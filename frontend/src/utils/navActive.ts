/**
 * Whether a nav item stands for the page that is open.
 *
 * An item is active on its own page and on everything below it, so ALLIANCES
 * stays lit on `/alliances/99005338` — a detail page is still somewhere, and a
 * nav that goes dark the moment you open one reads as if it were nowhere.
 *
 * The comparison is by segment, not by string prefix, which is what keeps
 * `/map` off `/sovereignty/map` and `/alliances` off `/alliancesmerged`. The
 * query string is dropped first: two of the nav's hrefs carry pre-set filters
 * (`/killmails?page=1&regionId=10000070`) that no route ever echoes back.
 */
export function isNavActive(
  pathname: string | null,
  hrefs: readonly string[],
): boolean {
  if (!pathname) return false;

  return hrefs.some((href) => {
    const path = href.split(/[?#]/)[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}
