# 어디길 프로젝트 공식 가이드

이 문서는 현재 코드 기준의 기준 문서다. `docs/kr-geoguess-*.ko.md` 계열 문서는 초기 리서치와 계획의 기록이고, 실제 구현 상태를 이해할 때는 이 문서를 먼저 본다.

## 1. 프로젝트 한 줄 정의

`어디길`은 한국 지역만 대상으로 하는 로드뷰 위치 추측 웹 게임이다. 사용자는 Kakao Roadview를 보고 한국 지도에 핀을 찍고, 정답과의 거리에 따라 점수를 얻는다.

핵심 방향:

- 한국 사용자에게 익숙한 지역 감각을 쓰게 한다.
- 해외 GeoGuess 게임보다 한국 지형, 생활도로, 도 단위 선택에 집중한다.
- 로드뷰 이미지는 저장, 프록시, 재배포하지 않는다.
- 친구방에서는 모든 사람이 같은 라운드를 보고, 정답 공개 전에는 다른 사람의 핀이 보이지 않는다.

## 2. 현재 제공 기능

싱글플레이:

- 전국, 서울특별시, 각 도 단위 맵 선택
- 난이도 `하`, `중`, `상`
- 제한시간 `30초`, `45초`, `60초`, `90초`
- 5라운드 플레이
- 정답 공개 지도에서 내 핀, 정답 핀, 거리 표시
- 최종 결과 화면에서 총점, 평균 오차, 최고 라운드, 라운드별 결과
- 서버가 없어도 GitHub Pages 정적 배포만으로 플레이 가능

친구방 멀티플레이:

- 방 만들기와 코드/링크 입장
- 방장이 게임 시작 및 다음 라운드 진행
- 모든 플레이어가 같은 라운드 seed를 본다.
- 플레이어는 대기실에서 16색 팔레트 중 중복되지 않는 핀 색을 고른다.
- 정답 공개 전에는 자기 핀만 볼 수 있다.
- 라운드는 제한시간이 끝나면 자동 공개된다.
- 모든 접속 플레이어가 제출하면 방장에게만 조기 공개 버튼이 열린다.
- 방장 조기 공개는 3초 카운트다운 후 모든 플레이어에게 동시에 공개된다.
- 공개 후 정답 핀, 내 핀, 친구 핀, 라운드 순위가 보인다.
- 최종 결과에서는 전체 순위, 라운드별 점수, 우승 강조, 콘페티가 보인다.

랭킹:

- 브라우저 localStorage 기반 싱글 랭킹
- Node API가 연결되면 싱글 점수를 서버 리더보드에도 제출
- 친구방 멀티플레이가 끝나면 각 플레이어의 최종 점수를 같은 서버 리더보드에 기록
- 서버 리더보드는 현재 JSON 파일 저장소를 사용한다.

## 3. 의도적으로 하지 않는 것

- 로드뷰 이미지 저장
- 로드뷰 이미지 프록시
- Kakao 파노라마 ID 저장
- 일부 플레이어가 제출하지 않았는데 방장이 임의로 라운드 종료
- 듀얼 대미지/체력 모드
- 사용자 계정/로그인
- 멀티 방 영구 저장
- DB 기반 리더보드

## 4. 기술 스택

공통:

- Node.js 22
- npm workspaces
- TypeScript

웹:

- React 19
- Vite 6
- lucide-react 아이콘
- Kakao Maps JavaScript SDK Roadview
- SVG 기반 자체 한국 지도
- Playwright E2E/시각 QA

API:

- Express 5
- Vitest
- Supertest
- 파일 또는 메모리 기반 리더보드 저장소

도메인 패키지:

- `@kr-geo-guess/shared`
- 점수 계산, 거리 계산, seed 선택, match plan 생성, 맵 정의를 순수 TypeScript로 제공

배포:

- 프론트: GitHub Pages
- API: Render Web Service
- API persistent disk: 리더보드 JSON 보존용

## 5. 저장소 구조

