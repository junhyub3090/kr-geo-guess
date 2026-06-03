import type { LatLng } from "@kr-geo-guess/shared";
import { WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "./kakaoLoader";
import type { KakaoRoadviewStatus } from "./kakaoTypes";

type KakaoRoadviewPanelProps = {
  target: LatLng;
  onStatusChange?: (status: KakaoRoadviewStatus) => void;
};

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY as
  | string
  | undefined;

export function KakaoRoadviewPanel({
  target,
  onStatusChange,
}: KakaoRoadviewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetKey = `${target.lat}:${target.lng}`;
  const [statusState, setStatusState] = useState<{
    targetKey: string;
    status: KakaoRoadviewStatus;
  }>({
    targetKey,
    status: KAKAO_JS_KEY ? "loading" : "missing_key",
  });
  const status =
    statusState.targetKey === targetKey ? statusState.status : "loading";

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status, targetKey]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !KAKAO_JS_KEY) {
      setStatusState({ targetKey, status: "missing_key" });
      return;
    }

    let cancelled = false;
    setStatusState({ targetKey, status: "loading" });

    loadKakaoMaps(KAKAO_JS_KEY)
      .then(() => {
        window.kakao?.maps.load(() => {
          if (cancelled || !container || !window.kakao?.maps) {
            return;
          }

          const maps = window.kakao.maps;
          const position = new maps.LatLng(target.lat, target.lng);
          const roadview = new maps.Roadview(container, {
            disableZoomControl: true,
          });
          const client = new maps.RoadviewClient();

          client.getNearestPanoId(position, 80, (panoId) => {
            if (cancelled) {
              return;
            }

            if (panoId === null) {
              setStatusState({ targetKey, status: "no_pano" });
              return;
            }

            roadview.setPanoId(panoId, position);
            setStatusState({ targetKey, status: "ready" });
          });
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStatusState({ targetKey, status: "provider_error" });
        }
      });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [target.lat, target.lng, targetKey]);

  return (
    <section className="roadview-shell" aria-label="로드뷰 영역">
      <div className="roadview-sdk-surface" ref={containerRef} />
      {status !== "ready" ? <RoadviewFallback status={status} /> : null}
    </section>
  );
}

function RoadviewFallback({ status }: { status: KakaoRoadviewStatus }) {
  const message = getRoadviewMessage(status);

  return (
    <div className="roadview-fallback">
      <div className="street-grid" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="fallback-copy">
        <WifiOff size={22} aria-hidden="true" />
        <p>{message.title}</p>
        <span>{message.description}</span>
      </div>
    </div>
  );
}

function getRoadviewMessage(status: KakaoRoadviewStatus) {
  switch (status) {
    case "loading":
      return {
        title: "로드뷰 연결 중",
        description: "잠시만 기다려 주세요.",
      };
    case "no_pano":
      return {
        title: "다른 위치 찾는 중",
        description: "잠시만 기다려 주세요.",
      };
    case "provider_error":
      return {
        title: "제공자 연결 실패",
        description: "API 키, 도메인, 쿼터 상태를 확인해야 합니다.",
      };
    case "missing_key":
    default:
      return {
        title: "로드뷰 키 대기",
        description: "환경 키를 설정하면 이 영역에 로드뷰가 표시됩니다.",
      };
  }
}
