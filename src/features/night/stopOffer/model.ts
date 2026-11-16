export function stopOfferPosition(sheepCount: number): 14 | null {
  return Number.isInteger(sheepCount) && sheepCount >= 16 && sheepCount <= 30
    ? 14
    : null;
}
