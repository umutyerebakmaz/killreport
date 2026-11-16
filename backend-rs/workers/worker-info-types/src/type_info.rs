//! What ESI says about a type, and the one statement that stores it.

use serde::Deserialize;
use sqlx::PgPool;

/// `GET /universe/types/{id}/`, the fields `worker-info-types.ts` stores.
/// ESI's dogma attributes and effects, market group, packaged volume and the
/// rest are ignored, as in Node.
///
/// ESI marks `description` as required, but the column is nullable and a
/// missing one must not fail the whole message, so it is read as optional
/// like the rest.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct TypeInfo {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub group_id: i32,
    pub published: bool,
    #[serde(default)]
    pub volume: Option<f64>,
    #[serde(default)]
    pub capacity: Option<f64>,
    #[serde(default)]
    pub mass: Option<f64>,
    #[serde(default)]
    pub icon_id: Option<i32>,
}

/// Insert or update one type; `true` if it was new.
///
/// The Node worker never updates a type: it skips one that already exists
/// (`worker-info-types.ts:96-104`). Here the skip lives in the queue instead,
/// which publishes only the types missing from the table, so an existing row
/// reaches this statement only in a race or when an ID is queued by hand,
/// and then it takes ESI's current values.
///
/// - `updated_at` is set on insert *and* on update: the column has no
///   database default (`@updatedAt` is Prisma's). `created_at` is the
///   database default.
/// - `meta_group_id` is never written. `yarn sde:meta-groups` fills it from
///   the Static Data Export; ESI does not carry it.
///
/// `xmax = 0` holds only for a row this statement inserted.
pub async fn upsert_type(pool: &PgPool, id: i32, info: &TypeInfo) -> Result<bool, sqlx::Error> {
    let inserted = sqlx::query_scalar!(
        r#"
        INSERT INTO types (
          id, name, description, group_id, published, volume, capacity, mass,
          icon_id, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          name        = EXCLUDED.name,
          description = EXCLUDED.description,
          group_id    = EXCLUDED.group_id,
          published   = EXCLUDED.published,
          volume      = EXCLUDED.volume,
          capacity    = EXCLUDED.capacity,
          mass        = EXCLUDED.mass,
          icon_id     = EXCLUDED.icon_id,
          updated_at  = now()
        RETURNING (xmax = 0) AS "inserted!"
        "#,
        id,
        info.name,
        info.description,
        info.group_id,
        info.published,
        info.volume,
        info.capacity,
        info.mass,
        info.icon_id,
    )
    .fetch_one(pool)
    .await?;
    Ok(inserted)
}
