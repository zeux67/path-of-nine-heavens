// Batch C: leaders, clans, alignment, wanderers, secret-realm echoes.
import type { EventCore, Choice, Fx, Role, Cond } from './events';
import type { CraftId } from './craft';

const ok = (text: string, fx?: Fx) => ({ text, fx });
type CO = { risk?: 'safe' | 'risky' | 'deadly'; check?: number; cost?: number; lose?: { text: string; fx?: Fx }; craft?: CraftId };
const c = (label: string, win: { text: string; fx?: Fx }, o: CO = {}): Choice => ({ label, win, risk: o.risk ?? (o.check !== undefined ? 'risky' : 'safe'), check: o.check, cost: o.cost, lose: o.lose, craft: o.craft });
const ev = (id: string, title: string, icon: string, cond: Cond, intro: string[], choices: Choice[], extra: Partial<EventCore> = {}): EventCore => ({ id, title, icon, cond, weight: 3, intro, choices, ...extra });
const R = (...r: Role[]) => r;
const ROGUE = R('none'), LOW = R('sect-low'), CORE = R('sect-core'), ELD = R('sect-elder'), HEAD = R('sect-head'), CLM = R('clan-member'), CLH = R('clan-head');
const LEADER = R('sect-head', 'clan-head');
const ANY = R('none', 'sect-low', 'sect-core', 'sect-elder', 'sect-head', 'clan-member', 'clan-head');
const SECTMEM = R('sect-low', 'sect-core', 'sect-elder');

