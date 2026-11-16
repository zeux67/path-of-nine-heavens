// Crafts: refining (qi and artifact), alchemy and talismans. Basic recipes work in any town; no combat anywhere.
import type { SaveGame } from './state';
import { gearEffect, makeGear, addGear } from './gear';
import type { Kind } from './gear';
import { bump } from './goals';
import { addKarma } from './karma';
import { deployPuppet } from './craftx';
export const hooks: { readManual?: (s: SaveGame, id: string) => { save: SaveGame; msg: string } } = {};
import { getEco, addItem, itemById, pay, addStones, realmScale } from './economy';
import { REALMS as REALM_NAMES } from './data';
import { currentCult, stageCost, applyCultivationStep, cultGain, BUFF_INFO, buffOn, heavenOf, heavenWord, tribulationOdds, deathRisk, breakthroughChance, tribulationWaves } from './cultivation';

export type CraftId = 'refine' | 'alchemy' | 'talisman' | 'formation' | 'beast' | 'farming' | 'geomancy' | 'divination' | 'puppet' | 'poison';
export interface CraftState { xp: Partial<Record<CraftId, number>>; known: string[]; n: number; spark?: boolean }
export const CRAFT_DAYS: Record<CraftId, number> = { refine: 2, alchemy: 3, talisman: 1, formation: 2, beast: 3, farming: 5, geomancy: 3, divination: 1, puppet: 3, poison: 2 };
// Born gifts: Pill Destiny, Solar Flame and Myriad Poison bodies are natural alchemists; Solar Flame also refines well.
export function talentBonus(save: SaveGame, c: CraftId): number {
    const ch = save.char; let b = 0;
    if (c === 'alchemy' && (ch.fateName === 'Pill Destiny' || ch.physique === 'Solar Flame Body' || ch.physique === 'Myriad Poison Body')) b += 0.1;
    if (c === 'refine' && ch.physique === 'Solar Flame Body') b += 0.1;
    return b;
}
export const START_CRAFT: CraftState = { xp: { refine: 0, alchemy: 0, talisman: 0 }, known: ['t-spark'], n: 0 };
export const getCraft = (s: SaveGame): CraftState => s.craft ?? START_CRAFT;
export const CRAFT_INFO: Record<CraftId, { name: string; icon: string; blurb: string }> = {
    refine: { name: 'Refining', icon: '⚱️', blurb: 'Purify ore and beast cores at a crucible, forge charms and pendants.' },
    alchemy: { name: 'Alchemy', icon: '⚗️', blurb: 'Brew pills and draughts from herbs in a furnace.' },
    talisman: { name: 'Talismans', icon: '📜', blurb: 'Draw talismans in cinnabar ink. Teachers in every town pass on the basics.' },
    formation: { name: 'Formations', icon: '🀄', blurb: 'Lay arrays: gather qi to cultivate faster, guard arrays and trap arrays for fights. Anyone can learn it.' },
    beast: { name: 'Beast Taming', icon: '🐉', blurb: 'Feed and call spirit beasts: a happy beast speeds your cultivation and carries you on journeys.' },
    farming: { name: 'Spirit Farming', icon: '🌱', blurb: 'Grow spirit herbs and fruits. Turns one herb into several, and feeds the whole alchemy chain.' },
    geomancy: { name: 'Geomancy', icon: '🧭', blurb: 'Read the land: dowse springs, ore seams and jade, and chart qi veins to cultivate on.' },
    divination: { name: 'Divination', icon: '🔮', blurb: 'Cast fate slips: a better chance at a breakthrough, and a look at what heaven thinks of you.' },
    puppet: { name: 'Puppetry', icon: '🤖', blurb: 'Build puppets that guard you in a fight or dig for stones while you cultivate.' },
    poison: { name: 'Poison and Gu', icon: '☠️', blurb: 'The demonic craft: venoms for the field and blood gu that burn lifespan-hungry power into you. Dark marks stay.' },
};
export const SKILL_NAMES = ['Novice', 'Apprentice', 'Journeyman', 'Adept', 'Master', 'Grandmaster'];
// Depth state for the seven newer crafts (persistent beast, farm plots, puppets, study times, reputation).
export interface CraftDepth {
    study?: Record<string, number>;                 // recipe id -> game day the study ends
    rep?: Partial<Record<CraftId, number>>;         // craft reputation points
    beast?: { kind: string; name: string; rlm?: number; xp: number; stage: number; shedAt: number; fedAt: number } | null;
    plots?: ({ crop: string; at: number; q: number } | null)[];
    puppets?: { kind: 'guard' | 'miner'; hp: number }[];
    mineAt?: number;
    surveyed?: Record<string, number>;              // city id -> day
    contractAt?: number;
    lifeSpent?: number;                             // years paid for divination
    sites?: Record<string, number>;                 // city id -> day a dwelling site was charted
    cave?: { at: string; day: number } | null;      // the claimed cave dwelling
    ordTaken?: Partial<Record<CraftId, number>>;    // craft -> month index in which a client request was taken (one per month)
    orders?: Partial<Record<CraftId, { recipeId: string; out: string; qty: number; pay: number; month: number } | null>>; // the request in hand, fixed when taken
}
export const getCx = (save: SaveGame): CraftDepth => save.cx ?? {};
export const knows = (save: SaveGame, id: string) => getCraft(save).known.includes(id) || (getCx(save).study?.[id] ?? Infinity) <= save.clockDays;
export const studying = (save: SaveGame, id: string) => { const d = getCx(save).study?.[id]; return d !== undefined && d > save.clockDays ? Math.ceil(d - save.clockDays) : 0; };
export const REP_TITLES = ['Unknown', 'Known', 'Respected', 'Renowned', 'Legend'];
export const repTier = (save: SaveGame, c: CraftId) => { const r = getCx(save).rep?.[c] ?? 0; return r >= 150 ? 4 : r >= 60 ? 3 : r >= 20 ? 2 : r >= 5 ? 1 : 0; };
export const addRep = (save: SaveGame, c: CraftId, n = 1): SaveGame => ({ ...save, cx: { ...getCx(save), rep: { ...getCx(save).rep, [c]: (getCx(save).rep?.[c] ?? 0) + n } } });
// The seven newer crafts need study time on top of the teacher's fee (or a cheaper book and twice the time).
export const NEW_CRAFTS: CraftId[] = ['formation', 'beast', 'farming', 'geomancy', 'divination', 'puppet', 'poison'];
export const studyDays = (r: { learnFee?: number; level: number; craft: CraftId }, via: 'teacher' | 'book') => {
    if (!NEW_CRAFTS.includes(r.craft) || !(r.learnFee ?? 0)) return 0;
    const d = Math.ceil((r.learnFee ?? 0) / 6) + 3 * r.level + 2;
    return via === 'book' ? d * 2 : d;
};
export const bookFee = (fee: number) => Math.max(5, Math.ceil(fee * 0.4));
export const skillLevel = (save: SaveGame, c: CraftId) => Math.min(5, Math.floor(Math.sqrt((getCraft(save).xp[c] ?? 0) / 6)));

