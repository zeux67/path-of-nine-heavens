// Ventures: repeatable early-game work. Beast hunts, escort jobs, herb gathering and ore mining.
// Reward and risk climb together. Every venture shows its danger before you commit, and the deadly ones are signposted.
import type { SaveGame } from './state';
import { addItem, addStones, getEco, itemById } from './economy';
import { currentCult, applyCultivationStep } from './cultivation';
import { fateRoll, makeDeath } from './fate';
import { startBattle } from './combat';
import { bump } from './goals';
import { gearEffect, makeGear, addGear, GRADES } from './gear';
import { A } from './grammar';

export type VentureKind = 'hunt' | 'escort' | 'gather' | 'mine';
export interface Venture { id: string; kind: VentureKind; tier: number; name: string; icon: string; days: number; recRealm: number; note: string; cd: number }
const sc = (r: number) => Math.pow(1.3, r);
export const VENTURES: Venture[] = [
    { id: 'h0', kind: 'hunt', tier: 0, name: 'Hunt wild boars', icon: '🐗', days: 0, recRealm: 0, note: 'Hide, a core now and then. Rarely drops ore.', cd: 3 },
    { id: 'h1', kind: 'hunt', tier: 1, name: 'Hunt a fierce beast', icon: '🐅', days: 0, recRealm: 1, note: 'Cores, hide, ore. Artifact scraps are possible.', cd: 6 },
    { id: 'h2', kind: 'hunt', tier: 2, name: 'Hunt an apex beast', icon: '🐉', days: 0, recRealm: 2, note: 'Rich drops. It can kill you.', cd: 12 },
    { id: 'e0', kind: 'escort', tier: 0, name: 'Guard a village cart', icon: '🛒', days: 4, recRealm: 0, note: 'Steady pay. Small bandit gangs.', cd: 3 },
    { id: 'e1', kind: 'escort', tier: 1, name: 'Escort a merchant train', icon: '🐫', days: 8, recRealm: 1, note: 'Good pay. Raiders strike often.', cd: 6 },
    { id: 'e2', kind: 'escort', tier: 2, name: 'Escort a sect shipment', icon: '📦', days: 14, recRealm: 2, note: 'Big pay. Cultivator thieves hunt it.', cd: 12 },
    { id: 'g0', kind: 'gather', tier: 0, name: 'Gather herbs in the meadows', icon: '🌿', days: 3, recRealm: 0, note: 'Herbs and a small fee from the herbalist.', cd: 2 },
    { id: 'g1', kind: 'gather', tier: 1, name: 'Gather on the misty cliffs', icon: '⛰️', days: 6, recRealm: 1, note: 'Moonblossom, spring water. Falls and beasts.', cd: 5 },
    { id: 'g2', kind: 'gather', tier: 2, name: 'Gather in a poison marsh', icon: '☣️', days: 10, recRealm: 2, note: 'Fire lotus, ginseng. Venom and swamp beasts.', cd: 10 },
    { id: 'm0', kind: 'mine', tier: 0, name: 'Surface ore seam', icon: '⛏️', days: 3, recRealm: 0, note: 'Iron ore, a few specks of spirit ore.', cd: 2 },
    { id: 'm1', kind: 'mine', tier: 1, name: 'Mid shaft of the spirit vein', icon: '🪨', days: 6, recRealm: 1, note: 'Spirit ore and jade. Cave-ins and vein beasts.', cd: 5 },
    { id: 'm2', kind: 'mine', tier: 2, name: 'Deep vein', icon: '🕳️', days: 10, recRealm: 2, note: 'Rich spirit ore, star silver. Qi gas and collapse.', cd: 10 },
    { id: 'm3', kind: 'mine', tier: 3, name: 'Heart of the vein', icon: '💎', days: 16, recRealm: 3, note: 'Star silver and pure ore. Few return.', cd: 20 },
];
export const ventureById = (id: string) => VENTURES.find(v => v.id === id)!;
type Ref = { ventAt?: Record<string, number>; ventN?: number };
const ref = (s: SaveGame) => s as SaveGame & Ref;
export const ventureLeft = (s: SaveGame, v: Venture) => Math.max(0, Math.ceil(v.cd - (s.clockDays - (ref(s).ventAt?.[v.id] ?? -999))));
// Chance that this venture kills you on a bad turn, by how far you are under the recommended realm. Mining and gathering only.
export function ventureRisk(s: SaveGame, v: Venture): number {
    if (v.kind === 'hunt' || v.kind === 'escort') return 0; // handled by the battle itself
    const base = v.kind === 'mine' ? [0.004, 0.016, 0.05, 0.12][v.tier] : [0.002, 0.008, 0.03, 0][v.tier];
    const gap = v.recRealm - currentCult(s).realm;
    return Math.min(0.5, base * Math.pow(1.7, gap));
}
export const riskWord = (s: SaveGame, v: Venture): string => {
    const gap = v.recRealm - currentCult(s).realm;
    if (v.kind === 'hunt' || v.kind === 'escort') return gap >= 1 ? 'deadly' : gap === 0 ? (v.tier >= 2 ? 'dangerous' : 'risky') : 'safe';
    const p = ventureRisk(s, v);
    return p >= 0.08 ? 'deadly' : p >= 0.03 ? 'dangerous' : p >= 0.01 ? 'risky' : 'safe';
};
const pick = <T,>(a: T[], u: number) => a[Math.min(a.length - 1, Math.floor(u * a.length))];
const stonesFor = (v: Venture) => Math.round([14, 40, 110, 0][v.tier] * (v.kind === 'escort' ? 2.4 : 1) * (v.kind === 'gather' ? 0.8 : 1));

