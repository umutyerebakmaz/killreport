import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LABEL_FONT_FAMILY,
  LABEL_TIER_STYLE,
  labelLineHeight,
} from '@/utils/map/labelStyle';
import type { LabelCandidate } from '@/utils/map/labels';
import {
  createLabelLayer,
  destroyLabelLayer,
  drawLabels,
  type LabelLayer,
} from './labelLayer';

function candidate(overrides: Partial<LabelCandidate> = {}): LabelCandidate {
  return {
    key: 'system:30000142',
    name: 'Jita',
    tier: 'system',
    screenX: 100,
    screenY: 200,
    halfWidth: 10,
    halfHeight: 5,
    systemId: 30000142,
    ...overrides,
  };
}

let host: HTMLDivElement;
let layer: LabelLayer;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  layer = createLabelLayer(host);
});

describe('drawLabels', () => {
  it('writes a name into a span and positions it', () => {
    drawLabels(layer, [candidate()]);

    const el = layer.root.querySelector('span')!;
    expect(el.textContent).toBe('Jita');
    expect(el.style.transform).toBe(
      'translate(-50%, -50%) translate(100px, 200px)',
    );
  });

  it('stamps the region id onto a region name, and only onto one', () => {
    drawLabels(layer, [
      candidate({
        key: 'region:10000002',
        tier: 'region',
        name: 'The Forge',
        systemId: undefined,
        regionId: 10000002,
      }),
      candidate(),
    ]);

    const [region, system] = [...layer.root.querySelectorAll('span')];
    expect(region.dataset.mapRegion).toBe('10000002');
    expect(system.dataset.mapRegion).toBeUndefined();
  });

  it('stamps the constellation id onto a constellation name', () => {
    drawLabels(layer, [
      candidate({
        key: 'constellation:20000020',
        tier: 'constellation',
        name: 'Kimotoro',
        systemId: undefined,
        constellationId: 20000020,
      }),
    ]);

    const el = layer.root.querySelector('span')!;
    expect(el.dataset.mapConstellation).toBe('20000020');
    expect(el.dataset.mapRegion).toBeUndefined();
  });

  it('uppercases a region name', () => {
    drawLabels(layer, [
      candidate({
        key: 'region:10000002',
        tier: 'region',
        name: 'The Forge',
        systemId: undefined,
      }),
    ]);

    expect(layer.root.querySelector('span')!.textContent).toBe('THE FORGE');
  });

  // Asserted against labelStyle rather than against 12/600/1: the point of the
  // rule is that these come from the constants the measurer read, and a test
  // that spelled the numbers out would pass just as happily on a layer that
  // hardcoded them too. The line height is in here because it is the metric the
  // collision box is built from — `map.css` must not restate it.
  it('writes the tier metrics onto the element once', () => {
    drawLabels(layer, [candidate({ tier: 'constellation', key: 'c:1' })]);

    const style = LABEL_TIER_STYLE.constellation;
    const el = layer.root.querySelector('span')!;
    expect(el.style.fontSize).toBe(`${style.fontSize}px`);
    expect(el.style.fontWeight).toBe(style.fontWeight);
    expect(el.style.letterSpacing).toBe(`${style.letterSpacing}px`);
    expect(el.style.lineHeight).toBe(`${labelLineHeight('constellation')}px`);
    // The family is in this list because it is a metric: the measurer sets it
    // on the canvas context from the same constant, and a face that differed
    // between the two would size every collision box against text the browser
    // never draws.
    expect(el.style.fontFamily).toBe(LABEL_FONT_FAMILY);
  });

  it('reuses the same element when a key is drawn again', () => {
    drawLabels(layer, [candidate()]);
    const first = layer.root.querySelector('span');

    drawLabels(layer, [candidate({ screenX: 300 })]);
    const second = layer.root.querySelector('span');

    expect(second).toBe(first);
    expect(layer.root.children).toHaveLength(1);
    expect(second!.style.transform).toBe(
      'translate(-50%, -50%) translate(300px, 200px)',
    );
  });

  it('hides a name that lost its place rather than removing it', () => {
    drawLabels(layer, [candidate()]);
    drawLabels(layer, []);

    const el = layer.root.querySelector('span')!;
    expect(el.classList.contains('is-visible')).toBe(false);
    expect(layer.root.children).toHaveLength(1);
  });

  // The other half of the pool's contract: a hidden entry is the same element
  // coming back, not a new one. Without this the exit path above could be
  // satisfied by a layer that never re-shows anything.
  it('brings a hidden name back when it places again', () => {
    drawLabels(layer, [candidate()]);
    const first = layer.root.querySelector('span');
    drawLabels(layer, []);

    drawLabels(layer, [candidate()]);

    const el = layer.root.querySelector('span')!;
    expect(el).toBe(first);
    expect(el.classList.contains('is-visible')).toBe(true);
  });

  // jsdom runs no transitions, so what is pinned here is the mechanism the fade
  // depends on rather than the fade: a newly appended element needs its
  // before-change style resolved before it is told to fade in, or the browser
  // sees one style, starts no transition and the name pops.
  it('flushes the style of a newly appended name before revealing it', () => {
    const original = layer.root.getBoundingClientRect.bind(layer.root);
    // What the flush is FOR is the order: the element has to be in the document
    // and still invisible when the read happens, so the browser resolves
    // opacity 0 as the value the transition runs from.
    let visibleAtFlush: boolean | null = null;
    const flush = vi
      .spyOn(layer.root, 'getBoundingClientRect')
      .mockImplementation(() => {
        visibleAtFlush =
          layer.root.querySelector('span')?.classList.contains('is-visible') ??
          null;
        return original();
      });

    drawLabels(layer, [candidate()]);

    expect(flush).toHaveBeenCalled();
    expect(visibleAtFlush).toBe(false);
    expect(
      layer.root.querySelector('span')!.classList.contains('is-visible'),
    ).toBe(true);
  });

  it('does not force a layout on a frame that only moves pooled names', () => {
    // Every pointermove of a drag runs this. A read per frame would be a
    // forced reflow per frame, which is exactly what the pool exists to avoid.
    drawLabels(layer, [candidate()]);
    const flush = vi.spyOn(layer.root, 'getBoundingClientRect');

    drawLabels(layer, [candidate({ screenX: 300 })]);

    expect(flush).not.toHaveBeenCalled();
  });

  it('stamps only the system tier as a clickable target', () => {
    drawLabels(layer, [
      candidate(),
      candidate({
        key: 'region:10000002',
        tier: 'region',
        name: 'The Forge',
        systemId: undefined,
      }),
    ]);

    const [system, region] = [...layer.root.querySelectorAll('span')];
    expect(system.dataset.mapSystem).toBe('30000142');
    expect(region.dataset.mapSystem).toBeUndefined();
  });
});

describe('destroyLabelLayer', () => {
  it('drops the root and the pool', () => {
    drawLabels(layer, [candidate()]);
    destroyLabelLayer(layer);

    expect(host.children).toHaveLength(0);
    expect(layer.pool.size).toBe(0);
  });
});
