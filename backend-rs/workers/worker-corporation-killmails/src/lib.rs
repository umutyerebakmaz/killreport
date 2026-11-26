//! The corporation killmail sync's parts, split from the binary so the tests
//! can reach them: the sync and `handle_message`.

use chrono::{NaiveDateTime, Utc};
use esi::{EsiClient, EsiError};
use killmail_refs::{walk, Walk};
use runner::{Context, EntityQueueMessage, Outcome, Processed, Worker};
use sqlx::PgPool;
use sso::{load_credentials, Credentials, SsoClient};
use tracing::warn;

pub struct CorporationKillmailWorker {
    pub pool: PgPool,
    pub esi: EsiClient,
    pub sso: SsoClient,
}

/// What one sync did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Synced {
    /// The walk, and whose list it was, for the log line.
    Synced { walk: Walk, character_name: String },
    /// Nothing to do: no usable token, no corporation known yet, or an NPC
    /// corporation. Acked.
    Skipped(&'static str),
    /// ESI answered 403 (not a Director/CEO, or the scope is missing);
    /// recorded in `corp_killmails_denied_at` until the next login.
    Denied,
}

/// NPC corporations: no corporation killmails, and ESI answers 403.
pub fn is_npc_corporation(id: i32) -> bool {
    (1_000_000..2_000_000).contains(&id)
}

async fn stamp(pool: &PgPool, user_id: i32, now: NaiveDateTime) -> sqlx::Result<()> {
    sqlx::query("UPDATE users SET last_corp_killmail_sync_at = $2, updated_at = $2 WHERE id = $1")
        .bind(user_id)
        .bind(now)
        .execute(pool)
        .await?;
    Ok(())
}

/// One user's corporation sync. The corporation comes from `characters`, kept
/// current by `worker:info:characters` (`users.corporation_id` was never
/// written). Records what ESI lists in `killmail_refs`, then stamps
/// `last_corp_killmail_sync_at`. `now` is UTC.
pub async fn sync_corporation(
    pool: &PgPool,
    esi: &EsiClient,
    sso: &SsoClient,
    user_id: i32,
    full_sync: bool,
    now: NaiveDateTime,
) -> anyhow::Result<Synced> {
    let (user, access_token) = match load_credentials(pool, sso, user_id, now).await? {
        Credentials::Ok { user, access_token } => (user, access_token),
        Credentials::NotFound => return Ok(Synced::Skipped("user not found")),
        Credentials::NoRefreshToken => return Ok(Synced::Skipped("no refresh token")),
        Credentials::Revoked => return Ok(Synced::Skipped("grant revoked")),
    };

    let corporation: Option<i32> =
        sqlx::query_scalar("SELECT corporation_id FROM characters WHERE id = $1")
            .bind(user.character_id)
            .fetch_optional(pool)
            .await?;
    let corporation_id = match corporation {
        None => {
            stamp(pool, user.id, now).await?;
            return Ok(Synced::Skipped("character not fetched yet"));
        }
        Some(id) if is_npc_corporation(id) => {
            stamp(pool, user.id, now).await?;
            return Ok(Synced::Skipped("NPC corporation"));
        }
        Some(id) => id,
    };

    let full_sync = full_sync || user.last_corp_killmail_sync_at.is_none();
    let path = format!("/corporations/{corporation_id}/killmails/recent/");
    let bucket = user.character_id.to_string();
    let walked = walk(
        |page| esi.get_page_authed(&path, page, &access_token, &bucket),
        pool,
        "corporation",
        full_sync,
        now,
    )
    .await;

    let walked = match walked {
        Ok(walked) => walked,
        Err(error)
            if matches!(
                error.downcast_ref::<EsiError>(),
                Some(EsiError::Http { status: 403, .. })
            ) =>
        {
            sqlx::query(
                "UPDATE users SET corp_killmails_denied_at = $2, last_corp_killmail_sync_at = $2,
                                  updated_at = $2
                 WHERE id = $1",
            )
            .bind(user.id)
            .bind(now)
            .execute(pool)
            .await?;
            warn!(
                "  ! {}: ESI returned 403 - not a Director/CEO, or missing esi-killmails.read_corporation_killmails.v1. not retried until the next login.",
                user.character_name
            );
            return Ok(Synced::Denied);
        }
        Err(error) => return Err(error),
    };
    if walked.capped {
        warn!("  ⚠️  corporation {corporation_id}: stopped at the page cap; older killmails were not read");
    }

    stamp(pool, user.id, now).await?;
    Ok(Synced::Synced {
        walk: walked,
        character_name: user.character_name,
    })
}

/// The runner's view of a sync.
pub fn processed(user_id: i32, synced: Synced) -> Processed {
    match synced {
        Synced::Synced {
            walk: w,
            character_name,
        } => Processed {
            outcome: Outcome::Updated,
            detail: format!(
                " {character_name} (user {user_id}): {} listed on {} page(s), {} new",
                w.found, w.pages, w.inserted
            ),
        },
        Synced::Skipped(why) => Processed {
            outcome: Outcome::Unchanged,
            detail: format!(" user {user_id} ({why})"),
        },
        Synced::Denied => Processed {
            outcome: Outcome::Unchanged,
            detail: format!(" user {user_id} (403, not retried until the next login)"),
        },
    }
}

impl CorporationKillmailWorker {
    async fn run(&self, user_id: i32, full_sync: bool) -> anyhow::Result<Processed> {
        let now = Utc::now().naive_utc();
        let synced =
            sync_corporation(&self.pool, &self.esi, &self.sso, user_id, full_sync, now).await?;
        Ok(processed(user_id, synced))
    }
}

impl Worker for CorporationKillmailWorker {
    const QUEUE_NAME: &'static str = "esi_corporation_killmails_queue";
    const CONSUMER_TAG: &'static str = "worker-corporation-killmails-rs";
    const STARTED: &'static str = "🔄 ESI corporation killmail worker started";
    const WAITING_FOR: &'static str = "corporation killmail jobs";
    const ENTITY: &'static str = "user";

    async fn handle(&self, id: i32, _ctx: &Context<'_>) -> anyhow::Result<Processed> {
        self.run(id, false).await
    }

    async fn handle_message(
        &self,
        message: &EntityQueueMessage,
        _ctx: &Context<'_>,
    ) -> anyhow::Result<Processed> {
        self.run(message.entity_id, message.full_sync).await
    }
}
