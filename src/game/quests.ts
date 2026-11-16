// Side quests offered by townsfolk when you talk to them. Procedural: fetch, hunt, gather, mine, escort and help-out.
// They pay when done: stones, pills, cultivation, treasures and now and then an artifact.
import type { SaveGame } from './state';
import { addItem, addStones, getEco, itemById } from './economy';
import { currentCult, stageCost, cultGain } from './cultivation';
import { fateRoll } from './fate';
import { tallyOf } from './goals';
import type { Tally } from './goals';
import { addGear, makeGear, GRADES } from './gear';
import type { Kind } from './gear';
import { A } from './grammar';

export interface QReward { stones?: number; items?: Record<string, number>; cult?: number; gear?: { kind: Kind; grade: number }; text: string }
export interface Quest { id: string; npc: string; role: string; cityId: string; kind: 'fetch' | 'hunt' | 'gather' | 'mine' | 'escort' | 'help'; text: string; item?: string; need: number; base: number; due: number; reward: QReward; fam?: string }
type Ref = { quests?: Quest[]; qN?: number; qDone?: number };
export const questsOf = (s: SaveGame): Quest[] => (s as SaveGame & Ref).quests ?? [];
export const MAX_QUESTS = 3;
const pick = <T,>(a: T[], u: number) => a[Math.min(a.length - 1, Math.floor(u * a.length))];

function rewardFor(s: SaveGame, u: number, u2: number, size: number): QReward {
    const realm = currentCult(s).realm, k = Math.pow(1.6, realm), t = Math.floor(u * 5);
    if (t === 0) { const n = Math.round(size * 18 * k); return { stones: n, text: `${n} spirit stones` }; }
    if (t === 1) { const n = 1 + Math.floor(size / 2); return { items: { 'qi-pill': n * 2 }, text: `${n * 2} Qi Gathering Pills` }; }
    if (t === 2) { const f = Math.min(0.5, 0.08 * size); return { cult: f, text: `${Math.round(f * 100)}% of a stage of cultivation` }; }
    if (t === 3) { const g = size >= 3 && realm >= 1 ? 1 : 0; return { gear: { kind: 'treasure', grade: g }, text: `${A(GRADES[g])}-grade treasure` }; }
    return u2 < 0.5 && size >= 2 ? { gear: { kind: 'artifact', grade: 0 }, text: 'an old artifact (Mortal grade)' } : { items: { 'bt-pill': 1, 'core-essence': 1 }, text: 'a Breakthrough Pill and a core essence' };
}
// Called after a chat. About one in three chats may bring a request, never more than three open at once.
export function maybeOffer(s0: SaveGame, p: { id: string; name: string; role: string; cityId: string }): { save: SaveGame; line: string } {
    const qs = questsOf(s0);
    if (qs.length >= MAX_QUESTS || qs.some(q => q.npc === p.id)) return { save: s0, line: '' };
    const n = ((s0 as SaveGame & Ref).qN ?? 0) + 1;
    const R = (k: number) => fateRoll(s0, 700 + n * 5 + k);
    if (R(0) > 0.34) return { save: s0, line: '' };
    const byRole: Record<string, Quest['kind'][]> = { herbalist: ['fetch', 'gather'], smith: ['fetch', 'mine'], hermit: ['gather', 'help'], trader: ['escort', 'fetch'], teacher: ['help', 'fetch'], hunter: ['hunt', 'hunt', 'fetch'], miner: ['mine', 'fetch'], healer: ['help', 'gather'], wanderer: ['escort', 'hunt', 'fetch'] };
    const kind = pick(byRole[p.role] ?? ['fetch', 'hunt', 'help'], R(1));
    const tally = tallyOf(s0);
    let need = 1, item: string | undefined, text = '', size = 1;
    if (kind === 'fetch') { const pool = p.role === 'smith' ? ['iron-ore', 'refined-iron', 'beast-hide'] : p.role === 'miner' ? ['iron-ore', 'spirit-ore'] : ['herb', 'iron-ore', 'beast-hide', 'bitter-root', 'moonblossom', 'core']; item = pick(pool, R(2)); need = 2 + Math.floor(R(3) * 4); if (item === 'core' || item === 'spirit-ore') need = 1 + Math.floor(R(3) * 2); size = Math.min(3, 1 + Math.floor((itemById(item)?.base ?? 5) * need / 25)); text = `bring ${need} ${itemById(item)?.name ?? item}`; }
    else if (kind === 'hunt') { need = 1 + Math.floor(R(2) * 3); size = need; text = `win ${need} beast hunt${need > 1 ? 's' : ''} (Board > Ventures)`; }
    else if (kind === 'gather') { need = 1 + Math.floor(R(2) * 2); size = need; text = `finish ${need} gathering trip${need > 1 ? 's' : ''}`; }
    else if (kind === 'mine') { need = 1 + Math.floor(R(2) * 2); size = need + 1; text = `finish ${need} mining trip${need > 1 ? 's' : ''}`; }
    else if (kind === 'escort') { need = 1; size = 2; text = 'see one client safely down the road on an escort job'; }
    else { need = 20 + Math.floor(R(2) * 5) * 10; size = Math.min(3, Math.ceil(need / 40)); text = `help with ${need} spirit stones for those in need`; }
    const reward = rewardFor(s0, R(4), R(5), size);
    const tkey: Record<string, keyof Tally> = { hunt: 'hunt', gather: 'gather', mine: 'mine', escort: 'escort' };
    const q: Quest = { id: `q${n}`, npc: p.id, role: p.role, cityId: p.cityId, kind, text, item, need, base: tkey[kind] ? (tally[tkey[kind]] ?? 0) : 0, due: s0.clockDays + 120, reward };
    const line = `📜 ${p.name} asks: ${text}. Reward: ${reward.text}. (Home > Path)`;
    return { save: { ...s0, quests: [...qs, q], qN: n } as SaveGame, line };
}
const tkeyOf = (k: Quest['kind']): keyof Tally | null => k === 'hunt' || k === 'gather' || k === 'mine' || k === 'escort' ? k : null;
export function questProgress(s: SaveGame, q: Quest): number {
    const k = tkeyOf(q.kind);
    if (k) return Math.min(q.need, (tallyOf(s)[k] ?? 0) - q.base);
    if (q.kind === 'fetch') return Math.min(q.need, getEco(s).items[q.item!] ?? 0);
    return Math.min(q.need, getEco(s).stones);
}
export function payQuest(s0: SaveGame, q: Quest): SaveGame {
    let s = s0; const r = q.reward;
    if (r.stones) s = addStones(s, r.stones);
    for (const [k, n] of Object.entries(r.items ?? {})) s = addItem(s, k, n);
    if (r.gear) s = addGear(s, makeGear(`${s.seed}|${q.id}|quest`, r.gear.kind, r.gear.grade));
    if (r.cult) { const c = { ...currentCult(s) }; if (!c.gate) { const cost = stageCost(c.realm, c.stage); c.progress = Math.min(cost - 1, c.progress + cultGain(s, r.cult, r.cult * 1500)); s = { ...s, cult: c }; } }
    const msg = `📜 Quest done for ${q.npc.includes('|') ? 'a townsperson' : q.npc}: ${q.text}. Reward: ${r.text}.`;
    return { ...s, quests: questsOf(s).filter(x => x.id !== q.id), qDone: ((s as SaveGame & Ref).qDone ?? 0) + 1, log: [msg, ...s.log].slice(0, 30) } as SaveGame;
}
export const questReady = (s: SaveGame, q: Quest) => questProgress(s, q) >= q.need;
// Claim a finished quest from the quest menu: hand over goods or coin if asked, then take the reward.
export function claimQuest(s0: SaveGame, id: string): { save: SaveGame; msg: string } {
    const q = questsOf(s0).find(x => x.id === id); if (!q) return { save: s0, msg: '' };
    if (!questReady(s0, q)) return { save: s0, msg: 'Not finished yet.' };
    let s = s0;
    if (q.kind === 'fetch') s = addItem(s, q.item!, -q.need); else if (q.kind === 'help') s = addStones(s, -q.need);
    let out = payQuest(s, q);
    if (q.fam) out = { ...out, family: (out.family ?? []).map(r => r.id === q.fam ? { ...r, meter: Math.min(100, r.meter + 20) } : r) };
    return { save: out, msg: 'Claimed.' };
}
export const dropQuest = (s: SaveGame, id: string): SaveGame => ({ ...s, quests: questsOf(s).filter(q => q.id !== id) } as SaveGame);
// Expired quests fade away (finished ones wait for you).
export function settleQuests(s: SaveGame): SaveGame {
    let n = s;
    for (const q of questsOf(s)) if (n.clockDays > q.due && !questReady(n, q)) n = dropQuest(n, q.id);
    return n;
}

