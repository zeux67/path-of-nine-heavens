import React, { useEffect, useMemo, useRef, useState } from 'react';
import { City, World, pointInPolygon } from '../game/world';
import { powerAt } from '../game/war';
import { mulberry32 } from '../game/rng';
import { MAP_IMAGE_URL } from '../game/mapImage';
import { BORDERS } from '../game/borders';
import { LAND_MASK_URL } from '../game/landMask';
import { SEA_MASK_URL } from '../game/seaMask';
import { CARAVANS } from '../game/caravans';

// Closed Catmull-Rom spline through sparse border points -> smooth SVG path.
// Borders are pre-snapped to the painting's terrain contours (see game/borders.ts),
// so the curve follows ridges/rivers instead of straight Voronoi chords.
function smoothOpenPath(pts: number[]): string {
    const n = pts.length / 2;
    if (n < 2) return '';
    const cl = (i: number) => Math.min(n - 1, Math.max(0, i));
    const px = (i: number) => pts[cl(i) * 2];
    const py = (i: number) => pts[cl(i) * 2 + 1];
    let d = `M${px(0)},${py(0)}`;
    for (let i = 0; i < n - 1; i++) {
        const c1x = px(i) + (px(i + 1) - px(i - 1)) / 6;
        const c1y = py(i) + (py(i + 1) - py(i - 1)) / 6;
        const c2x = px(i + 1) - (px(i + 2) - px(i)) / 6;
        const c2y = py(i + 1) - (py(i + 2) - py(i)) / 6;
        d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${px(i + 1)},${py(i + 1)}`;
    }
    return d;
}

// Hierarchical world map: whole world -> continents -> prefectures -> countries -> cities.
// Drag to pan, pinch / wheel / buttons to zoom, tap a city for its sheet.

const ASPECT_DEFAULT = 5 / 6;
const MIN_W = 260;
const DEMO_INITIAL_VIEW: { x: number; y: number; w: number } | null = null;

interface Props {
    world: World;
    locationId: string | null;
    travelingToId: string | null;
    selectedId: string | null;
    onSelect: (city: City | null) => void;
    season?: 'spring' | 'summer' | 'autumn' | 'winter';
    year?: number;
}

const INK = '#33302a';
const GOLD = '#b89a5e';
const PARCH = '#ddd0b0';
const JADE = '#9db8a0';

// Inked miniature markers, drawn in a 24x24 box centered on (0,0) so they sit
// on the painting like the cartographer inked them. Shape = settlement rank.
function TierGlyph({ tier, size, seat, hegemon }: { tier: string; size: number; seat?: 'sect' | 'clan' | null; hegemon?: boolean }) {
    const k = size / 24;
    const L = { strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const, stroke: INK };
    const ROOF = '#8a3b2a', THATCH = '#a9803f', WALL = '#e4d7b6', STONE = '#c9bb98';
    const hut = (x: number, y: number, w: number, h: number, roof: string) => (
        <g {...L}>
            <rect x={x - w / 2} y={y} width={w} height={h} fill={WALL} />
            <path d={`M${x - w / 2 - 1.2} ${y} L${x} ${y - h * 0.9} L${x + w / 2 + 1.2} ${y} Z`} fill={roof} />
        </g>
    );
    let body = null;
    const ground = <ellipse cx="0" cy="8.5" rx="11.5" ry="3.6" fill="rgba(46,34,16,0.30)" stroke="none" />;
    if (tier === 'capital') {
        body = (<g>
            {ground}
            <g {...L}>
                <rect x="-11" y="2" width="22" height="7" fill={STONE} />
                <path d="M-11 2 V-0.5 H-9 V2 M-6 2 V-0.5 H-4 V2 M4 2 V-0.5 H6 V2 M9 2 V-0.5 H11 V2" fill={STONE} />
                <rect x="-8.5" y="-3" width="5" height="5" fill={WALL} />
                <path d="M-10 -3 L-6 -6.5 L-2 -3 Z" fill={ROOF} />
                <rect x="3.5" y="-3" width="5" height="5" fill={WALL} />
                <path d="M2 -3 L6 -6.5 L10 -3 Z" fill={ROOF} />
                <rect x="-2.6" y="-5" width="5.2" height="7" fill={WALL} />
                <path d="M-4.4 -5 L0 -8 L4.4 -5 Z" fill={GOLD} />
                <rect x="-1.8" y="-10" width="3.6" height="2.4" fill={WALL} />
                <path d="M-3 -10 L0 -12.2 L3 -10 Z" fill={GOLD} />
                <path d="M0 -12.2 V-15.5" />
                <path d="M0 -15.5 L4.2 -14.2 L0 -12.9 Z" fill="#b8301f" />
                <path d="M-2 9 V6 a2 2 0 0 1 4 0 V9" fill="#3a2a1a" />
            </g>
        </g>);
    } else if (tier === 'market') {
        body = (<g>
            {ground}
            <g {...L}>
                <rect x="-10" y="1.5" width="20" height="7" fill={STONE} />
                <path d="M-10 1.5 V-0.5 H-8 V1.5 M8 1.5 V-0.5 H10 V1.5" fill={STONE} />
                <path d="M-8 1.5 L-6 -3 H-1 L-1 1.5 Z" fill={ROOF} />
                <path d="M1 1.5 L1 -3 H6 L8 1.5 Z" fill={JADE} />
                <path d="M0 -3 V-9" />
                <path d="M0 -9 L5 -7.5 L0 -6 Z" fill={GOLD} />
                <path d="M-2 8.5 V5.5 a2 2 0 0 1 4 0 V8.5" fill="#3a2a1a" />
            </g>
        </g>);
    } else if (tier === 'city') {
        body = (<g>
            {ground}
            <g {...L}>
                <rect x="-9.5" y="1" width="19" height="7.5" fill={STONE} />
                <path d="M-9.5 1 V-1 H-7.5 V1 M-4.5 1 V-1 H-2.5 V1 M2.5 1 V-1 H4.5 V1 M7.5 1 V-1 H9.5 V1" fill={STONE} />
                <rect x="-6" y="-3.5" width="4.5" height="4.5" fill={WALL} />
                <path d="M-7.4 -3.5 L-3.75 -7 L-0.1 -3.5 Z" fill={ROOF} />
                <rect x="2" y="-2.5" width="4" height="3.5" fill={WALL} />
                <path d="M0.8 -2.5 L4 -5.5 L7.2 -2.5 Z" fill={ROOF} />
                <path d="M-2 8.5 V5 a2 2 0 0 1 4 0 V8.5" fill="#3a2a1a" />
            </g>
        </g>);
    } else if (tier === 'town') {
        body = (<g>
            {ground}
            <g {...L}>
                <path d="M-9 8 V3.5 H9 V8 Z" fill={STONE} />
                {hut(-4.5, 0, 5, 3.5, THATCH)}
                {hut(3.5, -0.5, 5.5, 4, ROOF)}
                <rect x="-1" y="-6" width="2.6" height="4" fill={WALL} />
                <path d="M-2 -6 L0.3 -8.5 L2.6 -6 Z" fill={ROOF} />
            </g>
        </g>);
    } else {
        body = (<g>
            {ground}
            {hut(-5.5, 2, 5, 4, THATCH)}
            {hut(4.5, 3, 5, 3.6, THATCH)}
            {hut(-0.5, -1.5, 4.2, 3.2, THATCH)}
            <path d="M-9 8 Q0 6.5 9 8" stroke="#7a5a30" strokeWidth={1.2} fill="none" vectorEffect="non-scaling-stroke" strokeDasharray="1 2.5" strokeLinecap="round" />
        </g>);
    }
    // Seat status lives in the icon itself: a small pennant (sect) or square banner (clan) on a pole;
    // hegemons fly a second pennant.
    const top = tier === 'capital' ? -9 : tier === 'market' ? -3 : tier === 'city' ? -3 : -3;
    const flag = (x: number, kind: 'sect' | 'clan', gold: boolean) => (
        <g {...L} fill={gold ? GOLD : PARCH} strokeWidth={1.4}>
            <path d={`M${x} ${top + 2} V${top - 8}`} fill="none" />
            {kind === 'sect' ? <path d={`M${x} ${top - 8} L${x + 6} ${top - 5.5} L${x} ${top - 3} Z`} /> : <path d={`M${x} ${top - 8} H${x + 5.5} V${top - 3.5} H${x}`} />}
        </g>
    );
    return (
        <g transform={`scale(${k})`}>
            {body}
            {seat && flag(tier === 'capital' ? 9 : 8, seat, true)}
            {seat && hegemon && flag(-11, seat, false)}
        </g>
    );
}

// Force-seat markers: torii for sects, courtyard house for clans, crown for hegemons.
function SeatGlyph({ kind, size }: { kind: 'sect' | 'clan'; size: number }) {
    const k = size / 24;
    const line = { strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
    return (
        <g transform={`scale(${k})`} {...line} stroke={INK} fill={GOLD}>
            {kind === 'sect' ? (<>
                <path d="M-8 -6 Q0 -9 8 -6" fill="none" />
                <path d="M-7 -2.5 H7" fill="none" />
                <path d="M-5 -2.5 V8 M5 -2.5 V8" fill="none" />
                <path d="M-6.5 8.5 H-3.5 M3.5 8.5 H6.5" fill="none" />
            </>) : (<>
                <path d="M-8 -1 L0 -7 L8 -1" fill="none" />
                <path d="M-6 -1 V8 H6 V-1" />
                <path d="M-2 8 V3 H2 V8" fill="none" />
            </>)}
        </g>
    );
}

function CrownGlyph({ size }: { size: number }) {
    const k = size / 24;
    return (
        <g transform={`scale(${k})`} stroke={INK} fill={GOLD} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
            <path d="M-5 4 L-3.5 -3 L0 1.5 L3.5 -3 L5 4 Z" />
            <path d="M-5 6.5 H5" fill="none" strokeLinecap="round" />
        </g>
    );
}


// Roads link each settlement to the nearest bigger one in its prefecture; rivers wind from inland springs to the nearest shore.
const TIER_RANK: Record<string, number> = { capital: 0, market: 1, city: 2, town: 3, village: 4 };
function buildRoadsAndRivers(world: World) {
    const roads: { x1: number; y1: number; x2: number; y2: number; rank: number }[] = [];
    const contOf = (x: number, y: number) => world.continents.find(k => pointInPolygon(x, y, k.polygon))?.id ?? null;
    const byPref = new Map<string, City[]>();
    for (const c of world.cities) { const a = byPref.get(c.prefectureId) ?? []; a.push(c); byPref.set(c.prefectureId, a); }
    const seen = new Set<string>();
    const link = (a: City, b: City) => {
        const key = a.id < b.id ? a.id + b.id : b.id + a.id;
        if (seen.has(key)) return; seen.add(key);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 520 || d < 30) return;
        const ca = contOf(a.x, a.y), cb = contOf(b.x, b.y), cm = contOf((a.x + b.x) / 2, (a.y + b.y) / 2);
        if (!ca || ca !== cb || ca !== cm) return;
        roads.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, rank: Math.max(TIER_RANK[a.tier], TIER_RANK[b.tier]) });
    };
    for (const list of byPref.values()) {
        for (const c of list) {
            const r = TIER_RANK[c.tier];
            if (r === 0) continue;
            let best: City | null = null, bd = Infinity;
            for (const o of list) { if (o === c || TIER_RANK[o.tier] >= r) continue; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bd) { bd = d; best = o; } }
            if (best) link(c, best);
        }
    }
    const caps = world.cities.filter(c => c.tier === 'capital');
    for (const c of caps) {
        let best: City | null = null, bd = Infinity;
        for (const o of caps) { if (o === c) continue; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bd) { bd = d; best = o; } }
        if (best) link(c, best);
    }
    const rng = mulberry32(world.seed ^ 0x7157);
    const rivers: string[] = [];
    for (const k of world.continents) {
        const xs = k.polygon.map(p => p[0]), ys = k.polygon.map(p => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        let made = 0;
        for (let t = 0; t < 400 && made < 5; t++) {
            const sx = x0 + rng() * (x1 - x0), sy = y0 + rng() * (y1 - y0);
            if (!pointInPolygon(sx, sy, k.polygon)) continue;
            let bx = 0, by = 0, bd = Infinity;
            for (const [px, py] of k.polygon) { const d = Math.hypot(px - sx, py - sy); if (d < bd) { bd = d; bx = px; by = py; } }
            if (bd < 160 || bd > 700) continue;
            const n = 7; const pts: [number, number][] = [];
            const nx = -(by - sy) / bd, ny = (bx - sx) / bd;
            let ok = true;
            for (let i = 0; i <= n; i++) {
                const f = i / n; const wob = Math.sin(f * 9 + made) * bd * 0.08 * (1 - f * 0.6);
                const px = sx + (bx - sx) * f + nx * wob, py = sy + (by - sy) * f + ny * wob;
                if (i < n && !pointInPolygon(px, py, k.polygon)) { ok = false; break; }
                pts.push([px, py]);
            }
            if (!ok) continue;
            let d = `M${pts[0][0].toFixed(0)} ${pts[0][1].toFixed(0)}`;
            for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0].toFixed(0)} ${pts[i][1].toFixed(0)} ${mx.toFixed(0)} ${my.toFixed(0)}`; }
            d += ` L${pts[n][0].toFixed(0)} ${pts[n][1].toFixed(0)}`;
            rivers.push(d); made++;
        }
    }
    return { roads, rivers };
}

