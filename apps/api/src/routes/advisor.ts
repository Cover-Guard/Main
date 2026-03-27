import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { logger } from '../utils/logger'

export const advisorRouter = Router()

const SYSTEM_PROMPT = `You are CoverGuard AI Advisor — a knowledgeable, concise insurance risk advisor embedded in the CoverGuard property insurability platform.

Your expertise:
- Flood risk (FEMA NFHL zones, SFHAs, BFE, NFIP requirements, private flood markets)
- Fire risk (Cal Fire FHSZ, USFS WUI, defensible space, FAIR Plans)
- Wind/hurricane risk (ASCE 7 design wind speed, TWIA, state wind pools)
- Earthquake risk (USGS seismic data, CEA, spectral acceleration)
- Crime risk (FBI CDE data, impact on umbrella policies)
- Insurance carriers (admitted vs surplus lines, who is actively writing/binding)
- Insurability assessment (standard market vs surplus lines vs last-resort plans)
- Premium estimation factors and cost drivers
- How to explain risk to home buyers and real estate agents

Guidelines:
- Be concise — keep responses under 200 words unless the user asks for detail.
- Use **bold** for key terms and important facts.
- When discussing risk scores, reference that CoverGuard scores are 0-100 (higher = more risk).
- Mention specific data sources (FEMA, USGS, Cal Fire, etc.) when relevant.
- If asked about a specific property, note that you don't have access to the user's current property context and suggest they check the property detail page.
- Never provide specific premium quotes or binding coverage — direct users to request quotes through the platform.
- Stay focused on property insurance, risk, and insurability topics. Politely redirect off-topic questions.
- Format responses with markdown (bold, bullet points, numbered lists) for readability.`

advisorRouter.post('/chat', requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'AI Advisor is not configured' },
      })
      return
    }

    const { messages } = req.body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'messages array is required' },
      })
      return
    }

    // Limit conversation history to last 20 messages to control token usage
    const trimmedMessages = messages.slice(-20)

    const anthropic = new Anthropic({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: trimmedMessages,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : 'Sorry, I could not generate a response.'

    const authReq = req as AuthenticatedRequest
    logger.info(`AI Advisor chat — user=${authReq.userId} tokens_in=${response.usage.input_tokens} tokens_out=${response.usage.output_tokens}`)

    res.json({ success: true, data: { text } })
  } catch (err) {
    logger.error('AI Advisor error', { error: err })
    res.status(500).json({
      success: false,
      error: { code: 'ADVISOR_ERROR', message: 'Failed to get AI response' },
    })
  }
})
