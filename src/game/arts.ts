// Techniques (cultivation methods) and spells (active arts).
// Data model is built so later slices (secret realms, markets, combat) can hang content on it:
// every art has an element, grade, source and mastery ladder; spells carry a combat `kind`
// and `power` that nothing uses yet.

import { COMPREHENSION_TIERS } from './data';
import type { Character, SaveGame } from './state';
import type { Force } from './world';

export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'neutral';
export const ELEMENTS: Element[] = ['metal', 'wood', 'water', 'fire', 'earth'];
export const ELEMENT_ICON: Record<Element, string> = {
    metal: '⚔️', wood: '🌿', water: '💧', fire: '🔥', earth: '⛰️', neutral: '☯️',
};

export const GRADES = ['Yellow', 'Mystic', 'Earth', 'Heaven'] as const; // 0..3
export const MASTERY_TIERS = ['Initiate', 'Small Success', 'Great Success', 'Perfection'] as const;

export type ArtSource = 'start' | 'sect' | 'market' | 'secret-realm' | 'legacy';

export interface Technique {
    id: string;
    name: string;
    element: Element;
    grade: number;       // index into GRADES
    blurb: string;
}

export type SpellKind = 'attack' | 'defense' | 'movement' | 'support';

export interface Spell {
    id: string;
    name: string;
    element: Element;
    grade: number;
    kind: SpellKind;
    power: number;       // reserved for the combat slice
    blurb: string;
}

const TECH_NAMES: Record<Exclude<Element, 'neutral'>, [string, string, string, string]> = {
    metal: ['Iron Bone Breathing', 'Whitegold Sword Scripture', 'Ten Thousand Blades Canon', 'Heaven-Cutting Metal Classic'],
    wood: ['Green Sprout Method', 'Ancient Cedar Sutra', 'Eternal Spring Canon', 'World-Tree Heavenly Classic'],
    water: ['Still Pond Breathing', 'Moonlit Stream Scripture', 'Nine Rivers Canon', 'Boundless Ocean Classic'],
    fire: ['Ember Heart Method', 'Cinnabar Sun Scripture', 'Phoenix Rebirth Canon', 'Nine-Sun Heavenly Classic'],
    earth: ['Stone Root Breathing', 'Mountain Seat Scripture', 'Yellow Dragon Canon', 'Pillar of Heaven Classic'],
};

const SPELL_NAMES: Record<Exclude<Element, 'neutral'>, [string, string, string, string]> = {
    metal: ['Gold Needle Barrage', 'Sword Light Step', 'Myriad Blade Rain', 'Heaven-Splitting Edge'],
    wood: ['Vine Snare', 'Bark Skin Ward', 'Spring Mending Rain', 'Forest Sovereign Domain'],
    water: ['Frost Mirror', 'Mist Veil Step', 'Tidal Palm', 'Ninefold Ocean Shield'],
    fire: ['Spark Talisman', 'Flame Lotus Burst', 'Red Cloud Dash', 'Phoenix Fire Descent'],
    earth: ['Stone Skin', 'Rockfall Seal', 'Earth Vein Walk', 'Mountain Crushing Seal'],
};
const SPELL_KINDS: SpellKind[][] = [
    ['attack', 'movement', 'attack', 'attack'],
    ['support', 'defense', 'support', 'defense'],
    ['defense', 'movement', 'attack', 'defense'],
    ['attack', 'attack', 'movement', 'attack'],
    ['defense', 'attack', 'movement', 'attack'],
];
const KIND_BLURB: Record<SpellKind, string> = {
    attack: 'An offensive art. Its power will matter once fighting arrives.',
    defense: 'A guarding art. Will turn blows aside once fighting arrives.',
    movement: 'A movement art. Quickens steps and escapes.',
    support: 'A supporting art. Heals, aids and sustains.',
};

export const TECHNIQUES: Technique[] = [
    { id: 'tech-basic', name: 'Basic Breathing Method', element: 'neutral', grade: 0, blurb: 'The first thing every mortal cultivator learns. Slow, even breaths that gather the thinnest qi.' },
    ...ELEMENTS.flatMap(el => TECH_NAMES[el as Exclude<Element, 'neutral'>].map((name, g): Technique => ({
        id: `tech-${el}-${g}`, name, element: el, grade: g,
        blurb: `A ${GRADES[g]}-grade ${el} cultivation method. It leans your qi toward ${el}.`,
    }))),
];