```text
apps/web
  React/Vite 프론트엔드

apps/realtime
  Express 기반 Node API
  이름은 realtime이지만 현재 멀티는 HTTP polling 방식이다.

packages/shared
  게임 도메인 로직
  프론트와 API가 같이 쓰는 타입/점수/seed/맵 함수

data/boundaries
  SVG 지도 렌더링용 시군구 GeoJSON

data/seed-pipeline
  출제 좌표 후보, 로드뷰 검증 결과, 런타임 seed JSON

scripts
  QA, seed audit, seed 후보 생성/검증/컴파일 도구

docs
  공식 가이드, 배포 가이드, 리서치/계획 기록
```

중요한 파일:

- `apps/web/src/App.tsx`: 앱 최상위 상태와 싱글/친구방 진입
- `apps/web/src/features/home/HomeScreen.tsx`: 홈, 맵 선택, 난이도, 친구방, 랭킹
- `apps/web/src/features/room/RoomInviteScreen.tsx`: 초대 링크 전용 친구방 입장 화면
- `apps/web/src/features/game/GameScreen.tsx`: 싱글 게임 화면
- `apps/web/src/features/game/RoomGameScreen.tsx`: 친구방 게임 화면
- `apps/web/src/features/api/staticGameApi.ts`: 서버 없이 싱글플레이를 돌리는 브라우저 내부 match API
- `apps/web/src/features/api/gameApi.ts`: Node API 클라이언트
- `apps/web/src/features/map/KoreaGuessMap.tsx`: 한국 SVG 지도, 클릭 좌표 변환, 핀/결과 오버레이
- `apps/web/src/features/provider/KakaoRoadviewPanel.tsx`: Kakao Roadview 표시
- `apps/realtime/src/http/createApiApp.ts`: HTTP 라우트
- `apps/realtime/src/http/matchStore.ts`: 서버 싱글 match와 리더보드 기록
- `apps/realtime/src/http/roomStore.ts`: 친구방 상태와 라운드 규칙
- `apps/realtime/src/http/seedCatalog.ts`: 런타임 seed JSON 로드
- `packages/shared/src/seeds.ts`: 맵 정의, seed fallback, 난이도별 seed 선택
- `packages/shared/src/match.ts`: match plan, 공개 round, 제출 결과 생성
- `packages/shared/src/roomColors.ts`: 친구방 플레이어 핀 색 팔레트
- `packages/shared/src/scoring.ts`: 점수 공식
- `packages/shared/src/geo.ts`: 거리 계산과 한국 영역 제한

## 6. 런타임 구조

### 6.1 프론트 부팅

`App.tsx`가 먼저 실행된다.

1. `VITE_API_BASE_URL`이 있으면 `/api/daily`, `/api/maps`, `/api/leaderboard`를 호출한다.
2. API 호출이 실패하거나 API URL이 없으면 shared fallback 맵 정보로 홈을 보여준다.
3. API가 없으면 친구방은 비활성화되고 싱글플레이만 가능하다.
4. API가 있으면 친구방과 서버 리더보드가 활성화된다.

### 6.2 싱글플레이

현재 웹 UI의 싱글플레이는 항상 `staticGameApi.ts`를 사용한다.

이유:

- GitHub Pages 정적 배포만으로도 게임이 돌아가야 한다.
- 싱글 라운드 진행은 서버 round-trip 없이 빠르게 처리할 수 있다.
- 서버가 연결된 경우에도 최종 점수만 서버 리더보드에 제출하면 된다.

흐름:

1. 사용자가 맵, 난이도, 제한시간을 고르고 시작한다.
2. `createStaticSoloMatch`가 `data/seed-pipeline/runtime/verified-seeds.json`을 불러온다.
3. JSON 로드 실패 시 `packages/shared/src/seeds.ts`의 수동 fallback seed를 쓴다.
4. `createMatchPlan`이 5라운드 seed를 결정한다.
5. 로드뷰와 지도 데이터가 준비되면 타이머가 시작된다.
6. 사용자가 핀을 찍고 제출하거나 시간이 끝나면 `submitRoundGuess`로 점수를 계산한다.
7. 5라운드 후 결과 화면을 보여주고 localStorage 랭킹에 저장한다.
8. API가 연결되어 있으면 `/api/leaderboard`에도 점수를 제출한다.

### 6.3 친구방 멀티플레이

