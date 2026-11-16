import React, { useState } from 'react';
import type { SaveGame } from '../game/state';
import type { World } from '../game/world';
import { pendingOf, render, resolveEvent, choiceChance, canChoose, fillChoice, stakesUnit } from '../game/events';
import { getEco } from '../game/economy';

const RISK = { safe: '', risky: 'risky', deadly: 'deadly' } as const;

export function EventScreen({ world, save, setSave }: { world: World; save: SaveGame; setSave: (s: SaveGame) => void }) {
    const p = pendingOf(save)[0];
    const [res, setRes] = useState<{ save: SaveGame; text: string } | null>(null);
    const r = render(save, world, p);
    if (!r) { setSave({ ...save, evq: pendingOf(save).slice(1) } as SaveGame); return null; }
    const unit = stakesUnit(save);
    const more = pendingOf(save).length - 1;
    return (
        <div className="battle evscreen">
            <div className="bcard">
                <h3>{r.core.icon} {r.core.title}</h3>
                <p>{r.text}</p>
                <div className="dim">🪙 {getEco(save).stones} stones{more > 0 ? ` · ${more} more waiting` : ''}</div>
            </div>
            {res ? (
                <div className="bcard">
                    <p>{res.text}</p>
                    <div className="bmenu one"><button type="button" onClick={() => setSave({ ...res.save, savedAt: Date.now() })}>Continue</button></div>
                </div>
            ) : (
                <div className="bmenu one evchoices">
                    {r.core.choices.map((ch, i) => {
                        const ok = canChoose(save, ch);
                        const chance = ch.check !== undefined ? ` · ${Math.round(choiceChance(save, ch) * 100)}%` : '';
                        return (
                            <button type="button" key={i} disabled={!ok} className={RISK[ch.risk ?? 'safe']}
                                onClick={() => setRes(resolveEvent(save, world, p, i))}>
                                {fillChoice(save, world, p, ch.label)}
                                <span className="dim"> {ch.cost ? ` · costs ${Math.round(ch.cost * unit)} 🪙` : ''}{ch.risk === 'risky' ? ' · ⚠️ risky' : ch.risk === 'deadly' ? ' · ☠️ deadly' : ''}{chance}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
