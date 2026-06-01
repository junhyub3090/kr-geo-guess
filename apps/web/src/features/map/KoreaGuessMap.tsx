import type { LatLng } from "@kr-geo-guess/shared";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import municipalitiesGeoJsonUrl from "../../../../../data/boundaries/skorea_municipalities_geo_simple.json?url";

type KoreaGuessMapProps = {
  guess: LatLng | null;
  target?: LatLng;
  regions?: readonly string[];
  peerGuesses?: Array<{
    id: string;
    label: string;
    point: LatLng;
  }>;
  distanceLabel?: string;
  disabled?: boolean;
  showLabels?: boolean;
  compact?: boolean;
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

const NATIONAL_FOCUS_REGIONS = new Set([
  "서울",
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
  target,
  regions = [],
  peerGuesses = [],
  distanceLabel,
  disabled = false,
  showLabels = true,
  compact = false,
  onGuess,
}: KoreaGuessMapProps & { mapData: BoundaryMapData }) {
  const [hoveredFeature, setHoveredFeature] = useState<HoveredFeature | null>(null);
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
  const viewBox = useMemo(
    () =>
      isNationalMap
        ? FULL_VIEW_BOX
        : padViewBox(combineBounds(visibleFeatures), 0.1),
    [isNationalMap, visibleFeatures],
  );
  const labels = showLabels
    ? REGION_LABELS.filter((label) =>
        isNationalMap
          ? NATIONAL_FOCUS_REGIONS.has(label.id)
          : selectedRegions.has(label.id),
      )
    : [];
  const overlayScale = getOverlayScale(viewBox);

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    if (disabled) {
      return;
    }

    const svgPoint = getSvgPointFromPointer(event.currentTarget, event);
    if (!svgPoint) {
      return;
    }

    const point = unproject(svgPoint, mapData);

    if (!isPointInFeatures(point, visibleFeatures)) {
      return;
    }

    onGuess(point);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
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
    <svg
      className={[
        "korea-map",
        isNationalMap ? "national" : "",
        disabled ? "disabled" : "",
        compact ? "compact" : "",
      ].filter(Boolean).join(" ")}
      data-testid="guess-map"
      viewBox={formatViewBox(viewBox)}
      role="img"
      aria-label="한국 추측 지도"
      onPointerDown={handlePointer}
      onPointerLeave={() => setHoveredFeature(null)}
      onPointerMove={handlePointerMove}
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
      {targetPoint
        ? peerPoints.map((peerGuess) => (
            <line
              className="peer-answer-line"
              key={`line-${peerGuess.id}`}
              x1={peerGuess.point.x}
              y1={peerGuess.point.y}
              x2={targetPoint.x}
              y2={targetPoint.y}
            />
          ))
        : null}
      {targetPoint ? (
        <g className="target-marker" transform={`translate(${targetPoint.x} ${targetPoint.y}) scale(${overlayScale})`}>
          <circle r="7" />
          <circle r="2.4" />
        </g>
      ) : null}
      {guessPoint ? (
        <g className="guess-marker" transform={`translate(${guessPoint.x} ${guessPoint.y}) scale(${overlayScale})`}>
          <circle className="guess-marker-halo" r="8" />
          <circle className="guess-marker-core" r="4.2" />
        </g>
      ) : null}
      {peerPoints.map((peerGuess) => (
        <g
          className="peer-guess-marker"
          key={peerGuess.id}
          transform={`translate(${peerGuess.point.x} ${peerGuess.point.y}) scale(${overlayScale})`}
        >
          <circle r="6" />
        </g>
      ))}
      {hoveredFeature ? (
        <MapHoverTooltip
          feature={hoveredFeature}
          scale={overlayScale}
        />
      ) : null}
    </svg>
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
  event: PointerEvent<SVGSVGElement>,
): SvgPoint | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) {
    return null;
  }

  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
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
      !regions.every((region) => NATIONAL_FOCUS_REGIONS.has(region))
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
