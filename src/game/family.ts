// Family: parents, grandparents, siblings and (for clan-born) a wider kin web. Mortal relatives grow old and die while you cultivate.
import { applyCultivationStep } from './cultivation';
import { ageYears, type Character, type SaveGame } from './state';
import { LIFESPAN } from './fate';
import { SURNAMES, GIVEN_NAMES, REALMS } from './data';
import { mulberry32 } from './rng';

export interface Relative {
    id: string; name: string; rel: string; age0: number; // age on the day you were born (day 0)
    realm: number; // -1 = mortal
    meter: number; alive: boolean; diedDay?: number; cause?: string;
    note?: string;
    sex?: 'm' | 'f';
}
export type BirthStatus = 'common' | 'heir' | 'elder-child' | 'leader-child';
export const BIRTH_LABEL: Record<BirthStatus, string> = { common: 'Common birth', heir: 'Heir of the clan', 'elder-child': "Child of a sect elder", 'leader-child': "Child of the sect leader" };

export function rollBirthStatus(char: Character, rng: () => number): BirthStatus {
    if (!char.affiliation) return 'common';
    if (char.affiliation.kind === 'clan') return rng() < 0.07 ? 'heir' : 'common';
    const r = rng();
    return r < 0.02 ? 'leader-child' : r < 0.1 ? 'elder-child' : 'common';
}
export function birthPerks(b: BirthStatus): { stones: number; luck: number; blurb: string } {
    if (b === 'heir') return { stones: 300, luck: 3, blurb: "You are the clan's heir. Resources and teachers are yours, and so are the rivals who want your seat." };
    if (b === 'leader-child') return { stones: 400, luck: 4, blurb: "Your parent leads the sect. Every door opens, and every jealous elder watches you." };
    if (b === 'elder-child') return { stones: 150, luck: 2, blurb: 'Your parent is a sect elder. You have patrons, and enemies of your parent.' };
    return { stones: 0, luck: 0, blurb: '' };
}

export function generateFamily(char: Character, seed: number, status: BirthStatus): Relative[] {
    const rng = mulberry32(seed ^ 0x9e3779b1);
    const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
    const kin = char.affiliation?.kind === 'clan';
    const sectish = char.affiliation?.kind === 'sect';
    const privileged = status !== 'common';
    const cultChance = privileged ? 0.95 : kin ? 0.45 : sectish ? 0.25 : 0.06;
    const used = new Set<string>([`${char.surname} ${char.given}`]);
    const uniqueName = (sur: string) => { let n = `${sur} ${pick(GIVEN_NAMES)}`; for (let t = 0; t < 40 && used.has(n); t++) n = `${sur} ${pick(GIVEN_NAMES)}`; if (used.has(n)) n = `${n} the ${used.size + 1}th`; used.add(n); return n; };
    const mk = (rel: string, age: number, sur: string, canCult: boolean, minRealm = 0): Relative => {
        const cult = canCult && rng() < cultChance;
        const realm = cult ? Math.min(6, minRealm + Math.floor(rng() * (privileged ? 4 : 2.2))) : -1;
        return { id: `${rel}${Math.floor(rng() * 1e6)}`, name: uniqueName(sur), rel, age0: age, realm, meter: 45 + Math.floor(rng() * 40), alive: true };
    };
    const out: Relative[] = [];
    const parentRealm = status === 'leader-child' ? 5 : status === 'elder-child' ? 4 : status === 'heir' ? 4 : 0;
    const f = mk('Father', 28 + Math.floor(rng() * 20), char.surname, true, parentRealm);
    const m = mk('Mother', 26 + Math.floor(rng() * 18), pick(SURNAMES), true, Math.max(0, parentRealm - 1));
    out.push(f, m);
    out.push(mk('Grandfather', f.age0 + 25 + Math.floor(rng() * 10), char.surname, true, Math.max(0, parentRealm - 1)));
    out.push(mk('Grandmother', m.age0 + 24 + Math.floor(rng() * 10), pick(SURNAMES), true));
    if (rng() < 0.6) out.push(mk('Grandmother', f.age0 + 24 + Math.floor(rng() * 10), pick(SURNAMES), true));
    const sibs = Math.floor(rng() * 4);
    for (let i = 0; i < sibs; i++) out.push(mk(rng() < 0.5 ? 'Elder brother' : 'Younger sister', Math.max(0, Math.floor(rng() * 10) - (i % 2 ? 4 : -2)), char.surname, true));
    if (kin) {
        const n = 3 + Math.floor(rng() * 5) + (status === 'heir' ? 2 : 0);
        for (let i = 0; i < n; i++) {
            const rel = pick(['Uncle', 'Aunt', 'Cousin', 'Cousin', 'Great-uncle', 'Cousin']);
            const age = rel.startsWith('Cousin') ? Math.floor(rng() * 14) : f.age0 + Math.floor(rng() * 14) - 4;
            out.push(mk(rel, age, rel === 'Aunt' ? pick(SURNAMES) : char.surname, true, rel.startsWith('Great') ? 1 : 0));
        }
    }
    return out;
}

