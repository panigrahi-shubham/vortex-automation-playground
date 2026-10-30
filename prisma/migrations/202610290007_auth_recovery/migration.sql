CREATE TABLE orvilo."RateLimit" (key TEXT PRIMARY KEY, count INTEGER NOT NULL, "resetsAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "RateLimit_resetsAt_idx" ON orvilo."RateLimit"("resetsAt");
CREATE TABLE orvilo."RecoveryChallenge" (
 "userId" TEXT PRIMARY KEY REFERENCES orvilo."User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "codeHash" TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE orvilo."TestMail" (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES orvilo."User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "to" TEXT NOT NULL, subject TEXT NOT NULL, code TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "TestMail_userId_createdAt_idx" ON orvilo."TestMail"("userId", "createdAt");
ALTER TABLE orvilo."RateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE orvilo."RecoveryChallenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE orvilo."TestMail" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON orvilo."RateLimit", orvilo."RecoveryChallenge", orvilo."TestMail" FROM PUBLIC, anon, authenticated;
