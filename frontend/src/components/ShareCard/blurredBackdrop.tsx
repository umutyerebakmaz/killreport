import type { ReactNode } from 'react';

/**
 * A soft backdrop without `filter`, which satori lacks: the caller passes a
 * tiny image (size=32), it is scaled to cover the panel, and a dark layer
 * goes over it.
 */
export function blurredBackdrop(src: string): ReactNode {
  return (
    <>
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
    </>
  );
}
