import type { Support } from '../api/contracts';
/** Fixed fixture, independent of writing contents. Resource details are not safety classification. */
export function createMockSupport(): Support {
  return {
    message:
      '지금은 잠시 쉬어 가도 괜찮아요. 도움이 필요하다면 아래 안내를 확인하거나 믿을 수 있는 사람에게 연락해 보세요.',
    resources: [
      {
        label: '자살예방상담전화 109 · 전화 앱 열기',
        action: 'call',
        target: 'tel:+82109',
      },
      {
        label: '믿을 수 있는 사람에게 연락하기',
        action: 'open_contacts',
        target: null,
      },
      {
        label: '109 안내 사이트 열기',
        action: 'open_url',
        target: 'https://www.129.go.kr/109',
      },
    ],
  };
}
