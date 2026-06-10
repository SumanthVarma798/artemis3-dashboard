const NasaOnboarding = (() => {

  const NASA_SIGNUP_URL = 'https://api.nasa.gov/#signUp';
  const DEMO_KEY        = 'DEMO_KEY';
  const MAX_ATTEMPTS    = 3;
  const LS_KEY          = 'nasa_api_key';
  const LS_STATUS       = 'nasa_key_status'; // 'ok' | 'demo' | 'pending'

  async function validateKey(key) {
    if (!key || key === DEMO_KEY) return { valid: false, isDemo: true };
    try {
      const res = await fetch(
        `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}&thumbs=true`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.status === 200)  return { valid: true };
      if (res.status === 403)  return { valid: false, reason: 'invalid' };
      if (res.status === 429)  return { valid: true, rateLimited: true };
      return { valid: false, reason: 'error', status: res.status };
    } catch {
      return { valid: false, reason: 'network' };
    }
  }

  let attempts    = 0;
  let resolveFlow = null;

  function run(hasExistingKey) {
    return new Promise((resolve) => {
      resolveFlow = resolve;
      attempts    = 0;
      // Mark pending so if user tabs away and returns, we re-show
      localStorage.setItem(LS_STATUS, 'pending');
      buildModal(hasExistingKey);
    });
  }

  function buildModal(hasExistingKey) {
    document.getElementById('nasa-onboard-modal')?.remove();

    const el = document.createElement('div');
    el.id        = 'nasa-onboard-modal';
    el.className = 'modal nasa-onboard';

    const notice = hasExistingKey
      ? `<div class="onboard-notice warn"><span class="notice-icon">⚠</span> The key on file failed validation — it may be expired or incorrect.</div>`
      : `<div class="onboard-notice info"><span class="notice-icon">ℹ</span> Live telemetry requires a NASA Open API key. They're <strong>free</strong> and arrive in seconds.</div>`;

    el.innerHTML = `
      <div class="modal-box onboard-box">
        <div class="onboard-header">
          <div class="onboard-icon">⬡</div>
          <div>
            <div class="onboard-title">NASA API KEY SETUP</div>
            <div class="onboard-sub">One-time setup · takes about 60 seconds</div>
          </div>
        </div>

        <!-- Step 1: get key + paste -->
        <div class="onboard-step" id="step-get-key">
          ${notice}
          <div class="onboard-instructions">
            <div class="step-row">
              <span class="step-num">1</span>
              <span>Click the button below — NASA's signup page opens in a new tab</span>
            </div>
            <div class="step-row">
              <span class="step-num">2</span>
              <span>Fill in your name and email on their page and submit</span>
            </div>
            <div class="step-row">
              <span class="step-num">3</span>
              <span>Copy the API key from the page or the confirmation email</span>
            </div>
            <div class="step-row">
              <span class="step-num">4</span>
              <span>Paste it below and hit Validate</span>
            </div>
          </div>

          <button class="choice-btn primary open-nasa-btn" id="btn-open-nasa">
            <span class="choice-icon">🚀</span>
            <div>
              <div class="choice-title">Open NASA API Signup</div>
              <div class="choice-desc">Opens api.nasa.gov in a new tab</div>
            </div>
          </button>

          <div class="auth-field key-field" style="margin-top:18px">
            <label>NASA API KEY  <span id="attempt-counter" class="attempt-count"></span></label>
            <div class="key-input-row">
              <input type="text" id="ob-key" placeholder="Paste your key here…" autocomplete="off" spellcheck="false" />
              <button class="key-validate-btn" id="btn-validate">VALIDATE</button>
            </div>
          </div>
          <div id="key-error"   class="auth-error hidden"></div>
          <div id="key-success" class="auth-success hidden"></div>

          <button class="onboard-skip" id="btn-skip">Skip · use DEMO_KEY (30 req/hour limit)</button>
        </div>

        <!-- Demo fallback -->
        <div class="onboard-step hidden" id="step-demo-fallback">
          <div class="onboard-notice danger">
            <span class="notice-icon">⚠</span>
            Key validation failed ${MAX_ATTEMPTS} times. Falling back to DEMO_KEY.
          </div>
          <div class="onboard-notice warn" style="margin-top:10px">
            <span class="notice-icon">ℹ</span>
            DEMO_KEY is rate-limited to <strong>30 req/hour</strong>. You can update your key later.
          </div>
          <div class="onboard-actions centered">
            <button class="auth-submit" id="btn-accept-demo">Continue with DEMO_KEY</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(el);
    wireModal(el);
  }

  function wireModal(el) {
    el.querySelector('#btn-open-nasa').onclick = () => {
      window.open(NASA_SIGNUP_URL, '_blank', 'noopener');
      // Focus the input so it's ready to paste when they come back
      setTimeout(() => el.querySelector('#ob-key')?.focus(), 300);
    };

    el.querySelector('#btn-skip').onclick = () => finish(el, DEMO_KEY, true);

    const counterEl = el.querySelector('#attempt-counter');
    const updateCounter = () => {
      if (counterEl && attempts > 0)
        counterEl.textContent = `(attempt ${attempts + 1} of ${MAX_ATTEMPTS})`;
    };

    const doValidate = async () => {
      const input   = el.querySelector('#ob-key');
      const errEl   = el.querySelector('#key-error');
      const sucEl   = el.querySelector('#key-success');
      const btn     = el.querySelector('#btn-validate');
      const key     = input.value.trim();

      if (!key) { showErr(errEl, 'Please paste your NASA API key first.'); return; }

      setLoading(btn, true, 'VALIDATING…');
      errEl.classList.add('hidden');
      sucEl.classList.add('hidden');

      const result = await validateKey(key);
      setLoading(btn, false, 'VALIDATE');

      if (result.valid || result.rateLimited) {
        sucEl.textContent = result.rateLimited
          ? '✓ Key accepted (currently rate-limited — will work when quota resets).'
          : '✓ Key validated!';
        sucEl.classList.remove('hidden');
        input.disabled = true;
        btn.disabled   = true;
        setTimeout(() => finish(el, key, false), 1200);
        return;
      }

      attempts++;
      updateCounter();

      if (attempts >= MAX_ATTEMPTS) {
        showStep(el, 'demo-fallback');
        el.querySelector('#btn-accept-demo').onclick = () => finish(el, DEMO_KEY, true);
        return;
      }

      const remaining = MAX_ATTEMPTS - attempts;
      const reason = result.reason === 'invalid' ? 'Key not recognized by NASA — check it was copied correctly.'
                   : result.reason === 'network' ? 'Network error — check your connection.'
                   : `Validation failed (HTTP ${result.status || '?'}).`;
      showErr(errEl, `${reason} ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      input.focus();
      input.select();
    };

    el.querySelector('#btn-validate').onclick = doValidate;
    el.querySelector('#ob-key').addEventListener('keydown', e => {
      if (e.key === 'Enter') doValidate();
    });
  }

  function showStep(el, name) {
    el.querySelectorAll('.onboard-step').forEach(s => s.classList.add('hidden'));
    el.querySelector(`#step-${name}`)?.classList.remove('hidden');
  }

  function showErr(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }

  function setLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = label;
  }

  async function finish(el, key, isDemo) {
    localStorage.setItem(LS_KEY,    key);
    localStorage.setItem(LS_STATUS, isDemo ? 'demo' : 'ok');
    el.remove();
    // Persist validated key to DB (silently — don't block UX)
    if (!isDemo && window.Auth?.callEdge) {
      Auth.callEdge('save_nasa_key', {}, { method: 'POST', body: JSON.stringify({ key }) })
        .catch(() => {});
    }
    window.dispatchEvent(new CustomEvent('nasa-key:ready', { detail: { key, isDemo } }));
    if (resolveFlow) resolveFlow({ key, isDemo });
  }

  // Re-attach modal if user tabbed away mid-flow and came back
  function reattachIfPending() {
    if (localStorage.getItem(LS_STATUS) === 'pending') {
      const stored = localStorage.getItem(LS_KEY);
      buildModal(stored && stored !== DEMO_KEY);
      // Re-wire resolve to a no-op since we're outside the normal promise flow;
      // app.js listens to the nasa-key:ready event instead
      resolveFlow = () => {};
    }
  }

  async function checkAndPromptIfNeeded() {
    const stored = localStorage.getItem(LS_KEY);
    const status = localStorage.getItem(LS_STATUS);

    // Trust cached status from this device
    if (status === 'ok' && stored && stored !== DEMO_KEY) return { key: stored, isDemo: false };
    if (status === 'demo') return { key: DEMO_KEY, isDemo: true };

    // No local cache — check DB (user may have validated on another device)
    if (window.Auth?.callEdge) {
      try {
        const result = await Auth.callEdge('get_nasa_key');
        if (result?.hasKey) {
          // Key exists in DB — mark ok locally and proceed without showing modal
          localStorage.setItem(LS_STATUS, 'ok');
          localStorage.setItem(LS_KEY, '__db__'); // sentinel: key lives in DB, Edge Fn handles it
          return { key: '__db__', isDemo: false };
        }
      } catch { /* network error — fall through to onboarding */ }
    }

    // Truly no key anywhere — run onboarding
    return run(stored && stored !== DEMO_KEY ? stored : null);
  }

  // On page load, re-show modal if onboarding was in progress
  window.addEventListener('load', () => {
    // Small delay so auth.js can fire auth:ready first
    setTimeout(reattachIfPending, 500);
  });

  return { checkAndPromptIfNeeded, validateKey };
})();
