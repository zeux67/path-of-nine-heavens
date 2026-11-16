// Deterministic world generation. ONE fixed seed: every life shares this world.

import { CITY_PREFIX, CITY_SUFFIX, CLAN_NAMES } from './data';
import { COASTLINES } from './coastlines';
import { renameWorld } from './names';
import { Rng, mulberry32, pick, randInt, shuffle } from './rng';

export const WORLD_SEED = 904151;

export type CityTier = 'village' | 'town' | 'city' | 'capital' | 'market';

export interface City {
    id: string;
    name: string;
    tier: CityTier;
    x: number;
    y: number;
    continentId: string;
    prefectureId: string;
    countryId: string;
    continent: string;
    prefecture: string;
    country: string;
    marketTier: number; // 0..3 index into MARKET_TIERS
    forceSeatId: string | null; // a force holds its headquarters here (kept for compat)
    seatForceIds: string[]; // every force headquartered here
}

export interface Force {
    id: string;
    kind: 'sect' | 'clan';
    name: string;
    surname: string | null; // clans: the bare family name ("Eastern Jiang Clan" -> "Jiang")
    hegemon: boolean;
    hqCityId: string;
    prefectureIds: string[]; // where it holds power (hegemons span several)
}

export interface Country {
    id: string;
    name: string;
    polygon: [number, number][];
    centroid: [number, number];
}

export interface Prefecture {
    id: string;
    name: string;
    polygon: [number, number][];
    centroid: [number, number];
    capitalId: string;
    forceIds: string[];
}

export interface Continent {
    id: string;
    name: string;
    polygon: [number, number][];
    centroid: [number, number];
}

export interface Sea {
    id: string;
    name: string;
    x: number;
    y: number;
}

export interface World {
    seed: number;
    width: number;
    height: number;
    continents: Continent[];
    seas: Sea[];
    prefectures: Prefecture[];
    countries: Country[];
    cities: City[];
    forces: Force[];
    cityById: Map<string, City>;
    prefectureById: Map<string, Prefecture>;
    forceById: Map<string, Force>;
}

const WORLD_W = 7800;
const WORLD_H = 5200;

// ---- geometry helpers -----------------------------------------------------

function blobPolygon(rng: Rng, cx: number, cy: number, rx: number, ry: number): [number, number][] {
    const pts: [number, number][] = [];
    const n = 24;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const wobble = 0.78 + rng() * 0.34;
        pts.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble]);
    }
    return pts;
}

// Keep the part of poly closer to A than to B (Sutherland-Hodgman on the bisector).
function clipBisector(poly: [number, number][], a: [number, number], b: [number, number]): [number, number][] {
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const dir: [number, number] = [b[0] - a[0], b[1] - a[1]];
    const side = (p: [number, number]) => (p[0] - mid[0]) * dir[0] + (p[1] - mid[1]) * dir[1];
    const out: [number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        const sp = side(p);
        const sq = side(q);
        if (sp <= 0) out.push(p);
        if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
            const t = sp / (sp - sq);
            out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
    }
    return out;
}

// Voronoi-style cells: each center's territory inside the parent polygon.
function partition(centers: [number, number][], parent: [number, number][]): [number, number][][] {
    return centers.map((c, i) => {
        let cell = parent;
        for (let j = 0; j < centers.length; j++) {
            if (i === j) continue;
            cell = clipBisector(cell, c, centers[j]);
            if (cell.length === 0) break;
        }
        return cell;
    });
}

export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

function centroid(poly: [number, number][]): [number, number] {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of poly) { sx += x; sy += y; }
    return [sx / poly.length, sy / poly.length];
}

function scatterCenters(rng: Rng, poly: [number, number][], n: number): [number, number][] {
    const [cx, cy] = centroid(poly);
    const centers: [number, number][] = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.8;
        const d = 0.32 + rng() * 0.33;
        // Walk outward from the centroid until inside the polygon.
        for (let r = 1900; r > 20; r -= 20) {
            const x = cx + Math.cos(a) * r * d;
            const y = cy + Math.sin(a) * r * d * 0.75;
            if (pointInPolygon(x, y, poly)) { centers.push([x, y]); break; }
        }
    }
    // Fallback for any center that never landed inside.
    while (centers.length < n) centers.push([cx + (rng() - 0.5) * 60, cy + (rng() - 0.5) * 60]);
    return centers;
}

// ---- name pools ------------------------------------------------------------

