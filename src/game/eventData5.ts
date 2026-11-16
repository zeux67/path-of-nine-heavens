// Batch E1: new cores with two openings and two slot pools each (about 18 distinct texts per core).
import type { EventCore, Choice, Fx, Role, Cond } from './events';
import type { CraftId } from './craft';

const ok = (text: string, fx?: Fx) => ({ text, fx });
type CO = { risk?: 'safe' | 'risky' | 'deadly'; check?: number; cost?: number; lose?: { text: string; fx?: Fx }; craft?: CraftId };
const c = (label: string, win: { text: string; fx?: Fx }, o: CO = {}): Choice => ({ label, win, risk: o.risk ?? (o.check !== undefined ? 'risky' : 'safe'), check: o.check, cost: o.cost, lose: o.lose, craft: o.craft });
const ev = (id: string, title: string, icon: string, cond: Cond, intro: string[], slots: Record<string, string[]>, choices: Choice[], extra: Partial<EventCore> = {}): EventCore => ({ id, title, icon, cond, weight: 3, intro, slots, choices, ...extra });
const R = (...r: Role[]) => r;
const ROGUE = R('none'), LOW = R('sect-low'), CORE = R('sect-core'), ELD = R('sect-elder'), CLM = R('clan-member'), CLH = R('clan-head');
const LEADER = R('sect-head', 'clan-head');
const ANY = R('none', 'sect-low', 'sect-core', 'sect-elder', 'sect-head', 'clan-member', 'clan-head');
const SECTMEM = R('sect-low', 'sect-core', 'sect-elder');

