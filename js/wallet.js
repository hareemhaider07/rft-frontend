/* ============================================
   RFT Entertainment - Wallet JavaScript
   PKR currency conversion, recharge, withdrawal, local payment methods
   ============================================ */

(function() {
    'use strict';

    // ==================== WALLET CONFIGURATION ====================

    const WALLET_CONFIG = {
        pkrRate: 280, // 1 USDT = 280 PKR
        minRecharge: 10, // USDT
        maxRecharge: 10000, // USDT
        minWithdraw: 10, // USDT
        maxWithdraw: 10000, // USDT
        localPaymentMethods: [
            { id: 'jazzcash', name: 'JazzCash', icon: '📱', color: '#ff0000' },
            { id: 'easypaisa', name: 'Easypaisa', icon: '💰', color: '#00aa00' },
            { id: 'sadapay', name: 'SadaPay', icon: '💳', color: '#6600cc' },
            { id: 'nayapay', name: 'NayaPay', icon: '🏦', color: '#ff6600' },
            { id: 'raast', name: 'Raast', icon: '⚡', color: '#00ccff' },
            { id: 'bank', name: 'Bank Transfer', icon: '🏛️', color: '#333333' }
        ]
    };

    // ==================== CURRENCY CONVERSION ====================

    /**
     * Convert USDT to PKR
     */
    function usdtToPkr(usdt) {
        return (usdt * WALLET_CONFIG.pkrRate).toFixed(2);
    }

    /**
     * Convert PKR to USDT
     */
    function pkrToUsdt(pkr) {
        return (pkr / WALLET_CONFIG.pkrRate).toFixed(2);
    }

    /**
     * Format currency display
     */
    function formatCurrency(amount, currency = 'PKR') {
        if (currency === 'PKR') {
            return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
        }
        return `${Number(amount).toFixed(2)} USDT`;
    }

    /**
     * Replace USDT text with PKR in DOM
     */
    function replaceCurrencyText() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const usdtMatch = text.match(/(\d+\.?\d*)\s*USDT/gi);
            
            if (usdtMatch) {
                let newText = text;
                usdtMatch.forEach(match => {
                    const usdt = parseFloat(match.replace(/[^0-9.]/g, ''));
                    const pkr = usdtToPkr(usdt);
                    newText = newText.replace(match, `${match} (${formatCurrency(pkr)})`);
                });
                textNode.textContent = newText;
            }
        });
    }

    // ==================== WALLET MANAGEMENT ====================

    /**
     * Get user wallet balance from API
     */
    async function getWalletBalance() {
        try {
            const response = await window.RFTApi?.get('/wallet/balance');
            if (response.success && response.data) {
                return response.data;
            }
            return { balance_usdt: 0, balance_pkr: '0.00', points: 0 };
        } catch (error) {
            console.error('Get balance error:', error);
            return { balance_usdt: 0, balance_pkr: '0.00', points: 0 };
        }
    }

    /**
     * Get transaction history from API
     */
    async function getTransactionHistory(page = 1, limit = 20, type = null) {
        try {
            const params = new URLSearchParams({ page, limit });
            if (type) params.append('type', type);
            
            const response = await window.RFTApi?.get(`/wallet/transactions?${params}`);
            if (response.success && response.data) {
                return response.data;
            }
            return { transactions: [], pagination: { page, limit, total: 0, total_pages: 0 } };
        } catch (error) {
            console.error('Get transactions error:', error);
            return { transactions: [], pagination: { page, limit, total: 0, total_pages: 0 } };
        }
    }

    /**
     * Handle recharge with bank transfer
     */
    async function handleRecharge(amountUsdt, paymentMethod, accountNumber, accountName) {
        try {
            const response = await window.RFTApi?.post('/wallet/recharge', {
                amount_usdt: amountUsdt,
                payment_method: paymentMethod,
                account_number: accountNumber,
                account_name: accountName
            });

            if (response.success) {
                window.RFTCore?.showToast?.('Recharge request submitted. Please upload payment screenshot.', 'success');
                return { success: true, ...response.data };
            }

            return { success: false, message: response.message || 'Recharge failed' };
        } catch (error) {
            console.error('Recharge error:', error);
            return { success: false, message: error.message || 'Recharge failed' };
        }
    }

    /**
     * Upload recharge screenshot
     */
    async function uploadRechargeScreenshot(transactionId, file) {
        try {
            const response = await window.RFTApi?.upload(`/wallet/recharge/${transactionId}/screenshot`, file, 'screenshot');
            if (response.success) {
                window.RFTCore?.showToast?.('Screenshot uploaded successfully', 'success');
                return { success: true, ...response.data };
            }
            return { success: false, message: response.message || 'Upload failed' };
        } catch (error) {
            console.error('Upload screenshot error:', error);
            return { success: false, message: error.message || 'Upload failed' };
        }
    }

    /**
     * Handle withdrawal
     */
    async function handleWithdraw(amountUsdt, paymentMethod, accountNumber, accountName) {
        try {
            const response = await window.RFTApi?.post('/wallet/withdraw', {
                amount_usdt: amountUsdt,
                payment_method: paymentMethod,
                account_number: accountNumber,
                account_name: accountName
            });

            if (response.success) {
                window.RFTCore?.showToast?.('Withdrawal request submitted. Admin will review within 24-48 hours.', 'success');
                return { success: true, ...response.data };
            }

            return { success: false, message: response.message || 'Withdrawal failed' };
        } catch (error) {
            console.error('Withdraw error:', error);
            return { success: false, message: error.message || 'Withdrawal failed' };
        }
    }

    // ==================== RECHARGE & WITHDRAWAL (LEGACY - KEPT FOR UI) ====================

    /**
     * Update wallet balance (local only - for UI updates)
     */
    function updateWalletBalance(amount) {
        const user = window.RFTCore?.getCurrentUser();
        if (!user) return { success: false, message: 'Not authenticated' };

        const currentBalance = user.balance_usdt || 0;
        const newBalance = Math.max(0, currentBalance + amount);

        window.RFTCore?.Storage.set('rft_current_user', {
            ...user,
            balance_usdt: newBalance
        });

        return { success: true, newBalance };
    }

    /**
     * Update transaction status (local only)
     */
    function updateTransactionStatus(transactionId, status) {
        const transactions = getTransactionHistory();
        const index = transactions.findIndex(t => t.id === transactionId);

        if (index !== -1) {
            transactions[index].status = status;
            transactions[index].updated_at = new Date().toISOString();
            return true;
        }

        return false;
    }

    // ==================== LOCAL PAYMENT METHODS ====================

    /**
     * Render local payment methods
     */
    function renderLocalPaymentMethods(containerId, onSelect) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = WALLET_CONFIG.localPaymentMethods.map(method => `
            <div class="local-payment-method" data-method="${method.id}" onclick="RFTWallet.selectPaymentMethod('${method.id}', '${containerId}')">
                <div class="payment-method-icon">${method.icon}</div>
                <div class="payment-method-name">${method.name}</div>
                <div class="payment-method-check">
                    <i class="ph-bold ph-check-circle"></i>
                </div>
            </div>
        `).join('');
    }

    /**
     * Select payment method
     */
    function selectPaymentMethod(methodId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Remove selected class from all methods
        container.querySelectorAll('.local-payment-method').forEach(el => {
            el.classList.remove('selected');
        });

        // Add selected class to chosen method
        const selected = container.querySelector(`[data-method="${methodId}"]`);
        if (selected) {
            selected.classList.add('selected');
        }

        // Store selection
        window.RFTCore?.Storage.set('rft_selected_payment', methodId);
    }

    /**
     * Get selected payment method
     */
    function getSelectedPaymentMethod() {
        const methodId = window.RFTCore?.Storage.get('rft_selected_payment');
        return WALLET_CONFIG.localPaymentMethods.find(m => m.id === methodId);
    }

    // ==================== KYC VERIFICATION ====================

    /**
     * Check if KYC is verified
     */
    function isKycVerified() {
        const user = window.RFTCore?.getCurrentUser();
        if (!user) return false;
        return user.kyc_status === 'verified';
    }

    /**
     * Get KYC status from API
     */
    async function getKycStatus() {
        try {
            const response = await window.RFTApi?.get('/kyc/status');
            if (response.success && response.data) {
                return response.data;
            }
            return { status: 'not_started', documents: [] };
        } catch (error) {
            console.error('Get KYC status error:', error);
            return { status: 'not_started', documents: [] };
        }
    }

    /**
     * Submit KYC documents
     */
    async function submitKyc(documentType, issuingCountry, documentNumber, frontImage, backImage, selfieImage) {
        try {
            const formData = new FormData();
            formData.append('document_type', documentType);
            formData.append('issuing_country', issuingCountry);
            formData.append('document_number', documentNumber);
            if (frontImage) formData.append('front_image', frontImage);
            if (backImage) formData.append('back_image', backImage);
            if (selfieImage) formData.append('selfie_image', selfieImage);

            const response = await window.RFTApi?.upload('/kyc/submit', formData, null);

            if (response.success) {
                window.RFTCore?.showToast?.('KYC documents submitted. Admin will review within 24-48 hours.', 'success');
                return { success: true, ...response.data };
            }

            return { success: false, message: response.message || 'KYC submission failed' };
        } catch (error) {
            console.error('Submit KYC error:', error);
            return { success: false, message: error.message || 'KYC submission failed' };
        }
    }

    /**
     * Open KYC verification (placeholder)
     */
    function openKyc() {
        const overlay = document.getElementById('rftKycOverlay');
        if (overlay) {
            overlay.classList.add('show');
        }
    }

    /**
     * Close KYC verification
     */
    function closeKyc() {
        const overlay = document.getElementById('rftKycOverlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    // ==================== WALLET UI ====================

    /**
     * Render wallet page
     */
    function renderWallet() {
        const balance = getWalletBalance();
        const transactions = getTransactionHistory();

        // Update balance display
        const balanceDisplay = document.querySelector('.balance-amount');
        if (balanceDisplay) {
            balanceDisplay.innerHTML = `${formatCurrency(balance.pkr)} <small>(${balance.usdt.toFixed(2)} USDT)</small>`;
        }

        // Update wallet card
        const walletCard = document.querySelector('.wallet-card');
        if (walletCard) {
            const walletHeader = walletCard.querySelector('.wallet-header strong');
            if (walletHeader) {
                walletHeader.textContent = formatCurrency(balance.pkr);
            }
        }

        // Render transactions
        const transactionList = document.querySelector('.transaction-list');
        if (transactionList) {
            transactionList.innerHTML = transactions.slice(0, 10).map(tx => `
                <div class="transaction-item">
                    <div class="transaction-icon">
                        <i class="ph-bold ${tx.type === 'recharge' ? 'ph-arrow-down-left' : 'ph-arrow-up-right'}"></i>
                    </div>
                    <div class="transaction-info">
                        <div class="transaction-type">${tx.type === 'recharge' ? 'Recharge' : 'Withdrawal'}</div>
                        <div class="transaction-method">${tx.method}</div>
                        <div class="transaction-date">${window.RFTCore?.formatDate?.(tx.createdAt) || tx.createdAt}</div>
                    </div>
                    <div class="transaction-amount ${tx.type === 'recharge' ? 'positive' : 'negative'}">
                        ${tx.type === 'recharge' ? '+' : '-'}${formatCurrency(tx.amountPKR)}
                    </div>
                    <div class="transaction-status status-${tx.status}">
                        ${tx.status}
                    </div>
                </div>
            `).join('');
        }
    }

    // ==================== INITIALIZATION ====================

    function init() {
        // Replace currency text on load
        replaceCurrencyText();

        // Listen for page changes
        document.addEventListener('rft:render', () => {
            replaceCurrencyText();
            renderWallet();
        });

        // Initial render
        if (document.querySelector('.balance-amount') || document.querySelector('.wallet-card')) {
            renderWallet();
        }

        // Render local payment methods if containers exist
        renderLocalPaymentMethods('rechargeMethods');
        renderLocalPaymentMethods('withdrawMethods');
    }

    // ==================== EXPORTS ====================

    window.RFTWallet = {
        usdtToPkr,
        pkrToUsdt,
        formatCurrency,
        replaceCurrencyText,
        getWalletBalance,
        getTransactionHistory,
        handleRecharge,
        uploadRechargeScreenshot,
        handleWithdraw,
        updateWalletBalance,
        updateTransactionStatus,
        renderLocalPaymentMethods,
        selectPaymentMethod,
        getSelectedPaymentMethod,
        isKycVerified,
        getKycStatus,
        submitKyc,
        openKyc,
        closeKyc,
        renderWallet,
        init
    };

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

})();
