/* ============================================================
   RFT Entertainment — Main Application
   Navigation, auth handlers, global wiring
   ============================================================ */
(function () {
  'use strict';

  const PROTECTED_PAGES = ['homePage','tasksPage','walletPage','rechargePage','withdrawPage',
    'vipPage','referralPage','earningsPage','notificationsPage','newsCenterPage',
    'mypagePage','personalInfoPage','luckyPage','leaderboardPage'];

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
        window.RFTApi?.setTokens(r.data.access_token, r.data.refresh_token);
        window.RFTCore?.setCurrentUser(r.data.user);
        window.RFTCore?.showToast('Welcome back!', 'success');
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
      if (refCode) payload.referral_code = refCode;
      const r = await window.RFTApi?.post('/auth/register', payload);
      if (r?.success) {
        window.RFTApi?.setTokens(r.data.access_token, r.data.refresh_token);
        window.RFTCore?.setCurrentUser(r.data.user);
        window.RFTCore?.showToast('Account created! Welcome to RFT!', 'success');
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
    const btn = document.querySelector('#forgotPage .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      const r = await window.RFTApi?.post('/auth/forgot-password', { email_or_phone: val });
      if (r?.success) {
        document.getElementById('forgotStep1').style.display = 'none';
        document.getElementById('forgotStep2').style.display = 'block';
        window.RFTCore?.showToast('Reset code generated. Check with admin if no SMS.', 'success');
        // dev mode: show OTP in toast
        if (r.debug_otp) window.RFTCore?.showToast(`Dev OTP: ${r.debug_otp}`, 'info');
      } else {
        window.RFTCore?.showToast(r?.message || 'Request failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Server error. Try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Code'; }
    }
  }

  async function handleResetPassword() {
    const emailOrPhone = document.getElementById('forgotEmail')?.value?.trim();
    const otp          = document.getElementById('forgotOtp')?.value?.trim();
    const newPwd       = document.getElementById('forgotNewPwd')?.value;
    if (!otp || otp.length !== 6) { window.RFTCore?.showToast('Enter the 6-digit code', 'error'); return; }
    if (!newPwd || newPwd.length < 6) { window.RFTCore?.showToast('Password must be at least 6 characters', 'error'); return; }
    const btn = document.querySelector('#forgotStep2 .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Resetting…'; }
    try {
      const r = await window.RFTApi?.post('/auth/reset-password', {
        email_or_phone: emailOrPhone, otp, new_password: newPwd
      });
      if (r?.success) {
        window.RFTCore?.showToast('Password reset! Please login.', 'success');
        // reset form state
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotStep1').style.display = 'block';
        document.getElementById('forgotEmail').value = '';
        document.getElementById('forgotOtp').value = '';
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

  async function handleLogout() {
    try {
      const rt = localStorage.getItem('rft_refresh_token');
      if (rt) await window.RFTApi?.post('/auth/logout', { refresh_token: rt });
    } catch (_) {}
    window.RFTApi?.clearTokens();
    window.RFTCore?.clearAuth();
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
    // expose global handlers used by HTML onclick
    window.handleLogin          = handleLogin;
    window.handleRegister       = handleRegister;
    window.handleForgot         = handleForgot;
    window.handleResetPassword  = handleResetPassword;
    window.handleLogout         = handleLogout;
    window.RFTApp               = { ...window.RFTApp, navigate };
  }

  window.RFTApp = { navigate, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