export const BATCH_E: EventCore[] = [
    // ---- Wanderers (rogues) -------------------------------------------------------------
    ev('e-ferry', 'The Ferryman\'s Price', '⛵', { roles: ROGUE }, ['The only ferry over the river near {city} will not move unless you pay more than the posted fare. {npc} the ferryman {excuse}.', 'You reach {place} to find the ferry tied up. {npc} says {excuse}, and holds out a hand.'],
        { excuse: ['says the river is high', 'swears the current has changed', 'claims there are bandits on the far bank'], place: ['the north bank', 'a muddy landing', 'the crossing at dusk'] }, [
        c('Pay the extra', ok('You cross. The fare was a theft, but a dry one.', { stones: -1 })),
        c('Bargain, with a few kind words', ok('{npc} grins and halves it.', { stones: -0.5, luck: 1 }), { check: 0.55, lose: ok('He does not budge. You pay in full.', { stones: -1 }) }),
        c('Swim it', ok('You cross cold and wet. A little stronger for it.', { cult: 0.02 }), { risk: 'risky', check: 0.7, lose: ok('The current takes your pack.', { stones: -2 }) }),
    ]),
    ev('e-mule', 'A Mule at the Roadside', '🫏', { roles: ROGUE }, ['A mule stands alone on the road to {city}, tied to nothing. {thing} is strapped to its back.', 'You find a mule grazing by {place}. Its pack holds {thing}.'],
        { thing: ['a bundle of herbs', 'a sealed jar', 'a roll of silk'], place: ['a broken shrine', 'a fallen tree', 'the old well'] }, [
        c('Look for the owner', ok('You find {npc} a mile on. A fair reward for honesty.', { stones: 1, karma: 3, luck: 1 })),
        c('Take the pack and go', ok('A fine haul, and the mule watches you leave.', { stones: 2, karma: -3 })),
        c('Leave it be', ok('Not yours. Not your trouble.')),
    ], { tags: ['mercy'] }),
    ev('e-beggar-qi', 'The Beggar Who Teaches', '🧓', { roles: ROGUE }, ['An old beggar at {place} stops you. "Sit. Your breath is wrong." He {act}.', 'In {city}, a beggar waves you over. "Your qi leaks," he says, and {act}.'],
        { place: ['a temple step', 'the market gate', 'a bridge'], act: ['draws a circle in the dust', 'taps your chest twice', 'sits you down by force'] }, [
        c('Sit and listen', ok('An hour of odd advice. You walk away steadier.', { cult: 0.05, karma: 1 })),
        c('Give him a coin and move on', ok('He nods. "Kind, at least."', { stones: -0.2, karma: 1 })),
        c('Brush him off', ok('He laughs after you.', { luck: -1 })),
    ]),
    ev('e-tournament-bet', 'A Back-Alley Wager', '🎲', { roles: ROGUE, minStones: 20 }, ['A crowd at {place} watches two cultivators spar. {npc} offers odds on the smaller one.', 'In {city}, {npc} runs a book on tonight\'s match at {place}.'],
        { place: ['an inn courtyard', 'a back lot', 'a dry fountain'] }, [
        c('Bet on the underdog', ok('The underdog wins on a lucky strike. A tidy purse.', { stones: 3 }), { risk: 'risky', check: 0.35, lose: ok('The favourite wins. Your stake is gone.', { stones: -2 }) }),
        c('Bet on the favourite', ok('Safe and small.', { stones: 1 }), { risk: 'risky', check: 0.62, lose: ok('An upset. You lose the stake.', { stones: -1.5 }) }),
        c('Just watch', ok('You learn how both of them move.', { cult: 0.02 })),
    ]),
    ev('e-sick-child', 'A Sick Child at the Inn', '🏠', { roles: ROGUE }, ['At an inn in {city}, {npc} begs for a healer. Her child burns with {ailment}.', 'You wake to coughing next door. {npc} says her child has {ailment}, and the nearest healer is a day away.'],
        { ailment: ['fever', 'a cold qi sickness', 'swamp rot'] }, [
        c('Share your herbs', ok('The fever breaks by dawn. {npc} weeps and gives you all she has.', { item: ['herb', -1], stones: 1, karma: 4, flag: 'saved-child' })),
        c('Pay for the healer to come', ok('A day later the child sits up. The healer thanks you.', { stones: -2, karma: 3, luck: 2 }), { cost: 2 }),
        c('Move on', ok('You do not hear the end of it.', { karma: -2 })),
    ], { tags: ['mercy'] }),
    ev('e-bounty-mistaken', 'A Bounty on Your Face', '📜', { roles: ROGUE, minRealm: 1 }, ['A wanted poster in {city} looks a lot like you. {npc} is already pointing at {place}.', 'You pass {place} and see your face on a notice. A guard turns slowly.'],
        { place: ['a notice board', 'the gate', 'the tavern wall'] }, [
        c('Talk your way out', ok('A little charm and the guard apologises.', { luck: 1 }), { check: 0.6, lose: ok('The guard is not fooled. You pay for his silence.', { stones: -2 }) }),
        c('Run for the gate', ok('You vanish into the crowd.'), { risk: 'risky', check: 0.55, lose: ok('You are caught and fined.', { stones: -3 }) }),
        c('Pay him off at once', ok('A heavy bribe and a lighter step.', { stones: -2 }), { cost: 2 }),
    ]),
    // ---- Outer / inner disciples --------------------------------------------------------
    ev('e-kitchen', 'The Kitchen Shortcut', '🍲', { roles: LOW }, ['A senior of {sect} offers you a place in the kitchens: easier work, {perk}, and a quiet word with {npc}.', 'The head cook of {sect} needs a hand. In return, {perk}.'],
        { perk: ['extra meals', 'a little extra stone allowance', 'a bed by the stove'] }, [
        c('Take the kitchen post', ok('Warm and safe, if dull. A small stipend and a friend.', { stones: 1, contrib: 1, luck: 1 })),
        c('Keep to your training', ok('You skip the comfort and keep your edge.', { cult: 0.03 })),
        c('Take it, and skim the stores', ok('Extra for you. Someone will count eventually.', { stones: 2, karma: -3, flag: 'skimmer' }), { risk: 'risky', check: 0.6, lose: ok('You are caught and docked.', { contrib: -2, stones: -1 }) }),
    ]),
    ev('e-hall-rumour', 'Whispers in the Hall', '🗣️', { roles: LOW }, ['In the {place} of {sect}, {npc} whispers that an elder is {rumour}.', 'You overhear at {place}: an elder is {rumour}. {npc} looks around and goes quiet.'],
        { place: ['dining hall', 'bathhouse', 'training yard'], rumour: ['stealing from the stores', 'dying of old wounds', 'planning to leave the sect'] }, [
        c('Report it', ok('The sect looks into it. Some of it is true. A small reward for you.', { contrib: 2, karma: 1 }), { check: 0.6, lose: ok('It was nothing, and you are marked as a gossip.', { contrib: -1 }) }),
        c('Spread it further', ok('The rumour grows. People notice you, not kindly.', { luck: -1, karma: -2 })),
        c('Say nothing', ok('Wise, probably.')),
    ]),
    ev('e-rival-sabotage', 'Sabotaged Training', '🪤', { roles: LOW }, ['You find your {thing} damaged before the trial. {npc} is nowhere, but their sleeve is wet with {residue}.', 'Before the {thing} trial, someone has tampered with your kit. You smell {residue}.'],
        { thing: ['sword', 'robes', 'talisman paper'], residue: ['oil', 'ink', 'spirit water'] }, [
        c('Confront {npc} in public', ok('{npc} blusters, then backs down. The elders notice.', { contrib: 1, luck: 1 }), { check: 0.55, lose: ok('{npc} turns it on you. You are scolded.', { contrib: -1 }) }),
        c('Fix it and say nothing', ok('You pass the trial anyway. A grudge settles quietly.', { cult: 0.03 })),
        c('Return the favour', ok('A small act of revenge. No one saw.', { luck: -1, karma: -3 })),
    ]),
    ev('e-manual-loan', 'A Borrowed Manual', '📖', { roles: LOW }, ['{npc} offers to lend you a {manual} for three days, if you do their chores.', 'In the library of {sect}, {npc} slides you a {manual} under the table.'],
        { manual: ['battered qi manual', 'half a sword treatise', 'poison herbal'] }, [
        c('Do the chores and study', ok('Three tiring days, but you copy the best pages.', { cult: 0.05, contrib: -1 })),
        c('Copy it in secret at night', ok('You finish just before dawn.', { cult: 0.04 }), { risk: 'risky', check: 0.6, lose: ok('A watchman catches you. Contribution lost.', { contrib: -3 }) }),
        c('Decline', ok('Cheap borrowed knowledge is rarely free.')),
    ]),
    // ---- Core disciples -----------------------------------------------------------------
    ev('e-succession-whisper', 'The Elder\'s Quiet Offer', '🪑', { roles: CORE, minRealm: 2 }, ['An elder of {sect} asks you to take his side in the council vote. In return he offers {prize}.', '{npc}, a council elder, invites you to tea. The talk turns to the coming vote and {prize}.'],
        { prize: ['a rare pill', 'a seat on his team', 'his private manual'] }, [
        c('Back him', ok('He wins and remembers you.', { contrib: 3, stones: 1, flag: 'faction-elder' })),
        c('Stay neutral', ok('He is cool to you, but others respect it.', { contrib: 1, luck: 1 })),
        c('Warn his rival', ok('The rival is grateful. The elder is not.', { contrib: 2, karma: -1, flag: 'dirty-politics' })),
    ]),
    ev('e-mission-compromise', 'A Mission, Compromised', '🗺️', { roles: CORE, minRealm: 2 }, ['Your mission for {sect} goes wrong: the {target} is not what the elders said, and {npc} begs you to let it go.', 'On a sect mission to {place}, you find that the {target} is a trap set by your own side.'],
        { target: ['informer', 'treasure', 'witness'], place: ['a border fort', 'a mountain pass', 'a river camp'] }, [
        c('Complete the mission as ordered', ok('The sect is pleased. You feel a little sick.', { contrib: 3, karma: -3 })),
        c('Let it go and report honestly', ok('The elders are cross, then grudgingly respectful.', { contrib: 1, karma: 3 })),
        c('Warn them off and take the blame', ok('The mission fails, but your honour does not.', { contrib: -1, karma: 4, luck: 1 })),
    ], { tags: ['mercy'] }),
    // ---- Elders -------------------------------------------------------------------------
    ev('e-disciple-theft', 'A Disciple Caught Stealing', '🧺', { roles: ELD, minRealm: 3 }, ['You catch {npc}, a junior disciple, stealing {thing} from the stores of {sect}. His family is {family}.', 'A steward brings you {npc}, caught with {thing}. He says his family is {family}.'],
        { thing: ['pills', 'herbs', 'spirit stones'], family: ['starving', 'in debt', 'proud and far away'] }, [
        c('Punish him by the book', ok('The law is kept. He is expelled, and the disciples fall quiet.', { contrib: 2, karma: -1 })),
        c('Let him work it off', ok('A year of hard labour. He is grateful and loyal.', { contrib: 1, karma: 3, flag: 'fair-elder' })),
        c('Cover for him and pay it yourself', ok('Your purse is lighter. The matter dies.', { stones: -2, karma: 3 }), { cost: 2 }),
    ]),
    ev('e-tournament-judge', 'The Judge\'s Dilemma', '⚖️', { roles: ELD, minRealm: 3 }, ['As judge of the {sect} tournament, you see {npc} win by {trick}. The crowd did not notice.', 'Your decision at the final of the {sect} tournament matters: {npc} used {trick}.'],
        { trick: ['a hidden talisman', 'a poisoned blade', 'a borrowed ward'] }, [
        c('Disqualify him', ok('The crowd boos. Then it cheers. The sect is stronger for honesty.', { contrib: 2, karma: 3 })),
        c('Let it stand', ok('The winner becomes a favourite of the leaders. A debt is owed.', { contrib: 1, karma: -3, flag: 'dirty-politics' })),
        c('Quietly warn him afterwards', ok('He is shaken. He will not try again.', { karma: 1, luck: 1 })),
    ]),
    // ---- Sect heads and clan heads (leaders) ---------------------------------------------
    ev('e-treasury-audit', 'The Quiet Audit', '🧮', { roles: LEADER, minRealm: 3 }, ['Your steward brings the books of {sect} and a worried face. {sum} stones cannot be accounted for.', 'An audit of {sect} finds {sum} stones missing. {npc} is the last to have signed.'],
        { sum: ['a few hundred', 'several thousand', 'a dangerous amount of'] }, [
        c('Open a public inquiry', ok('The thief is found among the officials. Trust rises.', { treasury: 1, karma: 2, luck: 1 }), { check: 0.6, lose: ok('The inquiry finds nothing and costs a month of friction.', { treasury: -1 }) }),
        c('Handle it quietly', ok('You quietly replace the loss. The books balance.', { treasury: -2 })),
        c('Blame an enemy', ok('The matter vanishes. The enemy is outraged, and your people know the lie.', { karma: -5, luck: -1 })),
    ]),
    ev('e-heir-marriage', 'An Unwelcome Match', '💍', { roles: LEADER, minRealm: 3 }, ['{npc}, head of a powerful house, proposes a marriage between your heir and {prize}.', 'An envoy offers an alliance by marriage. The bride\'s family holds {prize}.'],
        { prize: ['a spirit mine', 'a seat at the coalition', 'a debt of favours'] }, [
        c('Accept', ok('Power and wealth flow in. Your heir does not speak to you for a year.', { treasury: 3, karma: -2, flag: 'clan-marriage' })),
        c('Decline politely', ok('The envoy leaves with a thin smile. A cold border.', { treasury: -1 })),
        c('Counter-offer a trade pact instead', ok('Profit without chains.', { treasury: 1, flag: 'trade-pact' }), { check: 0.55, lose: ok('The envoy storms out.', { treasury: -1 }) }),
    ]),
    ev('e-famine-granary', 'The Granary Question', '🌾', { roles: LEADER, minRealm: 3 }, ['A bad harvest hits the lands of {sect}. {npc} reports that the granary is half full and the neighbours are {mood}.', 'Reports reach you: famine in {place}. The granary of {sect} could feed them or the disciples, not both.'],
        { mood: ['starving', 'afraid', 'begging'], place: ['the north villages', 'the river towns', 'the valley farms'] }, [
        c('Open the granary to the villages', ok('Hundreds are saved. The treasury groans.', { treasury: -3, karma: 6, luck: 2, flag: 'plague-saviour' })),
        c('Split it between villages and disciples', ok('A hard compromise. Neither side is happy.', { treasury: -1, karma: 2 })),
        c('Keep it for the sect', ok('The sect eats. The villages remember.', { treasury: 1, karma: -6 })),
    ], { tags: ['mercy'] }),
    // ---- Clan and family ----------------------------------------------------------------
    ev('e-clan-debt', 'A Cousin\'s Debt', '📒', { roles: CLM }, ['Your cousin {npc} has run up a debt of {sum} stones at a gambling house, and the clan is asked to cover it.', '{npc}, a cousin, begs you for help with a gambling debt of {sum} stones.'],
        { sum: ['a small', 'a modest', 'an ugly'] }, [
        c('Pay it for him', ok('He swears off dice. Maybe.', { stones: -2, karma: 2 }), { cost: 2 }),
        c('Refuse and let the clan decide', ok('The clan is not pleased with either of you.', { luck: -1 })),
        c('Help him, but make him work it off', ok('Hard lessons, fairly given.', { stones: -1, karma: 3, luck: 1 })),
    ]),
    ev('e-clan-feud', 'An Old Feud Wakes', '🗡️', { roles: CLM }, ['At {place}, a boy from a rival clan insults your family name and flashes {thing}.', 'A rival clan\'s hothead mocks your clan at {place}, waving {thing}.'],
        { place: ['the market', 'a wedding', 'the tea house'], thing: ['a stolen sword', 'a forged writ', 'your grandfather\'s medal'] }, [
        c('Duel him', ok('You win without killing him. His clan stews.', { cult: 0.03, luck: 1, flag: 'rival-defeated' }), { risk: 'risky', check: 0.55, lose: ok('You lose, badly. The clan hears of it.', { luck: -2 }) }),
        c('Report to the elders', ok('The elders send a stiff letter. The matter cools.', { contrib: 1 })),
        c('Laugh it off', ok('Humility earns more than a duel.', { karma: 1, luck: 1 })),
    ]),
    ev('e-patriarch-tomb', 'The Ancestral Tomb', '⚱️', { roles: CLH, minRealm: 3 }, ['Grave robbers have broken into your clan\'s tomb at {place}. {npc} reports that {thing} was taken.', 'You find your ancestors\' hall at {place} disturbed. Missing: {thing}.'],
        { place: ['the hill shrine', 'the old graveyard', 'the north vault'], thing: ['a jade sword', 'an ancestral tablet', 'a sealed manual'] }, [
        c('Hunt the thieves yourself', ok('You track them to a hidden camp. The treasures return.', { treasury: 2, karma: 1, flag: 'tomb-avenged' }), { risk: 'risky', check: 0.6, lose: ok('The trail goes cold. The clan loses face.', { treasury: -1 }) }),
        c('Post a large bounty', ok('A hunter brings back most of it.', { treasury: -2, luck: 1 }), { cost: 2 }),
        c('Reconsecrate and move on', ok('The ancestors are quieted, if not satisfied.', { treasury: -1, luck: -1 })),
    ]),
    ev('e-branch-rebellion', 'A Branch Family Rebels', '🏯', { roles: CLH, minRealm: 3 }, ['A branch family at {place} refuses its dues and calls itself independent. {npc} leads them.', '{npc}, leader of a branch house, stops sending tribute. "We are no longer your vassals."'],
        { place: ['the eastern valley', 'the river town', 'the hill villages'] }, [
        c('Grant autonomy in return for a pact', ok('They keep their pride and a thin loyalty.', { treasury: -1, luck: 1, flag: 'court-friend' })),
        c('Send the clan guard', ok('The rebellion is crushed. The branch is bitter.', { treasury: -2, karma: -4 }), { risk: 'risky', check: 0.6, lose: ok('The guard is beaten back. The branch is bolder.', { treasury: -3 }) }),
        c('Bribe their leader', ok('He takes the purse and calms the others.', { treasury: -2, karma: -1 }), { cost: 2 }),
    ]),
    // ---- Any role: travel and omens ----------------------------------------------------
    ev('e-omen-sky', 'An Omen in the Sky', '🌠', { roles: ANY }, ['At night above {place}, a {omen} crosses the sky. {npc} says it is a sign.', 'You wake to a {omen} over {place}. The whole town is awake and arguing about its meaning.'],
        { place: ['the city wall', 'the nearest hill', 'the temple roof'], omen: ['red comet', 'double moon', 'white thread of light'] }, [
        c('Meditate under it', ok('The qi in the air is strange and rich. A good night.', { cult: 0.06, luck: 1 })),
        c('Ask a priest what it means', ok('A long, vague answer for a small fee.', { stones: -0.3 })),
        c('Sleep through the whole thing', ok('You miss it, and wake rested.')),
    ]),
    ev('e-merchant-lost', 'A Lost Merchant', '🧳', { roles: ANY }, ['{npc}, a merchant, has lost his way on the road near {city}. His cart is full of {goods}.', 'You meet {npc} on the road. His cart holds {goods}, and his guards have deserted.'],
        { goods: ['spirit herbs', 'pills in jars', 'blank talismans'] }, [
        c('Guide him to town', ok('He is grateful and pays well.', { stones: 2, karma: 2, luck: 1 })),
        c('Escort him all the way', ok('A long walk for a heavy reward.', { stones: 3, karma: 1 }), { risk: 'risky', check: 0.7, lose: ok('Bandits find you both. You lose time and some coin.', { stones: -2 }) }),
        c('Rob him', ok('A quick score. A long guilty road.', { stones: 3, karma: -7, flag: 'cruel-to-beggar' })),
    ], { tags: ['dark'] }),
    ev('e-spirit-spring', 'A Hidden Spring', '💧', { roles: ANY }, ['Off the road near {place}, you find a small spring with a faint {glow} glow.', '{npc} points you to a spring at {place}. Locals avoid it. It glows {glow}.'],
        { place: ['an old orchard', 'a quiet gorge', 'the bend in the river'], glow: ['blue', 'pale green', 'silver'] }, [
        c('Drink and meditate', ok('A deep, cool clarity. A small gain.', { cult: 0.05 }), { check: 0.8, lose: ok('The water was foul. A bad stomach for a day.', { cult: -0.01 }) }),
        c('Bottle some', ok('A few vials of good water to sell.', { item: ['spirit-spring', 2] })),
        c('Tell the local elders', ok('They bless the spring and thank you.', { luck: 2, karma: 2 })),
    ]),
];
