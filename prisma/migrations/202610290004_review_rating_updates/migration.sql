-- Recompute both products if a maintenance operation moves a review.
CREATE OR REPLACE FUNCTION orvilo.refresh_product_rating() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE old_id INTEGER; new_id INTEGER; target_id INTEGER;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_id := OLD."productId"; END IF;
 IF TG_OP <> 'DELETE' THEN new_id := NEW."productId"; END IF;
 FOR target_id IN SELECT id FROM orvilo."Product"
   WHERE id IN (old_id, new_id) ORDER BY id FOR UPDATE
 LOOP
   UPDATE orvilo."Product" SET
    "rating" = (SELECT COALESCE(round(avg(rating), 1), 0) FROM orvilo."Review" WHERE "productId" = target_id),
    "reviewCount" = (SELECT count(*) FROM orvilo."Review" WHERE "productId" = target_id)
   WHERE id = target_id;
 END LOOP;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION orvilo.refresh_product_rating() FROM PUBLIC, anon, authenticated;
