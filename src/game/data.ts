// Static game data: tiers, fate patterns, physiques, name pools.

export interface Tier {
    name: string;
    effect: string;
}

// ---- Spiritual roots ----------------------------------------------------
export const ROOT_TIERS: (Tier & { speed: number; ceiling: string })[] = [
    { name: 'Mortal Root', speed: 1.0, ceiling: 'Golden Core', effect: 'Cultivation speed x1.0. Soft ceiling: Golden Core. Beyond it, only opportunity can carry you.' },
    { name: 'Pseudo Root', speed: 1.4, ceiling: 'Nascent Soul', effect: 'Cultivation speed x1.4. Soft ceiling: Nascent Soul.' },
    { name: 'Mixed Root', speed: 1.8, ceiling: 'Body Tribulation', effect: 'Cultivation speed x1.8. Soft ceiling: Body Tribulation.' },
    { name: 'Earth Root', speed: 2.4, ceiling: 'Spirit Unity', effect: 'Cultivation speed x2.4. Soft ceiling: Spirit Unity.' },
    { name: 'Heaven Root', speed: 3.2, ceiling: 'Ascendant', effect: 'Cultivation speed x3.2. Soft ceiling: Ascendant. Sects will fight over you.' },
    { name: 'Immortal Root', speed: 4.5, ceiling: 'Golden Immortal', effect: 'Cultivation speed x4.5. Soft ceiling: Golden Immortal. Once in ten thousand years.' },
    { name: 'Divine Root', speed: 6.0, ceiling: 'None', effect: 'Cultivation speed x6.0. No ceiling. The heavens themselves will watch you.' },
];
export const ROOT_WEIGHTS = [40, 25, 18, 10, 5, 1.5, 0.5];
export const AVATARS: Record<'male' | 'female', string[]> = {
    male: ['🧘‍♂️', '🧙‍♂️', '🥷', '🧑‍🌾', '🦅', '🐉'],
    female: ['🧘‍♀️', '🧙‍♀️', '💃', '👩‍🌾', '🦋', '🌸'],
};
export const ROOT_AVATARS = ['\u{1F6B6}', '\u{1F9D8}', '\u{1F9D8}', '\u{1F9D8}', '✨', '\u{1F31F}', '\u{1F409}'];

// ---- Cultivation realms (for reference display) -------------------------
export const REALMS = [
    'Qi Refining', 'Foundation Establishment', 'Golden Core', 'Nascent Soul',
    'Body Tribulation', 'Deity Transformation', 'Spirit Unity', 'Mahayana',
    'Ascendant', 'Pseudo Immortal', 'True Immortal', 'Earth Immortal',
    'Golden Immortal', 'Divine Immortal', 'Immortal Emperor',
];

// ---- Constitution --------------------------------------------------------
export const CONSTITUTION_TIERS: Tier[] = [
    { name: 'Mortal Body', effect: 'An ordinary body. No bonus, no burden.' },
    { name: 'Tempered Body', effect: 'Slightly tougher. Small combat power bonus.' },
    { name: 'Spirit Body', effect: 'Spiritual energy flows easily. Modest combat and healing bonus.' },
    { name: 'Earth Body', effect: 'Tough as bedrock. Solid combat power and tribulation resistance.' },
    { name: 'Heaven Body', effect: 'Favored by the world. Large combat bonus. Rare named physiques can appear from this tier up.' },
    { name: 'Immortal Body', effect: 'Half a step beyond mortality. Huge combat bonus, fast healing, longer lifespan.' },
    { name: 'Divine Body', effect: 'A body fit for gods. Immense combat power. Rare named physiques are likely.' },
];
export const CONSTITUTION_WEIGHTS = [38, 26, 17, 10, 6, 2, 1];

export const NAMED_PHYSIQUES: { name: string; effect: string }[] = [
    { name: 'Sword Heart Physique', effect: 'Sword arts and sword techniques are learned far faster. Sword intent comes naturally.' },
    { name: 'Myriad Poison Body', effect: 'Immune to poison. Bonus talent in alchemy; poisons become tonics.' },
    { name: 'Heavenly Lightning Body', effect: 'Lightning affinity. Heavenly tribulations hurt less and temper you more.' },
    { name: 'Frost Jade Body', effect: 'Ice affinity and a calm mind. Comprehension effectively one tier higher.' },
    { name: 'Solar Flame Body', effect: 'Fire affinity. Fine control over pill furnaces: bonus talent in alchemy and artifact refining.' },
    { name: 'Dragon Blood Physique', effect: 'Dragon blood in your veins. Great strength, longer lifespan, beasts bow to you.' },
    { name: 'Void Spirit Body', effect: 'You blur against the world. Harder to track, ambushes on the road rarely find you.' },
    { name: 'Eternal Greenwood Body', effect: 'Wounds knit fast. Spirit herbs thrive near you; medicine gardens favor you.' },
];

