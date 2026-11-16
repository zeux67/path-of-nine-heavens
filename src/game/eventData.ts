// Event cores. Add a batch by appending to a list below; the engine in events.ts needs no change.
// Stone amounts are multiples of the realm-scaled stakes unit. Anything with real risk is labelled.
import type { EventCore, Role } from './events';
import { BATCH_B } from './eventData2';
import { BATCH_C } from './eventData3';
import { BATCH_D } from './eventData4';
import { BATCH_E } from './eventData5';
import { BATCH_F } from './eventData6';
import { BATCH_G } from './eventData7';

const SECT_LOW: Role[] = ['sect-low'], ANYSECT: Role[] = ['sect-low', 'sect-core', 'sect-elder'];
const ROGUE: Role[] = ['none'], CLANM: Role[] = ['clan-member'];

const ROGUE_CORES: EventCore[] = [
    { id: 'rg-recruiter', title: 'A Recruiter at the Inn', icon: '📯', cond: { roles: ROGUE, maxRealm: 3 }, weight: 3, cooldown: 1080,
        intro: ['A recruiter from a minor sect corners you in {city}: "We have one seat open, and you have the look of someone who needs a roof."', 'In a {city} tea house, {npc} of a small sect slides a token across the table. "A trial seat. Tonight only."'],
        choices: [
            { label: 'Take the trial', risk: 'safe', win: { text: '{npc} walks you to the sect gate. The trial is hard, but the elders see something in you. You gain a patron.', fx: { contrib: 2, flag: 'recruiter-friend' } } },
            { label: 'Haggle for a stipend', risk: 'risky', check: 0.5, win: { text: 'He grumbles, then pays in advance. A stone purse and a place to start.', fx: { stones: 1.2 } }, lose: { text: 'He laughs, takes his token back and leaves. You drink alone.' } },
            { label: 'Decline politely', risk: 'safe', win: { text: 'He nods and finds another. You keep your road.' } },
        ] },
    { id: 'rg-bounty', title: 'Mistaken for a Wanted Man', icon: '🗡️', cond: { roles: ROGUE, maxRealm: 4 }, weight: 3,
        intro: ['A bounty hunter blocks the road near {city}. "Black coat, scar on the chin. You are {npc}, the one with the price on his head."', 'Two hired blades in {city} surround you in the market. "{npc} has a bounty. You match the sketch."'],
        choices: [
            { label: 'Talk your way out', risk: 'risky', check: 0.55, win: { text: 'You point at the wrong scar and offer to go before the magistrate. They back off, muttering.', fx: { luck: 1 } }, lose: { text: 'They do not buy it. A scuffle costs you a purse before you run.', fx: { stones: -0.8 } } },
            { label: 'Pay them off', cost: 1, risk: 'safe', win: { text: 'They pocket the stones and "find" the real man elsewhere.' } },
            { label: 'Fight', risk: 'deadly', check: 0.45, win: { text: 'You win, barely. Their purses cover your bruises.', fx: { stones: 1.4, flag: 'blooded' } }, lose: { text: 'You are cut down in an alley, a stranger\'s price on your head.', fx: { death: 'Cut down by bounty hunters who took you for a wanted man.' } } },
        ] },
    { id: 'rg-escort', title: 'Escort Work', icon: '🐪', cond: { roles: ROGUE, maxRealm: 4 }, weight: 3,
        intro: ['A caravan master in {city} needs a cultivator to ride with his wagons: "Six days, {thing}. Pay on arrival."'], slots: { thing: ['no questions asked', 'good food, bad roads', 'quiet roads, he swears', 'cargo you should not open'] },
        choices: [
            { label: 'Take the job', risk: 'risky', check: 0.7, win: { text: 'The road is dull and the pay is real.', fx: { stones: 1.6, rep: 1 } }, lose: { text: 'Bandits hit the last night. You hold them off, but the pay is cut and your arm hurts.', fx: { stones: 0.4 } } },
            { label: 'Ask for a bigger cut first', risk: 'safe', check: 0.5, win: { text: 'He agrees to half again. The master was desperate.', fx: { stones: 2.2 } }, lose: { text: 'He finds someone cheaper. No deal.' } },
        ] },
    { id: 'rg-map', title: 'The "Treasure Map"', icon: '🗺️', cond: { roles: ROGUE, maxRealm: 3 }, weight: 3,
        intro: ['A thin merchant in {city} lowers his voice: "A real map. A dying cultivator gave it to me. Only {thing}."'], slots: { thing: ['a few stones to you', 'a modest price', 'a fair price, a hundred years of qi inside'] },
        choices: [
            { label: 'Buy it', cost: 1.2, risk: 'risky', check: 0.3, win: { text: 'It is real. A cave near {city} with a pocket of spirit ore.', fx: { stones: 3.5, item: ['spirit-ore', 2] } }, lose: { text: 'The ink is still wet. The merchant is already gone.' } },
            { label: 'Look it over, then walk away', risk: 'safe', win: { text: 'The paper is new and the coastline is wrong. You keep your stones.' } },
        ] },
];

