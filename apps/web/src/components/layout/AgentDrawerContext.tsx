'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type AgentDrawerContextValue = {
  agentOpen: boolean;
  setAgentOpen: (open: boolean) => void;
  toggleAgent: () => void;
};

const AgentDrawerContext = createContext<AgentDrawerContextValue | null>(null);

// Global keyboard shortcut for power users. Cmd+/ on Mac, Ctrl+/ elsewhere.
// Picked because it's unused by Next/React/Chrome and mirrors what Linear,
// Slack, and Notion use for "open quick search". We swallow the event when
// it fires inside an editable target only if the user explicitly hits the
// shortcut chord (modifier required), so it never collides with normal typing.
function isShortcut(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  return mod && e.key === '/';
}

/**
 * Provides open/close state for the right-side AI Agent drawer.
 *
 * The drawer itself is rendered inside `SidebarLayout` as a real flex sibling
 * of the main content (Supabase-style), so it inherits the full viewport
 * height. Pages and global UI (sidebar nav button, floating launcher) consume
 * this context to toggle it.
 *
 * The provider also wires a global keyboard shortcut (Cmd/Ctrl + /) so the
 * drawer can be summoned or dismissed from anywhere in the app without
 * reaching for the mouse.
 */
export function AgentDrawerProvider({ children }: { children: ReactNode }) {
  const [agentOpen, setAgentOpen] = useState(false);

  const toggleAgent = useCallback(() => setAgentOpen((o) => !o), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isShortcut(e)) return;
      e.preventDefault();
      setAgentOpen((o) => !o);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <AgentDrawerContext.Provider
      value={{ agentOpen, setAgentOpen, toggleAgent }}
    >
      {children}
    </AgentDrawerContext.Provider>
  );
}

/**
 * Hook to read/control the AI Agent drawer's open state.
 * Returns a no-op shim if used outside a provider so non-SidebarLayout pages
 * (e.g. unauthenticated routes) don't crash if they accidentally render
 * components that consume this context.
 */
export function useAgentDrawer(): AgentDrawerContextValue {
  const ctx = useContext(AgentDrawerContext);
  if (ctx) return ctx;
  return {
    agentOpen: false,
    setAgentOpen: () => undefined,
    toggleAgent: () => undefined,
  };
}
