import { gearEffect } from './gear';
import { homeBonus } from './wealth';
// Idle cultivation: while you are in a settlement and not traveling, you meditate.
// Progress is measured in "cultivation base". 15 realms x 9 stages.

import { breakthroughDeathChance, waveDeathChance, fateRoll, makeDeath, lifespanYears, ageAt } from './fate';
import { btPillFor } from './pills';
import { COMPREHENSION_TIERS, REALMS, ROOT_TIERS } from './data';
import { PRACTICE_DRAG, advanceArts, getArts, techniqueMult } from './arts';
import type { Character, SaveGame } from './state';
import { getEco, resolveExpedition } from './economy';

export const STAGES_PER_REALM = 9;

export interface CultState { realm: number; stage: number; progress: number; gate?: boolean; weak?: number; scars?: number }

export const START_CULT: CultState = { realm: 0, stage: 0, progress: 0 };

// Cost of one stage. Low realms take months per stage and years per realm; high realms take
// decades per stage and centuries to millennia per realm (xianxia timescale).
export function stageCost(realm: number, stage: number): number {
    return Math.round(1440 * Math.pow(1.64, realm) * Math.pow(1.1, stage));
}

// Social and item boosts are worth a share of a stage, but never more than `idleDays` of your own idle meditation.
// Keeps them strong early and stops them from replacing cultivation once a stage costs decades.
export function cultGain(save: SaveGame, frac: number, idleDays: number): number {
    const c = currentCult(save);
    const rate = cultivationRate(save.char, c, Boolean(save.membership), getArts(save)).perDay * (1 + gearEffect(save, 'cult') + homeBonus(save, save.locationId) + cultBuff(save));
    return Math.max(1, Math.floor(Math.min(stageCost(c.realm, c.stage) * frac, rate * idleDays * 0.7)));
}

export function ceilingRealm(char: Character): number {
    const name = ROOT_TIERS[char.root].ceiling;
    if (name === 'None') return REALMS.length - 1;
    const i = REALMS.findIndex(r => r === name);
    return i < 0 ? REALMS.length - 1 : i;
}

export interface RateInfo { perDay: number; parts: { label: string; mult: number }[] }

export function cultivationRate(char: Character, cult: CultState, inSect: boolean | number, arts?: import('./arts').ArtsState): RateInfo {
    const parts: { label: string; mult: number }[] = [];
    parts.push({ label: ROOT_TIERS[char.root].name, mult: ROOT_TIERS[char.root].speed });
    const comp = 1 + char.comprehension * 0.12;
    if (comp !== 1) parts.push({ label: COMPREHENSION_TIERS[char.comprehension].name, mult: comp });
    const body = 1 + char.constitution * 0.05;
    if (body !== 1) parts.push({ label: 'Body', mult: body });
    if (inSect) parts.push({ label: 'Sect teachings', mult: typeof inSect === 'number' ? 1.15 + 0.05 * (inSect - 1) : 1.15 });
    if (cult.weak && cult.weak > 0) parts.push({ label: 'Qi deviation', mult: 0.5 });
    if (cult.scars) parts.push({ label: 'Tribulation scars', mult: 1 - 0.08 * cult.scars });
    if (arts) {
        const tm = techniqueMult(char, arts);
        if (tm) parts.push({ label: tm.name, mult: tm.mult });
        if (arts.practicing) parts.push({ label: 'Drilling a spell', mult: PRACTICE_DRAG });
    }
    if (cult.realm > ceilingRealm(char)) parts.push({ label: 'Bottleneck', mult: 0.1 });
    const base = 4; // cultivation base per day, before multipliers
    const perDay = parts.reduce((a, p) => a * p.mult, base);
    return { perDay, parts };
}

export function currentCult(save: SaveGame): CultState {
    return save.cult ?? START_CULT;
}

export function stageLabel(c: CultState): string {
    return `${REALMS[c.realm]} · Stage ${c.stage + 1}`;
}

const STAGE_LINES = [
    'Your qi settles into a deeper channel. {s}.',
    'A quiet breath, a loosened knot in the meridians. You reach {s}.',
    'The world dims, then sharpens. {s}.',
    'Spirit energy pools in your dantian like rain in a bowl. {s}.',
];

