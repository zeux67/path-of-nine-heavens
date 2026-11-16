// Spirit stones, a pack of items, markets, and secret-realm expeditions. No combat anywhere.

import { pillRankOf, pillEffect } from './pills';
import { realmDeathChance, pillDeathChance, fateRoll, makeDeath } from './fate';
import { ELEMENTS, gradeCap, getArts, learnCheck, spellById, techById, talentFor } from './arts';
import type { ArtsState, LearnedArt } from './arts';
import { REALMS } from './data';
import { gearEffect, makeGear, addGear, GRADES } from './gear';
import { ceilingRealm, currentCult, stageCost, advanceCult, cultGain, buffOn } from './cultivation';
import type { SaveGame } from './state';
import { A } from './grammar';

export interface Eco { stones: number; items: Record<string, number>; tox: number; sold?: Record<string, { n: number; d: number }> }
export const START_ECO: Eco = { stones: 30, items: {}, tox: 0 };
export const getEco = (s: SaveGame): Eco => s.eco ?? START_ECO;

export interface ItemDef { id: string; name: string; icon: string; blurb: string; base: number; buyable: boolean; minMarket: number; staple?: boolean; rank?: number }
export const ITEMS: ItemDef[] = [
    { id: 'qi-pill', name: 'Qi Gathering Pill', icon: '💊', rank: 0, blurb: 'Rank 0 cultivation pill (Qi Refining). Adds about a third of a stage. Pill toxicity builds with each one and fades over time.', base: 10, buyable: true, minMarket: 1, staple: true },
    { id: 'bt-pill', name: 'Breakthrough Pill', icon: '🔮', blurb: 'Old stock and rewards: works on any breakthrough, +15% chance at low realms, less at higher ones. Markets now sell ranked breakthrough pills.', base: 60, buyable: false, minMarket: 2 },
    { id: 'herb', name: 'Spirit Herb', icon: '🌿', blurb: 'Raw material for alchemy. Gathered in secret realms or bought from herb sellers.', base: 3, buyable: true, minMarket: 0, staple: true },
    { id: 'bitter-root', name: 'Bitter Root', icon: '🥕', blurb: 'A harsh root. Alchemists use it to draw poison out.', base: 4, buyable: true, minMarket: 0, staple: true },
    { id: 'iron-ore', name: 'Iron Ore', icon: '⛏️', blurb: 'Raw ore. Refine it into iron at a crucible.', base: 8, buyable: true, minMarket: 0, staple: true },
    { id: 'talisman-paper', name: 'Talisman Paper', icon: '📄', blurb: 'Blank yellow paper that holds a drawn talisman.', base: 3, buyable: true, minMarket: 0, staple: true },
    { id: 'cinnabar', name: 'Cinnabar Ink', icon: '🖋️', blurb: 'Red ink mixed with a drop of qi. Talismans are drawn in it.', base: 5, buyable: true, minMarket: 0, staple: true },
    { id: 'spirit-spring', name: 'Spirit Spring Water', icon: '💧', blurb: 'Clear water from a qi-rich spring.', base: 4, buyable: true, minMarket: 1 },
    { id: 'beast-hide', name: 'Beast Hide', icon: '🦬', blurb: 'Tough hide from a spirit beast.', base: 14, buyable: true, minMarket: 1 },
    { id: 'pill-furnace', name: 'Pill Furnace', icon: '🏺', blurb: 'A small bronze furnace. Needed to brew pills. Not used up.', base: 45, buyable: true, minMarket: 1, staple: true },
    { id: 'crucible', name: 'Refining Crucible', icon: '⚱️', blurb: 'A clay crucible for refining ore and cores. Not used up.', base: 55, buyable: true, minMarket: 1, staple: true },
    { id: 'fire-lotus', name: 'Fire Lotus Petal', icon: '🪷', blurb: 'A warm red petal. Rare in cold lands.', base: 25, buyable: true, minMarket: 2 },
    { id: 'moonblossom', name: 'Moonblossom', icon: '🌸', blurb: 'Blooms only at night. Calms a deviated qi flow.', base: 18, buyable: true, minMarket: 2 },
    { id: 'spirit-ore', name: 'Spirit Ore', icon: '🔹', blurb: 'Ore soaked in qi from a spirit vein. Refine it into ingots, or into your first artifact.', base: 22, buyable: true, minMarket: 2 },
    { id: 'spirit-ingot', name: 'Spirit Ingot', icon: '🔷', blurb: 'Purified spirit ore. The heart of a Spirit-grade artifact.', base: 70, buyable: false, minMarket: 9 },
    { id: 'cold-jade', name: 'Cold Jade', icon: '🟩', blurb: 'Cool green jade that holds qi well.', base: 30, buyable: true, minMarket: 2 },
    { id: 'core', name: 'Beast Core', icon: '🔴', blurb: 'A crystallised heart of qi from a spirit beast.', base: 22, buyable: true, minMarket: 2 },
    { id: 'jade-slip', name: 'Blank Jade Slip', icon: '📜', blurb: 'A jade slip for recording techniques. Collectors pay for fine ones.', base: 12, buyable: true, minMarket: 2 },
    { id: 'spirit-tea', name: 'Spirit Tea', icon: '🍵', blurb: 'A trade good. Cheap where it grows, dear elsewhere.', base: 6, buyable: true, minMarket: 1 },
    { id: 'silk', name: 'Spirit Silk', icon: '🧵', blurb: 'A trade good woven in great cities.', base: 30, buyable: true, minMarket: 2 },
    { id: 'dragon-wine', name: 'Dragon-bone Wine', icon: '🍶', blurb: 'A trade good. Cultivators drink it at gatherings.', base: 25, buyable: true, minMarket: 2 },
    { id: 'ginseng', name: 'Old Ginseng', icon: '🪴', blurb: 'Centuries-old root. Brewers and collectors fight over it.', base: 60, buyable: true, minMarket: 3 },
    { id: 'star-silver', name: 'Star Silver', icon: '✨', blurb: 'A fine ore from fallen stars.', base: 70, buyable: true, minMarket: 3 },
    { id: 'refined-iron', name: 'Refined Iron', icon: '🔩', blurb: 'Purified iron. Made at a crucible.', base: 22, buyable: false, minMarket: 9 },
    { id: 'core-essence', name: 'Core Essence', icon: '💠', blurb: 'A beast core refined to pure qi. Use it: +30% of a stage, no pill toxicity.', base: 55, buyable: true, minMarket: 3 },
    { id: 'detox-pill', name: 'Detox Pill', icon: '🟤', blurb: 'Draws out pill poison: toxicity down by 3.', base: 14, buyable: false, minMarket: 9 },
    { id: 'deviation-draught', name: 'Calming Draught', icon: '🧪', blurb: 'Ends a qi deviation at once.', base: 45, buyable: false, minMarket: 9 },
    { id: 'iron-charm', name: 'Iron Charm', icon: '🧿', blurb: 'Worn: 30% fewer encounters on the road.', base: 110, buyable: false, minMarket: 9 },
    { id: 'jade-pendant', name: 'Jade Pendant', icon: '📿', blurb: 'Worn: +5% breakthrough chance.', base: 220, buyable: false, minMarket: 9 },
    { id: 'spark-tal', name: 'Spark Talisman', icon: '🔥', blurb: 'Use: lights the furnace, next brew +15%.', base: 14, buyable: true, minMarket: 1 },
    { id: 'ward-tal', name: 'Ward Talisman', icon: '🛡️', blurb: 'Carried in your sleeve. If a rival strikes to kill, it cuts the odds from 30% to 10%, then burns away.', base: 60, buyable: true, minMarket: 2 },
    { id: 'swift-tal', name: 'Swift-step Talisman', icon: '👣', blurb: 'Use: your next journey takes 30% less time.', base: 32, buyable: false, minMarket: 9 },
    { id: 'array-flags', name: 'Array Flags', icon: '🚩', blurb: 'Formation flags and a jade disk. Needed to lay arrays. Not used up.', base: 40, buyable: true, minMarket: 1, staple: true },
    { id: 'taming-rope', name: 'Taming Rope', icon: '🪢', blurb: 'A spirit-woven rope for beast taming. Not used up.', base: 40, buyable: true, minMarket: 1, staple: true },
    { id: 'seed-tray', name: 'Spirit Seed Tray', icon: '🌱', blurb: 'Trays and a small plot kit for growing spirit plants. Not used up.', base: 30, buyable: true, minMarket: 1, staple: true },
    { id: 'geo-compass', name: 'Geomancer Compass', icon: '🧭', blurb: 'A luopan that points at qi veins. Not used up.', base: 50, buyable: true, minMarket: 1, staple: true },
    { id: 'divining-shells', name: 'Divining Shells', icon: '🐚', blurb: 'Turtle shells and coins for casting fate. Not used up.', base: 40, buyable: true, minMarket: 1, staple: true },
    { id: 'puppet-bench', name: 'Puppet Workbench', icon: '🛠️', blurb: 'A bench of joints, strings and runes. Not used up.', base: 60, buyable: true, minMarket: 1, staple: true },
    { id: 'venom-jar', name: 'Venom Still', icon: '🫙', blurb: 'A sealed jar and still for poisons and gu. Not used up.', base: 45, buyable: true, minMarket: 1, staple: true },
    { id: 'qi-array', name: 'Gather-Qi Array', icon: '🀄', blurb: 'Use: your cultivation is 30% faster for 60 days.', base: 55, buyable: false, minMarket: 9 },
    { id: 'guard-array', name: 'Guard Array', icon: '🔰', blurb: 'In a fight: a shield of 45% of your health. Works in a tribulation.', base: 70, buyable: false, minMarket: 9 },
    { id: 'trap-array', name: 'Trap Array', icon: '🪤', blurb: 'In a fight: stuns the foe and your next attack hits harder.', base: 60, buyable: false, minMarket: 9 },
    { id: 'beast-snack', name: 'Spirit Beast Feed', icon: '🍖', blurb: 'Use: your bonded beast is happy, cultivation +12% for 30 days.', base: 22, buyable: false, minMarket: 9 },
    { id: 'beast-whistle', name: 'Calling Whistle', icon: '🎺', blurb: 'Use: a beast carries you, your next journey takes 30% less time.', base: 38, buyable: false, minMarket: 9 },
    { id: 'site-map', name: 'Cultivation Site Chart', icon: '🗺️', blurb: 'Use: you settle on a charted qi vein, cultivation +20% for 90 days.', base: 65, buyable: false, minMarket: 9 },
    { id: 'fate-slip', name: 'Fate Slip', icon: '🎴', blurb: 'Use: a glimpse of your fate. Breakthrough chance +10% for 60 days.', base: 50, buyable: false, minMarket: 9 },
    { id: 'heaven-slip', name: "Heaven's-Eye Slip", icon: '👁️', blurb: "Use: reveals how closely heaven watches you and your tribulation odds.", base: 90, buyable: false, minMarket: 9 },
    { id: 'guard-puppet', name: 'Guard Puppet', icon: '🤖', blurb: 'Use: deploy it. It stands before you in every fight (a ward of 14% health) and wears down, and can be repaired with Refined Iron.', base: 80, buyable: false, minMarket: 9 },
    { id: 'miner-puppet', name: 'Mining Puppet', icon: '⛏️', blurb: 'Use: deploy it. It digs while you cultivate. Collect its stones from the Puppetry tab.', base: 75, buyable: false, minMarket: 9 },
    { id: 'ward-array', name: 'Ward Array', icon: '🛖', blurb: 'Use: for 90 days, trouble on the road finds you 40% less often.', base: 60, buyable: false, minMarket: 9 },
    { id: 'escape-array', name: 'Illusion Escape Array', icon: '🌀', blurb: 'Use before a secret realm: at the guardian, an illusion carries you out safely (with less loot). Lasts a year or one use.', base: 85, buyable: false, minMarket: 9 },
    { id: 'beast-pill', name: 'Beast Realm Pill', icon: '🟣', blurb: 'Use on a bonded beast that has fallen a major realm behind you: it crosses one realm. A special pill, found in secret realms or bought dear in large markets.', base: 140, buyable: true, minMarket: 3 },
    { id: 'demon-core', name: 'Demon Core', icon: '⚫', blurb: 'The heart of a fallen demon beast. Given to a bonded beast, it lets it cross one major realm. Found in deep secret realms.', base: 120, buyable: false, minMarket: 9 },
    { id: 'spirit-fruit', name: 'Spirit Fruit', icon: '🍑', blurb: 'Use: eat it for a surge of cultivation. Also sells well.', base: 70, buyable: false, minMarket: 9 },
    { id: 'viper-venom', name: 'Viper Venom', icon: '🐍', blurb: 'In a fight: the foe is poisoned and bleeds.', base: 35, buyable: false, minMarket: 9 },
    { id: 'blood-gu', name: 'Blood Gu', icon: '🩸', blurb: 'Use: swallow it for a surge of cultivation. Adds toxicity and a dark mark on your name.', base: 80, buyable: false, minMarket: 9 },
];
// What a market stocks: staples everywhere, plus a stable local selection and one lot that rotates monthly.
export function stockFor(save: SaveGame, cityId: string, tier: number): ItemDef[] {
    const month = Math.floor(save.clockDays / 30);
    return ITEMS.filter(it => it.buyable && tier >= it.minMarket
        && (it.staple || hash(`${cityId}|${it.id}`) % 100 < 60 || hash(`${cityId}|${it.id}|${month}`) % 100 < 12));
}
export type Cat = 'pills' | 'talismans' | 'materials' | 'goods' | 'tools' | 'charms';
export const CAT_INFO: Record<Cat, { icon: string; name: string }> = {
    pills: { icon: '💊', name: 'Pills and draughts' }, talismans: { icon: '📜', name: 'Talismans' }, materials: { icon: '🌿', name: 'Materials' },
    goods: { icon: '🧳', name: 'Trade goods' }, tools: { icon: '🏺', name: 'Tools' }, charms: { icon: '🧿', name: 'Charms and curios' },
};
export const CAT_OF: Record<string, Cat> = {
    'qi-pill': 'pills', 'bt-pill': 'pills', 'detox-pill': 'pills', 'deviation-draught': 'pills', 'core-essence': 'pills', 'beast-pill': 'pills', 'demon-core': 'materials',
    'spark-tal': 'talismans', 'ward-tal': 'talismans', 'swift-tal': 'talismans',
    'pill-furnace': 'tools', crucible: 'tools', 'array-flags': 'tools', 'taming-rope': 'tools', 'seed-tray': 'tools', 'geo-compass': 'tools', 'divining-shells': 'tools', 'puppet-bench': 'tools', 'venom-jar': 'tools',
    'qi-array': 'talismans', 'guard-array': 'talismans', 'trap-array': 'talismans', 'guard-puppet': 'talismans', 'ward-array': 'talismans', 'escape-array': 'talismans', 'fate-slip': 'talismans', 'heaven-slip': 'talismans', 'site-map': 'talismans',
    'spirit-tea': 'goods', silk: 'goods', 'dragon-wine': 'goods', ginseng: 'goods', 'star-silver': 'goods',
    'iron-charm': 'charms', 'jade-pendant': 'charms', 'jade-slip': 'charms',
};
export const catOf = (id: string): Cat => CAT_OF[id] ?? 'materials';
export const WEARABLE = ['iron-charm', 'jade-pendant'];
export const isWorn = (s: SaveGame, id: string) => (s.worn ?? []).includes(id) && (getEco(s).items[id] ?? 0) > 0;
export function wearToggle(s: SaveGame, id: string): { save: SaveGame; msg: string } {
    const worn = s.worn ?? [];
    if (worn.includes(id)) return { save: { ...s, worn: worn.filter(w => w !== id) }, msg: `You take off the ${itemById(id)?.name}.` };
    if ((getEco(s).items[id] ?? 0) < 1) return { save: s, msg: 'You do not have one.' };
    return { save: { ...s, worn: [...worn, id] }, msg: `You wear the ${itemById(id)?.name}.` };
}

