import type { Auth, Bootstrap } from '../api/contracts';

export const authFixture: Auth = {
  access_token: 'mock-access-token-not-valid-on-any-server',
  refresh_token: 'mock-refresh-token-not-valid-on-any-server',
  token_type: 'Bearer',
  expires_in: 900,
};

export const bootstrapFixture: Bootstrap = {
  server_time: '2026-11-10T17:00:00Z',
  timezone: 'Asia/Seoul',
  phase: 'night',
  night_date: '2026-11-10',
  next_screen: 'NIGHT_WORRY',
  user: {
    id: 'mock-user-1',
    email: 'user@example.com',
    birth_date: '2002-06-15',
    birth_date_edits_remaining: 1,
    stats: { night_count: 0, counted_sheep_total: 0, worry_record_count: 0 },
  },
  night_id: null,
  active_session_id: null,
  last_session: null,
  support: null,
  reminder: { enabled: false, local_time: null },
  required_consents: { terms_version: '1', privacy_version: '1' },
};

export const invalidCredentialsFixture = {
  error: {
    code: 'INVALID_CREDENTIALS',
    message: '로그인 정보를 확인해주세요.',
    fields: {},
    request_id: 'mock-request-1',
  },
};

export const validationErrorFixture = {
  error: {
    code: 'VALIDATION_ERROR',
    message: '입력값을 확인해주세요.',
    fields: { email: '이메일 형식을 확인해주세요.' },
    request_id: 'mock-request-2',
  },
};
