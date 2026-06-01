# 한국 Geo Guess 조사 정리

작성일: 2026-05-31

이 문서는 한국 전용 GeoGuessr류 게임을 만들기 위해 필요한 제품, 기술, 데이터, 약관, 멀티플레이 요구사항을 정리한다. 법률 자문은 아니며, 지도/로드뷰 API 약관과 요금은 바뀔 수 있으므로 공개 출시 전 다시 확인해야 한다.

## 결론

우리가 직접 한국의 모든 도로 이미지를 촬영하거나 수집하는 방식은 현실적이지 않다. 현실적인 제품 형태는 공식 지도/로드뷰 SDK 위에 게임 레이어를 얹는 것이다.

가장 유력한 1차 제공자는 카카오 로드뷰다. Kakao Maps Web API에는 `kakao.maps.Roadview`, `kakao.maps.RoadviewClient`, `getNearestPanoId(position, radius, callback)`, `roadview.setPanoId(...)` 흐름이 공식 문서와 샘플로 제공되어 있다. 좌표 근처의 파노라마를 찾아 공식 뷰어에 띄우는 데 필요한 최소 기능이 있다.

네이버 지도 파노라마도 기술적으로 가능하다. `naver.maps.Panorama`와 `panorama` 서브모듈이 있고, DOM에 파노라마 뷰어를 넣을 수 있다. 다만 네이버 클라우드 Maps 서비스 약관은 결과 데이터를 무단 복제, 저장, 가공, 배포하거나 DB화해 재사용하는 것을 명확히 금지한다. 따라서 네이버를 쓰더라도 파노라마/좌표/커버리지 결과를 우리 DB에 축적하는 설계는 피해야 한다.

Google Street View는 API와 메타데이터 기능이 성숙하지만, 한국 전용 게임의 기본 데이터 소스로는 카카오/네이버보다 약하다. 비용, 국내 커버리지, Google Maps Platform 약관상 캐싱/저장 제한도 고려해야 한다.

Mapillary와 KartaView는 CC BY-SA 기반 이미지 활용 가능성이 있어 더 개방적이지만, 한국 커버리지가 카카오/네이버 로드뷰 수준일 가능성은 낮다. 보조 모드나 오픈데이터 모드 후보로 두고, 먼저 커버리지 감사를 해야 한다.

따라서 MVP 기본 방침은 다음과 같다.

- 이미지는 저장하지 않는다.
- 로드뷰는 공식 SDK 뷰어로만 렌더링한다.
- 게임 서버에는 방, 유저, 추측, 점수, 설정, 우리가 만든 시드 좌표만 저장한다.
- 제공자에서 반환한 파노라마 이미지, 타일, 좌표 결과, 커버리지 결과를 대량 수집하거나 DB화하지 않는다.
- 카카오 `panoId` 저장 가능 여부는 출시 전 확인한다. 확인 전에는 저장하지 않는다.
- 랭크전 수준의 치팅 방지는 MVP 범위에서 제외한다. 클라이언트 SDK를 쓰는 구조상 고의적인 개발자도구 분석을 완전히 막기 어렵다.

## 만들 게임의 핵심 경험

### 기본 루프

한 라운드는 다음 순서로 진행된다.

1. 서버가 숨겨진 목표 좌표를 선택한다.
2. 클라이언트가 해당 좌표 근처의 공식 로드뷰/파노라마를 연다.
3. 플레이어가 지도에 핀을 찍는다.
4. 서버가 정답 좌표와 추측 좌표의 거리를 계산한다.
5. 서버가 점수를 계산한다.
6. 정답 공개 화면에서 실제 위치, 각 플레이어의 추측, 거리, 점수를 보여준다.
7. 모든 라운드가 끝나면 최종 결과를 보여준다.

한국 전용 게임에서는 지도 범위를 나누는 것이 중요하다.

