// Naming system: every name follows the land. Direction comes from where the place sits inside its
// parent region (with the four-symbol cosmos: Azure east, Vermilion south, White west, Black north,
// Yellow centre), the feature comes from the painted terrain under it (snow, peaks, forest, dunes,
// lakes, coast, plain), and sects take a speciality that fits their ground.
// Runs as a post-pass with its own RNG so the world's layout never changes.
import type { World, City, Force } from './world';
import { biomeAt, nearSea, type Biome } from './biomes';
import { mulberry32 } from './rng';

type R = () => number;
const pick = <T,>(r: R, a: T[]): T => a[Math.floor(r() * a.length)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function inPoly(x: number, y: number, poly: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

type Dir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C';
function dirOf(x: number, y: number, cx: number, cy: number, reach: number): Dir {
    const dx = x - cx, dy = y - cy;
    if (Math.hypot(dx, dy) < reach * 0.22) return 'C';
    const a = Math.atan2(dy, dx); // screen y grows downward, so +y is south
    const k = Math.round(a / (Math.PI / 4));
    return (['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E'] as Dir[])[(k + 8) % 8 === 8 ? 0 : (k + 8) % 8] ?? 'E';
}
const PLAIN: Record<Dir, string> = { N: 'Northern', NE: 'Northeastern', E: 'Eastern', SE: 'Southeastern', S: 'Southern', SW: 'Southwestern', W: 'Western', NW: 'Northwestern', C: 'Central' };
// The four symbols of old cosmology, by compass side.
const SYMBOL: Record<Dir, string[]> = {
    N: ['Black'], NE: [], E: ['Azure'], SE: [], S: ['Vermilion'], SW: [], W: ['White'], NW: [], C: ['Yellow'],
};
const sym = (r: R, d: Dir): string => (SYMBOL[d].length ? pick(r, SYMBOL[d]) : PLAIN[d]);
const ADJ_ONLY: Record<Dir, string> = { N: 'North', NE: 'Northeast', E: 'East', SE: 'Southeast', S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest', C: 'Central' };

// ---- terrain vocabularies ---------------------------------------------------
type Terr = 'P' | 'M' | 'S' | 'F' | 'D' | 'L' | 'C';
const terr = (b: Biome): Terr => (b === 'H' ? 'M' : b === '.' ? 'C' : b) as Terr;
const PREF_FEATURE: Record<Terr, string[]> = {
    P: ['Golden Fields', 'Cloudplain', 'Riverbend', 'Ten Thousand Fields', 'Heartland', 'Willow Plains', 'Millet Basin', 'Spring Breeze Plain'],
    M: ['Ironridge', 'Skyspire', 'Nine Peaks', 'Dragonspine', 'Sword Ridge', 'Thunder Crest', 'Cloudpiercer', 'Heavenpillar'],
    S: ['Frostpeak', 'White Waste', 'Snowcrown', 'Frozen Moon', 'Winterhold', 'Ice Sword', 'Silent Snow', 'Glacier Gate'],
    F: ['Verdant Sea', 'Greenwood', 'Hundred Beasts Forest', 'Mistwood', 'Emerald Canopy', 'Ancient Cedar', 'Ghostpine', 'Spirit Grove'],
    D: ['Golden Sands', 'Ashen Dune', 'Scorched Plain', 'Red Sand', 'Burning Waste', 'Dragon Bone Desert', 'Mirage Basin', 'Sunfall Dunes'],
    L: ['Nine Lakes', 'Mirror Lake', 'Moonwater', 'Thousand Pools', 'Lotus Basin', 'Jade Mere', 'Silent Rain', 'Cloud Reflection'],
    C: ['Tidegate', 'Whalecoast', 'Pearl Shore', 'Stormbreak', 'Seawatch', 'Dragon King Bay', 'Moonwave Coast', 'Coral Reach'],
};
const CITY_NOUN: Record<Terr, string[]> = {
    P: ['Orchard', 'Millet', 'Peach', 'Willow', 'Barley', 'Lantern', 'Swallow', 'Mulberry', 'Plum', 'Cloudfield', 'Ox', 'Haystack', 'Springbreeze'],
    M: ['Ashrock', 'Ironpeak', 'Skyladder', 'Thunderhead', 'Cinderridge', 'Greystone', 'Eagle', 'Cloudcleave', 'Swordnotch', 'Hangingbridge', 'Cragfall', 'Echo', 'Cliff', 'Boulder'],
    S: ['Snowgate', 'Frostmere', 'Whitepine', 'Icebridge', 'Coldspring', 'Lantern', 'Wolf', 'Snowcrane', 'Rime', 'Glacier', 'Drift'],
    F: ['Greenwood', 'Mossroot', 'Bamboo', 'Cedarfall', 'Ghostwood', 'Fernshade', 'Hundredleaf', 'Deercry', 'Willowshade', 'Pine', 'Moonbark', 'Antler', 'Fireflies'],
    D: ['Driftsand', 'Redwind', 'Cinderwell', 'Sunbaked', 'Bonewater', 'Mirage', 'Camelrest', 'Dustveil', 'Amberdune', 'Scorpion', 'Sandglass', 'Vulture'],
    L: ['Moonmirror', 'Lotus', 'Reedshore', 'Silverfish', 'Heron', 'Duckweed', 'Mistpier', 'Clearwater', 'Jaderipple', 'Frogsong', 'Crane', 'Willowwater'],
    C: ['Tidewatch', 'Pearl', 'Saltwind', 'Gullcry', 'Wavebreak', 'Driftwood', 'Lanternbay', 'Conch', 'Stormanchor', 'Whalerib', 'Coral', 'Kelp', 'Seabreeze'],
};
const CITY_MOD = ['Silver', 'Golden', 'Jade', 'Ash', 'Crimson', 'Quiet', 'Old', 'Nine', 'Three', 'Seven', 'High', 'Low', 'Hidden', 'Ancient', 'Misty', 'Bright', 'Dusk', 'Dawn', 'Twin', 'Lone', 'Broken', 'Sleeping', 'Rising', 'Falling', 'Iron', 'Amber', 'Pale', 'Green', 'Red', 'White', 'Black'];
const TIER_SUFFIX: Record<string, string[]> = {
    village: ['Hamlet', 'Village', 'Cottages', 'Stockade'],
    town: ['Town', 'Crossing', 'Watch', 'Ferry'],
    city: ['City', 'Fortress', 'Walls', 'Gate'],
    market: ['Bazaar', 'Emporium', 'Grand Market'],
};
const TERR_SUFFIX: Record<Terr, string[]> = {
    P: ['Ford', 'Crossing'], M: ['Pass', 'Terrace', 'Hold'], S: ['Hold', 'Pass'], F: ['Lodge', 'Clearing'],
    D: ['Oasis', 'Wells', 'Caravanserai'], L: ['Landing', 'Pier'], C: ['Harbor', 'Port', 'Landing'],
};
const STATES = ['Yan', 'Zhao', 'Wei', 'Chu', 'Qin', 'Qi', 'Han', 'Wu', 'Yue', 'Shu', 'Liang', 'Jin', 'Song', 'Xia', 'Zhou', 'Tang', 'Chen', 'Lu', 'Cai', 'Ba', 'Yong', 'Xiang', 'Ning', 'Kang', 'Ji', 'Rong', 'Dai', 'Pei', 'Yun', 'Shang', 'Tan', 'Teng', 'Xu', 'Ying', 'Fan', 'Lai'];
const STATE_SUFFIX: Record<Terr, string[]> = {
    P: ['Kingdom', 'Dynasty', 'Empire', 'Principality'], M: ['Marches', 'Highland Kingdom', 'Dominion', 'Mountain Court'],
    S: ['Frostmarch', 'Winter Dominion', 'Tribal Union'], F: ['Kingdom', 'Forest Court', 'Principality'],
    D: ['Khanate', 'Sand Dominion', 'Caravan League'], L: ['Kingdom', 'Water Court', 'Riverlands Compact'], C: ['Maritime League', 'Kingdom', 'Harbor Dominion'],
};
const SURNAMES = ['Xiao', 'Lin', 'Ye', 'Murong', 'Nangong', 'Ouyang', 'Dugu', 'Sima', 'Baili', 'Helian', 'Jiang', 'Shen', 'Zhao', 'Han', 'Yan', 'Liu', 'Chu', 'Gu', 'Mo', 'Su', 'Tang', 'Bai', 'Huangfu', 'Yuwen', 'Shangguan', 'Zhuge', 'Wanyan', 'Duanmu', 'Dongfang', 'Gongsun', 'Xuanyuan', 'Linghu', 'Qin', 'Luo', 'Fang', 'Meng'];
const CLAN_MOTIF: Record<Terr, string[]> = {
    P: ['Sky', 'Cloud', 'Spring Breeze', 'Golden Field', 'Lantern', 'Hundred Li'],
    M: ['Ridge', 'Iron Peak', 'Sword Ridge', 'Skyspire', 'Thunder Crag', 'Nine Peak'],
    S: ['Frost', 'Snow', 'Winter Moon', 'Ice Crown', 'Silent Snow'],
    F: ['Green Jade', 'Verdant', 'Hundred Leaf', 'Misty Wood', 'Ancient Cedar'],
    D: ['Golden Sand', 'Scorched Sun', 'Red Dune', 'Mirage', 'Dragon Bone'],
    L: ['Mirror Lake', 'Moonwater', 'Lotus', 'Jade Mere', 'Silent Rain'],
    C: ['Tide', 'Sea Wind', 'Pearl', 'Stormbreak', 'Whale Song'],
};
// Sect speciality that fits the ground it grew on, and the house type that suits it.
const SECT_SPEC: Record<Terr, [string, string[]][]> = {
    P: [['Pill', ['Valley', 'Pavilion']], ['Formation', ['Sect', 'Hall']], ['Talisman', ['Pavilion', 'Hall']], ['Heavenly Calculation', ['Pavilion']], ['Cloud', ['Sect', 'Palace']]],
    M: [['Sword', ['Sect', 'Peak', 'Villa']], ['Spear', ['Sect', 'Hall']], ['Thunder', ['Sect', 'Temple']], ['Iron Body', ['Hall', 'Sect']], ['Skyspire', ['Sect', 'Palace']]],
    S: [['Frost', ['Palace', 'Sect']], ['Ice Moon', ['Palace', 'Temple']], ['Cold Mountain', ['Sect', 'Hall']], ['Snow Lotus', ['Pavilion', 'Valley']]],
    F: [['Herb', ['Valley', 'Hall']], ['Beast Taming', ['Hall', 'Valley']], ['Spirit Wood', ['Sect', 'Temple']], ['Poison', ['Valley', 'Sect']], ['Hundred Flowers', ['Valley', 'Pavilion']]],
    D: [['Flame', ['Sect', 'Hall', 'Palace']], ['Scorching Sun', ['Sect', 'Temple']], ['Sand Shadow', ['Sect', 'Villa']], ['Puppet', ['Hall', 'Sect']]],
    L: [['Water Moon', ['Palace', 'Pavilion']], ['Lotus', ['Pavilion', 'Temple']], ['Mirror', ['Pavilion', 'Hall']], ['Rain Listening', ['Pavilion', 'Villa']]],
    C: [['Tide', ['Palace', 'Sect']], ['Sea Dragon', ['Palace', 'Hall']], ['Pearl', ['Pavilion', 'Palace']], ['Storm', ['Sect', 'Temple']]],
};
const SECT_PREFIX = ['Nine Heavens', 'Profound', 'Seven Star', 'Heavenly', 'Silent', 'Hidden', 'Ten Thousand', 'Eternal', 'Immortal', 'Primordial', 'Void', 'Celestial', 'Nine Dragon', 'Three Pure', 'Purple Cloud', 'Jade Emperor', 'Boundless', 'Dao Heart', 'Ancestral', 'Starfall', 'Moonlit', 'Sunless', 'Verdant', 'Crimson', 'Golden Lotus', 'Sacred', 'Phoenix', 'Thousand Peak', 'Mystic', 'Radiant'];

export function renameWorld(world: World, seed: number): void {
    const r: R = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    const used = new Set<string>();
    const unique = (make: () => string, fallback: (n: number) => string): string => {
        for (let t = 0; t < 80; t++) { const n = make(); if (!used.has(n) && !/\b(\S+) \1\b/i.test(n) && !/\b(White|Black|Azure|Yellow|Vermilion) (White|Black|Golden|Azure|Yellow|Scarlet|Crimson|Silver|Frost)/.test(n)) { used.add(n); return n; } }
        for (let n = 2; n < 400; n++) { const s = fallback(n); if (!used.has(s)) { used.add(s); return s; } }
        return make();
    };
    const dominant = (poly: [number, number][], fallbackXY: [number, number]): Terr => {
        const cnt: Record<string, number> = {};
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (const [x, y] of poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        for (let y = Math.floor(minY / 100) * 100 + 50; y < maxY; y += 100) for (let x = Math.floor(minX / 100) * 100 + 50; x < maxX; x += 100) {
            if (!inPoly(x, y, poly)) continue;
            const t = terr(biomeAt(x, y));
            if (t === 'C') continue;
            cnt[t] = (cnt[t] ?? 0) + (t === 'P' ? 0.6 : 1); // plains are the default; a notable biome wins
        }
        const e = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
        return e ? (e[0] as Terr) : terr(biomeAt(fallbackXY[0], fallbackXY[1]));
    };
    const reachOf = (poly: [number, number][], c: [number, number]) => Math.max(...poly.map(([x, y]) => Math.hypot(x - c[0], y - c[1])), 50);

    // Prefectures: "<direction> <terrain feature> Prefecture", e.g. "Eastern Ironridge Prefecture".
    const contById = new Map(world.continents.map(c => [c.id, c]));
    const prefTerr = new Map<string, Terr>();
    const prefFeature = new Map<string, string>();
    const prefOldToNew = new Map<string, string>();
    for (const p of world.prefectures) {
        const home = world.cities.find(c => c.prefectureId === p.id);
        const cont = home ? contById.get(home.continentId) : undefined;
        const t = dominant(p.polygon, p.centroid);
        const d: Dir = cont ? dirOf(p.centroid[0], p.centroid[1], cont.centroid[0], cont.centroid[1], reachOf(cont.polygon, cont.centroid)) : 'C';
        let feat = '';
        const old = p.name;
        p.name = unique(() => {
            feat = pick(r, PREF_FEATURE[t]);
            const roll = r();
            if (d === 'C' && roll < 0.6) return `${feat} Prefecture`;
            if (roll < 0.5) return `${PLAIN[d]} ${feat} Prefecture`;
            return `${sym(r, d)} ${feat} Prefecture`;
        }, n => `${PLAIN[d]} ${feat} Prefecture ${'I'.repeat(Math.min(n, 5))}`);
        prefTerr.set(p.id, t); prefFeature.set(p.id, feat); prefOldToNew.set(old, p.name);
    }
    const prefById = new Map(world.prefectures.map(p => [p.id, p]));

    // Countries: ancient state name + direction inside the prefecture + a house type that fits the land.
    const countryNew = new Map<string, string>();
    const stateOrder = [...STATES].sort(() => r() - 0.5);
    let si = 0;
    for (const c of world.countries) {
        const home = world.cities.find(x => x.countryId === c.id);
        const pref = home ? prefById.get(home.prefectureId) : undefined;
        const t = dominant(c.polygon, c.centroid);
        const d: Dir = pref ? dirOf(c.centroid[0], c.centroid[1], pref.centroid[0], pref.centroid[1], reachOf(pref.polygon, pref.centroid)) : 'C';
        const state = stateOrder[si++ % stateOrder.length];
        const round = Math.floor((si - 1) / stateOrder.length);
        c.name = unique(() => {
            const suf = pick(r, STATE_SUFFIX[t]);
            const name = round === 0 ? state : `${state}`;
            const roll = r();
            if (d === 'C' || roll < 0.35) return round === 0 ? `${name} ${suf}` : `Old ${name} ${suf}`;
            return `${PLAIN[d]} ${name} ${suf}`;
        }, n => `${state} ${pick(r, STATE_SUFFIX[t])} ${'I'.repeat(Math.min(n, 5))}`);
        countryNew.set(c.id, c.name);
    }
    const countryById = new Map(world.countries.map(c => [c.id, c]));

    // Cities: terrain feature + a suffix for the tier and the ground. The prefectural capital carries the
    // prefecture's own feature name (as Chinese capitals carry their region's name).
    const capitalOf = new Set(world.prefectures.map(p => p.capitalId));
    for (const c of world.cities) {
        const b = biomeAt(c.x, c.y);
        let t: Terr = terr(b);
        if (t !== 'L' && t !== 'S' && nearSea(c.x, c.y, 1)) t = 'C';
        if (capitalOf.has(c.id)) {
            const feat = prefFeature.get(c.prefectureId) ?? pick(r, CITY_NOUN[t]);
            c.name = unique(() => `${feat} ${pick(r, ['City', 'Capital', 'Seat'])}`, n => `${feat} Capital ${'I'.repeat(Math.min(n, 5))}`);
            continue;
        }
        const tier = c.tier === 'market' ? 'market' : c.tier;
        c.name = unique(() => {
            const feat = r() < 0.55 ? `${pick(r, CITY_MOD)} ${pick(r, CITY_NOUN[t])}` : pick(r, CITY_NOUN[t]);
            const suf = r() < 0.4 ? pick(r, TERR_SUFFIX[t]) : pick(r, TIER_SUFFIX[tier] ?? TIER_SUFFIX.town);
            return `${feat} ${suf}`;
        }, n => `${PLAIN[dirOf(c.x, c.y, prefById.get(c.prefectureId)?.centroid[0] ?? c.x, prefById.get(c.prefectureId)?.centroid[1] ?? c.y, 400)]} ${pick(r, CITY_MOD)} ${pick(r, CITY_NOUN[t])} ${pick(r, TIER_SUFFIX[tier] ?? TIER_SUFFIX.town)}${n > 40 ? ' ' + 'I'.repeat(Math.min(n - 40, 5)) : ''}`);
    }

    // Forces: named for the ground their seat sits on, with a speciality that grew from that ground.
    const cityOf = new Map(world.cities.map(c => [c.id, c]));
    const clanCount = new Map<string, number>();
    const forceDir = (f: Force, seat: City): Dir => {
        const cont = contById.get(seat.continentId); if (!cont) return 'C';
        const pref = prefById.get(seat.prefectureId);
        return pref ? dirOf(seat.x, seat.y, pref.centroid[0], pref.centroid[1], reachOf(pref.polygon, pref.centroid)) : 'C';
    };
    for (const f of world.forces) {
        const seat = cityOf.get(f.hqCityId); if (!seat) continue;
        let t: Terr = terr(biomeAt(seat.x, seat.y));
        if (t !== 'L' && t !== 'S' && nearSea(seat.x, seat.y, 1)) t = 'C';
        const d = forceDir(f, seat);
        if (f.kind === 'clan') {
            // spread the surnames out: pick among the least-used ones
            const least = Math.min(...SURNAMES.map(s => clanCount.get(s) ?? 0));
            const pool = SURNAMES.filter(s => (clanCount.get(s) ?? 0) === least);
            const core = pick(r, pool);
            clanCount.set(core, (clanCount.get(core) ?? 0) + 1);
            f.surname = core;
            f.name = unique(() => {
                const motif = pick(r, CLAN_MOTIF[t]); const roll = r();
                if (roll < 0.45) return `${PLAIN[d]} ${motif} ${core} Clan`.replace('Central ', '');
                if (roll < 0.8) return `${sym(r, d)} ${motif} ${core} Clan`;
                return `${motif} ${core} Clan`;
            }, n => `${core} Clan of the ${PLAIN[d]} ${'I'.repeat(Math.min(n, 5))} Line`);
        } else {
            f.name = unique(() => {
                const [spec, houses] = pick(r, SECT_SPEC[t]);
                const house = pick(r, houses); const roll = r();
                if (roll < 0.3) return `${sym(r, d)} ${spec} ${house}`;
                if (roll < 0.85) return `${pick(r, SECT_PREFIX)} ${spec} ${house}`;
                return `${spec} ${house}`;
            }, n => `${pick(r, SECT_PREFIX)} ${pick(r, SECT_SPEC[t])[0]} Sect ${'I'.repeat(Math.min(n, 5))}`);
        }
    }

    // Keep the denormalized labels on cities in step with the new names.
    for (const c of world.cities) {
        c.continent = contById.get(c.continentId)?.name ?? c.continent;
        c.prefecture = prefById.get(c.prefectureId)?.name ?? c.prefecture;
        c.country = countryById.get(c.countryId)?.name ?? c.country;
    }
    void prefOldToNew; void countryNew;
}
