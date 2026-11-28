//! Enrichment before the save (spec §4): which IDs are missing, what is
//! fetched, in what order, and where a refusal goes.

mod common;

use common::*;
use sqlx::PgPool;
use wiremock::matchers::{method, path, path_regex};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_redisq::enrich::{enrich, missing, Missing};

#[sqlx::test(
    migrations = false,
    fixtures("characters", "corporations", "alliances", "types")
)]
async fn missing_lists_only_ids_not_in_the_database(pool: PgPool) {
    let server = MockServer::start().await;
    mount_entities(&server).await;
    entity_info::alliance::fetch_and_upsert(&pool, &esi(&server), 99000001)
        .await
        .unwrap();

    let mut detail = detail();
    detail.attackers[0].character_id = None;
    detail.victim.items[0].item_type_id = Some(0);

    assert_eq!(
        missing(&pool, &detail).await.unwrap(),
        Missing {
            alliances: vec![99000002],
            corporations: vec![98000001, 98000002],
            characters: vec![2001],
            types: vec![587, 588, 2488],
        }
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "corporations", "alliances", "types")
)]
async fn missing_entities_are_fetched_and_written(pool: PgPool) {
    let server = MockServer::start().await;
    mount_entities(&server).await;
    let outbox = Recorder::default();

    let enriched = enrich(&pool, &esi(&server), &outbox, &detail())
        .await
        .unwrap();

    assert_eq!((enriched.written, enriched.failed), (10, 0));
    assert_eq!(count(&pool, "characters").await, 2);
    assert_eq!(count(&pool, "corporations").await, 2);
    assert_eq!(count(&pool, "alliances").await, 2);
    assert_eq!(count(&pool, "types").await, 4);
    assert!(outbox.calls().is_empty());
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "corporations", "alliances", "types")
)]
async fn an_entity_esi_refuses_is_queued_to_its_info_queue(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/characters/2001/"))
        .respond_with(ResponseTemplate::new(404))
        .mount(&server)
        .await;
    mount_entities(&server).await;
    let outbox = Recorder::default();

    let enriched = enrich(&pool, &esi(&server), &outbox, &detail())
        .await
        .unwrap();

    assert_eq!((enriched.written, enriched.failed), (9, 1));
    assert_eq!(
        outbox.calls(),
        vec![("esi_character_info_queue".to_owned(), vec![2001])]
    );
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "corporations", "alliances", "types")
)]
async fn a_failed_queue_publish_is_only_logged(pool: PgPool) {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path_regex("^/characters/"))
        .respond_with(ResponseTemplate::new(404))
        .mount(&server)
        .await;
    mount_entities(&server).await;

    let enriched = enrich(&pool, &esi(&server), &Recorder::failing(), &detail())
        .await
        .unwrap();
    assert_eq!((enriched.written, enriched.failed), (8, 2));
}

#[sqlx::test(
    migrations = false,
    fixtures("characters", "corporations", "alliances", "types")
)]
async fn alliances_then_corporations_then_characters_then_types(pool: PgPool) {
    let server = MockServer::start().await;
    mount_entities(&server).await;

    enrich(&pool, &esi(&server), &Recorder::default(), &detail())
        .await
        .unwrap();

    let order: Vec<usize> = server
        .received_requests()
        .await
        .unwrap()
        .iter()
        .map(|r| match r.url.path() {
            p if p.starts_with("/alliances") => 0,
            p if p.starts_with("/corporations") => 1,
            p if p.starts_with("/characters") => 2,
            _ => 3,
        })
        .collect();
    let mut sorted = order.clone();
    sorted.sort();
    assert_eq!(order.len(), 10);
    assert_eq!(order, sorted);
}
