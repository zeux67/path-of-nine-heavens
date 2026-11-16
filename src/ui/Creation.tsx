import { GAME_VERSION } from '../game/version';
import { rollBirthStatus, birthPerks, generateFamily, BIRTH_LABEL } from '../game/family';
import { CAUSE_LABEL, inheritance, type Lineage } from '../game/fate';
import { REALMS } from '../game/data';
import React, { useState } from 'react';
import { ATTR_LABELS, AttrKey, Character, SaveGame, describeAttr, rollCharacter } from '../game/state';
import { mulberry32 } from '../game/rng';
import { AVATARS } from '../game/data';
import { World } from '../game/world';

// BitLife-style reroll screen: every attribute can be locked individually.

interface Props {
    world: World;
    char: Character;
    setChar: (c: Character) => void;
    onBegin: () => void;
    lineage?: Lineage | null;
}

const ATTRS: AttrKey[] = ['name', 'birthplace', 'affiliation', 'root', 'constitution', 'fate', 'luck', 'comprehension', 'alignment'];
const ATTR_ICONS: Record<AttrKey, string> = {
    name: '📛', birthplace: '🏠', affiliation: '🏯', root: '🌱', constitution: '💪',
    fate: '☯️', luck: '🍀', comprehension: '📖', alignment: '⚖️',
};

export function Creation({ world, char, setChar, onBegin, lineage }: Props) {
    const [locks, setLocks] = useState<Partial<Record<AttrKey, boolean>>>({});

    const reroll = () => {
        const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
        setChar(rollCharacter(rng, world, locks, char));
    };

    const toggleLock = (k: AttrKey) => setLocks(l => ({ ...l, [k]: !l[k] }));

    return (
        <div className="creation">
            <div className="creation-head">
                <div className="game-logo">☯️</div>
                <h1>Path of Nine Heavens</h1><p className="dim">version {GAME_VERSION}</p>
                <p className="tagline">Your fate is rolled, not chosen. Lock what you like, reroll the rest, then step onto the road. The world ahead is as vast as ten thousand Earths.</p>
            </div>
            {lineage && lineage.line.length > 0 && (
                <div className="legacy-card">
                    <div className="legacy-title">🏮 Generation {lineage.gen + 1}</div>
                    <div>Descendant of <strong>{lineage.line[lineage.line.length - 1].name}</strong>, who {lineage.line[lineage.line.length - 1].cause === 'old-age' ? 'died of old age' : 'fell to ' + CAUSE_LABEL[lineage.line[lineage.line.length - 1].cause].toLowerCase()} in the {REALMS[lineage.line[lineage.line.length - 1].realm]} realm.</div>
                    <div className="dim">{inheritance(lineage).blurb}</div>
                </div>
            )}
            <div className="panel who">
                <h3>Who walks the Path?</h3>
                <div className="pills">
                    {(['male', 'female'] as const).map(g => (
                        <button key={g} type="button" className={`pill ${(char.gender ?? 'male') === g ? 'on' : ''}`} onClick={() => setChar({ ...char, gender: g, avatar: AVATARS[g][0] })}>{g === 'male' ? '♂ Man' : '♀ Woman'}</button>
                    ))}
                </div>
                <div className="avatars">
                    {AVATARS[char.gender ?? 'male'].map(a => (
                        <button key={a} type="button" className={`avpick ${(char.avatar ?? AVATARS[char.gender ?? 'male'][0]) === a ? 'on' : ''}`} onClick={() => setChar({ ...char, avatar: a })} aria-label="Choose avatar">{a}</button>
                    ))}
                </div>
            </div>
            <div className="attrs">
                {ATTRS.map(k => {
                    const d = describeAttr(k, char, world);
                    const locked = Boolean(locks[k]);
                    return (
                        <div className={`attr rarity-${d.rarity}`} key={k}>
                            <button
                                type="button"
                                className={`lock ${locked ? 'on' : ''}`}
                                onClick={() => toggleLock(k)}
                                aria-label={locked ? `Unlock ${ATTR_LABELS[k]}` : `Lock ${ATTR_LABELS[k]}`}
                                aria-pressed={locked}
                            >{locked ? '🔒' : '🔓'}</button>
                            <div className="attr-body">
                                <div className="attr-label">{ATTR_ICONS[k]} {ATTR_LABELS[k]}</div>
                                <div className="attr-value">{d.value}</div>
                                {d.effect && <div className="attr-effect">{d.effect}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="creation-actions">
                <button type="button" className="btn secondary" onClick={reroll}>🎲 Reroll unlocked</button>
                <button type="button" className="btn primary" onClick={onBegin}>Begin your journey →</button>
            </div>
        </div>
    );
}

export function makeSave(world: World, char0: Character, lineage?: Lineage | null): SaveGame {
    const inh = inheritance(lineage);
    const perks0 = 0; void perks0;
    const char = inh.luck ? { ...char0, luck: char0.luck + inh.luck } : char0;
    const items: Record<string, number> = {};
    if (inh.qiPills) items['qi-pill'] = inh.qiPills;
    if (inh.btPill) items['bt-pill'] = 1;
    const fseed = Math.floor(Math.random() * 2 ** 31);
    const birth = rollBirthStatus(char, mulberry32(fseed));
    const perks = birthPerks(birth);
    return {
        family: generateFamily(char, fseed, birth),
        birth,
        lineage: lineage ?? null,
        eco: { stones: 30 + inh.stones + perks.stones, items, tox: 0 },
        v: 1,
        seed: world.seed,
        char,
        clockDays: 0,
        speed: 0,
        paused: false,
        offlineEnabled: true,
        offlineSpeed: 1,
        locationId: char.birthplaceId,
        travel: null,
        membership: char.affiliation?.forceId ? { forceId: char.affiliation.forceId, sinceDays: 0 } : null,
        log: [...(birth !== 'common' ? [`👑 ${BIRTH_LABEL[birth]}. ${perks.blurb}`] : []), ...(lineage ? [`🏮 ${inh.blurb}`] : []), `You were born in ${world.cityById.get(char.birthplaceId)?.name ?? 'a small village'}. The road awaits.`],
        savedAt: Date.now(),
    };
}
