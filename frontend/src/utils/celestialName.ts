/**
 * A celestial's name for display. ESI names a stargate after its destination
 * in parentheses — "Stargate (O-VWPB)" — and the parentheses only add noise
 * after "from" on the killmail's Location row, so they go: "Stargate O-VWPB".
 * Every other name is shown as ESI has it.
 */
export const celestialName = (name: string | null | undefined): string =>
  (name ?? '').replace(/^Stargate \((.+)\)$/, 'Stargate $1');
