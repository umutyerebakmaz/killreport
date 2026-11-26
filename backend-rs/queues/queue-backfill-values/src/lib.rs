//! The backfill queue publisher's testable parts: the flags, and which
//! killmails a run queues, page by page.

use killmail_value::CAPSULE_GROUP_ID;
use sqlx::PgPool;

/// The queue `worker-backfill-values` consumes.
pub const QUEUE_NAME: &str = "backfill_killmail_values_queue";
/// The `source` field of every message, the same as the Node script.
pub const SOURCE: &str = "queue-backfill-values";
/// Killmail IDs read and published per page.
pub const PAGE_SIZE: i64 = 500;

/// `--limit=N`, `--id=K`, `--capsules-only`, as the Node script takes them.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Args {
    pub limit: Option<i64>,
    pub id: Option<i32>,
    pub capsules_only: bool,
}

/// The flags, or why they are refused. Node read a bad number as `NaN` and
/// went on; here a value that is not a positive integer, and any flag the
/// script does not know, stops the run before it queues anything.
pub fn parse_args(args: &[String]) -> Result<Args, String> {
    let mut parsed = Args::default();
    for arg in args {
        if arg == "--capsules-only" {
            parsed.capsules_only = true;
        } else if let Some(value) = arg.strip_prefix("--limit=") {
            parsed.limit = Some(positive(value, "--limit")?);
        } else if let Some(value) = arg.strip_prefix("--id=") {
            let id = positive(value, "--id")?;
            parsed.id = Some(i32::try_from(id).map_err(|_| format!("--id is too large: {value}"))?);
        } else {
            return Err(format!(
                "unknown argument {arg:?}; use --limit=N, --id=K, --capsules-only"
            ));
        }
    }
    Ok(parsed)
}

fn positive(value: &str, flag: &str) -> Result<i64, String> {
    match value.parse::<i64>() {
        Ok(n) if n > 0 => Ok(n),
        _ => Err(format!("{flag} must be a positive integer, got {value:?}")),
    }
}

/// How many killmails match, and the largest ID among them when the run
/// starts. Pages never go above that ID, so killmails saved while the run
/// is going neither shift the pages nor push older ones past `--limit`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Target {
    pub count: i64,
    pub max_id: Option<i32>,
}

/// The filter both queries share: `$1` the single ID or NULL, `$2` capsules
/// only. A capsule is a victim ship in group 29, the same test the formula
/// uses, so the Genolution pod is one too.
const FILTER: &str = "($1::int IS NULL OR k.killmail_id = $1)
    AND (NOT $2 OR EXISTS (
        SELECT 1 FROM victims v JOIN types t ON t.id = v.ship_type_id
        WHERE v.killmail_id = k.killmail_id AND t.group_id = $3))";

pub async fn target(pool: &PgPool, args: &Args) -> sqlx::Result<Target> {
    let (count, max_id): (i64, Option<i32>) = sqlx::query_as(&format!(
        "SELECT COUNT(*), MAX(k.killmail_id) FROM killmails k WHERE {FILTER}"
    ))
    .bind(args.id)
    .bind(args.capsules_only)
    .bind(CAPSULE_GROUP_ID)
    .fetch_one(pool)
    .await?;
    Ok(Target { count, max_id })
}

/// Up to `take` matching killmail IDs below `below`, newest (largest) first.
/// The next page starts below the last ID of this one.
pub async fn page(pool: &PgPool, args: &Args, below: i32, take: i64) -> sqlx::Result<Vec<i32>> {
    sqlx::query_scalar(&format!(
        "SELECT k.killmail_id FROM killmails k
         WHERE {FILTER} AND k.killmail_id < $4
         ORDER BY k.killmail_id DESC
         LIMIT $5"
    ))
    .bind(args.id)
    .bind(args.capsules_only)
    .bind(CAPSULE_GROUP_ID)
    .bind(below)
    .bind(take)
    .fetch_all(pool)
    .await
}