const SECT_CORES: EventCore[] = [
    { id: 'sl-protection', title: 'Protection Money', icon: '🥋', cond: { roles: SECT_LOW }, weight: 4,
        intro: ['Senior brother {npc} finds you after morning drills. "Pay for the privilege of the training yard, junior. Everyone does."', '{npc} and two friends block the path to the herb garden of {sect}. "Toll."'],
        choices: [
            { label: 'Pay', cost: 0.6, risk: 'safe', win: { text: 'It stings, but you keep your head down. Nobody bothers you for a season.' } },
            { label: 'Refuse', risk: 'risky', check: 0.45, win: { text: 'You stand still. A passing elder frowns, and {npc} moves on.', fx: { contrib: 1 } }, lose: { text: 'They beat you quietly. You miss two days of training.', fx: { cult: -0.01 } } },
            { label: 'Report him to the elders', risk: 'risky', check: 0.6, win: { text: '{npc} is punished. The elders note your honesty.', fx: { contrib: 3, flag: 'reported-senior' } }, lose: { text: 'The elders shrug: seniors keep order. {npc} remembers.', fx: { luck: -2 } } },
        ] },
    { id: 'sl-tournament', title: 'A Seat in the Tournament', icon: '🏆', cond: { roles: SECT_LOW, maxRealm: 4 }, weight: 3, cooldown: 1080,
        intro: ['The tournament slots of {sect} are posted. One place is open to an inner or outer disciple who can show promise.'],
        choices: [
            { label: 'Train hard for it', risk: 'safe', win: { text: 'You do not win, but your name is known. Your form improves.', fx: { cult: 0.04, contrib: 2 } } },
            { label: 'Enter at once', risk: 'risky', check: 0.4, win: { text: 'You win two bouts and an elder\'s attention.', fx: { contrib: 5, cult: 0.05 } }, lose: { text: 'You are thrown out in the first round, to loud laughter.', fx: { luck: -1 } } },
            { label: 'Skip it', risk: 'safe', win: { text: 'You spend the day in the library instead.', fx: { cult: 0.01 } } },
        ] },
    { id: 'sl-rival', title: 'The Rival Disciple', icon: '⚔️', cond: { roles: ANYSECT, maxRealm: 5 }, weight: 3,
        intro: ['A disciple of a rival sect, {npc}, sneers at your robes in {city}. "Meet me behind the market, if you are not afraid."'],
        choices: [
            { label: 'Accept the duel', risk: 'deadly', check: 0.5, win: { text: 'You win cleanly. {npc} bows, humiliated.', fx: { contrib: 4, luck: 2, flag: 'rival-defeated' } }, lose: { text: 'You are carried back to {sect} half dead. The duel was not to the death, but it nearly was.', fx: { stones: -1, luck: -2 } } },
            { label: 'Refuse and walk away', risk: 'safe', win: { text: 'Word spreads that you ducked him. Some disciples snicker.', fx: { luck: -1 } } },
        ] },
    { id: 'sc-succession', title: 'A Quiet Offer', icon: '🕯️', cond: { roles: ['sect-core'] }, weight: 3,
        intro: ['Elder {npc} calls you aside at dusk. "The sect master is old. When the seat opens, I need young people I can trust."'],
        choices: [
            { label: 'Back the elder', risk: 'risky', check: 0.55, win: { text: 'Your loyalty is noted and rewarded. You gain a powerful patron.', fx: { contrib: 6, flag: 'faction-elder' } }, lose: { text: 'Another faction hears of it. You are sidelined for a season.', fx: { contrib: -2 } } },
            { label: 'Stay neutral', risk: 'safe', win: { text: 'You stay out of it. The elder is cool toward you, but safe is safe.' } },
            { label: 'Warn the sect master', risk: 'risky', check: 0.5, win: { text: 'The sect master thanks you and quietly promotes you.', fx: { contrib: 8, flag: 'sect-master-favor' } }, lose: { text: 'He already knew, and you made enemies for nothing.', fx: { luck: -3 } } },
        ] },
    { id: 'se-dispute', title: 'The Elder\'s Seat of Judgement', icon: '⚖️', cond: { roles: ['sect-elder'] }, weight: 4,
        intro: ['Two disciples, {npc} and {npc2}, bring a quarrel before you. One claims the other stole a pill; the other swears the first lied.'],
        choices: [
            { label: 'Side with {npc}', risk: 'risky', check: 0.5, win: { text: 'The facts bear you out. {npc2} is punished and the matter ends.', fx: { contrib: 3 } }, lose: { text: 'You were wrong. {npc2} has friends. The sect grumbles.', fx: { contrib: -3 } } },
            { label: 'Call witnesses and dig', risk: 'safe', win: { text: 'It takes a week, but the truth comes out. The disciples respect your fairness.', fx: { contrib: 4, flag: 'fair-elder' } } },
            { label: 'Punish both', risk: 'safe', win: { text: 'The quarrel ends. Neither is grateful.', fx: { contrib: 1 } } },
        ] },
    { id: 'sh-tribute', title: 'Tribute Demand', icon: '👑', cond: { roles: ['sect-head'] }, weight: 4,
        intro: ['An envoy of a larger neighbour demands tribute from {sect}. "Pay, and we remain friends."'],
        choices: [
            { label: 'Pay the tribute', risk: 'safe', win: { text: 'The envoy leaves smiling. The treasury is lighter.', fx: { treasury: -2.5, flag: 'paid-tribute' } } },
            { label: 'Refuse', risk: 'risky', check: 0.5, win: { text: 'Your defiance holds. The envoy leaves empty-handed, and your disciples cheer.', fx: { treasury: 1, flag: 'defied-neighbor' } }, lose: { text: 'Raiders hit your outposts. You pay more than the tribute in damage.', fx: { treasury: -5 } } },
            { label: 'Negotiate', risk: 'safe', check: 0.65, win: { text: 'You settle for a smaller sum and a trade pact.', fx: { treasury: -1, flag: 'trade-pact' } }, lose: { text: 'Talks drag on and cost gifts. The demand stays the same.', fx: { treasury: -2.5 } } },
        ] },
    { id: 'sh-traitor', title: 'A Traitor Among the Elders', icon: '🗡️', cond: { roles: ['sect-head', 'clan-head'], minRealm: 3 }, weight: 3,
        intro: ['A loyal servant brings you a letter: elder {npc} has been selling the secrets of {sect} to a rival.'],
        choices: [
            { label: 'Confront {npc} in private', risk: 'risky', check: 0.55, win: { text: '{npc} breaks down and gives up the rival\'s contacts. You punish him quietly.', fx: { treasury: 1, flag: 'traitor-exposed' } }, lose: { text: '{npc} was ready. He escapes with secrets and a few treasures.', fx: { treasury: -3 } } },
            { label: 'Set a trap and watch', risk: 'safe', win: { text: 'You catch the courier with a fake document. The rival loses face.', fx: { luck: 2, flag: 'traitor-exposed' } } },
            { label: 'Ignore it', risk: 'risky', check: 0.3, win: { text: 'The letter was a forgery after all.' }, lose: { text: 'Months later, the leak costs you a vein.', fx: { treasury: -4 } } },
        ] },
    { id: 'cl-marriage', title: 'A Marriage Alliance', icon: '💍', cond: { roles: CLANM, maxRealm: 5 }, weight: 3, cooldown: 1440,
        intro: ['The elders of {sect} summon you. A powerful clan offers a marriage alliance with their {thing}.'], slots: { thing: ['third daughter', 'eldest son', 'cousin, kind and sharp-tongued'] },
        choices: [
            { label: 'Accept', risk: 'safe', win: { text: 'The wedding is lavish. Your clan gains a friend, and a dowry.', fx: { stones: 3, flag: 'married-alliance' } } },
            { label: 'Refuse', risk: 'risky', check: 0.6, win: { text: 'The elders grumble, but your talent is worth more than the pact.', fx: { luck: 1 } }, lose: { text: 'The rival clan takes offence. Your own elders freeze your allowance.', fx: { stones: -1 } } },
        ] },
    { id: 'ch-branch', title: 'The Branch Family Demands Autonomy', icon: '🏠', cond: { roles: ['clan-head'] }, weight: 4,
        intro: ['The head of a branch family in {city} arrives with twelve cousins. "We pay half the tithe, and we want our own hall."'],
        choices: [
            { label: 'Grant autonomy', risk: 'safe', win: { text: 'Peace returns. The branch grows loyal, though the tithe drops.', fx: { treasury: -2, flag: 'branch-free' } } },
            { label: 'Refuse and hold firm', risk: 'risky', check: 0.5, win: { text: 'They bow their heads. The clan stays whole.', fx: { treasury: 1 } }, lose: { text: 'The branch leaves with its wealth. The clan is smaller.', fx: { treasury: -5 } } },
            { label: 'Offer a seat on the council', risk: 'safe', check: 0.65, win: { text: 'A compromise that works. Loyalty rises, and so does your standing.', fx: { treasury: 2, flag: 'council-seat' } }, lose: { text: 'They take the seat and keep pushing.', fx: { treasury: -1 } } },
        ] },
];

