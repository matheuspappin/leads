-- Migração: Adiciona colunas de classificação de site
-- Execute este script no Supabase SQL Editor

ALTER TABLE scraped_leads
  ADD COLUMN IF NOT EXISTS site_type    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS site_provider TEXT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS site_offline  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_triage     BOOLEAN DEFAULT FALSE;

-- Índice para filtrar por tipo de site rapidamente
CREATE INDEX IF NOT EXISTS idx_scraped_leads_site_type
  ON scraped_leads(user_id, site_type);

COMMENT ON COLUMN scraped_leads.site_type IS
  'Tipo do site: none, social, free_builder, directory, professional';
COMMENT ON COLUMN scraped_leads.site_provider IS
  'Nome do provedor (ex: Netlify, Canva, Doctoralia, Instagram...)';
COMMENT ON COLUMN scraped_leads.site_offline IS
  'TRUE se o site retornou erro 404 ou 5xx';
COMMENT ON COLUMN scraped_leads.is_triage IS
  'TRUE se o lead não tem telefone ou score=0 (requer triagem manual)';
