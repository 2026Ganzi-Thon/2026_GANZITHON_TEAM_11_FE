import { expect, it } from '@jest/globals';
import { sentenceLines } from './sentences';
it('breaks displayed sentences while preserving decimal numbers, URLs and existing newlines', () => {
  expect(sentenceLines('애썼어요. 쉬어 가요! 괜찮아요?')).toBe(
    '애썼어요.\n쉬어 가요!\n괜찮아요?',
  );
  expect(sentenceLines('괜찮아.천천히 가자.')).toBe('괜찮아.\n천천히 가자.');
  expect(
    sentenceLines('3.5점. https://example.com/path 입니다.\n다음 문장'),
  ).toBe('3.5점.\nhttps://example.com/path 입니다.\n다음 문장');
});
