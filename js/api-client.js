/* ============================================
   RFT Entertainment - API Client
   HTTP client for backend API communication
   ============================================ */

(function() {
    'use strict';

    // API Configuration
    const API_CONFIG = {
        baseURL: 'https://rft-backend-production.up.railway.app/api',
        timeout: 30000
    };

    // Token storage
    let accessToken = localStorage.getItem('rft_access_token');
    let refreshToken = localStorage.getItem('rft_refresh_token');

    /**
     * Set tokens
     */
    function setTokens(access, refresh) {
        accessToken = access;
        refreshToken = refresh;
        localStorage.setItem('rft_access_token', access);
        localStorage.setItem('rft_refresh_token', refresh);
    }

    /**
     * Clear tokens
     */
    function clearTokens() {
        accessToken = null;
        refreshToken = null;
        localStorage.removeItem('rft_access_token');
        localStorage.removeItem('rft_refresh_token');
    }

    /**
     * Get access token
     */
    function getAccessToken() {
        return accessToken;
    }

    /**
     * Make HTTP request
     */
    async function request(endpoint, options = {}) {
        const url = `${API_CONFIG.baseURL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            
            // Handle 401 unauthorized
            if (response.status === 401 && refreshToken) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    headers['Authorization'] = `Bearer ${accessToken}`;
                    return fetch(url, { ...config, headers });
                }
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    /**
     * Refresh access token
     */
    async function refreshAccessToken() {
        try {
            const response = await fetch(`${API_CONFIG.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!response.ok) {
                clearTokens();
                return false;
            }

            const data = await response.json();
            if (data.success && data.data) {
                setTokens(data.data.access_token, data.data.refresh_token);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            clearTokens();
            return false;
        }
    }

    /**
     * GET request
     */
    function get(endpoint, options = {}) {
        return request(endpoint, { ...options, method: 'GET' });
    }

    /**
     * POST request
     */
    function post(endpoint, data, options = {}) {
        return request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    function put(endpoint, data, options = {}) {
        return request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    function del(endpoint, options = {}) {
        return request(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Upload file
     */
    async function upload(endpoint, file, fieldName = 'file') {
        const formData = new FormData();
        formData.append(fieldName, file);

        const url = `${API_CONFIG.baseURL}${endpoint}`;
        const headers = {};

        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Upload failed');
            }

            return data;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    // ==================== EXPORTS ====================

    window.RFTApi = {
        config: API_CONFIG,
        setTokens,
        clearTokens,
        getAccessToken,
        request,
        get,
        post,
        put,
        del,
        upload
    };

})();
