import type { ReactNode } from 'react';

/**
 * The blurred backdrop behind a panel: the SVG `blurredBackdropUri` built
 * (the blur itself is an SVG filter, which resvg renders and satori's CSS
 * cannot), with a dark layer over it. A null source leaves the panel plain.
 * One wrapper element, because satori drops a fragment's children.
 */
export function blurredBackdrop(src: string | null): ReactNode {
  if (!src) return null;
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(16,16,16,0.55)',
        }}
      />
    </div>
  );
}
