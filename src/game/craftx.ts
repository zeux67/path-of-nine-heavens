// Craft depth: the loops behind the seven newer crafts. Beast companion, farm plots, puppets, surveys, readings, contracts.
import type { SaveGame } from './state';
import type { World } from './world';
import { RECIPES, getCx, getCraft, skillLevel, realmGate, addRep, repTier, NEW_CRAFTS, knows, studying, studyDays, bookFee } from './craft';
import { REALMS } from './data';
import type { CraftDepth, CraftId } from './craft';
import { getEco, addItem, addStones, itemById, pay, realmScale, realmHere, gapHooks } from './economy';
import type { Expedition } from './economy';
import { currentCult, buffOn, BUFF_INFO } from './cultivation';
import { regionDanger, REGION_WORDS } from './danger';
import { addKarma } from './karma';
import { mulberry32, hashSeed } from './rng';
import { eligibleCores, pendingOf } from './events';

const withCx = (s: SaveGame, patch: Partial<CraftDepth>): SaveGame => ({ ...s, cx: { ...getCx(s), ...patch } });
const items = (s: SaveGame) => getEco(s).items;
const has = (s: SaveGame, id: string, n = 1) => (items(s)[id] ?? 0) >= n;
const take = (s: SaveGame, id: string, n = 1): SaveGame => ({ ...s, eco: { ...getEco(s), items: { ...items(s), [id]: (items(s)[id] ?? 0) - n } } });
const xp = (s: SaveGame, c: CraftId, n: number): SaveGame => ({ ...s, craft: { ...getCraft(s), xp: { ...getCraft(s).xp, [c]: (getCraft(s).xp[c] ?? 0) + n } } });
const rng = (s: SaveGame, k: string) => mulberry32(hashSeed(`${s.seed}|${k}|${Math.floor(s.clockDays)}`));
const busy = (s: SaveGame) => (s.travel || s.exp) ? 'You cannot do this while on the road or inside a realm.' : null;
type R = { save: SaveGame; msg: string };

