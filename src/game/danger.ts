// World danger: roads and regions threaten you in proportion to how far you stray from civilization.
import type { SaveGame } from './state';
import type { City, World } from './world';
import { travelHours } from './world';
import { currentCult } from './cultivation';
import { gearEffect, makeGear, addGear, GRADES, gearPrice } from './gear';
import { bump } from './goals';
import { startBattle } from './combat';
import { fateRoll, makeDeath } from './fate';
import { getEco, addItem, addStones, itemById } from './economy';
import { stageCost, cultGain, buffOn } from './cultivation';
import { GIVEN_NAMES, SURNAMES } from './data';
import { A } from './grammar';

export const REGION_WORDS = ['Safe', 'Watched', 'Perilous', 'Deadly'];
function hash(str: string): number { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// 0 civilized .. 3 deadly wilds. Capitals and market cities are safe; remote villages in unclaimed prefectures are not.
export function regionDanger(world: World, c: City): number {
    let d = c.tier === 'capital' ? 0 : c.tier === 'market' ? 0 : c.tier === 'city' ? 1 : c.tier === 'town' ? 1 : 2;
    const pref = world.prefectureById.get(c.prefectureId);
    const forces = (pref?.forceIds ?? []).map(id => world.forceById.get(id)).filter(Boolean);
    if (forces.length === 0) d += 1;
    else if (forces.some(f => f!.hegemon)) d -= 1;
    if (c.marketTier >= 2) d -= 1;
    if (hash(`${c.id}|wild`) % 7 === 0) d += 1; // a beast territory nearby
    return Math.max(0, Math.min(3, d));
}
export function beastTerritory(world: World, c: City): boolean { return regionDanger(world, c) >= 3; }

function power(save: SaveGame): number {
    const ch = save.char, r = currentCult(save).realm;
    return 1 + r * 1.3 + ch.luck / 60 + ch.constitution * 0.3;
}
const P_EVENT = [0, 0.03, 0.09, 0.18];

export function roadDanger(world: World, from: City, to: City): number { return Math.max(regionDanger(world, from), regionDanger(world, to)); }
function rolls(hours: number) { return Math.max(1, Math.min(6, Math.ceil(hours / 72))); }

// Outcome weights for one encounter: [harmless, robbed, injured, killed]
function outcome(save: SaveGame, d: number): number[] {
    const threat = d * 2 + 0.5;
    const pw = power(save);
    const gap = threat - pw;
    const pEscape = Math.max(0.1, Math.min(0.92, 0.55 + (pw - threat) * 0.12));
    const rest = 1 - pEscape;
    const pKill = d >= 2 ? Math.min(0.6, Math.max(0, gap) * (d >= 3 ? 0.09 : 0.035)) * rest : 0;
    const left = Math.max(0, rest - pKill);
    return [pEscape, left * 0.45, left * 0.55, pKill];
}
export function roadRisk(world: World, save: SaveGame, from: City, to: City): { harm: number; death: number } {
    const d = roadDanger(world, from, to);
    const n = rolls(travelHours(from, to));
    const o = outcome(save, d);
    const pe = P_EVENT[d] * (buffOn(save, 'ward') ? 0.6 : 1);
    return { harm: 1 - Math.pow(1 - pe * (o[1] + o[2]), n), death: 1 - Math.pow(1 - pe * o[3], n) };
}

const FOES = ['a band of demonic cultivators', 'a ravenous spirit beast', 'a pack of mountain wolves with spirit cores', 'a hidden bandit sect', 'a swamp serpent', 'a roaming blood cultivator'];

export function resolveRoad(world: World, save: SaveGame, from: City, to: City): SaveGame {
    const d = roadDanger(world, from, to);
    const n = rolls(travelHours(from, to));
    let s = save;
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
        if (fateRoll(s, 100 + i) >= P_EVENT[d] * (1 - gearEffect(s, 'road')) * (buffOn(s, 'ward') ? 0.6 : 1)) continue;
        const foe = FOES[hash(`${s.seed}${s.clockDays | 0}${i}`) % FOES.length];
        const o = outcome(s, d);
        let r = fateRoll(s, 200 + i), k = 0;
        while (k < 3 && r >= o[k]) { r -= o[k]; k++; }
        if (k === 0) { lines.push(`⚠️ On the road to ${to.name} you meet ${foe}, and slip away unharmed.`); continue; }
        if (!s.battle) {
            const pr = currentCult(s).realm;
            return startBattle({ ...s, log: [...lines.reverse(), ...s.log].slice(0, 30) }, { kind: 'ambush', foeName: foe[0].toUpperCase() + foe.slice(1), foeRealm: pr + [-1, -1, 0, 1][d] + (k === 3 ? 1 : 0), lethal: k === 3, k, to: to.name });
        }
        if (k === 1) {
            const e = getEco(s); const lost = Math.floor(e.stones * 0.6);
            s = { ...s, eco: { ...e, stones: e.stones - lost } };
            lines.push(`🗡️ ${foe[0].toUpperCase() + foe.slice(1)} robs you on the road. You lose ${lost} spirit stones.`);
        } else if (k === 2) {
            const c = { ...currentCult(s) }; c.weak = Math.max(c.weak ?? 0, 90); c.progress = Math.floor(c.progress * 0.88);
            s = { ...s, cult: c };
            lines.push(`🩸 ${foe[0].toUpperCase() + foe.slice(1)} wounds you badly. You crawl to safety with a qi deviation (half speed for 3 months).`);
        } else {
            const c = currentCult(s);
            const dead = makeDeath(s, 'ambush', `On the road to ${to.name}, ${foe} found you in ${A(REGION_WORDS[d].toLowerCase())} stretch of the wilds. You were not strong enough to run and not strong enough to win.`, c.realm, c.stage);
            return { ...s, locationId: from.id, travel: null, dead, paused: true, log: [`☠️ ${foe[0].toUpperCase() + foe.slice(1)} ends your journey.`, ...lines.reverse(), ...s.log].slice(0, 30) };
        }
    }
    return roadFinds(world, lines.length ? { ...s, log: [...lines.reverse(), ...s.log].slice(0, 30) } : s, from, to);
}

