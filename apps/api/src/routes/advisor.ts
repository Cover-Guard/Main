import { Router } from 'express'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
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

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(10000),
  })).min(1).max(50),
})

// Reuse a single client instance (the SDK handles connection pooling internally)
let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

advisorRouter.post('/chat', requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const client = getAnthropicClient()
    if (!client) {
      res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'AI Advisor is not configured. Please contact your administrator.' },
      })
      return
    }

    const parsed = chatSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message ?? 'Invalid messages' },
      })
      return
    }

    const { messages } = parsed.data

    // Limit conversation history to last 20 messages to control token usage
    const trimmedMessages = messages.slice(-20)

    const response = await client.messages.create({
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
    const authReq = req as AuthenticatedRequest

    if (err instanceof Anthropic.AuthenticationError) {
      logger.error(`AI Advisor auth error — user=${authReq.userId}`, { status: err.status, message: err.message })
      // Reset client so a corrected key is picked up on next request
      anthropicClient = null
      res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'AI Advisor authentication failed. Please check the API key configuration.' },
      })
      return
    }

    if (err instanceof Anthropic.RateLimitError) {
      logger.warn(`AI Advisor rate limited — user=${authReq.userId}`, { status: err.status })
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'AI Advisor is temporarily busy. Please try again in a moment.' },
      })
      return
    }

    if (err instanceof Anthropic.NotFoundError) {
      logger.error(`AI Advisor model not found — user=${authReq.userId}`, { status: err.status, message: err.message })
      res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'AI Advisor model is unavailable. Please try again later.' },
      })
      return
    }

    if (err instanceof Anthropic.APIConnectionError) {
      logger.error(`AI Advisor connection error — user=${authReq.userId}`, { message: err.message })
      res.status(502).json({
        success: false,
        error: { code: 'BAD_GATEWAY', message: 'Could not reach AI service. Please try again.' },
      })
      return
    }

    if (err instanceof Anthropic.APIError) {
      logger.error(`AI Advisor API error — user=${authReq.userId}`, { status: err.status, message: err.message })
      res.status(err.status >= 500 ? 502 : 500).json({
        success: false,
        error: { code: 'ADVISOR_ERROR', message: 'AI service returned an error. Please try again.' },
      })
      return
    }

    // Unexpected errors go to the central error handler
    next(err)
  }
})
