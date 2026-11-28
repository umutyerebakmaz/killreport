//! The stream loop's one step (spec §1–§3): where it starts, when the
//! sequence moves and is saved, and how long it waits after each answer.

mod common;

use std::time::Duration;

use common::*;
use pubsub::RedisPubSub;
use serde_json::json;
use sqlx::PgPool;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use worker_redisq::cursor;
use worker_redisq::process::{Processor, Settled};
use worker_redisq::r2z2::R2z2;
use worker_redisq::run::{error_delay, Stream, Tick};

const SEQ: i64 = 96_000_000;

fn processor(pool: PgPool, esi_server: &MockServer) -> Processor {
    Processor {
        pool,
        esi: esi(esi_server),
        pubsub: RedisPubSub::new(None),
        enrichment: false,
    }
}

async fn head(server: &MockServer, sequence: i64) {
    Mock::given(method("GET"))
        .and(path("/sequence.json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "sequence": sequence })))
        .mount(server)
        .await;
}

async fn file(server: &MockServer, sequence: i64, response: ResponseTemplate, times: u64) {
    Mock::given(method("GET"))
        .and(path(format!("/{sequence}.json")))
        .respond_with(response)
        .expect(times)
        .mount(server)
        .await;
}

fn killmail() -> ResponseTemplate {
    ResponseTemplate::new(200).set_body_json(json!({
        "killmail_id": ID,
        "zkb": { "hash": HASH },
        "esi": detail_json()
    }))
}

async fn start(pool: &PgPool, r2z2: &MockServer, esi: &MockServer) -> Stream {
    Stream::start(R2z2::new(&r2z2.uri()), processor(pool.clone(), esi), noon())
        .await
        .unwrap()
}

macro_rules! stream_test {
    ($name:ident, $body:expr) => {
        #[sqlx::test(
            migrations = false,
            fixtures(
                "stream_cursors",
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
                "killmail_refs"
            )
        )]
        async fn $name(pool: PgPool) {
            ($body)(pool).await
        }
    };
}

stream_test!(
    starts_from_the_head_without_a_cursor_row,
    |pool: PgPool| async move {
        let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
        head(&r2z2, SEQ).await;

        let stream = start(&pool, &r2z2, &esi).await;

        assert_eq!(stream.sequence(), SEQ);
        assert_eq!(cursor::load(&pool).await.unwrap(), Some(SEQ));
    }
);

stream_test!(resumes_from_the_saved_cursor, |pool: PgPool| async move {
    let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
    head(&r2z2, SEQ + 500).await;
    cursor::save(&pool, SEQ, noon()).await.unwrap();

    assert_eq!(start(&pool, &r2z2, &esi).await.sequence(), SEQ);
});

stream_test!(
    a_settled_killmail_advances_and_saves_the_cursor,
    |pool: PgPool| async move {
        let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
        head(&r2z2, SEQ).await;
        file(&r2z2, SEQ, killmail(), 1).await;
        let mut stream = start(&pool, &r2z2, &esi).await;

        let tick = stream.step(&Recorder::default(), noon()).await.unwrap();

        assert_eq!(tick, Tick::Settled(Settled::Saved { announced: 1 }));
        assert_eq!(tick.delay(), Duration::from_millis(100));
        assert_eq!(stream.sequence(), SEQ + 1);
        assert_eq!(cursor::load(&pool).await.unwrap(), Some(SEQ + 1));
    }
);

stream_test!(
    a_network_error_does_not_advance,
    |pool: PgPool| async move {
        let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
        head(&r2z2, SEQ).await;
        file(&r2z2, SEQ, ResponseTemplate::new(500), 1).await;
        let mut stream = start(&pool, &r2z2, &esi).await;

        assert!(stream.step(&Recorder::default(), noon()).await.is_err());
        assert_eq!(stream.sequence(), SEQ);
        assert_eq!(cursor::load(&pool).await.unwrap(), Some(SEQ));
    }
);

