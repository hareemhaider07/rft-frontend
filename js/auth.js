/* ============================================================
   RFT Entertainment — Auth JavaScript
   Authentication helpers, password utilities, session management
   ============================================================ */

(function () {
  'use strict';

  const SESSION_CONFIG = {
    sessionTimeout: 24 * 60 * 60 * 1000,
    rememberMeDays: 30
  };

  // ── Authentication ──────────────────────────────────────────────────────────

  async function login(emailOrPhone, password, rememberMe = false) {
    try {
      const r = await window.RFTApi?.post('/auth/login', {
        email_or_phone: emailOrPhone,
        password
      });
      if (r?.success && r.data) {
        // Backend returns camelCase (accessToken) — handle both
        const accessToken  = r.data.accessToken  || r.data.access_token;
        const refreshToken = r.data.refreshToken || r.data.refresh_token;
        window.RFTApi?.setTokens(accessToken, refreshToken);
        window.RFTCore?.setCurrentUser(r.data.user);
        if (rememberMe) {
          window.RFTCore?.Storage?.set('rft_remembered_login', {
            emailOrPhone,
            expiry: Date.now() + SESSION_CONFIG.rememberMeDays * 24 * 60 * 60 * 1000
          });
        }
        return { success: true, user: r.data.user };
      }
      return { success: false, message: r?.message || 'Login failed' };
    } catch (err) {
      return { success: false, message: err.message || 'Login failed' };
    }
  }

  async function register(userData) {
    try {
      const r = await window.RFTApi?.post('/auth/register', userData);
      if (r?.success && r.data) {
        const accessToken  = r.data.accessToken  || r.data.access_token;
        const refreshToken = r.data.refreshToken || r.data.refresh_token;
        window.RFTApi?.setTokens(accessToken, refreshToken);
        window.RFTCore?.setCurrentUser(r.data.user);
        return { success: true, user: r.data.user };
      }
      return { success: false, message: r?.message || 'Registration failed' };
    } catch (err) {
      return { success: false, message: err.message || 'Registration failed' };
    }
  }

  async function logout() {
    try {
      const rt = localStorage.getItem('rft_refresh_token');
      if (rt) await window.RFTApi?.post('/auth/logout', { refresh_token: rt });
    } catch (_) {}
    window.RFTApi?.clearTokens();
    window.RFTCore?.clearAuth?.();
    window.RFTCore?.Storage?.remove('rft_remembered_login');
    window.RFTCore?.showToast?.('Logged out successfully', 'info');
    setTimeout(() => window.RFTCore?.showPage?.('loginPage'), 350);
  }

  function isAuthenticated() {
    return !!localStorage.getItem('rft_access_token');
  }

  // ── Password utilities ──────────────────────────────────────────────────────

  function checkPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8)          score++;
    if (password.length >= 12)         score++;
    if (/[a-z]/.test(password))        score++;
    if (/[A-Z]/.test(password))        score++;
    if (/[0-9]/.test(password))        score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  }

  function getPasswordSuggestions(password) {
    const s = [];
    if (password.length < 8)             s.push('Use at least 8 characters');
    if (!/[a-z]/.test(password))         s.push('Add lowercase letters');
    if (!/[A-Z]/.test(password))         s.push('Add uppercase letters');
    if (!/[0-9]/.test(password))         s.push('Add numbers');
    if (!/[^a-zA-Z0-9]/.test(password)) s.push('Add special characters');
    return s;
  }

  // ── Session restore ─────────────────────────────────────────────────────────

  function restoreSession() {
    const remembered = window.RFTCore?.Storage?.get('rft_remembered_login');
    if (!remembered || Date.now() > remembered.expiry) {
      window.RFTCore?.Storage?.remove('rft_remembered_login');
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  function init() {
    restoreSession();
    document.addEventListener('rft:core:ready', () => {
      window.RFTCore?.syncAuthState?.();
    });
  }

  window.RFTAuth = {
    login, register, logout, isAuthenticated,
    checkPasswordStrength, getPasswordSuggestions,
    restoreSession, init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
