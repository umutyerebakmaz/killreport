import type { AllianceShareCardProps } from '@/lib/shareCard/entityShare';
import { SHARE } from '@/lib/shareCard/palette';
import { UsersIcon } from '@heroicons/react/16/solid';
import { GlobeAltIcon, StarIcon } from '@heroicons/react/24/outline';
import type { ComponentType, CSSProperties } from 'react';
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

type Icon = ComponentType<{
  width?: number;
  height?: number;
  style?: CSSProperties;
}>;

/** One of the three small numbers above kills and losses. */
function MiniStat({
  icon: Icon,
  iconColor,
  value,
  valueColor,
  label,
}: {
  icon: Icon;
  iconColor: string;
  value: string;
  valueColor: string;
  label: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Icon
          width={40}
          height={40}
          style={{ color: iconColor, marginRight: 10 }}
        />
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1,
            color: valueColor,
          }}
        >
          {value}
        </div>
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 20,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: SHARE.faint,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** The alliance share card: logo on the left, membership, sov, kills and losses on the right. */
export default function AllianceShareCard({
  p,
}: {
  p: AllianceShareCardProps;
}) {
  return (
    <ShareCardFrame
      bar="accent"
      left={
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.logo} alt="" style={fill} />
          <NameBlock title={p.name} />
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
              left: 50,
              right: 130,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex' }}>
              <MiniStat
                icon={UsersIcon}
                iconColor="#60a5fa"
                value={p.members}
                valueColor="#93c5fd"
                label="Members"
              />
              <div style={{ display: 'flex', marginLeft: 34 }}>
                <MiniStat
                  icon={StarIcon}
                  iconColor="#eab308"
                  value={p.corporations}
                  valueColor="#eab308"
                  label="Corps"
                />
              </div>
              <div style={{ display: 'flex', marginLeft: 34 }}>
                <MiniStat
                  icon={GlobeAltIcon}
                  iconColor="#34d399"
                  value={p.sov}
                  valueColor="#6ee7b7"
                  label="Sov"
                />
              </div>
            </div>
            <div style={{ display: 'flex', marginTop: 40 }}>
              <StatNumber
                value={p.kills}
                label="Kills"
                color={SHARE.dropped}
                size={104}
              />
            </div>
            <div style={{ display: 'flex', marginTop: 40 }}>
              <StatNumber
                value={p.losses}
                label="Losses"
                color={SHARE.red}
                size={104}
              />
            </div>
          </div>
          {p.bars ? (
            <KillLossBars
              kills={p.bars.kills}
              losses={p.bars.losses}
              top={190}
              height={300}
            />
          ) : null}
        </div>
      }
      footerRight={
        <div style={{ fontSize: 26, color: SHARE.muted }}>Alliance</div>
      }
    />
  );
}