- 전국 한국
- 시/도 단위
- 시/군/구 단위
- 서울 골목, 제주, 해안도로, 대학가, 산업단지, 전통시장, 지하철역 주변 같은 큐레이션 맵

전국 모드와 서울 구 단위 모드는 점수 곡선이 달라야 한다. 같은 5km 오차라도 체감 난이도가 다르다.

### 출시 시점에 필요한 모드

MVP에 넣을 모드:

- 솔로 클래식: 5라운드, 제한 시간 옵션, 결과 공유
- 친구방 클래식: 2-20명이 같은 라운드를 동시에 플레이
- 데일리 챌린지: 매일 같은 시드로 점수 경쟁

MVP 이후에 넣을 모드:

- 듀얼: 1v1 체력전
- 팀전: 팀 단위 평균/최고 추측으로 승부
- 지역 스트릭: 시/도 또는 시/군/구를 연속으로 맞히는 모드
- 배틀로얄 거리전: 매 라운드 가장 못 맞힌 플레이어 탈락
- No Move / No Pan / No Zoom: 공식 뷰어 제어 가능성이 확인된 뒤에만

GeoGuessr 공식 도움말 기준 듀얼은 1v1, 라운드당 한 번 추측, 각 플레이어 6,000 체력, 5라운드부터 데미지 배율이 올라가는 구조다. 이 규칙을 그대로 복제할 필요는 없지만, 플레이어가 기대하는 경쟁 구조를 이해하는 기준으로 삼을 수 있다.

## 멀티플레이 요구사항

멀티플레이는 실시간 UI보다 서버 권위 상태 머신이 핵심이다.

서버가 반드시 소유해야 하는 상태:

- 방 생성, 방 코드, 초대 링크
- 호스트 권한
- 플레이어 목록, 준비 상태, 연결/재연결 상태
- 현재 라운드, 라운드 시작/종료 시각
- 각 플레이어의 추측 제출 여부
- 점수와 정답 공개 데이터
- 최종 결과

방 상태는 다음처럼 나눈다.

- `lobby`
- `countdown`
- `round_active`
- `round_locking`
- `round_reveal`
- `between_rounds`
- `finished`

멀티플레이 UX에서 중요한 것:

- 링크 하나로 바로 입장
- 계정 없이 닉네임만으로 시작 가능
- 방 코드는 호스트에게 항상 보이게
- 중간 입장자는 기본적으로 관전자로 처리
- 새로고침/네트워크 끊김 후 일정 시간 내 재접속 가능
- 제출한 사람은 본인 핀을 보며 다른 사람을 기다릴 수 있게
- 모두 제출하면 타이머를 줄여 빠르게 공개
- 듀얼에서는 한 명이 제출하면 상대에게 짧은 최종 카운트다운 제공

## UX 요구사항

### 데스크톱

- 로드뷰/파노라마가 화면 대부분을 차지한다.
- 추측 지도는 우하단 작은 패널에서 시작하고 클릭하면 커진다.
- 타이머, 라운드, 플레이어 상태, 점수는 작지만 항상 보여준다.
- 핀을 찍기 전에는 제출 버튼이 비활성화된다.
- 정답 공개 단계에서는 지도와 점수판이 중심이 된다.

### 모바일

- 기본 화면은 파노라마 전체 화면이다.
- 추측 지도는 하단 시트 또는 전체 화면 드로어로 연다.
- 엄지로 핀 찍기와 제출이 편해야 한다.
- 제출 버튼은 지도 드로어 안에서 항상 접근 가능해야 한다.
- 정답 공개 때는 파노라마보다 지도/점수판을 우선한다.

### 실패 상태

반드시 다뤄야 하는 실패 상태:

- 로드뷰 없음
- 제공자 SDK 로드 실패
- API 키/도메인 설정 오류
- 쿼터 초과
- 느린 네트워크
- 방 서버와 연결 끊김
- 호스트 이탈
- 플레이어 새로고침

## 데이터 제공자 검토

### 1. 카카오 로드뷰

판단: MVP 1순위.

