// Character rolling and game-state model.

import {
    ANCESTRIES, COMPREHENSION_TIERS, COMPREHENSION_WEIGHTS, CONSTITUTION_TIERS,
    CONSTITUTION_WEIGHTS, FATE_PATTERNS, FATE_RARITY_WEIGHTS, FatePattern,
    GIVEN_NAMES, NAMED_PHYSIQUES, ROOT_TIERS, ROOT_WEIGHTS, SURNAMES,
} from './data';
import { Rng, pick, pickWeighted, rollLuck } from './rng';
import { City, Force, World } from './world';

export interface Affiliation {
    kind: 'ancestry' | 'sect' | 'clan';
    name: string;
    detail: string;
    forceId: string | null; // set for sect/clan: the character is born at its headquarters
}

export interface Character {
    surname: string;
    given: string;
    birthplaceId: string;
    affiliation: Affiliation | null;
    root: number;            // index into ROOT_TIERS
    constitution: number;    // index into CONSTITUTION_TIERS
    physique: string | null; // named physique, top tiers only
    fateName: string;
    luck: number;            // 1..100
    comprehension: number;   // index into COMPREHENSION_TIERS
    alignment: 'righteous' | 'demonic';
    heavenly?: boolean;      // rare single-element 'Heavenly Affinity' (x1.8)
    affinity?: string[];     // elements the root attunes to; absent = all five (old saves)
    gender?: 'male' | 'female';   // chosen at creation; old saves read as male
    avatar?: string;              // chosen at creation
}

export type AttrKey =
    | 'name' | 'birthplace' | 'affiliation' | 'root' | 'constitution'
    | 'fate' | 'luck' | 'comprehension' | 'alignment';

export const ATTR_LABELS: Record<AttrKey, string> = {
    name: 'Name', birthplace: 'Birthplace', affiliation: 'Affiliation', root: 'Spiritual root',
    constitution: 'Constitution', fate: 'Fate pattern', luck: 'Luck',
    comprehension: 'Comprehension', alignment: 'Alignment',
};

// Spiritual affinity: how many of the five elements the root answers to. Fewer = stronger bonuses. Higher roots lean to fewer.
export const AFFINITY_COUNT_WEIGHTS = [45, 25, 15, 10, 4.5, 0.5]; // 5,4,3,2,1 elements, then the rare 'heavenly' single
export function rollAffinity(rng: Rng, root: number): { el: string[]; heavenly: boolean } {
    const els = ['metal', 'wood', 'water', 'fire', 'earth'];
    const lean = Math.max(0, root - 2) * 0.12; // higher roots: shift weight toward fewer elements
    if (rng() < 0.005) return { el: [els[Math.floor(rng() * 5)]], heavenly: true };
    const w = AFFINITY_COUNT_WEIGHTS.slice(0, 5).map((x, i) => x * (i >= 2 ? 1 + lean * (i - 1) : Math.max(0.2, 1 - lean * (2 - i))));
    let r = rng() * w.reduce((a, b) => a + b, 0), k = 0;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { k = i; break; } }
    const n = 5 - k;
    const pool = [...els]; const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return { el: out, heavenly: false };
}

export function findFate(name: string): FatePattern {
    return FATE_PATTERNS.find(f => f.name === name) ?? FATE_PATTERNS[0];
}

function rollFate(rng: Rng): string {
    const rarity = pickWeighted(rng, [
        { value: 'common' as const, weight: FATE_RARITY_WEIGHTS.common },
        { value: 'uncommon' as const, weight: FATE_RARITY_WEIGHTS.uncommon },
        { value: 'rare' as const, weight: FATE_RARITY_WEIGHTS.rare },
        { value: 'legendary' as const, weight: FATE_RARITY_WEIGHTS.legendary },
    ]);
    return pick(rng, FATE_PATTERNS.filter(f => f.rarity === rarity)).name;
}

