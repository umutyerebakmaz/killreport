//! The character killmail sync's parts, split from the binary so the tests
//! can reach them: the sync and `handle_message`.

use chrono::{NaiveDateTime, Utc};
use esi::{EsiClient, EsiError};
use killmail_refs::{walk, Walk};
use runner::{Context, EntityQueueMessage, Outcome, Processed, Worker};
use sqlx::PgPool;
use sso::{load_credentials, Credentials, SsoClient};
use tracing::warn;

pub struct UserKillmailWorker {
    pub pool: PgPool,
    pub esi: EsiClient,
    pub sso: SsoClient,
}

/// What one sync did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Synced {
    Synced(Walk),
    /// Nothing to do until the user logs in again; acked.
    Skipped(&'static str),
}

/// One user's character sync: record what ESI lists in `killmail_refs`, then
/// stamp `last_killmail_sync_at`. A never-synced user, or `full_sync`, walks
/// every page. A failure part-way keeps the pages already recorded and returns
/// before the stamp, so the user is selected again. `now` is UTC.
pub async fn sync_user(
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

    let full_sync = full_sync || user.last_killmail_sync_at.is_none();
    let path = format!("/characters/{}/killmails/recent/", user.character_id);
    let bucket = user.character_id.to_string();
    let walked = match walk(
        |page| esi.get_page_authed(&path, page, &access_token, &bucket),
        pool,
        "character",
        full_sync,
        now,
    )
    .await
    {
        Ok(walked) => walked,
        // The token lacks esi-killmails.read_killmails.v1. No retry helps; a
        // login with the scope does. Stamped, so the cron waits its 15 minutes.
        Err(error)
            if matches!(
                error.downcast_ref::<EsiError>(),
                Some(EsiError::Http { status: 403, .. })
            ) =>
        {
            stamp(pool, user.id, now).await?;
            warn!(
                "  ! {}: ESI returned 403 - missing esi-killmails.read_killmails.v1. skipping.",
                user.character_name
            );
            return Ok(Synced::Skipped("403, scope missing"));
        }
        Err(error) => return Err(error),
    };
    if walked.capped {
        warn!(
            "  ⚠️  {}: stopped at the page cap; older killmails were not read",
            user.character_name
        );
    }

    stamp(pool, user.id, now).await?;
    Ok(Synced::Synced(walked))
}

async fn stamp(pool: &PgPool, user_id: i32, now: NaiveDateTime) -> sqlx::Result<()> {
    sqlx::query("UPDATE users SET last_killmail_sync_at = $2, updated_at = $2 WHERE id = $1")
        .bind(user_id)
        .bind(now)
        .execute(pool)
        .await?;
    Ok(())
}

/// The runner's view of a sync: `Updated` when it ran, `Unchanged` when there
/// was nothing to do.
pub fn processed(user_id: i32, synced: Synced) -> Processed {
    match synced {
        Synced::Synced(w) => Processed {
            outcome: Outcome::Updated,
            detail: format!(
                " user {user_id}: {} listed on {} page(s), {} new",
                w.found, w.pages, w.inserted
            ),
        },
        Synced::Skipped(why) => Processed {
            outcome: Outcome::Unchanged,
            detail: format!(" user {user_id} ({why})"),
        },
    }
}

impl UserKillmailWorker {
    async fn run(&self, user_id: i32, full_sync: bool) -> anyhow::Result<Processed> {
        let now = Utc::now().naive_utc();
        let synced = sync_user(&self.pool, &self.esi, &self.sso, user_id, full_sync, now).await?;
        Ok(processed(user_id, synced))
    }
}

impl Worker for UserKillmailWorker {
    const QUEUE_NAME: &'static str = "esi_user_killmails_queue";
    const CONSUMER_TAG: &'static str = "worker-user-killmails-rs";
    const STARTED: &'static str = "🔄 ESI user killmail worker started";
    const WAITING_FOR: &'static str = "user killmail jobs";
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
