// Late-game money: long-term funds with thin returns, a home with upgrades, income assets, and a monthly auction house.
import type { SaveGame } from './state';
import { addStones, getEco } from './economy';
import { powerAt, rosterCount } from './war';
import type { World } from './world';
import { distanceLi } from './world';
import { makeGear, addGear, GRADES, gearPrice } from './gear';
import type { GearItem, Kind } from './gear';

export interface Wealth {
    funds: Record<string, { amt: number; since: number }>;
    home?: { cityId: string; level: number };
    assets: Record<string, number>; // asset id -> level
    last: number; // day wealth income was last settled
    chamber?: { cityId: string; level: number; routes: { id: string; a: string; b: string; guards: number[] }[] };
    shares?: Record<string, { n: number; cost: number }>; // sect shares: forceId -> count, total stones paid
}
let W: World | null = null;
export const setWealthWorld = (w: World) => { W = w; };
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const getWealth = (s: SaveGame): Wealth => (s as any).wealth ?? { funds: {}, assets: {}, last: s.clockDays };
const put = (s: SaveGame, w: Wealth): SaveGame => ({ ...s, wealth: w } as SaveGame);
const stones = (s: SaveGame) => getEco(s).stones;
const spend = (s: SaveGame, n: number) => addStones(s, -n);

// ---- Funds: thin returns, paid over very long spans ----
export interface FundDef { id: string; name: string; icon: string; yearly: number; note: string; lockYears: number }
export const FUNDS: FundDef[] = [
    { id: 'sect', name: 'Sect Treasury Bond', icon: '🏯', yearly: 0.004, lockYears: 20, note: 'Safe. 0.4% a year. Pulling out within 20 years costs a fifth.' },
    { id: 'merchant', name: 'Merchant Guild Fund', icon: '🏦', yearly: 0.009, lockYears: 10, note: '0.9% a year, but a bad century can eat part of it. Early exit costs a tenth.' },
];
export function fundValue(s: SaveGame, id: string): number {
    const f = getWealth(s).funds[id]; return f ? f.amt : 0;
}
export function invest(s: SaveGame, id: string, amt: number): { save: SaveGame; msg: string } {
    if (stones(s) < amt || amt <= 0) return { save: s, msg: 'You do not have that many stones.' };
    const w = getWealth(s), cur = w.funds[id];
    const next = { ...w, funds: { ...w.funds, [id]: { amt: (cur?.amt ?? 0) + amt, since: cur ? cur.since : s.clockDays } } };
    return { save: put(spend(s, amt), next), msg: `🏦 You place ${amt} stones in the ${FUNDS.find(f => f.id === id)?.name}. Returns arrive over decades.` };
}
export function withdraw(s: SaveGame, id: string): { save: SaveGame; msg: string } {
    const w = getWealth(s), f = w.funds[id], def = FUNDS.find(x => x.id === id)!;
    if (!f || f.amt <= 0) return { save: s, msg: 'Nothing invested there.' };
    const early = (s.clockDays - f.since) / 360 < def.lockYears;
    const pay = Math.floor(f.amt * (early ? (id === 'sect' ? 0.8 : 0.9) : 1));
    const funds = { ...w.funds }; delete funds[id];
    return { save: put(addStones(s, pay), { ...w, funds }), msg: `You withdraw ${pay} stones${early ? ' (early exit fee paid)' : ''}.` };
}

