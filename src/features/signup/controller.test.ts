import { expect, it, jest } from '@jest/globals';
import { ApiError } from '../../api/errors';
import { createSignupController } from './controller';
import type { SignupActions, ConsentDocuments } from './types';
const documents: ConsentDocuments = {
  revision: 'v1',
  documents: ['terms', 'privacy', 'processing', 'notifications'].map((id) => ({
    id: id as 'terms',
    title: id,
    version: 'v1',
    body: 'Example document',
  })),
};
function fixture() {
  const actions: SignupActions = {
    passwordReset: { request: async () => ({ accepted: true }) },
    today: '2026-11-16',
    loadDocuments: jest
      .fn<SignupActions['loadDocuments']>()
      .mockResolvedValue(documents),
    register: jest
      .fn<SignupActions['register']>()
      .mockImplementation(async (_key, c) => ({ id: 'u', email: c.email })),
    consent: jest.fn<SignupActions['consent']>().mockResolvedValue(undefined),
    birth: jest
      .fn<SignupActions['birth']>()
      .mockImplementation(async (_id, date) => ({
        birth_date: date,
        edits_remaining: 1,
        zodiac: 'taurus',
      })),
    login: async () => {},
  };
  return { actions, c: createSignupController(actions) };
}
async function registered(c: ReturnType<typeof createSignupController>) {
  c.openSignup();
  c.edit('email', '  TEST@EXAMPLE.COM ');
  c.edit('password', ' password ');
  c.edit('confirmation', ' password ');
  await c.submit();
}
it('validates fields and keeps the exact password while normalizing only email', async () => {
  const { actions, c } = fixture();
  c.openSignup();
  await c.submit();
  expect(c.getSnapshot().fields.email).toBeTruthy();
  expect(actions.register).not.toHaveBeenCalled();
  c.edit('email', 'test@example.com');
  c.edit('password', '😀'.repeat(7));
  c.edit('confirmation', '😀'.repeat(7));
  await c.submit();
  expect(actions.register).not.toHaveBeenCalled();
  c.edit('password', ' pass123 ');
  c.edit('confirmation', 'wrong');
  await c.submit();
  expect(c.getSnapshot().fields.confirmation).toBeTruthy();
  c.edit('email', '  TEST@EXAMPLE.COM ');
  c.edit('confirmation', ' pass123 ');
  await c.submit();
  expect(actions.register).toHaveBeenCalledWith(
    expect.any(String),
    { email: 'test@example.com', password: ' pass123 ' },
    expect.any(AbortSignal),
  );
  expect(c.getSnapshot().stage).toBe('consents');
  expect(c.getSnapshot().password).toBe('');
});
it('preserves one registration across back navigation and does not require optional consent', async () => {
  const { actions, c } = fixture();
  await registered(c);
  c.toggle('terms');
  await c.submit();
  expect(c.getSnapshot().stage).toBe('consents');
  expect(actions.consent).not.toHaveBeenCalled();
  c.toggle('privacy');
  await c.submit();
  expect(c.getSnapshot().stage).toBe('birth');
  c.back();
  c.back();
  c.edit('email', 'other@example.com');
  await c.submit();
  expect(actions.register).toHaveBeenCalledTimes(1);
  expect(c.getSnapshot().email).toBe('test@example.com');
  await c.submit();
  c.changeDate('month', 2);
  c.changeDate('day', 29);
  await c.submit();
  expect(c.getSnapshot().stage).toBe('complete');
  expect(c.getSnapshot().result?.edits_remaining).toBe(1);
  expect(actions.consent).toHaveBeenCalledWith(
    'u',
    {
      revision: 'v1',
      choices: {
        terms: true,
        privacy: true,
        notifications: false,
      },
    },
    expect.any(AbortSignal),
  );
});
it('recovers an uncertain registration with the frozen original operation and blocks edits', async () => {
  const { actions, c } = fixture();
  jest.mocked(actions.register).mockRejectedValueOnce(new ApiError('network'));
  await registered(c);
  expect(c.getSnapshot().uncertain).toBe(true);
  c.edit('email', 'changed@example.com');
  c.edit('password', 'changedpass');
  await c.submit();
  const calls = jest.mocked(actions.register).mock.calls;
  expect(calls[0].slice(0, 2)).toEqual(calls[1].slice(0, 2));
  expect(c.getSnapshot().stage).toBe('consents');
});
it('blocks consent on document failure and invalidates old checks after a version conflict', async () => {
  const { actions, c } = fixture();
  jest
    .mocked(actions.loadDocuments)
    .mockRejectedValueOnce(new ApiError('network'));
  await registered(c);
  c.toggle('all');
  await c.submit();
  expect(actions.consent).not.toHaveBeenCalled();
  await c.reload();
  c.toggle('all');
  jest
    .mocked(actions.consent)
    .mockRejectedValueOnce(
      new ApiError('http', { status: 409, code: 'CONSENT_VERSION_CHANGED' }),
    );
  await c.submit();
  expect(c.getSnapshot().choices.terms).toBe(false);
  expect(c.getSnapshot().stage).toBe('consents');
  await c.submit();
  expect(actions.consent).toHaveBeenCalledTimes(1);
});
it('rejects future dates, keeps birth drafts on failure and validates the initial-save response', async () => {
  const { actions, c } = fixture();
  await registered(c);
  c.toggle('all');
  await c.submit();
  c.changeDate('year', 2026);
  c.changeDate('month', 12);
  await c.submit();
  expect(actions.birth).not.toHaveBeenCalled();
  c.changeDate('year', 2004);
  jest.mocked(actions.birth).mockRejectedValueOnce(new ApiError('network'));
  await c.submit();
  expect(c.getSnapshot().stage).toBe('birth');
  expect(c.getSnapshot().date.month).toBe(12);
  jest.mocked(actions.birth).mockResolvedValueOnce({
    birth_date: '2004-12-14',
    edits_remaining: 0,
    zodiac: 'sagittarius',
  });
  await c.submit();
  expect(c.getSnapshot().stage).toBe('birth');
  await c.submit();
  expect(c.getSnapshot().stage).toBe('complete');
});
it.each(['resolve', 'reject'] as const)(
  'aborts pending registration, clears secrets and ignores late %s',
  async (mode) => {
    const { actions, c } = fixture();
    let resolve!: (v: { id: string; email: string }) => void;
    let reject!: (e: Error) => void;
    jest.mocked(actions.register).mockImplementationOnce(
      () =>
        new Promise((r, j) => {
          resolve = r;
          reject = j;
        }),
    );
    c.openSignup();
    c.edit('email', 'a@example.com');
    c.edit('password', 'password');
    c.edit('confirmation', 'password');
    const promise = c.submit();
    void c.submit();
    expect(actions.register).toHaveBeenCalledTimes(1);
    const signal = jest.mocked(actions.register).mock.calls[0][2];
    c.stop();
    expect(signal.aborted).toBe(true);
    if (mode === 'resolve') resolve({ id: 'u', email: 'a@example.com' });
    else reject(Error('late secret'));
    await promise;
    expect(c.getSnapshot().stage).not.toBe('consents');
    expect(c.getSnapshot().password).toBe('');
  },
);
it('reconfirms the original first birth save after a lost response instead of spending an edit on a different date', async () => {
  const { actions, c } = fixture();
  await registered(c);
  c.toggle('all');
  await c.submit();
  jest.mocked(actions.birth).mockRejectedValueOnce(new ApiError('network'));
  await c.submit();
  const before = c.getSnapshot().date;
  c.changeDate('month', 6);
  expect(c.getSnapshot().date).toEqual(before);
  await c.submit();
  expect(jest.mocked(actions.birth).mock.calls.map((call) => call[1])).toEqual([
    '2004-05-14',
    '2004-05-14',
  ]);
  expect(c.getSnapshot().stage).toBe('complete');
});
it('preserves a processing registration key and original credentials until its existing result is recovered', async () => {
  const { actions, c } = fixture();
  jest
    .mocked(actions.register)
    .mockRejectedValueOnce(
      new ApiError('http', { status: 409, code: 'REQUEST_IN_PROGRESS' }),
    );
  await registered(c);
  expect(c.getSnapshot().uncertain).toBe(true);
  c.edit('email', 'another@example.com');
  c.edit('password', 'anotherpass');
  c.back();
  c.openSignup();
  await c.submit();
  const calls = jest.mocked(actions.register).mock.calls;
  expect(calls[1].slice(0, 2)).toEqual(calls[0].slice(0, 2));
  expect(c.getSnapshot().stage).toBe('consents');
  expect(c.getSnapshot().password).toBe('');
});
it('preserves a processing birth date and recovers it without spending a profile edit', async () => {
  const { actions, c } = fixture();
  await registered(c);
  c.toggle('all');
  await c.submit();
  jest
    .mocked(actions.birth)
    .mockRejectedValueOnce(
      new ApiError('http', { status: 409, code: 'REQUEST_IN_PROGRESS' }),
    );
  await c.submit();
  expect(c.getSnapshot().birthUncertain).toBe(true);
  c.changeDate('month', 6);
  await c.submit();
  expect(jest.mocked(actions.birth).mock.calls.map((call) => call[1])).toEqual([
    '2004-05-14',
    '2004-05-14',
  ]);
  expect(c.getSnapshot().result?.edits_remaining).toBe(1);
  expect(c.getSnapshot().stage).toBe('complete');
});
it('permits correcting a definitively rejected email instead of retaining its old registration operation', async () => {
  const { actions, c } = fixture();
  jest
    .mocked(actions.register)
    .mockRejectedValueOnce(
      new ApiError('http', { status: 409, code: 'EMAIL_ALREADY_USED' }),
    );
  await registered(c);
  expect(c.getSnapshot().uncertain).toBe(false);
  c.edit('email', 'new@example.com');
  await c.submit();
  const calls = jest.mocked(actions.register).mock.calls;
  expect(calls[1][0]).not.toBe(calls[0][0]);
  expect(calls[1][1].email).toBe('new@example.com');
  expect(c.getSnapshot().stage).toBe('consents');
});
it('keeps an unresolved birth date locked when revisiting consent and that unrelated save fails', async () => {
  const { actions, c } = fixture();
  await registered(c);
  c.toggle('all');
  await c.submit();
  jest
    .mocked(actions.birth)
    .mockRejectedValueOnce(
      new ApiError('http', { status: 409, code: 'REQUEST_IN_PROGRESS' }),
    );
  await c.submit();
  c.back();
  jest.mocked(actions.consent).mockRejectedValueOnce(new ApiError('network'));
  await c.submit();
  expect(c.getSnapshot().birthUncertain).toBe(true);
  await c.submit();
  c.changeDate('month', 6);
  expect(c.getSnapshot().date.month).toBe(5);
  await c.submit();
  expect(jest.mocked(actions.birth).mock.calls.map((call) => call[1])).toEqual([
    '2004-05-14',
    '2004-05-14',
  ]);
  expect(c.getSnapshot().stage).toBe('complete');
});
