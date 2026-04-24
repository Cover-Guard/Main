'use client'

import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import { useAgentDrawer } from './AgentDrawerContext'

/**
 * Floating "AI" launcher in the bottom-right corner of every page.
 *
 * Previously this component owned its own 420px popover with chat history,
 * suggested questions, and the chatWithAdvisor pipeline. That chat now lives
 * in `AgentChatPanel`, rendered inside the right-side AI Agent drawer that
 * SidebarLayout owns. This component is intentionally reduced to *just* the
 * floating launcher — clicking it opens (or closes) that drawer, so the
 * bottom-right button and the sidebar "Your Agent" button are the same
 * experience.
 */
export function AIAdvisor() {
  const { agentOpen, toggleAgent } = useAgentDrawer()

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={toggleAgent}
        className="h-16 w-16 rounded-full bg-[#0d1929] hover:bg-[#162438] shadow-2xl flex items-center justify-center transition-all hover:scale-105 border-2 border-teal-500/30"
        title="AI Agent"
        aria-label={agentOpen ? 'Close AI Agent panel' : 'Open AI Agent panel'}
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
