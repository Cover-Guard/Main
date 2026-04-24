'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type AgentDrawerContextValue = {
  agentOpen: boolean;
  setAgentOpen: (open: boolean) => void;
  toggleAgent: () => void;
};

const AgentDrawerContext = createContext<AgentDrawerContextValue | null>(null);

/**
 * Provides open/close state for the right-side AI Agent drawer.
 *
 * The drawer itself is rendered inside `SidebarLayout` as a real flex sibling
 * of the main content (so it inherits the full viewport height from the
 * `flex h-screen` container — same pattern as Zapier's agent panel). Pages
 * like `EnhancedDashboard` consume this context to toggle the drawer from
 * their own UI (e.g. a header button).
 */
export function AgentDrawerProvider({ children }: { children: ReactNode }) {
  const [agentOpen, setAgentOpen] = useState(false);
  return (
    <AgentDrawerContext.Provider
      value={{
        agentOpen,
        setAgentOpen,
        toggleAgent: () => setAgentOpen((o) => !o),
      }}
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