// ---- Beast taming: catch, feed, evolve; fights beside you; carries you; sheds materials -------------
export const BEAST_KINDS = ['Spirit Hare', 'Iron-Back Boar', 'Moon Wolf', 'Thunder Hawk', 'Flame Fox', 'Azure Serpent', 'Qilin Cub', 'Phoenix Chick'];
export const BEAST_STAGES = ['Cub', 'Grown beast', 'Spirit beast', 'True beast'];
const STAGE_XP = [40, 110, 240];
export const beastOf = (s: SaveGame) => getCx(s).beast ?? null;
// The beast's own cultivation realm. It grows alongside its owner inside a major realm, but a new major realm
// needs ONE catalyst: a special pill, a rare spiritual material, or a demon core. Feeding never crosses that gate.
export const beastCult = (s: SaveGame) => { const b = beastOf(s); return b ? Math.min(b.rlm ?? currentCult(s).realm, currentCult(s).realm) : 0; };
export const beastHeld = (s: SaveGame) => { const b = beastOf(s); return Boolean(b) && currentCult(s).realm > beastCult(s); };
export const BEAST_CATALYSTS = [['ginseng', 'rare spiritual material', 2], ['spirit-fruit', 'rare spiritual material', 3], ['beast-pill', 'special pill', 5], ['demon-core', 'demon core', 11]] as const;
// Each catalyst only reaches so far (last number = highest realm it can lift a beast into), so cheap low-realm stock cannot open every gate.
export const catalystReach = (item: string) => BEAST_CATALYSTS.find(c => c[0] === item)?.[2] ?? -1;
export const beastRealm = (s: SaveGame) => { const b = beastOf(s); return b ? Math.min(beastCult(s) + 1, b.stage * 2) : 0; };
export function ascendBeast(s: SaveGame, item: string): R {
    const b = beastOf(s); if (!b) return { save: s, msg: 'You have no bonded beast.' };
    if (!BEAST_CATALYSTS.some(c => c[0] === item)) return { save: s, msg: 'That will not help a beast cross a realm.' };
    if (!beastHeld(s)) return { save: s, msg: `${b.name} is already at your realm. It can cross to a new major realm only after you do.` };
    if (!has(s, item)) return { save: s, msg: `You have no ${itemById(item)?.name}.` };
    const nr = beastCult(s) + 1;
    if (nr > catalystReach(item)) return { save: s, msg: `${itemById(item)?.name} is too weak to lift ${b.name} into ${REALMS[nr]}. It needs something stronger${item === 'demon-core' ? '' : ': ' + BEAST_CATALYSTS.filter(c => c[2] >= nr).map(c => itemById(c[0])?.name).join(', ')}.`.replace('too weak','too weak') };
    return { save: addRep(xp(withCx(take(s, item), { beast: { ...b, rlm: nr } }), 'beast', 4), 'beast', 2), msg: `🌟 ${b.name} swallows the ${itemById(item)?.name} and crosses into ${REALMS[nr]}.${nr < currentCult(s).realm ? ` It is still ${currentCult(s).realm - nr} realm${currentCult(s).realm - nr === 1 ? '' : 's'} behind you.` : ''}` };
}
export const mountCut = (s: SaveGame) => { const b = beastOf(s); return b && b.stage >= 1 ? 0.1 * b.stage : 0; };
export function tameBeast(s: SaveGame, world?: World): R {
    const why = busy(s); if (why) return { save: s, msg: why };
    if (beastOf(s)) return { save: s, msg: 'You already have a bonded beast.' };
    if (!has(s, 'taming-rope')) return { save: s, msg: 'You need a Taming Rope.' };
    if (!has(s, 'beast-snack', 2)) return { save: s, msg: 'You need 2 Spirit Beast Feed to win one over.' };
    const lv = skillLevel(s, 'beast'), r = rng(s, 'tame');
    const chance = Math.min(0.9, 0.4 + 0.1 * lv + 0.02 * repTier(s, 'beast'));
    const t = take(s, 'beast-snack', 2);
    const city = world?.cityById.get(s.locationId), zone = world && city ? regionDanger(world, city) : 0; // wilder land holds wilder beasts
    if (r() >= chance) {
        if (zone >= 2 && r() < 0.35) { const c = { ...currentCult(t) }; c.weak = Math.max(c.weak ?? 0, 30); return { save: { ...xp(t, 'beast', 1.5), cult: c }, msg: '🐾 The wild beast takes the feed, then lashes out. You escape with a short qi deviation and lose the feed.' }; }
        return { save: xp(t, 'beast', 1.5), msg: '🐾 The beast takes the feed and slips away. You lose the feed. Try again.' };
    }
    const kind = BEAST_KINDS[Math.min(BEAST_KINDS.length - 1, Math.floor(r() * Math.min(2 + lv, 2 + 2 * zone)))];
    const nm = ['Ash', 'Moss', 'Ember', 'Pebble', 'Mist', 'Thorn', 'Dusk', 'Sprout'][Math.floor(r() * 8)];
    return { save: addRep(xp(withCx(t, { beast: { kind, name: nm, rlm: Math.min(2 * zone, currentCult(s).realm), xp: 0, stage: 0, shedAt: s.clockDays, fedAt: s.clockDays } }), 'beast', 6), 'beast', 2), msg: `🐾 ${an(kind)} accepts the rope and bonds with you. You name it ${nm}. It is a cub. Feed it to help it grow.` };
}
export function feedBeast(s: SaveGame): R {
    const b = beastOf(s); if (!b) return { save: s, msg: 'You have no bonded beast.' };
    if (!has(s, 'beast-snack')) return { save: s, msg: 'You need Spirit Beast Feed.' };
    if (b.stage >= 3) return { save: s, msg: `${b.name} is a true beast. It needs no more growing.` };
    const gain = 12 + 3 * skillLevel(s, 'beast');
    let nb = { ...b, xp: b.xp + gain, fedAt: s.clockDays }; let line = `🍖 ${b.name} eats happily (+${gain}).`;
    if (nb.xp >= STAGE_XP[b.stage]) { nb = { ...nb, stage: b.stage + 1, xp: 0 }; line = `✨ ${b.name} evolves into ${A(BEAST_STAGES[nb.stage])}. It will fight harder${nb.stage >= 1 ? ' and can carry you: journeys are ' + nb.stage * 10 + '% faster' : ''}.`; }
    return { save: xp(withCx(take(s, 'beast-snack'), { beast: nb }), 'beast', 2), msg: line };
}
export const shedReady = (s: SaveGame) => { const b = beastOf(s); return b && b.stage >= 1 ? Math.max(0, Math.ceil(b.shedAt + 30 - s.clockDays)) : -1; };
export function collectShed(s: SaveGame): R {
    const b = beastOf(s); if (!b) return { save: s, msg: 'You have no bonded beast.' };
    const left = shedReady(s); if (left < 0) return { save: s, msg: `${b.name} is too young to shed anything useful.` };
    if (left > 0) return { save: s, msg: `${b.name} will have something for you in ${left} days.` };
    let n = addItem(s, 'beast-hide', b.stage + 1); let line = `🧵 ${b.name} sheds ${b.stage + 1} beast hide${b.stage + 1 === 1 ? '' : 's'}.`;
    if (b.stage >= 2) { n = addItem(n, 'core', 1); line += ' And a small spirit core.'; }
    return { save: addRep(xp(withCx(n, { beast: { ...b, shedAt: s.clockDays } }), 'beast', 2), 'beast', 1), msg: line };
}