const REALM_LINES = [
    'Thunder rolls over a clear sky. You break through into the {r} realm.',
    'Something old cracks inside you and light pours out. You have entered the {r} realm.',
    'The bottleneck gives way at last. {r} - the road ahead is longer, and so are you.',
];

// Advance cultivation by `days` of game time. Returns the new state and story lines (newest last).
export function advanceCult(save: SaveGame, days: number, inSect: boolean | number): { cult: CultState; lines: string[] } {
    let c = { ...currentCult(save) };
    const lines: string[] = [];
    if (days <= 0) return { cult: c, lines };
    if (c.gate) { if (c.weak) c.weak = Math.max(0, c.weak - days); return { cult: c, lines }; } // at the threshold you can only recover
    let guard = 0;
    let remaining = days;
    while (remaining > 0 && guard++ < 400) {
        if (c.realm >= REALMS.length || c.gate) break;
        const rate = cultivationRate(save.char, c, inSect, getArts(save)).perDay * (1 + gearEffect(save, 'cult') + homeBonus(save, save.locationId) + cultBuff(save));
        const need = stageCost(c.realm, c.stage) - c.progress;
        const daysNeeded = need / rate;
        if (c.weak && c.weak > 0 && c.weak < Math.min(daysNeeded, remaining)) {
            c.progress += rate * c.weak; remaining -= c.weak; c.weak = 0; continue;
        }
        if (c.weak && c.weak > 0) c.weak = Math.max(0, c.weak - Math.min(daysNeeded, remaining));
        if (daysNeeded > remaining) {
            c.progress += rate * remaining;
            remaining = 0;
            break;
        }
        remaining -= daysNeeded;
        c.progress = 0;
        c.stage += 1;
        if (c.stage >= STAGES_PER_REALM) {
            // Perfection: the bottleneck. The player must attempt the breakthrough.
            c.stage = STAGES_PER_REALM - 1;
            c.progress = stageCost(c.realm, c.stage);
            if (c.realm >= REALMS.length - 1) { c.progress = c.progress - 1; break; }
            c.gate = true;
            lines.push(`🔒 You reach perfection in the ${REALMS[c.realm]} realm. Open your cultivation card and attempt the breakthrough.`);
            break;
        } else {
            const tpl = STAGE_LINES[(c.stage + c.realm) % STAGE_LINES.length];
            lines.push('🧘 ' + tpl.replace('{s}', stageLabel(c)));
        }
    }
    return { cult: c, lines };
}

// Apply a time step to a save: clock, cultivation, log. Used by the live tick and offline catch-up.
export function applyCultivationStep(save: SaveGame, days: number, inSect: boolean): SaveGame {
    if (save.dead) return save;
    return checkOldAge(save.clockDays + days, applyCultivationStepRaw(save, days, inSect));
}

const WARN_AT = [0.8, 0.92, 0.98];
function checkOldAge(endDays: number, s: SaveGame): SaveGame {
    if (s.dead) return s;
    const c = currentCult(s);
    const span = lifespanYears(s, c.realm);
    const age = ageAt(endDays);
    if (age >= span) {
        const t = Math.min(endDays, (span - 16) * 360);
        const dead = makeDeath({ ...s, clockDays: t }, 'old-age', `Your years ran out at ${Math.floor(span).toLocaleString('en-US')}. The ${REALMS[c.realm]} realm gave you only that much, and you did not break through in time.`, c.realm, c.stage);
        return { ...s, clockDays: t, dead, paused: true, log: ['☠️ Your lifespan is spent. The lamp goes out.', ...s.log].slice(0, 30) };
    }
    let w = s.warned ?? 0;
    const frac = age / span;
    const lines: string[] = [];
    while (w < 3 && frac >= WARN_AT[w]) {
        lines.push(['🍂 Your hair has begun to whiten. The ' + REALMS[c.realm] + ' realm will not hold you forever.', '🥀 Your breath shortens. You feel the end of your years approaching. Only a breakthrough can extend them.', '⌛ You can hear the last grains falling. If you will break through, it must be soon.'][w]);
        w++;
    }
    return lines.length || w !== (s.warned ?? 0) ? { ...s, warned: w, log: [...lines.reverse(), ...s.log].slice(0, 30) } : s;
}

