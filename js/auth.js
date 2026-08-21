/* ============================================
   RFT Entertainment - Auth JavaScript
   Authentication, Google OAuth, login, register
   ============================================ */

(function() {
    'use strict';

    // ==================== AUTH CONFIGURATION ====================

    const AUTH_CONFIG = {
        googleClientId: '', // Placeholder for production OAuth client ID
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        rememberMeDays: 30
    };

    // ==================== USER MANAGEMENT ====================

    /**
     * Get all users from storage
     */
    function getUsers() {
        try {
            return window.RFTCore?.Storage.get('rft_users', []) || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Save users to storage
     */
    function saveUsers(users) {
        try {
            return window.RFTCore?.Storage.set('rft_users', users);
        } catch (e) {
            return false;
        }
    }

    /**
     * Find user by email or phone
     */
    function findUser(emailOrPhone) {
        const users = getUsers();
        const normalized = String(emailOrPhone).toLowerCase();
        return users.find(u => 
            String(u.email || '').toLowerCase() === normalized || 
            String(u.phone || '') === normalized
        );
    }

    /**
     * Create new user
     */
    function createUser(userData) {
        const users = getUsers();
        
        // Check if user already exists
        if (findUser(userData.email) || findUser(userData.phone)) {
            return { success: false, message: 'User already exists' };
        }

        const newUser = {
            id: window.RFTCore?.generateId() || 'user_' + Date.now(),
            ...userData,
            createdAt: new Date().toISOString(),
            kycStatus: 'not_started',
            balance: 0,
            points: 0
        };

        users.push(newUser);
        saveUsers(users);

        return { success: true, user: newUser };
    }

    /**
     * Update user
     */
    function updateUser(emailOrPhone, updates) {
        const users = getUsers();
        const normalized = String(emailOrPhone).toLowerCase();
        const index = users.findIndex(u => 
            String(u.email || '').toLowerCase() === normalized || 
            String(u.phone || '') === normalized
        );

        if (index === -1) {
            return { success: false, message: 'User not found' };
        }

        users[index] = { ...users[index], ...updates };
        saveUsers(users);

        return { success: true, user: users[index] };
    }

    // ==================== AUTHENTICATION ====================

    /**
     * Login with email/phone and password
     */
    async function login(emailOrPhone, password, rememberMe = false) {
        try {
            const response = await window.RFTApi?.post('/auth/login', {
                email_or_phone: emailOrPhone,
                password
            });

            if (response.success && response.data) {
                const { user, access_token, refresh_token } = response.data;
                
                // Store tokens
                window.RFTApi?.setTokens(access_token, refresh_token);
                
                // Set current user
                window.RFTCore?.setCurrentUser(user);
                document.documentElement.dataset.rftAuth = '1';

                // Remember me
                if (rememberMe) {
                    window.RFTCore?.Storage.set('rft_remembered_login', {
                        emailOrPhone,
                        expiry: Date.now() + (AUTH_CONFIG.rememberMeDays * 24 * 60 * 60 * 1000)
                    });
                }

                return { success: true, user };
            }

            return { success: false, message: response.message || 'Login failed' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: error.message || 'Login failed' };
        }
    }

    /**
     * Register new user
     */
    async function register(userData) {
        try {
            const response = await window.RFTApi?.post('/auth/register', userData);

            if (response.success && response.data) {
                const { user, access_token, refresh_token } = response.data;
                
                // Store tokens
                window.RFTApi?.setTokens(access_token, refresh_token);
                
                // Set current user
                window.RFTCore?.setCurrentUser(user);
                document.documentElement.dataset.rftAuth = '1';

                return { success: true, user };
            }

            return { success: false, message: response.message || 'Registration failed' };
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, message: error.message || 'Registration failed' };
        }
    }

    /**
     * Logout
     */
    async function logout() {
        try {
            await window.RFTApi?.post('/auth/logout', {
                refresh_token: window.RFTApi?.getAccessToken()
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear tokens
        window.RFTApi?.clearTokens();
        window.RFTCore?.clearAuth();
        document.documentElement.dataset.rftAuth = '0';
        
        window.RFTCore?.showToast?.('Logged out successfully', 'info');
        
        // Redirect to login page
        setTimeout(() => {
            window.RFTCore?.showPage?.('loginPage');
        }, 350);
    }

    /**
     * Check if user is authenticated
     */
    function isAuthenticated() {
        return document.documentElement.dataset.rftAuth === '1';
    }

    // ==================== GOOGLE OAUTH ====================

    /**
     * Initialize Google OAuth (placeholder for production)
     */
    function initGoogleAuth() {
        // This is a placeholder for production Google OAuth integration
        // In production, you would initialize the Google Identity Services SDK here
        console.info('[RFT Google Auth] OAuth client ID not configured for standalone mode.');
    }

    /**
     * Handle Google sign-in (placeholder)
     */
    function handleGoogleSignIn() {
        // Placeholder for production Google OAuth flow
        window.RFTCore?.showToast?.('Google Sign-In requires backend configuration', 'info');
    }

    // ==================== PASSWORD MANAGEMENT ====================

    /**
     * Check password strength
     */
    function checkPasswordStrength(password) {
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        if (strength <= 2) return 'weak';
        if (strength <= 4) return 'medium';
        return 'strong';
    }

    /**
     * Get password suggestions
     */
    function getPasswordSuggestions(password) {
        const suggestions = [];
        
        if (password.length < 8) {
            suggestions.push('Use at least 8 characters');
        }
        if (!/[a-z]/.test(password)) {
            suggestions.push('Add lowercase letters');
        }
        if (!/[A-Z]/.test(password)) {
            suggestions.push('Add uppercase letters');
        }
        if (!/[0-9]/.test(password)) {
            suggestions.push('Add numbers');
        }
        if (!/[^a-zA-Z0-9]/.test(password)) {
            suggestions.push('Add special characters');
        }

        return suggestions;
    }

    // ==================== FORGOT PASSWORD ====================

    /**
     * Request password reset (placeholder)
     */
    function requestPasswordReset(email) {
        // Placeholder for production password reset flow
        // In production, this would send an email with reset link
        window.RFTCore?.showToast?.('Password reset requires backend configuration', 'info');
        return { success: false, message: 'Backend required' };
    }

    /**
     * Reset password (placeholder)
     */
    function resetPassword(token, newPassword) {
        // Placeholder for production password reset flow
        window.RFTCore?.showToast?.('Password reset requires backend configuration', 'info');
        return { success: false, message: 'Backend required' };
    }

    // ==================== SESSION MANAGEMENT ====================

    /**
     * Restore session from remember me
     */
    function restoreSession() {
        const remembered = window.RFTCore?.Storage.get('rft_remembered_login');
        
        if (!remembered) {
            return false;
        }

        // Check if remember me is still valid
        if (Date.now() > remembered.expiry) {
            window.RFTCore?.Storage.remove('rft_remembered_login');
            return false;
        }

        // Auto-login would go here in production
        // For now, just show a message
        return false;
    }

    // ==================== UI HELPERS ====================

    /**
     * Show login page
     */
    function showLoginPage() {
        window.RFTCore?.showPage?.('loginPage');
    }

    /**
     * Show register page
     */
    function showRegisterPage() {
        window.RFTCore?.showPage?.('registerPage');
    }

    /**
     * Show forgot password page
     */
    function showForgotPage() {
        window.RFTCore?.showPage?.('forgotPage');
    }

    // ==================== INITIALIZATION ====================

    function init() {
        initGoogleAuth();
        restoreSession();
        
        // Listen for core ready event
        document.addEventListener('rft:core:ready', () => {
            window.RFTCore?.syncAuthState?.();
        });
    }

    // ==================== EXPORTS ====================

    window.RFTAuth = {
        getUsers,
        saveUsers,
        findUser,
        createUser,
        updateUser,
        login,
        register,
        logout,
        isAuthenticated,
        initGoogleAuth,
        handleGoogleSignIn,
        checkPasswordStrength,
        getPasswordSuggestions,
        requestPasswordReset,
        resetPassword,
        restoreSession,
        showLoginPage,
        showRegisterPage,
        showForgotPage,
        init
    };

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

})();