// ---- Spirit farming: plots, growth time, quality --------------------------------------------------------
export type { Crop } from './crops';
export { CROPS } from './crops';
import { CROPS } from './crops';
import type { Crop } from './crops';
export const plotCount = (s: SaveGame) => 2 + Math.min(4, skillLevel(s, 'farming'));
export const plotsOf = (s: SaveGame) => { const p = getCx(s).plots ?? []; return Array.from({ length: plotCount(s) }, (_, i) => p[i] ?? null); };
export const growDays = (s: SaveGame, c: Crop) => Math.ceil(c.days * (buffOn(s, 'qiarray') ? 0.7 : 1));
export const cropKnown = (s: SaveGame, c: Crop) => c.fee === 0 || knows(s, c.id);
export const cropDays = (c: Crop, via: 'teacher' | 'book') => studyDays({ learnFee: c.fee, level: c.level, craft: 'farming' }, via);
export const cropFee = (c: Crop, via: 'teacher' | 'book') => via === 'book' ? bookFee(c.fee) : c.fee;
export function learnCrop(s: SaveGame, c: Crop, via: 'teacher' | 'book' = 'teacher'): R {
    if (cropKnown(s, c)) return { save: s, msg: 'You already know how to grow it.' };
    if (studying(s, c.id)) return { save: s, msg: `You are already studying it: ${studying(s, c.id)} days left.` };
    if ((via as string) === 'book') return { save: s, msg: 'Books are bought from a market that stocks them, then read from your pack.' };
    const fee = cropFee(c, via), days = cropDays(c, via);
    const p = pay(s, fee); if (!p) return { save: s, msg: `${via === 'book' ? 'The bookseller' : 'The old farmer'} asks ${fee} stones.` };
    return { save: { ...p, cx: { ...getCx(p), study: { ...getCx(p).study, [c.id]: Math.ceil(p.clockDays + days) } } }, msg: `🌱 You ${via === 'book' ? `buy a manual for ${fee} stones and study it` : `pay ${fee} stones and study under an old farmer`}. ${c.name} will take ${days} days to learn.` };
}
export function plant(s: SaveGame, slot: number, c: Crop): R {
    const why = busy(s); if (why) return { save: s, msg: why };
    if (!has(s, 'seed-tray')) return { save: s, msg: 'You need a Spirit Seed Tray.' };
    if (!cropKnown(s, c)) return { save: s, msg: 'You have not learned to grow it.' };
    if (skillLevel(s, 'farming') < c.level) return { save: s, msg: 'Your farming skill is too low for it.' };
    { const g = realmGate(s, c.level); if (g) return { save: s, msg: g }; }
    if (plotsOf(s)[slot]) return { save: s, msg: 'That plot is already planted.' };
    const seed = c.item === 'spirit-fruit' ? 'ginseng' : c.item;
    if (!has(s, seed)) return { save: s, msg: `You need 1 ${itemById(seed)?.name} to plant${c.item === 'spirit-fruit' ? ' (a ginseng root)' : ''}.` };
    if (!has(s, 'spirit-spring')) return { save: s, msg: 'You need 1 Spirit Spring Water.' };
    const q = Math.min(1, 0.4 + 0.12 * skillLevel(s, 'farming') + (buffOn(s, 'vein') ? 0.1 : 0) + rng(s, `q${slot}`)() * 0.2);
    const plots = plotsOf(s).slice(); plots[slot] = { crop: c.id, at: s.clockDays, q };
    return { save: xp(withCx(take(take(s, seed), 'spirit-spring'), { plots }), 'farming', 1), msg: `${c.icon} You plant ${c.name}. It will be ready in ${growDays(s, c)} days.` };
}
export const plotDaysLeft = (s: SaveGame, p: { crop: string; at: number }) => { const c = CROPS.find(x => x.id === p.crop)!; return Math.max(0, Math.ceil(p.at + growDays(s, c) - s.clockDays)); };
export function harvest(s: SaveGame, slot: number): R {
    const p = plotsOf(s)[slot]; if (!p) return { save: s, msg: 'Nothing is planted there.' };
    const c = CROPS.find(x => x.id === p.crop)!; const left = plotDaysLeft(s, p);
    if (left > 0) return { save: s, msg: `${c.name} needs ${left} more days.` };
    const n = c.qty + Math.floor(p.q * 2.2) + (rng(s, `h${slot}`)() < p.q - 0.4 ? 1 : 0);
    const plots = plotsOf(s).slice(); plots[slot] = null;
    const g = n > c.qty + 2 ? 'a rich harvest' : 'a fair harvest';
    return { save: addRep(xp(withCx(addItem(s, c.item, n), { plots }), 'farming', 3), 'farming', 1), msg: `${c.icon} ${g}: ${n} ${itemById(c.item)?.name}.` };
}


