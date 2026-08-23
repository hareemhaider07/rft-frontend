/* ============================================================
   RFT Entertainment — Notifications Module
   ============================================================ */
(function () {
  'use strict';

  async function loadNotifications() {
    const list = document.getElementById('notifList');
    if (!list) return;
    list.innerHTML = '<div class="tx-loading">Loading…</div>';
    try {
      const r = await window.RFTApi.get('/notifications?limit=50');
      if (!r.success) { list.innerHTML = '<div class="tx-loading">Failed to load</div>'; return; }
      updateBadge(r.data.unread_count);
      if (!r.data.notifications.length) {
        list.innerHTML = '<div class="team-empty"><i class="ph-bold ph-bell-slash"></i><p>No notifications yet</p></div>';
        return;
      }
      list.innerHTML = r.data.notifications.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'notif-unread'}" onclick="markOneRead('${n.id}', this)">
          <div class="notif-icon notif-${n.type||'info'}">
            <i class="ph-bold ${iconForType(n.type)}"></i>
          </div>
          <div class="notif-body">
            <div class="notif-title">${n.title}</div>
            <div class="notif-msg">${n.message}</div>
            <div class="notif-time">${fmtTime(n.created_at)}</div>
          </div>
          ${!n.is_read ? '<div class="notif-dot"></div>' : ''}
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = '<div class="tx-loading">Error loading notifications</div>';
    }
  }

  async function loadAnnouncements() {
    const list = document.getElementById('newsList');
    if (!list) return;
    list.innerHTML = '<div class="tx-loading">Loading…</div>';
    try {
      const r = await window.RFTApi.get('/notifications/announcements');
      if (!r.success || !r.data.length) {
        list.innerHTML = '<div class="team-empty"><i class="ph-bold ph-newspaper"></i><p>No announcements</p></div>';
        return;
      }
      list.innerHTML = r.data.map(a => `
        <div class="news-item">
          <div class="news-icon news-${a.type||'info'}"><i class="ph-bold ${iconForType(a.type)}"></i></div>
          <div class="news-body">
            <div class="news-title">${a.title}</div>
            <div class="news-content">${a.content}</div>
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
      if (r.success && r.data.length) {
        const el = document.getElementById('announcementText');
        if (el) el.textContent = r.data[0].title + ' — ' + r.data[0].content;
      }
    } catch (_) {}
  }

  async function checkUnread() {
    try {
      const r = await window.RFTApi.get('/notifications?limit=1');
      if (r.success) updateBadge(r.data.unread_count);
    } catch (_) {}
  }

  function updateBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

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
    } catch (_) {}
  }

  function iconForType(type) {
    const map = { success: 'ph-check-circle', error: 'ph-x-circle', warning: 'ph-warning', info: 'ph-info' };
    return map[type] || 'ph-bell';
  }

  function fmtTime(d) {
    if (!d) return '';
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
  }

  function init() {
    document.addEventListener('rft:page:notificationsPage', loadNotifications);
    document.addEventListener('rft:page:newsCenterPage', loadAnnouncements);
    window.markAllRead = markAllRead;
    window.markOneRead = markOneRead;
  }

  window.RFTNotifications = { loadNotifications, loadAnnouncements, loadAnnouncementTicker, checkUnread, updateBadge, markAllRead, markOneRead, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
