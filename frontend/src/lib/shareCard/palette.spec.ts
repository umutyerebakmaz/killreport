import { describe, expect, it } from 'vitest';
import { securityHex } from './palette';

describe('securityHex', () => {
  it('maps security levels to hex colours', () => {
    expect(securityHex(0.5)).toBe('#4ade80');
    expect(securityHex(0.2)).toBe('#facc15');
    expect(securityHex(-0.8)).toBe('#f87171');
    expect(securityHex(null)).toBe('#c084fc');
  });
});
