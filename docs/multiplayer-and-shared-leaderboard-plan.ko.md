# 멀티플레이 및 공유 싱글 리더보드 계획

## 목표

한국 Geo Guess 게임에서 싱글플레이 점수를 전체 리더보드에 공유하고, 친구방에서는 모든 플레이어가 같은 라운드를 제한시간 안에 플레이한 뒤 정답과 순위를 함께 확인한다.

## 현재 구현 범위

- 싱글플레이는 GitHub Pages에서도 정적으로 실행된다.
- `VITE_API_BASE_URL`이 설정되면 싱글 완료 점수를 Node API의 `/api/leaderboard`로 전송한다.
- Node API는 `LEADERBOARD_DATA_FILE`이 설정된 경우 공유 싱글 점수를 JSON 파일에 저장한다.
- 친구방은 Node API가 있을 때 활성화된다.
- 친구방 라운드는 모든 플레이어에게 같은 `currentRound`와 같은 로드뷰 좌표를 제공한다.
- 공개 전에는 플레이어 본인의 핀만 보이고, 공개 후에만 정답핀과 다른 플레이어 핀이 보인다.
- 공개 후에는 라운드 순위표에서 플레이어별 거리, 점수, 순위를 확인한다.
- 모든 라운드 종료 후에는 최종 순위, 라운드별 점수, 우승자 크라운과 가벼운 폭죽 연출을 보여준다.

## 배포 프로세스

1. GitHub Pages는 정적 웹 배포로 유지한다.
2. Node API 서버를 Render, Railway, Fly.io 같은 런타임에 배포한다.
3. 서버 환경 변수에 `WEB_ORIGIN=https://junhyub3090.github.io`를 설정한다.
4. 공유 리더보드를 파일로 유지하려면 `LEADERBOARD_DATA_FILE=/var/data/leaderboard.json`처럼 영속 디스크 경로를 설정한다.
5. GitHub Actions 변수 `VITE_API_BASE_URL`에 Node API 공개 URL을 등록한다.
6. API 서버에 영속 디스크가 없으면 파일 저장 리더보드는 재배포/재시작 시 사라질 수 있다. 장기 운영 단계에서는 Supabase나 Neon Postgres로 리더보드/방 결과 저장소를 교체한다.

## 다음 단계

- 친구방 상태를 메모리에서 Redis 또는 Postgres 기반으로 옮겨 서버 재시작과 수평 확장에 대응한다.
- 리더보드에 맵/난이도 필터를 서버 쿼리로 추가한다.
- 최종 결과 화면에서 라운드별 지도 리플레이를 제공할지 결정한다.
- 닉네임 중복, 악의적 점수 제출, 과도한 요청을 막기 위한 간단한 rate limit과 서명 검증을 추가한다.
