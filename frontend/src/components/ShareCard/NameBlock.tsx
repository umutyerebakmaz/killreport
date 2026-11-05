import { SHARE } from '@/lib/shareCard/palette';
import type { ReactNode } from 'react';

const SHADOW = '0 2px 6px rgba(0,0,0,0.9)';
const ONE_LINE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** A line of text, or pieces of it each with its own colour. */
export type Pieces = string | { text: string; color?: string }[];

/**
 * Pieces go in a flex row (satori wants `display: flex` on any element with
 * more than one child). Every piece but the last keeps its whitespace and
 * never shrinks; the last one is the single line that gets the ellipsis.
 */
function renderPieces(content: Pieces): ReactNode {
  if (typeof content === 'string') return content;
  return content.map((piece, i) => {
    const last = i === content.length - 1;
    return (
      <span
        key={`${piece.text}-${i}`}
        style={{
          color: piece.color,
          ...(last
            ? { minWidth: 0, ...ONE_LINE }
            : { flexShrink: 0, whiteSpace: 'pre' }),
        }}
      >
        {piece.text}
      </span>
    );
  });
}

/**
 * Name and memberships pinned to the bottom of a panel, one name per line.
 * Sits over an image, so the text carries a shadow rather than a scrim.
 */
export default function NameBlock({
  title,
  memberships = [],
  subtitle,
}: {
  title: Pieces;
  memberships?: { logo: string; name: string }[];
  subtitle?: Pieces;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 22,
        right: 22,
        bottom: 20,
        display: 'flex',
        flexDirection: 'column',
        textShadow: SHADOW,
      }}
    >
      <div
        style={{
          fontSize: 52,
          fontWeight: 500,
          lineHeight: 1.1,
          color: '#ffffff',
          ...(typeof title === 'string' ? ONE_LINE : { display: 'flex' }),
        }}
      >
        {renderPieces(title)}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 30,
            fontWeight: 500,
            color: SHARE.text,
            ...(typeof subtitle === 'string' ? ONE_LINE : { display: 'flex' }),
          }}
        >
          {renderPieces(subtitle)}
        </div>
      ) : null}
      {memberships.map((m, i) => (
        <div
          key={`${m.name}-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: i === 0 ? 10 : 8,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.logo}
            width={44}
            height={44}
            alt=""
            style={{ marginRight: 10 }}
          />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 26,
              color: SHARE.text,
              ...ONE_LINE,
            }}
          >
            {m.name}
          </div>
        </div>
      ))}
    </div>
  );
}
