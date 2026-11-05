import { SHARE } from '@/lib/shareCard/palette';
import type { SolarSystemShareCardProps } from '@/lib/shareCard/solarSystemShare';
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

/** `Hed · Heimatar`, with the separator only between names that exist. */
export function systemSubtitle(
  constellationName: string,
  regionName: string,
): { text: string; color: string }[] | undefined {
  const pieces = [
    constellationName && { text: constellationName, color: SHARE.text },
    regionName && { text: regionName, color: SHARE.region },
  ].filter((piece) => !!piece);
  if (pieces.length === 0) return undefined;
  return pieces.length === 2
    ? [pieces[0], { text: ' · ', color: SHARE.muted }, pieces[1]]
    : pieces;
}

/** The solar system share card: the star on the left, 24 hour kills on the right. */
export default function SolarSystemShareCard({
  p,
}: {
  p: SolarSystemShareCardProps;
}) {
  return (
    <ShareCardFrame
      bar="accent"
      left={
        <div
          style={{
            display: 'flex',
            flex: 1,
            position: 'relative',
            background: SHARE.ground,
          }}
        >
          {p.starImage ? (
            // The renders put the dark space top left; flipped, it falls behind the name.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.starImage}
              alt=""
              style={{ ...fill, transform: 'scaleY(-1)' }}
            />
          ) : null}
          <NameBlock
            title={[
              { text: `${p.secText} `, color: p.secColor },
              { text: p.systemName },
            ]}
            subtitle={systemSubtitle(p.constellationName, p.regionName)}
          />
        </div>
      }
      right={
        <div
          style={{
            display: 'flex',
            flex: 1,
            position: 'relative',
            background: SHARE.surface,
          }}
        >
          {p.regionMap ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.regionMap}
              alt=""
              width={520}
              height={520}
              style={{ position: 'absolute', left: 60, top: 20, opacity: 0.45 }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 60,
              right: 60,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <StatNumber
              value={p.kills}
              label="Kills"
              color={SHARE.red}
              size={104}
            />
            <div style={{ display: 'flex', marginTop: 40 }}>
              <StatNumber
                value={p.npcKills}
                label="NPC Kills"
                color={SHARE.date}
                size={104}
              />
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              right: 32,
              bottom: 22,
              fontSize: 22,
              letterSpacing: 3,
              color: SHARE.muted,
            }}
          >
            LAST 24 HOURS
          </div>
        </div>
      }
      footerRight={
        <div style={{ fontSize: 26, color: SHARE.muted }}>Solar System</div>
      }
    />
  );
}
