// Geopolitics: forces fight over grudges, territory and prizes. Deterministic replay by year, so history never rewrites.
import type { Force, World, Prefecture } from './world';
import { pointInPolygon } from './world';
import { forceAlignment } from './state';

function hash(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
    return h >>> 0;
}
const u = (s: string) => (hash(s) % 100000) / 100000;
const pick = <T,>(a: T[], s: string): T => a[hash(s) % a.length];

export interface WarEvent { year: number; text: string; kind: 'war' | 'razed' | 'tide' | 'great' | 'prize' | 'grudge' }
export interface PowerState { year: number; holder: Record<string, string>; strength: Record<string, number>; roster: Record<string, number[]>; fallen: Record<string, number>; events: WarEvent[] }

const GRUDGES = [
    'a stolen inheritance manual', 'a murdered young master', 'a broken marriage pact', 'an insult at the alchemy contest',
    'a disciple who defected with a sealed scripture', 'a debt of a thousand spirit stones', 'a plundered ancestral tomb',
    'a rigged tournament', 'an ancestor-level betrayal from nine generations ago', 'a spirit vein both claim',
    'a young master slapped in public', 'a poisoned banquet', 'a stolen fate-changing pill',
];
const PRIZES = [
    'a collapsing immortal ruin', 'a dead Dao Lord\'s heaven-defying inheritance', 'a newly born spirit vein', 'a nine-colored lotus ripening in a hidden valley',
    'a sealed ancient demon tomb', 'a fallen sect\'s treasury', 'a thunder tribulation pond', 'a fragment of an ancient divine weapon', 'a legendary secret realm that opens once per thousand years',
];
const TIDES = [
    'A beast tide pours from the wilds. Ten thousand spirit beasts trample the fields.',
    'A tide of demonic beasts breaks the border formations.',
    'A Nine-Tailed calamity beast awakens and the beasts of the region flee in a stampede.',
    'The sky cracks, and spatial rifts spit out ravenous void beasts.',
    'A dragon-blooded beast king gathers his hordes against the cities.',
];
const WAR_VERBS = ['burns the outer halls of', 'storms the mountain gate of', 'seals the spirit vein of', 'hunts down the elders of', 'drowns the valley seats of'];

// Great wars come every 70-100 years, never on a fixed beat.
const GW = new Set<number>(); let gwLast = 0, gwNext = 0;
function isGreatWarYear(y: number): boolean {
    if (gwNext === 0) gwNext = 35 + (hash('gw|0') % 31);
    while (gwNext <= y) { GW.add(gwNext); gwLast = gwNext; gwNext = gwLast + 70 + (hash(`gw|${gwLast}`) % 31); }
    return GW.has(y);
}
export const ROSTER_REALMS = 15;
const realmW = (r: number) => Math.pow(1.8, r);
export function rosterStrength(r: number[]): number { let t = 0; for (let i = 0; i < r.length; i++) t += r[i] * realmW(i); return t / 12; }
export function rosterCount(r: number[]): number { return r.reduce((a, b) => a + b, 0); }
export function initialRoster(f: Force): number[] {
    const total = f.hegemon ? 1000 + (hash(f.id) % 900) : f.kind === 'sect' ? 150 + (hash(f.id) % 300) : 60 + (hash(f.id) % 160);
    const ceil = f.hegemon ? 9 + (hash(f.id + 'c') % 4) : f.kind === 'sect' ? 5 + (hash(f.id + 'c') % 4) : 3 + (hash(f.id + 'c') % 4);
    const r = new Array(ROSTER_REALMS).fill(0);
    for (let i = 0; i <= ceil; i++) r[i] = total * 0.55 * Math.pow(0.45, i);
    r[ceil] = Math.max(r[ceil], 1); r[ceil - 1] = Math.max(r[ceil - 1], 2);
    return r;
}
export function strengthOf(f: Force): number { return rosterStrength(initialRoster(f)); }
function refresh(st: PowerState, id: string): void { st.strength[id] = rosterStrength(st.roster[id]); }
// Casualties: frac of the roster dies; the strongest cultivators fall least often.
function casualty(st: PowerState, id: string, frac: number): void {
    const r = st.roster[id]; if (!r) return;
    for (let i = 0; i < r.length; i++) r[i] *= 1 - frac * Math.pow(0.88, i);
    refresh(st, id);
}
function growYear(st: PowerState, id: string, f: Force): void {
    const r = st.roster[id]; if (!r || st.fallen[id]) return;
    const init = initialRoster(f); const cap = rosterCount(init) * 1.8; const n = rosterCount(r);
    const ceil = init.reduce((m, v, i) => (v > 0 ? i : m), 0);
    const nr = r.slice();
    for (let i = 0; i < r.length; i++) {
        nr[i] -= r[i] * 0.02;
        if (i < ceil) { const m = r[i] * 0.045 / (1 + i * 0.5); nr[i] -= m; nr[i + 1] += m; }
    }
    nr[0] += 0.045 * Math.max(0, cap - n);
    st.roster[id] = nr; refresh(st, id);
}

