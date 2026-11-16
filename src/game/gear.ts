// Equipment: robes, weapons, rings, treasures and a life-bound artifact. Effects touch systems that exist; weapons carry
// an attack stat that waits for combat. Gear instances are unique, kept in save.gearBag and worn in save.gear.
import type { SaveGame } from './state';

export type Kind = 'robe' | 'head' | 'belt' | 'boots' | 'weapon' | 'focus' | 'ring' | 'charm' | 'treasure' | 'artifact';
export interface GearItem { uid: string; name: string; icon: string; kind: Kind; grade: number; fx: Record<string, number>; atk?: number; since?: number }
export const GRADES = ['Mortal', 'Spirit', 'Earth', 'Heaven'];
export const GRADE_REALM = [0, 2, 4, 7];
const GRADE_MULT = [1, 2, 3.5, 6];
export const FX_LABEL: Record<string, string> = {
    cult: 'cultivation speed', bt: 'breakthrough chance', road: 'fewer road encounters', travel: 'faster travel', craft: 'craft success',
    barter: 'better prices', life: 'years of life', luck: 'luck', rival: 'rival protection', calamity: 'calamity protection', tox: 'less pill toxicity',
};
const FX_CAP: Record<string, number> = { cult: 0.6, bt: 0.2, road: 0.7, travel: 0.5, craft: 0.25, barter: 0.3, life: 400, luck: 40, rival: 0.8, calamity: 0.8, tox: 0.7 };
export const fmtFx = (k: string, v: number) => k === 'life' ? `+${Math.round(v)} ${FX_LABEL[k]}` : k === 'luck' ? `+${Math.round(v)} ${FX_LABEL[k]}` : `+${Math.round(v * 100)}% ${FX_LABEL[k]}`;

