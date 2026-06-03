# KR Geo Guess

한국 지역만 고르는 GeoGuessr 스타일 웹 게임입니다. 로드뷰 이미지는 저장하거나 프록시하지 않고 Kakao Maps JavaScript SDK의 Roadview 컴포넌트로만 표시합니다.

## 공식 문서

현재 구현 기준의 전체 설명은 [docs/project-guide.ko.md](docs/project-guide.ko.md)에 정리되어 있습니다.

포함 내용:

- 게임 아이디어와 현재 기능
- 프론트/API/shared 패키지 구조
- 싱글플레이와 친구방 멀티플레이 흐름
- 출제 좌표와 로드뷰 취급 원칙
- 점수 공식
- 배포, 환경 변수, QA, 유지보수 기준

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run dev
```

`.env`에는 최소한 아래 값을 둡니다.

```bash
VITE_KAKAO_MAP_JS_KEY=카카오_JavaScript_키
VITE_API_BASE_URL=http://127.0.0.1:2567
```

카카오 개발자 콘솔의 JavaScript SDK 도메인에는 로컬 기준으로 `http://127.0.0.1:5173`, `http://localhost:5173`을 등록합니다.

## QA

```bash
npm run qa
```

이 명령은 단위 테스트, 타입 체크, 프로덕션 빌드, 웹 번들 크기 확인, Playwright E2E를 순서대로 실행합니다.

## 배포 구조

GitHub Pages는 정적 프론트만 호스팅합니다. 싱글플레이는 브라우저 내부 정적 모드로 바로 동작하고, 친구방 멀티플레이와 서버 리더보드는 Render, Fly.io, Railway 같은 Node 호스팅에 `apps/realtime` 서버를 따로 배포해야 동작합니다.

싱글플레이만 먼저 배포:

- GitHub 저장소에서 `docs/deploy-web.github-actions.yml` 내용을 `.github/workflows/deploy-web.yml`로 복사합니다.
- GitHub 저장소 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
- GitHub 저장소 secret 또는 variable `VITE_KAKAO_MAP_JS_KEY`에 카카오 JavaScript 키를 넣습니다.
- `VITE_API_BASE_URL`은 비워도 됩니다. 비어 있으면 친구방은 꺼지고 싱글플레이만 실행됩니다.
- 카카오 JavaScript SDK 도메인에는 `https://junhyub3090.github.io`를 추가합니다.

프론트 배포:

- GitHub Pages workflow는 `main` 브랜치 push 때 `apps/web/dist`를 배포합니다.
- GitHub 저장소 변수 `VITE_API_BASE_URL`에 배포된 Node API 주소를 넣습니다.
- GitHub 저장소 secret 또는 variable `VITE_KAKAO_MAP_JS_KEY`에 카카오 JavaScript 키를 넣습니다.
- 카카오 JavaScript SDK 도메인에는 `https://junhyub3090.github.io`를 추가합니다.

백엔드 배포:

- build command: `npm ci && npm run build -w @kr-geo-guess/shared && npm run build -w @kr-geo-guess/realtime`
- start command: `npm run start:api`
- 환경변수 `WEB_ORIGIN=https://junhyub3090.github.io` 또는 `WEB_ORIGINS`에 허용할 프론트 origin을 넣습니다.
