// A living world: powers rise and fall, cities prosper and wane, and news and rumors drift through the log.
// Everything is a deterministic function of (life, time), so a reload never rewrites history.
import type { SaveGame } from './state';
import type { City, Force, World } from './world';
import { REALMS, SURNAMES, GIVEN_NAMES } from './data';
import { REALM_KINDS, realmHere } from './economy';
import { warNews, territoriesOf } from './war';
import { A } from './grammar';

function hash(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
    return h >>> 0;
}
const unit = (s: string) => (hash(s) % 100000) / 100000;
const pick = <T,>(arr: T[], s: string): T => arr[hash(s) % arr.length];

// Each life walks its own timeline through the same map.
export function lifeSalt(save: SaveGame): string { return `${save.char.given}${save.char.surname}${save.char.luck}${save.lineage?.gen ?? 0}`; }
export const yearsOf = (days: number) => days / 360;

// ---- Forces: sway 0..1 with a slow rise and fall ----------------------------------
export function swayAt(save: SaveGame, f: Force, years: number): number {
    const salt = lifeSalt(save);
    const p1 = 60 + unit(`${f.id}p1`) * 140, p2 = 17 + unit(`${f.id}p2`) * 30;
    const ph1 = unit(`${f.id}${salt}a`) * 6.283, ph2 = unit(`${f.id}${salt}b`) * 6.283;
    const base = f.hegemon ? 0.68 : f.kind === 'sect' ? 0.5 : 0.44;
    const v = base + 0.2 * Math.sin(years / p1 * 6.283 + ph1) + 0.08 * Math.sin(years / p2 * 6.283 + ph2);
    return Math.max(0.05, Math.min(0.98, v));
}
const SWAY_WORDS = ['overshadowed', 'minor', 'respected', 'powerful', 'dominant'];
export function holdingsAt(world: World, f: Force, year: number): number {
    return territoriesOf(world, f.id, Math.floor(year)).length;
}
const warBonus = (n: number) => n === 0 ? -0.12 : Math.min(0.25, n * 0.035);
export function swayState(save: SaveGame, f: Force, world?: World): { word: string; arrow: '▲' | '▼' | '▬'; trend: 'rising' | 'falling' | 'steady'; holdings: number | null } {
    const y = yearsOf(save.clockDays), y0 = Math.max(0, y - 6);
    const hN = world ? holdingsAt(world, f, y) : null, h0 = world ? holdingsAt(world, f, y0) : null;
    const now = Math.max(0.05, Math.min(0.98, swayAt(save, f, y) + (hN === null ? 0 : warBonus(hN))));
    const before = Math.max(0.05, Math.min(0.98, swayAt(save, f, y0) + (h0 === null ? 0 : warBonus(h0))));
    const word = SWAY_WORDS[Math.min(4, Math.floor(now * 5))];
    const d = now - before;
    return d > 0.02 ? { word, arrow: '▲', trend: 'rising', holdings: hN } : d < -0.02 ? { word, arrow: '▼', trend: 'falling', holdings: hN } : { word, arrow: '▬', trend: 'steady', holdings: hN };
}

// ---- Cities: fortune -1..1 ----------------------------------------------------------
export function fortuneAt(save: SaveGame, c: City, years: number): number {
    const salt = lifeSalt(save);
    const p = 25 + unit(`${c.id}fp`) * 70, ph = unit(`${c.id}${salt}fh`) * 6.283;
    const tierBias = c.tier === 'capital' ? 0.25 : c.tier === 'market' ? 0.15 : 0;
    return Math.max(-1, Math.min(1, tierBias + 0.85 * Math.sin(years / p * 6.283 + ph)));
}
export function fortuneState(save: SaveGame, c: City): { word: string; icon: string } {
    const y = yearsOf(save.clockDays);
    const f = fortuneAt(save, c, y), d = f - fortuneAt(save, c, Math.max(0, y - 4));
    if (f > 0.55) return { word: d < -0.03 ? 'prosperous, past its peak' : 'thriving', icon: '📈' };
    if (f > 0.15) return { word: d < -0.03 ? 'comfortable but cooling' : 'prosperous', icon: '🏮' };
    if (f > -0.25) return { word: d > 0.03 ? 'recovering' : 'steady', icon: '🏘️' };
    if (f > -0.6) return { word: d > 0.03 ? 'slowly mending' : 'strained', icon: '🌫️' };
    return { word: 'declining', icon: '📉' };
}

