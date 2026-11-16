// 1v1 turn-based combat. Pure functions over save.battle. Death is only possible in lethal fights (ambushes, bosses).
import type { SaveGame } from './state';
import { getArts, spellById, techById, ELEMENT_ICON } from './arts';
import type { Element } from './arts';
import { affinityMult, affinityOf } from './arts';
import { beastOf, beastRealm, BEAST_STAGES, puppetsFight } from './craftx';
import { currentCult, finishTribulation, tribulationWaves, heavenMul, addHeaven } from './cultivation';
import { equipped, gearEffect, artifactLevel, makeGear, addGear, GRADES } from './gear';
import { addItem, addStones, getEco, itemById, resolveExpedition } from './economy';
import { makeDeath } from './fate';
import { huntSpoils } from './ventures';
import { A } from './grammar';

export interface Foe { name: string; realm: number; el: Element; hp: number; max: number; atk: number; aff?: number } // aff: how many elements the foe answers to (1 = dangerous)
export interface Battle {
    id: string; kind: 'ambush' | 'duel' | 'boss' | 'raid' | 'hunt'; lethal: boolean; k: number; stake: number; to?: string;
    foe: Foe; hp: number; max: number; qi: number; maxQi: number; ward: number; turn: number; log: string[]; rs: number;
    p: { bleed: number; burn: number; seal: number; stun: number; spark: boolean; guard: boolean; dodge: boolean; artCd: number; allyCd?: number; beastCd?: number };
    f: { bleed: number; burn: number; seal: number; stun: number };
    wave?: number; waves?: number; camp?: string; haul?: number; trib?: boolean; guardian?: boolean; hv?: number;
    over?: 'win' | 'lose' | 'flee' | 'yield'; resolved?: string;
}
export type Action = { t: 'strike' } | { t: 'spell'; id: string } | { t: 'artifact' } | { t: 'item'; id: string } | { t: 'ally' } | { t: 'beast' } | { t: 'guard' } | { t: 'flee' } | { t: 'yield' };

const sc = (r: number) => Math.pow(1.3, r);
const CYCLE: Element[] = ['metal', 'wood', 'earth', 'water', 'fire']; // each overcomes the next
export const overcomes = (a: Element, d: Element) => a !== 'neutral' && d !== 'neutral' && CYCLE[(CYCLE.indexOf(a) + 1) % 5] === d;
export const weakTo = (d: Element): Element | null => d === 'neutral' ? null : CYCLE[(CYCLE.indexOf(d) + 4) % 5];
export const SPELL_QI = [10, 20, 35, 55];
export const BATTLE_ITEMS: Record<string, { label: string; cat: 'talisman' | 'pill' }> = {
    'spark-tal': { label: 'Spark Talisman: next attack hits 60% harder', cat: 'talisman' },
    'ward-tal': { label: 'Ward Talisman: a shield of 35% of your health', cat: 'talisman' },
    'swift-tal': { label: 'Swift-step Talisman: dodge the next blow', cat: 'talisman' },
    'guard-array': { label: 'Guard Array: a shield of 45% of your health', cat: 'talisman' },
    'trap-array': { label: 'Trap Array: stun the foe, next attack hits harder', cat: 'talisman' },
    'viper-venom': { label: 'Viper Venom: poison the foe', cat: 'pill' },
    'qi-pill': { label: 'Qi Pill: restore 40% qi, heal 15%', cat: 'pill' },
    'detox-pill': { label: 'Detox Pill: cure ailments, heal 20%', cat: 'pill' },
    herb: { label: 'Spirit Herb: heal 12%', cat: 'pill' },
};