const TIER_R: Record<string, number> = { village: 6, town: 9, city: 13, capital: 18, market: 15 };
// Icon size as a fraction of the visible map width: constant on-screen size at every zoom.
const ICON_F: Record<string, number> = { village: 0.05, town: 0.056, city: 0.064, capital: 0.088, market: 0.072 };
const ICON_THR: Record<string, number> = { village: 380, town: 650, city: 1100, market: 1800, capital: 3200 };
const PREF_TINTS = ['rgba(255,184,77,0.05)', 'rgba(127,224,192,0.05)', 'rgba(147,165,255,0.06)', 'rgba(255,147,147,0.05)', 'rgba(224,196,127,0.06)'];

const SEASON_TINT = { spring: 'rgba(110,170,100,0.09)', summer: 'rgba(255,214,120,0.06)', autumn: 'rgba(196,112,40,0.13)', winter: 'rgba(150,190,225,0.15)' } as const;
// Wisps of mist drifting over open water: [cx, cy, rx, ry, drift seconds].
const MISTS: [number, number, number, number, number][] = [
    [900, 600, 620, 190, 95], [2600, 900, 700, 210, 120], [4300, 520, 600, 180, 105], [6500, 800, 680, 200, 130],
    [1500, 2300, 640, 200, 110], [3400, 2700, 720, 220, 90], [5600, 2500, 650, 190, 125], [7100, 2200, 600, 180, 100],
    [1000, 4300, 700, 200, 115], [2900, 4600, 640, 190, 98], [4800, 4400, 720, 210, 128], [6700, 4500, 640, 190, 108],
];