export const SPELLS: Spell[] = ELEMENTS.flatMap((el, ei) => SPELL_NAMES[el as Exclude<Element, 'neutral'>].map((name, g): Spell => {
    const kind = SPELL_KINDS[ei][g];
    return { id: `spell-${el}-${g}`, name, element: el, grade: g, kind, power: 10 + g * 14, blurb: `${GRADES[g]}-grade ${el} art. ${KIND_BLURB[kind]}` };
}));

export const techById = (id: string) => TECHNIQUES.find(t => t.id === id);
export const spellById = (id: string) => SPELLS.find(s => s.id === id);

// ---- Learned arts ----------------------------------------------------------

export interface LearnedArt {
    id: string;
    source: ArtSource;
    points: number;      // mastery points
    talent: number;      // hidden multiplier, 0.6..1.4, revealed at Small Success
}

export interface ArtsState {
    techniques: LearnedArt[];
    spells: LearnedArt[];
    activeTechnique: string | null;
    practicing: string | null; // spell id being drilled
}

export const MAX_TECHNIQUES = 3;
export const MAX_SPELLS = 4;

// Points needed to climb from a tier to the next. Index = current tier 0..2.
export function tierCost(grade: number, tier: number): number {
    return Math.round(90 * (grade + 1) * Math.pow(2.2, tier));
}

export function masteryOf(grade: number, points: number): { tier: number; into: number; need: number; maxed: boolean } {
    let p = points;
    for (let t = 0; t < 3; t++) {
        const c = tierCost(grade, t);
        if (p < c) return { tier: t, into: p, need: c, maxed: false };
        p -= c;
    }
    return { tier: 3, into: 1, need: 1, maxed: true };
}

// Hidden talent: stable per (character, art) so it never changes between loads.
export function talentFor(char: Character, artId: string): number {
    let h = 2166136261;
    const key = `${char.surname}|${char.given}|${char.birthplaceId}|${artId}`;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    const u = ((h >>> 0) % 1000) / 1000;
    return Math.round((0.6 + u * 0.8) * 100) / 100;
}

export function sectElement(force: Force): Element {
    let h = 0;
    for (let i = 0; i < force.id.length; i++) h = (h * 31 + force.id.charCodeAt(i)) >>> 0;
    return ELEMENTS[h % ELEMENTS.length];
}

export function defaultArts(save: Pick<SaveGame, 'char'>): ArtsState {
    const c = save.char;
    const arts: ArtsState = {
        techniques: [{ id: 'tech-basic', source: 'start', points: 0, talent: talentFor(c, 'tech-basic') }],
        spells: [], activeTechnique: 'tech-basic', practicing: null,
    };
    if (c.affiliation?.kind === 'sect') {
        const own = affinityOf(c), el = own[(c.surname.length + c.given.length) % own.length] as Element;
        arts.techniques.push({ id: `tech-${el}-0`, source: 'sect', points: 0, talent: talentFor(c, `tech-${el}-0`) });
        arts.spells.push({ id: `spell-${el}-0`, source: 'sect', points: 0, talent: talentFor(c, `spell-${el}-0`) });
        arts.activeTechnique = `tech-${el}-0`;
    }
    return arts;
}

export function getArts(save: SaveGame): ArtsState {
    return save.arts ?? defaultArts(save);
}

// ---- Effects ---------------------------------------------------------------

// Cultivation-rate multiplier from the active technique (1.0 when none).
export function techniqueMult(char: Character, arts: ArtsState): { name: string; mult: number } | null {
    const act = arts.techniques.find(t => t.id === arts.activeTechnique);
    const t = act ? techById(act.id) : null;
    if (!act || !t) return null;
    const m = masteryOf(t.grade, act.points);
    const base = 0.08 + 0.1 * t.grade;                  // grade power
    const mastery = 1 + m.tier * 0.4;                   // mastery grows it
    const talent = m.tier >= 1 ? act.talent : 1;        // talent only bites once revealed
    return { name: t.name, mult: (1 + base * mastery * talent) * techniqueSpeed(char, t.element) };
}

export const PRACTICE_DRAG = 0.75; // meditation efficiency while drilling a spell

// Highest grade this character can learn: comprehension gates it; outer disciples cap lower.
export function gradeCap(char: Character, inSect: boolean): number {
    const byComp = Math.min(3, Math.floor(char.comprehension / 2));
    return inSect ? Math.min(byComp, 1) : byComp;
}

