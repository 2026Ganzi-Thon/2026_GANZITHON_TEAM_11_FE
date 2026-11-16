import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createNightMorningDemo } from './nightMorningDemo';
import { finish, signal, settle, start } from './__tests__/nightHistory';
const closesAt = '2026-11-17T04:00:00+09:00';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
function fixture(
  scenario: Parameters<typeof createNightMorningDemo>[0] = 'success',
) {
  let now = Date.parse('2026-11-17T03:59:00+09:00');
  return {
    d: createNightMorningDemo(scenario, {
      nightDate: '2026-11-16',
      expiry: { now: () => now, closesAt },
    }),
    end: () => {
      now = Date.parse(closesAt);
    },
  };
}
it.each(['save', 'retry'] as const)(
  'rejects a %s that reaches the commit boundary after 04:00 and leaves the morning unentrusted',
  async (kind) => {
    const { d, end } = fixture(kind === 'retry' ? 'entrust-retry' : 'success');
    await start(d, 7);
    d.progress({ position: 4, furthestPosition: 4 });
    if (kind === 'retry')
      await expect(
        settle(d.entrust!.save('entrusted', signal())),
      ).rejects.toMatchObject({ kind: 'network' });
    const pending = d.entrust!.save('entrusted', signal());
    end();
    await expect(settle(pending)).rejects.toMatchObject({
      code: 'NIGHT_CLOSED',
    });
    expect(d.getRecord()).toMatchObject({ expired: true, counted: 4 });
    expect(d.getRecord().night?.entrusted).toBe(false);
    const m = await settle(d.morning.loadMorning(signal()));
    expect(m.candidate_cards.map((c) => c.position).sort()).toEqual([1, 2, 3]);
    expect(
      (await settle(d.morning.reflection!.load(d.nightId, signal()))).night
        ?.entrusted,
    ).toBe(false);
  },
);
it.each(['entrusted', 'skipped'] as const)(
  'keeps confirmed %s consistent in the finish replay and morning after expiration',
  async (action) => {
    const { d, end } = fixture();
    await start(d, 7);
    d.progress({ position: 4, furthestPosition: 4 });
    await settle(d.entrust!.save(action, signal()));
    d.progress({ position: 7, furthestPosition: 7 });
    const value = await finish(d, 7);
    expect(value.summary.entrusted_count).toBe(action === 'entrusted' ? 1 : 0);
    end();
    await settle(d.expiry!.load(signal()));
    expect((await finish(d, 7)).summary.entrusted_count).toBe(
      action === 'entrusted' ? 1 : 0,
    );
    await expect(
      settle(d.entrust!.save(action, signal())),
    ).rejects.toMatchObject({ code: 'NIGHT_CLOSED' });
    expect(
      (await settle(d.morning.reflection!.load(d.nightId, signal()))).night
        ?.entrusted,
    ).toBe(action === 'entrusted');
  },
);
it('retains a committed choice whose response was lost before expiry and never resubmits it from the morning', async () => {
  const { d, end } = fixture('entrust-lost-response');
  await start(d, 7);
  d.progress({ position: 4, furthestPosition: 4 });
  await expect(
    settle(d.entrust!.save('entrusted', signal())),
  ).rejects.toMatchObject({ kind: 'network' });
  end();
  await settle(d.expiry!.load(signal()));
  expect((await settle(d.entrust!.load(signal()))).action).toBe('entrusted');
  expect(
    (await settle(d.morning.reflection!.load(d.nightId, signal()))).night
      ?.entrusted,
  ).toBe(true);
  expect(d.getSession()?.position).toBe(4);
});
