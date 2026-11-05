import type { CharacterShareCardProps } from '@/lib/shareCard/entityShare';
import { SHARE } from '@/lib/shareCard/palette';
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

/** The character share card: portrait on the left, kills and losses on the right. */
export default function CharacterShareCard({
  p,
}: {
  p: CharacterShareCardProps;
}) {
  return (
    <ShareCardFrame
      bar="accent"
      left={
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.portrait} alt="" style={fill} />
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
            <StatNumber
              value={p.kills}
              label="Kills"
              color={SHARE.dropped}
              size={128}
            />
            <div style={{ display: 'flex', marginTop: 44 }}>
              <StatNumber
                value={p.losses}
                label="Losses"
                color={SHARE.red}
                size={128}
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
        <div style={{ fontSize: 26, color: SHARE.muted }}>Character</div>
      }
    />
  );
}