// ---- Sect shares: a top-10 board of the strongest forces. Price follows strength; dividends are thin and yearly. ----
export const DIVIDEND = 0.005;
export interface Ranked { id: string; name: string; kind: string; strength: number; price: number; rank: number; fallen: boolean; members: number; top: number }
let boardCache: { w: unknown; year: number; strength: unknown; list: Ranked[] } | null = null;
export function sectBoard(s: SaveGame, all = false): Ranked[] {
    if (!W) return [];
    const year = Math.floor(s.clockDays / 360);
    const st = powerAt(W, year);
    if (boardCache && boardCache.w === W && boardCache.year === year && boardCache.strength === st) { const l = boardCache.list; return all ? l : l.filter(x => !x.fallen).slice(0, 10); }
    const list = W.forces.map(f => ({ id: f.id, name: f.name, kind: f.kind, strength: st.strength[f.id] ?? 0, price: Math.max(1, Math.round((st.strength[f.id] ?? 0) * 1.8)), rank: 0, fallen: !!st.fallen[f.id], members: Math.round(rosterCount(st.roster[f.id] ?? [])), top: (st.roster[f.id] ?? []).reduce((m, v, i) => (v >= 0.5 ? i : m), 0) }));
    list.sort((a, b) => b.strength - a.strength); list.forEach((x, i) => { x.rank = i + 1; });
    boardCache = { w: W, year, strength: st, list };
    return all ? list : list.filter(x => !x.fallen).slice(0, 10);
}
export function sharesOf(s: SaveGame, id: string) { return getWealth(s).shares?.[id] ?? { n: 0, cost: 0 }; }
export function buyShares(s: SaveGame, id: string, n: number): { save: SaveGame; msg: string } {
    const row = sectBoard(s, true).find(x => x.id === id); if (!row || row.fallen) return { save: s, msg: 'That sect no longer trades.' };
    const cost = row.price * n; if (stones(s) < cost) return { save: s, msg: `You need ${cost} stones.` };
    const w = getWealth(s), cur = sharesOf(s, id);
    return { save: put(spend(s, cost), { ...w, shares: { ...(w.shares ?? {}), [id]: { n: cur.n + n, cost: cur.cost + cost } } }), msg: `📈 You buy ${n} share${n > 1 ? 's' : ''} of the ${row.name} for ${cost} stones.` };
}
export function sellShares(s: SaveGame, id: string, n: number): { save: SaveGame; msg: string } {
    const row = sectBoard(s, true).find(x => x.id === id), cur = sharesOf(s, id);
    if (!row || cur.n <= 0) return { save: s, msg: 'You hold none.' };
    n = Math.min(n, cur.n);
    const pay = row.fallen ? 0 : Math.floor(row.price * n * 0.98);
    const w = getWealth(s), left = cur.n - n, shares = { ...(w.shares ?? {}) };
    if (left <= 0) delete shares[id]; else shares[id] = { n: left, cost: cur.cost * left / cur.n };
    return { save: put(addStones(s, pay), { ...w, shares }), msg: row.fallen ? `The ${row.name} has fallen. Its shares are worthless.` : `📉 You sell ${n} share${n > 1 ? 's' : ''} for ${pay} stones (2% fee).` };
}
export const holdingsValue = (s: SaveGame) => { const sh = getWealth(s).shares ?? {}; const b = sectBoard(s, true); return Object.entries(sh).reduce((a, [id, v]) => { const r = b.find(x => x.id === id); return a + (r && !r.fallen ? r.price * v.n : 0); }, 0); };