function end(s: SaveGame, days: number): SaveGame {
    if (!days) return s;
    const st = applyCultivationStep(s, days, Boolean(s.membership));
    return { ...st, clockDays: st.dead ? st.dead.atDays : s.clockDays + days };
}
const say = (s: SaveGame, line: string): SaveGame => ({ ...s, log: [line, ...s.log].slice(0, 30) });
function wound(s: SaveGame, weak: number, loss: number): SaveGame {
    const c = { ...currentCult(s) }; c.weak = Math.max(c.weak ?? 0, weak); c.progress = Math.floor(c.progress * (1 - loss)); return { ...s, cult: c };
}
function dies(s: SaveGame, text: string): SaveGame {
    const c = currentCult(s);
    return { ...s, dead: makeDeath(s, 'venture', text, c.realm, c.stage), paused: true, log: [`☠️ ${text}`, ...s.log].slice(0, 30) };
}

export function canVenture(s: SaveGame): string | null {
    if (s.dead) return 'You are dead.';
    if (s.travel || s.exp) return 'Not while on the road or inside a realm.';
    if (s.battle) return 'You are in a fight.';
    return null;
}

export function startVenture(s0: SaveGame, id: string): { save: SaveGame; msg: string } {
    const v = ventureById(id), no = canVenture(s0);
    if (no) return { save: s0, msg: no };
    if (ventureLeft(s0, v) > 0) return { save: s0, msg: 'Nothing new to do here yet. Come back in a few days.' };
    const n = (ref(s0).ventN ?? 0) + 1;
    let s: SaveGame = { ...s0, ventAt: { ...(ref(s0).ventAt ?? {}), [id]: s0.clockDays }, ventN: n } as SaveGame;
    const realm = currentCult(s).realm;
    const R = (k: number) => fateRoll(s, 900 + n * 7 + k);
    if (v.kind === 'hunt') {
        const names = [['a wild boar', 'a razor-tusk boar', 'a mountain boar king'], ['a marsh tiger', 'a thunder-striped tiger', 'a cave panther'], ['a scale-wing drake', 'a thousand-year serpent', 'a fire-maned lion']][v.tier];
        const lethal = v.tier >= 2 && realm <= v.recRealm;
        return { save: startBattle(s, { kind: 'hunt', foeName: pick(names, R(1)), foeRealm: v.recRealm, lethal, k: lethal ? 3 : 2, stake: v.tier, haul: 0, hpMul: [0.5, 0.85, 1.1][v.tier], atkMul: [0.55, 0.85, 1][v.tier] }), msg: `${v.icon} You track the beast.` };
    }
    if (v.kind === 'escort') {
        const pay = stonesFor(v);
        const p = [0.3, 0.5, 0.65][v.tier] * (1 - Math.min(0.5, gearEffect(s, 'road')));
        s = end(s, v.days);
        if (s.dead) return { save: s, msg: '☠️ You did not live to see the end of the road.' };
        if (R(2) < p) {
            const foe = [['a bandit gang boss', 'a hungry outlaw'], ['a raider captain', 'a deserter cultivator'], ['a rogue elder', 'a thief of the Black Lotus']][v.tier];
            const lethal = v.tier >= 2 && realm <= v.recRealm;
            return { save: startBattle(say(s, `🛡️ Raiders ambush the ${v.name.toLowerCase().replace(/^(guard|escort) /, '')}. Drive them off to be paid.`), { kind: 'hunt', foeName: pick(foe, R(3)), foeRealm: v.recRealm, lethal, k: lethal ? 3 : 2, stake: 10 + v.tier, haul: pay, hpMul: [0.55, 0.85, 1.1][v.tier], atkMul: [0.6, 0.85, 1][v.tier] }), msg: '🛡️ Ambush!' };
        }
        s = bump(addStones(s, pay), 'escort');
        return { save: say(s, `🛡️ The ${v.name.toLowerCase()} arrives safe. The client pays ${pay} stones.`), msg: `Paid ${pay} stones.` };
    }
    if (v.kind === 'gather') {
        s = end(s, v.days);
        if (s.dead) return { save: s, msg: '☠️ Your body gave out on the trail.' };
        const pools = [['herb', 'herb', 'bitter-root'], ['herb', 'moonblossom', 'spirit-spring', 'moonblossom'], ['fire-lotus', 'ginseng', 'herb', 'fire-lotus']][v.tier];
        const lines: string[] = [];
        const got = 2 + v.tier * 2 + Math.floor(R(4) * 3);
        for (let i = 0; i < got; i++) s = addItem(s, pick(pools, R(10 + i)), 1);
        const fee = stonesFor(v); s = bump(addStones(s, fee), 'gather');
        lines.push(`${v.icon} You bring back ${got} plants and earn ${fee} stones from the herbalist.`);
        const hz = R(5);
        if (hz < ventureRisk(s, v)) return { save: dies(s, [`A sudden fall in the mist ended you.`, 'A swamp beast dragged you under.', 'Marsh venom stopped your heart.'][v.tier]), msg: '☠️' };
        if (hz < 0.2 + 0.1 * v.tier) { s = wound(s, 30 + v.tier * 15, 0.04 + 0.02 * v.tier); lines.push(['🐍 A snake bites you. Weak for a while.', '🪨 You slip on the cliff and tear a muscle.', '☣️ Marsh venom burns through you. You limp home weak.'][v.tier]); }
        if (R(6) < 0.06 + 0.04 * v.tier) { const g = makeGear(`${s.seed}|${n}|gather`, 'treasure', 0, 'Moss-grown Gourd'); s = addGear(s, g); lines.push(`🏺 In a hollow you find the ${g.name}. (See Gear.)`); }
        return { save: lines.reverse().reduce((a, l) => say(a, l), s), msg: lines[lines.length - 1] };
    }
    // mine
    s = end(s, v.days);
    if (s.dead) return { save: s, msg: '☠️ Your body gave out underground.' };
    const lines: string[] = [];
    s = bump(s, 'mine');
    const gap = v.recRealm - realm;
    const q = 1 + Math.floor(R(7) * 3) + v.tier * 2;
    const iron = [4, 3, 1, 0][v.tier] + Math.floor(R(8) * 3);
    if (iron) s = addItem(s, 'iron-ore', iron);
    const spirit = v.tier === 0 ? (R(9) < 0.35 ? 1 : 0) : Math.round(q * [0, 0.55, 0.8, 1.1][v.tier]);
    if (spirit) s = addItem(s, 'spirit-ore', spirit);
    const rare: string[] = [];
    if (v.tier >= 1 && R(11) < 0.25 + 0.1 * v.tier) { s = addItem(s, 'cold-jade', 1 + (v.tier >= 2 ? 1 : 0)); rare.push('cold jade'); }
    if (v.tier >= 2 && R(12) < 0.2 + 0.15 * (v.tier - 2)) { s = addItem(s, 'star-silver', 1 + (v.tier >= 3 ? 1 : 0)); rare.push('star silver'); }
    lines.push(`${v.icon} ${v.name}: ${iron ? iron + ' iron ore' : ''}${iron && spirit ? ', ' : ''}${spirit ? spirit + ' spirit ore' : ''}${rare.length ? ', plus ' + rare.join(' and ') : ''}${!iron && !spirit ? 'nothing' : ''}.`);
    const hz = R(13);
    const p = ventureRisk(s, v);
    if (hz < p) return { save: dies(s, ['', 'A shaft collapsed on you.', 'Qi gas filled the deep vein and you never climbed out.', 'The vein heart breathed out a killing storm of qi.'][v.tier]), msg: '☠️' };
    if (hz < p + 0.18 + 0.08 * v.tier + 0.06 * Math.max(0, gap)) {
        s = wound(s, 40 + v.tier * 20, 0.05 + 0.03 * v.tier);
        lines.push(['⛏️ A rock fall bruises you. Weak for a while.', '💨 A cave-in pins you. You dig out hurt, ore in hand.', '☁️ Qi gas leaks in the deep. Your meridians burn.', '⚡ The vein lashes you with raw qi.'][v.tier]);
    }
    if (v.tier >= 1 && R(14) < 0.22 + 0.04 * v.tier) {
        lines.push('🪨 A vein beast bursts from the wall!');
        const lethal = false;
        s = lines.reverse().reduce((a, l) => say(a, l), s);
        return { save: startBattle(s, { kind: 'hunt', foeName: ['', 'a stone-hide mole', 'a vein-gnawing centipede', 'an ore-eating dragonling'][v.tier], foeRealm: v.recRealm, lethal, k: 2, stake: 20, haul: 0 }), msg: '🪨 A vein beast!' };
    }
    return { save: lines.reverse().reduce((a, l) => say(a, l), s), msg: lines[lines.length - 1] };
}

