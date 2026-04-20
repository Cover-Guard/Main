'use client'

import { useCallback, useEffect, useState } from 'react'
import { Joyride, STATUS, type EventData, type Step } from 'react-joyride'

const STORAGE_KEY = 'coverguard.howToWalkthrough.v1'

export const DEFAULT_STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Welcome to CoverGuard',
    content:
      "Let's take a 30-second tour so you know where everything lives before you start exploring properties.",
  },
  {
    target: '[data-tour="nav"]',
    title: 'Your main navigation',
    content:
      'Search, Dashboard, Toolkit, and Help all live here. Collapse the sidebar any time to give yourself more room.',
  },
  {
    target: '[data-tour="search"]',
    title: 'Start with an address',
    content:
      'Drop any US address in the search to get a full risk profile — flood, fire, wind, earthquake, and crime.',
  },
  {
    target: '[data-tour="dashboard"]',
    title: 'Your workspace',
    content:
      'Track saved properties, pipeline deals, and KPIs. Everything you touch shows up here so you can pick up where you left off.',
  },
  {
    target: '[data-tour="release-notes"]',
    title: "What's new",
    content:
      'We ship improvements often. This section keeps you up to date on new features, improvements, and fixes.',
  },
  {
    target: '[data-tour="help"]',
    title: 'Help is always here',
    content:
      'Stuck? The Help page has guides, FAQs, and the full release history. You can replay this tour any time.',
  },
]

interface Props {
  steps?: Step[]
  /** Controlled: true to start, false to stop. When undefined, `autoRunOnce` applies. */
  run?: boolean
  /** When true and the user hasn't completed the tour, it runs once on mount. */
  autoRunOnce?: boolean
  storageKey?: string
  onFinish?: (status: 'finished' | 'skipped' | 'closed') => void
}

export function HowToWalkthrough({
  steps = DEFAULT_STEPS,
  run,
  autoRunOnce = true,
  storageKey = STORAGE_KEY,
  onFinish,
}: Props) {
  const [running, setRunning] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (run === true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0)
       
      setRunning(true)
      return
    }
    if (run === false) {
       
      setRunning(false)
      return
    }
    if (autoRunOnce) {
      let completed: string | null = null
      try {
        completed = window.localStorage.getItem(storageKey)
      } catch {
        /* storage disabled — treat as first-run */
      }
      if (!completed) {
         
        setStepIndex(0)
         
        setRunning(true)
      }
    }
  }, [run, autoRunOnce, storageKey])

  const handleEvent = useCallback(
    (data: EventData) => {
      const { action, index, status, type } = data
      if (type === 'step:after' || type === 'error:target_not_found') {
        setStepIndex(index + (action === 'prev' ? -1 : 1))
      }
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        setRunning(false)
        try {
          window.localStorage.setItem(storageKey, new Date().toISOString())
        } catch {
          /* storage disabled — no-op */
        }
        onFinish?.(status)
      } else if (action === 'close') {
        setRunning(false)
        onFinish?.('closed')
      }
    },
    [onFinish, storageKey]
  )

  return (
    <Joyride
      steps={steps}
      run={running}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip tour',
      }}
      options={{
        showProgress: true,
        skipBeacon: true,
        primaryColor: '#0ea5e9',
        arrowColor: '#ffffff',
        backgroundColor: '#ffffff',
        textColor: '#111827',
        zIndex: 10000,
      }}
    />
  )
}

export function useWalkthroughTrigger() {
  const [run, setRun] = useState(false)
  return {
    run,
    start: useCallback(() => setRun(true), []),
    stop: useCallback(() => setRun(false), []),
  }
}
