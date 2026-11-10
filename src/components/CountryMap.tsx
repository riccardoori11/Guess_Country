import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { countries } from '../data/countries';
import geography from '../data/geography.json';
import './country-map.css';

interface CountryMapProps {
  completedIds: readonly string[];
  incorrectId: string | null;
  revealedIds?: readonly string[];
  focusCountryId?: string | null;
  disabled?: boolean;
  onSelect: (countryId: string) => void;
}
interface View { x: number; y: number; scale: number }
interface Point { x: number; y: number }
interface Gesture {
  view: View;
  points: Point[];
  moved: boolean;
  countryId: string | null;
}
const WIDTH = 960;
const HEIGHT = 480;
const HOME: View = { x: 0, y: 0, scale: 1 };
const names = new Map(countries.map((country) => [country.id, country.name]));
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function constrained(view: View): View {
  const scale = Math.max(1, Math.min(40, view.scale));
  return {
    scale,
    x: Math.max(WIDTH * (1 - scale), Math.min(0, view.x)),
    y: Math.max(HEIGHT * (1 - scale), Math.min(0, view.y)),
  };
}

function countryView(feature: (typeof geography)[number]): View {
  let center: Point;
  let scale = 16;
  if (feature.point) {
    center = { x: feature.point[0], y: feature.point[1] };
  } else {
    // Bounds come from our generated static paths, so focusing also works in
    // non-layout environments and never depends on SVG getBBox support.
    // Focus the largest polygon; overseas and antimeridian pieces keep their
    // highlighting without forcing the camera out to the entire world.
    let largestArea = -1;
    let bounds = { left: 0, right: WIDTH, top: 0, bottom: HEIGHT };
    for (const ring of feature.path.split('M').filter(Boolean)) {
      const points = ring.replace(/Z$/, '').split('L').map((point) => point.split(',').map(Number));
      const area = Math.abs(points.reduce((sum, [x, y], index) => {
        const [nextX, nextY] = points[(index + 1) % points.length];
        return sum + x * nextY - nextX * y;
      }, 0)) / 2;
      if (area <= largestArea) continue;
      largestArea = area;
      bounds = {
        left: Math.min(...points.map(([x]) => x)),
        right: Math.max(...points.map(([x]) => x)),
        top: Math.min(...points.map(([, y]) => y)),
        bottom: Math.max(...points.map(([, y]) => y)),
      };
    }
    center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
    scale = Math.max(1, Math.min(16, WIDTH * 0.78 / Math.max(1, bounds.right - bounds.left), HEIGHT * 0.72 / Math.max(1, bounds.bottom - bounds.top)));
  }
  return { scale, x: WIDTH / 2 - center.x * scale, y: HEIGHT / 2 - center.y * scale };
}

