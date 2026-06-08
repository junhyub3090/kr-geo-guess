import type { LatLng } from "@kr-geo-guess/shared";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { CSSProperties, PointerEvent, WheelEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  DOKDO_ISLANDS,
  DOKDO_SVG_BOUNDS_PADDING,
  FULL_VIEW_BOX,
  MAP_DRAG_THRESHOLD_PX,
  MAP_MAX_ZOOM,
  MAP_WHEEL_ZOOM_STEP,
  MAP_ZOOM_STEP,
  NATIONAL_ADMIN_REGIONS,
  REGION_LABELS,
  SEOUL_REGION_ID,
} from "./koreaMapConstants";
import {
  areSameViewBoxes,
  clampViewBoxToBase,
  combineBounds,
  findFeatureAtPoint,
  formatViewBox,
  getCachedBoundaryMapData,
  getMapZoomLevel,
  getOverlayScale,
  getSvgPointFromClient,
  getSvgPointFromPointer,
  getViewBoxCenter,
  getZoomedViewBox,
  includeSvgPointsInBounds,
  isPointInFeatures,
  loadBoundaryMapData,
  padViewBox,
  project,
  unproject,
} from "./koreaMapData";
import {
  DokdoLandmark,
  MapHoverTooltip,
  MapLabel,
  SeoulHanRiverLayer,
} from "./KoreaMapOverlays";
import type {
  BoundaryMapData,
  BoundaryMapState,
  HoveredFeature,
  MapDragState,
  SvgPoint,
  ViewBoxBounds,
} from "./koreaMapTypes";

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
    data: getCachedBoundaryMapData(),
    error: null,
  }));

  useEffect(() => {
    const cachedBoundaryMapData = getCachedBoundaryMapData();
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
