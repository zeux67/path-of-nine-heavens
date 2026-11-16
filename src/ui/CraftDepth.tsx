import React from 'react';
import type { SaveGame } from '../game/state';
import type { World } from '../game/world';
import type { CraftId } from '../game/craft';
import { studying, skillLevel, repTier, getCx, getCraft, REP_TITLES, SKILL_NAMES } from '../game/craft';
import { getEco, itemById } from '../game/economy';
import { BEAST_STAGES, beastOf, beastRealm, beastCult, beastHeld, ascendBeast, BEAST_CATALYSTS, tameBeast, trialBeast, feedBeast, siteHere, claimCave, caveCost, orderInHand, canTakeOrder, takeCommission, deliverCommission, collectShed, shedReady, CROPS, plotsOf, plotDaysLeft, cropKnown, cropDays, cropFee, learnCrop, plant, harvest, growDays, puppetsOf, PUPPET_HP, mineStock, collectMine, repairPuppet, surveyLeft, survey, readFate, READ_COST, BLACK_ITEMS, blackAccess, blackPrice, sellBlack, takeContract, contractLeft } from '../game/craftx';
import { realmScale } from '../game/economy';
import { ManualBtn } from './ManualBtn';
import { buffOn, BUFF_INFO, currentCult } from '../game/cultivation';
import { REALMS } from '../game/data';

type Act = (r: { save: SaveGame; msg: string }) => void;
const Btn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => <button type="button" className="btn secondary small" disabled={disabled} onClick={onClick}>{children}</button>;