export interface Recipe { id: string; craft: CraftId; name: string; inputs: Record<string, number>; tool?: string; out: string; level: number; realm?: number; base: number; learnFee?: number; qty?: number; gear?: { kind: Kind; grade: number } }
export const RECIPES: Recipe[] = [
    { id: 'r-iron', craft: 'refine', name: 'Refine iron', inputs: { 'iron-ore': 2 }, tool: 'crucible', out: 'refined-iron', level: 0, base: 0.85 },
    { id: 'r-m-artifact', craft: 'refine', name: 'Refine a first artifact (flying raft)', inputs: { 'refined-iron': 5, 'spirit-ore': 3, core: 1 }, tool: 'crucible', out: 'artifact', level: 1, base: 0.6, gear: { kind: 'artifact', grade: 0 } },
    { id: 'r-ingot', craft: 'refine', name: 'Smelt spirit ingots', inputs: { 'spirit-ore': 3 }, tool: 'crucible', out: 'spirit-ingot', level: 1, base: 0.75 },
    { id: 'r-s-artifact', craft: 'refine', name: 'Refine a Spirit-grade artifact', inputs: { 'spirit-ingot': 4, 'refined-iron': 4, 'core-essence': 2 }, tool: 'crucible', out: 'artifact', level: 3, base: 0.5, gear: { kind: 'artifact', grade: 1 } },
    { id: 'r-essence', craft: 'refine', name: 'Refine a beast core to essence', inputs: { core: 2 }, tool: 'crucible', out: 'core-essence', level: 1, base: 0.7 },
    { id: 'r-charm', craft: 'refine', name: 'Forge an iron charm', inputs: { 'refined-iron': 2, 'beast-hide': 1 }, tool: 'crucible', out: 'iron-charm', level: 1, base: 0.75, gear: { kind: 'charm', grade: 0 } },
    { id: 'r-pendant', craft: 'refine', name: 'Carve a jade pendant', inputs: { 'cold-jade': 2, 'refined-iron': 1 }, tool: 'crucible', out: 'jade-pendant', level: 2, base: 0.65, gear: { kind: 'charm', grade: 1 } },
    { id: 'r-g-robe', craft: 'refine', name: 'Sew a Spirit-grade robe', inputs: { silk: 2, 'beast-hide': 2 }, tool: 'crucible', out: 'robe', level: 2, base: 0.65, gear: { kind: 'robe', grade: 1 } },
    { id: 'r-g-boots', craft: 'refine', name: 'Make Spirit-grade boots', inputs: { 'beast-hide': 4, 'spirit-spring': 2 }, tool: 'crucible', out: 'boots', level: 2, base: 0.65, gear: { kind: 'boots', grade: 1 } },
    { id: 'r-g-sword', craft: 'refine', name: 'Forge a Spirit-grade blade', inputs: { 'refined-iron': 4, 'cold-jade': 1 }, tool: 'crucible', out: 'weapon', level: 3, base: 0.6, gear: { kind: 'weapon', grade: 1 } },
    { id: 'r-g-ring', craft: 'refine', name: 'Cut a Spirit-grade ring', inputs: { 'cold-jade': 2, 'star-silver': 1 }, tool: 'crucible', out: 'ring', level: 3, base: 0.6, gear: { kind: 'ring', grade: 1 } },
    { id: 'r-g-focus', craft: 'refine', name: 'Forge an Earth-grade focus', inputs: { 'star-silver': 3, 'core-essence': 2 }, tool: 'crucible', out: 'focus', level: 4, base: 0.55, gear: { kind: 'focus', grade: 2 } },
    { id: 'r-g-treasure', craft: 'refine', name: 'Refine an Earth-grade treasure', inputs: { 'star-silver': 4, 'core-essence': 3, ginseng: 1 }, tool: 'crucible', out: 'treasure', level: 4, base: 0.5, gear: { kind: 'treasure', grade: 2 } },
    { id: 'r-g-robe3', craft: 'refine', name: 'Weave an Earth-grade robe', inputs: { silk: 6, 'star-silver': 2, 'core-essence': 2 }, tool: 'crucible', out: 'robe', level: 4, base: 0.5, gear: { kind: 'robe', grade: 2 } },
    { id: 'r-g-artifact', craft: 'refine', name: 'Refine a Heaven-grade artifact', inputs: { 'star-silver': 10, 'core-essence': 8, ginseng: 3 }, tool: 'crucible', out: 'artifact', level: 5, base: 0.4, gear: { kind: 'artifact', grade: 3 } },
    { id: 'a-qi', craft: 'alchemy', name: 'Brew a Qi Gathering Pill', inputs: { herb: 2 }, tool: 'pill-furnace', out: 'qi-pill', level: 0, base: 0.7 },
    { id: 'a-detox', craft: 'alchemy', name: 'Brew a Detox Pill', inputs: { herb: 2, 'bitter-root': 1 }, tool: 'pill-furnace', out: 'detox-pill', level: 0, base: 0.75 },
    { id: 'a-draught', craft: 'alchemy', name: 'Brew a Calming Draught', inputs: { herb: 2, 'spirit-spring': 1, moonblossom: 1 }, tool: 'pill-furnace', out: 'deviation-draught', level: 1, base: 0.65 },
    { id: 't-spark', craft: 'talisman', name: 'Draw a Spark Talisman', inputs: { 'talisman-paper': 1, cinnabar: 1 }, out: 'spark-tal', level: 0, base: 0.8, learnFee: 0 },
    { id: 't-swift', craft: 'talisman', name: 'Draw a Swift-step Talisman', inputs: { 'talisman-paper': 1, cinnabar: 1, 'beast-hide': 1 }, out: 'swift-tal', level: 1, base: 0.7, learnFee: 30 },
    { id: 'f-qi', craft: 'formation', name: 'Lay a Gather-Qi Array', inputs: { 'cold-jade': 1, 'spirit-spring': 1, cinnabar: 1 }, tool: 'array-flags', out: 'qi-array', level: 0, base: 0.75, learnFee: 20 },
    { id: 'f-guard', craft: 'formation', name: 'Lay a Guard Array', inputs: { 'refined-iron': 1, cinnabar: 1, 'spirit-spring': 1 }, tool: 'array-flags', out: 'guard-array', level: 1, base: 0.7, learnFee: 40 },
    { id: 'f-trap', craft: 'formation', name: 'Set a Trap Array', inputs: { 'iron-ore': 2, cinnabar: 1 }, tool: 'array-flags', out: 'trap-array', level: 1, base: 0.7, learnFee: 40 },
    { id: 'b-snack', craft: 'beast', name: 'Prepare spirit beast feed', inputs: { herb: 2, 'beast-hide': 1 }, tool: 'taming-rope', out: 'beast-snack', level: 0, base: 0.8, learnFee: 20 },
    { id: 'b-whistle', craft: 'beast', name: 'Carve a calling whistle', inputs: { 'cold-jade': 1, 'beast-hide': 1 }, tool: 'taming-rope', out: 'beast-whistle', level: 1, base: 0.7, learnFee: 40 },
    { id: 'b-core', craft: 'beast', name: 'Coax a beast to shed a core', inputs: { 'beast-snack': 2 }, tool: 'taming-rope', out: 'core', level: 2, base: 0.5, learnFee: 60 },
    { id: 'geo-spring', craft: 'geomancy', name: 'Dowse a spirit spring', inputs: {}, tool: 'geo-compass', out: 'spirit-spring', qty: 3, level: 0, base: 0.8, learnFee: 20 },
    { id: 'geo-ore', craft: 'geomancy', name: 'Locate a spirit ore seam', inputs: {}, tool: 'geo-compass', out: 'spirit-ore', qty: 2, level: 1, base: 0.65, learnFee: 40 },
    { id: 'geo-jade', craft: 'geomancy', name: 'Dig out cold jade', inputs: {}, tool: 'geo-compass', out: 'cold-jade', qty: 2, level: 2, base: 0.6, learnFee: 60 },
    { id: 'geo-site', craft: 'geomancy', name: 'Chart a cultivation site', inputs: { 'jade-slip': 1 }, tool: 'geo-compass', out: 'site-map', level: 2, base: 0.6, learnFee: 60 },
    { id: 'd-slip', craft: 'divination', name: 'Cast a fate slip', inputs: { 'jade-slip': 1, cinnabar: 1 }, tool: 'divining-shells', out: 'fate-slip', level: 0, base: 0.75, learnFee: 20 },
    { id: 'd-heaven', craft: 'divination', name: "Cast a heaven's-eye slip", inputs: { 'jade-slip': 1, cinnabar: 2, 'spirit-spring': 1 }, tool: 'divining-shells', out: 'heaven-slip', level: 3, base: 0.5, learnFee: 100 },
    { id: 'f-ward', craft: 'formation', name: 'Lay a Ward Array', inputs: { 'iron-ore': 2, cinnabar: 1, 'spirit-spring': 1 }, tool: 'array-flags', out: 'ward-array', level: 2, base: 0.65, learnFee: 60 },
    { id: 'f-escape', craft: 'formation', name: 'Lay an Illusion Escape Array', inputs: { 'cold-jade': 1, cinnabar: 2, 'jade-slip': 1 }, tool: 'array-flags', out: 'escape-array', level: 3, base: 0.5, learnFee: 100 },
    { id: 'p-guard', craft: 'puppet', name: 'Build a guard puppet', inputs: { 'refined-iron': 2, 'beast-hide': 1 }, tool: 'puppet-bench', out: 'guard-puppet', level: 0, base: 0.75, learnFee: 30 },
    { id: 'p-miner', craft: 'puppet', name: 'Build a mining puppet', inputs: { 'refined-iron': 3, 'spirit-ore': 1 }, tool: 'puppet-bench', out: 'miner-puppet', level: 2, base: 0.6, learnFee: 60 },
    { id: 'x-venom', craft: 'poison', name: 'Distil viper venom', inputs: { 'bitter-root': 2, herb: 1 }, tool: 'venom-jar', out: 'viper-venom', level: 0, base: 0.75, learnFee: 20 },
    { id: 'x-gu', craft: 'poison', name: 'Raise a blood gu', inputs: { core: 1, 'bitter-root': 1, herb: 2 }, tool: 'venom-jar', out: 'blood-gu', level: 2, base: 0.55, learnFee: 80 },
    { id: 't-ward', craft: 'talisman', name: 'Draw a Ward Talisman', inputs: { 'talisman-paper': 2, cinnabar: 1 }, out: 'ward-tal', level: 1, base: 0.7, learnFee: 40 },
];
export const recipeChance = (save: SaveGame, r: Recipe) => Math.max(0.1, Math.min(0.95, r.base + 0.02 * repTier(save, r.craft) + (r.craft === 'poison' && save.char.alignment === 'demonic' ? 0.08 : 0) + 0.06 * (skillLevel(save, r.craft) - r.level) + talentBonus(save, r.craft) + gearEffect(save, 'craft') + (r.craft === 'alchemy' && getCraft(save).spark ? 0.15 : 0)));
// Realm ceiling: a crafter only makes things of their own cultivation realm or lower. Skill never lifts the ceiling.
export const realmReq = (level: number) => Math.max(0, level - 1);
export function realmGate(save: SaveGame, level: number, realm?: number): string | null {
    const need = realm ?? realmReq(level), have = currentCult(save).realm;
    return have >= need ? null : `Beyond your realm: this needs ${REALM_NAMES[need]} or higher (you are ${REALM_NAMES[have]}).`;
}
export function missing(save: SaveGame, r: Recipe): string | null {
    const gate = realmGate(save, r.level, r.realm); if (gate) return gate;
    const items = getEco(save).items;
    if (r.tool && (items[r.tool] ?? 0) < 1) return `Requires: ${itemById(r.tool)?.name ?? 'a tool'}.`;
    if (skillLevel(save, r.craft) < r.level) return `Needs ${SKILL_NAMES[r.level]} ${CRAFT_INFO[r.craft].name}.`;
    if (r.learnFee !== undefined && !knows(save, r.id)) return studying(save, r.id) ? `Still studying: ${studying(save, r.id)} days left.` : 'Not learned yet.';
    for (const [id, n] of Object.entries(r.inputs)) if ((items[id] ?? 0) < n) return `Needs ${n} ${itemById(id)?.name} (you have ${items[id] ?? 0}).`;
    return null;
}
function unit(save: SaveGame, n: number): number {
    let h = 2166136261; const k = `${save.seed}|craft|${n}`;
    for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
}
export function learnRecipe(save: SaveGame, r: Recipe, via: 'teacher' | 'book' = 'teacher'): { save: SaveGame; msg: string } {
    const c = getCraft(save);
    if (knows(save, r.id)) return { save, msg: 'You already know it.' };
    if (studying(save, r.id)) return { save, msg: `You are already studying it: ${studying(save, r.id)} days left.` };
    if ((via as string) === 'book') return { save, msg: 'Books are bought from a market that stocks them, then read from your pack.' };
    const days = studyDays(r, via);
    const rt = repTier(save, r.craft), cut = rt >= 3 ? 0.25 : rt >= 2 ? 0.15 : 0; // standing perk: teachers charge less
    const fee = Math.round((via === 'book' && days ? bookFee(r.learnFee ?? 0) : (r.learnFee ?? 0)) * (1 - cut));
    const paid = fee ? pay(save, fee) : save;
    if (!paid) return { save, msg: `${via === 'book' ? 'The bookseller' : 'The teacher'} asks ${fee} spirit stones.` };
    if (days) return { save: { ...paid, cx: { ...getCx(paid), study: { ...getCx(paid).study, [r.id]: Math.ceil(paid.clockDays + days) } } }, msg: `📖 You ${via === 'book' ? `buy a manual for ${fee} stones and study it` : `pay ${fee} stones and study under a teacher`}. It will take ${days} days.` };
    return { save: { ...paid, craft: { ...c, known: [...c.known, r.id] } }, msg: `📜 A local teacher passes on the ${itemById(r.out)?.name}${fee ? ` for ${fee} stones` : ''}.` };
}
export function craftIt(save: SaveGame, r: Recipe): { save: SaveGame; msg: string } {
    if (save.travel || save.exp) return { save, msg: 'You cannot work while on the road or inside a realm.' };
    const why = missing(save, r);
    if (why) return { save, msg: why };
    const c = getCraft(save), eco = getEco(save);
    const items = { ...eco.items };
    for (const [id, n] of Object.entries(r.inputs)) items[id] = (items[id] ?? 0) - n;
    const ok = unit(save, c.n) < recipeChance(save, r);
    let saved = ''; // Renowned workers salvage something from a spoiled batch
    if (!ok && repTier(save, r.craft) >= 3) { const top = Object.entries(r.inputs).sort((a, b) => b[1] - a[1])[0]; if (top) { items[top[0]] = (items[top[0]] ?? 0) + 1; saved = ` Your standing saves 1 ${itemById(top[0])?.name ?? top[0]} from the wreck.`; } }
    const repGain = ok && NEW_CRAFTS.includes(r.craft);
    const before = skillLevel(save, r.craft);
    let s: SaveGame = { ...save, eco: { ...eco, items }, craft: { ...c, n: c.n + 1, spark: r.craft === 'alchemy' ? false : c.spark, xp: { ...c.xp, [r.craft]: (c.xp[r.craft] ?? 0) + (ok ? 4 : 1.5) } } };
    const days = CRAFT_DAYS[r.craft];
    const stepped = applyCultivationStep(s, days, Boolean(s.membership));
    s = { ...stepped, clockDays: stepped.dead ? stepped.dead.atDays : s.clockDays + days };
    if (s.dead) return { save: s, msg: '☠️ Your body gave out while you worked.' };
    if (ok) s = bump(s, 'craft');
    if (repGain) s = addRep(s, r.craft, 1);
    if (ok) s = r.gear ? addGear(s, makeGear(`${s.seed}|${c.n}|${r.id}`, r.gear.kind, r.gear.grade, r.id === 'r-charm' ? 'Iron Charm' : r.id === 'r-pendant' ? 'Jade Pendant' : undefined)) : addItem(s, r.out, r.qty ?? 1);
    const lv = skillLevel(s, r.craft);
    const up = lv > before ? ` You are now ${SKILL_NAMES[lv]} in ${CRAFT_INFO[r.craft].name}.` : '';
    return { save: s, msg: ok ? `${CRAFT_INFO[r.craft].icon} Success: ${r.qty && r.qty > 1 ? `${r.qty} x ` : ''}${itemById(r.out)?.name}. (${days} day${days === 1 ? '' : 's'})${up}` : `💨 The batch spoils. You lose the materials but learn from it.${saved}${up}` };
}

