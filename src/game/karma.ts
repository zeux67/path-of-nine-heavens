// Karma: a signed ledger grown from the righteous/demonic nature each life is born with.
// Positive = merit, negative = sin. The same deed weighs differently by nature: a righteous cultivator
// who does evil breaks their own vows (x1.5), a demonic one has made peace with it (x0.6) but earns less credit for mercy (x0.6).
// The heart-demon tribulation reads this ledger and the life's remembered choices. Items cannot buy a way past it.
import type { SaveGame } from './state';
import { mulberry32 } from './rng';

export const KARMA_MAX = 100;

// Deeds remembered as event flags -> karma change. Positive = merit.
export const KARMA_FLAGS: Record<string, number> = {
    'took-refugees': 6, 'defended-newcomer': 3, 'helped-fugitive': 2, 'plague-saviour': 8, 'saved-friend': 4, 'orphan-ward': 5, 'adopted-outsider': 4,
    'peacemaker': 4, 'shared-vein': 3, 'tomb-avenged': 2, 'traitor-exposed': 2, 'taught-student': 3, 'fair-elder': 3, 'gentle-heir': 3,
    'sold-orphan': -10, 'cruel-to-beggar': -4, 'abandoned-friend': -5, 'crippled-student': -9, 'silenced-master': -12, 'slew-patrol': -6,
    'hired-assassin': -6, 'blood-pact': -10, 'poisoner': -5, 'forger': -3, 'dishonest-alchemist': -4, 'profiteer': -3, 'seized-vein': -5,
    'dark-patron': -5, 'ruthless-heir': -3, 'forbidden-manual': -4, 'forbidden-talisman': -4, 'dirty-politics': -3, 'dark-craft': -6, 'saved-beast': 3, 'fought-blight': 4, 'tomb-robber': -5, 'saved-child': 4, 'skimmer': -3, 'bound-spirit': -4,
};

export function karmaOf(s: SaveGame): number { return s.karma ?? 0; }
export const KARMA_STEPS: [number, string][] = [[-60, 'Blood-soaked'], [-30, 'Stained'], [-10, 'Tarnished'], [10, 'Unmarked'], [30, 'Kind'], [60, 'Virtuous'], [101, 'Saint-like']];
export function karmaWord(s: SaveGame): string { const k = karmaOf(s); return (KARMA_STEPS.find(([m]) => k < m) ?? KARMA_STEPS[KARMA_STEPS.length - 1])[1]; }

export function karmaWeight(s: SaveGame, delta: number): number {
    const dem = s.char.alignment === 'demonic';
    if (delta < 0) return delta * (dem ? 0.6 : 1.5);
    return delta * (dem ? 0.6 : 1);
}
// Adds a deed to the ledger (weighted by nature) and remembers the last few reasons.
export function addKarma(s: SaveGame, delta: number, why?: string): SaveGame {
    if (!delta) return s;
    const w = Math.round(karmaWeight(s, delta) * 10) / 10;
    const k = Math.max(-KARMA_MAX, Math.min(KARMA_MAX, karmaOf(s) + w));
    const log = why ? [`${w > 0 ? '+' : ''}${w} ${why}`, ...(s.karmaLog ?? [])].slice(0, 8) : s.karmaLog;
    return { ...s, karma: k, karmaLog: log };
}
// Applies a remembered flag to the ledger once.
export function karmaForFlag(s: SaveGame, flag: string): SaveGame {
    const d = KARMA_FLAGS[flag];
    return d ? addKarma(s, d, flag.replace(/-/g, ' ')) : s;
}
// Sin makes breakthroughs harder, merit eases them a little.
export const karmaBt = (s: SaveGame) => Math.max(-0.06, Math.min(0.03, karmaOf(s) / 1500));

// ---- Heart-demon tribulation ------------------------------------------------------------
export const HD_FROM = 3; // the Nascent Soul breakthrough and every second realm after
export const heartDemonAt = (nextRealm: number) => nextRealm >= HD_FROM && (nextRealm - HD_FROM) % 2 === 0;
export const hdTrials = (nextRealm: number) => Math.min(5, 3 + Math.floor((nextRealm - HD_FROM) / 2));

export interface HdTrial { id: string; title: string; icon: string; text: string; face: string; resist: string; embrace: string }
export interface HdState { realm: number; seed: number; step: number; passes: number; fails: number; ids: string[]; log: string[]; usedPill: boolean; underGrade: boolean }

