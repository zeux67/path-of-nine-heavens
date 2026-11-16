import { familyTick } from './game/family';
import { householdTick } from './game/people';
import { BattleScreen } from './ui/Battle';
import { EventScreen } from './ui/EventScreen';
import { eventTick, pendingOf } from './game/events';
import { startGuardian } from './game/combat';
import { setWealthWorld } from './game/wealth';
import { setSectWorld } from './game/sect';
import { setEconWorld } from './game/economy';
import { resolveRoad, resolveCalamity, resolveRivals } from './game/danger';
import { newsBetween, newsItems } from './game/living';
import { extendLineage, type Lineage } from './game/fate';
import { applyCultivationStep } from './game/cultivation';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocalState } from './storage';
import { WORLD_SEED, generateWorld, formatDuration } from './game/world';
import {
    Character, GAME_HOURS_PER_REAL_SECOND, OFFLINE_SPEEDS, SAVE_KEY, SAVE_BACKUP_KEY, SAVE_SCHEMA, SPEEDS, SaveGame,
    rollCharacter,
} from './game/state';
import { mulberry32 } from './game/rng';
import { migrateSave, looksValid } from './game/migrate';
import './game/books';
import { Creation, makeSave } from './ui/Creation';
import { Game } from './ui/Game';
import { SeclusionReport } from './ui/Seclusion';
import { HeartDemonScreen } from './ui/HeartDemon';
import { runSeclusion, realmExitReport } from './game/seclusion';
import { nav } from './game/nav';
import { PrefsCtx, DEFAULT_PREFS, PREFS_KEY, shellClass, Prefs } from './ui/prefs';

const DEMO_DEFAULT = false;

function DemoGame({ world, char }: { world: ReturnType<typeof generateWorld>; char: Character }) {
    const [s, setS] = useState<SaveGame>(() => {
        const base = makeSave(world, char);
        const ev = typeof window !== 'undefined' ? /[?&]evdemo=([\w-]+)/.exec(window.location?.search ?? '')?.[1] : null;
        const sd = typeof window !== 'undefined' ? /[?&]secldemo=(\d+)/.exec(window.location?.search ?? '')?.[1] : null;
        if (sd) return runSeclusion(world, { ...base, clockDays: 360 * 3 }, Number(sd) * 360);
        return ev ? { ...base, evq: [{ id: ev, seed: 12345 }] } : base;
    });
    return s.battle ? <BattleScreen save={s} setSave={setS} /> : s.hd ? <HeartDemonScreen save={s} setSave={setS} /> : s.seclReport ? <SeclusionReport report={s.seclReport} onClose={() => setS({ ...s, seclReport: null })} onJournal={() => { nav.tab = 'journal'; setS({ ...s, seclReport: null }); }} /> : pendingOf(s).length ? <EventScreen world={world} save={s} setSave={setS} /> : <Game world={world} save={s} setSave={setS} onAbandon={() => undefined} />;
}

import { SPLASH_ART } from './ui/splashArt';

function Splash({ onDone }: { onDone: () => void }) {
    useEffect(() => { const id = setTimeout(onDone, 2400); return () => clearTimeout(id); }, [onDone]);
    return (
        <button type="button" className="splash" onClick={onDone} aria-label="Skip intro">
            <img className="splash-art" src={SPLASH_ART} alt="" />
            <span className="splash-title">Path of<br />Nine Heavens</span>
            <span className="splash-studio">SV Games</span>
            <span className="splash-dev">by ZEUX</span>
            <span className="splash-tap">Tap to begin</span>
        </button>
    );
}

