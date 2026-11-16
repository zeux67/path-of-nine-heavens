// Bounty board: parcels to carry across the land and goods to hand over. Pay and standing grow with each job done.
import type { SaveGame } from './state';
import type { City, World } from './world';
import { distanceLi } from './world';
import { getEco, addItem, addStones, itemById, ITEMS, realmScale } from './economy';

export interface Job { id: string; kind: 'parcel' | 'goods'; title: string; fromCity: string; toCityId?: string; item?: string; n?: number; reward: number; due: number }
export interface JobsState { active: Job[]; done: string[]; rep: number }
export const getJobs = (s: SaveGame): JobsState => s.jobs ?? { active: [], done: [], rep: 0 };
export const MAX_ACTIVE = 3;
const REP_TITLES = ['Unknown', 'Errand-runner', 'Trusted courier', 'Known name', 'Notice-board favourite', 'Legend of the roads'];
export const repTitle = (rep: number) => REP_TITLES[Math.min(5, Math.floor(Math.sqrt(rep / 2)))];
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const GOODS = ['herb', 'iron-ore', 'talisman-paper', 'spirit-tea', 'detox-pill', 'refined-iron', 'spark-tal', 'core-essence'];
const repBonus = (save: SaveGame) => 1 + Math.min(0.3, getJobs(save).rep * 0.02);
const travelDays = (a: City, b: City) => distanceLi(a, b) / 48;

let nearCache: { world: World; id: string; list: City[] } | null = null;
function near(world: World, c: City): City[] {
    if (nearCache && nearCache.world === world && nearCache.id === c.id) return nearCache.list;
    const list = world.cities.filter(o => o.id !== c.id && o.continentId === c.continentId && o.marketTier >= 1).map(o => ({ o, d: travelDays(c, o) })).filter(x => x.d >= 6 && x.d <= 70).map(x => x.o);
    nearCache = { world, id: c.id, list };
    return list;
}
export function boardFor(world: World, save: SaveGame, city: City): Job[] {
    const month = Math.floor(save.clockDays / 30);
    const out: Job[] = [];
    const dests = near(world, city);
    const n = city.marketTier === 0 ? 2 : 4;
    for (let i = 0; i < n; i++) {
        const h = hash(`${city.id}|${month}|job${i}`);
        const id = `${city.id}|${month}|${i}`;
        if (i % 2 === 0 && dests.length) {
            const to = dests[h % dests.length];
            const d = travelDays(city, to);
            out.push({ id, kind: 'parcel', title: `Carry a sealed parcel to ${to.name}`, fromCity: city.id, toCityId: to.id, reward: Math.round((12 + d * 1.3) * realmScale(save) * repBonus(save)), due: save.clockDays + Math.ceil(d * 1.8 + 15) });
        } else {
            const item = GOODS[h % GOODS.length], def = itemById(item)!;
            const cnt = 2 + (h >>> 4) % 4;
            out.push({ id, kind: 'goods', title: `Bring ${cnt} ${def.name}`, fromCity: city.id, item, n: cnt, reward: Math.round(cnt * def.base * 1.7 * repBonus(save)), due: save.clockDays + 40 + (h >>> 8) % 40 });
        }
    }
    return out.filter(j => !getJobs(save).done.includes(j.id) && !getJobs(save).active.some(a => a.id === j.id));
}
export function acceptJob(save0: SaveGame, j: Job): { save: SaveGame; msg: string } {
    const save = pruneJobs(save0);
    const js = getJobs(save);
    if (js.active.length >= MAX_ACTIVE) return { save, msg: `You already carry ${MAX_ACTIVE} errands. Finish or drop one.` };
    return { save: { ...save, jobs: { ...js, active: [...js.active, j] } }, msg: `📋 Taken: ${j.title}.` };
}
export function dropJob(save: SaveGame, id: string): { save: SaveGame; msg: string } {
    const js = getJobs(save);
    return { save: { ...save, jobs: { ...js, active: js.active.filter(a => a.id !== id), rep: Math.max(0, js.rep - 1) } }, msg: 'You drop the errand. Word gets around.' };
}
export function jobStatus(world: World, save: SaveGame, j: Job): { ready: boolean; why: string } {
    if (j.kind === 'parcel') return j.toCityId === save.locationId ? { ready: true, why: '' } : { ready: false, why: `Deliver in ${world.cityById.get(j.toCityId!)?.name ?? '?'}.` };
    const have = getEco(save).items[j.item!] ?? 0;
    return have >= j.n! ? { ready: true, why: '' } : { ready: false, why: `You have ${have} of ${j.n}.` };
}
export function finishJob(world: World, save0: SaveGame, id: string): { save: SaveGame; msg: string } {
    const save = pruneJobs(save0);
    const js = getJobs(save);
    const j = js.active.find(a => a.id === id);
    if (!j) return { save, msg: 'That errand has lapsed.' };
    const st = jobStatus(world, save, j);
    if (!st.ready) return { save, msg: st.why };
    let s = j.kind === 'goods' ? addItem(save, j.item!, -j.n!) : save;
    s = addStones(s, j.reward);
    s = { ...s, jobs: { active: js.active.filter(a => a.id !== id), done: [...js.done, j.id].slice(-60), rep: js.rep + 1 } };
    return { save: s, msg: `💰 ${j.title}: paid ${j.reward} stones. Standing: ${repTitle(js.rep + 1)}.` };
}
// Drop expired errands (lose a point of standing each).
export function pruneJobs(save: SaveGame): SaveGame {
    const js = save.jobs;
    if (!js || !js.active.some(a => a.due < save.clockDays)) return save;
    const keep = js.active.filter(a => a.due >= save.clockDays);
    return { ...save, jobs: { ...js, active: keep, rep: Math.max(0, js.rep - (js.active.length - keep.length)) } };
}
void ITEMS;
