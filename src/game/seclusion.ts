// Closed-door cultivation: pick a span, see a projection, then time passes in chunks with the world running.
// No player events during seclusion. A report of what happened in the world is shown on exit.
import type { SaveGame } from './state';
import type { World } from './world';
import { applyCultivationStep, currentCult, stageLabel } from './cultivation';
import { resolveCalamity, resolveRivals } from './danger';
import { familyTick } from './family';
import { householdTick } from './people';
import { newsItems } from './living';
import { lifespanYears, ageAt } from './fate';
import { getEco, shockAt, itemById } from './economy';

export interface SeclReport {
    planned: number; days: number; stop: string; died?: boolean;
    before: string; after: string; stones: number; age: number; left: number; start: number;
    you: string[]; people: string[]; sect: string[]; world: string[]; danger: string[];
    market?: string[]; kind?: 'realm'; place?: string; gained?: string[];
}

export const DAYS_PER_YEAR = 360;
export const SECL_PRESETS: { label: string; days: number }[] = [
    { label: '1 month', days: 30 }, { label: '1 season', days: 90 }, { label: '1 year', days: 360 },
    { label: '5 years', days: 1800 }, { label: '10 years', days: 3600 }, { label: '50 years', days: 18000 }, { label: '100 years', days: 36000 },
];

export function canSeclude(s: SaveGame): { ok: boolean; why: string } {
    if (s.dead) return { ok: false, why: 'This life has ended.' };
    if (s.travel) return { ok: false, why: 'You cannot seclude yourself on the road. Reach a city first.' };
    if (s.battle || s.tribPending) return { ok: false, why: 'Not in the middle of a fight.' };
    if (s.exp) return { ok: false, why: 'Not inside a secret realm.' };
    if (currentCult(s).gate) return { ok: false, why: 'You are at the threshold. Seclusion gains nothing until you break through.' };
    return { ok: true, why: '' };
}

export function lifeLeftDays(s: SaveGame): number {
    const span = lifespanYears(s, currentCult(s).realm);
    return Math.max(0, (span - ageAt(s.clockDays)) * DAYS_PER_YEAR);
}

export interface SeclProjection { label: string; pct: number; gate: boolean; gateRealm: string; ageAfter: number; leftAfter: number; oldAge: boolean; reachedDays: number }
// Cultivation only (no world), same rate code as the live clock.
export function projectSeclusion(s: SaveGame, days: number): SeclProjection {
    let cur = s; let done = 0; const chunk = days > 3600 ? 180 : 30;
    while (done < days - 1e-6 && !cur.dead) {
        const step = Math.min(chunk, days - done);
        const nx = applyCultivationStep(cur, step, Boolean(cur.membership));
        cur = { ...nx, clockDays: nx.dead ? nx.dead.atDays : cur.clockDays + step };
        done += step;
        if (currentCult(cur).gate) break;
    }
    const c = currentCult(cur); const span = lifespanYears(cur, c.realm);
    const need = stageLabel(c);
    const age = ageAt(s.clockDays + days);
    return { label: need, pct: 0, gate: !!c.gate, gateRealm: need, ageAfter: Math.floor(age), leftAfter: Math.max(0, Math.floor(span - age)), oldAge: !!cur.dead || age >= span, reachedDays: done };
}

// Market shocks that hit your city while you were away, when you hold goods they affect.
export function marketLines(save: SaveGame, from: number, to: number): string[] {
    const held = getEco(save).items; const out: string[] = [];
    for (let q = Math.floor(from / 90); q <= Math.floor(to / 90) && q - Math.floor(from / 90) < 400; q++) {
        const sh = shockAt({ ...save, clockDays: q * 90 + 1 }, save.locationId); if (!sh) continue;
        const mine = sh.ids.filter(id => (held[id] ?? 0) > 0).map(id => itemById(id)?.name ?? id);
        if (mine.length) { const t = `${sh.text} You hold: ${mine.slice(0, 3).join(', ')}.`; if (!out.includes(t)) out.push(t); }
    }
    return out.slice(-4);
}

// Popup after a secret realm ends: what you got, what it cost, and what the world did meanwhile.
export function realmExitReport(world: World, before: SaveGame, after: SaveGame): SeclReport {
    const exp = before.exp!; const seen = new Set(before.log);
    const lines = after.log.filter(l => !seen.has(l));
    const gained: string[] = [];
    const bi = getEco(before).items, ai = getEco(after).items;
    for (const id of Object.keys(ai)) { const d = (ai[id] ?? 0) - (bi[id] ?? 0); if (d > 0) gained.push(`${itemById(id)?.name ?? id} x${d}`); }
    const c = currentCult(after); const span = lifespanYears(after, c.realm);
    const ni = newsItems(world, after, exp.startDays, after.clockDays, 3).map(n => n.t).reverse();
    const RD = /☠️|wound|injur|ambush|attack|trapped|sealed|lost |escape|fled|flee|bleed|poison|guardian/i;
    const danger = lines.filter(l => RD.test(l)); const rest = lines.filter(l => !RD.test(l));
    return {
        kind: 'realm', place: `${exp.icon} ${exp.name}`, planned: exp.endsDays - exp.startDays, days: after.clockDays - exp.startDays,
        stop: after.dead ? 'You did not come back.' : 'You step out of the realm.', died: !!after.dead,
        before: stageLabel(currentCult(before)), after: stageLabel(c), start: exp.startDays,
        stones: getEco(after).stones - getEco(before).stones, age: Math.floor(ageAt(after.clockDays)), left: Math.max(0, Math.floor(span - ageAt(after.clockDays))),
        you: Array.from(new Set(rest)).slice(0, 6), people: [], sect: [], world: ni, danger: Array.from(new Set(danger)).slice(0, 5),
        market: marketLines(after, exp.startDays, after.clockDays), gained,
    };
}