#[sqlx::test(migrations = false, fixtures("stream_cursors"))]
async fn a_failing_ref_write_does_not_advance(pool: PgPool) {
    // No killmail_refs table: the killmail can be written nowhere.
    let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
    head(&r2z2, SEQ).await;
    file(
        &r2z2,
        SEQ,
        ResponseTemplate::new(200)
            .set_body_json(json!({ "killmail_id": ID, "zkb": { "hash": HASH } })),
        1,
    )
    .await;
    Mock::given(method("GET"))
        .and(path(format!("/killmails/{ID}/{HASH}/")))
        .respond_with(ResponseTemplate::new(500))
        .mount(&esi)
        .await;
    let mut stream = start(&pool, &r2z2, &esi).await;

    assert!(stream.step(&Recorder::default(), noon()).await.is_err());
    assert_eq!(stream.sequence(), SEQ);
    assert_eq!(cursor::load(&pool).await.unwrap(), Some(SEQ));
}

stream_test!(
    a_restart_after_a_saved_killmail_does_not_announce_it_again,
    |pool: PgPool| async move {
        let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
        head(&r2z2, SEQ).await;
        file(&r2z2, SEQ, killmail(), 1).await;
        file(&r2z2, SEQ + 1, ResponseTemplate::new(404), 1).await;
        let outbox = Recorder::default();

        let mut first = start(&pool, &r2z2, &esi).await;
        first.step(&outbox, noon()).await.unwrap();
        drop(first);

        let mut second = start(&pool, &r2z2, &esi).await;
        assert_eq!(second.sequence(), SEQ + 1);
        assert_eq!(second.step(&outbox, noon()).await.unwrap(), Tick::Empty);

        assert_eq!(outbox.calls().len(), 1);
    }
);

stream_test!(
    a_404_with_the_head_behind_waits_six_seconds,
    |pool: PgPool| async move {
        let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
        head(&r2z2, SEQ).await;
        file(&r2z2, SEQ, ResponseTemplate::new(404), 1).await;
        let mut stream = start(&pool, &r2z2, &esi).await;

        let tick = stream.step(&Recorder::default(), noon()).await.unwrap();
        assert_eq!(tick, Tick::Empty);
        assert_eq!(tick.delay(), Duration::from_secs(6));
        assert_eq!(stream.sequence(), SEQ);
    }
);

stream_test!(
    a_404_with_the_head_ahead_skips_on_the_third_try_and_saves,
    |pool: PgPool| async move {
        let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
        head(&r2z2, SEQ + 5).await;
        cursor::save(&pool, SEQ, noon()).await.unwrap();
        file(&r2z2, SEQ, ResponseTemplate::new(404), 3).await;
        let mut stream = start(&pool, &r2z2, &esi).await;

        assert_eq!(
            stream.step(&Recorder::default(), noon()).await.unwrap(),
            Tick::Empty
        );
        assert_eq!(
            stream.step(&Recorder::default(), noon()).await.unwrap(),
            Tick::Empty
        );
        let tick = stream.step(&Recorder::default(), noon()).await.unwrap();

        assert_eq!(tick, Tick::Skipped);
        assert_eq!(tick.delay(), Duration::from_millis(100));
        assert_eq!(cursor::load(&pool).await.unwrap(), Some(SEQ + 1));
    }
);

stream_test!(an_unreadable_body_is_skipped, |pool: PgPool| async move {
    let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
    head(&r2z2, SEQ).await;
    file(
        &r2z2,
        SEQ,
        ResponseTemplate::new(200).set_body_string("<html>"),
        1,
    )
    .await;
    let mut stream = start(&pool, &r2z2, &esi).await;

    assert_eq!(
        stream.step(&Recorder::default(), noon()).await.unwrap(),
        Tick::Unreadable
    );
    assert_eq!(cursor::load(&pool).await.unwrap(), Some(SEQ + 1));
});

stream_test!(rate_limited_waits_five_seconds, |pool: PgPool| async move {
    let (r2z2, esi) = (MockServer::start().await, MockServer::start().await);
    head(&r2z2, SEQ).await;
    file(&r2z2, SEQ, ResponseTemplate::new(429), 1).await;
    let mut stream = start(&pool, &r2z2, &esi).await;

    let tick = stream.step(&Recorder::default(), noon()).await.unwrap();
    assert_eq!(tick, Tick::RateLimited);
    assert_eq!(tick.delay(), Duration::from_secs(5));
    assert_eq!(stream.sequence(), SEQ);
});

#[test]
fn errors_wait_a_hundred_milliseconds_and_five_seconds_every_fifth() {
    let delays: Vec<u64> = (1..=10)
        .map(|n| error_delay(n).as_millis() as u64)
        .collect();
    assert_eq!(
        delays,
        vec![100, 100, 100, 100, 5000, 100, 100, 100, 100, 5000]
    );
}
