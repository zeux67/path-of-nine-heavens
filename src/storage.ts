import { useCallback, useState } from 'react';
// Standalone browser persistence. Storage is specific to this origin and device.
export function useLocalState<T>(key: string, initial: T): [T, (next: T) => void, { ready: boolean }] {
  const [value, setValue] = useState<T>(() => {
    // A damaged or blocked store must not silently turn into a fresh life.
    const raw = localStorage.getItem(key);
    return raw === null ? initial : JSON.parse(raw) as T;
  });
  const set = useCallback((next: T) => {
    // Write before updating memory, so storage errors cannot look like successful saves.
    localStorage.setItem(key, JSON.stringify(next));
    setValue(next);
  }, [key]);
  return [value, set, { ready: true }];
}
