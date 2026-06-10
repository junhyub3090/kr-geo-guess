# Render API 배포 가이드

## 선택

이 프로젝트의 Node API는 Render Web Service로 배포한다.

Render를 고른 이유:

- Node/Express API 배포가 단순하다.
- GitHub 저장소 연결 후 `render.yaml` 기반 Blueprint 배포가 가능하다.
- `/health` 헬스체크와 persistent disk를 같은 서비스에 붙일 수 있다.
- 현재 규모에서는 Supabase/Postgres를 붙이기 전 임시 파일 리더보드 운영에 충분하다.

## 이미 repo에 준비된 것

- `npm run build:api`: shared 패키지와 realtime API만 빌드한다.
- `npm run start:api`: 빌드된 realtime API 서버를 실행한다.
- `render.yaml`: Render Web Service, 환경 변수, 헬스체크, 1GB disk 설정을 정의한다.
- `.node-version`: Node 22.22.0으로 빌드/실행 버전을 맞춘다.

## Render에서 직접 해야 할 일

### 1. GitHub에 최신 코드 올리기

1. 로컬 변경을 push한다.
2. GitHub 저장소 `junhyub3090/kr-geo-guess`에 `render.yaml`이 보이는지 확인한다.

### 2. Render 계정 준비

1. <https://render.com> 접속
2. `Sign In` 또는 `Get Started`
3. GitHub 계정으로 로그인
4. GitHub 권한 요청 화면에서 `junhyub3090/kr-geo-guess` 저장소 접근을 허용

### 3. Blueprint로 API 만들기

1. Render Dashboard로 이동
2. `New` 클릭
3. `Blueprint` 클릭
4. GitHub 저장소 목록에서 `junhyub3090/kr-geo-guess` 선택
5. Render가 `render.yaml`을 감지하는지 확인
6. Service 이름이 `kr-geo-guess-api`인지 확인
7. Plan은 persistent disk를 쓰기 위해 유료 Web Service plan이 필요하다.
8. `Apply` 또는 `Create Blueprint` 클릭

### 4. 디스크 설정 확인

Blueprint 적용 후 서비스 설정에서 아래가 있는지 확인한다.

- Disk name: `leaderboard-data`
- Mount path: `/var/data`
- Size: `1GB`

디스크가 없으면 리더보드 JSON 파일이 재배포나 재시작 때 사라질 수 있다.

### 5. 환경 변수 확인

Render 서비스의 `Environment` 또는 `Environment Variables`에서 아래 값이 있는지 확인한다.

```text
NODE_VERSION=22.22.0
WEB_ORIGIN=https://junhyub3090.github.io
LEADERBOARD_DATA_FILE=/var/data/leaderboard.json
FEEDBACK_DATA_FILE=/var/data/feedback.json
SEED_ISSUE_DATA_FILE=/var/data/seed-issues.json
SEED_ISSUE_ADMIN_TOKEN=<긴 랜덤 문자열>
```

### 6. 배포 로그 확인

Deploy 로그에서 아래 흐름을 확인한다.

```text
npm ci
npm run build:api
npm run start:api
KR Geo Guess API listening on port ...
```

Render가 제공하는 URL은 보통 아래 형태다.

```text
https://kr-geo-guess-api.onrender.com
```

실제 URL은 Render 서비스 화면 상단의 서비스 URL을 사용한다.

### 7. API 헬스체크 확인

브라우저에서 아래 주소를 연다.

```text
https://너의-render-api-url/health
```

정상 응답:

```json
{
  "ok": true,
  "service": "kr-geo-guess-realtime"
}
```

### 8. GitHub Pages 빌드 변수 설정

1. GitHub 저장소 `junhyub3090/kr-geo-guess`로 이동
2. `Settings` 클릭
3. 왼쪽 메뉴에서 `Secrets and variables` 클릭
4. `Actions` 클릭
5. `Variables` 탭 클릭
6. `New repository variable` 클릭
7. Name에 `VITE_API_BASE_URL` 입력
8. Value에 Render API URL 입력

예:

```text
https://kr-geo-guess-api.onrender.com
```

9. `Add variable` 클릭

### 9. Kakao Developers 도메인 추가

1. Kakao Developers 콘솔 접속
2. 앱 `kr-geo-guess` 선택
3. `제품 설정` > `카카오맵` 또는 JavaScript 키 설정 화면 이동
4. JavaScript SDK 도메인에 아래 도메인 추가

```text
https://junhyub3090.github.io
```

5. 저장

### 10. GitHub Pages 다시 배포

1. GitHub 저장소에서 `Actions` 클릭
2. `Deploy Web` workflow 클릭
3. `Run workflow` 클릭
4. branch는 `main` 선택
5. 실행
6. 성공 후 Pages URL 접속

### 11. 최종 테스트

1. Pages URL 접속
2. 홈에서 `친구방`의 `방 만들기` 버튼이 활성화되어 있는지 확인
3. 싱글플레이 1판 완료
4. 홈으로 돌아와 싱글 랭킹에 점수가 보이는지 확인
5. 친구에게 URL 공유
6. 친구방 생성 후 링크 복사
7. 친구가 같은 방에 들어오는지 확인
8. 라운드 종료 후 정답핀, 내 핀, 친구 핀, 라운드 순위가 보이는지 확인

## 실패할 때 확인할 것

### 친구방 버튼이 비활성화됨

- GitHub Actions 변수 `VITE_API_BASE_URL`이 비어 있거나 잘못된 URL이다.
- Pages를 변수 설정 이후 다시 배포하지 않았다.

### API는 열리는데 Pages에서 요청 실패

- Render 환경 변수 `WEB_ORIGIN`이 `https://junhyub3090.github.io`인지 확인한다.
- 브라우저 개발자도구 Console에서 CORS 오류가 있는지 확인한다.

### 리더보드가 재배포 후 사라짐

- Render 서비스에 persistent disk가 붙어 있는지 확인한다.
- `LEADERBOARD_DATA_FILE`이 `/var/data/leaderboard.json`인지 확인한다.

### 로드뷰 실패 좌표가 재시작 후 다시 나옴

- Render 서비스에 persistent disk가 붙어 있는지 확인한다.
- `SEED_ISSUE_DATA_FILE`을 설정하지 않았다면 `LEADERBOARD_DATA_FILE`이 persistent disk 경로인지 확인한다.
- 명시 설정을 쓰면 `SEED_ISSUE_DATA_FILE=/var/data/seed-issues.json`인지 확인한다.
- `?admin=seed-issues` 운영 목록을 쓰려면 `SEED_ISSUE_ADMIN_TOKEN`이 설정되어 있는지 확인한다.

### 로드뷰가 안 뜸

- Kakao Developers JavaScript SDK 도메인에 `https://junhyub3090.github.io`가 등록되어 있는지 확인한다.
- GitHub Actions secret 또는 variable `VITE_KAKAO_MAP_JS_KEY`가 유지되어 있는지 확인한다.