// ---- Market shocks: war, plague and harvest swing the price of whole families of goods in a prefecture each season ----
let econWorld: import('./world').World | null = null;
export const setEconWorld = (w: import('./world').World) => { econWorld = w; };
export interface Shock { text: string; mult: number; ids: string[] }
const SHOCKS: Shock[] = [
    { text: '⚔️ War in the prefecture has drained the forges: ore, iron and charms fetch more.', mult: 1.6, ids: ['iron-ore', 'refined-iron', 'iron-charm', 'beast-hide'] },
    { text: '🦠 A plague has emptied the herb stores: herbs and pills are scarce.', mult: 1.7, ids: ['herb', 'bitter-root', 'moonblossom', 'fire-lotus', 'ginseng', 'detox-pill', 'qi-pill'] },
    { text: '🌾 A bumper harvest floods the stalls: tea, wine and silk sell cheap.', mult: 0.6, ids: ['spirit-tea', 'dragon-wine', 'silk'] },
    { text: '🛤️ Bandits have closed the roads: imported goods cost more.', mult: 1.4, ids: ['silk', 'star-silver', 'cold-jade', 'jade-slip', 'core'] },
    { text: '🏆 A grand tournament is coming: talismans and pills are in demand.', mult: 1.5, ids: ['ward-tal', 'spark-tal', 'swift-tal', 'qi-pill', 'bt-pill', 'core-essence'] },
];
export function shockAt(save: SaveGame, cityId: string): Shock | null {
    const city = econWorld?.cityById.get(cityId);
    if (!city) return null;
    const season = Math.floor(save.clockDays / 90);
    const h = hash(`${city.prefectureId}|${season}|shock`);
    return h % 100 < 14 ? SHOCKS[(h >>> 8) % SHOCKS.length] : null;
}
export const itemById = (id: string) => ITEMS.find(i => i.id === id);

