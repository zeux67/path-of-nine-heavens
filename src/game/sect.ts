// Founding and running your own sect or family dynasty. Strength comes from a real roster of cultivators by realm.
import type { SaveGame } from './state';
import { addStones, getEco } from './economy';
import { powerAt, rosterStrength, rosterCount, ROSTER_REALMS, initialRoster } from './war';
import type { World, Force } from './world';

export interface OwnSect {
    name: string; kind: 'sect' | 'clan'; cityId: string; founded: number;
    roster: number[]; treasury: number; build: Record<string, number>;
    peaceUntil: number; // day until which a peace pact holds
    tribute: number;    // yearly stones paid under a peace pact
    wars: number; wins: number; last: number; events: { d: number; t: string }[];
}
let W: World | null = null;
export const setSectWorld = (w: World) => { W = w; };
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const getSect = (s: SaveGame): OwnSect | null => (s as any).ownSect ?? null;
const put = (s: SaveGame, o: OwnSect): SaveGame => ({ ...s, ownSect: o } as SaveGame);
const stones = (s: SaveGame) => getEco(s).stones;
const realmOf = (s: SaveGame) => s.cult?.realm ?? 0;

export const FOUND_COST = 20000, FOUND_REALM = 5;
export interface Building { id: string; name: string; icon: string; base: number; note: string }
export const BUILDINGS: Building[] = [
    { id: 'gate', name: 'Gate Hall', icon: '⛩️', base: 2000, note: 'More recruits each year and room for stronger experts.' },
    { id: 'library', name: 'Scripture Library', icon: '📜', base: 3000, note: 'Disciples rise in realm faster.' },
    { id: 'vein', name: 'Spirit Vein', icon: '💎', base: 4000, note: 'Stones flow into the treasury each year.' },
    { id: 'forge', name: 'Forge and Pill Hall', icon: '⚒️', base: 3500, note: 'Fewer losses in war and a little extra income.' },
    { id: 'formation', name: 'Guardian Formation', icon: '🛡️', base: 5000, note: 'Raiders and rivals strike less often and less hard.' },
];
export const MAX_BUILD = 5;
export const buildCost = (b: Building, lvl: number) => Math.round(b.base * Math.pow(1.9, lvl));
const lv = (o: OwnSect, id: string) => o.build[id] ?? 0;

export function sectStrength(o: OwnSect): number { return rosterStrength(o.roster); }
export function sectRank(s: SaveGame, o: OwnSect): number {
    if (!W) return 0; const st = powerAt(W, Math.floor(s.clockDays / 360)); const me = sectStrength(o);
    return 1 + W.forces.filter(f => !st.fallen[f.id] && (st.strength[f.id] ?? 0) > me).length;
}
export function foundVerdict(s: SaveGame, cityId: string | null, name: string): string | null {
    if (getSect(s)) return 'You already lead a force.';
    if (realmOf(s) < FOUND_REALM) return `Only a cultivator of realm ${FOUND_REALM} or higher can raise a banner.`;
    if (!cityId) return 'You must stand in a city to found a seat.';
    if (name.trim().length < 3) return 'Give your banner a name of at least 3 letters.';
    if (stones(s) < FOUND_COST) return `Founding costs ${FOUND_COST} stones.`;
    return null;
}
export function foundSect(s: SaveGame, cityId: string, name: string, kind: 'sect' | 'clan'): { save: SaveGame; msg: string } {
    const bad = foundVerdict(s, cityId, name); if (bad) return { save: s, msg: bad };
    const nm = name.trim().slice(0, 28);
    const roster = new Array(ROSTER_REALMS).fill(0); roster[0] = 14; roster[1] = 4; roster[2] = 1;
    const o: OwnSect = { name: nm, kind, cityId, founded: s.clockDays, roster, treasury: 0, build: { gate: 1 }, peaceUntil: 0, tribute: 0, wars: 0, wins: 0, last: s.clockDays, events: [] };
    return { save: put(addStones(s, -FOUND_COST), o), msg: `🏯 You raise the banner of the ${nm}. About twenty hopefuls kneel at your gate.` };
}
export function upgradeBuilding(s: SaveGame, id: string): { save: SaveGame; msg: string } {
    const o = getSect(s), b = BUILDINGS.find(x => x.id === id); if (!o || !b) return { save: s, msg: '' };
    const l = lv(o, id); if (l >= MAX_BUILD) return { save: s, msg: 'Already at its height.' };
    const c = buildCost(b, l); if (o.treasury + stones(s) < c) return { save: s, msg: `Needs ${c} stones (treasury plus purse).` };
    const fromT = Math.min(o.treasury, c); let ns = addStones(s, -(c - fromT));
    return { save: put(ns, { ...o, treasury: o.treasury - fromT, build: { ...o.build, [id]: l + 1 } }), msg: `${b.icon} ${b.name} raised to level ${l + 1}.` };
}
export function depositTreasury(s: SaveGame, n: number): { save: SaveGame; msg: string } {
    const o = getSect(s); if (!o || stones(s) < n || n <= 0) return { save: s, msg: 'Not enough stones.' };
    return { save: put(addStones(s, -n), { ...o, treasury: o.treasury + n }), msg: `You add ${n} stones to the treasury.` };
}
export function cap(o: OwnSect) { return 40 + lv(o, 'gate') * 60 + lv(o, 'gate') * lv(o, 'gate') * 15; }
export const expertCeiling = (o: OwnSect) => 3 + lv(o, 'gate') * 2; // highest realm a sect can host
export const EXPERT_COST = (r: number) => Math.round(800 * Math.pow(1.7, r));

