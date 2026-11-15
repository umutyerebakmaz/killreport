//! Which corporation IDs get queued: from the arguments, or from the table.
//! `sqlx::test` creates a throwaway database per test from `DATABASE_URL`'s
//! server; the database `DATABASE_URL` names is never touched.

use queue_corporations::{all_corporation_ids, parse_ids};
use sqlx::PgPool;

fn args(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}

#[test]
fn parse_ids_keeps_valid_numbers() {
    assert_eq!(parse_ids(&args(&["123", "abc", "456"])), [123, 456]);
}

#[test]
fn parse_ids_rejects_partial_numbers() {
    assert!(parse_ids(&args(&["12abc"])).is_empty());
}

#[sqlx::test(migrations = false, fixtures("corporations", "corporation_rows"))]
async fn all_ids_in_order(pool: PgPool) {
    assert_eq!(
        all_corporation_ids(&pool).await.unwrap(),
        [98000001, 98000002, 98000003]
    );
}

#[sqlx::test(migrations = false, fixtures("corporations"))]
async fn empty_table_is_empty(pool: PgPool) {
    assert!(all_corporation_ids(&pool).await.unwrap().is_empty());
}