function prefContinent(world: World, p: Prefecture): string {
    const c = world.continents.find(k => pointInPolygon(p.centroid[0], p.centroid[1], k.polygon));
    return c?.id ?? 'x';
}

let cacheWorld: World | null = null; let cacheState: PowerState | null = null; let contMap: Map<string, string> | null = null;

function initial(world: World): PowerState {
    const holder: Record<string, string> = {}; const strength: Record<string, number> = {}; const roster: Record<string, number[]> = {};
    for (const f of world.forces) { roster[f.id] = initialRoster(f); strength[f.id] = rosterStrength(roster[f.id]); }
    for (const p of world.prefectures) {
        const ids = p.forceIds.length ? p.forceIds : [];
        if (!ids.length) continue;
        holder[p.id] = ids.slice().sort((a, b) => (strength[b] ?? 0) - (strength[a] ?? 0))[0];
    }
    return { year: 0, holder, strength, roster, fallen: {}, events: [] };
}

function stepYear(world: World, st: PowerState, y: number): void {
    const s = `${world.forces.length}|${y}`;
    const nm = (id: string) => world.forceById.get(id)?.name ?? id;
    const prefs = world.prefectures.filter(p => p.forceIds.length >= 2);
    // Wars of grudge and territory: about 1.5 per year across the world.
    const wars = u(`${s}|nw`) < 0.5 ? 2 : u(`${s}|nw2`) < 0.6 ? 1 : 0;
    for (let k = 0; k < wars && prefs.length; k++) {
        const p = prefs[hash(`${s}|p${k}`) % prefs.length];
        const holderId = st.holder[p.id];
        const rivals = p.forceIds.filter(id => id !== holderId && !st.fallen[id]);
        if (!holderId || !rivals.length) continue;
        const atk = pick(rivals, `${s}|a${k}`);
        const ra = (st.strength[atk] ?? 40) * (0.6 + u(`${s}|ra${k}`) * 0.9), rd = (st.strength[holderId] ?? 40) * (0.6 + u(`${s}|rd${k}`) * 0.9);
        const why = u(`${s}|why${k}`) < 0.5 ? `over ${pick(GRUDGES, `${s}|g${k}`)}` : `for control of ${p.name}`;
        if (ra > rd) {
            st.holder[p.id] = atk;
            casualty(st, atk, 0.08); casualty(st, holderId, 0.3);
            const razed = u(`${s}|rz${k}`) < 0.3;
            st.events.push({ year: y, kind: razed ? 'razed' : 'war', text: `⚔️ ${nm(atk)} ${pick(WAR_VERBS, `${s}|v${k}`)} ${nm(holderId)} ${why} and takes ${p.name}${razed ? ' - the old seats are razed to ash' : ''}.` });
            if (razed) casualty(st, holderId, 0.4);
        } else {
            casualty(st, atk, 0.2);
            if (u(`${s}|gq${k}`) < 0.25) st.events.push({ year: y, kind: 'grudge', text: `🛡️ ${nm(holderId)} holds ${p.name} against ${nm(atk)} ${why}. The attackers retreat bloodied.` });
        }
        // The loser can fall for good if it is ground down.
        const loser = ra > rd ? holderId : atk;
        if ((st.strength[loser] ?? 40) < 14 && !st.fallen[loser]) { st.fallen[loser] = y; st.events.push({ year: y, kind: 'razed', text: `💀 The ${nm(loser)} is wiped out. Its banner falls and its halls stand empty.` }); }
    }
    for (const f of world.forces) growYear(st, f.id, f);
    // Prize wars: secret realms, ruins, inheritances.
    if (u(`${s}|prize`) < 0.35 && prefs.length) {
        const p = prefs[hash(`${s}|pp`) % prefs.length];
        const prize = pick(PRIZES, `${s}|pz`);
        const a = pick(p.forceIds, `${s}|pa`), b = pick(p.forceIds, `${s}|pb`);
        if (a !== b) { const w = (st.strength[a] ?? 40) * (0.5 + u(`${s}|pw`)) > (st.strength[b] ?? 40) * (0.5 + u(`${s}|pw2`)) ? a : b; { const r = st.roster[w]; for (let i = r.length - 2; i >= 0; i--) { const m = r[i] * 0.12; r[i] -= m; r[i + 1] += m; } refresh(st, w); }
            st.events.push({ year: y, kind: 'prize', text: `🏺 ${nm(a)} and ${nm(b)} clash near ${p.name} over ${prize}. ${nm(w)} walks away with it and grows stronger.` }); }
    }
    // Beast tides.
    if (u(`${s}|tide`) < 0.18 && world.prefectures.length) {
        const p = world.prefectures[hash(`${s}|tp`) % world.prefectures.length];
        st.events.push({ year: y, kind: 'tide', text: `🐲 ${pick(TIDES, `${s}|tt`)} ${p.name} suffers.` });
    }
    // Human vs demon great war: every ~70 years, one continent, righteous and demonic sects swap prefectures.
    if (isGreatWarYear(y) && world.continents.length) {
        const cont = world.continents[hash(`${s}|gc`) % world.continents.length];
        const inC = world.prefectures.filter(p => (contMap?.get(p.id) ?? '') === cont.id);
        st.events.push({ year: y, kind: 'great', text: `🔥 The Human-Demon War ignites on ${cont.name}. Righteous and demonic sects march against each other.` });
        const sects = world.forces.filter(f => f.kind === 'sect');
        let flipped = 0;
        for (const p of inC) {
            if (flipped >= 4) break;
            const hid = st.holder[p.id]; const hf = hid ? world.forceById.get(hid) : null;
            if (!hf || hf.kind !== 'sect') continue;
            const wantDemonic = u(`${s}|gw`) < 0.5;
            const opp = p.forceIds.map(id => world.forceById.get(id)!).find(f => f && f.kind === 'sect' && forceAlignment(f) === (wantDemonic ? 'demonic' : 'righteous') && forceAlignment(hf) !== forceAlignment(f));
            if (opp) { st.holder[p.id] = opp.id; flipped++; st.events.push({ year: y, kind: 'war', text: `⚔️ In the great war, ${opp.name} seizes ${p.name} from the ${forceAlignment(hf)} side.` }); }
        }
        void sects;
        st.events.push({ year: y + 4, kind: 'great', text: `🕊️ After four years of blood, the Human-Demon War on ${cont.name} ends in an exhausted truce.` });
    }
}

