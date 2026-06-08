export type GeoJsonFeature = {
  properties: {
    code: string;
    name: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: PolygonCoordinates | MultiPolygonCoordinates;
  };
};

export type PolygonCoordinates = Position[][];
export type MultiPolygonCoordinates = Position[][][];
export type Position = [number, number];

export type SvgPoint = {
  x: number;
  y: number;
};

export type HoveredFeature = {
  name: string;
  point: SvgPoint;
};

export type MapDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  moved: boolean;
};

export type ViewBoxBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GeoBounds = {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
};

export type Projection = {
  lngScale: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type ProjectionContext = {
  geoBounds: GeoBounds;
  projection: Projection;
};

export type MunicipalityFeature = {
  id: string;
  name: string;
  province: string;
  path: string;
  bounds: ViewBoxBounds;
  polygons: Position[][][];
};

export type ProvinceBoundaryPath = {
  id: string;
  regions: string[];
  path: string;
};

export type BoundaryMapData = ProjectionContext & {
  municipalityFeatures: MunicipalityFeature[];
  nationalProvinceBoundaryPaths: ProvinceBoundaryPath[];
};

export type BoundaryMapState = {
  data: BoundaryMapData | null;
  error: Error | null;
};