공식 문서에서 확인한 기능:

- `kakao.maps.Roadview(container[, options])`
- `kakao.maps.RoadviewClient()`
- `getNearestPanoId(position, radius, callback)`
- `roadview.setPanoId(panoId, position)`
- `init`, `panoid_changed`, `viewpoint_changed` 이벤트
- JavaScript SDK 앱 키와 플랫폼 등록 필요
- 카카오 쿼터 문서에 Map SDK JavaScript 일일 무료 쿼터와 유료 사용 단가 안내

가능한 구현 방식:

1. 서버가 우리 시드 DB에서 좌표를 고른다.
2. 클라이언트가 해당 좌표를 받아 카카오 `getNearestPanoId`를 호출한다.
3. 근처 파노라마가 있으면 카카오 공식 Roadview 뷰어에 띄운다.
4. 없으면 라운드 시작 전에 서버가 다른 시드를 고른다.
5. 정답 공개 전까지 우리 앱 상태에는 정답 좌표를 노출하지 않는다.

주의점:

- 일부 카카오 SDK 문서에는 로드뷰 사용에 별도 협의가 필요하다는 표현이 있다. 웹 로드뷰 공개 게임 사용 가능 여부를 확인해야 한다.
- `panoId` 저장 가능 여부가 명확하지 않으므로 확인 전에는 저장하지 않는다.
- No Move / No Pan / No Zoom 구현 가능성이 공식 뷰어에서 제한될 수 있다.
- 클라이언트 SDK 객체나 이벤트를 통해 위치 단서가 새어 나갈 수 있다.

### 2. 네이버 지도 파노라마

판단: 기술적으로 가능하지만 약관상 더 보수적으로 접근해야 한다.

공식 문서에서 확인한 기능:

- `naver.maps.Panorama`
- `panorama` 서브모듈 필요
- `position`, `panoId`, `pov` 기반 초기화
- `init`, `pano_status`, `pano_changed`, `pov_changed` 이벤트
- NAVER 로고/컨트롤 옵션

핵심 약관 리스크:

네이버 클라우드 Maps 서비스 약관은 결과 데이터를 약관 범위를 넘어 복제, 저장, 가공, 배포하거나 제3자에게 제공해서는 안 된다고 명시한다. 또한 결과 데이터를 별도로 저장하거나 DB화해 재사용하는 것도 금지한다. 예시로 API 결과 좌표 데이터를 모아 이후 API 호출 없이 재사용하는 행위를 엄격히 금지한다고 설명한다.

따라서 네이버를 쓰는 경우:

- 공식 뷰어로 즉시 렌더링하는 용도에 한정한다.
- 네이버에서 반환한 파노라마 ID, 좌표, 커버리지 결과를 DB화하지 않는다.
- 출시 전 별도 약관 검토가 필요하다.

### 3. Google Street View

판단: 보조 또는 해외 확장 후보.

공식 문서에서 확인한 기능:

- `StreetViewPanorama`
- `StreetViewService`
- Street View Static API Metadata
- 메타데이터로 파노라마 존재 여부, 좌표, pano ID, 날짜, 저작권 정보 확인 가능
- 메타데이터 요청은 문서상 과금/쿼터를 소모하지 않음
- 서비스별 약관에서 `pano_ID` 같은 일부 Google ID 캐싱 허용 범위가 언급됨

주의점:

- 한국 전용 커버리지는 카카오/네이버 대비 약할 수 있다.
- Google 지도 콘텐츠 캐싱, 저장, 재호스팅, 비Google 지도와의 결합에는 제한이 많다.
- Dynamic Street View 비용이 부담될 수 있다.

### 4. Mapillary

판단: 오픈데이터 모드 후보.

장점:

- API, Python SDK, MapillaryJS 제공
- 얼굴/번호판 블러 처리
- 이미지가 CC BY-SA로 공유된다고 안내
- 직접 배포/수정 가능성이 카카오/네이버보다 크다