// ---- Bonding a wild beast without feed: a trial of nerve, or a Beast Hollow ---------------------------------
const bond = (s: SaveGame, r: () => number, cap: number, how: string, natural: number): R => {
    const lv = skillLevel(s, 'beast');
    const kind = BEAST_KINDS[Math.min(BEAST_KINDS.length - 1, Math.floor(r() * Math.max(1, Math.min(2 + lv, cap))))];
    const nm = ['Ash', 'Moss', 'Ember', 'Pebble', 'Mist', 'Thorn', 'Dusk', 'Sprout'][Math.floor(r() * 8)];
    return { save: addRep(xp(withCx(s, { beast: { kind, name: nm, rlm: Math.min(natural, currentCult(s).realm), xp: 0, stage: 0, shedAt: s.clockDays, fedAt: s.clockDays } }), 'beast', 6), 'beast', 2), msg: `🐾 ${how} ${an(kind)} bonds with you. You name it ${nm}. It is a cub. Feed it to help it grow.` };
};
export function trialBeast(s: SaveGame, world?: World): R {
    const why = busy(s); if (why) return { save: s, msg: why };
    if (beastOf(s)) return { save: s, msg: 'You already have a bonded beast.' };
    if (!has(s, 'taming-rope')) return { save: s, msg: 'You need a Taming Rope.' };
    const lv = skillLevel(s, 'beast'), r = rng(s, 'trial');
    const city = world?.cityById.get(s.locationId), zone = world && city ? regionDanger(world, city) : 0;
    const chance = Math.min(0.75, 0.2 + 0.1 * lv + 0.02 * repTier(s, 'beast') - 0.03 * zone);
    const days = 3, n0: SaveGame = { ...s, clockDays: s.clockDays + days };
    if (r() >= chance) { const c = { ...currentCult(n0) }; c.weak = Math.max(c.weak ?? 0, 45); return { save: xp({ ...n0, cult: c }, 'beast', 2), msg: '🐾 You face a wild beast with nothing but nerve. It does not yield, and you stagger away with a short qi deviation. No feed lost, but no friend either.' }; }
    const b = bond(n0, r, 2 + 2 * zone, 'You face a wild beast alone for three days, and it yields.', 2 * zone);
    return b;
}

// ---- Secret-realm gaps: geomancy shortens trips, formation unpicks guardian arrays, Beast Hollows hold cubs ----
gapHooks.realmDays = (s, days) => Math.max(20, Math.round(days * (1 - 0.05 * Math.min(5, skillLevel(s, 'geomancy')))));
gapHooks.arrayBreak = (s, exp, roll) => {
    const lv = skillLevel(s, 'formation');
    if (lv < 2 || !has(s, 'array-flags')) return null;
    if (roll >= Math.min(0.75, 0.25 + 0.1 * lv + 0.02 * repTier(s, 'formation'))) return null;
    return { ...addRep(xp(s, 'formation', 3), 'formation', 1), exp: { ...exp, guard: 'win' as const }, log: ['🀄 The guardian stands on an old array. You read its flags, unpick two, and it falls silent. You walk past it.', ...s.log].slice(0, 30) };
};
gapHooks.beastExit = (s, exp) => {
    if (exp.name !== 'Beast Hollow' || beastOf(s) || !has(s, 'taming-rope')) return s;
    const r = rng(s, `hollow|${exp.realmId}`), lv = skillLevel(s, 'beast');
    if (r() >= Math.min(0.7, 0.2 + 0.1 * lv)) return s;
    const b = bond(s, r, 3 + exp.danger, 'A cub follows you out of the Hollow, and your rope is enough.', 1 + 2 * exp.danger);
    return { ...b.save, log: [b.msg, ...b.save.log].slice(0, 30) };
};

