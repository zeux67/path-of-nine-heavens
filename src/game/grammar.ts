// "a" or "an" before a name, so "an Iron Ore" and "a Pill" read right.
export const A = (w: string | undefined): string => { const x = w ?? ''; return (/^(hour|honest|heir)/i.test(x) ? 'an ' : /^[aeiou]/i.test(x) ? 'an ' : 'a ') + x; };
