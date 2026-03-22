-- CreateIndex: composite index for filtered + paginated sorts on Property(state, createdAt DESC)
CREATE INDEX "properties_state_createdAt_idx" ON "properties"("state", "createdAt" DESC);
