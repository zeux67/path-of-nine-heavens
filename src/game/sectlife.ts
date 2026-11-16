// Sect life: a seasonal event (one per 90 days) and the Merit Hall, where contribution buys goods.
import type { SaveGame } from './state';
import { addItem, addStones } from './economy';
import { currentCult, stageCost, sectRankIndex, cultGain } from './cultivation';
import { fateRoll } from './fate';
import { addGear, makeGear, gearBag } from './gear';

export interface SectLifeState { season: number; done: boolean; last?: string }
export const sectLifeOf = (s: SaveGame): SectLifeState => {
    const st = (s as SaveGame & { sectLife?: SectLifeState }).sectLife;
    const season = Math.floor(s.clockDays / 90);
    return st && st.season === season ? st : { season, done: false };
};
const put = (s: SaveGame, st: SectLifeState): SaveGame => ({ ...s, sectLife: st } as SaveGame);
const bump = (s: SaveGame, n: number): SaveGame => ({ ...s, rank: { rank: s.rank?.rank ?? 0, contrib: (s.rank?.contrib ?? 0) + n } });
const say = (s: SaveGame, _msg: string): SaveGame => s;   // the UI's act() writes the log line

export interface SectEvent { id: string; icon: string; title: string; blurb: string; button: string }
const EVENTS: SectEvent[] = [
    { id: 'assembly', icon: '🔔', title: 'Grand Assembly', blurb: 'The elders open the hall and teach. Those who listen well carry a piece of it home.', button: 'Sit and listen' },
    { id: 'trial', icon: '⚔️', title: 'Inter-court Trial', blurb: 'Outer, inner and core courts test each other on the arena stones. Glory and bruises both.', button: 'Enter the arena' },
    { id: 'fair', icon: '⚗️', title: 'Alchemy Fair', blurb: 'Pill masters trade samples and gossip. A patient guest leaves with something useful.', button: 'Walk the stalls' },
    { id: 'hunt', icon: '🌲', title: 'Mountain Hunt', blurb: 'The sect rides out together after beasts. Pelts and cores go to the best hunters.', button: 'Ride out' },
];
export const eventOfSeason = (s: SaveGame): SectEvent => EVENTS[Math.floor(fateRoll(s, 4000 + sectLifeOf(s).season) * EVENTS.length) % EVENTS.length] as SectEvent;

export function joinEvent(s0: SaveGame): { save: SaveGame; msg: string } {
    const st = sectLifeOf(s0);
    if (!s0.membership) return { save: s0, msg: 'Only sworn members may attend.' };
    if (st.done) return { save: s0, msg: 'You already took part this season.' };
    const ev = eventOfSeason(s0), realm = currentCult(s0).realm, k = Math.pow(1.6, realm);
    const r = fateRoll(s0, 4100 + st.season);
    let s = s0, msg = '';
    if (ev.id === 'assembly') {
        const c = { ...currentCult(s) }; if (!c.gate) { const cost = stageCost(c.realm, c.stage); c.progress = Math.min(cost - 1, c.progress + cultGain(s, 0.12, 90)); s = { ...s, cult: c }; }
        s = bump(s, 20); msg = '🔔 You absorb the elders\' words. Your cultivation moves, and you earn 20 contribution.';
    } else if (ev.id === 'trial') {
        const win = 0.45 + sectRankIndex(s) * 0.05 + (s.char.luck ?? 0) / 600;
        if (r < win) { s = addStones(bump(s, 45), Math.round(40 * k)); msg = `⚔️ You win your bouts. 45 contribution and ${Math.round(40 * k)} stones.`; }
        else { s = bump(s, 10); msg = '⚔️ You lose in the second round, bruised but noticed. 10 contribution.'; }
    } else if (ev.id === 'fair') {
        s = addItem(bump(s, 10), r < 0.5 ? 'qi-pill' : 'detox-pill', r < 0.5 ? 2 : 1); msg = `⚗️ A pill master presses ${r < 0.5 ? 'two Qi Gathering Pills' : 'a detox pill'} on you. 10 contribution.`;
    } else {
        s = addItem(bump(s, 30), 'beast-hide', 2 + Math.floor(r * 3)); msg = '🌲 A good hunt. Hides for your share and 30 contribution.';
    }
    return { save: say(put(s, { ...st, done: true, last: msg }), msg), msg };
}

export interface MeritItem { id: string; icon: string; name: string; cost: number; minRank: number; give: () => { items?: Record<string, number>; stones?: number; gear?: boolean }; }
export const MERIT: MeritItem[] = [
    { id: 'm-pill', icon: '💊', name: '5 Qi Gathering Pills', cost: 30, minRank: 0, give: () => ({ items: { 'qi-pill': 5 } }) },
    { id: 'm-ore', icon: '🔹', name: '3 Spirit Ore', cost: 60, minRank: 0, give: () => ({ items: { 'spirit-ore': 3 } }) },
    { id: 'm-bt', icon: '🔮', name: 'Breakthrough Pill', cost: 150, minRank: 1, give: () => ({ items: { 'bt-pill': 1 } }) },
    { id: 'm-core', icon: '🧿', name: 'Core Essence', cost: 120, minRank: 1, give: () => ({ items: { 'core-essence': 1 } }) },
    { id: 'm-art', icon: '🛡️', name: 'Sect artifact (Mortal grade)', cost: 300, minRank: 2, give: () => ({ gear: true }) },
];
export function buyMerit(s0: SaveGame, id: string): { save: SaveGame; msg: string } {
    const m = MERIT.find(x => x.id === id); if (!m) return { save: s0, msg: '' };
    if (!s0.membership) return { save: s0, msg: 'Only sworn members may use the Merit Hall.' };
    if (sectRankIndex(s0) < m.minRank) return { save: s0, msg: 'Your rank is too low for that shelf.' };
    const have = Math.floor(s0.rank?.contrib ?? 0);
    if (have < m.cost) return { save: s0, msg: `Needs ${m.cost} contribution (you have ${have}).` };
    let s: SaveGame = { ...s0, rank: { rank: s0.rank?.rank ?? 0, contrib: (s0.rank?.contrib ?? 0) - m.cost } };
    const g = m.give();
    for (const [k, n] of Object.entries(g.items ?? {})) s = addItem(s, k, n);
    if (g.stones) s = addStones(s, g.stones);
    if (g.gear) s = addGear(s, makeGear(`${s.seed}|${s.clockDays}|${gearBag(s).length}|merit`, 'artifact', 0));
    const msg = `🏛️ The Merit Hall hands over ${m.name} for ${m.cost} contribution.`;
    return { save: say(s, msg), msg };
}
