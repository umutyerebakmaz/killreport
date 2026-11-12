const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One line of the SDE's characterTitles.jsonl as { id, name } with the English
 * name, or null for a line with no English name, a non-UUID key, or a blank or
 * malformed line — skipped rather than allowed to abort an import.
 */
export function parseCharacterTitleLine(
  line: string,
): { id: string; name: string } | null {
  if (!line.trim()) return null;

  let record: { _key?: unknown; name?: { en?: unknown } | null };
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }
  if (!record || typeof record !== 'object') return null;

  const id = record._key;
  const name = record.name?.en;
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  if (typeof name !== 'string' || !name.trim()) return null;
  return { id, name };
}
