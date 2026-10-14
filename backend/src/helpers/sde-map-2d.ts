/**
 * One line of the SDE's mapSolarSystems.jsonl as [systemId, x, y], or null for
 * a system with no schematic position — every wormhole, Abyssal and Proving
 * system — and for a blank or malformed line, which is skipped rather than
 * allowed to abort an import of 8,490 lines.
 */
export function parseMap2dLine(line: string): [number, number, number] | null {
  if (!line.trim()) return null;

  let record: unknown;
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof record !== 'object' || record === null) return null;

  const { _key: id, position2D } = record as {
    _key?: unknown;
    position2D?: { x?: unknown; y?: unknown };
  };
  const x = position2D?.x;
  const y = position2D?.y;
  if (!Number.isInteger(id)) return null;
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  if (typeof y !== 'number' || !Number.isFinite(y)) return null;
  return [id as number, x, y];
}
