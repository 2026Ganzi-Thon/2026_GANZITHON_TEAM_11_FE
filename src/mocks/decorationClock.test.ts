import { afterEach, expect, it, jest } from '@jest/globals';
import { createMockHome } from './firstNightHome';
import { settle, signal } from './__tests__/nightHistory';
afterEach(() => {
  jest.useRealTimers();
});
it.each(['adopted', 'candidates'] as const)(
  'uses the %s home clock when saving crosses 21:00',
  async (scenario) => {
    jest.useFakeTimers();
    let time = Date.parse('2026-11-17T20:59:59+09:00');
    const source = createMockHome(scenario, { now: () => time });
    if (scenario === 'candidates') {
      const morning = await settle(source.morning.loadMorning(signal()));
      await settle(
        source.morning.adopt(
          morning.night!.id,
          morning.default_card_id!,
          signal(),
        ),
      );
    }
    const sheep = (await settle(source.morning.loadFlock(signal())))[0];
    const data = await settle(
      source.morning.decoration!.load(sheep.id, signal()),
    );
    const p = source.morning.decoration!.save(
      sheep.id,
      {
        if_version: data.sheep.version,
        placements: [
          {
            instance_id: 'p',
            sticker_id: 'st-1',
            x: 0.5,
            y: 0.5,
            rotation: 0,
            scale: 1,
          },
        ],
      },
      signal(),
    );
    time = Date.parse('2026-11-17T21:00:00+09:00');
    await expect(settle(p)).rejects.toMatchObject({ code: 'DAY_ONLY' });
    expect(
      (await settle(source.morning.loadFlock(signal())))[0].placements ?? [],
    ).toEqual([]);
  },
);