// ---- Master powers ----
export function inviteExpert(s: SaveGame): { save: SaveGame; msg: string } {
    const o = getSect(s); if (!o) return { save: s, msg: '' };
    const r = Math.min(expertCeiling(o), Math.max(2, realmOf(s) - 1)); const c = EXPERT_COST(r);
    if (stones(s) + o.treasury < c) return { save: s, msg: `An expert of realm ${r} wants ${c} stones.` };
    const t = Math.min(o.treasury, c); const roster = o.roster.slice(); roster[r] += 1;
    return { save: put(addStones(s, -(c - t)), { ...o, treasury: o.treasury - t, roster, events: [{ d: s.clockDays, t: `A realm ${r} expert joins as guest elder.` }, ...o.events].slice(0, 12) }), msg: `🧙 A realm ${r} expert accepts your invitation and joins as guest elder (${c} stones).` };
}
export function helpElders(s: SaveGame): { save: SaveGame; msg: string } {
    const o = getSect(s); if (!o) return { save: s, msg: '' };
    const top = o.roster.reduce((m, v, i) => (v >= 1 ? i : m), 0); const c = Math.round(600 * Math.pow(1.6, top));
    if (top >= expertCeiling(o)) return { save: s, msg: 'Your hall cannot hold a stronger elder. Upgrade the Gate Hall.' };
    if (stones(s) + o.treasury < c) return { save: s, msg: `Pills and a vein session for your elders cost ${c} stones.` };
    const t = Math.min(o.treasury, c); const roster = o.roster.slice(); roster[top] -= 1; roster[top + 1] += 1;
    return { save: put(addStones(s, -(c - t)), { ...o, treasury: o.treasury - t, roster, events: [{ d: s.clockDays, t: `Your senior elder breaks through to realm ${top + 1}.` }, ...o.events].slice(0, 12) }), msg: `🌟 You pour pills and vein qi into your senior elder, who breaks through to realm ${top + 1} (${c} stones).` };
}
export function rivalsNear(s: SaveGame, o: OwnSect): { f: Force; str: number }[] {
    if (!W) return []; const st = powerAt(W, Math.floor(s.clockDays / 360)); const city = W.cityById.get(o.cityId); if (!city) return [];
    const mine = sectStrength(o);
    return W.forces.filter(f => !st.fallen[f.id] && !f.hegemon).map(f => ({ f, str: st.strength[f.id] ?? 0, d: Math.hypot((W!.cityById.get(f.hqCityId)?.x ?? 0) - city.x, (W!.cityById.get(f.hqCityId)?.y ?? 0) - city.y) }))
        .sort((a, b) => a.d - b.d).slice(0, 12).sort((a, b) => Math.abs(a.str - mine) - Math.abs(b.str - mine)).slice(0, 4).map(x => ({ f: x.f, str: x.str }));
}
function casualties(o: OwnSect, frac: number): number[] { return o.roster.map((v, i) => v * (1 - frac * Math.pow(0.88, i))); }
export function declareWar(s: SaveGame, fid: string): { save: SaveGame; msg: string } {
    const o = getSect(s); if (!o || !W) return { save: s, msg: '' };
    if (s.clockDays < o.peaceUntil) return { save: s, msg: 'A peace pact still holds. Wait for it to end.' };
    const foe = W.forceById.get(fid); const st = powerAt(W, Math.floor(s.clockDays / 360)); if (!foe) return { save: s, msg: '' };
    const fs = st.strength[fid] ?? 0, ms = sectStrength(o);
    const roll = (k: string) => 0.6 + (hash(`${s.seed}|${s.clockDays}|${fid}|${k}`) % 900) / 1000;
    const win = ms * roll('a') * (1 + lv(o, 'forge') * 0.04) > fs * roll('d');
    const loot = Math.round(fs * (win ? 30 : 0));
    const ro = casualties(o, win ? 0.08 : 0.35 - lv(o, 'formation') * 0.03);
    const ev = { d: s.clockDays, t: win ? `War on ${foe.name}: victory. ${loot} stones of spoils.` : `War on ${foe.name}: defeat. Heavy losses.` };
    return { save: put(s, { ...o, roster: ro, treasury: o.treasury + loot, wars: o.wars + 1, wins: o.wins + (win ? 1 : 0), events: [ev, ...o.events].slice(0, 12) }), msg: win ? `⚔️ Your banners crush the ${foe.name}. ${loot} stones of spoils enter the treasury.` : `⚔️ The ${foe.name} breaks your assault. Your halls mourn their dead.` };
}
export function makePeace(s: SaveGame): { save: SaveGame; msg: string } {
    const o = getSect(s); if (!o) return { save: s, msg: '' };
    const c = Math.round(sectStrength(o) * 12);
    if (stones(s) + o.treasury < c) return { save: s, msg: `A ten-year peace pact costs ${c} stones.` };
    const t = Math.min(o.treasury, c);
    return { save: put(addStones(s, -(c - t)), { ...o, treasury: o.treasury - t, peaceUntil: s.clockDays + 3600, events: [{ d: s.clockDays, t: 'A ten-year peace pact is sworn. Raiders stay away.' }, ...o.events].slice(0, 12) }), msg: `🕊️ Envoys swear a ten-year peace for ${c} stones. Raids will not come.` };
}

