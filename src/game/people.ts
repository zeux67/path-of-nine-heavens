// Townsfolk: a few named locals in every town. Befriend them for favours. No combat.
import { sectTick, getSect } from './sect';
const putSect = (s: SaveGame, o: import('./sect').OwnSect): SaveGame => ({ ...s, ownSect: o } as SaveGame);
import { dutyTick } from './duties';
import { wealthTick } from './wealth';
import type { SaveGame } from './state';
import type { City } from './world';
import { GIVEN_NAMES, SURNAMES } from './data';
import { addItem, addStones, getEco, pay } from './economy';
import { currentCult, stageCost, cultGain } from './cultivation';
import { maybeOffer } from './quests';
import { makeGear, addGear } from './gear';
import { A } from './grammar';

export type Role = 'herbalist' | 'smith' | 'hermit' | 'trader' | 'teacher' | 'hunter' | 'miner' | 'healer' | 'wanderer';
export interface Person { id: string; name: string; role: Role; cityId: string; trait?: string }
export interface Bond { aff: number; lastChat: number; favour: boolean }
export const ROLE_INFO: Record<Role, { icon: string; title: string; favour: string }> = {
    herbalist: { icon: '🌿', title: 'Herbalist', favour: 'gives you a bundle of herbs' },
    smith: { icon: '🔨', title: 'Smith', favour: 'hands over refined iron' },
    hermit: { icon: '🧓', title: 'Retired cultivator', favour: 'shares a hard-won insight' },
    trader: { icon: '🧳', title: 'Trader', favour: 'slips you a tip worth stones' },
    teacher: { icon: '📜', title: 'Talisman teacher', favour: 'teaches you the Ward Talisman for free' },
    hunter: { icon: '🏹', title: 'Beast hunter', favour: 'gives you hides and a beast core from his kills' },
    miner: { icon: '⛏️', title: 'Vein miner', favour: 'gives you spirit ore from his best seam' },
    healer: { icon: '🩺', title: 'Wandering healer', favour: 'mends your meridians and draws out poison' },
    wanderer: { icon: '🎒', title: 'Wanderer', favour: 'gives you a keepsake from his travels' },
};
const ROLES: Role[] = ['herbalist', 'smith', 'hermit', 'trader', 'teacher'];
const ALL_ROLES: Role[] = [...ROLES, 'hunter', 'miner', 'healer', 'wanderer'];
const TRAITS = ['gruff', 'cheerful', 'weary', 'sharp-eyed', 'soft-spoken', 'boastful', 'scarred', 'young and eager', 'old and wry', 'suspicious', 'generous', 'superstitious'];
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const FAVOUR_AT = 5, SWORN_AT = 10;
export const bondsOf = (s: SaveGame): Record<string, Bond> => s.bonds ?? {};

// A bigger, random roster per town, made lazily and cached. The first few keep the old ids and roles so saves stay valid.
const rosterCache = new Map<string, Person[]>();
export function peopleIn(city: City): Person[] {
    const hit = rosterCache.get(city.id); if (hit) return hit;
    const n = [3, 5, 7, 10][city.marketTier] ?? 3, old = city.marketTier === 0 ? 1 : city.marketTier === 1 ? 2 : 3;
    const out: Person[] = [];
    const used = new Set<Role>();
    for (let i = 0; i < n; i++) {
        const pool = i < old ? ROLES : ALL_ROLES;
        let role = pool[hash(`${city.id}|p${i}`) % pool.length];
        for (let k = 0; used.has(role) && k < 9; k++) role = pool[(pool.indexOf(role) + 1) % pool.length];
        used.add(role);
        const h = hash(`${city.id}|n${i}`);
        out.push({ id: `${city.id}|${i}`, name: `${SURNAMES[h % SURNAMES.length]} ${GIVEN_NAMES[(h >>> 7) % GIVEN_NAMES.length]}`, role, cityId: city.id, trait: TRAITS[(h >>> 15) % TRAITS.length] });
    }
    rosterCache.set(city.id, out);
    return out;
}
const setBond = (s: SaveGame, id: string, b: Bond): SaveGame => ({ ...s, bonds: { ...bondsOf(s), [id]: b } });
export const bondOf = (s: SaveGame, p: Person): Bond => bondsOf(s)[p.id] ?? { aff: 0, lastChat: -999, favour: false };
export const bondWord = (aff: number) => aff >= SWORN_AT ? 'Sworn friend' : aff >= FAVOUR_AT ? 'Friend' : aff >= 2 ? 'Friendly' : aff >= 1 ? 'Acquaintance' : 'Stranger';