export interface LibraryEntry { kind: 'technique' | 'spell'; id: string }

// What a sect library offers a member: its element at grades the character can handle.
export function libraryFor(force: Force, char: Character): LibraryEntry[] {
    const el = sectElement(force);
    const cap = gradeCap(char, true);
    const out: LibraryEntry[] = [];
    for (let g = 0; g <= cap; g++) {
        out.push({ kind: 'technique', id: `tech-${el}-${g}` });
        out.push({ kind: 'spell', id: `spell-${el}-${g}` });
    }
    return out;
}

export function learnCheck(save: SaveGame, kind: 'technique' | 'spell', id: string): { ok: boolean; why?: string } {
    const arts = getArts(save);
    const list = kind === 'technique' ? arts.techniques : arts.spells;
    if (list.some(a => a.id === id)) return { ok: false, why: 'Already known.' };
    if (kind === 'technique' && list.length >= MAX_TECHNIQUES) return { ok: false, why: `You can hold only ${MAX_TECHNIQUES} techniques. Forget one first.` };
    if (kind === 'spell' && list.length >= MAX_SPELLS) return { ok: false, why: `You can hold only ${MAX_SPELLS} spells. Forget one first.` };
    return { ok: true };
}

// Advance mastery over `days` of meditation. Returns the new arts state and story lines.
export function advanceArts(save: SaveGame, days: number): { arts: ArtsState; lines: string[] } {
    const arts = getArts(save);
    const learn = COMPREHENSION_TIERS[save.char.comprehension].learn;
    const lines: string[] = [];
    const bump = (list: LearnedArt[], activeId: string | null, perDay: number, getter: (id: string) => { name: string; grade: number } | undefined) =>
        list.map(a => {
            if (a.id !== activeId) return a;
            const info = getter(a.id);
            if (!info) return a;
            const before = masteryOf(info.grade, a.points);
            const points = a.points + days * perDay * learn * (before.tier >= 1 ? a.talent : 1);
            const after = masteryOf(info.grade, points);
            if (after.tier > before.tier) {
                const tail = after.tier === 1 ? ` Its hidden talent shows: you are ${a.talent >= 1.1 ? 'gifted' : a.talent <= 0.8 ? 'clumsy' : 'steady'} with it (x${a.talent.toFixed(2)}).` : '';
                lines.push(`📖 ${info.name}: ${MASTERY_TIERS[after.tier]}.${tail}`);
            }
            return { ...a, points };
        });
    const techniques = bump(arts.techniques, arts.activeTechnique, 1, id => techById(id));
    const spells = bump(arts.spells, arts.practicing, 1.3, id => spellById(id));
    return { arts: { ...arts, techniques, spells }, lines };
}


// ---- Spiritual affinity ------------------------------------------------------------------
export const affinityOf = (char: Character): string[] => char.affinity && char.affinity.length ? char.affinity : ELEMENTS;
const SPELL_BONUS = [1.0, 1.0, 1.05, 1.15, 1.3, 1.5]; // index = element count
const SPEED_BONUS = [1.0, 1.0, 1.0, 1.0, 1.08, 1.15]; // technique speed, by count (see speedBonus)
// Matching element: bonus by count. Missing element: weaker and costlier. Neutral and five-element characters: no change.
export function affinityMult(char: Character, el: Element): { power: number; cost: number; note: string } {
    if (el === 'neutral') return { power: 1, cost: 1, note: '' };
    const aff = affinityOf(char), n = aff.length;
    if (n >= 5) return { power: 1, cost: 1, note: '' };
    if (aff.includes(el)) { const p = char.heavenly ? 1.8 : n === 1 ? 1.5 : n === 2 ? 1.3 : n === 3 ? 1.15 : 1.05; return { power: p, cost: 1, note: `x${p} with your ${el} affinity` }; }
    return { power: 0.6, cost: 1.5, note: `weak: you lack ${el} affinity (x0.6, +50% qi)` };
}
export function techniqueSpeed(char: Character, el: Element): number {
    if (el === 'neutral') return 1;
    const aff = affinityOf(char), n = aff.length;
    if (n >= 5) return 1;
    if (aff.includes(el)) return char.heavenly ? 1.45 : n === 1 ? 1.25 : n === 2 ? 1.15 : n === 3 ? 1.08 : 1;
    return 0.85;
}
