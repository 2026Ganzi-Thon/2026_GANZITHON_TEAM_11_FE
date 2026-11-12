import { ApiError } from '../api/errors';
import { categories } from '../features/night/categories';
import {
  PREVIEW_TEXT_CARD_LIMIT,
  textCardLength,
  type TextCardActions,
  type TextCardDraft,
  type TextCardSubmission,
} from '../features/cards/types';
export type TextCardScenario =
  | 'success'
  | 'retry'
  | 'lost-response'
  | 'field-error'
  | 'support'
  | 'safety-unavailable'
  | 'entry-required';
/** Session-only adapter. Error scenarios are fixtures, never content classification. */
export function createMockTextCards(
  scenario: TextCardScenario = 'success',
  {
    sourceNightId = 'preview-night',
    canSubmit = () => true,
    onSubmitted = () => {},
  }: {
    sourceNightId?: string;
    canSubmit?: () => boolean;
    onSubmitted?: (receipt: TextCardSubmission) => void;
  } = {},
): TextCardActions {
  let version = 0;
  let draft: TextCardDraft = {
    category_id: null,
    text: '',
    operationKey: 'preview-text-0',
  };
  let failed = false;
  const accepted = new Map<
    string,
    { fingerprint: string; receipt: TextCardSubmission }
  >();
  const fingerprint = (value: Pick<TextCardDraft, 'category_id' | 'text'>) =>
    JSON.stringify([value.category_id, value.text.trim()]);
  const copy = (receipt: TextCardSubmission) => ({
    ...receipt,
    content: { ...receipt.content },
  });
  return {
    readDraft: () => ({ ...draft }),
    writeDraft(value) {
      if (fingerprint(value) !== fingerprint(draft)) version++;
      draft = { ...value, operationKey: `preview-text-${version}` };
      return { ...draft };
    },
    submit(value, key, signal) {
      const body = JSON.stringify(value);
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new ApiError('aborted'));
          return;
        }
        const cleanup = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
        };
        const abort = () => {
          cleanup();
          reject(new ApiError('aborted'));
        };
        const timer = setTimeout(() => {
          cleanup();
          try {
            const previous = accepted.get(key);
            if (previous) {
              if (previous.fingerprint !== body)
                throw new ApiError('http', {
                  status: 409,
                  code: 'IDEMPOTENCY_CONFLICT',
                });
              resolve(copy(previous.receipt));
              return;
            }
            if (
              value.source_night_id !== sourceNightId ||
              !canSubmit() ||
              scenario === 'entry-required'
            )
              throw new ApiError('http', {
                status: 409,
                code: 'WRITING_ENTRY_REQUIRED',
              });
            if (
              value.kind !== 'text' ||
              !categories.some(
                (c) => c.id !== 'none' && c.id === value.category_id,
              )
            )
              throw new ApiError('http', {
                status: 422,
                fields: { category_id: '고민 분류를 다시 골라 주세요.' },
              });
            if (
              !textCardLength(value.content.text) ||
              textCardLength(value.content.text) > PREVIEW_TEXT_CARD_LIMIT
            )
              throw new ApiError('http', {
                status: 422,
                fields: { 'content.text': '1~200자로 적어 주세요.' },
              });
            if (
              !failed &&
              scenario !== 'success' &&
              scenario !== 'lost-response'
            ) {
              failed = true;
              if (scenario === 'retry') throw new ApiError('network');
              if (scenario === 'field-error')
                throw new ApiError('http', {
                  status: 422,
                  fields: { 'content.text': '글 내용을 다시 확인해 주세요.' },
                });
              if (scenario === 'support')
                throw new ApiError('http', {
                  status: 422,
                  code: 'SUPPORT_RECOMMENDED',
                  serverMessage:
                    '지금은 글을 보내기보다 잠시 쉬어 가도 괜찮아요.',
                });
              if (scenario === 'safety-unavailable')
                throw new ApiError('http', {
                  status: 503,
                  code: 'SAFETY_CHECK_UNAVAILABLE',
                });
            }
            const receipt: TextCardSubmission = {
              id: `preview-submitted-text-${accepted.size + 1}`,
              kind: 'text',
              category_id: value.category_id,
              content: { text: value.content.text.trim() },
              moderation_status: 'pending',
            };
            accepted.set(key, { fingerprint: body, receipt });
            onSubmitted(copy(receipt));
            if (scenario === 'lost-response' && !failed) {
              failed = true;
              throw new ApiError('network');
            }
            resolve(copy(receipt));
          } catch (error) {
            reject(error);
          }
        }, 400);
        signal.addEventListener('abort', abort, { once: true });
      });
    },
  };
}
