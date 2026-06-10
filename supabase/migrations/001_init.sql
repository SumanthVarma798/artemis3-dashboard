-- ============================================================
-- Artemis III Dashboard — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Tiers enum ──
CREATE TYPE user_tier AS ENUM ('free', 'pro', 'admin');

-- ── Profiles ──
-- Auto-created on signup via trigger (see below)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  tier        user_tier NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile only
CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users cannot write their own tier (admin only)
CREATE POLICY "profiles: own update non-tier fields"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND tier = (SELECT tier FROM public.profiles WHERE id = auth.uid()));

-- ── Feature flags per tier ──
CREATE TABLE public.tier_features (
  tier        user_tier NOT NULL,
  feature     TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (tier, feature)
);

ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read feature flags
CREATE POLICY "tier_features: authenticated read"
  ON public.tier_features FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed tier features
INSERT INTO public.tier_features (tier, feature, enabled) VALUES
  ('free',  'mission_timeline',   true),
  ('free',  'countdown',          true),
  ('free',  'orbital_3d_static',  true),
  ('free',  'orbital_3d_live',    false),
  ('free',  'dsn_live',           false),
  ('free',  'horizons_live',      false),
  ('pro',   'mission_timeline',   true),
  ('pro',   'countdown',          true),
  ('pro',   'orbital_3d_static',  true),
  ('pro',   'orbital_3d_live',    true),
  ('pro',   'dsn_live',           true),
  ('pro',   'horizons_live',      true),
  ('admin', 'mission_timeline',   true),
  ('admin', 'countdown',          true),
  ('admin', 'orbital_3d_static',  true),
  ('admin', 'orbital_3d_live',    true),
  ('admin', 'dsn_live',           true),
  ('admin', 'horizons_live',      true);

-- ── API key vault ──
-- Stores product-owned keys (NASA, etc.) — never exposed to client directly
-- Access only via Edge Functions with service_role
CREATE TABLE public.api_key_vault (
  key_name    TEXT PRIMARY KEY,
  key_value   TEXT NOT NULL,   -- store encrypted at rest via Supabase Vault ideally
  description TEXT,
  min_tier    user_tier NOT NULL DEFAULT 'pro',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_key_vault ENABLE ROW LEVEL SECURITY;

-- NO client access — Edge Functions use service_role key
-- (no SELECT policy = no client can read this table)

-- ── Usage tracking (optional, for rate limiting) ──
CREATE TABLE public.api_usage (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  called_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tier        user_tier NOT NULL
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage: own read"
  ON public.api_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Index for rate-limit lookups
CREATE INDEX idx_api_usage_user_time ON public.api_usage (user_id, called_at DESC);

-- ── Auto-create profile on signup ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier)
  VALUES (NEW.id, NEW.email, 'free');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Helper: get caller's tier (used inside Edge Functions) ──
CREATE OR REPLACE FUNCTION public.get_my_tier()
RETURNS user_tier LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tier FROM public.profiles WHERE id = auth.uid();
$$;

-- ── Admin: promote user to pro ──
-- Run manually in SQL editor: SELECT promote_to_pro('user@email.com');
CREATE OR REPLACE FUNCTION public.promote_to_pro(p_email TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET tier = 'pro', updated_at = NOW()
  WHERE email = p_email;
END;
$$;

-- ── Seed: insert your NASA API key ──
-- Run AFTER creating your Supabase project. Replace YOUR_NASA_KEY below.
-- INSERT INTO public.api_key_vault (key_name, key_value, description, min_tier)
-- VALUES ('nasa_api_key', 'YOUR_NASA_KEY', 'NASA Open APIs — api.nasa.gov', 'pro');
