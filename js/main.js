/* ============================================================
   RFT Entertainment — Main Application
   Navigation, auth handlers, global wiring
   ============================================================ */
(function () {
  'use strict';

  const PROTECTED_PAGES = ['homePage','tasksPage','walletPage','rechargePage','withdrawPage',
    'vipPage','referralPage','earningsPage','notificationsPage','newsCenterPage',
    'mypagePage','personalInfoPage','luckyPage','leaderboardPage',
    'myTasksPage','savedMethodsPage'];

  // ── Page navigation ────────────────────────────────────────────────────────
  function navigate(pageId) {
    const isAuth = !!localStorage.getItem('rft_access_token');
    if (PROTECTED_PAGES.includes(pageId) && !isAuth) {
      pageId = 'loginPage';
    }
    window.RFTCore?.showPage(pageId);
    // update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === pageId);
    });
    // hide bottom nav on auth pages
    const bottomNav = document.getElementById('bottomNav');
    const floatBtns = document.getElementById('floatingButtons');
    const authPages = ['loginPage','registerPage','forgotPage'];
    if (bottomNav) bottomNav.style.display = authPages.includes(pageId) ? 'none' : 'flex';
    if (floatBtns) floatBtns.style.display = authPages.includes(pageId) ? 'none' : 'flex';
    // fire page-specific event
    document.dispatchEvent(new CustomEvent(`rft:page:${pageId}`));
  }

  // ── Auth handlers ──────────────────────────────────────────────────────────
  async function handleLogin() {
    const emailOrPhone = document.getElementById('loginEmail')?.value?.trim();
    const password     = document.getElementById('loginPassword')?.value;
    if (!emailOrPhone || !password) {
      window.RFTCore?.showToast('Enter email/phone and password', 'error');
      return;
    }
    const btn = document.querySelector('#loginPage .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    try {
      const r = await window.RFTApi?.post('/auth/login', { email_or_phone: emailOrPhone, password });
      if (r?.success) {
        // Backend returns either accessToken (camelCase) or access_token (snake_case)
        const accessToken  = r.data.accessToken  || r.data.access_token;
        const refreshToken = r.data.refreshToken || r.data.refresh_token;
        window.RFTApi?.setTokens(accessToken, refreshToken);
        window.RFTCore?.setCurrentUser(r.data.user);
        window.RFTCore?.showToast('Welcome back!', 'success');
        window.RFTNotifications?.startPolling?.();
        navigate('homePage');
      } else {
        window.RFTCore?.showToast(r?.message || 'Login failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Server error. Try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    }
  }

  async function handleRegister() {
    if (!document.getElementById('agreeTerms')?.checked) {
      window.RFTCore?.showToast('Please agree to Terms & Conditions', 'error');
      return;
    }
    const name     = document.getElementById('registerName')?.value?.trim();
    const email    = document.getElementById('registerEmail')?.value?.trim();
    const phone    = document.getElementById('registerPhone')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;
    const refCode  = document.getElementById('registerRef')?.value?.trim();
    if (!name || !email || !phone || !password) {
      window.RFTCore?.showToast('Fill in all required fields', 'error');
      return;
    }
    if (password.length < 6) {
      window.RFTCore?.showToast('Password must be at least 6 characters', 'error');
      return;
    }
    const btn = document.querySelector('#registerPage .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }
    try {
      const payload = { name, email, phone: phone.startsWith('0') ? phone : '0' + phone, password };
      // Prefix with selected country code if not Pakistan
      const countryCode = document.getElementById('countryCode')?.value || '+92';
      if (countryCode !== '+92') {
        // Store full international number
        payload.phone = countryCode + phone.replace(/^0/, '');
      }
      if (refCode) payload.referral_code = refCode;
      const r = await window.RFTApi?.post('/auth/register', payload);
      if (r?.success) {
        const accessToken  = r.data.accessToken  || r.data.access_token;
        const refreshToken = r.data.refreshToken || r.data.refresh_token;
        window.RFTApi?.setTokens(accessToken, refreshToken);
        window.RFTCore?.setCurrentUser(r.data.user);
        window.RFTCore?.showToast('Account created! Welcome to RFT!', 'success');
        window.RFTNotifications?.startPolling?.();
        navigate('homePage');
      } else {
        window.RFTCore?.showToast(r?.message || 'Registration failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Server error. Try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
    }
  }

  async function handleForgot() {
    const val = document.getElementById('forgotEmail')?.value?.trim();
    if (!val) { window.RFTCore?.showToast('Enter your email or phone', 'error'); return; }
    const btn = document.getElementById('forgotSendBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      const r = await window.RFTApi?.post('/auth/forgot-password', { email_or_phone: val });
      if (r?.success) {
        // Show step 2
        document.getElementById('forgotStep1').style.display = 'none';
        document.getElementById('forgotStep2').style.display = 'block';

        // Update delivery banner
        const banner = document.getElementById('otpDeliveryBanner');
        const text   = document.getElementById('otpDeliveryText');
        if (banner && text) {
          if (r.delivery === 'email') {
            banner.className = 'otp-delivery-banner otp-delivery-email';
            text.textContent = `Code sent to your email ${r.delivered_to}`;
          } else if (r.delivery === 'sms') {
            banner.className = 'otp-delivery-banner otp-delivery-sms';
            text.textContent = `Code sent via SMS to ${r.delivered_to}`;
          } else {
            banner.className = 'otp-delivery-banner otp-delivery-fallback';
            text.textContent = 'Code generated — check with admin if SMS/email not received';
          }
        }

        // Show debug OTP in toast if dev mode returns it
        if (r.debug_otp) {
          window.RFTCore?.showToast(`Dev OTP: ${r.debug_otp}`, 'info');
        }

        // Start 60s countdown for resend button
        startResendCountdown(60);

        window.RFTCore?.showToast(r.message || 'Reset code sent!', 'success');
      } else {
        window.RFTCore?.showToast(r?.message || 'Request failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Server error. Try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Code'; }
    }
  }

  async function handleResendOtp() {
    const val = document.getElementById('forgotEmail')?.value?.trim();
    if (!val) return;
    const btn = document.getElementById('otpResendBtn');
    if (btn) btn.disabled = true;
    try {
      const r = await window.RFTApi?.post('/auth/forgot-password', { email_or_phone: val });
      if (r?.success) {
        window.RFTCore?.showToast(r.message || 'New code sent!', 'success');
        if (r.debug_otp) window.RFTCore?.showToast(`Dev OTP: ${r.debug_otp}`, 'info');
        startResendCountdown(60);
      } else {
        window.RFTCore?.showToast(r?.message || 'Failed to resend', 'error');
        startResendCountdown(30);
      }
    } catch (_) {
      window.RFTCore?.showToast('Server error', 'error');
      startResendCountdown(30);
    }
  }

  let _countdownTimer = null;
  function startResendCountdown(seconds) {
    const btn       = document.getElementById('otpResendBtn');
    const countdown = document.getElementById('otpCountdown');
    if (!btn || !countdown) return;
    btn.disabled = true;
    clearInterval(_countdownTimer);
    let remaining = seconds;
    countdown.textContent = remaining;
    _countdownTimer = setInterval(() => {
      remaining--;
      countdown.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(_countdownTimer);
        btn.disabled = false;
        btn.innerHTML = 'Resend code';
      }
    }, 1000);
  }

  async function handleResetPassword() {
    const emailOrPhone = document.getElementById('forgotEmail')?.value?.trim();
    const otp          = document.getElementById('forgotOtp')?.value?.trim();
    const newPwd       = document.getElementById('forgotNewPwd')?.value;
    if (!otp || otp.length !== 6) { window.RFTCore?.showToast('Enter the 6-digit code', 'error'); return; }
    if (!newPwd || newPwd.length < 6) { window.RFTCore?.showToast('Password must be at least 6 characters', 'error'); return; }
    const btn = document.getElementById('forgotResetBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Resetting…'; }
    try {
      const r = await window.RFTApi?.post('/auth/reset-password', {
        email_or_phone: emailOrPhone, otp, new_password: newPwd
      });
      if (r?.success) {
        window.RFTCore?.showToast('Password reset successfully! Please login.', 'success');
        // Reset form state
        clearInterval(_countdownTimer);
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotStep1').style.display = 'block';
        document.getElementById('forgotEmail').value  = '';
        document.getElementById('forgotOtp').value    = '';
        document.getElementById('forgotNewPwd').value = '';
        setTimeout(() => navigate('loginPage'), 1200);
      } else {
        window.RFTCore?.showToast(r?.message || 'Reset failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Server error. Try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Reset Password'; }
    }
  }

  // OTP input formatting — auto-advance and spacing
  function handleOtpInput(input) {
    let val = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = val;
    // Auto-submit when 6 digits entered
    if (val.length === 6) {
      document.getElementById('forgotNewPwd')?.focus();
    }
    // Show password strength when typing new password
    const pwdInput = document.getElementById('forgotNewPwd');
    if (pwdInput) {
      pwdInput.addEventListener('input', updatePwdStrength, { once: false });
    }
  }

  function updatePwdStrength() {
    const pwd  = document.getElementById('forgotNewPwd')?.value || '';
    const wrap = document.getElementById('pwdStrengthWrap');
    const fill = document.getElementById('pwdStrengthFill');
    const lbl  = document.getElementById('pwdStrengthLabel');
    if (!wrap || !fill || !lbl) return;
    if (!pwd) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNum   = /[0-9]/.test(pwd);
    const hasSpec  = /[^A-Za-z0-9]/.test(pwd);
    const score    = [pwd.length >= 8, hasUpper, hasNum, hasSpec].filter(Boolean).length;
    const levels   = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors   = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
    fill.style.width      = (score * 25) + '%';
    fill.style.background = colors[score] || '#888';
    lbl.textContent       = levels[score] || '';
    lbl.style.color       = colors[score] || '#888';
  }

  async function handleLogout() {
    try {
      const rt = localStorage.getItem('rft_refresh_token');
      if (rt) await window.RFTApi?.post('/auth/logout', { refresh_token: rt });
    } catch (_) {}
    window.RFTApi?.clearTokens();
    window.RFTCore?.clearAuth();
    // Stop the notification poller
    document.dispatchEvent(new CustomEvent('rft:auth:logout'));
    window.RFTNotifications?.stopPolling?.();
    window.RFTCore?.showToast('Logged out', 'info');
    navigate('loginPage');
  }

  // ── Load public config from backend ───────────────────────────────────────
  async function loadAppConfig() {
    try {
      const r = await fetch('https://rft-backend-production.up.railway.app/api/config');
      const data = await r.json();
      if (data.success) {
        const cfg = data.data;
        // update WhatsApp button
        const waBtn = document.querySelector('.fab.whatsapp');
        if (waBtn && cfg.support_whatsapp) {
          waBtn.href = `https://wa.me/${cfg.support_whatsapp}`;
        }
        // store config globally for wallet.js to use
        window.RFT_CONFIG = cfg;
      }
    } catch (_) {
      // use defaults silently
      window.RFT_CONFIG = { pkr_rate: 280, min_recharge_usdt: 10, min_withdraw_usdt: 10 };
    }
  }
  function checkUrlRef() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      const refInput = document.getElementById('registerRef');
      if (refInput) refInput.value = ref;
      localStorage.setItem('rft_ref_code', ref);
    } else {
      const stored = localStorage.getItem('rft_ref_code');
      if (stored) {
        const refInput = document.getElementById('registerRef');
        if (refInput) refInput.value = stored;
      }
    }
  }

  // ── Referral code from URL ─────────────────────────────────────────────────
  function setupNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) navigate(page);
      });
    });
  }

  // ── Bottom nav setup ───────────────────────────────────────────────────────
  function determineStartPage() {
    const hasToken = !!localStorage.getItem('rft_access_token');
    checkUrlRef();
    if (hasToken) {
      navigate('homePage');
    } else {
      // check if ref param in URL → go to register
      const params = new URLSearchParams(window.location.search);
      if (params.get('ref')) {
        navigate('registerPage');
      } else {
        navigate('loginPage');
      }
    }
  }

  // ── Initial route ──────────────────────────────────────────────────────────
  function init() {
    loadAppConfig();
    setupNav();
    determineStartPage();
    // Start notification polling if already logged in (page refresh case)
    if (localStorage.getItem('rft_access_token')) {
      setTimeout(() => window.RFTNotifications?.startPolling?.(), 2000);
    }
    // expose global handlers used by HTML onclick
    window.handleLogin          = handleLogin;
    window.handleRegister       = handleRegister;
    window.handleForgot         = handleForgot;
    window.handleResendOtp      = handleResendOtp;
    window.handleResetPassword  = handleResetPassword;
    window.handleOtpInput       = handleOtpInput;
    window.handleLogout         = handleLogout;
    window.updateCountryCode    = (sel) => {}; // no-op, handled in payload
    window.RFTApp               = { ...window.RFTApp, navigate };
  }

  window.RFTApp = { navigate, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
