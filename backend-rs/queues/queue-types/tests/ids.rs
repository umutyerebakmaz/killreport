//! Which type IDs get queued: ESI's list minus what the table already holds.
//! `sqlx::test` creates a throwaway database per test from `DATABASE_URL`'s
//! server; the database `DATABASE_URL` names is never touched.

use std::collections::HashSet;

use queue_types::{existing_type_ids, missing};
use sqlx::PgPool;

#[test]
fn missing_keeps_esi_order_and_drops_existing_and_repeats() {
    let existing = HashSet::from([3, 1]);
    assert_eq!(missing(&[5, 3, 9, 3, 1, 5], &existing), [5, 9]);
}

#[test]
fn nothing_is_missing_when_the_table_has_everything() {
    let existing = HashSet::from([1, 2]);
    assert!(missing(&[2, 1], &existing).is_empty());
}

#[sqlx::test(migrations = false, fixtures("types"))]
async fn existing_type_ids_reads_the_table(pool: PgPool) {
    sqlx::query(
        "INSERT INTO types (id, name, group_id, updated_at)
         VALUES (587, 'Rifter', 25, now()), (588, 'Reaper', 237, now())",
    )
    .execute(&pool)
    .await
    .unwrap();

    assert_eq!(
        existing_type_ids(&pool).await.unwrap(),
        HashSet::from([587, 588])
    );
}