function applyCultivationStepRaw(save: SaveGame, days: number, inSect: boolean): SaveGame {
    if (save.exp) {
        // Inside a secret realm: no meditation. Resolve when the expedition ends.
        const end = save.clockDays + days;
        if (end < save.exp.endsDays) return save;
        // Realm over: resolve it, then spend the rest of the step meditating.
        const rest = end - Math.max(save.exp.endsDays, save.clockDays);
        const done = resolveExpedition({ ...save, clockDays: Math.max(save.exp.endsDays, save.clockDays) });
        if (done.exp?.guard === 'pending') return { ...done, clockDays: save.clockDays };
        return rest > 0 ? applyCultivationStepRaw({ ...done, clockDays: done.clockDays }, rest, inSect) : { ...done, clockDays: save.clockDays };
    }
    // Only the part of the step spent settled (not on the road) counts.
    let cultDays = days;
    if (save.travel) {
        const arrive = save.travel.arriveDays;
        const end = save.clockDays + days;
        cultDays = Math.max(0, end - Math.max(arrive, save.clockDays));
        if (end < arrive) cultDays = 0;
    }
    if (cultDays <= 0) return save;
    const { cult, lines } = advanceCult(save, cultDays, inSect ? sectRankIndex(save) + 1 : false);
    const ar = advanceArts(save, cultDays);
    lines.push(...ar.lines);
    let log = save.log;
    // Keep the log readable after long offline spans.
    const shown = lines.length > 4 ? [`🧘 Long seclusion: ${lines.length - 3} more breakthroughs passed.`, ...lines.slice(-3)] : lines;
    for (const l of shown) log = [l, ...log];
    const rank = inSect ? { rank: sectRankIndex(save), contrib: (save.rank?.contrib ?? 0) + cultDays * 0.5 } : save.rank;
    let eco = save.eco;
    if (eco) eco = { ...eco, tox: Math.max(0, eco.tox - cultDays / 20) };
    if (inSect) { const e = eco ?? getEco(save); eco = { ...e, stones: e.stones + cultDays * 0.1 * (sectRankIndex(save) + 1) }; }
    return { ...save, cult, arts: ar.arts, rank, eco, log: log.slice(0, 30) };
}


// ---- Breakthrough and tribulation ------------------------------------------------

export const TRIBULATION_FROM = 4; // Body Tribulation onward calls down heavenly lightning

function roll(save: SaveGame, salt: number): number {
    let x = Math.floor(save.clockDays * 1000) * 2654435761 + (save.brk?.attempts ?? 0) * 40503 + salt * 977 + save.seed;
    x = (x ^ (x >>> 13)) * 1274126177; x = x ^ (x >>> 16);
    return ((x >>> 0) % 10000) / 10000;
}

export function breakthroughChance(save: SaveGame): number {
    const c = currentCult(save);
    const ch = save.char;
    let p = 0.9 - 0.04 * c.realm + ch.luck / 500 + ch.comprehension * 0.02;
    if (c.realm + 1 > ceilingRealm(ch)) p -= 0.25;
    if ((c.weak ?? 0) > 0) p -= 0.2; // pushing through an unhealed qi deviation
    if (ch.fateName === "Heaven's Jealousy") p -= 0.05;
    { const bp = btPillFor(save, c.realm); if (bp) p += bp.bonus; }
    p += gearEffect(save, 'bt') + gearEffect(save, 'luck') / 500 + btBuff(save) + karmaBt(save);
    return Math.max(0.1, Math.min(0.95, p));
}

export function tribulationWaves(realm: number): number { return realm >= TRIBULATION_FROM ? 3 + Math.floor((realm - TRIBULATION_FROM) / 2) : 0; }

