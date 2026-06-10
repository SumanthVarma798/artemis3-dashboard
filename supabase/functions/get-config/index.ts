import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const RATE_LIMITS: Record<string, number> = {
  free:  0,
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

    // ── Profile + tier ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()

    const tier = profile?.tier ?? 'free'

    // ── Feature flags ──
    const { data: flags } = await supabase
      .from('tier_features')
      .select('feature, enabled')
      .eq('tier', tier)

    const features: Record<string, boolean> = {}
    flags?.forEach(f => { features[f.feature] = f.enabled })

    const url    = new URL(req.url)
    const action = url.searchParams.get('action') ?? 'features'

    // ── features (always allowed) ──
    if (action === 'features') {
      return json({ tier, features })
    }

    // ── Pro/admin only beyond here ──
    if (tier === 'free') {
      return json({ error: 'Pro tier required', upgrade: true }, 403)
    }

    // ── validate_nasa_key: test a key against NASA without saving ──
    if (action === 'validate_nasa_key') {
      const body   = await req.json().catch(() => ({}))
      const keyVal = body.key ?? ''
      if (!keyVal || keyVal === 'DEMO_KEY') return json({ valid: false, reason: 'invalid' })
      const testUrl = `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(keyVal)}&thumbs=true`
      const testRes = await fetch(testUrl)
      if (testRes.status === 200)  return json({ valid: true })
      if (testRes.status === 403)  return json({ valid: false, reason: 'invalid' })
      if (testRes.status === 429)  return json({ valid: true,  rateLimited: true })
      return json({ valid: false, reason: 'error', status: testRes.status })
    }

    // ── save_nasa_key: store user's validated key in vault ──
    if (action === 'save_nasa_key') {
      const body    = await req.json().catch(() => ({}))
      const keyVal  = body.key ?? ''
      const isDemo  = !keyVal || keyVal === 'DEMO_KEY'

      if (!isDemo) {
        await supabase.from('api_key_vault').upsert(
          { key_name: 'nasa_api_key', key_value: keyVal, user_id: user.id, min_tier: 'pro' },
          { onConflict: 'key_name,user_id' }
        )
      }
      return json({ saved: true, isDemo })
    }

    // ── get_nasa_key: return whether user has a key stored ──
    if (action === 'get_nasa_key') {
      const { data: row } = await supabase
        .from('api_key_vault')
        .select('key_value')
        .eq('key_name', 'nasa_api_key')
        .eq('user_id', user.id)
        .single()

      return json({ hasKey: !!row?.key_value, isDemo: !row?.key_value })
    }

    // ── Rate limit ──
    const limit      = RATE_LIMITS[tier] ?? 0
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const { count }  = await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('called_at', oneHourAgo)

    if ((count ?? 0) >= limit) {
      return json({ error: 'Rate limit exceeded', retry_after: '1 hour' }, 429)
    }

    // ── Resolve effective NASA key: user's own key → product key → DEMO_KEY ──
    const { data: userKeyRow } = await supabase
      .from('api_key_vault')
      .select('key_value')
      .eq('key_name', 'nasa_api_key')
      .eq('user_id', user.id)
      .single()

    const { data: productKeyRow } = await supabase
      .from('api_key_vault')
      .select('key_value')
      .eq('key_name', 'nasa_api_key')
      .is('user_id', null)
      .single()

    const nasaKey = userKeyRow?.key_value || productKeyRow?.key_value || 'DEMO_KEY'

    // ── Log usage ──
    await supabase.from('api_usage').insert({ user_id: user.id, endpoint: action, tier })

    // ── horizons ──
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

    // ── dsn ──
    if (action === 'dsn') {
      const res  = await fetch('https://eyes.nasa.gov/dsn/data/dsn.xml')
      const text = await res.text()
      return new Response(JSON.stringify({ xml: text, tier }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── nasa — generic NASA API proxy using the resolved key ──
    if (action === 'nasa') {
      const endpoint = url.searchParams.get('endpoint') ?? ''
      const queryStr = url.searchParams.get('params') ?? ''
      const nasaUrl  = `https://api.nasa.gov/${endpoint}?api_key=${nasaKey}&${queryStr}`
      const res      = await fetch(nasaUrl)
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