// ---- Home and assets ----
export const HOME_COST = [0, 600, 4000, 30000, 200000, 1500000];
export const HOME_NAMES = ['No home', 'Thatched Cottage', 'Courtyard House', 'Cliffside Manor', 'Spirit-vein Estate', 'Cloud Palace'];
export interface AssetDef { id: string; name: string; icon: string; base: number; income: number; need: number }
export const ASSETS: AssetDef[] = [
    { id: 'shop', name: 'Market Shop', icon: '🏪', base: 800, income: 0.012, need: 1 },
    { id: 'garden', name: 'Spirit Herb Garden', icon: '🌿', base: 3000, income: 0.014, need: 2 },
    { id: 'mine', name: 'Spirit Stone Mine', icon: '⛏️', base: 25000, income: 0.016, need: 3 },
    { id: 'tower', name: 'Pill Tower', icon: '🗼', base: 160000, income: 0.018, need: 4 },
];
export const assetCost = (a: AssetDef, lvl: number) => Math.round(a.base * Math.pow(2.6, lvl));
export const MAX_ASSET = 4;
export function homeBonus(s: SaveGame, cityId: string | null): number { const h = getWealth(s).home; return h && cityId === h.cityId ? 0.03 * h.level : 0; }
export function buyHome(s: SaveGame, cityId: string, cityName: string): { save: SaveGame; msg: string } {
    const w = getWealth(s);
    if (w.home) return { save: s, msg: `You already keep a home in another place. Upgrade it instead.` };
    const cost = HOME_COST[1]; if (stones(s) < cost) return { save: s, msg: `You need ${cost} stones.` };
    return { save: put(spend(s, cost), { ...w, home: { cityId, level: 1 } }), msg: `🏠 You buy a ${HOME_NAMES[1]} in ${cityName}. Cultivating at home grows faster.` };
}
export function upgradeHome(s: SaveGame): { save: SaveGame; msg: string } {
    const w = getWealth(s); if (!w.home) return { save: s, msg: 'You have no home.' };
    if (w.home.level >= 5) return { save: s, msg: 'It is already a Cloud Palace.' };
    const cost = HOME_COST[w.home.level + 1]; if (stones(s) < cost) return { save: s, msg: `You need ${cost} stones.` };
    return { save: put(spend(s, cost), { ...w, home: { ...w.home, level: w.home.level + 1 } }), msg: `🏠 Your home becomes a ${HOME_NAMES[w.home.level + 1]}.` };
}
export function buyAsset(s: SaveGame, id: string): { save: SaveGame; msg: string } {
    const w = getWealth(s), a = ASSETS.find(x => x.id === id)!;
    if (!w.home) return { save: s, msg: 'Buy a home first. Assets are managed from it.' };
    if (w.home.level < a.need) return { save: s, msg: `Needs a ${HOME_NAMES[a.need]} or better.` };
    const lvl = w.assets[id] ?? 0; if (lvl >= MAX_ASSET) return { save: s, msg: 'Fully upgraded.' };
    const cost = assetCost(a, lvl); if (stones(s) < cost) return { save: s, msg: `You need ${cost} stones.` };
    return { save: put(spend(s, cost), { ...w, assets: { ...w.assets, [id]: lvl + 1 } }), msg: `${a.icon} ${lvl ? 'Upgraded' : 'Bought'} ${a.name} (level ${lvl + 1}).` };
}
export function yearlyIncome(s: SaveGame): number {
    const w = getWealth(s);
    let t = 0;
    for (const a of ASSETS) { const l = w.assets[a.id] ?? 0; if (l) { let spent = 0; for (let i = 0; i < l; i++) spent += assetCost(a, i); t += spent * a.income; } }
    for (const f of FUNDS) { const v = w.funds[f.id]; if (v) t += v.amt * f.yearly; }
    t += holdingsValue(s) * DIVIDEND + chamberNet(s);
    return t;
}
// Called from the household tick: settles income for the elapsed span. Funds compound slowly into their principal.
export function wealthTick(s: SaveGame, from: number, to: number): SaveGame {
    if (s.dead || to <= from) return s;
    const w = getWealth(s); if (!w.home && !Object.keys(w.funds).length && !Object.keys(w.shares ?? {}).length && !w.chamber) return s;
    const yrs = (to - from) / 360;
    let pay = 0; const funds: Wealth['funds'] = {};
    for (const a of ASSETS) { const l = w.assets[a.id] ?? 0; if (l) { let spent = 0; for (let i = 0; i < l; i++) spent += assetCost(a, i); pay += spent * a.income * yrs; } }
    for (const f of FUNDS) {
        const v = w.funds[f.id]; if (!v) continue;
        let amt = v.amt * Math.pow(1 + f.yearly, yrs);
        if (f.id === 'merchant') { const h = (hash(`${s.seed}|${Math.floor(to / 36000)}|crash`) % 100); if (Math.floor(from / 36000) !== Math.floor(to / 36000) && h < 18) amt *= 0.8; }
        funds[f.id] = { ...v, amt };
    }
    pay += holdingsValue(s) * DIVIDEND * yrs + chamberNet(s) * yrs;
    let n = addStones(s, pay);
    n = put(n, { ...w, funds, last: to });
    if (Math.floor(from / 360) !== Math.floor(to / 360) && pay > 0) n = { ...n, log: [`🏠 Your holdings earn about ${Math.round(pay / yrs)} stones a year.`, ...n.log].slice(0, 30) };
    return n;
}

