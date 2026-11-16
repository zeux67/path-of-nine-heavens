// Batch B: wanderers, sect life, leaders, clan life, crafts. Compact constructors keep the table readable.
import type { EventCore, Choice, Fx, Role, Cond } from './events';
import type { CraftId } from './craft';

const ok = (text: string, fx?: Fx) => ({ text, fx });
type CO = { risk?: 'safe' | 'risky' | 'deadly'; check?: number; cost?: number; lose?: { text: string; fx?: Fx }; craft?: CraftId };
const c = (label: string, win: { text: string; fx?: Fx }, o: CO = {}): Choice => ({ label, win, risk: o.risk ?? (o.check !== undefined ? 'risky' : 'safe'), check: o.check, cost: o.cost, lose: o.lose, craft: o.craft });
const ev = (id: string, title: string, icon: string, cond: Cond, intro: string[], choices: Choice[], extra: Partial<EventCore> = {}): EventCore => ({ id, title, icon, cond, weight: 3, intro, choices, ...extra });
const R = (...r: Role[]) => r;
const ROGUE = R('none'), LOW = R('sect-low'), CORE = R('sect-core'), ELD = R('sect-elder'), HEAD = R('sect-head'), CLM = R('clan-member'), CLH = R('clan-head');
const MEMBER = R('sect-low', 'sect-core', 'sect-elder', 'clan-member');
const LEADER = R('sect-head', 'clan-head');
const ANY = R('none', 'sect-low', 'sect-core', 'sect-elder', 'sect-head', 'clan-member', 'clan-head');

