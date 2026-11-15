import { expect, it } from '@jest/globals';
import { readReentryRoute, readReentrySession } from './model';
const route = {
  phase: 'night',
  next_screen: 'NIGHT_FEED',
  night_id: 'night-1',
  active_session_id: 'session-1',
  support: null,
};
const session = {
  id: 'session-1',
  night_id: 'night-1',
  status: 'active',
  sheep_count: 6,
  position: 2,
  furthest_position: 4,
  sequence: 0,
  writer_epoch: 2,
};
it('keeps a saved current position separate from the furthest viewed position', () => {
  expect(readReentryRoute(route)).toEqual(route);
  expect(readReentrySession(session, 'night-1', 'session-1')).toEqual(session);
});
it('accepts a not-yet-viewed session without pretending a downloaded first card was viewed', () => {
  expect(
    readReentrySession(
      { ...session, position: 0, furthest_position: 0 },
      'night-1',
      'session-1',
    ),
  ).toMatchObject({ position: 0, furthest_position: 0 });
});
it.each([
  { phase: 'day' },
  { next_screen: 'NIGHT_RETURN' },
  { night_id: '' },
  { active_session_id: null },
  { active_session_id: ' ' },
  { support: { message: 'unexpected', resources: [] } },
])('rejects an inconsistent or out-of-scope entry route (%p)', (invalid) => {
  expect(() => readReentryRoute({ ...route, ...invalid })).toThrow();
});
it('keeps a support route with a missing payload recoverable instead of passing through to the feed', () => {
  expect(
    readReentryRoute({ ...route, next_screen: 'NIGHT_SUPPORT', support: null }),
  ).toMatchObject({ next_screen: 'NIGHT_SUPPORT', support: null });
});
it.each([
  { id: 'different-session' },
  { night_id: 'different-night' },
  { status: 'completed' },
  { sheep_count: 2 },
  { sheep_count: 31 },
  { position: -1 },
  { position: 7 },
  { position: 5, furthest_position: 4 },
  { position: 0, furthest_position: 4 },
  { sequence: -1 },
  { sequence: 1 },
  { writer_epoch: 0 },
  { writer_epoch: 1.5 },
])(
  'does not allow invalid session metadata to select or silently clamp a card (%p)',
  (invalid) => {
    expect(() =>
      readReentrySession({ ...session, ...invalid }, 'night-1', 'session-1'),
    ).toThrow();
  },
);