export interface SlotDef { id: string; kind: Kind; label: string; icon: string; group: string }
export const SLOTS: SlotDef[] = [
    { id: 'robe', kind: 'robe', label: 'Robe', icon: '🥋', group: 'Body' }, { id: 'head', kind: 'head', label: 'Headwear', icon: '🎩', group: 'Body' },
    { id: 'belt', kind: 'belt', label: 'Belt', icon: '🎗️', group: 'Body' }, { id: 'boots', kind: 'boots', label: 'Boots', icon: '🥾', group: 'Body' },
    { id: 'weapon', kind: 'weapon', label: 'Weapon', icon: '🗡️', group: 'Hands' }, { id: 'focus', kind: 'focus', label: 'Focus', icon: '🔮', group: 'Hands' },
    { id: 'ring1', kind: 'ring', label: 'Ring', icon: '💍', group: 'Adornments' }, { id: 'ring2', kind: 'ring', label: 'Ring', icon: '💍', group: 'Adornments' },
    { id: 'charm1', kind: 'charm', label: 'Charm', icon: '🧿', group: 'Adornments' }, { id: 'charm2', kind: 'charm', label: 'Charm', icon: '🧿', group: 'Adornments' },
    { id: 'treasure1', kind: 'treasure', label: 'Treasure', icon: '🏺', group: 'Treasures' }, { id: 'treasure2', kind: 'treasure', label: 'Treasure', icon: '🏺', group: 'Treasures' },
    { id: 'artifact', kind: 'artifact', label: 'Artifact', icon: '⚜️', group: 'Artifact' },
];
const KIND_FX: Record<Kind, [string, number][]> = {
    robe: [['calamity', 0.08], ['life', 3]], head: [['luck', 3], ['bt', 0.01]], belt: [['barter', 0.03], ['craft', 0.02]],
    boots: [['travel', 0.05], ['road', 0.04]], weapon: [['rival', 0.05]], focus: [['cult', 0.02], ['bt', 0.01]],
    ring: [['cult', 0.02], ['bt', 0.012]], charm: [['road', 0.06], ['bt', 0.01]], treasure: [['tox', 0.1], ['calamity', 0.06], ['luck', 2]],
    artifact: [['cult', 0.06], ['life', 5]],
};
const NAMES: Record<Kind, string[][]> = {
    robe: [['Hemp Robe', 'Rough Cloth Robe'], ['Cloudsilk Robe', 'Moonthread Robe'], ['Starweave Robe', 'Thousand-Crane Robe'], ['Heavenly Phoenix Robe', 'Robe of Nine Heavens']],
    head: [['Bamboo Hat', 'Cloth Headband'], ['Jade Hairpin', 'Silver Crown'], ['Sage Guan', 'Dragon-bone Circlet'], ['Crown of the Dao', 'Celestial Diadem']],
    belt: [['Rope Belt', 'Leather Belt'], ['Spirit Silk Sash', 'Jade-clasp Belt'], ['Starsteel Belt', 'Bottomless Sash'], ['Girdle of Heaven', 'Belt of Ten Thousand Things']],
    boots: [['Straw Sandals', 'Travel Boots'], ['Cloud-step Boots', 'Wind Sandals'], ['Thunderstride Boots', 'Mist-walk Boots'], ['Boots of Ten Thousand Li', 'Heavenstep Sandals']],
    weapon: [['Iron Sword', 'Hardwood Staff'], ['Spirit Blade', 'Jade Fan'], ['Starfall Sword', 'Thunder Halberd'], ['Heaven-cleaving Sword', 'Sword of Nine Suns']],
    focus: [['Copper Mirror', 'Wooden Beads'], ['Jade Mirror', 'Spirit Bell'], ['Moon Pearl', 'Soul-calming Chime'], ['Mirror of Fates', 'Bead of the Dao']],
    ring: [['Bronze Ring', 'Bone Ring'], ['Jade Ring', 'Silver Ring'], ['Void Ring', 'Starlight Ring'], ['Ring of Origin', 'Ring of the Great Dao']],
    charm: [['Iron Charm', 'Peach-wood Charm'], ['Jade Pendant', 'Spirit Charm'], ['Thunder-wood Charm', 'Pearl Pendant'], ['Heavenly Fortune Charm', 'Charm of Ten Thousand Years']],
    treasure: [['Clay Gourd', 'Old Compass'], ['Spirit Gourd', 'Lotus Lamp'], ['Earth Vein Bell', 'Purple Cauldron'], ['Heaven-sealing Pagoda', 'Pearl of Creation']],
    artifact: [['Bamboo Flying Raft', 'Iron Sword Vessel'], ['Spirit Flying Boat', 'Jade Lotus Vessel'], ['Star Vessel', 'Thunder Chariot'], ['Nine Heavens Vessel', 'Origin Sword Vessel']],
};
const ICON: Record<Kind, string> = { robe: '🥋', head: '🎩', belt: '🎗️', boots: '🥾', weapon: '🗡️', focus: '🔮', ring: '💍', charm: '🧿', treasure: '🏺', artifact: '⚜️' };
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function makeGear(seedKey: string, kind: Kind, grade: number, nameOverride?: string): GearItem {
    const h = hash(`${seedKey}|${kind}|${grade}`);
    const fxs = KIND_FX[kind];
    const fx: Record<string, number> = {};
    const n = grade >= 2 ? fxs.length : Math.min(fxs.length, 1 + (h % 2));
    for (let i = 0; i < n; i++) { const [k, v] = fxs[(h + i) % fxs.length]; const jitter = 0.85 + ((h >>> (i * 5)) % 31) / 100; fx[k] = (fx[k] ?? 0) + (k === 'life' || k === 'luck' ? Math.round(v * GRADE_MULT[grade] * jitter) : Math.round(v * GRADE_MULT[grade] * jitter * 1000) / 1000); }
    const pool = NAMES[kind][grade];
    return { uid: `g${h.toString(36)}`, name: nameOverride ?? pool[(h >>> 3) % pool.length], icon: ICON[kind], kind, grade, fx, atk: kind === 'weapon' ? Math.round(6 * GRADE_MULT[grade] * (0.9 + (h % 20) / 100)) : undefined };
}
export const gearPrice = (g: GearItem) => Math.round([60, 400, 3000, 25000][g.grade] * (g.kind === 'artifact' ? 6 : 1) * (1 + g.kind.length * 0.02) * (0.9 + (hash(g.uid) % 25) / 100));
export const gearBag = (s: SaveGame): GearItem[] => s.gearBag ?? [];
export const equipped = (s: SaveGame): Record<string, GearItem | null> => s.gear ?? {};
const realmOf = (s: SaveGame) => s.cult?.realm ?? 0;
export const artifactLevel = (s: SaveGame, g: GearItem) => g.kind === 'artifact' ? Math.min(9, Math.floor(Math.max(0, s.clockDays - (g.since ?? s.clockDays)) / (360 * 8))) : 0;

