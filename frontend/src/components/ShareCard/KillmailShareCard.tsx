import type { KillmailShareCardProps } from '@/lib/shareCard/killmailShare';
import { SHARE } from '@/lib/shareCard/palette';
import NameBlock from './NameBlock';
import ShareAttackerBadge from './ShareAttackerBadge';
import ShareCardFrame from './ShareCardFrame';

const SHADOW = '0 2px 6px rgba(0,0,0,0.9)';
const fill = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

/** The killmail share card: victim on the left, the hull and its numbers on the right. */
export default function KillmailShareCard({
  p,
  tierIconSrc,
}: {
  p: KillmailShareCardProps;
  /** The tier icon as a data URI; satori cannot fetch a relative path. */
  tierIconSrc: string | null;
}) {
  return (
    <ShareCardFrame
      bar="red"
      left={
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.portrait} alt="" style={fill} />
          <NameBlock title={p.victimName} memberships={p.memberships} />
        </div>
      }
      right={
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.shipImage} alt="" style={fill} />
          {tierIconSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tierIconSrc}
              width={64}
              height={64}
              alt=""
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: 26,
              right: 26,
              bottom: 22,
              display: 'flex',
              flexDirection: 'column',
              textShadow: SHADOW,
            }}
          >
            <div style={{ fontSize: 24, color: SHARE.date }}>{p.date}</div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                color: SHARE.isk,
              }}
            >
              {p.total}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: 4,
                fontSize: 26,
                lineHeight: 1.15,
              }}
            >
              <div style={{ color: SHARE.red }}>{p.destroyed}</div>
              <div style={{ color: SHARE.dropped }}>{p.dropped}</div>
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 46,
                fontWeight: 500,
                color: SHARE.ship,
              }}
            >
              {p.shipName}
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 10,
                fontSize: 30,
                fontWeight: 500,
              }}
            >
              <div style={{ color: p.secColor }}>{p.secText}</div>
              <div style={{ marginLeft: 12, color: SHARE.ship }}>
                {p.systemName}
              </div>
              {p.regionName ? (
                <>
                  <div
                    style={{
                      marginLeft: 12,
                      fontWeight: 400,
                      color: SHARE.muted,
                    }}
                  >
                    ·
                  </div>
                  <div style={{ marginLeft: 12, color: SHARE.region }}>
                    {p.regionName}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      }
      footerRight={
        <ShareAttackerBadge
          solo={p.solo}
          npc={p.npc}
          attackerCount={p.attackerCount}
        />
      }
    />
  );
}
