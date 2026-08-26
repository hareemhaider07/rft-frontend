/* ============================================
   RFT Entertainment - Core JavaScript
   Core utilities, helpers, and initialization
   ============================================ */

(function() {
    'use strict';

    // ==================== CORE UTILITIES ====================

    /**
     * Get element by ID with null check
     */
    const $ = (id) => document.getElementById(id);

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const toast = document.querySelector('.toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    /**
     * Show page by ID
     */
    function showPage(pageId) {
        // Hide ALL pages — uses the .page class which every page has
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('show');
        });

        const page = document.getElementById(pageId);
        if (page) {
            page.classList.add('show');
            // Scroll the page element itself back to top (not window, since pages are position:absolute)
            page.scrollTop = 0;
            window.scrollTo(0, 0);
        }
    }

    /**
     * Safe localStorage operations
     */
    const Storage = {
        get(key, defaultValue = null) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch (e) {
                console.error(`Storage get error for ${key}:`, e);
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error(`Storage set error for ${key}:`, e);
                return false;
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error(`Storage remove error for ${key}:`, e);
                return false;
            }
        }
    };

    /**
     * Safe sessionStorage operations
     */
    const SessionStorage = {
        get(key, defaultValue = null) {
            try {
                const value = sessionStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch (e) {
                console.error(`SessionStorage get error for ${key}:`, e);
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                sessionStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error(`SessionStorage set error for ${key}:`, e);
                return false;
            }
        },
        remove(key) {
            try {
                sessionStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error(`SessionStorage remove error for ${key}:`, e);
                return false;
            }
        }
    };

    /**
     * Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function
     */
    function throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Format currency
     */
    function formatCurrency(amount, currency = 'PKR') {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    }

    /**
     * Format date
     */
    function formatDate(date, format = 'short') {
        const options = format === 'short' 
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        
        return new Date(date).toLocaleDateString('en-PK', options);
    }

    /**
     * Generate unique ID
     */
    function generateId() {
        return 'rft_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Validate email
     */
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Validate phone number
     */
    function isValidPhone(phone) {
        const re = /^[\d\s\-\+\(\)]{10,}$/;
        return re.test(phone);
    }

    /**
     * Sanitize HTML
     */
    function sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    // ==================== AUTH STATE MANAGEMENT ====================

    /**
     * Sync auth state
     */
    function syncAuthState() {
        try {
            const auth = SessionStorage.get('rft_auth');
            const user = Storage.get('rft_current_user');
            document.documentElement.dataset.rftAuth = (auth && user) ? '1' : '0';
            
            if (!auth && typeof window.currentUser !== 'undefined' && window.currentUser) {
                window.currentUser = null;
            }
        } catch (e) {
            console.error('Auth sync error:', e);
        }
    }

    /**
     * Get current user
     */
    function getCurrentUser() {
        try {
            return Storage.get('rft_current_user') || window.currentUser;
        } catch (e) {
            return null;
        }
    }

    /**
     * Set current user
     */
    function setCurrentUser(user) {
        try {
            window.currentUser = user;
            Storage.set('rft_current_user', user);
            syncAuthState();
            return true;
        } catch (e) {
            console.error('Set user error:', e);
            return false;
        }
    }

    /**
     * Clear auth
     */
    function clearAuth() {
        try {
            Storage.remove('rft_current_user');
            Storage.remove('rft_remembered_login');
            Storage.remove('rft_autologin');
            SessionStorage.remove('rft_auth');
            SessionStorage.remove('rft_auth_user');
            window.currentUser = null;
            document.documentElement.dataset.rftAuth = '0';
            return true;
        } catch (e) {
            console.error('Clear auth error:', e);
            return false;
        }
    }

    // ==================== DOM HELPERS ====================

    /**
     * Create element with attributes
     */
    function createElement(tag, attributes = {}, textContent = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });
        
        if (textContent) {
            element.textContent = textContent;
        }
        
        return element;
    }

    /**
     * Remove element by ID
     */
    function removeElement(id) {
        const element = document.getElementById(id);
        if (element) {
            element.remove();
            return true;
        }
        return false;
    }

    /**
     * Add class to element
     */
    function addClass(element, className) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.add(className);
            return true;
        }
        return false;
    }

    /**
     * Remove class from element
     */
    function removeClass(element, className) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.remove(className);
            return true;
        }
        return false;
    }

    /**
     * Toggle class on element
     */
    function toggleClass(element, className) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.toggle(className);
            return true;
        }
        return false;
    }

    // ==================== EVENT HELPERS ====================

    /**
     * Add event listener with delegation
     */
    function onEvent(parent, eventType, selector, handler) {
        parent.addEventListener(eventType, (e) => {
            const target = e.target.closest(selector);
            if (target && parent.contains(target)) {
                handler.call(target, e);
            }
        });
    }

    /**
     * Once event listener
     */
    function once(element, event, handler) {
        const onceHandler = (e) => {
            handler(e);
            element.removeEventListener(event, onceHandler);
        };
        element.addEventListener(event, onceHandler);
    }

    // ==================== ANIMATION HELPERS ====================

    /**
     * Fade in element
     */
    function fadeIn(element, duration = 300) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (!element) return;

        element.style.opacity = '0';
        element.style.display = 'block';
        
        requestAnimationFrame(() => {
            element.style.transition = `opacity ${duration}ms ease`;
            element.style.opacity = '1';
        });
    }

    /**
     * Fade out element
     */
    function fadeOut(element, duration = 300, callback = null) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (!element) return;

        element.style.transition = `opacity ${duration}ms ease`;
        element.style.opacity = '0';
        
        setTimeout(() => {
            element.style.display = 'none';
            if (callback) callback();
        }, duration);
    }

    // ==================== INITIALIZATION ====================

    /**
     * Initialize core functionality
     */
    function init() {
        syncAuthState();
        
        // Dispatch custom render event for other modules
        document.dispatchEvent(new CustomEvent('rft:core:ready'));
    }

    // ==================== EXPORTS ====================

    window.RFTCore = {
        $,
        showToast,
        showPage,
        Storage,
        SessionStorage,
        debounce,
        throttle,
        formatCurrency,
        formatDate,
        generateId,
        isValidEmail,
        isValidPhone,
        sanitizeHTML,
        syncAuthState,
        getCurrentUser,
        setCurrentUser,
        clearAuth,
        createElement,
        removeElement,
        addClass,
        removeClass,
        toggleClass,
        onEvent,
        once,
        fadeIn,
        fadeOut,
        init
    };

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

})();