// Chances on the road: a hermit, a wandering trader or old ruins. Every opportunity carries some danger (never death here).
const FIND_P = 0.1;
// Rare strokes of luck on the road: an inheritance cave, a dying cultivator, a hidden market. Each one can bite back.
const LUCKY_P = 0.03;
function luckyEncounter(save: SaveGame, salt: number, toName: string): SaveGame {
    let s = bump(save, 'lucky');
    const say = (line: string) => { s = { ...s, log: [line, ...s.log].slice(0, 30) }; };
    const k = Math.floor(fateRoll(s, salt) * 3), r = fateRoll(s, salt + 1), r2 = fateRoll(s, salt + 2);
    const c = currentCult(s);
    if (k === 0) { // inheritance cave
        if (r < 0.04 + 0.02 * c.realm) { const dead = makeDeath(s, 'trapped', `You followed a glow into a hillside cave near ${toName}. The dead master's last guardian was still awake.`, c.realm, c.stage); return { ...s, dead, paused: true, log: [`☠️ The cave guardian wakes. ${dead.text}`, ...s.log].slice(0, 30) }; }
        if (r < 0.28) { const w = { ...c }; w.weak = Math.max(w.weak ?? 0, 60); w.progress = Math.floor(w.progress * 0.85); say('🕳️ You find a master\'s inheritance cave near the road, but its trial beats you back. A qi deviation, and nothing taken.'); return { ...s, cult: w }; }
        if (r < 0.5 && !c.gate) { const gain = cultGain(s, 0.6, 500); const w = { ...c }; w.progress = Math.min(stageCost(c.realm, c.stage) - 1, w.progress + gain); say(`🕳️ An inheritance cave! A dead master's imprint teaches you in a single night. +${gain} cultivation base.`); return { ...s, cult: w }; }
        if (r < 0.75) { const g = makeGear(`${s.seed}|${s.clockDays | 0}|cave`, r2 < 0.5 ? 'artifact' : 'weapon', c.realm >= 2 && r2 > 0.85 ? 1 : 0); say(`🕳️ An inheritance cave! On a stone altar rests ${g.name} (${GRADES[g.grade]}-grade). (See Gear.)`); return addGear(s, g); }
        s = addItem(s, 'spirit-ore', 4 + Math.floor(r2 * 4)); s = addItem(s, 'core', 1); say('🕳️ An old cave, long looted. The miners left spirit ore and a beast core behind.'); return s;
    }
    if (k === 1) { // wounded cultivator
        if (r < 0.2) { const lost = Math.floor(getEco(s).stones * 0.4); s = addStones(s, -lost); const w = { ...currentCult(s) }; w.weak = Math.max(w.weak ?? 0, 30); say(`🩸 A "wounded cultivator" begs for help on the road to ${toName}. It was a trap. He robs you of ${lost} stones and leaves you weak.`); return { ...s, cult: w }; }
        if (r < 0.5) { const g = makeGear(`${s.seed}|${s.clockDays | 0}|dying`, r2 < 0.6 ? 'artifact' : 'ring', 0); say(`🩸 A dying cultivator presses the ${g.name} into your hands and asks you to bury him. You do. (See Gear.)`); return addGear(s, g); }
        if (r < 0.8) { s = addItem(s, 'core-essence', 1); s = addItem(s, 'spark-tal', 1); say('🩸 You bind a stranger\'s wounds. He wakes, thanks you, and leaves a core essence and a spark talisman.'); return s; }
        const gain = cultGain(s, 0.15, 120); const w = { ...c }; if (!w.gate) w.progress = Math.min(stageCost(c.realm, c.stage) - 1, w.progress + gain); say(`🩸 You bind a stranger's wounds. Before he goes he explains one flaw in your breathing. +${gain} cultivation base.`); return { ...s, cult: w };
    }
    // hidden market
    const e = getEco(s);
    const g = makeGear(`${s.seed}|${s.clockDays | 0}|hmk`, r < 0.4 ? 'artifact' : (['weapon', 'robe', 'boots', 'focus', 'charm'] as const)[Math.floor(r2 * 5)], c.realm >= 2 && r > 0.8 ? 1 : 0);
    const price = Math.round(gearPrice(g) * 0.5);
    if (e.stones >= price) { s = addGear(addStones(s, -price), g); say(`🏮 A hidden market opens behind a waterfall. You buy ${g.name} (${GRADES[g.grade]}-grade) for ${price} stones, half the usual price. (See Gear.)`); return s; }
    const n = Math.max(1, Math.min(4, Math.floor(e.stones / 12))); const cost = n * 12;
    if (e.stones >= 12) { s = addItem(addStones(s, -cost), 'spirit-ore', n); say(`🏮 A hidden market behind a waterfall. A ${g.name} sits there for ${price} stones, more than you carry. You buy ${n} spirit ore for ${cost} instead.`); return s; }
    say(`🏮 A hidden market behind a waterfall shows the ${g.name} for ${price} stones. You cannot afford it, and it is gone when you return.`); return s;
}
export function roadFinds(world: World, save: SaveGame, from: City, to: City): SaveGame {
    if (save.dead) return save;
    let s = save;
    const n = Math.min(2, rolls(travelHours(from, to)));
    const say = (line: string) => { s = { ...s, log: [line, ...s.log].slice(0, 30) }; };
    for (let i = 0; i < n; i++) {
        if (s.dead) break;
        if (fateRoll(s, 430 + i) < LUCKY_P) { s = luckyEncounter(s, 440 + i * 10, to.name); continue; }
        if (fateRoll(s, 400 + i) >= FIND_P) continue;
        const k = Math.floor(fateRoll(s, 410 + i) * 3);
        const r = fateRoll(s, 420 + i);
        if (k === 0) {
            const c = { ...currentCult(s) };
            if (c.gate) { say('🧓 A hermit on the road nods at you and says only: "Break through first."'); continue; }
            const gain = cultGain(s, 0.2, 150);
            c.progress = Math.min(stageCost(c.realm, c.stage) - 1, c.progress + gain);
            s = { ...s, cult: c }; say(`🧓 A hermit shares tea and a few words on the way to ${to.name}. You gain ${gain} cultivation base.`);
        } else if (k === 1) {
            const pool = ['moonblossom', 'cold-jade', 'jade-slip', 'beast-hide', 'fire-lotus'];
            const id = pool[hash(`${s.seed}${s.clockDays | 0}${i}m`) % pool.length];
            const price = Math.ceil((itemById(id)?.base ?? 10) * 0.5);
            const e = getEco(s);
            if (e.stones >= price) { s = addItem({ ...s, eco: { ...e, stones: e.stones - price } }, id, 1); say(`🧳 A wandering trader sells you ${itemById(id)?.name} for ${price} stones, half what a market would ask.`); }
            else say('🧳 A wandering trader shows rare goods, but you cannot afford any.');
        } else if (r < 0.28) {
            const c = { ...currentCult(s) }; c.weak = Math.max(c.weak ?? 0, 45); c.progress = Math.floor(c.progress * 0.92);
            s = { ...s, cult: c }; say('🏚️ You explore old ruins near the road. A sealed trap bites back: a qi deviation and some lost progress. You get out with nothing.');
        } else {
            const pool = ['core', 'ginseng', 'star-silver', 'fire-lotus', 'cold-jade'];
            const id = pool[hash(`${s.seed}${s.clockDays | 0}${i}r`) % pool.length];
            if (r < 0.7) { s = addItem(s, id, 1); say(`🏚️ In old ruins by the road you find: ${itemById(id)?.name}.`); }
            else { const g = 30 + Math.floor(r * 60); s = addStones(s, g); say(`🏚️ In old ruins by the road you find ${g} spirit stones in a collapsed shrine.`); }
        }
    }
    return s;
}