interface TrialDef { id: string; icon: string; title: string; when: (s: SaveGame) => boolean; text: (s: SaveGame) => string; face: string; resist: string; embrace: string; win: Record<'face' | 'resist' | 'embrace', string>; lose: Record<'face' | 'resist' | 'embrace', string> }
const flag = (s: SaveGame, f: string) => (s.evflags ?? []).includes(f);
const anyFlag = (s: SaveGame, fs: string[]) => fs.some(f => flag(s, f));
const SINS = ['sold-orphan', 'crippled-student', 'silenced-master', 'slew-patrol', 'abandoned-friend', 'cruel-to-beggar', 'blood-pact', 'hired-assassin'];
const sinful = (s: SaveGame) => karmaOf(s) <= -10 || anyFlag(s, SINS);
const kind = (s: SaveGame) => karmaOf(s) >= 10;

const TRIALS: TrialDef[] = [
    { id: 'victims', icon: '👥', title: 'The ones you wronged', when: sinful,
      text: s => anyFlag(s, ['sold-orphan']) ? 'A child you once sold stands in the dark and does not speak. Behind it, more faces. They all know your name.' : anyFlag(s, ['crippled-student', 'silenced-master']) ? 'A face you silenced and a hand you crippled come toward you, quite calmly. "Why?" they ask.' : 'Faces from your past crowd the dark: people you took from, left behind, or hurt. They do not rage. They only watch.',
      face: 'Look at them and say you did it', resist: 'Tell yourself it was needed', embrace: 'Say they were weak and you are not',
      win: { face: 'You name each wrong aloud. The faces fade. It hurts, and you are lighter.', resist: 'The excuse holds, barely. The faces dim.', embrace: 'Your cruelty burns the vision away. Something in you hardens.' },
      lose: { face: 'You cannot say it. The faces press closer and the dark has your breath.', resist: 'The excuse cracks. They know it is a lie, and so do you.', embrace: 'You laugh and the dark laughs back, louder.' } },
    { id: 'mercy', icon: '🕯️', title: 'The ones you saved', when: kind,
      text: s => anyFlag(s, ['plague-saviour', 'took-refugees']) ? 'A crowd you once fed and sheltered stands in a golden haze. They bow. Then they ask you to stay with them, forever, and give up the road.' : 'People you helped appear in warm light and thank you. The heart-demon wears their kindness: "Stay. You have done enough. Climbing is selfish."',
      face: 'Thank them, and walk on', resist: 'Refuse the warmth and push through', embrace: 'Stay a little, then decide',
      win: { face: 'You leave with their blessing. The haze turns to dawn.', resist: 'You tear free. Cold, but clear.', embrace: 'You rest, take what strength it gives, and leave when ready.' },
      lose: { face: 'The thanks turn into a leash. You hesitate and the moment passes.', resist: 'You push too hard and the warmth turns to ash in your hands.', embrace: 'You stay too long. Years pass inside the vision.' } },
    { id: 'death', icon: '⏳', title: 'The end of your years', when: () => true,
      text: () => `You see yourself old, grey and forgotten, turned to dust while the mountains stand. The heart-demon whispers: "Take any road. Take it now."`,
      face: 'Accept that you will die someday', resist: 'Shout down the fear', embrace: 'Promise anything to live longer',
      win: { face: 'You breathe out. Death is a road too. The vision loosens.', resist: 'Your will rings like a bell. The vision shatters.', embrace: 'The dark takes the promise and gives you your breath back, for now.' },
      lose: { face: 'You say the words and do not mean them. The fear sees.', resist: 'The shout is hollow. Fear answers it with silence.', embrace: 'You bargain. The dark enjoys that very much.' } },
    { id: 'loved', icon: '🏡', title: 'The ones you left', when: () => true,
      text: s => s.family?.length ? 'Your family sits at a table that has gone cold. One chair is yours. They look up. They are older than you remember.' : 'A home you never had, a table with a chair kept empty. Someone you might have loved asks you to come in from the road.',
      face: 'Sit, then rise and leave them with love', resist: 'Turn your back on the table', embrace: 'Take the chair and stop climbing',
      win: { face: 'You eat one meal with them and leave without regret.', resist: 'You walk on. It costs you something you will not get back.', embrace: 'You stay a while and are stronger for it, then rise.' },
      lose: { face: 'You cannot sit and you cannot leave. The table fills with ash.', resist: 'The empty chair follows you out into the dark.', embrace: 'The warmth is a lie and it keeps you.' } },
    { id: 'power', icon: '🔥', title: 'The throne of power', when: () => true,
      text: () => 'A throne of bones and gold. The heart-demon wears your face and offers you every realm at once, for one small thing: your name.',
      face: 'Refuse and ask what it truly wants', resist: 'Smash the throne', embrace: 'Take the throne and bend it to you',
      win: { face: 'You ask, and it has no answer. The throne cracks.', resist: 'The throne shatters and so does the vision.', embrace: 'The throne is yours now, and the demon is its servant. For this hour.' },
      lose: { face: 'It answers truthfully and the truth is worse than you hoped.', resist: 'The throne reforms behind you, larger.', embrace: 'The throne takes the name and gives you nothing back.' } },
    { id: 'mirror', icon: '🪞', title: 'Your own face', when: () => true,
      text: s => s.char.alignment === 'demonic' ? 'A mirror shows the righteous cultivator you could have been. It speaks gently: "It is not too late to turn."' : 'A mirror shows the cruel cultivator you could have been. It smiles. "It is not too late to take what you want."',
      face: 'Look until you see all of yourself', resist: 'Break the mirror', embrace: 'Step into the other self',
      win: { face: 'You see both and choose. The mirror goes still.', resist: 'The glass breaks and each shard shows your own eyes.', embrace: 'You wear the other face a moment and take back your own.' },
      lose: { face: 'You look away first.', resist: 'The shards cut. Each one remembers.', embrace: 'The other self does not step back out.' } },
];

