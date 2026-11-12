# 양 세는 밤

고민을 적고 정한 수만큼 양을 세며 하루를 마무리하는 Android 앱입니다.

2026 간지톤 11팀 프론트엔드 저장소입니다.

## 개발 환경

- Expo SDK 58 · React Native · TypeScript · Expo Router
- Node.js 24.15.0 (`.nvmrc`) · npm 11.12.1
- Android Studio, Android SDK, JDK 21
- Android 에뮬레이터 또는 USB 디버깅이 활성화된 Android 기기

## 실행

```sh
npm ci
npm run android
```

`npm run android`는 `android/`가 없으면 네이티브 프로젝트를 생성하고, 개발용 앱을 빌드·설치한 뒤 Metro를 실행합니다. `android/`가 이미 있으면 자동 prebuild를 건너뜁니다. Android SDK와 JDK가 환경에 설정되어 있어야 합니다. 첫 빌드에는 SDK 구성 요소와 Gradle 의존성 다운로드가 필요할 수 있습니다.

개발용 앱이 설치된 뒤에는 다음 명령으로 Metro를 다시 실행합니다.

```sh
npm start
```

네이티브 의존성, `app.json`의 화면 방향·scheme, config plugin 설정 등을 바꾸면 아래 순서로 Android 프로젝트를 재생성한 뒤 빌드합니다.

```sh
npx expo prebuild --clean --platform android
npm run android
```

`--clean`은 기존 `android/`를 삭제하고 다시 생성하므로 해당 폴더의 수동 변경도 지워집니다. 필요한 변경은 실행 전에 보존하고 `app.json`이나 Expo config plugin에 반영합니다. 생성된 `android/`, `ios/`는 Git에 포함하지 않으며, 네이티브 설정은 `app.json`과 Expo config plugin으로 관리합니다.

## 검사

```sh
npm run check          # 타입, ESLint, Prettier 검사
npm run test:ci        # Jest 실행
npm run bundle:android # Android JavaScript 번들 생성
```

Jest는 API 요청·오류·취소 처리와 mock 응답 연동을 검사합니다. 테스트 파일이 없으면 `test:ci`가 실패합니다. 자동 테스트와 번들 검사는 실제 서버 연동, APK 빌드, 기기 검증을 대신하지 않습니다.

PR에서는 위 검사를 GitHub Actions로 실행합니다. 변경한 화면은 Android에서도 확인하고, PR에 검증 결과와 남은 제한 사항을 기록합니다. 코드 포맷은 `npm run format`으로 적용합니다.

## 구성

```text
src/app/       Expo Router 화면과 공통 레이아웃
src/api/       HTTP 클라이언트, 오류, 인증·앱 시작 응답 타입
src/mocks/     명시적으로 주입하는 mock 전송 함수와 응답 예시
app.json       앱 및 네이티브 설정
.github/       CI와 PR 템플릿
```

## API 사용

`.env.example`을 `.env`로 복사하고 `EXPO_PUBLIC_API_BASE_URL`에 `/api/v1`을 포함한 개발 서버 주소를 지정합니다. `EXPO_PUBLIC_*` 값은 앱에 포함되므로 비밀 키를 넣지 않습니다. 현재 초기 화면에서는 API를 호출하지 않습니다.

```ts
import { createApiClient } from './src/api/client';
import { getApiBaseUrl } from './src/api/config';
import type { Bootstrap } from './src/api/contracts';

const api = createApiClient({ baseUrl: getApiBaseUrl() });
// accessToken은 인증 흐름에서 전달받습니다.
const bootstrap = await api.request<Bootstrap>('/bootstrap', { accessToken });
```

요청 경로는 `/bootstrap`처럼 기본 API 경로에 상대적으로 지정합니다. JSON 요청은 `body`, 인증은 `accessToken`, 멱등키는 `idempotencyKey`로 전달합니다. 204 또는 빈 성공 응답은 `undefined`입니다. 응답의 제네릭 타입은 런타임 검증이 아니므로, 화면 연결 시 필수 필드와 허용 상태를 검증해야 합니다.

`ApiError.kind`로 서버 오류(`http`), 연결 실패(`network`), 시간초과(`timeout`), 취소(`aborted`), 잘못된 JSON(`invalid-response`), 잘못된 설정(`configuration`)을 구분합니다. 서버 오류에는 `status`, `code`, `fields`, `requestId`, `retryAfter`가 제공될 수 있습니다. `serverMessage`와 `fields`에는 민감한 내용이 포함될 수 있으므로 오류 객체 전체를 로그에 남기거나 그대로 사용자에게 표시하지 않습니다.

기본 시간제한은 10초이며 `timeoutMs`로 변경할 수 있습니다. 자동 재시도·토큰 갱신·토큰 저장은 아직 포함하지 않습니다. 변경 요청을 재시도할 때는 같은 작업의 멱등키와 본문을 유지하고, 새로운 작업에는 새 키를 전달해야 합니다.

mock은 `createMockFetch`를 클라이언트의 `fetch` 옵션에 직접 주입할 때만 사용합니다. 동일한 클라이언트와 오류 처리를 거치며, 미등록 경로는 501 `MOCK_ROUTE_NOT_FOUND`를 반환하고 실제 네트워크에 연결하지 않습니다. 경로 매칭은 메서드와 전체 pathname 기준이며 query에 따른 응답 분기는 제공하지 않습니다. mock 검증은 실제 인증·서버 구현 검증을 의미하지 않습니다.

```ts
import { createApiClient } from './src/api/client';
import { createMockFetch } from './src/mocks/transport';
import { bootstrapFixture } from './src/mocks/fixtures';

const api = createApiClient({
  baseUrl: 'https://mock.invalid/api/v1',
  fetch: createMockFetch([
    { method: 'GET', path: '/api/v1/bootstrap', body: bootstrapFixture },
  ]),
});
```
