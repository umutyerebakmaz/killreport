//! The log line format: INFO lines carry no level label, every other level
//! keeps its own. All output goes to stdout, so `WARN` and `ERROR` are what a
//! grep of the journal finds; on the INFO lines the label was only noise.

use std::fmt;

use tracing::{Event, Level, Subscriber};
use tracing_subscriber::fmt::format::{Format, Full, Writer};
use tracing_subscriber::fmt::time::{FormatTime, SystemTime};
use tracing_subscriber::fmt::{FmtContext, FormatEvent, FormatFields};
use tracing_subscriber::registry::LookupSpan;

/// Wraps a base [`Format`]: WARN, ERROR, DEBUG and TRACE print through it
/// unchanged, INFO through the same format with the level turned off.
pub(crate) struct HideInfoLevel<T = SystemTime> {
    labelled: Format<Full, T>,
    unlabelled: Format<Full, T>,
}

impl<T: Clone> HideInfoLevel<T> {
    pub(crate) fn new(base: Format<Full, T>) -> Self {
        Self {
            unlabelled: base.clone().with_level(false),
            labelled: base,
        }
    }
}

impl<S, N, T> FormatEvent<S, N> for HideInfoLevel<T>
where
    S: Subscriber + for<'a> LookupSpan<'a>,
    N: for<'a> FormatFields<'a> + 'static,
    T: FormatTime,
{
    fn format_event(
        &self,
        ctx: &FmtContext<'_, S, N>,
        writer: Writer<'_>,
        event: &Event<'_>,
    ) -> fmt::Result {
        if *event.metadata().level() == Level::INFO {
            self.unlabelled.format_event(ctx, writer, event)
        } else {
            self.labelled.format_event(ctx, writer, event)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::io;
    use std::sync::{Arc, Mutex};

    use tracing::{debug, error, info, warn};
    use tracing_subscriber::fmt::format::Format;

    use super::HideInfoLevel;

    #[derive(Clone, Default)]
    struct Buffer(Arc<Mutex<Vec<u8>>>);

    impl io::Write for Buffer {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    fn capture(emit: impl FnOnce()) -> Vec<String> {
        let buffer = Buffer::default();
        let writer = buffer.clone();
        let subscriber = tracing_subscriber::fmt()
            .with_max_level(tracing::Level::DEBUG)
            .event_format(HideInfoLevel::new(
                Format::default()
                    .with_ansi(false)
                    .with_target(false)
                    .without_time(),
            ))
            .with_writer(move || writer.clone())
            .finish();
        tracing::subscriber::with_default(subscriber, emit);
        let out = String::from_utf8(buffer.0.lock().unwrap().clone()).unwrap();
        out.lines().map(str::to_owned).collect()
    }

    #[test]
    fn info_lines_have_no_level_label() {
        let lines = capture(|| info!(count = 3, "drained"));
        assert_eq!(lines, ["drained count=3"]);
    }

    #[test]
    fn other_levels_keep_their_label() {
        let lines = capture(|| {
            debug!("d");
            warn!("w");
            error!("e");
        });
        assert_eq!(lines, ["DEBUG d", " WARN w", "ERROR e"]);
    }
}
