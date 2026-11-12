import { ApiError } from './errors';

/** Read only when connecting an API; importing screens does not require an env file. */
export function getApiBaseUrl(
  value = process.env.EXPO_PUBLIC_API_BASE_URL,
): string {
  if (!value?.trim()) throw new ApiError('configuration');
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ApiError('configuration');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new ApiError('configuration');
  }
  return url.href.replace(/\/+$/, '');
}
