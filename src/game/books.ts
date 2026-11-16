// Craft manuals: real inventory items stocked by markets. Buy one, then read it from the Bag to start the study
// (twice the teacher's time, at about 40% of the teacher's fee). Reading never costs extra.
import type { SaveGame } from './state';
import { cpId, btId, cpName, cpBase, btBase, MAX_RANK } from './pills';
import { RECIPES, NEW_CRAFTS, CRAFT_INFO, knows, studying, studyDays, bookFee, getCx } from './craft';
import { CROPS } from './crops';
import { ITEMS, CAT_OF, getEco } from './economy';
import { USABLE, hooks } from './craft';
import { REALMS } from './data';
import { A } from './grammar';

export interface Manual { id: string; target: string; kind: 'recipe' | 'crop'; name: string; icon: string; fee: number; days: number; tier: number }
export const MANUALS: Manual[] = [
    ...RECIPES.filter(r => NEW_CRAFTS.includes(r.craft) && (r.learnFee ?? 0) > 0).map(r => ({ id: `book-${r.id}`, target: r.id, kind: 'recipe' as const, name: r.name, icon: CRAFT_INFO[r.craft].icon, fee: bookFee(r.learnFee ?? 0), days: studyDays(r, 'book'), tier: r.level })),
    ...CROPS.filter(c => c.fee > 0).map(c => ({ id: `book-${c.id}`, target: c.id, kind: 'crop' as const, name: `Growing ${c.name}`, icon: c.icon, fee: bookFee(c.fee), days: studyDays({ learnFee: c.fee, level: c.level, craft: 'farming' }, 'book'), tier: c.level })),
];
export const manualOf = (id: string) => MANUALS.find(m => m.id === id);
for (const m of MANUALS) {
    if (ITEMS.some(i => i.id === m.id)) continue;
    ITEMS.push({ id: m.id, name: `Manual: ${m.name}`, icon: '📘', blurb: `Read it from your pack to study ${m.name.toLowerCase()} on your own. Takes ${m.days} days. No teacher needed.`, base: m.fee, buyable: true, minMarket: Math.min(3, m.tier), staple: m.tier <= 1 });
    CAT_OF[m.id] = 'goods';
    USABLE.push(m.id);
}
export function readManual(save: SaveGame, id: string): { save: SaveGame; msg: string } {
    const m = manualOf(id); if (!m) return { save, msg: 'You cannot read that.' };
    const eco = getEco(save);
    if ((eco.items[id] ?? 0) < 1) return { save, msg: 'You have none.' };
    if (save.travel || save.exp) return { save, msg: 'You cannot study on the road or inside a realm.' };
    if (knows(save, m.target)) return { save, msg: `You already know ${m.name.toLowerCase()}. Keep the manual to sell.` };
    if (studying(save, m.target)) return { save, msg: `You are already studying it: ${studying(save, m.target)} days left.` };
    const cx = getCx(save);
    return { save: { ...save, eco: { ...eco, items: { ...eco.items, [id]: eco.items[id] - 1 } }, cx: { ...cx, study: { ...cx.study, [m.target]: Math.ceil(save.clockDays + m.days) } } }, msg: `📘 You settle down with the manual. ${m.name} will take ${m.days} days to learn.` };
}

// ---- Ranked pill ladder: items and alchemy recipes for ranks 1..14 (rank 0 is the old Qi Gathering Pill) ----
const band = (r: number): [string, number] => r <= 2 ? ['moonblossom', 1] : r <= 4 ? ['fire-lotus', r - 1] : r <= 7 ? ['ginseng', 1] : ['core', 1 + Math.floor(r / 5)];
const skillFor = (r: number) => [0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5][r];
for (let r = 1; r <= MAX_RANK; r++) {
    const tier = r <= 1 ? 1 : r <= 4 ? 2 : 3, [rare, q] = band(r);
    if (!ITEMS.some(i => i.id === cpId(r))) {
        ITEMS.push({ id: cpId(r), name: cpName(r), icon: '💊', rank: r, blurb: `Rank ${r} cultivation pill. Best for ${REALMS[r]} and below: about a third of a stage or more, with extra toxicity for lower realms. Weaker for higher realms.`, base: cpBase(r), buyable: true, minMarket: tier });
        CAT_OF[cpId(r)] = 'pills';
    }
    if (r < MAX_RANK && !ITEMS.some(i => i.id === btId(r))) {
        ITEMS.push({ id: btId(r), name: `${REALMS[r]} Breakthrough Pill`, icon: '🔮', rank: r, blurb: `Rank ${r} breakthrough pill, for breaking out of ${REALMS[r]}: +15%, a little more from a higher rank pill. Too weak for a higher realm's breakthrough.`, base: btBase(r), buyable: true, minMarket: Math.max(2, tier) });
        CAT_OF[btId(r)] = 'pills';
    }
    if (!RECIPES.some(x => x.id === `a-cp-${r}`)) {
        RECIPES.push({ id: `a-cp-${r}`, craft: 'alchemy', name: `Brew ${A(cpName(r))}`, inputs: { herb: 2, [rare]: q }, tool: 'pill-furnace', out: cpId(r), level: skillFor(r), realm: r, base: 0.7, learnFee: 20 * r });
        if (r < MAX_RANK) RECIPES.push({ id: `a-bt-${r}`, craft: 'alchemy', name: `Brew ${A(REALMS[r])} Breakthrough Pill`, inputs: { herb: 2, [rare]: q + (rare === 'core' ? 3 : 1), 'core-essence': 1 }, tool: 'pill-furnace', out: btId(r), level: skillFor(r), realm: r, base: 0.55, learnFee: 30 * r });
    }
}
hooks.readManual = readManual;