// ---- Auction house: monthly lots in larger cities ----
export interface Lot { id: string; label: string; icon: string; value: number; gear?: GearItem; item?: { id: string; n: number } }
export function auctionLots(s: SaveGame, cityId: string, tier: number): Lot[] {
    if (tier < 2) return [];
    const month = Math.floor(s.clockDays / 30), kinds: Kind[] = ['robe', 'head', 'belt', 'boots', 'weapon', 'focus', 'ring', 'charm', 'treasure', 'artifact'];
    const out: Lot[] = [];
    for (let i = 0; i < 4; i++) {
        const h = hash(`${cityId}|${month}|auc${i}`);
        const gr = Math.min(3, (tier >= 4 ? 1 : 0) + ((h >>> 3) % 100 < 55 ? 1 : (h >>> 9) % 100 < 85 ? 2 : 3));
        const kind = kinds[h % kinds.length];
        const g = makeGear(`auc|${cityId}|${month}|${i}`, kind, kind === 'artifact' ? Math.max(gr, 2) : gr);
        out.push({ id: `${cityId}|${month}|${i}`, label: g.name, icon: g.icon, value: Math.round(gearPrice(g) * 1.4), gear: g });
    }
    return out;
}
export const reserve = (l: Lot) => Math.round(l.value * 0.6);
export function bidLot(s: SaveGame, lot: Lot, bid: number): { save: SaveGame; msg: string } {
    if (stones(s) < bid) return { save: s, msg: 'You cannot cover that bid.' };
    if (bid < reserve(lot)) return { save: s, msg: `The reserve is ${reserve(lot)} stones.` };
    const owned = (s.gearBag ?? []).some(x => x.uid === lot.gear!.uid) || Object.values(s.gear ?? {}).some(x => x?.uid === lot.gear!.uid);
    if (owned) return { save: s, msg: 'That lot is already yours.' };
    const rival = lot.value * (0.7 + (hash(`rival|${lot.id}`) % 60) / 100); // hidden top rival bid
    if (bid > rival) return { save: addGear(spend(s, bid), lot.gear!), msg: `🔨 Sold! The ${lot.gear!.name} is yours for ${bid} stones.` };
    return { save: s, msg: `🔨 You were outbid. Your stones are returned. (The winning bid was ${Math.round(rival)}.)` };
}