단점:

- 한국 커버리지가 균일하지 않을 가능성이 높다.
- 로드뷰처럼 연속 이동하는 경험이 약할 수 있다.
- CC BY-SA 표기와 공유 조건을 지켜야 한다.

### 5. KartaView

판단: 후순위 후보.

KartaView는 거리 사진과 3D 공간 데이터를 CC BY-SA 4.0으로 제공한다고 안내한다. 다만 한국 커버리지, API 안정성, 생태계는 별도 검증이 필요하다.

## 시드 좌표 전략

가장 중요한 원칙은 "플레이 가능한 위치 목록"을 제공자 API 결과로 대량 생성하지 않는 것이다.

안전한 시드 출처:

- 직접 수동 큐레이션한 좌표
- OpenStreetMap 도로 데이터에서 생성한 후보 좌표
- 라이선스가 허용되는 공공데이터
- 유저가 제출하고 운영자가 승인한 좌표

위험한 방식:

- 카카오/네이버 지도 페이지 스크래핑
- 로드뷰 이미지/타일 다운로드
- 제공자 API를 대량 호출해 영구 커버리지 DB 생성
- 제공자가 반환한 파노라마 좌표/ID를 허가 없이 저장

MVP 전략:

1. 수동 또는 OSM 기반으로 후보 좌표를 만든다.
2. DB에는 우리의 좌표, 지역, 태그, 난이도, 출처만 저장한다.
3. 라운드 시작 시점에 공식 SDK로 근처 파노라마 존재 여부를 확인한다.
4. 없으면 다른 시드를 고른다.
5. 실패 통계는 짧게 보관하고, 영구 저장은 약관 확인 후 결정한다.

## 점수 계산

정답 좌표와 추측 좌표의 거리는 서버에서 미터 단위로 계산한다. PostgreSQL + PostGIS를 쓰면 `ST_DistanceSphere` 또는 geography 타입 기반 거리 계산을 사용할 수 있다.

권장 점수식:

```text
if distance <= perfectRadiusMeters:
  score = 5000
else:
  score = round(5000 * exp(-(distance - perfectRadiusMeters) / decayMeters))
```

초기값:

- 전국 모드: `perfectRadiusMeters = 25`, `decayMeters = 140000`
- 시/도 모드: `perfectRadiusMeters = 20`, `decayMeters = 30000`
- 도시 고밀도 모드: `perfectRadiusMeters = 15`, `decayMeters = 8000`

이 방식은 단순하고, 설명 가능하고, 실제 플레이 데이터를 보고 튜닝하기 쉽다.

## 기술 구조

### 프론트엔드

- Vite React
- 공식 SDK 로더
- Provider Adapter
- 파노라마 화면
- 추측 지도
- 로비/방 화면
- 결과 화면
- 관리자 시드 편집 화면
- Playwright 기반 데스크톱/모바일 시각 테스트

### 실시간 서버

Colyseus를 추천한다. Colyseus의 Room 개념은 각각의 게임 세션을 독립된 방으로 다루고, 방 안의 공유 상태와 메시지를 동기화하는 구조라 이 게임과 잘 맞는다.

서버 책임:

- 방 상태 머신
- 타이머
- 추측 제출 검증
- 점수 계산
- 재접속
- 결과 저장

### DB

- PostgreSQL + PostGIS
- Drizzle ORM

핵심 테이블:

- `users`
- `guest_sessions`
- `rooms`
- `room_players`
- `matches`
- `rounds`
- `guesses`
- `seed_locations`
- `seed_sets`
- `daily_challenges`
- `provider_health_events`
- `moderation_events`

## 치팅과 경쟁전

정답 좌표를 우리 웹소켓/HTTP 응답에 정답 공개 전까지 보내지 않는 것은 가능하다. 하지만 카카오/네이버/구글 같은 클라이언트 SDK 자체가 내부적으로 파노라마 위치나 ID를 다룬다. 개발자도구를 적극적으로 쓰는 사용자를 완전히 막기는 어렵다.