export function chat(save: SaveGame, p: Person): { save: SaveGame; msg: string } {
    const b = bondOf(save, p);
    if (save.clockDays - b.lastChat < 30) return { save, msg: `${p.name} has said all they care to this month.` };
    const talked = setBond(save, p.id, { ...b, aff: b.aff + 1, lastChat: save.clockDays });
    const o = maybeOffer(talked, p);
    return { save: o.save, msg: `💬 You spend an evening with ${p.name}${p.trait ? `, ${A(p.trait)} sort` : ''}. Friendship grows.${o.line ? ' ' + o.line : ''}` };
}
export const GIFT = 10;
export function gift(save: SaveGame, p: Person): { save: SaveGame; msg: string } {
    if (save.clockDays - ((bondOf(save, p) as any).giftAt ?? -999) < 7) return { save, msg: `${p.name} has only just received a gift. Wait a week or so.` };
    const paid = pay(save, GIFT);
    if (!paid) return { save, msg: `A gift costs ${GIFT} spirit stones.` };
    return { save: setBond(paid, p.id, { ...bondOf(save, p), aff: bondOf(save, p).aff + 2, giftAt: save.clockDays } as any), msg: `🎁 ${p.name} accepts your gift with a warm smile.` };
}
export function askFavour(save: SaveGame, p: Person): { save: SaveGame; msg: string } {
    const b = bondOf(save, p);
    if (b.aff < FAVOUR_AT) return { save, msg: `${p.name} does not know you well enough yet.` };
    if (b.favour) return { save, msg: `${p.name} has already done what they can for you.` };
    let s = save, line = '';
    if (p.role === 'herbalist') { s = addItem(s, 'herb', 6); line = '6 Spirit Herb'; }
    else if (p.role === 'smith') { s = addItem(s, 'refined-iron', 3); line = '3 Refined Iron'; }
    else if (p.role === 'trader') { const g = Math.round(60 * (1 + currentCult(s).realm * 0.6)); s = addStones(s, g); line = `${g} stones`; }
    else if (p.role === 'hermit') {
        const c = { ...currentCult(s) };
        if (c.gate) return { save, msg: `${p.name} says: "You are at the threshold. Break through first."` };
        const gain = cultGain(s, 0.25, 360); c.progress = Math.min(stageCost(c.realm, c.stage) - 1, c.progress + gain); s = { ...s, cult: c }; line = `${gain} cultivation base`;
    } else if (p.role === 'hunter') { s = addItem(addItem(s, 'beast-hide', 3), 'core', 1); line = '3 Beast Hide and a Beast Core'; }
    else if (p.role === 'miner') { s = addItem(s, 'spirit-ore', 3); line = '3 Spirit Ore'; }
    else if (p.role === 'healer') { const c = { ...currentCult(s), weak: 0 }; s = { ...s, cult: c, eco: { ...getEco(s), tox: Math.max(0, getEco(s).tox - 4) } }; line = 'your weakness and some toxicity gone'; }
    else if (p.role === 'wanderer') { const g = makeGear(`${s.seed}|${p.id}|keep`, 'artifact', 0); s = addGear(s, g); line = `${g.name} (see Gear)`; }
    else { s = { ...s, craft: { ...(s.craft ?? { xp: { refine: 0, alchemy: 0, talisman: 0 }, known: ['t-spark'], n: 0 }), known: Array.from(new Set([...(s.craft?.known ?? ['t-spark']), 't-ward'])) } }; line = 'the Ward Talisman'; }
    void getEco;
    return { save: setBond(s, p.id, { ...b, favour: true }), msg: `🤝 ${p.name} ${ROLE_INFO[p.role].favour}: ${line}.` };
}

