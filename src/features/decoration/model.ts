import { ApiError } from '../../api/errors';
import type { DecorationData, Placement } from './types';
const nonempty = (s: unknown): s is string =>
  typeof s === 'string' && s.trim().length > 0;
const between = (n: unknown, lo: number, hi: number): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
export function validPlacements(
  value: unknown,
  ids: ReadonlySet<string>,
): value is Placement[] {
  if (!Array.isArray(value) || value.length > 20) return false;
  const seen = new Set<string>();
  return value.every((p) => {
    if (
      !p ||
      !nonempty(p.instance_id) ||
      seen.has(p.instance_id) ||
      !ids.has(p.sticker_id) ||
      !between(p.x, 0, 1) ||
      !between(p.y, 0, 1) ||
      !between(p.rotation, -180, 180) ||
      !between(p.scale, 0.25, 3)
    )
      return false;
    seen.add(p.instance_id);
    return true;
  });
}
export function readDecoration(raw: unknown, id: string): DecorationData {
  const data = raw as DecorationData;
  const s = data?.sheep;
  const shapes = new Set(['star', 'circle', 'triangle', 'sparkle', 'diamond']);
  const catalog = data?.stickers;
  if (
    !Array.isArray(catalog) ||
    catalog.length !== 7 ||
    !catalog.every(
      (st) =>
        st && nonempty(st.id) && nonempty(st.label) && shapes.has(st.asset_key),
    ) ||
    new Set(catalog.map((st) => st.id)).size !== 7 ||
    !s ||
    s.id !== id ||
    !nonempty(s.night_id) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.night_date) ||
    !nonempty(s.card_id) ||
    (s.color_key !== null && typeof s.color_key !== 'string') ||
    !Number.isSafeInteger(s.version) ||
    s.version < 1 ||
    !validPlacements(s.placements, new Set(catalog.map((st) => st.id)))
  )
    throw new ApiError('invalid-response');
  return {
    sheep: { ...s, placements: s.placements.map((p) => ({ ...p })) },
    stickers: catalog.map((st) => ({ ...st })),
  };
}
export function clampPlacement(p: Placement): Placement {
  return {
    ...p,
    x: Math.max(0, Math.min(1, p.x)),
    y: Math.max(0, Math.min(1, p.y)),
    rotation: Math.max(-180, Math.min(180, p.rotation)),
    scale: Math.max(0.25, Math.min(3, p.scale)),
  };
}
export function samePlacements(a: Placement[], b: Placement[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => {
      const q = b[i];
      return (
        p.instance_id === q.instance_id &&
        p.sticker_id === q.sticker_id &&
        p.x === q.x &&
        p.y === q.y &&
        p.rotation === q.rotation &&
        p.scale === q.scale
      );
    })
  );
}

export function dropCoordinates(
  pageX: number,
  pageY: number,
  frame: { left: number; top: number; width: number },
): { x: number; y: number } | null {
  const x = (pageX - frame.left - (frame.width - 130) / 2) / 130,
    y = (pageY - frame.top - 52) / 103;
  return Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    x <= 1 &&
    y >= 0 &&
    y <= 1
    ? { x, y }
    : null;
}
