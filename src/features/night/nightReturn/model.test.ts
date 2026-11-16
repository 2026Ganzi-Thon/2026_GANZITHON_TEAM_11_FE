import { expect, it } from '@jest/globals';
import { readNightReturnRoute } from './model';
import { lastSession, snapshot } from './__tests__/fixture';
it.each(['completed', 'stopped'] as const)(
  'only welcomes back a confirmed %s session',
  (status) => {
    expect(
      readNightReturnRoute(snapshot({ last_session: lastSession({ status }) })),
    ).toMatchObject({
      kind: 'return',
      record: { nightId: 'return-night', summary: { counted: 15, status } },
    });
  },
);
it('routes an active session to its feed even when a previous finished summary exists', () => {
  expect(
    readNightReturnRoute(
      snapshot({ next_screen: 'NIGHT_FEED', active_session_id: 'active-one' }),
    ),
  ).toEqual({ kind: 'feed', nightId: 'return-night', sessionId: 'active-one' });
});
it('keeps an unacknowledged closing card on the closing route', () => {
  expect(
    readNightReturnRoute(snapshot({ next_screen: 'NIGHT_CLOSING' })),
  ).toEqual({ kind: 'closing', nightId: 'return-night' });
});
it('routes exactly 04:00 to morning', () => {
  expect(
    readNightReturnRoute(
      snapshot({
        server_time: '2026-11-16T19:00:00Z',
        phase: 'day',
        night_date: '2026-11-17',
        next_screen: 'MORNING_ADOPTION',
      }),
    ),
  ).toEqual({ kind: 'morning', nightId: 'return-night' });
});
it('keeps the same night on both sides of midnight', () => {
  for (const server_time of ['2026-11-16T14:59:59Z', '2026-11-16T15:00:00Z']) {
    expect(
      readNightReturnRoute(
        snapshot({
          server_time,
          last_session: lastSession({ finished_at: '2026-11-16T14:50:00Z' }),
        }),
      ),
    ).toMatchObject({ kind: 'return' });
  }
});
it.each([
  [
    { next_screen: 'NIGHT_SHEEP_COUNT' },
    { kind: 'entry', step: 'count', nightId: 'return-night' },
  ],
  [
    { next_screen: 'NIGHT_WORRY', night_id: null },
    { kind: 'entry', step: 'worry', nightId: null },
  ],
  [
    { next_screen: 'NIGHT_SUPPORT' },
    { kind: 'support', nightId: 'return-night' },
  ],
  [{ next_screen: 'HOME' }, { kind: 'home' }],
] as const)(
  'respects the confirmed %s route without starting a session',
  (patch, want) => {
    expect(readNightReturnRoute(snapshot(patch))).toEqual(want);
  },
);
it.each([
  { active_session_id: 'already-active' },
  { night_id: '' },
  { last_session: null },
  { last_session: lastSession({ counted: -1 }) },
  { last_session: lastSession({ counted: 1.5 }) },
  { last_session: lastSession({ fluff_count: NaN }) },
  { last_session: lastSession({ yarn_sent_count: -1 }) },
  { last_session: lastSession({ finished_at: '2026-11-16T18:00:00Z' }) },
  { last_session: lastSession({ finished_at: '2026-11-15T16:12:00Z' }) },
  { server_time: '2026-02-30T17:10:00Z' },
  { server_time: '2026-11-16T19:00:00Z' },
  { night_date: '2026-11-17' },
  { timezone: 'UTC' },
])('rejects an inconsistent return snapshot %s', (patch) => {
  expect(() => readNightReturnRoute(snapshot(patch))).toThrow();
});
it('does not accept a pending warm card as a completed return screen', () => {
  const bad = snapshot();
  bad.last_session = { ...lastSession(), closing_card: {} as never };
  expect(() => readNightReturnRoute(bad)).toThrow();
});
it('can show totals above a single-session thirty-sheep limit', () => {
  expect(
    readNightReturnRoute(
      snapshot({ last_session: lastSession({ counted: 45 }) }),
    ),
  ).toMatchObject({ kind: 'return', record: { summary: { counted: 45 } } });
});
