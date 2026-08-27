/* ============================================================
   RFT Entertainment — Task Engine
   ============================================================ */
(function () {
  'use strict';

  const TASK_CONFIG = { dailyLimit: 10, rewardPerTask: 0.1, pkrRate: 280 };
  let _tasks = [];
  let _stats = { completed_today: 0, remaining_today: 10, daily_limit: 10 };
  let _activeTaskId = null;
  let _taskTimer = null;

  const pkr = (usdt) => 'Rs. ' + Math.round(parseFloat(usdt) * TASK_CONFIG.pkrRate).toLocaleString('en-PK');

  // ── API ────────────────────────────────────────────────────────────────────
  async function fetchTasks() {
    try {
      const r = await window.RFTApi?.get('/tasks');
      if (r?.success) {
        _tasks = r.data.tasks || [];
        _stats = r.data.stats || _stats;
      }
    } catch (e) {
      console.error('fetchTasks error:', e);
    }
  }

  async function startTask(taskId) {
    try {
      const r = await window.RFTApi?.post(`/tasks/${taskId}/start`, {});
      if (r?.success) return r.data;
      window.RFTCore?.showToast(r?.message || 'Cannot start task', 'error');
      return null;
    } catch (e) {
      window.RFTCore?.showToast('Error starting task', 'error');
      return null;
    }
  }

  async function completeTask(taskId, sessionId, watchDuration) {
    try {
      const r = await window.RFTApi?.post(`/tasks/${taskId}/complete`, {
        session_id: sessionId,
        watch_duration_seconds: watchDuration
      });
      if (r?.success) {
        window.RFTCore?.showToast(`+${pkr(r.data.reward_usdt)} earned!`, 'success');
        const user = window.RFTCore?.getCurrentUser();
        if (user) {
          window.RFTCore?.setCurrentUser({ ...user, balance_usdt: r.data.new_balance_usdt, points: r.data.points });
        }
        return r.data;
      }
      window.RFTCore?.showToast(r?.message || 'Task completion failed', 'error');
      return null;
    } catch (e) {
      window.RFTCore?.showToast('Error completing task', 'error');
      return null;
    }
  }

  // ── Task Hall render ───────────────────────────────────────────────────────
  async function renderTaskHall(listElId, doneElId, leftElId) {
    await fetchTasks();
    const doneEl = document.getElementById(doneElId);
    const leftEl = document.getElementById(leftElId);
    if (doneEl) doneEl.textContent = _stats.completed_today;
    if (leftEl) leftEl.textContent = _stats.remaining_today;

    const listEl = document.getElementById(listElId);
    if (!listEl) return;

    if (!_tasks.length) {
      listEl.innerHTML = '<div class="task-empty"><i class="ph-bold ph-play-circle"></i><p>No tasks available</p></div>';
      return;
    }

    const typeIcons  = { youtube:'ph-youtube-logo', tiktok:'ph-tiktok-logo', instagram:'ph-instagram-logo', facebook:'ph-facebook-logo', twitter:'ph-twitter-logo', other:'ph-play-circle' };
    const typeColors = { youtube:'#FF0000', tiktok:'#ff0050', instagram:'#E1306C', facebook:'#1877F2', twitter:'#1DA1F2', other:'#d4a843' };

    listEl.innerHTML = _tasks.map(task => {
      const reward = pkr(task.reward_usdt);
      const icon   = typeIcons[task.task_type]  || 'ph-play-circle';
      const color  = typeColors[task.task_type] || '#d4a843';
      return `
        <div class="rft-engine-task-card ${task.is_completed ? 'task-completed' : ''}" data-task-id="${task.id}">
          <div class="rft-engine-card-main">
            <div class="rft-engine-poster-wrap">
              <img src="${task.thumbnail_url || `https://placehold.co/120x80/1a1a1a/${color.slice(1)}?text=${task.task_type}`}" alt="${task.title}" loading="lazy">
              ${!task.is_completed
                ? `<button class="rft-engine-play" onclick="openTaskPreview('${task.id}')"><i class="ph-bold ph-play"></i></button>`
                : `<div class="rft-engine-done"><i class="ph-bold ph-check-circle"></i></div>`}
            </div>
            <div class="rft-engine-card-body">
              <div class="rft-engine-card-top">
                <strong>${task.title}</strong>
                <div class="rft-engine-meta">
                  <span style="color:${color}"><i class="ph-bold ${icon}"></i> ${task.task_type}</span>
                  <span>${task.duration_seconds}s</span>
                </div>
              </div>
              <div class="rft-engine-bottom">
                <span>Reward:</span>
                <em>${reward}</em>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Video URL → embed URL converter ──────────────────────────────────────
  function getEmbedUrl(videoUrl, taskType) {
    if (!videoUrl || videoUrl === '#') return null;

    try {
      // ── YouTube ──
      if (taskType === 'youtube' || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        let videoId = null;
        // youtu.be/ID
        const shortMatch = videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (shortMatch) videoId = shortMatch[1];
        // youtube.com/watch?v=ID
        const longMatch = videoUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (longMatch) videoId = longMatch[1];
        // youtube.com/embed/ID
        const embedMatch = videoUrl.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (embedMatch) videoId = embedMatch[1];
        // youtube.com/shorts/ID
        const shortsMatch = videoUrl.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortsMatch) videoId = shortsMatch[1];

        if (videoId) {
          return {
            type:   'iframe',
            url:    `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`,
            canEmbed: true
          };
        }
      }

      // ── Facebook video ──
      if (taskType === 'facebook' || videoUrl.includes('facebook.com')) {
        return {
          type:    'iframe',
          url:     `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&autoplay=true&show_text=false&width=500`,
          canEmbed: true
        };
      }

      // ── TikTok — cannot be embedded, use in-app overlay ──
      if (taskType === 'tiktok' || videoUrl.includes('tiktok.com')) {
        return { type: 'overlay', url: videoUrl, canEmbed: false };
      }

      // ── Instagram — cannot be embedded, use in-app overlay ──
      if (taskType === 'instagram' || videoUrl.includes('instagram.com')) {
        return { type: 'overlay', url: videoUrl, canEmbed: false };
      }

      // ── Twitter/X ──
      if (taskType === 'twitter' || videoUrl.includes('twitter.com') || videoUrl.includes('x.com')) {
        return { type: 'overlay', url: videoUrl, canEmbed: false };
      }

      // ── Default — overlay ──
      return { type: 'overlay', url: videoUrl, canEmbed: false };
    } catch (_) {
      return { type: 'overlay', url: videoUrl, canEmbed: false };
    }
  }

  // ── In-app browser overlay for non-embeddable platforms ───────────────────
  function showInAppBrowser(url, title, onClose) {
    // Create overlay if not exists
    let overlay = document.getElementById('inAppBrowserOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'inAppBrowserOverlay';
      overlay.className = 'in-app-browser';
      overlay.innerHTML = `
        <div class="iab-header">
          <div class="iab-title" id="iabTitle"></div>
          <div class="iab-actions">
            <a id="iabOpenExternal" target="_blank" class="iab-btn">
              <i class="ph-bold ph-arrow-square-out"></i>
            </a>
            <button class="iab-btn" onclick="window.closeInAppBrowser()">
              <i class="ph-bold ph-x"></i>
            </button>
          </div>
        </div>
        <iframe id="iabFrame" src="" allowfullscreen></iframe>
        <div class="iab-overlay-msg" id="iabOverlayMsg">
          <i class="ph-bold ph-warning"></i>
          <p>This platform blocks embedding. The page has been opened externally.</p>
          <small>Come back to this screen — the timer is still running!</small>
        </div>
      `;
      document.querySelector('.main-container').appendChild(overlay);
    }

    document.getElementById('iabTitle').textContent = title;
    document.getElementById('iabOpenExternal').href  = url;

    const frame   = document.getElementById('iabFrame');
    const msg     = document.getElementById('iabOverlayMsg');
    const iabOverlay = document.getElementById('inAppBrowserOverlay');

    // Try to load in iframe — detect if blocked
    frame.src = '';
    msg.style.display = 'none';
    frame.style.display = 'block';

    // Set a timeout — if iframe hasn't loaded content, show message + open externally
    const loadTimer = setTimeout(() => {
      try {
        // If cross-origin blocked, contentDocument will be null or throw
        const doc = frame.contentDocument;
        if (!doc || doc.title === '') throw new Error('blocked');
      } catch (_) {
        // Platform blocks iframe — open in new tab and show message
        window.open(url, '_blank');
        frame.style.display = 'none';
        msg.style.display   = 'flex';
      }
    }, 2000);

    frame.onload = () => {
      clearTimeout(loadTimer);
      try {
        const doc = frame.contentDocument;
        if (!doc || doc.body?.innerHTML === '') {
          window.open(url, '_blank');
          frame.style.display = 'none';
          msg.style.display   = 'flex';
        }
      } catch (_) {
        // Cross-origin — expected for YouTube etc., iframe is showing
        clearTimeout(loadTimer);
      }
    };

    frame.src = url;
    iabOverlay.classList.add('show');
    iabOverlay._onClose = onClose;

    window.closeInAppBrowser = () => {
      iabOverlay.classList.remove('show');
      frame.src = '';
      if (iabOverlay._onClose) iabOverlay._onClose();
    };
  }

  // ── Task Preview Modal ─────────────────────────────────────────────────────
  async function openTaskPreview(taskId) {
    if (_stats.remaining_today <= 0) {
      window.RFTCore?.showToast('Daily task limit reached. Come back tomorrow!', 'error');
      return;
    }
    const task = _tasks.find(t => t.id === taskId);
    if (!task) return;
    _activeTaskId = taskId;

    const modal = document.getElementById('rftTaskPreview');
    if (!modal) return;

    const reward = pkr(task.reward_usdt);
    const embed  = getEmbedUrl(task.video_url, task.task_type);

    modal.innerHTML = `
      <div class="rft-task-preview-content">
        <button class="rft-task-preview-close" onclick="closeTaskPreview()"><i class="ph-bold ph-x"></i></button>
        <div class="rft-task-preview-video" id="taskVideoWrap">
          <img src="${task.thumbnail_url || `https://placehold.co/340x190/1a1a1a/d4a843?text=${task.task_type}`}" alt="${task.title}" id="taskThumb">
          <div class="rft-task-preview-overlay" id="taskOverlay">
            <button class="rft-task-preview-play" id="taskPlayBtn" onclick="beginTask('${task.id}')">
              <i class="ph-bold ph-play"></i>
            </button>
          </div>
        </div>
        <div class="rft-task-preview-info">
          <h3>${task.title}</h3>
          <p>${task.description || 'Complete this task to earn rewards.'}</p>
          <div class="rft-task-preview-meta">
            <span><i class="ph-bold ph-clock"></i> ${task.duration_seconds}s</span>
            <span><i class="ph-bold ph-coins"></i> ${reward}</span>
          </div>
          <div id="taskProgress" style="display:none">
            <div class="task-progress-bar"><div class="task-progress-fill" id="taskProgressFill"></div></div>
            <div class="task-progress-text" id="taskProgressText">Watching…</div>
          </div>
        </div>
      </div>
    `;
    modal.classList.add('show');
    // Store embed info for beginTask
    modal._embed = embed;
  }

  async function beginTask(taskId) {
    const session = await startTask(taskId);
    if (!session) return;

    const modal    = document.getElementById('rftTaskPreview');
    const embed    = modal?._embed;
    const videoWrap= document.getElementById('taskVideoWrap');
    const thumb    = document.getElementById('taskThumb');
    const overlay  = document.getElementById('taskOverlay');
    const btn      = document.getElementById('taskPlayBtn');
    const progress = document.getElementById('taskProgress');
    const fill     = document.getElementById('taskProgressFill');
    const text     = document.getElementById('taskProgressText');

    if (btn)      btn.style.display = 'none';
    if (overlay)  overlay.style.display = 'none';
    if (progress) progress.style.display = 'block';

    const task     = _tasks.find(t => t.id === taskId);
    const duration = (task?.duration_seconds || 30) * 1000;
    const start    = Date.now();

    // ── Inline embed (YouTube / Facebook) ─────────────────────────────────
    if (embed?.canEmbed) {
      if (thumb)    thumb.style.display     = 'none';
      // Replace thumbnail with iframe
      const iframe = document.createElement('iframe');
      iframe.src             = embed.url;
      iframe.allow           = 'autoplay; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.className       = 'task-embed-iframe';
      iframe.style.cssText   = 'width:100%;height:100%;border:none;border-radius:0;position:absolute;inset:0;';
      videoWrap?.appendChild(iframe);
    }
    // ── In-app browser overlay (TikTok / Instagram) ────────────────────────
    else if (embed?.url) {
      showInAppBrowser(embed.url, task.title, null);
    }

    // ── Start timer regardless ─────────────────────────────────────────────
    _taskTimer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      if (fill) fill.style.width = pct + '%';
      if (text) text.textContent = `Watching… ${Math.ceil((duration - elapsed) / 1000)}s remaining`;
      if (elapsed >= duration) {
        clearInterval(_taskTimer);
        // Close in-app browser if open
        if (!embed?.canEmbed && window.closeInAppBrowser) {
          window.closeInAppBrowser();
        }
        finishTask(taskId, session.session_id, Math.floor(duration / 1000));
      }
    }, 200);
  }

  async function finishTask(taskId, sessionId, watchSecs) {
    const text = document.getElementById('taskProgressText');
    if (text) text.textContent = 'Submitting…';

    const result = await completeTask(taskId, sessionId, watchSecs);
    if (result) {
      if (text) text.textContent = `✓ Earned ${pkr(result.reward_usdt)}!`;
      setTimeout(() => {
        closeTaskPreview();
        renderTaskHall('homeTaskList', 'homeTaskDone', 'homeTaskLeft');
        renderTaskHall('pageTaskList', 'pageTaskDone', 'pageTaskLeft');
        refreshHomeBalance();
      }, 1500);
    }
  }

  function closeTaskPreview() {
    if (_taskTimer) { clearInterval(_taskTimer); _taskTimer = null; }
    // Close in-app browser if open
    if (window.closeInAppBrowser) window.closeInAppBrowser();
    // Remove any injected iframe
    const iframe = document.querySelector('.task-embed-iframe');
    if (iframe) iframe.remove();
    const modal = document.getElementById('rftTaskPreview');
    if (modal) { modal.classList.remove('show'); modal._embed = null; }
    _activeTaskId = null;
  }

  // ── Member Rankings ────────────────────────────────────────────────────────
  async function renderMemberRankings() {
    const el = document.getElementById('rftVideoMemberRank');
    if (!el) return;
    try {
      const r = await window.RFTApi?.get('/user/leaderboard');
      if (!r?.success || !r.data.length) {
        el.innerHTML = `
          <div class="rft-video-member-rank-head"><span>Member Rankings</span><span>Weekly Activity</span></div>
          <div style="text-align:center;padding:20px;color:#666;font-size:13px">No data yet this week</div>`;
        return;
      }
      const vipColors = ['#888','#CD7F32','#C0C0C0','#FFD700','#E5E4E2','#B9F2FF'];
      el.innerHTML = `
        <div class="rft-video-member-rank-head"><span>Member Rankings</span><span>Weekly Earnings</span></div>
        ${r.data.map((m, i) => `
          <div class="rft-video-member-row">
            <div class="rank-num" style="color:${i<3?'#d4a843':'#666'};font-weight:700;min-width:20px">#${m.rank}</div>
            <div class="avatar" style="background:${vipColors[m.vip_level]}22;color:${vipColors[m.vip_level]}">${m.display_name.charAt(0)}</div>
            <div class="name">
              ${m.display_name}
              <small style="display:block;color:#6e6e73;font-size:10px">VIP ${m.vip_level} · Weekly activity</small>
            </div>
            <div class="reward">${pkr(m.week_earned)}</div>
          </div>
        `).join('')}`;
    } catch (_) {
      el.innerHTML = '';
    }
  }

  // ── Home balance refresh ───────────────────────────────────────────────────
  async function refreshHomeBalance() {
    try {
      const r = await window.RFTApi?.get('/wallet/balance');
      if (r?.success) {
        const d     = r.data;
        const balEl = document.getElementById('hbbBalance');
        const nameEl= document.getElementById('hbbName');
        const vipEl = document.getElementById('hbbVip');
        if (balEl) balEl.textContent = pkr(d.balance_usdt);
        if (vipEl) vipEl.textContent = `VIP ${d.vip_level || 0}`;
        const user = window.RFTCore?.getCurrentUser();
        if (nameEl && user) nameEl.textContent = user.name || 'Welcome';
        const profBal = document.getElementById('profBalance');
        const profPts = document.getElementById('profPoints');
        if (profBal) profBal.textContent = pkr(d.balance_usdt);
        if (profPts) profPts.textContent = d.points;
      }
    } catch (_) {}
  }

  function init() {
    document.addEventListener('rft:page:homePage',  () => {
      renderTaskHall('homeTaskList', 'homeTaskDone', 'homeTaskLeft');
      renderMemberRankings();
      refreshHomeBalance();
      window.RFTNotifications?.loadAnnouncementTicker?.();
      window.RFTNotifications?.checkUnread?.();
    });
    document.addEventListener('rft:page:tasksPage', () => {
      renderTaskHall('pageTaskList', 'pageTaskDone', 'pageTaskLeft');
    });
    window.openTaskPreview  = openTaskPreview;
    window.beginTask        = beginTask;
    window.closeTaskPreview = closeTaskPreview;
  }

  window.RFTTaskEngine = { fetchTasks, renderTaskHall, openTaskPreview, beginTask, closeTaskPreview, renderMemberRankings, refreshHomeBalance, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
