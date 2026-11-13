//! The database pool a worker uses.
//!
//! Mirrors `backend/src/services/prisma-worker.ts`: workers get a small pool
//! of their own and give connections back quickly, because the managed
//! PostgreSQL connection limit is shared by the API and every worker process.

use std::time::Duration;

use sqlx::postgres::{PgPool, PgPoolOptions};

/// At most this many connections per worker process (`prisma-worker.ts:28`, `max: 2`).
pub const MAX_CONNECTIONS: u32 = 2;
/// No connection is kept open while idle (`prisma-worker.ts:29`, `min: 0`).
pub const MIN_CONNECTIONS: u32 = 0;
/// An idle connection is closed after this long (`prisma-worker.ts:30`, `idleTimeoutMillis: 10000`).
pub const IDLE_TIMEOUT: Duration = Duration::from_secs(10);
/// Waiting for a free connection gives up after this long (`prisma-worker.ts:31`, `connectionTimeoutMillis: 10000`).
pub const ACQUIRE_TIMEOUT: Duration = Duration::from_secs(10);

/// The pool settings, without connecting. Split out so a test can check them.
pub fn worker_pool_options() -> PgPoolOptions {
    PgPoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .min_connections(MIN_CONNECTIONS)
        .idle_timeout(IDLE_TIMEOUT)
        .acquire_timeout(ACQUIRE_TIMEOUT)
}

/// Open the worker pool and log its settings the way the Node worker does.
///
/// Connects lazily: the first query opens the first connection, as `pg.Pool`
/// does, so a worker can start while the database is still coming up and the
/// failure surfaces on the first message instead of at startup.
pub fn worker_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let pool = worker_pool_options().connect_lazy(database_url)?;
    tracing::info!(
        "✅ [worker] PostgreSQL pool configured: max={MAX_CONNECTIONS} connections, min={MIN_CONNECTIONS}, idleTimeout={}s, pid={}",
        IDLE_TIMEOUT.as_secs(),
        std::process::id()
    );
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn options_match_the_node_worker_pool() {
        let options = worker_pool_options();
        assert_eq!(options.get_max_connections(), 2);
        assert_eq!(options.get_min_connections(), 0);
        assert_eq!(options.get_idle_timeout(), Some(Duration::from_secs(10)));
        assert_eq!(options.get_acquire_timeout(), Duration::from_secs(10));
    }

    /// Needs a reachable PostgreSQL in `DATABASE_URL`:
    /// `cargo test -p db -- --ignored`.
    #[tokio::test]
    #[ignore = "needs a running PostgreSQL in DATABASE_URL"]
    async fn connects_and_runs_a_query() {
        let url = std::env::var("DATABASE_URL").expect("DATABASE_URL is not set");
        let pool = worker_pool(&url).expect("pool");
        let one: i32 = sqlx::query_scalar("SELECT 1")
            .fetch_one(&pool)
            .await
            .expect("query");
        assert_eq!(one, 1);
        pool.close().await;
    }
}