// ---- Mortal-world calamities: the early game is fragile ----------------------------------
// Yearly hazard of a deadly calamity (plague, famine, raid, beast tide) where you live, by region danger.
// It fades fast as you grow (shield) and halves inside a sect. Signposted: each death is preceded by milder scares.
const CALAMITY = [0.0035, 0.0085, 0.019, 0.04];
const CALAMITY_SCARE_SHARE = 0.3; // fraction of calamities that kill outright
export function calamityHazard(world: World, save: SaveGame): number {
    const city = world.cityById.get(save.locationId);
    if (!city) return 0;
    const r = currentCult(save).realm;
    const shield = r === 0 ? 1 : r === 1 ? 0.55 : r === 2 ? 0.12 : 0;
    if (shield === 0) return 0;
    let h = CALAMITY[regionDanger(world, city)] * shield * (1 - save.char.constitution * 0.06) * (1 - gearEffect(save, 'calamity'));
    if (save.membership) h *= 0.5;
    return Math.max(0, h) * 2.6;
}
// Set by craftx: guard puppets standing at home may turn a calamity away (avoids a circular import).
export const homeGuardHook: { fn: ((s: SaveGame, rs: number) => { save: SaveGame; line: string } | null) | null } = { fn: null };
const CAL_TEXT = ['a plague', 'a famine', 'a bandit raid', 'a beast tide', 'a flood', 'a fever that took half the street'];
export function resolveCalamity(world: World, save: SaveGame, fromDay: number, toDay: number): SaveGame {
    if (save.dead || save.exp || toDay <= fromDay) return save;
    const city = world.cityById.get(save.locationId);
    if (!city) return save;
    const years = (toDay - fromDay) / 360;
    const h = calamityHazard(world, save);
    if (h <= 0) return save;
    const pEvent = 1 - Math.exp(-(h / CALAMITY_SCARE_SHARE) * years);
    if (fateRoll({ ...save, clockDays: toDay }, 300) >= pEvent) return save;
    const what = CAL_TEXT[hash(`${save.seed}${toDay | 0}c`) % CAL_TEXT.length];
    const violent = what.includes('raid') || what.includes('beast tide');
    if (violent && save.cx?.cave?.at === save.locationId && fateRoll({ ...save, clockDays: toDay }, 303) < 0.25) return { ...save, log: [`🏔️ ${what[0].toUpperCase() + what.slice(1)} reaches ${city.name}, but nobody finds your hidden cave. It passes.`, ...save.log].slice(0, 30) };
    const guarded = violent ? homeGuardHook.fn?.({ ...save, clockDays: toDay }, fateRoll({ ...save, clockDays: toDay }, 302)) : null; // puppets can stop violence, never disease, famine or flood
    if (guarded) return { ...guarded.save, log: [guarded.line.replace('{what}', what).replace('{city}', city.name), ...save.log].slice(0, 30) };
    if (fateRoll({ ...save, clockDays: toDay }, 301) < CALAMITY_SCARE_SHARE) {
        const c = currentCult(save);
        const dead = makeDeath({ ...save, clockDays: toDay }, 'calamity', `${what[0].toUpperCase() + what.slice(1)} swept ${city.name}. A young cultivator with no strength to speak of was one of the many it took.`, c.realm, c.stage);
        return { ...save, dead, paused: true, log: [`☠️ ${what[0].toUpperCase() + what.slice(1)} sweeps ${city.name}. You do not survive it.`, ...save.log].slice(0, 30) };
    }
    const c = { ...currentCult(save) }; c.weak = Math.max(c.weak ?? 0, 60); c.progress = Math.floor(c.progress * 0.9);
    return { ...save, cult: c, log: [`⚠️ ${what[0].toUpperCase() + what.slice(1)} strikes ${city.name}. You barely live through it (qi deviation, 2 months). ${regionDanger(world, city) >= 2 ? 'This place is not safe for the weak.' : ''}`, ...save.log].slice(0, 30) };
}


