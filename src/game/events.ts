// Random events: hand-written cores plus slots, picked by seed. Data lives in eventData.ts so batches can be added without code changes.
import type { SaveGame } from './state';
import type { World } from './world';
import { SURNAMES, GIVEN_NAMES } from './data';
import { hashSeed, mulberry32 } from './rng';
import { currentCult, cultGain, stageCost } from './cultivation';
import { getEco, addStones, addItem } from './economy';
import { skillLevel } from './craft';
import type { CraftId } from './craft';
import { makeDeath } from './fate';
import { getJobs } from './jobs';
import { getSect } from './sect';
import { sectRankIndex } from './cultivation';
import { EVENT_CORES } from './eventData';
import { lifeSalt } from './living';
import { addKarma, karmaForFlag } from './karma';

export type Role = 'none' | 'sect-low' | 'sect-core' | 'sect-elder' | 'sect-head' | 'clan-member' | 'clan-head';
export interface Cond { roles?: Role[]; align?: 'righteous' | 'demonic'; minRealm?: number; maxRealm?: number; craft?: { id: CraftId; level: number }; minStones?: number; flag?: string; noFlag?: string; root?: number }
export interface Fx {
    stones?: number;      // multiple of the stakes unit (realm scaled); negative = loss
    cult?: number;        // fraction of the current stage (capped by cultGain)
    contrib?: number;     // sect contribution (x10 units)
    luck?: number;        // +/- luck points
    item?: [string, number];
    rep?: number;         // errand standing
    treasury?: number;    // own sect or clan treasury, multiple of the stakes unit
    rootTo?: number;      // rewrite the spiritual root (ultra-rare fate events)
    single?: boolean;     // rewrite affinity to one element
    karma?: number;       // direct karma change (weighted by alignment)
    flag?: string;        // remembered for later events and the karma system
    death?: string;       // fatal outcome text
}
export interface Outcome { text: string; fx?: Fx }
export type Risk = 'safe' | 'risky' | 'deadly';
export interface Choice { label: string; cost?: number; risk?: Risk; check?: number; craft?: CraftId; win: Outcome; lose?: Outcome }
export interface EventCore {
    id: string; title: string; icon: string; family?: string;
    cond: Cond; weight: number; cooldown?: number;
    intro: string[];                          // alternative openings; {npc} {city} {sect} {thing} are filled per seed
    slots?: Record<string, string[]>;         // extra slot pools, referenced as {name}
    choices: Choice[];
    tags?: string[];                          // read later by the karma system
}
export interface Pending { id: string; seed: number }

export const stakesUnit = (save: SaveGame) => Math.round(30 * (1 + currentCult(save).realm * 0.9));

export function roleOf(save: SaveGame, world: World): Role {
    const own = getSect(save);
    if (own) return own.kind === 'clan' ? 'clan-head' : 'sect-head';
    const m = save.membership;
    if (!m) return 'none';
    const f = world.forceById.get(m.forceId);
    const rank = sectRankIndex(save);
    if (f?.kind === 'clan') return rank >= 5 ? 'clan-head' : 'clan-member';
    return rank >= 5 ? 'sect-head' : rank >= 3 ? 'sect-elder' : rank === 2 ? 'sect-core' : 'sect-low';
}

const flags = (s: SaveGame): string[] => (s as any).evflags ?? [];
const cool = (s: SaveGame): Record<string, number> => (s as any).evcd ?? {};
export const pendingOf = (s: SaveGame): Pending[] => (s as any).evq ?? [];

