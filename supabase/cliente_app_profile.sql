-- ============================================================
-- EMPORIUM — "App user" business-profile fields on clientes
--
-- When a tienda user (rol=cliente or rol=comprador) submits their
-- first order, the app writes a full business profile into clientes
-- so admin can manage them alongside B2B clients (supermarkets, etc.).
--
-- `ciudad` already exists per schema.sql; kept here as IF NOT EXISTS
-- so this file is safely re-runnable.
-- Execute in Supabase SQL Editor.
-- ============================================================

-- tipo_cliente: 'tienda' | 'supermercado' | 'restaurante' | 'persona_natural' | …
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_cliente text DEFAULT 'persona_natural';

-- ciudad: already in schema, but guaranteed here for older databases
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS ciudad text;

-- Helpful index for looking up by tipo + activo
CREATE INDEX IF NOT EXISTS clientes_tipo_cliente_idx
  ON public.clientes (tipo_cliente) WHERE activo = true;