function rollBirthplace(rng: Rng, world: World): string {
    const cities: City[] = world.cities;
    const tier = pickWeighted(rng, [
        { value: 'village' as const, weight: 34 },
        { value: 'town' as const, weight: 30 },
        { value: 'city' as const, weight: 22 },
        { value: 'capital' as const, weight: 10 },
        { value: 'market' as const, weight: 4 },
    ]);
    const pool = cities.filter(c => c.tier === tier);
    return (pool.length > 0 ? pick(rng, pool) : pick(rng, cities)).id;
}

function rollAffiliation(rng: Rng, world: World): Affiliation | null {
    const roll = rng();
    if (roll >= 0.12) return null; // affiliation is a rare jackpot
    const kind = pickWeighted(rng, [
        { value: 'clan' as const, weight: 45 },
        { value: 'sect' as const, weight: 35 },
        { value: 'ancestry' as const, weight: 20 },
    ]);
    if (kind === 'clan') {
        const clans: Force[] = world.forces.filter(f => f.kind === 'clan');
        if (clans.length === 0) return null;
        const clan = pick(rng, clans);
        return { kind, name: clan.name, forceId: clan.id, detail: `Born into the ${clan.name} at ${world.cityById.get(clan.hqCityId)?.name ?? 'its seat'}. Its name opens doors, and its enemies are now yours.` };
    }
    if (kind === 'sect') {
        const sects: Force[] = world.forces.filter(f => f.kind === 'sect');
        if (sects.length === 0) return null;
        const sect = pick(rng, sects);
        return { kind, name: sect.name, forceId: sect.id, detail: `Born into an outer court of the ${sect.name} at ${world.cityById.get(sect.hqCityId)?.name ?? 'its headquarters'}. You begin with a technique manual and a senior who owes your family a favor.` };
    }
    const name = pick(rng, ANCESTRIES);
    return { kind, name, forceId: null, detail: 'A sleeping bloodline. It may awaken at a breakthrough, or draw hunters to your door.' };
}

export function rollCharacter(
    rng: Rng,
    world: World,
    locks: Partial<Record<AttrKey, boolean>>,
    prev: Character | null,
): Character {
    const keep = (k: AttrKey) => Boolean(prev && locks[k]);

    // Affiliation first: a clan fixes the surname.
    const affiliation = keep('affiliation') ? prev!.affiliation : rollAffiliation(rng, world);

    let surname = keep('name') ? prev!.surname : pick(rng, SURNAMES);
    if (affiliation?.kind === 'clan' && !keep('name')) {
        // Bare family name only: "Eastern Jiang Clan" -> surname "Jiang".
        surname = (affiliation.forceId ? world.forceById.get(affiliation.forceId)?.surname : null)
            ?? affiliation.name.replace(' Clan', '');
    }
    const given = keep('name') ? prev!.given : pick(rng, GIVEN_NAMES);

    // Born into a sect or clan: home is its headquarters, not a random town.
    let birthplaceId: string;
    if (keep('birthplace')) {
        birthplaceId = prev!.birthplaceId;
    } else if (affiliation && affiliation.forceId) {
        const force = world.forceById.get(affiliation.forceId);
        birthplaceId = force?.hqCityId ?? rollBirthplace(rng, world);
    } else {
        birthplaceId = rollBirthplace(rng, world);
    }

    const constitution = keep('constitution') ? prev!.constitution
        : pickWeighted(rng, CONSTITUTION_WEIGHTS.map((w, i) => ({ value: i, weight: w })));
    let physique = keep('constitution') ? prev!.physique : null;
    if (!keep('constitution')) {
        const chance = constitution >= 6 ? 0.5 : constitution === 5 ? 0.3 : constitution === 4 ? 0.12 : 0;
        physique = rng() < chance ? pick(rng, NAMED_PHYSIQUES).name : null;
    }

    const alignment: Character['alignment'] = keep('alignment') ? prev!.alignment : (rng() < 0.75 ? 'righteous' : 'demonic');
    const fateName = keep('fate') ? prev!.fateName : rollFate(rng);
    // The Lonely Star curse overrides everything: no affiliation, ever.
    const finalAffiliation = findFate(fateName).name === 'Lonely Star' ? null : affiliation;

    const char: Character = {
        surname, given,
        birthplaceId,
        affiliation: finalAffiliation,
        root: keep('root') ? prev!.root
            : pickWeighted(rng, ROOT_WEIGHTS.map((w, i) => ({ value: i, weight: w }))),
        constitution,
        physique,
        fateName,
        luck: keep('luck') ? prev!.luck : rollLuck(rng),
        comprehension: keep('comprehension') ? prev!.comprehension
            : pickWeighted(rng, COMPREHENSION_WEIGHTS.map((w, i) => ({ value: i, weight: w }))),
        alignment,
        gender: prev?.gender ?? 'male',
        avatar: prev?.avatar ?? '🧘‍♂️',
    };
    if (keep('root') && prev?.affinity) { char.affinity = prev.affinity; char.heavenly = prev.heavenly; }
    else { const a = rollAffinity(rng, char.root); char.affinity = a.el; char.heavenly = a.heavenly || undefined; }
    return char;
}