// Spoils of a won hunt or escort fight. Called from finishBattle.
export function huntSpoils(s: SaveGame, b: { foe: { realm: number; name: string }; rs: number; stake: number; haul?: number }): { save: SaveGame; lines: string[] } {
    let n = s; const lines: string[] = []; const t = Math.min(3, b.stake);
    if (b.haul) { n = bump(addStones(n, b.haul), 'escort'); lines.push(`🛡️ The client pays ${b.haul} stones for the safe road.`); return { save: n, lines }; }
    const u = (k: number) => ((b.rs >>> k) % 1000) / 1000;
    n = bump(n, 'hunt');
    const bounty = [8, 20, 50][Math.min(2, t)]; n = addStones(n, bounty); lines.push(`🪙 The village pays ${bounty} stones bounty.`);
    const hide = 1 + Math.floor(u(1) * (1 + t)); n = addItem(n, 'beast-hide', hide); lines.push(`🥩 You skin the kill: ${hide} beast hide.`);
    if (u(4) < [0.15, 0.4, 0.7][Math.min(2, t)]) { const c = t === 2 ? 2 : 1; n = addItem(n, 'core', c); lines.push(`🔴 You cut out ${c} beast core${c > 1 ? 's' : ''}.`); }
    if (u(7) < [0.1, 0.3, 0.45][Math.min(2, t)]) { const o = 1 + Math.floor(u(9) * 2); n = addItem(n, t >= 1 ? 'spirit-ore' : 'iron-ore', o); lines.push(`⛏️ Ore glints in its den: ${o} ${t >= 1 ? 'spirit ore' : 'iron ore'}.`); }
    if (u(11) < [0.03, 0.08, 0.16][Math.min(2, t)]) {
        const gr = t >= 2 && u(13) < 0.3 ? 1 : 0;
        const g = makeGear(`${n.seed}|${b.rs}|hunt`, u(15) < 0.5 ? 'artifact' : (['weapon', 'charm', 'treasure', 'ring'] as const)[Math.floor(u(17) * 4)], gr);
        n = bump(addGear(n, g), 'artifact'); lines.push(`✨ Something old was lodged in its gut: ${g.name} (${GRADES[g.grade]}-grade). (See Gear.)`);
    }
    return { save: n, lines };
}
export { itemById };