// ---- Geomancy dwelling site: chart one, claim it, cultivate and shelter there --------------------------------
export const CAVE_COST = 150;
export const siteHere = (s: SaveGame) => Boolean(getCx(s).sites?.[s.locationId]);
export const caveCost = (s: SaveGame) => Math.round(CAVE_COST * realmScale(s));
export function claimCave(s: SaveGame, world: World): R {
    const why = busy(s); if (why) return { save: s, msg: why };
    if (!siteHere(s)) return { save: s, msg: 'You have not charted a dwelling site here. Survey the land with a Geomancer Compass.' };
    if (getCx(s).cave?.at === s.locationId) return { save: s, msg: 'This cave is already yours.' };
    const p = pay(s, caveCost(s)); if (!p) return { save: s, msg: `Opening and warding the cave costs ${caveCost(s)} stones.` };
    const nm = world.cityById.get(s.locationId)?.name ?? 'here';
    return { save: addRep(withCx(p, { cave: { at: s.locationId, day: s.clockDays } }), 'geomancy', 2), msg: `🏔️ You open the sealed cave near ${nm}, set its ward and make it your dwelling. While you are here: cultivation +10%, and raiders find you 25% less.` };
}

// ---- Commissions: a client request is taken once a month per craft, fixed when taken, then delivered -------------
export interface Commission { recipeId: string; out: string; qty: number; pay: number; month: number }
const monthOf = (s: SaveGame) => Math.floor(s.clockDays / 30);
export const orderInHand = (s: SaveGame, craft: CraftId): Commission | null => { const o = getCx(s).orders?.[craft]; return o && o.month >= monthOf(s) ? o : null; };
export const canTakeOrder = (s: SaveGame, craft: CraftId) => (getCx(s).ordTaken?.[craft] ?? -1) < monthOf(s);
export function takeCommission(s: SaveGame, craft: CraftId): R {
    if (orderInHand(s, craft)) return { save: s, msg: 'You already have a client waiting.' };
    if (!canTakeOrder(s, craft)) return { save: s, msg: 'No new client for this craft until next month.' };
    const pool = RECIPES.filter(r => r.craft === craft && !r.gear && knows(s, r.id) && !realmGate(s, r.level, r.realm) && itemById(r.out));
    if (!pool.length) return { save: s, msg: 'Nobody asks for work you cannot do yet. Learn a recipe first.' };
    const month = monthOf(s), h = hashSeed(`${s.seed}|${month}|${craft}`);
    const rec = pool[h % pool.length], qty = 1 + ((h >>> 8) % 2), it = itemById(rec.out)!;
    const o: Commission = { recipeId: rec.id, out: rec.out, qty, pay: Math.max(1, Math.round(it.base * qty * (1.3 + 0.05 * repTier(s, craft)))), month };
    return { save: withCx(s, { orders: { ...getCx(s).orders, [craft]: o }, ordTaken: { ...getCx(s).ordTaken, [craft]: month } }), msg: `📝 A client asks for ${qty} ${it.name}, paying ${o.pay} stones. They will wait until the month ends.` };
}
export function deliverCommission(s: SaveGame, craft: CraftId): R {
    const o = orderInHand(s, craft); if (!o) return { save: s, msg: 'No client is waiting for this craft.' };
    if (!has(s, o.out, o.qty)) return { save: s, msg: `You need ${o.qty} ${itemById(o.out)?.name}.` };
    const n = addRep(xp(addStones(take(s, o.out, o.qty), o.pay), craft, 2), craft, 1);
    return { save: withCx(n, { orders: { ...getCx(n).orders, [craft]: null } }), msg: `📝 The client takes ${o.qty} ${itemById(o.out)?.name} and pays ${o.pay} stones. Your name travels a little further.` };
}