function rnd(b: Battle): number { b.rs = (Math.imul(b.rs, 1664525) + 1013904223) >>> 0; return b.rs / 4294967296; }
export function playerStats(s: SaveGame) {
    const r = currentCult(s).realm, ch = s.char, w = equipped(s).weapon;
    const ma = Object.values(equipped(s)).reduce((a, g) => a + (g && g.kind !== 'weapon' ? 0 : 0), 0);
    return {
        r, max: Math.round((90 + ch.constitution * 25) * sc(r)),
        atk: (10 + (w?.atk ?? 0)) * sc(r) * (1 + ch.constitution * 0.06) + ma,
        mag: 10 * sc(r) * (1 + ch.comprehension * 0.06), maxQi: 100 + 20 * r,
    };
}
export function startBattle(s: SaveGame, spec: { guardian?: boolean; trib?: boolean; hpMul?: number; atkMul?: number; wave?: number; waves?: number; camp?: string; haul?: number; kind: Battle['kind']; foeName: string; foeRealm: number; lethal: boolean; k?: number; stake?: number; to?: string }): SaveGame {
    const st = playerStats(s), fr = Math.max(0, spec.foeRealm);
    const h = Math.abs(Math.floor(s.clockDays * 97) + fr * 13 + (spec.k ?? 0) * 7 + s.seed) >>> 0;
    const els: Element[] = ['metal', 'wood', 'earth', 'water', 'fire'];
    const el = els[h % 5];
    const aff = spec.guardian || spec.trib ? (spec.trib ? 5 : 1) : [1, 2, 2, 3, 3, 4, 4, 5, 5][(h >>> 4) % 9];
    const foe: Foe = { name: spec.foeName, realm: fr, el, hp: Math.round(95 * sc(fr) * (spec.hpMul ?? 1)), max: Math.round(95 * sc(fr) * (spec.hpMul ?? 1)), atk: 10 * sc(fr) * (spec.atkMul ?? 1) * (aff === 1 ? 1.15 : aff === 2 ? 1.08 : 1), aff };
    const b: Battle = {
        id: `b${h}`, trib: spec.trib, guardian: spec.guardian, wave: spec.wave, waves: spec.waves, camp: spec.camp, haul: spec.haul, kind: spec.kind, lethal: spec.lethal, k: spec.k ?? 0, stake: spec.stake ?? 0, to: spec.to, foe,
        hp: st.max, max: st.max, qi: st.maxQi, maxQi: st.maxQi, ward: 0, turn: 1, rs: h || 7,
        log: [spec.lethal ? `⚠️ ${spec.foeName} means to kill you. Fight, or run.` : `⚔️ ${spec.foeName} faces you.`],
        p: { bleed: 0, burn: 0, seal: 0, stun: 0, spark: false, guard: false, dodge: false, artCd: 0 }, f: { bleed: 0, burn: 0, seal: 0, stun: 0 },
    };
    const pf = puppetsFight(s);
    if (pf.ward) { b.ward += Math.round(b.max * 0.14 * pf.ward); b.log.unshift(`🤖 Your guard puppet${pf.ward > 1 ? 's' : ''} stand before you (ward ${b.ward}).`); }
    return { ...pf.save, battle: b, paused: true };
}
const push = (b: Battle, line: string) => { b.log = [line, ...b.log].slice(0, 8); };
function hitFoe(b: Battle, s: SaveGame, base: number, el: Element, pierce = false): number {
    const r = playerStats(s).r, gap = Math.pow(1.6, Math.max(-3, Math.min(3, r - b.foe.realm)) * 0);
    let d = base * (0.85 + rnd(b) * 0.3) * gap;
    const weak = overcomes(el, b.foe.el); if (weak) { d *= 2; const pa = affinityOf(s.char); if (pa.length < 5 && pa.includes(el)) d *= 1.25; }
    const t = getArts(s).techniques.find(x => x.id === getArts(s).activeTechnique); const tm = t ? 1 + 0.05 + 0.04 * (techById(t.id)?.grade ?? 0) : 1; d *= tm;
    if (b.p.spark) { d *= 1.6; b.p.spark = false; }
    const crit = rnd(b) < 0.1; if (crit) d *= 1.5;
    if (!pierce) d *= 0.9; d = Math.max(1, Math.round(d));
    b.foe.hp = Math.max(0, b.foe.hp - d);
    return d + (weak ? 0.5 : 0) + (crit ? 0.25 : 0);
}
const tag = (v: number) => `${Math.floor(v)}${Math.floor(v) !== v ? (v % 1 >= 0.5 && (v % 1) - 0.5 >= 0.25 ? ' (weakness, crit)' : v % 1 >= 0.5 ? ' (weakness!)' : ' (crit!)') : ''}`;