친구방은 `apps/realtime/src/http/roomStore.ts`가 관리한다.

현재 방식:

- HTTP API + 1초 polling
- WebSocket/Colyseus 없음
- 방 상태는 서버 메모리에 있음
- 서버 재시작 시 진행 중인 방은 사라짐

흐름:

1. 방 만들기: `POST /api/rooms`
2. 입장: `POST /api/rooms/:roomCode/join`
3. 방장이 시작: `POST /api/rooms/:roomCode/start`
4. 각 클라이언트는 1초마다 `GET /api/rooms/:roomCode`로 상태를 갱신한다.
5. 대기실에서 플레이어는 `POST /api/rooms/:roomCode/color`로 중복되지 않는 핀 색을 고를 수 있다.
6. 플레이어 제출: `POST /api/rooms/:roomCode/guess`
7. 모든 접속 플레이어가 제출하면 방장에게 공개 버튼이 열린다.
8. 방장이 공개를 누르면 `round_reveal_countdown`으로 바뀌고 3초 후 `round_reveal`이 된다.
9. 방장이 공개를 누르지 않아도 제한시간이 끝나면 다음 polling 또는 제출 요청에서 서버가 자동 공개한다.
10. 공개 후 방장이 `POST /api/rooms/:roomCode/next`로 다음 라운드 또는 최종 결과로 넘긴다.
11. 플레이어가 나가면 `POST /api/rooms/:roomCode/leave`로 연결 상태를 갱신하고, 방장이 나간 경우 다른 접속 플레이어에게 방장 권한을 넘긴다.
    진행 중인 방에서 접속 플레이어가 0명이 되면 서버는 방을 삭제한다.
12. 프론트는 방 입장 시 browser history entry를 추가해서 홈 버튼이나 뒤로가기 모두 leave 흐름을 타도록 한다.
13. 마지막 라운드 종료 시 서버는 각 플레이어의 최종 점수를 `playerId` 기준으로 공유 리더보드에 기록한다.

공정성 규칙:

- 방 생성 시 하나의 match plan이 만들어진다.
- 모든 플레이어는 같은 `roundIndex`와 같은 `seedId`를 본다.
- 정답 공개 전에는 `room.revealed`가 `null`이다.
- 공개 전 peer guess는 클라이언트에 전달되지 않는다.
- 공개 후에만 정답과 모든 제출 결과가 내려간다.
- 핀을 찍지 못한 플레이어는 `guess: null`, `score: 0`으로 결과에 포함된다.

## 7. HTTP API

기본 URL은 `VITE_API_BASE_URL` 또는 Render 서비스 URL이다.

공통:

- `GET /health`
- `GET /api/seeds`
- `GET /api/maps`
- `GET /api/daily`

싱글/랭킹:

- `POST /api/solo-matches`
- `GET /api/solo-matches/:matchId`
- `POST /api/solo-matches/:matchId/guess`
- `POST /api/solo-matches/:matchId/next`
- `GET /api/leaderboard`
- `POST /api/leaderboard`

친구방:

- `POST /api/rooms`
- `POST /api/rooms/:roomCode/join`
- `GET /api/rooms/:roomCode`
- `POST /api/rooms/:roomCode/color`
- `POST /api/rooms/:roomCode/start`
- `POST /api/rooms/:roomCode/guess`
- `POST /api/rooms/:roomCode/reveal`
- `POST /api/rooms/:roomCode/next`
- `POST /api/rooms/:roomCode/leave`

`POST /api/rooms/:roomCode/reveal`은 방장 전용이다. 현재 라운드에서 접속 중인 모든 플레이어가 제출한 경우에만 `round_reveal_countdown`으로 바뀐다.

## 8. 맵과 지도 UI

사용자가 선택할 수 있는 맵:

- 전국
- 서울특별시
- 경기도
- 강원도
- 충청북도
- 충청남도
- 경상북도
- 경상남도
- 전라북도
- 전라남도
- 제주도

전국 맵은 런타임 seed 전체를 사용한다. 여기에는 부산, 대구, 인천, 광주, 대전, 울산, 세종 seed도 포함된다. 다만 홈 선택지는 현재 한국 전체와 서울/도 단위에 집중한다.

