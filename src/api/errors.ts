export type ApiErrorKind =
  | 'configuration'
  | 'http'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'invalid-response';

interface ErrorDetails {
  status?: number;
  code?: string;
  serverMessage?: string;
  fields?: Record<string, unknown>;
  requestId?: string;
  retryAfter?: string;
}

const messages: Record<Exclude<ApiErrorKind, 'http'>, string> = {
  configuration: 'Invalid API configuration',
  network: 'Network request failed',
  timeout: 'Request timed out',
  aborted: 'Request cancelled',
  'invalid-response': 'Invalid JSON response',
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly serverMessage?: string;
  readonly fields?: Record<string, unknown>;
  readonly requestId?: string;
  readonly retryAfter?: string;

  constructor(kind: ApiErrorKind, details: ErrorDetails = {}) {
    super(kind === 'http' ? `HTTP ${details.status}` : messages[kind]);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = details.status;
    this.code = details.code;
    this.serverMessage = details.serverMessage;
    this.fields = details.fields;
    this.requestId = details.requestId;
    this.retryAfter = details.retryAfter;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function httpError(response: Response, body: unknown): ApiError {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  return new ApiError('http', {
    status: response.status,
    code: typeof error.code === 'string' ? error.code : undefined,
    serverMessage:
      typeof error.message === 'string' ? error.message : undefined,
    fields: isRecord(error.fields) ? error.fields : undefined,
    requestId:
      typeof error.request_id === 'string' ? error.request_id : undefined,
    retryAfter: response.headers.get('Retry-After') ?? undefined,
  });
}
