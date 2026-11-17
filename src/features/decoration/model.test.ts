import { expect, it } from '@jest/globals';
import { clampPlacement, readDecoration, samePlacements } from './model';
const sheep = {
  id: 'a',
  night_id: 'n',
  night_date: '2026-11-16',
  card_id: 'c',
  color_key: null,
  version: 1,
  placements: [],
};
const stickers = Array.from({ length: 7 }, (_, i) => ({
  id: `st-${i + 1}`,
  label: `스티커 ${i + 1}`,
  asset_key: [
    'star',
    'circle',
    'triangle',
    'sparkle',
    'diamond',
    'circle',
    'triangle',
  ][i],
}));
const one = {
  instance_id: 'p',
  sticker_id: 'st-1',
  x: 0.5,
  y: 0.5,
  rotation: 0,
  scale: 1,
};
it('reads a versioned sheep with its catalog and preserves independent placement snapshots', () => {
  const value = readDecoration(
    { sheep: { ...sheep, placements: [one] }, stickers },
    'a',
  );
  expect(value.sheep.placements).toEqual([one]);
  value.sheep.placements[0].x = 0.2;
  expect(one.x).toBe(0.5);
});
it.each([
  { sheep: { ...sheep, id: 'b' }, stickers },
  { sheep: { ...sheep, version: 0 }, stickers },
  { sheep: { ...sheep, placements: [{ ...one, x: NaN }] }, stickers },
  {
    sheep: { ...sheep, placements: [{ ...one, sticker_id: 'missing' }] },
    stickers,
  },
  { sheep: { ...sheep, placements: [one, one] }, stickers },
  {
    sheep: {
      ...sheep,
      placements: Array.from({ length: 21 }, (_, i) => ({
        ...one,
        instance_id: `p-${i}`,
      })),
    },
    stickers,
  },
  { sheep, stickers: [] },
  { sheep, stickers: [...stickers.slice(0, 6), stickers[0]] },
])('rejects malformed or unrelated editor data %#', (data) =>
  expect(() => readDecoration(data, 'a')).toThrow(),
);
it('clamps manipulation at allowed coordinate, rotation and size boundaries', () => {
  expect(
    clampPlacement({ ...one, x: -1, y: 2, rotation: 200, scale: 4 }),
  ).toEqual({ ...one, x: 0, y: 1, rotation: 180, scale: 3 });
  expect(clampPlacement({ ...one, rotation: -200, scale: 0 })).toEqual({
    ...one,
    rotation: -180,
    scale: 0.25,
  });
});
it('compares the entire ordered visual placement without confusing different instances', () => {
  expect(samePlacements([one], [{ ...one }])).toBe(true);
  expect(samePlacements([one], [{ ...one, x: 0.1 }])).toBe(false);
  expect(samePlacements([one], [{ ...one, instance_id: 'other' }])).toBe(false);
});
