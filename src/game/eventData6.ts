// Batch F: 20 new cores for the 0.2 release, craft-aware and market-aware. Two openings and two slot pools each.
import type { EventCore, Choice, Fx, Role, Cond } from './events';
import type { CraftId } from './craft';

const ok = (text: string, fx?: Fx) => ({ text, fx });
type CO = { risk?: 'safe' | 'risky' | 'deadly'; check?: number; cost?: number; lose?: { text: string; fx?: Fx }; craft?: CraftId };
const c = (label: string, win: { text: string; fx?: Fx }, o: CO = {}): Choice => ({ label, win, risk: o.risk ?? (o.check !== undefined ? 'risky' : 'safe'), check: o.check, cost: o.cost, lose: o.lose, craft: o.craft });
const ev = (id: string, title: string, icon: string, cond: Cond, intro: string[], slots: Record<string, string[]>, choices: Choice[], extra: Partial<EventCore> = {}): EventCore => ({ id, title, icon, cond, weight: 3, intro, slots, choices, ...extra });
const R = (...r: Role[]) => r;
const ROGUE = R('none'), SECTMEM = R('sect-low', 'sect-core', 'sect-elder'), CLAN = R('clan-member', 'clan-head');
const ANY = R('none', 'sect-low', 'sect-core', 'sect-elder', 'sect-head', 'clan-member', 'clan-head');

