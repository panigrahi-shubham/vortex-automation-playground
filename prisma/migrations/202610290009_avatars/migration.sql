ALTER TABLE orvilo."User" ADD COLUMN avatar TEXT;
CREATE TABLE orvilo."Avatar" (
 id TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL UNIQUE REFERENCES orvilo."User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 data BYTEA NOT NULL CHECK (octet_length(data) <= 524288)
);
ALTER TABLE orvilo."Avatar" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON orvilo."Avatar" FROM PUBLIC, anon, authenticated;