// Total effect of everything worn (plus legacy pack charms) for a key.
export function gearEffect(s: SaveGame, key: string): number {
    let t = 0;
    for (const g of Object.values(s.gear ?? {})) {
        if (!g) continue;
        let v = g.fx[key] ?? 0;
        if (g.kind === 'artifact' && key === 'cult') v *= 1 + 0.12 * artifactLevel(s, g);
        t += v;
    }
    const legacy = s.worn ?? [], items = s.eco?.items ?? {};
    if (legacy.includes('iron-charm') && (items['iron-charm'] ?? 0) > 0 && key === 'road') t += 0.3;
    if (legacy.includes('jade-pendant') && (items['jade-pendant'] ?? 0) > 0 && key === 'bt') t += 0.05;
    return Math.min(t, FX_CAP[key] ?? 1);
}
export function fxText(g: GearItem, s?: SaveGame): string {
    const parts = Object.entries(g.fx).map(([k, v]) => fmtFx(k, g.kind === 'artifact' && k === 'cult' && s ? v * (1 + 0.12 * artifactLevel(s, g)) : v));
    if (g.atk) parts.push(`attack ${g.atk} (combat later)`);
    return parts.join(' · ');
}
export function canWear(s: SaveGame, g: GearItem): string | null {
    return realmOf(s) < GRADE_REALM[g.grade] ? `Needs ${['Qi Refining', 'Foundation Establishment', 'Golden Core', 'Nascent Soul', 'Body Tribulation', 'Deity Transformation', 'Spirit Unity', 'Mahayana'][GRADE_REALM[g.grade]]} or higher.` : null;
}
export function equip(s: SaveGame, slotId: string, uid: string): { save: SaveGame; msg: string } {
    const slot = SLOTS.find(x => x.id === slotId); const g = gearBag(s).find(x => x.uid === uid);
    if (!slot || !g || g.kind !== slot.kind) return { save: s, msg: 'That does not fit there.' };
    const why = canWear(s, g); if (why) return { save: s, msg: why };
    const cur = (s.gear ?? {})[slotId];
    let bag = gearBag(s).filter(x => x.uid !== uid);
    if (cur) bag = [...bag, cur];
    const item = g.kind === 'artifact' && !g.since ? { ...g, since: s.clockDays } : g;
    return { save: { ...s, gear: { ...(s.gear ?? {}), [slotId]: item }, gearBag: bag }, msg: `${g.icon} You equip the ${g.name}.` };
}
export function unequip(s: SaveGame, slotId: string): { save: SaveGame; msg: string } {
    const cur = (s.gear ?? {})[slotId]; if (!cur) return { save: s, msg: '' };
    return { save: { ...s, gear: { ...(s.gear ?? {}), [slotId]: null }, gearBag: [...gearBag(s), cur] }, msg: `You take off the ${cur.name}.` };
}
export function addGear(s: SaveGame, g: GearItem): SaveGame { return { ...s, gearBag: [...gearBag(s), g] }; }
// Market gear stall: a few pieces per town per month, better in bigger markets.
export function gearStall(s: SaveGame, cityId: string, tier: number): GearItem[] {
    if (tier < 1) return [];
    const month = Math.floor(s.clockDays / 30), kinds = Object.keys(KIND_FX).filter(k => k !== 'artifact') as Kind[];
    const out: GearItem[] = [];
    for (let i = 0; i < 3; i++) {
        const h = hash(`${cityId}|${month}|gear${i}`);
        const maxG = tier === 1 ? 0 : tier === 2 ? 1 : 2;
        const grade = Math.min(maxG, (h >>> 4) % 100 < 70 ? 0 : (h >>> 12) % 100 < 80 ? 1 : 2);
        out.push(makeGear(`${cityId}|${month}|${i}`, kinds[h % kinds.length], tier === 1 ? 0 : grade));
    }
    // A rare find: an old artifact, now and then, in bigger markets.
    const ha = hash(`${cityId}|${month}|art`);
    if (tier >= 2 && ha % 100 < (tier === 2 ? 22 : 40)) out.push(makeGear(`${cityId}|${month}|art`, 'artifact', tier === 3 && (ha >>> 8) % 100 < 25 ? 1 : 0));
    return out;
}
export function buyGear(s: SaveGame, g: GearItem): { save: SaveGame; msg: string } {
    const cost = gearPrice(g), stones = s.eco?.stones ?? 0;
    if (stones < cost) return { save: s, msg: `You need ${cost} spirit stones.` };
    const owned = gearBag(s).some(x => x.uid === g.uid) || Object.values(s.gear ?? {}).some(x => x?.uid === g.uid);
    if (owned) return { save: s, msg: 'You already own that piece.' };
    return { save: addGear({ ...s, eco: { ...s.eco!, stones: stones - cost } }, g), msg: `You buy the ${g.name} for ${cost} stones.` };
}
export function sellGear(s: SaveGame, uid: string): { save: SaveGame; msg: string } {
    const g = gearBag(s).find(x => x.uid === uid); if (!g) return { save: s, msg: '' };
    const p = Math.round(gearPrice(g) * 0.5);
    return { save: { ...s, gearBag: gearBag(s).filter(x => x.uid !== uid), eco: { ...s.eco!, stones: (s.eco?.stones ?? 0) + p } }, msg: `You sell the ${g.name} for ${p} stones.` };
}
export const wearingSummary = (s: SaveGame) => { const n = Object.values(s.gear ?? {}).filter(Boolean).length; const c = gearEffect(s, 'cult'); return `${n}/${SLOTS.length} slots${c > 0 ? ` · +${Math.round(c * 100)}% cultivation` : ''}`; };
