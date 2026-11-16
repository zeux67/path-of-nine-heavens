import React, { useState } from 'react';
import type { SaveGame } from '../game/state';
import { TRIB_OK, tribBolt, act, battleActions, finishBattle, fleeChance, SPELL_QI, BATTLE_ITEMS, artifactCost, weakTo } from '../game/combat';
import { ELEMENT_ICON, affinityMult } from '../game/arts';
import { REALMS } from '../game/data';
import { artifactLevel } from '../game/gear';
import { getEco } from '../game/economy';

export function BattleScreen({ save, setSave }: { save: SaveGame; setSave: (s: SaveGame) => void }) {
    const b = save.battle!;
    const [menu, setMenu] = useState<null | 'spell' | 'tal' | 'pill'>(null);
    const A = battleActions(save);
    const go = (a: Parameters<typeof act>[1]) => { setMenu(null); setSave({ ...act(save, a), savedAt: Date.now() }); };
    const pct = (v: number, m: number) => `${Math.max(0, Math.min(100, (v / m) * 100))}%`;
    const weak = weakTo(b.foe.el);
    const st = (o: Record<string, number | boolean>) => Object.entries(o).filter(([k, v]) => typeof v === 'number' && v > 0 && k !== 'artCd').map(([k, v]) => <span className="tag" key={k}>{({ allyCd: 'ally rests', beastCd: 'beast rests' } as Record<string, string>)[k] ?? k} {v as number}</span>);
    const realm = (save.cult?.realm ?? 0);
    const items = A.items.filter(id => BATTLE_ITEMS[id] && (!b.trib || TRIB_OK.has(id)));
    const tal = items.filter(id => BATTLE_ITEMS[id].cat === 'talisman'), pills = items.filter(id => BATTLE_ITEMS[id].cat === 'pill');
    return (
        <div className="battle">
            {b.trib ? (
            <div className="bcard">
                <h3>⚡ Heavenly Tribulation</h3>
                <div className="dim">Wave {Math.min(b.waves ?? 3, Math.ceil(b.turn / 2))} of {b.waves} · bolt {Math.min(b.turn, (b.waves ?? 3) * 2)} of {(b.waves ?? 3) * 2} · next bolt about {Math.round(tribBolt(b))} · only defence works</div>
                <div className="bar ehp"><i style={{ width: pct(Math.min(b.turn - 1, (b.waves ?? 3) * 2), (b.waves ?? 3) * 2), background: '#c9a44a' }} /></div>
                <div className="dim">Survive every bolt to break through. Failure may be fatal.</div>
            </div>
            ) : (
            <div className="bcard">
                <h3>⚔️ {b.guardian ? 'Guardian' : b.trib ? 'Tribulation' : b.kind === 'duel' ? 'Duel' : b.kind === 'raid' ? `Raid ${b.wave}/${b.waves}` : 'Ambush'} · {b.foe.name}, {REALMS[b.foe.realm] ?? 'Immortal Emperor'}</h3>
                <div className="dim">{ELEMENT_ICON[b.foe.el]} {b.foe.el}{b.foe.aff === 1 ? ' (single-element, dangerous)' : ''} · {weak ? `weak to ${ELEMENT_ICON[weak]} ${weak}` : 'no weakness'} · turn {b.turn}{b.guardian ? ' · 🗿 realm guardian: defeat may be fatal, fleeing is not' : b.trib ? ' · ⚡ failure may be fatal' : b.lethal ? ' · ⚠️ lethal' : ' · defeat will not kill you'}</div>
                <div className="bar ehp"><i style={{ width: pct(b.foe.hp, b.foe.max) }} /></div>
                <div className="dim">Enemy HP {b.foe.hp}/{b.foe.max} {st(b.f)}</div>
            </div>
            )}
            <div className="bcard">
                <h3>🧘 You · {REALMS[realm]}</h3>
                <div className="bar hp"><i style={{ width: pct(b.hp, b.max) }} /></div>
                <div className="dim">HP {b.hp}/{b.max} {b.ward > 0 && <span className="tag">ward {b.ward}</span>} {st(b.p)}{b.p.dodge && <span className="tag">dodge</span>}{b.p.spark && <span className="tag">spark</span>}{b.p.guard && <span className="tag">guard</span>}</div>
                <div className="bar qi"><i style={{ width: pct(b.qi, b.maxQi) }} /></div>
                <div className="dim">Qi {b.qi}/{b.maxQi}</div>
            </div>
            <div className="bcard blog">{b.log.slice(0, 5).map((l, i) => <p key={i} style={{ opacity: 1 - i * 0.15 }}>{l}</p>)}</div>
            {b.over ? (
                <div className="bcard">
                    <p><strong>{b.over === 'win' ? '🏆 Victory' : b.over === 'flee' ? '🏃 You got away' : b.over === 'yield' ? '🏳️ You yielded' : b.lethal && b.k >= 3 ? '☠️ You have fallen' : '💢 Defeated'}</strong></p>
                    <button type="button" className="btn" onClick={() => setSave({ ...finishBattle(save), savedAt: Date.now() })}>Continue</button>
                </div>
            ) : menu === null ? (
                b.trib ? (
                <div className="bmenu">
                    <button type="button" disabled={!A.art || b.p.artCd > 0} onClick={() => go({ t: 'artifact' })}>⚜️ Barrier{A.art ? (b.p.artCd > 0 ? ` (${b.p.artCd})` : ` ${artifactCost(artifactLevel(save, A.art))}`) : ' (no artifact)'}</button>
                    <button type="button" disabled={tal.length === 0} onClick={() => setMenu('tal')}>📜 Talisman</button>
                    <button type="button" disabled={pills.length === 0} onClick={() => setMenu('pill')}>💊 Pill / herb</button>
                    <button type="button" className="s" onClick={() => go({ t: 'guard' })}>🧘 Endure{(b.p.allyCd ?? 0) > 0 ? ' (gather qi)' : ' (thin barrier)'}</button>
                </div>
                ) : (
                <div className="bmenu">
                    <button type="button" onClick={() => go({ t: 'strike' })}>🗡️ Strike</button>
                    <button type="button" disabled={A.sealed || A.spells.length === 0} onClick={() => setMenu('spell')}>✨ Technique</button>
                    <button type="button" disabled={!A.art || A.sealed || b.p.artCd > 0} onClick={() => go({ t: 'artifact' })}>⚜️ Artifact{A.art ? (b.p.artCd > 0 ? ` (${b.p.artCd})` : ` ${artifactCost(artifactLevel(save, A.art))}`) : ''}</button>
                    <button type="button" disabled={tal.length === 0} onClick={() => setMenu('tal')}>📜 Talisman</button>
                    {A.beast && <button type="button" disabled={A.beast.cd > 0} onClick={() => go({ t: 'beast' })}>🐾 {A.beast.name}{A.beast.cd > 0 ? ` (${A.beast.cd})` : ''}</button>}
                    {A.ally && <button type="button" disabled={A.ally.cd > 0} onClick={() => go({ t: 'ally' })}>💞 {A.ally.name}{A.ally.cd > 0 ? ` (${A.ally.cd})` : ''}</button>}
                    <button type="button" className="s" onClick={() => go({ t: 'guard' })}>🛡️ Guard</button>
                    <button type="button" className="s" disabled={pills.length === 0} onClick={() => setMenu('pill')}>💊 Pill</button>
                    <button type="button" className="s" disabled={!!b.trib} onClick={() => go({ t: 'flee' })}>🏃 Flee {Math.round(fleeChance(save) * 100)}%</button>
                    <button type="button" className="s" disabled={b.lethal} onClick={() => go({ t: 'yield' })}>{b.lethal ? '🤝 No mercy' : '🤝 Yield'}</button>
                </div>
                )
            ) : (
                <div className="bmenu one">
                    {menu === 'spell' && A.spells.map(sp => <button type="button" key={sp.id} disabled={b.qi < Math.round(SPELL_QI[sp.grade] * affinityMult(save.char, sp.element).cost)} onClick={() => go({ t: 'spell', id: sp.id })}>{ELEMENT_ICON[sp.element]} {sp.name} <span className="dim">{sp.kind} · {Math.round(SPELL_QI[sp.grade] * affinityMult(save.char, sp.element).cost)} qi{affinityMult(save.char, sp.element).note ? ` · ${affinityMult(save.char, sp.element).note}` : ''}</span></button>)}
                    {menu === 'tal' && tal.map(id => <button type="button" key={id} onClick={() => go({ t: 'item', id })}>{BATTLE_ITEMS[id].label} <span className="dim">x{getEco(save).items[id]}</span></button>)}
                    {menu === 'pill' && pills.map(id => <button type="button" key={id} onClick={() => go({ t: 'item', id })}>{BATTLE_ITEMS[id].label} <span className="dim">x{getEco(save).items[id]}</span></button>)}
                    <button type="button" className="s" onClick={() => setMenu(null)}>Back</button>
                </div>
            )}
        </div>
    );
}
