/* ============================================================
   RFT Entertainment — Features Module
   Handles: login popup, banner carousel, pull-to-refresh,
   transaction detail, VIP celebration, my tasks, saved methods,
   referral QR, team stats, frozen balance
   ============================================================ */
(function () {
  'use strict';

  const PKR = (usdt) => 'Rs. ' + Math.round(parseFloat(usdt || 0) * 280).toLocaleString('en-PK');

  // ═══════════════════════════════════════════════════════════
  // 1. LOGIN NOTICE POPUP
  // ═══════════════════════════════════════════════════════════

  async function checkLoginPopup() {
    try {
      const r = await window.RFTApi?.get('/notifications/login-popup');
      if (!r?.success || !r.data) return;
      const popup = r.data;
      // Show once per session per popup ID
      const shownKey = 'rft_popup_shown_' + popup.id;
      if (sessionStorage.getItem(shownKey)) return;
      sessionStorage.setItem(shownKey, '1');
      showLoginPopup(popup);
    } catch (_) {}
  }

  function showLoginPopup(popup) {
    const overlay = document.getElementById('loginPopupOverlay');
    const title   = document.getElementById('lpTitle');
    const content = document.getElementById('lpContent');
    const btn     = document.getElementById('lpBtn');
    const imgWrap = document.getElementById('lpImgWrap');
    const img     = document.getElementById('lpImg');
    if (!overlay) return;
    if (title)   title.textContent   = popup.title;
    if (content) content.textContent = popup.content;
    if (btn)     btn.textContent     = popup.button_text || 'Got it';
    if (popup.image_url && imgWrap && img) {
      img.src = popup.image_url;
      imgWrap.style.display = 'block';
    }
    if (btn && popup.button_url) {
      btn.onclick = () => { window.open(popup.button_url, '_blank'); closeLoginPopup(); };
    } else if (btn) {
      btn.onclick = closeLoginPopup;
    }
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function closeLoginPopup() {
    const overlay = document.getElementById('loginPopupOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
  }

  // ═══════════════════════════════════════════════════════════
  // 2. BANNER CAROUSEL
  // ═══════════════════════════════════════════════════════════

  let _carouselIdx  = 0;
  let _carouselTimer = null;
  const SLIDE_COUNT = 4;

  function initCarousel() {
    const track = document.getElementById('hbcTrack');
    const dots  = document.querySelectorAll('.hbc-dot');
    if (!track) return;

    // Touch/swipe support
    let touchStartX = 0;
    track.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    track.addEventListener('touchend',   e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) goSlide(diff > 0 ? _carouselIdx + 1 : _carouselIdx - 1);
    });

    // Dot clicks
    dots.forEach((dot, i) => dot.addEventListener('click', () => goSlide(i)));

    // Auto-advance every 3.5s
    _carouselTimer = setInterval(() => goSlide(_carouselIdx + 1), 3500);
  }

  function goSlide(idx) {
    _carouselIdx = ((idx % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
    const track = document.getElementById('hbcTrack');
    const dots  = document.querySelectorAll('.hbc-dot');
    if (track) track.style.transform = `translateX(-${_carouselIdx * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === _carouselIdx));
  }

  function stopCarousel() {
    if (_carouselTimer) { clearInterval(_carouselTimer); _carouselTimer = null; }
  }

  // ═══════════════════════════════════════════════════════════
  // 3. PULL-TO-REFRESH
  // ═══════════════════════════════════════════════════════════

  function initPullToRefresh(pageId, refreshFn) {
    const page = document.getElementById(pageId);
    if (!page) return;
    let startY = 0, pulling = false;
    const indicator = document.getElementById('pullRefreshIndicator');

    page.addEventListener('touchstart', e => {
      if (page.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });

    page.addEventListener('touchmove', e => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 60 && indicator) {
        indicator.classList.add('ptr-visible');
        indicator.innerHTML = '<i class="ph-bold ph-arrows-clockwise ptr-spinning"></i> Release to refresh';
      }
    }, { passive: true });

    page.addEventListener('touchend', e => {
      if (!pulling) return;
      pulling = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 60 && indicator) {
        indicator.classList.remove('ptr-visible');
        indicator.innerHTML = '<i class="ph-bold ph-arrows-clockwise"></i> Pull to refresh';
        refreshFn();
        window.RFTCore?.showToast('Refreshed', 'success');
      } else if (indicator) {
        indicator.classList.remove('ptr-visible');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 4. TRANSACTION DETAIL VIEW
  // ═══════════════════════════════════════════════════════════

  function showTxDetail(tx) {
    const modal  = document.getElementById('txDetailModal');
    const title  = document.getElementById('txdTitle');
    const icon   = document.getElementById('txdIcon');
    const amount = document.getElementById('txdAmount');
    const status = document.getElementById('txdStatus');
    const rows   = document.getElementById('txdRows');
    if (!modal) return;

    const isCredit = ['recharge','task_reward','referral_commission','referral_bonus','spin_reward','manual_adjustment'].includes(tx.type);
    const labels   = { recharge:'Deposit', withdrawal:'Withdrawal', task_reward:'Task Reward', referral_commission:'Referral Commission', referral_bonus:'Referral Bonus', spin_reward:'Lucky Draw Win', manual_adjustment:'Balance Adjustment' };
    const icons    = { recharge:'ph-arrow-down-left', withdrawal:'ph-arrow-up-right', task_reward:'ph-play-circle', referral_commission:'ph-users-three', referral_bonus:'ph-gift', spin_reward:'ph-shooting-star', manual_adjustment:'ph-pencil' };
    const statusColors = { completed:'#22c55e', pending:'#f97316', failed:'#ef4444' };

    if (title)  title.textContent  = labels[tx.type] || tx.type;
    if (icon)   icon.innerHTML     = `<i class="ph-bold ${icons[tx.type]||'ph-arrow-right'}"></i>`;
    if (icon)   icon.style.background = isCredit ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)';
    if (icon)   icon.style.color      = isCredit ? '#22c55e' : '#ef4444';

    const pkr = tx.amount_pkr ? Number(tx.amount_pkr).toLocaleString('en-PK') : Math.round(parseFloat(tx.amount_usdt||0)*280).toLocaleString('en-PK');
    if (amount) {
      amount.textContent = `${isCredit?'+':'-'}Rs. ${pkr}`;
      amount.style.color = isCredit ? '#22c55e' : '#ef4444';
    }
    if (status) {
      status.textContent  = tx.status;
      status.style.color  = statusColors[tx.status] || '#888';
    }

    const detailRows = [
      { label: 'Type',             val: labels[tx.type] || tx.type },
      { label: 'Amount',           val: `Rs. ${pkr}` },
      { label: 'Payment Method',   val: tx.payment_method || '—' },
      { label: 'Reference',        val: tx.payment_reference || '—' },
      { label: 'Status',           val: tx.status },
      { label: 'Notes',            val: tx.notes || '—' },
      { label: 'Admin Note',       val: tx.admin_note || '—' },
      { label: 'Date',             val: tx.created_at ? new Date(tx.created_at).toLocaleString('en-PK') : '—' }
    ].filter(r => r.val && r.val !== '—');

    if (rows) rows.innerHTML = detailRows.map(r => `
      <div class="txd-row">
        <span class="txd-label">${r.label}</span>
        <span class="txd-val">${r.val}</span>
      </div>`).join('');

    modal.classList.add('show');
  }

  function closeTxDetail() {
    document.getElementById('txDetailModal')?.classList.remove('show');
  }

  // ═══════════════════════════════════════════════════════════
  // 5. VIP UPGRADE CELEBRATION
  // ═══════════════════════════════════════════════════════════

  const VIP_NAMES  = ['Starter','Bronze','Silver','Gold','Platinum','Diamond'];
  const VIP_COLORS = ['#888','#CD7F32','#C0C0C0','#FFD700','#E5E4E2','#B9F2FF'];

  function triggerVipCelebration(newLevel) {
    const overlay = document.getElementById('vipUpgradeOverlay');
    const badge   = document.getElementById('vucBadge');
    const level   = document.getElementById('vucLevel');
    if (!overlay) return;

    const name  = VIP_NAMES[newLevel]  || `VIP ${newLevel}`;
    const color = VIP_COLORS[newLevel] || '#d4a843';

    if (badge) { badge.style.background = color + '22'; badge.style.color = color; }
    if (level) { level.textContent = name; level.style.color = color; }

    // Launch fireworks
    launchFireworks(document.getElementById('vucFireworks'));

    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Auto-close after 6s
    setTimeout(closeVipCelebration, 6000);
  }

  function closeVipCelebration() {
    const overlay = document.getElementById('vipUpgradeOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => { overlay.style.display = 'none'; }, 400);
  }

  function launchFireworks(container) {
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#d4a843','#22c55e','#3b82f6','#ef4444','#a855f7','#f97316'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'fw-particle';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const angle = Math.random() * 360;
      const dist  = 80 + Math.random() * 120;
      p.style.cssText = `
        position:absolute; width:6px; height:6px; border-radius:50%;
        background:${color}; top:50%; left:50%;
        animation: fw ${0.6 + Math.random() * 0.8}s ease-out forwards;
        --tx: ${Math.cos(angle * Math.PI/180) * dist}px;
        --ty: ${Math.sin(angle * Math.PI/180) * dist}px;
      `;
      container.appendChild(p);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 6. MY TASKS PAGE
  // ═══════════════════════════════════════════════════════════

  let _myTasksPage = 1;

  async function loadMyTasksPage() {
    await loadMyTasksStats();
    await loadMyTasksList(1);
  }

  async function loadMyTasksStats() {
    try {
      const r = await window.RFTApi?.get('/user/stats');
      if (!r?.success) return;
      const s   = r.data;
      const el  = document.getElementById('myTasksStats');
      if (!el) return;
      el.innerHTML = `
        <div class="earn-stat-grid" style="padding:0 16px 16px">
          <div class="earn-stat"><div class="esv">${s.total_tasks_completed}</div><div class="esl">Total Completed</div></div>
          <div class="earn-stat"><div class="esv">${s.tasks_today}</div><div class="esl">Today</div></div>
          <div class="earn-stat"><div class="esv">${PKR(s.total_earned_usdt)}</div><div class="esl">Total Earned</div></div>
          <div class="earn-stat"><div class="esv">${PKR(s.today_earned_usdt)}</div><div class="esl">Today's Earnings</div></div>
        </div>`;
    } catch (_) {}
  }

  async function loadMyTasksList(page = 1) {
    _myTasksPage = page;
    const el = document.getElementById('myTasksList');
    if (!el) return;
    if (page === 1) el.innerHTML = '<div class="tx-loading">Loading…</div>';

    try {
      const r = await window.RFTApi?.get(`/user/my-tasks?page=${page}&limit=20`);
      if (!r?.success) { el.innerHTML = '<div class="tx-loading">No tasks found</div>'; return; }
      const tasks = r.data.tasks;
      if (!tasks.length && page === 1) {
        el.innerHTML = '<div class="team-empty"><i class="ph-bold ph-play-circle"></i><p>No completed tasks yet</p><small>Complete your first task to see it here</small></div>';
        return;
      }
      const typeIcons  = { youtube:'ph-youtube-logo', tiktok:'ph-tiktok-logo', instagram:'ph-instagram-logo', facebook:'ph-facebook-logo', other:'ph-play-circle' };
      const typeColors = { youtube:'#FF0000', tiktok:'#ff0050', instagram:'#E1306C', facebook:'#1877F2', other:'#d4a843' };
      const html = tasks.map(t => `
        <div class="my-task-row">
          <div class="mtr-thumb">
            <img src="${t.thumbnail_url||`https://placehold.co/50x50/1a1a1a/${(typeColors[t.task_type]||'d4a843').slice(1)}?text=${t.task_type.charAt(0).toUpperCase()}`}" loading="lazy">
            <i class="ph-bold ${typeIcons[t.task_type]||'ph-play-circle'} mtr-type-icon" style="color:${typeColors[t.task_type]||'#d4a843'}"></i>
          </div>
          <div class="mtr-info">
            <div class="mtr-title">${t.title}</div>
            <div class="mtr-date">${fmtDate(t.completed_at || t.task_date)}</div>
          </div>
          <div class="mtr-reward">+Rs. ${t.reward_pkr.toLocaleString('en-PK')}</div>
        </div>`).join('');
      if (page === 1) el.innerHTML = html;
      else el.insertAdjacentHTML('beforeend', html);

      // Load more button
      const pag = r.data.pagination;
      const existingBtn = document.getElementById('myTasksLoadMore');
      if (existingBtn) existingBtn.remove();
      if (pag.page < pag.total_pages) {
        const btn = document.createElement('button');
        btn.id = 'myTasksLoadMore';
        btn.className = 'btn-secondary';
        btn.style.cssText = 'margin:12px 16px;width:calc(100% - 32px)';
        btn.textContent = `Load More (${pag.total - page * 20} remaining)`;
        btn.onclick = () => loadMyTasksList(page + 1);
        el.after(btn);
      }
    } catch (_) {
      el.innerHTML = '<div class="tx-loading">Error loading tasks</div>';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 7. SAVED PAYOUT METHODS
  // ═══════════════════════════════════════════════════════════

  async function loadSavedMethodsPage() {
    const el = document.getElementById('savedMethodsList');
    if (!el) return;
    el.innerHTML = '<div class="tx-loading">Loading…</div>';
    try {
      const r = await window.RFTApi?.get('/saved-methods');
      if (!r?.success || !r.data.length) {
        el.innerHTML = '<div class="team-empty"><i class="ph-bold ph-credit-card"></i><p>No saved accounts</p><small>Add an account for quick withdrawals</small></div>';
        return;
      }
      el.innerHTML = r.data.map(m => `
        <div class="saved-method-row ${m.is_default ? 'smr-default' : ''}">
          <div class="smr-icon">${methodIcon(m.method_name)}</div>
          <div class="smr-info">
            <div class="smr-name">${m.account_name}</div>
            <div class="smr-num">${m.account_number} · ${m.method_name}</div>
            ${m.is_default ? '<span class="smr-badge">Default</span>' : ''}
          </div>
          <div class="smr-actions">
            ${!m.is_default ? `<button class="smr-btn" onclick="setDefaultMethod('${m.id}')">Set Default</button>` : ''}
            <button class="smr-btn smr-del" onclick="deleteMethod('${m.id}')"><i class="ph-bold ph-trash"></i></button>
          </div>
        </div>`).join('');
    } catch (_) {
      el.innerHTML = '<div class="tx-loading">Error loading methods</div>';
    }
  }

  async function loadWithdrawSavedMethods() {
    try {
      const r = await window.RFTApi?.get('/saved-methods');
      const shortcut = document.getElementById('savedMethodsShortcut');
      const list     = document.getElementById('savedMethodsShortcutList');
      if (!r?.success || !r.data.length || !shortcut || !list) return;
      shortcut.style.display = 'block';
      list.innerHTML = r.data.slice(0, 3).map(m => `
        <div class="sms-item" onclick="applySavedMethod('${m.id}','${m.method_name}','${m.account_name}','${m.account_number}')">
          <span class="sms-icon">${methodIcon(m.method_name)}</span>
          <div class="sms-info">
            <span class="sms-name">${m.account_name}</span>
            <span class="sms-num">${m.account_number}</span>
          </div>
          ${m.is_default ? '<span class="sms-tag">Default</span>' : ''}
        </div>`).join('');
    } catch (_) {}
  }

  function methodIcon(name) {
    const map = { jazzcash:'📱', easypaisa:'💰', sadapay:'💳', nayapay:'🏦', raast:'⚡', bank:'🏛️' };
    return map[name?.toLowerCase()] || '💳';
  }

  function applySavedMethod(id, methodName, accName, accNum) {
    // Auto-fill withdraw form
    const method = document.querySelector(`#withdrawMethods .pm-btn[data-id]`);
    document.getElementById('wdAccName').value = accName;
    document.getElementById('wdAccNum').value  = accNum;
    // Try to select the matching payment method button
    document.querySelectorAll('#withdrawMethods .pm-btn').forEach(btn => {
      if (btn.querySelector('.pm-name')?.textContent.toLowerCase().includes(methodName)) {
        btn.click();
      }
    });
    window.RFTCore?.showToast(`${accName} selected`, 'success');
  }

  function openAddSavedMethod() {
    document.getElementById('addMethodForm').style.display = 'block';
  }

  async function saveNewMethod() {
    const name   = document.getElementById('smMethodName').value;
    const accName= document.getElementById('smAccName').value.trim();
    const accNum = document.getElementById('smAccNum').value.trim();
    const isDef  = document.getElementById('smIsDefault').checked;
    if (!accName || !accNum) { window.RFTCore?.showToast('Fill all fields', 'error'); return; }
    try {
      const r = await window.RFTApi?.post('/saved-methods', { method_name: name, account_name: accName, account_number: accNum, is_default: isDef });
      if (r?.success) {
        window.RFTCore?.showToast('Account saved!', 'success');
        document.getElementById('addMethodForm').style.display = 'none';
        document.getElementById('smAccName').value = '';
        document.getElementById('smAccNum').value  = '';
        loadSavedMethodsPage();
      } else window.RFTCore?.showToast(r?.message || 'Failed', 'error');
    } catch (_) { window.RFTCore?.showToast('Error saving', 'error'); }
  }

  async function setDefaultMethod(id) {
    const r = await window.RFTApi?.put(`/saved-methods/${id}/default`, {});
    if (r?.success) { window.RFTCore?.showToast('Default updated', 'success'); loadSavedMethodsPage(); }
  }

  async function deleteMethod(id) {
    const r = await window.RFTApi?.del(`/saved-methods/${id}`);
    if (r?.success) { window.RFTCore?.showToast('Removed', 'success'); loadSavedMethodsPage(); }
  }

  // ═══════════════════════════════════════════════════════════
  // 8. REFERRAL QR CODE
  // ═══════════════════════════════════════════════════════════

  function renderReferralQR(url) {
    const canvas = document.getElementById('referralQrCanvas');
    const section= document.getElementById('referralQrSection');
    if (!canvas || !section) return;
    section.style.display = 'block';
    // Use Google Charts QR API (no npm package needed)
    const size = 180;
    const qrUrl = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(url)}&choe=UTF-8&chld=M|2`;
    canvas.innerHTML = `
      <img src="${qrUrl}" width="${size}" height="${size}" alt="Referral QR Code" style="border-radius:12px;background:#fff;padding:8px">
    `;
  }

  function downloadReferralQR() {
    const img = document.querySelector('#referralQrCanvas img');
    if (!img) return;
    const a = document.createElement('a');
    a.href     = img.src;
    a.download = 'rft-referral-qr.png';
    a.click();
    window.RFTCore?.showToast('QR code saved!', 'success');
  }

  // ═══════════════════════════════════════════════════════════
  // 9. TEAM PERFORMANCE STATS
  // ═══════════════════════════════════════════════════════════

  async function loadTeamStats() {
    try {
      const r = await window.RFTApi?.get('/user/team-stats');
      if (!r?.success) return;
      const s   = r.data;
      const card= document.getElementById('teamPerfCard');
      const grid= document.getElementById('tpcGrid');
      if (!card || !grid) return;
      card.style.display = 'block';
      grid.innerHTML = `
        <div class="tpc-stat"><div class="tpc-val">${s.total_count}</div><div class="tpc-label">Total Members</div></div>
        <div class="tpc-stat"><div class="tpc-val" style="color:#22c55e">${s.active_7d}</div><div class="tpc-label">Active (7d)</div></div>
        <div class="tpc-stat"><div class="tpc-val">${s.level1_count}</div><div class="tpc-label">Level 1</div></div>
        <div class="tpc-stat"><div class="tpc-val">${s.level2_count}</div><div class="tpc-label">Level 2</div></div>
        <div class="tpc-stat"><div class="tpc-val">${s.level3_count}</div><div class="tpc-label">Level 3</div></div>
        <div class="tpc-stat"><div class="tpc-val" style="color:var(--gold)">Rs. ${s.total_commission_pkr.toLocaleString('en-PK')}</div><div class="tpc-label">Total Earned</div></div>
      `;
    } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════
  // 10. FROZEN BALANCE IN WALLET
  // ═══════════════════════════════════════════════════════════

  function updateFrozenBalance(frozenUsdt) {
    const el = document.getElementById('walletFrozen');
    if (!el) return;
    const pkr = Math.round(parseFloat(frozenUsdt || 0) * 280);
    el.textContent = pkr > 0 ? `Rs. ${pkr.toLocaleString('en-PK')}` : 'Rs. 0';
    el.style.color = pkr > 0 ? '#f97316' : '#666';
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' });
  }

  // ═══════════════════════════════════════════════════════════
  // INIT — Wire all page events
  // ═══════════════════════════════════════════════════════════

  function init() {
    // Login popup after home page loads
    document.addEventListener('rft:page:homePage', () => {
      initCarousel();
      checkLoginPopup();
      // Check VIP upgrade
      _checkVipUpgrade();
    });

    // Stop carousel when leaving home
    ['tasksPage','walletPage','luckyPage','referralPage','earningsPage','mypagePage','leaderboardPage'].forEach(p => {
      document.addEventListener(`rft:page:${p}`, stopCarousel);
    });

    // Pull-to-refresh on tasks
    document.addEventListener('rft:page:tasksPage', () => {
      initPullToRefresh('tasksPage', () => {
        window.RFTTaskEngine?.renderTaskHall('pageTaskList','pageTaskDone','pageTaskLeft');
      });
    });

    // My tasks
    document.addEventListener('rft:page:myTasksPage', loadMyTasksPage);

    // Saved methods page
    document.addEventListener('rft:page:savedMethodsPage', loadSavedMethodsPage);

    // Withdraw page — load saved methods
    document.addEventListener('rft:page:withdrawPage', loadWithdrawSavedMethods);

    // Referral page — render QR + team stats
    document.addEventListener('rft:page:referralPage', async () => {
      // Wait for referral info to load first
      setTimeout(async () => {
        try {
          const r = await window.RFTApi?.get('/referral/info');
          if (r?.success && r.data.referral_link) {
            renderReferralQR(r.data.referral_link);
          }
        } catch (_) {}
        loadTeamStats();
      }, 500);
    });

    // Wallet page — update frozen balance
    document.addEventListener('rft:page:walletPage', async () => {
      try {
        const r = await window.RFTApi?.get('/wallet/balance');
        if (r?.success) updateFrozenBalance(r.data.frozen_usdt);
      } catch (_) {}
    });

    // Expose globals
    window.closeLoginPopup     = closeLoginPopup;
    window.closeTxDetail       = closeTxDetail;
    window.showTxDetail        = showTxDetail;
    window.closeVipCelebration = closeVipCelebration;
    window.triggerVipCelebration = triggerVipCelebration;
    window.downloadReferralQR  = downloadReferralQR;
    window.openAddSavedMethod  = openAddSavedMethod;
    window.saveNewMethod       = saveNewMethod;
    window.setDefaultMethod    = setDefaultMethod;
    window.deleteMethod        = deleteMethod;
    window.applySavedMethod    = applySavedMethod;
  }

  // Check if user just got VIP upgrade since last login
  async function _checkVipUpgrade() {
    try {
      const user = window.RFTCore?.getCurrentUser?.();
      if (!user) return;
      const key     = 'rft_last_known_vip';
      const lastVip = parseInt(localStorage.getItem(key) || '0');
      const curVip  = user.vip_level || 0;
      if (curVip > lastVip && lastVip >= 0) {
        triggerVipCelebration(curVip);
      }
      localStorage.setItem(key, curVip);
    } catch (_) {}
  }

  window.RFTFeatures = {
    checkLoginPopup, closeLoginPopup, showTxDetail, closeTxDetail,
    triggerVipCelebration, closeVipCelebration, loadMyTasksPage,
    loadSavedMethodsPage, renderReferralQR, loadTeamStats,
    updateFrozenBalance, goSlide, init
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
