import React from 'react';
import type { SaveGame } from '../game/state';
import type { City } from '../game/world';
import { stockFor, buyItem, buyPrice, getEco, itemById, marketRefusal } from '../game/economy';
import { useItem } from '../game/craft';
import { manualOf } from '../game/books';

type Act = (r: { save: SaveGame; msg: string }) => void;
// The only way to study from a book: own the manual (bought from a market that really stocks it), then read it.
export function ManualBtn({ save, here, target, act }: { save: SaveGame; here: City | null; target: string; act: Act }) {
    const id = `book-${target}`, m = manualOf(id);
    if (!m) return null;
    const have = getEco(save).items[id] ?? 0;
    const btn = (label: string, onClick: () => void) => <button type="button" className="btn secondary small" onClick={onClick}>{label}</button>;
    if (have > 0) return btn(`📘 Read manual (${m.days}d)`, () => act(useItem(save, id)));
    const it = itemById(id);
    const stocked = here && it && !marketRefusal(save, here.id, here.marketTier) && stockFor(save, here.id, here.marketTier).some(x => x.id === id);
    if (stocked && it && here) return btn(`📘 Buy manual 💎${buyPrice(save, here.id, it)}`, () => act(buyItem(save, here.id, it)));
    return <span className="dim">📘 Manual not sold here. See the World tab.</span>;
}