const RUMOURS = [
    'A sealed cave is said to open somewhere in the next prefecture when the moon is dark.',
    'Merchants say the road beasts are bolder this season. Pack a ward.',
    'An old cultivator pays well for spirit ore, quietly, no questions.',
    'Someone saw a hidden market in the hills. Only the lucky find it twice.',
    'The sects are recruiting again. Strong backs are welcome, strong roots more so.',
];
// Share wine: a friend tells a rumour; costs a little, once every 15 days per person.
export function shareWine(save: SaveGame, p: Person): { save: SaveGame; msg: string } {
    const b = bondOf(save, p) as any;
    if (b.aff < 2) return { save, msg: `${p.name} is not yet friend enough to drink with.` };
    if (save.clockDays - (b.wine ?? -999) < 15) return { save, msg: `${p.name} has had enough wine for a fortnight.` };
    const paid = pay(save, 5); if (!paid) return { save, msg: 'A jar of wine costs 5 spirit stones.' };
    const line = RUMOURS[Math.floor(hash(`${save.seed}|wine|${p.id}|${Math.floor(save.clockDays)}`) % RUMOURS.length)] as string;
    return { save: setBond(paid, p.id, { ...b, aff: b.aff + 1, wine: save.clockDays }), msg: `🍶 You share wine with ${p.name}. They lean in: "${line}"` };
}
// Swap pointers: a close friend shows you something. Once every 90 days per person.
export function swapPointers(save: SaveGame, p: Person): { save: SaveGame; msg: string } {
    const b = bondOf(save, p) as any;
    if (b.aff < FAVOUR_AT) return { save, msg: `${p.name} does not know you well enough yet.` };
    if (save.clockDays - (b.pointers ?? -999) < 90) return { save, msg: `You have traded all you can with ${p.name} for now.` };
    const c = { ...currentCult(save) };
    if (c.gate) return { save, msg: 'You are at the threshold. Break through first.' };
    const cost = stageCost(c.realm, c.stage); const gain = cultGain(save, 0.06, 30);
    c.progress = Math.min(cost - 1, c.progress + gain);
    return { save: setBond({ ...save, cult: c }, p.id, { ...b, aff: b.aff + 1, pointers: save.clockDays }), msg: `🧠 You and ${p.name} trade pointers until dawn. Your cultivation moves (+${gain}).` };
}

