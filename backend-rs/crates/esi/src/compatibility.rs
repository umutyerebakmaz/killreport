//! The `X-Compatibility-Date` an ESI request asks for.
//!
//! ESI freezes a route's response shape at the date a client names. Most
//! routes are read at [`CompatibilityDate::DEFAULT`], the date
//! `esi-client.ts:23` sends; a caller that needs fields added later names its
//! own date for that one request, as `character.service.ts:53-56` does.

/// A `YYYY-MM-DD` date for the `X-Compatibility-Date` header.
///
/// Built with a `const fn`, so a worker declares its date as a constant and a
/// malformed one stops the build. Only the shape is checked, not the
/// calendar: ESI rejects a date it does not know, and these dates are copied
/// from ESI's changelog rather than computed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CompatibilityDate(&'static str);

impl CompatibilityDate {
    /// The date every request without one of its own is sent with.
    pub const DEFAULT: CompatibilityDate = CompatibilityDate::new("2020-01-01");

    /// # Panics
    ///
    /// If `date` is not `YYYY-MM-DD`; in a `const` that is a compile error.
    pub const fn new(date: &'static str) -> Self {
        let bytes = date.as_bytes();
        if bytes.len() != 10 {
            panic!("compatibility date must be YYYY-MM-DD");
        }
        let mut i = 0;
        while i < bytes.len() {
            let valid = match i {
                4 | 7 => bytes[i] == b'-',
                _ => bytes[i].is_ascii_digit(),
            };
            if !valid {
                panic!("compatibility date must be YYYY-MM-DD");
            }
            i += 1;
        }
        Self(date)
    }

    pub fn as_str(self) -> &'static str {
        self.0
    }
}
