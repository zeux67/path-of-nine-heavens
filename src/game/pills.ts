// Ranked pills across the full cultivation roster (15 realms, rank 0 to 14).
// Cultivation pill rank r (cp-r; rank 0 is the old Qi Gathering Pill) and breakthrough pill rank k (bt-k, for breaking OUT of realm k,
// so a realm-k alchemist can brew the pill for their own next breakthrough).
import { REALMS } from './data';

export const MAX_RANK = REALMS.length - 1; // 14
const CP_NAMES = ['Qi Gathering Pill', 'Foundation Pill', 'Golden Core Pill', 'Nascent Soul Pill', 'Body Tribulation Pill', 'Deity Pill', 'Spirit Unity Pill', 'Mahayana Pill', 'Ascendant Pill', 'Pseudo Immortal Pill', 'True Immortal Pill', 'Earth Immortal Pill', 'Golden Immortal Pill', 'Divine Immortal Pill', 'Emperor Pill'];
export const cpName = (r: number) => CP_NAMES[r];
export const cpId = (r: number) => (r === 0 ? 'qi-pill' : `cp-${r}`);
export const btId = (k: number) => `bt-${k}`;
export const cpBase = (r: number) => Math.round(10 * (1 + 0.6 * r));      // same price the old scaled pill had at that realm
export const btBase = (k: number) => Math.round(60 * (1 + 0.6 * k)); // k = realm being left (0..13)
export const pillRankOf = (id: string): number | null => id === 'qi-pill' ? 0 : /^cp-\d+$/.test(id) ? Number(id.slice(3)) : null;
export const btRankOf = (id: string): number | null => /^bt-\d+$/.test(id) ? Number(id.slice(3)) : null;

// Cultivation pill: how much of a stage it gives and how much toxicity it adds, for a user of realm R.
export function pillEffect(rank: number, R: number): { frac: number; tox: number } {
    if (rank >= R) return { frac: Math.min(0.6, 0.33 * (1 + 0.25 * (rank - R))), tox: 1 + 0.75 * (rank - R) };
    return { frac: 0.33 * Math.pow(0.5, R - rank), tox: 1 };
}
// The breakthrough pill an attempt out of realm `from` would swallow: lowest ranked pill of enough rank, then the old any-rank pill.
export function btPillFor(save: { eco?: { items: Record<string, number> } }, from: number): { id: string; bonus: number } | null {
    const items = save.eco?.items ?? {};
    for (let k = from; k < MAX_RANK; k++) if ((items[btId(k)] ?? 0) > 0) return { id: btId(k), bonus: Math.min(0.25, 0.15 + 0.03 * (k - from)) };
    if ((items['bt-pill'] ?? 0) > 0) return { id: 'bt-pill', bonus: from <= 2 ? 0.15 : Math.max(0.03, 0.15 - 0.03 * (from - 2)) }; // legacy stock fades at higher realms
    return null;
}
