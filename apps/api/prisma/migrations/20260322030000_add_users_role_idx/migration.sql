-- CreateIndex: missing index on users(role) declared in schema.prisma @@index([role])
CREATE INDEX "users_role_idx" ON "users"("role");
