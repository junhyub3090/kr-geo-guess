import type { LatLng } from "@kr-geo-guess/shared";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { CSSProperties, PointerEvent, WheelEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import municipalitiesGeoJsonUrl from "../../../../../data/boundaries/skorea_municipalities_geo_simple.json?url";

type KoreaGuessMapProps = {
  guess: LatLng | null;
  guessColor?: string;
  target?: LatLng;
  resetKey?: string | number | null;
  regions?: readonly string[];
  peerGuesses?: Array<{
    id: string;
    label: string;
    point: LatLng;
    color?: string;
    rank?: number;
    distanceLabel?: string;
  }>;
  distanceLabel?: string;
  disabled?: boolean;
  showLabels?: boolean;
  compact?: boolean;
  onReady?: () => void;
  onGuess: (guess: LatLng) => void;
};

type GeoJsonFeature = {
  properties: {
    code: string;
    name: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: PolygonCoordinates | MultiPolygonCoordinates;
  };
};

type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];
type Position = [number, number];

type SvgPoint = {
  x: number;
  y: number;
};

type HoveredFeature = {
  name: string;
  point: SvgPoint;
};

type MapDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  moved: boolean;
};

type ViewBoxBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GeoBounds = {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
};

type Projection = {
  lngScale: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

type ProjectionContext = {
  geoBounds: GeoBounds;
  projection: Projection;
};

type MunicipalityFeature = {
  id: string;
  name: string;
  province: string;
  path: string;
  bounds: ViewBoxBounds;
  polygons: Position[][][];
};

type ProvinceBoundaryPath = {
  id: string;
  regions: string[];
  path: string;
};

type BoundaryMapData = ProjectionContext & {
  municipalityFeatures: MunicipalityFeature[];
  nationalProvinceBoundaryPaths: ProvinceBoundaryPath[];
};

type BoundaryMapState = {
  data: BoundaryMapData | null;
  error: Error | null;
};

const FULL_VIEW_BOX: ViewBoxBounds = {
  x: 0,
  y: 0,
  width: 524,
  height: 631,
};

const DOKDO_ISLANDS: Array<{
  id: "seodo" | "dongdo";
  testId: string;
  point: LatLng;
  radiusX: number;
  radiusY: number;
  rotation: number;
}> = [
  {
    id: "seodo",
    testId: "dokdo-seodo-islet",
    point: {
      lat: 37 + 14 / 60 + 30.6 / 3600,
      lng: 131 + 51 / 60 + 54.6 / 3600,
    },
    radiusX: 3.2,
    radiusY: 2.1,
    rotation: -18,
  },
  {
    id: "dongdo",
    testId: "dokdo-dongdo-islet",
    point: {
      lat: 37 + 14 / 60 + 26.8 / 3600,
      lng: 131 + 52 / 60 + 10.4 / 3600,
    },
    radiusX: 2.8,
    radiusY: 1.8,
    rotation: 14,
  },
];

const DOKDO_GEO_BOUNDS_PADDING = 0.05;
const DOKDO_SVG_BOUNDS_PADDING = 9;
const MAP_DRAG_THRESHOLD_PX = 6;
const MAP_MAX_ZOOM = 6;
const MAP_ZOOM_STEP = 1.35;
const MAP_WHEEL_ZOOM_STEP = 1.24;
const SEOUL_REGION_ID = "서울";

type RiverPoint = readonly [number, number];

// Simplified OpenStreetMap Han River multipolygon outer rings for the Seoul map.
const SEOUL_HAN_RIVER_SURFACES: readonly (readonly RiverPoint[])[] = [
  [
    [37.54147, 127.02517], [37.54076, 127.03231], [37.53425, 127.05471], [37.52992, 127.06396], [37.5281, 127.06977], [37.52654, 127.07861], [37.52689, 127.0877], [37.51969, 127.09161], [37.51846, 127.08128], [37.52055, 127.06591], [37.52908, 127.05222], [37.53252, 127.03792], [37.5343, 127.03397], [37.5348, 127.02828], [37.53381, 127.02497], [37.53169, 127.02193], [37.52863, 127.01928], [37.51846, 127.00742], [37.51729, 127.00489], [37.5155, 127.00419], [37.51343, 127.00074], [37.51221, 126.99694], [37.5074, 126.9912], [37.50623, 126.98256], [37.50715, 126.97122], [37.50933, 126.96546], [37.51311, 126.95948], [37.51827, 126.94566], [37.52083, 126.94357], [37.52844, 126.93453], [37.53148, 126.92961], [37.53393, 126.92266], [37.53598, 126.91187], [37.53523, 126.91027], [37.53478, 126.91235], [37.53431, 126.90952], [37.53487, 126.90815], [37.53702, 126.90615], [37.54846, 126.8886], [37.55155, 126.88337], [37.5548, 126.87552], [37.5614, 126.86686], [37.57626, 126.84124], [37.58122, 126.82916], [37.58764, 126.81788], [37.59146, 126.81255], [37.59866, 126.80562], [37.60539, 126.79785], [37.60717, 126.79306], [37.60731, 126.78856], [37.6096, 126.78609], [37.61917, 126.77102], [37.62244, 126.75823], [37.62873, 126.74459], [37.63587, 126.73463], [37.64823, 126.70681], [37.65139, 126.70271], [37.65478, 126.70195], [37.66503, 126.67859], [37.66772, 126.67514], [37.66849, 126.675], [37.67274, 126.66815], [37.67747, 126.66322], [37.68327, 126.65901], [37.68824, 126.65884], [37.69168, 126.66001], [37.69236, 126.6623], [37.69591, 126.66435], [37.69941, 126.66256], [37.70474, 126.66292], [37.70817, 126.66489], [37.72012, 126.66788], [37.72888, 126.67122], [37.73064, 126.67028], [37.73512, 126.6701], [37.73537, 126.66873], [37.73547, 126.66993], [37.74194, 126.66922], [37.75453, 126.6659], [37.76282, 126.66082], [37.76832, 126.65631], [37.77305, 126.6748], [37.77091, 126.67518], [37.76981, 126.67722], [37.77036, 126.67951], [37.76697, 126.68379], [37.76471, 126.6851], [37.75865, 126.68639], [37.75834, 126.68707], [37.75604, 126.68508], [37.74339, 126.68645], [37.73848, 126.6853], [37.73769, 126.68685], [37.73563, 126.68777], [37.72705, 126.68828], [37.72516, 126.68689], [37.72326, 126.6874], [37.72051, 126.68665], [37.71259, 126.68018], [37.70498, 126.67523], [37.69499, 126.67136], [37.69272, 126.67119], [37.68075, 126.67872], [37.67415, 126.68595], [37.67023, 126.69148], [37.66185, 126.71215], [37.65843, 126.71845], [37.65534, 126.72166], [37.65371, 126.72462], [37.65388, 126.72645], [37.65263, 126.72697], [37.65328, 126.728], [37.65921, 126.72998], [37.66043, 126.73137], [37.65664, 126.73671], [37.65974, 126.73098], [37.65718, 126.72983], [37.65506, 126.73041], [37.65541, 126.7294], [37.65321, 126.72855], [37.6523, 126.7274], [37.65248, 126.72633], [37.65348, 126.72613], [37.65314, 126.72551], [37.64768, 126.73258], [37.63231, 126.76149], [37.62874, 126.77126], [37.62724, 126.77834], [37.62183, 126.78889], [37.61465, 126.80039], [37.60602, 126.80951], [37.59946, 126.81505], [37.59664, 126.81911], [37.59227, 126.83028], [37.59128, 126.83118], [37.58538, 126.8436], [37.58411, 126.8445], [37.584, 126.84658], [37.58166, 126.85066], [37.57862, 126.85361], [37.5741, 126.86201], [37.57449, 126.86296], [37.57376, 126.8625], [37.57014, 126.86959], [37.56498, 126.87592], [37.56188, 126.88485], [37.56131, 126.88481], [37.55847, 126.8899], [37.54425, 126.90989], [37.54253, 126.9175], [37.54279, 126.92015], [37.54338, 126.91994], [37.54373, 126.92062], [37.5432, 126.92117], [37.54414, 126.92585], [37.54142, 126.93361], [37.54119, 126.93742], [37.54001, 126.93923], [37.53468, 126.94326], [37.53374, 126.94704], [37.52975, 126.95159], [37.52407, 126.95313], [37.52179, 126.95565], [37.52091, 126.95968], [37.51514, 126.97492], [37.51452, 126.98144], [37.51522, 126.98743], [37.51735, 126.99183], [37.51669, 126.99229], [37.51733, 126.99411], [37.51716, 126.99274], [37.51776, 126.99414], [37.51886, 126.9945], [37.52192, 127.00096], [37.52588, 127.00413], [37.53046, 127.01204], [37.53951, 127.01835], [37.54109, 127.02081], [37.54147, 127.02517],
  ],
  [
    [37.5716, 127.15575], [37.56962, 127.1524], [37.56797, 127.15111], [37.56794, 127.15017], [37.56879, 127.15149], [37.56772, 127.14695], [37.568, 127.13872], [37.56553, 127.13236], [37.56216, 127.12738], [37.55692, 127.12252], [37.5448, 127.11735], [37.53513, 127.10993], [37.53037, 127.10738], [37.52363, 127.09999], [37.51969, 127.09161], [37.52689, 127.0877], [37.54326, 127.10758], [37.54622, 127.10981], [37.54995, 127.11077], [37.56123, 127.1156], [37.56847, 127.12384], [37.57389, 127.13586], [37.57562, 127.14985], [37.58244, 127.16366], [37.58645, 127.17612], [37.59113, 127.18072], [37.59214, 127.18596], [37.59121, 127.19578], [37.58949, 127.20075], [37.58752, 127.204], [37.58125, 127.21052], [37.57987, 127.21103], [37.57776, 127.21402], [37.57681, 127.21683], [37.57578, 127.21758], [37.57586, 127.21872], [37.57358, 127.22019], [37.57284, 127.2231], [37.57173, 127.22431], [37.56759, 127.22585], [37.5664, 127.22805], [37.56145, 127.23127], [37.56067, 127.23246], [37.54941, 127.23762], [37.54671, 127.23998], [37.54427, 127.24405], [37.54334, 127.24905], [37.53431, 127.26325], [37.52918, 127.27558], [37.5283, 127.28021], [37.52486, 127.27764], [37.52777, 127.2748], [37.52801, 127.27226], [37.53083, 127.26536], [37.53284, 127.26273], [37.53867, 127.25147], [37.54518, 127.23329], [37.55016, 127.22697], [37.55353, 127.22392], [37.55473, 127.22351], [37.55512, 127.22403], [37.55553, 127.22324], [37.55631, 127.22365], [37.5567, 127.2223], [37.55556, 127.22211], [37.55622, 127.22125], [37.56156, 127.21809], [37.56347, 127.21513], [37.57555, 127.20637], [37.58045, 127.20108], [37.58355, 127.1959], [37.58434, 127.18908], [37.5839, 127.18268], [37.58252, 127.17922], [37.58202, 127.17989], [37.58235, 127.17836], [37.58157, 127.17655], [37.58079, 127.17712], [37.58014, 127.1734], [37.57919, 127.17275], [37.57918, 127.17014], [37.57977, 127.17051], [37.5716, 127.15575],
  ],
];

const PROVINCE_BY_CODE_PREFIX: Record<string, string> = {
  "11": "서울",
  "21": "부산",
  "22": "대구",
  "23": "인천",
  "24": "광주",
  "25": "대전",
  "26": "울산",
  "29": "세종",
  "31": "경기",
  "32": "강원",
  "33": "충북",
  "34": "충남",
  "35": "전북",
  "36": "전남",
  "37": "경북",
  "38": "경남",
  "39": "제주",
};

const REGION_LABELS: Array<{ id: string; label: string; point: LatLng }> = [
  { id: "서울", label: "서울", point: { lat: 37.5665, lng: 126.978 } },
  { id: "경기", label: "경기", point: { lat: 37.4138, lng: 127.5183 } },
  { id: "강원", label: "강원", point: { lat: 37.8228, lng: 128.1555 } },
  { id: "충북", label: "충북", point: { lat: 36.8, lng: 127.7 } },
  { id: "충남", label: "충남", point: { lat: 36.52, lng: 126.8 } },
  { id: "전북", label: "전북", point: { lat: 35.82, lng: 127.12 } },
  { id: "전남", label: "전남", point: { lat: 34.82, lng: 126.9 } },
  { id: "경북", label: "경북", point: { lat: 36.55, lng: 128.73 } },
  { id: "경남", label: "경남", point: { lat: 35.35, lng: 128.25 } },
  { id: "제주", label: "제주", point: { lat: 33.43, lng: 126.55 } },
  { id: "부산", label: "부산", point: { lat: 35.1796, lng: 129.0756 } },
  { id: "대구", label: "대구", point: { lat: 35.8714, lng: 128.6014 } },
  { id: "인천", label: "인천", point: { lat: 37.4563, lng: 126.7052 } },
  { id: "광주", label: "광주", point: { lat: 35.1595, lng: 126.8526 } },
  { id: "대전", label: "대전", point: { lat: 36.3504, lng: 127.3845 } },
  { id: "울산", label: "울산", point: { lat: 35.5384, lng: 129.3114 } },
  { id: "세종", label: "세종", point: { lat: 36.48, lng: 127.289 } },
];

const NATIONAL_ADMIN_REGIONS = new Set([
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
]);

let cachedBoundaryMapData: BoundaryMapData | null = null;
let pendingBoundaryMapData: Promise<BoundaryMapData> | null = null;

export function KoreaGuessMap(props: KoreaGuessMapProps) {
  const boundaryMapState = useBoundaryMapData();

  if (!boundaryMapState.data) {
    return (
      <KoreaMapPlaceholder
        compact={props.compact}
        disabled={props.disabled}
        message={
          boundaryMapState.error
            ? "지도를 불러오지 못했습니다"
            : "지도 로딩 중"
        }
      />
    );
  }

  return <LoadedKoreaGuessMap {...props} mapData={boundaryMapState.data} />;
}

function LoadedKoreaGuessMap({
  mapData,
  guess,
  guessColor,
  target,
  resetKey,
  regions = [],
  peerGuesses = [],
  distanceLabel,
  disabled = false,
  showLabels = true,
  compact = false,
  onReady,
  onGuess,
}: KoreaGuessMapProps & { mapData: BoundaryMapData }) {
  const [hoveredFeature, setHoveredFeature] = useState<HoveredFeature | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const dragStateRef = useRef<MapDragState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const seoulRiverClipId = `seoul-river-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const selectedRegions = useMemo(() => new Set(regions), [regions]);
  const visibleFeatures = useMemo(() => {
    if (selectedRegions.size === 0) {
      return mapData.municipalityFeatures;
    }

    return mapData.municipalityFeatures.filter((feature) =>
      selectedRegions.has(feature.province),
    );
  }, [mapData.municipalityFeatures, selectedRegions]);
  const isNationalMap = selectedRegions.size === 0;
  const showSeoulHanRiver =
    selectedRegions.size === 1 && selectedRegions.has(SEOUL_REGION_ID);
  const showDokdoLandmark = isNationalMap || selectedRegions.has("경북");
  const baseViewBox = useMemo(
    () => {
      if (isNationalMap) {
        return FULL_VIEW_BOX;
      }

      const visibleBounds = combineBounds(visibleFeatures);
      const bounds = showDokdoLandmark
        ? includeSvgPointsInBounds(
            visibleBounds,
            DOKDO_ISLANDS.map((island) => project(island.point, mapData)),
            DOKDO_SVG_BOUNDS_PADDING,
          )
        : visibleBounds;

      return padViewBox(bounds, 0.1);
    },
    [isNationalMap, mapData, showDokdoLandmark, visibleFeatures],
  );
  const [interactiveViewBox, setInteractiveViewBox] = useState<ViewBoxBounds>(baseViewBox);

  useEffect(() => {
    clearMapInteractionState();
    setInteractiveViewBox(baseViewBox);
  }, [baseViewBox.x, baseViewBox.y, baseViewBox.width, baseViewBox.height, resetKey]);

  const labels = showLabels
    ? REGION_LABELS.filter((label) =>
        isNationalMap
          ? NATIONAL_ADMIN_REGIONS.has(label.id)
          : selectedRegions.has(label.id),
      )
    : [];
  const overlayScale = getOverlayScale(interactiveViewBox);
  const zoomLevel = getMapZoomLevel(baseViewBox, interactiveViewBox);
  const isZoomed = zoomLevel > 1.01;
  const canZoomIn = zoomLevel < MAP_MAX_ZOOM - 0.01;
  const canZoomOut = zoomLevel > 1.01;
  const showMapControls = !compact && !disabled;

  function zoomMap(factor: number, anchor?: SvgPoint) {
    setInteractiveViewBox((currentViewBox) =>
      getZoomedViewBox(
        currentViewBox,
        baseViewBox,
        anchor ?? getViewBoxCenter(currentViewBox),
        factor,
      ),
    );
  }

  function resetMapView() {
    clearMapInteractionState();
    setInteractiveViewBox(baseViewBox);
  }

  function clearMapInteractionState() {
    const dragState = dragStateRef.current;
    const svg = svgRef.current;

    if (
      dragState &&
      svg?.hasPointerCapture(dragState.pointerId)
    ) {
      svg.releasePointerCapture(dragState.pointerId);
    }

    dragStateRef.current = null;
    setHoveredFeature(null);
    setIsPanning(false);
  }

  function placeGuessFromPointer(svg: SVGSVGElement, event: PointerEvent<SVGSVGElement>) {
    const svgPoint = getSvgPointFromPointer(svg, event);
    if (!svgPoint) {
      return;
    }

    const point = unproject(svgPoint, mapData);

    if (!isPointInFeatures(point, visibleFeatures)) {
      return;
    }

    onGuess(point);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (compact || disabled) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState.moved || compact || disabled) {
      return;
    }

    placeGuessFromPointer(event.currentTarget, event);
  }

  function handlePointerCancel(event: PointerEvent<SVGSVGElement>) {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsPanning(false);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const dragState = dragStateRef.current;
    if (dragState && dragState.pointerId === event.pointerId) {
      const distanceMoved = Math.hypot(
        event.clientX - dragState.startClientX,
        event.clientY - dragState.startClientY,
      );

      if (distanceMoved > MAP_DRAG_THRESHOLD_PX) {
        dragState.moved = true;
      }

      if (dragState.moved) {
        setHoveredFeature(null);

        if (isZoomed) {
          event.preventDefault();
          const previousSvgPoint = getSvgPointFromClient(
            event.currentTarget,
            dragState.lastClientX,
            dragState.lastClientY,
          );
          const nextSvgPoint = getSvgPointFromPointer(event.currentTarget, event);

          if (previousSvgPoint && nextSvgPoint) {
            const deltaX = nextSvgPoint.x - previousSvgPoint.x;
            const deltaY = nextSvgPoint.y - previousSvgPoint.y;

            setInteractiveViewBox((currentViewBox) =>
              clampViewBoxToBase(
                {
                  ...currentViewBox,
                  x: currentViewBox.x - deltaX,
                  y: currentViewBox.y - deltaY,
                },
                baseViewBox,
              ),
            );
            setIsPanning(true);
          }
        }

        dragState.lastClientX = event.clientX;
        dragState.lastClientY = event.clientY;
        return;
      }
    }

    if (compact || disabled) {
      setHoveredFeature(null);
      return;
    }

    const svgPoint = getSvgPointFromPointer(event.currentTarget, event);
    if (!svgPoint) {
      setHoveredFeature(null);
      return;
    }

    const point = unproject(svgPoint, mapData);
    const feature = findFeatureAtPoint(point, visibleFeatures);

    setHoveredFeature(feature ? { name: feature.name, point: svgPoint } : null);
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    if (compact || disabled) {
      return;
    }

    const anchor = getSvgPointFromPointer(event.currentTarget, event);
    if (!anchor) {
      return;
    }

    const nextViewBox = getZoomedViewBox(
      interactiveViewBox,
      baseViewBox,
      anchor,
      event.deltaY < 0 ? MAP_WHEEL_ZOOM_STEP : 1 / MAP_WHEEL_ZOOM_STEP,
    );
    if (areSameViewBoxes(nextViewBox, interactiveViewBox)) {
      return;
    }

    event.preventDefault();
    setInteractiveViewBox(nextViewBox);
  }

  const guessPoint = guess ? project(guess, mapData) : null;
  const targetPoint = target ? project(target, mapData) : null;
  const peerPoints = targetPoint
    ? peerGuesses.map((peerGuess) => ({
        ...peerGuess,
        point: project(peerGuess.point, mapData),
      }))
    : [];
  const midpoint =
    guessPoint && targetPoint
      ? {
          x: (guessPoint.x + targetPoint.x) / 2,
          y: (guessPoint.y + targetPoint.y) / 2,
        }
      : null;

  return (
    <div
      className={[
        "korea-map-shell",
        isZoomed ? "zoomed" : "",
        isPanning ? "panning" : "",
        disabled ? "disabled" : "",
        compact ? "compact" : "",
      ].filter(Boolean).join(" ")}
    >
      {showMapControls ? (
        <div className="map-zoom-controls" aria-label="지도 확대/축소 도구">
          <button
            aria-label="지도 확대"
            className="map-zoom-button"
            disabled={!canZoomIn}
            onClick={() => zoomMap(MAP_ZOOM_STEP)}
            title="지도 확대"
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
          <button
            aria-label="지도 축소"
            className="map-zoom-button"
            disabled={!canZoomOut}
            onClick={() => zoomMap(1 / MAP_ZOOM_STEP)}
            title="지도 축소"
            type="button"
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <button
            aria-label="지도 초기화"
            className="map-zoom-button"
            disabled={!canZoomOut}
            onClick={resetMapView}
            title="지도 초기화"
            type="button"
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
          <span className="map-zoom-readout" aria-live="polite">
            {`${zoomLevel.toFixed(1)}x`}
          </span>
        </div>
      ) : null}
      <svg
        className={[
          "korea-map",
          isNationalMap ? "national" : "",
          disabled ? "disabled" : "",
          compact ? "compact" : "",
        ].filter(Boolean).join(" ")}
        data-testid="guess-map"
        viewBox={formatViewBox(interactiveViewBox)}
        role="img"
        aria-label="한국 추측 지도"
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => setHoveredFeature(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        ref={svgRef}
      >
      <rect className="map-sea" width="524" height="631" rx="8" />
      <g className="province-layer">
        {visibleFeatures.map((feature) => (
          <path
            className="map-region"
            d={feature.path}
            data-province={feature.province}
            key={feature.id}
          >
            <title>{feature.name}</title>
          </path>
        ))}
      </g>
      {showSeoulHanRiver ? (
        <SeoulHanRiverLayer
          clipId={seoulRiverClipId}
          mapData={mapData}
          visibleFeatures={visibleFeatures}
        />
      ) : null}
      <g className="municipality-boundary-layer" aria-hidden="true">
        {visibleFeatures.map((feature) => (
          <path
            className="map-region-boundary"
            d={feature.path}
            key={`boundary-${feature.id}`}
          />
        ))}
      </g>
      {isNationalMap ? (
        <g className="province-boundary-layer" aria-hidden="true">
          {mapData.nationalProvinceBoundaryPaths.map((boundary) => (
            <path
              className="province-boundary"
              d={boundary.path}
              data-boundary-regions={boundary.regions.join(" ")}
              key={boundary.id}
            />
          ))}
        </g>
      ) : null}
      {labels.map((label) => (
        <MapLabel
          key={label.id}
          point={label.point}
          label={label.label}
          mapData={mapData}
          scale={overlayScale}
        />
      ))}
      {showDokdoLandmark ? (
        <DokdoLandmark mapData={mapData} scale={overlayScale} />
      ) : null}
      {guessPoint && targetPoint ? (
        <g className="answer-link">
          <line
            className="answer-line-halo"
            x1={guessPoint.x}
            y1={guessPoint.y}
            x2={targetPoint.x}
            y2={targetPoint.y}
          />
          <line
            className="answer-line-core"
            x1={guessPoint.x}
            y1={guessPoint.y}
            x2={targetPoint.x}
            y2={targetPoint.y}
          />
          {midpoint && distanceLabel ? (
            <g transform={`translate(${midpoint.x} ${midpoint.y}) scale(${overlayScale})`}>
              <rect
                className="answer-distance-pill"
                x="-44"
                y="-43"
                width="88"
                height="26"
                rx="13"
              />
              <text className="answer-distance-label" y="-29">
                {distanceLabel}
              </text>
            </g>
          ) : null}
        </g>
      ) : null}
      {targetPoint ? (
        <g className="target-marker" transform={`translate(${targetPoint.x} ${targetPoint.y}) scale(${overlayScale})`}>
          <circle r="7" />
          <circle r="2.4" />
        </g>
      ) : null}
      {guessPoint ? (
        <g
          className="guess-marker"
          style={{ "--player-color": guessColor } as CSSProperties}
          transform={`translate(${guessPoint.x} ${guessPoint.y}) scale(${overlayScale})`}
        >
          <circle className="guess-marker-halo" r="8" />
          <circle className="guess-marker-core" r="4.2" />
        </g>
      ) : null}
      {peerPoints.map((peerGuess) => (
        <g
          className="peer-guess-marker"
          key={peerGuess.id}
          style={{ "--player-color": peerGuess.color } as CSSProperties}
          transform={`translate(${peerGuess.point.x} ${peerGuess.point.y}) scale(${overlayScale})`}
        >
          <title>
            {peerGuess.distanceLabel
              ? `${peerGuess.label} · ${peerGuess.distanceLabel}`
              : peerGuess.label}
          </title>
          <circle r="6" />
          {typeof peerGuess.rank === "number" ? (
            <text className="peer-rank-badge" y="2.4">
              {peerGuess.rank}
            </text>
          ) : null}
        </g>
      ))}
      {hoveredFeature ? (
        <MapHoverTooltip
          feature={hoveredFeature}
          scale={overlayScale}
        />
      ) : null}
      </svg>
    </div>
  );
}

function KoreaMapPlaceholder({
  compact,
  disabled,
  message,
}: {
  compact?: boolean;
  disabled?: boolean;
  message: string;
}) {
  return (
    <svg
      className={[
        "korea-map",
        disabled ? "disabled" : "",
        compact ? "compact" : "",
      ].filter(Boolean).join(" ")}
      data-testid="guess-map"
      viewBox={formatViewBox(FULL_VIEW_BOX)}
      role="img"
      aria-label="한국 추측 지도"
    >
      <rect className="map-sea" width="524" height="631" rx="8" />
      <text className="map-loading-label" x="262" y="315">
        {message}
      </text>
    </svg>
  );
}

function useBoundaryMapData(): BoundaryMapState {
  const [state, setState] = useState<BoundaryMapState>(() => ({
    data: cachedBoundaryMapData,
    error: null,
  }));

  useEffect(() => {
    if (cachedBoundaryMapData) {
      setState({ data: cachedBoundaryMapData, error: null });
      return;
    }

    let isMounted = true;

    loadBoundaryMapData()
      .then((data) => {
        if (isMounted) {
          setState({ data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error("Map load failed"),
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}

function loadBoundaryMapData() {
  if (cachedBoundaryMapData) {
    return Promise.resolve(cachedBoundaryMapData);
  }

  pendingBoundaryMapData ??= fetch(municipalitiesGeoJsonUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Boundary map request failed: ${response.status}`);
      }

      return response.json() as Promise<{ features: GeoJsonFeature[] }>;
    })
    .then((geoJson) => {
      const data = buildBoundaryMapData(geoJson.features);
      cachedBoundaryMapData = data;
      return data;
    })
    .catch((error: unknown) => {
      pendingBoundaryMapData = null;
      throw error;
    });

  return pendingBoundaryMapData;
}

