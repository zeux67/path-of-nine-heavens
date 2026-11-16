// Goals: a chain of small early-game aims. Each pays out once, then the next opens. Quiet by design: one card, claim when ready.
import type { SaveGame } from './state';
import { addItem, addStones, getEco } from './economy';
import { currentCult, stageCost, cultGain } from './cultivation';
import { gearBag, makeGear, addGear, GRADES } from './gear';
import type { Kind } from './gear';

export type Tally = Partial<Record<'hunt' | 'escort' | 'gather' | 'mine' | 'lucky' | 'craft' | 'artifact', number>>;
type Ref = { tally?: Tally; goalsDone?: string[] };
export const tallyOf = (s: SaveGame): Tally => (s as SaveGame & Ref).tally ?? {};
export const bump = (s: SaveGame, k: keyof Tally, n = 1): SaveGame => ({ ...s, tally: { ...tallyOf(s), [k]: (tallyOf(s)[k] ?? 0) + n } } as SaveGame);
export const goalsDone = (s: SaveGame): string[] => (s as SaveGame & Ref).goalsDone ?? [];

interface Reward { gear?: { kind: Kind; grade: number }; stones?: number; items?: Record<string, number>; cult?: number; text: string }
export interface Goal { id: string; after?: string; icon: string; title: string; hint: string; have: (s: SaveGame) => number; need: number; reward: Reward }
const t = (k: keyof Tally) => (s: SaveGame) => tallyOf(s)[k] ?? 0;
const hasArtifact = (s: SaveGame) => (Object.values(s.gear ?? {}).some(g => g?.kind === 'artifact') || gearBag(s).some(g => g.kind === 'artifact') || (tallyOf(s).artifact ?? 0) > 0) ? 1 : 0;
export const GOALS: Goal[] = [
    { id: 'g-hunt1', icon: '🐗', title: 'Taste blood', hint: 'Win a beast hunt (Board > Ventures).', have: t('hunt'), need: 1, reward: { stones: 25, items: { 'beast-hide': 2 }, text: '25 stones and 2 beast hide' } },
    { id: 'g-gather1', after: 'g-hunt1', icon: '🌿', title: 'A hand for herbs', hint: 'Finish a gathering trip.', have: t('gather'), need: 1, reward: { items: { 'qi-pill': 3 }, text: '3 Qi Gathering Pills' } },
    { id: 'g-mine1', after: 'g-gather1', icon: '⛏️', title: 'Dig for ore', hint: 'Finish a mining trip.', have: t('mine'), need: 1, reward: { items: { 'spirit-ore': 2 }, text: '2 spirit ore' } },
    { id: 'g-escort1', after: 'g-mine1', icon: '🛡️', title: 'Hired blade', hint: 'Bring a client safely to the end of the road.', have: t('escort'), need: 1, reward: { stones: 40, text: '40 stones' } },
    { id: 'g-cult1', after: 'g-escort1', icon: '🧘', title: 'Qi sea stirs', hint: 'Reach stage 4 of Qi Refining.', have: s => currentCult(s).realm > 0 ? 4 : currentCult(s).stage, need: 4, reward: { cult: 0.3, items: { 'core-essence': 1 }, text: 'a core essence and a third of a stage of cultivation' } },
    { id: 'g-luck1', after: 'g-cult1', icon: '🍀', title: 'Touched by fortune', hint: 'Meet a stroke of luck on the road: a cave, a stranger or a hidden market.', have: t('lucky'), need: 1, reward: { gear: { kind: 'treasure', grade: 0 }, stones: 40, text: 'a Mortal-grade treasure and 40 stones' } },
    { id: 'g-art1', after: 'g-luck1', icon: '⚜️', title: 'First artifact', hint: 'Get an artifact: refine one, find one, or win one.', have: hasArtifact, need: 1, reward: { cult: 0.5, items: { 'qi-pill': 2 }, text: 'half a stage of cultivation and 2 qi pills' } },
    { id: 'g-hunt5', after: 'g-art1', icon: '🐅', title: 'Beast slayer', hint: 'Win 5 hunts.', have: t('hunt'), need: 5, reward: { items: { core: 2 }, gear: { kind: 'weapon', grade: 0 }, stones: 80, text: 'a blade, 80 stones and 2 beast cores' } },
    { id: 'g-craft1', after: 'g-hunt5', icon: '⚱️', title: 'Hands at the crucible', hint: 'Complete 5 crafts.', have: t('craft'), need: 5, reward: { gear: { kind: 'artifact', grade: 0 }, items: { 'spirit-ingot': 1 }, text: 'a flying-raft artifact and a spirit ingot' } },
    { id: 'g-force', after: 'g-craft1', icon: '⛩️', title: 'A banner to stand under', hint: 'Join a sect, clan or order.', have: s => s.membership ? 1 : 0, need: 1, reward: { stones: 120, text: '120 stones' } },
    { id: 'g-found', after: 'g-force', icon: '🏔️', title: 'Foundation laid', hint: 'Break through to Foundation Establishment.', have: s => currentCult(s).realm >= 1 ? 1 : 0, need: 1, reward: { stones: 300, gear: { kind: 'artifact', grade: 1 }, items: { 'bt-pill': 1 }, text: 'a Spirit-grade artifact (wearable from Golden Core), 300 stones and a Breakthrough Pill' } },
    { id: 'g-deep', after: 'g-found', icon: '🕳️', title: 'Into the deep vein', hint: 'Finish 3 mining trips in all.', have: t('mine'), need: 3, reward: { items: { 'star-silver': 2 }, text: '2 star silver' } },
    { id: 'g-core', after: 'g-deep', icon: '🔴', title: 'The core condenses', hint: 'Reach Golden Core.', have: s => currentCult(s).realm >= 2 ? 1 : 0, need: 1, reward: { stones: 1000, gear: { kind: 'treasure', grade: 2 }, cult: 0.5, text: 'an Earth-grade treasure, 1000 stones and half a stage of cultivation' } },
];
export const goalById = (id: string) => GOALS.find(g => g.id === id)!;
export const activeGoals = (s: SaveGame): Goal[] => { const d = goalsDone(s); return GOALS.filter(g => !d.includes(g.id) && (!g.after || d.includes(g.after))); };
export const goalReady = (s: SaveGame, g: Goal) => g.have(s) >= g.need;
export function claimGoal(s0: SaveGame, id: string): { save: SaveGame; msg: string } {
    const g = goalById(id);
    if (!g || goalsDone(s0).includes(id) || !goalReady(s0, g)) return { save: s0, msg: '' };
    let s = s0; const r = g.reward;
    if (r.stones) s = addStones(s, r.stones);
    for (const [k, n] of Object.entries(r.items ?? {})) s = addItem(s, k, n);
    if (r.gear) s = addGear(s, makeGear(`${s.seed}|goal|${id}`, r.gear.kind, r.gear.grade));
    if (r.cult) { const c = { ...currentCult(s) }; if (!c.gate) { c.progress = Math.min(stageCost(c.realm, c.stage) - 1, c.progress + cultGain(s, r.cult, r.cult * 1500)); s = { ...s, cult: c }; } }
    s = { ...s, goalsDone: [...goalsDone(s), id] } as SaveGame;
    const msg = `🎯 ${g.title}. Reward: ${r.text}.`;
    return { save: { ...s, log: [msg, ...s.log].slice(0, 30) }, msg };
}
void getEco; void GRADES;