import { karmaBt, heartDemonAt, startHd, hdPassed } from './karma';
// Craft buffs (arrays, feed, site maps, fate slips) last until a game day.
export const buffOn = (s: SaveGame, k: string): boolean => (s.buffs?.[k] ?? 0) > s.clockDays;
export const BUFF_INFO: Record<string, { name: string; icon: string; cult?: number; bt?: number; days: number }> = {
    qiarray: { name: 'Gather-Qi Array', icon: '🀄', cult: 0.3, days: 60 },
    bond: { name: 'Bonded beast', icon: '🐉', cult: 0.12, days: 30 },
    vein: { name: 'Charted spirit vein', icon: '🧭', cult: 0.2, days: 90 },
    ward: { name: 'Ward Array', icon: '🛖', days: 90 },
    escape: { name: 'Escape Array', icon: '🌀', days: 365 },
    foresight: { name: 'Fate foresight', icon: '🔮', bt: 0.1, days: 60 },
};
export const atCave = (s: SaveGame): boolean => Boolean(s.cx?.cave && s.cx.cave.at === s.locationId && !s.travel);
export const cultBuff = (s: SaveGame): number => Object.keys(BUFF_INFO).reduce((a, k) => a + (buffOn(s, k) ? (BUFF_INFO[k].cult ?? 0) : 0), 0) + (atCave(s) ? 0.1 : 0);
export const btBuff = (s: SaveGame): number => Object.keys(BUFF_INFO).reduce((a, k) => a + (buffOn(s, k) ? (BUFF_INFO[k].bt ?? 0) : 0), 0);
// Heaven remembers: secret realms survived, guardians and equal-realm foes slain raise it; each point hardens the tribulation.
export const heavenOf = (s: SaveGame): number => s.heaven ?? 0;
export const heavenMul = (s: SaveGame): number => 1 + Math.min(0.5, heavenOf(s) * 0.015);
export const heavenWord = (s: SaveGame): string => { const h = heavenOf(s); return h < 3 ? 'unnoticed' : h < 10 ? 'noticed' : h < 20 ? 'watched' : h < 30 ? 'marked' : 'hunted by heaven'; };
export const addHeaven = (s: SaveGame, n: number): SaveGame => ({ ...s, heaven: Math.round(((s.heaven ?? 0) + n) * 10) / 10 });

// A failed tribulation has teeth: a longer deviation, and a chance of a permanent scar on the path (slower qi, shorter life).
export function tribulationFailure(save: SaveGame, c: { progress: number; gate?: boolean; weak?: number; scars?: number; realm: number; stage: number }, lines: string[]): void {
    const scarChance = 0.35 + Math.min(0.3, heavenOf(save) * 0.01);
    c.gate = false;
    if (fateRoll(save, 31) < scarChance && (c.scars ?? 0) < 3) {
        c.scars = (c.scars ?? 0) + 1; c.progress = Math.floor(stageCost(c.realm, c.stage) * 0.4); c.weak = 360;
        lines.push(`💔 The lightning scars your meridians for good. Your cultivation path is crippled (scar ${c.scars} of 3): qi flows ${Math.round(c.scars * 8)}% slower and your lifespan is shorter.`);
    } else {
        c.progress = Math.floor(stageCost(c.realm, c.stage) * 0.4); c.weak = 360;
        lines.push('🩸 You lose much of your cultivation and suffer a deep qi deviation (half speed for a year). Rebuild and try again.');
    }
}

export function waveSurvive(save: SaveGame, realm: number): number {
    const ch = save.char;
    const power = 1 + ch.constitution * 0.2 + ch.luck / 150;
    let strength = 1 + realm * 0.18;
    if (ch.fateName === "Heaven's Jealousy") strength *= 1.3;
    strength *= heavenMul(save);
    return Math.max(0.6, Math.min(0.985, 0.995 - 0.07 * (strength / power)));
}

export interface BreakthroughResult { save: SaveGame; ok: boolean; lines: string[]; pending?: boolean }
export interface TribPending { usedPill: boolean; underGrade: boolean; realm: number }