function buildBoundaryMapData(features: GeoJsonFeature[]): BoundaryMapData {
  const geoBounds = getGeoBounds(features);
  const projection = createProjection(geoBounds);
  const context = { geoBounds, projection };
  const municipalityFeatures = features.map((feature) =>
    toMunicipalityFeature(feature, context),
  );

  return {
    ...context,
    municipalityFeatures,
    nationalProvinceBoundaryPaths: createProvinceBoundaryPaths(
      municipalityFeatures,
      context,
    ),
  };
}

function getSvgPointFromPointer(
  svg: SVGSVGElement,
  event: PointerEvent<SVGSVGElement> | WheelEvent<SVGSVGElement>,
): SvgPoint | null {
  return getSvgPointFromClient(svg, event.clientX, event.clientY);
}

function getSvgPointFromClient(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): SvgPoint | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) {
    return null;
  }

  const point = new DOMPoint(clientX, clientY).matrixTransform(
    matrix.inverse(),
  );

  return {
    x: point.x,
    y: point.y,
  };
}

function toMunicipalityFeature(
  feature: GeoJsonFeature,
  context: ProjectionContext,
): MunicipalityFeature {
  const polygons = normalizePolygons(feature.geometry);
  const province = PROVINCE_BY_CODE_PREFIX[feature.properties.code.slice(0, 2)] ?? "";
  const path = polygons.map((polygon) => polygonToPath(polygon, context)).join(" ");

  return {
    id: feature.properties.code,
    name: feature.properties.name,
    province,
    path,
    bounds: getProjectedBounds(polygons, context),
    polygons,
  };
}

