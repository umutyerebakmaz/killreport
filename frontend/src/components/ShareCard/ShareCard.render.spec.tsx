// @vitest-environment node
import { ImageResponse } from 'next/og';
import { describe, expect, it } from 'vitest';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { SHARE, SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import {
  blurredBackdrop,
  KillLossBars,
  NameBlock,
  ShareAttackerBadge,
  ShareCardFrame,
  StatNumber,
} from './index';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('share card render', () => {
  it('renders the shared parts to a 1200x630 PNG', async () => {
    const fonts = await loadShareCardFonts();
    const res = new ImageResponse(
      <ShareCardFrame
        bar="accent"
        left={
          <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
            {blurredBackdrop(PNG)}
            <NameBlock
              title={[
                { text: '0.4', color: '#facc15' },
                { text: 'General XAN' },
              ]}
              memberships={[
                { logo: PNG, name: 'Some Corporation' },
                { logo: PNG, name: 'Some Alliance' },
              ]}
              subtitle={[
                { text: 'Hed', color: SHARE.text },
                { text: ' \u00b7 ', color: SHARE.muted },
                { text: 'Heimatar', color: SHARE.region },
              ]}
            />
          </div>
        }
        right={
          <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
            <StatNumber
              value="252"
              label="Kills"
              color={SHARE.dropped}
              size={96}
            />
            <KillLossBars kills={252} losses={58} top={100} height={300} />
          </div>
        }
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <ShareAttackerBadge solo npc={false} attackerCount={1} />
            <ShareAttackerBadge solo npc attackerCount={1} />
            <ShareAttackerBadge solo={false} npc={false} attackerCount={5} />
            <ShareAttackerBadge solo={false} npc attackerCount={3} />
          </div>
        }
      />,
      { ...SHARE_CARD_SIZE, fonts },
    );
    const buf = Buffer.from(await res.arrayBuffer());
    expect([...buf.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
  });
});
