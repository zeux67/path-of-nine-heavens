// Batch G: 24 more cores for the 0.2 release, craft-aware and market-aware. Two openings and two slot pools each.
import type { EventCore, Choice, Fx, Role, Cond } from './events';
import type { CraftId } from './craft';

const ok = (text: string, fx?: Fx) => ({ text, fx });
type CO = { risk?: 'safe' | 'risky' | 'deadly'; check?: number; cost?: number; lose?: { text: string; fx?: Fx }; craft?: CraftId };
const c = (label: string, win: { text: string; fx?: Fx }, o: CO = {}): Choice => ({ label, win, risk: o.risk ?? (o.check !== undefined ? 'risky' : 'safe'), check: o.check, cost: o.cost, lose: o.lose, craft: o.craft });
const ev = (id: string, title: string, icon: string, cond: Cond, intro: string[], slots: Record<string, string[]>, choices: Choice[], extra: Partial<EventCore> = {}): EventCore => ({ id, title, icon, cond, weight: 3, intro, slots, choices, ...extra });
const R = (...r: Role[]) => r;
const LEADER = R('sect-head', 'clan-head');
const ROGUE = R('none'), SECTMEM = R('sect-low', 'sect-core', 'sect-elder'), CLAN = R('clan-member', 'clan-head');
const ANY = R('none', 'sect-low', 'sect-core', 'sect-elder', 'sect-head', 'clan-member', 'clan-head');

