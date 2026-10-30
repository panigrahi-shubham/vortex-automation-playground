ALTER TABLE orvilo."User" ADD COLUMN phone TEXT NOT NULL DEFAULT '',
 ADD COLUMN settings JSONB NOT NULL DEFAULT '{"orderEmails":true,"marketingEmails":false,"theme":"system","reducedMotion":false}';
