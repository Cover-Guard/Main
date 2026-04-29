'use client'

import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import { useAgentDrawer } from './AgentDrawerContext'

/**
 * Floating "AI" launcher in the bottom-right corner of every page.
 *
 * The chat itself lives in `AgentChatPanel`, rendered inside the right-side
 * AI Agent drawer that SidebarLayout owns. Clicking this button toggles that
 * drawer, so the bottom-right launcher and the sidebar "Your Agent" button
 * are the same experience.
 *
 * When the drawer is already open, this button hides itself — the sidebar
 * button (and the drawer's own header X) are sufficient close affordances,
 * and a permanent floating bubble overlapping the open drawer is just
 * duplicate UI.
 */
export function AIAdvisor() {
  const { agentOpen, toggleAgent } = useAgentDrawer()

  // Don't render the launcher while the drawer is open. The drawer has its
  // own close affordance and hiding the bubble keeps the bottom-right corner
  // of the dashboard usable (no overlap with content under the drawer).
  if (agentOpen) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={toggleAgent}
        className="h-16 w-16 rounded-full bg-[#0d1929] hover:bg-[#162438] shadow-2xl flex items-center justify-center transition-all hover:scale-105 border-2 border-teal-500/30"
        title="AI Agent (Ctrl/Cmd + /)"
        aria-label="Open AI Agent panel"
        aria-expanded={agentOpen}
        aria-haspopup="dialog"
      >
        <div className="relative flex items-center justify-center">
          <CoverGuardShield className="h-8 w-8" />
          <span className="absolute -bottom-2 -right-2 text-[9px] font-bold text-white leading-none bg-teal-500 rounded-md px-1 py-0.5 shadow-sm">
            AI
          </span>
        </div>
      </button>
    </div>
  )
}
ed={open}
        aria-haspopup="dialog"
      >
        <div className="relative flex items-center justify-center">
          <CoverGuardShield className="h-8 w-8" />
          <span className="absolute -bottom-2 -right-2 text-[9px] font-bold text-white leading-none bg-teal-500 rounded-md px-1 py-0.5 shadow-sm">
            AI
          </span>
        </div>
      </button>
    </div>
  )
}
