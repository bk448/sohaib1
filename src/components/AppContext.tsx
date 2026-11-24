import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  fetchNewLeadCountsBySite,
  fetchSites,
  getCurrentSession,
  onAuthStateChange,
  subscribeToLeadChanges,
  type Lead,
  type Site,
} from '../lib/data';
import { useToast } from './ToastContext';

interface AppContextValue {
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  sites: Site[];
  sitesLoading: boolean;
  refreshSites: () => Promise<void>;
  newCounts: { totalNew: number; bySiteId: Record<string, number> };
  refreshNewCounts: () => Promise<void>;
  selectedLead: Lead | null;
  setSelectedLead: (lead: Lead | null) => void;
  isAddLeadOpen: boolean;
  setIsAddLeadOpen: (open: boolean) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  realtimeTick: number;
  lastRealtimeLead: { type: 'INSERT' | 'UPDATE'; lead: Lead } | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

const THEME_STORAGE_KEY = 'lead_desk_theme';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [newCounts, setNewCounts] = useState<{ totalNew: number; bySiteId: Record<string, number> }>({
    totalNew: 0,
    bySiteId: {},
  });

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [lastRealtimeLead, setLastRealtimeLead] = useState<{
    type: 'INSERT' | 'UPDATE';
    lead: Lead;
  } | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  // Initialize Supabase Auth session & listener
  useEffect(() => {
    let mounted = true;

    getCurrentSession()
      .then((sess) => {
        if (!mounted) return;
        setSession(sess);
        setUser(sess?.user ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const unsub = onAuthStateChange((sess, usr) => {
      if (!mounted) return;
      setSession(sess);
      setUser(usr);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const refreshSites = useCallback(async () => {
    if (!session) return;
    setSitesLoading(true);
    try {
      const data = await fetchSites();
      setSites(data);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to load sites',
        description: err instanceof Error ? err.message : 'Unable to fetch sites table.',
      });
    } finally {
      setSitesLoading(false);
    }
  }, [session, addToast]);

  const refreshNewCounts = useCallback(async () => {
    if (!session) return;
    try {
      const counts = await fetchNewLeadCountsBySite();
      setNewCounts(counts);
    } catch {
      // Keep quiet if transient, main views surface errors
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      refreshSites();
      refreshNewCounts();
    } else {
      setSites([]);
      setNewCounts({ totalNew: 0, bySiteId: {} });
    }
  }, [session, refreshSites, refreshNewCounts]);

  // Realtime subscription on leads (INSERT + UPDATE)
  useEffect(() => {
    if (!session) return;

    const unsubscribe = subscribeToLeadChanges({
      onInsert: (lead) => {
        setLastRealtimeLead({ type: 'INSERT', lead });
        setRealtimeTick((t) => t + 1);
        refreshNewCounts();

        const siteLabel = lead.site_name || 'Unassigned site';
        const isHigh = lead.priority === 'high';

        addToast({
          variant: isHigh ? 'high-priority' : 'info',
          title: isHigh
            ? `HIGH PRIORITY Lead · ${siteLabel}`
            : `New Lead · ${siteLabel}`,
          description: `${lead.name || lead.email || 'New inquiry'}${
            lead.subject ? ` — ${lead.subject}` : ''
          }`,
          actionLabel: 'Inspect lead',
          onAction: () => setSelectedLead(lead),
        });
      },
      onUpdate: (lead) => {
        setLastRealtimeLead({ type: 'UPDATE', lead });
        setRealtimeTick((t) => t + 1);
        refreshNewCounts();
        setSelectedLead((prev) => (prev && prev.id === lead.id ? lead : prev));
      },
    });

    return () => {
      unsubscribe();
    };
  }, [session, addToast, refreshNewCounts]);

  return (
    <AppContext.Provider
      value={{
        session,
        user,
        authLoading,
        sites,
        sitesLoading,
        refreshSites,
        newCounts,
        refreshNewCounts,
        selectedLead,
        setSelectedLead,
        isAddLeadOpen,
        setIsAddLeadOpen,
        globalSearch,
        setGlobalSearch,
        darkMode,
        toggleDarkMode,
        realtimeTick,
        lastRealtimeLead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
