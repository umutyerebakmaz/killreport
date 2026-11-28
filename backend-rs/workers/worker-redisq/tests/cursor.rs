//! The durable position in `stream_cursors`.

use chrono::NaiveDate;
use sqlx::PgPool;
use worker_redisq::cursor;

fn noon() -> chrono::NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 11, 28)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap()
}

#[sqlx::test(migrations = false, fixtures("stream_cursors"))]
async fn load_is_none_without_a_row(pool: PgPool) {
    assert_eq!(cursor::load(&pool).await.unwrap(), None);
}

#[sqlx::test(migrations = false, fixtures("stream_cursors"))]
async fn save_then_load_returns_the_sequence(pool: PgPool) {
    cursor::save(&pool, 12_345_678_901, noon()).await.unwrap();
    assert_eq!(cursor::load(&pool).await.unwrap(), Some(12_345_678_901));
}

#[sqlx::test(migrations = false, fixtures("stream_cursors"))]
async fn save_overwrites_and_stamps_updated_at(pool: PgPool) {
    cursor::save(&pool, 1, noon()).await.unwrap();
    let later = noon() + chrono::Duration::minutes(5);
    cursor::save(&pool, 2, later).await.unwrap();

    let rows: Vec<(String, i64, chrono::NaiveDateTime)> =
        sqlx::query_as("SELECT stream, sequence, updated_at FROM stream_cursors")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(rows, vec![(cursor::STREAM.to_owned(), 2, later)]);
}
