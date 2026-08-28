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

    // Dummy data always shown — gives the app a live feel
    const dummy = [
      { rank:1, display_name:'H***n', vip_level:3, week_earned:'12500' },
      { rank:2, display_name:'A***d', vip_level:2, week_earned:'8400'  },
      { rank:3, display_name:'M***a', vip_level:2, week_earned:'6200'  },
      { rank:4, display_name:'F***a', vip_level:1, week_earned:'4800'  },
      { rank:5, display_name:'Z***b', vip_level:1, week_earned:'3600'  },
    ];

    // Try real data first, fall back to dummy
    let leaders = dummy;
    try {
      const r = await window.RFTApi?.get('/user/leaderboard');
      if (r?.success && r.data.length) leaders = r.data;
    } catch (_) {}

    const vipColors = ['#888','#CD7F32','#C0C0C0','#B8860B','#5080A0','#1A8070'];
    el.innerHTML = `
      <div class="rft-video-member-rank-head"><span>Member Rankings</span><span>This Week</span></div>
      ${leaders.map((m, i) => {
        const isPkr = typeof m.week_earned === 'string' && !m.score_label;
        const display = isPkr
          ? 'Rs. ' + Number(m.week_earned).toLocaleString('en-PK')
          : (m.score_label || m.week_earned);
        const color = vipColors[m.vip_level] || '#888';
        return `
          <div class="rft-video-member-row">
            <div class="rank-num" style="color:${i<3?'#B8860B':'#999'};font-weight:800">#${m.rank}</div>
            <div class="avatar" style="background:${color}18;color:${color}">${m.display_name.charAt(0)}</div>
            <div class="name">
              ${m.display_name}
              <small style="display:block;color:#999;font-size:10px">VIP ${m.vip_level}</small>
            </div>
            <div class="reward">${display}</div>
          </div>`;
      }).join('')}
    `;
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
      renderTrailerReel();
    });
    window.openTaskPreview  = openTaskPreview;
    window.beginTask        = beginTask;
    window.closeTaskPreview = closeTaskPreview;
  }

  window.RFTTaskEngine = { fetchTasks, renderTaskHall, openTaskPreview, beginTask, closeTaskPreview, renderMemberRankings, refreshHomeBalance, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  // ── Trailer Reel ──────────────────────────────────────────────────────────
  const TRAILERS = [
    // Hollywood
    { id:'62bIsvRcPv0', studio:'Sony Pictures',        title:'Spider-Man: Brand New Day',          meta:'New Trailer · In theaters' },
    { id:'jxU8FU3o75A', studio:'Sony Pictures',        title:'Insidious: Out of the Further',       meta:'Official Trailer · Aug 21' },
    { id:'4U-wmj5D47s', studio:'Universal / Blumhouse',title:'Other Mommy',                         meta:'Official Trailer · Oct 9' },
    { id:'irVNGjRFZGk', studio:'Marvel Studios',       title:'Avengers: Doomsday',                  meta:'Official Trailer · Dec 18' },
    { id:'3oB9AxspVow', studio:'Warner Bros.',          title:'The End of Oak Street',               meta:'Official Trailer · IMAX Aug 14' },
    { id:'ZSdOwt-G49w', studio:'Illumination',          title:'Minions & Monsters',                  meta:'Official Trailer · July 1' },
    { id:'zhApeaHMvfs', studio:'Sony Pictures',        title:'Jumanji: Open World',                  meta:'Official Trailer · Christmas Day' },
    { id:'ZVkrhHebz1Q', studio:'Focus Features',       title:'The Uprising',                         meta:'Official Trailer · Sept 10' },
    { id:'f_bKjZeJBBI', studio:'Universal Pictures',   title:'The Odyssey',                          meta:'Christopher Nolan · July 17' },
    { id:'FKSdXH89jbo', studio:'Lionsgate',             title:'Mutiny',                               meta:'Jason Statham' },
    { id:'n7f6hlKsxxo', studio:'Disney',                title:'Moana',                                meta:'Live Action · July 10' },
    { id:'7xfqITrMDcI', studio:'Apple TV+',             title:'Matchbox The Movie',                   meta:'Streaming Oct 9' },
    { id:'zEbpmROmKBQ', studio:'Paramount Pictures',   title:'Heart of the Beast',                   meta:'Brad Pitt · In theaters' },
    { id:'kgv8jf_8dm0', studio:'Netflix',               title:'Apex',                                 meta:'Charlize Theron' },
    { id:'mNd1gb19A-c', studio:'Sony Pictures',        title:'Resident Evil',                         meta:'Official Trailer · 4K' },
    { id:'48CtX6OgU3s', studio:'Lionsgate',             title:'The Housemaid',                        meta:'Sydney Sweeney, Amanda Seyfried' },
    { id:'i36Zw32GfRQ', studio:'Universal Pictures',   title:'Reminders of Him',                     meta:'Colleen Hoover' },
    { id:'FmM2giDwLAE', studio:'Universal Pictures',   title:'Violent Night 2',                      meta:'Official Trailer · Dec 4' },
    // Bollywood
    { id:'Uu2QK9Z9X5E', studio:'Red Chillies',         title:'King',                                 meta:'Shah Rukh Khan · Dec 24' },
    { id:'lNaSdnz2I8g', studio:'Sony Pictures',        title:'Ramayana',                              meta:'Ranbir Kapoor, Yash · Diwali 2026' },
    { id:'IG-eByZdz6Y', studio:'T-Series',              title:'Dhamaal 4',                            meta:'Ajay Devgn, Riteish Deshmukh' },
    { id:'R704yP3dlXw', studio:'Star Studios',          title:'Welcome To The Jungle',                meta:'Akshay Kumar · In cinemas now' },
    { id:'hlfz1ep8IL4', studio:'KVN Productions',       title:'Haiwaan',                              meta:'Akshay Kumar, Saif Ali Khan' },
    { id:'zfopTfY3lBU', studio:'Maddock Films',         title:'Eetha',                                meta:'Shraddha Kapoor, Randeep Hooda' },
    { id:'fJ9dmfWRzlM', studio:'RKD Studios',           title:'Mahakali',                             meta:'Akshaye Khanna' },
    { id:'b8jZdpIzG4k', studio:'SRF',                   title:'Ishqnama',                             meta:'In cinemas 24th July' },
    { id:'rRQ8oKCoYrQ', studio:'Dharma Productions',    title:'Chand Mera Dil',                       meta:'Ananya Panday, Lakshya' },
    { id:'q2zwd3OVcnM', studio:'RTake Studios',         title:'Daadi Ki Shaadi',                      meta:'Neetu Kapoor, Kapil Sharma' },
    { id:'h1Q_Oykycns', studio:'Netflix India',         title:'Toaster',                              meta:'Rajkummar Rao, Sanya Malhotra' },
    { id:'8p73KvHdcuE', studio:'Netflix India',         title:'Dhindora 2',                           meta:'@BBKiVines' },
    { id:'PRUTWluKRW8', studio:'Applause Entertainment',title:'Main Vaapas Aaunga',                   meta:'Diljit, Sharvari' },
    { id:'5vMWZhHPlaw', studio:'Excel Movies',          title:'Mirzapur The Movie',                   meta:'Ali Fazal, Pankaj Tripathi' },
    { id:'1ya87ENCRj0', studio:'Indian Cinema',         title:'Awarapan 2',                           meta:'Emraan Hashmi, Disha Patani · Aug 14' },
    { id:'2wtddXiROWA', studio:'Indian Cinema',         title:'Jan Neta',                             meta:'Thalapathy Vijay, Pooja Hegde' },
    { id:'unf8x_aZg9Y', studio:'Indian Cinema',         title:'Ikka',                                 meta:'Sunny Deol, Akshaye Khanna · Netflix' },
    { id:'XW1RkKiRnsg', studio:'Indian Cinema',         title:'Bhooth Bangla',                        meta:'Akshay Kumar, Tabu, Paresh Rawal' },
    { id:'YpGhCA2X3gU', studio:'Indian Cinema',         title:'Hanuman Ansh',                         meta:'In cinemas July 31' },
    { id:'6_MaiogJvSE', studio:'Indian Cinema',         title:'Street Fighter',                       meta:'Hindi Trailer · Oct 16' },
    // Pakistani Cinema
    { id:'PVWxat5Z0zs', studio:'Pakistani Cinema',      title:'ZOMBEID',                              meta:'Fahad Mustafa, Mehwish Hayat' },
    { id:'jewsWOoP6nQ', studio:'Pakistani Cinema',      title:'Mango Jutt',                           meta:'Faisal Qureshi, Hareem Farooq' },
    { id:'ouzEuRvdVC0', studio:'Pakistani Cinema',      title:'Mera Lyari',                           meta:'Ayesha Omar, Dananeer Mobeen' },
    { id:'jw5dTVTX9zo', studio:'Pakistani Cinema',      title:'Teefa In Trouble',                     meta:'Ali Zafar, Maya Ali · 2018' },
    { id:'KozPWehBjvs', studio:'Pakistani Cinema',      title:'Aag Lagay Basti Mein',                 meta:'Fahad Mustafa, Mahira Khan' },
    { id:'UwZBNbxBgM0', studio:'Pakistani Cinema',      title:'Umro Ayyar: A New Beginning',          meta:'Usman Mukhtar, Faran Tahir' },
    { id:'pNPFlT--b94', studio:'Pakistani Cinema',      title:'Luv Di Saun',                          meta:'Farhan Saeed, Mamya Shajaffar · Eid' },
    { id:'A5ejkDCT1CA', studio:'Pakistani Cinema',      title:'Superstar',                            meta:'Mahira Khan, Bilal Ashraf' },
    { id:'EJ2J07ca18w', studio:'Pakistani Cinema',      title:'Parey Hut Love',                       meta:'ARY Films' },
    { id:'Z0SpyQ588NQ', studio:'Pakistani Cinema',      title:'BULLAH',                               meta:'Official Trailer · Eid 2026' },
    { id:'RXo-y4dugVQ', studio:'Pakistani Cinema',      title:'Khan Tumhara',                         meta:'Bilal Ashraf, Maya Ali · Eid ul-Adha' },
    { id:'pEWqOAcYgpQ', studio:'Pakistani Cinema',      title:'The Legend of Maula Jatt',             meta:'Official Theatrical Trailer 2022' },
    { id:'Y3zwLrr9TKE', studio:'Pakistani Cinema',      title:'Zindagi Tamasha',                      meta:'Circus of Life' },
    { id:'TUM6liPArUE', studio:'Pakistani Cinema',      title:'Jawani Phir Nahi Ani 2',               meta:'ARY Films' },
    { id:'MhMHXeewXN4', studio:'Pakistani Cinema',      title:'Parchi',                               meta:'Ali Rehman Khan, Hareem Farooq' },
    { id:'3RAlhb3WLY8', studio:'Pakistani Cinema',      title:'Kamli',                                meta:'Saba Qamar, Sania Saeed' },
    { id:'Xj18uwvIo8Y', studio:'Pakistani Cinema',      title:'Neelofar',                             meta:'Fawad Khan, Mahira Khan' },
    { id:'rVpljgnB100', studio:'Pakistani Cinema',      title:'DELHI GATE',                           meta:'Nadeem Cheema, Javed Sheikh' },
    { id:'ekdP7w7irrQ', studio:'Pakistani Cinema',      title:'London Nahi Jaunga',                   meta:'Humayun Saeed, Mehwish Hayat' },
    { id:'jTndSSde6Z8', studio:'Pakistani Cinema',      title:'Love Guru',                            meta:'Humayun Saeed, Mahira Khan · Eid' },
    { id:'AOuEl2JHnFg', studio:'Pakistani Cinema',      title:'Load Wedding',                         meta:'Fahad Mustafa, Mehwish Hayat' },
    { id:'yJk_aZTvj9M', studio:'Pakistani Cinema',      title:'Money Back Guarantee',                 meta:'Fawad Khan, Wasim Akram' },
    { id:'f8IQfwadVGw', studio:'Pakistani Cinema',      title:'Quaid-e-Azam Zindabad',               meta:'Fahad Mustafa, Mahira Khan' },
    { id:'FJ2Fm-4CR5k', studio:'Pakistani Cinema',      title:'Parwaaz Hai Junoon',                   meta:'Hamza Ali Abbasi, Ahad Raza Mir' },
    { id:'iqup82jtx8Q', studio:'Pakistani Cinema',      title:'Verna',                                meta:'Mahira Khan · Shoaib Mansoor' },
    { id:'WgzXHQSFtxY', studio:'Pakistani Cinema',      title:'COMBATIVO AKA COMMANDO ALI',           meta:'Greatest Pakistani Action Movie 2026' },
    { id:'1t3dMZ4B9JM', studio:'Pakistani Cinema',      title:'Khel Khel Mein',                       meta:'Sajal Aly, Bilal Abbas' },
    { id:'EdM1mugi3T8', studio:'Pakistani Cinema',      title:'36 GARH',                              meta:'Moammar Rana, Shafqat Cheema' },
    { id:'tCT017S36hc', studio:'Indian Cinema',         title:'VIBE',                                 meta:'In cinemas Sept 18' },
    { id:'jX6UJY3oXAc', studio:'Indian Cinema',         title:'The India Story',                      meta:'July 24' },
    { id:'7457LdEDt4I', studio:'Indian Cinema',         title:'Kamaal Dhamaal Malamaal',              meta:'Nana Patekar, Paresh Rawal' },
    { id:'RWOL5S6uxaQ', studio:'Aamir Khan Talkies',    title:'Batwara 1947',                         meta:'Shabana Azmi, Sunny Deol' },
    { id:'9FUd-D4FWjw', studio:'Dharma Productions',    title:'Sunny Sanskari Ki Tulsi Kumari',       meta:'Varun, Janhvi · In cinemas' },
    { id:'dW8_SNM-5Kc', studio:'Tips Films',             title:'Hai Jawani Toh Ishq Hona Hai',         meta:'Varun Dhawan, Mrunal Thakur' },
  ];

  // Gradient palette for poster backgrounds (site warm/gold tones)
  const TR_PALETTES = [
    ['#3a2f1e','#14121a'], ['#2f1e2e','#101018'], ['#1e2f2a','#101418'],
    ['#332218','#161214'], ['#241e3a','#12101a'], ['#3a1e28','#141014']
  ];

  // Deduplicate by YouTube ID
  function buildUniqueTrailers() {
    const seen = new Set();
    return TRAILERS.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }

  // Try multiple thumbnail resolutions in sequence
  function attachThumbFallback(img, id) {
    const urls = [
      `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    ];
    let attempt = 0;
    img.onerror = function () {
      attempt++;
      if (attempt < urls.length) {
        img.src = urls[attempt];
      } else {
        img.style.display = 'none';
        const fb = img.nextElementSibling;
        if (fb) fb.style.display = 'flex';
      }
    };
    img.src = urls[0];
  }

  function renderTrailerReel() {
    const grid    = document.getElementById('trailerGrid');
    const counter = document.getElementById('trailerCount');
    if (!grid) return;

    const list = buildUniqueTrailers();
    if (counter) counter.textContent = list.length;

    const playSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

    grid.innerHTML = '';
    list.forEach((t, i) => {
      const [a, b] = TR_PALETTES[i % TR_PALETTES.length];

      const card = document.createElement('a');
      card.className   = 'tr-card';
      card.href        = `https://www.youtube.com/watch?v=${t.id}`;
      card.target      = '_blank';
      card.rel         = 'noopener noreferrer';
      card.setAttribute('aria-label', `Watch ${t.title} on YouTube`);

      card.innerHTML = `
        <div class="tr-poster" style="--pa:${a};--pb:${b}">
          <img class="tr-thumb" alt="${t.title}" loading="lazy" decoding="async">
          <div class="tr-thumb-fallback" style="display:none">
            <span>${t.title}</span>
          </div>
          <div class="tr-play">${playSvg}</div>
          <div class="tr-overlay"></div>
        </div>
        <div class="tr-body">
          <span class="tr-studio">${t.studio}</span>
          <div class="tr-title">${t.title}</div>
          <div class="tr-meta">${t.meta}</div>
          <div class="tr-yt-row">
            <svg viewBox="0 0 24 24" fill="#ff0033" width="14" height="14">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c2 .6 9.4.6 9.4.6s7.4 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12Z"/>
            </svg>
            Watch on YouTube
          </div>
        </div>
      `;

      // Attach thumb after element is in DOM tree (onerror needs live element)
      const img = card.querySelector('.tr-thumb');
      attachThumbFallback(img, t.id);

      grid.appendChild(card);
    });
  }

  window.renderTrailerReel = renderTrailerReel;
})();
