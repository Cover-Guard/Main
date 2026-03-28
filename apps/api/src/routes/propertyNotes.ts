import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const propertyNotesRouter = Router()
propertyNotesRouter.use(requireAuth)
propertyNotesRouter.use(requireSubscription)

const createNoteSchema = z.object({
  content: z.string().min(1).max(2000).transform((s) => s.trim()),
})

const updateNoteSchema = z.object({
  content: z.string().min(1).max(2000).transform((s) => s.trim()),
})

// List notes for a property (current user)
propertyNotesRouter.get('/:propertyId/notes', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const propertyId = String(req.params.propertyId)
    const page = Math.min(10000, Math.max(1, parseInt(req.query.page as string, 10) || 1))
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50))

    const notes = await prisma.propertyNote.findMany({
      where: { propertyId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    })

    res.json({ success: true, data: notes })
  } catch (err) {
    next(err)
  }
})

// Create a note
propertyNotesRouter.post('/:propertyId/notes', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const propertyId = String(req.params.propertyId)
    const body = createNoteSchema.parse(req.body)

    const propertyExists = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    })
    if (!propertyExists) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }

    const note = await prisma.propertyNote.create({
      data: { userId, propertyId, content: body.content },
    })

    res.status(201).json({ success: true, data: note })
  } catch (err) {
    next(err)
  }
})

// Update a note
propertyNotesRouter.patch('/:propertyId/notes/:noteId', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const noteId = String(req.params.noteId)
    const body = updateNoteSchema.parse(req.body)

    const existing = await prisma.propertyNote.findFirst({
      where: { id: noteId, userId },
    })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found' },
      })
      return
    }

    const note = await prisma.propertyNote.update({
      where: { id: noteId },
      data: { content: body.content },
    })

    res.json({ success: true, data: note })
  } catch (err) {
    next(err)
  }
})

// Delete a note
propertyNotesRouter.delete('/:propertyId/notes/:noteId', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const noteId = String(req.params.noteId)

    const existing = await prisma.propertyNote.findFirst({
      where: { id: noteId, userId },
    })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found' },
      })
      return
    }

    await prisma.propertyNote.delete({ where: { id: noteId } })
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})
