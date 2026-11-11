CREATE TABLE orvilo."PracticeProfile" (
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "defects" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "generation" INTEGER NOT NULL DEFAULT 0,
  "workspace" JSONB NOT NULL,
  CONSTRAINT "PracticeProfile_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "PracticeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES orvilo."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE orvilo."PracticeProfile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON orvilo."PracticeProfile" FROM PUBLIC, anon, authenticated;