// ---- News: at most one ambient event per month --------------------------------------
export interface WorldEvent { kind: 'tournament' | 'realm' | 'npc' | 'hegemon' | 'sway' | 'city'; text: string; forecast?: string }

function npcName(s: string) { return `${pick(SURNAMES, s + 'sn')} ${pick(GIVEN_NAMES, s + 'gn')}`; }

export function eventForMonth(world: World, save: SaveGame, m: number): WorldEvent | null {
    const salt = lifeSalt(save);
    const key = `${salt}|ev|${m}`;
    if (unit(key) > 0.42) return null;
    const years = (m * 30) / 360;
    const kind = pick(['tournament', 'realm', 'npc', 'hegemon', 'sway', 'city', 'city'] as const, key + 'k');
    const forces = world.forces;
    const f = pick(forces, key + 'f');
    const hq = world.cityById.get(f.hqCityId);
    const place = hq?.name ?? 'the mountains';
    switch (kind) {
        case 'tournament': {
            const sects = forces.filter(x => x.kind === 'sect');
            const s = pick(sects, key + 's');
            const c = world.cityById.get(s.hqCityId);
            return { kind, text: `⚔️ The ${s.name} has thrown open its gates at ${c?.name ?? 'its mountain'} for a sect tournament. Young disciples gather from across ${c?.continent ?? 'the land'}.`,
                forecast: `the ${s.name} will hold a sect tournament at ${c?.name ?? 'its mountain'}` };
        }
        case 'realm': {
            const pref = pick(world.prefectures, key + 'p');
            const rk = pick(REALM_KINDS, key + 'r');
            return { kind, text: `🗝️ ${A(rk.name.toLowerCase()).replace(/^a/, 'A')} has been discovered in ${pref.name}. Cultivators are already racing toward it.`, forecast: `${A(rk.name.toLowerCase())} stirs in ${pref.name}` };
        }
        case 'npc': {
            const r = Math.min(11, 2 + Math.floor(Math.log2(1 + years / 12)) + (hash(key + 'rr') % 2));
            const nm = npcName(key);
            return { kind, text: `🌩️ ${nm}, an elder of the ${f.name}, has broken through to the ${REALMS[r]} realm. The sky over ${place} ran with lightning for three nights.` };
        }
        case 'hegemon': {
            const hs = forces.filter(x => x.hegemon);
            if (hs.length < 2) return null;
            const a = pick(hs, key + 'h1');
            const sameCont = hs.filter(x => x.id !== a.id && world.cityById.get(x.hqCityId)?.continentId === world.cityById.get(a.hqCityId)?.continentId);
            const b = sameCont.length ? pick(sameCont, key + 'h2') : pick(hs.filter(x => x.id !== a.id), key + 'h2');
            const t = pick(['signed a truce', 'traded envoys and insults', 'clashed over a mountain pass', 'quietly closed their borders to each other', 'agreed to share a spirit vein'], key + 'ht');
            return { kind, text: `👑 The hegemons ${a.name} and ${b.name} have ${t}.` };
        }
        case 'sway': {
            const pref = pick(world.prefectures, key + 'sp');
            const up = unit(key + 'su') < 0.5;
            return { kind, text: `${up ? '📈' : '📉'} The ${f.name} has ${up ? 'gained ground' : 'lost ground'} in ${pref.name}${up ? ', and its banners now fly in the markets' : ', and rivals circle its holdings'}.` };
        }
        default: {
            const c = pick(world.cities.filter(x => x.tier !== 'village'), key + 'c');
            const t = pick([
                `🌾 A bumper harvest fills the granaries of ${c.name}.`, `🏮 ${c.name} holds its lantern festival; the streets are full till dawn.`,
                `🐺 Beast tides have hit the roads near ${c.name}. Caravans wait for escorts.`, `🌧️ Floods have cut the roads to ${c.name}.`,
                `🕯️ Sickness runs through ${c.name}. Healers are charging a fortune.`, `🪙 A rich spirit vein was struck outside ${c.name}. Merchants are moving in.`,
            ], key + 'ct');
            return { kind, text: t };
        }
    }
}

