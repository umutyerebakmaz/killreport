/** ESI's `X-Pages` response header as a number, or `null` when it is absent
 * or unreadable. */
export function xPages(headers: unknown): number | null {
  const raw = (headers as Record<string, unknown> | undefined)?.['x-pages'];
  const pages = Number(raw);
  return raw === undefined || !Number.isInteger(pages) || pages < 1
    ? null
    : pages;
}