function normalizePolygons(geometry: GeoJsonFeature["geometry"]): Position[][][] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates as PolygonCoordinates];
  }

  return geometry.coordinates as MultiPolygonCoordinates;
}

function polygonToPath(polygon: Position[][], context: ProjectionContext) {
  return polygon
    .map((ring) => {
      const [first, ...rest] = ring;
      if (!first) {
        return "";
      }

      const firstPoint = projectPosition(first, context);
      const commands = rest
        .map((position) => {
          const point = projectPosition(position, context);
          return `L ${roundSvg(point.x)} ${roundSvg(point.y)}`;
        })
        .join(" ");

      return `M ${roundSvg(firstPoint.x)} ${roundSvg(firstPoint.y)} ${commands} Z`;
    })
    .join(" ");
}

function MapLabel({
  point,
  label,
  mapData,
  scale,
}: {
  point: LatLng;
  label: string;
  mapData: BoundaryMapData;
  scale: number;
}) {
  const { x, y } = project(point, mapData);

  return (
    <text className="map-label" transform={`translate(${x} ${y}) scale(${scale})`}>
      {label}
    </text>
  );
}

function SeoulHanRiverLayer({
  clipId,
  mapData,
  visibleFeatures,
}: {
  clipId: string;
  mapData: BoundaryMapData;
  visibleFeatures: readonly MunicipalityFeature[];
}) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          {visibleFeatures.map((feature) => (
            <path d={feature.path} key={`river-clip-${feature.id}`} />
          ))}
        </clipPath>
      </defs>
      <g
        aria-label="한강"
        className="seoul-river-layer"
        clipPath={`url(#${clipId})`}
        data-testid="seoul-han-river"
      >
        <title>한강</title>
        {SEOUL_HAN_RIVER_SURFACES.map((surface, index) => (
          <path
            className="seoul-han-river-surface"
            d={createProjectedRiverSurfacePath(surface, mapData)}
            key={`han-river-surface-${index}`}
          />
        ))}
      </g>
    </>
  );
}

