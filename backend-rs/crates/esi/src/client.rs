//! The single HTTP client for ESI: the Rust port of
//! `backend/src/services/esi-client.ts`.
//!
//! Every request asks the limiter for a slot first, reports the response back
//! to it and gives the slot up again. This is the only file in `backend-rs/`
//! that may name ESI's host; `tests/guard.rs` fails if any other does.

use std::collections::HashMap;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde::de::DeserializeOwned;

use crate::compatibility::CompatibilityDate;
use crate::limiter::{EsiRoute, RateLimiter};
use crate::shared::Priority;
use crate::throttled::{EsiThrottled, ThrottleKind};

const ESI_BASE_URL: &str = "https://esi.evetech.net";
/// A stalled socket must not hold a limiter slot forever (`esi-client.ts:74`).
const TIMEOUT: Duration = Duration::from_secs(30);

/// Told apart from the Node workers' `KillReport/<version>` in ESI's logs and
/// ours (spec, "ESI erişimi").
fn user_agent() -> String {
    format!(
        "KillReport-rs/{} (+https://github.com/umutyerebakmaz/killreport)",
        env!("CARGO_PKG_VERSION")
    )
}

/// Why an ESI request failed.
///
/// No variant carries a request header, so no error message can leak an
/// `Authorization` token (`esi-client.ts:57-66`).
#[derive(Debug, thiserror::Error)]
pub enum EsiError {
    /// 420 or 429: the limiter has already put its brake in place.
    #[error(transparent)]
    Throttled(#[from] EsiThrottled),
    /// Any other non-2xx answer.
    #[error("ESI {status} on {path}")]
    Http { status: u16, path: String },
    /// No answer at all: connection, TLS or timeout.
    #[error("ESI request to {path} failed: {source}")]
    Transport {
        path: String,
        #[source]
        source: reqwest::Error,
    },
    /// A 2xx whose body is not the shape the caller asked for.
    #[error("ESI response from {path} did not decode: {source}")]
    Decode {
        path: String,
        #[source]
        source: serde_json::Error,
    },
}

impl EsiError {
    /// The HTTP status, when there was a response.
    pub fn status(&self) -> Option<u16> {
        match self {
            Self::Throttled(throttled) => Some(throttled.status),
            Self::Http { status, .. } => Some(*status),
            Self::Transport { .. } | Self::Decode { .. } => None,
        }
    }
}

/// The ESI client. Cheap to clone; clones share one connection pool and one
/// limiter.
#[derive(Clone, Debug)]
pub struct EsiClient {
    http: reqwest::Client,
    base_url: String,
    limiter: RateLimiter,
    /// How every request asks the limiter: bulk with no maximum wait unless
    /// made [`live`](Self::live).
    priority: Priority,
    max_wait: Option<Duration>,
}

impl EsiClient {
    pub fn new(limiter: RateLimiter) -> Self {
        Self::with_base_url(limiter, ESI_BASE_URL)
    }

    /// The same client against another host: for tests, which run against a
    /// local mock server.
    pub fn with_base_url(limiter: RateLimiter, base_url: impl Into<String>) -> Self {
        // The compatibility date is not a default header: each request sets
        // its own, so exactly one is ever sent.
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_str(&user_agent()).expect("the user agent is ASCII"),
        );
        let http = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(TIMEOUT)
            .build()
            .expect("the reqwest client builds with static settings");
        Self {
            http,
            base_url: base_url.into().trim_end_matches('/').to_owned(),
            limiter,
            priority: Priority::Bulk,
            max_wait: None,
        }
    }

    /// This client as live traffic, the way Node's `setEsiPriority('live')`
    /// and `setEsiMaxWait` set a process up: every request asks the shared
    /// budget as `Priority::Live`, and a brake or group wait longer than
    /// `max_wait` fails it with [`EsiError::Throttled`] instead of waiting.
    /// For a stream that must not stall behind bulk work (`worker-redisq`).
    pub fn live(mut self, max_wait: Duration) -> Self {
        self.priority = Priority::Live;
        self.max_wait = Some(max_wait);
        self
    }

    /// The limiter this client draws on.
    pub fn limiter(&self) -> &RateLimiter {
        &self.limiter
    }

    /// GET `path` (e.g. `/alliances/99000001`) at
    /// [`CompatibilityDate::DEFAULT`] and decode the JSON body.
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, EsiError> {
        self.get_with_compatibility_date(path, CompatibilityDate::DEFAULT)
            .await
    }

    /// GET `path` with `date` as its `X-Compatibility-Date`, for a route whose
    /// fields only exist from that date on, and decode the JSON body.
    pub async fn get_with_compatibility_date<T: DeserializeOwned>(
        &self,
        path: &str,
        date: CompatibilityDate,
    ) -> Result<T, EsiError> {
        let (body, _headers) = self.fetch(path, date, None).await?;
        Ok(body)
    }

