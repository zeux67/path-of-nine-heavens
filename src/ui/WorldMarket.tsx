import React, { useMemo, useState } from 'react';
import type { SaveGame } from '../game/state';
import type { World, City } from '../game/world';
import { travelHours, formatDuration } from '../game/world';
import { ITEMS, CAT_INFO, catOf, stockFor, scrollsFor, buyItem, buyPrice, demandTag, marketRefusal, learnScroll, getEco, itemById } from '../game/economy';
import type { ItemDef, Cat } from '../game/economy';
import { ELEMENT_ICON, GRADES, getArts, spellById, techById, learnCheck } from '../game/arts';
import { manualOf, MANUALS } from '../game/books';
import { RECIPES, realmReq, CRAFT_INFO } from '../game/craft';
import { REALMS } from '../game/data';
import { currentCult } from '../game/cultivation';

type Act = (r: { save: SaveGame; msg: string }) => void;
type Filter = 'all' | 'pills' | 'manuals' | 'arts' | Exclude<Cat, 'pills'>;
const FILTERS: [Filter, string][] = [['all', '🌐 All'], ['pills', '💊 Pills'], ['manuals', '📘 Manuals'], ['arts', '📜 Arts'], ['talismans', '🔖 Talismans'], ['materials', '🌿 Materials'], ['tools', '🏺 Tools'], ['goods', '🧳 Goods'], ['charms', '🧿 Charms']];
const TIER_WORD = ['village stalls', 'roadside stalls', 'a market town', 'a grand market'];

interface Listing { key: string; kind: 'item' | 'art'; filter: Filter; icon: string; name: string; rank: string; blurb: string; item?: ItemDef; art?: { kind: 'technique' | 'spell'; id: string }; towns: { c: City; price: number; tag: string; hours: number }[] }