// ---- Dao companion and disciples ----
export interface Companion { name: string; role: Role; sinceDays: number; lastDual: number; realm?: number; duals?: number }
export interface Disciple { name: string; sinceDays: number; talent: number; realm?: number; xp?: number; taught?: number }
export const DUAL_COOLDOWN = 90;
export const MAX_DISCIPLES = 3;
export const DISCIPLE_FEE = 50;
export function inviteCompanion(save: SaveGame, p: Person): { save: SaveGame; msg: string } {
    if (save.companion) return { save, msg: `You already walk the Dao with ${save.companion.name}.` };
    if (bondOf(save, p).aff < SWORN_AT) return { save, msg: `${p.name} is not yet close enough to you.` };
    return { save: { ...save, companion: { name: p.name, role: p.role, sinceDays: save.clockDays, lastDual: save.clockDays - DUAL_COOLDOWN, realm: Math.max(0, currentCult(save).realm - 1), duals: 0 } }, msg: `💞 ${p.name} agrees to walk the Dao beside you.` };
}
export function dualCultivate(save: SaveGame): { save: SaveGame; msg: string } {
    const c = save.companion;
    if (!c) return { save, msg: 'You have no companion.' };
    const left = DUAL_COOLDOWN - (save.clockDays - c.lastDual);
    if (left > 0) return { save, msg: `You and ${c.name} must rest ${Math.ceil(left)} more days.` };
    const cu = { ...currentCult(save) };
    if (cu.gate) return { save, msg: 'You are at the threshold. Attempt the breakthrough first.' };
    const duals = (c.duals ?? 0) + 1;
    const cr = Math.min(cu.realm + 1, Math.max(c.realm ?? Math.max(0, cu.realm - 1), Math.max(0, cu.realm - 1)) + (duals % 5 === 0 ? 1 : 0));
    const gain = cultGain(save, 0.2 + Math.min(0.1, (cr - cu.realm + 1) * 0.03 + duals * 0.002), 120);
    cu.progress = Math.min(stageCost(cu.realm, cu.stage) - 1, cu.progress + gain);
    return { save: { ...save, cult: cu, companion: { ...c, lastDual: save.clockDays, duals, realm: cr } }, msg: `💞 Dual cultivation with ${c.name}: +${gain} cultivation base, no toxicity.${cr > (c.realm ?? 0) ? ` ${c.name} reaches realm ${cr}.` : ''}` };
}
export const discipleTribute = (save: SaveGame, d: Disciple) => Math.max(1, Math.round(8 * d.talent * (1 + currentCult(save).realm * 0.6) * (1 + (d.realm ?? 0) * 0.4)));
export const discipleRealm = (d: Disciple) => d.realm ?? 0;
export function instruct(save: SaveGame, i: number): { save: SaveGame; msg: string } {
    const list = (save.disciples ?? []).slice(); const d = list[i]; if (!d) return { save, msg: '' };
    if (save.clockDays - (d.taught ?? -999) < 30) return { save, msg: `${d.name} is still digesting last month's lesson.` };
    const cap = Math.max(0, currentCult(save).realm - 1);
    if (discipleRealm(d) >= cap) return { save, msg: `${d.name} has learned all you can teach at this realm. Rise higher first.` };
    list[i] = { ...d, taught: save.clockDays, xp: (d.xp ?? 0) + 1.5 };
    return { save: { ...save, disciples: list }, msg: `🎓 You instruct ${d.name}.` };
}
// A disciple who reaches realm 3 can be sent to your own sect as an elder.
export function graduateToSect(save: SaveGame, i: number): { save: SaveGame; msg: string } {
    const o = getSect(save); const list = (save.disciples ?? []).slice(); const d = list[i];
    if (!o || !d) return { save, msg: 'You need your own sect for that.' };
    if (discipleRealm(d) < 3) return { save, msg: `${d.name} must reach realm 3 first.` };
    const r = o.roster.slice(); r[discipleRealm(d)] += 1; list.splice(i, 1);
    return { save: { ...(putSect(save, { ...o, roster: r, events: [{ d: save.clockDays, t: `${d.name} joins as an elder (realm ${discipleRealm(d)}).` }, ...o.events].slice(0, 12) })), disciples: list }, msg: `🎓 ${d.name} takes a seat as elder of the ${o.name}.` };
}
function discipleGrow(save: SaveGame, yrs: number): SaveGame {
    const list = save.disciples ?? []; if (!list.length) return save;
    const cap = Math.max(0, currentCult(save).realm - 1);
    return { ...save, disciples: list.map(d => { let xp = (d.xp ?? 0) + d.talent * yrs * 0.5, r = discipleRealm(d); while (r < cap && xp >= 2 + r * 1.5) { xp -= 2 + r * 1.5; r++; } return { ...d, xp, realm: r }; }) };
}
export function takeDisciple(save: SaveGame, city: City): { save: SaveGame; msg: string } {
    const list = save.disciples ?? [];
    if (currentCult(save).realm < 1) return { save, msg: 'Only a Foundation Establishment cultivator can take a disciple.' };
    if (list.length >= MAX_DISCIPLES) return { save, msg: `You already teach ${MAX_DISCIPLES} disciples.` };
    const paid = pay(save, DISCIPLE_FEE);
    if (!paid) return { save, msg: `The family expects a ${DISCIPLE_FEE} stone entry gift for your guidance.` };
    const h = hash(`${save.seed}|${city.id}|disc|${list.length}|${Math.floor(save.clockDays / 360)}`);
    const d: Disciple = { name: `${SURNAMES[h % SURNAMES.length]} ${GIVEN_NAMES[(h >>> 7) % GIVEN_NAMES.length]}`, sinceDays: save.clockDays, talent: Math.round((0.6 + ((h >>> 13) % 90) / 100) * 100) / 100 };
    return { save: { ...paid, disciples: [...list, d] }, msg: `🎓 ${d.name} kneels and becomes your disciple (talent ${d.talent.toFixed(2)}).` };
}
export function dismissDisciple(save: SaveGame, i: number): SaveGame { return { ...save, disciples: (save.disciples ?? []).filter((_, k) => k !== i) }; }
// Disciples send tribute as they grow; a log line each year.
export function householdTick(save: SaveGame, fromDay: number, toDay: number): SaveGame {
    save = wealthTick(save, fromDay, toDay);
    save = sectTick(save, fromDay, toDay);
    save = dutyTick(save);
    if (!(save.disciples ?? []).length || toDay <= fromDay || save.dead) return save;
    const yrs = (toDay - fromDay) / 360;
    save = discipleGrow(save, yrs);
    const list = save.disciples ?? [];
    const total = list.reduce((a, d) => a + discipleTribute(save, d), 0) * yrs;
    let s = addStones(save, total);
    if (Math.floor(fromDay / 360) !== Math.floor(toDay / 360)) s = { ...s, log: [`🎓 Your disciples send tribute: about ${Math.round(list.reduce((a, d) => a + discipleTribute(save, d), 0))} stones this year.`, ...s.log].slice(0, 30) };
    return s;
}
