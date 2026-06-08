import type { LatLng } from "@kr-geo-guess/shared";
import type { PointerEvent, WheelEvent } from "react";
import municipalitiesGeoJsonUrl from "../../../../../data/boundaries/skorea_municipalities_geo_simple.json?url";
import {
  DOKDO_GEO_BOUNDS_PADDING,
  DOKDO_ISLANDS,
  FULL_VIEW_BOX,
  MAP_MAX_ZOOM,
  NATIONAL_ADMIN_REGIONS,
  PROVINCE_BY_CODE_PREFIX,
} from "./koreaMapConstants";
import type {
  BoundaryMapData,
  GeoBounds,
  GeoJsonFeature,
  MunicipalityFeature,
  MultiPolygonCoordinates,
  PolygonCoordinates,
  Position,
  Projection,
  ProjectionContext,
  SvgPoint,
  ViewBoxBounds,
} from "./koreaMapTypes";

let cachedBoundaryMapData: BoundaryMapData | null = null;
let pendingBoundaryMapData: Promise<BoundaryMapData> | null = null;

export function getCachedBoundaryMapData() {
  return cachedBoundaryMapData;
}

export function loadBoundaryMapData() {
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

export function buildBoundaryMapData(features: GeoJsonFeature[]): BoundaryMapData {
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

export function getSvgPointFromPointer(
  svg: SVGSVGElement,
  event: PointerEvent<SVGSVGElement> | WheelEvent<SVGSVGElement>,
): SvgPoint | null {
  return getSvgPointFromClient(svg, event.clientX, event.clientY);
}

export function getSvgPointFromClient(
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

export function toMunicipalityFeature(
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

export function normalizePolygons(geometry: GeoJsonFeature["geometry"]): Position[][][] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates as PolygonCoordinates];
  }

  return geometry.coordinates as MultiPolygonCoordinates;
}

export function polygonToPath(polygon: Position[][], context: ProjectionContext) {
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

export function project(point: LatLng, context: ProjectionContext) {
  return projectPosition([point.lng, point.lat], context);
}

export function projectPosition(position: Position, context: ProjectionContext): SvgPoint {
  const [lng, lat] = position;
  const rawX = (lng - context.geoBounds.minLng) * context.projection.lngScale;
  const rawY = context.geoBounds.maxLat - lat;

  return {
    x: context.projection.offsetX + rawX * context.projection.scale,
    y: context.projection.offsetY + rawY * context.projection.scale,
  };
}

export function unproject(point: SvgPoint, context: ProjectionContext): LatLng {
  const rawX = (point.x - context.projection.offsetX) / context.projection.scale;
  const rawY = (point.y - context.projection.offsetY) / context.projection.scale;

  return {
    lat: context.geoBounds.maxLat - rawY,
    lng: context.geoBounds.minLng + rawX / context.projection.lngScale,
  };
}

export function createProjection(bounds: GeoBounds): Projection {
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

export function getGeoBounds(features: GeoJsonFeature[]): GeoBounds {
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

export function scanPositions(value: unknown, visit: (position: Position) => void) {
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

export function getProjectedBounds(
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

export function createProvinceBoundaryPaths(
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

export function getSegmentKey(from: Position, to: Position) {
  const fromKey = getPositionKey(from);
  const toKey = getPositionKey(to);

  return fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`;
}

export function getPositionKey([lng, lat]: Position) {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

export function isSamePosition(from: Position, to: Position) {
  return from[0] === to[0] && from[1] === to[1];
}

export function combineBounds(features: MunicipalityFeature[]): ViewBoxBounds {
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

export function includeSvgPointsInBounds(
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

export function padViewBox(viewBox: ViewBoxBounds, ratio: number): ViewBoxBounds {
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

export function isPointInFeatures(point: LatLng, features: MunicipalityFeature[]) {
  return features.some((feature) =>
    feature.polygons.some((polygon) => isPointInPolygon(point, polygon)),
  );
}

export function findFeatureAtPoint(point: LatLng, features: MunicipalityFeature[]) {
  return features.find((feature) =>
    feature.polygons.some((polygon) => isPointInPolygon(point, polygon)),
  );
}

export function getViewBoxCenter(viewBox: ViewBoxBounds): SvgPoint {
  return {
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + viewBox.height / 2,
  };
}

export function getMapZoomLevel(baseViewBox: ViewBoxBounds, viewBox: ViewBoxBounds) {
  return Math.max(
    baseViewBox.width / viewBox.width,
    baseViewBox.height / viewBox.height,
  );
}

export function getZoomedViewBox(
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

export function clampViewBoxToBase(
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

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function areSameViewBoxes(from: ViewBoxBounds, to: ViewBoxBounds) {
  return (
    Math.abs(from.x - to.x) < 0.001 &&
    Math.abs(from.y - to.y) < 0.001 &&
    Math.abs(from.width - to.width) < 0.001 &&
    Math.abs(from.height - to.height) < 0.001
  );
}

export function isPointInPolygon(point: LatLng, polygon: Position[][]) {
  const outerRing = polygon[0];
  if (!outerRing || !isPointInRing(point, outerRing)) {
    return false;
  }

  return polygon.slice(1).every((hole) => !isPointInRing(point, hole));
}

export function isPointInRing(point: LatLng, ring: Position[]) {
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

export function getOverlayScale(viewBox: ViewBoxBounds) {
  return Math.max(
    0.1,
    Math.min(1, Math.max(viewBox.width / FULL_VIEW_BOX.width, viewBox.height / FULL_VIEW_BOX.height)),
  );
}

export function formatViewBox(viewBox: ViewBoxBounds) {
  return `${roundSvg(viewBox.x)} ${roundSvg(viewBox.y)} ${roundSvg(viewBox.width)} ${roundSvg(viewBox.height)}`;
}

export function roundSvg(value: number) {
  return Number(value.toFixed(3));
}
