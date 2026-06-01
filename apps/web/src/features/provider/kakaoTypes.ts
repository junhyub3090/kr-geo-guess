import type { LatLng } from "@kr-geo-guess/shared";

export type KakaoRoadviewStatus =
  | "missing_key"
  | "loading"
  | "ready"
  | "no_pano"
  | "provider_error";

export type KakaoMapsNamespace = {
  load: (callback: () => void) => void;
  event: {
    addListener: (
      target: unknown,
      type: string,
      handler: () => void,
    ) => void;
  };
  LatLng: new (lat: number, lng: number) => LatLng;
  Roadview: new (
    container: HTMLElement,
    options?: {
      panoId?: number;
      panoX?: number;
      panoY?: number;
      disableZoomControl?: boolean;
    },
  ) => {
    setPanoId: (panoId: number, position: LatLng) => void;
    getViewpointWithPanoId: () => {
      pan: number;
      tilt: number;
      zoom: number;
      panoId: number;
    };
    getPosition: () => LatLng;
  };
  RoadviewClient: new () => {
    getNearestPanoId: (
      position: LatLng,
      radius: number,
      callback: (panoId: number | null) => void,
    ) => void;
  };
};

declare global {
  interface Window {
    kakao?: {
      maps: KakaoMapsNamespace;
    };
  }
}