// ---- Puppets: built once, guard in every fight, dig while you cultivate --------------------------------
export const PUPPET_HP = 12;
export const puppetsOf = (s: SaveGame) => getCx(s).puppets ?? [];
export const guardWard = (s: SaveGame) => puppetsOf(s).filter(p => p.kind === 'guard' && p.hp > 0).length;
export function deployPuppet(s: SaveGame, kind: 'guard' | 'miner'): R {
    const id = kind === 'guard' ? 'guard-puppet' : 'miner-puppet';
    if (!has(s, id)) return { save: s, msg: 'You have none.' };
    const cap = 1 + skillLevel(s, 'puppet');
    if (puppetsOf(s).length >= cap) return { save: s, msg: `Your skill controls ${cap} puppet${cap === 1 ? '' : 's'} at a time.` };
    return { save: withCx(take(s, id), { puppets: [...puppetsOf(s), { kind, hp: PUPPET_HP }], mineAt: getCx(s).mineAt ?? s.clockDays }), msg: `🤖 Your ${kind === 'guard' ? 'guard' : 'mining'} puppet stands ready. It lasts about ${PUPPET_HP} ${kind === 'guard' ? 'fights' : 'collections'} before it needs repairs.` };
}
// Each guard puppet takes the first blow of a fight, as a ward of 14% health, and wears down.
export function puppetsFight(s: SaveGame): { save: SaveGame; ward: number } {
    const list = puppetsOf(s).map(p => p.kind === 'guard' && p.hp > 0 ? { ...p, hp: p.hp - 1 } : p);
    const n = puppetsOf(s).filter(p => p.kind === 'guard' && p.hp > 0).length;
    return { save: n ? withCx(s, { puppets: list }) : s, ward: n };
}
import { homeGuardHook } from './danger';
import { A } from './grammar';
homeGuardHook.fn = (s, rs) => {
    const n = guardWard(s);
    const trap = (items(s)['trap-array'] ?? 0) > 0;
    if ((!n && !trap) || rs >= Math.min(0.85, 0.3 * n + (trap ? 0.3 : 0))) return null;
    if (trap) s = take(s, 'trap-array');
    const list = puppetsOf(s).map(p => p.kind === 'guard' && p.hp > 0 ? { ...p, hp: Math.max(0, p.hp - 4) } : p);
    if (!n) return { save: s, line: '🪤 A trap array at your door springs when {what} reaches {city}. The attackers are driven off, and the array is spent.' };
    return { save: withCx(s, { puppets: list }), line: n > 1 ? '🤖 Your guard puppets hold the line when {what} reaches {city}. The attackers are driven off, and the puppets are battered.' : '🤖 Your guard puppet holds the door when {what} reaches {city}. The attackers are driven off, and the puppet is battered.' };
};
export const MINE_DAYS_CAP = 60;
export const mineStock = (s: SaveGame) => {
    const n = puppetsOf(s).filter(p => p.kind === 'miner' && p.hp > 0).length; if (!n) return 0;
    const days = Math.min(MINE_DAYS_CAP, Math.max(0, s.clockDays - (getCx(s).mineAt ?? s.clockDays)));
    return Math.floor(n * days * 0.35 * realmScale(s));
};
export function collectMine(s: SaveGame): R {
    const g = mineStock(s); if (g < 1) return { save: s, msg: 'The mining puppets have found nothing yet.' };
    const list = puppetsOf(s).map(p => p.kind === 'miner' && p.hp > 0 ? { ...p, hp: p.hp - 1 } : p);
    return { save: addStones(withCx(s, { puppets: list, mineAt: s.clockDays }), g), msg: `⛏️ Your mining puppets bring back ${g} spirit stones.` };
}
export function repairPuppet(s: SaveGame, i: number): R {
    const p = puppetsOf(s)[i]; if (!p) return { save: s, msg: '' };
    if (p.hp >= PUPPET_HP) return { save: s, msg: 'It is in good repair.' };
    if (!has(s, 'refined-iron')) return { save: s, msg: 'Repairs need 1 Refined Iron.' };
    const list = puppetsOf(s).slice(); list[i] = { ...p, hp: PUPPET_HP };
    return { save: addRep(withCx(take(s, 'refined-iron'), { puppets: list }), 'puppet', 1), msg: '🛠️ You rebuild the joints. It is as good as new.' };
}