function CraftDepthInner({ craft, save, world, act }: { craft: CraftId; save: SaveGame; world: World; act: Act }) {
    const lv = skillLevel(save, craft);
    const here = world.cityById.get(save.locationId) ?? null;
    const tier = repTier(save, craft);
    const rep = getCx(save).rep?.[craft] ?? 0;
    const head = ['formation', 'beast', 'farming', 'geomancy', 'divination', 'puppet', 'poison'].includes(craft)
        ? <p className="dim">Standing: <strong>{REP_TITLES[tier]}</strong> ({Math.floor(rep)} points). Good work raises it, and every title adds 2% to your success rate in this craft. Respected: teachers charge 15% less. Renowned: 25% less, and you salvage one input from a spoiled batch.</p> : null;
    if (craft === 'formation') {
        const act2 = (['qiarray', 'ward', 'escape'] as const).filter(k => buffOn(save, k));
        return <div>{head}{act2.length ? <p className="dim">Working now: {act2.map(k => `${BUFF_INFO[k].icon} ${BUFF_INFO[k].name}`).join(', ')}. Use finished arrays from your Bag.</p> : <p className="dim">Finished arrays are used from your Bag: Gather-Qi for cultivation, Ward for the road, Illusion Escape for a deep realm, Guard and Trap in a fight.</p>}</div>;
    }
    if (craft === 'beast') {
        const b = beastOf(save); const left = shedReady(save);
        return (
            <div>{head}
                {b ? (
                    <div className="bcard">
                        <strong>🐾 {b.name} the {b.kind}</strong>
                        <div className="dim">Growth stage: {BEAST_STAGES[b.stage]} ({b.stage >= 3 ? 'fully grown' : `${b.xp} of ${[40, 110, 240][b.stage]} to the next stage`}). In a fight it matches {REALMS[Math.min(beastCult(save), Math.max(0, beastRealm(save) - 1))]} for now. Its growth stage holds back its strength until it grows.</div>
                        <div className="dim">Fights beside you with its own action (every 3 turns).{b.stage >= 1 ? ` Carries you: journeys ${b.stage * 10}% faster now (10% as a grown beast, 20% as a spirit beast, 30% as a true beast).` : ' A cub is too small to carry you. From a grown beast it makes journeys 10% faster, then 20%, then 30%.'}{b.stage >= 1 ? ` Sheds materials every 30 days (${left > 0 ? `${left} days left` : 'ready now'}).` : ''}</div>
                        <div className="dim">Beast realm: <strong>{REALMS[beastCult(save)]}</strong>{beastHeld(save) ? ` (you are ${REALMS[currentCult(save).realm]}). It cannot cross to the next major realm by feeding. Give it ONE of: Old Ginseng (reaches Golden Core), Spirit Fruit (up to Nascent Soul), a Beast Realm Pill (up to Deity Transformation) or a Demon Core (any realm).` : '. It grows alongside you. After your next major realm it will need a pill, rare material or demon core to follow.'}</div>
                        {beastHeld(save) && <div className="btnrow wrap">{BEAST_CATALYSTS.filter(c => (getEco(save).items[c[0]] ?? 0) > 0).map(c => <Btn key={c[0]} disabled={beastCult(save) + 1 > c[2]} onClick={() => act(ascendBeast(save, c[0]))}>{itemById(c[0])?.icon} Give {itemById(c[0])?.name} ({getEco(save).items[c[0]]})</Btn>)}{!BEAST_CATALYSTS.some(c => (getEco(save).items[c[0]] ?? 0) > 0) && <span className="dim">You hold none of these yet.</span>}</div>}
                        <div className="btnrow wrap"><Btn onClick={() => act(feedBeast(save))}>🍖 Feed ({getEco(save).items['beast-snack'] ?? 0})</Btn><Btn disabled={left !== 0} onClick={() => act(collectShed(save))}>🧵 Collect</Btn></div>
                    </div>
                ) : (
                    <div className="bcard"><div className="dim">No bonded beast. Taming uses a Taming Rope and 2 Spirit Beast Feed. Wilder land holds wilder beasts, and better skill lets you win them over.</div><div className="btnrow wrap"><Btn onClick={() => act(tameBeast(save, world))}>🐾 Try to tame a beast</Btn><Btn onClick={() => act(trialBeast(save, world))}>⚔️ Face a wild beast alone (3 days, no feed)</Btn></div><div className="dim">Beast Hollows in the secret realms sometimes let a cub follow you out, if you carry a Taming Rope.</div></div>
                )}
            </div>
        );
    }
    if (craft === 'farming') {
        const plots = plotsOf(save);
        return (
            <div>{head}
                <p className="dim">Plots: {plots.length} (more as your skill grows). Planting takes a seed, 1 Spirit Spring Water and a Seed Tray, then time. Better skill means a richer harvest.</p>
                {plots.map((p, i) => {
                    const c = p ? CROPS.find(x => x.id === p.crop)! : null; const left = p ? plotDaysLeft(save, p) : 0;
                    return (
                        <div className="row-item" key={i}>
                            <div><strong>Plot {i + 1}: {c ? `${c.icon} ${c.name}` : 'empty'}</strong>{c && <div className="dim">{left > 0 ? `${left} days to ripen` : 'Ripe. Ready to harvest.'}</div>}</div>
                            {c ? <Btn disabled={left > 0} onClick={() => act(harvest(save, i))}>Harvest</Btn> : null}
                        </div>
                    );
                })}
                {plots.some(p => !p) && <>
                    <p className="dim">Plant in the first empty plot:</p>
                    <div className="btnrow wrap">{CROPS.map(c => {
                        const slot = plots.findIndex(p => !p);
                        if (!cropKnown(save, c)) {
                            const left = studying(save, c.id);
                            if (left > 0) return <span key={c.id} className="dim">{c.icon} Studying {c.name}: {left} days</span>;
                            return <React.Fragment key={c.id}><Btn onClick={() => act(learnCrop(save, c))}>{c.icon} {c.name}: teacher {c.fee} ({cropDays(c, 'teacher')}d)</Btn><ManualBtn save={save} here={here} target={c.id} act={act} /></React.Fragment>;
                        }
                        return <Btn key={c.id} onClick={() => act(plant(save, slot, c))}>{c.icon} {c.name} ({growDays(save, c)}d)</Btn>;
                    })}</div>
                </>}
            </div>
        );
    }
    if (craft === 'geomancy') {
        const left = surveyLeft(save);
        return (
            <div>{head}
                <p className="dim">Survey the land where you stand: it warns of danger, foretells next month's secret-realm gate, and may turn up a hidden qi vein or a buried cache. Takes 3 days. Each town can be read once every 120 days.</p>
                <Btn disabled={left > 0} onClick={() => act(survey(save, world))}>🧭 Survey this land{left > 0 ? ` (${left} days)` : ''}</Btn>
                <p className="dim">Geomancy also shortens secret-realm trips by 5% per skill level (up to 25%). At Journeyman or better, a survey can chart a cave dwelling.</p>
                {getCx(save).cave && <p className="dim">🏔️ Your cave dwelling is near {world.cityById.get(getCx(save).cave!.at)?.name ?? 'a distant town'}. Cultivation +10% there, and raiders find you 25% less.</p>}
                {siteHere(save) && getCx(save).cave?.at !== save.locationId && <Btn onClick={() => act(claimCave(save, world))}>🏔️ Open and ward the cave here ({caveCost(save)} stones)</Btn>}
            </div>
        );
    }
    if (craft === 'divination') {
        const cost = Math.round(READ_COST * realmScale(save));
        return (
            <div>{head}
                <p className="dim">Cast the shells to glimpse events that may find you soon. Low skill gives false readings sometimes. Masters can be hit by backlash (half a year of life).</p>
                <div className="btnrow wrap"><Btn onClick={() => act(readFate(save, world, 'stones'))}>🔮 Read for {cost} stones</Btn><Btn onClick={() => act(readFate(save, world, 'life'))}>⏳ Read for 1 year of life</Btn></div>
            </div>
        );
    }
    if (craft === 'puppet') {
        const list = puppetsOf(save); const stock = mineStock(save);
        return (
            <div>{head}
                <p className="dim">Your skill commands {1 + lv} puppet{lv === 0 ? '' : 's'} at once. Deploy finished puppets from your Bag. Guards stand before you in every fight and wear down. Miners dig while you cultivate.</p>
                {list.length === 0 && <p className="dim">No puppets deployed.</p>}
                {list.map((p, i) => (
                    <div className="row-item" key={i}>
                        <div><strong>{p.kind === 'guard' ? '🤖 Guard puppet' : '⛏️ Mining puppet'}</strong><div className="dim">Condition {p.hp} of {PUPPET_HP}{p.hp <= 0 ? ' (broken)' : ''}</div></div>
                        <Btn disabled={p.hp >= PUPPET_HP} onClick={() => act(repairPuppet(save, i))}>Repair</Btn>
                    </div>
                ))}
                {list.some(p => p.kind === 'miner') && <Btn disabled={stock < 1} onClick={() => act(collectMine(save))}>⛏️ Collect {stock} stones</Btn>}
            </div>
        );
    }
    if (craft === 'poison') {
        const access = blackAccess(save); const cl = contractLeft(save);
        return (
            <div>{head}
                {!access ? <p className="risk hot">🕶️ The black market does not know you. It deals with the demonic, or a poisoner at Journeyman skill.</p> : (
                    <>
                        <p className="dim">🕶️ The black market buys poisons at more than twice their price. Every sale and contract marks your karma{save.char.alignment === 'righteous' ? ' hard, because a righteous path feels its sins' : ''}.</p>
                        <div className="btnrow wrap">{BLACK_ITEMS.map(id => (getEco(save).items[id] ?? 0) > 0 ? <Btn key={id} onClick={() => act(sellBlack(save, id))}>{itemById(id)?.icon} Sell {itemById(id)?.name} ({blackPrice(save, id)})</Btn> : null)}</div>
                        <Btn disabled={cl > 0} onClick={() => act(takeContract(save))}>☠️ Take a contract (uses 1 Viper Venom){cl > 0 ? ` - ${cl} days` : ''}</Btn>
                    </>
                )}
            </div>
        );
    }
    return null;
}

export function CraftDepthPanel(props: { craft: CraftId; save: SaveGame; world: World; act: Act }) {
    const { craft, save, act } = props;
    const o = orderInHand(save, craft);
    const have = o ? (getEco(save).items[o.out] ?? 0) : 0;
    return <>
        <CraftDepthInner {...props} />
        {o ? <div className="bcard"><strong>📝 A client waits for {o.qty} {itemById(o.out)?.name}</strong><div className="dim">Pays {o.pay} stones. You have {have}. The request lasts until the month ends.</div><Btn disabled={have < o.qty} onClick={() => act(deliverCommission(save, craft))}>Deliver</Btn></div>
            : <div className="bcard"><div className="dim">📝 Clients ask for finished goods, one request per craft each month. Standing raises the pay.</div><Btn disabled={!canTakeOrder(save, craft)} onClick={() => act(takeCommission(save, craft))}>{canTakeOrder(save, craft) ? 'Ask for work' : 'No new client this month'}</Btn></div>}
    </>;
}
