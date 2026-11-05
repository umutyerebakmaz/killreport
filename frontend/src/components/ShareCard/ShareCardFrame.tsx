import { SHARE } from '@/lib/shareCard/palette';
import type { ReactNode } from 'react';

const STRIP = 14;
const PANEL_HEIGHT = 560;
const FOOTER_HEIGHT = 70;

/** Position and size only; the panels and cards fill and clip themselves. */
const panel = (left: number, width: number) =>
  ({
    position: 'absolute',
    display: 'flex',
    top: 0,
    left,
    width,
    height: PANEL_HEIGHT,
    overflow: 'hidden',
  }) as const;

/**
 * The 1200x630 frame every share card sits in: the coloured strip, two panels
 * and the footer with the mark and wordmark.
 *
 * The tally mark is the third copy of the drawing in `ui/Logo.tsx` and
 * `app/icon.svg`; satori has no stylesheet, so the colours are written out
 * here as well.
 */
export default function ShareCardFrame({
  bar,
  left,
  right,
  footerRight,
}: {
  bar: 'red' | 'accent';
  left: ReactNode;
  right: ReactNode;
  footerRight: ReactNode;
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: 1200,
        height: 630,
        background: SHARE.ground,
        fontFamily: 'RC',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: STRIP,
          height: 630,
          background: SHARE[bar],
        }}
      />
      <div style={panel(STRIP, 560)}>{left}</div>
      <div style={panel(574, 626)}>{right}</div>
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          left: STRIP,
          top: PANEL_HEIGHT,
          width: 1200 - STRIP,
          height: FOOTER_HEIGHT,
          paddingLeft: 20,
          paddingRight: 32,
          background: SHARE.surface,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="46" height="46" viewBox="0 0 24 24">
            <rect x="3" y="5" width="3" height="14" fill={SHARE.text} />
            <rect x="8" y="5" width="3" height="14" fill={SHARE.text} />
            <rect x="13" y="5" width="3" height="14" fill={SHARE.text} />
            <rect x="18" y="5" width="3" height="14" fill={SHARE.text} />
            <line
              x1="2"
              y1="18.5"
              x2="22"
              y2="5.5"
              stroke={SHARE.accent}
              strokeWidth="3"
            />
          </svg>
          <div
            style={{
              marginLeft: 16,
              fontSize: 30,
              fontWeight: 500,
              letterSpacing: 3,
              color: SHARE.text,
            }}
          >
            KILLREPORT
          </div>
        </div>
        {footerRight}
      </div>
    </div>
  );
}
