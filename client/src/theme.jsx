import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const KEY = 'magdrive_theme'; // stores the MODE: 'light' | 'dark' | 'auto'
const ThemeCtx = createContext({ mode: 'auto', theme: 'light', cycle: () => {} });

const osPrefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

function getMode() {
  const s = localStorage.getItem(KEY);
  return s === 'light' || s === 'dark' || s === 'auto' ? s : 'auto'; // default: follow OS
}

// Resolve a mode to the concrete light/dark theme that hits the DOM.
const resolve = (mode) => (mode === 'auto' ? (osPrefersDark() ? 'dark' : 'light') : mode);

const apply = (theme) => {
  document.documentElement.dataset.theme = theme;
};

// Apply before React paints (called from main.jsx) to avoid a flash of the wrong theme.
export function initTheme() {
  const theme = resolve(getMode());
  apply(theme);
  return theme;
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(getMode);
  const [theme, setTheme] = useState(() => resolve(getMode()));

  // Persist + apply whenever the mode changes.
  useEffect(() => {
    const t = resolve(mode);
    setTheme(t);
    apply(t);
    localStorage.setItem(KEY, mode);
  }, [mode]);

  // While in Auto, live-follow OS appearance changes.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      if (getMode() === 'auto') {
        const t = e.matches ? 'dark' : 'light';
        setTheme(t);
        apply(t);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Light → Dark → Auto → Light
  const cycle = useCallback(() => {
    setMode((m) => (m === 'light' ? 'dark' : m === 'dark' ? 'auto' : 'light'));
  }, []);

  return <ThemeCtx.Provider value={{ mode, theme, cycle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
