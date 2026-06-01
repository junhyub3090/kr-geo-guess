# 시드 풀 파이프라인

목표는 서울과 각 시/도별로 승인된 출제 위치를 약 1000곳씩 확보하고, 그 안에서 `하(easy)`, `중(medium)`, `상(hard)` 난이도를 균형 있게 유지하는 것이다.

중요한 원칙:

- 자동 후보는 바로 게임에 넣지 않는다.
- 로드뷰 이미지는 저장하지 않는다.
- 공식 Kakao Roadview SDK로 근처 파노라마 존재 여부만 확인한다.
- 관공서 정문, 역 광장, 유명 관광지 정면, 간판 하나로 바로 맞힐 수 있는 지점은 제외한다.
- OSM 후보를 쓰면 앱과 문서에 OpenStreetMap 출처와 라이선스 표기를 유지한다.

## 상태

- `candidate`: 자동 수집된 원시 후보
- `roadview_verified`: 공식 SDK 흐름으로 주변 로드뷰 존재가 확인된 후보
- `approved`: 사람이 검수해 출제 가능하다고 승인한 후보
- `rejected`: 너무 쉽거나 로드뷰가 부적절해 제외한 후보

런타임 게임은 `packages/shared/src/seeds.ts`에 들어간 승인 좌표만 사용한다. `data/seed-pipeline/candidates` 아래의 JSONL 파일은 검수 대기/작업용 데이터이며, 존재한다고 해서 자동 출제되지 않는다.

## 목표 수량

`region-targets.ko.json`은 17개 시/도 각각에 `targetApproved: 1000`을 둔다. 난이도별 목표는 기본적으로 `하 334 / 중 333 / 상 333`이다. 게임 시작 시 선택하는 `상/중/하`는 이 풀에서 난이도 비율을 다르게 뽑는 설정이고, 풀 자체는 가능한 한 균형 있게 유지한다.

## 후보 생성

예시:

```bash
npm run seed:candidates -- --region seoul --difficulty easy --limit 50 --out data/seed-pipeline/candidates/seoul-easy.jsonl
```

안전 확인용:

```bash
npm run seed:candidates -- --region seoul --difficulty easy --limit 5 --dry-run
```

대량 수집은 Overpass API에 부담을 줄 수 있으므로 한 번에 한 지역/난이도씩 작게 실행한다. 실제 운영용 대량 수집은 Geofabrik의 한국 OSM extract를 내려받아 로컬에서 처리하는 쪽이 더 안정적이다.

## 로드뷰 존재 검증

Kakao JavaScript 키가 등록된 로컬 도메인에서 브라우저를 열고, 공식 SDK의 `RoadviewClient.getNearestPanoId`로 좌표 주변 로드뷰 존재 여부만 확인한다. 파노라마 ID와 이미지는 저장하지 않는다.

```bash
npm run seed:roadview -- --in data/seed-pipeline/candidates/seoul-easy.jsonl --out data/seed-pipeline/candidates/seoul-easy.roadview.jsonl
```

검증 결과가 `roadview_verified`여도 바로 출제하지 않는다. 사람이 실제 화면을 보고 너무 쉬운 간판/관공서/역/관광지 정면을 제외한 뒤 `approved`로 승격해야 한다.

## 감사

현재 런타임 풀과 목표 차이는 아래 명령으로 본다.

```bash
npm run seed:audit
```

이 명령은 실제 게임에 들어간 좌표와 `data/seed-pipeline/candidates` 안의 후보 상태를 분리해서 보여준다.
