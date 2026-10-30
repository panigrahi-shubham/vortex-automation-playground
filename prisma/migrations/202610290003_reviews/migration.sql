ALTER TABLE orvilo."Product" ADD COLUMN "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
 ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE orvilo."Review" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES orvilo."User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "productId" INTEGER NOT NULL REFERENCES orvilo."Product"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
 "title" TEXT NOT NULL CHECK (length(trim("title")) BETWEEN 3 AND 60),
 "body" TEXT NOT NULL CHECK (length(trim("body")) BETWEEN 10 AND 500),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Review_userId_productId_key" ON orvilo."Review"("userId", "productId");
CREATE INDEX "Review_productId_createdAt_idx" ON orvilo."Review"("productId", "createdAt");
ALTER TABLE orvilo."Review" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON orvilo."Review" FROM PUBLIC, anon, authenticated;
-- Maintain ratings on all writes, including cascading account deletion.
CREATE FUNCTION orvilo.refresh_product_rating() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE target_id INTEGER;
BEGIN
 target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."productId" ELSE NEW."productId" END;
 PERFORM id FROM orvilo."Product" WHERE id = target_id FOR UPDATE;
 UPDATE orvilo."Product" SET
   "rating" = (SELECT COALESCE(round(avg(rating), 1), 0) FROM orvilo."Review" WHERE "productId" = target_id),
   "reviewCount" = (SELECT count(*) FROM orvilo."Review" WHERE "productId" = target_id)
 WHERE id = target_id;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION orvilo.refresh_product_rating() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER review_rating_changed AFTER INSERT OR DELETE OR UPDATE ON orvilo."Review"
FOR EACH ROW EXECUTE FUNCTION orvilo.refresh_product_rating();