export const hdPick = (s: SaveGame, seed: number, n: number): string[] => {
    const rng = mulberry32(seed);
    const pool = TRIALS.filter(t => t.when(s) && t.id !== 'mirror');
    const out: string[] = [];
    // The ones that read the life come first when they apply.
    for (const id of ['victims', 'mercy']) { const t = pool.find(p => p.id === id); if (t && out.length < n) out.push(t.id); }
    const rest = pool.filter(p => !out.includes(p.id)).map(p => p.id);
    while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
    if (out.length < n) out.push('mirror');
    return out.slice(0, n);
};
export function startHd(s: SaveGame, realm: number, usedPill: boolean, underGrade: boolean): HdState {
    const seed = (s.seed ^ (realm * 7919) ^ Math.floor(s.clockDays)) >>> 0;
    return { realm, seed, step: 0, passes: 0, fails: 0, ids: hdPick(s, seed, hdTrials(realm)), log: [], usedPill, underGrade };
}
export const hdTrial = (s: SaveGame, hd: HdState): (HdTrial & { n: number; of: number }) | null => {
    const id = hd.ids[hd.step]; const t = TRIALS.find(x => x.id === id); if (!t) return null;
    return { id: t.id, title: t.title, icon: t.icon, text: t.text(s), face: t.face, resist: t.resist, embrace: t.embrace, n: hd.step + 1, of: hd.ids.length };
};
// Chance to hold each way. No item enters the sum.
export function hdChance(s: SaveGame, hd: HdState, way: 'face' | 'resist' | 'embrace'): number {
    const dem = s.char.alignment === 'demonic', k = karmaOf(s);
    const clarity = 0.58 + s.char.comprehension * 0.03 + (s.char.luck - 50) * 0.0015 - (hd.realm - HD_FROM) * 0.01;
    const debt = Math.max(0, -k) * (dem ? 0.002 : 0.004);
    const merit = Math.max(0, k) * 0.002;
    let p: number;
    if (way === 'face') p = clarity + merit - debt;
    else if (way === 'resist') p = clarity - 0.08 + (dem ? 0.1 : 0) - debt * 1.3 + merit * 0.5;
    else p = clarity - 0.18 + (dem ? 0.28 : 0) - debt * 0.5 - merit;
    return Math.max(0.1, Math.min(0.92, p));
}
export const hdNeed = (hd: HdState) => hd.ids.length - 1; // one slip is allowed
export function hdResolveStep(s: SaveGame, hd: HdState, way: 'face' | 'resist' | 'embrace'): { hd: HdState; text: string; won: boolean; save: SaveGame } {
    const t = TRIALS.find(x => x.id === hd.ids[hd.step])!;
    const rng = mulberry32((hd.seed ^ ((hd.step + 1) * 104729) ^ (way === 'face' ? 1 : way === 'resist' ? 2 : 3)) >>> 0);
    const won = rng() < hdChance(s, hd, way);
    const text = won ? t.win[way] : t.lose[way];
    let n = s;
    if (won && way === 'embrace' && s.char.alignment !== 'demonic') n = addKarma(n, -2, 'embraced the dark in your heart');
    if (won && way === 'face' && sinful(s)) n = addKarma(n, 3, 'faced your sins');
    const nh = { ...hd, step: hd.step + 1, passes: hd.passes + (won ? 1 : 0), fails: hd.fails + (won ? 0 : 1), log: [...hd.log, text] };
    return { hd: nh, text, won, save: n };
}
export const hdDone = (hd: HdState) => hd.step >= hd.ids.length;
export const hdPassed = (hd: HdState) => hd.passes >= hdNeed(hd);
