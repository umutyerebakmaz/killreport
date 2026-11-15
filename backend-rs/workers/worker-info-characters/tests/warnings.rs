//! What `title_fields` logs when it drops a value. Node interpolates the
//! value with `String(value)`, so a string reads bare, without JSON quotes.
//!
//! Its own test binary: capturing needs the one global subscriber below.

use std::sync::{Arc, Mutex};

use chrono::{TimeZone, Utc};
use serde_json::{json, Value};
use worker_info_characters::character::{title_fields, CharacterInfo};

thread_local! {
    /// The lines of the `capture_warnings` call active on this thread, if any.
    static CAPTURED: std::cell::RefCell<Option<Arc<Mutex<Vec<String>>>>> =
        const { std::cell::RefCell::new(None) };
}

/// Writes each formatted line to this thread's capture; drops it when none.
struct ThreadSink;
impl std::io::Write for ThreadSink {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let line = String::from_utf8_lossy(buf).trim().to_owned();
        if !line.is_empty() {
            CAPTURED.with(|captured| {
                if let Some(lines) = captured.borrow().as_ref() {
                    lines.lock().unwrap().push(line);
                }
            });
        }
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Every WARN logged on this thread while `f` runs. One global subscriber,
/// installed once, routes lines to the capturing thread, as in
/// `crates/esi/tests/limiter.rs`.
fn warnings_during(f: impl FnOnce()) -> Vec<String> {
    static INSTALL: std::sync::Once = std::sync::Once::new();
    INSTALL.call_once(|| {
        let subscriber = tracing_subscriber::fmt()
            .with_max_level(tracing::Level::WARN)
            .with_ansi(false)
            .without_time()
            .with_writer(|| ThreadSink)
            .finish();
        tracing::subscriber::set_global_default(subscriber)
            .expect("no other global subscriber in this test binary");
    });
    let lines = Arc::new(Mutex::new(Vec::new()));
    CAPTURED.with(|captured| *captured.borrow_mut() = Some(Arc::clone(&lines)));
    f();
    CAPTURED.with(|captured| *captured.borrow_mut() = None);
    let lines = lines.lock().unwrap().clone();
    lines
}

fn with(character_title_id: Option<Value>, achievement_score: Option<Value>) -> CharacterInfo {
    CharacterInfo {
        name: "x".into(),
        corporation_id: 1,
        birthday: Utc.with_ymd_and_hms(2010, 1, 1, 0, 0, 0).unwrap(),
        bloodline_id: 1,
        race_id: 1,
        gender: "male".into(),
        alliance_id: None,
        security_status: None,
        description: None,
        faction_id: None,
        corporation_title: None,
        character_title_id,
        achievement_score,
    }
}

#[test]
fn a_dropped_title_id_string_is_logged_without_quotes() {
    let lines = warnings_during(|| {
        title_fields(&with(Some(json!("not-a-uuid")), None));
    });
    assert_eq!(lines.len(), 1, "{lines:?}");
    assert!(
        lines[0].ends_with("Ignoring character_title_id not-a-uuid: not a UUID"),
        "{lines:?}"
    );
}

#[test]
fn a_dropped_score_string_is_logged_without_quotes() {
    let lines = warnings_during(|| {
        title_fields(&with(None, Some(json!("12"))));
    });
    assert_eq!(lines.len(), 1, "{lines:?}");
    assert!(
        lines[0].ends_with("Ignoring achievement_score 12: not an int32 >= 0"),
        "{lines:?}"
    );
}

#[test]
fn a_dropped_number_is_logged_as_it_is() {
    let lines = warnings_during(|| {
        title_fields(&with(None, Some(json!(-1))));
    });
    assert_eq!(lines.len(), 1, "{lines:?}");
    assert!(
        lines[0].ends_with("Ignoring achievement_score -1: not an int32 >= 0"),
        "{lines:?}"
    );
}