const CRAFT_CORES: EventCore[] = [
    { id: 'cr-commission', title: 'A Pill Commission', icon: '⚗️', cond: { craft: { id: 'alchemy', level: 1 } }, weight: 3,
        intro: ['A noble house in {city} sends a servant: "My lord needs {thing} for a family event, ready in a month."'], slots: { thing: ['a batch of qi pills', 'a dozen detox pills', 'a rare calming draught'] }, tags: ['craft'],
        choices: [
            { label: 'Take the order', risk: 'risky', craft: 'alchemy', check: 0.55, win: { text: 'The batch is perfect. The house pays well and recommends you.', fx: { stones: 2.2, rep: 1 } }, lose: { text: 'A bad batch. You refund part of the fee. The noble is annoyed.', fx: { stones: -0.5 } } },
            { label: 'Decline', risk: 'safe', win: { text: 'You return the deposit. They find another alchemist.' } },
        ] },
    { id: 'cr-poison', title: 'A Quiet Request', icon: '☠️', cond: { craft: { id: 'alchemy', level: 2 } }, weight: 2, cooldown: 1440,
        intro: ['A veiled stranger in {city} asks for a poison that leaves no trace, and offers a purse that is hard to ignore.'], tags: ['dark'],
        choices: [
            { label: 'Take the money', risk: 'risky', craft: 'alchemy', check: 0.6, win: { text: 'The stranger pays in full and vanishes. Your hands feel heavier.', fx: { stones: 4, flag: 'poisoner' } }, lose: { text: 'It was a trap. The stranger takes the poison and the purse back.', fx: { stones: -1, flag: 'poisoner' } } },
            { label: 'Refuse', risk: 'safe', win: { text: 'The stranger leaves. You hear later that someone else took the job.' } },
            { label: 'Tell the city watch', risk: 'risky', check: 0.6, win: { text: 'The watch grabs the stranger. You gain a small reward and a friend in the guard.', fx: { stones: 1, rep: 1 } }, lose: { text: 'The stranger had friends. Your shop is burgled.', fx: { stones: -1.5 } } },
        ] },
    { id: 'cr-contract', title: 'An Artifact Contract', icon: '⚒️', cond: { craft: { id: 'refine', level: 2 } }, weight: 3,
        intro: ['A travelling cultivator lays a sketch on your bench in {city}: a flying sword, with a {thing}.'], slots: { thing: ['fixed price and a month', 'bonus if it is done early', 'share of the fame it earns'] }, tags: ['craft'],
        choices: [
            { label: 'Take the contract', risk: 'risky', craft: 'refine', check: 0.55, win: { text: 'The blade sings. The cultivator pays and spreads your name.', fx: { stones: 2.6, rep: 1 } }, lose: { text: 'The metal cracks during quenching. You pay for the ore.', fx: { stones: -1 } } },
            { label: 'Ask for materials up front', risk: 'safe', win: { text: 'He pays the ore in advance. Smaller profit, no risk.', fx: { stones: 1 } } },
        ] },
    { id: 'cr-wards', title: 'Plague Wards', icon: '📜', cond: { craft: { id: 'talisman', level: 1 } }, weight: 3,
        intro: ['A village outside {city} begs you for ward talismans. The plague is spreading, and they can pay little.'], tags: ['mercy'],
        choices: [
            { label: 'Draw them for free', risk: 'safe', win: { text: 'The plague stops at their gate. The village will remember you for generations.', fx: { luck: 3, flag: 'plague-saviour' } } },
            { label: 'Charge a fair price', risk: 'safe', win: { text: 'They scrape together what they can. You earn a little and feel nothing.', fx: { stones: 0.8 } } },
            { label: 'Sell them to the rich of {city} instead', risk: 'safe', win: { text: 'The rich pay triple. The village does not forgive, and word travels.', fx: { stones: 3, luck: -4, flag: 'profiteer' } } },
        ] },
];

export const EVENT_CORES: EventCore[] = [...ROGUE_CORES, ...SECT_CORES, ...CRAFT_CORES, ...BATCH_B, ...BATCH_C, ...BATCH_D, ...BATCH_E, ...BATCH_F, ...BATCH_G];
