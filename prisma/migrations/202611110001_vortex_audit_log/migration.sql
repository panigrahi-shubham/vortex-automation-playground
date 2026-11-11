CREATE TABLE orvilo."AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "state" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON orvilo."AuditLog" ("actorId", "createdAt");
CREATE INDEX "AuditLog_targetId_createdAt_idx" ON orvilo."AuditLog" ("targetId", "createdAt");
ALTER TABLE orvilo."AuditLog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON orvilo."AuditLog" FROM PUBLIC, anon, authenticated;
