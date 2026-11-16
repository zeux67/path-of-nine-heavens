// Device settings (kept apart from the life): theme, text size, motion. Held in App via useLocalState, shared by context.
import { createContext, useContext } from 'react';
export interface Prefs { theme: 'dark' | 'light' | 'auto'; text: 's' | 'm' | 'l'; calm: boolean }
export const DEFAULT_PREFS: Prefs = { theme: 'dark', text: 'm', calm: false };
export const PREFS_KEY = 'nh.prefs.v1';
export const PrefsCtx = createContext<{ prefs: Prefs; set: (p: Partial<Prefs>) => void }>({ prefs: DEFAULT_PREFS, set: () => undefined });
export const usePrefs = (): Prefs => useContext(PrefsCtx).prefs;
export const useSetPrefs = () => useContext(PrefsCtx).set;
export const isLight = (p: Prefs) => p.theme === 'light' || (p.theme === 'auto' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: light)').matches);
export const shellClass = (p: Prefs) => `game-shell${isLight(p) ? ' light' : ''}${p.calm ? ' rm' : ''} fs-${p.text}`;
