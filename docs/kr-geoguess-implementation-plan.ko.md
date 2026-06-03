# 한국 Geo Guess 개발 계획

작성일: 2026-05-31

> 현재 구현 기준 문서는 `docs/project-guide.ko.md`다. 이 문서는 초기 개발 계획의 기록이며, Colyseus/듀얼 등 일부 항목은 현재 제품 범위에서 제거되었다.

이 계획은 빈 레포에서 한국 전용 GeoGuessr류 게임을 만든다는 전제로 작성한다. 핵심은 먼저 로드뷰 제공자 사용 가능성을 확인하고, 그 뒤에 게임/멀티플레이 기능을 단계적으로 쌓는 것이다.

## 기본 결정

- 1차 제공자는 카카오 로드뷰로 시작한다.
- 제공자 SDK는 Provider Adapter 뒤에 숨긴다.
- 게임 서버에는 우리 게임 데이터와 시드 좌표만 저장한다.
- 로드뷰 이미지, 타일, 스크린샷, 제공자 결과 데이터는 저장하지 않는다.
- 카카오 `panoId` 저장은 허가 또는 약관상 명확한 근거가 생길 때까지 하지 않는다.
- 공개 랭크전은 MVP가 아니다.
- 친구방 멀티플레이를 먼저 만든다.

## 선택 스택

- TypeScript
- Vite React
- Colyseus 실시간 서버
- PostgreSQL + PostGIS
- Drizzle ORM
- Vitest
- Playwright
- Docker Compose

초기 구조:

```text
apps/
  web/
    src/
      components/
      features/game/
      features/lobby/
      features/provider/
      features/results/
      lib/
  realtime/
    src/
      rooms/
      game/
      provider/
      scoring/
      persistence/
packages/
  shared/
    src/
      types/
      scoring/
      geo/
docs/
```

## 0단계: 제공자/약관 가능성 확인

목표: 큰 개발 전에 카카오 로드뷰로 실제 게임이 가능한지 확인한다.

작업:

1. Kakao Developers 앱을 만든다.
2. Kakao Map API를 활성화한다.
3. 로컬/스테이징/프로덕션 도메인을 등록한다.
4. 버리는 정적 POC를 만든다.
   - Kakao Maps SDK 로드
   - `kakao.maps.Roadview` 생성
   - `RoadviewClient.getNearestPanoId` 호출
   - 한국 좌표 하나 렌더링
   - `null` 파노라마 처리
5. 실제 동작을 기록한다.
   - 데스크톱/모바일에서 로드되는지
   - 이동 화살표 제어가 가능한지
   - pan/zoom과 이동을 분리할 수 있는지
   - 어떤 이벤트가 위치나 pano 정보를 노출하는지
6. 카카오 DevTalk 또는 비즈니스 채널에 확인한다.
   - 공개 GeoGuessr류 게임에서 Roadview 사용 가능 여부
   - `panoId` 저장 가능 여부
   - "이 좌표는 로드뷰 가능" 같은 결과 저장 가능 여부
   - 별도 협의, 표기, 요금, 쿼터 조건
7. 카카오가 막히거나 모호하면 네이버 파노라마로 같은 POC를 작게 만든다.

완료 기준:

- 공식 SDK로 카카오 로드뷰를 좌표에서 열 수 있다.
- 공개 게임 사용 가능 여부가 확인된다.
- 저장 가능한 제공자 데이터 범위가 정리된다.
- 이동 제한 모드 가능성이 확인된다.

이 단계가 해결되기 전에는 공개 멀티플레이 개발을 크게 진행하지 않는다.

## 1단계: 프로젝트 기반

목표: 앱, 서버, 테스트, DB 기반을 만든다.

작업:

1. pnpm 워크스페이스를 만든다.
2. `apps/web`에 Vite React 앱을 만든다.
3. `apps/realtime`에 Colyseus 서버를 만든다.
4. `packages/shared`에 공용 타입/점수/거리 유틸을 둔다.
5. Docker Compose로 PostgreSQL/PostGIS와 Redis를 준비한다.
6. 환경 변수 검증을 추가한다.
   - `KAKAO_MAP_JS_KEY`
   - `DATABASE_URL`
   - `REDIS_URL`
   - `PUBLIC_APP_URL`
