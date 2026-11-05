import { SHARE } from '@/lib/shareCard/palette';
import type { ReactNode } from 'react';

const SHADOW = '0 2px 6px rgba(0,0,0,0.9)';
const ONE_LINE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/**
 * Name and memberships pinned to the bottom of a panel, one name per line.
 * Sits over an image, so the text carries a shadow rather than a scrim.
 */
export default function NameBlock({
  title,
  memberships = [],
  subtitle,
}: {
  title: ReactNode;
  memberships?: { logo: string; name: string }[];
  subtitle?: ReactNode;
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
          ...ONE_LINE,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 26,
            color: SHARE.text,
            ...ONE_LINE,
          }}
        >
          {subtitle}
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
