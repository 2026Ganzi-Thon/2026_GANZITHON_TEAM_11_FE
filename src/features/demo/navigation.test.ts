import { expect, it } from '@jest/globals';
import { createNightMorningNavigation } from './navigation';
it('keeps the paused feed or closing request across a home round trip and isolates navigation sources', () => {
  const a = createNightMorningNavigation(),
    b = createNightMorningNavigation();
  a.setPage('feed');
  a.pause('feed');
  expect(a.getSnapshot()).toMatchObject({ page: 'paused', resume: 'feed' });
  const request = {
    reason: 'leave' as const,
    position: 2,
    furthestPosition: 3,
    sheepCount: 6,
  };
  a.closing(request);
  request.position = 4;
  a.pause('closing');
  expect(a.getSnapshot()).toMatchObject({
    page: 'paused',
    resume: 'closing',
    request: { position: 2, furthestPosition: 3 },
  });
  a.showMorning();
  expect(a.getSnapshot()).toMatchObject({ page: 'morning', wasMorning: true });
  expect(b.getSnapshot().page).toBe('entry');
});
it('notifies only its subscribers and removes them on unmount', () => {
  const nav = createNightMorningNavigation();
  let calls = 0;
  const stop = nav.subscribe(() => calls++);
  nav.setPage('feed');
  stop();
  nav.pause('feed');
  expect(calls).toBe(1);
});