// ---- Comprehension -------------------------------------------------------
export const COMPREHENSION_TIERS: (Tier & { learn: number })[] = [
    { name: 'Dull', learn: 0.6, effect: 'Techniques and arts learned at x0.6 speed. The dao is a closed book.' },
    { name: 'Ordinary', learn: 1.0, effect: 'Techniques and arts learned at x1.0 speed.' },
    { name: 'Bright', learn: 1.25, effect: 'Techniques and arts learned at x1.25 speed.' },
    { name: 'Keen', learn: 1.5, effect: 'Techniques and arts learned at x1.5 speed. Small bonus to breakthrough odds.' },
    { name: 'Genius', learn: 2.0, effect: 'Techniques and arts learned at x2.0 speed. Noticeable bonus to breakthrough odds.' },
    { name: 'Prodigy', learn: 3.0, effect: 'Techniques and arts learned at x3.0 speed. Real bonus to breakthrough odds.' },
    { name: 'Heaven-Defying', learn: 5.0, effect: 'Techniques and arts learned at x5.0 speed. Insight strikes like lightning.' },
];
export const COMPREHENSION_WEIGHTS = [20, 32, 22, 14, 8, 3, 1];

// ---- Fate patterns -------------------------------------------------------
export type FateKind = 'blessing' | 'curse' | 'mixed';
export interface FatePattern {
    name: string;
    kind: FateKind;
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    effect: string;
}
export const FATE_PATTERNS: FatePattern[] = [
    // Blessings
    { name: "Heaven's Favorite", kind: 'blessing', rarity: 'legendary', effect: 'Luck +25. Fortunate events seek you out.' },
    { name: 'Fortuitous Encounters', kind: 'blessing', rarity: 'rare', effect: 'Secret realms and lucky encounters find you far more often.' },
    { name: 'Reincarnated Expert', kind: 'blessing', rarity: 'legendary', effect: 'You carry past-life memories: techniques are learned as if your comprehension were two tiers higher.' },
    { name: 'Pill Destiny', kind: 'blessing', rarity: 'rare', effect: 'A hidden alchemy talent, two grades higher, revealed at your first study.' },
    { name: 'Golden Finger', kind: 'blessing', rarity: 'legendary', effect: 'A mysterious perk sleeps within you. It will reveal itself when the time comes.' },
    { name: 'Born Under a Lucky Star', kind: 'blessing', rarity: 'uncommon', effect: 'Luck +10.' },
    { name: "Merchant's Eye", kind: 'blessing', rarity: 'common', effect: 'You spot value others miss. Better prices in every market.' },
    { name: 'Beast Affinity', kind: 'blessing', rarity: 'uncommon', effect: 'Spirit beasts trust you. Beast taming comes one grade easier.' },
    { name: 'Sword Heart Seed', kind: 'blessing', rarity: 'rare', effect: 'A seed of sword intent. Sword techniques are learned faster.' },
    { name: 'Unblocked Meridians', kind: 'blessing', rarity: 'uncommon', effect: 'Your early cultivation flows smoothly: faster progress through Qi Refining.' },
    { name: 'Noble Bearing', kind: 'blessing', rarity: 'common', effect: 'You carry yourself like nobility. Sects and clans accept you more easily.' },
    { name: 'Long Breath', kind: 'blessing', rarity: 'common', effect: 'A deep, slow vitality. Modestly longer lifespan.' },
    { name: 'Iron Will', kind: 'blessing', rarity: 'uncommon', effect: 'Failed breakthroughs wound your pride, not your foundation. Failure costs less.' },
    { name: "Wanderer's Luck", kind: 'blessing', rarity: 'uncommon', effect: 'The road loves you. Travel encounters lean fortunate.' },
    // Curses
    { name: "Heaven's Jealousy", kind: 'curse', rarity: 'rare', effect: 'The heavens resent you. Heavenly tribulations strike you harder.' },
    { name: 'Withered Lifespan', kind: 'curse', rarity: 'rare', effect: 'Your candle burns short. Lifespan reduced from birth.' },
    { name: 'Blocked Meridians', kind: 'curse', rarity: 'rare', effect: 'Cultivation crawls at the start. But blocked meridians sometimes hide a physique that awakens later.' },
    { name: 'Lonely Star', kind: 'curse', rarity: 'uncommon', effect: 'You walk alone. No sect, clan or affiliation will ever claim you.' },
    { name: 'Karmic Debt', kind: 'curse', rarity: 'rare', effect: 'A powerful enemy hunts your bloodline. One day, they will find you.' },
    { name: 'Frail Body', kind: 'curse', rarity: 'common', effect: 'A weak vessel. Combat power reduced.' },
    { name: 'Clouded Mind', kind: 'curse', rarity: 'common', effect: 'The secondary arts resist you: learned as if comprehension were one tier lower.' },
    { name: 'Misfortune Magnet', kind: 'curse', rarity: 'uncommon', effect: 'Trouble finds you on the road. Travel encounters lean dangerous.' },
    { name: 'Scarred Dantian', kind: 'curse', rarity: 'rare', effect: 'An old wound in your core. Breakthrough odds slightly reduced.' },
    // Mixed
    { name: 'Great Misfortune, Great Fortune', kind: 'mixed', rarity: 'rare', effect: 'Disaster and miracle alternate through your life. Nothing will ever be boring.' },
    { name: 'Cursed Blessing', kind: 'mixed', rarity: 'uncommon', effect: 'Your luck swings wildly between ruin and windfall.' },
    { name: 'Old Soul, Young Body', kind: 'mixed', rarity: 'uncommon', effect: 'Comprehension effectively one tier higher, constitution one tier lower.' },
];
export const FATE_RARITY_WEIGHTS = { common: 46, uncommon: 30, rare: 18, legendary: 6 };