export function WorldMarket({ save, world, here, act }: { save: SaveGame; world: World; here: City | null; act: Act }) {
    const [q, setQ] = useState(''); const [f, setF] = useState<Filter>('all'); const [open, setOpen] = useState<string | null>(null);
    const month = Math.floor(save.clockDays / 30);
    // Real stock, this month, in every town that would trade with you. Same functions the town market uses.
    const listings = useMemo(() => {
        const map = new Map<string, Listing>();
        const origin = here ?? world.cities[0];
        for (const c of world.cities) {
            if (c.tier === 'village' && false) continue;
            const tier = c.marketTier ?? 0;
            if (tier < 1 || marketRefusal(save, c.id, tier)) continue;
            const hours = travelHours(origin, c);
            for (const it of stockFor(save, c.id, tier)) {
                const m = manualOf(it.id);
                const key = it.id;
                let l = map.get(key);
                if (!l) { l = { key, kind: 'item', filter: m ? 'manuals' : (catOf(it.id) as Filter), icon: it.icon, name: it.name, rank: rankOf(it, m ? m.tier : undefined), blurb: it.blurb, item: it, towns: [] }; map.set(key, l); }
                l.towns.push({ c, price: buyPrice(save, c.id, it), tag: demandTag(save, c.id, it.id), hours });
            }
            for (const e of scrollsFor(save, c.id, tier)) {
                const info = e.kind === 'technique' ? techById(e.id) : spellById(e.id);
                if (!info) continue;
                const key = `art-${e.id}`;
                let l = map.get(key);
                if (!l) { l = { key, kind: 'art', filter: 'arts', icon: '📜', name: info.name, rank: `${GRADES[info.grade]} grade ${e.kind}`, blurb: `${ELEMENT_ICON[info.element]} ${e.kind === 'technique' ? 'A cultivation technique.' : 'A battle spell.'}`, art: { kind: e.kind, id: e.id }, towns: [] }; map.set(key, l); }
                l.towns.push({ c, price: e.price, tag: '', hours });
            }
        }
        for (const l of map.values()) l.towns.sort((a, b) => a.hours - b.hours);
        return [...map.values()];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [world, month, here?.id, save.char.alignment, save.cult?.realm]);
    const ql = q.trim().toLowerCase();
    const shown = listings.filter(l => (f === 'all' || l.filter === f) && (!ql || l.name.toLowerCase().includes(ql) || l.rank.toLowerCase().includes(ql))).sort((a, b) => FILTERS.findIndex(x => x[0] === a.filter) - FILTERS.findIndex(x => x[0] === b.filter) || (a.item?.rank ?? 99) - (b.item?.rank ?? 99) || (a.item?.id.startsWith('bt-') ? 1 : 0) - (b.item?.id.startsWith('bt-') ? 1 : 0) || a.name.localeCompare(b.name));
    const known = new Set(getArts(save).techniques.map(x => x.id).concat(getArts(save).spells.map(x => x.id)));
    const hereOk = here ? !marketRefusal(save, here.id, here.marketTier ?? 0) : false;
    return (
        <div className="worldmarket">
            <h3>🌐 World Market</h3>
            <p className="dim">Everything on sale across the land, this month. Stock rotates monthly and is only bought in person, so the town you stand in is the only place you can buy from now.</p>
            <input className="wm-search" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', margin: '6px 0', borderRadius: 8, border: '1px solid #3a5a52', background: '#0d1f1c', color: 'inherit', font: 'inherit' }} type="search" placeholder="Search pills, manuals, arts..." value={q} onChange={e => setQ(e.target.value)} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0 8px' }}>{FILTERS.map(([k, nm]) => <button key={k} type="button" className={`pill ${f === k ? 'on' : ''}`} style={{ flex: '0 0 auto', width: 'auto', padding: '5px 10px', fontSize: 13, display: 'inline-flex', flexDirection: 'row', gap: 4, whiteSpace: 'nowrap' }} onClick={() => setF(k)}>{nm}</button>)}</div>
            <p className="dim">{shown.length} listing{shown.length === 1 ? '' : 's'}{shown.length > 60 ? ', showing the first 60. Search or filter to narrow.' : ''}</p>
            {shown.slice(0, 60).map(l => {
                const isOpen = open === l.key, cheapest = Math.min(...l.towns.map(t => t.price)), cheapTown = l.towns.find(t => t.price === cheapest), here_ = l.towns.find(t => t.c.id === here?.id);
                const brew = l.item ? RECIPES.find(r => r.out === l.item!.id) : undefined;
                const man = l.item ? manualOf(l.item.id) : undefined;
                return (
                    <div className="row-item wm-row" key={l.key} style={{ display: 'block' }}>
                        <button type="button" className="wm-head" onClick={() => setOpen(isOpen ? null : l.key)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
                            <strong>{l.icon} {l.name}</strong> <em className="dim">{l.rank}</em>
                            <div className="dim">cheapest 💎{cheapest}{cheapTown ? ` at ${cheapTown.c.name}` : ''} · sold in {l.towns.length} town{l.towns.length === 1 ? '' : 's'}{here_ ? ' · ✅ here' : ''} {isOpen ? '▲' : '▼'}</div>
                        </button>
                        {isOpen && (
                            <div className="wm-detail">
                                <div className="dim">{l.blurb}</div>
                                {brew && <div className="dim">Brewing it needs {REALMS[brew.realm ?? realmReq(brew.level)]} realm or higher ({CRAFT_INFO[brew.craft].name} craft). Buying has no realm limit.</div>}
                                {man && <div className="dim">Making what it teaches needs {REALMS[realmReq(man.tier)]} realm. Buying has no realm limit.</div>}
                                {l.art && (() => { const k = learnCheck(save, l.art.kind, l.art.id); return <div className="dim">{known.has(l.art.id) ? 'You already know it.' : k.ok ? 'You can learn it now.' : `You cannot learn it yet: ${k.why}`} Anyone can buy it.</div>; })()}
                                <div className="dim" style={{ marginTop: 6 }}>Nearest towns that sell it (closest first):</div>
                                {l.towns.slice(0, 8).map(t => (
                                    <div className="wm-town" key={t.c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                                        <span>{t.c.id === here?.id ? '📍 ' : ''}{t.c.name} <span className="dim">· {TIER_WORD[t.c.marketTier ?? 0]} · {t.c.id === here?.id ? 'you are here' : formatDuration(t.hours) + ' away'}</span></span>
                                        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>💎{t.price}{t.tag && <em className="dim"> {t.tag}</em>}</span>
                                    </div>
                                ))}
                                {l.towns.length > 8 && <div className="dim">+ {l.towns.length - 8} farther towns (the cheapest one may be among them).</div>}
                                {here_ && hereOk && l.item && <button type="button" className="btn secondary small" onClick={() => act(buyItem(save, here!.id, l.item!))}>Buy here for {here_.price}</button>}
                                {here_ && hereOk && l.art && (known.has(l.art.id) ? <em className="dim">Known</em> : <button type="button" className="btn secondary small" onClick={() => act(learnScroll(save, here!.id, { kind: l.art!.kind, id: l.art!.id, price: here_.price }))}>Learn here for {here_.price}</button>)}
                                {!here_ && <div className="dim">Not stocked in {here?.name ?? 'this town'}. Travel to one of these towns to buy.</div>}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
function rankOf(it: ItemDef, tier?: number): string {
    if (it.rank !== undefined) return it.id.startsWith('bt-') ? `Rank ${it.rank} breakthrough pill (out of ${REALMS[it.rank]})` : `Rank ${it.rank} cultivation pill (${REALMS[it.rank]})`;
    if (tier !== undefined) return tier <= 0 ? 'Basic manual' : `Rank ${tier + 1} manual`;
    return ['Common', 'Common', 'Fine', 'Rare'][Math.min(3, it.minMarket)] ?? 'Rare';
}