7. 스크립트를 추가한다.
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:e2e`
8. 웹 헬스 화면과 서버 헬스 엔드포인트를 만든다.

완료 기준:

- 로컬에서 웹과 실시간 서버가 실행된다.
- 타입체크와 테스트가 돌아간다.
- 필수 환경 변수가 없으면 명확히 실패한다.

## 2단계: Provider Adapter POC

목표: 카카오 SDK 의존성을 게임 로직에서 분리한다.

만들 것:

- `KakaoScriptLoader`
- `KakaoPanoramaProvider`
- `KakaoGuessMapProvider`
- `ProviderErrorBoundary`
- 공용 `PanoramaProvider` 인터페이스
- 공용 `GuessMapProvider` 인터페이스

상태 모델:

- `ready`
- `loading`
- `no_pano`
- `provider_error`
- `quota_or_auth_error`
- `network_error`

테스트:

- SDK 스크립트가 중복 로드되지 않는다.
- 파노라마 없음 상태가 UI에 표시된다.
- 라운드 전환 시 이벤트 리스너가 정리된다.
- 카카오 전역 객체는 provider 폴더 밖에서 직접 import/use하지 않는다.

완료 기준:

- 하드코딩된 한국 좌표 하나로 로드뷰 라운드 화면이 뜬다.
- 게임 코드는 provider 인터페이스만 사용한다.

## 3단계: 시드 카탈로그

목표: 제공자 결과를 저장하지 않고도 플레이 후보 좌표를 관리한다.

테이블:

```text
seed_locations
  id
  lat
  lng
  region_1
  region_2
  tags
  difficulty
  source_type
  source_ref
  status
  created_at
  updated_at
