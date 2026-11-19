CREATE TABLE "orvilo"."BusinessWorkspace" (
  "userId" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessWorkspace_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "BusinessWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "orvilo"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Business data is accessed through authenticated server routes, not the public data API.
REVOKE ALL ON "orvilo"."BusinessWorkspace" FROM PUBLIC, anon, authenticated;
