/* ============================================================
   RFT Entertainment — API Client
   HTTP client with auto token refresh
   ============================================================ */
(function () {
  'use strict';

  const BASE_URL = 'https://rft-backend-production.up.railway.app/api';

  let _accessToken  = localStorage.getItem('rft_access_token')  || '';
  let _refreshToken = localStorage.getItem('rft_refresh_token') || '';

  function setTokens(access, refresh) {
    _accessToken  = access;
    _refreshToken = refresh;
    localStorage.setItem('rft_access_token',  access);
    localStorage.setItem('rft_refresh_token', refresh);
  }

  function clearTokens() {
    _accessToken  = '';
    _refreshToken = '';
    localStorage.removeItem('rft_access_token');
    localStorage.removeItem('rft_refresh_token');
  }

  function getAccessToken()  { return _accessToken; }
  function getRefreshToken() { return _refreshToken; }

  async function refreshAccessToken() {
    if (!_refreshToken) { clearTokens(); return false; }
    try {
      const r = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: _refreshToken })
      });
      if (!r.ok) { clearTokens(); return false; }
      const data = await r.json();
      if (data.success && data.data) {
        // Handle both camelCase and snake_case token keys
        const access  = data.data.accessToken  || data.data.access_token;
        const refresh = data.data.refreshToken || data.data.refresh_token;
        setTokens(access, refresh);
        return true;
      }
      clearTokens();
      return false;
    } catch (_) {
      clearTokens();
      return false;
    }
  }

  async function request(endpoint, options = {}, retry = true) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { ...options.headers };

    // Don't set Content-Type for FormData — browser sets it with boundary
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (_accessToken) {
      headers['Authorization'] = `Bearer ${_accessToken}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });

      // Auto-refresh on 401
      if (res.status === 401 && retry && _refreshToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return request(endpoint, options, false);
        }
        // Refresh failed — redirect to login
        clearTokens();
        window.RFTCore?.clearAuth?.();
        window.RFTCore?.showPage?.('loginPage');
        throw new Error('Session expired. Please login again.');
      }

      const data = await res.json();
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error. Check your internet connection.');
      }
      throw err;
    }
  }

  function get(endpoint, opts = {}) {
    return request(endpoint, { ...opts, method: 'GET' });
  }

  function post(endpoint, body, opts = {}) {
    return request(endpoint, {
      ...opts, method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
  }

  function put(endpoint, body, opts = {}) {
    return request(endpoint, {
      ...opts, method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
  }

  function del(endpoint, opts = {}) {
    return request(endpoint, { ...opts, method: 'DELETE' });
  }

  // Upload — accepts either a FormData object or a single File + fieldName
  async function upload(endpoint, fileOrFormData, fieldName = 'file') {
    let formData;
    if (fileOrFormData instanceof FormData) {
      formData = fileOrFormData;
    } else {
      formData = new FormData();
      formData.append(fieldName, fileOrFormData);
    }
    // Use request() so we get the 401-refresh logic
    return request(endpoint, { method: 'POST', body: formData });
  }

  window.RFTApi = {
    BASE_URL,
    setTokens, clearTokens, getAccessToken, getRefreshToken,
    request, get, post, put, del, upload
  };
})();
