// Sect duties (timed missions that earn contribution) and fellow disciples (a relations list).
import type { SaveGame } from './state';
import { addStones, getEco } from './economy';
import { SURNAMES, GIVEN_NAMES } from './data';

const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export interface Duty { id: string; icon: string; title: string; days: number; contrib: number; stones: number; risk: number; hurt: string }
export interface DutyState { active: { duty: Duty; endsDay: number; ready?: boolean } | null; done: number; month: number; taken: string[] }
export const getDuty = (s: SaveGame): DutyState => (s as any).duty ?? { active: null, done: 0, month: -1, taken: [] };
const DEFS: Omit<Duty, 'id'>[] = [
    { icon: '🌿', title: 'Tend the spirit herb garden', days: 20, contrib: 25, stones: 15, risk: 0.03, hurt: 'A blighted bed cost you your pay.' },
    { icon: '📜', title: 'Copy scriptures in the library', days: 30, contrib: 40, stones: 5, risk: 0.02, hurt: 'You smudged a rare scroll and paid for it.' },
    { icon: '🛡️', title: 'Patrol the outer wall', days: 25, contrib: 35, stones: 20, risk: 0.15, hurt: 'Beasts mauled the patrol. You were hurt and lost your pay.' },
    { icon: '🐺', title: 'Hunt a mountain beast', days: 40, contrib: 70, stones: 60, risk: 0.3, hurt: 'The beast won. You limp home and pay for the healing.' },
    { icon: '🧳', title: 'Escort a supply caravan', days: 45, contrib: 80, stones: 80, risk: 0.28, hurt: 'Bandits hit the caravan. You lost the pay and part of your purse.' },
    { icon: '⚗️', title: 'Fire the pill furnace overnight', days: 15, contrib: 30, stones: 25, risk: 0.1, hurt: 'The furnace flared and scorched you.' },
];
export function dutyBoard(s: SaveGame): Duty[] {
    const month = Math.floor(s.clockDays / 30), st = getDuty(s);
    const rank = s.rank?.rank ?? 0, scale = 1 + rank * 0.6 + (s.cult?.realm ?? 0) * 0.35;
    return [0, 1, 2, 3].map(i => DEFS[hash(`${s.seed}|duty|${month}|${i}`) % DEFS.length]).filter((d, i, a) => a.findIndex(x => x.title === d.title) === i)
        .map((d, i) => ({ ...d, id: `${month}|${d.title}`, contrib: Math.round(d.contrib * scale), stones: Math.round(d.stones * scale) })).filter(d => !st.taken.includes(d.id));
}
export function takeDuty(s: SaveGame, d: Duty): { save: SaveGame; msg: string } {
    const st = getDuty(s);
    if (st.active) return { save: s, msg: 'You are already on a duty.' };
    return { save: { ...s, duty: { ...st, active: { duty: d, endsDay: s.clockDays + d.days }, taken: [...st.taken, d.id].slice(-12) } } as SaveGame, msg: `${d.icon} You take the duty: ${d.title}. Back in ${d.days} days.` };
}
// A finished duty waits to be claimed from the quest menu.
export function dutyTick(s: SaveGame): SaveGame {
    const st = getDuty(s); const a = st.active; if (!a || a.ready || s.clockDays < a.endsDay || s.dead) return s;
    return { ...s, duty: { ...st, active: { ...a, ready: true } }, log: [`${a.duty.icon} Duty finished: ${a.duty.title}. Claim it in Quests.`, ...s.log].slice(0, 30) } as SaveGame;
}
export function claimDuty(s: SaveGame): SaveGame {
    const st = getDuty(s); const a = st.active; if (!a || !a.ready || s.dead) return s;
    const d = a.duty; const failed = (hash(`${s.seed}|dr|${d.id}`) % 1000) / 1000 < d.risk;
    const log = (t: string) => [t, ...s.log].slice(0, 30);
    if (failed) { const e = getEco(s); const fee = Math.min(e.stones, Math.round(d.stones * 0.5)); const s2 = addStones(s, -fee); return { ...s2, duty: { ...st, active: null }, log: log(`${d.icon} ${d.hurt}`) } as SaveGame; }
    const s2 = addStones(s, d.stones);
    return { ...s2, rank: { rank: s.rank?.rank ?? 0, contrib: (s.rank?.contrib ?? 0) + d.contrib }, duty: { ...st, active: null, done: st.done + 1 }, log: log(`${d.icon} Duty done: ${d.title}. +${d.contrib} contribution, +${d.stones} stones.`) } as SaveGame;
}

