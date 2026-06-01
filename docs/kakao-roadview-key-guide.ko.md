# Kakao Roadview 키 발급 및 로컬 설정 가이드

이 프로젝트는 로드뷰 이미지를 저장, 프록시, 다운로드하지 않고 Kakao Maps JavaScript SDK의 Roadview 뷰어로만 표시한다. 필요한 키는 `JavaScript Key`이며, `REST API 키`, `Admin 키`를 브라우저에 넣으면 안 된다.

## 공식 근거

- Kakao 지도 Web API 가이드는 JavaScript API 사용 전 키 발급이 필요하고, 카카오 계정, 개발자 등록, 앱 생성, JavaScript Key 선택, JavaScript SDK 도메인 등록이 필요하다고 안내한다.
- 같은 가이드는 등록된 사이트 도메인에서만 지도 API를 사용할 수 있으므로 도메인을 반드시 등록해야 한다고 안내한다.
- Kakao 지도 문서에는 `Roadview`, `RoadviewClient`, `getNearestPanoId(position, radius, callback)`가 제공되어 특정 좌표 근처의 파노라마 ID를 얻고 SDK Roadview에 표시할 수 있다고 명시되어 있다.

참고:

- https://apis.map.kakao.com/web/guide/
- https://apis.map.kakao.com/web/documentation/
- https://developers.kakao.com/docs/latest/ko/kakaomap/common

## 발급 순서

1. https://developers.kakao.com 에 카카오 계정으로 로그인한다.
2. 상단의 `내 애플리케이션`으로 들어간다.
3. `애플리케이션 추가하기`를 눌러 앱을 만든다.
4. 생성한 앱에서 `앱 설정` > `플랫폼`으로 이동한다.
5. `Web 플랫폼 등록`을 선택하고 사이트 도메인을 등록한다.
6. 로컬 개발용으로 아래 두 개를 모두 등록하는 것을 권장한다.

```text
http://127.0.0.1:5173
http://localhost:5173
```

7. 실제 배포 후에는 운영 도메인도 추가한다.

```text
https://your-production-domain.com
```

8. `앱 설정` > `앱 키` 또는 `플랫폼 키`에서 `JavaScript 키`를 복사한다.
9. 프로젝트 루트에 `.env`를 만들고 아래처럼 넣는다.

```bash
VITE_KAKAO_MAP_JS_KEY=복사한_JavaScript_키
VITE_API_BASE_URL=http://127.0.0.1:2567
VITE_REALTIME_URL=ws://localhost:2567
REALTIME_PORT=2567
ALLOWED_ORIGIN=http://127.0.0.1:5173
```

10. 개발 서버를 다시 시작한다.

```bash
npm run dev
```

## 확인 방법

- 브라우저는 `http://127.0.0.1:5173/`로 접속한다.
- Kakao Developers에 `http://localhost:5173`만 등록하고 브라우저를 `127.0.0.1`로 열면 SDK가 막힐 수 있다. 접속 주소와 등록 도메인을 맞춰야 한다.
- 키가 없거나 도메인이 맞지 않으면 앱은 로드뷰 이미지를 대체 표시하지 않고, 안전 안내 패널만 표시한다.

## 운영 시 주의

- 로드뷰 타일, 이미지, 파노라마 데이터를 서버에 저장하지 않는다.
- 브라우저 요청을 서버가 대신 프록시하지 않는다.
- 위치 시드에는 좌표, 지역 힌트, 난이도 같은 게임 데이터만 저장한다.
- 대량 트래픽 전에는 Kakao Developers의 쿼터, 이용약관, 상업 이용 조건을 다시 확인한다.
