// Supabase auth module — handles login/signup, session, tier, and feature flags
const Auth = (() => {
  let supabase = null;
  let session  = null;
  let userTier = 'free';
  let features = {};

  // Injected at runtime from config.js (never hardcode keys in source)
  function getConfig() {
    return window.SUPABASE_CONFIG || { url: '', anonKey: '' };
  }

  function isConfigured() {
    const cfg = getConfig();
    return cfg.url && cfg.anonKey;
  }

  // ── Init ──
  async function init() {
    if (!isConfigured()) {
      console.warn('[Auth] Supabase not configured — running in demo mode');
      renderDemoMode();
      return false;
    }

    const { createClient } = window.supabase;
    supabase = createClient(getConfig().url, getConfig().anonKey);

    // Restore existing session
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s) await onSession(s);

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, s) => {
      if (s) await onSession(s);
      else    onSignOut();
    });

    renderAuthUI();
    return true;
  }

  async function onSession(s) {
    session = s;
    // Fetch tier + features from Edge Function
    try {
      const edgeFn = `${getConfig().url}/functions/v1/get-config?action=features`;
      const res    = await fetch(edgeFn, {
        headers: { Authorization: `Bearer ${s.access_token}` },
      });
      const data = await res.json();
      userTier = data.tier   ?? 'free';
      features = data.features ?? {};
    } catch {
      userTier = 'free';
      features = {};
    }
    updateAuthUI();
    // Notify dashboard of tier
    window.dispatchEvent(new CustomEvent('auth:ready', { detail: { tier: userTier, features } }));
  }

  function onSignOut() {
    session  = null;
    userTier = 'free';
    features = {};
    updateAuthUI();
    window.dispatchEvent(new CustomEvent('auth:signedout'));
  }

  // ── Public API proxy (pro only) ──
  async function callEdge(action, params = {}) {
    if (!session) return null;
    const qs  = new URLSearchParams({ action, ...params });
    const res = await fetch(`${getConfig().url}/functions/v1/get-config?${qs}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    return res.json();
  }

  function hasFeature(name) {
    return features[name] === true;
  }

  function getTier() { return userTier; }
  function getSession() { return session; }

  // ── Sign in / Sign up ──
  async function signUp(email, password) {
    if (!supabase) return { error: { message: 'Not configured' } };
    return supabase.auth.signUp({ email, password });
  }

  async function signIn(email, password) {
    if (!supabase) return { error: { message: 'Not configured' } };
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  // ── UI ──
  function renderDemoMode() {
    const btn = document.getElementById('btn-auth');
    if (btn) {
      btn.textContent = 'DEMO';
      btn.title = 'Running in demo mode — configure Supabase to enable accounts';
      btn.style.color = 'var(--warn)';
    }
  }

  function renderAuthUI() {
    // Replace the config gear button with an auth button
    const topRight = document.querySelector('.tb-right');
    if (!topRight) return;

    // Auth button
    const btn = document.createElement('button');
    btn.id        = 'btn-auth';
    btn.className = 'icon-btn auth-btn';
    btn.textContent = 'SIGN IN';
    btn.title = 'Sign in to your account';
    btn.addEventListener('click', () => showAuthModal());
    topRight.insertBefore(btn, topRight.firstChild);

    // Tier badge
    const badge = document.createElement('span');
    badge.id        = 'tier-badge';
    badge.className = 'tier-badge';
    badge.textContent = 'FREE';
    topRight.insertBefore(badge, btn);
  }

  function updateAuthUI() {
    const btn   = document.getElementById('btn-auth');
    const badge = document.getElementById('tier-badge');
    if (!btn || !badge) return;

    if (session) {
      const email = session.user.email;
      btn.textContent = email.split('@')[0].toUpperCase();
      btn.title = `Signed in as ${email} · Click to sign out`;
      btn.onclick = () => {
        if (confirm(`Sign out of ${email}?`)) signOut();
      };
      badge.textContent = userTier.toUpperCase();
      badge.className   = `tier-badge tier-${userTier}`;
    } else {
      btn.textContent = 'SIGN IN';
      btn.onclick     = () => showAuthModal();
      badge.textContent = 'FREE';
      badge.className   = 'tier-badge';
    }
  }

  // ── Auth modal ──
  function showAuthModal() {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      modal = buildAuthModal();
      document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal.querySelector('input[type="email"]')?.focus();
  }

  function buildAuthModal() {
    const modal = document.createElement('div');
    modal.id        = 'auth-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-box auth-modal-box">
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="signin">Sign In</button>
          <button class="auth-tab" data-tab="signup">Create Account</button>
        </div>

        <div class="auth-panel" id="auth-signin">
          <p class="auth-sub">Access your Artemis III mission dashboard.</p>
          <div class="auth-field">
            <label>EMAIL</label>
            <input type="email" id="signin-email" placeholder="you@example.com" autocomplete="email" />
          </div>
          <div class="auth-field">
            <label>PASSWORD</label>
            <input type="password" id="signin-password" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <div id="signin-error" class="auth-error hidden"></div>
          <button id="btn-signin" class="auth-submit">SIGN IN</button>
        </div>

        <div class="auth-panel hidden" id="auth-signup">
          <p class="auth-sub">Create a free account. Upgrade to Pro for live telemetry.</p>
          <div class="auth-field">
            <label>EMAIL</label>
            <input type="email" id="signup-email" placeholder="you@example.com" autocomplete="email" />
          </div>
          <div class="auth-field">
            <label>PASSWORD</label>
            <input type="password" id="signup-password" placeholder="Min. 8 characters" autocomplete="new-password" />
          </div>
          <div id="signup-error" class="auth-error hidden"></div>
          <div id="signup-success" class="auth-success hidden"></div>
          <button id="btn-signup" class="auth-submit">CREATE ACCOUNT</button>
        </div>

        <div class="auth-tier-info">
          <div class="tier-row">
            <span class="tier-name free">FREE</span>
            <span class="tier-features">Countdown · Timeline · Static orbital</span>
          </div>
          <div class="tier-row">
            <span class="tier-name pro">PRO</span>
            <span class="tier-features">Live JPL Horizons · DSN real-time · Full telemetry</span>
          </div>
        </div>

        <button class="modal-close" id="auth-close">✕</button>
      </div>
    `;

    // Tab switching
    modal.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.auth-panel').forEach(p => p.classList.add('hidden'));
        tab.classList.add('active');
        modal.querySelector(`#auth-${tab.dataset.tab}`)?.classList.remove('hidden');
      });
    });

    // Close
    modal.querySelector('#auth-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

    // Sign in
    modal.querySelector('#btn-signin').addEventListener('click', async () => {
      const email = modal.querySelector('#signin-email').value.trim();
      const pass  = modal.querySelector('#signin-password').value;
      const errEl = modal.querySelector('#signin-error');
      setAuthLoading(modal.querySelector('#btn-signin'), true);
      const { error } = await signIn(email, pass);
      setAuthLoading(modal.querySelector('#btn-signin'), false);
      if (error) { showAuthError(errEl, error.message); return; }
      modal.classList.add('hidden');
    });

    // Sign up
    modal.querySelector('#btn-signup').addEventListener('click', async () => {
      const email = modal.querySelector('#signup-email').value.trim();
      const pass  = modal.querySelector('#signup-password').value;
      const errEl = modal.querySelector('#signup-error');
      const sucEl = modal.querySelector('#signup-success');
      setAuthLoading(modal.querySelector('#btn-signup'), true);
      const { error } = await signUp(email, pass);
      setAuthLoading(modal.querySelector('#btn-signup'), false);
      if (error) { showAuthError(errEl, error.message); return; }
      errEl.classList.add('hidden');
      sucEl.textContent = 'Check your email to confirm your account.';
      sucEl.classList.remove('hidden');
    });

    // Enter key support
    modal.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const panel = inp.closest('.auth-panel');
          panel?.querySelector('.auth-submit')?.click();
        }
      });
    });

    return modal;
  }

  function showAuthError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function setAuthLoading(btn, loading) {
    btn.disabled     = loading;
    btn.textContent  = loading ? 'LOADING…' : btn.id === 'btn-signin' ? 'SIGN IN' : 'CREATE ACCOUNT';
  }

  return { init, signIn, signUp, signOut, hasFeature, getTier, getSession, callEdge };
})();
