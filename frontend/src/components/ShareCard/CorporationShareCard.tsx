import type { CorporationShareCardProps } from '@/lib/shareCard/entityShare';
import { SHARE } from '@/lib/shareCard/palette';
import { UsersIcon } from '@heroicons/react/16/solid';
import { blurredBackdrop } from './blurredBackdrop';
import KillLossBars from './KillLossBars';
import NameBlock from './NameBlock';
import ShareCardFrame from './ShareCardFrame';
import StatNumber from './StatNumber';

const fill = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

/** The corporation share card: logo and alliance on the left, members, kills and losses on the right. */
export default function CorporationShareCard({
  p,
}: {
  p: CorporationShareCardProps;
}) {
  return (
    <ShareCardFrame
      bar="accent"
      left={
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.logo} alt="" style={fill} />
          <NameBlock title={p.name} memberships={p.memberships} />
        </div>
      }
      right={
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          {blurredBackdrop(p.backdrop)}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 60,
              right: 140,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <UsersIcon
                width={64}
                height={64}
                style={{ color: '#60a5fa', marginRight: 16 }}
              />
              <StatNumber
                value={p.members}
                label="Members"
                color="#93c5fd"
                size={84}
              />
            </div>
            <div style={{ display: 'flex', marginTop: 26 }}>
              <StatNumber
                value={p.kills}
                label="Kills"
                color={SHARE.dropped}
                size={96}
              />
            </div>
            <div style={{ display: 'flex', marginTop: 26 }}>
              <StatNumber
                value={p.losses}
                label="Losses"
                color={SHARE.red}
                size={96}
              />
            </div>
          </div>
          {p.bars ? (
            <KillLossBars
              kills={p.bars.kills}
              losses={p.bars.losses}
              top={60}
              height={440}
            />
          ) : null}
        </div>
      }
      footerRight={
        <div style={{ fontSize: 26, color: SHARE.muted }}>Corporation</div>
      }
    />
  );
}