function foeTurn(b: Battle, s: SaveGame) {
    if (b.f.stun > 0) { b.f.stun--; push(b, `${b.foe.name} is stunned and loses the turn.`); return; }
    if (b.p.dodge) { b.p.dodge = false; push(b, `You step aside. ${b.foe.name}'s blow finds nothing.`); return; }
    const roll = rnd(b); let dmg = b.foe.atk * (0.85 + rnd(b) * 0.3);
    const calam = 1 - Math.min(0.5, gearEffect(s, 'calamity') * 0.5);
    if (roll < 0.22) {
        const k = Math.floor(rnd(b) * 3);
        if (k === 0) { b.p.bleed = 3; push(b, `${b.foe.name}'s blade opens your arm. You are bleeding.`); }
        else if (k === 1 && b.p.seal <= 0) { b.p.seal = 2; push(b, `${b.foe.name} seals your qi for 2 turns.`); }
        else { b.p.burn = 3; push(b, `${b.foe.name} sets your robes alight. You are burning.`); }
        dmg *= 0.6;
    } else if (b.foe.hp < b.foe.max * 0.3 && roll > 0.8) { dmg *= 1.5; push(b, `${b.foe.name} fights desperately.`); }
    if (b.p.guard) { dmg *= 0.5; b.p.guard = false; }
    dmg = Math.round(dmg * calam);
    if (b.ward > 0) { const ab = Math.min(b.ward, dmg); b.ward -= ab; dmg -= ab; if (ab) push(b, `Your ward absorbs ${ab}.`); }
    if (dmg > 0) { b.hp = Math.max(0, b.hp - dmg); push(b, `${b.foe.name} hits you for ${dmg}.`); }
}
function lightning(b: Battle, s: SaveGame) {
    if (b.p.dodge) { b.p.dodge = false; push(b, '⚡ You slip between the bolts. The lightning strikes empty ground.'); return; }
    let dmg = tribBolt(b) * (0.65 + rnd(b) * 0.7) * (1 - Math.min(0.5, gearEffect(s, 'calamity') * 0.5));
    b.p.guard = false;
    dmg = Math.round(dmg);
    if (b.ward > 0) { const ab = Math.min(b.ward, dmg); b.ward -= ab; dmg -= ab; if (ab) push(b, `Your barrier absorbs ${ab}.`); }
    if (dmg > 0) { b.hp = Math.max(0, b.hp - dmg); push(b, `⚡ Bolt ${b.turn} of ${(b.waves ?? 3) * 2} hits you for ${dmg}.`); }
}
function endRound(b: Battle) {
    const dot = (cur: number, max: number) => Math.round(max * 0.05 + 1);
    if (b.p.bleed > 0) { b.hp = Math.max(0, b.hp - dot(b.hp, b.max)); b.p.bleed--; }
    if (b.p.burn > 0) { b.hp = Math.max(0, b.hp - dot(b.hp, b.max)); b.p.burn--; }
    if (b.p.seal > 0) b.p.seal--;
    if (b.f.bleed > 0) { b.foe.hp = Math.max(0, b.foe.hp - dot(b.foe.hp, b.foe.max)); b.f.bleed--; }
    if (b.f.burn > 0) { b.foe.hp = Math.max(0, b.foe.hp - dot(b.foe.hp, b.foe.max)); b.f.burn--; }
    if (b.p.artCd > 0) b.p.artCd--;
    if ((b.p.allyCd ?? 0) > 0) b.p.allyCd!--;
    if ((b.p.beastCd ?? 0) > 0) b.p.beastCd!--;
    b.qi = Math.min(b.maxQi, b.qi + Math.round(b.maxQi * 0.06));
    b.turn++;
}
export function battleActions(s: SaveGame) {
    const b = s.battle!, arts = getArts(s);
    const spells = arts.spells.map(a => spellById(a.id)!).filter(Boolean);
    const art = equipped(s).artifact ?? null;
    const items = Object.keys(BATTLE_ITEMS).filter(id => (getEco(s).items[id] ?? 0) > 0);
    const ally = s.companion ? { name: s.companion.name, cd: b.p.allyCd ?? 0 } : null;
    const bs = beastOf(s); const beast = bs ? { name: bs.name, cd: b.p.beastCd ?? 0 } : null;
    return { spells, art, items, sealed: b.p.seal > 0, ally, beast };
}
export const artifactCost = (lv: number) => 40 + lv * 6;
export function fleeChance(s: SaveGame): number {
    const b = s.battle!; return Math.max(0.15, Math.min(0.9, 0.5 + (playerStats(s).r - b.foe.realm) * 0.12 + gearEffect(s, 'travel') * 0.5));
}
export function act(s: SaveGame, a: Action): SaveGame {
    if (!s.battle || s.battle.over) return s;
    const b: Battle = JSON.parse(JSON.stringify(s.battle)); let ns = s; const st = playerStats(s);
    const use = (id: string) => { ns = addItem(ns, id, -1); };
    if (b.trib && (a.t === 'strike' || a.t === 'spell' || a.t === 'yield' || a.t === 'ally' || a.t === 'beast' || a.t === 'flee' || (a.t === 'item' && !TRIB_OK.has(a.id)))) return s;
    if (b.p.stun > 0) { b.p.stun--; push(b, 'You are stunned and cannot act.'); }
    else if (a.t === 'strike') { const d = hitFoe(b, ns, st.atk, 'neutral'); push(b, `You strike for ${tag(d)}.`); }
    else if (a.t === 'spell') {
        const sp = spellById(a.id); if (!sp || b.p.seal > 0) return s;
        const af = affinityMult(s.char, sp.element); const cost = Math.round(SPELL_QI[sp.grade] * af.cost); if (b.qi < cost) { push(b, 'Not enough qi.'); return { ...s, battle: b }; }
        b.qi -= cost;
        if (sp.kind === 'defense') { b.ward += Math.round(b.max * (0.12 + 0.06 * sp.grade)); push(b, `${sp.name}: a ward rises (${b.ward}).`); }
        else if (sp.kind === 'support') { const h = Math.round(b.max * (0.12 + 0.05 * sp.grade)); b.hp = Math.min(b.max, b.hp + h); push(b, `${sp.name} restores ${h} health.`); }
        else if (sp.kind === 'movement') { b.p.dodge = true; push(b, `${sp.name}: you will slip the next blow.`); }
        else {
            const d = hitFoe(b, ns, st.mag * (1.3 + 0.5 * sp.grade) * af.power, sp.element); push(b, `${ELEMENT_ICON[sp.element]} ${sp.name} hits for ${tag(d)}.`);
            const rr = rnd(b); if (rr < 0.25) { if (sp.element === 'fire') { b.f.burn = 3; push(b, `${b.foe.name} burns.`); } else if (sp.element === 'metal') { b.f.bleed = 3; push(b, `${b.foe.name} bleeds.`); } else if (sp.element === 'earth') { b.f.stun = 1; push(b, `${b.foe.name} is staggered.`); } else if (sp.element === 'water') { b.f.seal = 2; push(b, `${b.foe.name}'s qi is chilled.`); } }
        }
    }
    else if (a.t === 'artifact') {
        const art = equipped(s).artifact; if (!art || b.p.seal > 0 || b.p.artCd > 0) return s;
        const lv = artifactLevel(s, art), cost = artifactCost(lv); if (b.qi < cost) { push(b, 'Not enough qi.'); return { ...s, battle: b }; }
        b.qi -= cost; b.p.artCd = b.trib ? 2 : 3;
        if (b.trib) { const sh = Math.round(b.max * (0.2 + 0.05 * lv + 0.08 * art.grade)); b.ward += sh; push(b, `⚜️ ${art.name} raises a barrier of ${sh}.`); }
        else {
        const d = hitFoe(b, ns, (st.atk + st.mag) * (1.1 + 0.15 * lv + 0.4 * art.grade), 'neutral', true); push(b, `⚜️ ${art.name} strikes for ${tag(d)}, ignoring defence.`); }
    }
    else if (a.t === 'item') {
        if ((getEco(s).items[a.id] ?? 0) < 1) return s; use(a.id);
        if (a.id === 'spark-tal') { b.p.spark = true; push(b, 'The talisman flares. Your next attack hits harder.'); }
        else if (a.id === 'ward-tal') { b.ward += Math.round(b.max * 0.35); push(b, `A ward of ${b.ward} surrounds you.`); }
        else if (a.id === 'guard-array') { b.ward += Math.round(b.max * 0.45); push(b, `The array flares into a barrier of ${b.ward}.`); }
        else if (a.id === 'trap-array') { b.f.stun = Math.max(b.f.stun, 1); b.p.spark = true; push(b, `${b.foe.name} is caught in the array and stunned.`); }
        else if (a.id === 'viper-venom') { b.f.bleed = Math.max(b.f.bleed, 4); push(b, `Venom spreads through ${b.foe.name}.`); }
        else if (a.id === 'swift-tal') { b.p.dodge = true; push(b, 'You move like the wind. The next blow will miss.'); }
        else if (a.id === 'qi-pill') { b.qi = Math.min(b.maxQi, b.qi + Math.round(b.maxQi * 0.4)); b.hp = Math.min(b.max, b.hp + Math.round(b.max * 0.15)); push(b, 'You swallow a Qi Pill.'); }
        else if (a.id === 'detox-pill') { b.p.bleed = b.p.burn = b.p.seal = 0; b.hp = Math.min(b.max, b.hp + Math.round(b.max * 0.2)); push(b, 'A Detox Pill clears your ailments.'); }
        else { b.hp = Math.min(b.max, b.hp + Math.round(b.max * 0.12)); push(b, 'You chew a spirit herb.'); }
    }
    else if (a.t === 'beast') {
        const bs = beastOf(ns); if (!bs || (b.p.beastCd ?? 0) > 0) return s;
        b.p.beastCd = 3;
        if (b.hp < b.max * 0.35 && bs.stage >= 1) { const sh = Math.round(b.max * (0.1 + 0.05 * bs.stage)); b.ward += sh; push(b, `🐾 ${bs.name} throws itself between you and the blow (ward ${sh}).`); }
        else { const d = hitFoe(b, ns, (8 + 0.4 * st.atk) * sc(beastRealm(ns)) * (0.8 + 0.25 * bs.stage), 'neutral'); push(b, `🐾 ${bs.name} the ${BEAST_STAGES[bs.stage].toLowerCase()} tears into ${b.foe.name} for ${tag(d)}.`); }
    }
    else if (a.t === 'ally') {
        const co = ns.companion; if (!co || (b.p.allyCd ?? 0) > 0) return s;
        b.p.allyCd = 3; const cr = Math.max(0, co.realm ?? st.r);
        if (b.hp < b.max * 0.45) { const h = Math.round(b.max * 0.2); b.hp = Math.min(b.max, b.hp + h); push(b, `💞 ${co.name} tends your wounds (+${h}).`); }
        else { const d = hitFoe(b, ns, (10 + 0.5 * st.atk) * sc(cr) * 0.9, 'neutral'); push(b, `💞 ${co.name} strikes with you for ${tag(d)}.`); }
    }
    else if (a.t === 'guard' && b.trib) { if ((b.p.allyCd ?? 0) > 0) { b.qi = Math.min(b.maxQi, b.qi + Math.round(b.maxQi * 0.05)); push(b, 'You endure, breathing, gathering qi.'); } else { b.p.allyCd = 2; const sh = Math.round(b.max * 0.2); b.ward += sh; b.qi = Math.min(b.maxQi, b.qi + Math.round(b.maxQi * 0.05)); push(b, `You circulate your qi into a thin barrier (${sh}).`); } }
    else if (a.t === 'guard') { b.p.guard = true; b.qi = Math.min(b.maxQi, b.qi + Math.round(b.maxQi * 0.05)); push(b, 'You brace. The next blow is halved.'); }
    else if (a.t === 'yield') { if (b.lethal) return s; b.over = 'yield'; push(b, 'You yield.'); return { ...ns, battle: b }; }
    else if (a.t === 'flee') {
        if (b.trib) return s;
        if (rnd(b) < fleeChance(s)) { b.over = 'flee'; push(b, 'You break away and run.'); return { ...ns, battle: b }; }
        push(b, 'You cannot get away.');
    }
    if (b.foe.hp <= 0) { b.over = 'win'; push(b, `${b.foe.name} falls.`); return { ...ns, battle: b }; }
    if (b.trib) { lightning(b, ns); endRound(b); if (b.hp > 0 && b.turn > (b.waves ?? 3) * 2) { b.over = 'win'; push(b, '⚡ The last bolt fades. You have endured the tribulation.'); } return b.hp <= 0 ? { ...ns, battle: { ...b, over: 'lose', log: ['⚡ The lightning breaks you.', ...b.log].slice(0, 8) } } : { ...ns, battle: b }; }
    foeTurn(b, ns); endRound(b);
    if (b.hp <= 0) { b.over = 'lose'; push(b, 'You fall.'); }
    else if (b.foe.hp <= 0) { b.over = 'win'; push(b, `${b.foe.name} succumbs.`); }
    return { ...ns, battle: b };
}
// Apply the result and clear the battle. Lethal losses kill; everything else is a defeat with a price.
export function startTribulation(s: SaveGame): SaveGame {
    const r = currentCult(s).realm, w = tribulationWaves(r + 1);
    const ns = startBattle(s, { kind: 'boss', foeName: 'the Heavenly Tribulation', foeRealm: r + 1, lethal: true, trib: true, hpMul: 1000, atkMul: 1 });
    ns.battle!.waves = w; ns.battle!.wave = 1; ns.battle!.hv = heavenMul(s);
    ns.battle!.log = [`⚡ The Heavenly Tribulation descends: ${w} waves, two bolts each. Defend and endure. You cannot strike back, and you cannot run.`];
    return ns;
}
export const TRIB_OK = new Set(['ward-tal', 'swift-tal', 'qi-pill', 'detox-pill', 'herb', 'guard-array']);
export const tribTotal = (w: number) => w <= 3 ? 2.1 : 2.6 + 0.22 * (w - 4);
export const tribBolt = (b: Battle) => { const n = 2 * (b.waves ?? 3); return b.max * (tribTotal(b.waves ?? 3) / n) * (0.75 + 0.5 * b.turn / n) * (b.hv ?? 1); };
export function startGuardian(s: SaveGame): SaveGame {
    const x = s.exp!; const r = currentCult(s).realm;
    const ns = startBattle(s, { kind: 'boss', foeName: `the guardian of the ${x.name}`, foeRealm: Math.min(14, x.danger * 2), lethal: true, guardian: true, hpMul: 1.15, atkMul: 0.95 });
    ns.battle!.log = [`🗿 The ${x.name} wakes. Its guardian (realm ${Math.min(14, x.danger * 2) + 1}) bars the way out. Fight, or flee with what you can carry.`]; void r;
    return ns;
}
export function finishBattle(s: SaveGame): SaveGame {
    const b = s.battle; if (!b || !b.over) return s;
    if (b.guardian) {
        let n: SaveGame = { ...s, battle: null, paused: false };
        if (b.over === 'win') { const got = Math.round(40 * sc(b.foe.realm)); n = addHeaven(addStones(n, got), 1); n = { ...n, log: [`🗿 The guardian falls. Its hoard holds ${got} stones.`, ...n.log].slice(0, 30) }; }
        return resolveExpedition(n.exp ? { ...n, exp: { ...n.exp, guard: b.over === 'win' ? 'win' : b.over === 'flee' ? 'flee' : 'lose' } } : n);
    }
    if (b.trib) return finishTribulation({ ...s, battle: null, paused: false }, b.over === 'win');
    let n: SaveGame = { ...s, battle: null, paused: false }; const lines: string[] = [];
    const r = currentCult(n).realm;
    if (b.over === 'win') {
        const got = Math.round(15 * sc(b.foe.realm) * (0.6 + (b.rs % 100) / 125));
        n = addStones(n, got); lines.push(`⚔️ You defeat ${b.foe.name} and take ${got} stones.`);
        if (b.foe.realm >= currentCult(n).realm) n = addHeaven(n, 0.5 + 0.25 * (b.foe.realm - currentCult(n).realm));
        if (b.kind === 'hunt') { const sp = huntSpoils(n, b); n = sp.save; lines.push(...sp.lines); }
        if (b.kind !== 'hunt' && b.foe.realm >= 2 && (b.rs % 100) < 12 + b.foe.realm * 2) {
            const kinds = ['robe', 'head', 'belt', 'boots', 'weapon', 'ring', 'charm'] as const;
            const g = makeGear(`${n.seed}|${b.id}`, kinds[b.rs % kinds.length], Math.min(3, Math.floor(b.foe.realm / 3)));
            n = addGear(n, g); lines.push(`${g.icon} It carried ${g.name} (${GRADES[g.grade]}-grade). (See Gear.)`);
        }
        if (b.kind !== 'duel' && b.kind !== 'hunt' && b.foe.realm >= 1 && (b.rs % 100) < 40) {
            const LOOT = ['herb', 'iron-ore', 'talisman-paper', 'spark-tal', 'qi-pill', 'detox-pill', 'core-essence'];
            const it = LOOT[(b.rs >>> 3) % (b.foe.realm >= 4 ? LOOT.length : LOOT.length - 1)]; const def = itemById(it);
            if (def) { n = addItem(n, it, 1); lines.push(`🎒 Found on the body: ${def.name}.`); }
        }
        if (b.kind === 'raid') {
            const w = b.wave ?? 1, W = b.waves ?? 1, hauled = (b.haul ?? 0) + got;
            if (w < W) {
                const nx = startBattle({ ...n, log: [...lines.reverse(), ...n.log].slice(0, 30) }, { kind: 'raid', foeName: `a ${['guard', 'captain', 'camp lord'][Math.min(2, w)]} of the ${b.camp ?? 'camp'}`, foeRealm: b.foe.realm + (w + 1 === W ? 1 : 0), lethal: false, wave: w + 1, waves: W, camp: b.camp, haul: hauled });
                nx.battle!.log.unshift(`⚔️ Wave ${w + 1} of ${W}. Push on or flee with your haul so far.`);
                return nx;
            }
            const chest = Math.round(hauled * 2.2); n = addStones(n, chest); lines.push(`🏴 You sack the ${b.camp ?? 'camp'}: the strongroom holds ${chest} stones.`);
            if ((b.rs % 100) < 45) { const kinds = ['robe', 'head', 'belt', 'boots', 'weapon', 'ring', 'charm'] as const; const g = makeGear(`${n.seed}|${b.id}|raid`, kinds[(b.rs >>> 5) % kinds.length], Math.min(3, Math.floor(b.foe.realm / 3) + 1)); n = addGear(n, g); lines.push(`${g.icon} Among the spoils: ${g.name} (${GRADES[g.grade]}-grade).`); }
        }
        if (b.kind === 'duel') lines[0] = `⚔️ You win the duel against ${b.foe.name} and take ${got + b.stake} stones.`, n = addStones(n, b.stake);
    } else if (b.over === 'flee') { lines.push(`🏃 You escape ${b.foe.name}.`); if (b.k >= 2) { const c = { ...currentCult(n) }; c.weak = Math.max(c.weak ?? 0, 30); n = { ...n, cult: c }; lines.push('You are shaken (a short qi deviation).'); } }
    else {
        if (b.lethal && b.over === 'lose' && b.k >= 3) {
            const dead = makeDeath(n, b.kind === 'hunt' ? 'venture' : 'ambush', b.kind === 'hunt' ? `${b.foe.name} was stronger than the contract paid for. You fought, and you lost.` : `${b.foe.name} caught you on the road to ${b.to ?? 'your destination'}. You fought, and you lost.`, r, currentCult(n).stage);
            return { ...n, dead, paused: true, log: [`☠️ ${b.foe.name} ends your journey.`, ...n.log].slice(0, 30) };
        }
        if (b.kind === 'duel') { const e = getEco(n); const lost = Math.min(b.stake, Math.floor(e.stones * 0.5)); n = addStones(n, -lost); const c = { ...currentCult(n) }; c.weak = Math.max(c.weak ?? 0, 45); n = { ...n, cult: c }; lines.push(`🏳️ You lose the duel. You pay ${lost} stones and nurse your pride and wounds.`); }
        else if (b.kind === 'raid') { const e = getEco(n); const lost = Math.floor(e.stones * 0.25); n = addStones(n, -lost); const c2 = { ...currentCult(n) }; c2.weak = Math.max(c2.weak ?? 0, 60); n = { ...n, cult: c2 }; lines.push(`🏴 The raid on the ${b.camp ?? 'camp'} fails. You are driven off, lose ${lost} stones and are shaken (short qi deviation).`); }
        else if (b.k === 1 || b.lethal) { const e = getEco(n); const lost = Math.floor(e.stones * 0.6); n = addStones(n, -lost); lines.push(`🗡️ ${b.foe.name} robs you. You lose ${lost} spirit stones.`); }
        else { const c = { ...currentCult(n) }; c.weak = Math.max(c.weak ?? 0, 90); c.progress = Math.floor(c.progress * 0.88); n = { ...n, cult: c }; lines.push(`🩸 ${b.foe.name} wounds you badly. You crawl away with a qi deviation (half speed for 3 months).`); }
    }
    return { ...n, log: [...lines.reverse(), ...n.log].slice(0, 30) };
}
export const RAIDS = [
    { id: 'bandit', name: 'Bandit hideout', icon: '🏴', tier: -1, waves: 2, note: 'Weaker foes, small spoils' },
    { id: 'demon', name: 'Demonic outpost', icon: '👹', tier: 0, waves: 3, note: 'Even foes, solid spoils' },
    { id: 'beast', name: 'Beast lord den', icon: '🐲', tier: 1, waves: 3, note: 'Stronger foes, rich spoils' },
];
export const raidSpec = (s: SaveGame, id: string) => {
    const r = currentCult(s).realm, d = RAIDS.find(x => x.id === id)!;
    return { kind: 'raid' as const, foeName: `a guard of the ${d.name.toLowerCase()}`, foeRealm: Math.max(0, r + d.tier), lethal: false, wave: 1, waves: d.waves, camp: d.name.toLowerCase(), haul: 0 };
};
export const duelSpec = (s: SaveGame, tier: -1 | 0 | 1) => {
    const r = currentCult(s).realm; const stake = Math.round(20 * sc(r) * (tier + 2));
    return { kind: 'duel' as const, foeName: ['a young arena disciple', 'a veteran duelist', 'a sword-saint of the arena'][tier + 1], foeRealm: r + tier, lethal: false, stake };
};