// ---- Clock ----------------------------------------------------------------

export const SPEEDS = [1, 2, 5, 10, 50]; // multipliers
export const OFFLINE_SPEEDS = [0.5, 1, 2]; // multipliers of game speed while away
export const GAME_HOURS_PER_REAL_SECOND = 24; // at 1x: 1 real second = 1 game day

export interface ClockParts { year: number; month: number; day: number; hour: number }

// 12 months of 30 days = 360-day year.
export function clockParts(dayFloat: number): ClockParts {
    const totalDays = Math.floor(dayFloat);
    return {
        year: Math.floor(totalDays / 360) + 1,
        month: Math.floor((totalDays % 360) / 30) + 1,
        day: (totalDays % 30) + 1,
        hour: Math.floor((dayFloat - Math.floor(dayFloat)) * 24),
    };
}

export function formatClock(dayFloat: number): string {
    const p = clockParts(dayFloat);
    return `Year ${p.year} · Month ${p.month} · Day ${p.day}`;
}

export const START_AGE_YEARS = 16;

export function ageYears(dayFloat: number): number {
    return START_AGE_YEARS + Math.floor(dayFloat / 360);
}

// ---- Save ------------------------------------------------------------------

export interface TravelState { fromId: string; toId: string; arriveDays: number }

export interface Membership { forceId: string; sinceDays: number }

export interface SaveGame {
    schema?: number;      // save format version (see migrate.ts)
    wroteBy?: number;
    v: 1;
    seed: number;
    char: Character;
    clockDays: number;
    speed: number;          // index into SPEEDS
    paused: boolean;
    offlineEnabled: boolean;
    offlineSpeed: number;   // index into OFFLINE_SPEEDS
    locationId: string;
    travel: TravelState | null;
    membership?: Membership | null; // optional for pre-home saves
    arts?: import('./arts').ArtsState; // techniques + spells; absent = defaults
    cult?: { realm: number; stage: number; progress: number; gate?: boolean; weak?: number; scars?: number }; // idle cultivation; absent = start
    rank?: { rank: number; contrib: number }; // sect rank climbing; absent = outer disciple, 0 contribution
    battle?: import('./combat').Battle | null;
    tribPending?: import('./cultivation').TribPending;
    wealth?: import('./wealth').Wealth;
    gear?: Record<string, import('./gear').GearItem | null>; // equipped
    gearBag?: import('./gear').GearItem[]; // owned, not worn
    worn?: string[]; // charms worn
    swift?: boolean; // swift-step talisman active for the next journey
    companion?: import('./people').Companion | null;
    disciples?: import('./people').Disciple[];
    bonds?: Record<string, import('./people').Bond>; // friendships with townsfolk
    jobs?: import('./jobs').JobsState; // bounty-board errands and standing
    craft?: import('./craft').CraftState; // refining, alchemy and talisman skill
    eco?: import('./economy').Eco; // spirit stones, pack, pill toxicity
    exp?: import('./economy').Expedition | null; // current secret-realm expedition
    brk?: { attempts: number; fails: number }; // breakthrough record
    dead?: import('./fate').Death | null; // set when this life has ended
    lineage?: import('./fate').Lineage | null; // ancestors of this life
    news?: { d: number; t: string; k: string }[]; // world news feed, newest first
    family?: import('./family').Relative[];
    birth?: import('./family').BirthStatus;
    warned?: number; // last lifespan warning step shown (0-3)
    log: string[];
    scheme?: import('./danger').Scheme | null;   // an active plot against a privileged-born heir
    evq?: { id: string; seed: number }[];   // pending random events (the clock waits)
    evcd?: Record<string, number>;          // event cooldowns by id
    cx?: import('./craft').CraftDepth;
    karma?: number;                          // signed ledger, see karma.ts
    karmaLog?: string[];
    hd?: import('./karma').HdState | null;   // heart-demon tribulation in progress
    evflags?: string[];                      // remembered choices
    evlast?: number;                         // day of the last event
    buffs?: Record<string, number>; // craft buffs: key -> day they end
    heaven?: number; // heaven's attention: grows with heaven-defying deeds, hardens the tribulation
    seclReport?: import('./seclusion').SeclReport | null; // shown once on leaving seclusion
    journal?: { d: number; t: string }[];   // dated copy of the last 30 events
    savedAt: number;        // device time, ms
}

