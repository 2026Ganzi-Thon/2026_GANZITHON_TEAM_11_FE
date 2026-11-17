import { ApiError } from '../api/errors';
import {
  consentIds,
  type ConsentDocuments,
  type LegalDocumentActions,
} from '../features/legal/model';
export type LegalDocumentsScenario = 'success' | 'retry' | 'slow' | 'long';
/** Example content only; no legal policy is authored or agreed by this fixture. */
export function exampleLegalDocuments(
  revision = 'v1',
  long = false,
): ConsentDocuments {
  const titles = [
    '서비스 이용약관',
    '개인정보 수집 · 이용',
    '고민 글 외부 AI 전송',
    '알림 수신',
  ];
  return {
    revision,
    documents: consentIds.map((id, i) => ({
      id,
      title: titles[i],
      version: revision,
      body:
        `화면 검증용 예시입니다. 실제 약관 원문이 아닙니다.\n\n${titles[i]} 항목의 내용과 버전을 확인하는 화면입니다.\n\n이 동의 화면에서는 서버로 정보를 보내거나 기기 알림 권한을 요청하지 않습니다. 실제 문서와 동의 저장 계약은 서비스 연결 시 적용합니다.` +
        (long
          ? '\n\n긴 문서의 스크롤 확인을 위한 예시 문단입니다. 문서를 읽어도 기존 선택은 바뀌지 않습니다.'.repeat(
              18,
            )
          : ''),
    })),
  };
}
export function createMockLegalDocuments(
  scenario: LegalDocumentsScenario = 'success',
): LegalDocumentActions {
  let failed = false;
  return {
    load: (signal) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new ApiError('aborted'));
          return;
        }
        const abort = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          reject(new ApiError('aborted'));
        };
        const timer = setTimeout(
          () => {
            signal.removeEventListener('abort', abort);
            if (scenario === 'retry' && !failed) {
              failed = true;
              reject(new ApiError('network'));
              return;
            }
            resolve(exampleLegalDocuments('v1', scenario === 'long'));
          },
          scenario === 'slow' ? 5000 : 500,
        );
        signal.addEventListener('abort', abort, { once: true });
      }),
  };
}