지도 렌더링:

- `data/boundaries/skorea_municipalities_geo_simple.json`을 불러온다.
- `KoreaGuessMap`이 GeoJSON 좌표를 SVG 좌표로 투영한다.
- 선택한 맵이 도 단위면 해당 지역 viewBox로 확대한다.
- 게임 중 지도 라벨은 숨기고, 패널 제목에 선택 맵 이름을 보여준다.
- 마우스 hover 시 현재 시군구 이름을 툴팁으로 보여준다.
- 클릭은 실제 보이는 SVG 좌표에서 위경도로 역변환한다.
- 선택 지역 polygon 밖을 클릭하면 guess를 만들지 않는다.

## 9. 출제 좌표와 seed 파이프라인

런타임 우선 seed:

- `data/seed-pipeline/runtime/verified-seeds.json`

fallback seed:

- `packages/shared/src/seeds.ts`

현재 목표:

- 17개 시/도 각각 1000개
- 난이도별 기본 목표 `easy 334 / medium 333 / hard 333`

seed 생성/검증 원칙:

- OSM 기반 후보를 만든다.
- 후보는 바로 게임에 넣지 않는다.
- Kakao 공식 SDK 흐름으로 주변 로드뷰 존재 여부를 확인한다.
- Kakao 행정구역 검증으로 지역이 맞는지 확인한다.
- 관공서 정면, 역 광장, 유명 관광지 정면, 간판 하나로 바로 특정되는 위치는 제외한다.
- 런타임 JSON에는 로드뷰 이미지나 panoId를 저장하지 않는다.

주요 명령:

```bash
npm run seed:audit
npm run seed:candidates
npm run seed:roadview
npm run seed:build
npm run seed:compile
```

지역 검증 테스트:

- `packages/shared/src/__tests__/runtime-seed-audit.test.ts`
- 런타임 seed가 roadview/region 검증 후보에서 왔는지 확인한다.
- 선택 가능한 맵이 자기 지역 seed만 노출하는지 확인한다.

## 10. 난이도와 라운드 선택

seed 자체 난이도:

- `easy`
- `medium`
- `hard`

사용자 선택 난이도:

- `하` -> 내부값 `easy`
- `중` -> 내부값 `normal`
- `상` -> 내부값 `hard`

선택 비율:

```text
하(easy):   easy 62%, medium 30%, hard 8%
중(normal): easy 28%, medium 48%, hard 24%
상(hard):   easy 10%, medium 28%, hard 62%
mixed:      easy 34%, medium 33%, hard 33%
```

`mixed`는 데일리 챌린지 같은 내부 균형 모드에서 쓴다.

라운드 선택:

- match 생성 시 seed 목록을 deterministic shuffle한다.
- `idSeed`가 같으면 같은 라운드 구성이 나온다.
- 친구방은 방 생성 시 plan을 만들고 모든 플레이어가 같은 plan을 공유한다.

## 11. 점수 공식

거리 계산:

- `distanceMeters`가 Haversine 공식으로 두 좌표 간 거리를 계산한다.

기본 점수:

- 최대 라운드 점수는 5000점
- 완벽 반경 안이면 5000점
- 반경 밖은 지수 감쇠

스코프별 설정:

```text
national: 완벽 반경 25m, 감쇠 140km
province: 완벽 반경 20m, 감쇠 30km
city:     완벽 반경 15m, 감쇠 8km
```

시간 보너스:

- 최대 200점
- 제한시간 길이가 아니라 제출까지 걸린 시간 기준으로 계산한다.
- 현재는 첫 30초 안에서 빠를수록 보너스가 크고, 30초 이후 제출은 시간 보너스가 없다.
- 같은 정확도와 같은 경과 시간이라면 30초/60초/90초 방의 시간 보너스는 같다.
- 정확도가 낮으면 빨리 찍어도 보너스가 작다.
- 최종 라운드 점수는 5000점을 넘지 않는다.

미제출:

- `guess: null`
- `distanceMeters: null`
- `score: 0`

한국 영역 밖 제출:

- `isInsideKoreaBounds`에서 거부한다.

## 12. 로드뷰 정책

