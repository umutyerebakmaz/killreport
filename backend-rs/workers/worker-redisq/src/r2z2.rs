//! zKillboard's R2Z2 feed: `sequence.json` for the head, `/{sequence}.json`
//! for one killmail. Plain HTTP, not ESI: it goes nowhere near the ESI
//! limiter. R2Z2 allows 15 requests per second per IP; the pacing is the
//! stream loop's.

use std::time::Duration;

use anyhow::{bail, Context as _};
use killmail_writer::KillmailDetail;
use reqwest::StatusCode;
use serde::Deserialize;
use serde_json::Value;

/// The live feed.
pub const BASE_URL: &str = "https://r2z2.zkillboard.com/ephemeral";
/// The Node worker's, unchanged.
pub const USER_AGENT: &str = "Killreport Real-Time Sync - github.com/umutyerebakmaz/killreport";
const TIMEOUT: Duration = Duration::from_secs(10);

/// One killmail as R2Z2 gives it.
#[derive(Debug, Clone, PartialEq)]
pub struct Package {
    pub killmail_id: i32,
    /// `zkb.hash`, or the top-level `hash` when `zkb` has none.
    pub hash: String,
    /// The embedded ESI killmail, when it has the shape the writer needs
    /// (the Node worker's `isUsableEsiKillmail`); otherwise it is fetched.
    pub esi: Option<KillmailDetail>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Poll {
    Found(Package),
    /// A 200 with no killmail ID or hash in it: nothing to save or to
    /// record for later. The reason is for the log line.
    Unreadable(String),
    /// No file at this sequence (yet).
    NotFound,
    /// 403 or 429: back off without advancing.
    RateLimited,
}

pub struct R2z2 {
    http: reqwest::Client,
    base_url: String,
}

#[derive(Deserialize)]
struct Head {
    sequence: i64,
}

impl R2z2 {
    pub fn new(base_url: &str) -> Self {
        let http = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(TIMEOUT)
            .build()
            .expect("the reqwest client builds with static settings");
        Self {
            http,
            base_url: base_url.trim_end_matches('/').to_owned(),
        }
    }

    /// The newest sequence R2Z2 has published.
    pub async fn head(&self) -> anyhow::Result<i64> {
        let url = format!("{}/sequence.json", self.base_url);
        let response = self.http.get(&url).send().await?;
        let status = response.status();
        if !status.is_success() {
            bail!("sequence.json: {status}");
        }
        let head: Head = response.json().await.context("sequence.json")?;
        Ok(head.sequence)
    }

    /// The file at `sequence`. A transport error or another status is `Err`:
    /// the loop retries the same number.
    pub async fn get(&self, sequence: i64) -> anyhow::Result<Poll> {
        let url = format!("{}/{sequence}.json", self.base_url);
        let response = self.http.get(&url).send().await?;
        match response.status() {
            StatusCode::NOT_FOUND => return Ok(Poll::NotFound),
            StatusCode::FORBIDDEN | StatusCode::TOO_MANY_REQUESTS => return Ok(Poll::RateLimited),
            status if !status.is_success() => bail!("R2Z2 {sequence}: {status}"),
            _ => {}
        }
        let body = response.bytes().await?;
        Ok(parse(&body))
    }
}

/// Read a 200's body. Loose on purpose: only the ID and hash are required,
/// and an embedded killmail that does not decode is dropped, not fatal.
fn parse(body: &[u8]) -> Poll {
    let Ok(value) = serde_json::from_slice::<Value>(body) else {
        return Poll::Unreadable("the body is not JSON".to_owned());
    };
    let Some(killmail_id) = value["killmail_id"]
        .as_i64()
        .and_then(|id| i32::try_from(id).ok())
    else {
        return Poll::Unreadable("no killmail_id".to_owned());
    };
    let hash = value["zkb"]["hash"]
        .as_str()
        .or_else(|| value["hash"].as_str());
    let Some(hash) = hash else {
        return Poll::Unreadable(format!("killmail {killmail_id}: no hash"));
    };
    let esi = serde_json::from_value::<KillmailDetail>(value["esi"].clone())
        .ok()
        .filter(|detail| !detail.attackers.is_empty());
    Poll::Found(Package {
        killmail_id,
        hash: hash.to_owned(),
        esi,
    })
}
