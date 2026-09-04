import { describe, expect, it } from 'vitest';

import {
  formatSecurityStatus,
  getSecurityBgColor,
  getSecurityBorderColor,
  getSecurityColor,
  getSecurityLabel,
  getSecurityLevel,
} from './security';

describe('getSecurityLevel', () => {
  it('treats 0.5 and above as high sec', () => {
    expect(getSecurityLevel(1.0)).toBe('high-sec');
    expect(getSecurityLevel(0.5)).toBe('high-sec');
  });

  it('treats anything above zero but below 0.5 as low sec', () => {
    expect(getSecurityLevel(0.4)).toBe('low-sec');
    expect(getSecurityLevel(0.1)).toBe('low-sec');
  });

  it('treats zero and below as null sec', () => {
    expect(getSecurityLevel(0)).toBe('null-sec');
    expect(getSecurityLevel(-0.5)).toBe('null-sec');
    expect(getSecurityLevel(-1)).toBe('null-sec');
  });

  it('treats a missing security status as wormhole space', () => {
    expect(getSecurityLevel(null)).toBe('wormhole');
    expect(getSecurityLevel(undefined)).toBe('wormhole');
  });
});

/**
 * The four class helpers all derive from getSecurityLevel, so one table keeps
 * their palettes aligned: a change to one without the others shows up here.
 */
const PALETTE = [
  {
    input: 0.9,
    level: 'high sec',
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    label: 'High Sec',
  },
  {
    input: 0.3,
    level: 'low sec',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/50',
    label: 'Low Sec',
  },
  {
    input: -0.2,
    level: 'null sec',
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    label: 'Null Sec',
  },
  {
    input: null,
    level: 'wormhole',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    label: 'Wormhole',
  },
];

describe.each(PALETTE)(
  '$level styling',
  ({ input, color, bg, border, label }) => {
    it('returns the text, background, border and label for the band', () => {
      expect(getSecurityColor(input)).toBe(color);
      expect(getSecurityBgColor(input)).toBe(bg);
      expect(getSecurityBorderColor(input)).toBe(border);
      expect(getSecurityLabel(input)).toBe(label);
    });
  },
);

describe('formatSecurityStatus', () => {
  it('renders one decimal place', () => {
    expect(formatSecurityStatus(1)).toBe('1.0');
    expect(formatSecurityStatus(0.945)).toBe('0.9');
    expect(formatSecurityStatus(-0.04)).toBe('-0.0');
  });

  it('labels wormhole space instead of a number', () => {
    expect(formatSecurityStatus(null)).toBe('W-Space');
    expect(formatSecurityStatus(undefined)).toBe('W-Space');
  });

  it('rounds a low-sec system to 0.5 for display while its band stays low sec', () => {
    // Worth pinning: the displayed number and the colour disagree by design,
    // because EVE truncates in its own UI the same way.
    expect(formatSecurityStatus(0.45)).toBe('0.5');
    expect(getSecurityLevel(0.45)).toBe('low-sec');
  });
});
