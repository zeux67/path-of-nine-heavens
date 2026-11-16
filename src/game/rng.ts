// Deterministic RNG utilities. The whole world regenerates from one seed,
// so the saved game only stores the seed, not the world.

export function hashSeed(str: string): number {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export type Rng = () => number;

export function pick<T>(rng: Rng, arr: T[]): T {
    return arr[Math.floor(rng() * arr.length)];
}

export function randInt(rng: Rng, min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1));
}

export function pickWeighted<T>(rng: Rng, items: { value: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let roll = rng() * total;
    for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) return item.value;
    }
    return items[items.length - 1].value;
}

// Roughly bell-shaped 1..100 for luck: average of three rolls.
export function rollLuck(rng: Rng): number {
    return Math.round(((rng() + rng() + rng()) / 3) * 99) + 1;
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
