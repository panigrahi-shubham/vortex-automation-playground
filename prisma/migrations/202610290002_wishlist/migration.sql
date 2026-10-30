CREATE TABLE orvilo."WishlistEntry" (
  "userId" TEXT NOT NULL REFERENCES orvilo."User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "productId" INTEGER NOT NULL REFERENCES orvilo."Product"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "productId")
);
CREATE INDEX "WishlistEntry_productId_idx" ON orvilo."WishlistEntry"("productId");
ALTER TABLE orvilo."WishlistEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON orvilo."WishlistEntry" FROM PUBLIC, anon, authenticated;
