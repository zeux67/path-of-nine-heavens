import React, { useState } from 'react';
import type { SaveGame } from '../game/state';
import type { World } from '../game/world';
import { SECL_PRESETS, DAYS_PER_YEAR, canSeclude, lifeLeftDays, projectSeclusion, runSeclusion } from '../game/seclusion';
import type { SeclReport } from '../game/seclusion';

const fmt = (d: number) => d >= DAYS_PER_YEAR ? (() => { const y = Math.round((d / DAYS_PER_YEAR) * 10) / 10; return `${y} ${y === 1 ? 'year' : 'years'}`; })() : d >= 30 ? `${Math.round(d / 30)} months` : `${Math.round(d)} days`;

export function SeclusionCard({ world, save, setSave }: { world: World; save: SaveGame; setSave: (s: SaveGame) => void }) {
    const [days, setDays] = useState(DAYS_PER_YEAR);
    const [years, setYears] = useState('');
    const can = canSeclude(save);
    const left = lifeLeftDays(save);
    const capped = Math.max(1, Math.min(days, Math.floor(left)));
    const proj = can.ok ? projectSeclusion(save, capped) : null;
    const [busy, setBusy] = useState(false);
    return (
        <details className="kin-acts secl-card">
            <summary>🚪 Closed-door seclusion</summary>
            <p className="dim">Seal the door and cultivate for a span you choose. The world keeps moving without you. No chance events while you are inside. You get a report when you come out.</p>
            {!can.ok ? <p className="risk hot">{can.why}</p> : (
                <>
                    <div className="btnrow wrap">
                        {SECL_PRESETS.map(p => (
                            <button type="button" key={p.days} className={`btn small ${capped === p.days ? 'primary' : 'secondary'}`} disabled={p.days > left} onClick={() => { setDays(p.days); setYears(''); }}>{p.label}</button>
                        ))}
                    </div>
                    <label className="secl-free dim">Or years: <input type="number" min={1} max={Math.floor(left / DAYS_PER_YEAR)} value={years} placeholder="e.g. 3" onChange={e => { setYears(e.target.value); const n = Math.floor(Number(e.target.value)); if (n > 0) setDays(n * DAYS_PER_YEAR); }} /></label>
                    <div className="bcard secl-proj">
                        <h3>If you seclude for {fmt(capped)}</h3>
                        {proj && <>
                            <p>Expected: <strong>{proj.label}</strong>{proj.gate ? <span> - a breakthrough gate will stop you there</span> : null}</p>
                            <p className="dim">Age after: {proj.ageAfter}. Lifespan left after: {proj.oldAge ? 'none - you may die of old age' : `about ${proj.leftAfter} years`}.</p>
                            {proj.gate && proj.reachedDays < capped && <p className="dim">You would leave after about {fmt(proj.reachedDays)}.</p>}
                        </>}
                        {days > left && <p className="dim">Capped to your remaining lifespan ({fmt(left)}).</p>}
                        <p className="dim">Seclusion ends early if you reach a breakthrough gate, your years run low, or danger finds you. Death is still possible.</p>
                    </div>
                    <button type="button" className="btn primary" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { setSave(runSeclusion(world, save, capped)); setBusy(false); }, 30); }}>{busy ? 'In seclusion...' : `🚪 Begin seclusion (${fmt(capped)})`}</button>
                </>
            )}
        </details>
    );
}

function Section({ icon, title, items, open }: { icon: string; title: string; items: string[]; open?: boolean }) {
    if (!items.length) return null;
    return (
        <details className="secl-sec" open={open}>
            <summary>{icon} {title} <span className="dim">({items.length})</span></summary>
            <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </details>
    );
}

export function SeclusionReport({ report, onClose, onJournal }: { report: SeclReport; onClose: () => void; onJournal: () => void }) {
    const r = report;
    return (
        <div className="battle evscreen secl-report">
            <div className="bcard">
                <h3>{r.kind === 'realm' ? `${r.place ?? 'Secret realm'}: you step out` : '🚪 You step out of seclusion'}</h3>
                <p>{r.stop}</p>
                <p className="dim">{fmt(r.days)} {r.kind === 'realm' ? 'inside' : 'passed'}{r.days < r.planned && r.kind !== 'realm' ? ` (planned ${fmt(r.planned)})` : ''}. Age {r.age}{r.died ? '' : `, about ${r.left} years left`}.</p>
            </div>
            <div className="bcard">
                <h3>🧘 You</h3>
                <p>{r.before} <span className="dim">to</span> <strong>{r.after}</strong></p>
                <p className="dim">🪙 Stones {r.stones >= 0 ? '+' : ''}{Math.round(r.stones)}</p>
                {r.gained && r.gained.length > 0 && <p>🎁 Brought out: {r.gained.join(', ')}</p>}
                {r.you.length > 0 && <ul>{r.you.map((t, i) => <li key={i}>{t}</li>)}</ul>}
            </div>
            <div className="bcard secl-secs">
                <Section icon="👪" title="People" items={r.people} open />
                <Section icon="🏯" title="Sect and clan" items={r.sect} />
                <Section icon="🌏" title="World" items={r.world} open />
                <Section icon="☠️" title="Danger and losses" items={r.danger} />
                <Section icon="🏪" title="Market" items={r.market ?? []} />
                {!r.people.length && !r.sect.length && !r.world.length && !r.danger.length && !(r.market ?? []).length && <p className="dim">Nothing worth reporting reached you.</p>}
            </div>
            <div className="bmenu">
                <button type="button" className="s" onClick={onJournal}>📖 Full journal</button>
                <button type="button" onClick={onClose}>{r.died ? 'Continue' : 'Back to the world'}</button>
            </div>
        </div>
    );
}
