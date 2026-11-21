import { ApiError } from './api';
import { isMessageKey, type MessageKey, type Translate } from './i18n';

const STATUS_KEYS: Record<number, MessageKey> = {
  400: 'errors.bad_request',
  401: 'errors.invalid_key',
  402: 'errors.no_credit',
  403: 'errors.forbidden',
  404: 'errors.not_found',
  429: 'errors.rate_limited',
  500: 'errors.internal_error',
  502: 'errors.upstream_error',
  504: 'errors.timeout',
};

export function errorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    if (isMessageKey(key)) return t(key);
    const statusKey = STATUS_KEYS[error.status];
    if (statusKey) return t(statusKey);
    return t('errors.generic');
  }

  if (error instanceof TypeError) return t('errors.network');
  return t('errors.generic');
}

export function streamErrorMessage(code: string, t: Translate): string {
  const key = `errors.${code}`;
  if (isMessageKey(key) && key.startsWith('errors.')) return t(key);
  return t('errors.stream_error');
}