// Family missions: a relative asks for help. Done from the same quest menu; the claim also warms the bond.
const FAM_ASKS: { kind: Quest['kind']; item?: string; need: number; line: (n: string) => string }[] = [
    { kind: 'fetch', item: 'herb', need: 3, line: n => `${n} is sick and needs 3 herbs` },
    { kind: 'fetch', item: 'iron-ore', need: 4, line: n => `${n} needs 4 iron ore for the family smithing` },
    { kind: 'help', need: 40, line: n => `${n} is in debt and needs 40 spirit stones` },
    { kind: 'help', need: 25, line: n => `${n} needs 25 spirit stones for a wedding gift` },
    { kind: 'hunt', need: 1, line: n => `beasts threaten ${n}'s fields: win 1 beast hunt` },
    { kind: 'gather', need: 1, line: n => `${n} wants a gathering trip's worth of herbs for the family, finish 1 gathering trip` },
];
export function familyAsk(s0: SaveGame, rel: { id: string; name: string; rel: string }): { save: SaveGame; msg: string } {
    const qs = questsOf(s0);
    if (qs.some(x => x.fam === rel.id)) return { save: s0, msg: `${rel.name} already asked something of you. Check Quests on the Path home.` };
    if (qs.length >= MAX_QUESTS + 2) return { save: s0, msg: 'You have too many open requests. Finish some first.' };
    const n = ((s0 as SaveGame & Ref).qN ?? 0) + 1;
    const a = FAM_ASKS[Math.floor(fateRoll(s0, 900 + n) * FAM_ASKS.length)] as typeof FAM_ASKS[number];
    const tally = tallyOf(s0);
    const tkey = tkeyOf(a.kind);
    const reward = rewardFor(s0, fateRoll(s0, 910 + n), fateRoll(s0, 920 + n), 2);
    const text = a.line(`${rel.rel === 'Spouse' ? 'your partner' : `your ${rel.rel.toLowerCase()} ${rel.name.split(' ')[0]}`}`);
    const q: Quest = { id: `q${n}`, npc: rel.name, role: 'family', cityId: '', kind: a.kind, text, item: a.item, need: a.need, base: tkey ? (tally[tkey] ?? 0) : 0, due: s0.clockDays + 180, reward, fam: rel.id };
    return { save: { ...s0, quests: [...qs, q], qN: n } as SaveGame, msg: `👪 ${text}. Reward: ${reward.text}, and a warmer bond. (Quests, Path home)` };
}
