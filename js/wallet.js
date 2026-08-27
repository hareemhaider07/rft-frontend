/* ============================================================
   RFT Entertainment — Wallet Module
   QR recharge, withdrawal, earnings, transaction history
   ============================================================ */
(function () {
  'use strict';

  const PKR_RATE = 280;
  let _paymentMethods = [];
  let _selectedRechargeMethod = null;
  let _selectedWithdrawMethod  = null;
  let _pendingTxId = null;
  let _currentTxFilter = '';

  // ── Currency helpers ───────────────────────────────────────────────────────
  function usdtToPkr(usdt) { return (parseFloat(usdt) * PKR_RATE).toFixed(2); }
  function formatPkr(pkr)  { return 'Rs. ' + Number(pkr).toLocaleString('en-PK'); }

  // ── Load payment methods ───────────────────────────────────────────────────
  async function loadPaymentMethods() {
    try {
      const r = await window.RFTApi?.get('/wallet/payment-info');
      if (r?.success) _paymentMethods = r.data;
    } catch (_) {}
  }

  // ── Wallet Page ────────────────────────────────────────────────────────────
  async function loadWalletPage() {
    try {
      const r = await window.RFTApi?.get('/wallet/balance');
      if (r?.success) {
        const d = r.data;
        document.getElementById('walletBalPkr').textContent     = formatPkr(d.balance_pkr);
        document.getElementById('walletBalUsdt').textContent    = formatPkr(d.balance_pkr);
        document.getElementById('walletPoints').textContent     = d.points;
        document.getElementById('walletEarned').textContent     = formatPkr(usdtToPkr(d.total_earned_usdt));
        document.getElementById('walletDeposited').textContent  = formatPkr(usdtToPkr(d.total_recharged_usdt));
        document.getElementById('walletWithdrawn').textContent  = formatPkr(usdtToPkr(d.total_withdrawn_usdt));
      }
    } catch (_) {}
    loadTransactions('');
  }

  async function loadTransactions(type) {
    _currentTxFilter = type;
    const el = document.getElementById('txList');
    if (!el) return;
    el.innerHTML = '<div class="tx-loading">Loading…</div>';
    try {
      const params = type ? `?type=${type}&limit=30` : '?limit=30';
      const r = await window.RFTApi?.get('/wallet/transactions' + params);
      if (!r?.success || !r.data.transactions.length) {
        el.innerHTML = '<div class="tx-loading">No transactions found</div>';
        return;
      }
      el.innerHTML = r.data.transactions.map(tx => txRow(tx)).join('');
    } catch (_) {
      el.innerHTML = '<div class="tx-loading">Error loading transactions</div>';
    }
  }

  function txRow(tx) {
    const isCredit = ['recharge','task_reward','referral_commission','referral_bonus','manual_adjustment'].includes(tx.type);
    const icons = { recharge:'ph-arrow-down-left', withdrawal:'ph-arrow-up-right', task_reward:'ph-play-circle', referral_commission:'ph-users-three', referral_bonus:'ph-gift', manual_adjustment:'ph-pencil' };
    const labels = { recharge:'Deposit', withdrawal:'Withdrawal', task_reward:'Task Reward', referral_commission:'Referral Commission', referral_bonus:'Referral Bonus', manual_adjustment:'Balance Adjustment' };
    const statusColors = { completed:'#22c55e', pending:'#f97316', failed:'#ef4444' };
    const pkrAmt = tx.amount_pkr ? Number(tx.amount_pkr).toLocaleString('en-PK') : Math.round(parseFloat(tx.amount_usdt) * PKR_RATE).toLocaleString('en-PK');
    return `
      <div class="transaction-item">
        <div class="transaction-icon ${isCredit?'tx-credit':'tx-debit'}">
          <i class="ph-bold ${icons[tx.type]||'ph-arrow-right'}"></i>
        </div>
        <div class="transaction-info">
          <div class="transaction-type">${labels[tx.type]||tx.type}</div>
          <div class="transaction-method">${tx.payment_method||''}</div>
          <div class="transaction-date">${fmtDate(tx.created_at)}</div>
        </div>
        <div class="transaction-right">
          <div class="transaction-amount ${isCredit?'positive':'negative'}">
            ${isCredit?'+':'-'}Rs. ${pkrAmt}
          </div>
          <div class="transaction-status" style="color:${statusColors[tx.status]||'#888'}">${tx.status}</div>
        </div>
      </div>`;
  }

  function filterTx(type, tabEl) {
    document.querySelectorAll('#walletPage .tx-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    loadTransactions(type);
  }

  // ── Recharge Page ──────────────────────────────────────────────────────────
  async function loadRechargePage() {
    await loadPaymentMethods();
    renderRechargeInfo();
    renderPaymentMethodButtons('rechargeMethods', 'recharge');

    // PKR equiv on amount input
    const amtEl = document.getElementById('rechargeAmount');
    if (amtEl) {
      amtEl.addEventListener('input', () => {
        const pkr = amtEl.value ? usdtToPkr(amtEl.value) : '';
        const eq  = document.getElementById('rechargePkrEquiv');
        if (eq) eq.textContent = pkr ? `≈ ${formatPkr(pkr)}` : '';
      });
    }
  }

  function renderRechargeInfo() {
    const el = document.getElementById('rechargeInfoCard');
    if (!el) return;
    el.innerHTML = `
      <div class="ric-title"><i class="ph-bold ph-info"></i> How to Recharge</div>
      <ol class="ric-steps">
        <li>Select a payment method below</li>
        <li>Send the amount to the displayed account/QR code</li>
        <li>Enter your details and upload the payment screenshot</li>
        <li>Your balance will be credited after admin approval (usually within 1 hour)</li>
      </ol>
    `;
  }

  function renderPaymentMethodButtons(containerId, mode) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!_paymentMethods.length) {
      el.innerHTML = '<div class="tx-loading">Loading payment methods…</div>';
      return;
    }
    el.innerHTML = _paymentMethods.map(m => `
      <div class="pm-btn" data-id="${m.id}" data-mode="${mode}"
           onclick="${mode==='recharge'?'selectRechargeMethod':'selectWithdrawMethod'}('${m.id}')">
        <span class="pm-icon">${m.icon||'💳'}</span>
        <span class="pm-name">${m.name}</span>
        <i class="ph-bold ph-check-circle pm-check" style="display:none"></i>
      </div>
    `).join('');
  }

  function selectRechargeMethod(methodId) {
    _selectedRechargeMethod = _paymentMethods.find(m => m.id === methodId);
    // highlight
    document.querySelectorAll('#rechargeMethods .pm-btn').forEach(b => {
      const isThis = b.dataset.id === methodId;
      b.classList.toggle('pm-selected', isThis);
      const chk = b.querySelector('.pm-check');
      if (chk) chk.style.display = isThis ? 'block' : 'none';
    });
    // show QR card
    const card = document.getElementById('selectedMethodCard');
    const qr   = document.getElementById('smcQr');
    const an   = document.getElementById('smcAccName');
    const num  = document.getElementById('smcAccNum');
    const ins  = document.getElementById('smcInstructions');
    if (card) card.style.display = 'block';
    if (qr)   { qr.src = _selectedRechargeMethod.qr_code_url || ''; qr.style.display = _selectedRechargeMethod.qr_code_url ? 'block' : 'none'; }
    if (an)   an.textContent  = _selectedRechargeMethod.account_name || '—';
    if (num)  num.textContent = _selectedRechargeMethod.account_number || '—';
    if (ins)  ins.textContent = _selectedRechargeMethod.instructions || '';
    // show extra fields and screenshot
    const extra = document.getElementById('rechargeExtraFields');
    const ss    = document.getElementById('screenshotSection');
    const btn   = document.getElementById('rechargeBtn');
    if (extra) extra.style.display = 'block';
    if (ss)    ss.style.display    = 'block';
    if (btn)   btn.style.display   = 'block';
  }

  function selectWithdrawMethod(methodId) {
    _selectedWithdrawMethod = _paymentMethods.find(m => m.id === methodId);
    document.querySelectorAll('#withdrawMethods .pm-btn').forEach(b => {
      const isThis = b.dataset.id === methodId;
      b.classList.toggle('pm-selected', isThis);
      const chk = b.querySelector('.pm-check');
      if (chk) chk.style.display = isThis ? 'block' : 'none';
    });
    const extra = document.getElementById('withdrawExtraFields');
    const btn   = document.getElementById('withdrawBtn');
    if (extra) extra.style.display = 'block';
    if (btn)   btn.style.display   = 'block';
  }

  function previewScreenshot(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const prev = document.getElementById('screenshotPreview');
      if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
  }

  async function handleRecharge() {
    const amount = parseFloat(document.getElementById('rechargeAmount')?.value);
    if (!amount || amount < 10) { window.RFTCore?.showToast('Minimum recharge is 10 USDT', 'error'); return; }
    if (!_selectedRechargeMethod) { window.RFTCore?.showToast('Please select a payment method', 'error'); return; }
    const accName = document.getElementById('rcAccName')?.value?.trim();
    const accNum  = document.getElementById('rcAccNum')?.value?.trim();
    const ref     = document.getElementById('rcRef')?.value?.trim();
    if (!accName || !accNum) { window.RFTCore?.showToast('Enter your account name and number', 'error'); return; }

    const btn = document.getElementById('rechargeBtn');
    if (btn) btn.disabled = true;

    try {
      const r = await window.RFTApi?.post('/wallet/recharge', {
        amount_usdt: amount,
        payment_method: _selectedRechargeMethod.identifier,
        account_number: accNum,
        account_name: accName,
        payment_reference: ref || undefined
      });

      if (r?.success) {
        _pendingTxId = r.data.transaction_id;
        // upload screenshot if selected
        const file = document.getElementById('screenshotFile')?.files[0];
        if (file && _pendingTxId) {
          await window.RFTApi?.upload(`/wallet/recharge/${_pendingTxId}/screenshot`, file, 'screenshot');
        }
        window.RFTCore?.showToast('Recharge submitted! Awaiting admin approval.', 'success');
        setTimeout(() => RFTApp.navigate('walletPage'), 1500);
      } else {
        window.RFTCore?.showToast(r?.message || 'Recharge failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Error submitting recharge', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Withdraw Page ──────────────────────────────────────────────────────────
  async function loadWithdrawPage() {
    await loadPaymentMethods();
    renderPaymentMethodButtons('withdrawMethods', 'withdraw');
    // show available balance
    try {
      const r = await window.RFTApi?.get('/wallet/balance');
      if (r?.success) {
        const el = document.getElementById('withdrawAvailBal');
        if (el) el.textContent = `${formatPkr(usdtToPkr(r.data.balance_usdt))} (${r.data.balance_usdt} USDT)`;
      }
    } catch (_) {}
    // PKR equiv
    const amtEl = document.getElementById('withdrawAmount');
    if (amtEl) {
      amtEl.addEventListener('input', () => {
        const pkr = amtEl.value ? usdtToPkr(amtEl.value) : '';
        const eq  = document.getElementById('withdrawPkrEquiv');
        if (eq) eq.textContent = pkr ? `≈ ${formatPkr(pkr)}` : '';
      });
    }
    // check KYC
    const user = window.RFTCore?.getCurrentUser();
    const kycWarn = document.getElementById('kycWarning');
    if (kycWarn) kycWarn.style.display = (user?.kyc_status !== 'verified') ? 'flex' : 'none';
  }

  async function handleWithdraw() {
    const amount = parseFloat(document.getElementById('withdrawAmount')?.value);
    if (!amount || amount < 10) { window.RFTCore?.showToast('Minimum withdrawal is 10 USDT', 'error'); return; }
    if (!_selectedWithdrawMethod) { window.RFTCore?.showToast('Please select a payment method', 'error'); return; }
    const accName = document.getElementById('wdAccName')?.value?.trim();
    const accNum  = document.getElementById('wdAccNum')?.value?.trim();
    if (!accName || !accNum) { window.RFTCore?.showToast('Enter account name and number', 'error'); return; }

    const btn = document.getElementById('withdrawBtn');
    if (btn) btn.disabled = true;
    try {
      const r = await window.RFTApi?.post('/wallet/withdraw', {
        amount_usdt: amount,
        payment_method: _selectedWithdrawMethod.identifier,
        account_number: accNum,
        account_name: accName
      });
      if (r?.success) {
        window.RFTCore?.showToast('Withdrawal submitted! Processing in 24–48 hours.', 'success');
        setTimeout(() => RFTApp.navigate('walletPage'), 1500);
      } else {
        window.RFTCore?.showToast(r?.message || 'Withdrawal failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Error submitting withdrawal', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Earnings Page ──────────────────────────────────────────────────────────
  async function loadEarningsPage() {
    try {
      const [balRes, statsRes] = await Promise.all([
        window.RFTApi?.get('/wallet/balance'),
        window.RFTApi?.get('/user/stats')
      ]);
      const sumEl = document.getElementById('earningsSummary');
      if (sumEl && balRes?.success && statsRes?.success) {
        const b = balRes.data;
        const s = statsRes.data;
        sumEl.innerHTML = `
          <div class="earn-stat-grid">
            <div class="earn-stat"><div class="esv">${b.total_earned_usdt} USDT</div><div class="esl">Total Task Earnings</div></div>
            <div class="earn-stat"><div class="esv">${b.total_referral_usdt} USDT</div><div class="esl">Referral Commissions</div></div>
            <div class="earn-stat"><div class="esv">${s.today_earned_usdt} USDT</div><div class="esl">Earned Today</div></div>
            <div class="earn-stat"><div class="esv">${s.total_tasks_completed}</div><div class="esl">Tasks Completed</div></div>
          </div>
        `;
      }
    } catch (_) {}
    // load task + referral transactions
    try {
      const r = await window.RFTApi?.get('/wallet/transactions?limit=50');
      const el = document.getElementById('earningsList');
      if (!el) return;
      if (r?.success) {
        const earned = r.data.transactions.filter(t => ['task_reward','referral_commission','referral_bonus'].includes(t.type));
        if (!earned.length) { el.innerHTML = '<div class="tx-loading">No earnings yet</div>'; return; }
        el.innerHTML = earned.map(tx => txRow(tx)).join('');
      }
    } catch (_) {}
  }

  // ── Personal Info Edit ───────────────────────────────────────────────────────
  function toggleEditMode() {
    const viewMode = document.getElementById('piViewMode');
    const editMode = document.getElementById('piEditMode');
    const editBtn  = document.getElementById('piEditBtn');
    const isEditing = editMode.style.display !== 'none';

    if (isEditing) {
      // Switch back to view
      editMode.style.display = 'none';
      viewMode.style.display = 'block';
      editBtn.innerHTML = '<i class="ph-bold ph-pencil"></i> Edit';
    } else {
      // Pre-fill edit fields from current data
      const user = window.RFTCore?.getCurrentUser?.() || {};
      document.getElementById('editName').value       = user.name       || '';
      document.getElementById('editWhatsapp').value   = user.whatsapp   || '';
      document.getElementById('editResidence').value  = user.residence  || '';
      document.getElementById('editOccupation').value = user.occupation || '';
      document.getElementById('editAge').value        = user.age        || '';
      document.getElementById('editGender').value     = user.gender     || '';

      viewMode.style.display = 'none';
      editMode.style.display = 'block';
      editBtn.innerHTML = '<i class="ph-bold ph-x"></i> Cancel';
    }
  }

  async function savePersonalInfo() {
    const name       = document.getElementById('editName').value.trim();
    const whatsapp   = document.getElementById('editWhatsapp').value.trim();
    const residence  = document.getElementById('editResidence').value.trim();
    const occupation = document.getElementById('editOccupation').value.trim();
    const age        = document.getElementById('editAge').value;
    const gender     = document.getElementById('editGender').value;

    if (!name) { window.RFTCore?.showToast('Name is required', 'error'); return; }

    const btn = document.getElementById('piSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      const r = await window.RFTApi?.put('/user/profile', {
        name,
        whatsapp:   whatsapp   || undefined,
        residence:  residence  || undefined,
        occupation: occupation || undefined,
        age:        age        ? parseInt(age) : undefined,
        gender:     gender     || undefined
      });

      if (r?.success) {
        // Update stored user
        const user = window.RFTCore?.getCurrentUser?.() || {};
        window.RFTCore?.setCurrentUser({ ...user, name, whatsapp, residence, occupation, age: age ? parseInt(age) : user.age, gender });

        // Update display fields
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
        set('infoName',    name);
        set('profileName', name);

        window.RFTCore?.showToast('Profile updated successfully!', 'success');
        toggleEditMode();
      } else {
        window.RFTCore?.showToast(r?.message || 'Update failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Error saving profile', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    }
  }

  // ── KYC Overlay — updated to handle all states ───────────────────────────────
  function openKycOverlay() {
    const overlay = document.getElementById('rftKycOverlay');
    if (!overlay) return;

    // Check current KYC status
    const user = window.RFTCore?.getCurrentUser?.() || {};
    const status = user.kyc_status || 'not_started';

    // Hide all states first
    ['kycVerifiedState','kycPendingState','kycRejectedState','kycStep1','kycStep2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    if (status === 'verified') {
      document.getElementById('kycVerifiedState').style.display = 'block';
    } else if (status === 'pending') {
      document.getElementById('kycPendingState').style.display = 'block';
    } else if (status === 'rejected') {
      // Show rejection notice + allow resubmit
      document.getElementById('kycRejectedState').style.display = 'block';
      document.getElementById('kycStep1').style.display = 'block';
      const subtitle = document.getElementById('kycStep1Subtitle');
      if (subtitle) subtitle.style.display = 'none'; // hide default subtitle, rejection notice replaces it
      // Load rejection reason from API
      window.RFTApi?.get('/kyc/status').then(r => {
        if (r?.success && r.data.documents?.length) {
          const latestDoc = r.data.documents[0];
          const reasonEl = document.getElementById('kycRejectionReason');
          if (reasonEl && latestDoc.rejection_reason) {
            reasonEl.textContent = 'Reason: ' + latestDoc.rejection_reason;
          }
        }
      }).catch(() => {});
    } else {
      // not_started — show normal flow
      document.getElementById('kycStep1').style.display = 'block';
      const subtitle = document.getElementById('kycStep1Subtitle');
      if (subtitle) subtitle.style.display = 'block';
    }

    overlay.classList.add('show');
  }
  function closeKycOverlay() {
    document.getElementById('rftKycOverlay').classList.remove('show');
  }
  function kycNextStep() {
    const docType = document.getElementById('kycDocType')?.value;
    const country = document.getElementById('kycCountry')?.value;
    const docNum  = document.getElementById('kycDocNum')?.value?.trim();
    if (!docNum) { window.RFTCore?.showToast('Enter document number', 'error'); return; }
    document.getElementById('kycStep1').style.display = 'none';
    document.getElementById('kycStep2').style.display = 'block';
  }
  function kycBackStep() {
    document.getElementById('kycStep2').style.display = 'none';
    document.getElementById('kycStep1').style.display = 'block';
  }
  function previewKyc(input, previewId) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const p = document.getElementById(previewId);
      if (p) { p.src = e.target.result; p.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
  }
  async function submitKycForm() {
    const docType = document.getElementById('kycDocType')?.value;
    const country = document.getElementById('kycCountry')?.value;
    const docNum  = document.getElementById('kycDocNum')?.value?.trim();
    const front   = document.getElementById('kycFront')?.files[0];
    if (!front) { window.RFTCore?.showToast('Front image is required', 'error'); return; }

    const formData = new FormData();
    formData.append('document_type',   docType);
    formData.append('issuing_country', country);
    formData.append('document_number', docNum);
    formData.append('front_image', front);
    const back   = document.getElementById('kycBack')?.files[0];
    const selfie = document.getElementById('kycSelfie')?.files[0];
    if (back)   formData.append('back_image',   back);
    if (selfie) formData.append('selfie_image', selfie);

    const submitBtn = document.querySelector('#kycStep2 .btn-primary');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    try {
      const r = await window.RFTApi?.upload('/kyc/submit', formData, null);
      if (r?.success) {
        window.RFTCore?.showToast('KYC submitted. Review takes 24–48 hours.', 'success');
        closeKycOverlay();
        // Update local user kyc_status to pending
        const user = window.RFTCore?.getCurrentUser();
        if (user) {
          window.RFTCore?.setCurrentUser({ ...user, kyc_status: 'pending' });
          // Update badge in profile menu
          const badge = document.getElementById('kycStatusBadge');
          if (badge) { badge.textContent = 'pending'; badge.className = 'kyc-badge kyc-pending'; }
          const infoKyc = document.getElementById('infoKyc');
          if (infoKyc) infoKyc.textContent = 'pending';
        }
      } else {
        window.RFTCore?.showToast(r?.message || 'KYC submission failed', 'error');
      }
    } catch (_) {
      window.RFTCore?.showToast('Error submitting KYC', 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit KYC'; }
    }
  }

  // ── Profile Page ───────────────────────────────────────────────────────────
  async function loadProfilePage() {
    try {
      const [profRes, statsRes] = await Promise.all([
        window.RFTApi?.get('/user/profile'),
        window.RFTApi?.get('/user/stats')
      ]);
      if (profRes?.success) {
        const u = profRes.data;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
        set('profileName', u.name);
        set('profileEmail', u.email);
        set('profileVipBadge', `VIP ${u.vip_level || 0}`);
        set('profBalance', formatPkr(usdtToPkr(u.balance_usdt)));
        set('infoName', u.name);
        set('infoEmail', u.email);
        set('infoPhone', u.phone);
        set('infoRefCode', u.referral_code);
        set('infoVip', `VIP ${u.vip_level || 0}`);
        set('infoKyc', u.kyc_status);
        set('infoJoined', fmtDate(u.created_at));
        const kycBadge = document.getElementById('kycStatusBadge');
        if (kycBadge) {
          kycBadge.textContent = u.kyc_status;
          kycBadge.className = `kyc-badge kyc-${u.kyc_status}`;
        }
        window.RFTCore?.setCurrentUser(u);
      }
      if (statsRes?.success) {
        const s = statsRes.data;
        const refEl = document.getElementById('profReferrals');
        const ptsEl = document.getElementById('profPoints');
        if (refEl) refEl.textContent = s.referral_count;
        if (ptsEl) ptsEl.textContent = s.tasks_completed || 0;
      }
    } catch (_) {}
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function copyText(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
      window.RFTCore?.showToast('Copied!', 'success');
    });
  }

  function togglePwd(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) icon.className = isHidden ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye';
  }

  function init() {
    document.addEventListener('rft:page:walletPage',   loadWalletPage);
    document.addEventListener('rft:page:rechargePage', loadRechargePage);
    document.addEventListener('rft:page:withdrawPage', loadWithdrawPage);
    document.addEventListener('rft:page:earningsPage', () => {
      // earnings.js handles this page now
    });
    document.addEventListener('rft:page:mypagePage',   loadProfilePage);
    document.addEventListener('rft:page:personalInfoPage', loadProfilePage);

    // expose for HTML onclick
    window.filterTx              = filterTx;
    window.selectRechargeMethod  = selectRechargeMethod;
    window.selectWithdrawMethod  = selectWithdrawMethod;
    window.previewScreenshot     = previewScreenshot;
    window.handleRecharge        = handleRecharge;
    window.handleWithdraw        = handleWithdraw;
    window.openKycOverlay        = openKycOverlay;
    window.closeKycOverlay       = closeKycOverlay;
    window.kycNextStep           = kycNextStep;
    window.kycBackStep           = kycBackStep;
    window.previewKyc            = previewKyc;
    window.submitKycForm         = submitKycForm;
    window.toggleEditMode        = toggleEditMode;
    window.savePersonalInfo      = savePersonalInfo;
    window.copyText              = copyText;
    window.togglePwd             = togglePwd;
  }

  window.RFTWallet = {
    loadWalletPage, loadRechargePage, loadWithdrawPage, loadEarningsPage,
    loadProfilePage, handleRecharge, handleWithdraw, copyText, init
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
