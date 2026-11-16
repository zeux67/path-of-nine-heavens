import React, { useState } from 'react';
import type { SaveGame } from '../game/state';
import { hdTrial, hdChance, hdResolveStep, hdDone, hdNeed, karmaWord, karmaOf } from '../game/karma';
import { finishHeartDemon } from '../game/cultivation';
import { startTribulation } from '../game/combat';
import { REALMS } from '../game/data';

const WAYS = [['face', '🪷'], ['resist', '🛡️'], ['embrace', '🌑']] as const;

export function HeartDemonScreen({ save, setSave }: { save: SaveGame; setSave: (s: SaveGame) => void }) {
    const hd = save.hd!;
    const [res, setRes] = useState<{ text: string; won: boolean } | null>(null);
    const t = hdTrial(save, hd);
    const done = hdDone(hd);
    const next = () => {
        if (!done) { setRes(null); return; }
        const r = finishHeartDemon(save);
        setSave({ ...(r.lightning ? startTribulation(r.save) : r.save), savedAt: Date.now() });
    };
    return (
        <div className="battle evscreen hdscreen">
            <div className="bcard">
                <h3>🌑 Heart-demon tribulation</h3>
                <p className="dim">Breaking into {REALMS[hd.realm]}. No item, pill or talisman helps here. Only who you have been. There are {hd.ids.length} trials. You must pass at least {hdNeed(hd)} of them, so one stumble is forgiven. Pass them and the breakthrough goes on. Fail and your cultivation is hurt.</p>
                <div className="dim">⚖️ Karma: {karmaWord(save)} ({karmaOf(save)}) · Trials passed: {hd.passes} · failed: {hd.fails}</div>
            </div>
            {!done && t && !res && (
                <>
                    <div className="bcard">
                        <h3>{t.icon} {t.title} <span className="dim">({t.n} of {t.of})</span></h3>
                        <p>{t.text}</p>
                    </div>
                    <div className="bmenu one evchoices">
                        {WAYS.map(([w, ic]) => (
                            <button type="button" key={w} onClick={() => {
                                const r = hdResolveStep(save, hd, w);
                                setSave({ ...r.save, hd: r.hd });
                                setRes({ text: r.text, won: r.won });
                            }}>
                                {ic} {t[w]}
                                <span className="dim"> · {Math.round(hdChance(save, hd, w) * 100)}% chance you pass it</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
            {(res || done) && (
                <div className="bcard">
                    {res && <p>{res.won ? '✅ ' : '❌ '}{res.text}</p>}
                    {done && <p><strong>{hd.passes >= hdNeed(hd) ? 'You passed the trials.' : 'You failed the trials.'}</strong></p>}
                    <div className="bmenu one"><button type="button" onClick={next}>{done ? (hd.passes >= hdNeed(hd) ? 'Continue' : 'Wake') : 'Next trial'}</button></div>
                </div>
            )}
        </div>
    );
}