이 프로젝트는 로드뷰 데이터를 매우 보수적으로 다룬다.

하는 것:

- Kakao Maps JavaScript SDK를 브라우저에서 직접 로드한다.
- Roadview 컴포넌트에 위경도를 전달한다.
- 사용자는 Kakao 제공 UI를 통해 로드뷰를 본다.

하지 않는 것:

- 로드뷰 이미지를 저장하지 않는다.
- 로드뷰 이미지를 서버로 프록시하지 않는다.
- 로드뷰 스크린샷을 asset으로 만들지 않는다.
- panoId를 런타임 seed로 저장하지 않는다.

필요한 설정:

- `.env` 또는 GitHub Actions secret/variable에 `VITE_KAKAO_MAP_JS_KEY`
- Kakao Developers JavaScript SDK 도메인 등록
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
  - `https://junhyub3090.github.io`

## 13. 환경 변수

웹 빌드:

```text
VITE_KAKAO_MAP_JS_KEY
VITE_API_BASE_URL
VITE_BASE_PATH
```

API 서버:

```text
PORT
REALTIME_PORT
WEB_ORIGIN
WEB_ORIGINS
LEADERBOARD_DATA_FILE
NODE_VERSION
```

설명:

- `VITE_API_BASE_URL`: 비어 있으면 싱글플레이만 동작한다.
- `WEB_ORIGIN`: 단일 허용 프론트 origin
- `WEB_ORIGINS`: 쉼표로 여러 origin 허용
- `LEADERBOARD_DATA_FILE`: 서버 리더보드 JSON 파일 경로
- `PORT`: Render가 주입하는 포트

## 14. 로컬 실행

설치:

```bash
npm install
```

환경 파일:

```bash
cp .env.example .env
```

개발 서버:

```bash
npm run dev
```

개별 실행:

```bash
npm run dev:web
npm run dev:realtime
```

프로덕션 빌드:

```bash
npm run build
```

API만 빌드/실행:

```bash
npm run build:api
npm run start:api
```

## 15. 배포

프론트:

- GitHub Pages
- workflow: `.github/workflows/deploy-web.yml`
- 빌드 산출물: `apps/web/dist`
- base path: `/kr-geo-guess/`

API:

- Render Web Service
- 설정: `render.yaml`
- build: `npm ci && npm run build:api`
- start: `npm run start:api`
- health check: `/health`
- 리더보드 저장: `/var/data/leaderboard.json`

배포 후 연결:

1. Render API URL을 GitHub repository variable `VITE_API_BASE_URL`에 넣는다.
2. Kakao Developers 도메인에 GitHub Pages origin을 등록한다.
3. GitHub Pages workflow를 다시 실행한다.
4. 홈에서 친구방 버튼이 활성화되는지 확인한다.

## 16. QA와 테스트

전체 QA:

```bash
npm run qa
```

이 명령이 하는 일:

1. shared 단위 테스트
2. shared 빌드
3. realtime API 테스트
4. 전체 타입체크
5. 전체 프로덕션 빌드
6. 웹 번들 크기 확인
7. Playwright E2E/시각 QA

주요 테스트 범위:

- 점수 계산
- seed 선택과 지역 검증
- API CORS/health/leaderboard/room flow
- 싱글 라운드 플레이
- 친구방 멀티플레이
- 홈 화면 잘림 방지
- 맵 선택 시 viewBox 변경
- 지도 클릭 위치와 핀 위치 일치
- 서울/전국 경계선 렌더링
- 결과 오버레이 최소화
- 모바일 레이아웃

seed 감사:

```bash
npm run seed:audit
```

커밋/푸시 전에는 최소한 `npm run qa`를 통과시키는 것을 기준으로 한다.

## 17. 유지보수 가이드

### 맵을 추가할 때

1. `packages/shared/src/seeds.ts`의 `KOREA_GAME_MAPS`에 맵 정의를 추가한다.
2. 해당 맵의 `regions`가 seed의 `region1`과 일치해야 한다.
3. 필요한 경우 `data/seed-pipeline/region-targets.ko.json`에 목표를 추가한다.
4. `runtime-seed-audit.test.ts`가 통과하는지 확인한다.
5. `visual-qa.spec.ts`에서 선택 지도 viewBox와 클릭 테스트를 보강한다.