function hash(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

// Prices drift month to month per city (0.9 .. 1.15).
export function priceFactor(save: SaveGame, cityId: string): number {
    const month = Math.floor(save.clockDays / 30);
    return 0.95 + (hash(`${cityId}|${month}`) % 16) / 100;
}

// Pill and scroll prices climb with realm so the economy keeps pace with the cultivation curve.
export function realmScale(save: SaveGame): number { return 1 + currentCult(save).realm * 0.6; }

// Local demand for a good, 0.7 (glut) .. 1.5 (scarce), shifting each season. Buy where it is cheap, sell where it is dear.
export function demandAt(save: SaveGame, cityId: string, itemId: string): number {
    const sh = shockAt(save, cityId);
    const shock = sh && sh.ids.includes(itemId) ? sh.mult : 1;
    if (itemId === 'qi-pill' || itemId === 'bt-pill') return shock;
    const season = Math.floor(save.clockDays / 90);
    return (0.9 + (hash(`${cityId}|${itemId}|${season}|dm`) % 31) / 100) * shock;
}
export function demandTag(save: SaveGame, cityId: string, itemId: string): string {
    const d = demandAt(save, cityId, itemId);
    return d >= 1.25 ? '▲ in demand' : d <= 0.85 ? '▼ plentiful' : '';
}
export function buyPrice(save: SaveGame, cityId: string, it: ItemDef): number {
    const scale = it.id === 'bt-pill' ? realmScale(save) : 1; // ranked pills have a fixed rank price
    return Math.max(1, Math.round(it.base * scale * priceFactor(save, cityId) * demandAt(save, cityId, it.id) * (1 - Math.min(0.15, gearEffect(save, 'barter')))));
}
// Pills you SELL keep the full realm scaling up to realm 3, then grow slowly so brewing stays healthy early but stops printing money late.
export const sellRankScale = (r: number): number => r <= 3 ? 1 + r * 0.6 : 2.8 + (r - 3) * 0.05;
export const sellScale = (save: SaveGame): number => { const r = currentCult(save).realm; return r <= 3 ? 1 + r * 0.6 : 2.8 + (r - 3) * 0.05; };
// Market depth: each sale of the same kind of goods in the same town knocks 6% off the next price (floor 30%); it recovers one sale per 3 days.
// Market depth is an OPTIONAL proposal, OFF in 0.2 pending approval. Set true to enable.
export const MARKET_DEPTH_ON = false;
export const SELL_DROP = 0.06, SELL_FLOOR = 0.3, SELL_RECOVER_DAYS = 3;
const depthKey = (cityId: string, itemId: string) => `${cityId}|${CAT_OF[itemId] ?? itemId}`; // a town's buyers glut by kind of goods, not by single item
export function soldDepth(save: SaveGame, cityId: string, itemId: string): number {
    const r = getEco(save).sold?.[depthKey(cityId, itemId)]; if (!r) return 0;
    return Math.max(0, r.n - (save.clockDays - r.d) / SELL_RECOVER_DAYS);
}
// Low-rank pills (rank 3 and below) are exempt: their brewing margin is a deliberate early-game choice.
const exempt = (itemId: string): boolean => { if (!MARKET_DEPTH_ON) return true; const r = itemById(itemId)?.rank; return r !== undefined && r <= 3; };
export const depthFactor = (save: SaveGame, cityId: string, itemId: string): number => exempt(itemId) ? 1 : Math.max(SELL_FLOOR, 1 - SELL_DROP * soldDepth(save, cityId, itemId));
export function sellPrice(save: SaveGame, cityId: string, tier: number, it: ItemDef): number {
    const scale = it.rank !== undefined ? sellRankScale(it.rank) / (1 + 0.6 * it.rank) : it.id === 'bt-pill' ? sellScale(save) : 1;
    const raw = Math.round(it.base * scale * (0.6 + 0.1 * tier) * priceFactor(save, cityId) * demandAt(save, cityId, it.id) * (1 + Math.min(0.15, gearEffect(save, 'barter'))) * depthFactor(save, cityId, it.id));
    return Math.max(1, Math.min(raw, Math.round(buyPrice(save, cityId, it) * 0.9))); // never sell for more than 90% of what the same city would charge you
}

export function scrollPrice(grade: number, kind: 'technique' | 'spell', save: SaveGame, cityId: string): number {
    return Math.round((kind === 'technique' ? 45 : 35) * Math.pow(2.4, grade) * priceFactor(save, cityId));
}

export interface ScrollEntry { kind: 'technique' | 'spell'; id: string; price: number }
// Scrolls on offer: stable per city and month. Tier 2 shelves reach grade 1, tier 3 up to your comprehension.
export function scrollsFor(save: SaveGame, cityId: string, tier: number): ScrollEntry[] {
    if (tier < 2) return [];
    const cap = tier === 2 ? 1 : 3; // stock depends on the market, never on who is looking; learnCheck decides who may learn
    const month = Math.floor(save.clockDays / 30);
    const out: ScrollEntry[] = [];
    for (let i = 0; i < 4; i++) {
        const h = hash(`${cityId}|${month}|${i}`);
        const el = ELEMENTS[h % ELEMENTS.length];
        const g = (h >>> 5) % (cap + 1);
        const kind = i % 2 === 0 ? 'technique' : 'spell';
        out.push({ kind, id: `${kind === 'technique' ? 'tech' : 'spell'}-${el}-${g}`, price: scrollPrice(g, kind, save, cityId) });
    }
    return out;
}

export function pay(save: SaveGame, cost: number): SaveGame | null {
    const eco = getEco(save);
    if (eco.stones < cost) return null;
    return { ...save, eco: { ...eco, stones: eco.stones - cost } };
}
export function addItem(save: SaveGame, id: string, n: number): SaveGame {
    const eco = getEco(save);
    return { ...save, eco: { ...eco, items: { ...eco.items, [id]: (eco.items[id] ?? 0) + n } } };
}
export function addStones(save: SaveGame, n: number): SaveGame {
    const eco = getEco(save);
    return { ...save, eco: { ...eco, stones: eco.stones + n } };
}

export function buyItem(save: SaveGame, cityId: string, it: ItemDef): { save: SaveGame; msg: string } {
    const cost = buyPrice(save, cityId, it);
    const paid = pay(save, cost);
    if (!paid) return { save, msg: `You need ${cost} spirit stones.` };
    return { save: addItem(paid, it.id, 1), msg: `Bought: ${it.name} for ${cost} stones.` };
}

export function sellItem(save: SaveGame, cityId: string, tier: number, it: ItemDef): { save: SaveGame; msg: string } {
    const eco = getEco(save);
    if ((eco.items[it.id] ?? 0) < 1) return { save, msg: 'You have none to sell.' };
    const price = sellPrice(save, cityId, tier, it);
    let s = addStones(addItem(save, it.id, -1), price);
    if (exempt(it.id)) return { save: s, msg: `Sold: ${it.name} for ${price} stones.` };
    const sold: Record<string, { n: number; d: number }> = {};
    for (const [k, r] of Object.entries(getEco(s).sold ?? {})) if (r.n - (s.clockDays - r.d) / SELL_RECOVER_DAYS > 0.05) sold[k] = r;
    sold[depthKey(cityId, it.id)] = { n: soldDepth(save, cityId, it.id) + 1, d: s.clockDays };
    s = { ...s, eco: { ...getEco(s), sold } };
    return { save: s, msg: `Sold: ${it.name} for ${price} stones.` };
}

export function usePill(save: SaveGame, id = 'qi-pill'): { save: SaveGame; msg: string } {
    const eco = getEco(save);
    const rk = pillRankOf(id);
    if (rk === null || (eco.items[id] ?? 0) < 1) return { save, msg: `You have no ${itemById(id)?.name ?? 'pill'}.` };
    const c = { ...currentCult(save) };
    if (c.gate) return { save, msg: 'You are at the threshold. A pill cannot push you further; attempt the breakthrough.' };
    const eff = Math.max(0.15, 1 - eco.tox * 0.12);
    const pe = pillEffect(rk, c.realm);
    const gain = Math.floor(cultGain(save, pe.frac, 120) * eff);
    c.progress = Math.min(stageCost(c.realm, c.stage) - 1, c.progress + gain);
    const dTox = pe.tox * (1 - gearEffect(save, 'tox'));
    const next = { ...save, cult: c, eco: { ...eco, tox: eco.tox + dTox, items: { ...eco.items, [id]: eco.items[id] - 1 } } };
    if (pillDeathChance(eco.tox + 1) > 0 && fateRoll(save, 31) < pillDeathChance(eco.tox + 1)) {
        const dead = makeDeath(save, 'pill-poison', 'You swallowed pill after pill without letting the poison settle. Your dantian clogged and your heart stopped.', c.realm, c.stage);
        return { save: { ...next, dead, paused: true, log: ['☠️ The pill poison reaches your heart.', ...save.log].slice(0, 30) }, msg: '☠️ The pill poison reaches your heart.' };
    }
    if (eco.tox + 1 >= 4) { c.weak = Math.max(c.weak ?? 0, 30 * (eco.tox - 2)); next.cult = c; }
    const note = eco.tox >= 3 ? ' Pill toxicity is heavy; the effect is weak.' + (eco.tox + 1 >= 4 ? ' Your meridians ache: a qi deviation sets in.' : '') + (eco.tox + 1 >= 6 ? ' You are poisoning yourself.' : '') : '';
    return { save: next, msg: `💊 The pill melts into warmth: +${gain} cultivation base.${note}` };
}

export function learnScroll(save: SaveGame, cityId: string, e: ScrollEntry, source: 'market' | 'secret-realm' = 'market'): { save: SaveGame; msg: string } {
    const chk = learnCheck(save, e.kind, e.id);
    if (!chk.ok) return { save, msg: chk.why ?? '' };
    const info = e.kind === 'technique' ? techById(e.id) : spellById(e.id);
    if (!info) return { save, msg: '' };
    const paid = source === 'market' ? pay(save, e.price) : save;
    if (!paid) return { save, msg: `You need ${e.price} spirit stones.` };
    const arts = getArts(paid);
    const art: LearnedArt = { id: e.id, source, points: 0, talent: talentFor(paid.char, e.id) };
    const next: ArtsState = e.kind === 'technique' ? { ...arts, techniques: [...arts.techniques, art] } : { ...arts, spells: [...arts.spells, art] };
    return { save: { ...paid, arts: next }, msg: `📜 You learned ${info.name}${source === 'market' ? ` for ${e.price} stones` : ''}.` };
}

// ---- Secret realms ----------------------------------------------------------------

export interface RealmKind { name: string; icon: string; blurb: string }
export const REALM_KINDS: RealmKind[] = [
    { name: 'Herb Valley', icon: '🌿', blurb: 'A hidden valley where spirit herbs grow thick.' },
    { name: 'Sunken Ruins', icon: '🏛️', blurb: 'The broken halls of a forgotten sect.' },
    { name: 'Beast Hollow', icon: '🐺', blurb: 'A cavern of sleeping spirit beasts. You take what you can without waking them.' },
    { name: 'Sword Tomb', icon: '⚔️', blurb: 'Rusted blades hum with the will of their dead owners.' },
    { name: 'Grotto Heaven', icon: '🏯', blurb: 'A cave-heaven of dense qi where a dead master sealed his legacy. The doors close behind the unwary.' },
    { name: 'Medicine Garden', icon: '🌺', blurb: 'Spirit herbs older than any sect, tended by guardian beasts and old formations.' },
    { name: 'Thunder Pond', icon: '⚡', blurb: 'A pool wreathed in lightning. Dangerous, and rich in qi.' },
];
export const DANGER = ['Calm', 'Uneasy', 'Perilous', 'Deadly', 'Calamitous', 'Abyssal', 'Heaven-defying', 'Primordial'];
export const MAX_DANGER = DANGER.length - 1;
const hiMult = (d: number) => (d <= 3 ? 1 : Math.pow(2.4, d - 3));

export interface RealmOffer { id: string; kind: RealmKind; danger: number; days: number; recommended: number; opensIn: number; closesIn: number; open: boolean }

// Each prefecture has a realm that opens for two of every three months. Stable per prefecture and month.
export function realmHere(save: SaveGame, prefecture: string): RealmOffer {
    const month = Math.floor(save.clockDays / 30);
    const base = hash(prefecture);
    const open = (base + month) % 3 !== 0;
    const h = hash(`${prefecture}|${month}`);
    // Opportunities sit within 2 realms of the player 99% of the time; the 1% outliers are extraordinary (usually deadly).
    const pr = currentCult(save).realm;
    const roll = (hash(`${prefecture}|${month}|band`) % 10000) / 10000;
    const off = roll < 0.99 ? (hash(`${prefecture}|${month}|off`) % 5) - 2 : (roll < 0.995 ? 3 + (hash(`${prefecture}|${month}|up`) % 3) : -3 - (hash(`${prefecture}|${month}|dn`) % 3));
    const danger = Math.max(0, Math.min(MAX_DANGER, Math.round(Math.max(0, pr + off) / 2)));
    const monthEnd = (month + 1) * 30;
    return {
        id: `${prefecture}|${month}`, kind: REALM_KINDS[h % REALM_KINDS.length], danger,
        days: 30 + danger * 30, recommended: danger * 2, opensIn: open ? 0 : monthEnd - save.clockDays, closesIn: open ? monthEnd - save.clockDays : 0, open,
    };
}

export interface Expedition { guard?: 'pending' | 'win' | 'lose' | 'flee'; realmId: string; name: string; icon: string; danger: number; startDays: number; endsDays: number; trapped?: number; trapDays?: number; trapMult?: number }

// Set by craftx (avoids a circular import): geomancy shortens trips, formation can unpick a guardian's array, taming can bond a beast in a Beast Hollow.
export const gapHooks: { realmDays?: (s: SaveGame, days: number) => number; arrayBreak?: (s: SaveGame, exp: Expedition, r: number) => SaveGame | null; beastExit?: (s: SaveGame, exp: Expedition) => SaveGame } = {};
export function enterRealm(save: SaveGame, offer: RealmOffer): { save: SaveGame; msg: string } {
    if (save.exp) return { save, msg: 'You are already inside a secret realm.' };
    if (save.travel) return { save, msg: 'Finish your journey first.' };
    if (!offer.open) return { save, msg: 'The realm is sealed this month.' };
    const exp: Expedition = { realmId: offer.id, name: offer.kind.name, icon: offer.kind.icon, danger: offer.danger, startDays: save.clockDays, endsDays: save.clockDays + (gapHooks.realmDays ? gapHooks.realmDays(save, offer.days) : offer.days) };
    return { save: { ...save, exp, log: [`${offer.kind.icon} You step into the ${offer.kind.name}. Cultivation pauses while you explore.`, ...save.log].slice(0, 30) }, msg: '' };
}

function rrand(save: SaveGame, exp: Expedition, salt: number): number {
    let x = hash(`${save.seed}|${exp.realmId}|${exp.startDays}|${salt}`);
    x = Math.imul(x ^ (x >>> 15), 2246822507); x ^= x >>> 13;
    return (x >>> 0) / 4294967296;
}

export function resolveExpedition(save: SaveGame): SaveGame {
    const out = resolveExpeditionRaw(save);
    // Walking out of a secret realm alive draws heaven's eye, more for deadlier ones.
    if (save.exp && !out.dead && !out.exp && gapHooks.beastExit) return gapHooks.beastExit({ ...out, heaven: Math.round(((out.heaven ?? 0) + 0.5 * Math.max(1, save.exp.danger)) * 10) / 10 }, save.exp);
    if (save.exp && !out.dead && !out.exp) return { ...out, heaven: Math.round(((out.heaven ?? 0) + 0.5 * Math.max(1, save.exp.danger)) * 10) / 10 };
    return out;
}
// How much qi a sealed site yields for cultivation while you are stuck inside (before a per-site roll).
const TRAP_QI: Record<string, number> = { 'Grotto Heaven': 2.2, 'Thunder Pond': 1.4, 'Herb Valley': 0.7, 'Medicine Garden': 0.8, 'Sunken Ruins': 0.35, 'Beast Hollow': 0.15, 'Sword Tomb': 0.1 };
export function realmPower(save: SaveGame): number {
    const ch = save.char;
    return currentCult(save).realm + 1 + ch.luck / 50 + ch.constitution * 0.3 + (ch.fateName === 'Fortuitous Encounters' ? 1.5 : 0);
}
export function realmTrapChance(danger: number, realm: number, kind: string): number {
    if (danger === 0) return 0;
    const under = Math.max(0, danger * 2 - realm);
    const bonus = kind === 'Grotto Heaven' ? 0.03 : kind === 'Medicine Garden' ? 0.02 : 0;
    return Math.min(0.55, 0.015 * danger + 0.03 * under + bonus);
}
export function realmSuccess(save: SaveGame, danger: number): number {
    const ch = save.char;
    const realm = currentCult(save).realm;
    const power = realm + 1 + ch.luck / 50 + ch.constitution * 0.3 + (ch.fateName === 'Fortuitous Encounters' ? 1.5 : 0);
    const need = danger * 2 + 1.5;
    const underBy = Math.max(0, danger * 2 - realm);
    return Math.max(0.08, Math.min(0.95, 0.35 + 0.4 * (power / need) - 0.06 * Math.max(0, underBy - 1)));
}
// Overall chance of not coming back, as shown on the realm card.
export function realmTrapRisk(save: SaveGame, danger: number, kind: string): number { return realmTrapChance(danger, currentCult(save).realm, kind); }
export function realmDeathRisk(save: SaveGame, danger: number): number {
    return (1 - realmSuccess(save, danger)) * realmDeathChance(danger, currentCult(save).realm);
}

function resolveExpeditionRaw(save: SaveGame): SaveGame {
    const exp = save.exp;
    if (!exp) return save;
    const ch = save.char;
    const realm = currentCult(save).realm;
    const pSuccess = realmSuccess(save, exp.danger);
    const lines: string[] = [];
    let s: SaveGame = { ...save, exp: null };
    const d = exp.danger;
    if (exp.trapped) {
        // Sealed in: a last escape check at the end of the seal.
        const under = Math.max(0, d * 2 - realm);
        const pEsc = Math.max(0.15, Math.min(0.9, 0.5 + 0.1 * (realmPower(save) - (d * 2 + 1))));
        const grew = (): { s: SaveGame; line: string } => {
            const before = currentCult(s);
            const r = advanceCult(s, (exp.trapDays ?? 0) * (exp.trapMult ?? 0), false);
            const after = r.cult; const gained = (after.realm * 9 + after.stage) - (before.realm * 9 + before.stage);
            return { s: { ...s, cult: after }, line: gained > 0 ? ` Years of sealed cultivation carried you ${gained} stage${gained > 1 ? 's' : ''} higher.` : '' };
        };
        if (fateRoll(save, 61) < pEsc) {
            const got = Math.floor((2 + d * 3) * hiMult(d));
            s = addStones(s, got);
            const g = grew(); s = g.s;
            return { ...s, log: [`${exp.icon} The seal weakens and you claw your way out of the ${exp.name} with ${got} stones.${g.line}`, ...save.log].slice(0, 30) };
        }
        if (d >= 2 && fateRoll(save, 62) < Math.min(0.9, 0.08 + 0.09 * under + 0.05 * d)) {
            const dead = makeDeath(save, 'trapped', `The ${exp.name} sealed behind you and you could not break out. Your qi ran dry in the dark.`, realm, currentCult(save).stage);
            return { ...s, clockDays: exp.endsDays, dead, paused: true, log: [`${exp.icon} The ${exp.name} keeps you forever.`, ...save.log].slice(0, 30) };
        }
        const cult = { ...currentCult(s), weak: 120 }; cult.progress = Math.floor(cult.progress * 0.8);
        s = { ...s, cult };
        const g = grew(); s = g.s;
        return { ...s, log: [`${exp.icon} After a long struggle you break the seal, half-starved and hollowed out (qi deviation, 4 months).${g.line}`, ...save.log].slice(0, 30) };
    }
    if (d >= 1 && fateRoll(save, 51) < realmTrapChance(d, realm, exp.name)) {
        // Seals are measured in years: a few at Uneasy sites, decades at Deadly ones.
        const years = [0, 2, 8, 20, 40, 80, 150, 300][d] + fateRoll(save, 52) * [0, 3, 7, 20, 40, 80, 150, 300][d];
        const extra = Math.round(years * 360);
        const mult = TRAP_QI[exp.name] * (0.6 + fateRoll(save, 53) * 0.8);
        const exp2 = { ...exp, endsDays: exp.endsDays + extra, trapped: 1, trapDays: extra, trapMult: mult };
        const cond = mult >= 1.4 ? 'The qi inside is thick. You can cultivate here at great pace.' : mult >= 0.6 ? 'Some qi seeps through the walls. You can cultivate here slowly.' : mult >= 0.2 ? 'The qi is thin. Cultivation here is barely worth the name.' : 'The place is barren. There is nothing to cultivate with.';
        return { ...save, exp: exp2, log: [`${exp.icon} The ${exp.name} seals itself behind you. You are trapped for about ${years < 1.5 ? Math.round(years * 12) + ' months' : Math.round(years) + ' years'}. ${cond}`, ...save.log].slice(0, 30) };
    }
    if (d >= 3 && exp.guard === undefined && buffOn(save, 'escape')) return { ...save, buffs: { ...(save.buffs ?? {}), escape: 0 }, exp: { ...exp, guard: 'flee' }, log: ['🌀 Your escape array flares and the illusion carries you past the guardian. You leave with less than you hoped.', ...save.log].slice(0, 30) };
    if (d >= 3 && exp.guard === undefined) { const broken = gapHooks.arrayBreak?.(save, exp, rrand(save, exp, 21)); if (broken) return broken; return { ...save, exp: { ...exp, guard: 'pending' } }; }
    if (exp.guard === 'pending') return save;
    const failed = exp.guard === 'win' ? false : exp.guard === 'lose' || exp.guard === 'flee' ? true : rrand(save, exp, 1) >= pSuccess;
    if (failed) {
        const cult = { ...currentCult(s), weak: 90 };
        const part = Math.floor(cult.progress * 0.15);
        cult.progress -= part;
        s = { ...s, cult };
        if (exp.guard !== 'flee' && fateRoll(save, 41) < realmDeathChance(d, realm)) {
            const dead = makeDeath(save, 'secret-realm', `The ${exp.name} was ${DANGER[d].toLowerCase()} and you were not ready for it (realm ${realm + 1} against a realm ${d * 2 + 1} danger). You never came out.`, realm, currentCult(save).stage);
            return { ...s, clockDays: exp.endsDays, dead, paused: true, log: [`${exp.icon} The ${exp.name} swallows you. Nothing returns.`, ...save.log].slice(0, 30) };
        }
        const got = Math.floor((2 + d * 2 * rrand(save, exp, 2)) * hiMult(d));
        s = addStones(s, got);
        lines.push(`${exp.icon} The ${exp.name} turns on you. You flee with ${got} stones and a qi deviation (half speed for 3 months).`);
    } else {
        const herbs = (1 + Math.floor(rrand(save, exp, 3) * (2 + d * 2))) * (exp.name === 'Medicine Garden' ? 3 : 1);
        if (exp.name === 'Grotto Heaven') {
            const cc = { ...currentCult(s) };
            cc.progress = Math.min(stageCost(cc.realm, cc.stage) - 1, cc.progress + cultGain(s, 0.15 + 0.1 * d, 250 * (0.6 + d)));
            s = { ...s, cult: cc };
            lines.push('🏯 The cave-heaven\'s dense qi floods your meridians. Your cultivation surges.');
        }
        s = addItem(s, 'herb', herbs);
        let loot = `${herbs} spirit herb${herbs > 1 ? 's' : ''}`;
        const stones = Math.round((6 + d * 12) * hiMult(d) * (0.6 + rrand(save, exp, 4) * 0.8));
        s = addStones(s, stones); loot += `, ${stones} stones`;
        if (d >= 1 && rrand(save, exp, 5) < 0.5) { s = addItem(s, 'core', 1 + (d >= 3 ? 1 : 0) + Math.floor(d / 4)); loot += ', a beast core'; }
        if (d >= 3 && rrand(save, exp, 7) < 0.2) { s = addItem(s, 'demon-core', 1); loot += ', a Demon Core'; }
        if (d >= 1 && rrand(save, exp, 6) < 0.18 + d * 0.04) { s = addItem(s, `bt-${Math.min(13, currentCult(s).realm)}`, 1); loot += ', a Breakthrough Pill'; }
        lines.push(`${exp.icon} You leave the ${exp.name} with ${loot}.`);
        if (d >= 3 && rrand(save, exp, 11) < 0.06 + d * 0.025) {
            const kinds = ['robe', 'head', 'belt', 'boots', 'weapon', 'focus', 'ring', 'charm', 'treasure'] as const;
            const k = kinds[Math.floor(rrand(save, exp, 12) * kinds.length)];
            const gr = d >= 6 ? 3 : d >= 5 ? 2 : d >= 4 ? 2 : 1;
            const piece = makeGear(`${save.seed}|${exp.realmId}|${exp.startDays}`, k, gr);
            s = addGear(s, piece); lines.push(`${piece.icon} Among the ruins you recover ${piece.name} (${GRADES[gr]}-grade). (See Gear.)`);
        }
        const artChance = 0.22 + d * 0.06 + (ch.fateName === 'Fortuitous Encounters' ? 0.2 : 0);
        if (rrand(save, exp, 7) < artChance) {
            const cap = Math.min(3, gradeCap(ch, false), d + 1);
            const el = ELEMENTS[Math.floor(rrand(save, exp, 8) * ELEMENTS.length)];
            const g = Math.min(cap, Math.floor(rrand(save, exp, 9) * (cap + 1)));
            const kind: 'technique' | 'spell' = rrand(save, exp, 10) < 0.5 ? 'technique' : 'spell';
            const id = `${kind === 'technique' ? 'tech' : 'spell'}-${el}-${g}`;
            const r = learnScroll(s, '', { kind, id, price: 0 }, 'secret-realm');
            if (r.msg.startsWith('📜')) { s = r.save; lines.push(`📜 In the depths you find a carved legacy and learn ${(kind === 'technique' ? techById(id) : spellById(id))?.name}.`); }
            else { s = addStones(s, 40); lines.push('📜 You find a legacy scroll but cannot hold another art, so you sell it for 40 stones.'); }
        }
    }
    return { ...s, log: [...lines.slice().reverse(), ...s.log].slice(0, 30) };
}

export { REALMS, ceilingRealm };

// Some cities refuse your path: righteous strongholds shun demonic cultivators, and black-market towns shun righteous ones.
export function marketRefusal(save: SaveGame, cityId: string, tier: number): string | null {
    if (tier < 1) return null;
    const h = hash('align|' + cityId);
    if (save.char.alignment === 'demonic' && h % 4 === 0) return 'The stallkeepers smell blood qi on you and shutter their stalls. This is a righteous stronghold.';
    if (save.char.alignment === 'righteous' && h % 9 === 0) return 'A black-market town. The brokers eye your clean robes and refuse to deal with you.';
    return null;
}