const SECT_FIRST = ['Azure', 'Thunder', 'Jade', 'Scarlet', 'Silent', 'Profound', 'Mystic', 'Iron', 'Spirit', 'Raging', 'Frozen', 'Ghost', 'Heavenly', 'Blood', 'Golden', 'Moonlit', 'Verdant', 'Storm', 'Ember', 'Frost', 'Lotus', 'Crimson', 'Hollow', 'Radiant'];
const SECT_SECOND = ['Cloud', 'Sword', 'Star', 'Moon', 'Flame', 'River', 'Beast', 'Talisman', 'Formation', 'Pill', 'Bone', 'Phoenix', 'Dragon', 'Tiger', 'Crane', 'Serpent', 'Peak', 'Abyss', 'Lightning', 'Rain', 'Shadow', 'Bamboo', 'Willow', 'Sun'];
const SECT_SUFFIX = ['Sect', 'Pavilion', 'Hall', 'Valley', 'Temple', 'Palace', 'Villa', 'Gate', 'Court', 'Sanctum'];
const COUNTRY_WORDS = ['Great Yan', 'Wei', 'Chu', 'Zhao', 'Qilin', 'Red Maple', 'Ironpine', 'Cloudveil', 'Jin', 'Liang', 'Xia', 'Northern Ji', 'Riverlands', 'Jadefall', 'Long', 'Shu', 'Han', 'Eastern Wu', 'Qin', 'Song'];
const COUNTRY_SUFFIX = ['Kingdom', 'Dynasty', 'Marches', 'Dominion', 'Union', 'Theocracy', 'Principality', 'Territories', 'Empire', 'Court'];
const PREFECTURE_A = [
    'Jade', 'Falling', 'Green', 'Moon', 'Thunder', 'White', 'Ninefold', 'Ember', 'Frost',
    'Gold', 'Black', 'Spirit', 'Ashen', 'Lotus', 'Sword', 'Mistral', 'Crimson', 'Silent',
    'Dragon', 'Amber', 'Pale', 'Iron', 'Azure', 'Scarlet', 'Hollow', 'Storm', 'Verdant',
    'Profound', 'Ghost', 'Radiant',
];
const PREFECTURE_B = [
    'Cloud', 'Star', 'peak', 'water', 'clap', 'sand', 'fold', 'stone', 'veil', 'leaf',
    'root', 'Wind', 'ash', 'River', 'Ridge', 'Hollow', 'Sparrow', 'Rain', 'bone', 'Vale',
    'Moon', 'Blossom', 'Peak', 'Sea', 'Reach', 'Field', 'Marsh', 'Gate',
];
const SEA_NAMES = [
    'Whalefall Sea', 'Sea of Silent Stars', 'Tempest Abyss', 'Moonmirror Sea',
    'Blacktide Expanse', 'Azure Maelstrom', 'Ghostwave Sea', 'Dragonspine Deep',
    'Sea of Ten Thousand Mists',
];
const CONTINENT_NAMES = [
    'Azure Dragon Continent', 'Verdant Crane Expanse', 'Profound Tortoise Mainland',
    'Scarlet Phoenix Reach', 'Jade Qilin Wilds', 'White Tiger Highlands',
    'Ember Serpent Lowlands', 'Frozen Moon Frontier', 'Thunder Roc Plateau',
    'Blood Lotus Shore', 'Sky Whale Isles', 'Silent Cicada Vale',
];

// ---- the world -------------------------------------------------------------

