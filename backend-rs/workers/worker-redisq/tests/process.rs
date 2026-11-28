//! One killmail from R2Z2 to the database (spec §3–§5): the embedded copy or
//! ESI, enrichment, the save, the announcement, and `killmail_refs` when the
//! save cannot happen.

mod common;

use common::*;
use pubsub::RedisPubSub;
use sqlx::PgPool;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_redisq::process::{Processor, Settled};
use worker_redisq::r2z2::Package;

fn processor(pool: PgPool, server: &MockServer, enrichment: bool) -> Processor {
    Processor {
        pool,
        esi: esi(server),
        pubsub: RedisPubSub::new(None),
        enrichment,
    }
}

fn package(esi: bool) -> Package {
    Package {
        killmail_id: ID,
        hash: HASH.to_owned(),
        esi: esi.then(detail),
    }
}

async fn mock_detail(server: &MockServer, response: ResponseTemplate) {
    Mock::given(method("GET"))
        .and(path(format!("/killmails/{ID}/{HASH}/")))
        .respond_with(response)
        .mount(server)
        .await;
}

async fn refs(pool: &PgPool) -> Vec<(i32, String, String)> {
    sqlx::query_as("SELECT killmail_id, killmail_hash, source FROM killmail_refs")
        .fetch_all(pool)
        .await
        .unwrap()
}

macro_rules! killmail_test {
    ($name:ident, $body:expr) => {
        #[sqlx::test(
            migrations = false,
            fixtures(
                "killmails",
                "victims",
                "attackers",
                "killmail_items",
                "killmail_filters",
                "character_kill_stats",
                "corporation_kill_stats",
                "alliance_kill_stats",
                "regions",
                "constellations",
                "solar_systems",
                "types",
                "item_groups",
                "categories",
                "market_prices",
                "characters",
                "corporations",
                "alliances",
                "killmail_refs"
            )
        )]
        async fn $name(pool: PgPool) {
            ($body)(pool).await
        }
    };
}

killmail_test!(
    a_package_with_an_esi_copy_is_saved_without_calling_esi,
    |pool: PgPool| async move {
        let server = MockServer::start().await;
        let outbox = Recorder::default();

        let settled = processor(pool.clone(), &server, false)
            .process(&outbox, &package(true), noon())
            .await
            .unwrap();

        assert_eq!(settled, Settled::Saved { announced: 1 });
        assert_eq!(count(&pool, "killmails").await, 1);
        assert!(server.received_requests().await.unwrap().is_empty());
    }
);

killmail_test!(
    a_package_without_one_is_fetched_from_esi,
    |pool: PgPool| async move {
        let server = MockServer::start().await;
        mock_detail(
            &server,
            ResponseTemplate::new(200).set_body_json(detail_json()),
        )
        .await;

        let settled = processor(pool.clone(), &server, false)
            .process(&Recorder::default(), &package(false), noon())
            .await
            .unwrap();

        assert_eq!(settled, Settled::Saved { announced: 1 });
        assert_eq!(count(&pool, "killmails").await, 1);
    }
);

killmail_test!(
    esi_failing_records_a_killmail_ref,
    |pool: PgPool| async move {
        let server = MockServer::start().await;
        mock_detail(&server, ResponseTemplate::new(500)).await;

        let settled = processor(pool.clone(), &server, false)
            .process(&Recorder::default(), &package(false), noon())
            .await
            .unwrap();

        assert_eq!(settled, Settled::Deferred);
        assert_eq!(
            refs(&pool).await,
            vec![(ID, HASH.to_owned(), "redisq".to_owned())]
        );
        assert_eq!(count(&pool, "killmails").await, 0);
    }
);

killmail_test!(
    a_save_error_records_a_killmail_ref,
    |pool: PgPool| async move {
        let server = MockServer::start().await;
        let mut body = detail_json();
        body["attackers"] = serde_json::json!([]);
        mock_detail(&server, ResponseTemplate::new(200).set_body_json(body)).await;

        let settled = processor(pool.clone(), &server, false)
            .process(&Recorder::default(), &package(false), noon())
            .await
            .unwrap();

        assert_eq!(settled, Settled::Deferred);
        assert_eq!(refs(&pool).await.len(), 1);
    }
);

killmail_test!(a_failing_ref_write_is_an_error, |pool: PgPool| async move {
    let server = MockServer::start().await;
    mock_detail(&server, ResponseTemplate::new(500)).await;
    let processor = processor(pool.clone(), &server, false);
    pool.close().await;

    assert!(processor
        .process(&Recorder::default(), &package(false), noon())
        .await
        .is_err());
});

killmail_test!(
    a_new_killmail_is_announced_to_discord,
    |pool: PgPool| async move {
        let server = MockServer::start().await;
        let outbox = Recorder::default();

        processor(pool, &server, false)
            .process(&outbox, &package(true), noon())
            .await
            .unwrap();

        assert_eq!(
            outbox.calls(),
            vec![("discord_webhook_queue".to_owned(), vec![ID])]
        );
    }
);

killmail_test!(
    a_failed_announcement_still_settles_as_saved,
    |pool: PgPool| async move {
        let server = MockServer::start().await;

        let settled = processor(pool.clone(), &server, false)
            .process(&Recorder::failing(), &package(true), noon())
            .await
            .unwrap();

        assert_eq!(settled, Settled::Saved { announced: 0 });
        assert_eq!(count(&pool, "killmails").await, 1);
    }
);

killmail_test!(
    an_already_stored_killmail_is_not_announced,
    |pool: PgPool| async move {
        let server = MockServer::start().await;
        let processor = processor(pool, &server, false);
        processor
            .process(&Recorder::default(), &package(true), noon())
            .await
            .unwrap();
        let outbox = Recorder::default();

        let settled = processor
            .process(&outbox, &package(true), noon())
            .await
            .unwrap();

        assert_eq!(settled, Settled::AlreadyStored);
        assert!(outbox.calls().is_empty());
    }
);

killmail_test!(
    enrichment_writes_the_names_before_the_killmail,
    |pool: PgPool| async move {
        let server = MockServer::start().await;
        mount_entities(&server).await;

        processor(pool.clone(), &server, true)
            .process(&Recorder::default(), &package(true), noon())
            .await
            .unwrap();

        assert_eq!(count(&pool, "characters").await, 2);
        assert_eq!(count(&pool, "killmails").await, 1);
    }
);

killmail_test!(enrichment_off_calls_no_esi, |pool: PgPool| async move {
    let server = MockServer::start().await;

    processor(pool.clone(), &server, false)
        .process(&Recorder::default(), &package(true), noon())
        .await
        .unwrap();

    assert!(server.received_requests().await.unwrap().is_empty());
    assert_eq!(count(&pool, "characters").await, 0);
});
