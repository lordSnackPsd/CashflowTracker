import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Settings } from '../types';
import { initDb } from '../db/client';
import { repos } from '../db/repositories';

// Small starter set only — everything is user-extensible from here (spec 3.1).
const STARTER_CATEGORIES: Array<{ name: string; emoji: string }> = [
  { name: 'Transportation', emoji: '🚕' },
  { name: 'Food and drink', emoji: '☕' },
  { name: 'Groceries', emoji: '🛒' },
  { name: 'Bills', emoji: '🧾' },
  { name: 'Bank account fees', emoji: '🏦' },
];

interface AppContextValue {
  ready: boolean;
  settings: Settings | null;
  /** Bumps whenever any screen writes data — screens re-read on change. */
  dataVersion: number;
  bumpData: () => void;
  reloadSettings: () => Promise<void>;
}

const AppContext = createContext<AppContextValue>({
  ready: false,
  settings: null,
  dataVersion: 0,
  bumpData: () => {},
  reloadSettings: async () => {},
});

export function useApp(): AppContextValue {
  return useContext(AppContext);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const bumpData = useCallback(() => setDataVersion(v => v + 1), []);

  const reloadSettings = useCallback(async () => {
    setSettings(await repos.settings.get());
  }, []);

  useEffect(() => {
    (async () => {
      await initDb();
      const cats = await repos.categories.list(true);
      if (cats.length === 0) {
        for (const c of STARTER_CATEGORIES) {
          await repos.categories.create({
            name: c.name,
            emoji: c.emoji,
            monthlyBudget: null,
            lessSpendGoal: false,
          });
        }
      }
      setSettings(await repos.settings.get());
      setReady(true);
    })();
  }, []);

  const value = useMemo(
    () => ({ ready, settings, dataVersion, bumpData, reloadSettings }),
    [ready, settings, dataVersion, bumpData, reloadSettings],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
