/* ============================================================
   RFT Entertainment — Lucky Draw Module
   Canvas spin wheel with daily spin limit
   ============================================================ */
(function () {
  'use strict';

  const PRIZES = [
    { label: 'Try Again',  color: '#2a2a3a', textColor: '#888' },
    { label: '+10 Points', color: '#1a3a5c', textColor: '#64b5f6' },
    { label: '+20 Points', color: '#2d1a5c', textColor: '#ce93d8' },
    { label: '0.05 USDT',  color: '#5c3a00', textColor: '#ffb74d' },
    { label: '0.10 USDT',  color: '#1a5c2a', textColor: '#81c784' },
    { label: '0.25 USDT',  color: '#5c1a00', textColor: '#ff8a65' },
    { label: '0.50 USDT',  color: '#003366', textColor: '#64b5f6' },
    { label: '1.00 USDT',  color: '#4a0000', textColor: '#ef9a9a' },
    { label: '+50 Points', color: '#1a4a00', textColor: '#a5d6a7' },
  ];

  let _spinning  = false;
  let _canSpin   = false;
  let _prizes    = PRIZES;  // will be overridden by server response
  let _currentAngle = 0;
  let _animFrame = null;

  // ── Draw wheel on canvas ─────────────────────────────────────────────────
  function drawWheel(angle) {
    const canvas = document.getElementById('luckyWheelCanvas');
    if (!canvas) return;
    const ctx   = canvas.getContext('2d');
    const cx    = canvas.width  / 2;
    const cy    = canvas.height / 2;
    const r     = cx - 8;
    const slice = (2 * Math.PI) / _prizes.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer glow ring
    ctx.save();
    ctx.shadowColor = 'rgba(212,168,67,0.5)';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, 2 * Math.PI);
    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth   = 3;
    ctx.stroke();
    ctx.restore();

    _prizes.forEach((prize, i) => {
      const start = angle + i * slice;
      const end   = start + slice;

      // Slice fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle   = prize.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth   = 1;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + slice / 2);
      ctx.textAlign    = 'right';
      ctx.fillStyle    = prize.textColor || '#fff';
      ctx.font         = `bold ${_prizes.length > 8 ? 11 : 13}px Inter, sans-serif`;
      ctx.shadowColor  = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur   = 4;
      ctx.fillText(prize.label, r - 10, 5);
      ctx.restore();
    });

    // Centre circle
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 28);
    grad.addColorStop(0, '#f0c060');
    grad.addColorStop(1, '#b8922e');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Centre icon
    ctx.fillStyle  = '#1a1000';
    ctx.font       = 'bold 13px sans-serif';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RFT', cx, cy);
  }

  // ── Spin animation ────────────────────────────────────────────────────────
  function animateSpin(targetIndex, onDone) {
    const slice        = (2 * Math.PI) / _prizes.length;
    // land in the middle of the target slice, pointer is at top (angle = 0)
    const targetAngle  = -(targetIndex * slice + slice / 2);
    const extraSpins   = (Math.floor(Math.random() * 3) + 5) * 2 * Math.PI;
    const finalAngle   = targetAngle - extraSpins;
    const startAngle   = _currentAngle;
    const delta        = finalAngle - startAngle;
    const duration     = 4000 + Math.random() * 1000;
    const startTime    = performance.now();

    function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

    function frame(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      _currentAngle  = startAngle + delta * easeOut(progress);
      drawWheel(_currentAngle);
      if (progress < 1) {
        _animFrame = requestAnimationFrame(frame);
      } else {
        _currentAngle = finalAngle % (2 * Math.PI);
        drawWheel(_currentAngle);
        onDone();
      }
    }
    _animFrame = requestAnimationFrame(frame);
  }

  // ── Load page ─────────────────────────────────────────────────────────────
  async function loadLuckyPage() {
    drawWheel(0);
    await loadStatus();
    await loadHistory();
  }

  async function loadStatus() {
    const bar = document.getElementById('luckyStatusBar');
    const btn = document.getElementById('luckySpinBtn');
    try {
      const r = await window.RFTApi?.get('/lucky/status');
      if (!r?.success) return;
      _canSpin = r.data.can_spin;

      // update prize labels from server (keeps client in sync)
      if (r.data.prizes?.length) {
        _prizes = r.data.prizes.map((p, i) => ({
          ...PRIZES[i] || PRIZES[0],
          label: p.label,
          color: p.color || PRIZES[i]?.color || '#333'
        }));
        drawWheel(_currentAngle);
      }

      if (bar) {
        bar.innerHTML = _canSpin
          ? `<div class="lsb-ready"><i class="ph-bold ph-star"></i> Your daily spin is ready!</div>`
          : `<div class="lsb-done"><i class="ph-bold ph-check-circle"></i> Already spun today · Next spin: Tomorrow</div>`;
      }
      if (btn) {
        btn.disabled = !_canSpin;
        btn.style.opacity = _canSpin ? '1' : '0.45';
        btn.textContent   = _canSpin ? '🎰 SPIN NOW' : '✓ Come Back Tomorrow';
      }
    } catch (_) {}
  }

  async function loadHistory() {
    // Show last 5 spins from notifications
    const el = document.getElementById('luckyHistory');
    if (!el) return;
    try {
      const r = await window.RFTApi?.get('/notifications?limit=20');
      if (!r?.success) return;
      const spins = r.data.notifications.filter(n => n.title.includes('Lucky Draw')).slice(0, 5);
      if (!spins.length) {
        el.innerHTML = '<div class="tx-loading">No spins yet — spin now to start!</div>';
        return;
      }
      el.innerHTML = spins.map(s => `
        <div class="lucky-history-row">
          <div class="lhr-icon">🎰</div>
          <div class="lhr-info">
            <div class="lhr-msg">${s.message}</div>
            <div class="lhr-date">${fmtTime(s.created_at)}</div>
          </div>
        </div>
      `).join('');
    } catch (_) {}
  }

  // ── Spin ──────────────────────────────────────────────────────────────────
  async function spinWheel() {
    if (_spinning || !_canSpin) return;
    _spinning = true;
    const btn = document.getElementById('luckySpinBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Spinning…'; }

    try {
      const r = await window.RFTApi?.post('/lucky/spin', {});
      if (!r?.success) {
        window.RFTCore?.showToast(r?.message || 'Spin failed', 'error');
        _spinning = false;
        if (btn) { btn.disabled = false; btn.textContent = '🎰 SPIN NOW'; }
        return;
      }

      const prizeIndex = r.data.prize_index ?? 0;

      animateSpin(prizeIndex, () => {
        _spinning = false;
        _canSpin  = false;
        showResult(r.data);

        // Update balance in header
        const user = window.RFTCore?.getCurrentUser();
        if (user) {
          window.RFTCore?.setCurrentUser({
            ...user,
            balance_usdt: r.data.new_balance_usdt,
            points:       r.data.new_points
          });
        }
        const balEl = document.getElementById('hbbBalance');
        if (balEl) balEl.textContent = `${r.data.new_balance_usdt} USDT`;

        if (btn) { btn.disabled = true; btn.textContent = '✓ Come Back Tomorrow'; btn.style.opacity = '0.45'; }
        loadHistory();
        window.RFTNotifications?.checkUnread?.();
      });
    } catch (_) {
      _spinning = false;
      if (btn) { btn.disabled = false; btn.textContent = '🎰 SPIN NOW'; }
    }
  }

  function showResult(data) {
    const el = document.getElementById('luckyResultCard');
    if (!el) return;
    const isWin = data.prize_usdt > 0 || data.prize_points > 0;
    el.innerHTML = `
      <div class="lrc-inner" style="border-color:${data.prize_color || '#d4a843'}">
        <div class="lrc-icon">${isWin ? '🎉' : '😔'}</div>
        <div class="lrc-prize" style="color:${data.prize_color || '#d4a843'}">${data.prize}</div>
        <div class="lrc-msg">${data.prize_usdt > 0 ? `+${data.prize_usdt} USDT added to your wallet` : data.prize_points > 0 ? `+${data.prize_points} Points added` : 'Better luck tomorrow!'}</div>
      </div>
    `;
    el.style.display = 'block';
  }

  function fmtTime(d) {
    if (!d) return '';
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    const hrs  = Math.floor(diff / 3600000);
    if (hrs < 24) return `${hrs}h ago`;
    return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
  }

  function init() {
    document.addEventListener('rft:page:luckyPage', loadLuckyPage);
    window.spinWheel = spinWheel;
  }

  window.RFTLucky = { loadLuckyPage, spinWheel, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