// ---- Names ---------------------------------------------------------------
export const SURNAMES = ['Xiao', 'Lin', 'Ye', 'Chen', 'Wang', 'Li', 'Zhao', 'Su', 'Han', 'Gu', 'Qin', 'Mu', 'Bai', 'Feng', 'Long', 'Murong', 'Nangong', 'Ouyang', 'Dugu', 'Sima', 'Baili', 'Helian', 'Jiang', 'Shen', 'Lu', 'Wei'];
export const GIVEN_NAMES = ['Chen', 'Hao', 'Yun', 'Qing', 'Feng', 'Tian', 'Ming', 'Xuan', 'Yan', 'Lei', 'Wuji', 'Zimo', 'Qingge', 'Ruoxi', 'Jian', 'Bai', 'Sha', 'Dong', 'Hu', 'Ling', 'Yue', 'Xing', 'He', 'An', 'Rou', 'Ting', 'Fan', 'Ao', 'Jue', 'Han'];

export const CLAN_NAMES = ['Xiao', 'Lin', 'Ye', 'Murong', 'Nangong', 'Ouyang', 'Dugu', 'Sima', 'Baili', 'Helian', 'Jiang', 'Shen'];
export const SECT_NAMES = [
    'Profound Heaven Sect', 'Azure Cloud Sect', 'Seven Star Pavilion', 'Jade Maiden Palace',
    'Thunder Sword Sect', 'Ten Thousand Beasts Hall', 'Mystic Alchemy Pavilion', 'Iron Formation Sect',
    'Spirit Talisman Hall', 'Silent Buddha Temple', 'Raging Flame Valley', 'Frozen River Sect',
    'Ghost Shadow Sect', 'Heavenly Calculation Pavilion', 'Blood Moon Sect', 'Myriad Sword Villa',
];
export const ANCESTRIES = [
    'Descendant of the Moon-Swallowing Fox',
    'Blood of the ancient Barbarian Kings',
    'Lineage of a fallen Sword Immortal',
    "Bloodline of the Azure Dragon's servant clan",
    'Last heir of a destroyed celestial sect',
    'Seed of a scattered Immortal dynasty',
];

export const CONTINENT_NAMES = [
    'Azure Dragon Continent', 'Verdant Crane Expanse', 'Profound Tortoise Mainland',
    'Scarlet Phoenix Reach', 'Silent Tiger Steppes', 'Jade Qilin Wilds',
];
export const PREFECTURE_WORDS = [
    'Jade Cloud', 'Falling Star', 'Greenpeak', 'Moonwater', 'Thunderclap', 'Whitesand',
    'Ninefold', 'Emberstone', 'Frostveil', 'Goldleaf', 'Blackroot', 'Spirit Wind',
    'Ashen', 'Lotus River', 'Sword Ridge', 'Mistral Hollow', 'Crimson Sparrow', 'Silent Rain',
];
export const COUNTRY_NAMES = [
    'Great Yan Kingdom', 'Wei Dynasty', 'Kingdom of Chu', 'Zhao Marches', 'Qilin Dominion',
    'Red Maple Kingdom', 'Ironpine Union', 'Cloudveil Theocracy', 'State of Jin',
    'Liang Territories', 'Xia Principality', 'Northern Ji Steppes', 'Riverlands Compact', 'Jadefall Court',
];
export const CITY_PREFIX = ['Green', 'Jade', 'Moon', 'Star', 'Cloud', 'Iron', 'Red', 'White', 'Black', 'Frost', 'Ember', 'Stone', 'River', 'Mist', 'Thunder', 'Azure', 'Gold', 'Silent', 'Falling', 'Rising', 'Spirit', 'Lotus', 'Sword', 'Amber'];
export const CITY_SUFFIX = ['cloud', 'fall', 'ford', 'gate', 'hollow', 'peak', 'rest', 'shore', 'spring', 'watch', 'reach', 'vale', 'brook', 'field', 'haven', 'march', 'wall', 'crown', 'spire', 'basin', 'wind', 'grove', 'light', 'song'];

// ---- Birthplace tiers -----------------------------------------------------
export const BIRTHPLACE_LABEL: Record<string, string> = {
    village: 'Small village',
    town: 'Country town',
    city: 'Country city',
    capital: 'Prefectural capital',
    market: 'Great market city',
};

// ---- Market tiers ---------------------------------------------------------
export const MARKET_TIERS = ['No market', 'Roadside stalls', 'Cultivation market', 'Grand market'];
