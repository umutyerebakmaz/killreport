import { hexToTint } from './colors';

/**
 * Sovereignty owner colours, chosen against the map's own ground (#030712).
 *
 * 26 of them were picked by hand — the 22 factions and four alliances — and
 * the rest were placed by farthest-point sampling in OKLab, each one as far
 * from every colour already in the dictionary as the sRGB gamut allows.
 *
 * **101 colours do not fully separate.** 57 of the 5,050 pairs sit under
 * OKLab ΔE 0.08 and the closest two are 0.042 apart, which is the layer's
 * reading contract rather than a defect: the colour says "these are one
 * holding", and which holding is answered by the logo at SOV_LOGO_ZOOM. See
 * the spec's §3.1.
 *
 * An owner missing from here is drawn SOV_UNOWNED_TINT and identified by its
 * logo alone, so the layer is correct while the dictionary is incomplete.
 * Adding one is a single line.
 */
export const SOV_COLORS: Record<number, string> = {
  500003: '#d4a017',
  1354830081: '#1ca800',
  500001: '#4d7ea8',
  500004: '#2e9e6b',
  99003581: '#ffffff',
  500002: '#a83e2e',
  1900696668: '#6cdf5d',
  500019: '#7a3f8f',
  500005: '#6fb5c9',
  99009163: '#243bff',
  500007: '#daab52',
  498125261: '#f592fe',
  99012042: '#fe1363',
  99003214: '#7cd05d',
  500015: '#b6b68b',
  500010: '#b50000',
  99006941: '#ffe815',
  99011223: '#8d13f4',
  500008: '#cd32c8',
  99014518: '#0bf0e0',
  500014: '#9a7b1f',
  99007887: '#a779fd',
  99003995: '#f58393',
  500011: '#c8721f',
  1727758877: '#b90e77',
  99012328: '#c1628b',
  99015206: '#b8f9ad',
  99011528: '#b7b5fc',
  99012982: '#6661f2',
  1988009451: '#fd50b7',
  99009287: '#ffb0cf',
  500006: '#d8dde3',
  99009927: '#145ec1',
  500026: '#9e1b1b',
  99013045: '#f923ff',
  99010468: '#9b00b3',
  99010877: '#9cfe00',
  99008788: '#fe5828',
  927292903: '#c78ccc',
  99013537: '#248510',
  933731581: '#8ea432',
  99014548: '#7c5d29',
  99002685: '#fed990',
  99014783: '#9b51cd',
  99014986: '#80d8fe',
  1042504553: '#1ecdaa',
  99014050: '#ba8b81',
  99001969: '#e31705',
  99009129: '#7da0fc',
  99013532: '#d0cb21',
  99012064: '#15fea6',
  99014557: '#9b6d65',
  500012: '#6e1020',
  99010389: '#ff8516',
  99011279: '#6e3ec7',
  99013502: '#db67e6',
  99014203: '#9b4871',
  99014913: '#b53bfd',
  99013739: '#e20092',
  99007629: '#657d59',
  1411711376: '#80a383',
  99005393: '#fba589',
  99012410: '#99f8fa',
  1644918530: '#8378cf',
  500016: '#c9c2a8',
  500017: '#7f8fa6',
  500020: '#2f6b4a',
  99007257: '#11a6aa',
  99011416: '#97deac',
  99014699: '#6405fc',
  99014995: '#ca564d',
  431502563: '#10c72e',
  555959926: '#16c1fe',
  500018: '#2f6f7f',
  99007203: '#b56ac3',
  99009845: '#42b970',
  99009902: '#d2a2af',
  99012279: '#d33068',
  99014321: '#a53d9f',
  1220922756: '#008d89',
  1614483120: '#0278e7',
  99011828: '#718d16',
  99014999: '#fcbf45',
  99000285: '#0ff439',
  99006751: '#f9cdfc',
  99013444: '#fe7ccb',
  99015056: '#657100',
  99015215: '#ae9654',
  500013: '#7a5f9e',
  500027: '#3f8fd4',
  500029: '#4a4f57',
  99006225: '#f417c9',
  99009331: '#7085ff',
  99011268: '#90cbc8',
  99011702: '#957298',
  99011935: '#ac5d10',
  99012813: '#baec5b',
  99013578: '#e2805f',
  99014213: '#c598ff',
  99014362: '#ee5f8d',
  99015135: '#9ea1ca',
};

/**
 * Systems nobody holds, and owners the dictionary does not name.
 *
 * Not the security colour: that is another layer's sentence, and two
 * magnitudes told at once leaves neither readable. Not GATE_TINT either — the
 * dot has to sit quieter than the lines that connect it, or an empty region
 * reads louder than a held one. A judgement; tune by looking.
 */
export const SOV_UNOWNED_TINT = 0x475569;

/** The owner's tint, or null when the dictionary does not name them. */
export function sovTint(ownerId: number): number | null {
  const hex = SOV_COLORS[ownerId];
  return hex === undefined ? null : hexToTint(hex);
}
