import { GAME_VERSION } from '../game/version';
import { getSect, foundSect, foundVerdict, FOUND_COST, FOUND_REALM, BUILDINGS, MAX_BUILD, buildCost, upgradeBuilding, depositTreasury, cap, expertCeiling, EXPERT_COST, inviteExpert, helpElders, makePeace, declareWar, rivalsNear, sectStrength, sectRank } from '../game/sect';
import { claimDuty, getDuty, dutyBoard, takeDuty, fellowsOf, relOf, relWord, TEMPER_INFO, chatFellow, giftFellow, sparFellow, askHelp, mealFellow, studyFellow } from '../game/duties';
import { rosterCount } from '../game/war';
import { ACTS, marry, haveChild, interact, relAge, relLabel, relLifespan, BIRTH_LABEL } from '../game/family';
import { powerAt, strengthBefore } from '../game/war';
import { counterScheme, PEACE_COST, roadRisk, regionDanger, REGION_WORDS, beastTerritory } from '../game/danger';
import { rumorsAt, fortuneState, swayState, seasonOf, SEASON_ICON } from '../game/living';
import { CAUSE_LABEL, lifespanYears, ageAt, extendLineage, inheritance } from '../game/fate';
import {
    ELEMENT_ICON, GRADES, LibraryEntry, MASTERY_TIERS, MAX_SPELLS, MAX_TECHNIQUES, getArts, learnCheck, libraryFor,
    masteryOf, spellById, talentFor, techById, techniqueMult, ArtsState, LearnedArt,
  techniqueSpeed, affinityMult,
} from '../game/arts';
import { heavenWord, heavenMul, ceilingRealm, attemptBreakthrough, breakthroughChance, canPromote, cultivationRate, currentCult, nextRank, promote, sectRankIndex, SECT_RANKS, stageCost, stageLabel, STAGES_PER_REALM, tribulationWaves, tribulationOdds, deathRisk } from '../game/cultivation';
import { SLOTS, GRADES, GRADE_REALM, gearBag, equipped, equip, unequip, fxText, fmtFx, canWear, gearStall, buyGear, sellGear, gearPrice, gearEffect, wearingSummary, artifactLevel } from '../game/gear';
import type { GearItem } from '../game/gear';
import { FUNDS, invest, withdraw, fundValue, getWealth, HOME_NAMES, HOME_COST, ASSETS, assetCost, MAX_ASSET, buyHome, upgradeHome, buyAsset, yearlyIncome, CHAMBER_COST, CHAMBER_UP, GUARD_NAMES, GUARD_WAGE, maxRoutes, routeInfo, foundChamber, upgradeChamber, routeBuildCost, addRoute, hireGuard, dismissGuard, sectBoard, sharesOf, buyShares, sellShares, holdingsValue, DIVIDEND, auctionLots, reserve, bidLot } from '../game/wealth';
import { mountCut } from '../game/craftx';
import { karmaWord, karmaOf, heartDemonAt, hdTrials } from '../game/karma';
import { startTribulation, startBattle, duelSpec, RAIDS, raidSpec } from '../game/combat';
import { sectLifeOf, eventOfSeason, joinEvent, MERIT, buyMerit } from '../game/sectlife';
import { exportSave, importSave } from '../game/migrate';
import { exportSave, importSave } from '../game/migrate';
import { usePrefs, useSetPrefs } from './prefs';
import { SeclusionCard } from './Seclusion';
import { nav } from '../game/nav';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CraftDepthPanel } from './CraftDepth';
import { knows, studying, studyDays, bookFee, CRAFT_INFO, RECIPES, SKILL_NAMES, USABLE, craftIt, getCraft, learnRecipe, missing, recipeChance, skillLevel, useItem } from '../game/craft';
import type { CraftId } from '../game/craft';
import { CAT_INFO, WEARABLE, catOf, isWorn, shockAt, wearToggle } from '../game/economy';
import type { Cat } from '../game/economy';
import { instruct, graduateToSect, DISCIPLE_FEE, MAX_DISCIPLES, DUAL_COOLDOWN, dismissDisciple, discipleTribute, dualCultivate, inviteCompanion, takeDisciple, SWORN_AT } from '../game/people';
import { FAVOUR_AT, GIFT, ROLE_INFO, askFavour, bondOf, bondWord, chat, gift, peopleIn, shareWine, swapPointers } from '../game/people';
import { questsOf, questProgress, questReady, claimQuest, dropQuest, settleQuests, familyAsk } from '../game/quests';
import { activeGoals, goalReady, claimGoal, goalsDone, GOALS } from '../game/goals';
import { VENTURES, startVenture, ventureLeft, riskWord, canVenture } from '../game/ventures';
import type { VentureKind } from '../game/ventures';
import { acceptJob, boardFor, dropJob, finishJob, getJobs, jobStatus, repTitle } from '../game/jobs';
import '../game/books'
import { pillRankOf } from '../game/pills'
import { WorldMarket } from './WorldMarket'
import { ManualBtn } from './ManualBtn'
import { depthFactor, demandTag, stockFor, marketRefusal, DANGER, ITEMS, buyItem, buyPrice, enterRealm, getEco, itemById, realmDeathRisk, realmTrapRisk, learnScroll, realmHere, scrollsFor, sellItem, sellPrice, usePill } from '../game/economy';
import { ROOT_AVATARS, BIRTHPLACE_LABEL, MARKET_TIERS, REALMS } from '../game/data';
import {
    ATTR_LABELS, AttrKey, OFFLINE_SPEEDS, SPEEDS, SaveGame, ageYears, describeAttr, forceAlignment, formatClock, joinVerdict,
} from '../game/state';
import { City, Force, World, pointInPolygon, distanceLi, formatDuration, travelHours } from '../game/world';
import { MapView } from './MapView';

interface Props {
    world: World;
    save: SaveGame;
    setSave: (s: SaveGame) => void;
    onAbandon: () => void;
    onReincarnate?: (child?: string) => void;
    initialTab?: Tab;
    backup?: { at: number; save: SaveGame } | null;
    onRestore?: (s: SaveGame) => void;
}

let hintSeen = false;
type Tab = 'home' | 'journal' | 'profile' | 'arts' | 'map' | 'news' | 'family' | 'force' | 'bag' | 'settings' | 'gear' | 'wealth';
const ATTRS: AttrKey[] = ['name', 'birthplace', 'affiliation', 'root', 'constitution', 'fate', 'luck', 'comprehension', 'alignment'];

const wornLabel = (s: SaveGame, id: string) => (isWorn(s, id) ? 'Remove' : 'Wear');
const PACK_ORDER: Cat[] = ['pills', 'talismans', 'materials', 'goods', 'tools', 'charms'];

const relName = (s: string) => /(father|mother)'s father$/i.test(s) ? 'Grandfather' : /(father|mother)'s mother$/i.test(s) ? 'Grandmother' : s;
const relTerm = (r: { rel: string; sex?: 'm' | 'f' }, g?: 'male' | 'female') => r.rel === 'Spouse' ? ((g ?? 'male') === 'male' ? 'Wife' : 'Husband') : r.rel === 'Child' ? (r.sex === 'f' ? 'Daughter' : r.sex === 'm' ? 'Son' : 'Child') : relName(r.rel);
const rankByPower = (world: World, save: SaveGame, fs: Force[]): { f: Force; rank: number; power: number; arrow: '▲' | '▼' | '▬'; trend: 'rising' | 'falling' | 'steady' }[] => {
    const yr = Math.floor(save.clockDays / 360);
    const st = powerAt(world, yr);
    const old = strengthBefore(world, yr, 5);
    const order = (tbl: Record<string, number>) => { const m = new Map<string, number>(); fs.map(f => ({ id: f.id, s: tbl[f.id] ?? 0 })).sort((a, b) => b.s - a.s).forEach((x, i) => m.set(x.id, i + 1)); return m; };
    const before = old ? order(old) : null;
    return fs.map(f => ({ f, power: Math.round(st.strength[f.id] ?? 0) })).sort((a, b) => b.power - a.power).map((x, i) => {
        const was = before?.get(x.f.id) ?? i + 1;
        const d = was - (i + 1);
        return { ...x, rank: i + 1, arrow: d > 0 ? '▲' as const : d < 0 ? '▼' as const : '▬' as const, trend: d > 0 ? 'rising' as const : d < 0 ? 'falling' as const : 'steady' as const };
    });
};
const contPrefCache = new WeakMap<World, Map<string, ReturnType<World['prefectures']['filter']>>>();
const prefsInContinent = (w: World, id: string, make: () => World['prefectures']) => {
    let m = contPrefCache.get(w); if (!m) { m = new Map(); contPrefCache.set(w, m); }
    let r = m.get(id); if (!r) { r = make(); m.set(id, r); }
    return r;
};
const FOLD_TABS = ['force', 'wealth', 'news', 'profile', 'journal', 'bag', 'settings', 'family', 'arts', 'gear'];
export function Game(props: Props) {
    if (props.save.dead) return <DeathScreen world={props.world} save={props.save} onNext={props.onReincarnate ?? props.onAbandon} />;
    return <GameLive {...props} />;
}

// Shop and teacher tag, matching the real maths: spells use power and qi cost, techniques use cultivation speed.
function affTag(save: SaveGame, kind: 'technique' | 'spell', el: Parameters<typeof affinityMult>[1]): string {
    if (kind === 'spell') { const n = affinityMult(save.char, el).note; return n ? ` · ${n}` : ''; }
    const sp = techniqueSpeed(save.char, el);
    if (sp === 1) return '';
    return sp > 1 ? ` · cultivation x${sp} with your ${el} affinity` : ` · slower: you lack ${el} affinity (cultivation x${sp})`;
}

function DeathScreen({ world, save, onNext }: { world: World; save: SaveGame; onNext: (child?: string) => void }) {
    const kids = (save.family ?? []).filter(r => r.rel === 'Child' && r.alive && relAge(r, save.dead!.atDays) >= 16);
    const d = save.dead!;
    const next = extendLineage(null, save, d);
    const city = world.cityById.get(save.locationId);
    return (
        <div className="death">
            <div className="death-glyph">🕯️</div>
            <h1>{save.char.given} {save.char.surname}</h1>
            <div className="dim">{CAUSE_LABEL[d.cause]} · age {d.age.toLocaleString('en-US')} · {REALMS[d.realm]} realm</div>
            <p className="death-text">{d.text}</p>
            <p className="dim">{city ? `They fell near ${city.name}. ` : ''}Their life spanned {formatDuration(d.atDays * 24)} of the world.</p>
            <div className="legacy-card">
                <div className="legacy-title">🏮 What they leave behind</div>
                <div>Generation {next.gen}. Highest realm in your line: <strong>{REALMS[next.bestRealm]}</strong>.</div>
                <div className="dim">{inheritance(next).blurb}</div>
                {next.line.length > 1 && <div className="dim">Ancestors: {next.line.slice(0, -1).slice(-4).map(a => `${a.name} (${REALMS[a.realm]})`).join(', ')}</div>}
            </div>
            {kids.map(k => <button type="button" key={k.id} className="btn primary" onClick={() => onNext(k.name.split(' ')[0])}>👶 Play your child {k.name} (age {relAge(k, save.dead!.atDays)}) →</button>)}
            <button type="button" className="btn primary" onClick={() => onNext()}>{kids.length ? 'Or let a rolled descendant be born →' : 'Light the next lamp: a descendant is born →'}</button>
        </div>
    );
}

