# 지도 경계 데이터

`skorea_municipalities_geo_simple.json`은 `southkorea/southkorea-maps`의 KOSTAT 2013 시군구 단순화 GeoJSON을 사용한다.

- 원본: https://github.com/southkorea/southkorea-maps
- 파일: `kostat/2013/json/skorea_municipalities_geo_simple.json`
- 용도: 앱 내부 SVG 지도 렌더링과 클릭 가능 행정구역 판정

서울맵 한강 수면 오버레이는 OpenStreetMap 한강 `natural=water`, `water=river` multipolygon의 outer ring을 단순화해 앱 코드에 포함한다.

- 원본: https://www.openstreetmap.org/
- 조회: Overpass API
- 라이선스: OpenStreetMap data, ODbL

로드뷰 이미지나 파노라마 ID와 무관한 행정구역 경계 데이터다.
