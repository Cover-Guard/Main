-- Add missing single-column index on properties(state) declared in schema.prisma @@index([state])

CREATE INDEX IF NOT EXISTS "properties_state_idx" ON "properties"("state");
