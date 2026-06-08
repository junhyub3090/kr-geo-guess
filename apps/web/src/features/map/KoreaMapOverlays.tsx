import type { LatLng } from "@kr-geo-guess/shared";
import { DOKDO_ISLANDS, SEOUL_HAN_RIVER_SURFACES } from "./koreaMapConstants";
import { project, roundSvg } from "./koreaMapData";
import type {
  BoundaryMapData,
  HoveredFeature,
  MunicipalityFeature,
  ProjectionContext,
} from "./koreaMapTypes";
import type { RiverPoint } from "./koreaMapConstants";

export function MapLabel({
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

export function SeoulHanRiverLayer({
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

export function DokdoLandmark({
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

export function MapHoverTooltip({
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