### 출제 좌표를 바꿀 때

1. 후보 생성
2. 로드뷰 존재 검증
3. 행정구역 검증
4. 사람이 너무 쉬운 위치를 제외
5. runtime seed JSON 컴파일
6. `npm run seed:audit`
7. `npm run qa`

### 점수 공식을 바꿀 때

1. `packages/shared/src/scoring.ts`
2. `packages/shared/src/match.ts`
3. `packages/shared/src/__tests__/scoring.test.ts`
4. 싱글/친구방 결과 UI에서 점수 표시가 깨지지 않는지 확인

### 친구방 규칙을 바꿀 때

1. `apps/realtime/src/http/roomStore.ts`
2. `apps/web/src/features/game/useFriendRoomGame.ts`
3. `apps/web/src/features/game/RoomGameScreen.tsx`
4. `apps/realtime/src/__tests__/api.test.ts`
5. `apps/web/tests/game.spec.ts`

규칙 변경 시 특히 확인할 것:

- 공개 전 peer pin이 보이지 않는지
- 모든 플레이어가 같은 seed를 보는지
- 시간 만료 미제출자가 0점으로 포함되는지
- 모두 제출 전 방장 공개가 막히는지
- 모두 제출 후 공개가 countdown을 거치는지

### UI를 바꿀 때

1. `apps/web/src/styles.css`
2. 관련 feature 컴포넌트
3. `apps/web/tests/visual-qa.spec.ts`
4. 데스크톱 1440x900, compact 1280x720, 모바일 393x852 확인

## 18. 현재 한계

- 친구방 상태는 메모리 기반이라 API 서버 재시작 시 사라진다.
- 친구방은 polling 방식이라 동접이 커지면 WebSocket 또는 DB/Redis 기반으로 바꿔야 한다.
- 리더보드는 JSON 파일 기반이라 장기 운영에는 Postgres/Supabase 같은 DB가 낫다.
- 사용자 계정이 없어서 랭킹 신뢰성은 낮다.
- 데일리 챌린지는 표시 중심이고, 서버에서 1일 1회 시도 제한은 아직 없다.
- 로드뷰 제공자 장애나 키 설정 문제 시 로드뷰가 표시되지 않는다.

## 19. 라이선스/출처 주의

- 게임 규칙 아이디어 자체는 위치 추측 장르의 일반적 형태지만, 브랜드/문구/지도/데이터/이미지는 자체 구현으로 유지한다.
- GeoGuessr 명칭, UI, 맵 설명, asset을 복제하지 않는다.
- Kakao Roadview는 공식 JavaScript SDK로만 표시한다.
- 지도 경계 데이터는 `data/boundaries/README.md`의 출처를 유지한다.
- OSM 기반 후보를 사용하므로 공개 서비스에서는 OpenStreetMap 기여자 표기를 유지해야 한다.

## 20. 빠른 문제 해결

로드뷰가 안 뜬다:

- `VITE_KAKAO_MAP_JS_KEY` 확인
- Kakao Developers JavaScript SDK 도메인 확인
- 브라우저 콘솔의 Kakao SDK 오류 확인

친구방 버튼이 꺼져 있다:

- `VITE_API_BASE_URL`이 비어 있거나 API 호출이 실패한 상태다.
- GitHub Pages는 variable 변경 후 다시 빌드해야 한다.

친구방에서 방이 사라졌다:

- API 서버가 재시작되면 메모리 방 상태가 사라진다.

랭킹이 재배포 후 사라졌다:

- Render persistent disk 설정
- `LEADERBOARD_DATA_FILE=/var/data/leaderboard.json`

지도 클릭 위치가 어긋난다:

- `KoreaGuessMap`의 projection, viewBox, `getSvgPointFromPointer`, `unproject`를 함께 확인한다.
- `guess marker lands on the exact visible map point that was clicked` 테스트를 먼저 본다.

지역 seed가 틀린 것 같다:

- `npm run seed:audit`
- `runtime-seed-audit.test.ts`
- candidate의 `kakaoRegion.region1`, `regionVerified` 확인
