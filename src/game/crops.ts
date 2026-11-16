// Crop list for spirit farming (leaf module so item generation can read it safely).
export interface Crop { id: string; item: string; name: string; icon: string; days: number; qty: number; level: number; fee: number }
export const CROPS: Crop[] = [
    { id: 'crop-herb', item: 'herb', name: 'Spirit Herb', icon: '🌿', days: 12, qty: 3, level: 0, fee: 0 },
    { id: 'crop-bitter', item: 'bitter-root', name: 'Bitter Root', icon: '🥕', days: 12, qty: 3, level: 0, fee: 10 },
    { id: 'crop-moon', item: 'moonblossom', name: 'Moonblossom', icon: '🌸', days: 25, qty: 3, level: 2, fee: 50 },
    { id: 'crop-lotus', item: 'fire-lotus', name: 'Fire Lotus', icon: '🪷', days: 40, qty: 3, level: 3, fee: 80 },
    { id: 'crop-ginseng', item: 'ginseng', name: 'Old Ginseng', icon: '🪴', days: 90, qty: 2, level: 4, fee: 150 },
    { id: 'crop-fruit', item: 'spirit-fruit', name: 'Spirit Fruit', icon: '🍑', days: 60, qty: 2, level: 3, fee: 120 },
];
