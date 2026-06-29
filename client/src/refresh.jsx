import { createContext, useContext, useState, useCallback } from 'react';

// Tiny global "data changed" signal so the sidebar stats + current page refetch
// after uploads / deletes / edits without prop-drilling.
const RefreshCtx = createContext({ version: 0, bump: () => {} });

export function RefreshProvider({ children }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  return <RefreshCtx.Provider value={{ version, bump }}>{children}</RefreshCtx.Provider>;
}

export const useRefresh = () => useContext(RefreshCtx);