    /// GET every page of a paged list route and concatenate them in page
    /// order. `path` may carry a query string of its own
    /// (`/markets/10000002/orders/?type_id=34`); the page goes after it with
    /// `&`, or with `?` when there is none. The first page is asked for as
    /// `page=1` and its `X-Pages` says how many follow.
    /// A missing or unreadable `X-Pages` means one page. Pages are fetched one
    /// after another, each through the limiter like any other request, and
    /// any failing page fails the whole call: a partial list never comes back.
    pub async fn get_paged<T: DeserializeOwned>(&self, path: &str) -> Result<Vec<T>, EsiError> {
        let date = CompatibilityDate::DEFAULT;
        let separator = if path.contains('?') { '&' } else { '?' };
        let (mut all, headers): (Vec<T>, _) = self
            .fetch(&format!("{path}{separator}page=1"), date, None)
            .await?;
        let pages = headers
            .get("x-pages")
            .and_then(|value| value.trim().parse::<u32>().ok())
            .unwrap_or(1);
        for page in 2..=pages {
            let (items, _): (Vec<T>, _) = self
                .fetch(&format!("{path}{separator}page={page}"), date, None)
                .await?;
            all.extend(items);
        }
        Ok(all)
    }

    /// One page of an authenticated paged list (`/characters/{id}/killmails/recent/`),
    /// on the bucket of the character whose token it is: the grouped
    /// `char-killmail` and `corp-killmail` limits are per character. `Ok(None)`
    /// on 404, which ESI answers for an empty list or a page past the end.
    /// Every other failure, a 403 included, is an error; the token goes in a
    /// header and never into an error message.
    pub async fn get_page_authed<T: DeserializeOwned>(
        &self,
        path: &str,
        page: u32,
        access_token: &str,
        bucket_key: &str,
    ) -> Result<Option<Page<T>>, EsiError> {
        let separator = if path.contains('?') { '&' } else { '?' };
        let paged = format!("{path}{separator}page={page}");
        match self
            .fetch::<Vec<T>>(
                &paged,
                CompatibilityDate::DEFAULT,
                Some(Auth {
                    access_token,
                    bucket_key,
                }),
            )
            .await
        {
            Ok((items, headers)) => Ok(Some(Page {
                items,
                pages: headers
                    .get("x-pages")
                    .and_then(|value| value.trim().parse::<u32>().ok()),
            })),
            Err(EsiError::Http { status: 404, .. }) => Ok(None),
            Err(error) => Err(error),
        }
    }

    /// One GET: the decoded body and the response headers, lowercased.
    async fn fetch<T: DeserializeOwned>(
        &self,
        path: &str,
        date: CompatibilityDate,
        auth: Option<Auth<'_>>,
    ) -> Result<(T, HashMap<String, String>), EsiError> {
        let route = match &auth {
            Some(auth) => EsiRoute::with_bucket_key(path, auth.bucket_key),
            None => EsiRoute::new(path),
        };
        // Held until the body has been read; dropping it gives the slot back
        // on every path out of this function.
        let _permit = self
            .limiter
            .acquire_with(&route, self.max_wait, self.priority)
            .await?;

        let mut request = self.http.get(format!("{}{path}", self.base_url)).header(
            "x-compatibility-date",
            HeaderValue::from_static(date.as_str()),
        );
        if let Some(auth) = &auth {
            request = request.bearer_auth(auth.access_token);
        }
        let response = request.send().await.map_err(|source| EsiError::Transport {
            path: path.to_owned(),
            source,
        })?;

        let status = response.status().as_u16();
        let headers = lowercase_headers(response.headers());
        self.limiter.observe_async(&route, status, &headers).await;

        if status == 420 || status == 429 {
            let kind = throttle_kind(status, &headers);
            return Err(EsiThrottled::new(status, kind, format!("ESI {status} on {path}")).into());
        }
        if !response.status().is_success() {
            return Err(EsiError::Http {
                status,
                path: path.to_owned(),
            });
        }

        let body = response
            .bytes()
            .await
            .map_err(|source| EsiError::Transport {
                path: path.to_owned(),
                source,
            })?;
        let decoded = serde_json::from_slice(&body).map_err(|source| EsiError::Decode {
            path: path.to_owned(),
            source,
        })?;
        Ok((decoded, headers))
    }
}

/// `esi-client.ts:47-54`.
fn throttle_kind(status: u16, headers: &HashMap<String, String>) -> ThrottleKind {
    if status == 420 {
        ThrottleKind::ErrorLimit
    } else if headers.contains_key("x-ratelimit-group") {
        ThrottleKind::RateLimit
    } else {
        ThrottleKind::DeepLimit
    }
}

/// The limiter reads plain lowercase keys. Header names already are; a value
/// that is not visible ASCII is dropped, as no header the limiter reads has one.
fn lowercase_headers(headers: &HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .filter_map(|(name, value)| {
            let value = value.to_str().ok()?;
            Some((name.as_str().to_ascii_lowercase(), value.to_owned()))
        })
        .collect()
}

/// The token and the bucket of an authenticated request.
struct Auth<'a> {
    access_token: &'a str,
    bucket_key: &'a str,
}

/// One page of an authenticated list and ESI's `X-Pages`, `None` when it is
/// absent or unreadable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub pages: Option<u32>,
}
