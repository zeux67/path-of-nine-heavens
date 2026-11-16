import { gearEffect } from './gear';
// Death, lifespan and the descendant legacy. Pure helpers; callers decide when to roll.
import type { SaveGame } from './state';
import { START_AGE_YEARS } from './state';

export type DeathCause = 'old-age' | 'tribulation' | 'breakthrough' | 'secret-realm' | 'pill-poison' | 'ambush' | 'trapped' | 'calamity' | 'rival' | 'venture';

export interface Ancestor { name: string; realm: number; stage: number; age: number; cause: DeathCause; cityId: string; surname: string; years: number }
export interface Lineage { gen: number; bestRealm: number; line: Ancestor[] }
export interface Death { cause: DeathCause; atDays: number; age: number; realm: number; stage: number; text: string }

// Natural lifespan in years, by realm reached. Each realm is a second life.
export const LIFESPAN = [70, 130, 220, 380, 650, 1100, 1800, 2900, 4600, 7500, 12000, 20000, 35000, 60000, 100000];

export function lifespanYears(save: SaveGame, realm: number): number {
    const c = save.char;
    const mult = 1 + c.constitution * 0.04 + (c.fateName === "Heaven's Jealousy" ? -0.05 : 0);
    return Math.round(LIFESPAN[Math.min(realm, LIFESPAN.length - 1)] * mult * (1 - 0.03 * (save.cult?.scars ?? 0)) + gearEffect(save, 'life') - (save.cx?.lifeSpent ?? 0));
}

export function ageAt(days: number): number { return START_AGE_YEARS + days / 360; }

export const CAUSE_LABEL: Record<DeathCause, string> = {
    'old-age': 'Old age', tribulation: 'Heavenly tribulation', breakthrough: 'Failed breakthrough',
    'secret-realm': 'Secret realm', 'pill-poison': 'Pill poison', ambush: 'Ambush on the road', trapped: 'Sealed in a secret realm', calamity: 'Plague, famine or raid', rival: "A rival's scheme", venture: 'A venture gone wrong',
};

// A deterministic unit roll from the save, so a reload cannot reroll fate.
export function fateRoll(save: SaveGame, salt: number): number {
    let x = Math.floor(save.clockDays * 1000) * 2654435761 + salt * 40503 + save.seed * 31 + (save.brk?.attempts ?? 0) * 977 + Math.floor((save.eco?.tox ?? 0) * 100);
    x = Math.imul(x ^ (x >>> 13), 1274126177); x = x ^ (x >>> 16);
    return ((x >>> 0) % 100000) / 100000;
}

// ---- Lethality tables ----------------------------------------------------
// Failure stings at low realms and starts to kill from Golden Core (realm 2) onward.
export function breakthroughDeathChance(save: SaveGame, realm: number, underGrade: boolean, weak: boolean, pill = false): number {
    if (realm < 2) return weak && underGrade ? 0.03 : 0;
    let p = 0.03 * (realm - 1);
    if (pill) p *= 0.5; // a Breakthrough Pill steadies the qi
    if (underGrade) p *= 2;
    if (weak) p *= 1.8; // forcing it through a qi deviation
    return Math.min(0.6, p);
}

// Chance a failed tribulation wave is fatal instead of merely failing the attempt.
export function waveDeathChance(realm: number, underGrade: boolean, constitution = 0, pill = false): number {
    let p = (0.12 + 0.07 * (realm - 4)) / (1 + constitution * 0.08);
    if (pill) p *= 0.75;
    if (underGrade) p *= 1.6;
    return Math.min(0.85, p);
}

// A failed secret realm kills in proportion to how far under-realm you are and how dangerous it is.
export function realmDeathChance(danger: number, realm: number): number {
    if (danger === 0) return 0;
    const under = Math.max(0, danger * 2 - realm);
    if (under === 0) return danger >= 3 ? 0.01 : 0;
    return Math.min(0.92, 0.035 * Math.pow(under, 1.5) * danger * (under === 1 ? 0.5 : 1));
}

// Pill toxicity: heavy overdose is poison. Early overuse stings first (see economy.usePill).
export function pillDeathChance(tox: number): number {
    if (tox < 7) return 0;
    return Math.min(0.9, 0.12 * (tox - 6));
}

export function makeDeath(save: SaveGame, cause: DeathCause, text: string, realm: number, stage: number): Death {
    return { cause, atDays: save.clockDays, age: Math.floor(ageAt(save.clockDays)), realm, stage, text };
}

// ---- Descendants -----------------------------------------------------------
export function extendLineage(prev: Lineage | null | undefined, save: SaveGame, d: Death): Lineage {
    const a: Ancestor = {
        name: `${save.char.given} ${save.char.surname}`, surname: save.char.surname, realm: d.realm, stage: d.stage,
        age: d.age, cause: d.cause, cityId: save.locationId, years: Math.floor(d.atDays / 360),
    };
    const line = [...(prev?.line ?? save.lineage?.line ?? []), a].slice(-30);
    return { gen: (prev?.gen ?? save.lineage?.gen ?? 0) + 1, bestRealm: Math.max(prev?.bestRealm ?? save.lineage?.bestRealm ?? 0, d.realm), line };
}

export interface Inheritance { luck: number; stones: number; qiPills: number; btPill: boolean; blurb: string }
export function inheritance(l: Lineage | null | undefined): Inheritance {
    if (!l) return { luck: 0, stones: 0, qiPills: 0, btPill: false, blurb: '' };
    const luck = Math.min(12, l.bestRealm * 2 + l.gen);
    const stones = 25 * l.bestRealm + 10 * l.gen;
    const qiPills = Math.min(5, l.gen + Math.floor(l.bestRealm / 2));
    const btPill = l.bestRealm >= 3;
    return { luck, stones, qiPills, btPill, blurb: `Ancestral blessing: +${luck} luck, ${stones} spirit stones${qiPills ? `, ${qiPills} Qi Gathering Pill${qiPills > 1 ? 's' : ''}` : ''}${btPill ? ', a Breakthrough Pill' : ''}.` };
}
