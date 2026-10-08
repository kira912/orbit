/**
 * Browser stand-in for `@maplibre/maplibre-react-native`, aliased in by
 * metro.config.js on web. Implements the subset of its API the app uses
 * (Map, Camera, GeoJSONSource, Layer, Marker, UserLocation) on top of
 * maplibre-gl, with the same props and event shapes, so screens stay shared.
 */
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { View, type StyleProp, type ViewStyle } from "react-native";
import * as maplibregl from "maplibre-gl";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { subscribeToUserPosition } from "../user-position";

export type { StyleSpecification };

// Served from public/ (see scripts/copy-maplibre-worker.js); versioned to bust caches on upgrade.
maplibregl.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);
type LngLat = [number, number];

const MapContext = createContext<maplibregl.Map | null>(null);
const SourceContext = createContext<string | null>(null);

function useMap(): maplibregl.Map {
  const map = useContext(MapContext);
  if (!map) throw new Error("MapLibre components must be rendered inside <Map>");
  return map;
}

/** How far (px) from a finger a feature still counts as tapped. */
const TAP_TOLERANCE = 8;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MAX_MOVE = 10;

interface MapProps {
  style?: StyleProp<ViewStyle>;
  mapStyle: StyleSpecification | string;
  logo?: boolean;
  compass?: boolean;
  attributionPosition?: { top?: number; bottom?: number; left?: number; right?: number };
  onLongPress?: (event: { nativeEvent: { lngLat: LngLat } }) => void;
  children?: ReactNode;
}