// Attempt the breakthrough at the gate. Failure never kills: you lose progress and suffer a qi deviation (half speed for 6 months).
export function attemptBreakthrough(save: SaveGame, fight = false): BreakthroughResult {
    const c = { ...currentCult(save) };
    if (!c.gate) return { save, ok: false, lines: [] };
    const lines: string[] = [];
    const brk = { attempts: (save.brk?.attempts ?? 0) + 1, fails: save.brk?.fails ?? 0 };
    const p = breakthroughChance(save);
    let usedPill = false;
    const bp = btPillFor(save, c.realm);
    if (save.eco && bp) { save = { ...save, eco: { ...save.eco, items: { ...save.eco.items, [bp.id]: save.eco.items[bp.id] - 1 } } }; usedPill = true; }
    if (usedPill) lines.push('🔮 You swallow a Breakthrough Pill.');
    let ok = roll(save, 1) < p;
    if (!ok) lines.push('💢 Your qi rebels at the threshold and the breakthrough collapses.');
    const underGrade = c.realm + 1 > ceilingRealm(save.char);
    const wasWeak = (c.weak ?? 0) > 0;
    let fatal: { cause: 'tribulation' | 'breakthrough'; text: string } | null = null;
    if (ok && fight && heartDemonAt(c.realm + 1)) {
        lines.push('🌑 The air turns still. Your heart-demon wakes and speaks in your own voice. Face it.');
        return { save: { ...save, brk, hd: startHd(save, c.realm + 1, usedPill, underGrade), log: [...lines.slice().reverse(), ...save.log].slice(0, 30) } as SaveGame, ok: false, lines };
    }
    if (ok && fight && tribulationWaves(c.realm + 1) > 0) {
        lines.push('⚡ The sky darkens. The tribulation descends. Face it.');
        return { save: { ...save, brk, tribPending: { usedPill, underGrade, realm: c.realm } } as SaveGame, ok: false, pending: true, lines };
    }
    if (ok) {
        const waves = tribulationWaves(c.realm + 1);
        for (let w = 0; w < waves && ok; w++) {
            const s = waveSurvive(save, c.realm + 1);
            if (roll(save, 10 + w) < s) lines.push(`⚡ Heavenly lightning, wave ${w + 1} of ${waves}: you endure it.`);
            else {
                ok = false;
                if (fateRoll(save, 20 + w) < waveDeathChance(c.realm + 1, underGrade, save.char.constitution, usedPill)) {
                    fatal = { cause: 'tribulation', text: `Wave ${w + 1} of ${waves} of the heavenly tribulation struck you down at the threshold of the ${REALMS[c.realm + 1]} realm.` };
                    lines.push(`⚡ Heavenly lightning, wave ${w + 1} of ${waves}: it shatters your guard and your body with it.`);
                } else lines.push(`⚡ Heavenly lightning, wave ${w + 1} of ${waves}: it breaks through your guard. The tribulation fails.`);
            }
        }
    } else if (fateRoll(save, 9) < breakthroughDeathChance(save, c.realm, underGrade, wasWeak, usedPill)) {
        fatal = { cause: 'breakthrough', text: `Your qi turned on you at the ${REALMS[c.realm]} bottleneck. Your meridians burst${wasWeak ? ', and you had forced it while still wounded' : ''}${underGrade ? ', far beyond what your roots could bear' : ''}.` };
        lines.push('☠️ The backlash is not a deviation this time. Your meridians tear.');
    }
    if (fatal) {
        const dead = makeDeath(save, fatal.cause, fatal.text, c.realm, c.stage);
        return { save: { ...save, brk: { ...brk, fails: brk.fails + 1 }, dead, paused: true, log: [...lines.slice().reverse(), ...save.log].slice(0, 30) }, ok: false, lines };
    }
    if (ok) {
        c.realm += 1; c.stage = 0; c.progress = 0; c.gate = false;
        lines.push(`🌟 You break through into the ${REALMS[c.realm]} realm.${tribulationWaves(c.realm) ? ' The tribulation clouds disperse.' : ''}`);
        save = { ...save, warned: 0 };
        lines.push(`🕰️ Your lifespan is now ${lifespanYears(save, c.realm).toLocaleString('en-US')} years.`);
    } else {
        brk.fails += 1;
        if (tribulationWaves(c.realm + 1) > 0 && lines.some(l => l.includes('tribulation fails'))) tribulationFailure(save, c, lines);
        else {
            c.progress = Math.floor(stageCost(c.realm, c.stage) * 0.6); c.gate = false; c.weak = 180;
            lines.push('🩸 You lose some cultivation and suffer a qi deviation (half speed for 6 months). Rebuild and try again.');
        }
    }
    return { save: { ...save, cult: c, brk, log: [...lines.slice().reverse(), ...save.log].slice(0, 30) }, ok, lines };
}

