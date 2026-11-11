-- ================================================
-- Lead Hunter Desktop — Migration
-- Adiciona a coluna "source" na tabela "searches" para
-- diferenciar as buscas feitas via web e via app desktop.
-- ================================================

ALTER TABLE public.searches ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';