export const BATCH_F: EventCore[] = [
    ev('f-stall-scales', 'The Crooked Scales', '⚖️', { roles: ANY }, ['A stallholder in {city} weighs your {goods} on scales that tip toward {side}.', '{npc} sells you {goods} and the scales look wrong. You notice it only after {side}.'],
        { goods: ['herbs', 'iron ore', 'hides'], side: ['his own hand', 'the stall post', 'a hidden weight'] }, [
        c('Say nothing and walk on', ok('You lose a little. You also avoid a fight.', { stones: -0.3 })),
        c('Demand a reweigh', ok('The crowd watches. He sets it right, red in the face.', { stones: 0.3, rep: 1 }), { check: 0.6, lose: ok('He shouts louder than you. You leave shorted.', { stones: -0.5 }) }),
        c('Report him to the market watch', ok('He is fined. The watch remembers your name kindly.', { rep: 2, karma: 1 })),
    ]),
    ev('f-herb-glut', 'A Glut of Herbs', '🌿', { roles: ANY }, ['Farmers around {city} have {cause}, and {hint}.', 'A wagon of herbs is dumped at the gate of {city}. {cause}, says the driver, and {hint}.'],
        { cause: ['had a bumper year', 'lost their buyer', 'been told to clear their fields'], hint: ['herbs sell for almost nothing', 'every stall is overflowing'] }, [
        c('Buy a sack and hold it', ok('You buy cheap. In a month it will sell well.', { item: ['herb', 4], stones: -0.3 })),
        c('Help load the wagons', ok('Honest work, honest pay, and a good word.', { stones: 0.4, karma: 1 })),
        c('Ignore it', ok('Not every bargain is yours.')),
    ]),
    ev('f-guard-puppet-ruin', 'The Puppet in the Ruin', '🤖', { roles: ANY, minRealm: 1 }, ['Inside {hall} near {city} sits {state} puppet, still turning its head to follow you.', 'An old workshop near {city} holds a puppet in {state} condition. It has not moved for years.'],
        { state: ['a rusted', 'a battered', 'a strangely intact'], hall: ['a collapsed hall', 'a flooded cellar', 'a burnt shrine'] }, [
        c('Study its joints', ok('You learn how it was made. Your hands improve.', { cult: 0.02, luck: 1 }), { craft: 'puppet', check: 0.65, lose: ok('A hidden latch snaps your finger.', { stones: -0.3 }) }),
        c('Strip it for parts', ok('Good iron, though nothing more.', { item: ['refined-iron', 2] })),
        c('Leave it sleeping', ok('Some things should stay still.', { luck: 1 })),
    ], { tags: ['mercy'] }),
    ev('f-geomancer-dispute', 'A Boundary Dispute', '🧭', { roles: ANY }, ['Two families in {city} argue over {matter}. They offer {pay} if you read the land for them.', '{npc} begs you to settle a quarrel about {matter} by the ground itself, for {pay}.'],
        { matter: ['a boundary stone', 'a spring', 'a burial plot'], pay: ['a purse', 'a promise', 'a small gift'] }, [
        c('Read the qi veins and rule', ok('Your ruling is fair and both sides pay.', { stones: 0.8, rep: 2 }), { craft: 'geomancy', check: 0.6, lose: ok('Your reading is doubted. You leave with nothing.', { rep: -1 }) }),
        c('Refuse to take a side', ok('Both are annoyed. Neither can fault you.')),
        c('Take a bribe from one', ok('You rule for the payer. Everyone knows.', { stones: 1, karma: -4, rep: -2 })),
    ]),
    ev('f-sick-beast', 'The Sick Spirit Beast', '🐾', { roles: ANY }, ['A hunter at {place} kneels beside a {beast} that will not eat. "You know animals," he says.', 'A {beast} lies by {place}, breathing shallowly. {npc} watches helplessly.'],
        { beast: ['spirit hare', 'young boar', 'moon wolf cub'], place: ['the village edge', 'a stable', 'the forest road'] }, [
        c('Tend it through the night', ok('It lives. The hunter owes you more than he can pay.', { karma: 3, rep: 2, luck: 1 }), { craft: 'beast', check: 0.6, lose: ok('It dies in your arms. A bad night.', { karma: 1 }) }),
        c('Offer a little feed', ok('It eats a little and rises. A decent end.', { karma: 1 })),
        c('Walk on', ok('Not your beast.', { karma: -1 })),
    ], { tags: ['mercy'] }),
    ev('f-poison-trade', 'A Quiet Order', '☠️', { roles: ANY, minRealm: 1 }, ['A hooded buyer in {city} asks for {thing}, and names a price too high for honest use, {deal}.', '{npc} whispers a request for {thing}. The coins on the table look very real, {deal}.'],
        { thing: ['a slow venom', 'a sleeping draught', 'something that leaves no trace'], deal: ['half paid now', 'all paid upfront'] }, [
        c('Refuse and report it', ok('The watch thanks you. The buyer is gone by morning.', { karma: 3, rep: 1 })),
        c('Sell it, no questions', ok('The coins are heavy and so is the silence.', { stones: 2, karma: -6 })),
        c('Sell a harmless fake', ok('You take the coins and sell sugared water. The buyer never returns.', { stones: 1, karma: -1 }), { check: 0.7, lose: ok('The buyer tests it. You flee the city for a month.', { stones: -0.5, karma: -2 }) }),
    ]),
    ev('f-pill-forgery', 'Forged Pills at the Stall', '💊', { roles: ANY }, ['A stall in {city} sells {pill}, cheap, with a fine seal. The seal is {seal}, and it looks forged.', 'You are offered {pill} at half price by {npc}. The glaze is wrong and it carries {seal}.'],
        { pill: ['qi gathering pills', 'detox pills', 'breakthrough pills'], seal: ['a copied seal', 'a plain wax seal'] }, [
        c('Expose the forgery', ok('The guild thanks you with a reward and a seat at their table.', { stones: 0.6, rep: 2, karma: 2 })),
        c('Buy one to examine', ok('Chalk and herbs. You at least know now.', { stones: -0.2, luck: 1 }), { craft: 'alchemy', check: 0.7, lose: ok('You swallow a little and feel ill for days.', { cult: -0.01 }) }),
        c('Walk away', ok('Forgers always find their end.')),
    ]),
    ev('f-guild-feast', 'The Guild Feast', '🍶', { roles: ANY }, ['The craft guild of {city} holds its yearly feast, and a place is open at the {seat} table, and {dish} is on the menu.', 'An invitation arrives from the guild: a {seat} seat at the harvest feast. {dish} is on the menu.'],
        { seat: ['high', 'low', 'middle'], dish: ['spirit rice', 'braised boar', 'jade tea'] }, [
        c('Go and make friends', ok('You trade names and promises over wine.', { rep: 2, luck: 1 })),
        c('Go and drink too much', ok('You say something clever, then something foolish.', { rep: 1, stones: -0.3 })),
        c('Decline politely', ok('A quiet evening. You miss nothing you will remember.')),
    ]),
    ev('f-old-manual', 'The Mouldy Manual', '📘', { roles: ANY }, ['A bookseller in {city} pulls out a manual spotted with mould. "{claim}," he says, asking {price}.', 'You find a damp manual at the back of a stall. The seller {claim}, for {price}.'],
        { claim: ['swears it is rare', 'does not know what it is', 'says it was his master\'s'], price: ['a few stones', 'a fair sum'] }, [
        c('Buy it', ok('Half the pages are gone, but what is left is sound.', { cult: 0.03, stones: -0.4 }), { check: 0.6, lose: ok('It is a love poem. A good one, but not useful.', { stones: -0.4 }) }),
        c('Haggle', ok('You get it nearly free, mould and all.', { cult: 0.02, stones: -0.1 }), { check: 0.5, lose: ok('He takes offence and puts it away.') }),
        c('Pass', ok('The seller shrugs. You hear a cough behind the stall.')),
    ]),
    ev('f-road-toll', 'The Toll Post', '🚧', { roles: ANY }, ['A new toll post on the road near {city} asks {toll} from every traveller. {npc} holds the rope, looking {guard}.', 'A rope is stretched across the road. A guard demands {toll}, looking {guard}.'],
        { toll: ['three stones', 'a day\'s food', 'whatever you can spare'], guard: ['bored', 'nervous', 'smug'] }, [
        c('Pay it', ok('You are waved through.', { stones: -0.4 })),
        c('Talk your way past', ok('The guard lets you go with a grumble.', { rep: 1 }), { check: 0.55, lose: ok('He takes double for the trouble.', { stones: -0.8 }) }),
        c('Go around through the brush', ok('A long detour, but you keep your coins.', { cult: 0.01 })),
    ]),
    ev('f-spirit-spring-lost', 'The Missing Spring', '💧', { roles: ANY }, ['A spring {dist} from {city} dried up overnight. The villagers blame {cause}.', '{npc} says the spring they used for years has gone dry. They blame {cause} and ask for your eyes.'],
        { dist: ['a day', 'half a day', 'a few hours'], cause: ['a shifted rock', 'a buried array', 'a sleeping beast'] }, [
        c('Dowse for the cause', ok('You find the blockage. Water returns, and a gift with it.', { stones: 0.8, rep: 2 }), { craft: 'geomancy', check: 0.6, lose: ok('You dig in the wrong place. The hole is still useful.', { stones: -0.2 }) }),
        c('Tell them to dig deeper', ok('It might work.', { rep: 0 })),
        c('Leave it to them', ok('They find the cause in a week. It was a stone.')),
    ]),
    ev('f-arena-bet', 'Betting at the Arena', '🥊', { roles: ANY }, ['A crowd gathers at the arena in {city}. {npc} offers you {odds} on {fighter}.', 'Fighters trade blows in {city}. A broker asks if you will back {fighter} at {odds}.'],
        { fighter: ['the old champion', 'the young upstart', 'a masked stranger'], odds: ['even', 'two to one', 'three to one'] }, [
        c('Bet a little', ok('Your fighter wins. A small, pleasant sum.', { stones: 0.6 }), { check: 0.5, lose: ok('He falls in the second round.', { stones: -0.4 }) }),
        c('Bet big', ok('He wins and the crowd roars. A real purse.', { stones: 2 }), { risk: 'risky', check: 0.4, lose: ok('A bad night. A very bad night.', { stones: -1.5 }) }),
        c('Only watch', ok('A good fight, a good evening.', { cult: 0.01 })),
    ]),
    ev('f-lost-child', 'The Lost Child', '🧒', { roles: ANY }, ['A child in {city} cannot find {who}. {npc} asks if you have seen them.', 'You find a child crying at {place}. They do not know the way home.'],
        { who: ['their mother', 'their older brother', 'their grandmother'], place: ['the market gate', 'a temple step', 'the bridge'] }, [
        c('Walk them home', ok('A grateful family and a warm cup of tea.', { karma: 3, luck: 1 })),
        c('Hand them to the watch', ok('It is handled, if coldly.', { karma: 1 })),
        c('Look away', ok('Someone else will help.', { karma: -2 })),
    ], { tags: ['mercy'] }),
    ev('f-sect-library', 'The Locked Shelf', '📚', { roles: SECTMEM }, ['In the library of {sect}, one {shelf} is locked. {npc} guards the key, looking {mood}.', 'A shelf at the back of the library is closed. The key hangs on {npc}\'s belt. He looks {mood}.'],
        { shelf: ['shelf', 'cabinet', 'scroll case'], mood: ['bored', 'sleepy', 'watchful'] }, [
        c('Ask permission', ok('He refuses once, then relents for a small favour.', { contrib: 1, cult: 0.02 })),
        c('Pick the lock at night', ok('You read what you can by moonlight. Nobody knows.', { cult: 0.05, karma: -2 }), { check: 0.5, lose: ok('You are caught. A flogging and a lost month of standing.', { contrib: -2, karma: -1 }) }),
        c('Leave it', ok('Not today.')),
    ]),
    ev('f-sect-cooking', 'The Cooking Duty', '🍲', { roles: R('sect-low') }, ['You are assigned to the sect kitchen for {span}. {npc} the cook is a harsh man who loves {dish}.', 'The duty roster puts you in the kitchen of {sect}. {npc} hands you a knife and says nothing. The first order is {dish}.'],
        { span: ['a week', 'ten days', 'a month'], dish: ['dumplings', 'rice porridge', 'braised roots'] }, [
        c('Work hard', ok('The cook nods once. You eat well all week.', { contrib: 1, cult: 0.01 })),
        c('Skimp on the chores', ok('He notices. You scrub pots for another week.', { contrib: -1 })),
        c('Bring him a rare herb', ok('He cooks you a pill-soup the elders would envy.', { cult: 0.04, item: ['herb', -1] })),
    ]),
    ev('f-clan-feud', 'The Cousin\'s Insult', '🏮', { roles: CLAN }, ['A cousin in {city} insults your branch of the clan in front of {audience}, over {reason}.', 'At the clan gathering, {npc} sneers at your branch. Then {audience} fall silent. It is about {reason}.'],
        { audience: ['the elders', 'the servants', 'the entire hall'], reason: ['a debt', 'an old grudge', 'a slighted bride'] }, [
        c('Answer calmly', ok('The hall approves. The cousin is quiet for a season.', { rep: 2, luck: 1 })),
        c('Challenge him', ok('You win. A bruise, a rank, and an enemy.', { rep: 3, karma: -1 }), { risk: 'risky', check: 0.5, lose: ok('You lose in front of everyone.', { rep: -3 }) }),
        c('Walk out', ok('A quiet exit. A long memory.')),
    ]),
    ev('f-clan-granary', 'The Empty Granary', '🌾', { roles: CLAN }, ['The clan granary is {state}, and winter is near. {npc} keeps the keys. The best fix is to {remedy}.', 'You count the grain in the clan granary. It is {state}. You could {remedy}.'],
        { state: ['half empty', 'nearly bare', 'short by a third'], remedy: ['buy at market', 'trade with neighbours'] }, [
        c('Buy grain at market', ok('A costly month, but nobody starves.', { stones: -1.2, karma: 2 })),
        c('Ration it strictly', ok('Grumbling, but the grain lasts.', { rep: -1, luck: 1 })),
        c('Raid the neighbour clan', ok('Full barns. A long feud.', { stones: 1, karma: -5 }), { risk: 'risky', check: 0.45, lose: ok('Your men are beaten back.', { rep: -2, karma: -3 }) }),
    ]),
    ev('f-spirit-fruit-tree', 'The Fruit on the Branch', '🍎', { roles: ANY, minRealm: 1 }, ['A tree at {place} bears a single glowing fruit. Birds avoid it, and the thing guarding it is {guard}.', 'You notice a fruit on a lonely tree at {place}. It hums quietly. Beside it: {guard}.'],
        { place: ['a ruined shrine', 'a hilltop', 'the edge of a lake'], guard: ['a coiled snake', 'a watching crow', 'a sleeping tiger'] }, [
        c('Pick it', ok('Sweet, and full of qi. You feel it settle.', { cult: 0.1 }), { risk: 'risky', check: 0.55, lose: ok('The guardian wakes. You flee with a wound.', { cult: -0.03, stones: -0.3 }) }),
        c('Pick it and plant the seed', ok('You plant the seed in your pack. It may grow into a spirit tree.', { cult: 0.03, luck: 2 })),
        c('Leave it', ok('Not every treasure is for you.', { karma: 1 })),
    ]),
    ev('f-heaven-letter', 'A Letter Without a Sender', '✉️', { roles: ANY }, ['A letter lies on your pillow in {city}. It reads: "{line}", in {hand}.', 'A sealed note is slipped under your door. It says only: "{line}", written in {hand}.'],
        { line: ['Do not go north this month', 'Trust the one who gives you tea', 'The road remembers a debt you owe'], hand: ['a neat hand', 'a shaky hand'] }, [
        c('Heed it', ok('Whatever it was, you avoid it. A quiet month.', { luck: 2 })),
        c('Ask around', ok('Nobody knows who wrote it. Something is watching.', { luck: 1 })),
        c('Burn it', ok('The paper curls to ash. A cold feeling lingers.', { luck: -1 })),
    ]),
    ev('f-dream-teacher', 'A Teacher in the Dream', '💭', { roles: ANY, minRealm: 1 }, ['In a dream, {who} sits at the foot of your bed and corrects your breathing. You notice {sign}.', 'You dream of {who} counting your breaths, one by one. You notice {sign}.'],
        { who: ['an old woman', 'a faceless monk', 'a youth in white'], sign: ['a falling leaf', 'a distant bell'] }, [
        c('Follow the breath', ok('You wake clear-headed and light. Your qi runs smoother.', { cult: 0.05 })),
        c('Ask who they are', ok('They smile and are gone. You wake with one word on your tongue.', { luck: 2 })),
        c('Wake yourself', ok('You wake with a start. Nothing more.')),
    ]),
    ev('f-festival-lantern', 'The Lantern Festival', '🏮', { roles: ANY }, ['{city} floods the river with lanterns for the festival. {npc} hands you one to float. You think of {wish}.', 'Lanterns drift down the river at {city}. You are handed a blank {paint} one and a brush.'],
        { wish: ['a long life', 'a good road', 'peace for a lost one'], paint: ['red', 'gold', 'white'] }, [
        c('Write a wish and float it', ok('It drifts out of sight. You feel lighter.', { luck: 1, karma: 1 })),
        c('Write a name for the dead', ok('A quiet grief, and a little peace.', { karma: 2 })),
        c('Pass the lantern on', ok('You watch the lights go by.')),
    ]),
];