function DokdoLandmark({
  mapData,
  scale,
}: {
  mapData: BoundaryMapData;
  scale: number;
}) {
  return (
    <g
      aria-label="독도"
      className="dokdo-landmark"
      data-testid="dokdo-landmark"
    >
      <title>독도</title>
      {DOKDO_ISLANDS.map((island) => {
        const point = project(island.point, mapData);

        return (
          <ellipse
            className="dokdo-island"
            cx={point.x}
            cy={point.y}
            data-testid={island.testId}
            key={island.id}
            rx={island.radiusX * scale}
            ry={island.radiusY * scale}
            transform={`rotate(${island.rotation} ${point.x} ${point.y})`}
          />
        );
      })}
    </g>
  );
}

function createProjectedRiverSurfacePath(
  points: readonly RiverPoint[],
  context: ProjectionContext,
) {
  const projectedPoints = points.map(([lat, lng]) => project({ lat, lng }, context));
  const first = projectedPoints[0];

  if (!first) {
    return "";
  }

  return [
    `M ${roundSvg(first.x)} ${roundSvg(first.y)}`,
    ...projectedPoints
      .slice(1)
      .map((point) => `L ${roundSvg(point.x)} ${roundSvg(point.y)}`),
    "Z",
  ].join(" ");
}

function MapHoverTooltip({
  feature,
  scale,
}: {
  feature: HoveredFeature;
  scale: number;
}) {
  const width = Math.max(54, feature.name.length * 13 + 18);

  return (
    <g
      className="map-hover-tooltip"
      data-testid="map-hover-tooltip"
      transform={`translate(${feature.point.x} ${feature.point.y}) scale(${scale})`}
    >
      <rect
        x={-width / 2}
        y="-35"
        width={width}
        height="24"
        rx="12"
      />
      <text y="-23">{feature.name}</text>
    </g>
  );
}