export function generateWorld(seed: number): World {
    const rng = mulberry32(seed);
    const continents: Continent[] = [];
    const prefectures: Prefecture[] = [];
    const countries: Country[] = [];
    const cities: City[] = [];
    const forces: Force[] = [];

    const usedSectNames = new Set<string>();
    const usedClanNames = new Set<string>();
    const usedPrefNames = new Set<string>();
    const usedCountryNames = new Set<string>();
    const usedCityNames = new Set<string>();

    const sectName = (): string => {
        for (let t = 0; t < 60; t++) {
            const n = `${pick(rng, SECT_FIRST)} ${pick(rng, SECT_SECOND)} ${pick(rng, SECT_SUFFIX)}`;
            if (!usedSectNames.has(n)) { usedSectNames.add(n); return n; }
        }
        const n = `${pick(rng, SECT_FIRST)} ${pick(rng, SECT_SECOND)} ${pick(rng, SECT_SUFFIX)}`;
        usedSectNames.add(n);
        return n;
    };
    const CLAN_ADJ = ['Northern', 'Southern', 'Eastern', 'Western', 'Great', 'Ancient', 'Hidden', 'Black', 'White', 'Golden', 'Silver', 'Jade'];
    // Returns the display name plus the bare family name ("Eastern Jiang Clan" -> "Jiang").
    const clanName = (seatName: string): { name: string; core: string } => {
        for (let t = 0; t < 80; t++) {
            const core = pick(rng, CLAN_NAMES);
            const full = usedClanNames.size < CLAN_NAMES.length && rng() < 0.5 ? core : `${pick(rng, CLAN_ADJ)} ${core}`;
            const n = full + ' Clan';
            if (!usedClanNames.has(n)) { usedClanNames.add(n); return { name: n, core }; }
        }
        // Pool exhausted: branch clans named after their seat city.
        for (let t = 0; t < 40; t++) {
            const core = pick(rng, CLAN_NAMES);
            const n = `${core} Clan of ${seatName}`;
            if (!usedClanNames.has(n)) { usedClanNames.add(n); return { name: n, core }; }
        }
        const core = pick(rng, CLAN_NAMES);
        const n = `${pick(rng, CLAN_ADJ)} ${core} Clan`;
        usedClanNames.add(n);
        return { name: n, core };
    };
    const COUNTRY_ADJ = ['Northern', 'Southern', 'Eastern', 'Western', 'Upper', 'Lower', 'Great', 'Old', 'New', 'Free'];
    const countryName = (): string => {
        for (let t = 0; t < 80; t++) {
            const core = pick(rng, COUNTRY_WORDS);
            const n = (rng() < 0.45 ? core : `${pick(rng, COUNTRY_ADJ)} ${core}`) + ' ' + pick(rng, COUNTRY_SUFFIX);
            if (!usedCountryNames.has(n)) { usedCountryNames.add(n); return n; }
        }
        const n = `${pick(rng, COUNTRY_ADJ)} ${pick(rng, COUNTRY_WORDS)} ${pick(rng, COUNTRY_SUFFIX)}`;
        usedCountryNames.add(n);
        return n;
    };
    const prefectureName = (): string => {
        for (let t = 0; t < 80; t++) {
            const n = `${pick(rng, PREFECTURE_A)} ${pick(rng, PREFECTURE_B)} Prefecture`;
            if (!usedPrefNames.has(n)) { usedPrefNames.add(n); return n; }
        }
        const n = `${pick(rng, PREFECTURE_A)} ${pick(rng, PREFECTURE_B)} Prefecture`;
        usedPrefNames.add(n);
        return n;
    };
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const cityName = (): string => {
        for (let t = 0; t < 50; t++) {
            const n = `${pick(rng, CITY_PREFIX)} ${cap(pick(rng, CITY_SUFFIX))}`;
            if (!usedCityNames.has(n)) { usedCityNames.add(n); return n; }
        }
        const n = `${pick(rng, CITY_PREFIX)} ${cap(pick(rng, CITY_SUFFIX))} ${cap(pick(rng, CITY_SUFFIX))}`;
        usedCityNames.add(n);
        return n;
    };

    // Continents: the 12 landmasses of Zeel's hand-painted world map, coastlines
    // traced from the approved art (src/game/coastlines.ts). Sorted largest first:
    // 4 huge, 5 medium, 3 small. Names assigned by size, grandest first.
    const contNames = [
        'Azure Dragon Continent', 'Profound Tortoise Mainland', 'Scarlet Phoenix Reach', 'Verdant Crane Expanse',
        'Jade Qilin Wilds', 'White Tiger Highlands', 'Thunder Roc Plateau', 'Blood Lotus Shore', 'Ember Serpent Lowlands',
        'Frozen Moon Frontier', 'Sky Whale Isles', 'Silent Cicada Vale',
    ];
    COASTLINES.forEach((poly, i) => {
        continents.push({ id: `cont-${i}`, name: contNames[i], polygon: poly, centroid: centroid(poly) });
    });
    // Nine named seas in the open water between the landmasses (points verified as sea on the art).
    const seaPts: [number, number][] = [[3412, 792], [2864, 1646], [4266, 1524], [6703, 2012], [731, 2621], [3961, 2621], [5698, 3079], [2559, 4084], [3900, 4816]];
    const seas: Sea[] = SEA_NAMES.map((name, i) => ({ id: `sea-${i}`, name, x: seaPts[i][0], y: seaPts[i][1] }));

    let cityCounter = 0;
    for (const cont of continents) {
        let area = 0;
        for (let i = 0, j = cont.polygon.length - 1; i < cont.polygon.length; j = i++) {
            area += (cont.polygon[j][0] + cont.polygon[i][0]) * (cont.polygon[j][1] - cont.polygon[i][1]);
        }
        area = Math.abs(area / 2);
        const nPref = Math.max(5, Math.min(15, Math.round(5 + ((area - 134000) / (3536000 - 134000)) * 10)));
        const prefCenters = scatterCenters(rng, cont.polygon, nPref);
        const prefCells = partition(prefCenters, cont.polygon);
        const contForces: Force[] = [];
        const contPrefIds: string[] = [];

        for (let p = 0; p < nPref; p++) {
            const cell = prefCells[p];
            if (cell.length < 3) continue;
            const prefId = `pref-${prefectures.length}`;
            const prefName = prefectureName();

            // Countries: 2-3 per prefecture.
            const nCountry = randInt(rng, 2, 4);
            const countryCenters = scatterCenters(rng, cell, nCountry);
            const countryCells = partition(countryCenters, cell);
            const prefCities: City[] = [];

            for (let ctry = 0; ctry < nCountry; ctry++) {
                const cCell = countryCells[ctry];
                if (cCell.length < 3) continue;
                const cName = countryName();
                const countryId = `country-${countries.length}`;
                countries.push({ id: countryId, name: cName, polygon: cCell, centroid: centroid(cCell) });

                const xs = cCell.map(pt => pt[0]);
                const ys = cCell.map(pt => pt[1]);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                const nCities = randInt(rng, 2, 4);
                let placed = 0;
                for (let tries = 0; tries < 400 && placed < nCities; tries++) {
                    const x = minX + rng() * (maxX - minX);
                    const y = minY + rng() * (maxY - minY);
                    if (!pointInPolygon(x, y, cCell)) continue;
                    let tooClose = false;
                    for (const other of cities) {
                        const ddx = other.x - x;
                        const ddy = other.y - y;
                        if (ddx * ddx + ddy * ddy < 110 * 110) { tooClose = true; break; }
                    }
                    if (tooClose) continue;
                    const roll = rng();
                    const tier: CityTier = roll < 0.42 ? 'village' : roll < 0.8 ? 'town' : 'city';
                    prefCities.push({
                        id: `city-${cityCounter++}`, name: cityName(), tier, x, y,
                        continentId: cont.id, prefectureId: prefId, countryId,
                        continent: cont.name, prefecture: prefName, country: cName,
                        marketTier: tier === 'city' ? 1 : 0,
                        forceSeatId: null,
                        seatForceIds: [],
                    });
                    placed++;
                }
            }

            if (prefCities.length === 0) continue;

            // Capital: closest city to the prefecture's center of mass.
            const [pcx, pcy] = centroid(cell);
            prefCities.sort((a, b) => ((a.x - pcx) ** 2 + (a.y - pcy) ** 2) - ((b.x - pcx) ** 2 + (b.y - pcy) ** 2));
            const capital = prefCities[0];
            capital.tier = 'capital';
            capital.marketTier = Math.max(capital.marketTier, 2);

            cities.push(...prefCities);
            prefectures.push({
                id: prefId, name: prefName, polygon: cell, centroid: centroid(cell),
                capitalId: capital.id, forceIds: [],
            });
            contPrefIds.push(prefId);
        }

        // Forces: 1-3 new ones per prefecture on EVERY continent pass - old prefectures
        // keep accumulating factions, so the oldest continents are the most crowded (up
        // to ~30 forces per prefecture). Hegemons, below, stay inside their own continent.
        const contPrefs = prefectures.filter(pr => contPrefIds.includes(pr.id));
        const allPrefsSoFar = prefectures.filter(pr => pr.polygon.length > 0 && cities.some(c => c.prefectureId === pr.id));
        const contOwnForces: Force[] = [];
        for (const pref of allPrefsSoFar) {
            const nForces = randInt(rng, 1, 3);
            // Per-city seat caps (Zeel): at most 10 forces headquartered in one city,
            // except the prefectural capital, which can hold up to 20.
            const seats = cities.filter(c => c.prefectureId === pref.id
                && c.seatForceIds.length < (c.id === pref.capitalId ? 20 : 10));
            for (let f = 0; f < nForces && seats.length > 0; f++) {
                const isSect = rng() < 0.65;
                const si = Math.floor(rng() * seats.length);
                const seat = seats[si];
                if (seat.seatForceIds.length >= (seat.id === pref.capitalId ? 20 : 10) - 1) seats.splice(si, 1);
                const clan = isSect ? null : clanName(seat.name);
                const force: Force = {
                    id: `force-${forces.length}`,
                    kind: isSect ? 'sect' : 'clan',
                    name: isSect ? sectName() : clan!.name,
                    surname: clan ? clan.core : null,
                    hegemon: false,
                    hqCityId: seat.id,
                    prefectureIds: [pref.id],
                };
                seat.forceSeatId = force.id;
                seat.seatForceIds.push(force.id);
                forces.push(force);
                contForces.push(force);
                if (contPrefIds.includes(pref.id)) contOwnForces.push(force);
                pref.forceIds.push(force.id);
            }
        }

        // Hegemons: up to two of this continent's own forces extend over its
        // neighboring prefectures (never across continents).
        const nHegemons = randInt(rng, 1, 2);
        for (let h = 0; h < nHegemons && contOwnForces.length > 0; h++) {
            const force = pick(rng, contOwnForces);
            if (force.hegemon) continue;
            const homePref = force.prefectureIds[0];
            const home = prefectures.find(pr => pr.id === homePref);
            if (!home) continue;
            const others = contPrefs.filter(pr => pr.id !== homePref && !pr.forceIds.includes(force.id));
            if (others.length === 0) continue;
            others.sort((a, b) =>
                ((a.centroid[0] - home.centroid[0]) ** 2 + (a.centroid[1] - home.centroid[1]) ** 2)
                - ((b.centroid[0] - home.centroid[0]) ** 2 + (b.centroid[1] - home.centroid[1]) ** 2));
            const span = randInt(rng, 1, Math.min(2, others.length));
            for (let s = 0; s < span; s++) {
                force.prefectureIds.push(others[s].id);
                others[s].forceIds.push(force.id);
            }
            force.hegemon = true;
            force.name = force.kind === 'sect' ? force.name : force.name; // name unchanged
        }

        // One great market city per continent, not a capital, not a force seat.
        const marketCandidates = cities.filter(c => c.continentId === cont.id && c.tier !== 'capital' && !c.forceSeatId);
        if (marketCandidates.length > 0) {
            const m = pick(rng, marketCandidates);
            m.tier = 'market';
            m.marketTier = 3;
        }
    }

    // De-cluster: a few relaxation passes push apart any cities closer than 120px.
    // A move is reverted if it would push a city off its continent.
    const contPoly = new Map(continents.map(c => [c.id, c.polygon]));
    for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < cities.length; i++) {
            for (let j = i + 1; j < cities.length; j++) {
                const a = cities[i];
                const b = cities[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d2 = dx * dx + dy * dy;
                if (d2 >= 120 * 120 || d2 === 0) continue;
                const d = Math.sqrt(d2);
                const push = (120 - d) / 2 + 1;
                const ux = dx / d;
                const uy = dy / d;
                const ax = a.x - ux * push;
                const ay = a.y - uy * push;
                const bx = b.x + ux * push;
                const by = b.y + uy * push;
                if (pointInPolygon(ax, ay, contPoly.get(a.continentId)!)) { a.x = ax; a.y = ay; }
                if (pointInPolygon(bx, by, contPoly.get(b.continentId)!)) { b.x = bx; b.y = by; }
            }
        }
    }

    {
        const w0 = { seed, width: WORLD_W, height: WORLD_H, continents, seas, prefectures, countries, cities, forces } as unknown as World;
        renameWorld(w0, seed);
    }
    const cityById = new Map<string, City>();
    for (const c of cities) cityById.set(c.id, c);
    const prefectureById = new Map<string, Prefecture>();
    for (const p of prefectures) prefectureById.set(p.id, p);
    const forceById = new Map<string, Force>();
    for (const f of forces) forceById.set(f.id, f);

    return {
        seed, width: WORLD_W, height: WORLD_H,
        continents, seas, prefectures, countries, cities, forces,
        cityById, prefectureById, forceById,
    };
}

// Map distance: 1 px = 5 li. On foot a cultivator covers about 48 li a day: journeys are long and scale with real distance.
export const LI_PER_PX = 5;
export const TRAVEL_LI_PER_HOUR = 2;

export function distanceLi(a: City, b: City): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) * LI_PER_PX;
}

export function travelHours(a: City, b: City): number {
    return distanceLi(a, b) / TRAVEL_LI_PER_HOUR;
}

export function formatDuration(hours: number): string {
    const totalHours = Math.ceil(hours);
    const days = Math.floor(totalHours / 24);
    const h = totalHours % 24;
    if (days >= 60) {
        const years = days / 360;
        if (years >= 1000) return `about ${(years / 1000).toFixed(1).replace(/\.0$/, '')} millennia`;
        if (years >= 10) return `about ${Math.round(years)} years`;
        if (years >= 1) return `about ${years.toFixed(1).replace(/\.0$/, '')} years`;
        const months = Math.round(days / 30);
        return `about ${months} months`;
    }
    const dd = days + (h > 0 ? 1 : 0); // round partial days up; no hours shown
    return `${Math.max(1, dd)} day${Math.max(1, dd) === 1 ? '' : 's'}`;
}