// ---- Rival schemes: the price of a privileged birth ---------------------------------------------
// Heirs and the children of elders and sect leaders attract plotters. A scheme grows in three signposted steps over
// years: whispers, a survivable attempt, then (after a final warning) one deadly attempt. You can buy peace, find
// protection inside a force, or simply leave: a rival loses the trail of someone who walks away.
export interface Scheme { stage: 1 | 2 | 3; due: number; rival: string; role: string; cityId: string }
const SCHEME_BASE: Record<string, number> = { heir: 0.04, 'leader-child': 0.036, 'elder-child': 0.028 };
const SCHEME_SHIELD = [1, 0.85, 0.5, 0.25, 0.1];
const SCHEME_LETHAL = 0.3;
const SCHEME_STEP = 30;
export function schemeRisk(save: SaveGame): number {
    const base = SCHEME_BASE[save.birth ?? 'common'] ?? 0;
    return base * SCHEME_SHIELD[Math.min(currentCult(save).realm, SCHEME_SHIELD.length - 1)];
}
function rivalFor(save: SaveGame, t: number): { rival: string; role: string } {
    const g = GIVEN_NAMES[hash(`${save.seed}r${t | 0}`) % GIVEN_NAMES.length];
    const s = SURNAMES[hash(`${save.seed}s${t | 0}`) % SURNAMES.length];
    if (save.birth === 'heir') return { rival: `${save.char.surname} ${g}`, role: 'a cousin who wants the clan seat' };
    if (save.birth === 'leader-child') return { rival: `Elder ${s} ${g}`, role: 'an elder who fears your parent\'s successor' };
    return { rival: `${s} ${g}`, role: 'a rival elder\'s disciple' };
}
export function resolveRivals(world: World, save: SaveGame, fromDay: number, toDay: number): SaveGame {
    if (save.dead || save.exp || toDay <= fromDay || !save.birth || save.birth === 'common') return save;
    let cur = save;
    const city = () => world.cityById.get(cur.locationId);
    const log = (line: string) => { cur = { ...cur, log: [line, ...cur.log].slice(0, 30) }; };
    let last = fromDay;
    for (;;) {
        const now = Math.min(last + SCHEME_STEP, toDay);
        const dt = now - last;
        last = now;
        const at = { ...cur, clockDays: now };
        const sc = cur.scheme ?? null;
        if (sc) {
            if (cur.locationId !== sc.cityId) {
                log(`🌫️ You left ${world.cityById.get(sc.cityId)?.name ?? 'home'} behind. ${sc.rival} loses your trail.`);
                cur = { ...cur, scheme: null };
            } else if (now >= sc.due) {
                const next = hash(`${cur.seed}${now | 0}n`);
                if (sc.stage === 1) {
                    const c = { ...currentCult(cur) }; c.weak = Math.max(c.weak ?? 0, 60); c.progress = Math.floor(c.progress * 0.9);
                    cur = { ...cur, cult: c, scheme: { ...sc, stage: 2, due: now + 240 + (next % 300) } };
                    log(`⚠️ Someone laced your tea in ${city()?.name ?? 'home'}. You live, but the qi deviation costs you months. It was ${sc.rival}, ${sc.role}. They will try again.`);
                } else if (sc.stage === 2) {
                    cur = { ...cur, scheme: { ...sc, stage: 3, due: now + 90 + (next % 210) } };
                    log(`🕯️ A hired blade was seen asking after you. ${sc.rival} is done being subtle. Buy peace, find protection, or leave.`);
                } else {
                    const ward = (cur.eco?.items['ward-tal'] ?? 0) > 0;
                    if (ward) { cur = { ...cur, eco: { ...cur.eco!, items: { ...cur.eco!.items, 'ward-tal': cur.eco!.items['ward-tal'] - 1 } } }; log('🛡️ Your Ward Talisman flares and burns to ash as a blade finds your sleeve.'); }
                    if (fateRoll(at, 330) < (ward ? 0.1 : SCHEME_LETHAL) * (1 - gearEffect(cur, 'rival'))) {
                        const c = currentCult(cur);
                        const dead = makeDeath(at, 'rival', `${sc.rival}, ${sc.role}, had you killed. Privilege had warned you for years.`, c.realm, c.stage);
                        return { ...cur, dead, paused: true, scheme: null, log: [`☠️ ${sc.rival} finally strikes. You do not survive.`, ...cur.log].slice(0, 30) };
                    }
                    log(`🗡️ ${sc.rival}'s last attempt on you fails. The plot is exposed and they are gone from the clan.`);
                    cur = { ...cur, scheme: null };
                }
            }
        } else if (fateRoll(at, 310) < schemeRisk(cur) * (dt / 360)) {
            const who = rivalFor(cur, now);
            cur = { ...cur, scheme: { stage: 1, due: now + 360 + (hash(`${cur.seed}${now | 0}d`) % 480), rival: who.rival, role: who.role, cityId: cur.locationId } };
            log(`👀 Whispers in ${city()?.name ?? 'home'}: ${who.rival}, ${who.role}, has been asking where you sleep and what you eat.`);
        }
        if (now >= toDay) break;
    }
    return cur;
}
function currentCost(s: SaveGame) { return currentCult(s); }
export const PEACE_COST = 150;
export function counterScheme(save: SaveGame, move: 'peace' | 'protection'): SaveGame {
    const sc = save.scheme;
    if (!sc) return save;
    const eco = getEco(save);
    const salt = move === 'peace' ? 321 : 322;
    const roll = fateRoll(save, salt);
    if (move === 'peace') {
        if (eco.stones < PEACE_COST) return { ...save, log: [`You cannot afford peace: ${PEACE_COST} spirit stones.`, ...save.log].slice(0, 30) };
        const ok = roll < 0.55;
        return { ...save, eco: { ...eco, stones: eco.stones - PEACE_COST }, scheme: ok ? null : sc, log: [ok ? `🤝 Your gifts soften ${sc.rival}. For now the scheme is shelved.` : `💸 ${sc.rival} takes your gifts and smiles. Nothing changes.`, ...save.log].slice(0, 30) };
    }
    if (!save.membership) return { ...save, log: ['You belong to no banner that can protect you.', ...save.log].slice(0, 30) };
    const ok = roll < 0.7;
    return { ...save, scheme: ok ? null : sc, log: [ok ? `🛡️ Your banner shields you. ${sc.rival} is warned off.` : `Your banner's elders shrug; ${sc.rival} has friends too.`, ...save.log].slice(0, 30) };
}