export const SAVE_KEY = 'nh.save.v1';   // never change: every version reads and writes this key
export const SAVE_BACKUP_KEY = 'nh.save.bak.v1';
export const SAVE_SCHEMA = 2;

// ---- Joining a force -------------------------------------------------------

export interface Verdict { ok: boolean; text: string }

// Sects walk a righteous or demonic path, read from their names (Blood, Ghost, Bone, Abyss, Shadow are demonic).
export function forceAlignment(force: Force): 'righteous' | 'demonic' {
    return /\b(Blood|Ghost|Bone|Abyss|Shadow)\b/.test(force.name) ? 'demonic' : 'righteous';
}

export function joinVerdict(char: Character, force: Force, membership: Membership | null | undefined): Verdict {
    if (membership?.forceId === force.id) return { ok: false, text: `You already belong to the ${force.name}.` };
    if (membership) return { ok: false, text: 'You already wear another banner. Renounce it before swearing to a new one.' };
    if (findFate(char.fateName).name === 'Lonely Star') {
        return { ok: false, text: 'The Lonely Star walks alone. The gatekeeper reads your fate and quietly closes the gate. No force will ever claim you.' };
    }
    if (force.kind === 'clan') {
        if (force.surname && char.surname === force.surname) {
            return { ok: true, text: `Your name is ${char.surname} - the blood test is a formality. The ${force.name} welcomes you home.` };
        }
        return { ok: false, text: `The ${force.name} takes only its own blood. No shared surname, no entry.` };
    }
    const fa = forceAlignment(force);
    if (fa !== char.alignment) {
        return { ok: false, text: fa === 'demonic'
            ? `The ${force.name} walks the demonic path. Its gatekeepers smell righteous qi on you and bar the gate.`
            : `The ${force.name} holds to the righteous path. Its elders sense the blood on your qi and turn you away.` };
    }
    // Sects test the spiritual root.
    if (char.root >= 2) {
        return { ok: true, text: `The testing stone flares bright. The ${force.name} accepts you as an outer disciple.` };
    }
    if (char.root === 1 && char.luck >= 50) {
        return { ok: true, text: 'Your root barely stirs the testing stone - but fortune favors you, and an elder waves you through. Outer disciple.' };
    }
    if (char.root === 1) {
        return { ok: false, text: `Your Pseudo Root barely stirs the testing stone. The ${force.name} turns you away - for now.` };
    }
    return { ok: false, text: 'A Mortal Root. The disciples at the gate do not even bother to laugh. Find another road, or make your own.' };
}