export function eligible(save: SaveGame, world: World, core: EventCore): boolean {
    const c = core.cond, realm = currentCult(save).realm;
    if (c.roles && !c.roles.includes(roleOf(save, world))) return false;
    if (c.align && c.align !== save.char.alignment) return false;
    if (c.minRealm !== undefined && realm < c.minRealm) return false;
    if (c.maxRealm !== undefined && realm > c.maxRealm) return false;
    if (c.craft && skillLevel(save, c.craft.id) < c.craft.level) return false;
    if (c.minStones !== undefined && getEco(save).stones < c.minStones) return false;
    if (c.root !== undefined && save.char.root !== c.root) return false;
    if (c.flag && !flags(save).includes(c.flag)) return false;
    if (c.noFlag && flags(save).includes(c.noFlag)) return false;
    const last = cool(save)[core.id];
    if (last !== undefined && save.clockDays - last < (core.cooldown ?? 3600)) return false;
    return true;
}

export function eligibleCores(save: SaveGame, world: World): EventCore[] { return EVENT_CORES.filter(c => eligible(save, world, c)); }

const MONTHLY: Record<Role, number> = { none: 0.05, 'sect-low': 0.05, 'sect-core': 0.06, 'sect-elder': 0.07, 'sect-head': 0.09, 'clan-member': 0.05, 'clan-head': 0.09 };

export function eventTick(world: World, save: SaveGame, from: number, to: number): SaveGame {
    const m0 = Math.floor(from / 30), m1 = Math.floor(to / 30);
    if (m1 <= m0 || save.dead || save.battle) return save;
    const salt = lifeSalt(save);
    let s = save;
    for (let m = m0 + 1; m <= Math.min(m1, m0 + 6); m++) {
        if (pendingOf(s).length >= 2) break;
        if (s.clockDays - ((s as any).evlast ?? -999) < 120) continue;
        const rng = mulberry32(hashSeed(`${salt}|evt|${m}`));
        const role = roleOf(s, world);
        if (rng() > MONTHLY[role]) continue;
        const pool = eligibleCores(s, world).filter(c => !pendingOf(s).some(p => p.id === c.id));
        if (!pool.length) continue;
        let r = rng() * pool.reduce((a, c) => a + c.weight, 0), core = pool[pool.length - 1];
        for (const c of pool) { r -= c.weight; if (r <= 0) { core = c; break; } }
        s = { ...s, evq: [...pendingOf(s), { id: core.id, seed: hashSeed(`${salt}|${core.id}|${m}`) }], evlast: m * 30 } as SaveGame;
    }
    return s;
}

// ---- Rendering a variant -----------------------------------------------------------------
export interface Rendered { core: EventCore; text: string; unit: number }
function fill(t: string, slots: Record<string, string>) { return t.replace(/\{(\w+)\}/g, (_, k) => slots[k] ?? `{${k}}`); }
export function slotsFor(save: SaveGame, world: World, core: EventCore, seed: number): Record<string, string> {
    const rng = mulberry32(seed), pk = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
    const f = save.membership ? world.forceById.get(save.membership.forceId) : null;
    const own = getSect(save);
    const city = world.cityById.get(save.locationId);
    const out: Record<string, string> = {
        npc: `${pk(SURNAMES)} ${pk(GIVEN_NAMES)}`, npc2: `${pk(SURNAMES)} ${pk(GIVEN_NAMES)}`,
        city: city?.name ?? 'the city', sect: own?.name ?? f?.name ?? 'the sect',
    };
    for (const [k, v] of Object.entries(core.slots ?? {})) out[k] = fill(pk(v), out);
    return out;
}
export function render(save: SaveGame, world: World, p: Pending): Rendered | null {
    const core = EVENT_CORES.find(c => c.id === p.id);
    if (!core) return null;
    const slots = slotsFor(save, world, core, p.seed);
    const rng = mulberry32(p.seed ^ 0x9e37);
    return { core, text: fill(core.intro[Math.floor(rng() * core.intro.length)], slots), unit: stakesUnit(save) };
}
export const fillChoice = (save: SaveGame, world: World, p: Pending, t: string) => {
    const core = EVENT_CORES.find(c => c.id === p.id);
    return core ? fill(t, slotsFor(save, world, core, p.seed)) : t;
};