export function App() {
    const [splash, setSplash] = useState(true);
    const [prefs, setPrefsRaw] = useLocalState<Prefs>(PREFS_KEY, DEFAULT_PREFS);
    const prefsCtx = { prefs, set: (p: Partial<Prefs>) => setPrefsRaw({ ...prefs, ...p }) };
    const [rawSave, setRawSave, saved] = useLocalState<SaveGame | null>(SAVE_KEY, null);
    const [backup, setBackup] = useLocalState<{ at: number; save: SaveGame } | null>(SAVE_BACKUP_KEY, null);
    // Old saves are upgraded in memory on read; unknown fields stay. A save that looks broken is never touched.
    const saveMig = useMemo(() => migrateSave(rawSave), [rawSave]);
    // Live copy of the life: the clock ticks here every second; the device write is throttled.
    const [live, setLive] = useState<SaveGame | null | undefined>(undefined);
    const lastPersist = useRef(0);
    const save = live !== undefined ? live : saveMig;
    const broken = saved.ready && rawSave != null && !looksValid(rawSave);
    const setSaveRaw = (s: SaveGame | null, persist = true) => {
        if (broken) return;
        if (s && !(typeof s.schema === 'number' && s.schema >= SAVE_SCHEMA)) s = { ...s, schema: SAVE_SCHEMA, wroteBy: SAVE_SCHEMA };
        setLive(s);
        if (!persist) return;
        lastPersist.current = Date.now();
        setRawSave(s);
        try { (window as any).__nhLastSave = s ? JSON.stringify(s) : null; } catch { /* ignore */ }
        // Safety copy of the last good life, at most once an hour.
        if (s && looksValid(s) && (!backup || Date.now() - backup.at > 3600_000)) setBackup({ at: Date.now(), save: s });
    };
    const [lineage, setLineage] = useLocalState<Lineage | null>('nh.lineage.v1', null);

    // ONE persistent world: every life is born into the same map.
    const world = useMemo(() => { const w = generateWorld(WORLD_SEED); setEconWorld(w); setWealthWorld(w); setSectWorld(w); return w; }, []);
    const firstRoll = useMemo(
        () => rollCharacter(mulberry32(Math.floor(Math.random() * 2 ** 31)), world, {}, null),
        [world],
    );
    const [rolledChar, setDraftChar] = useState<Character | null>(null);
    const draftChar = rolledChar ?? firstRoll;

    // A death passes the line on: a descendant born near where the ancestor fell, carrying the family name.
    const reincarnate = (childGiven?: string) => {
        if (!saved.ready || !save?.dead) return;
        const next = extendLineage(null, save, save.dead);
        const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
        let c = rollCharacter(rng, world, {}, null);
        if (!c.affiliation) {
            c = { ...c, surname: save.char.surname };
            if (world.cityById.get(save.locationId)) c = { ...c, birthplaceId: save.locationId };
        }
        if (childGiven && !c.affiliation) c = { ...c, given: childGiven };
        setLineage(next);
        setDraftChar(c);
        setSaveRaw(null);
    };

    const setSave = (s: SaveGame | null) => { if (saved.ready) setSaveRaw(s); };

    // Time spent away (cold start or a backgrounded app): one catch-up that respects the offline setting.
    const applyAway = (save: SaveGame, elapsedSec: number): SaveGame => {
        const hours = elapsedSec * 1 * OFFLINE_SPEEDS[save.offlineSpeed];
        const days = hours / 24;
        let next: SaveGame = { ...save, clockDays: save.clockDays + days, savedAt: Date.now() };
        next = applyCultivationStep(save, days, Boolean(save.membership));
        next = { ...next, clockDays: next.dead ? next.dead.atDays : save.clockDays + days, savedAt: Date.now() };
        let msg = `While you were away, ${formatDuration(hours)} passed in the world.`;
        if (!next.dead && next.travel && next.clockDays >= next.travel.arriveDays) {
            const dest = world.cityById.get(next.travel.toId);
            const src = world.cityById.get(next.travel.fromId);
            const trv = next.travel;
            if (src && dest) next = resolveRoad(world, next, src, dest);
            if (!next.dead) { next.locationId = trv.toId; next.travel = null; }
            msg += ` You arrived at ${dest?.name ?? 'your destination'}.`;
        }
        if (!next.dead && !next.travel) next = resolveCalamity(world, next, save.clockDays, next.clockDays);
        if (!next.dead && !next.travel) next = resolveRivals(world, next, save.clockDays, next.clockDays);
        if (!next.dead) next = familyTick(next, save.clockDays, next.clockDays);
        if (!next.dead) next = householdTick(next, save.clockDays, next.clockDays);
        if (!next.dead) next = eventTick(world, next, save.clockDays, next.clockDays);
        if (!next.dead) { const n = newsBetween(world, next, save.clockDays, next.clockDays); if (n.length) next.log = [...n.slice().reverse(), ...next.log].slice(0, 30); const ni = newsItems(world, next, save.clockDays, next.clockDays); if (ni.length) next.news = [...ni.slice().reverse(), ...(next.news ?? [])].slice(0, 80); }
        next.log = [msg, ...next.log].slice(0, 30);
        if (save.exp && !next.exp && !next.battle) next = { ...next, seclReport: realmExitReport(world, save, next) };
        return next;
    };

    // One-time offline accrual when a save loads.
    const offlineApplied = useRef(false);
    useEffect(() => {
        if (!saved.ready || offlineApplied.current || !save) return;
        offlineApplied.current = true;
        const elapsedSec = Math.max(0, (Date.now() - save.savedAt) / 1000);
        if (elapsedSec < 30) { setSaveRaw({ ...save, savedAt: Date.now() }); return; }
        if (!save.offlineEnabled) { setSaveRaw({ ...save, savedAt: Date.now() }); return; }
        // Same freeze as the running clock: a fight, heart demon, report, pending event or a death waits for the player.
        if (save.dead || save.battle || save.hd || save.seclReport || pendingOf(save).length) { setSaveRaw({ ...save, savedAt: Date.now() }); return; }
        setSaveRaw(applyAway(save, elapsedSec));
    }, [saved.ready]);

    // Live ticking: game time advances with real time at the chosen speed.
    const saveRef = useRef(save);
    saveRef.current = save;
    const lastTick = useRef(Date.now());
    useEffect(() => {
        if (!save) return;
        lastTick.current = Date.now();
        const id = setInterval(() => {
            const now = Date.now();
            const dtSec = (now - lastTick.current) / 1000;
            lastTick.current = now;
            const cur = saveRef.current;
            if (!cur || cur.paused || cur.dead || cur.battle || cur.seclReport || cur.hd || pendingOf(cur).length) return;
            // A backgrounded app resumes with a big gap: never replay it at live speed.
            if (dtSec > 5) { setSaveRaw(cur.offlineEnabled ? applyAway(cur, dtSec) : { ...cur, savedAt: now }); return; }
            const days = (dtSec * GAME_HOURS_PER_REAL_SECOND * SPEEDS[cur.speed]) / 24;
            let next: SaveGame = applyCultivationStep(cur, days, Boolean(cur.membership));
            next = { ...next, clockDays: next.dead ? next.dead.atDays : cur.clockDays + days, savedAt: now };
            if (!next.dead && !next.travel) next = resolveCalamity(world, next, cur.clockDays, next.clockDays);
            if (!next.dead && !next.travel) next = resolveRivals(world, next, cur.clockDays, next.clockDays);
            if (!next.dead) next = familyTick(next, cur.clockDays, next.clockDays);
            if (!next.dead) next = householdTick(next, cur.clockDays, next.clockDays);
            if (!next.dead) next = eventTick(world, next, cur.clockDays, next.clockDays);
            if (!next.dead) { const n = newsBetween(world, next, cur.clockDays, next.clockDays); if (n.length) next.log = [...n.slice().reverse(), ...next.log].slice(0, 30); const ni = newsItems(world, next, cur.clockDays, next.clockDays); if (ni.length) next.news = [...ni.slice().reverse(), ...(next.news ?? [])].slice(0, 80); }
            if (!next.dead && next.travel && next.clockDays >= next.travel.arriveDays) {
                const dest = world.cityById.get(next.travel.toId);
                const src = world.cityById.get(next.travel.fromId);
                const trv = next.travel;
                if (src && dest) next = resolveRoad(world, next, src, dest);
                if (!next.dead) { next.locationId = trv.toId; next.travel = null; }
                next.log = [`You arrived at ${dest?.name ?? 'your destination'}.`, ...next.log].slice(0, 30);
            }
            if (cur.exp && !next.exp && !next.battle) next = { ...next, seclReport: realmExitReport(world, cur, next) };
            if (!next.dead && !next.battle && next.exp?.guard === 'pending') next = startGuardian(next);
            setSaveRaw(next, now - lastPersist.current >= 10_000);
        }, 1000);
        return () => clearInterval(id);
    }, [Boolean(save), world]);

    // Flush the throttled write when the app is hidden or closed.
    useEffect(() => {
        const flush = () => { const c = saveRef.current; if (c && !broken && live !== undefined) { lastPersist.current = Date.now(); setRawSave({ ...c, savedAt: Date.now() }); } };
        const vis = () => { if (document.visibilityState === 'hidden') flush(); };
        document.addEventListener('visibilitychange', vis);
        window.addEventListener('pagehide', flush);
        return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', flush); };
    });

    // Demo mode for visual checks: renders the game screen without a save.
    const isDemo = DEMO_DEFAULT || (typeof window !== 'undefined' && /[?&]demo=1/.test(window.location?.search ?? ''));
    if (!save && isDemo) {
        return (
            <PrefsCtx.Provider value={prefsCtx}><>
                <div className={shellClass(prefs)}>
                    <DemoGame world={world} char={draftChar} />
                </div>
            </></PrefsCtx.Provider>
        );
    }

    if (splash) return <PrefsCtx.Provider value={prefsCtx}><><div className={shellClass(prefs)}><Splash onDone={() => setSplash(false)} /></div></></PrefsCtx.Provider>;

    if (broken) {
        return (
            <PrefsCtx.Provider value={prefsCtx}><><div className={shellClass(prefs)}><div className="panel">
                <h3>This save could not be read</h3>
                <p className="dim">Your saved life is untouched on this device - nothing was overwritten. It may come from a much newer version. {backup ? 'A safety copy from this device is available.' : ''}</p>
                {backup && <button type="button" className="btn" onClick={() => setRawSave(backup.save)}>Restore the safety copy</button>}
                <button type="button" className="btn secondary" onClick={() => { try { void navigator.clipboard?.writeText(JSON.stringify(rawSave)); } catch { /* ignore */ } }}>Copy the raw save</button>
            </div></div></></PrefsCtx.Provider>
        );
    }

    return (
        <PrefsCtx.Provider value={prefsCtx}><>
            <div className={shellClass(prefs)}>
                {!save ? (
                    draftChar ? (
                        <Creation
                            world={world}
                            char={draftChar}
                            setChar={setDraftChar}
                            lineage={lineage}
                            onBegin={() => setSave(makeSave(world, draftChar, lineage))}
                        />
                    ) : (
                        <div className="loading">Consulting the heavens…</div>
                    )
                ) : save.battle ? (
                    <BattleScreen save={save} setSave={setSave} />
                ) : !save.dead && save.hd ? (
                    <HeartDemonScreen save={save} setSave={setSave} />
                ) : !save.dead && save.seclReport ? (
                    <SeclusionReport report={save.seclReport} onClose={() => setSave({ ...save, seclReport: null })} onJournal={() => { const t = 'journal'; setSave({ ...save, seclReport: null }); nav.tab = t; }} />
                ) : !save.dead && pendingOf(save).length ? (
                    <EventScreen world={world} save={save} setSave={setSave} />
                ) : (
                    <Game
                        world={world}
                        save={save}
                        setSave={setSave}
                        backup={backup}
                        onRestore={(s: SaveGame) => { if (saved.ready) { setBackup({ at: Date.now(), save: save as SaveGame }); setRawSave({ ...s, savedAt: Date.now() }); setLive(undefined); } }}
                        onAbandon={() => { if (saved.ready) { setLineage(null); setSaveRaw(null); } }}
                        onReincarnate={reincarnate}
                    />
                )}
            </div>
        </></PrefsCtx.Provider>
    );
}
