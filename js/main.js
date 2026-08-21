/* ============================================
   RFT Entertainment - Main JavaScript
   Application initialization and orchestration
   ============================================ */

(function() {
    'use strict';

    // ==================== APPLICATION CONFIGURATION ====================

    const APP_CONFIG = {
        name: 'RFT Entertainment',
        version: '2.0.0',
        environment: 'production',
        debug: false
    };

    // ==================== MODULE REGISTRATION ====================

    const modules = {
        core: null,
        auth: null,
        taskEngine: null,
        wallet: null
    };

    /**
     * Register module
     */
    function registerModule(name, module) {
        if (module) {
            modules[name] = module;
            console.log(`[RFT] Module registered: ${name}`);
        }
    }

    /**
     * Get module
     */
    function getModule(name) {
        return modules[name];
    }

    // ==================== INITIALIZATION SEQUENCE ====================

    /**
     * Initialize core module
     */
    function initCore() {
        if (window.RFTCore) {
            registerModule('core', window.RFTCore);
            window.RFTCore.init();
            return true;
        }
        console.error('[RFT] Core module not found');
        return false;
    }

    /**
     * Initialize auth module
     */
    function initAuth() {
        if (window.RFTAuth) {
            registerModule('auth', window.RFTAuth);
            window.RFTAuth.init();
            return true;
        }
        console.error('[RFT] Auth module not found');
        return false;
    }

    /**
     * Initialize task engine module
     */
    function initTaskEngine() {
        if (window.RFTTaskEngine) {
            registerModule('taskEngine', window.RFTTaskEngine);
            window.RFTTaskEngine.init();
            return true;
        }
        console.error('[RFT] Task engine module not found');
        return false;
    }

    /**
     * Initialize wallet module
     */
    function initWallet() {
        if (window.RFTWallet) {
            registerModule('wallet', window.RFTWallet);
            window.RFTWallet.init();
            return true;
        }
        console.error('[RFT] Wallet module not found');
        return false;
    }

    // ==================== THEME MANAGEMENT ====================

    /**
     * Apply video parity theme
     */
    function applyVideoParityTheme() {
        document.body.classList.add('rft-video-parity-active');
        console.log('[RFT] Video parity theme applied');
    }

    /**
     * Remove video parity theme
     */
    function removeVideoParityTheme() {
        document.body.classList.remove('rft-video-parity-active');
        console.log('[RFT] Video parity theme removed');
    }

    /**
     * Apply performance theme
     */
    function applyPerformanceTheme() {
        document.body.classList.add('rft-performance-theme');
        console.log('[RFT] Performance theme applied');
    }

    // ==================== ROUTING ====================

    /**
     * Handle navigation
     */
    function navigate(pageId) {
        const core = getModule('core');
        if (core) {
            core.showPage(pageId);
            
            // Dispatch navigation event
            document.dispatchEvent(new CustomEvent('rft:navigate', {
                detail: { pageId }
            }));
        }
    }

    /**
     * Setup navigation handlers
     */
    function setupNavigation() {
        // Bottom navigation
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const pageId = item.dataset.page;
                if (pageId) {
                    navigate(pageId);
                    
                    // Update active state
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');
                }
            });
        });

        // Back buttons
        const backButtons = document.querySelectorAll('.back-btn');
        backButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const core = getModule('core');
                const auth = getModule('auth');
                
                if (auth && auth.isAuthenticated()) {
                    navigate('homePage');
                } else {
                    navigate('loginPage');
                }
            });
        });
    }

    // ==================== ERROR HANDLING ====================

    /**
     * Global error handler
     */
    function setupErrorHandling() {
        window.addEventListener('error', (e) => {
            console.error('[RFT] Global error:', e.error);
            
            if (APP_CONFIG.debug) {
                const core = getModule('core');
                if (core) {
                    core.showToast('An error occurred. See console for details.', 'error');
                }
            }
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('[RFT] Unhandled promise rejection:', e.reason);
        });
    }

    // ==================== PERFORMANCE OPTIMIZATION ====================

    /**
     * Setup performance monitoring
     */
    function setupPerformanceMonitoring() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 100) {
                        console.warn(`[RFT] Slow operation: ${entry.name} took ${entry.duration}ms`);
                    }
                }
            });
            
            observer.observe({ entryTypes: ['measure', 'navigation'] });
        }
    }

    // ==================== SERVICE WORKER ====================

    /**
     * Register service worker (placeholder for PWA)
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator && APP_CONFIG.environment === 'production') {
            // Placeholder for service worker registration
            console.log('[RFT] Service worker registration placeholder');
        }
    }

    // ==================== STARTUP SEQUENCE ====================

    /**
     * Initialize application
     */
    function init() {
        console.log(`[RFT] Initializing ${APP_CONFIG.name} v${APP_CONFIG.version}`);

        // Mark start time
        const startTime = performance.now();

        // Initialize modules in order
        const coreInitialized = initCore();
        const authInitialized = initAuth();
        const taskEngineInitialized = initTaskEngine();
        const walletInitialized = initWallet();

        // Setup application features
        if (coreInitialized) {
            setupNavigation();
            setupErrorHandling();
            setupPerformanceMonitoring();
            registerServiceWorker();

            // Apply default theme
            applyVideoParityTheme();
        }

        // Calculate initialization time
        const endTime = performance.now();
        const initTime = (endTime - startTime).toFixed(2);

        console.log(`[RFT] Initialization complete in ${initTime}ms`);

        // Dispatch ready event
        document.dispatchEvent(new CustomEvent('rft:ready', {
            detail: {
                version: APP_CONFIG.version,
                initTime,
                modules: {
                    core: coreInitialized,
                    auth: authInitialized,
                    taskEngine: taskEngineInitialized,
                    wallet: walletInitialized
                }
            }
        }));

        // Show welcome message
        const core = getModule('core');
        if (core) {
            setTimeout(() => {
                core.showToast(`Welcome to ${APP_CONFIG.name}`, 'info');
            }, 500);
        }
    }

    // ==================== EXPORTS ====================

    window.RFTApp = {
        config: APP_CONFIG,
        registerModule,
        getModule,
        initCore,
        initAuth,
        initTaskEngine,
        initWallet,
        applyVideoParityTheme,
        removeVideoParityTheme,
        applyPerformanceTheme,
        navigate,
        init
    };

    // ==================== AUTO-INITIALIZATION ====================

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        // DOM already loaded, initialize immediately
        init();
    }

    // Also initialize on window load as fallback
    window.addEventListener('load', () => {
        if (!window.RFTApp._initialized) {
            init();
            window.RFTApp._initialized = true;
        }
    }, { once: true });

})();