export function choiceChance(save: SaveGame, ch: Choice): number {
    if (ch.check === undefined) return 1;
    const luck = (save.char.luck - 50) * 0.002;
    const craft = ch.craft ? 0.05 * skillLevel(save, ch.craft) : 0;
    return Math.max(0.05, Math.min(0.95, ch.check + luck + craft));
}
export function canChoose(save: SaveGame, ch: Choice): boolean { return !ch.cost || getEco(save).stones >= ch.cost * stakesUnit(save); }

function applyFx(save: SaveGame, fx: Fx | undefined, unitV: number): SaveGame {
    if (!fx) return save;
    let s = save;
    if (fx.stones) { const n = Math.round(fx.stones * unitV); s = addStones(s, n < 0 ? -Math.min(-n, getEco(s).stones) : n); }
    if (fx.cult) {
        const c = currentCult(s);
        const d = fx.cult > 0 ? cultGain(s, fx.cult, 20) : -Math.floor(stageCost(c.realm, c.stage) * -fx.cult);
        s = { ...s, cult: { ...c, progress: Math.max(0, c.progress + d) } };
    }
    if (fx.contrib && s.rank) s = { ...s, rank: { ...s.rank, contrib: Math.max(0, s.rank.contrib + fx.contrib * 10) } };
    if (fx.luck) s = { ...s, char: { ...s.char, luck: Math.max(1, Math.min(100, s.char.luck + fx.luck)) } };
    if (fx.item) s = addItem(s, fx.item[0], fx.item[1]);
    if (fx.rep) { const js = getJobs(s); s = { ...s, jobs: { ...js, rep: Math.max(0, js.rep + fx.rep) } }; }
    if (fx.treasury) { const o = getSect(s); if (o) s = { ...s, ownSect: { ...o, treasury: Math.max(0, o.treasury + Math.round(fx.treasury * unitV)) } } as SaveGame; }
    if (fx.rootTo !== undefined) s = { ...s, char: { ...s.char, root: fx.rootTo } };
    if (fx.single) { const els = ['metal', 'wood', 'water', 'fire', 'earth']; s = { ...s, char: { ...s.char, affinity: [els[Math.abs(Math.floor(s.clockDays) + s.seed) % 5]], heavenly: undefined } }; }
    if (fx.karma) s = addKarma(s, fx.karma, 'a choice you made');
    if (fx.flag) { const fresh = !flags(s).includes(fx.flag); s = { ...s, evflags: [...new Set([...flags(s), fx.flag])].slice(-80) } as SaveGame; if (fresh) s = karmaForFlag(s, fx.flag); }
    if (fx.death) { const c = currentCult(s); s = { ...s, dead: makeDeath(s, 'ambush', fx.death, c.realm, c.stage), paused: true } as SaveGame; }
    return s;
}

// Applies the chosen outcome and removes the event from the queue. Returns the outcome text for the screen.
export function resolveEvent(save: SaveGame, world: World, p: Pending, choiceIx: number): { save: SaveGame; text: string } {
    const r = render(save, world, p);
    if (!r) return { save: { ...save, evq: pendingOf(save).filter(x => x !== p) } as SaveGame, text: '' };
    const ch = r.core.choices[choiceIx];
    const rng = mulberry32(p.seed ^ (choiceIx + 1) * 7919);
    const won = rng() < choiceChance(save, ch);
    const out = won || !ch.lose ? ch.win : ch.lose;
    let s = save;
    if (ch.cost) { const n = Math.round(ch.cost * r.unit); s = addStones(s, -Math.min(n, getEco(s).stones)); }
    s = applyFx(s, out.fx, r.unit);
    const text = fillChoice(save, world, p, out.text);
    const q = pendingOf(s).filter(x => x.id !== p.id || x.seed !== p.seed);
    s = { ...s, evq: q, evcd: { ...cool(s), [p.id]: s.clockDays } } as SaveGame;
    s = { ...s, log: [`${r.core.icon} ${r.core.title}: ${text}`, ...s.log].slice(0, 30) };
    return { save: s, text };
}
