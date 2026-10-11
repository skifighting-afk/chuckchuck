// The last heading already reached below the fixed header is the reading position.
export function currentSectionIndex(tops: number[], threshold: number): number {
  let selected = -1;
  tops.forEach((top, index) => { if (top <= threshold) selected = index; });
  return selected;
}