export function powerAt(world: World, year: number): PowerState {
    if (!contMap || cacheWorld !== world) { contMap = new Map(); for (const p of world.prefectures) contMap.set(p.id, prefContinent(world, p)); }
    if (!cacheState || cacheWorld !== world || cacheState.year > year) { cacheWorld = world; cacheState = initial(world); strengthHist.clear(); strengthHist.set(cacheState.year, { ...cacheState.strength }); }
    const st = cacheState;
    for (let y = st.year + 1; y <= year; y++) {
        stepYear(world, st, y); st.year = y;
        strengthHist.set(y, { ...st.strength }); strengthHist.delete(y - 7);
    }
    return st;
}
const strengthHist = new Map<number, Record<string, number>>();
/** Strength table from `back` years ago (the oldest kept, up to 6), or null when the simulation has no earlier year. */
export function strengthBefore(world: World, year: number, back = 5): Record<string, number> | null {
    powerAt(world, year);
    for (let b = back; b >= 1; b--) { const h = strengthHist.get(year - b); if (h) return h; }
    return null;
}

export function warNews(world: World, fromYear: number, toYear: number): WarEvent[] {
    const st = powerAt(world, toYear);
    return st.events.filter(e => e.year > fromYear && e.year <= toYear);
}
export function territoriesOf(world: World, forceId: string, year: number): Prefecture[] {
    const st = powerAt(world, year);
    return world.prefectures.filter(p => st.holder[p.id] === forceId);
}