export const MapView = React.memo(MapViewInner);
function MapViewInner({ world, locationId, travelingToId, selectedId, onSelect, season = 'spring', year = 0 }: Props) {
    const [showKey, setShowKey] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [realms, setRealms] = useState(false);
    const [q, setQ] = useState('');
    const [aspect, setAspect] = useState(ASPECT_DEFAULT);
    const ASPECT = aspect;
    const maxW = Math.min(world.width + 120, (world.height + 700) * aspect);
    const [view, setView] = useState(() => (DEMO_INITIAL_VIEW ?? {
        x: (world.width - 5000) / 2, y: (world.height - 5000 / ASPECT) / 2, w: 5000,
    }));
    const svgRef = useRef<SVGSVGElement | null>(null);
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 50 && r.height > 50) setAspect(a => (Math.abs(a - r.width / r.height) > 0.01 ? r.width / r.height : a)); };
        measure();
        let fitted = false;
        const fit = () => {
            if (fitted) return;
            const r = el.getBoundingClientRect();
            if (r.width < 50 || r.height < 200) return;
            fitted = true;
            const asp = r.width / r.height;
            const mw = Math.min(world.width + 120, (world.height + 700) * asp);
            const w = Math.min(mw, 2800);
            const hh = w / asp;
            const home = locationId ? world.cityById.get(locationId) : null;
            const cx = home ? home.x : world.width / 2, cy = home ? home.y : world.height / 2;
            setView({ w, x: Math.min(Math.max(cx - w / 2, -350), world.width - w + 350), y: Math.min(Math.max(cy - hh / 2, -350), world.height - hh + 350) });
        };
        fit();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { measure(); fit(); }) : null;
        ro?.observe(el);
        window.addEventListener('resize', measure);
        return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
    }, []);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const dragStart = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean } | null>(null);
    const pinchStart = useRef<{ dist: number; w: number; cx: number; cy: number } | null>(null);
    const viewRef = useRef(view);
    const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    if (commitTimer.current === null) viewRef.current = view;
    // During a drag or pinch the viewBox moves directly on the element (cheap); React re-renders the heavy label layers only a few times a second and once more when the finger lifts.
    const setViewLive = (v: { x: number; y: number; w: number }) => {
        viewRef.current = v;
        svgRef.current?.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.w / ASPECT}`);
        if (commitTimer.current === null) commitTimer.current = setTimeout(() => { commitTimer.current = null; setView(viewRef.current); }, 160);
    };
    const flushView = () => { if (commitTimer.current !== null) { clearTimeout(commitTimer.current); commitTimer.current = null; setView(viewRef.current); } };
    useEffect(() => () => { if (commitTimer.current !== null) clearTimeout(commitTimer.current); }, []);

    const h = view.w / ASPECT;

    const clampView = (v: { x: number; y: number; w: number }) => {
        const w = Math.min(Math.max(v.w, MIN_W), maxW);
        const hh = w / ASPECT;
        return {
            w,
            x: Math.min(Math.max(v.x, -350), world.width - w + 350),
            y: Math.min(Math.max(v.y, -350), world.height - hh + 350),
        };
    };

    const toWorld = (clientX: number, clientY: number): [number, number] => {
        const rect = svgRef.current!.getBoundingClientRect();
        const v = viewRef.current;
        return [
            v.x + ((clientX - rect.left) / rect.width) * v.w,
            v.y + ((clientY - rect.top) / rect.height) * (v.w / ASPECT),
        ];
    };

    const zoomAt = (clientX: number, clientY: number, factor: number) => {
        const [wx, wy] = toWorld(clientX, clientY);
        const v = viewRef.current;
        const w2 = Math.min(Math.max(v.w * factor, MIN_W), maxW);
        const scale = w2 / v.w;
        setView(clampView({ x: wx - (wx - v.x) * scale, y: wy - (wy - v.y) * scale, w: w2 }));
    };

    const onPointerDown = (e: React.PointerEvent) => {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 1) {
            dragStart.current = { px: e.clientX, py: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
            pinchStart.current = null;
        } else if (pointers.current.size === 2) {
            dragStart.current = null;
            const pts = [...pointers.current.values()];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            pinchStart.current = { dist, w: viewRef.current.w, cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
        }
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && pinchStart.current) {
            const pts = [...pointers.current.values()];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const factor = pinchStart.current.dist / Math.max(dist, 20);
            const cx = (pts[0].x + pts[1].x) / 2;
            const cy = (pts[0].y + pts[1].y) / 2;
            const v = viewRef.current;
            const w2 = Math.min(Math.max(pinchStart.current.w * factor, MIN_W), maxW);
            const scale = w2 / v.w;
            // Zoom around the pinch midpoint in world units.
            const [mx, my] = toWorld(cx, cy);
            setViewLive(clampView({ x: mx - (mx - v.x) * scale, y: my - (my - v.y) * scale, w: w2 }));
            return;
        }
        if (dragStart.current && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const v = viewRef.current;
            const dx = ((e.clientX - dragStart.current.px) / rect.width) * v.w;
            const dy = ((e.clientY - dragStart.current.py) / rect.height) * (v.w / ASPECT);
            if (Math.abs(e.clientX - dragStart.current.px) + Math.abs(e.clientY - dragStart.current.py) > 8) dragStart.current.moved = true;
            setViewLive(clampView({ x: dragStart.current.vx - dx, y: dragStart.current.vy - dy, w: v.w }));
        }
    };

    const onPointerUp = (e: React.PointerEvent) => {
        const wasDrag = dragStart.current?.moved ?? true;
        pointers.current.delete(e.pointerId);
        flushView();
        if (pointers.current.size < 2) pinchStart.current = null;
        if (pointers.current.size === 0) {
            dragStart.current = null;
            if (wasDrag) return;
            const [wx, wy] = toWorld(e.clientX, e.clientY);
            let best: City | null = null;
            let bestD = Infinity;
            const hitR = Math.max(viewRef.current.w * 0.045, 24);
            for (const c of world.cities) {
                const d = Math.hypot(c.x - wx, c.y - wy) - Math.max(TIER_R[c.tier], viewRef.current.w * 0.03);
                if (d < hitR && d < bestD) { best = c; bestD = d; }
            }
            onSelect(best);
        }
    };

    // Wheel zoom (non-passive so the page does not scroll).
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            e.preventDefault();
            zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.25 : 0.8);
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    const zoomButton = (factor: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    };

    // Zoom tiers: one label family per band so layers never compete.
    // world: continents+seas | 4800..1800: prefectures | 1800..800: countries+capitals | <1000: cities
    const showWorld = view.w >= 4800;
    const showPrefectures = view.w < 4800;
    const showPrefLabels = view.w >= 1800 && view.w < 4800;
    const showCountries = view.w < 1800;
    const showCountryLabels = view.w >= 800 && view.w < 1800;
    const showCityDots = true;
    // Icons appear by tier as you zoom in, so no zoom level is crowded.
    const iconTier = (t: string) => (t === 'capital' ? view.w < 3200 : t === 'market' ? view.w < 1800 : t === 'city' ? view.w < 1100 : t === 'town' ? view.w < 650 : view.w < 380);
    const labelMajorCities = view.w < 1400;   // capitals + market cities
    const labelMidCities = view.w < 700;     // + cities
    const labelTowns = view.w < 420;          // + towns
    const labelAllCities = view.w < 260;      // + villages
    const showForceSeats = view.w < 1800;
    const fs = (k: number) => Math.round(view.w * k * 10) / 10; // constant-screen-size font
    const iconPx = (tier: string) => view.w * (ICON_F[tier] ?? 0.02) * (0.8 + 0.5 * Math.min(1, Math.max(0, 1 - view.w / (ICON_THR[tier] ?? 1000))));
    const ringPad = view.w * 0.007;
    const spanOf = (poly: [number, number][]) => {
        let minX = Infinity;
        let maxX = -Infinity;
        for (const [px] of poly) { if (px < minX) minX = px; if (px > maxX) maxX = px; }
        return maxX - minX;
    };
    const spanOk = (poly: [number, number][], frac: number) => spanOf(poly) >= view.w * frac;

    // Greedy label placer: priority order wins; later colliding labels drop out.
    const placed: number[][] = [];
    const tryPlace = (x: number, y: number, w: number, h: number): boolean => {
        const x0 = x - w / 2;
        const y0 = y - h / 2;
        const x1 = x + w / 2;
        const y1 = y + h / 2;
        for (const p of placed) if (x0 < p[2] && x1 > p[0] && y0 < p[3] && y1 > p[1]) return false;
        placed.push([x0, y0, x1, y1]);
        return true;
    };
    const labelW = (name: string, size: number) => name.length * size * 0.64;
    // SVG text y is the baseline: the ink box runs from about 0.9 size above to 0.3 size below.
    const tryText = (x: number, baseY: number, w: number, size: number) => tryPlace(x, baseY - size * 0.3, w, size * 1.2);
    const placeNear = (x: number, baseY: number, w: number, size: number): { x: number; y: number } | null => {
        const offs: number[][] = [[0, 0], [0, -1.3], [0, 1.3], [-0.5, 0], [0.5, 0], [0, -2.6], [0, 2.6], [-0.5, -1.3], [0.5, 1.3]];
        for (const [ox, oy] of offs) {
            const px = x + ox * w; const py = baseY + oy * size;
            if (tryText(px, py, w, size)) return { x: px, y: py };
        }
        return null;
    };
    const seatOf = useMemo(() => {
        const m = new Map<string, { kind: 'sect' | 'clan'; hegemon: boolean }>();
        for (const f of world.forces) {
            const cur = m.get(f.hqCityId);
            const next = { kind: f.kind, hegemon: f.hegemon };
            if (!cur || (next.hegemon && !cur.hegemon) || (next.kind === 'sect' && cur.kind === 'clan' && !cur.hegemon)) m.set(f.hqCityId, next);
        }
        return m;
    }, [world]);
    // Keep labels out from under the floating zoom/home controls (bottom-right).
    placed.push([view.x + view.w * 0.84, view.y + (view.w / ASPECT) * 0.22, view.x + view.w + 50, view.y + view.w / ASPECT + 50]);

    const selCity = selectedId ? world.cityById.get(selectedId) : null;
    const reveal = useMemo(() => {
        const prefs = new Set<string>(); let country: string | null = null;
        if (selCity) {
            const ps = powerAt(world, year);
            for (const fid of selCity.seatForceIds ?? []) {
                const f = world.forceById.get(fid); if (!f) continue;
                const held = world.prefectures.filter(p => ps.holder[p.id] === fid).map(p => p.id);
                for (const id of (held.length ? held : f.prefectureIds)) prefs.add(id);
            }
            if (selCity.tier === 'capital') country = selCity.countryId;
        }
        return { prefs: [...prefs], country };
    }, [world, selCity, year]);
    const geo = useMemo(() => buildRoadsAndRivers(world), [world]);
    const home = locationId ? world.cityById.get(locationId) : null;
    const borderPaths = useMemo(() => {
        const m = new Map<string, string>();
        const add = (id: string, poly: [number, number][]) => {
            void poly;
            m.set(id, (BORDERS[id] ?? []).map(smoothOpenPath).join(''));
        };
        world.prefectures.forEach(p => add(p.id, p.polygon));
        world.countries.forEach(c => add(c.id, c.polygon));
        return m;
    }, [world]);
    const hView = view.w / ASPECT;
    const inView = (x: number, y: number) =>
        x > view.x - 400 && x < view.x + view.w + 400 && y > view.y - 400 && y < view.y + hView + 400;

    // Icons are obstacles; the player's own city and the selected city always keep their labels.
    const isShown = (c: { id: string; x: number; y: number }) => inView(c.x, c.y) || c.id === locationId || c.id === selectedId || c.id === travelingToId;
    if (!showWorld) {
        for (const c of world.cities) {
            if (!isShown(c) || !iconTier(c.tier)) continue;
            const sz = iconPx(c.tier);
            placed.push([c.x - sz * 0.55, c.y - sz * (seatOf.has(c.id) ? 0.95 : 0.68), c.x + sz * 0.55, c.y + sz * 0.52]);
        }
        const forcedSize = fs(0.036);
        for (const id of [locationId, selectedId]) {
            const c = id ? world.cityById.get(id) : null;
            if (!c) continue;
            const w = labelW(c.name, forcedSize);
            const by = c.y + iconPx(c.tier) * 0.52 + forcedSize * 1.05;
            placed.push([c.x - w / 2, by - forcedSize * 0.9, c.x + w / 2, by + forcedSize * 0.3]);
        }
    }
    // ---- Label layout pre-pass: one family per zoom band, greedy de-collision ----
    const continentLabels: { id: string; x: number; y: number; lines: string[]; size: number }[] = [];
    const seaLabelIds = new Set<string>();
    if (showWorld) {
        world.continents.forEach((c, i) => {
            const words = c.name.split(' ');
            let mid = Math.ceil(words.length / 2);
            if (words.length > 2) {
                // Split where the two lines are most balanced in width.
                let best = Infinity;
                for (let k = 1; k < words.length; k++) {
                    const a = words.slice(0, k).join(' ').length;
                    const b = words.slice(k).join(' ').length;
                    if (Math.max(a, b) < best) { best = Math.max(a, b); mid = k; }
                }
            }
            const two = words.length > 2;
            const lines = two ? [words.slice(0, mid).join(' '), words.slice(mid).join(' ')] : [c.name];
            const size = fs(0.05);
            const wpx = Math.max(...lines.map(l => l.length)) * size * 0.66;
            const hpx = two ? size * 2.15 : size * 1.2;
            const stagger = (i % 2 === 0 ? -1 : 1) * view.w * 0.022;
            const y = c.centroid[1] + stagger;
            if (tryPlace(c.centroid[0], y, wpx, hpx) || tryPlace(c.centroid[0], c.centroid[1], wpx, hpx)) {
                const yy = placed[placed.length - 1];
                continentLabels.push({ id: c.id, x: c.centroid[0], y: (yy[1] + yy[3]) / 2, lines, size });
            }
        });
        for (const sea of world.seas) {
            const size = fs(0.03);
            if (tryText(sea.x, sea.y, labelW(sea.name, size), size)) seaLabelIds.add(sea.id);
        }
    }
    const prefLabelIds = new Set<string>();
    const prefPos = new Map<string, { x: number; y: number }>();
    const countryPos = new Map<string, { x: number; y: number }>();
    const forceNamePos = new Map<string, { x: number; y: number }>();
    if (showPrefLabels) {
        const size = fs(0.04);
        [...world.prefectures]
            .sort((a, b) => spanOf(b.polygon) - spanOf(a.polygon))
            .forEach(p => {
                if (!spanOk(p.polygon, 0.16)) return;
                const pos = placeNear(p.centroid[0], p.centroid[1], labelW(p.name, size), size);
                if (pos) { prefLabelIds.add(p.id); prefPos.set(p.id, pos); }
            });
    }
    const countryLabelIds = new Set<string>();
    if (showCountryLabels) {
        const size = fs(0.034);
        [...world.countries]
            .sort((a, b) => spanOf(b.polygon) - spanOf(a.polygon))
            .forEach(c => {
                if (!spanOk(c.polygon, 0.13)) return;
                const pos = placeNear(c.centroid[0], c.centroid[1], labelW(c.name, size), size);
                if (pos) { countryLabelIds.add(c.id); countryPos.set(c.id, pos); }
            });
    }
    const cityLabelIds = new Set<string>();
    if (!showWorld) {
        const size = fs(0.036);
        const rank: Record<string, number> = { capital: 0, market: 1, city: 2, town: 3, village: 4 };
        world.cities
            .filter(c =>
                iconTier(c.tier) && ((labelMajorCities && (c.tier === 'capital' || c.tier === 'market'))
                    || (labelMidCities && c.tier === 'city')
                    || (labelTowns && c.tier === 'town')
                    || (labelAllCities && c.tier === 'village'))
                && inView(c.x, c.y))
            .sort((a, b) => rank[a.tier] - rank[b.tier])
            .forEach(c => {
                if (tryText(c.x, c.y + iconPx(c.tier) * 0.52 + size * 1.05, labelW(c.name, size), size)) cityLabelIds.add(c.id);
            });
    }
    if (view.w < 420) {
        const size = fs(0.03);
        for (const f of world.forces) {
            const hq = world.cityById.get(f.hqCityId);
            if (!hq || !inView(hq.x, hq.y)) continue;
            const w = labelW(f.name + (f.hegemon ? ' (hegemon)' : ''), size);
            const x = hq.x + iconPx(hq.tier) * 0.9;
            if (tryText(x + w / 2, hq.y + fs(0.008), w, size)) forceNamePos.set(f.id, { x, y: hq.y + fs(0.008) });
        }
    }
    if (locationId) cityLabelIds.add(locationId);
    if (selectedId) cityLabelIds.add(selectedId);

    return (
        <div className="mapwrap">
            <svg
                ref={svgRef}
                className="map"
                viewBox={`${view.x} ${view.y} ${view.w} ${h}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                role="application"
                aria-label="World map. Drag to explore, pinch or use buttons to zoom, tap a city."
            >
                <rect x={-600} y={-600} width={world.width + 1200} height={world.height + 1200} fill="#0d3240" />
                <image href={MAP_IMAGE_URL} x={0} y={0} width={world.width} height={world.height} preserveAspectRatio="none" />

                {/* Continents come from Zeel's painted art - no procedural blobs. */}

                <defs>
                    <mask id="land-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={world.width} height={world.height}>
                        <image href={LAND_MASK_URL} x={0} y={0} width={world.width} height={world.height} preserveAspectRatio="none" />
                    </mask>
                    <mask id="sea-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={world.width} height={world.height}>
                        <image href={SEA_MASK_URL} x={0} y={0} width={world.width} height={world.height} preserveAspectRatio="none" />
                    </mask>
                    <radialGradient id="mist-grad">
                        <stop offset="0" stopColor="#e6efe9" stopOpacity="0.2" />
                        <stop offset="0.6" stopColor="#e6efe9" stopOpacity="0.07" />
                        <stop offset="1" stopColor="#e6efe9" stopOpacity="0" />
                    </radialGradient>
                </defs>
                <g mask="url(#land-mask)">
                <rect x={0} y={0} width={world.width} height={world.height} fill={SEASON_TINT[season]} className="season-tint" pointerEvents="none" />
                {realms && (() => {
                    const ps = powerAt(world, year);
                    const hue = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
                    return world.prefectures.map(p => {
                        const hid = ps.holder[p.id];
                        if (!hid) return null;
                        const poly = p.polygon;
                        if (!poly.length) return null;
                        const d = 'M' + poly.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L') + 'Z';
                        return <path key={`rt${p.id}`} d={d} fill={`hsla(${hue(hid)},62%,46%,0.30)`} stroke="none" pointerEvents="none" />;
                    });
                })()}
                {/* Prefecture territories */}
                {showPrefectures && world.prefectures.map((p) => (
                    <path key={p.id} d={borderPaths.get(p.id) ?? ''}
                        fill="none" stroke="rgba(8,38,44,0.7)" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                ))}
                {/* Tap a seat: its force territory (and a capital's country) is outlined in gold */}
                {reveal.prefs.map(id => <path key={`rp${id}`} d={borderPaths.get(id) ?? ''} fill="none" stroke="#b8860b" strokeWidth={3.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
                {reveal.country && <path d={borderPaths.get(reveal.country) ?? ''} fill="none" stroke="#8a2f1c" strokeWidth={3.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}

                </g>

                {/* Rivers and roads: thin, only when zoomed in enough, under cities and labels */}
                {view.w < 3200 && geo.rivers.map((d, i) => <path key={`rv${i}`} d={d} fill="none" stroke="#4f93ad" strokeWidth={1.8} strokeLinecap="round" opacity={0.85} vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
                {view.w < 1400 && geo.roads.filter(r => r.rank <= (view.w < 800 ? 3 : view.w < 1100 ? 2 : 1) && inView((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2)).map((r, i) => <line key={`rd${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#7a5a30" strokeWidth={1.3} strokeDasharray="1 4" strokeLinecap="round" opacity={0.75} vectorEffect="non-scaling-stroke" pointerEvents="none" />)}

                {/* Region labels (de-collided in the pre-pass above) */}
                {showWorld && continentLabels.map(l => (
                    <text key={l.id} x={l.x} y={l.y} className="map-continent" textAnchor="middle" fontSize={l.size}>
                        {l.lines.length > 1
                            ? (<><tspan x={l.x} dy={-l.size * 0.62}>{l.lines[0]}</tspan><tspan x={l.x} dy={l.size * 1.33}>{l.lines[1]}</tspan></>)
                            : l.lines[0]}
                    </text>
                ))}
                {showWorld && world.seas.map(sea => seaLabelIds.has(sea.id) && (
                    <text key={sea.id} x={sea.x} y={sea.y} className="map-sea" textAnchor="middle" fontSize={fs(0.03)}>{sea.name}</text>
                ))}
                {showPrefLabels && world.prefectures.map(p => prefPos.has(p.id) && (
                    <text key={p.id} x={prefPos.get(p.id)!.x} y={prefPos.get(p.id)!.y} className="map-prefecture" textAnchor="middle" fontSize={fs(0.04)}>{p.name.replace(' Prefecture', '')}</text>
                ))}
                {showCountryLabels && world.countries.map(c => countryPos.has(c.id) && (
                    <text key={c.id} x={countryPos.get(c.id)!.x} y={countryPos.get(c.id)!.y} className="map-country" textAnchor="middle" fontSize={fs(0.034)}>{c.name}</text>
                ))}

                {/* Cities */}
                {showCityDots && world.cities.map(c => {
                    if ((showWorld && c.id !== locationId) || (!iconTier(c.tier) && c.id !== locationId && c.id !== selectedId && c.id !== travelingToId)) return null;
                    if (!showWorld && !inView(c.x, c.y) && c.id !== locationId && c.id !== selectedId && c.id !== travelingToId) return null;
                    const r = iconPx(c.tier) / 2;
                    const seat = seatOf.get(c.id);
                    const isSel = c.id === selectedId;
                    const isHere = c.id === locationId;
                    const isDest = c.id === travelingToId;
                    const labeled = cityLabelIds.has(c.id);
                    return (
                        <g key={c.id}>
                            {isHere && <circle cx={c.x} cy={c.y} r={r + ringPad * 2} fill="none" stroke="#8fbfae" strokeWidth={3} vectorEffect="non-scaling-stroke" className="pulse" />}
                            {isDest && <circle cx={c.x} cy={c.y} r={r + ringPad * 2} fill="none" stroke="#d08a5e" strokeWidth={3} vectorEffect="non-scaling-stroke" strokeDasharray="10 8" />}
                            {isSel && <circle cx={c.x} cy={c.y} r={r + ringPad} fill="none" stroke="#e8e2d0" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
                            <g transform={`translate(${c.x} ${c.y})`}><TierGlyph tier={c.tier} size={r * 2} seat={seat?.kind ?? null} hegemon={seat?.hegemon} /></g>
                            {labeled && <text x={c.x} y={c.y + r * 1.04 + fs(0.036) * 1.05} className="map-city" textAnchor="middle" fontSize={fs(0.036)}>{c.name}</text>}
                        </g>
                    );
                })}

                {/* Caravan lanterns on short overland routes */}
                {/* Caravan motes removed: SMIL animation repainted the whole map every frame on phones. */}

                {/* Force names (the seat itself is shown on the settlement icon) */}
                {world.forces.map(f => forceNamePos.has(f.id) && (
                    <text key={f.id} x={forceNamePos.get(f.id)!.x} y={forceNamePos.get(f.id)!.y} className="map-force" fontSize={fs(0.03)}>{f.name}{f.hegemon ? ' (hegemon)' : ''}</text>
                ))}
            </svg>
            <div className="map-zoom">
                <button type="button" onClick={() => zoomButton(0.7)} aria-label="Zoom in">+</button>
                <button type="button" onClick={() => zoomButton(1.43)} aria-label="Zoom out">−</button>
                <button type="button" onClick={() => setView(clampView((() => { const w0 = maxW; return { x: world.width / 2 - w0 / 2, y: world.height / 2 - w0 / ASPECT / 2, w: w0 }; })()))} aria-label="See the whole world">🌍</button>
                {home && <button type="button" onClick={() => setView(clampView({ x: home.x - 500, y: home.y - 500 / ASPECT, w: 1000 }))} aria-label="Go home">🏠</button>}
            </div>
            <button type="button" className={`map-realms-btn${realms ? ' on' : ''}`} aria-label="Show who holds each region" aria-pressed={realms} onClick={() => setRealms(r => !r)}>🏯</button>
            <button type="button" className="map-search-btn" aria-label="Search places" onClick={() => { setSearchOpen(o => !o); setQ(''); }}>🔍</button>
            {searchOpen && (
                <div className="map-search">
                    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Find a city, town or village" aria-label="Search places" />
                    {q.trim().length >= 2 && (() => {
                        const ql = q.trim().toLowerCase();
                        const rank: Record<string, number> = { capital: 0, market: 1, city: 2, town: 3, village: 4 };
                        const hits = world.cities.filter(c => c.name.toLowerCase().includes(ql)).sort((a, b) => (a.name.toLowerCase().startsWith(ql) ? 0 : 1) - (b.name.toLowerCase().startsWith(ql) ? 0 : 1) || rank[a.tier] - rank[b.tier]).slice(0, 6);
                        return hits.length === 0 ? <p className="dim">No place by that name.</p> : hits.map(c => (
                            <button type="button" key={c.id} onClick={() => { setSearchOpen(false); const w = Math.min(maxW, 520); setView(clampView({ x: c.x - w / 2, y: c.y - w / ASPECT / 2, w })); onSelect(c); }}>
                                <b>{c.name}</b><span>{c.tier === 'market' ? 'market city' : c.tier} · {c.prefecture}</span>
                            </button>
                        ));
                    })()}
                </div>
            )}
            <button type="button" className="map-info" aria-label="Map key" onClick={() => setShowKey(k => !k)}>{showKey ? '✕' : 'i'}</button>
            {showKey && (
                <div className="map-key" onClick={() => setShowKey(false)}>
                    <b>Places</b>
                    {(['capital', 'city', 'town', 'village'] as const).map(t => (
                        <span key={t}><svg width="17" height="17" viewBox="-12 -12 24 24"><TierGlyph tier={t} size={22} /></svg> {t[0].toUpperCase() + t.slice(1)}</span>
                    ))}
                    <b>Seats</b>
                    <span><svg width="19" height="19" viewBox="-12 -14 24 26"><TierGlyph tier="city" size={20} seat="sect" /></svg> Sect</span>
                    <span><svg width="19" height="19" viewBox="-12 -14 24 26"><TierGlyph tier="city" size={20} seat="clan" /></svg> Clan</span>
                    <span><svg width="19" height="19" viewBox="-12 -14 24 26"><TierGlyph tier="city" size={20} seat="sect" hegemon /></svg> Hegemon</span>
                    <b>Colours</b>
                    <span style={{ fontSize: 12, color: "#a9bcb4" }}>🏯 button: tint each region by the force that holds it</span>
                    <b>Lines</b>
                    <span><svg width="26" height="8" viewBox="0 0 26 8"><path d="M0 4 H26" stroke="#6f9a96" strokeWidth="1.6" /></svg> Prefecture</span>
                    <span><svg width="26" height="8" viewBox="0 0 26 8"><path d="M0 4 Q6 0 13 4 T26 4" fill="none" stroke="#4f93ad" strokeWidth="1.8" /></svg> River</span>
                    <span><svg width="26" height="8" viewBox="0 0 26 8"><path d="M0 4 H26" stroke="#7a5a30" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" /></svg> Road</span>
                </div>
            )}
        </div>
    );
}
