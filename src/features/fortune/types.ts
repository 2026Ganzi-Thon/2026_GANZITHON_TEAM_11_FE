import { ApiError } from '../../api/errors';
export const zodiacNames = {
  aries: '양자리',
  taurus: '황소자리',
  gemini: '쌍둥이자리',
  cancer: '게자리',
  leo: '사자자리',
  virgo: '처녀자리',
  libra: '천칭자리',
  scorpio: '전갈자리',
  sagittarius: '궁수자리',
  capricorn: '염소자리',
  aquarius: '물병자리',
  pisces: '물고기자리',
} as const;
export const sheepNames = {
  sparkling: '반짝이는 양',
  favorable: '순풍의 양',
  relaxed: '느긋한 양',
  resting: '쉬어 가는 양',
} as const;
/** GET /fortune/today projection. The source supplies the daily result. */
export interface Fortune {
  date: string;
  zodiac: keyof typeof zodiacNames;
  rank: number | null;
  sheep_type: keyof typeof sheepNames;
  message: string;
  lucky_color: string;
  lucky_item: string;
  small_action: string;
}
export interface FortuneActions {
  load(signal: AbortSignal): Promise<Fortune>;
}
export function readFortune(value: unknown): Fortune {
  const fail = () => {
    throw new ApiError('invalid-response');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail();
  const item = value as Record<string, unknown>;
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date))
    return fail();
  const time = new Date(`${item.date}T00:00:00Z`);
  if (
    !Number.isFinite(time.getTime()) ||
    time.toISOString().slice(0, 10) !== item.date
  )
    return fail();
  if (
    typeof item.zodiac !== 'string' ||
    !Object.hasOwn(zodiacNames, item.zodiac) ||
    typeof item.sheep_type !== 'string' ||
    !Object.hasOwn(sheepNames, item.sheep_type) ||
    !(
      item.rank === null ||
      (typeof item.rank === 'number' &&
        Number.isInteger(item.rank) &&
        item.rank >= 1 &&
        item.rank <= 12)
    )
  )
    return fail();
  if (
    !['message', 'lucky_color', 'lucky_item', 'small_action'].every(
      (key) =>
        typeof item[key] === 'string' &&
        (item[key] as string).trim().length > 0,
    )
  )
    return fail();
  return { ...(value as Fortune) };
}
/** Only these ranks are public; lower ranks never become a title or subtitle. */
export const publicRank = (fortune: Fortune) =>
  fortune.rank !== null && fortune.rank <= 3 ? fortune.rank : null;