export const BATCH_G: EventCore[] = [
    ev('g-bridge-toll-ghost', 'The Ghost on the Bridge', '👻', { roles: ANY }, ['At night, a pale figure stands on the bridge near {city}, asking each passer-by for {ask}.', 'Travellers near {city} tell of a ghost on the bridge who wants {ask}. Tonight it is waiting for you, {mood}.'],
        { ask: ['a name', 'a coin for the ferry', 'a promise to remember her'], mood: ['quietly', 'with a terrible patience'] }, [
        c('Give what it asks', ok('The figure fades with a smile. The air warms.', { karma: 3, luck: 1 })),
        c('Drive it off with qi', ok('It scatters. You feel faintly ashamed.', { cult: 0.02, karma: -1 }), { check: 0.6, lose: ok('It shrieks and chills you to the bone.', { cult: -0.02 }) }),
        c('Take the other road', ok('A long walk in the dark, but a quiet one.')),
    ]),
    ev('g-wine-merchant', 'The Wine Merchant\'s Test', '🍷', { roles: ANY }, ['A wine merchant in {city} offers a free cup to anyone who can name its {thing}.', '{npc} pours you a strange wine and asks for its {thing}. The prize is {prize}.'],
        { thing: ['age', 'herb', 'year'], prize: ['a jar of the same', 'a small purse'] }, [
        c('Taste and guess', ok('You guess right. The crowd cheers, and he pays up.', { stones: 0.5, rep: 1 }), { check: 0.45, lose: ok('You guess wrong and pay for the cup.', { stones: -0.2 }) }),
        c('Use your qi to read it', ok('You read the herbs inside. Correct, and a little rude.', { stones: 0.5, cult: 0.01 }), { craft: 'alchemy', check: 0.7, lose: ok('The wine is stronger than your qi. You sway.', { stones: -0.1 }) }),
        c('Decline', ok('You keep your head clear.')),
    ]),
    ev('g-sword-stranger', 'A Stranger With a Sword', '🗡️', { roles: ANY, minRealm: 1 }, ['A stranger at {place} draws a plain sword and says, "{line}".', 'On the road to {city}, a swordsman bars your way. "{line}," he says, and waits.'],
        { place: ['a lonely crossroads', 'a quiet ridge', 'a forest clearing'], line: ['One bout, no killing', 'Show me your best cut', 'I have lost twice this year'] }, [
        c('Accept the bout', ok('A clean fight. He bows and teaches you one thing.', { cult: 0.05, rep: 1 }), { risk: 'risky', check: 0.5, lose: ok('You lose, but learn what he showed.', { cult: 0.02, stones: -0.3 }) }),
        c('Decline politely', ok('He nods and lets you pass.')),
        c('Strike first', ok('Cheap, and it works. You feel poorly about it.', { stones: 0.3, karma: -4 })),
    ]),
    ev('g-widow-farm', 'The Widow\'s Fields', '🌾', { roles: ANY }, ['A widow near {city} cannot bring in her {crop} before the {rain}. {npc} says the village will not help.', 'At the edge of {city}, a woman begs for hands to bring in her {crop} before the {rain}.'],
        { crop: ['rice', 'millet', 'herbs'], rain: ['heavy rains', 'storms'] }, [
        c('Work the fields with her', ok('Three days of mud and sweat. She presses a little into your hand.', { karma: 3, stones: 0.2, luck: 1 })),
        c('Pay for labourers', ok('The harvest is saved.', { stones: -0.5, karma: 2 })),
        c('Pass by', ok('The rain comes. You hear about it later.', { karma: -1 })),
    ], { tags: ['mercy'] }),
    ev('g-sect-rumour', 'A Rumour in the Hall', '🗣️', { roles: SECTMEM }, ['Whispers go round {sect} that {npc} has {deed}. The talk is {mood}.', 'In the dining hall of {sect}, you overhear that {npc} has {deed}. Nobody says it loudly, and the mood is {mood}.'],
        { deed: ['stolen from the treasury', 'sold a manual outside', 'a hidden injury'], mood: ['gossip', 'unease'] }, [
        c('Spread it', ok('It travels fast. You feel clever and a little dirty.', { karma: -2, contrib: 0 })),
        c('Check the truth quietly', ok('You find the real story. It was less than half of it.', { luck: 1, karma: 1 }), { check: 0.55, lose: ok('You are seen asking. People wonder why.', { contrib: -1 }) }),
        c('Say nothing', ok('It dies in a week.')),
    ]),
    ev('g-elder-test', 'The Elder\'s Test', '🧓', { roles: R('sect-low', 'sect-core') }, ['An elder of {sect} sets you {task}, and watches without a word. You have until {limit}.', '{npc} calls you aside and gives you {task}. "Do it alone, and finish by {limit}," he says.'],
        { task: ['a hard riddle', 'a cold night on the peak', 'a basin of water to carry without spilling'], limit: ['dawn', 'sundown'] }, [
        c('Think it through', ok('He nods slowly. You have done well.', { contrib: 2, cult: 0.03 }), { check: 0.6, lose: ok('You fail. He sighs and says nothing.') }),
        c('Ask a friend for help', ok('You pass, but he knows.', { contrib: 0, karma: -1 })),
        c('Refuse the test', ok('He shrugs. There will not be another.', { contrib: -1 })),
    ]),
    ev('g-cultivation-slump', 'A Dry Spell', '🌫️', { roles: ANY, minRealm: 1 }, ['Your qi stalls for a month. Nothing moves, nothing changes, and {mood} sets in.', 'For weeks your practice does not move. {cause}, you think, and keep going.'],
        { mood: ['a quiet doubt', 'a bitter patience'], cause: ['Perhaps the body is tired', 'Perhaps the mind is too loud'] }, [
        c('Rest completely', ok('A week of nothing. Then a clean breath, and things move again.', { cult: 0.02 })),
        c('Push harder', ok('You force a little progress. It costs you.', { cult: 0.04, luck: -1 }), { risk: 'risky', check: 0.5, lose: ok('You strain something. A short deviation.', { cult: -0.03 }) }),
        c('Walk the road for a week', ok('Fresh air, fresh thoughts. It helps.', { cult: 0.03, luck: 1 })),
    ]),
    ev('g-beast-cries', 'Beasts Cry in the Night', '🐺', { roles: ANY }, ['Beasts in the hills near {city} cry out all night. {npc} says it is {cause}, and takes it for {hint}.', 'You cannot sleep for the howling near {city}. A hunter says it is {cause}, and calls it {hint}.'],
        { cause: ['a coming storm', 'an old rivalry', 'a wounded elder beast'], hint: ['a bad omen', 'a good omen'] }, [
        c('Go out and look', ok('You find a hurt beast and some herbs growing around it.', { item: ['herb', 2], luck: 1 }), { risk: 'risky', check: 0.55, lose: ok('A pack finds you first. You run.', { stones: -0.4 }) }),
        c('Stay inside', ok('By morning it is quiet.')),
        c('Ask a diviner', ok('She says it is not your business. She charges you anyway.', { stones: -0.2, luck: 1 }), { craft: 'divination' }),
    ]),
    ev('g-market-fire', 'Fire in the Market', '🔥', { roles: ANY }, ['A fire breaks out in the market of {city}, starting at a {stall} stall. The wind is {wind}, and people scream.', 'You smell smoke in {city}. A {stall} stall is alight and the wind is {wind}.'],
        { stall: ['silk', 'oil', 'herb'], wind: ['rising', 'gusting'] }, [
        c('Fight the fire', ok('You save two stalls and a child. Your robe is ruined.', { rep: 3, karma: 3, stones: -0.2 }), { risk: 'risky', check: 0.55, lose: ok('The fire is too strong. You drag out a few people and burn your hand.', { karma: 2, cult: -0.01 }) }),
        c('Loot in the chaos', ok('A few rich pickings. Nobody sees.', { stones: 1.5, karma: -6 })),
        c('Stay clear', ok('It burns for hours.')),
    ]),
    ev('g-array-flaw', 'A Flaw in the Array', '🀄', { roles: ANY, minRealm: 1 }, ['The ward array around {place} in {city} has a flaw. {npc} cannot find it, and hears only {sign}.', 'Something is wrong with the array at {place}. {npc} has tried for days. All that shows is {sign}.'],
        { place: ['the gate', 'the market', 'a manor'], sign: ['a faint hum', 'a missing flag'] }, [
        c('Trace the pattern and fix it', ok('You find a flag swapped for a fake. It hums true again.', { stones: 0.7, rep: 2 }), { craft: 'formation', check: 0.6, lose: ok('You make it worse. You pay for the damage.', { stones: -0.5 }) }),
        c('Point out who last touched it', ok('A gossip, but a useful one.', { rep: 1 })),
        c('Walk away', ok('It is not your array.')),
    ]),
    ev('g-lost-herb-garden', 'The Overgrown Garden', '🌿', { roles: ANY }, ['Behind a house in {city} lies a garden gone wild. {npc} says the owner {fate}.', 'A garden near {city} is choked with {plant}. The old gardener is {fate}.'],
        { fate: ['died last spring', 'left with no word', 'will not come back'], plant: ['thistle', 'wild herbs', 'spirit weeds'] }, [
        c('Clear and replant it', ok('A month of work, and a few good plants.', { item: ['herb', 3], luck: 1 }), { craft: 'farming', check: 0.65, lose: ok('The roots go deeper than you thought. You get little.', { item: ['herb', 1] }) }),
        c('Dig out what is worth taking', ok('A few herbs, a few bad looks.', { item: ['herb', 2], karma: -1 })),
        c('Leave it be', ok('Nature takes it back.')),
    ]),
    ev('g-hunter-guide', 'The Hunter\'s Offer', '🏹', { roles: ANY }, ['A hunter at {place} offers to guide you through the hills for {fee}.', '{npc} the hunter says he knows a shortcut to {place}, for {fee}.'],
        { place: ['a hidden valley', 'a ridge of herbs', 'an old den'], fee: ['a few stones', 'a bottle of wine'] }, [
        c('Hire him', ok('He knows the way. You return with a good haul.', { item: ['beast-hide', 2], stones: -0.2 })),
        c('Go alone', ok('You get lost for a day, then find something.', { luck: 1 }), { check: 0.5, lose: ok('You get lost and find nothing.', { stones: -0.2 }) }),
        c('Decline', ok('He shrugs and goes.')),
    ]),
    ev('g-travelling-doctor', 'The Travelling Doctor', '🩺', { roles: ANY }, ['A doctor in {city} treats the poor for free, and asks only for {help}.', '{npc} the doctor sets up a stall at {place}. He asks passers-by for {help}.'],
        { help: ['herbs', 'a little qi', 'a few hands'], place: ['the market gate', 'the temple step'] }, [
        c('Help him for a day', ok('A long day. A good one.', { karma: 3, luck: 1 })),
        c('Give a few herbs', ok('He thanks you quietly.', { karma: 2, item: ['herb', -1] })),
        c('Carry on', ok('Not your trouble.')),
    ], { tags: ['mercy'] }),
    ev('g-monk-riddle', 'The Monk\'s Riddle', '🧘', { roles: ANY }, ['A monk on the road to {city} asks: "{q}"', 'At a roadside shrine, a monk in a {robe} robe looks at you and asks: "{q}"'],
        { q: ['What is heavier, a mountain or a promise?', 'Where does the river go when it is frozen?', 'Who walks beside you when you walk alone?'], robe: ['grey', 'saffron'] }, [
        c('Answer from the heart', ok('He smiles. "Not wrong." Your mind is calmer.', { cult: 0.03, karma: 1 })),
        c('Answer cleverly', ok('He laughs. "Clever is not wise." You feel both flattered and scolded.', { luck: 1 })),
        c('Say nothing and bow', ok('He bows back. Nothing more is needed.', { karma: 1 })),
    ]),
    ev('g-poison-antidote', 'The Poisoned Well', '☠️', { roles: ANY }, ['The well in {city} is poisoned and {sick} are ill. {npc} blames {culprit}.', 'Villagers near {city} fall sick, {sick} of them, after drinking from the well. {culprit} is blamed.'],
        { culprit: ['a rival', 'a travelling merchant', 'a bad spirit'], sick: ['dozens', 'a few'] }, [
        c('Brew an antidote', ok('The sick recover. You are thanked and paid.', { stones: 0.8, karma: 3, rep: 2 }), { craft: 'alchemy', check: 0.6, lose: ok('Too weak. You save some, not all.', { karma: 2 }) }),
        c('Help with water and rest', ok('You save a few. Not enough, but something.', { karma: 2 })),
        c('Leave the village', ok('You hear the news later.', { karma: -2 })),
    ], { tags: ['mercy'] }),
    ev('g-roadside-shrine', 'The Roadside Shrine', '⛩️', { roles: ANY }, ['A small shrine stands at {place}, with {offer} at its foot.', 'You pass a shrine near {city}. Someone has left {offer} there.'],
        { offer: ['a bowl of rice', 'a faded ribbon', 'three stones'], place: ['a crossroads', 'a hilltop', 'a riverbank'] }, [
        c('Leave an offering', ok('A quiet peace settles on you.', { luck: 2, stones: -0.1 })),
        c('Take the offering', ok('Nobody will know. You will.', { stones: 0.1, karma: -3, luck: -1 })),
        c('Pause and bow', ok('A moment of calm.', { karma: 1 })),
    ]),
    ev('g-quarrel-couple', 'A Quarrel in the Street', '🗯️', { roles: ANY }, ['A couple quarrel loudly outside an inn in {city}. {npc} watches with {crowd}.', 'Voices rise from a doorway in {city}. A husband and wife argue about {matter} before {crowd}.'],
        { matter: ['a debt', 'a mother-in-law', 'a lost purse'], crowd: ['a crowd', 'a few idle men'] }, [
        c('Step in and mediate', ok('You calm them. Perhaps.', { karma: 1, rep: 1 }), { check: 0.55, lose: ok('They both turn on you.', { rep: -1 }) }),
        c('Watch with the crowd', ok('A fine show.')),
        c('Walk on', ok('Not your concern.')),
    ]),
    ev('g-sudden-rain', 'Sudden Rain', '🌧️', { roles: ANY }, ['Rain catches you on the road to {city}. A {shelter} stands nearby, and {figure} is already inside.', 'A storm breaks over {city}. You see a {shelter} and {figure} sheltering inside.'],
        { shelter: ['ruined hut', 'wayside inn', 'cave mouth'], figure: ['a monk', 'a peddler'] }, [
        c('Shelter inside', ok('You share a fire and a few words with a stranger.', { luck: 1 })),
        c('Cultivate in the rain', ok('Cold, wet, and clear. Your qi moves oddly well.', { cult: 0.04 }), { risk: 'risky', check: 0.65, lose: ok('You catch a chill. A few days of fever.', { cult: -0.02 }) }),
        c('Press on', ok('You arrive soaked and in a bad mood.')),
    ]),
    ev('g-clan-tomb', 'The Ancestors\' Hall', '🏯', { roles: CLAN }, ['The ancestors\' hall of the clan needs {repair}. The elders look at you. It will cost {cost}.', 'A beam in the clan hall has {repair}. {npc} says it must be mended before winter. It will cost {cost}.'],
        { repair: ['a new roof', 'fresh paint', 'a stronger beam'], cost: ['a fair sum', 'a modest sum'] }, [
        c('Pay for it', ok('The hall is restored. The elders nod.', { stones: -1, rep: 3, luck: 1 })),
        c('Lead the work yourself', ok('A hard week, but you earn quiet respect.', { rep: 2, cult: 0.01 })),
        c('Put it off', ok('The beam cracks a little more.', { rep: -1 })),
    ]),
    ev('g-clan-dowry', 'A Cousin\'s Dowry', '💍', { roles: CLAN }, ['A cousin is to marry into a {house} house, and the clan must pay a dowry of {gift}.', '{npc} announces a cousin\'s match. The dowry is {gift}, and the clan looks at you.'],
        { house: ['rich', 'rising', 'old'], gift: ['silver and silk', 'a small spirit stone chest'] }, [
        c('Pay in full', ok('The match goes through. The clan\'s name rises.', { stones: -1.5, rep: 3 })),
        c('Pay half and promise the rest', ok('A little shame, but it passes.', { stones: -0.8, rep: 1 })),
        c('Refuse', ok('The cousin is left in tears. You are the villain of the season.', { rep: -3, karma: -2 })),
    ]),
    ev('g-leader-envoy', 'The Envoy\'s Gift', '🎁', { roles: LEADER, minRealm: 3 }, ['An envoy from {rival} brings you a gift of {gift}. He smiles too much.', 'A messenger from {rival} lays {gift} at your feet and says nothing about what is wanted.'],
        { rival: ['a rival sect', 'a rich house', 'the coalition'], gift: ['a jade seal', 'a spirit weapon', 'a chest of stones'] }, [
        c('Accept and wait to see', ok('A favour is owed. You will be asked.', { treasury: 1, luck: -1 })),
        c('Refuse politely', ok('The envoy bows. His smile goes thin.', { karma: 1 })),
        c('Return it with a gift of your own', ok('The balance is even, and your pride too.', { treasury: -0.5, rep: 2 })),
    ]),
    ev('g-leader-schism', 'Whispers of Schism', '⚖️', { roles: LEADER, minRealm: 3 }, ['A faction in your {body} whispers of leaving over {cause}, led by {npc}.', 'Your steward warns of talk of a split. {npc} has been meeting people at night. The cause: {cause}.'],
        { body: ['sect', 'clan'], cause: ['unpaid dues', 'an old slight', 'a rival\'s gold'] }, [
        c('Meet them openly', ok('You hear their grievance and meet part of it. The talk dies.', { treasury: -0.5, rep: 2 }), { check: 0.6, lose: ok('They walk out in anger. The loss is real.', { treasury: -1.5, rep: -2 }) }),
        c('Crush the ringleader', ok('The talk stops. The fear does not.', { karma: -3, rep: 1 })),
        c('Ignore it', ok('It grows. You will have to deal with it later.', { luck: -1 })),
    ]),
    ev('g-moon-night', 'A Moon Too Bright', '🌕', { roles: ANY, minRealm: 1 }, ['The moon over {city} is unusually bright. Your qi stirs, and {mood}. The light is {tone}.', 'A bright moon hangs above {city}. {mood} fills you, and you cannot sleep. The light is {tone}.'],
        { mood: ['a strange hunger', 'a quiet excitement', 'a clarity you have not felt'], tone: ['sharp', 'soft'] }, [
        c('Sit and cultivate under it', ok('The moonlight feeds your qi. A good night.', { cult: 0.05 })),
        c('Walk the streets', ok('You walk until dawn and meet a stranger with a story.', { luck: 1 })),
        c('Close the shutters', ok('You sleep badly.')),
    ]),
];