// News newly reached in (fromDay, toDay]. At most 2 are surfaced so long jumps do not flood the log.
export interface NewsItem { d: number; t: string; k: string }
export function newsItems(world: World, save: SaveGame, fromDay: number, toDay: number, max = 8): NewsItem[] {
    const m0 = Math.floor(fromDay / 30), m1 = Math.floor(toDay / 30);
    if (m1 <= m0) return [];
    const out: NewsItem[] = [];
    const y0 = Math.floor(fromDay / 360), y1 = Math.floor(toDay / 360);
    if (y1 > y0) for (const w of warNews(world, Math.max(y0, y1 - 25), y1).slice(-max)) out.push({ d: w.year * 360, t: w.text, k: w.kind });
    for (let m = m1; m > m0 && out.length < max && m > m1 - 120; m--) {
        const e = eventForMonth(world, save, m);
        if (e) out.push({ d: m * 30, t: e.text, k: e.kind });
    }
    return out.sort((a, b) => b.d - a.d).slice(0, max).reverse(); // oldest first
}
export function newsBetween(world: World, save: SaveGame, fromDay: number, toDay: number): string[] {
    return newsItems(world, save, fromDay, toDay, 2).map(n => n.t);
}

// ---- Rumors in the market --------------------------------------------------------------
export function rumorsAt(world: World, save: SaveGame, city: City): string[] {
    const m = Math.floor(save.clockDays / 30);
    const out: string[] = [];
    // True forecasts: upcoming tournaments, discoveries.
    for (let k = 1; k <= 4 && out.length < 1; k++) {
        const e = eventForMonth(world, save, m + k);
        if (e?.forecast) out.push(`💬 A tea-house storyteller swears ${e.forecast} within ${k === 1 ? 'the month' : `${k} months`}.`);
    }
    // Power of the region.
    const pref = world.prefectureById.get(city.prefectureId);
    const fids = pref?.forceIds ?? [];
    if (fids.length) {
        const f = world.forceById.get(fids[hash(`${city.id}${m}pf`) % fids.length]);
        if (f) {
            const st = swayState(save, f, world);
            out.push(st.trend === 'rising' ? `💬 Merchants say the ${f.name} is on the rise in ${city.prefecture}. Their buyers pay well.`
                : st.trend === 'falling' ? `💬 Whispers in ${city.name}: the ${f.name} is losing its grip on ${city.prefecture}.`
                : `💬 The ${f.name} still holds ${city.prefecture}, and nobody dares say otherwise.`);
        }
    }
    // A neighbouring realm, which is true right now.
    const near = world.prefectures.filter(p => p.id !== city.prefectureId && world.cityById.get(p.capitalId)?.continentId === city.continentId);
    if (near.length) {
        const p = near[hash(`${city.id}${m}rr`) % near.length];
        const o = realmHere(save, p.name);
        out.push(o.open ? `💬 Hunters back from ${p.name} say ${A(o.kind.name.toLowerCase())} is open this month.` : `💬 The ${o.kind.name.toLowerCase()} in ${p.name} is sealed for now, they say.`);
    }
    // Last month's news, retold.
    const past = eventForMonth(world, save, m) ?? eventForMonth(world, save, m - 1);
    if (past && out.length < 3) out.push(`💬 Everyone is talking about it: ${past.text.replace(/^\S+\s/, '')}`);
    return out.slice(0, 3);
}

export function seasonOf(days: number): 'spring' | 'summer' | 'autumn' | 'winter' {
    const mo = Math.floor((days % 360) / 30);
    return mo < 3 ? 'spring' : mo < 6 ? 'summer' : mo < 9 ? 'autumn' : 'winter';
}
export const SEASON_ICON = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' } as const;