function project(point: LatLng, context: ProjectionContext) {
  return projectPosition([point.lng, point.lat], context);
}

function projectPosition(position: Position, context: ProjectionContext): SvgPoint {
  const [lng, lat] = position;
  const rawX = (lng - context.geoBounds.minLng) * context.projection.lngScale;
  const rawY = context.geoBounds.maxLat - lat;

  return {
    x: context.projection.offsetX + rawX * context.projection.scale,
    y: context.projection.offsetY + rawY * context.projection.scale,
  };
}

function unproject(point: SvgPoint, context: ProjectionContext): LatLng {
  const rawX = (point.x - context.projection.offsetX) / context.projection.scale;
  const rawY = (point.y - context.projection.offsetY) / context.projection.scale;

  return {
    lat: context.geoBounds.maxLat - rawY,
    lng: context.geoBounds.minLng + rawX / context.projection.lngScale,
  };
}

function createProjection(bounds: GeoBounds): Projection {
  const meanLat = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  const lngScale = Math.cos(meanLat);
  const rawWidth = (bounds.maxLng - bounds.minLng) * lngScale;
  const rawHeight = bounds.maxLat - bounds.minLat;
  const scale = Math.min(
    FULL_VIEW_BOX.width / rawWidth,
    FULL_VIEW_BOX.height / rawHeight,
  );

  return {
    lngScale,
    scale,
    offsetX: (FULL_VIEW_BOX.width - rawWidth * scale) / 2,
    offsetY: (FULL_VIEW_BOX.height - rawHeight * scale) / 2,
  };
}

