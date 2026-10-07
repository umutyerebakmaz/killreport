import { beforeEach, describe, expect, it } from 'vitest';
import {
  createChipLayer,
  destroyChipLayer,
  drawChips,
  writeChipText,
  type ChipLayer,
} from './chipLayer';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const campaign = {
  campaignId: 7,
  solarSystemId: 30004759,
  solarSystemName: '1DQ1-A',
  eventType: 'ihub_defense',
  startTime: new Date(NOW + 42 * 60_000 + 10_000).toISOString(),
  defenderScore: 0.6,
  attackersScore: 0.4,
};
const box = {
  campaignId: 7,
  systemId: 30004759,
  screenX: 120,
  screenY: 80,
  halfWidth: 60,
  halfHeight: 9,
};

let host: HTMLDivElement;
let layer: ChipLayer;

beforeEach(() => {
  host = document.createElement('div');
  layer = createChipLayer(host);
});

describe('chipLayer', () => {
  it('draws a placed chip where the placement put it, stamped with its system', () => {
    drawChips(layer, [box]);
    const chip = host.querySelector('.map-chip') as HTMLElement;

    expect(chip.dataset.mapSystem).toBe('30004759');
    expect(chip.classList.contains('is-visible')).toBe(true);
    expect(chip.style.transform).toContain('translate(120px, 80px)');
  });

  it('writes the countdown into a drawn chip', () => {
    drawChips(layer, [box]);
    writeChipText(layer, [campaign], NOW);
    expect(host.querySelector('.map-chip')!.textContent).toBe(
      '1DQ1-A · IHub · 42:10',
    );
  });

  it('marks a chip live once its timer has started', () => {
    drawChips(layer, [box]);
    writeChipText(layer, [campaign], NOW + 60 * 60_000);
    const chip = host.querySelector('.map-chip') as HTMLElement;
    expect(chip.dataset.live).toBe('');
    expect(chip.textContent).toBe('1DQ1-A · IHub · LIVE 60–40');
  });

  // Pooled like the labels: a chip that loses its place is hidden, not removed,
  // so the next pan brings it back with a class change.
  it('hides a chip that is no longer placed, and keeps its element', () => {
    drawChips(layer, [box]);
    drawChips(layer, []);
    const chip = host.querySelector('.map-chip') as HTMLElement;
    expect(chip.classList.contains('is-visible')).toBe(false);
  });

  it('leaves the host as it found it', () => {
    drawChips(layer, [box]);
    destroyChipLayer(layer);
    expect(host.querySelector('.map-chips')).toBeNull();
  });
});