// ---- Fellow disciples ----
export type Temper = 'warm' | 'proud' | 'scheming' | 'bookish';
export interface Fellow { id: string; name: string; realm: number; temper: Temper; line: string }
export const TEMPER_INFO: Record<Temper, { icon: string; word: string; line: string }> = {
    warm: { icon: '🙂', word: 'Warm-hearted', line: 'shares food and rumours freely' },
    proud: { icon: '😤', word: 'Proud', line: 'respects only strength' },
    scheming: { icon: '🦊', word: 'Scheming', line: 'smiles too often' },
    bookish: { icon: '📖', word: 'Bookish', line: 'knows every scripture by heart' },
};
export function fellowsOf(s: SaveGame, forceId: string): Fellow[] {
    const r = s.cult?.realm ?? 0;
    return Array.from({ length: 7 }, (_, i) => {
        const h = hash(`${forceId}|fd|${i}`); const t = (['warm', 'proud', 'scheming', 'bookish'] as Temper[])[h % 4];
        return { id: `${forceId}|${i}`, name: `${SURNAMES[h % SURNAMES.length]} ${GIVEN_NAMES[(h >>> 7) % GIVEN_NAMES.length]}`, realm: Math.max(0, r + ((h >>> 12) % 5) - 2), temper: t, line: TEMPER_INFO[t].line };
    });
}
export interface Rel { aff: number; last: number; help: number }
export const relsOf = (s: SaveGame): Record<string, Rel> => (s as any).rels ?? {};
export const relOf = (s: SaveGame, f: Fellow): Rel => relsOf(s)[f.id] ?? { aff: 0, last: -999, help: -999 };
const setRel = (s: SaveGame, id: string, r: Rel): SaveGame => ({ ...s, rels: { ...relsOf(s), [id]: r } } as SaveGame);
export const relWord = (a: number) => a >= 10 ? 'Sworn sibling' : a >= 5 ? 'Close friend' : a >= 2 ? 'Friendly' : a <= -3 ? 'Enemy' : a < 0 ? 'Cold' : 'Acquaintance';
export function chatFellow(s: SaveGame, f: Fellow): { save: SaveGame; msg: string } {
    const r = relOf(s, f); if (s.clockDays - r.last < 30) return { save: s, msg: `${f.name} has nothing more to say this month.` };
    const bump = f.temper === 'proud' && (s.cult?.realm ?? 0) < f.realm ? 0 : 1;
    return { save: setRel(s, f.id, { ...r, aff: r.aff + bump, last: s.clockDays }), msg: bump ? `💬 You share tea with ${f.name}. Ties warm.` : `💬 ${f.name} barely looks at someone of lower realm.` };
}
import { cultGain } from './cultivation';
export const GIFT_WAIT = 7; // days between gifts to the same person
export function giftFellow(s: SaveGame, f: Fellow): { save: SaveGame; msg: string } {
    const r0 = relOf(s, f) as any; if (s.clockDays - (r0.giftAt ?? -999) < GIFT_WAIT) return { save: s, msg: `${f.name} has only just been given a gift. Wait a week or so.` };
    const cost = 25; if (getEco(s).stones < cost) return { save: s, msg: `A gift costs ${cost} stones.` };
    const r = relOf(s, f); const up = f.temper === 'scheming' ? 1 : 2;
    return { save: setRel(addStones(s, -cost), f.id, { ...r, aff: r.aff + up, giftAt: s.clockDays } as any), msg: `🎁 ${f.name} accepts your gift${f.temper === 'scheming' ? ' with a thin smile' : ' warmly'}.` };
}
export function sparFellow(s: SaveGame, f: Fellow): { save: SaveGame; msg: string } {
    const r = relOf(s, f); if (s.clockDays - r.last < 30) return { save: s, msg: 'Wait until next month to spar again.' };
    const win = (s.cult?.realm ?? 0) + (hash(`${s.seed}|sp|${s.clockDays}|${f.id}`) % 3) - 1 >= f.realm;
    const up = f.temper === 'proud' ? (win ? 2 : 1) : 1;
    return { save: setRel(s, f.id, { ...r, aff: r.aff + up, last: s.clockDays }), msg: win ? `🥋 You best ${f.name} in a friendly bout. They bow.` : `🥋 ${f.name} bests you. You both learn something.` };
}
export function askHelp(s: SaveGame, f: Fellow): { save: SaveGame; msg: string } {
    const r = relOf(s, f); if (r.aff < 5) return { save: s, msg: `${f.name} does not trust you enough yet.` };
    if (s.clockDays - r.help < 180) return { save: s, msg: `${f.name} already helped you recently.` };
    const c = 30 + f.realm * 15;
    return { save: { ...setRel(s, f.id, { ...r, help: s.clockDays }), rank: { rank: s.rank?.rank ?? 0, contrib: (s.rank?.contrib ?? 0) + c } } as SaveGame, msg: `🤝 ${f.name} vouches for you before the elders. +${c} contribution.` };
}

// Fellow disciples: share a meal (small stones, warms ties) and study together (cultivation and contribution).
export function mealFellow(s: SaveGame, f: Fellow): { save: SaveGame; msg: string } {
    const r = relOf(s, f) as any;
    if (s.clockDays - (r.meal ?? -999) < 20) return { save: s, msg: `You ate with ${f.name} not long ago.` };
    if (getEco(s).stones < 10) return { save: s, msg: 'A shared meal costs 10 stones.' };
    return { save: setRel(addStones(s, -10), f.id, { ...r, aff: r.aff + 1, meal: s.clockDays }), msg: `🍜 You share a meal with ${f.name} in the dining hall. Talk turns to the sect.` };
}
export function studyFellow(s: SaveGame, f: Fellow): { save: SaveGame; msg: string } {
    const r = relOf(s, f) as any;
    if (r.aff < 2) return { save: s, msg: `${f.name} would rather study alone for now.` };
    if (s.clockDays - (r.study ?? -999) < 60) return { save: s, msg: `You studied with ${f.name} recently.` };
    const c = { ...(s.cult ?? { realm: 0, stage: 0, progress: 0 }) };
    if (c.gate) return { save: s, msg: 'You are at the threshold. Break through first.' };
    const cost = Math.round(1440 * Math.pow(1.64, c.realm) * Math.pow(1.1, c.stage));
    const gain = cultGain(s, 0.05, 15); c.progress = Math.min(cost - 1, c.progress + gain);
    const out = { ...setRel({ ...s, cult: c }, f.id, { ...r, aff: r.aff + 1, study: s.clockDays }), rank: { rank: s.rank?.rank ?? 0, contrib: (s.rank?.contrib ?? 0) + 10 } } as SaveGame;
    return { save: out, msg: `📖 You and ${f.name} study a scripture together. Cultivation moves (+${gain}) and +10 contribution.` };
}