export const BATCH_C: EventCore[] = [
    // Leaders
    ev('ld-refugees', 'Refugees at the Gate', '🏚️', { roles: LEADER, minRealm: 3 }, ['Hundreds of refugees from a burned town camp outside the gates of {sect}. Some are cultivators, many are not.'], [
        c('Take them all in', ok('Your halls fill and your stores shrink. The new disciples are loyal, and some are gifted.', { treasury: -2, flag: 'took-refugees', luck: 3 })),
        c('Take only the cultivators', ok('The sect grows stronger. The camp starves.', { treasury: 1, luck: -3 })),
        c('Send them away', ok('The camp scatters. Rumours spread.', { luck: -2 })),
    ], { tags: ['mercy'] }),
    ev('ld-assassin', 'An Assassin in the Hall', '🗡️', { roles: LEADER, minRealm: 4 }, ['A hooded figure slips past the guards of {sect} and stands at your bedside. "A client wants you dead. I will name the price for you to buy my silence."'], [
        c('Pay him to name his client', ok('He names a rival. You now know your enemy.', { treasury: -2, flag: 'knows-enemy' }), { cost: 2 }),
        c('Fight', ok('You subdue him. His mark is a rival\'s seal.', { treasury: 1, flag: 'knows-enemy' }), { risk: 'deadly', check: 0.6, lose: ok('A near thing. You are wounded and he escapes.', { treasury: -1 }) }),
        c('Hire him yourself', ok('He accepts. A cold, useful friend, for a while.', { treasury: -3, flag: 'hired-assassin' }), { cost: 3 }),
    ], { tags: ['dark'] }),
    ev('ld-rival-offer', 'A Rival\'s Peace Offer', '🕊️', { roles: LEADER, minRealm: 4 }, ['The head of a rival force sends an envoy: a truce, a trade pact, and a marriage between your houses.'], [
        c('Accept the whole offer', ok('Peace and trade. Your disciples cheer.', { treasury: 3, flag: 'rival-allied' })),
        c('Accept the trade only', ok('Profit without strings.', { treasury: 1 })),
        c('Reject it', ok('The envoy leaves with a thin smile. Border posts double.', { treasury: -1 })),
    ]),
    ev('ld-bandit', 'Bandits Raid a Village', '🔥', { roles: LEADER, minRealm: 3 }, ['A village under your protection is burned by bandits. The villagers wait outside your gate.'], [
        c('Lead the hunt yourself', ok('You crush the bandits. The villagers wail your name in thanks.', { treasury: 1, luck: 3 }), { risk: 'risky', check: 0.6, lose: ok('The bandits scatter. Your name stays under a cloud.', { luck: -1 }) }),
        c('Send disciples', ok('A disciple dies, but the bandits are caught.', { treasury: -1, contrib: 0 })),
        c('Pay compensation only', ok('The village rebuilds and forgets you.', { treasury: -1.5 })),
    ]),
    ev('ld-mentor', 'A Retired Master Returns', '🧓', { roles: LEADER, minRealm: 5 }, ['An old master who once led {sect} returns from seclusion and asks to be heard. He speaks of old mistakes.'], [
        c('Listen and follow his advice', ok('His advice saves you from an old trap.', { treasury: 2, luck: 2 })),
        c('Honour him but ignore him', ok('He nods and returns to his cave.')),
        c('Silence him', ok('He leaves in sadness. Your elders stay quiet.', { luck: -4, flag: 'silenced-master' })),
    ], { tags: ['karma'] }),
    ev('ld-festival', 'The Founding Festival', '🏮', { roles: LEADER }, ['The yearly founding festival of {sect} is near. The treasurer says it will cost a good sum.'], [
        c('Go grand', ok('A feast, fireworks and a surge of pride. New disciples arrive.', { treasury: -3, luck: 2 }), { cost: 0 }),
        c('Keep it modest', ok('A quiet festival, a quiet treasury.', { treasury: -0.5 })),
        c('Cancel it', ok('The disciples grumble. The treasury saves a bundle.', { treasury: 0.5, luck: -1 })),
    ]),
    ev('ld-tax', 'The Tax Collector', '🧾', { roles: LEADER }, ['A court collector arrives at {sect} with a levy that is higher than last year.'], [
        c('Pay in full', ok('The collector leaves smiling.', { treasury: -2 })),
        c('Argue it down', ok('You trim it a little.', { treasury: -1 }), { check: 0.5, lose: ok('He frowns and adds a fine.', { treasury: -3 }) }),
        c('Bribe the clerk', ok('The clerk loses a page, and the levy with it.', { treasury: -0.5 }), { cost: 0.5 }),
    ]),
    // Clan
    ev('ch-ancestral-hall', 'The Ancestral Hall Burns', '🔥', { roles: CLH, minRealm: 3 }, ['A fire guts the ancestral hall of {sect}. Elders blame sabotage, others blame carelessness.'], [
        c('Rebuild at once', ok('A bigger hall rises. The clan\'s pride survives.', { treasury: -3, luck: 2 })),
        c('Investigate first', ok('You find the fire was set by a rival branch. Heads roll.', { treasury: -1, flag: 'found-arsonist' }), { check: 0.55, lose: ok('Nothing is found. Rumours grow.', { treasury: -1 }) }),
    ]),
    ev('ch-outsider', 'An Outsider Seeks Adoption', '🤝', { roles: CLH }, ['A talented cultivator, {npc}, begs to be adopted into the clan and take the name. The elders are split.'], [
        c('Adopt him', ok('He is brilliant and grateful. Some elders sulk.', { treasury: 2, flag: 'adopted-outsider' })),
        c('Refuse', ok('The clan stays pure. He is welcomed by a rival.', { luck: -1 })),
    ]),
    ev('cm-elder-gift', 'An Elder\'s Gift', '🎁', { roles: CLM }, ['An old clan elder takes you aside and presses a small bundle into your hand. "You are my favourite. Do not tell the others."'], [
        c('Accept', ok('A pill and a few stones. A tangle of cousins\' envy.', { stones: 0.8, item: ['qi-pill', 1] })),
        c('Decline', ok('He is touched by your restraint.', { luck: 2 })),
    ]),
    ev('cm-arranged', 'An Arranged Match', '💍', { roles: CLM, minRealm: 2 }, ['Your parents want you to meet the daughter of a rival clan\'s head. They say the match could heal an old feud.'], [
        c('Meet her', ok('You like each other more than expected. The feud cools.', { stones: 1.5, flag: 'clan-marriage' })),
        c('Refuse', ok('Your parents sulk. Your freedom is yours.', { luck: 1 })),
    ]),
    // Alignment
    ev('al-blood-pact', 'A Blood Pact Offered', '🩸', { roles: ANY, align: 'demonic', minRealm: 2 }, ['A pale cultivator in {city} offers a blood pact: strength now, a debt later.'], [
        c('Sign', ok('Power surges. Your eyes redden for a week. The debt waits.', { cult: 0.1, flag: 'blood-pact', luck: -4 }), { risk: 'risky', check: 0.7, lose: ok('The pact bites. You are weak for a season.', { cult: -0.04, flag: 'blood-pact' }) }),
        c('Refuse', ok('He shrugs and vanishes.')),
    ], { tags: ['dark'] }),
    ev('al-orthodox-bounty', 'A Righteous Bounty', '☀️', { roles: ANY, align: 'righteous', minRealm: 2 }, ['A righteous sect posts a bounty on a demonic cultivator nearby. The man is feared, but also wounded.'], [
        c('Hunt him', ok('You bring in the head. The bounty is generous and the sect welcomes you.', { stones: 3, contrib: 2, luck: 2 }), { risk: 'deadly', check: 0.5, lose: ok('He was a trap. You barely escape.', { stones: -1 }) }),
        c('Pass', ok('Someone else takes it.')),
    ]),
    ev('al-dark-market', 'A Back-Alley Auction', '🕯️', { roles: ANY, minRealm: 2 }, ['In the back of a {city} tavern, masked dealers auction forbidden manuals. A buyer\'s token is slipped to you.'], [
        c('Bid', ok('You win a manual of a dark art. Strong, forbidden, and risky.', { cult: 0.09, stones: -1.5, flag: 'forbidden-manual' }), { cost: 1.5, risk: 'risky', check: 0.6, lose: ok('The manual is a trap that tries to seize your mind.', { cult: -0.04, luck: -3 }) }),
        c('Report the auction', ok('The watch raids it and thanks you.', { rep: 1 })),
        c('Leave', ok('You keep your hands clean.')),
    ], { tags: ['dark'] }),
    ev('al-demonic-hunt', 'Hunted by the Righteous', '🏹', { roles: ANY, align: 'demonic', minRealm: 2 }, ['A righteous patrol marks you at the edge of {city}. "A demonic cultivator, here?"'], [
        c('Slip away', ok('You vanish in the crowd.', { luck: 1 }), { check: 0.6, lose: ok('They catch your sleeve. A fight, a scar.', { stones: -1 }) }),
        c('Fight them', ok('You break the patrol. A legend is born.', { stones: 2, flag: 'slew-patrol' }), { risk: 'deadly', check: 0.4, lose: ok('You are struck down.', { death: 'Struck down by a righteous patrol that recognised your demonic qi.' }) }),
        c('Bribe the captain', ok('He looks away. You owe him nothing, and he owes you silence.', { stones: -1 }), { cost: 1 }),
    ]),
    // More wanderers and secret-realm echoes
    ev('an-hermit', 'A Hermit\'s Question', '🧘', { roles: ANY, minRealm: 1 }, ['On a mountain path above {city}, a hermit asks you a riddle: "What is faster than the wind and heavier than a mountain?"'], [
        c('Answer "time"', ok('He smiles and gives you a short breathing method.', { cult: 0.04 })),
        c('Answer "a promise"', ok('He nods. A promise is lighter than air, he says, and then gives you a pill.', { item: ['qi-pill', 1], luck: 1 })),
        c('Say nothing', ok('He laughs and goes back to his cave.')),
    ]),
    ev('an-sect-recruit-demon', 'A Sinister Invitation', '🌑', { roles: ROGUE, align: 'demonic', maxRealm: 4 }, ['A pale elder of a demonic sect offers you a seat. "We reward talent, and ask few questions."'], [
        c('Accept', ok('A dark door opens, and the road ahead is brighter and darker.', { contrib: 2, flag: 'dark-patron' })),
        c('Decline', ok('He lets you go. For now.')),
    ], { tags: ['dark'] }),
    ev('an-rumor-realm', 'A Secret Realm Rumour', '🗝️', { roles: ANY, minRealm: 1 }, ['A drunk hunter in {city} swears he found the mouth of a secret realm. "Only forty days left before it seals."'], [
        c('Follow the rumour', ok('The entrance is real. A short, safe visit yields a few herbs.', { stones: 1.5, item: ['herb', 4] }), { check: 0.6, lose: ok('It was a drunk\'s dream. You lose a week.', {}) }),
        c('Ignore it', ok('You keep your plans.')),
    ]),
    ev('an-caravan-attack', 'Beasts on the Road', '🐺', { roles: ANY, maxRealm: 5 }, ['A caravan outside {city} is attacked by a pack of spirit wolves. The guards flee.'], [
        c('Fight for the caravan', ok('You save the goods and the owner. A generous reward.', { stones: 2.2, rep: 1 }), { risk: 'deadly', check: 0.55, lose: ok('The wolves are too many. You retreat, bloodied.', { stones: -1 }) }),
        c('Watch from a distance', ok('The caravan is lost. You carry the memory.', { luck: -1 })),
    ]),
    ev('an-thief', 'A Pickpocket', '🧤', { roles: ANY }, ['In the crowded market of {city}, a thin boy slips his hand into your sleeve.'], [
        c('Catch him', ok('You grab his wrist. He drops your purse and begs.', { luck: 1 }), { check: 0.6, lose: ok('He is gone with some of your stones.', { stones: -0.5 }) }),
        c('Let him go', ok('A stone lighter and a heart lighter.', { stones: -0.2, luck: 1 })),
    ]),
    ev('an-wedding', 'A Village Wedding', '🎎', { roles: ANY }, ['A village near {city} invites you to a wedding. The bride\'s family has little but offers a seat of honour.'], [
        c('Attend with a gift', ok('A merry night. The village sings your name.', { stones: -0.3, luck: 2 }), { cost: 0.3 }),
        c('Attend empty-handed', ok('Nobody minds. The wine is sweet.', { luck: 1 })),
        c('Decline', ok('You carry on.')),
    ]),
    ev('an-lightning-tree', 'The Lightning-Struck Tree', '🌩️', { roles: ANY, minRealm: 2, maxRealm: 7 }, ['A lightning-struck tree near {city} still hums with qi. Carved wood from it would make a fine talisman base.'], [
        c('Carve a branch', ok('The wood is dense with lightning qi. It sells for a lot.', { stones: 2 }), { risk: 'risky', check: 0.55, lose: ok('A last bolt arcs from the trunk. You are scorched.', { cult: -0.02 }) }),
        c('Meditate beneath it', ok('The residual qi settles into your meridians.', { cult: 0.05 }), { check: 0.7, lose: ok('You can not settle and leave with a headache.', {}) }),
    ]),
    ev('an-dream', 'A Strange Dream', '🌙', { roles: ANY, minRealm: 1 }, ['You dream of a white-robed figure on a mountain, pointing east. You wake with a name on your lips: {npc}.'], [
        c('Seek the name', ok('A stranger of that name indeed exists. He gives you a small, odd gift.', { luck: 3, stones: 0.8 })),
        c('Ignore it', ok('The dream fades.')),
    ]),
    ev('sl-herb-garden', 'The Herb Garden Blight', '🥀', { roles: LOW }, ['A blight strikes the herb garden of {sect}. The gardener asks outer disciples to help save it.'], [
        c('Help for a day', ok('You save a third of the plants. The gardener leaves you a pouch.', { item: ['herb', 3], contrib: 1 })),
        c('Skip it and cultivate', ok('You use the day to train.', { cult: 0.015 })),
    ]),
    ev('sl-new-disciple', 'A Nervous Newcomer', '🧒', { roles: LOW }, ['A new outer disciple, {npc}, trips in the training yard and spills a bowl on a senior. The senior raises a hand.'], [
        c('Step in', ok('You stand between them. The senior lowers his hand and the newcomer never forgets.', { luck: 2, flag: 'defended-newcomer' }), { check: 0.7, lose: ok('You take the slap yourself.', { luck: 0 }) }),
        c('Look away', ok('It is not your fight.', { luck: -1 })),
    ]),
    ev('sc-inner-circle', 'The Inner Circle Invites You', '🏯', { roles: CORE, minRealm: 2 }, ['A group of core disciples invites you to their private study group. Their leader, {npc}, is ambitious.'], [
        c('Join', ok('Their notes are good. Their politics are not.', { cult: 0.05, flag: 'inner-circle' })),
        c('Refuse politely', ok('They remember it, kindly.')),
    ]),
    ev('sc-heaven-rank', 'The Heavenly Ranking', '🥇', { roles: CORE, minRealm: 2 }, ['The sect holds its Heavenly Ranking trial. Core disciples fight for resources and name.'], [
        c('Enter the trial', ok('You place in the top ten. A pill, a name, a chest.', { stones: 2, contrib: 4, cult: 0.04 }), { risk: 'risky', check: 0.45, lose: ok('You lose in the third round, scorched and humbled.', { luck: -1 }) }),
        c('Skip it', ok('You study instead.', { cult: 0.02 })),
    ]),
    ev('se-ancient-tablet', 'An Ancient Tablet', '🪧', { roles: ELD, minRealm: 4 }, ['In the vault of {sect}, an elder finds an ancient tablet in a script nobody reads. The sect master wants it kept secret.'], [
        c('Decipher it', ok('You spend a year of free hours, and earn a deep insight.', { cult: 0.09, contrib: 3 }), { check: 0.55, lose: ok('The script defies you.', {}) }),
        c('Give it to the sect master', ok('He is pleased with your loyalty.', { contrib: 4 })),
    ]),
    ev('se-rival-elder', 'A Rival Elder\'s Scheme', '🎭', { roles: ELD }, ['Elder {npc} spreads whispers that you favour certain disciples. The sect master asks you to explain.'], [
        c('Defend yourself openly', ok('You win the room. The rival is quiet.', { contrib: 3 }), { check: 0.55, lose: ok('The whispers stick. A lasting stain.', { contrib: -3 }) }),
        c('Counter-whisper', ok('The rival is ruined. Some call it dirty.', { contrib: 2, flag: 'dirty-politics' })),
        c('Ignore it', ok('The sect master is not impressed.', { contrib: -1 })),
    ]),
    ev('se-student-fall', 'A Disciple Falls', '🕳️', { roles: ELD }, ['{npc}, a disciple you trained, is caught practising a forbidden art. The sect wants him punished.'], [
        c('Cripple his cultivation', ok('The law is kept. He never forgives you.', { contrib: 3, luck: -2, flag: 'crippled-student' })),
        c('Argue for exile', ok('He is exiled instead. You lose a student and keep your conscience.', { contrib: 1, luck: 1 })),
        c('Help him escape', ok('He flees by night. You risk everything.', { contrib: -6, flag: 'helped-fugitive' }), { check: 0.4, lose: ok('You are caught. Your rank drops.', { contrib: -12 }) }),
    ], { tags: ['karma'] }),
    ev('cr-guild', 'The Merchant Guild Courts You', '🏛️', { craft: { id: 'alchemy', level: 2 } }, ['A merchant guild in {city} offers a supply contract: steady stones, but fixed prices.'], [
        c('Sign', ok('Reliable income, no big wins.', { stones: 2.0, rep: 1 })),
        c('Counter with better terms', ok('The guild agrees to a better price.', { stones: 3 }), { check: 0.45, lose: ok('They walk away.', {}) }),
        c('Refuse', ok('You stay free.')),
    ]),
    ev('cr-master-lesson', 'A Master\'s Lesson', '🎓', { craft: { id: 'refine', level: 2 } }, ['A famous smith passing through {city} offers a one-day lesson, for a price or a favour.'], [
        c('Pay', ok('A day that is worth a year at the forge.', { cult: 0.03, stones: -1.2 }), { cost: 1.2 }),
        c('Offer a favour', ok('He nods. Someday he will call it in.', { cult: 0.02, flag: 'smith-favor' })),
        c('Pass', ok('He moves on.')),
    ]),
    ev('cr-forbidden-talisman', 'The Forbidden Scroll', '📜', { craft: { id: 'talisman', level: 3 } }, ['A dying talisman master hands you a scroll: a forbidden design that doubles the power, and may backfire.'], [
        c('Copy it', ok('The talisman crackles with bigger power. A few are sold for a high price.', { stones: 3.5, flag: 'forbidden-talisman' }), { risk: 'risky', craft: 'talisman', check: 0.5, lose: ok('A copy backfires in your hands.', { stones: -1, cult: -0.02 }) }),
        c('Burn it', ok('The master looks disappointed, then relieved.', { luck: 1 })),
    ]),
    ev('cr-auction', 'An Invitation to the Auction', '🔔', { craft: { id: 'refine', level: 3 } }, ['The auction house of {city} invites you to bring a masterpiece for its autumn sale.'], [
        c('Bring your best', ok('Your piece fetches a record price.', { stones: 5, rep: 2 }), { craft: 'refine', check: 0.5, lose: ok('It sells for a fair price. No fame.', { stones: 1.5 }) }),
        c('Decline', ok('You stay at the forge.')),
    ]),
    ev('cr-material-shortage', 'The Price of Ore Spikes', '📈', { craft: { id: 'refine', level: 1 } }, ['War in the north makes ore scarce. Prices in {city} spike.'], [
        c('Wait it out', ok('Prices settle in a month. Nothing lost.')),
        c('Pay the spike', ok('You keep working at a loss.', { stones: -1 })),
        c('Hunt ore yourself', ok('A rough trip, but you return with ore for a season.', { item: ['spirit-ore', 3] }), { risk: 'risky', check: 0.55, lose: ok('You find nothing and lose time.', {}) }),
    ]),
    // Fate rewrites for the rootless (approved: mortal-root event, ultra-rare immortal root)
    ev('fate-mortal-heaven', 'The Sky Opens Over a Mortal', '🌌', { roles: ANY, root: 0, minRealm: 1 }, ['At dusk in {city} the clouds part in a column over your head. An old stargazer whispers that heaven has noticed a man with no root.'], [
        c('Stand in the light', ok('Your roots are torn out and regrown. Your body answers one element alone now, and answers it hard.', { single: true, flag: 'fate-rewritten', luck: 5 }), { risk: 'risky', check: 0.5, lose: ok('The light burns and passes. You wake on the ground, shaken but alive.', { luck: -3 }) }),
        c('Step out of it', ok('You keep your plain road. Some gifts are not free.', { luck: 1 })),
    ], { weight: 1, cooldown: 36000, tags: ['fate'] }),
    ev('fate-mortal-immortal', 'The Immortal Root Awakens', '🌠', { roles: ANY, root: 0, minRealm: 3 }, ['A dead sage\'s last seal finds you in {city}. It does not ask what root you have. It rewrites it.'], [
        c('Accept the seal', ok('The world tilts. A root meant for immortals now lives in a mortal frame.', { rootTo: 5, single: true, flag: 'immortal-root', luck: 5 }), { risk: 'deadly', check: 0.35, lose: ok('The seal rejects you and your meridians burn out.', { death: 'was unmade trying to take a dead sage\'s seal' }) }),
        c('Refuse it', ok('The seal fades. You will wonder for the rest of your life.', { luck: 2 })),
    ], { weight: 0.15, cooldown: 360000, tags: ['fate'] }),
];