```

`source_type`:

- `manual`
- `osm_derived`
- `public_dataset`
- `user_submitted`

작업:

1. `seed_locations` 테이블과 공간 인덱스를 만든다.
2. 작은 수동 CSV import 스크립트를 만든다.
3. 좌표가 한국 영역 안에 있는지 검증한다.
4. 시/도, 시/군/구, 난이도, 태그를 붙인다.
5. 시드 선택기를 만든다.
   - 지역 균형
   - 도시/시골 태그
   - 최근 중복 회피
   - 선택한 모드 범위
6. 라운드 시작 전에 provider runtime check를 한다.
   - 파노라마가 없으면 다른 시드를 고른다.
   - 재시도 횟수 상한을 둔다.

금지:

- 이 단계에서 `panoId`를 저장하지 않는다.
- 제공자 API를 대량 호출해 커버리지 DB를 만들지 않는다.

완료 기준:

- 서버가 5라운드 한국 시드 세트를 만들 수 있다.
- 파노라마가 없는 좌표가 나와도 매치가 깨지지 않는다.

## 4단계: 솔로 클래식

목표: 혼자서 5라운드를 끝까지 플레이할 수 있게 한다.

화면:

- 시작 화면
- 라운드 화면
- 추측 지도
- 정답 공개
- 최종 요약

플로우:

1. 사용자가 Solo Classic을 시작한다.
2. 서버가 5개 시드를 가진 매치를 만든다.
3. 클라이언트가 1라운드 파노라마를 연다.
4. 사용자가 핀을 찍고 제출한다.
5. 서버가 거리와 점수를 계산한다.
6. 정답 공개 화면을 보여준다.
7. 5라운드까지 반복한다.
8. 최종 점수와 라운드별 결과를 보여준다.

테스트:

- 핀 없이 제출할 수 없다.
- 라운드가 잠긴 뒤 제출할 수 없다.
- 같은 정답/추측은 항상 같은 점수를 낸다.
- 새로고침 후 현재 솔로 매치를 복구한다.
- 모바일 지도 드로어가 제출 버튼을 가리지 않는다.

완료 기준:

- 데스크톱과 모바일에서 5라운드 게임을 완료할 수 있다.
- 결과 공유 페이지는 제공자 이미지를 포함하지 않는다.

## 5단계: 점수와 지리 유틸

목표: 점수 계산을 테스트 가능하고 조정 가능하게 만든다.

만들 것:

- `distanceMeters(target, guess)`
- `scoreClassic(distance, scope)`
- `scoreDuelDamage(playerScore, opponentScore, roundNumber)`
- `formatDistance`
- `formatScore`

규칙:

- 완벽 반경 안은 5000점
- 반경 밖은 지수 감쇠
- 전국/시도/도시 모드마다 감쇠값 다름
- DB에는 표시 문자열이 아니라 원본 거리와 점수를 저장

테스트:

- 같은 좌표는 5000점
- 완벽 반경 안은 5000점
- 거리가 멀수록 점수는 감소
- 전국 모드가 도시 모드보다 관대함
- 듀얼 배율은 설정된 라운드부터 적용

완료 기준:

- 점수 상수와 공식이 문서화되어 있다.
- 모든 점수 유틸에 단위 테스트가 있다.

## 6단계: 친구방 멀티플레이

목표: 여러 명이 같은 라운드를 동시에 플레이한다.

Colyseus 방:

- `KoreaClassicRoom`
- `LobbyState`
- `PlayerState`
- `RoundState`
- `GuessState`

상태 전환:

- `lobby -> countdown`
- `countdown -> round_active`
- `round_active -> round_reveal`
- `round_reveal -> next countdown`
- `finished`

호스트 기능:

- 라운드 수
- 제한 시간
- 시드 범위
- 시작
- 강퇴
- 지원 가능할 때 이동 제한 옵션

플레이어 기능:

- 링크/코드로 입장
- 닉네임 설정
- 준비
- 핀 찍기
- 제출
- 재접속

테스트:

- 모든 플레이어가 같은 라운드를 본다.
- 정답 공개 전 웹소켓 payload에 정답 좌표가 없다.
- 플레이어는 라운드당 한 번만 제출한다.
- 타이머 만료 시 라운드가 끝난다.
- 모두 제출하면 조기 종료된다.
- 연결이 끊긴 플레이어가 TTL 안에 돌아오면 복구된다.

완료 기준:

- 2-8명이 친구방에서 5라운드를 완료할 수 있다.
- 모든 클라이언트의 공개 화면과 점수판이 일치한다.

## 7단계: 결과, 히스토리, 데일리 챌린지

목표: 다시 플레이할 이유를 만든다.

만들 것:

- 게스트/로그인 사용자 매치 기록
- 제공자 이미지 없는 공개 결과 페이지
- 데일리 챌린지
- 데일리 리더보드
- 기본 프로필

데일리 규칙:

- 한국 시간 기준 하루 하나의 시드 세트
- 공식 시도는 1회
- 점수, 거리, 총 소요 시간 저장
- 재플레이는 연습으로 표시

테스트:

- 같은 날짜는 같은 데일리 시드를 만든다.
- 두 번째 시도가 공식 점수를 덮어쓰지 않는다.
- 결과 페이지는 provider API key 없이 렌더링된다.

완료 기준:

- 사용자가 매일 돌아올 이유가 있다.
- 결과 공유가 제공자 이미지 약관을 건드리지 않는다.

## 8단계: 관리자 시드 편집기

목표: 위치 품질을 운영자가 계속 개선할 수 있게 한다.

기능:

- 관리자 로그인
- 시드 목록/필터
- 좌표 추가/수정
- 지역/태그/난이도 편집
- 수동 테스트 버튼
- 시드 비활성화
- 감사 로그
- 유저 신고 처리

주의:

- 수동 테스트는 공식 뷰어를 즉시 여는 용도다.
- 테스트 결과를 영구 커버리지 DB로 쌓지 않는다.

완료 기준:

- 개발자 없이도 나쁜 위치를 제거할 수 있다.
- 신고된 위치를 빠르게 검토할 수 있다.

## 9단계: 성능과 안정성

목표: 실제 사용 중 흔한 실패를 견딘다.

작업:

- Provider 로딩 스켈레톤
- SDK/네트워크 에러 재시도
- 방 heartbeat
- 재접속 UI
- 방 생성 rate limit
- 구조화 로그
- 비용/쿼터 추정 지표

수집 지표:

- provider load success/failure
- no-pano rate
- average round load time
- reconnect count
- room completion rate
- estimated provider calls

완료 기준:

- 제공자 장애가 게임 전체 장애로 번지지 않는다.
- 예상 비용을 대략 계산할 수 있다.
- 플레이어가 나가도 방이 멈추지 않는다.

## 10단계: MVP 이후 모드

우선순위:

1. 친구 듀얼
2. 지역 스트릭
3. 팀 클래식
4. 공개 비랭크 매치메이킹
5. 랭크전
6. 토너먼트

듀얼 추가 작업:

- HP 상태
- 데미지 공식
- 첫 제출 후 15초 최종 카운트다운
- 라운드 배율
- 서든데스 규칙
- 리플레이/감사 로그

랭크전 조건:

- 제공자 사용 허가 명확화
- 치팅 대응 문서화
- 신고/제재 흐름
- 연결 끊김 규칙
- provider 실패 시 무효 처리 규칙

## 테스트 전략

단위 테스트:

- 점수
- 거리
- 시드 선택
- 방 상태 전환
- 타이머
- 권한

통합 테스트:

- 방 생성
- 입장
- 제출
- 공개
- 재접속
- 데일리 챌린지

브라우저 테스트:

- 데스크톱 솔로 게임
- 모바일 솔로 게임
- 두 브라우저 컨텍스트로 2인 방
- mock provider 기반 오류 상태
- 정답 공개 전 payload 검사

수동 QA:

- Chrome, Safari, Firefox
- iOS Safari, Android Chrome
- 느린 네트워크
- API 키 없음
- 도메인 오류
- 쿼터/인증 오류
- 파노라마 없음
- 호스트 이탈
- 라운드 중 새로고침

## 배포 순서

1. 로컬 개발
   - 로컬 Postgres/PostGIS
   - 로컬 Colyseus 서버
   - 카카오 로컬 도메인 키
2. 비공개 스테이징
   - 스테이징 도메인 등록
   - 초대 사용자 테스트
   - 쿼터 모니터링
   - 오류 로그
3. 제한 공개 베타
   - 친구방 중심
   - 랭크 없음
   - 제공자 실패 안내
4. 공개 출시
   - 비용 알림
   - 제공자 사용 허가 또는 근거 확보
   - 개인정보처리방침/이용약관
   - 신고/운영 도구

## 먼저 해결할 질문

- 카카오 로드뷰 공개 게임 사용이 별도 계약 없이 가능한가?
- 카카오 `panoId`를 저장해도 되는가?
- provider availability/failure 결과를 시드에 저장해도 되는가?
- 공식 뷰어로 진짜 No Move / No Pan / No Zoom이 가능한가?
- 추측 지도도 같은 제공자를 써야 약관상 안전한가?
- MVP 인증은 게스트 전용으로 충분한가?

기본값:

- 카카오 공식 SDK만 사용
- `panoId` 저장 안 함
- provider 커버리지 결과 영구 저장 안 함
- 파노라마와 추측 지도는 같은 제공자 사용
- 게스트 우선
- 친구방 먼저

## 첫 2주 계획

1주차:

- 카카오 로드뷰 POC
- 카카오 문의 목록 발송
- pnpm/Vite/Colyseus/PostGIS 기반 생성
- Provider Adapter 골격
- 하드코딩 단일 라운드 화면
- 점수 유틸과 테스트

2주차:

- 시드 카탈로그 테이블
- 수동 시드 import
- 솔로 5라운드
- 정답 공개 지도
- 최종 요약
- provider 실패 재시도
- 데스크톱/모바일 Playwright 체크

2주가 끝났을 때 판단할 것:

- 카카오 제약이 받아들일 만한가?
- 게임 루프가 실제로 재미있는가?
- 모바일에서 추측 지도가 충분히 편한가?
- 다음 단계로 친구방 멀티플레이를 만들 가치가 있는가?