// ---- Geomancy: survey the land ------------------------------------------------------------------------
export const SURVEY_DAYS = 3, SURVEY_COOLDOWN = 120;
export function surveyLeft(s: SaveGame): number { const d = getCx(s).surveyed?.[s.locationId]; return d === undefined ? 0 : Math.max(0, Math.ceil(d + SURVEY_COOLDOWN - s.clockDays)); }
export function survey(s: SaveGame, world: World): R {
    const why = busy(s); if (why) return { save: s, msg: why };
    if (!has(s, 'geo-compass')) return { save: s, msg: 'You need a Geomancer Compass.' };
    if (surveyLeft(s)) return { save: s, msg: `You have read this land already. Come back in ${surveyLeft(s)} days.` };
    const city = world.cityById.get(s.locationId); if (!city) return { save: s, msg: '' };
    const lv = skillLevel(s, 'geomancy'), r = rng(s, `survey|${s.locationId}`);
    const lines: string[] = []; let n: SaveGame = s;
    lines.push(`⚠️ Danger around ${city.name}: ${REGION_WORDS[regionDanger(world, city)]}.`);
    const now = realmHere(s, city.prefectureId), nxt = realmHere({ ...s, clockDays: s.clockDays + 30 }, city.prefectureId);
    lines.push(`🕳️ The gate nearby: ${now.kind.name}, ${now.open ? 'open' : 'sealed'}. Next month: ${nxt.kind.name}${nxt.open ? ' (open)' : ' (sealed)'}, ${nxt.danger >= 3 ? 'a deadly place' : nxt.danger >= 1 ? 'uneasy' : 'calm'}${lv >= 2 ? `, danger ${nxt.danger}` : ''}.`);
    if (r() < 0.3 + 0.08 * lv) {
        if (!buffOn(n, 'vein')) { n = { ...n, buffs: { ...(n.buffs ?? {}), vein: n.clockDays + BUFF_INFO.vein.days } }; lines.push('🧭 A hidden qi vein runs under the hills. You settle on it: cultivation +20% for 90 days.'); }
        else lines.push('🧭 A second vein, but you are already settled on one.');
    }
    if (r() < 0.3 + 0.05 * lv) {
        const g = Math.round((30 + r() * 40) * realmScale(s)); n = addStones(n, g);
        lines.push(`💰 A buried cache: ${g} spirit stones${r() < 0.4 ? ' and a lump of spirit ore' : ''}.`);
        if (r() < 0.4) n = addItem(n, 'spirit-ore', 1);
    }
    if (lv >= 2 && !getCx(n).sites?.[s.locationId] && r() < 0.15 + 0.05 * lv) { n = withCx(n, { sites: { ...getCx(n).sites, [s.locationId]: s.clockDays } }); lines.push('🏔️ You chart a sealed cave with good qi nearby. It could be opened and made a dwelling for a fee.'); }
    if (r() < 0.1 + 0.07 * lv) { // a sealed cave only a geomancer would find
        if (r() < Math.max(0.05, 0.4 - 0.08 * lv)) { const c = { ...currentCult(n) }; c.weak = Math.max(c.weak ?? 0, 30); n = { ...n, cult: c }; lines.push('🕳️ You find a sealed cave. Its old ward lashes out as you open it, and you stagger away with a short qi deviation. Come back stronger.'); }
        else { const ore = 3 + Math.floor(r() * 4), cores = 1 + (lv >= 3 ? 1 : 0); n = addItem(addItem(n, 'spirit-ore', ore), 'core', cores); lines.push(`🕳️ You find a sealed cave and read its ward. Inside: ${ore} spirit ore and ${cores} beast core${cores > 1 ? 's' : ''}.`); if (r() < 0.25) { const g = Math.round((60 + r() * 60) * realmScale(s)); n = addStones(n, g); lines.push(`💰 A dead cultivator's purse: ${g} spirit stones.`); } }
    }
    n = withCx(n, { surveyed: { ...getCx(n).surveyed, [s.locationId]: s.clockDays } });
    n = addRep(xp(n, 'geomancy', 3), 'geomancy', 1);
    n = { ...n, clockDays: n.clockDays + SURVEY_DAYS };
    return { save: n, msg: lines.join('\n') };
}