따라서:

- MVP와 친구방은 신뢰 기반 캐주얼 게임으로 둔다.
- 데일리 챌린지는 캐주얼 리더보드로 둔다.
- 랭크전은 나중에 별도 검토한다.
- 비정상적으로 빠르고 정확한 추측, 반복적인 0m 추측 같은 패턴은 탐지한다.
- 서버는 점수와 타이머를 항상 권위적으로 계산한다.

## MVP 범위

넣는다:

- 카카오 로드뷰 POC
- 솔로 클래식
- 친구방 클래식
- 5라운드 게임
- 제한 시간
- 서버 점수 계산
- 수동/오픈데이터 기반 시드 카탈로그
- 런타임 파노라마 확인
- 정답 공개 지도와 점수판
- 재접속
- 기본 관리자 시드 편집기
- 제공자 오류/비용 관측

넣지 않는다:

- 랭크전
- 현금/상품 보상
- 공개 매치메이킹
- 로드뷰 이미지 스크린샷 공유
- 제공자 결과 기반 커버리지 DB
- 모든 이동 제한 모드
- 음성 채팅

## 주요 리스크

1. 카카오/네이버 로드뷰를 게임에 공개적으로 써도 되는지 확인 필요
2. `panoId`, 커버리지 결과, 제공자 좌표 저장 가능 여부 불확실
3. 공식 뷰어에서 No Move / No Pan / No Zoom 제어가 제한될 수 있음
4. 클라이언트 SDK 기반이라 랭크전 치팅 방지가 약함
5. 멀티플레이는 플레이어 수만큼 로드뷰 뷰어가 로드되어 비용 증가
6. Mapillary/KartaView는 한국 커버리지 부족 가능성
7. 모바일 지도/파노라마 UX가 나쁘면 유지율이 낮아짐

## 참고 자료

- Kakao Maps Web API Roadview docs: https://apis.map.kakao.com/web/documentation/
- Kakao Roadview sample: https://apis.map.kakao.com/web/sample/basicRoadview/
- Kakao quota docs: https://developers.kakao.com/docs/en/getting-started/quota
- Kakao developer site policy: https://developers.kakao.com/terms/en/site-policies
- Naver Maps Panorama docs: https://navermaps.github.io/maps.js.ncp/docs/naver.maps.Panorama.html
- Naver Maps submodule docs: https://navermaps.github.io/maps.js.en/docs/tutorial-4-Submodules.html
- Naver Cloud pricing: https://www.ncloud.com/charge/price/ko
- Naver Cloud Maps terms PDF: https://xv-ncloud.pstatic.net/images/provision/%5B%EB%AF%BC%EA%B0%84%5DMaps%EC%84%9C%EB%B9%84%EC%8A%A4%EC%9D%B4%EC%9A%A9%EC%95%BD%EA%B4%80_v0.4_%28CLEAN%29_1742433558704.pdf
- Google Street View JS docs: https://developers.google.com/maps/documentation/javascript/streetview
- Google Street View metadata docs: https://developers.google.com/maps/documentation/streetview/metadata
- Google Maps Platform service-specific terms: https://cloud.google.com/maps-platform/terms/maps-service-terms
- Mapillary intro/API overview: https://help.mapillary.com/hc/en-us/articles/115001770269-An-Introduction-to-Mapillary
- Mapillary CC BY-SA note: https://help.mapillary.com/hc/en-us/articles/115001770409-CC-BY-SA-license-for-open-data
- KartaView terms: https://kartaview.org/terms
- GeoGuessr Duels support article: https://geoguessr.zendesk.com/hc/en-us/articles/4411221768465-What-are-Duels
- Colyseus rooms docs: https://docs.colyseus.io/room
- PostGIS distance docs: https://postgis.net/docs/ST_DistanceSphere.html
- PostGIS radius docs: https://postgis.net/docs/ST_DWithin.html

