/**
 * A separate module because UniverseMap.spec.tsx mocks it: jsdom's
 * getContext('webgl2') always returns null, so without a mock only the
 * component's "no WebGL" branch could ever be exercised.
 */
export function isWebgl2Available(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