export function Map({ style, mapStyle, attributionPosition, onLongPress, children }: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = new maplibregl.Map({
      container,
      style: mapStyle,
      center: [2.3522, 48.8566],
      zoom: 13,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    instance.touchZoomRotate.disableRotation();
    instance.on("load", () => setMap(instance));

    const fireLongPress = (lngLat: maplibregl.LngLat) =>
      onLongPressRef.current?.({ nativeEvent: { lngLat: [lngLat.lng, lngLat.lat] } });

    // Mouse: right click. Touch: iOS Safari never fires contextmenu, so time the press.
    instance.on("contextmenu", (e) => fireLongPress(e.lngLat));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: maplibregl.Point | null = null;
    const cancel = () => {
      clearTimeout(timer);
      start = null;
    };
    instance.on("touchstart", (e) => {
      cancel();
      if (e.originalEvent.touches.length !== 1) return;
      start = e.point;
      const lngLat = e.lngLat;
      timer = setTimeout(() => fireLongPress(lngLat), LONG_PRESS_MS);
    });
    instance.on("touchmove", (e) => {
      if (start && e.point.dist(start) > LONG_PRESS_MAX_MOVE) cancel();
    });
    instance.on("touchend", cancel);
    instance.on("touchcancel", cancel);

    // The container is sized by flexbox after mount: keep the canvas in step.
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container);

    return () => {
      cancel();
      observer.disconnect();
      instance.remove();
      setMap(null);
    };
    // The style is fixed once the map exists (setStyle would drop the app's layers).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attribution: Record<string, string> = {};
  if (attributionPosition) {
    for (const [side, value] of Object.entries(attributionPosition)) attribution[side] = `${value}px`;
  }

  return (
    <View style={style}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {/* Moves MapLibre's attribution like the native attributionPosition prop. */}
      {attributionPosition && (
        <style>{`.maplibregl-ctrl-bottom-right{${Object.entries(attribution)
          .map(([side, value]) => `${side}:${value};`)
          .join("")}right:auto;}`}</style>
      )}
      {map && <MapContext.Provider value={map}>{children}</MapContext.Provider>}
    </View>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────

interface FlyToOptions {
  center: LngLat;
  zoom?: number;
  duration?: number;
}
interface FitBoundsOptions {
  padding?: maplibregl.PaddingOptions;
  duration?: number;
}
export interface CameraRef {
  flyTo: (options: FlyToOptions) => void;
  fitBounds: (bounds: [number, number, number, number], options?: FitBoundsOptions) => void;
}

interface CameraProps {
  initialViewState?: { center?: LngLat; zoom?: number };
  trackUserLocation?: "default" | "heading" | "course";
  onTrackUserLocationChange?: (event: { nativeEvent: { trackUserLocation: string | null } }) => void;
}

const FOLLOW_ZOOM = 15;

export const Camera = forwardRef<CameraRef, CameraProps>(function Camera(
  { initialViewState, trackUserLocation, onTrackUserLocationChange },
  ref,
) {
  const map = useMap();
  const onChangeRef = useRef(onTrackUserLocationChange);
  onChangeRef.current = onTrackUserLocationChange;

  useImperativeHandle(
    ref,
    () => ({
      flyTo: ({ center, zoom, duration }) => map.flyTo({ center, zoom, duration }),
      fitBounds: ([w, s, e, n], options) =>
        map.fitBounds(
          [
            [w, s],
            [e, n],
          ],
          { padding: options?.padding, duration: options?.duration },
        ),
    }),
    [map],
  );

  useEffect(() => {
    if (initialViewState?.center) map.jumpTo({ center: initialViewState.center, zoom: initialViewState.zoom });
    // Initial view only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const following = trackUserLocation != null;
  useEffect(() => {
    if (!following) return;
    let first = true;
    const unsubscribe = subscribeToUserPosition(({ coords }) => {
      const center: LngLat = [coords.longitude, coords.latitude];
      if (first) map.flyTo({ center, zoom: Math.max(map.getZoom(), FOLLOW_ZOOM), duration: 800 });
      else map.easeTo({ center, duration: 600 });
      first = false;
    });
    // Like the native side: a pan by the user stops following.
    const onDrag = (e: { originalEvent?: Event }) => {
      if (e.originalEvent) onChangeRef.current?.({ nativeEvent: { trackUserLocation: null } });
    };
    map.on("dragstart", onDrag);
    return () => {
      unsubscribe();
      map.off("dragstart", onDrag);
    };
  }, [map, following]);

  return null;
});

// ─── Sources & layers ─────────────────────────────────────────────────────

interface SourcePressEvent {
  nativeEvent: { features: GeoJSON.Feature[]; lngLat: LngLat };
  stopPropagation: () => void;
}

interface GeoJSONSourceProps {
  id: string;
  data: GeoJSON.GeoJSON;
  onPress?: (event: SourcePressEvent) => void;
  children?: ReactNode;
}

export function GeoJSONSource({ id, data, onPress, children }: GeoJSONSourceProps) {
  const map = useMap();
  const [added, setAdded] = useState(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    map.addSource(id, { type: "geojson", data });
    setAdded(true);
    return () => {
      setAdded(false);
      if (!map.getStyle() || !map.getSource(id)) return; // map already torn down
      // React may clean the source up before its child layers: drop them first.
      for (const layer of map.getStyle().layers) {
        if ("source" in layer && layer.source === id) map.removeLayer(layer.id);
      }
      map.removeSource(id);
    };
    // Data updates go through setData below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, id]);

  useEffect(() => {
    if (added) (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data);
  }, [map, id, data, added]);

  useEffect(() => {
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!onPressRef.current) return;
      const { x, y } = e.point;
      const features = map
        .queryRenderedFeatures([
          [x - TAP_TOLERANCE, y - TAP_TOLERANCE],
          [x + TAP_TOLERANCE, y + TAP_TOLERANCE],
        ])
        .filter((f) => f.source === id);
      if (features.length === 0) return;
      onPressRef.current({
        nativeEvent: { features: features as GeoJSON.Feature[], lngLat: [e.lngLat.lng, e.lngLat.lat] },
        stopPropagation: () => undefined,
      });
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, id]);

  // Layers mount only once the source exists, as maplibre-gl requires.
  return added ? <SourceContext.Provider value={id}>{children}</SourceContext.Provider> : null;
}

type LayerProps = {
  id: string;
  type: LayerSpecification["type"];
  source?: string;
  beforeId?: string;
  filter?: unknown;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

export function Layer({ id, type, source, beforeId, filter, paint, layout }: LayerProps) {
  const map = useMap();
  const parentSource = useContext(SourceContext);
  const sourceId = source ?? parentSource;
  const applied = useRef<{ paint?: Record<string, unknown>; layout?: Record<string, unknown>; filter?: unknown }>({});

  useEffect(() => {
    map.addLayer(
      // maplibre-gl rejects keys set to undefined: only pass what the layer defines.
      {
        id,
        type,
        source: sourceId,
        ...(paint && { paint }),
        ...(layout && { layout }),
        ...(filter != null && { filter }),
      } as LayerSpecification,
      beforeId && map.getLayer(beforeId) ? beforeId : undefined,
    );
    applied.current = { paint, layout, filter };
    return () => {
      if (map.getStyle() && map.getLayer(id)) map.removeLayer(id);
    };
    // Style props are diffed below; a new id/type/source means a new layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, id, type, sourceId]);

  useEffect(() => {
    const previous = applied.current;
    if (!map.getLayer(id)) return;
    // Keys come from the app's layer specs, typed against the native package.
    diffProperties(previous.paint, paint, (key, value) => map.setPaintProperty(id, key as never, value as never));
    diffProperties(previous.layout, layout, (key, value) => map.setLayoutProperty(id, key as never, value as never));
    if (JSON.stringify(previous.filter) !== JSON.stringify(filter)) {
      map.setFilter(id, (filter ?? null) as maplibregl.FilterSpecification | null);
    }
    applied.current = { paint, layout, filter };
  }, [map, id, paint, layout, filter]);

  return null;
}

function diffProperties(
  previous: Record<string, unknown> = {},
  next: Record<string, unknown> = {},
  set: (key: string, value: unknown) => void,
) {
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) set(key, next[key]);
  }
}

// ─── Markers ──────────────────────────────────────────────────────────────

interface MarkerProps {
  id?: string;
  lngLat: LngLat;
  anchor?: maplibregl.PositionAnchor;
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
  children?: ReactNode;
}

/** A React subtree pinned to a coordinate, rendered into a maplibre-gl marker element. */
export function Marker({ lngLat, anchor = "center", pointerEvents, children }: MarkerProps) {
  const map = useMap();
  const [element] = useState(() => document.createElement("div"));
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    const marker = new maplibregl.Marker({ element, anchor }).setLngLat(lngLat).addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // Position updates go through setLngLat below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, element, anchor]);

  useEffect(() => {
    markerRef.current?.setLngLat(lngLat);
  }, [lngLat[0], lngLat[1]]);

  element.style.pointerEvents = pointerEvents === "none" ? "none" : "";
  return createPortal(children, element);
}

/** The blue "you are here" dot, fed by the browser's geolocation. */
export function UserLocation() {
  const [position, setPosition] = useState<LngLat | null>(null);
  useEffect(() => subscribeToUserPosition(({ coords }) => setPosition([coords.longitude, coords.latitude])), []);
  if (!position) return null;
  return (
    <Marker lngLat={position} pointerEvents="none">
      <div
        style={{
          width: 18,
          height: 18,
          boxSizing: "border-box",
          borderRadius: "50%",
          background: "#2f80ed",
          border: "3px solid #ffffff",
          boxShadow: "0 0 0 6px rgba(47,128,237,0.2), 0 1px 4px rgba(0,0,0,0.3)",
        }}
      />
    </Marker>
  );
}
