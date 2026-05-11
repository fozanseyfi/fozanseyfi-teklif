-- Share Links — recipient_email kolonu eklenir.
--
-- Müşteri/yatırımcı e-postası kayda alınır, "Tekrar Mail At" özelliği için.
-- Idempotent.

ALTER TABLE solar.share_links
  ADD COLUMN IF NOT EXISTS recipient_email text;