const DANGER = /☠️|⚔️|⚡|ambush|rival|calamit|plague|raid|assassin|bandit|beast|robbed|stole|injur|wound|attack|flood|famine|quake|storm/i;
const PEOPLE = /\b(son|daughter|wife|husband|child|children|born|died|passed away|funeral|friend|disciple|companion|brother|sister|parent|mother|father|uncle|aunt|grandchild|married|household)\b/i;
const SECT = /\b(sect|rank|promot|tournament|elder|duty|clan|hall|contribution)\b/i;

export function runSeclusion(world: World, save: SaveGame, days: number): SaveGame {
    const chk = canSeclude(save); if (!chk.ok) return save;
    const startDay = save.clockDays, target = startDay + days;
    const before = stageLabel(currentCult(save)), stones0 = getEco(save).stones;
    let cur: SaveGame = { ...save, paused: false };
    const seen = new Set(save.log);
    const lines: string[] = []; const worldNews: string[] = [];
    let stop = 'You came out when you planned to.';
    const chunk = days > 3600 ? 90 : 30;
    while (cur.clockDays < target - 1e-6) {
        const step = Math.min(chunk, target - cur.clockDays);
        const w0 = cur.clockDays;
        let nx = applyCultivationStep(cur, step, Boolean(cur.membership));
        nx = { ...nx, clockDays: nx.dead ? nx.dead.atDays : w0 + step };
        if (!nx.dead) nx = resolveCalamity(world, nx, w0, nx.clockDays);
        if (!nx.dead) nx = resolveRivals(world, nx, w0, nx.clockDays);
        if (!nx.dead) nx = familyTick(nx, w0, nx.clockDays);
        if (!nx.dead) nx = householdTick(nx, w0, nx.clockDays);
        if (!nx.dead) {
            const ni = newsItems(world, nx, w0, nx.clockDays, 4);
            for (const n of ni) if (!worldNews.includes(n.t)) worldNews.push(n.t);
            if (ni.length) nx.news = [...ni.slice().reverse(), ...(nx.news ?? [])].slice(0, 80);
        }
        for (const l of nx.log) if (!seen.has(l)) { seen.add(l); lines.push(l); }
        const warnUp = (nx.warned ?? 0) > (cur.warned ?? 0);
        const stop0 = cur;
        cur = nx;
        if (cur.dead) { stop = 'Your life ended in seclusion.'; break; }
        if (cur.battle || cur.tribPending) { stop = 'Danger found you. You were pulled out of seclusion.'; break; }
        if (currentCult(cur).gate && !currentCult(stop0).gate) { stop = 'You reached the threshold of a breakthrough and stopped.'; break; }
        if (warnUp) { stop = 'Your years are running out. You left seclusion early.'; break; }
    }
    const used = cur.clockDays - startDay;
    const c = currentCult(cur);
    const pick = (re: RegExp, not?: RegExp[]) => lines.filter(l => re.test(l) && !(not ?? []).some(n => n.test(l)));
    const uniq = (a: string[], n = 6) => Array.from(new Set(a)).slice(0, n);
    const danger = uniq(pick(DANGER));
    const people = uniq(pick(PEOPLE, [DANGER]));
    const sect = uniq(pick(SECT, [DANGER, PEOPLE]));
    const rest = lines.filter(l => !DANGER.test(l) && !PEOPLE.test(l) && !SECT.test(l));
    const span = lifespanYears(cur, c.realm);
    const report: SeclReport = {
        market: marketLines(save, startDay, cur.clockDays),
        planned: days, days: used, stop, died: !!cur.dead, before, after: stageLabel(c), start: startDay,
        stones: getEco(cur).stones - stones0, age: Math.floor(ageAt(cur.clockDays)), left: Math.max(0, Math.floor(span - ageAt(cur.clockDays))),
        you: uniq(rest.slice(-5)), people, sect, world: uniq(worldNews.slice().reverse(), 5), danger,
    };
    return { ...cur, seclReport: report, journal: [{ d: cur.clockDays, t: `🧘 Seclusion ended: ${report.after}.` }, ...(cur.journal ?? [])].slice(0, 30), savedAt: Date.now() };
}
