-- Additive product discovery identity and evaluation evidence support.
-- Existing products and evaluations remain untouched.

ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS evidence JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_source_external_id
  ON products (tenant_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- Rollback boundary (manual, only after stopping evidence writes and backing up):
--   DROP INDEX IF EXISTS idx_products_tenant_source_external_id;
--   ALTER TABLE evaluations DROP COLUMN IF EXISTS evidence;
-- Do not run the rollback after evidence consumers are deployed unless a verified
-- backup and explicit retention decision cover the evidence being removed.
