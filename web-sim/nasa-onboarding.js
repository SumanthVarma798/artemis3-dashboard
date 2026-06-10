// NASA API Key onboarding — first-login flow for pro users
// State machine: validate → (fail) → offer auto-request OR manual paste → retry ×3 → DEMO_KEY fallback
const NasaOnboarding = (() => {

  const NASA_SIGNUP_URL = 'https://api.nasa.gov/';
  const DEMO_KEY        = 'DEMO_KEY';
  const MAX_ATTEMPTS    = 3;

  // Test key against a lightweight NASA endpoint
  async function validateKey(key) {
    if (!key || key === DEMO_KEY) return { valid: false, isDemo: true };
    try {
      const res = await fetch(
        `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}&thumbs=true`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.status === 200)   return { valid: true };
      if (res.status === 403)   return { valid: false, reason: 'invalid' };
      if (res.status === 429)   return { valid: true,  rateLimited: true }; // valid but throttled
      return { valid: false, reason: 'error', status: res.status };
    } catch {
      return { valid: false, reason: 'network' };
    }
  }

  // Submit to NASA API signup endpoint on behalf of user
  // NASA's form POSTs to https://api.nasa.gov/signup — we try it; CORS will likely block it,
  // so we fall back to opening the page in a new tab with a prefilled deep-link.
  async function requestNasaKey({ firstName, lastName, email }) {
    // Try direct POST (works if NASA allows cross-origin — they sometimes do for their API form)
    try {
      const body = new FormData();
      body.append('firstName',   firstName);
      body.append('lastName',    lastName);
      body.append('email',       email);
      body.append('application[].organization', 'Personal / Artemis III Dashboard');

      const res = await fetch('https://api.nasa.gov/signup', {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) return { success: true, method: 'direct' };
    } catch { /* CORS expected — fall through */ }

    // Fallback: open NASA signup page in new tab. User fills in (we pre-filled what we can).
    // NASA's signup form is at api.nasa.gov — open it and notify user to check email.
    const params = new URLSearchParams({ firstName, lastName, email });
    window.open(`${NASA_SIGNUP_URL}?${params}#signUp`, '_blank', 'noopener');
    return { success: true, method: 'tab', tabOpened: true };
  }

  // ─────────────────────────────────────────────────────────────
  // MODAL — full onboarding state machine rendered in one container
  // ─────────────────────────────────────────────────────────────
  let attempts    = 0;
  let resolveFlow = null; // called with final key when done

  function run(currentKey) {
    return new Promise((resolve) => {
      resolveFlow = resolve;
      attempts    = 0;
      buildModal(currentKey);
    });
  }

  function buildModal(currentKey) {
    let el = document.getElementById('nasa-onboard-modal');
    if (el) el.remove();

    el = document.createElement('div');
    el.id        = 'nasa-onboard-modal';
    el.className = 'modal nasa-onboard';
    el.innerHTML = `
      <div class="modal-box onboard-box">
        <div class="onboard-header">
          <div class="onboard-icon">⬡</div>
          <div>
            <div class="onboard-title">NASA API KEY REQUIRED</div>
            <div class="onboard-sub">Pro features need a valid NASA Open API key</div>
          </div>
        </div>

        <!-- Step 1: problem notice + choice -->
        <div class="onboard-step" id="step-choice">
          <div class="onboard-notice warn" id="choice-notice">
            ${currentKey && currentKey !== 'DEMO_KEY'
              ? `<span class="notice-icon">⚠</span> The key you provided (<code>${currentKey.slice(0,8)}…</code>) failed validation. It may be incorrect or expired.`
              : `<span class="notice-icon">ℹ</span> No NASA API key is set. Live telemetry and DSN data require one.`
            }
          </div>
          <p class="onboard-body">
            NASA API keys are <strong>free</strong> and take ~30 seconds to get at
            <a href="https://api.nasa.gov" target="_blank" rel="noopener">api.nasa.gov</a>.
          </p>
          <p class="onboard-body">How would you like to proceed?</p>
          <div class="onboard-choices">
            <button class="choice-btn primary" id="btn-auto-request">
              <span class="choice-icon">🚀</span>
              <div>
                <div class="choice-title">Request key for me</div>
                <div class="choice-desc">Enter your name + email — we'll submit the NASA form and you paste the key back</div>
              </div>
            </button>
            <button class="choice-btn" id="btn-manual-key">
              <span class="choice-icon">⌨</span>
              <div>
                <div class="choice-title">I already have a key</div>
                <div class="choice-desc">Paste your existing NASA API key directly</div>
              </div>
            </button>
          </div>
          <button class="onboard-skip" id="btn-skip-onboard">Skip for now · use DEMO_KEY (limited rate)</button>
        </div>

        <!-- Step 2a: collect name + email for auto-request -->
        <div class="onboard-step hidden" id="step-collect">
          <p class="onboard-body">Enter your details — we'll submit the NASA API key request on your behalf and open their signup page.</p>
          <div class="auth-field">
            <label>FIRST NAME</label>
            <input type="text" id="ob-first" placeholder="Jane" autocomplete="given-name" />
          </div>
          <div class="auth-field">
            <label>LAST NAME</label>
            <input type="text" id="ob-last" placeholder="Doe" autocomplete="family-name" />
          </div>
          <div class="auth-field">
            <label>EMAIL ADDRESS</label>
            <input type="email" id="ob-email" placeholder="jane@example.com" autocomplete="email" />
          </div>
          <div id="collect-error" class="auth-error hidden"></div>
          <div class="onboard-actions">
            <button class="onboard-back" id="btn-collect-back">← Back</button>
            <button class="auth-submit" id="btn-submit-request">Submit NASA Request →</button>
          </div>
        </div>

        <!-- Step 2b: after auto-request — waiting for key -->
        <div class="onboard-step hidden" id="step-check-email">
          <div class="onboard-notice ok">
            <span class="notice-icon">✓</span>
            <span id="email-sent-msg">NASA API key request submitted. Check your inbox — the key usually arrives within a few minutes.</span>
          </div>
          <p class="onboard-body">Once you receive the email, paste your new API key below:</p>
          <div class="auth-field key-field">
            <label>NASA API KEY  <span id="attempt-counter" class="attempt-count"></span></label>
            <div class="key-input-row">
              <input type="text" id="ob-key-auto" placeholder="Paste key from NASA email…" autocomplete="off" spellcheck="false" />
              <button class="key-validate-btn" id="btn-validate-auto">VALIDATE</button>
            </div>
          </div>
          <div id="auto-key-error" class="auth-error hidden"></div>
          <div id="auto-key-success" class="auth-success hidden"></div>
          <div class="onboard-actions">
            <button class="onboard-back" id="btn-email-back">← Back</button>
          </div>
        </div>

        <!-- Step 3: manual key entry -->
        <div class="onboard-step hidden" id="step-manual">
          <p class="onboard-body">
            Get your free key at <a href="https://api.nasa.gov" target="_blank" rel="noopener">api.nasa.gov</a> → Sign Up, then paste it below.
          </p>
          <div class="auth-field key-field">
            <label>NASA API KEY  <span id="manual-attempt-counter" class="attempt-count"></span></label>
            <div class="key-input-row">
              <input type="text" id="ob-key-manual" placeholder="e.g. aBcDeFgH1234…" autocomplete="off" spellcheck="false" />
              <button class="key-validate-btn" id="btn-validate-manual">VALIDATE</button>
            </div>
          </div>
          <div id="manual-key-error"   class="auth-error hidden"></div>
          <div id="manual-key-success" class="auth-success hidden"></div>
          <div class="onboard-actions">
            <button class="onboard-back" id="btn-manual-back">← Back</button>
          </div>
        </div>

        <!-- Step final: DEMO_KEY fallback -->
        <div class="onboard-step hidden" id="step-demo-fallback">
          <div class="onboard-notice danger">
            <span class="notice-icon">⚠</span>
            Key validation failed ${MAX_ATTEMPTS} times. Falling back to NASA's public DEMO_KEY.
          </div>
          <div class="onboard-notice warn" style="margin-top:10px">
            <span class="notice-icon">ℹ</span>
            DEMO_KEY has a <strong>30 req/hour</strong> rate limit. Live telemetry will be throttled or unavailable during peak usage. You can update your key later from Settings.
          </div>
          <div class="onboard-actions centered">
            <button class="auth-submit" id="btn-accept-demo">Continue with DEMO_KEY</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(el);
    wireStep1(el);
  }

  // ── Step 1: choice ──
  function wireStep1(el) {
    el.querySelector('#btn-auto-request').onclick = () => showStep(el, 'collect');
    el.querySelector('#btn-manual-key').onclick   = () => showStep(el, 'manual');
    el.querySelector('#btn-skip-onboard').onclick  = () => finish(el, DEMO_KEY, true);
    wireStep2Collect(el);
    wireStep2Manual(el);
  }

  // ── Step 2a: collect name+email ──
  function wireStep2Collect(el) {
    el.querySelector('#btn-collect-back').onclick = () => { attempts = 0; showStep(el, 'choice'); };
    el.querySelector('#btn-submit-request').onclick = async () => {
      const first  = el.querySelector('#ob-first').value.trim();
      const last   = el.querySelector('#ob-last').value.trim();
      const email  = el.querySelector('#ob-email').value.trim();
      const errEl  = el.querySelector('#collect-error');

      if (!first || !last || !email) {
        showErr(errEl, 'Please fill in all three fields.'); return;
      }
      if (!email.includes('@')) {
        showErr(errEl, 'Please enter a valid email address.'); return;
      }
      errEl.classList.add('hidden');

      const btn = el.querySelector('#btn-submit-request');
      setLoading(btn, true, 'SUBMITTING…');

      const result = await requestNasaKey({ firstName: first, lastName: last, email });

      setLoading(btn, false, 'Submit NASA Request →');

      const msgEl = el.querySelector('#email-sent-msg');
      if (result.tabOpened) {
        msgEl.textContent = `NASA's signup page opened in a new tab. Fill in your details there — the key is sent to ${email}. Once received, paste it below.`;
      } else {
        msgEl.textContent = `Request submitted to NASA. The API key will be sent to ${email} shortly.`;
      }
      showStep(el, 'check-email');
      wireStep2CheckEmail(el);
    };
  }

  // ── Step 2b: paste key after email ──
  function wireStep2CheckEmail(el) {
    el.querySelector('#btn-email-back').onclick = () => showStep(el, 'collect');
    const counterEl = el.querySelector('#attempt-counter');
    if (counterEl) counterEl.textContent = `(attempt ${attempts + 1} of ${MAX_ATTEMPTS})`;

    el.querySelector('#btn-validate-auto').onclick = () =>
      validateAndAdvance(el, '#ob-key-auto', '#auto-key-error', '#auto-key-success', '#attempt-counter', 'check-email');
    el.querySelector('#ob-key-auto').addEventListener('keydown', e => {
      if (e.key === 'Enter') el.querySelector('#btn-validate-auto').click();
    });
  }

  // ── Step 3: manual key entry ──
  function wireStep2Manual(el) {
    el.querySelector('#btn-manual-back').onclick = () => { attempts = 0; showStep(el, 'choice'); };
    const counterEl = el.querySelector('#manual-attempt-counter');
    if (counterEl) counterEl.textContent = `(attempt ${attempts + 1} of ${MAX_ATTEMPTS})`;

    el.querySelector('#btn-validate-manual').onclick = () =>
      validateAndAdvance(el, '#ob-key-manual', '#manual-key-error', '#manual-key-success', '#manual-attempt-counter', 'manual');
    el.querySelector('#ob-key-manual').addEventListener('keydown', e => {
      if (e.key === 'Enter') el.querySelector('#btn-validate-manual').click();
    });
  }

  async function validateAndAdvance(el, inputSel, errSel, sucSel, counterSel, stepOnFail) {
    const input  = el.querySelector(inputSel);
    const errEl  = el.querySelector(errSel);
    const sucEl  = el.querySelector(sucSel);
    const key    = input.value.trim();

    if (!key) { showErr(errEl, 'Please paste your NASA API key first.'); return; }

    const validateBtn = el.querySelector(inputSel.replace('ob-key', 'btn-validate').replace('#ob-key-auto','#btn-validate-auto').replace('#ob-key-manual','#btn-validate-manual'));
    setLoading(validateBtn, true, 'VALIDATING…');

    const result = await validateKey(key);

    setLoading(validateBtn, false, 'VALIDATE');

    if (result.valid || result.rateLimited) {
      sucEl.textContent = result.rateLimited
        ? '✓ Key accepted (rate-limited right now — will work when quota resets).'
        : '✓ API key validated successfully!';
      sucEl.classList.remove('hidden');
      errEl.classList.add('hidden');
      input.disabled = true;
      validateBtn.disabled = true;
      setTimeout(() => finish(el, key, false), 1200);
      return;
    }

    attempts++;
    const counterEl = el.querySelector(counterSel);

    if (attempts >= MAX_ATTEMPTS) {
      showStep(el, 'demo-fallback');
      el.querySelector('#btn-accept-demo').onclick = () => finish(el, DEMO_KEY, true);
      return;
    }

    const remaining = MAX_ATTEMPTS - attempts;
    const reason = result.reason === 'invalid'  ? 'Key not recognized by NASA — check it was copied correctly.'
                 : result.reason === 'network'  ? 'Network error — check your connection and try again.'
                 : `Validation failed (status ${result.status || '?'}).`;
    showErr(errEl, `${reason} ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
    if (counterEl) counterEl.textContent = `(attempt ${attempts + 1} of ${MAX_ATTEMPTS})`;
    input.focus(); input.select();
  }

  // ── Helpers ──
  function showStep(el, stepName) {
    el.querySelectorAll('.onboard-step').forEach(s => s.classList.add('hidden'));
    el.querySelector(`#step-${stepName}`)?.classList.remove('hidden');
  }

  function showErr(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function setLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = label;
  }

  function finish(el, key, isDemo) {
    // Save key
    localStorage.setItem('nasa_api_key', key);
    localStorage.setItem('nasa_key_validated', isDemo ? 'demo' : 'ok');
    el.remove();
    // Notify app
    window.dispatchEvent(new CustomEvent('nasa-key:ready', { detail: { key, isDemo } }));
    if (resolveFlow) resolveFlow({ key, isDemo });
  }

  // Entry point — called after pro user logs in
  // Returns a promise resolving to { key, isDemo }
  async function checkAndPromptIfNeeded() {
    const stored    = localStorage.getItem('nasa_api_key');
    const validated = localStorage.getItem('nasa_key_validated');

    // Already validated this session
    if (validated === 'ok' && stored && stored !== DEMO_KEY) return { key: stored, isDemo: false };
    if (validated === 'demo') return { key: DEMO_KEY, isDemo: true };

    // First pro login or stored key needs re-validation
    const result = await validateKey(stored);
    if (result.valid || result.rateLimited) {
      localStorage.setItem('nasa_key_validated', 'ok');
      return { key: stored, isDemo: false };
    }

    // Key failed (or missing) — show onboarding
    return run(stored);
  }

  return { checkAndPromptIfNeeded, validateKey };
})();
