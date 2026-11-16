// Save compatibility. Rules: (1) the storage key never changes; (2) newer builds read every older save, filling
// defaults for fields that did not exist; (3) fields this build does not know are kept untouched (spread, never rebuilt),
// so a downgrade then upgrade loses nothing; (4) a save that looks broken is never overwritten - a backup copy is kept.
import type { SaveGame } from './state';
import { SAVE_SCHEMA } from './state';

export const looksValid = (s: unknown): s is SaveGame => {
    const o = s as Record<string, unknown> | null;
    return !!o && typeof o === 'object' && typeof o.clockDays === 'number' && !!o.char && typeof o.char === 'object';
};
// Steps run in order from the save's own schema up to the current one. Each only adds defaults.
const STEPS: Record<number, (s: any) => any> = {
    1: s => ({ ...s, char: { ...s.char, gender: s.char.gender ?? 'male' } }),   // 1 -> 2: gender and avatar
};
export function migrateSave(raw: unknown): SaveGame | null {
    if (!looksValid(raw)) return null;
    let s: any = raw;
    const from = typeof s.schema === 'number' ? s.schema : 1;
    // A save written by a NEWER build is kept as is (its extra fields stay); this build just plays what it understands.
    if (from >= SAVE_SCHEMA) return s as SaveGame;
    for (let v = from; v < SAVE_SCHEMA; v++) if (STEPS[v]) s = STEPS[v](s);
    return { ...s, schema: SAVE_SCHEMA, wroteBy: SAVE_SCHEMA } as SaveGame;
}
// Text backup: wrapped so it carries its schema and survives copy and paste.
export const exportSave = (s: SaveGame): string => JSON.stringify({ nineHeavens: 1, schema: (s as any).schema ?? SAVE_SCHEMA, save: s });
export function importSave(text: string): SaveGame | null {
    try { const j = JSON.parse(text.trim()); return migrateSave(j?.nineHeavens ? j.save : j); } catch { return null; }
}