const age = (r: Relative, day: number) => Math.floor(r.age0 + day / 360);
export const relAge = age;
export function relLifespan(r: Relative): number { return r.realm < 0 ? 72 : LIFESPAN[Math.min(r.realm, LIFESPAN.length - 1)]; }
export function relLabel(r: Relative): string { return r.realm < 0 ? 'mortal' : REALMS[r.realm]; }

// Advance relatives by whole years between fromDay and toDay. Deaths and breakthroughs surface as log lines.
export function familyTick(save: SaveGame, fromDay: number, toDay: number): SaveGame {
    const fam = save.family;
    if (!fam || toDay <= fromDay) return save;
    const y0 = Math.floor(fromDay / 360), y1 = Math.floor(toDay / 360);
    if (y1 <= y0) return save;
    const rng = mulberry32((save.seed * 31 + y1 * 977 + y0) >>> 0);
    const lines: string[] = [];
    const next = fam.map(r => ({ ...r }));
    for (let y = y0 + 1; y <= Math.min(y1, y0 + 400); y++) {
        const day = y * 360;
        for (const r of next) {
            if (!r.alive) continue;
            const a = age(r, day), span = relLifespan(r);
            r.meter = Math.max(0, r.meter - 1.2); // neglect
            const hazard = a >= span ? 1 : a > span * 0.8 ? 0.08 + (a - span * 0.8) / span : a > 40 && r.realm < 0 ? 0.004 : 0.001;
            if (rng() < hazard) {
                r.alive = false; r.diedDay = day;
                r.cause = a >= span * 0.8 ? 'old age' : pickOf(rng, ['a fever', 'an accident', 'a sudden sickness', 'heartbreak']);
                const close = r.rel === 'Father' || r.rel === 'Mother';
                lines.push(close ? `🕯️ Word reaches you: your ${r.rel.toLowerCase()}, ${r.name}, has died of ${r.cause} at ${a}. ${r.realm < 0 ? 'A mortal life is so short beside yours.' : 'You were not there.'}` : `🕯️ ${r.name}, your ${r.rel.toLowerCase()}, has died of ${r.cause} at ${a}.`);
            } else if (r.realm >= 0 && r.realm < 8 && rng() < 0.012 * (1 + (5 - Math.min(5, r.realm)) * 0.1)) {
                r.realm += 1;
                lines.push(`🌟 ${r.name}, your ${r.rel.toLowerCase()}, has broken through to the ${REALMS[r.realm]} realm.`);
            }
        }
    }
    const log = lines.length ? [...lines.slice(-3).reverse(), ...save.log].slice(0, 30) : save.log;
    return { ...save, family: next, log };
}
function pickOf<T>(rng: () => number, a: T[]): T { return a[Math.floor(rng() * a.length)]; }

// ---- Interactions ------------------------------------------------------------------
export interface Act { id: 'visit' | 'gift' | 'time' | 'help' | 'ask' | 'meal' | 'train'; label: string }
export const ACTS: Act[] = [
    { id: 'visit', label: 'Visit (at your birthplace)' }, { id: 'gift', label: 'Send 10 stones' },
    { id: 'time', label: 'Spend a season together' }, { id: 'help', label: 'Ask for help' },
    { id: 'ask', label: 'Ask what troubles them' }, { id: 'meal', label: 'Share a family meal' }, { id: 'train', label: 'Cultivate side by side' },
];
// Time spent with family really passes: cultivation, ageing and the family's own clock all advance.
function passDays(s: SaveGame, days: number): SaveGame {
    let n = applyCultivationStep(s, days, Boolean(s.membership));
    n = { ...n, clockDays: n.dead ? n.dead.atDays : s.clockDays + days };
    return n.dead ? n : familyTick(n, s.clockDays, n.clockDays);
}