// ---- Divination: pay to peek at what is coming --------------------------------------------------------
export const READ_COST = 40;
export function readFate(s: SaveGame, world: World, pay_: 'stones' | 'life'): R {
    const why = busy(s); if (why) return { save: s, msg: why };
    if (!has(s, 'divining-shells')) return { save: s, msg: 'You need Divining Shells.' };
    const lv = skillLevel(s, 'divination');
    let n: SaveGame = s;
    if (pay_ === 'stones') { const cost = Math.round(READ_COST * realmScale(s)); const p = pay(s, cost); if (!p) return { save: s, msg: `A reading costs ${cost} stones.` }; n = p; }
    else n = withCx(s, { lifeSpent: (getCx(s).lifeSpent ?? 0) + 1 });
    const r = rng(s, 'fate');
    const pool = eligibleCores(s, world);
    const queued = pendingOf(s).map(p => p.id);
    const names = [...new Set([...queued, ...pool.slice().sort(() => r() - 0.5).slice(0, 4).map(c => c.id)])].slice(0, 3);
    const title = (id: string) => (pool.find(c => c.id === id)?.title) ?? id;
    const falseP = Math.max(0.05, 0.4 - 0.1 * lv - 0.02 * repTier(s, 'divination'));
    const shown = names.map(id => r() < falseP && pool.length ? pool[Math.floor(r() * pool.length)].title : title(id));
    let line = `🔮 The shells fall. Over the coming months you may meet: ${shown.join(', ')}. Fate can shift, and readings are sometimes wrong${lv < 3 ? ' (yours is a rough art)' : ''}.`;
    if (lv >= 3 && r() < 0.08) { n = withCx(n, { lifeSpent: (getCx(n).lifeSpent ?? 0) + 0.5 }); line += ' 💢 Backlash: the reading cost you half a year of life.'; }
    return { save: addRep(xp(n, 'divination', 3), 'divination', 1), msg: line };
}

// ---- Poison: the black market ------------------------------------------------------------------------
export const BLACK_ITEMS = ['viper-venom', 'blood-gu'];
export const blackAccess = (s: SaveGame) => s.char.alignment === 'demonic' || skillLevel(s, 'poison') >= 2;
export const blackPrice = (s: SaveGame, id: string) => Math.round((itemById(id)?.base ?? 20) * 2.2 * (s.char.alignment === 'demonic' ? 1.1 : 1));
export function sellBlack(s: SaveGame, id: string): R {
    if (!blackAccess(s)) return { save: s, msg: 'The brokers do not know you. They deal with the demonic, or a poisoner of Journeyman skill.' };
    if (!has(s, id)) return { save: s, msg: 'You have none.' };
    const g = blackPrice(s, id);
    return { save: addRep(addKarma(addStones(take(s, id), g), -2, 'sold poison to the black market'), 'poison', 1), msg: `🕶️ A masked broker pays ${g} stones and asks no questions.` };
}
export const CONTRACT_DAYS = 5, CONTRACT_COOLDOWN = 60;
export const contractLeft = (s: SaveGame) => { const d = getCx(s).contractAt; return d === undefined ? 0 : Math.max(0, Math.ceil(d + CONTRACT_COOLDOWN - s.clockDays)); };
export function takeContract(s: SaveGame): R {
    const why = busy(s); if (why) return { save: s, msg: why };
    if (!blackAccess(s)) return { save: s, msg: 'No one offers you contracts yet.' };
    if (!has(s, 'viper-venom')) return { save: s, msg: 'A contract needs a dose of Viper Venom.' };
    if (contractLeft(s)) return { save: s, msg: `No new contract for ${contractLeft(s)} days.` };
    const lv = skillLevel(s, 'poison'), r = rng(s, 'contract');
    const win = r() < Math.min(0.9, 0.55 + 0.06 * lv + 0.02 * repTier(s, 'poison'));
    let n = withCx(take(s, 'viper-venom'), { contractAt: s.clockDays });
    n = { ...n, evflags: [...new Set([...(n.evflags ?? []), 'poisoner'])].slice(-80) };
    n = { ...n, clockDays: n.clockDays + CONTRACT_DAYS };
    if (win) { const g = Math.round(55 * realmScale(s)); return { save: addRep(xp(addKarma(addStones(n, g), -8, 'a poison contract'), 'poison', 3), 'poison', 2), msg: `☠️ The mark dies quietly. The broker pays ${g} stones. It will be remembered.` }; }
    const lost = Math.min(getEco(n).stones, Math.round(25 * realmScale(s)));
    return { save: addKarma(addStones(n, -lost), -4, 'a botched poison contract'), msg: `💢 The mark lives and the guards are alerted. You flee and pay ${lost} stones for silence.` };
}
export { NEW_CRAFTS };

function an(w: string): string { return (/^[AEIOU]/i.test(w) ? 'An ' : 'A ') + w; }
