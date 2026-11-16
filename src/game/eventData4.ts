// Batch D: profession events for the seven newer crafts. Each needs the craft at Apprentice (level 1) or better.
import type { EventCore, Choice, Fx, Cond } from './events';
import type { CraftId } from './craft';

const ok = (text: string, fx?: Fx) => ({ text, fx });
type CO = { risk?: 'safe' | 'risky' | 'deadly'; check?: number; cost?: number; lose?: { text: string; fx?: Fx }; craft?: CraftId };
const c = (label: string, win: { text: string; fx?: Fx }, o: CO = {}): Choice => ({ label, win, risk: o.risk ?? (o.check !== undefined ? 'risky' : 'safe'), check: o.check, cost: o.cost, lose: o.lose, craft: o.craft });
const ev = (id: string, title: string, icon: string, cond: Cond, intro: string[], choices: Choice[], extra: Partial<EventCore> = {}): EventCore => ({ id, title, icon, cond, weight: 3, intro, choices, ...extra });
const K = (id: CraftId, level = 1): Cond => ({ craft: { id, level } });

export const BATCH_D: EventCore[] = [
    ev('pf-array-rival', 'A Rival Array Master', '🀄', K('formation'), ['A travelling array master in {city} sneers at your work. "Flags and jade, child. Real arrays breathe. Shall we compare?"'], [
        c('Accept a contest of arrays', ok('Your array holds longer. The crowd applauds and the master bows.', { stones: 2, luck: 2, flag: 'array-champion' }), { check: 0.55, craft: 'formation', lose: ok('Yours breaks first. You learn where it was weak.', { stones: -1, cult: 0.02 }) }),
        c('Ask to study under him instead', ok('He is surprised, then pleased. A day of lessons costs you little.', { cult: 0.05, stones: -1 })),
        c('Walk away', ok('Pride is a cheap thing to keep.')),
    ], { tags: ['craft'] }),
    ev('pf-array-flaw', 'A Flaw in the Ward', '🛖', K('formation'), ['{npc} of {city} hires you to renew the ward array around a village. You find an old flaw: a broken flag that someone sold as new.'], [
        c('Fix it quietly at your own cost', ok('The village sleeps safe. {npc} never learns what it cost you.', { stones: -2, luck: 3, karma: 3 })),
        c('Tell {npc} and demand the seller be named', ok('The seller is run out of town. The village pays you well.', { stones: 2, karma: 2 })),
        c('Take the pay and leave the flaw', ok('The pay is good. The flaw remains.', { stones: 2, karma: -5 })),
    ], { tags: ['mercy'] }),
    ev('pf-beast-wounded', 'A Wounded Beast', '🐾', K('beast'), ['A spirit beast limps out of the brush near {city}, bleeding. Its eyes are very aware. Hunters are close behind.'], [
        c('Hide it and heal it', ok('It heals slowly and leaves you a gift of hide before it goes.', { item: ['beast-hide', 2], karma: 4, flag: 'saved-beast' }), { check: 0.7, craft: 'beast', lose: ok('The hunters find you both. You pay them off.', { stones: -2 }) }),
        c('Sell it to the hunters', ok('A fair price for a bad deed.', { stones: 3, karma: -4 })),
        c('Leave it to fate', ok('You do not look back.')),
    ], { tags: ['mercy'] }),
    ev('pf-beast-bond', 'The Beast That Sits at Your Door', '🐉', K('beast', 2), ['Every dawn a wild spirit beast sits at your door and watches you work. Today it brought a gift.'], [
        c('Accept the gift and feed it', ok('You are a little more than a stranger now. A spirit core, and a quiet friend.', { item: ['core', 1], luck: 2 })),
        c('Try to tame it by force', ok('It fights. You win, barely, and it will never trust you.', { item: ['beast-hide', 3], karma: -3 }), { risk: 'risky', check: 0.5, craft: 'beast', lose: ok('It gashes you and flees.', { stones: -1 }) }),
        c('Ignore it', ok('It stops coming.')),
    ], { tags: ['craft'] }),
    ev('pf-farm-blight', 'Blight in the Fields', '🌱', K('farming'), ['A grey rot is eating the spirit fields around {city}. Every farmer is losing a harvest. {npc} asks if you can help.'], [
        c('Burn your own best bed to stop it spreading', ok('The blight stops at your fence. You lose a season of herbs and gain a name.', { stones: -2, karma: 4, flag: 'fought-blight' })),
        c('Sell a cure at a fair price', ok('A fair cure, a fair price, a fair name.', { stones: 2, karma: 1 }), { check: 0.7, craft: 'farming', lose: ok('The cure fails and your name suffers.', { stones: -1 }) }),
        c('Buy up the dying fields cheaply', ok('You profit. People remember who profited.', { stones: 3, karma: -5, flag: 'profiteer' })),
    ], { tags: ['mercy'] }),
    ev('pf-farm-fruit', 'A Strange Seed', '🍑', K('farming', 2), ['An old farmer on the road presses a black seed into your hand. "It will not sprout for the careless. Do not ask what it is."'], [
        c('Plant it with care', ok('Weeks later a single spirit fruit ripens, glowing. You eat it before you think.', { cult: 0.08, luck: 2 }), { check: 0.65, craft: 'farming', lose: ok('The sprout withers. You learn patience.', { cult: 0.01 }) }),
        c('Sell it as a rarity', ok('A merchant pays well and never asks.', { stones: 2 })),
        c('Leave it alone', ok('Some gifts are better refused.')),
    ], { tags: ['craft'] }),
    ev('pf-geo-vein', 'A Vein Under the Market', '🧭', K('geomancy'), ['Your compass spins in {city}. A fat qi vein lies under the central market, and no one else knows.'], [
        c('Tell the elders', ok('The elders reward you and consecrate the place.', { stones: 2, karma: 3, luck: 2 })),
        c('Buy the plot quietly', ok('You own a small piece of a great vein.', { cult: 0.06, stones: -3 }), { cost: 3 }),
        c('Sell the secret to a sect', ok('The sect pays and builds a wall around it.', { stones: 4, karma: -2 })),
    ], { tags: ['craft'] }),
    ev('pf-geo-tomb', 'An Old Tomb', '⚱️', K('geomancy', 2), ['Reading the hills near {city}, you find a collapsed tomb whose geomancy was laid by a master of old. The grave goods are still sealed.'], [
        c('Open it with proper rites', ok('You leave offerings and take only what the dead allow.', { stones: 3, cult: 0.03, karma: 2 }), { check: 0.6, craft: 'geomancy', lose: ok('The rites fail. Something cold follows you home.', { cult: -0.02 }) }),
        c('Break the seal and take everything', ok('A fortune in goods, and a bad feeling.', { stones: 5, karma: -5, flag: 'tomb-robber' }), { risk: 'risky', check: 0.5, lose: ok('The tomb answers. You flee with nothing.', { stones: -2 }) }),
        c('Mark the place and leave', ok('Some things are not yours.', { karma: 1 })),
    ], { tags: ['dark'] }),
    ev('pf-div-dread', 'A Dreadful Reading', '🔮', K('divination'), ['A merchant of {city} begs for a reading before a long voyage. The shells fall badly: he will not come home.'], [
        c('Tell him the truth', ok('He cancels the voyage, thanks you in tears, and a month later his ship sinks.', { stones: 1, karma: 3, luck: 2 })),
        c('Lie and say it is fine', ok('He sails. You do not read the news.', { stones: 2, karma: -6 })),
        c('Refuse to read for him', ok('He goes elsewhere. You never learn the end.')),
    ], { tags: ['mercy'] }),
    ev('pf-div-fate', 'A Stranger Who Knows Your Fate', '🎴', K('divination', 2), ['A blind seer in {city} stops you in the street. "I read you, little diviner. You will want to hear it, and you will pay for it."'], [
        c('Pay for the whole reading', ok('Some of it is useful. Some of it you wish you had not heard.', { cult: 0.05, luck: 3, stones: -2 }), { cost: 2 }),
        c('Ask only one question', ok('One answer, one warning. Cheap and sharp.', { luck: 2, stones: -1 })),
        c('Cast your own and ignore him', ok('Your own shells say the same, only kinder.', { cult: 0.02 }), { check: 0.55, craft: 'divination', lose: ok('Your shells crack. A bad omen.', { luck: -3 }) }),
    ], { tags: ['craft'] }),
    ev('pf-puppet-theft', 'Puppet Thief', '🤖', K('puppet'), ['You wake to find the door of your workshop open and a half-built puppet gone. A trail of oil leads out of {city}.'], [
        c('Follow the trail', ok('You catch {npc}, who begs for mercy. You take your puppet back and a lesson for him.', { item: ['refined-iron', 2], karma: 1 }), { check: 0.55, craft: 'puppet', lose: ok('You lose the trail and a night.', {}) }),
        c('Let it go and build a better one', ok('The next one is better, and locked in.', { stones: -1, cult: 0.02 })),
        c('Put a bounty on him', ok('A bounty hunter brings him back, damaged.', { stones: -2, karma: -2 }), { cost: 2 }),
    ], { tags: ['craft'] }),
    ev('pf-puppet-soul', 'The Puppet That Looks Back', '🎭', K('puppet', 2), ['In the quiet of the night, your finest puppet turns its head and looks at you. Its eyes are not wood.'], [
        c('Break it, to be safe', ok('It falls apart. You feel something leave the room.', { karma: 1 })),
        c('Study what happened', ok('A scrap of will lingered in the wood. You learn a secret of the craft.', { cult: 0.05, flag: 'bound-spirit' }), { check: 0.55, craft: 'puppet', lose: ok('The will snaps back into the wood and lashes out.', { cult: -0.02 }) }),
        c('Bind the spirit into it, for good', ok('A loyal servant, of a kind. Its eyes follow you everywhere.', { stones: 2, karma: -4, flag: 'bound-spirit' })),
    ], { tags: ['dark'] }),
    ev('pf-poison-client', 'A Quiet Client', '☠️', K('poison'), ['A cloaked client in {city} places a heavy purse on the table. "A tasteless dose. For a man who has wronged me. I will say no more."'], [
        c('Refuse and send them away', ok('The client leaves, cold. Your hands stay clean.', { karma: 2 })),
        c('Make it, and take the purse', ok('A death with no name. The purse is heavy and so is your conscience.', { stones: 4, karma: -8, flag: 'poisoner' })),
        c('Take the purse, make a harmless dose', ok('They never learn. Nor does the man marked for death.', { stones: 3, karma: 1 }), { check: 0.6, craft: 'poison', lose: ok('They notice. Your name is mud in the trade.', { stones: -2, karma: -1 }) }),
    ], { tags: ['dark'] }),
    ev('pf-poison-rival', 'The Alchemist and the Poisoner', '⚗️', K('poison'), ['The local alchemist blames your venoms for a poisoning in {city}. You did not make that poison. Probably.'], [
        c('Prove your innocence with a public test', ok('Your venoms are clean of it. The alchemist apologises and the town respects you more.', { luck: 2, karma: 2 }), { check: 0.6, craft: 'poison', lose: ok('The test goes badly. Your name takes a beating.', { stones: -2, luck: -2 }) }),
        c('Poison his stock in the night', ok('The alchemist never works again. You do not sleep well.', { stones: 2, karma: -9, flag: 'poisoner' })),
        c('Let the rumour run its course', ok('It dies, in time.', { luck: -1 })),
    ], { tags: ['dark'] }),
];
