//! `publish_pending` against a real PostgreSQL and a fake broker.
//! `sqlx::test` creates a throwaway database per test from `DATABASE_URL`'s
//! server; the database `DATABASE_URL` names is never touched.

use std::sync::Mutex;

use chrono::{NaiveDate, NaiveDateTime};
use queue_killmail_refs::{detail_body, publish_pending, Broker, QueueDepth};
use sqlx::PgPool;

fn now() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 11, 26)
        .unwrap()
        .and_hms_opt(10, 0, 0)
        .unwrap()
}

#[derive(Default)]
struct FakeBroker {
    consumers: u32,
    messages: u32,
    refuse: bool,
    published: Mutex<Vec<Vec<u8>>>,
}

impl Broker for FakeBroker {
    async fn depth(&self) -> anyhow::Result<QueueDepth> {
        Ok(QueueDepth {
            messages: self.messages,
            consumers: self.consumers,
        })
    }

    async fn publish_confirmed(&self, bodies: &[Vec<u8>]) -> anyhow::Result<()> {
        if self.refuse {
            anyhow::bail!("the broker refused the batch");
        }
        self.published.lock().unwrap().extend_from_slice(bodies);
        Ok(())
    }
}

async fn ref_row(pool: &PgPool, id: i32) {
    sqlx::query(
        "INSERT INTO killmail_refs (killmail_id, killmail_hash, source, discovered_at)
         VALUES ($1, $2, 'character', $3)",
    )
    .bind(id)
    .bind(format!("h{id}"))
    .bind(now())
    .execute(pool)
    .await
    .unwrap();
}

async fn rounds(pool: &PgPool) -> Vec<(i32, i32)> {
    sqlx::query_as("SELECT killmail_id, queued_count FROM killmail_refs ORDER BY killmail_id")
        .fetch_all(pool)
        .await
        .unwrap()
}

#[test]
fn the_body_matches_the_node_publisher() {
    let body = detail_body(&killmail_refs::Ref {
        killmail_id: 133900250,
        killmail_hash: "abc".to_owned(),
    });
    assert_eq!(
        std::str::from_utf8(&body).unwrap(),
        r#"{"killmailId":133900250,"killmailHash":"abc","announce":false}"#
    );
}

#[sqlx::test(migrations = false, fixtures("killmail_refs", "killmails"))]
async fn no_consumer_skips_the_tick(pool: PgPool) {
    ref_row(&pool, 1).await;
    let broker = FakeBroker::default();

    assert_eq!(publish_pending(&pool, &broker, now()).await.unwrap(), 0);
    assert!(broker.published.lock().unwrap().is_empty());
    assert_eq!(rounds(&pool).await, [(1, 0)]);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs", "killmails"))]
async fn waits_while_the_detail_queue_still_holds_messages(pool: PgPool) {
    ref_row(&pool, 1).await;
    let broker = FakeBroker {
        consumers: 1,
        messages: 3,
        ..FakeBroker::default()
    };

    assert_eq!(publish_pending(&pool, &broker, now()).await.unwrap(), 0);
    assert!(broker.published.lock().unwrap().is_empty());
    assert_eq!(rounds(&pool).await, [(1, 0)]);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs", "killmails"))]
async fn publishes_pending_refs_and_counts_the_round(pool: PgPool) {
    ref_row(&pool, 1).await;
    ref_row(&pool, 2).await;
    let broker = FakeBroker {
        consumers: 1,
        ..FakeBroker::default()
    };

    assert_eq!(publish_pending(&pool, &broker, now()).await.unwrap(), 2);
    assert_eq!(broker.published.lock().unwrap().len(), 2);
    assert_eq!(rounds(&pool).await, [(1, 1), (2, 1)]);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs", "killmails"))]
async fn a_refused_batch_leaves_the_counters_alone(pool: PgPool) {
    ref_row(&pool, 1).await;
    let broker = FakeBroker {
        consumers: 1,
        refuse: true,
        ..FakeBroker::default()
    };

    assert!(publish_pending(&pool, &broker, now()).await.is_err());
    assert_eq!(rounds(&pool).await, [(1, 0)]);
}

#[sqlx::test(migrations = false, fixtures("killmail_refs", "killmails"))]
async fn nothing_pending_publishes_nothing(pool: PgPool) {
    let broker = FakeBroker {
        consumers: 1,
        ..FakeBroker::default()
    };

    assert_eq!(publish_pending(&pool, &broker, now()).await.unwrap(), 0);
    assert!(broker.published.lock().unwrap().is_empty());
}
