/**
 * One line of the SDE's types.jsonl as a [typeId, metaGroupId] pair, or null
 * for a type with no meta group — and for a blank or malformed line, which is
 * skipped rather than allowed to abort an import of 50,000 lines.
 */
export function parseMetaGroupLine(line: string): [number, number] | null {
  if (!line.trim()) return null;

  let record: { _key?: unknown; metaGroupID?: unknown };
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }

  const typeId = record._key;
  const metaGroupId = record.metaGroupID;
  if (!Number.isInteger(typeId) || !Number.isInteger(metaGroupId)) return null;
  return [typeId as number, metaGroupId as number];
}