export function CountryMap({ completedIds, incorrectId, revealedIds = [], focusCountryId = null, disabled = false, onSelect }: CountryMapProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(HOME);
  const viewRef = useRef<View>(HOME);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(WIDTH);
  const [showTargets, setShowTargets] = useState(true);
  const instructionsId = useId();
  const completed = new Set(completedIds);
  const revealed = new Set(revealedIds);
  const updateView = useCallback((next: View) => {
    const bounded = constrained(next);
    viewRef.current = bounded;
    setView(bounded);
  }, []);
  const position = useCallback((clientX: number, clientY: number): Point => {
    const rect = svg.current?.getBoundingClientRect();
    const ratio = WIDTH / (rect?.width || WIDTH);
    return { x: (clientX - (rect?.left || 0)) * ratio, y: (clientY - (rect?.top || 0)) * ratio };
  }, []);
  const zoom = useCallback((factor: number, center: Point = { x: WIDTH / 2, y: HEIGHT / 2 }) => {
    const current = viewRef.current;
    const scale = Math.max(1, Math.min(40, current.scale * factor));
    updateView({
      scale,
      x: center.x - (center.x - current.x) * scale / current.scale,
      y: center.y - (center.y - current.y) * scale / current.scale,
    });
  }, [updateView]);

  useEffect(() => {
    if (!focusCountryId) return;
    const feature = geography.find((item) => item.id === focusCountryId);
    if (!feature) return;
    pointers.current.clear();
    gesture.current = null;
    setDragging(false);
    updateView(countryView(feature));
  }, [focusCountryId, updateView]);

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width || WIDTH);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    // Native non-passive wheel listener lets zoom consume the gesture reliably.
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(Math.exp(-event.deltaY * 0.002), position(event.clientX, event.clientY));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      element.removeEventListener('wheel', wheel);
    };
  }, [position, zoom]);

  function beginGesture(countryId: string | null = null, moved = false) {
    gesture.current = { view: viewRef.current, points: [...pointers.current.values()], moved, countryId };
  }
  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    pointers.current.set(event.pointerId, position(event.clientX, event.clientY));
    const target = event.target instanceof Element ? event.target.closest<SVGGElement>('[data-country-id]') : null;
    beginGesture(pointers.current.size === 1 ? target?.dataset.countryId || null : null, pointers.current.size > 1);
    // Capture keeps panning stable when a pointer leaves the viewport.
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, position(event.clientX, event.clientY));
    const currentPoints = [...pointers.current.values()];
    const start = gesture.current;
    if (currentPoints.length >= 2 && start.points.length >= 2) {
      start.moved = true;
      const from = midpoint(start.points[0], start.points[1]);
      const to = midpoint(currentPoints[0], currentPoints[1]);
      const scale = Math.max(1, Math.min(40, start.view.scale * distance(currentPoints[0], currentPoints[1]) / Math.max(1, distance(start.points[0], start.points[1]))));
      updateView({ scale, x: to.x - (from.x - start.view.x) * scale / start.view.scale, y: to.y - (from.y - start.view.y) * scale / start.view.scale });
    } else if (currentPoints.length === 1 && start.points.length === 1) {
      const dx = currentPoints[0].x - start.points[0].x;
      const dy = currentPoints[0].y - start.points[0].y;
      if (Math.hypot(dx, dy) * width / WIDTH > 4) start.moved = true;
      if (start.moved) updateView({ ...start.view, x: start.view.x + dx, y: start.view.y + dy });
    }
    if (start.moved) setDragging(true);
  }
  function pointerEnd(event: ReactPointerEvent<SVGSVGElement>, cancelled = false) {
    const start = gesture.current;
    if (!pointers.current.has(event.pointerId)) return;
    if (!cancelled && pointers.current.size === 1 && start && !start.moved && start.countryId && !disabled) onSelect(start.countryId);
    pointers.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (pointers.current.size) beginGesture(null, true);
    else { gesture.current = null; setDragging(false); }
  }
  const markerRadius = 3.5 * WIDTH / width / view.scale;
  const hitRadius = 12 * WIDTH / width / view.scale;

  return (
    <div className="country-map">
      <div className="map-toolbar">
        <label className="map-target-toggle">
          <input type="checkbox" checked={showTargets} onChange={(event) => setShowTargets(event.target.checked)} />
          Small-country targets
        </label>
        <div className="map-controls" aria-label="Map controls">
          <button type="button" onClick={() => zoom(1 / 1.65)} disabled={view.scale <= 1} aria-label="Zoom out"><Minus size={16} /></button>
          <output aria-label="Map zoom">{view.scale.toFixed(1)}×</output>
          <button type="button" onClick={() => zoom(1.65)} disabled={view.scale >= 40} aria-label="Zoom in"><Plus size={16} /></button>
          <button type="button" onClick={() => updateView(HOME)} aria-label="Reset map view"><Maximize2 size={15} /></button>
        </div>
      </div>
      <svg
        ref={svg}
        className={`country-map-viewport${dragging ? ' is-dragging' : ''}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label="Blank political world map"
        aria-describedby={instructionsId}
        tabIndex={0}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={(event) => pointerEnd(event)}
        onPointerCancel={(event) => pointerEnd(event, true)}
        onLostPointerCapture={(event) => pointerEnd(event, true)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const current = viewRef.current;
          const deltas: Record<string, Point> = { ArrowLeft: { x: 70, y: 0 }, ArrowRight: { x: -70, y: 0 }, ArrowUp: { x: 0, y: 70 }, ArrowDown: { x: 0, y: -70 } };
          if (deltas[event.key]) { event.preventDefault(); updateView({ ...current, x: current.x + deltas[event.key].x, y: current.y + deltas[event.key].y }); }
          else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.65); }
          else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.65); }
          else if (event.key === 'Home') { event.preventDefault(); updateView(HOME); }
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {geography.filter((feature) => !names.has(feature.id)).map((feature) => <path key={feature.id} className="map-other-land" d={feature.path} fillRule="evenodd" aria-hidden="true" />)}
          {geography.filter((feature) => names.has(feature.id)).map((feature) => (
            <g
              key={feature.id}
              data-country-id={feature.id}
              className={`map-country${completed.has(feature.id) ? ' is-completed' : ''}${revealed.has(feature.id) ? ' is-revealed' : ''}${incorrectId === feature.id ? ' is-incorrect' : ''}`}
              role="button"
              aria-label={names.get(feature.id)}
              aria-description={revealed.has(feature.id) ? 'Revealed answer' : completed.has(feature.id) ? 'Correctly located' : undefined}
              aria-disabled={disabled}
              aria-pressed={completed.has(feature.id)}
              tabIndex={disabled ? -1 : 0}
              // Pointer selections happen on pointerup; detail 0 covers keyboard,
              // assistive-technology activation, and programmatic clicks.
              onClick={(event) => { if (event.detail === 0 && !disabled) onSelect(feature.id); }}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !disabled) { event.preventDefault(); onSelect(feature.id); }
              }}
            >
              <path className="map-country-shape" d={feature.path} fillRule="evenodd" />
              {feature.point && (showTargets || revealed.has(feature.id)) && (
                <>
                  <circle className="map-country-hit" cx={feature.point[0]} cy={feature.point[1]} r={hitRadius} />
                  <circle className="map-country-dot" cx={feature.point[0]} cy={feature.point[1]} r={markerRadius} />
                </>
              )}
            </g>
          ))}
        </g>
      </svg>
      <p className="map-instructions" id={instructionsId}>Click a country. Drag to pan; scroll or pinch to zoom. Dots mark small countries — zoom in to separate them. Keyboard: Tab to a country, Enter to choose; focus the map for arrows, +, −, and Home.</p>
      <div className="map-legend" aria-label="Map legend">
        <span><i className="map-legend-neutral" />Unanswered</span>
        <span><i className="map-legend-complete" />Located</span>
        <span><i className="map-legend-revealed" />Revealed</span>
        <span><i className="map-legend-incorrect" />Incorrect guess</span>
      </div>
    </div>
  );
}
