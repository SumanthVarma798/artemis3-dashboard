// Edge Function: get-config
// Called by authenticated dashboard clients to:
//   1. Return their tier + feature flags
//   2. Proxy NASA/Horizons API calls (so the key never reaches the browser)
//
// Deploy: supabase functions deploy get-config

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Rate limits per tier (requests per hour)
const RATE_LIMITS: Record<string, number> = {
  free:  0,    // no live API calls
  pro:   60,
  admin: 999,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return json({ error: 'Invalid token' }, 401)

    // ── Get user profile + tier ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()

    const tier = profile?.tier ?? 'free'

    // ── Get feature flags for tier ──
    const { data: flags } = await supabase
      .from('tier_features')
      .select('feature, enabled')
      .eq('tier', tier)

    const features: Record<string, boolean> = {}
    flags?.forEach(f => { features[f.feature] = f.enabled })

    // ── Parse request ──
    const url    = new URL(req.url)
    const action = url.searchParams.get('action') ?? 'features'

    // ── Action: features (always allowed) ──
    if (action === 'features') {
      return json({ tier, features })
    }

    // ── Actions below require pro/admin ──
    if (tier === 'free') {
      return json({ error: 'Pro tier required', upgrade: true }, 403)
    }

    // ── Rate limit check ──
    const limit = RATE_LIMITS[tier] ?? 0
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('called_at', oneHourAgo)

    if ((count ?? 0) >= limit) {
      return json({ error: 'Rate limit exceeded', retry_after: '1 hour' }, 429)
    }

    // ── Fetch NASA API key from vault ──
    const { data: vaultRow } = await supabase
      .from('api_key_vault')
      .select('key_value')
      .eq('key_name', 'nasa_api_key')
      .single()

    const nasaKey = vaultRow?.key_value ?? 'DEMO_KEY'

    // ── Log usage ──
    await supabase.from('api_usage').insert({ user_id: user.id, endpoint: action, tier })

    // ── Action: horizons — proxy JPL Horizons API ──
    if (action === 'horizons') {
      const target = url.searchParams.get('target') ?? '301'
      const now    = new Date()
      const start  = now.toISOString().slice(0, 16).replace('T', ' ')
      const stop   = new Date(now.getTime() + 3_600_000).toISOString().slice(0, 16).replace('T', ' ')

      const params = new URLSearchParams({
        format: 'json', COMMAND: target, OBJ_DATA: 'NO',
        MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', CENTER: '500@399',
        START_TIME: start, STOP_TIME: stop, STEP_SIZE: '1h',
        VEC_TABLE: '3', CSV_FORMAT: 'YES',
      })

      const res  = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`)
      const data = await res.json()
      return json({ data, tier })
    }

    // ── Action: dsn — proxy DSN Now XML ──
    if (action === 'dsn') {
      const res  = await fetch('https://eyes.nasa.gov/dsn/data/dsn.xml')
      const text = await res.text()
      return new Response(JSON.stringify({ xml: text, tier }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Action: nasa — generic NASA API proxy ──
    // Accepts optional user_key param (validated client-side before being sent)
    // Falls back to vault key if user_key is absent or DEMO_KEY
    if (action === 'nasa') {
      const endpoint = url.searchParams.get('endpoint') ?? ''
      const queryStr = url.searchParams.get('params') ?? ''
      const userKey  = url.searchParams.get('user_key') ?? ''
      const effectiveKey = (userKey && userKey !== 'DEMO_KEY') ? userKey : nasaKey
      const nasaUrl  = `https://api.nasa.gov/${endpoint}?api_key=${effectiveKey}&${queryStr}`
      const res      = await fetch(nasaUrl)
      // Detect invalid key from NASA response
      if (res.status === 403) return json({ error: 'nasa_key_invalid', tier }, 403)
      const data = await res.json()
      return json({ data, tier })
    }

    return json({ error: 'Unknown action' }, 400)

  } catch (err) {
    console.error(err)
    return json({ error: 'Internal server error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