function getGeoBounds(features: GeoJsonFeature[]): GeoBounds {
  const bounds = {
    minLng: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };

  for (const feature of features) {
    scanPositions(feature.geometry.coordinates, ([lng, lat]) => {
      bounds.minLng = Math.min(bounds.minLng, lng);
      bounds.maxLng = Math.max(bounds.maxLng, lng);
      bounds.minLat = Math.min(bounds.minLat, lat);
      bounds.maxLat = Math.max(bounds.maxLat, lat);
    });
  }

  for (const island of DOKDO_ISLANDS) {
    bounds.minLng = Math.min(
      bounds.minLng,
      island.point.lng - DOKDO_GEO_BOUNDS_PADDING,
    );
    bounds.maxLng = Math.max(
      bounds.maxLng,
      island.point.lng + DOKDO_GEO_BOUNDS_PADDING,
    );
    bounds.minLat = Math.min(
      bounds.minLat,
      island.point.lat - DOKDO_GEO_BOUNDS_PADDING,
    );
    bounds.maxLat = Math.max(
      bounds.maxLat,
      island.point.lat + DOKDO_GEO_BOUNDS_PADDING,
    );
  }

  return bounds;
}

function scanPositions(value: unknown, visit: (position: Position) => void) {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    visit(value as Position);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => scanPositions(item, visit));
  }
}