function GameLive({ world, save, setSave, onAbandon, initialTab = 'home', backup, onRestore }: Props) {
    const [impText, setImpText] = useState('');
    const [tab, setTab] = useState<Tab>(() => { if (nav.tab) { const t = nav.tab; nav.tab = null; return t as Tab; } return initialTab; });
    const [menuOpen, setMenuOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(() => !hintSeen);
    const dismissHint = () => { hintSeen = true; setHintOpen(false); };
    const [sheetDy, setSheetDy] = useState(0);
    const dragY = useRef<number | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [marketOpen, setMarketOpen] = useState(false);
    const [dTab, setDTab] = useState<'duties' | 'peers'>('duties');
    const [sName, setSName] = useState('');
    const [sKind, setSKind] = useState<'sect' | 'clan'>('sect');
    const [sTab, setSTab] = useState<'hall' | 'build' | 'powers' | 'news'>('hall');
    const [wTab, setWTab] = useState<'shares' | 'home' | 'auction' | 'funds' | 'trade'>('shares');
    const [bids, setBids] = useState<Record<string, number>>({});
    const [gearSlot, setGearSlot] = useState<string | null>(null);
    const [gearView, setGearView] = useState<string>('Body');
    const [boardAll, setBoardAll] = useState(false);
    const prefs = usePrefs();
    const setPrefs = useSetPrefs();
    const [qOpen, setQOpen] = useState(false);
    const [ventKind, setVentKind] = useState<VentureKind>('hunt');
    const [townTab, setTownTab] = useState<'market' | 'world' | 'crafts' | 'board' | 'people' | 'powers'>('market');
    const [homeView, setHomeView] = useState<'path' | 'realm' | 'sect' | 'town'>('path');
    const [craftTab, setCraftTab] = useState<CraftId>('alchemy');
    const [prevTab, setPrevTab] = useState<Tab>('home');
    const [verdict, setVerdict] = useState<string | null>(null);

    const membership = save.membership ?? null;
    const hv = homeView === 'sect' && !save.membership ? 'path' : homeView;
    const memberForce = membership ? world.forceById.get(membership.forceId) ?? null : null;
    const memberCity = memberForce ? world.cityById.get(memberForce.hqCityId) ?? null : null;

    const applyTo = (f: Force) => {
        const v = joinVerdict(save.char, f, membership);
        setVerdict(v.text);
        setSave({
            ...save,
            membership: v.ok ? { forceId: f.id, sinceDays: save.clockDays } : membership,
            rank: v.ok ? { rank: 0, contrib: 0 } : save.rank,
            log: [v.ok ? v.text : `${f.name}: refused. ${v.text}`, ...save.log].slice(0, 30),
            savedAt: Date.now(),
        });
    };

    const renounce = () => {
        if (!memberForce) return;
        setVerdict(null);
        setSave({
            ...save,
            membership: null,
            rank: undefined,
            log: [`You renounced the ${memberForce.name} and walked out of its gates.`, ...save.log].slice(0, 30),
            savedAt: Date.now(),
        });
    };

    const [mktNote, setMktNote] = useState<string | null>(null);
    const [powCont, setPowCont] = useState<string>(world.continents[0]?.id ?? '');
    const onSelectCity = useCallback((c: City | null) => setSelectedId(c?.id ?? null), []);
    const act = (r: { save: SaveGame; msg: string }) => { setMktNote(r.msg || null); if (r.save !== save) setSave({ ...r.save, log: r.msg && r.msg.length > 2 ? [r.msg, ...r.save.log].slice(0, 30) : r.save.log, savedAt: Date.now() }); };
    const arts = getArts(save);
    const [artNote, setArtNote] = useState<string | null>(null);
    const setArts = (a: ArtsState, line?: string) => setSave({
        ...save, arts: a, log: line ? [line, ...save.log].slice(0, 30) : save.log, savedAt: Date.now(),
    });
    const learnArt = (e: LibraryEntry) => {
        const chk = learnCheck(save, e.kind, e.id);
        if (!chk.ok) { setArtNote(chk.why ?? ''); return; }
        const info = e.kind === 'technique' ? techById(e.id) : spellById(e.id);
        if (!info) return;
        const art: LearnedArt = { id: e.id, source: 'sect', points: 0, talent: talentFor(save.char, e.id) };
        setArtNote(null);
        if (e.kind === 'technique') setArts({ ...arts, techniques: [...arts.techniques, art] }, `📚 You copied ${info.name} from the sect library.`);
        else setArts({ ...arts, spells: [...arts.spells, art] }, `📚 You learned ${info.name} from the sect library.`);
    };
    const forgetArt = (kind: 'technique' | 'spell', id: string) => {
        const info = kind === 'technique' ? techById(id) : spellById(id);
        if (kind === 'technique') {
            const techniques = arts.techniques.filter(a => a.id !== id);
            setArts({ ...arts, techniques, activeTechnique: arts.activeTechnique === id ? (techniques[0]?.id ?? null) : arts.activeTechnique }, `You let go of ${info?.name ?? 'a technique'}.`);
        } else {
            setArts({ ...arts, spells: arts.spells.filter(a => a.id !== id), practicing: arts.practicing === id ? null : arts.practicing }, `You let go of ${info?.name ?? 'a spell'}.`);
        }
    };

    const gameRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (save.dead) return;
        const q = settleQuests(save); if (q !== save) setSave({ ...q, savedAt: Date.now() });
    }, [save.clockDays, save.eco, save.tally, save.quests, save.membership, save.gearBag, save.cult?.realm]);
    useEffect(() => {
        const root = gameRef.current; if (!root || !FOLD_TABS.includes(tab)) return;
        const panels = Array.from(root.querySelectorAll<HTMLElement>('.panel')).filter(p => p.querySelector(':scope > h3'));
        panels.forEach((p, i) => { if (!p.dataset.seen) { p.dataset.seen = '1'; if (i === 0) p.classList.add('open'); } });
    });
    const patch = (p: Partial<SaveGame>) => setSave({ ...save, ...p, savedAt: Date.now() });
    const prevLog = useRef(save.log);
    useEffect(() => {
        if (save.log === prevLog.current) return;
        const old = [...prevLog.current];
        const fresh: string[] = [];
        for (const l of save.log) { const i = old.indexOf(l); if (i >= 0) old.splice(i, 1); else fresh.push(l); }
        prevLog.current = save.log;
        if (fresh.length) patch({ journal: [...fresh.map(t => ({ d: save.clockDays, t })), ...(save.journal ?? [])].slice(0, 30) });
    }, [save.log]);
    const here = world.cityById.get(save.locationId) ?? null;
    const travelingTo = save.travel ? world.cityById.get(save.travel.toId) ?? null : null;
    const selected = selectedId ? world.cityById.get(selectedId) ?? null : null;

    const arriveIn = save.travel ? Math.max(0, save.travel.arriveDays - save.clockDays) : 0;

    const startTravel = (dest: City) => {
        if (!here || save.travel || save.exp) return;
        const hours = travelHours(here, dest) * (save.swift ? 0.7 : 1) * (1 - gearEffect(save, 'travel')) * (1 - mountCut(save));
        setSave({
            ...save,
            swift: false,
            travel: { fromId: here.id, toId: dest.id, arriveDays: save.clockDays + hours / 24 },
            log: [`You set out for ${dest.name}.`, ...save.log].slice(0, 30),
            savedAt: Date.now(),
        });
        setSelectedId(null);
    };

    const cancelTravel = () => {
        if (!save.travel) return;
        const from = world.cityById.get(save.travel.fromId);
        setSave({
            ...save,
            travel: null,
            locationId: save.travel.fromId,
            log: [`You turned back to ${from?.name ?? 'safety'}.`, ...save.log].slice(0, 30),
            savedAt: Date.now(),
        });
    };

    return (
        <div ref={gameRef} className={`game t-${tab}${tab === 'map' ? ' map-mode' : ''}`} onClick={e => {
            const at = (e.target as HTMLElement).closest?.('.attrs > .attr') as HTMLElement | null;
            if (at && tab === 'profile') { at.classList.toggle('open'); return; }
            const h = (e.target as HTMLElement).closest?.('.game .panel > h3') as HTMLElement | null;
            if (!h || !FOLD_TABS.includes(tab)) return;
            const panel = h.parentElement!;
            panel.classList.toggle('open');
        }}>
            <header className="topbar compact">
                <span className="clock-face">⏳ {formatClock(save.clockDays)} {SEASON_ICON[seasonOf(save.clockDays)]}</span>
                <span className="compact-ctl">
                    {tab !== 'map' && (
                        <button type="button" className="profile-chip mini" onClick={() => { if (tab !== 'profile') setPrevTab(tab); setTab('profile'); }} aria-label="Open profile">
                            <span className="profile-avatar">{save.char.avatar ?? ROOT_AVATARS[save.char.root]}</span>
                            <span className="profile-name">{save.char.given}</span>
                        </button>
                    )}
                    <button type="button" className={`chip pause ${save.paused ? 'on' : ''}`} onClick={() => patch({ paused: !save.paused })} aria-pressed={save.paused} aria-label={save.paused ? 'Resume' : 'Pause'}>{save.paused ? '▶' : '⏸'}</button>
                    <button type="button" className="chip on" onClick={() => patch({ speed: (save.speed + 1) % SPEEDS.length, paused: false })} aria-label="Change speed">{SPEEDS[save.speed]}x</button>
                </span>
            </header>

            {save.travel && travelingTo && (
                <div className="travel-banner">
                    🥾 Traveling to <strong>{travelingTo.name}</strong> - arrive in {formatDuration(arriveIn * 24)}.
                    <button type="button" className="linkbtn" onClick={cancelTravel}>Turn back</button>
                </div>
            )}

            {(
                <nav className="bottomnav">
                    {([['home', '🏠', 'Home'], ['map', '🗺️', 'Map'], ['family', '👪', 'Family'], ['force', '🏯', 'Force']] as [Tab, string, string][]).map(([t, ic, nm]) => (
                        <button key={t} type="button" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}><span>{ic}</span>{nm}</button>
                    ))}
                    <button type="button" className={['arts', 'bag', 'news', 'journal', 'settings', 'profile'].includes(tab) ? 'on' : ''} onClick={() => setMenuOpen(true)}><span>☰</span>More</button>
                </nav>
            )}
            {menuOpen && (
                <div className="drawer-scrim" onClick={() => setMenuOpen(false)}>
                    <div className="drawer" onClick={e => e.stopPropagation()}>
                        <div className="drawer-grip" />
                        <div className="drawer-grid">
                            {([['home', '🏠', 'Home'], ['map', '🗺️', 'Map'], ['arts', '✨', 'Arts'], ['family', '👪', 'Family'], ['bag', '🎒', 'Pack'], ['gear', '🛡️', 'Gear'], ['wealth', '💰', 'Wealth'], ['force', '🏯', 'Force'], ['news', '📰', 'News'], ['journal', '📜', 'Journal'], ['settings', '⚙️', 'Settings'], ['profile', '🧘', 'Profile']] as [Tab, string, string][]).map(([t, ic, nm]) => (
                                <button key={t} type="button" className={tab === t ? 'cur' : ''} onClick={() => { setMenuOpen(false); if (t === 'profile' && tab !== 'profile') setPrevTab(tab); setTab(t); }}><span>{ic}</span>{nm}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}


            {tab === 'home' && (
                <div className="home">
                    {!save.travel && here && (() => {
                        const views: ['path' | 'realm' | 'sect' | 'town', string, string][] = [['path', '🧘', 'Path'], ['realm', '🌀', 'Realm'], ...(membership ? [['sect', '🎴', 'Sect'] as ['sect', string, string]] : []), ['town', '🏯', 'Town']];
                        return (
                            <div className="homeviews" role="tablist">
                                {views.map(([k, ic, nm]) => <button key={k} type="button" role="tab" aria-selected={hv === k} className={`hv ${hv === k ? 'on' : ''}`} onClick={() => setHomeView(k)}><span>{ic}</span>{nm}</button>)}
                            </div>
                        );
                    })()}
                    {(hv === 'path' || save.travel || !here) && (() => {
                        const recent = (save.journal && save.journal.length ? save.journal.map(j => j.t) : save.log).slice(0, 2);
                        const cc = currentCult(save);
                        let next: React.ReactNode;
                        if (save.scheme && !save.travel) next = 'A rival is plotting. See the panel below.';
                        else if (save.travel) next = 'Keep walking. The road is long; time passes as you go.';
                        else if (cc.gate) next = 'You stand at a threshold. Attempt the breakthrough below when you feel ready.';
                        else if (!membership) next = 'Find a force. See "Powers here" below and apply to join one.';
                        else next = <>Look at the world. <button type="button" className="linkbtn" onClick={() => setTab('map')}>Open the map</button></>;
                        return (
                            <div className="panel today">
                                <h3>📌 Today</h3>
                                {recent.length === 0 ? <p className="dim">Nothing has happened yet. Your story starts when you move.</p> : recent.map((l, i) => <p key={i} className={i === 0 ? '' : 'dim'}>{l}</p>)}
                                <p className="next"><strong>Next:</strong> {next}</p>
                                <button type="button" className="linkbtn" onClick={() => setTab('journal')}>Open the journal</button>
                            </div>
                        );
                    })()}
                    {save.travel && travelingTo ? (
                        <div className="panel">
                            <h3>On the road</h3>
                            <p>🥾 Traveling to <strong>{travelingTo.name}</strong> ({travelingTo.prefecture}, {travelingTo.continent}) - arrive in {formatDuration(arriveIn * 24)}.</p>
                            <button type="button" className="btn secondary" onClick={cancelTravel}>Turn back</button>
                        </div>
                    ) : here && hv === 'path' ? (
                        <div className="panel">
                            <h3>You are in {here.name}</h3>
                            <p className="dim">{BIRTHPLACE_LABEL[here.tier]} · {here.country}, {here.prefecture} · {here.continent}</p>
                            {memberForce && (
                                <p>🎴 <strong>{memberForce.name}</strong> - {SECT_RANKS[sectRankIndex(save)].name.toLowerCase()}{memberCity && memberCity.id !== here.id ? ` (its seat is ${memberCity.name})` : ''}.
                                    <button type="button" className="linkbtn" onClick={renounce}>Renounce</button>
                                </p>
                            )}
                        </div>
                    ) : null}

                    {hv === 'path' && !save.travel && !save.dead && (() => {
                        type QR = { key: string; src: string; icon: string; title: string; sub: string; ready: boolean; claim: () => void; drop?: () => void };
                        const put = (r: { save: SaveGame }) => setSave({ ...r.save, savedAt: Date.now() });
                        const ms: QR[] = activeGoals(save).slice(0, 3).map(g => { const have = Math.min(g.need, Math.floor(g.have(save))); return { key: g.id, src: 'Milestone', icon: g.icon, title: g.title, sub: `${g.hint} ${g.need > 1 ? have + '/' + g.need + ' · ' : ''}Reward: ${g.reward.text}`, ready: goalReady(save, g), claim: () => put(claimGoal(save, g.id)) }; });
                        const nq: QR[] = questsOf(save).map(q => ({ key: q.id, src: q.fam ? 'Family' : 'Request', icon: q.fam ? '👪' : '📜', title: q.text[0].toUpperCase() + q.text.slice(1), sub: `${Math.floor(questProgress(save, q))}/${q.need} · ${Math.max(0, Math.ceil(q.due - save.clockDays))}d left · Reward: ${q.reward.text}`, ready: questReady(save, q), claim: () => put(claimQuest(save, q.id)), drop: () => setSave({ ...dropQuest(save, q.id), savedAt: Date.now() }) }));
                        const bj: QR[] = getJobs(save).active.map(j => { const st = jobStatus(world, save, j); return { key: j.id, src: 'Bounty', icon: '📋', title: j.title, sub: `${st.ready ? 'Ready to hand in.' : st.why} Pay ${j.reward} stones.`, ready: st.ready, claim: () => put(finishJob(world, save, j.id)), drop: () => put(dropJob(save, j.id)) }; });
                        const ds = getDuty(save).active;
                        const du: QR[] = ds ? [{ key: 'duty', src: 'Sect duty', icon: ds.duty.icon, title: ds.duty.title, sub: ds.ready ? 'Finished. Report back to claim.' : `Back in ${Math.max(0, Math.ceil(ds.endsDay - save.clockDays))} days.`, ready: Boolean(ds.ready), claim: () => setSave({ ...claimDuty(save), savedAt: Date.now() }) }] : [];
                        const all = [...ms, ...nq, ...bj, ...du], ready = all.filter(x => x.ready);
                        const row = (r: QR) => (
                            <div className="row-item" key={r.key}>
                                <div><strong>{r.icon} {r.title}</strong><div className="dim">{r.src} · {r.sub}</div></div>
                                <span className="btnrow">{r.ready ? <button type="button" className="btn small" onClick={r.claim}>Claim</button> : r.drop ? <button type="button" className="btn secondary small" onClick={r.drop}>Drop</button> : null}</span>
                            </div>);
                        const grp = (name: string, list: QR[]) => list.length > 0 && <details key={name}><summary>{name} ({list.length})</summary>{list.map(row)}</details>;
                        return (
                            <div className={`panel goal ${ready.length ? 'claimable' : ''}`}>
                                <button type="button" className="goal-h qhead" onClick={() => setQOpen(o => !o)}><strong>📜 Quests</strong><span className="dim">{ready.length > 0 ? <b className="qbadge">{ready.length} to claim</b> : `${all.length} open`} {qOpen ? '▴' : '▾'}</span></button>
                                {!qOpen && (all[0] ? <div className="dim">{all[0].icon} {all[0].title}</div> : <div className="dim">Nothing open. Talk to people in town or check the Board.</div>)}
                                {qOpen && <>
                                    {ready.length > 0 && <><h4>Ready to claim</h4>{ready.map(row)}</>}
                                    {grp('Milestones', ms.filter(x => !x.ready))}
                                    {grp('Requests', nq.filter(x => !x.ready && x.src === 'Request'))}
                                    {grp('Family', nq.filter(x => !x.ready && x.src === 'Family'))}
                                    {grp('Bounties', bj.filter(x => !x.ready))}
                                    {grp('Sect duty', du.filter(x => !x.ready))}
                                    {all.length === 0 && <p className="dim">Nothing open. Talk to people in town or check the Board.</p>}
                                    <details><summary>Completed</summary><p className="dim">{goalsDone(save).length}/{GOALS.length} milestones{goalsDone(save).length ? ': ' + goalsDone(save).slice(-4).map(id => GOALS.find(g => g.id === id)?.title).join(', ') : ''}. {(save as any).qDone ?? 0} requests, {getJobs(save).done.length} bounties, {getDuty(save).done} sect duties.</p></details>
                                </>}
                            </div>
                        );
                    })()}

                    {save.scheme && !save.travel && hv === 'path' && (
                        <div className="panel rival">
                            <h3>🗡️ A rival moves against you</h3>
                            <p>{save.scheme.rival} is {save.scheme.role}. {save.scheme.stage === 1 ? 'So far, only whispers.' : save.scheme.stage === 2 ? 'The first attempt failed. A second will come.' : 'The next attempt will be deadly.'}</p>
                            <div className="btnrow wrap">
                                <button type="button" className="btn secondary small" onClick={() => setSave({ ...counterScheme(save, 'peace'), savedAt: Date.now() })}>Offer gifts ({PEACE_COST} stones)</button>
                                <button type="button" className="btn secondary small" disabled={!save.membership} onClick={() => setSave({ ...counterScheme(save, 'protection'), savedAt: Date.now() })}>Ask your banner for protection</button>
                            </div>
                            <p className="dim">Leaving this city ends the scheme: they lose your trail.</p>
                        </div>
                    )}

                    {!save.travel && here && (
                        <>
                            {hv === 'path' && <div className={`panel cult ${save.paused ? 'idle' : 'live'}`}>
                                {(() => {
                                    const c = currentCult(save);
                                    const need = stageCost(c.realm, c.stage);
                                    const rate = cultivationRate(save.char, c, membership ? sectRankIndex(save) + 1 : false, getArts(save));
                                    const pct = Math.min(100, (c.progress / need) * 100);
                                    const perHour = rate.perDay / 24;
                                    const hoursLeft = (need - c.progress) / perHour;
                                    return (
                                        <>
                                            <h3>{save.exp ? '🌀 Meditation paused (inside a secret realm)' : c.gate ? '🔒 At the threshold' : save.paused ? '🧘 Meditation paused' : '🧘 Cultivating...'}</h3>
                                            <p className="cult-realm">{stageLabel(c)}</p>
                                            <div className="cult-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                                                <div className="cult-fill" style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="cult-nums">Cultivation base {Math.floor(c.progress)} / {need}</p>
                                            {c.gate ? <p className="dim">Efficiency +{rate.perDay.toFixed(1)} per day (paused at the threshold)</p> : <p className="dim">Efficiency +{rate.perDay.toFixed(1)} per day · next stage in {save.paused ? 'a while (time is stopped)' : formatDuration(hoursLeft)}</p>}
                                            <details className="cult-why"><summary>Why this rate</summary><p className="dim cult-parts">{rate.parts.map(p => `${p.label} x${p.mult.toFixed(2).replace(/\.?0+$/, '')}`).join(' · ')}</p></details>
                                            {c.gate && (
                                                <div className="brk">
                                                    <p className={deathRisk(save) >= 0.1 ? 'risk hot' : 'risk'}>☠️ Risk of death if you try now: <strong>{deathRisk(save) < 0.005 ? 'negligible' : `${Math.round(deathRisk(save) * 100)}%`}</strong>{c.realm + 1 > ceilingRealm(save.char) ? ' (beyond your root\'s ceiling)' : ''}{(c.weak ?? 0) > 0 ? ' (you are still recovering from a qi deviation)' : ''}</p>
                                                    <p>Perfection reached. Breakthrough chance <strong>{Math.round(breakthroughChance(save) * 100)}%</strong>
                                                        {tribulationWaves(c.realm + 1) > 0 ? ` - then ${tribulationWaves(c.realm + 1)} waves of heavenly lightning, two bolts each.` : '.'}</p>
<details className="kin-acts"><summary>⚡ About the tribulation and failure</summary>
                                                    {heartDemonAt(c.realm + 1) && <p className="risk hot">🌑 This breakthrough calls your heart-demon first: {hdTrials(c.realm + 1)} trials drawn from your life, with no items allowed. You must pass at least {hdTrials(c.realm + 1) - 1} of them. Each trial has three ways through, and the page shows your chance for each. Sin makes it harder{save.char.alignment === 'righteous' ? ' (a righteous path feels its own sins hardest)' : ' (a demonic path has made peace with its sins, but gets less strength from mercy)'}. Karma: <strong>{karmaWord(save)}</strong> ({karmaOf(save)}).{karmaOf(save) <= -60 ? ' A heart-demon fed this much can devour you: death is possible if you fail badly.' : ''}</p>}
                                                    {tribulationWaves(c.realm + 1) > 0 && <p className="dim">👁️ Heaven's attention: <strong>{heavenWord(save)}</strong> ({(save.heaven ?? 0).toFixed(1)}). Secret realms survived, guardians slain and equal-or-higher foes beaten make the tribulation up to {Math.round(heavenMul(save) * 100 - 100)}% harsher now (max +50%).</p>}
                                                    {(c.scars ?? 0) > 0 && <p className="risk hot">💔 Tribulation scars: {c.scars} of 3 (qi {Math.round((c.scars ?? 0) * 8)}% slower, shorter life).</p>}
                                                    {tribulationWaves(c.realm + 1) > 0 && <p className="dim">Scars: each one slows qi by 8% and shortens life by 3% (max 3). Heaven's attention raises the odds of a scar, from 35% up to 65%.</p>}
                                                    {tribulationWaves(c.realm + 1) > 0 && <p className="risk hot">⚡ The tribulation is a survival fight: only defensive artifacts, ward and swift talismans, and healing pills or herbs work. Bring them, and a defensive artifact if you can.</p>}
                                                    {tribulationWaves(c.realm + 1) > 0
                                                        ? <p className="dim">A failed tribulation costs most of your progress (you keep 40%) and a deep qi deviation: half speed for a year. It can also scar your path for good. Death is possible from Golden Core on.</p>
                                                        : <p className="dim">A failed attempt costs progress (you keep 60%) and a qi deviation: half speed for 6 months. From Golden Core on, a bad failure can kill.</p>}
</details>
                                                    <button type="button" className="btn primary" onClick={() => { const r = attemptBreakthrough(save, true); setSave({ ...(r.pending ? startTribulation(r.save) : r.save), savedAt: Date.now() }); }}>⚡ Attempt breakthrough</button>
                                                </div>
                                            )}
                                            {!c.gate && c.weak ? <p className="dim">🩸 Qi deviation: half speed for {formatDuration(c.weak * 24)} more.</p> : null}
                                            <details className="kin-acts"><summary>⚖️ Karma: {karmaWord(save)} ({karmaOf(save)})</summary>
                                                <p className="dim">Your deeds are written in a ledger, bound to your {save.char.alignment} nature. {save.char.alignment === 'righteous' ? 'Cruelty counts 1.5 times against you.' : 'Cruelty counts 0.6 times, but mercy earns 0.6 times.'} Sin slows breakthroughs a little and weakens you against your heart-demon. It is read at the Nascent Soul breakthrough and every second realm after.</p>
                                                {(save.karmaLog ?? []).length ? (save.karmaLog ?? []).map((l, i) => <p key={i} className="dim">{l}</p>) : <p className="dim">Nothing written yet.</p>}
                                            </details>
                                            <p className="dim">Stage {c.stage + 1} of {STAGES_PER_REALM}. You meditate whenever you are settled, not on the road. It follows the game speed.</p>
                                            <SeclusionCard world={world} save={save} setSave={setSave} />
                                        </>
                                    );
                                })()}
                            </div>}

                            {membership && memberForce && hv === 'sect' && (() => {
                                const ss = swayState(save, memberForce, world);
                                return (
                                    <div className="panel">
                                        <h3>⚖️ Standing of the {memberForce.name}</h3>
                                        <p><strong>{ss.word}</strong> <em className={`sway ${ss.trend}`}>{ss.arrow} {ss.trend}</em></p>
                                        <p className="dim">{ss.holdings ? `Holds ${ss.holdings} prefecture${ss.holdings === 1 ? '' : 's'} by arms.` : 'Holds no prefecture by arms.'} Conquest raises a banner's standing and losses lower it.</p>
                                    </div>
                                );
                            })()}

                            {membership && memberForce && hv === 'sect' && (() => {
                                const nr = nextRank(save); const pv = canPromote(save);
                                return (
                                    <div className="panel">
                                        <h3>🎖️ Rank in the {memberForce.name}</h3>
                                        <p><strong>{SECT_RANKS[sectRankIndex(save)].name}</strong> · contribution {Math.floor(save.rank?.contrib ?? 0)}</p>
                                        <p className="dim">{nr ? `Next: ${nr.name}. ${pv.why}` : pv.why} Contribution grows while you cultivate under its banner.</p>
                                        {nr && <button type="button" className="btn secondary" disabled={!pv.ok} onClick={() => setSave({ ...promote(save), savedAt: Date.now() })}>Seek promotion</button>}
                                        <details><summary>Rank ladder</summary>{SECT_RANKS.map((r, i) => <div className="relative" key={r.name}>{i === sectRankIndex(save) ? '▶ ' : i < sectRankIndex(save) ? '✓ ' : ''}<strong>{r.name}</strong> <span className="dim">{r.contrib} contribution · {REALMS[r.realm]}</span></div>)}</details>
                                    </div>
                                );
                            })()}

                            {membership && memberForce && hv === 'sect' && (() => {
                                const ev = eventOfSeason(save), sl = sectLifeOf(save);
                                const left = Math.max(0, Math.ceil((sl.season + 1) * 90 - save.clockDays));
                                return (
                                    <>
                                        <div className="panel">
                                            <h3>{ev.icon} This season: {ev.title}</h3>
                                            <p className="dim">{ev.blurb}</p>
                                            {sl.done ? <p className="dim">You took part. {sl.last ?? ''} The next gathering comes in {left} days.</p> : <button type="button" className="btn primary" onClick={() => act(joinEvent(save))}>{ev.button}</button>}
                                            {!sl.done && <p className="dim">One gathering each season. This one ends in {left} days.</p>}
                                        </div>
                                        <div className="panel">
                                            <h3>🏛️ Merit Hall</h3>
                                            <p className="dim">Spend contribution ({Math.floor(save.rank?.contrib ?? 0)} now) on sect goods. Higher ranks open higher shelves. Spending does not lower your rank.</p>
                                            {MERIT.slice(0, 3).map(m => <div className="row-item" key={m.id}><div><strong>{m.icon} {m.name}</strong><div className="dim">{m.cost} contribution{m.minRank > sectRankIndex(save) ? ` · needs ${SECT_RANKS[m.minRank].name}` : ''}</div></div><button type="button" className="btn secondary small" disabled={m.minRank > sectRankIndex(save)} onClick={() => act(buyMerit(save, m.id))}>Take</button></div>)}
                                            <details><summary>More shelves</summary>{MERIT.slice(3).map(m => <div className="row-item" key={m.id}><div><strong>{m.icon} {m.name}</strong><div className="dim">{m.cost} contribution{m.minRank > sectRankIndex(save) ? ` · needs ${SECT_RANKS[m.minRank].name}` : ''}</div></div><button type="button" className="btn secondary small" disabled={m.minRank > sectRankIndex(save)} onClick={() => act(buyMerit(save, m.id))}>Take</button></div>)}</details>
                                            {mktNote && <p className="dim">{mktNote}</p>}
                                        </div>
                                        <div className="panel">
                                            <h3>📚 Sect life</h3>
                                            <p className="dim">Techniques sit in the library, duties and fellow disciples live under Force, and sect wars and news are in the Events tab of Force.</p>
                                            <div className="btnrow wrap"><button type="button" className="btn secondary small" onClick={() => setTab('arts')}>📚 Library (Arts)</button><button type="button" className="btn secondary small" onClick={() => setTab('force')}>📋 Duties and peers</button></div>
                                        </div>
                                    </>
                                );
                            })()}

                            {hv === 'realm' && (() => {
                                const exp = save.exp;
                                if (exp) {
                                    const left = Math.max(0, exp.endsDays - save.clockDays);
                                    const pct = Math.min(100, ((save.clockDays - exp.startDays) / (exp.endsDays - exp.startDays)) * 100);
                                    return (
                                        <div className="panel">
                                            <h3>{exp.icon} Inside the {exp.name}</h3>
                                            <div className="cult-bar"><div className="cult-fill" style={{ width: `${pct}%` }} /></div>
                                            <p className="dim">{formatDuration(left * 24)} more. Cultivation is paused while you explore. {DANGER[exp.danger]} realm.</p>
                                        </div>
                                    );
                                }
                                const offer = realmHere(save, here.prefecture);
                                const myRealm = currentCult(save).realm;
                                const cc = currentCult(save), nextR = cc.realm + 1 < REALMS.length ? cc.realm + 1 : null;
                                const bottle: string[] = [];
                                if (cc.gate) bottle.push('Perfection reached: you stand at the threshold. Attempt the breakthrough on the Path tab.');
                                if (cc.weak) bottle.push(`Qi deviation: half speed for ${formatDuration(cc.weak * 24)} more.`);
                                if (nextR !== null && nextR > ceilingRealm(save.char)) bottle.push(`Your root caps near ${REALMS[ceilingRealm(save.char)]}. Going past it costs 25% on the breakthrough.`);
                                if (nextR !== null && !(save.eco?.items['bt-pill'] ?? 0)) bottle.push('No Breakthrough Pill held (+15% chance if you carry one).');
                                if (nextR !== null && tribulationWaves(nextR) > 0) bottle.push(`The ${REALMS[nextR]} breakthrough calls ${tribulationWaves(nextR)} waves of heavenly lightning.`);
                                return (
                                    <>
                                    <div className="panel">
                                        <h3>🌀 Secret realm</h3>
                                        <p><strong>{offer.kind.icon} {offer.kind.name}</strong> · {DANGER[offer.danger]}</p>
                                        <p className="dim">{offer.kind.blurb}</p>
                                        {offer.open ? (
                                            <>
                                                <p className="dim">Open for {Math.ceil(offer.closesIn)} more days. Takes {formatDuration(offer.days * 24)}. Recommended: {REALMS[offer.recommended]}{myRealm < offer.recommended ? ' (you are under-cultivated: high risk)' : ''}.</p>
                                                <p className={realmDeathRisk(save, offer.danger) >= 0.1 ? 'risk hot' : 'risk'}>☠️ Risk of never returning: <strong>{realmDeathRisk(save, offer.danger) < 0.005 ? 'negligible' : `${Math.round(realmDeathRisk(save, offer.danger) * 100)}%`}</strong>{realmTrapRisk(save, offer.danger, offer.kind.name) >= 0.01 ? ` · sealed in: ${Math.round(realmTrapRisk(save, offer.danger, offer.kind.name) * 100)}%` : ''}</p>
                                                <button type="button" className="btn secondary" onClick={() => act(enterRealm(save, offer))}>Enter the realm</button>
                                            </>
                                        ) : <p className="dim">Sealed. Opens in {Math.ceil(offer.opensIn)} days.</p>}
                                    </div>
                                    <div className="panel">
                                        <h3>🧭 Your realm</h3>
                                        <p className="cult-realm">{stageLabel(cc)}</p>
                                        <div className="cult-bar"><div className="cult-fill" style={{ width: `${Math.min(100, (cc.progress / stageCost(cc.realm, cc.stage)) * 100)}%` }} /></div>
                                        <p className="dim">Stage {cc.stage + 1} of {STAGES_PER_REALM} · age {ageYears(save.clockDays)} of {lifespanYears(save, cc.realm).toLocaleString('en-US')}.{nextR !== null ? ` Next realm: ${REALMS[nextR]}, lifespan ${lifespanYears(save, nextR).toLocaleString('en-US')}.` : ' The last realm.'}</p>
                                        {nextR !== null && <p>Chance to break through: <strong>{Math.round(breakthroughChance(save) * 100)}%</strong></p>}
                                        <h4>Bottlenecks</h4>
                                        {bottle.length ? bottle.slice(0, 3).map((b, i) => <p className="dim" key={i}>• {b}</p>) : <p className="dim">Nothing blocks you. Keep cultivating.</p>}
                                        {bottle.length > 3 && <details><summary>More</summary>{bottle.slice(3).map((b, i) => <p className="dim" key={i}>• {b}</p>)}</details>}
                                        <div className="btnrow wrap"><button type="button" className="btn secondary small" onClick={() => setHomeView('path')}>🧘 To the Path</button><button type="button" className="btn secondary small" onClick={() => setTab('arts')}>📚 Arts</button><button type="button" className="btn secondary small" onClick={() => setTab('bag')}>🎒 Pills and items</button></div>
                                        <details><summary>The ladder of realms</summary>
                                            {REALMS.slice(0, 10).map((nm, i) => {
                                                const rk = SECT_RANKS.filter(r => r.realm === i).map(r => r.name);
                                                return <div className="relative" key={nm}>{i === cc.realm ? '▶ ' : i < cc.realm ? '✓ ' : ''}<strong>{nm}</strong> <span className="dim">lifespan {lifespanYears(save, i).toLocaleString('en-US')}{tribulationWaves(i) > 0 ? ` · ${tribulationWaves(i)} lightning waves to enter` : ''}{i > ceilingRealm(save.char) ? ' · beyond your root' : ''}{rk.length ? ` · opens sect rank ${rk.join(', ')}` : ''}</span></div>;
                                            })}
                                        </details>
                                    </div>
                                    </>
                                );
                            })()}

                            {hv === 'town' && <>
                            <div className="townnav" role="tablist">
                                <div className="townhead">🏯 {here.name}</div>
                                <div className="pills">
                                    {([['market', '🏪', 'Market'], ['world', '🌐', 'World'], ['crafts', '🛠️', 'Crafts'], ['board', '📋', 'Board'], ['people', '🏘️', 'People'], ['powers', '⛩️', 'Powers']] as ['market' | 'world' | 'crafts' | 'board' | 'people' | 'powers', string, string][]).map(([k, ic, nm]) => (
                                        <button key={k} type="button" role="tab" aria-selected={townTab === k} className={`pill ${townTab === k ? 'on' : ''}`} onClick={() => setTownTab(k)}><span>{ic}</span>{nm}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="panel venture" hidden={townTab !== 'board'}>
                                <h3>🧭 Ventures</h3>
                                <p className="dim">Repeatable work. Pay and drops rise with danger. Match the realm shown, or expect to bleed.</p>
                                <div className="pills">
                                    {([['hunt', '🐗', 'Hunts'], ['escort', '🛡️', 'Escorts'], ['gather', '🌿', 'Gathering'], ['mine', '⛏️', 'Mining']] as [VentureKind, string, string][]).map(([k, ic, nm]) => (
                                        <button key={k} type="button" className={`pill ${ventKind === k ? 'on' : ''}`} onClick={() => setVentKind(k)}><span>{ic}</span>{nm}</button>
                                    ))}
                                </div>
                                {(() => {
                                    const list = VENTURES.filter(v => v.kind === ventKind);
                                    const row = (v: typeof list[number]) => { const left = ventureLeft(save, v), rw = riskWord(save, v), no = canVenture(save); return (
                                        <div className="row-item" key={v.id}>
                                            <div><strong>{v.icon} {v.name}</strong><div className="dim">{v.days ? `${v.days} days · ` : ''}{REALMS[v.recRealm]?.name ?? 'Realm ' + v.recRealm}+ · <span className={`vr ${rw}`}>{rw}</span></div><div className="dim">{v.note}</div></div>
                                            <button type="button" className="btn small" disabled={left > 0 || Boolean(no)} onClick={() => { const r = startVenture(save, v.id); setSave({ ...r.save, savedAt: Date.now() }); }}>{left > 0 ? `${left}d` : 'Go'}</button>
                                        </div>); };
                                    return <>{list.slice(0, 3).map(row)}{list.length > 3 && <details><summary>+{list.length - 3} deeper</summary>{list.slice(3).map(row)}</details>}</>;
                                })()}
                                {save.log[0] && <p className="dim vlog">{save.log[0]}</p>}
                            </div>

                            {here && here.marketTier >= 1 && !marketRefusal(save, here.id, here.marketTier) && (
                                <div className="panel" hidden={townTab !== 'board'}>
                                    <h3>⚔️ Duel arena</h3>
                                    <p className="dim">Spar for stakes. Losing costs stones and a short qi deviation, never your life.</p>
                                    <div className="pills">
                                        {([[-1, 'Junior'], [0, 'Even'], [1, 'Master']] as [-1 | 0 | 1, string][]).map(([t, nm]) => (
                                            <button key={t} type="button" className="btn secondary small" onClick={() => setSave({ ...startBattle(save, duelSpec(save, t)), savedAt: Date.now() })}>{nm} · win {duelSpec(save, t).stake}</button>
                                        ))}
                                    </div>
                                    <h3>🏴 Raids</h3>
                                    <p className="dim">Fight through 2-3 waves, then loot the strongroom. Each camp rebuilds for 60 days after a raid. Flee any time and keep what you took. A failed raid costs stones, never your life.</p>
                                    {RAIDS.map(r => <div className="row-item" key={r.id}><div><strong>{r.icon} {r.name}</strong><div className="dim">{r.waves} waves · {r.note}</div></div>{(() => { const left = Math.ceil(60 - (save.clockDays - ((save as any).raidAt?.[r.id] ?? -999))); return <button type="button" className="btn small" disabled={left > 0} onClick={() => setSave({ ...startBattle({ ...save, raidAt: { ...((save as any).raidAt ?? {}), [r.id]: save.clockDays } } as SaveGame, raidSpec(save, r.id)), savedAt: Date.now() })}>{left > 0 ? `${left}d` : 'Raid'}</button>; })()}</div>)}
                                </div>
                            )}

                            <div className="panel" hidden={townTab !== 'market'}>
                                <h3>🏪 Market</h3>
                                <p className="dim">{MARKET_TIERS[here.marketTier]}</p>
                                {!marketOpen ? (
                                    <button type="button" className="btn secondary" onClick={() => setMarketOpen(true)}>Visit the market</button>
                                ) : (
                                    <>
                                        <p>{here.marketTier === 0 && 'A few farmers trade grain by the well. No spirit stones change hands here.'}
                                            {here.marketTier === 1 && 'Roadside stalls sell travel rations, crude talisman paper and gossip in equal measure.'}
                                            {here.marketTier === 2 && 'Stalls of herbs, beast cores and low-grade talismans. Cultivators haggle in low voices.'}
                                            {here.marketTier === 3 && 'A grand market: auction halls, pill shops, flying-sword brokers. Fortunes move under the lanterns.'}</p>
                                        <p className="dim fortune-line">{fortuneState(save, here).icon} {here.name} is {fortuneState(save, here).word}.</p>
                                        {currentCult(save).realm < 2 && <p className={regionDanger(world, here) >= 2 ? 'risk hot' : 'risk'}>⚠️ Local danger: {REGION_WORDS[regionDanger(world, here)]}.{regionDanger(world, here) >= 2 ? ' Plague, famine and raids kill the weak here. A sect, a safer city or a higher realm lowers the risk.' : regionDanger(world, here) === 1 ? ' Calamities still happen to the weak.' : ' Calamities are rare behind these walls.'}</p>}
                                        <div className="rumors">
                                            {rumorsAt(world, save, here).slice(0, here.marketTier === 0 ? 1 : 3).map((r, i) => <p className="rumor" key={i}>{r}</p>)}
                                        </div>
                                        {false ? null : marketRefusal(save, here.id, here.marketTier) ? <p className="verdict">{marketRefusal(save, here.id, here.marketTier)}</p> : (
                                            <>
                                                <p className="stones">💎 {Math.floor(getEco(save).stones)} spirit stones{getEco(save).tox >= 1 ? ` · pill toxicity ${getEco(save).tox.toFixed(1)}${getEco(save).tox >= 6 ? ' (lethal soon)' : getEco(save).tox >= 4 ? ' (dangerous)' : ''}` : ''}</p>
                                                <p className="dim">Prices drift month to month.</p>
                                                {shockAt(save, here.id) && <p className="rumor">{shockAt(save, here.id)!.text}</p>}
                                                {here.marketTier === 0 && <p className="dim">A wandering peddler sells the basics for stones.</p>}
                                                {stockFor(save, here.id, here.marketTier).map(it => (
                                                    <div className="row-item" key={it.id}>
                                                        <div><strong>{it.icon} {it.name}</strong>{demandTag(save, here.id, it.id) && <em className="dim"> {demandTag(save, here.id, it.id)}</em>}<div className="dim">{it.blurb}</div></div>
                                                        <button type="button" className="btn secondary small" onClick={() => act(buyItem(save, here.id, it))}>Buy {buyPrice(save, here.id, it)}</button>
                                                    </div>
                                                ))}
                                                {scrollsFor(save, here.id, here.marketTier).map(e => {
                                                    const info = e.kind === 'technique' ? techById(e.id) : spellById(e.id);
                                                    const a = getArts(save);
                                                    const known = (e.kind === 'technique' ? a.techniques : a.spells).some(x => x.id === e.id);
                                                    return info ? (
                                                        <div className="row-item" key={e.id}>
                                                            <div><strong>📜 {info.name}</strong><div className="dim">{e.kind} · {GRADES[info.grade]} · {ELEMENT_ICON[info.element]}{affTag(save, e.kind, info.element)}</div>{!known && !learnCheck(save, e.kind, e.id).ok && <div className="dim">Cannot learn yet: {learnCheck(save, e.kind, e.id).why}</div>}</div>
                                                            {known ? <em className="dim">Known</em> : <button type="button" className="btn secondary small" onClick={() => act(learnScroll(save, here.id, e))}>Learn {e.price}</button>}
                                                        </div>
                                                    ) : null;
                                                })}
                                                {ITEMS.some(it => (getEco(save).items[it.id] ?? 0) > 0) && <h4>Your pack</h4>}
                                                {PACK_ORDER.map(cat => {
                                                    const list = ITEMS.filter(it => catOf(it.id) === cat && (getEco(save).items[it.id] ?? 0) > 0);
                                                    if (!list.length) return null;
                                                    return (
                                                        <div key={cat}>
                                                            <div className="packcat">{CAT_INFO[cat].icon} {CAT_INFO[cat].name}</div>
                                                            {list.map(it => (
                                                                <div className="row-item" key={'p' + it.id}>
                                                                    <div><strong>{it.icon} {it.name} x{getEco(save).items[it.id]}</strong>{demandTag(save, here.id, it.id) && <em className="dim"> {demandTag(save, here.id, it.id)}</em>}{depthFactor(save, here.id, it.id) < 0.97 && <em className="dim"> glutted here, price down {Math.round((1 - depthFactor(save, here.id, it.id)) * 100)}%</em>}</div>
                                                                    <span className="btnrow">
                                                                        {pillRankOf(it.id) !== null && <button type="button" className="btn secondary small" onClick={() => act(usePill(save, it.id))}>Use</button>}
                                                                        {USABLE.includes(it.id) && <button type="button" className="btn secondary small" onClick={() => act(useItem(save, it.id))}>Use</button>}
                                                                        {WEARABLE.includes(it.id) && <button type="button" className="btn secondary small" onClick={() => act(wearToggle(save, it.id))}>{wornLabel(save, it.id)}</button>}
                                                                        <button type="button" className="btn secondary small" onClick={() => act(sellItem(save, here.id, here.marketTier, it))}>Sell {sellPrice(save, here.id, here.marketTier, it)}</button>
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                                {mktNote && <p className="dim">{mktNote}</p>}
                                            </>
                                        )}
                                        <button type="button" className="linkbtn" onClick={() => setMarketOpen(false)}>Leave the stalls</button>
                                    </>
                                )}
                            </div>


                            <div className="panel" hidden={townTab !== 'world'}>{townTab === 'world' && <WorldMarket save={save} world={world} here={here} act={act} />}</div>
                            <div className="panel" hidden={townTab !== 'crafts'}>
                                <h3>🛠️ Crafts</h3>
                                <p className="dim">Basic crafts work in any town. Skill grows with practice.</p>
                                <div className="btnrow wrap">
                                    {(Object.keys(CRAFT_INFO) as CraftId[]).map(c => (
                                        <button key={c} type="button" className="btn secondary small" style={craftTab === c ? { background: '#c9a35a', color: '#1a1208', borderColor: '#c9a35a' } : undefined} onClick={() => setCraftTab(c)}>{CRAFT_INFO[c].icon} {CRAFT_INFO[c].name}</button>
                                    ))}
                                </div>
                                <p className="dim">{CRAFT_INFO[craftTab].blurb} <strong>{SKILL_NAMES[skillLevel(save, craftTab)]}</strong></p>
                                <p className="dim">Realm ceiling: you can only make things of your own realm ({REALMS[currentCult(save).realm]}) or lower. Skill does not lift it.</p>
                                {mktNote && <p className="dim" style={{ whiteSpace: 'pre-line' }}>{mktNote}</p>}
                                <CraftDepthPanel craft={craftTab} save={save} world={world} act={act} />
                                {RECIPES.filter(r => r.craft === craftTab).map(r => {
                                    const known = r.learnFee === undefined || knows(save, r.id);
                                    const studyLeft = studying(save, r.id);
                                    const tdays = studyDays(r, 'teacher'), bdays = studyDays(r, 'book');
                                    const why = missing(save, r);
                                    return (
                                        <div className="row-item" key={r.id}>
                                            <div>
                                                <strong>{r.gear ? '🛡️' : itemById(r.out)?.icon} {r.name}</strong>
                                                <div className="dim">{Object.entries(r.inputs).map(([id, n]) => `${n} ${itemById(id)?.name}`).join(', ')}{r.tool ? ` · ${itemById(r.tool)?.name}` : ''} · {Math.round(recipeChance(save, r) * 100)}%</div>
                                                {known && why && <div className="dim">{why}</div>}
                                            </div>
                                            {known
                                                ? <button type="button" className="btn secondary small" disabled={!!why} onClick={() => act(craftIt(save, r))}>Make</button>
                                                : studyLeft > 0 ? <span className="dim">📖 {studyLeft} days</span> : <div className="btnrow wrap"><button type="button" className="btn secondary small" onClick={() => act(learnRecipe(save, r))}>Teacher {r.learnFee}{tdays ? ` (${tdays}d)` : ''}</button>{bdays > 0 && <ManualBtn save={save} here={here} target={r.id} act={act} />}</div>}
                                        </div>
                                    );
                                })}
                            </div>


                            <div className="panel" hidden={townTab !== 'board'}>
                                <h3>📋 Bounty board</h3>
                                {(() => {
                                    const js = getJobs(save);
                                    const active = js.active.filter(a => a.due >= save.clockDays);
                                    const offers = boardFor(world, save, here);
                                    return (
                                        <>
                                            <p className="dim">Standing: <strong>{repTitle(js.rep)}</strong> · {js.done.length} errand{js.done.length === 1 ? '' : 's'} done. Good standing pays up to 30% more.</p>
                                            {active.length > 0 && <h4>Your errands</h4>}
                                            {active.map(j => {
                                                const st = jobStatus(world, save, j);
                                                return (
                                                    <div className="row-item" key={j.id}>
                                                        <div><strong>{j.title}</strong><div className="dim">💎 {j.reward} · {Math.ceil(j.due - save.clockDays)} days left{!st.ready ? ` · ${st.why}` : ''}</div></div>
                                                        <span className="btnrow">
                                                            <button type="button" className="btn secondary small" disabled={!st.ready} onClick={() => act(finishJob(world, save, j.id))}>{j.kind === 'parcel' ? 'Deliver' : 'Hand over'}</button>
                                                            <button type="button" className="btn secondary small" onClick={() => act(dropJob(save, j.id))}>Drop</button>
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            <h4>{here.name} notice board</h4>
                                            {offers.length === 0 && <p className="dim">Nothing new is posted. Check back next month.</p>}
                                            {offers.map(j => (
                                                <div className="row-item" key={j.id}>
                                                    <div><strong>{j.title}</strong><div className="dim">💎 {j.reward} · {Math.ceil(j.due - save.clockDays)} days</div></div>
                                                    <button type="button" className="btn secondary small" onClick={() => act(acceptJob(save, j))}>Take</button>
                                                </div>
                                            ))}
                                        </>
                                    );
                                })()}
                            </div>


                            <div className="panel" hidden={townTab !== 'people'}>
                                <h3>🏘️ People of {here.name}</h3>
                                {(() => { const ppl = peopleIn(here); const prow = (p: typeof ppl[number]) => {
                                    const b = bondOf(save, p);
                                    return (
                                        <div className="row-item" key={p.id}>
                                            <div><strong>{ROLE_INFO[p.role].icon} {p.name}</strong><div className="dim">{ROLE_INFO[p.role].title}{p.trait ? ` · ${p.trait}` : ''} · {bondWord(b.aff)}{b.favour ? ' · favour spent' : ''}</div></div>
                                            <span className="btnrow">
                                                <button type="button" className="btn secondary small" onClick={() => act(chat(save, p))}>Chat</button>
                                                <button type="button" className="btn secondary small" onClick={() => act(gift(save, p))}>Gift {GIFT}</button>
                                                {b.aff >= 2 && <button type="button" className="btn secondary small" onClick={() => act(shareWine(save, p))}>🍶 Wine</button>}
                                                {b.aff >= FAVOUR_AT && <button type="button" className="btn secondary small" onClick={() => act(swapPointers(save, p))}>🧠 Pointers</button>}
                                                {b.aff >= FAVOUR_AT && !b.favour && <button type="button" className="btn small" onClick={() => act(askFavour(save, p))}>Ask a favour</button>}
                                            </span>
                                        </div>
                                    );
                                }; return <>{ppl.slice(0, 4).map(prow)}{ppl.length > 4 && <details><summary>+{ppl.length - 4} more people</summary>{ppl.slice(4).map(prow)}</details>}</>; })()}
                                <p className="dim">Chat once a month; gifts speed things up. Friends do favours once.</p>
                                {(() => {
                                    const comp = save.companion ?? null;
                                    const discs = save.disciples ?? [];
                                    const cdLeft = comp ? Math.max(0, DUAL_COOLDOWN - (save.clockDays - comp.lastDual)) : 0;
                                    return (
                                        <>
                                            <h4>💞 Dao companion</h4>
                                            {comp ? (
                                                <div className="row-item">
                                                    <div><strong>{comp.name}</strong><div className="dim">Realm {comp.realm ?? 0} · {comp.duals ?? 0} sessions · fights beside you in battle. {cdLeft > 0 ? `Rest ${Math.ceil(cdLeft)} more days before the next dual cultivation.` : 'Ready for dual cultivation: +20% of a stage, no toxicity.'}</div></div>
                                                    <button type="button" className="btn secondary small" disabled={cdLeft > 0} onClick={() => act(dualCultivate(save))}>Cultivate together</button>
                                                </div>
                                            ) : <p className="dim">Befriend someone to Sworn friend ({SWORN_AT}) and invite them to walk the Dao beside you.</p>}
                                            {!comp && peopleIn(here).filter(p => bondOf(save, p).aff >= SWORN_AT).map(p => (
                                                <div className="row-item" key={'c' + p.id}><div><strong>{p.name}</strong><div className="dim">Sworn friend</div></div><button type="button" className="btn small" onClick={() => act(inviteCompanion(save, p))}>Invite</button></div>
                                            ))}
                                            <h4>🎓 Disciples ({discs.length}/{MAX_DISCIPLES})</h4>
                                            {discs.map((d, i) => (
                                                <div className="row-item" key={d.name + i}>
                                                    <div><strong>{d.name}</strong><div className="dim">Realm {d.realm ?? 0} · talent {d.talent.toFixed(2)} · sends about {discipleTribute(save, d)} stones a year</div></div>
                                                    <div className="col"><button type="button" className="btn small" onClick={() => act(instruct(save, i))}>Instruct</button>{getSect(save) && (d.realm ?? 0) >= 3 && <button type="button" className="btn secondary small" onClick={() => act(graduateToSect(save, i))}>To sect</button>}<button type="button" className="btn secondary small" onClick={() => setSave({ ...dismissDisciple(save, i), savedAt: Date.now() })}>Dismiss</button></div>
                                                </div>
                                            ))}
                                            {discs.length < MAX_DISCIPLES && <button type="button" className="btn secondary" onClick={() => act(takeDisciple(save, here))}>Take a disciple ({DISCIPLE_FEE} stones, Foundation Establishment and up)</button>}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="panel" hidden={townTab !== 'powers'}>
                                <h3>⛩️ Powers here</h3>
                                {(() => {
                                    const seated = (here.seatForceIds ?? []).map(id => world.forceById.get(id)).filter(Boolean) as Force[];
                                    const sway = (world.prefectureById.get(here.prefectureId)?.forceIds ?? [])
                                        .map(id => world.forceById.get(id)).filter(Boolean) as Force[];
                                    const swayOnly = sway.filter(f => !seated.some(s => s.id === f.id));
                                    if (seated.length === 0 && swayOnly.length === 0) return <p className="dim">No force holds this place. The wilds keep their own law.</p>;
                                    return (
                                        <>
                                            {seated.length === 0 && <p className="dim">No force is headquartered in {here.name}. You can only join a power at its seat.</p>}
                                            {rankByPower(world, save, seated).map(({ f, rank }) => (
                                                <div className="force-row" key={f.id}>
                                                    <span><b className="rk">#{rank}</b> {f.kind === 'sect' ? '⛩️' : '🏠'} {f.name}{f.hegemon ? ' 👑' : ''} <em className={`sway ${swayState(save, f, world).trend}`}>{swayState(save, f, world).arrow} {swayState(save, f, world).word}</em></span>
                                                    {membership?.forceId === f.id
                                                        ? <em className="dim">Your force</em>
                                                        : <button type="button" className="btn secondary small" onClick={() => applyTo(f)}>Apply to join</button>}
                                                </div>
                                            ))}
                                            {swayOnly.length > 0 && (
                                                <div className="dim sway-list">
                                                    <div>Also holding sway in {here.prefecture}:</div>
                                                    {rankByPower(world, save, swayOnly).slice(0, 3).map(({ f, rank }) => <div key={f.id} className="sway-row"><b className="rk">#{rank}</b> {f.kind === 'sect' ? '🏯' : '🏠'} {f.name}</div>)}
                                                    {swayOnly.length > 3 && <details><summary>+{swayOnly.length - 3} more</summary>{rankByPower(world, save, swayOnly).slice(3).map(({ f, rank }) => <div key={f.id} className="sway-row"><b className="rk">#{rank}</b> {f.kind === 'sect' ? '🏯' : '🏠'} {f.name}</div>)}</details>}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                {verdict && <p className="verdict">{verdict}</p>}
                            </div>

                            {memberForce && memberCity && memberCity.id === here.id && (
                                <div className="panel">
                                    <h3>📚 Sect library</h3>
                                    <p className="dim">The {memberForce.name} opens its shelves to outer disciples. Techniques and spells here follow the sect's element; deeper halls open as you rise.</p>
                                    {libraryFor(memberForce, save.char).map(e => {
                                        const info = e.kind === 'technique' ? techById(e.id) : spellById(e.id);
                                        if (!info) return null;
                                        const known = (e.kind === 'technique' ? arts.techniques : arts.spells).some(a => a.id === e.id);
                                        return (
                                            <div className="force-row" key={e.id}>
                                                <span>{ELEMENT_ICON[info.element]} {info.name}<small className="dim"> · {e.kind} · {GRADES[info.grade]}{affTag(save, e.kind, info.element)}</small></span>
                                                {known ? <em className="dim">Known</em> : <button type="button" className="btn secondary small" onClick={() => learnArt(e)}>Learn</button>}
                                            </div>
                                        );
                                    })}
                                    {artNote && <p className="verdict">{artNote}</p>}
                                </div>
                            )}

                            <div className="panel">
                                <h3>🥾 The road</h3>
                                <p className="dim">Pick a destination on the map. Time passes while you travel.</p>
                                <button type="button" className="btn primary" onClick={() => setTab('map')}>Open the map</button>
                            </div>
                            </>}
                        </>
                    )}

                    {save.log.length > 0 && (
                        <div className="log">
                            {save.log.slice(0, 4).map((l, i) => <div key={i} className="log-line">{l}</div>)}
                        </div>
                    )}
                </div>
            )}

            {tab === 'profile' && (
                <div className="attrs">
                    <div className="profile-head">
                        <span className="profile-avatar big">{save.char.avatar ?? ROOT_AVATARS[save.char.root]}</span>
                        <div>
                            <div className="profile-title">{save.char.surname} {save.char.given}</div>
                            <div className="dim">Age {ageYears(save.clockDays)} of {lifespanYears(save, currentCult(save).realm).toLocaleString('en-US')} · {stageLabel(currentCult(save))}</div>
                        </div>
                        <button type="button" className="btn secondary small" onClick={() => setTab(prevTab)}>Back</button>
                    </div>
                    {ATTRS.map(k => {
                        const d = describeAttr(k, save.char, world);
                        return (
                            <div className={`attr rarity-${d.rarity}`} key={k}>
                                <div className="attr-body">
                                    <div className="attr-label">{ATTR_LABELS[k]}</div>
                                    <div className="attr-value">{d.value}</div>
                                    {d.effect && <div className="attr-effect">{d.effect}</div>}
                                </div>
                            </div>
                        );
                    })}
                    <div className="attr">
                        <div className="attr-body">
                            <div className="attr-label">Spirit stones</div>
                            <div className="attr-value">💎 {Math.floor(getEco(save).stones)}</div>
                            <div className="attr-effect">Earned from your sect, selling loot and secret realms.</div>
                        </div>
                    </div>
                    <div className="attr rarity-good">
                        <div className="attr-body">
                            <div className="attr-label">Cultivation</div>
                            <div className="attr-value">{stageLabel(currentCult(save))}</div>
                            <div className="attr-effect">{Math.floor(currentCult(save).progress)} / {stageCost(currentCult(save).realm, currentCult(save).stage)} toward the next stage.</div>
                        </div>
                    </div>
                    {memberForce && membership && (
                        <div className="attr rarity-good">
                            <div className="attr-body">
                                <div className="attr-label">Force</div>
                                <div className="attr-value">{memberForce.name}</div>
                                <div className="attr-effect">{SECT_RANKS[sectRankIndex(save)].name} · joined {formatDuration(Math.max(0, save.clockDays - membership.sinceDays) * 24)} ago{memberCity ? ` · seat: ${memberCity.name}` : ''}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === 'arts' && (
                <div className="home">
                    <div className="panel">
                        <h3>☯️ Cultivation techniques</h3>
                        <p className="dim">The active technique shapes cultivation speed. Mastery grows through meditation. Slots: {arts.techniques.length}/{MAX_TECHNIQUES}.</p>
                        {arts.techniques.map(a => {
                            const t = techById(a.id); if (!t) return null;
                            const m = masteryOf(t.grade, a.points);
                            const active = arts.activeTechnique === a.id;
                            const eff = techniqueMult(save.char, { ...arts, activeTechnique: a.id });
                            return (
                                <div className={`art ${active ? 'active' : ''}`} key={a.id}>
                                    <div className="art-head">
                                        <strong>{ELEMENT_ICON[t.element]} {t.name}</strong>
                                        <span className="dim">{GRADES[t.grade]} · {MASTERY_TIERS[m.tier]}{techniqueSpeed(save.char, t.element) !== 1 ? ` · speed x${techniqueSpeed(save.char, t.element)}` : ''}</span>
                                    </div>
                                    <div className="cult-bar small"><div className="cult-fill" style={{ width: `${m.maxed ? 100 : (m.into / m.need) * 100}%` }} /></div>
                                    <p className="dim">{t.blurb} Rate x{eff ? eff.mult.toFixed(2) : '1.00'}. Talent: {m.tier >= 1 ? `x${a.talent.toFixed(2)}` : 'hidden until Small Success'}.</p>
                                    <div className="art-actions">
                                        {active ? <em className="dim">Active</em> : <button type="button" className="btn secondary small" onClick={() => setArts({ ...arts, activeTechnique: a.id }, `You switched your meditation to ${t.name}.`)}>Practice this</button>}
                                        {a.id !== 'tech-basic' && <button type="button" className="linkbtn" onClick={() => forgetArt('technique', a.id)}>Forget</button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="panel">
                        <h3>✨ Spells and arts</h3>
                        <p className="dim">Active arts with their own mastery. Drilling one slows meditation by 25%. Combat is not in the game yet; these are being prepared for it. Slots: {arts.spells.length}/{MAX_SPELLS}.</p>
                        {arts.spells.length === 0 && <p className="dim">You know no spells yet. Join a sect and visit its library, or find a manual on the road.</p>}
                        {arts.spells.map(a => {
                            const sp = spellById(a.id); if (!sp) return null;
                            const m = masteryOf(sp.grade, a.points);
                            const drilling = arts.practicing === a.id;
                            return (
                                <div className={`art ${drilling ? 'active' : ''}`} key={a.id}>
                                    <div className="art-head">
                                        <strong>{ELEMENT_ICON[sp.element]} {sp.name}</strong>
                                        <span className="dim">{GRADES[sp.grade]} {sp.kind} · {MASTERY_TIERS[m.tier]}{affinityMult(save.char, sp.element).note ? ` · ${affinityMult(save.char, sp.element).note}` : ''}</span>
                                    </div>
                                    <div className="cult-bar small"><div className="cult-fill" style={{ width: `${m.maxed ? 100 : (m.into / m.need) * 100}%` }} /></div>
                                    <p className="dim">{sp.blurb} Talent: {m.tier >= 1 ? `x${a.talent.toFixed(2)}` : 'hidden until Small Success'}.</p>
                                    <div className="art-actions">
                                        <button type="button" className="btn secondary small" onClick={() => setArts({ ...arts, practicing: drilling ? null : a.id }, drilling ? `You stopped drilling ${sp.name}.` : `You begin drilling ${sp.name} between meditations.`)}>{drilling ? 'Stop drilling' : 'Drill this'}</button>
                                        <button type="button" className="linkbtn" onClick={() => forgetArt('spell', a.id)}>Forget</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="panel">
                        <h3>🗝️ Where arts are found</h3>
                        <p className="dim">Sect libraries (join a force at its seat, then visit Home there). Markets and secret realms that take months to open are coming in later slices.</p>
                    </div>
                </div>
            )}

            {tab === 'map' && (
                <div className={`map-page${selected ? ' sheet-open' : ''}`}>
                    <MapView
                        world={world}
                        locationId={save.travel ? null : save.locationId}
                        travelingToId={travelingTo?.id ?? null}
                        selectedId={selectedId}
                        season={seasonOf(save.clockDays)}
                        year={Math.floor(save.clockDays / 360)}
                        onSelect={onSelectCity}
                    />
                    <button type="button" className="map-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu">☰ Menu</button>
                    {hintOpen && !selected && (
                        <div className="map-toast" onClick={dismissHint}>Drag to explore · pinch or +/− to zoom · tap a place for details. Home: <b>{here?.name ?? 'unknown'}</b> <u>Got it</u></div>
                    )}
                    {selected ? (
                        <div className="sheet" style={sheetDy ? { transform: `translateY(${sheetDy}px)`, transition: 'none' } : undefined}>
                            <div className="sheet-grab"
                                onPointerDown={e => { dragY.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                                onPointerMove={e => { if (dragY.current !== null) setSheetDy(Math.max(0, e.clientY - dragY.current)); }}
                                onPointerUp={() => { if (sheetDy > 70) setSelectedId(null); setSheetDy(0); dragY.current = null; }}
                                onPointerCancel={() => { setSheetDy(0); dragY.current = null; }}
                                aria-label="Drag down to close"><i /></div>
                            <div className="sheet-head">
                                <h2>{selected.name}</h2>
                                <button type="button" className="close" onClick={() => setSelectedId(null)} aria-label="Close">✕</button>
                            </div>
                            <p className="sheet-sum">{BIRTHPLACE_LABEL[selected.tier]} · {selected.prefecture}, {selected.continent}</p>
                            {here && selected.id !== here.id && !save.travel && (
                                <div className="sheet-travel">
                                    <p>🥾 On foot: {Math.round(distanceLi(here, selected)).toLocaleString()} li · {formatDuration(travelHours(here, selected))}</p>
                                    {(() => { const rr = roadRisk(world, save, here, selected); return (rr.harm + rr.death) >= 0.005 ? <p className={rr.death >= 0.05 ? 'risk hot' : 'risk'}>⚠️ Road risk: robbery or injury {Math.round(rr.harm * 100)}%{rr.death >= 0.005 ? ` · death ${rr.death < 0.01 ? '<1' : Math.round(rr.death * 100)}%` : ''}</p> : <p className="risk">The road is safe.</p>; })()}
                                    <button type="button" className="btn primary" disabled={Boolean(save.exp)} onClick={() => startTravel(selected)}>{save.exp ? "Finish the secret realm first" : "Travel here"}</button>
                                    <p className="sheet-note">Mounts and flying swords come with cultivation. Time passes while you travel.</p>
                                </div>
                            )}
                            {selected.id === save.locationId && !save.travel && (
                                <p className="sheet-note">You are here. Market, local powers and joining a force are on the Home tab.</p>
                            )}
                            {save.travel && <p className="sheet-note">You are on the road. Finish or abandon the journey first.</p>}
                            <details className="sheet-more"><summary>About this place</summary>
                            <div className="sheet-facts">
                                <div><span>Size</span>{BIRTHPLACE_LABEL[selected.tier]}</div>
                                <div><span>Danger</span><b className={regionDanger(world, selected) >= 2 ? 'dz hot' : 'dz'}>{REGION_WORDS[regionDanger(world, selected)]}</b>{beastTerritory(world, selected) ? ' · beast territory' : ''}</div>
                                <div><span>Now</span>{fortuneState(save, selected).icon} {fortuneState(save, selected).word}</div>
                                <div><span>Region</span>{selected.country}, {selected.prefecture}</div>
                                <div><span>Continent</span>{selected.continent}</div>
                                <div className="sheet-powers"><span>Powers</span>{(() => {
                                    const ids = world.prefectureById.get(selected.prefectureId)?.forceIds ?? [];
                                    const fs = ids.map(id => world.forceById.get(id)).filter(Boolean);
                                    if (fs.length === 0) return <em>Unclaimed wilds</em>;
                                    return (
                                        <ul>
                                            {rankByPower(world, save, fs as Force[]).map(({ f: ff, rank, power, arrow, trend }) => { const f = ff as Force | undefined; return (
                                                <li key={f!.id}>
                                                    <b className="rk">#{rank}</b> {f!.kind === 'sect' ? '⛩️' : '🏠'} {f!.name} <span className="pw">{power}</span> <em className={`sway ${trend}`}>{arrow}</em>
                                                    {f!.hegemon && <i title="Rules several prefectures"> 👑 hegemon</i>}
                                                </li>); })}
                                        </ul>
                                    );
                                })()}</div>
                                {selected.seatForceIds && selected.seatForceIds.length > 0 && (
                                    <div className="sway-list"><span>{selected.seatForceIds.length > 1 ? 'Seats' : 'Seat of'}</span>
                                        {(() => { const fs2 = selected.seatForceIds.map(id => world.forceById.get(id)).filter(Boolean) as Force[]; const row = (f: Force) => <div key={f.id} className="sway-row">{f.kind === 'sect' ? '⛩️' : '🏠'} {f.name}</div>; return <>{fs2.slice(0, 3).map(row)}{fs2.length > 3 && <details><summary>+{fs2.length - 3} more</summary>{fs2.slice(3).map(row)}</details>}</>; })()}
                                    </div>
                                )}
                                <div><span>Market</span>{MARKET_TIERS[selected.marketTier]}</div>
                            </div>
                            </details>
                        </div>
                    ) : null}
                </div>
            )}

            {tab === 'journal' && (
                <div className="panel">
                    <h3>📜 Journal</h3>
                    <p className="dim">The last 30 events of this life, newest first.</p>
                    {(save.journal ?? []).length === 0 && save.log.length === 0 && <p className="dim">Empty so far.</p>}
                    {(save.journal ?? []).map((j, i) => <div className="relative" key={i}><span className="dim">{formatClock(j.d)}</span><div>{j.t}</div></div>)}
                    {(save.journal ?? []).length === 0 && save.log.map((l, i) => <div className="relative" key={i}><div>{l}</div></div>)}
                </div>
            )}

            {tab === 'family' && (
                <div className="panel">
                    <h3>👪 Family</h3>
                    <p className="dim">{BIRTH_LABEL[save.birth ?? 'common']}. Kin live in {world.cityById.get(save.char.birthplaceId)?.name ?? 'the birthplace'}. Bonds fade with neglect.</p>
                    {(save.family ?? []).length === 0 && <p className="dim">No family is recorded for this life.</p>}
                    {(save.family ?? []).map(r => (
                        <details className={`relative ${r.alive ? '' : 'gone'}`} key={r.id}>
                            <summary className="rel-top"><strong>{r.name}</strong> <span className="dim">{relTerm(r, save.char.gender)}{r.alive ? ` · ${relAge(r, save.clockDays)}` : ' · gone'}</span></summary>
                            <div className="dim">{r.alive ? `Age ${relAge(r, save.clockDays)} of ~${relLifespan(r)} · ${relLabel(r)}` : `Died of ${r.cause} · age ${relAge(r, r.diedDay ?? 0)} · ${relLabel(r)}`}</div>
                            {r.alive && <div className="meter"><i style={{ width: `${Math.round(r.meter)}%` }} /></div>}
                            {r.alive && <details className="kin-acts"><summary>Do something together</summary><div className="btnrow wrap">{ACTS.map(a => <button type="button" key={a.id} className="btn secondary small" onClick={() => { const res = a.id === 'ask' ? familyAsk(save, r) : interact(save, r.id, a.id, save.locationId === save.char.birthplaceId && !save.travel && !save.exp); setSave({ ...res.save, savedAt: Date.now() }); setMktNote(res.msg); }}>{a.label}</button>)}</div></details>}
                        </details>
                    ))}
                    <div className="btnrow wrap">
                        <button type="button" className="btn secondary small" onClick={() => { const r = marry(save); setSave({ ...r.save, savedAt: Date.now() }); setMktNote(r.msg); }}>💍 {(save.char.gender ?? 'male') === 'male' ? 'Take a wife' : 'Take a husband'}</button>
                        <button type="button" className="btn secondary small" onClick={() => { const r = haveChild(save); setSave({ ...r.save, savedAt: Date.now() }); setMktNote(r.msg); }}>👶 Have a child</button>
                    </div>
                    {mktNote && <p className="verdict">{mktNote}</p>}
                </div>
            )}

            {tab === 'force' && (() => {
                const yr = Math.floor(save.clockDays / 360);
                const ps = powerAt(world, yr);
                const cont = world.continents.find(k => k.id === powCont) ?? world.continents[0];
                const inC = prefsInContinent(world, cont?.id ?? '', () => world.prefectures.filter(p => cont && pointInPolygon(p.centroid[0], p.centroid[1], cont.polygon)));
                const powerPanel = (
                    <div className="panel">
                        <h3>🗺️ Who holds what</h3>
                        <p className="dim">Year {yr + 1}. Wars move these borders. Pick a continent.</p>
                        <select className="cont-select" value={cont?.id} onChange={e => setPowCont(e.target.value)}>{world.continents.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
                        {inC.slice(0, 12).map(p => { const hid = ps.holder[p.id]; const hf = hid ? world.forceById.get(hid) : null; return <div className="relative" key={p.id}><strong>{p.name}</strong> <span className="dim">{hf ? `${hf.kind === 'sect' ? '🏯' : '🏠'} ${hf.name}${ps.fallen[hf.id] !== undefined ? ' (fallen)' : ''}` : 'unclaimed'}</span></div>; })}
                        {inC.length > 12 && <details><summary>+{inC.length - 12} more prefectures</summary>{inC.slice(12, 60).map(p => { const hid = ps.holder[p.id]; const hf = hid ? world.forceById.get(hid) : null; return <div className="relative" key={p.id}><strong>{p.name}</strong> <span className="dim">{hf ? hf.name : 'unclaimed'}</span></div>; })}</details>}
                        {inC.length === 0 && <p className="dim">No prefectures recorded here.</p>}
                    </div>
                );
                const os = getSect(save);
                const ownPanel = !os ? (
                    <div className="panel">
                        <h3>🏯 Raise your own banner</h3>
                        <p className="dim">Found a sect or a family dynasty of your own. Needs realm {FOUND_REALM}+ and {FOUND_COST} stones, in the city where the founder stands ({here?.name ?? 'none'}). A founder's followers' realms become the force's strength.</p>
                        <div className="pills"><button type="button" className={`pill ${sKind === 'sect' ? 'on' : ''}`} onClick={() => setSKind('sect')}>🏯 Sect</button><button type="button" className={`pill ${sKind === 'clan' ? 'on' : ''}`} onClick={() => setSKind('clan')}>👪 Dynasty</button></div>
                        <input className="cont-select" placeholder="Name of your banner" maxLength={28} value={sName} onChange={e => setSName(e.target.value)} />
                        <button type="button" className="btn small" onClick={() => here && act(foundSect(save, here.id, sName, sKind))}>Found it · {FOUND_COST}</button>
                        {foundVerdict(save, here?.id ?? null, sName) && <p className="dim">{foundVerdict(save, here?.id ?? null, sName)}</p>}
                    </div>
                ) : (
                    <div className="panel">
                        <h3>{os.kind === 'sect' ? '🏯' : '👪'} {os.name}</h3>
                        <p className="dim">Master's seat: {world.cityById.get(os.cityId)?.name} · rank #{sectRank(save, os)} in the world · {Math.round(rosterCount(os.roster))} cultivators · strength {Math.round(sectStrength(os))}</p>
                        <div className="pills" role="tablist">{([['hall', 'Hall'], ['build', 'Build'], ['powers', 'Powers'], ['news', 'Events']] as const).map(([k, nm]) => <button key={k} type="button" role="tab" aria-selected={sTab === k} className={`pill ${sTab === k ? 'on' : ''}`} onClick={() => setSTab(k)}>{nm}</button>)}</div>
                        {sTab === 'hall' && (<div>
                            <p>Treasury: <strong>{Math.round(os.treasury)}</strong> stones · room for {cap(os)} followers · hosts experts up to realm {expertCeiling(os)}</p>
                            <div className="packcat">Roster</div>
                            {os.roster.map((v, i) => v >= 0.5 ? <div className="relative" key={i}>Realm {i}: <strong>{Math.round(v)}</strong></div> : null).filter(Boolean).slice(0, 3)}
                            <details><summary>All realms</summary>{os.roster.map((v, i) => v >= 0.5 ? <div className="relative" key={i}>Realm {i}: {Math.round(v)}</div> : null)}</details>
                            <button type="button" className="btn secondary small" onClick={() => act(depositTreasury(save, 1000))}>Add 1000 stones</button>
                            <p className="dim">{os.wars} wars fought, {os.wins} won.{save.clockDays < os.peaceUntil ? ' A peace pact holds.' : ''}</p>
                        </div>)}
                        {sTab === 'build' && BUILDINGS.map(b => { const l = os.build[b.id] ?? 0; return (
                            <div className="row-item" key={b.id}><div><strong>{b.icon} {b.name} · Lv {l}</strong><div className="dim">{b.note}</div></div>
                                {l < MAX_BUILD && <button type="button" className="btn small" onClick={() => act(upgradeBuilding(save, b.id))}>Raise {buildCost(b, l)}</button>}</div>); })}
                        {sTab === 'powers' && (<div>
                            <div className="row-item"><div><strong>🧙 Invite an expert</strong><div className="dim">A guest elder of realm {Math.min(expertCeiling(os), Math.max(2, (save.cult?.realm ?? 0) - 1))}</div></div><button type="button" className="btn small" onClick={() => act(inviteExpert(save))}>Invite {EXPERT_COST(Math.min(expertCeiling(os), Math.max(2, (save.cult?.realm ?? 0) - 1)))}</button></div>
                            <div className="row-item"><div><strong>🌟 Help your elders</strong><div className="dim">Pills and vein qi push your senior elder up a realm.</div></div><button type="button" className="btn small" onClick={() => act(helpElders(save))}>Help</button></div>
                            <div className="row-item"><div><strong>🕊️ Sue for peace</strong><div className="dim">Ten years without raids.</div></div><button type="button" className="btn small" onClick={() => act(makePeace(save))}>Pay {Math.round(sectStrength(os) * 12)}</button></div>
                            <div className="packcat">Declare war</div>
                            {rivalsNear(save, os).map(r => <div className="row-item" key={r.f.id}><div><strong>{r.f.name}</strong><div className="dim">Strength {Math.round(r.str)} vs your {Math.round(sectStrength(os))}</div></div><button type="button" className="btn secondary small" onClick={() => act(declareWar(save, r.f.id))}>War</button></div>)}
                        </div>)}
                        {sTab === 'news' && (os.events.length ? os.events.slice(0, 6).map((e, i) => <div className="relative" key={i}>Year {Math.floor(e.d / 360) + 1}: {e.t}</div>) : <p className="dim">Quiet so far.</p>)}
                    </div>
                );
                const fid = save.membership?.forceId ?? save.char.affiliation?.forceId ?? null;
                const f = fid ? world.forceById.get(fid) : undefined;
                if (!f) return <><div className="panel"><h3>🏯 Force</h3><p className="dim">No banner yet. Join a sect, or a clan of your blood, at its headquarters and it will show here.</p></div>{ownPanel}{powerPanel}</>;
                const member = save.membership?.forceId === f.id;
                const hq = world.cityById.get(f.hqCityId);
                let h = 0; for (const ch of f.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
                const members = (f.hegemon ? 40000 : 800) + (h % (f.hegemon ? 60000 : 4000));
                const rk = SECT_RANKS[sectRankIndex(save)];
                const pos = f.kind === 'sect' ? (member ? `${rk.name} (${save.rank?.contrib ?? 0} contribution)` : 'Born within its walls, not yet sworn') : (member ? 'Sworn kin' : `Blood of the clan${save.birth && save.birth !== 'common' ? `, ${BIRTH_LABEL[save.birth]}` : ''}`);
                const inForce = !!f && (member || save.char.affiliation?.forceId === f.id);
                const dutyPanel = inForce ? (
                    <div className="panel">
                        <h3>📋 Duties and peers</h3>
                        <div className="pills" role="tablist">{([['duties', 'Duties'], ['peers', 'Fellow disciples']] as const).map(([k, nm]) => <button key={k} type="button" role="tab" aria-selected={dTab === k} className={`pill ${dTab === k ? 'on' : ''}`} onClick={() => setDTab(k)}>{nm}</button>)}</div>
                        {dTab === 'duties' && (() => { const ds = getDuty(save); return (<div>
                            {ds.active ? <p>{ds.active.duty.icon} {ds.active.ready ? 'Duty finished' : 'On duty'}: <strong>{ds.active.duty.title}</strong>. {ds.active.ready ? 'Claim it in Quests (Home > Path).' : `Back in ${Math.max(0, Math.ceil(ds.active.endsDay - save.clockDays))} days.`}</p> : <p className="dim">Pick a duty. It runs while you cultivate. {ds.done} completed.</p>}
                            {!ds.active && dutyBoard(save).map(d => <div className="row-item" key={d.id}><div><strong>{d.icon} {d.title}</strong><div className="dim">{d.days} days · +{d.contrib} contribution · {d.stones} stones · risk {Math.round(d.risk * 100)}%</div></div><button type="button" className="btn small" onClick={() => act(takeDuty(save, d))}>Take</button></div>)}
                        </div>); })()}
                        {dTab === 'peers' && (<div>
                            {fellowsOf(save, f!.id).slice(0, 4).map(p => { const r = relOf(save, p); return (
                                <div className="row-item" key={p.id}><div><strong>{TEMPER_INFO[p.temper].icon} {p.name}</strong><div className="dim">Realm {p.realm} · {TEMPER_INFO[p.temper].word} · {relWord(r.aff)}</div></div>
                                    <div className="col"><button type="button" className="btn small" onClick={() => act(chatFellow(save, p))}>Chat</button><button type="button" className="btn secondary small" onClick={() => act(sparFellow(save, p))}>Spar</button></div></div>); })}
                            <details><summary>More fellow disciples, gifts and favours</summary>{fellowsOf(save, f!.id).map(p => { const r = relOf(save, p); return (
                                <div className="row-item" key={p.id}><div><strong>{p.name}</strong><div className="dim">Realm {p.realm} · {relWord(r.aff)}</div></div>
                                    <div className="col"><button type="button" className="btn secondary small" onClick={() => act(giftFellow(save, p))}>Gift 25</button><button type="button" className="btn secondary small" onClick={() => act(mealFellow(save, p))}>🍜 Meal</button><button type="button" className="btn secondary small" onClick={() => act(studyFellow(save, p))}>📖 Study</button><button type="button" className="btn secondary small" onClick={() => act(askHelp(save, p))}>Ask help</button></div></div>); })}</details>
                        </div>)}
                    </div>
                ) : null;
                const held = world.prefectures.filter(p => ps.holder[p.id] === f.id);
                const mine = (save.news ?? []).filter(n => n.t.includes(f.name) || (f.surname ? n.t.includes(f.surname) : false)).slice(0, 8);
                return (
                    <>{ownPanel}{dutyPanel}<div className="panel">
                        <h3>🏯 {f.name}</h3>
                        <p className="dim">{f.kind === 'sect' ? 'Sect' : 'Clan'}{f.hegemon ? ' · Hegemon of its continent' : ''} · {f.kind === 'sect' ? forceAlignment(f) : 'bloodline'}</p>
                        <p>Your standing: <strong>{pos}</strong></p>
                        <p>Headquarters: {hq?.name ?? 'unknown'}</p>
                        <p>Territory now: {held.length} prefecture{held.length === 1 ? '' : 's'}{held.length ? ` (${held.slice(0, 4).map(p => p.name).join(', ')}${held.length > 4 ? '...' : ''})` : ''}{ps.fallen[f.id] !== undefined ? ' - this force has fallen' : ''}</p>
                        <p>Members: about {members.toLocaleString()}</p>
                        <p>Allegiance: {member ? `sworn since day ${save.membership?.sinceDays ?? 0}` : 'by birth'}</p>
                        <h4>Force news</h4>
                        {mine.length === 0 ? <p className="dim">Nothing is said of this banner yet.</p> : mine.map((n, i) => <p key={i} className="dim">{n.t}</p>)}
                    </div>{powerPanel}</>
                );
            })()}

            {tab === 'wealth' && (() => {
                const w = getWealth(save), eco = getEco(save);
                const board = sectBoard(save);
                const lots = here ? auctionLots(save, here.id, here.marketTier) : [];
                const homeCity = w.home ? world.cityById.get(w.home.cityId) : null;
                return (
                    <div className="panel wealth">
                        <h3>💰 Wealth</h3>
                        <p className="dim">💎 {Math.floor(eco.stones)} stones · income about {Math.round(yearlyIncome(save))} a year. Returns here are thin and arrive over decades.</p>
                        <div className="pills">
                            {([['shares', '📈', 'Sects'], ['home', '🏠', 'Home'], ['auction', '🔨', 'Auction'], ['funds', '🏦', 'Funds'], ['trade', '🏛️', 'Trade']] as ['shares' | 'home' | 'auction' | 'funds' | 'trade', string, string][]).map(([k, ic, nm]) => (
                                <button key={k} type="button" role="tab" aria-selected={wTab === k} className={`pill ${wTab === k ? 'on' : ''}`} onClick={() => setWTab(k)}><span>{ic}</span>{nm}</button>
                            ))}
                        </div>
                        {wTab === 'shares' && (
                            <div>
                                <div className="packcat">Top 10 sects and clans</div>
                                <p className="dim">Strength comes from each force's cultivators and their realms. Wars kill members and move the price. Dividend about {(DIVIDEND * 100).toFixed(1)}% a year. A fallen sect's shares are worthless. Holdings worth {Math.round(holdingsValue(save))} stones.</p>
                                {board.slice(0, boardAll ? 10 : 3).map(r => { const h = sharesOf(save, r.id); return (
                                    <div className="row-item" key={r.id}>
                                        <div><strong>#{r.rank} {r.name}</strong><div className="dim">{r.kind === 'sect' ? 'Sect' : 'Clan'} · {r.members} cultivators, strongest realm {r.top} · {r.price} stones a share{h.n > 0 ? ` · you hold ${h.n} (paid ${Math.round(h.cost)})` : ''}</div></div>
                                        <div className="col">
                                            <button type="button" className="btn small" onClick={() => act(buyShares(save, r.id, 1))}>Buy 1</button>
                                            {h.n > 0 && <button type="button" className="btn secondary small" onClick={() => act(sellShares(save, r.id, h.n))}>Sell all</button>}
                                        </div>
                                    </div>); })}
                                <button type="button" className="btn secondary small" onClick={() => setBoardAll(!boardAll)}>{boardAll ? 'Show top 3' : 'Show all 10'}</button>
                                {Object.keys(w.shares ?? {}).filter(id => !board.some(b => b.id === id)).map(id => { const h = sharesOf(save, id); const r = sectBoard(save, true).find(x => x.id === id); return r ? (
                                    <div className="row-item" key={id}><div><strong>{r.name}</strong><div className="dim">Outside the top 10 · {r.price} a share · you hold {h.n}</div></div><button type="button" className="btn secondary small" onClick={() => act(sellShares(save, id, h.n))}>Sell all</button></div>) : null; })}
                            </div>
                        )}
                        {wTab === 'home' && (
                            <div>
                                <div className="packcat">Your home</div>
                                {!w.home ? (
                                    <div className="row-item"><div><strong>{HOME_NAMES[1]}</strong><div className="dim">A place to cultivate and manage holdings. Here: {here?.name ?? 'on the road'}.</div></div>
                                        <button type="button" className="btn small" disabled={!here} onClick={() => here && act(buyHome(save, here.id, here.name))}>Buy {HOME_COST[1]}</button></div>
                                ) : (
                                    <div className="row-item"><div><strong>🏠 {HOME_NAMES[w.home.level]}</strong> <span className="dim">in {homeCity?.name}</span><div className="dim">Cultivating there: +{w.home.level * 3}% speed.</div></div>
                                        {w.home.level < 5 && <button type="button" className="btn small" onClick={() => act(upgradeHome(save))}>Upgrade {HOME_COST[w.home.level + 1]}</button>}</div>
                                )}
                                <div className="packcat">Assets</div>
                                {ASSETS.map(a => { const l = w.assets[a.id] ?? 0; return (
                                    <div className="row-item" key={a.id}>
                                        <div><strong>{a.icon} {a.name}</strong> <span className="dim">level {l}/{MAX_ASSET}</span><div className="dim">About {(a.income * 100).toFixed(1)}% a year of what you put in. Needs {HOME_NAMES[a.need]}.</div></div>
                                        {l < MAX_ASSET && <button type="button" className="btn secondary small" onClick={() => act(buyAsset(save, a.id))}>{l ? 'Upgrade' : 'Buy'} {assetCost(a, l)}</button>}
                                    </div>); })}
                            </div>
                        )}
                        {wTab === 'auction' && (
                            <div>
                                <div className="packcat">Auction house{here ? ` · ${here.name}` : ''}</div>
                                {lots.length === 0 ? <p className="dim">{here ? 'Only larger cities hold auctions.' : 'Auctions are held in towns.'}</p> : (
                                    <>
                                        <p className="dim">New lots each month. Bid at least the reserve. A rival bids in secret: win by outbidding, otherwise your stones come back.</p>
                                        {lots.map(l => { const own = (save.gearBag ?? []).some(x => x.uid === l.gear!.uid) || Object.values(save.gear ?? {}).some(x => x?.uid === l.gear!.uid); const b = bids[l.id] ?? reserve(l); return (
                                            <div className="row-item" key={l.id}>
                                                <div><strong>{l.icon} {l.label}</strong> <span className={`grade g${l.gear!.grade}`}>{GRADES[l.gear!.grade]}</span><div className="dim">{fxText(l.gear!, save)}</div><div className="dim">Reserve {reserve(l)} · bid {b}</div></div>
                                                <div className="col">
                                                    <button type="button" className="btn secondary small" onClick={() => setBids({ ...bids, [l.id]: Math.round(b * 1.15) })}>+15%</button>
                                                    <button type="button" className="btn small" disabled={own} onClick={() => act(bidLot(save, l, b))}>{own ? 'Won' : 'Bid'}</button>
                                                </div>
                                            </div>); })}
                                    </>
                                )}
                            </div>
                        )}
                        {wTab === 'trade' && (() => {
                            const ch = w.chamber;
                            const dests = ch ? world.cities.filter(c => c.id !== ch.cityId && c.marketTier >= 2 && c.continentId === world.cityById.get(ch.cityId)?.continentId && !ch.routes.some(r => r.b === c.id)).sort((a, b) => distanceLi(world.cityById.get(ch.cityId)!, a) - distanceLi(world.cityById.get(ch.cityId)!, b)).slice(0, 4) : [];
                            return (
                                <div>
                                    <div className="packcat">Chamber of Commerce</div>
                                    {!ch ? (
                                        <div className="row-item"><div><strong>🏛️ Found a chamber</strong><div className="dim">Open trade routes between towns and hire cultivators to guard each caravan. Needs a major trading city (you are in {here?.name ?? 'the wilds'}).</div></div>
                                            <button type="button" className="btn small" disabled={!here} onClick={() => here && act(foundChamber(save, here.id, here.name, here.marketTier))}>Found {CHAMBER_COST}</button></div>
                                    ) : (
                                        <>
                                            <div className="row-item"><div><strong>🏛️ {world.cityById.get(ch.cityId)?.name} Chamber</strong> <span className="dim">level {ch.level}/5 · routes {ch.routes.length}/{maxRoutes(ch.level)}</span><div className="dim">Higher levels run more routes and raise profit. Robbers and demons raid caravans; hired cultivators cut that risk.</div></div>
                                                {ch.level < 5 && <button type="button" className="btn secondary small" onClick={() => act(upgradeChamber(save))}>Upgrade {CHAMBER_UP[ch.level + 1]}</button>}</div>
                                            {ch.routes.map(r => { const ri = routeInfo(save, r); return (
                                                <div className="sheet" key={r.id}>
                                                    <strong>🛤️ {world.cityById.get(r.a)?.name} to {world.cityById.get(r.b)?.name}</strong>
                                                    <div className="dim">Net about {Math.round(ri.net)} a year (income {Math.round(ri.income)}, wages {ri.wages}) · raid risk {Math.round(ri.raid * 100)}% a year</div>
                                                    <div className="dim">{r.guards.length ? r.guards.map(g => GUARD_NAMES[g]).join(', ') : 'No guards. Caravans are easy prey.'}</div>
                                                    <div className="pills">
                                                        {[0, 1, 2, 3].map(g => <button key={g} type="button" className="btn secondary small" onClick={() => act(hireGuard(save, r.id, g))}>Hire {['Qi', 'Found.', 'Core', 'Soul'][g]} {GUARD_WAGE[g]}/yr</button>)}
                                                        {r.guards.length > 0 && <button type="button" className="btn secondary small" onClick={() => act(dismissGuard(save, r.id))}>Dismiss</button>}
                                                    </div>
                                                </div>); })}
                                            {ch.routes.length < maxRoutes(ch.level) && dests.length > 0 && <div className="packcat">Open a route</div>}
                                            {ch.routes.length < maxRoutes(ch.level) && dests.map(d => (
                                                <div className="row-item" key={d.id}><div><strong>{d.name}</strong><div className="dim">{Math.round(distanceLi(world.cityById.get(ch.cityId)!, d))} li</div></div><button type="button" className="btn small" onClick={() => act(addRoute(save, d.id))}>Open {routeBuildCost(ch.cityId, d.id)}</button></div>))}
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                        {wTab === 'funds' && (
                            <div>
                                <div className="packcat">Long-term funds</div>
                                {FUNDS.map(f => (
                                    <div className="row-item" key={f.id}>
                                        <div><strong>{f.icon} {f.name}</strong><div className="dim">{f.note}</div><div className="dim">Invested: {Math.round(fundValue(save, f.id))}</div></div>
                                        <div className="col">
                                            <button type="button" className="btn small" onClick={() => act(invest(save, f.id, 1000))}>Put 1000</button>
                                            {fundValue(save, f.id) > 0 && <button type="button" className="btn secondary small" onClick={() => act(withdraw(save, f.id))}>Withdraw</button>}
                                        </div>
                                    </div>))}
                            </div>
                        )}
                    </div>
                );
            })()}
            {tab === 'gear' && (() => {
                const eq = equipped(save), bag = gearBag(save);
                const slot = SLOTS.find(x => x.id === gearSlot) ?? null;
                const cands = slot ? bag.filter(x => x.kind === slot.kind) : [];
                const cur = slot ? eq[slot.id] ?? null : null;
                const stall = here ? gearStall(save, here.id, here.marketTier) : [];
                const tot = ['cult', 'bt', 'road', 'travel', 'craft', 'barter', 'life', 'luck', 'rival', 'calamity', 'tox'].filter(k => gearEffect(save, k) > 0);
                const card = (it: GearItem) => (<><strong>{it.icon} {it.name}</strong> <span className={`grade g${it.grade}`}>{GRADES[it.grade]}</span><div className="dim">{fxText(it, save)}{it.kind === 'artifact' && ` · level ${artifactLevel(save, it)}`}</div></>);
                return (
                    <div className="panel gear">
                        <h3>🛡️ Equipment</h3>
                        <p className="dim">{wearingSummary(save)}</p>
                        {tot.length > 0 && <p className="dim">{tot.map(k => fmtFx(k, gearEffect(save, k))).join(' · ')}</p>}
                        <div className="pills">
                            {['Body', 'Hands', 'Adornments', 'Treasures', 'Artifact', 'Stall'].map(gv => <button key={gv} type="button" className={`pill ${gearView === gv ? 'on' : ''}`} onClick={() => setGearView(gv)}>{gv === 'Adornments' ? 'Charms' : gv === 'Treasures' ? 'Gems' : gv === 'Artifact' ? 'Relic' : gv}</button>)}
                        </div>
                        {['Body', 'Hands', 'Adornments', 'Treasures', 'Artifact'].filter(grp => grp === gearView).map(grp => (
                            <div key={grp}>
                                <div className="slotgrid">
                                    {SLOTS.filter(x => x.group === grp).map(x => {
                                        const it = eq[x.id];
                                        return (
                                            <button type="button" key={x.id} className={`slot ${it ? `g${it.grade}` : 'empty'} ${gearSlot === x.id ? 'sel' : ''}`} onClick={() => { setGearSlot(gearSlot === x.id ? null : x.id); setTimeout(() => document.querySelector('.sheet')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60); }}>
                                                <span className="si">{it ? it.icon : x.icon}</span>
                                                <span className="sn">{it ? it.name : x.label}</span>
                                                <span className="sg">{it ? GRADES[it.grade] : 'empty'}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {slot && gearView !== 'Stall' && SLOTS.find(x => x.id === slot.id)?.group === gearView && (
                            <div className="sheet">
                                <h4>{slot.icon} {slot.label}</h4>
                                {cur && <div className="row-item"><div>{card(cur)}</div><button type="button" className="btn secondary small" onClick={() => act(unequip(save, slot.id))}>Remove</button></div>}
                                {cands.length === 0 && <p className="dim">Nothing in your bag fits this slot. Buy it from a gear stall or forge it in Crafts.</p>}
                                {cands.map(it => { const why = canWear(save, it); return (
                                    <div className="row-item" key={it.uid}>
                                        <div>{card(it)}{why && <div className="dim">{why}</div>}</div>
                                        <div className="col">
                                            <button type="button" className="btn small" disabled={!!why} onClick={() => act(equip(save, slot.id, it.uid))}>Equip</button>
                                            <button type="button" className="btn secondary small" onClick={() => act(sellGear(save, it.uid))}>Sell {Math.round(gearPrice(it) * 0.5)}</button>
                                        </div>
                                    </div>); })}
                            </div>
                        )}
                        {gearView !== 'Stall' && bag.length > 0 && !slot && <p className="dim">In your bag: {bag.length} piece{bag.length === 1 ? '' : 's'}. Tap a slot to equip.</p>}
                        {gearView === 'Stall' && <div className="packcat">Gear stall{here ? ` · ${here.name}` : ''}</div>}
                        {gearView === 'Stall' && (stall.length === 0 ? <p className="dim">{here ? 'This town has no gear stall. Larger markets sell better pieces.' : 'You are on the road. Gear stalls open in towns.'}</p> : (
                            <>
                                <p className="dim">Stock changes each month. Spirit grade needs Foundation Establishment, Earth grade Golden Core.</p>
                                {stall.map(it => { const sold = bag.some(b => b.uid === it.uid) || Object.values(eq).some(e => e?.uid === it.uid); return (
                                    <div className="row-item" key={it.uid}>
                                        <div>{card(it)}</div>
                                        <button type="button" className="btn secondary small" disabled={sold} onClick={() => act(buyGear(save, it))}>{sold ? 'Owned' : `Buy ${gearPrice(it)}`}</button>
                                    </div>); })}
                            </>
                        ))}
                    </div>
                );
            })()}
            {tab === 'bag' && (
                <div className="panel">
                    <h3>🎒 Inventory</h3>
                    <p className="stones">💎 {Math.floor(getEco(save).stones)} spirit stones{getEco(save).tox >= 1 ? ` · pill toxicity ${getEco(save).tox.toFixed(1)}${getEco(save).tox >= 6 ? ' (lethal soon)' : getEco(save).tox >= 4 ? ' (dangerous)' : ''}` : ''}</p>
                    {!ITEMS.some(it => (getEco(save).items[it.id] ?? 0) > 0) && <p className="dim">The pack is empty. Anything bought, gathered in a secret realm or inherited is kept here until used.</p>}
                    {PACK_ORDER.map(cat => {
                        const list = ITEMS.filter(it => catOf(it.id) === cat && (getEco(save).items[it.id] ?? 0) > 0);
                        if (!list.length) return null;
                        return (
                            <details key={cat} open={cat === 'pills' || cat === 'charms'} className="packgroup">
                                <summary>{CAT_INFO[cat].icon} {CAT_INFO[cat].name} <em className="dim">({list.reduce((a, it) => a + getEco(save).items[it.id], 0)})</em></summary>
                                {list.map(it => (
                                    <div className="row-item" key={it.id}>
                                        <div><strong>{it.icon} {it.name} x{getEco(save).items[it.id]}</strong>{isWorn(save, it.id) && <em className="dim"> · worn</em>}<div className="dim">{it.blurb}</div></div>
                                        <span className="btnrow">
                                            {pillRankOf(it.id) !== null && <button type="button" className="btn secondary small" onClick={() => act(usePill(save, it.id))}>Use</button>}
                                            {USABLE.includes(it.id) && <button type="button" className="btn secondary small" onClick={() => act(useItem(save, it.id))}>Use</button>}
                                            {WEARABLE.includes(it.id) && <button type="button" className="btn secondary small" onClick={() => act(wearToggle(save, it.id))}>{wornLabel(save, it.id)}</button>}
                                        </span>
                                    </div>
                                ))}
                            </details>
                        );
                    })}
                    <p className="dim">Learned arts live in the Arts tab. Pills and herbs sell at any market.</p>
                    {mktNote && <p className="verdict">{mktNote}</p>}
                </div>
            )}

            {tab === 'news' && (
                <div className="panel">
                    <h3>📰 World news</h3>
                    {(save.news ?? []).length === 0 ? <p className="dim">Quiet for now. Word travels slowly; give the world some months.</p> : (
                        <div className="feed">
                            {(save.news ?? []).map((n, i) => (
                                <div className={`feed-item k-${n.k}`} key={i}>
                                    <div className="feed-when">Year {Math.floor(n.d / 360) + 1} · Month {Math.floor((n.d % 360) / 30) + 1}</div>
                                    <div className="feed-text">{n.t}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'settings' && (
                <div className="time-tab">
                    <div className="panel">
                        <h3>Appearance</h3>
                        <div className="setting-row"><span>Theme</span><span className="chiprow">
                            {([['dark', 'Dark'], ['light', 'Light'], ['auto', 'Device']] as const).map(([k, n]) => <button key={k} type="button" className={`chip ${prefs.theme === k ? 'on' : ''}`} onClick={() => setPrefs({ theme: k })}>{n}</button>)}
                        </span></div>
                        <div className="setting-row"><span>Text size</span><span className="chiprow">
                            {([['s', 'Small'], ['m', 'Normal'], ['l', 'Large']] as const).map(([k, n]) => <button key={k} type="button" className={`chip ${prefs.text === k ? 'on' : ''}`} onClick={() => setPrefs({ text: k })}>{n}</button>)}
                        </span></div>
                        <div className="setting-row"><span>Calm mode (no animation)</span><button type="button" className={`chip ${prefs.calm ? 'on' : ''}`} aria-pressed={prefs.calm} onClick={() => setPrefs({ calm: !prefs.calm })}>{prefs.calm ? 'On' : 'Off'}</button></div>
                    </div>
                    <div className="panel">
                        <h3>Game speed</h3>
                        <div className="setting-row"><span>Speed</span><span className="chiprow">
                            <button type="button" className={`chip pause ${save.paused ? 'on' : ''}`} onClick={() => patch({ paused: !save.paused })}>{save.paused ? 'Paused' : 'Pause'}</button>
                            {SPEEDS.map((s, i) => <button key={s} type="button" className={`chip ${!save.paused && save.speed === i ? 'on' : ''}`} onClick={() => patch({ speed: i, paused: false })}>{s}x</button>)}
                        </span></div>
                        <p className="dim">At 1x, one real second is one day. Now: {save.paused ? 'paused' : `${SPEEDS[save.speed]}x`} · {formatClock(save.clockDays)}</p>
                        <div className="setting-row"><span>Offline progress</span>
                            <button type="button" className={`chip ${save.offlineEnabled ? 'on' : ''}`} onClick={() => patch({ offlineEnabled: !save.offlineEnabled })} aria-pressed={save.offlineEnabled}>{save.offlineEnabled ? 'On' : 'Off'}</button></div>
                        {save.offlineEnabled && <div className="setting-row"><span>Offline speed</span><span className="chiprow">{OFFLINE_SPEEDS.map((s, i) => <button key={s} type="button" className={`chip ${save.offlineSpeed === i ? 'on' : ''}`} onClick={() => patch({ offlineSpeed: i })}>{s}x</button>)}</span></div>}
                        <p className="dim">Time accrues from the device clock on return. Lifespan keeps ticking either way, so an idle life is still a life.</p>
                    </div>
                    <div className="panel">
                        <h3>This life</h3>
                        <p className="dim">Saved to this device automatically. Settings above stay across lives.</p>
                        <details><summary>Back up or restore</summary>
                            <p className="dim">Saves stay on this device and survive updates and downgrades. Keep a backup anyway before switching apps.</p>
                            <button type="button" className="btn secondary small" onClick={() => { try { void navigator.clipboard?.writeText(exportSave(save)); setMktNote('Save copied to the clipboard.'); } catch { setMktNote('Could not copy.'); } }}>Copy save to clipboard</button>
                            <textarea className="imp" rows={3} placeholder="Paste a copied save here" value={impText} onChange={e => setImpText(e.target.value)} />
                            <button type="button" className="btn secondary small" disabled={!impText.trim()} onClick={() => { const s = importSave(impText); if (s && onRestore) { onRestore(s); setImpText(''); setMktNote('Save loaded.'); } else setMktNote('That does not look like a save.'); }}>Load pasted save</button>
                            {backup && onRestore && <button type="button" className="btn secondary small" onClick={() => onRestore(backup.save)}>Restore the automatic safety copy ({Math.max(1, Math.round((Date.now() - backup.at) / 60000))} min old)</button>}
                            {mktNote && <p className="dim">{mktNote}</p>}
                        </details>
                        <details><summary>Abandon this life</summary>
                            <p className="dim">This ends the current life and starts a new one. It cannot be undone.</p>
                            <button type="button" className="btn danger" onClick={onAbandon}>Yes, abandon this life</button>
                        </details>
                        <details><summary>About</summary><p className="dim">Path of Nine Heavens, version {GAME_VERSION}. A text cultivation life in a world of ten thousand Earths.</p></details>
                    </div>
                </div>
            )}
        </div>
    );
}
