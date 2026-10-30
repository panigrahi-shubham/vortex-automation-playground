CREATE TABLE orvilo."MfaCredential" ("userId" TEXT PRIMARY KEY REFERENCES orvilo."User"(id) ON DELETE CASCADE ON UPDATE CASCADE, secret TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false, "lastStep" INTEGER NOT NULL DEFAULT -1, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE orvilo."MfaLogin" ("tokenHash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES orvilo."User"(id) ON DELETE CASCADE ON UPDATE CASCADE, "passwordHash" TEXT NOT NULL, remember BOOLEAN NOT NULL DEFAULT false, attempts INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "MfaLogin_userId_idx" ON orvilo."MfaLogin"("userId");
CREATE TABLE orvilo."MfaBackupCode" ("codeHash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES orvilo."User"(id) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "MfaBackupCode_userId_idx" ON orvilo."MfaBackupCode"("userId");
ALTER TABLE orvilo."MfaCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE orvilo."MfaLogin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE orvilo."MfaBackupCode" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON orvilo."MfaCredential", orvilo."MfaLogin", orvilo."MfaBackupCode" FROM PUBLIC, anon, authenticated;