// ---- Sect rank climbing ----------------------------------------------------------

export const SECT_RANKS = [
    { name: 'Outer Disciple', contrib: 0, realm: 0 },
    { name: 'Inner Disciple', contrib: 60, realm: 1 },
    { name: 'Core Disciple', contrib: 180, realm: 2 },
    { name: 'Elder', contrib: 420, realm: 4 },
    { name: 'Grand Elder', contrib: 900, realm: 6 },
    { name: 'Sect Master', contrib: 1800, realm: 8 },
];

export function sectRankIndex(save: SaveGame): number { return Math.min(SECT_RANKS.length - 1, save.rank?.rank ?? 0); }

export function nextRank(save: SaveGame) {
    const i = sectRankIndex(save);
    return i + 1 < SECT_RANKS.length ? SECT_RANKS[i + 1] : null;
}

export function canPromote(save: SaveGame): { ok: boolean; why: string } {
    const n = nextRank(save);
    if (!save.membership) return { ok: false, why: 'You belong to no sect or clan.' };
    if (!n) return { ok: false, why: 'You hold the highest seat.' };
    const contrib = Math.floor(save.rank?.contrib ?? 0);
    const realm = currentCult(save).realm;
    if (contrib < n.contrib) return { ok: false, why: `Needs ${n.contrib} contribution (you have ${contrib}).` };
    if (realm < n.realm) return { ok: false, why: `Needs the ${REALMS[n.realm]} realm.` };
    return { ok: true, why: `Eligible to become ${n.name}.` };
}

export function promote(save: SaveGame): SaveGame {
    const v = canPromote(save); const n = nextRank(save);
    if (!v.ok || !n) return save;
    return { ...save, rank: { rank: sectRankIndex(save) + 1, contrib: save.rank?.contrib ?? 0 }, log: [`🎖️ You are raised to ${n.name}. Sect teachings now speed your cultivation further.`, ...save.log].slice(0, 30) };
}

// Odds of surviving every lightning wave of the next realm (1 when there is no tribulation).
// Plain-language death risk of attempting the breakthrough now (for the UI).
export function deathRisk(save: SaveGame): number {
    const c = currentCult(save);
    const under = c.realm + 1 > ceilingRealm(save.char);
    const pill = Boolean(btPillFor(save, c.realm));
    const weak = (c.weak ?? 0) > 0;
    const pb = 1 - breakthroughChance(save);
    let p = pb * breakthroughDeathChance(save, c.realm, under, weak, pill);
    const waves = tribulationWaves(c.realm + 1);
    if (waves) {
        const surv = waveSurvive(save, c.realm + 1);
        const fail = 1 - Math.pow(surv, waves);
        p += (1 - pb) * fail * waveDeathChance(c.realm + 1, under, save.char.constitution, pill) * 1.3;
    }
    return Math.min(0.95, p);
}

export function tribulationOdds(save: SaveGame): number {
    const next = currentCult(save).realm + 1;
    const waves = tribulationWaves(next);
    return Math.pow(waveSurvive(save, next), waves);
}

