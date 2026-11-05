import { getSecurityLevel } from '@/utils/security';

export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;

/** Colours of the share cards, as plain hex (satori has no Tailwind theme). */
export const SHARE = {
  ground: '#101010',
  surface: '#2b2b2c',
  inset: '#3d3d3e',
  red: '#fe3743',
  accent: '#5ccbcb',
  faint: '#999999',
  muted: '#b0b0b0',
  ship: '#fb923c',
  region: '#60a5fa',
  isk: '#e7b815',
  dropped: '#37ba5b',
  text: '#e5e7eb',
  date: '#d1d5db',
} as const;

const SECURITY_HEX = {
  'high-sec': '#4ade80',
  'low-sec': '#facc15',
  'null-sec': '#f87171',
  wormhole: '#c084fc',
} as const;

export function securityHex(sec: number | null | undefined): string {
  return SECURITY_HEX[getSecurityLevel(sec)];
}