export const BATCH_B: EventCore[] = [
    // ---- Wanderers (any role, outside sect walls) ----
    ev('an-beggar', 'The Old Beggar', '👴', { roles: ANY }, ['An old beggar sits at the gate of {city}, cup out. {thing}.'], [
        c('Give him a few stones', ok('He bows, says nothing, and later you find a pill in your sleeve. Kindness is its own coin.', { stones: -0.3, item: ['qi-pill', 1], luck: 2 }), { cost: 0.3 }),
        c('Share your food and sit with him', ok('He tells you a long, odd story. At the end he taps your brow, and the world looks clearer.', { cult: 0.03, luck: 1 })),
        c('Walk past', ok('Nothing happens. A cold wind follows you for a street or two.')),
        c('Kick his cup', ok('He looks up. For a heartbeat his eyes are not an old man\'s. You feel watched for weeks.', { luck: -6, flag: 'cruel-to-beggar' })),
    ], { slots: { thing: ['His eyes are clearer than they should be', 'His cup is made of old jade', 'He hums a song no one has sung for centuries'] }, tags: ['karma'], cooldown: 2160 }),
    ev('an-orphan', 'The Orphan with a Strange Root', '👶', { roles: ANY, minRealm: 1 }, ['In {city}, a child steals bread from your table. As {npc} drags him off, you sense a rare root in the boy.'], [
        c('Take him in as a ward', ok('He is shy and clever. Years from now he will return a different man, you hope.', { stones: -0.6, flag: 'orphan-ward', luck: 3 }), { cost: 0.6 }),
        c('Pay for his bread, nothing more', ok('He eats like a wolf, then vanishes into the crowd.', { stones: -0.1 })),
        c('Sell word of him to a sect', ok('A sect pays you a finder\'s fee. The boy is taken away crying.', { stones: 1.2, luck: -4, flag: 'sold-orphan' })),
    ], { tags: ['karma'], cooldown: 2880 }),
    ev('an-ghost-ship', 'A Ghost Ship on the Water', '🚢', { roles: ANY, minRealm: 2 }, ['Fog lies on the water near {city}. A ship with torn black sails drifts in, silent, lanterns still burning.'], [
        c('Board her', ok('The hold is full of silent crew and one chest of spirit stones. You leave with the chest and a chill.', { stones: 3.5, luck: -1 }), { check: 0.5, lose: ok('The deck shifts. You escape, but the ship\'s curse follows you home.', { stones: -1, luck: -4 }) }),
        c('Sail away from her', ok('You watch her go. The fog thins and the sea is empty again.')),
        c('Report her to the harbour watch', ok('The watch burns the ship at dawn and gives you a small reward.', { stones: 0.6, rep: 1 })),
    ], { cooldown: 2160 }),
    ev('an-rain', 'A Sudden Storm in the Mountains', '⛈️', { roles: ANY, maxRealm: 6 }, ['Black clouds gather over the road to {city}. A hunter offers shelter in a cave on the ridge, and {npc} warns it is "not empty."'], [
        c('Shelter in the cave', ok('A sleeping beast stirs, but the storm hides your scent. You find old bones and a small cache.', { stones: 1.3, item: ['beast-hide', 1] }), { check: 0.55, lose: ok('The beast wakes. You flee into the rain, bruised and without your pack.', { stones: -1 }) }),
        c('Walk through the storm', ok('A hard night, but you meet a lone swordsman who nods at your stubbornness.', { cult: 0.015 })),
    ]),
    ev('an-duel-challenge', 'A Challenge in the Teahouse', '🍵', { roles: ANY, minRealm: 1 }, ['A rough cultivator, {npc}, slams a cup on your table in {city}. "You look soft. Try me."'], [
        c('Accept', ok('You beat him with a surprise. He pays his debt and laughs about it.', { stones: 1.2, luck: 1 }), { risk: 'deadly', check: 0.5, lose: ok('He hits too hard. You wake at the inn, lighter in purse.', { stones: -1.2 }) }),
        c('Calm him with wine', ok('The challenge becomes a friendship. He knows a few useful tricks.', { cult: 0.02 }), { cost: 0.2 }),
        c('Leave', ok('The room laughs, but you are alive.', { luck: -1 })),
    ]),
    ev('an-lost-sword', 'A Sword in the Stream', '🗡️', { roles: ANY, maxRealm: 6 }, ['A rusted sword lies half-buried in a stream near {city}. A faint hum rises from the rust.'], [
        c('Pull it out', ok('The rust flakes off to show a spirit blade. It will fetch a good price.', { stones: 2.4 }), { check: 0.5, lose: ok('A ghost of the previous owner scolds you and drains your qi.', { cult: -0.02, luck: -2 }) }),
        c('Leave it alone', ok('You nod to the stream. It hums once, then is quiet.')),
    ]),
    ev('an-plague', 'Sickness in the Streets', '🕯️', { roles: ANY }, ['Sickness runs through {city}. Healers charge a fortune. A woman asks you for a herb you carry.'], [
        c('Give the herb freely', ok('Her child lives. The street remembers you.', { luck: 3, item: ['herb', -1] }), { }),
        c('Sell it at the market rate', ok('A fair sale, nothing more.', { stones: 0.6 })),
        c('Hoard it for a price spike', ok('You sell at triple a week later. People remember who held it back.', { stones: 2, luck: -5, flag: 'profiteer' })),
    ], { tags: ['mercy'] }),
    ev('an-inheritance-ruin', 'A Ruined Pavilion', '🏯', { roles: ANY, minRealm: 2, maxRealm: 7 }, ['In the hills outside {city}, you find a collapsed pavilion with a sealed door marked by an old formation.'], [
        c('Force the door', ok('The seal breaks. A manual, a few pills, an old cultivator\'s last note.', { cult: 0.08, stones: 1.5 }), { risk: 'deadly', check: 0.45, lose: ok('The formation lashes back. You crawl out half dead.', { stones: -1.5, cult: -0.05 }) }),
        c('Study the seal first', ok('You learn something of formations and open it the slow way, safely.', { cult: 0.05, stones: 0.8 }), { check: 0.7, lose: ok('You can not read it. You mark the place and go.', {}) }),
        c('Mark it on a map and sell the location', ok('A sect buys the map. You never see the treasure.', { stones: 2 })),
    ], { cooldown: 2160 }),

    // ---- Sect life ----
    ev('sl-herb-ration', 'Short Herb Rations', '🌿', { roles: LOW }, ['The steward of {sect} cuts the herb ration for outer disciples. Rumour says he sells the rest.'], [
        c('Complain to the steward', ok('He glares and trims your ration further. Lesson learned.', { luck: -1 }), { check: 0.3, lose: ok('He is displeased. The ration is cut again.', { luck: -2 }) }),
        c('Quietly gather your own herbs', ok('A hard week, but you find herbs and keep your head down.', { item: ['herb', 3] })),
        c('Report him to an elder', ok('An audit finds he skimmed the rations. You get a reward.', { contrib: 3, luck: 1 }), { check: 0.5, lose: ok('The steward is a friend of the elder. You are quietly shunned.', { contrib: -2 }) }),
    ]),
    ev('sl-sparring', 'Sparring with a Senior', '🥊', { roles: LOW }, ['A friendly senior, {npc}, offers to spar and show you a trick or two.'], [
        c('Spar seriously', ok('He is better, but you pick up a lesson.', { cult: 0.02 })),
        c('Ask him for a lesson instead', ok('He teaches you a breathing method.', { cult: 0.03 })),
    ]),
    ev('sl-library', 'The Restricted Shelf', '📚', { roles: LOW, minRealm: 1 }, ['The librarian of {sect} dozes. A restricted shelf behind him holds old cultivation notes.'], [
        c('Sneak a copy', ok('You copy a method by candlelight. It works.', { cult: 0.07 }), { risk: 'risky', check: 0.45, lose: ok('You are caught. The punishment is a month of cleaning.', { contrib: -3 }) }),
        c('Ask permission', ok('He gives you a shelf of plain notes and a polite lecture.', { cult: 0.02 })),
    ]),
    ev('sl-mission', 'A Hard Mission', '📜', { roles: LOW, maxRealm: 3 }, ['The mission hall of {sect} posts a hard task: clear a beast den near {city}. The reward is generous, the risk is plain.'], [
        c('Take it', ok('You and two others clear the den. Pay and credit.', { contrib: 5, stones: 1 }), { risk: 'deadly', check: 0.55, lose: ok('The den is worse than posted. You limp back, alone.', { contrib: 1, stones: -1 }) }),
        c('Wait for an easier one', ok('Nothing worth taking this month.')),
    ]),
    ev('sl-elder-errand', 'An Elder\'s Private Errand', '📦', { roles: LOW }, ['Elder {npc} gives you a sealed box to deliver to {city}. "Do not open it. Do not lose it."'], [
        c('Deliver it faithfully', ok('The receiver pays you a tip and tells the elder you are reliable.', { contrib: 3, stones: 0.5 })),
        c('Peek inside', ok('It holds a pill and a letter. You close it again. Nobody knows.', { luck: 1 }), { risk: 'risky', check: 0.6, lose: ok('A seal burns your hand. The elder knows by morning.', { contrib: -3 }) }),
    ]),
    ev('sc-friend-accused', 'A Friend Accused', '😠', { roles: CORE }, ['{npc}, a friend of yours, is accused of passing sect secrets. The evidence is thin but ugly.'], [
        c('Defend him publicly', ok('You prove the evidence was forged. He is freed, and owes you.', { contrib: 3, flag: 'saved-friend' }), { check: 0.5, lose: ok('The elders turn on you both. A season of cold looks.', { contrib: -4 }) }),
        c('Investigate quietly', ok('You find the real culprit. A quiet win.', { contrib: 4 }), { check: 0.6, lose: ok('You find nothing. He is punished.', { luck: -1 }) }),
        c('Stay out of it', ok('He is expelled. You keep your place and carry the memory.', { luck: -3, flag: 'abandoned-friend' })),
    ], { tags: ['karma'] }),
    ev('sc-experiment', 'Secret Experiments', '🧪', { roles: CORE, minRealm: 2 }, ['Elder {npc} runs an experiment in a sealed lab. He wants a volunteer, and the reward is a rare pill.'], [
        c('Volunteer', ok('The pill hurts and helps. Your cultivation rises.', { cult: 0.1, item: ['qi-pill', 2] }), { risk: 'deadly', check: 0.6, lose: ok('The experiment fails. You wake in the infirmary with scars.', { cult: -0.05 }) }),
        c('Decline', ok('He finds another volunteer. You do not ask what happened to him.')),
    ]),
    ev('se-war-policy', 'The War Council', '⚔️', { roles: ELD, minRealm: 3 }, ['The sect master wants war with a neighbour over a border mine. The council votes, and yours is the deciding voice.'], [
        c('Vote for war', ok('The war is short and costly, but the mine is yours.', { contrib: 6, stones: 2 }), { risk: 'risky', check: 0.5, lose: ok('The war drags on. The sect bleeds and you share the blame.', { contrib: -4 }) }),
        c('Vote for peace', ok('A pact is signed. The master is annoyed, the disciples relieved.', { contrib: 3, flag: 'peacemaker' })),
        c('Abstain', ok('You keep clean hands and no credit.')),
    ]),
    ev('se-disciple-talent', 'A Rare Disciple', '🌟', { roles: ELD, minRealm: 3 }, ['A new outer disciple, {npc}, shows unusual talent. A rival elder wants him as a private student.'], [
        c('Claim him as your own', ok('He learns fast and is loyal. Your name is attached to his.', { contrib: 4, flag: 'talented-student' }), { check: 0.6, lose: ok('The rival elder is angry. A feud begins.', { luck: -3 }) }),
        c('Let the rival have him', ok('A quiet favour owed to you.', { contrib: 2 })),
    ]),
    ev('se-stolen-treasure', 'The Stolen Treasure', '💎', { roles: ELD }, ['A relic of {sect} has vanished from the vault. Suspicion falls on two disciples.'], [
        c('Investigate yourself', ok('You find the thief and the relic. The sect praises you.', { contrib: 6 }), { check: 0.55, lose: ok('You accuse the wrong one. He is expelled, and you learn the truth too late.', { contrib: -4, luck: -3 }) }),
        c('Call in the sect master', ok('He solves it in a day. You lose face.', { contrib: 0 })),
    ]),
    ev('sh-heir', 'The Heir Question', '👑', { roles: HEAD, minRealm: 4 }, ['The elders press you to name an heir. Two candidates: {npc}, brilliant and ruthless, and {npc2}, gentle and loved.'], [
        c('Name the brilliant one', ok('The sect grows stronger and colder.', { treasury: 2, flag: 'ruthless-heir' })),
        c('Name the gentle one', ok('The disciples love it. Rivals start to circle.', { treasury: -1, flag: 'gentle-heir' })),
        c('Delay the decision', ok('The elders sulk and factions form.', { treasury: -1 })),
    ], { tags: ['karma'] }),
    ev('sh-spirit-vein', 'A Rich Vein Discovered', '⛰️', { roles: LEADER, minRealm: 4 }, ['Miners report a new spirit vein on the edge of your land. A neighbour claims it is theirs.'], [
        c('Take it by force', ok('You hold the vein. Enemies remember.', { treasury: 5, flag: 'seized-vein' }), { risk: 'risky', check: 0.5, lose: ok('You lose men and the vein stays contested.', { treasury: -4 }) }),
        c('Share it by treaty', ok('A fair deal and a friend.', { treasury: 2, flag: 'shared-vein' })),
        c('Sell your claim', ok('A big payment, no vein.', { treasury: 4 })),
    ]),
    ev('sh-envoy', 'An Imperial Envoy', '📯', { roles: LEADER, minRealm: 4 }, ['An envoy from the local court offers recognition of your {sect}, in exchange for oaths and a yearly levy.'], [
        c('Swear the oath', ok('Legitimacy and protection. Independence is lost.', { treasury: -2, flag: 'court-vassal' })),
        c('Refuse politely', ok('The envoy leaves cold. You owe no one.'), { }),
        c('Bribe him for better terms', ok('He softens the levy.', { treasury: -1, flag: 'court-friend' }), { cost: 0.5 }),
    ]),
    ev('ch-tomb', 'The Ancestor\'s Tomb Is Looted', '⚰️', { roles: CLH, minRealm: 3 }, ['A clan elder brings grim news: the tomb of your founding ancestor has been robbed. Bones are scattered and the relic gone.'], [
        c('Hunt the thieves', ok('You find them in the hills and recover the relic.', { treasury: 2, flag: 'tomb-avenged' }), { risk: 'risky', check: 0.5, lose: ok('The trail goes cold. The clan loses face.', { treasury: -2 }) }),
        c('Seal the tomb with a new array', ok('Safe now. It costs and honours the ancestor.', { treasury: -1.5 })),
    ]),
    ev('ch-heir-vote', 'Talent or Loyalty', '🧬', { roles: CLH, minRealm: 3 }, ['Your two children press different claims: one has talent, the other has the elders\' support.'], [
        c('Back talent', ok('The clan will be strong. The elders grumble.', { treasury: 1, flag: 'talent-heir' })),
        c('Back loyalty', ok('The elders are pleased. The clan grows safer, slower.', { treasury: 1, flag: 'loyal-heir' })),
        c('Split the duties', ok('A fragile compromise.', { treasury: -1 })),
    ]),
    ev('cm-feud', 'A Feud with a Cousin', '🥀', { roles: CLM }, ['A cousin, {npc}, spreads gossip about you at the clan hall. He wants your allowance.'], [
        c('Confront him', ok('He backs down in front of the elders.', { luck: 1 }), { check: 0.5, lose: ok('He has friends. The clan sides with him.', { luck: -2 }) }),
        c('Ignore it', ok('The gossip dies in a season.')),
        c('Ask the elder to mediate', ok('A fair verdict. You are quietly respected.', { contrib: 1 })),
    ]),
    ev('cm-allowance', 'The Clan Allowance', '💰', { roles: CLM }, ['The clan elders review allowances. A good word from you could raise or cut a cousin\'s.'], [
        c('Speak for your cousin', ok('He thanks you. You gain a friend.', { luck: 1 })),
        c('Speak for yourself', ok('The elders add a little to your stipend.', { stones: 0.5 })),
    ]),

    // ---- Crafts ----
    ev('cr-rare-recipe', 'A Dying Alchemist\'s Recipe', '📖', { craft: { id: 'alchemy', level: 2 } }, ['A dying alchemist in {city} offers his last recipe. "Take it, and carry on my work."'], [
        c('Pay his price', ok('The recipe is real. The next pills you make will be better.', { stones: -2, cult: 0.02, flag: 'rare-recipe' }), { cost: 2 }),
        c('Promise him a favour instead', ok('He nods. Later you owe a long debt to his students.', { luck: 1, flag: 'alchemist-debt' })),
        c('Decline', ok('He gives it to someone else.')),
    ]),
    ev('cr-herb-hunt', 'A Rare Herb Wanted', '🌿', { craft: { id: 'alchemy', level: 2 } }, ['A client in {city} pays well for a rare herb from a nearby secret realm. The trip is risky.'], [
        c('Go and fetch it', ok('You bring back the herb. The client pays a fortune.', { stones: 3, rep: 1 }), { risk: 'deadly', check: 0.55, craft: 'alchemy', lose: ok('The trip fails and you come back with scratches and nothing.', { stones: -0.5 }) }),
        c('Refuse', ok('The client finds a hunter instead.')),
    ]),
    ev('cr-bad-batch', 'A Bad Batch Comes Back', '☣️', { craft: { id: 'alchemy', level: 1 } }, ['A buyer storms into your stall in {city}: the pills you sold him last month made his friend ill.'], [
        c('Recall and compensate', ok('You pay and fix it. Trust is restored.', { stones: -1, rep: 1 }), { cost: 1 }),
        c('Deny everything', ok('He leaves cursing. Your name is stained.', { luck: -3, flag: 'dishonest-alchemist' }), { check: 0.5, lose: ok('The watch investigates and fines you.', { stones: -1.5, luck: -3 }) }),
    ]),
    ev('cr-alchemy-duel', 'An Alchemy Duel', '🔥', { craft: { id: 'alchemy', level: 3 } }, ['A rival alchemist, {npc}, challenges you in {city} to a public pill-refining contest. "Prove you are no fraud."'], [
        c('Accept', ok('Your pills beat his. The city talks about it for months.', { stones: 2.5, rep: 2, flag: 'alchemy-champion' }), { risk: 'risky', craft: 'alchemy', check: 0.45, lose: ok('You lose. The crowd laughs and your pride bleeds.', { stones: -1, rep: -1 }) }),
        c('Decline', ok('You walk away. His banner stays up.'), { }),
    ], { cooldown: 2160 }),
    ev('cr-forge-off', 'The Forge-Off', '🔨', { craft: { id: 'refine', level: 2 } }, ['The smiths of {city} hold their yearly forge-off. An old master will judge. The prize is a chest of rare ore.'], [
        c('Enter', ok('You place first. The old master shakes your hand.', { stones: 3, item: ['spirit-ore', 3], rep: 1 }), { craft: 'refine', check: 0.45, lose: ok('You place poorly but learn from the master.', { cult: 0.01 }) }),
        c('Watch and learn', ok('You study the winners\' work.', { cult: 0.02 })),
    ]),
    ev('cr-cursed-ore', 'The Cursed Ore', '🪨', { craft: { id: 'refine', level: 3 } }, ['A miner brings you a vein sample that hums. A spirit lives inside it, and it whispers.'], [
        c('Bind it into a weapon', ok('The blade is strong and strange. It sometimes mutters.', { stones: 3, flag: 'bound-spirit' }), { risk: 'risky', craft: 'refine', check: 0.45, lose: ok('The spirit rebels, ruining the weapon and burning your hands.', { stones: -1.5 }) }),
        c('Free the spirit', ok('It thanks you and leaves a small gift.', { luck: 3, item: ['spirit-ore', 1] })),
        c('Seal it away', ok('Safe and boring.', { stones: 0.2 })),
    ]),
    ev('cr-forgery', 'A Forgery Request', '🪞', { craft: { id: 'refine', level: 3 } }, ['A rich buyer wants a perfect copy of a famous artifact. "Nobody will know."'], [
        c('Take the job', ok('The copy is perfect. The pay is huge.', { stones: 5, flag: 'forger' }), { risk: 'risky', craft: 'refine', check: 0.55, lose: ok('A buyer spots the fake. Your name is dragged through the guild.', { stones: -2, luck: -4, flag: 'forger' }) }),
        c('Refuse', ok('He finds a worse smith. You sleep fine.')),
    ], { tags: ['dark'] }),
    ev('cr-ink-shortage', 'Spirit Ink Shortage', '🖋️', { craft: { id: 'talisman', level: 1 } }, ['A shady seller in {city} offers rare cinnabar ink at a steep discount.'], [
        c('Buy a stock', ok('The ink is good. Talismans come out crisp.', { item: ['cinnabar', 5], stones: -0.8 }), { cost: 0.8, check: 0.65, lose: ok('The ink is diluted. Your talismans fizzle.', { stones: 0 }) }),
        c('Report the seller', ok('The watch thanks you.', { rep: 1 })),
        c('Skip', ok('You buy your ink as usual.')),
    ]),
    ev('cr-war-order', 'A War Order', '⚔️', { craft: { id: 'talisman', level: 2 } }, ['A sect captain orders a hundred ward talismans for a coming war. The pay is steep, the deadline short.'], [
        c('Take the order', ok('You work three nights. The sect pays in stones and favour.', { stones: 3, contrib: 2 }), { craft: 'talisman', check: 0.55, lose: ok('You miss the deadline. The captain cuts your pay.', { stones: 0.5 }) }),
        c('Decline', ok('He finds someone else.')),
    ]),
    ev('cr-student', 'A Student Asks to Learn', '🧑‍🎓', { craft: { id: 'alchemy', level: 2 } }, ['A bright youth, {npc}, asks to learn your craft. He cannot afford the fee but is clearly gifted.'], [
        c('Teach him free', ok('He is grateful and works hard. One day his name will matter.', { luck: 2, flag: 'taught-student' })),
        c('Charge the fee', ok('He finds the money after a month. A modest income.', { stones: 1 })),
        c('Turn him away', ok('He looks hurt and leaves.')),
    ], { tags: ['mercy'] }),
];