// The tribulation fight is over. Win = the breakthrough lands. Loss = the old failure rules (deadly only by the usual death chance).
export function finishTribulation(save: SaveGame, won: boolean): SaveGame {
    const tp = (save as any).tribPending as TribPending | undefined; if (!tp) return save;
    const c = { ...currentCult(save) }; const brk = { attempts: save.brk?.attempts ?? 1, fails: save.brk?.fails ?? 0 };
    const lines: string[] = []; let s: SaveGame = { ...save, tribPending: undefined } as SaveGame;
    if (won) {
        c.realm += 1; c.stage = 0; c.progress = 0; c.gate = false;
        lines.push(`⚡ You endure the heavenly tribulation. 🌟 You break through into the ${REALMS[c.realm]} realm. The clouds disperse.`);
        s = { ...s, warned: 0 };
        lines.push(`🕰️ Your lifespan is now ${lifespanYears(s, c.realm).toLocaleString('en-US')} years.`);
        return { ...s, cult: c, brk, log: [...lines.slice().reverse(), ...s.log].slice(0, 30) };
    }
    if (fateRoll(s, 20) < waveDeathChance(tp.realm + 1, tp.underGrade, s.char.constitution, tp.usedPill)) {
        const dead = makeDeath(s, 'tribulation', `The heavenly tribulation struck you down at the threshold of the ${REALMS[tp.realm + 1]} realm.`, tp.realm, c.stage);
        return { ...s, brk: { ...brk, fails: brk.fails + 1 }, dead, paused: true, log: ['⚡ The lightning shatters your guard and your body with it.', ...s.log].slice(0, 30) };
    }
    brk.fails += 1;
    lines.push('⚡ The tribulation breaks through your guard and fails the breakthrough.');
    tribulationFailure(s, c, lines);
    return { ...s, cult: c, brk, log: [...lines.slice().reverse(), ...s.log].slice(0, 30) };
}

// The heart-demon gauntlet is over. Pass: on to the lightning (when the realm has waves) or straight through. Fail: the demon wins a round.
export function finishHeartDemon(save: SaveGame): { save: SaveGame; passed: boolean; lightning: boolean } {
    const hd = save.hd!; const passed = hdPassed(hd);
    const c = { ...currentCult(save) }; const lines: string[] = [];
    let s: SaveGame = { ...save, hd: null } as SaveGame;
    const brk = { attempts: s.brk?.attempts ?? 1, fails: s.brk?.fails ?? 0 };
    if (passed) {
        lines.push(`🌑 You hold against your heart-demon (${hd.passes} of ${hd.ids.length}).`);
        s = { ...s, evflags: [...new Set([...(s.evflags ?? []), 'hd-conquered'])].slice(-80) } as SaveGame;
        if (tribulationWaves(hd.realm) > 0) {
            lines.push('⚡ The sky darkens. The tribulation descends. Face it.');
            return { save: { ...s, brk, tribPending: { usedPill: hd.usedPill, underGrade: hd.underGrade, realm: c.realm }, log: [...lines.slice().reverse(), ...s.log].slice(0, 30) } as SaveGame, passed, lightning: true } as any;
        }
        c.realm += 1; c.stage = 0; c.progress = 0; c.gate = false;
        lines.push(`🌟 You break through into the ${REALMS[c.realm]} realm.`);
        s = { ...s, warned: 0 } as SaveGame;
        lines.push(`🕰️ Your lifespan is now ${lifespanYears(s, c.realm).toLocaleString('en-US')} years.`);
        return { save: { ...s, cult: c, brk, log: [...lines.slice().reverse(), ...s.log].slice(0, 30) }, passed, lightning: false } as any;
    }
    brk.fails += 1;
    lines.push(`🌑 Your heart-demon wins (${hd.passes} of ${hd.ids.length} held). The breakthrough collapses.`);
    if ((s.karma ?? 0) <= -60 && hd.fails >= 3 && fateRoll(s, 41) < 0.12) {
        const dead = makeDeath(s, 'breakthrough', `Your heart-demon devoured you at the threshold of the ${REALMS[c.realm + 1]} realm. It had so much to feed on.`, c.realm, c.stage);
        return { save: { ...s, brk, dead, paused: true, log: ['☠️ The heart-demon wears your face and takes it.', ...s.log].slice(0, 30) }, passed, lightning: false } as any;
    }
    c.gate = false; c.progress = Math.floor(stageCost(c.realm, c.stage) * 0.5); c.weak = 270;
    if (fateRoll(s, 42) < 0.25 && (c.scars ?? 0) < 3) { c.scars = (c.scars ?? 0) + 1; lines.push(`💔 The demon leaves a mark on your dao (scar ${c.scars} of 3): qi flows slower and your lifespan is shorter.`); }
    lines.push('🩸 You lose half your cultivation and suffer a qi deviation (about 9 months). Mend your heart and try again.');
    return { save: { ...s, cult: c, brk, log: [...lines.slice().reverse(), ...s.log].slice(0, 30) }, passed, lightning: false } as any;
}