function getProjectedBounds(
  polygons: Position[][][],
  context: ProjectionContext,
) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const position of ring) {
        const point = projectPosition(position, context);
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxY = Math.max(bounds.maxY, point.y);
      }
    }
  }

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function createProvinceBoundaryPaths(
  features: MunicipalityFeature[],
  context: ProjectionContext,
) {
  const segments = new Map<
    string,
    {
      from: Position;
      to: Position;
      provinces: Set<string>;
    }
  >();

  for (const feature of features) {
    for (const polygon of feature.polygons) {
      for (const ring of polygon) {
        for (let index = 0; index < ring.length; index += 1) {
          const from = ring[index];
          const to = ring[(index + 1) % ring.length];
          if (!from || !to || isSamePosition(from, to)) {
            continue;
          }

          const key = getSegmentKey(from, to);
          const segment = segments.get(key) ?? {
            from,
            to,
            provinces: new Set<string>(),
          };
          segment.provinces.add(feature.province);
          segments.set(key, segment);
        }
      }
    }
  }

  const pathsByRegionPair = new Map<string, string[]>();

  for (const segment of segments.values()) {
    const regions = [...segment.provinces].sort();
    if (
      regions.length < 2 ||
      !regions.every((region) => NATIONAL_ADMIN_REGIONS.has(region))
    ) {
      continue;
    }

    const regionPairKey = regions.join("|");
    const paths = pathsByRegionPair.get(regionPairKey) ?? [];
    const from = projectPosition(segment.from, context);
    const to = projectPosition(segment.to, context);

    paths.push(
      `M ${roundSvg(from.x)} ${roundSvg(from.y)} L ${roundSvg(to.x)} ${roundSvg(to.y)}`,
    );
    pathsByRegionPair.set(regionPairKey, paths);
  }

  return [...pathsByRegionPair.entries()].map(([id, paths]) => ({
    id,
    regions: id.split("|"),
    path: paths.join(" "),
  }));
}

