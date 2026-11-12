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

`npm run android`는 네이티브 프로젝트를 생성하고 개발용 앱을 빌드·설치한 뒤 Metro를 실행합니다. Android SDK와 JDK가 환경에 설정되어 있어야 합니다. 첫 빌드에는 SDK 구성 요소와 Gradle 의존성 다운로드가 필요할 수 있습니다.

개발용 앱이 설치된 뒤에는 다음 명령으로 Metro를 다시 실행합니다.

```sh
npm start
```

네이티브 의존성이나 앱 설정을 바꾸면 `npm run android`로 다시 빌드합니다. 생성된 `android/`, `ios/`는 Git에 포함하지 않으며, 네이티브 설정은 `app.json`과 Expo config plugin으로 관리합니다.

## 검사

```sh
npm run check          # 타입, ESLint, Prettier 검사
npm run test:ci        # Jest 실행
npm run bundle:android # Android JavaScript 번들 생성
```

현재는 초기 화면과 개발 환경만 구성되어 있어 기능 테스트가 없습니다. `test:ci`는 이 단계에 한해 테스트 파일이 없어도 종료하며, 첫 기능 테스트를 추가할 때 `--passWithNoTests`를 제거합니다. 번들 검사는 APK 빌드나 실제 기기 검증을 대신하지 않습니다.

PR에서는 위 검사를 GitHub Actions로 실행합니다. 변경한 화면은 Android에서도 확인하고, PR에 검증 결과와 남은 제한 사항을 기록합니다. 코드 포맷은 `npm run format`으로 적용합니다.

## 구성

```text
src/app/       Expo Router 화면과 공통 레이아웃
app.json       앱 및 네이티브 설정
.github/       CI와 PR 템플릿
```

API 연결은 아직 구현하지 않았습니다. `.env.example`의 `EXPO_PUBLIC_API_BASE_URL`은 후속 연동을 위한 예시이며 현재 앱에서는 사용하지 않습니다. `EXPO_PUBLIC_*` 값은 앱에 포함되므로 비밀 키를 넣지 않습니다.
