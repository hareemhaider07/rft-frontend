/* ============================================================
   RFT Entertainment — Earnings Chart Module
   Canvas-based stacked bar chart, no external dependencies
   ============================================================ */
(function () {
  'use strict';

  const PKR_RATE = 280;
  let _currentPeriod = 7;
  let _chartData     = null;
  let _canvas        = null;
  let _ctx           = null;
  let _bars          = [];   // hit areas for touch/click

  const fmt = (usdt) => 'Rs. ' + Math.round(parseFloat(usdt || 0) * PKR_RATE).toLocaleString('en-PK');

  // ── Load page ───────────────────────────────────────────────────────────────
  async function loadEarningsPage() {
    await load(7);
    await loadHistory();
  }

  async function load(period, tabEl) {
    _currentPeriod = period;

    // Update active tab
    if (tabEl) {
      document.querySelectorAll('#earningsPage .lb-tab').forEach(t => t.classList.remove('active'));
      tabEl.classList.add('active');
    } else {
      document.querySelectorAll('#earningsPage .lb-tab').forEach(t => {
        t.classList.toggle('active', parseInt(t.dataset.period) === period);
      });
    }

    // Show skeleton in chart area
    const wrap = document.getElementById('earnChartCard');
    if (wrap) wrap.classList.add('ecc-loading');

    try {
      const r = await window.RFTApi?.get(`/user/earnings-chart?period=${period}`);
      if (!r?.success) return;
      _chartData = r.data;
      renderStats(r.data.summary);
      renderBreakdown(r.data.summary, period);
      drawChart(r.data.days, r.data.summary.max_day_value);
      setupTouch();
    } catch (e) {
      console.error('Earnings chart error:', e);
    } finally {
      if (wrap) wrap.classList.remove('ecc-loading');
    }
  }

  // ── Stat cards ──────────────────────────────────────────────────────────────
  function renderStats(s) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('esTotalUsdt',  fmt(s.total_usdt));
    set('esTotalPkr',   'Rs. ' + Number(s.total_pkr).toLocaleString());
    set('esStreak',     s.earning_streak + (s.earning_streak === 1 ? ' day' : ' days'));
    set('esActiveDays', s.active_days + ' / ' + _currentPeriod);

    const badge = document.getElementById('earnBestDay');
    const text  = document.getElementById('earnBestDayText');
    if (s.best_day_usdt > 0 && badge && text) {
      badge.style.display = 'flex';
      text.textContent = `${fmt(s.best_day_usdt)} on ${fmtDate(s.best_day_date)}`;
    } else if (badge) {
      badge.style.display = 'none';
    }

    const title = document.getElementById('eccTitle');
    if (title) title.textContent = `Daily Earnings — Last ${_currentPeriod} Days`;
  }

  // ── Source breakdown ─────────────────────────────────────────────────────────
  function renderBreakdown(s, period) {
    const pct = (val) => s.total_usdt > 0
      ? ((val / s.total_usdt) * 100).toFixed(0) + '%'
      : '0%';
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('ebdTasksVal',  fmt(s.total_tasks_usdt));
    set('ebdRefVal',    fmt(s.total_referral_usdt));
    set('ebdSpinVal',   fmt(s.total_spin_usdt));
    set('ebdTasksSub',  pct(s.total_tasks_usdt)    + ' of total · ' + period + ' days');
    set('ebdRefSub',    pct(s.total_referral_usdt) + ' of total');
    set('ebdSpinSub',   pct(s.total_spin_usdt)     + ' of total');
  }

  // ── Chart drawing ────────────────────────────────────────────────────────────
  function drawChart(days, maxVal) {
    _canvas = document.getElementById('earningsCanvas');
    if (!_canvas) return;

    const dpr    = window.devicePixelRatio || 1;
    const W      = _canvas.parentElement.clientWidth || 340;
    const H      = 200;
    _canvas.width  = W * dpr;
    _canvas.height = H * dpr;
    _canvas.style.width  = W + 'px';
    _canvas.style.height = H + 'px';
    _ctx = _canvas.getContext('2d');
    _ctx.scale(dpr, dpr);

    const PAD_L = 40, PAD_R = 8, PAD_T = 16, PAD_B = 32;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    _ctx.clearRect(0, 0, W, H);

    const COLORS = {
      tasks:    '#d4a843',
      referral: '#3b82f6',
      spin:     '#a855f7',
      empty:    'rgba(255,255,255,0.04)'
    };

    if (!days.length) {
      _ctx.fillStyle = 'rgba(255,255,255,0.2)';
      _ctx.font = '13px Inter, sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('No earnings yet', W / 2, H / 2);
      return;
    }

    // Safe max
    const safeMax = maxVal > 0 ? maxVal : 0.1;

    // Y-axis grid lines + labels
    const gridLines = 4;
    _ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    _ctx.lineWidth   = 1;
    _ctx.fillStyle   = 'rgba(255,255,255,0.3)';
    _ctx.font        = '9px Inter, sans-serif';
    _ctx.textAlign   = 'right';

    // Y-axis labels in PKR
    for (let i = 0; i <= gridLines; i++) {
      const y      = PAD_T + chartH - (i / gridLines) * chartH;
      const pkrVal = Math.round((i / gridLines) * safeMax * PKR_RATE);
      const label  = pkrVal >= 1000 ? (pkrVal/1000).toFixed(0)+'k' : pkrVal.toString();
      _ctx.beginPath();
      _ctx.moveTo(PAD_L, y);
      _ctx.lineTo(PAD_L + chartW, y);
      _ctx.stroke();
      _ctx.fillText(label, PAD_L - 3, y + 3);
    }

    // Bars
    const gap      = 2;
    const barW     = Math.max(2, (chartW / days.length) - gap);
    _bars = [];

    days.forEach((d, i) => {
      const x    = PAD_L + i * (barW + gap);
      const keys = ['tasks', 'referral', 'spin'];
      let yOffset = PAD_T + chartH;

      // Empty bar (background)
      _ctx.fillStyle = COLORS.empty;
      _ctx.beginPath();
      _ctx.roundRect?.(x, PAD_T, barW, chartH, 2) ||
        _ctx.rect(x, PAD_T, barW, chartH);
      _ctx.fill();

      // Stacked segments
      for (const key of keys) {
        const val    = d[key] || 0;
        if (val <= 0) continue;
        const segH   = Math.max(2, (val / safeMax) * chartH);
        yOffset     -= segH;
        _ctx.fillStyle = COLORS[key];
        if (_ctx.roundRect) {
          _ctx.beginPath();
          _ctx.roundRect(x, yOffset, barW, segH, yOffset === PAD_T + chartH - segH ? [2, 2, 0, 0] : 0);
          _ctx.fill();
        } else {
          _ctx.fillRect(x, yOffset, barW, segH);
        }
      }

      // X-axis label (every N bars to avoid crowding)
      const showLabel = days.length <= 7 || i % Math.ceil(days.length / 7) === 0 || i === days.length - 1;
      if (showLabel) {
        _ctx.fillStyle   = 'rgba(255,255,255,0.3)';
        _ctx.font        = '8px Inter, sans-serif';
        _ctx.textAlign   = 'center';
        const parts      = d.date.split('-');
        _ctx.fillText(parts[2] + '/' + parts[1], x + barW / 2, H - 8);
      }

      // Store hit area for tooltip
      _bars.push({ x, y: PAD_T, w: barW, h: chartH, data: d });
    });
  }

  // ── Touch/click tooltip ──────────────────────────────────────────────────────
  function setupTouch() {
    if (!_canvas) return;
    // Remove old listener to avoid stacking
    _canvas.onclick = handleCanvasClick;
    _canvas.ontouchend = (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect  = _canvas.getBoundingClientRect();
      handleHit(touch.clientX - rect.left, touch.clientY - rect.top);
    };
  }

  function handleCanvasClick(e) {
    const rect = _canvas.getBoundingClientRect();
    handleHit(e.clientX - rect.left, e.clientY - rect.top);
  }

  function handleHit(cx, cy) {
    const tooltip = document.getElementById('eccTooltip');
    if (!tooltip) return;

    const hit = _bars.find(b => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
    if (!hit) { tooltip.style.display = 'none'; return; }

    const d   = hit.data;
    const tot = Math.round(d.total    * PKR_RATE);
    const tsk = Math.round(d.tasks    * PKR_RATE);
    const ref = Math.round(d.referral * PKR_RATE);
    const spn = Math.round(d.spin     * PKR_RATE);
    tooltip.innerHTML = `
      <div class="ect-date">${fmtDate(d.date)}</div>
      <div class="ect-row"><span style="color:#d4a843">●</span> Tasks: Rs. ${tsk.toLocaleString('en-PK')}</div>
      ${ref > 0 ? `<div class="ect-row"><span style="color:#3b82f6">●</span> Referral: Rs. ${ref.toLocaleString('en-PK')}</div>` : ''}
      ${spn > 0 ? `<div class="ect-row"><span style="color:#a855f7">●</span> Spin: Rs. ${spn.toLocaleString('en-PK')}</div>` : ''}
      <div class="ect-total">Total: Rs. ${tot.toLocaleString('en-PK')}</div>
    `;

    // Position tooltip
    const canvasRect = _canvas.getBoundingClientRect();
    const canvasW    = canvasRect.width;
    const tipX       = hit.x + hit.w / 2;
    tooltip.style.display = 'block';
    tooltip.style.left     = Math.min(tipX, canvasW - 110) + 'px';
    tooltip.style.top      = '10px';
  }

  // ── History list ─────────────────────────────────────────────────────────────
  async function loadHistory() {
    const el = document.getElementById('earningsList');
    if (!el) return;
    el.innerHTML = '<div class="tx-loading">Loading history…</div>';
    try {
      const r = await window.RFTApi?.get('/wallet/transactions?limit=50');
      if (!r?.success) { el.innerHTML = '<div class="tx-loading">No history</div>'; return; }
      const earnt = r.data.transactions.filter(t =>
        ['task_reward','referral_commission','referral_bonus','spin_reward'].includes(t.type)
      );
      if (!earnt.length) { el.innerHTML = '<div class="tx-loading">No earnings yet — complete your first task!</div>'; return; }

      const typeLabel = {
        task_reward:          'Task Reward',
        referral_commission:  'Referral Commission',
        referral_bonus:       'Referral Bonus',
        spin_reward:          'Lucky Draw Win'
      };
      const typeIcon = {
        task_reward:          'ph-play-circle',
        referral_commission:  'ph-users-three',
        referral_bonus:       'ph-gift',
        spin_reward:          'ph-shooting-star'
      };
      const typeColor = {
        task_reward:          '#d4a843',
        referral_commission:  '#3b82f6',
        referral_bonus:       '#22c55e',
        spin_reward:          '#a855f7'
      };

      el.innerHTML = earnt.map(tx => {
        const color = typeColor[tx.type] || '#888';
        const icon  = typeIcon[tx.type]  || 'ph-coins';
        const label = typeLabel[tx.type] || tx.type;
        const pkr   = tx.amount_pkr ? Number(tx.amount_pkr).toLocaleString() : Math.round(tx.amount_usdt * PKR_RATE).toLocaleString();
        return `
          <div class="transaction-item">
            <div class="transaction-icon tx-credit" style="background:${color}22;color:${color}">
              <i class="ph-bold ${icon}"></i>
            </div>
            <div class="transaction-info">
              <div class="transaction-type">${label}</div>
              <div class="transaction-date">${fmtTime(tx.created_at)}</div>
            </div>
            <div class="transaction-right">
              <div class="transaction-amount positive">+Rs. ${pkr}</div>
            </div>
          </div>`;
      }).join('');
    } catch (_) {
      el.innerHTML = '<div class="tx-loading">Error loading history</div>';
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function fmtDate(d) {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  }

  function fmtTime(d) {
    if (!d) return '';
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    const hrs  = Math.floor(diff / 3600000);
    if (hrs < 24) return hrs < 1 ? 'Just now' : `${hrs}h ago`;
    return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    document.addEventListener('rft:page:earningsPage', loadEarningsPage);
    // Redraw chart on window resize
    window.addEventListener('resize', () => {
      if (_chartData) drawChart(_chartData.days, _chartData.summary.max_day_value);
    });
  }

  window.RFTEarnings = { loadEarningsPage, load, loadHistory, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