export function interact(save: SaveGame, relId: string, act: Act['id'], atHome: boolean): { save: SaveGame; msg: string } {
    const fam = save.family ?? [];
    const r = fam.find(x => x.id === relId);
    if (!r || !r.alive) return { save, msg: 'They are gone.' };
    const eco = save.eco ?? { stones: 30, items: {}, tox: 0 };
    let meter = r.meter, msg = '', s = save;
    if (act === 'visit' || act === 'time') {
        if (!atHome) return { save, msg: 'They live in your birthplace. Travel there first.' };
        meter = Math.min(100, meter + (act === 'time' ? 15 : 8));
        msg = act === 'time' ? `🏮 You spend a season with ${r.name}. The bond deepens.` : `🏮 You visit ${r.name}. They are glad you came.`;
        if (act === 'time') s = passDays(s, 90);
    } else if (act === 'gift') {
        if (eco.stones < 10) return { save, msg: 'You do not have 10 stones.' };
        s = { ...s, eco: { ...eco, stones: eco.stones - 10 } };
        meter = Math.min(100, meter + 10); msg = `💎 You send ${r.name} 10 spirit stones. They are moved.`;
    } else if (act === 'meal') {
        if (!atHome) return { save, msg: 'They live in your birthplace. Travel there first.' };
        meter = Math.min(100, meter + 12); s = passDays(s, 3);
        msg = `🍲 A long meal with ${r.name}. Old stories, warm bowls.`;
    } else if (act === 'train') {
        if (!atHome) return { save, msg: 'They live in your birthplace. Travel there first.' };
        meter = Math.min(100, meter + 10); s = passDays(s, 20);
        msg = `🧘 You cultivate beside ${r.name} for a few weeks. The qi feels calmer shared.`;
    } else if (act === 'ask') {
        return { save, msg: '' };
    } else {
        if (meter >= 55 && r.realm >= 0) { const g = 5 + r.realm * 8; s = { ...s, eco: { ...eco, stones: eco.stones + g } }; msg = `🤝 ${r.name} presses ${g} stones into your hand.`; meter -= 5; }
        else if (meter >= 55) { msg = `${r.name} has little to give but kind words.`; }
        else { meter = Math.max(0, meter - 8); msg = `${r.name} turns you away. You have been absent too long.`; }
    }
    return { save: { ...s, family: fam.map(x => x.id === relId ? { ...x, meter } : x), log: [msg, ...s.log].slice(0, 30) }, msg };
}

// ---- Marriage and children -------------------------------------------------------
export function marry(save: SaveGame): { save: SaveGame; msg: string } {
    const fam = save.family ?? [];
    const age = Math.floor(ageYears(save.clockDays));
    if (fam.some(r => r.rel === 'Spouse' && r.alive)) return { save, msg: 'You already have a partner.' };
    if (age < 18) return { save, msg: 'You are too young to wed.' };
    const rng = mulberry32(Math.floor(save.clockDays) ^ save.seed ^ 0x51ed);
    const sur = SURNAMES[Math.floor(rng() * SURNAMES.length)] as string;
    const given = GIVEN_NAMES[Math.floor(rng() * GIVEN_NAMES.length)] as string;
    const cult = rng() < 0.35;
    const sp: Relative = { id: `sp-${Math.floor(save.clockDays)}`, name: `${typeof sur === 'string' ? sur : 'Lin'} ${given}`, rel: 'Spouse', age0: age + Math.floor(rng() * 4) - 2 - save.clockDays / 360, realm: cult ? 0 : -1, meter: 70, alive: true };
    return { save: { ...save, family: [...fam, sp], log: [`💍 You wed ${sp.name}, your ${(save.char.gender ?? 'male') === 'male' ? 'wife' : 'husband'}.`, ...save.log].slice(0, 30) }, msg: `💍 You wed ${sp.name}.` };
}
export function haveChild(save: SaveGame): { save: SaveGame; msg: string } {
    const fam = save.family ?? [];
    if (!fam.some(r => r.rel === 'Spouse' && r.alive)) return { save, msg: 'You need a living partner first.' };
    const last = fam.filter(r => r.rel === 'Child').map(r => (r as any).born ?? 0).reduce((a, b) => Math.max(a, b), -9999);
    if (save.clockDays - last < 720) return { save, msg: 'A new child must wait at least two years after the last.' };
    const rng = mulberry32(Math.floor(save.clockDays) ^ save.seed ^ 0xc41d);
    const given = GIVEN_NAMES[Math.floor(rng() * GIVEN_NAMES.length)] as string;
    const ch = { id: `ch-${Math.floor(save.clockDays)}`, name: `${given} ${save.char.surname}`, rel: 'Child', sex: rng() < 0.5 ? 'm' : 'f', age0: -Math.floor(save.clockDays / 360), born: save.clockDays, realm: rng() < 0.5 ? 0 : -1, meter: 80, alive: true } as Relative;
    return { save: { ...save, family: [...fam, ch], log: [`👶 A child is born: ${ch.name}.`, ...save.log].slice(0, 30) }, msg: `👶 A child is born: ${ch.name}.` };
}