function getSegmentKey(from: Position, to: Position) {
  const fromKey = getPositionKey(from);
  const toKey = getPositionKey(to);

  return fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`;
}

function getPositionKey([lng, lat]: Position) {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

function isSamePosition(from: Position, to: Position) {
  return from[0] === to[0] && from[1] === to[1];
}

function combineBounds(features: MunicipalityFeature[]): ViewBoxBounds {
  if (features.length === 0) {
    return FULL_VIEW_BOX;
  }

  const bounds = features.reduce(
    (current, feature) => ({
      minX: Math.min(current.minX, feature.bounds.x),
      minY: Math.min(current.minY, feature.bounds.y),
      maxX: Math.max(current.maxX, feature.bounds.x + feature.bounds.width),
      maxY: Math.max(current.maxY, feature.bounds.y + feature.bounds.height),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function includeSvgPointsInBounds(
  viewBox: ViewBoxBounds,
  points: readonly SvgPoint[],
  padding: number,
): ViewBoxBounds {
  if (points.length === 0) {
    return viewBox;
  }

  const bounds = points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x - padding),
      minY: Math.min(current.minY, point.y - padding),
      maxX: Math.max(current.maxX, point.x + padding),
      maxY: Math.max(current.maxY, point.y + padding),
    }),
    {
      minX: viewBox.x,
      minY: viewBox.y,
      maxX: viewBox.x + viewBox.width,
      maxY: viewBox.y + viewBox.height,
    },
  );

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function padViewBox(viewBox: ViewBoxBounds, ratio: number): ViewBoxBounds {
  const padding = Math.max(8, Math.max(viewBox.width, viewBox.height) * ratio);
  const x = Math.max(FULL_VIEW_BOX.x, viewBox.x - padding);
  const y = Math.max(FULL_VIEW_BOX.y, viewBox.y - padding);
  const maxX = Math.min(
    FULL_VIEW_BOX.x + FULL_VIEW_BOX.width,
    viewBox.x + viewBox.width + padding,
  );
  const maxY = Math.min(
    FULL_VIEW_BOX.y + FULL_VIEW_BOX.height,
    viewBox.y + viewBox.height + padding,
  );

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

function isPointInFeatures(point: LatLng, features: MunicipalityFeature[]) {
  return features.some((feature) =>
    feature.polygons.some((polygon) => isPointInPolygon(point, polygon)),
  );
}

function findFeatureAtPoint(point: LatLng, features: MunicipalityFeature[]) {
  return features.find((feature) =>
    feature.polygons.some((polygon) => isPointInPolygon(point, polygon)),
  );
}

function getViewBoxCenter(viewBox: ViewBoxBounds): SvgPoint {
  return {
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + viewBox.height / 2,
  };
}

function getMapZoomLevel(baseViewBox: ViewBoxBounds, viewBox: ViewBoxBounds) {
  return Math.max(
    baseViewBox.width / viewBox.width,
    baseViewBox.height / viewBox.height,
  );
}

function getZoomedViewBox(
  currentViewBox: ViewBoxBounds,
  baseViewBox: ViewBoxBounds,
  anchor: SvgPoint,
  factor: number,
): ViewBoxBounds {
  const currentZoomLevel = getMapZoomLevel(baseViewBox, currentViewBox);
  const nextZoomLevel = clamp(
    currentZoomLevel * factor,
    1,
    MAP_MAX_ZOOM,
  );
  const nextWidth = baseViewBox.width / nextZoomLevel;
  const nextHeight = baseViewBox.height / nextZoomLevel;
  const anchorRatioX = clamp(
    (anchor.x - currentViewBox.x) / currentViewBox.width,
    0,
    1,
  );
  const anchorRatioY = clamp(
    (anchor.y - currentViewBox.y) / currentViewBox.height,
    0,
    1,
  );

  return clampViewBoxToBase(
    {
      x: anchor.x - nextWidth * anchorRatioX,
      y: anchor.y - nextHeight * anchorRatioY,
      width: nextWidth,
      height: nextHeight,
    },
    baseViewBox,
  );
}

function clampViewBoxToBase(
  viewBox: ViewBoxBounds,
  baseViewBox: ViewBoxBounds,
): ViewBoxBounds {
  const width = clamp(
    viewBox.width,
    baseViewBox.width / MAP_MAX_ZOOM,
    baseViewBox.width,
  );
  const height = clamp(
    viewBox.height,
    baseViewBox.height / MAP_MAX_ZOOM,
    baseViewBox.height,
  );

  return {
    x: clamp(viewBox.x, baseViewBox.x, baseViewBox.x + baseViewBox.width - width),
    y: clamp(viewBox.y, baseViewBox.y, baseViewBox.y + baseViewBox.height - height),
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function areSameViewBoxes(from: ViewBoxBounds, to: ViewBoxBounds) {
  return (
    Math.abs(from.x - to.x) < 0.001 &&
    Math.abs(from.y - to.y) < 0.001 &&
    Math.abs(from.width - to.width) < 0.001 &&
    Math.abs(from.height - to.height) < 0.001
  );
}

function isPointInPolygon(point: LatLng, polygon: Position[][]) {
  const outerRing = polygon[0];
  if (!outerRing || !isPointInRing(point, outerRing)) {
    return false;
  }

  return polygon.slice(1).every((hole) => !isPointInRing(point, hole));
}

function isPointInRing(point: LatLng, ring: Position[]) {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLng, currentLat] = ring[index];
    const [previousLng, previousLat] = ring[previous];
    const crosses =
      currentLat > point.lat !== previousLat > point.lat &&
      point.lng <
        ((previousLng - currentLng) * (point.lat - currentLat)) /
          (previousLat - currentLat) +
          currentLng;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

function getOverlayScale(viewBox: ViewBoxBounds) {
  return Math.max(
    0.1,
    Math.min(1, Math.max(viewBox.width / FULL_VIEW_BOX.width, viewBox.height / FULL_VIEW_BOX.height)),
  );
}

function formatViewBox(viewBox: ViewBoxBounds) {
  return `${roundSvg(viewBox.x)} ${roundSvg(viewBox.y)} ${roundSvg(viewBox.width)} ${roundSvg(viewBox.height)}`;
}

function roundSvg(value: number) {
  return Number(value.toFixed(3));
}