// Consumables that act on you.
export function useItem(save: SaveGame, id: string): { save: SaveGame; msg: string } {
    if (id.startsWith('book-')) return hooks.readManual ? hooks.readManual(save, id) : { save, msg: 'You cannot read that yet.' };
    const eco = getEco(save);
    if ((eco.items[id] ?? 0) < 1) return { save, msg: 'You have none.' };
    const spent = { ...save, eco: { ...eco, items: { ...eco.items, [id]: eco.items[id] - 1 } } };
    if (id === 'detox-pill') return { save: { ...spent, eco: { ...spent.eco!, tox: Math.max(0, eco.tox - 3) } }, msg: '🟤 The poison drains out of you. Toxicity down.' };
    if (id === 'deviation-draught') { const c = { ...currentCult(save), weak: 0 }; return { save: { ...spent, cult: c }, msg: '🧪 Your qi runs clear again. The deviation is gone.' }; }
    if (id === 'core-essence') {
        const c = { ...currentCult(save) };
        if (c.gate) return { save, msg: 'You are at the threshold. Attempt the breakthrough instead.' };
        const gain = cultGain(save, 0.3, 200);
        c.progress = Math.min(stageCost(c.realm, c.stage) - 1, c.progress + gain);
        return { save: { ...spent, cult: c }, msg: `💠 Pure qi floods your dantian: +${gain} cultivation base, no toxicity.` };
    }
    if (id === 'swift-tal') { if (save.swift) return { save, msg: 'A swift-step talisman is already active.' }; return { save: { ...spent, swift: true }, msg: '👣 Light flows into your legs. Your next journey takes 30% less time.' }; }
    if (id === 'spark-tal') { const c = getCraft(save); if (c.spark) return { save, msg: 'The furnace is already lit with a spark.' }; return { save: { ...spent, craft: { ...c, spark: true } }, msg: '🔥 You light the furnace with a spark: your next brew gets +15%.' }; }
    const addBuff = (k: string, line: string): { save: SaveGame; msg: string } => {
        if (buffOn(save, k)) return { save, msg: `${BUFF_INFO[k].name} is already working on you.` };
        return { save: { ...spent, buffs: { ...(save.buffs ?? {}), [k]: save.clockDays + BUFF_INFO[k].days } }, msg: line };
    };
    if (id === 'ward-array') return addBuff('ward', '🛖 The ward settles over you. Trouble on the road finds you 40% less often for 90 days.');
    if (id === 'escape-array') return addBuff('escape', '🌀 The array is set. It will carry you past the guardian of your next deep realm.');
    if (id === 'guard-puppet') { const r = deployPuppet(save, 'guard'); return r; }
    if (id === 'miner-puppet') { const r = deployPuppet(save, 'miner'); return r; }
    if (id === 'spirit-fruit') {
        const c = { ...currentCult(save) };
        if (c.gate) return { save, msg: 'You are at the threshold. Attempt the breakthrough instead.' };
        const gain = cultGain(save, 0.3, 200); c.progress = Math.min(stageCost(c.realm, c.stage) - 1, c.progress + gain);
        return { save: { ...spent, cult: c }, msg: `🍑 Sweet qi floods you. +${gain} cultivation base.` };
    }
    if (id === 'qi-array') return addBuff('qiarray', '🀄 The array hums around you. Cultivation +30% for 60 days.');
    if (id === 'beast-snack') return addBuff('bond', '🐉 Your beast eats well and stays close. Cultivation +12% for 30 days.');
    if (id === 'site-map') return addBuff('vein', '🧭 You settle on the charted vein. Cultivation +20% for 90 days.');
    if (id === 'fate-slip') { const r = addBuff('foresight', `🎴 The slip shows a clear road. Breakthrough chance +10% for 60 days (now ${Math.round((breakthroughChance({ ...save, buffs: { ...(save.buffs ?? {}), foresight: save.clockDays + 60 } }) * 100))}%).`); return r; }
    if (id === 'heaven-slip') {
        const next = currentCult(save).realm + 1;
        const trib = tribulationWaves(next) > 0 ? `The coming tribulation: you survive all waves about ${Math.round(tribulationOdds(save) * 100)}% of the time.` : 'No tribulation waits at the next realm.';
        return { save: spent, msg: `👁️ Heaven's attention on you: ${heavenWord(save)} (${heavenOf(save).toFixed(1)}). ${trib} Risk of death if you break through now: ${Math.round(deathRisk(save) * 100)}%.` };
    }
    if (id === 'beast-whistle') { if (save.swift) return { save, msg: 'A beast is already waiting for your next journey.' }; return { save: { ...spent, swift: true }, msg: '🎺 A beast answers the whistle. Your next journey takes 30% less time.' }; }
    if (id === 'blood-gu') {
        const c = { ...currentCult(save) };
        if (c.gate) return { save, msg: 'You are at the threshold. Attempt the breakthrough instead.' };
        const gain = cultGain(save, 0.4, 300);
        c.progress = Math.min(stageCost(c.realm, c.stage) - 1, c.progress + gain);
        const eco2 = { ...spent.eco!, tox: spent.eco!.tox + 4 };
        const flags = Array.from(new Set([...(save.evflags ?? []), 'dark-craft']));
        return { save: addKarma({ ...spent, cult: c, eco: eco2, evflags: flags }, -6, 'swallowed a blood gu'), msg: `🩸 The gu feeds on you and gives back power: +${gain} cultivation base, toxicity +4. Something dark settles on your name.` };
    }
    return { save, msg: 'Nothing to do with it here. Sell it, or keep it for later.' };
}
export const USABLE = ['detox-pill', 'deviation-draught', 'core-essence', 'swift-tal', 'spark-tal', 'qi-array', 'beast-snack', 'site-map', 'fate-slip', 'heaven-slip', 'beast-whistle', 'miner-puppet', 'blood-gu', 'guard-puppet', 'ward-array', 'escape-array', 'spirit-fruit'];