// ---- Chamber of Commerce: trade routes between towns, guarded by hired cultivators ----
export const CHAMBER_COST = 15000;
export const CHAMBER_UP = [0, 0, 40000, 150000, 600000, 2500000];
export const GUARD_WAGE = [40, 200, 1000, 5000, 25000, 120000];
export const GUARD_NAMES = ['Qi Refining wanderer', 'Foundation sword-for-hire', 'Golden Core captain', 'Nascent Soul elder', 'Body Tribulation guardian', 'Deity Transformation protector'];
export const maxRoutes = (lvl: number) => 2 + lvl;
export interface RouteInfo { id: string; a: string; b: string; guards: number[]; income: number; wages: number; raid: number; net: number }
export function routeInfo(s: SaveGame, r: { id: string; a: string; b: string; guards: number[] }): RouteInfo {
    const w = getWealth(s), A = W?.cityById.get(r.a), B = W?.cityById.get(r.b);
    if (!A || !B) return { ...r, income: 0, wages: 0, raid: 0, net: 0 };
    const lvl = w.chamber?.level ?? 1, dist = distanceLi(A, B);
    const gross = (Math.min(dist, 8000) / 100) * (A.marketTier + B.marketTier + 1) * 2.0 * (1 + 0.15 * (lvl - 1)); // distance capped at 8000li, was uncapped x12
    const power = r.guards.reduce((a, g) => a + g + 1, 0);
    const raid = Math.max(0.03, Math.min(0.35, 0.35 - 0.04 * power));
    const wages = r.guards.reduce((a, g) => a + GUARD_WAGE[g], 0);
    return { ...r, income: gross * (1 - raid), wages, raid, net: gross * (1 - raid) - wages };
}
export const routeCost = (a: { x: number; y: number }, b: { x: number; y: number }) => 0;
export function foundChamber(s: SaveGame, cityId: string, name: string, tier: number): { save: SaveGame; msg: string } {
    const w = getWealth(s); if (w.chamber) return { save: s, msg: 'You already run a chamber.' };
    if (tier < 3) return { save: s, msg: 'Only a major trading city can host a chamber.' };
    if (stones(s) < CHAMBER_COST) return { save: s, msg: `You need ${CHAMBER_COST} stones.` };
    return { save: put(spend(s, CHAMBER_COST), { ...w, chamber: { cityId, level: 1, routes: [] } }), msg: `🏛️ The ${name} Chamber of Commerce opens its doors.` };
}
export function upgradeChamber(s: SaveGame): { save: SaveGame; msg: string } {
    const w = getWealth(s), c = w.chamber; if (!c) return { save: s, msg: 'Found a chamber first.' };
    if (c.level >= 5) return { save: s, msg: 'The chamber is at its height.' };
    const cost = CHAMBER_UP[c.level + 1]; if (stones(s) < cost) return { save: s, msg: `You need ${cost} stones.` };
    return { save: put(spend(s, cost), { ...w, chamber: { ...c, level: c.level + 1 } }), msg: `🏛️ The chamber grows to level ${c.level + 1}.` };
}
export function routeBuildCost(a: string, b: string): number {
    const A = W?.cityById.get(a), B = W?.cityById.get(b); if (!A || !B) return 0;
    return Math.round(400 + distanceLi(A, B) * 0.8);
}
export function addRoute(s: SaveGame, to: string): { save: SaveGame; msg: string } {
    const w = getWealth(s), c = w.chamber; if (!c) return { save: s, msg: 'Found a chamber first.' };
    if (c.routes.length >= maxRoutes(c.level)) return { save: s, msg: 'Your chamber cannot run more routes. Upgrade it.' };
    if (to === c.cityId || c.routes.some(r => r.b === to)) return { save: s, msg: 'That route already exists.' };
    const cost = routeBuildCost(c.cityId, to); if (stones(s) < cost) return { save: s, msg: `You need ${cost} stones.` };
    const nm = W?.cityById.get(to)?.name ?? 'there';
    return { save: put(spend(s, cost), { ...w, chamber: { ...c, routes: [...c.routes, { id: `${c.cityId}>${to}`, a: c.cityId, b: to, guards: [] }] } }), msg: `🛤️ A trade route opens to ${nm}.` };
}
export function hireGuard(s: SaveGame, routeId: string, realm: number): { save: SaveGame; msg: string } {
    const w = getWealth(s), c = w.chamber; if (!c) return { save: s, msg: '' };
    const r = c.routes.find(x => x.id === routeId); if (!r) return { save: s, msg: '' };
    if (r.guards.length >= 3) return { save: s, msg: 'Three guards are the most a caravan carries.' };
    const fee = GUARD_WAGE[realm] * 2; if (stones(s) < fee) return { save: s, msg: `Signing fee is ${fee} stones.` };
    return { save: put(spend(s, fee), { ...w, chamber: { ...c, routes: c.routes.map(x => x.id === routeId ? { ...x, guards: [...x.guards, realm] } : x) } }), msg: `🛡️ A ${GUARD_NAMES[realm]} joins the route.` };
}
export function dismissGuard(s: SaveGame, routeId: string): { save: SaveGame; msg: string } {
    const w = getWealth(s), c = w.chamber; if (!c) return { save: s, msg: '' };
    return { save: put(s, { ...w, chamber: { ...c, routes: c.routes.map(x => x.id === routeId ? { ...x, guards: x.guards.slice(0, -1) } : x) } }), msg: 'You let a guard go.' };
}
export const chamberNet = (s: SaveGame) => (getWealth(s).chamber?.routes ?? []).reduce((a, r) => a + routeInfo(s, r).net, 0);
