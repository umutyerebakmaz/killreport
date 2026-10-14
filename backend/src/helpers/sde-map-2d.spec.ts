import { describe, expect, it } from 'vitest';
import { parseMap2dLine } from './sde-map-2d';

describe('parseMap2dLine', () => {
  it('reads the id and the schematic position', () => {
    const line =
      '{"_key": 30000001, "position": {"x": -8.8e16, "y": 4.2e16, "z": -4.4e16}, "position2D": {"x": 6.985182150795389e+16, "y": -7.190628684642312e+16}}';
    expect(parseMap2dLine(line)).toEqual([
      30000001, 6.985182150795389e16, -7.190628684642312e16,
    ]);
  });

  it('skips a system with no schematic position, as every wormhole is', () => {
    const line = '{"_key": 31000005, "position": {"x": 1, "y": 2, "z": 3}}';
    expect(parseMap2dLine(line)).toBeNull();
  });

  it('skips a blank line, malformed JSON and a bare null', () => {
    expect(parseMap2dLine('')).toBeNull();
    expect(parseMap2dLine('   ')).toBeNull();
    expect(parseMap2dLine('{"_key": 1, "position2D"')).toBeNull();
    expect(parseMap2dLine('null')).toBeNull();
  });

  it('skips a non-numeric coordinate rather than writing NaN', () => {
    const line =
      '{"_key": 30000001, "position2D": {"x": "6.9e16", "y": -7.1e16}}';
    expect(parseMap2dLine(line)).toBeNull();
  });

  it('skips a non-integer id', () => {
    const line = '{"_key": "30000001", "position2D": {"x": 1, "y": 2}}';
    expect(parseMap2dLine(line)).toBeNull();
  });
});
