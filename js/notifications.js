/* ============================================================
   RFT Entertainment — Notifications Module
   Real-time polling: badge, toast pop-ups, nav dot, balance sync
   ============================================================ */
(function () {
  'use strict';

  // ── Poller state ────────────────────────────────────────────────────────────
  const POLL_INTERVAL_ACTIVE  = 15000;   // 15s when app is in foreground
  const POLL_INTERVAL_HIDDEN  = 60000;   // 60s when tab is hidden
  const MAX_TOAST_QUEUE       = 3;       // max simultaneous toasts

  let _pollTimer    = null;
  let _lastSeen     = new Date().toISOString();  // ISO timestamp of last received notification
  let _isPolling    = false;
  let _toastQueue   = [];
  let _currentUnread = 0;

  // ── Start / Stop poller ─────────────────────────────────────────────────────
  function startPolling() {
    if (_pollTimer) return;          // already running
    if (!window.RFTApi?.getAccessToken()) return;  // not logged in
    _poll();                         // immediate first call
    _scheduleNext();
  }

  function stopPolling() {
    clearTimeout(_pollTimer);
    _pollTimer = null;
  }

  function _scheduleNext() {
    clearTimeout(_pollTimer);
    const interval = document.hidden ? POLL_INTERVAL_HIDDEN : POLL_INTERVAL_ACTIVE;
    _pollTimer = setTimeout(() => {
      _poll();
      _scheduleNext();
    }, interval);
  }

  async function _poll() {
    if (_isPolling) return;
    if (!window.RFTApi?.getAccessToken()) { stopPolling(); return; }
    _isPolling = true;
    try {
      const r = await window.RFTApi.get(`/notifications/poll?since=${encodeURIComponent(_lastSeen)}`);
      if (!r?.success) return;

      // Update server time cursor — next poll will only fetch newer items
      if (r.server_time) _lastSeen = r.server_time;

      // Update unread badge
      updateBadge(r.unread_count);

      // Show toast pop-ups for each new notification
      if (r.new_notifications?.length) {
        r.new_notifications.forEach(n => showNotifToast(n));
        // If notifications page is open, refresh it live
        const notifPage = document.getElementById('notificationsPage');
        if (notifPage?.classList.contains('show')) {
          loadNotifications();
        }
      }

      // Sync balance silently in background
      if (r.balance) syncBalance(r.balance);

    } catch (_) {
      // Network error — silent, try again next interval
    } finally {
      _isPolling = false;
    }
  }

  // ── Balance sync ────────────────────────────────────────────────────────────
  function syncBalance(balance) {
    // Update home balance bar
    const balEl  = document.getElementById('hbbBalance');
    const vipEl  = document.getElementById('hbbVip');
    if (balEl) balEl.textContent = 'Rs. ' + Math.round(parseFloat(balance.usdt || 0) * 280).toLocaleString('en-PK');
    if (vipEl) vipEl.textContent = 'VIP ' + balance.vip_level;

    // Update wallet page if open
    const walletBalUsdt = document.getElementById('walletBalUsdt');
    const walletBalPkr  = document.getElementById('walletBalPkr');
    const walletPoints  = document.getElementById('walletPoints');
    if (walletBalUsdt) walletBalUsdt.textContent = balance.usdt;
    if (walletBalPkr)  walletBalPkr.textContent  = 'Rs. ' + Number(balance.pkr).toLocaleString();
    if (walletPoints)  walletPoints.textContent   = balance.points;

    // Update withdraw available balance
    const wdBal = document.getElementById('withdrawAvailBal');
    if (wdBal) wdBal.textContent = 'Rs. ' + Math.round(parseFloat(balance.usdt || 0) * 280).toLocaleString('en-PK') + ' (' + balance.usdt + ' USDT)';

    // Update profile stats
    const profBal = document.getElementById('profBalance');
    const profPts = document.getElementById('profPoints');
    if (profBal) profBal.textContent = 'Rs. ' + Math.round(parseFloat(balance.usdt || 0) * 280).toLocaleString('en-PK');
    if (profPts) profPts.textContent = balance.points;

    // Update stored user object
    const user = window.RFTCore?.getCurrentUser?.();
    if (user) {
      window.RFTCore?.setCurrentUser({
        ...user,
        balance_usdt: balance.usdt,
        points:       balance.points,
        vip_level:    balance.vip_level
      });
    }
  }

  // ── Toast notification pop-up ───────────────────────────────────────────────
  function showNotifToast(notif) {
    // Don't show if user is already on notifications page
    const notifPage = document.getElementById('notificationsPage');
    if (notifPage?.classList.contains('show')) return;

    // Limit simultaneous toasts
    if (_toastQueue.length >= MAX_TOAST_QUEUE) return;

    const container = _getOrCreateToastContainer();
    const el        = document.createElement('div');
    el.className    = `rt-toast rt-toast-${notif.type || 'info'}`;
    el.setAttribute('role', 'alert');

    const icons = { success: 'ph-check-circle', error: 'ph-x-circle', warning: 'ph-warning', info: 'ph-bell' };
    const icon  = icons[notif.type] || 'ph-bell';

    el.innerHTML = `
      <div class="rt-toast-icon"><i class="ph-bold ${icon}"></i></div>
      <div class="rt-toast-body">
        <div class="rt-toast-title">${escHtml(notif.title)}</div>
        <div class="rt-toast-msg">${escHtml(notif.message)}</div>
      </div>
      <button class="rt-toast-close" aria-label="Dismiss">✕</button>
    `;

    // Click anywhere on toast → navigate to notifications
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.rt-toast-close')) {
        window.RFTApp?.navigate('notificationsPage');
        _dismissToast(el);
      }
    });

    // Close button
    el.querySelector('.rt-toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      _dismissToast(el);
    });

    container.prepend(el);
    _toastQueue.push(el);

    // Animate in
    requestAnimationFrame(() => el.classList.add('rt-toast-show'));

    // Auto dismiss after 5s
    setTimeout(() => _dismissToast(el), 5000);
  }

  function _dismissToast(el) {
    el.classList.remove('rt-toast-show');
    el.classList.add('rt-toast-hide');
    setTimeout(() => {
      el.remove();
      _toastQueue = _toastQueue.filter(t => t !== el);
    }, 300);
  }

  function _getOrCreateToastContainer() {
    let c = document.getElementById('rtToastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'rtToastContainer';
      c.className = 'rt-toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  // ── Badge + nav dot ─────────────────────────────────────────────────────────
  function updateBadge(count) {
    _currentUnread = count;

    // Feature grid badge (home page)
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent    = count > 99 ? '99+' : count;
      badge.style.display  = count > 0 ? 'inline-block' : 'none';
    }

    // Bottom nav dot
    _updateNavDot(count > 0);

    // Page title badge (browser tab)
    if (count > 0) {
      document.title = `(${count}) RFT Entertainment`;
    } else {
      document.title = 'RFT Entertainment — Earn PKR by Watching Videos';
    }
  }

  function _updateNavDot(show) {
    // Find the Profile nav item and add/remove a dot
    let dot = document.getElementById('navNotifDot');
    if (!dot) {
      const profileNav = document.querySelector('.nav-item[data-page="mypagePage"]');
      if (!profileNav) return;
      dot = document.createElement('span');
      dot.id        = 'navNotifDot';
      dot.className = 'nav-notif-dot';
      profileNav.style.position = 'relative';
      profileNav.appendChild(dot);
    }
    dot.style.display = show ? 'block' : 'none';
  }

  // ── Page visibility — pause polling when tab is hidden ─────────────────────
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Tab became visible — poll immediately then resume normal schedule
      clearTimeout(_pollTimer);
      _poll();
      _scheduleNext();
    }
  });

  // ── Notifications page loader ───────────────────────────────────────────────
  async function loadNotifications() {
    const list = document.getElementById('notifList');
    if (!list) return;
    if (!list.hasChildNodes() || list.querySelector('.tx-loading')) {
      list.innerHTML = '<div class="tx-loading">Loading…</div>';
    }
    try {
      const r = await window.RFTApi.get('/notifications?limit=50');
      if (!r?.success) { list.innerHTML = '<div class="tx-loading">Failed to load</div>'; return; }
      updateBadge(r.data.unread_count);
      if (!r.data.notifications.length) {
        list.innerHTML = '<div class="team-empty"><i class="ph-bold ph-bell-slash"></i><p>No notifications yet</p></div>';
        return;
      }
      list.innerHTML = r.data.notifications.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'notif-unread'}" onclick="markOneRead('${n.id}', this)">
          <div class="notif-icon notif-${n.type || 'info'}">
            <i class="ph-bold ${iconForType(n.type)}"></i>
          </div>
          <div class="notif-body">
            <div class="notif-title">${escHtml(n.title)}</div>
            <div class="notif-msg">${escHtml(n.message)}</div>
            <div class="notif-time">${fmtTime(n.created_at)}</div>
          </div>
          ${!n.is_read ? '<div class="notif-dot"></div>' : ''}
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = '<div class="tx-loading">Error loading notifications</div>';
    }
  }

  // ── Announcements ────────────────────────────────────────────────────────────
  async function loadAnnouncements() {
    const list = document.getElementById('newsList');
    if (!list) return;
    list.innerHTML = '<div class="tx-loading">Loading…</div>';
    try {
      const r = await window.RFTApi.get('/notifications/announcements');
      if (!r?.success || !r.data.length) {
        list.innerHTML = '<div class="team-empty"><i class="ph-bold ph-newspaper"></i><p>No announcements</p></div>';
        return;
      }
      list.innerHTML = r.data.map(a => `
        <div class="news-item">
          <div class="news-icon news-${a.type || 'info'}"><i class="ph-bold ${iconForType(a.type)}"></i></div>
          <div class="news-body">
            <div class="news-title">${escHtml(a.title)}</div>
            <div class="news-content">${escHtml(a.content)}</div>
            <div class="news-time">${fmtTime(a.created_at)}</div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = '<div class="tx-loading">Error</div>';
    }
  }

  async function loadAnnouncementTicker() {
    try {
      const r = await window.RFTApi.get('/notifications/announcements');
      if (r?.success && r.data.length) {
        const el = document.getElementById('announcementText');
        if (el) el.textContent = r.data[0].title + ' — ' + r.data[0].content;
      }
    } catch (_) {}
  }

  // ── Mark read ─────────────────────────────────────────────────────────────
  async function markAllRead() {
    try {
      await window.RFTApi.post('/notifications/read-all', {});
      updateBadge(0);
      loadNotifications();
    } catch (_) {}
  }

  async function markOneRead(id, el) {
    try {
      await window.RFTApi.post(`/notifications/${id}/read`, {});
      el.classList.remove('notif-unread');
      const dot = el.querySelector('.notif-dot');
      if (dot) dot.remove();
      // Decrement badge
      updateBadge(Math.max(0, _currentUnread - 1));
    } catch (_) {}
  }

  // ── Utils ─────────────────────────────────────────────────────────────────
  function iconForType(type) {
    return { success: 'ph-check-circle', error: 'ph-x-circle', warning: 'ph-warning', info: 'ph-bell' }[type] || 'ph-bell';
  }

  function fmtTime(d) {
    if (!d) return '';
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    // Page events
    document.addEventListener('rft:page:notificationsPage', loadNotifications);
    document.addEventListener('rft:page:newsCenterPage',    loadAnnouncements);

    // Start polling after login (listen for token being set)
    // main.js calls navigate('homePage') after login — that fires rft:page:homePage
    document.addEventListener('rft:page:homePage', () => {
      if (window.RFTApi?.getAccessToken()) startPolling();
    });

    // Stop polling on logout
    document.addEventListener('rft:auth:logout', stopPolling);

    // Expose globals
    window.markAllRead = markAllRead;
    window.markOneRead = markOneRead;
  }

  window.RFTNotifications = {
    startPolling, stopPolling, loadNotifications, loadAnnouncements,
    loadAnnouncementTicker, checkUnread: _poll, updateBadge,
    markAllRead, markOneRead, syncBalance, init
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