// ---- Yearly life ----
const EVENTS: { t: string; fn: (o: OwnSect, s: SaveGame) => OwnSect | null; w: number }[] = [
    { w: 3, t: 'A prodigy arrives at the gate and swears in.', fn: o => { const r = o.roster.slice(); r[Math.min(3, expertCeiling(o))] += 1; return { ...o, roster: r }; } },
    { w: 2, t: 'A caravan of spirit herbs is gifted to the hall.', fn: o => ({ ...o, treasury: o.treasury + 600 + sectStrength(o) * 5 }) },
    { w: 2, t: 'A plague of qi rot thins the outer court.', fn: o => ({ ...o, roster: casualties(o, 0.1) }) },
    { w: 2, t: 'Beast tide at the foothills. Disciples hold the line.', fn: o => ({ ...o, roster: casualties(o, 0.05), treasury: o.treasury + 300 }) },
    { w: 2, t: 'A traitor steals from the treasury.', fn: o => ({ ...o, treasury: Math.floor(o.treasury * 0.85) }) },
    { w: 1, t: 'An ancient cache is found beneath the old hall.', fn: o => ({ ...o, treasury: o.treasury + 2500 }) },
];
export function sectTick(s: SaveGame, from: number, to: number): SaveGame {
    let o = getSect(s); if (!o || s.dead || to <= from) return s;
    let y = Math.floor(o.last / 360);
    const endY = Math.floor(to / 360); if (endY <= y) return s;
    let log = s.log;
    for (y = y + 1; y <= endY && y < Math.floor(o.last / 360) + 400; y++) {
        const k = (n: string) => hash(`${s.seed}|sect|${y}|${n}`) % 1000 / 1000;
        const r = o.roster.slice(); const n = rosterCount(r), c = cap(o);
        const lib = lv(o, 'library'), top = expertCeiling(o);
        const nr = r.slice();
        for (let i = 0; i < nr.length; i++) { nr[i] -= r[i] * 0.02; if (i < top) { const m = r[i] * (0.04 + lib * 0.012) / (1 + i * 0.5); nr[i] -= m; nr[i + 1] += m; } }
        nr[0] += Math.max(0, (c - n) * (0.12 + lv(o, 'gate') * 0.03));
        let treasury = o.treasury + (n * 4 + lv(o, 'vein') * 900 + lv(o, 'forge') * 250) - o.tribute;
        let nxt: OwnSect = { ...o, roster: nr, treasury: Math.max(0, treasury) };
        const evs = nxt.events.slice();
        // raids: only when no peace pact
        if (y * 360 >= o.peaceUntil && k('raid') < 0.18 - lv(o, 'formation') * 0.03) {
            const foe = 40 + k('rs') * 140; const my = sectStrength(nxt) * (1 + lv(o, 'formation') * 0.1);
            if (my * (0.7 + k('rr')) >= foe) { evs.unshift({ d: y * 360, t: 'Raiders are driven off from the gates.' }); }
            else { nxt = { ...nxt, roster: casualties(nxt, 0.2 - lv(o, 'formation') * 0.02), treasury: Math.floor(nxt.treasury * 0.8) }; evs.unshift({ d: y * 360, t: 'Raiders break the outer wall and loot the treasury.' }); }
        }
        if (k('ev') < 0.4) {
            const tot = EVENTS.reduce((a, e) => a + e.w, 0); let pick = k('ep') * tot; const e = EVENTS.find(x => (pick -= x.w) < 0) ?? EVENTS[0];
            const res = e.fn(nxt, s); if (res) { nxt = res; evs.unshift({ d: y * 360, t: e.t }); }
        }
        o = { ...nxt, events: evs.slice(0, 12) };
        if (sectStrength(o) < 3) { o = { ...o, roster: o.roster.map((v, i) => (i === 0 ? Math.max(v, 8) : v)) }; }
    }
    o = { ...o, last: to };
    log = [`🏯 A year of the ${o.name}: ${Math.round(rosterCount(o.roster))} cultivators, ${Math.round(o.treasury)} stones in the treasury.`, ...log].slice(0, 30);
    return { ...put(s, o), log };
}
export { initialRoster };
