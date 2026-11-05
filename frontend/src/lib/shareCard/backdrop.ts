/**
 * The right panel the backdrop covers, from ShareCardFrame: 626 x 560.
 */
export const BACKDROP_WIDTH = 626;
export const BACKDROP_HEIGHT = 560;

/** The approved mockup's CSS `blur(28px)`: an SVG standard deviation of 28. */
const BLUR = 28;

/**
 * How far the image reaches past the panel on every side. A Gaussian blur
 * pulls transparent pixels in from beyond the image's edge, which would
 * darken a rim around the panel; three deviations past the edge, the image
 * itself is what the blur samples.
 */
const BLEED = BLUR * 3;

const TIMEOUT_MS = 10_000;

/**
 * The blurred backdrop as an SVG data URI, ready for an `<img>` in a share
 * card. Satori has no CSS `filter`, but it hands images to resvg, which
 * renders SVG filters; resvg never fetches an external href, so the image is
 * downloaded here and embedded. Resolves to null when the image cannot be
 * fetched: the card then shows the plain panel rather than failing.
 */
export async function blurredBackdropUri(
  imageUrl: string,
): Promise<string | null> {
  let bytes: ArrayBuffer;
  let mime: string;
  try {
    const res = await fetch(imageUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    mime = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    if (!mime.startsWith('image/')) return null;
    bytes = await res.arrayBuffer();
  } catch {
    return null;
  }
  const embedded = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${BACKDROP_WIDTH}" height="${BACKDROP_HEIGHT}" ` +
    `viewBox="0 0 ${BACKDROP_WIDTH} ${BACKDROP_HEIGHT}">` +
    `<defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feGaussianBlur stdDeviation="${BLUR}"/></filter></defs>` +
    `<image href="${embedded}" x="${-BLEED}" y="${-BLEED}" ` +
    `width="${BACKDROP_WIDTH + 2 * BLEED}" height="${BACKDROP_HEIGHT + 2 * BLEED}" ` +
    `preserveAspectRatio="xMidYMid slice" filter="url(#b)"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
