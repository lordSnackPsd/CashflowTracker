import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface QuickAddContextValue {
  isOpen: boolean;
  /** Optionally pre-select a paying account/debt (account detail entry point). */
  open: (presetAccountId?: string) => void;
  close: () => void;
  presetAccountId: string | null;
}

const QuickAddContext = createContext<QuickAddContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  presetAccountId: null,
});

export function useQuickAdd(): QuickAddContextValue {
  return useContext(QuickAddContext);
}

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [presetAccountId, setPresetAccountId] = useState<string | null>(null);

  const open = useCallback((preset?: string) => {
    setPresetAccountId(preset ?? null);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, open, close, presetAccountId }),
    [isOpen, open, close, presetAccountId],
  );

  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>;
}