export function affinityLine(char: Character): string {
    const a = char.affinity;
    if (!a || a.length >= 5) return ' Affinity: all five elements - flexible, no bonus, no penalty.';
    const icons: Record<string, string> = { metal: '⚔️', wood: '🌿', water: '💧', fire: '🔥', earth: '⛰️' };
    return char.heavenly ? ` HEAVENLY AFFINITY: ${a.map(x => `${icons[x]} ${x}`).join(', ')} alone. Mastery of this one element is extraordinary (x1.8), other elements are weak.`
        : ` Affinity: ${a.map(x => `${icons[x]} ${x}`).join(', ')} (${a.length} ${a.length === 1 ? 'element' : 'elements'}).`;
}

export function describeAttr(key: AttrKey, char: Character, world: World): { value: string; effect: string; rarity: 'plain' | 'good' | 'great' | 'bad' } {
    switch (key) {
        case 'name': {
            const locked = char.affiliation?.kind === 'clan';
            return { value: `${char.surname} ${char.given}`, effect: locked ? `Surname bound to the ${char.surname} Clan.` : 'A commoner name.', rarity: 'plain' };
        }
        case 'birthplace': {
            const c = world.cityById.get(char.birthplaceId);
            if (!c) return { value: 'Unknown', effect: '', rarity: 'plain' };
            const seat = c.forceSeatId ? world.forceById.get(c.forceSeatId) : null;
            const seatNote = seat ? ` Seat of the ${seat.name}.` : '';
            return { value: c.name, effect: `${c.country}, ${c.prefecture}, ${c.continent}.${seatNote}`, rarity: c.tier === 'capital' || c.tier === 'market' || seat ? 'good' : 'plain' };
        }
        case 'affiliation': {
            if (!char.affiliation) return { value: 'None', effect: 'No clan, no sect, no bloodline. The ordinary road.', rarity: 'plain' };
            return { value: char.affiliation.name, effect: char.affiliation.detail, rarity: 'great' };
        }
        case 'root': {
            const r = ROOT_TIERS[char.root];
            return { value: r.name, effect: r.effect + affinityLine(char), rarity: char.root >= 5 ? 'great' : char.root >= 3 ? 'good' : 'plain' };
        }
        case 'constitution': {
            const c = CONSTITUTION_TIERS[char.constitution];
            const phys = char.physique ? ` - ${char.physique}` : '';
            const physEffect = char.physique ? ' ' + (NAMED_PHYSIQUES.find(p => p.name === char.physique)?.effect ?? '') : '';
            return { value: c.name + phys, effect: c.effect + physEffect, rarity: char.physique ? 'great' : char.constitution >= 3 ? 'good' : 'plain' };
        }
        case 'fate': {
            const f = findFate(char.fateName);
            return { value: f.name, effect: `${f.rarity[0].toUpperCase() + f.rarity.slice(1)} ${f.kind}. ${f.effect}`, rarity: f.kind === 'curse' ? 'bad' : f.rarity === 'legendary' || f.rarity === 'rare' ? 'great' : 'plain' };
        }
        case 'luck': {
            return { value: `${char.luck} / 100`, effect: char.luck >= 80 ? 'Fortune leans your way.' : char.luck <= 25 ? 'The dice hate you.' : 'Feeds every gamble: breakthroughs, encounters, loot.', rarity: char.luck >= 80 ? 'good' : char.luck <= 25 ? 'bad' : 'plain' };
        }
        case 'comprehension': {
            const c = COMPREHENSION_TIERS[char.comprehension];
            return { value: c.name, effect: c.effect, rarity: char.comprehension >= 4 ? 'good' : 'plain' };
        }
        case 'alignment': {
            return char.alignment === 'righteous'
                ? { value: 'Righteous ☀️', effect: 'Welcome in righteous sects and markets. Demonic paths are closed to you.', rarity: 'plain' }
                : { value: 'Demonic 🌑', effect: 'Demonic sects open to you; righteous sects and markets will shun you.', rarity: 'bad' };
        }
    }
}
