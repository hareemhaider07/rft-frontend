/* ============================================================
   RFT Entertainment — Lucky Draw / Spin Wheel Module
   Canvas-based spinning wheel with prize animation
   ============================================================ */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let _prizes        = [];
  let _spinning      = false;
  let _canSpin       = false;
  let _currentAngle  = 0;     // radians — current rotation of wheel
  let _animFrame     = null;
  let _canvas        = null;
  let _ctx           = null;

  // ── Init page ──────────────────────────────────────────────────────────────
  async function loadLuckyPage() {
    _canvas = document.getElementById('spinCanvas');
    if (!_canvas) return;
    _ctx = _canvas.getContext('2d');
    // Retina display support
    const dpr = window.devicePixelRatio || 1;
    const size = 320;
    _canvas.width  = size * dpr;
    _canvas.height = size * dpr;
    _canvas.style.width  = size + 'px';
    _canvas.style.height = size + 'px';
    _ctx.scale(dpr, dpr);

    await loadPrizes();
    await loadHistory();
  }

  async function loadPrizes() {
    try {
      const r = await window.RFTApi?.get('/spin/prizes');

      if (!r?.success) {
        _prizes = WHEEL_PRIZES;
        drawWheel(0);
        renderPrizeGrid(WHEEL_PRIZES);
        const subEl = document.getElementById('spinSubText');
        if (subEl) subEl.textContent = 'Error: ' + (r?.message || 'API call failed');
        console.error('Spin prizes failed:', r);
        return;
      }
      _prizes   = WHEEL_PRIZES;   // always use 8 unique segments for the wheel
      _canSpin  = r.data.can_spin;

      // Update status bar
      const countEl = document.getElementById('spinCountBadge');
      const subEl   = document.getElementById('spinSubText');
      const btn     = document.getElementById('spinBtn');

      if (countEl) countEl.textContent = r.data.spins_remaining;
      if (subEl) {
        subEl.textContent = r.data.can_spin
          ? `${r.data.spins_used} of ${r.data.spins_allowed} spins used today`
          : 'All spins used — come back tomorrow!';
      }
      if (btn) {
        btn.disabled = !_canSpin || _spinning;
        btn.style.opacity = _canSpin ? '1' : '0.5';
      }

      // Draw the wheel
      drawWheel(0);
      // Render prize grid
      renderPrizeGrid(_prizes);

      // If already spun today, show last result dimmed
      if (r.data.last_spin) {
        showLastSpin(r.data.last_spin);
      }
    } catch (e) {
      console.error('loadPrizes error:', e);
      _prizes = WHEEL_PRIZES;
      drawWheel(0);
      renderPrizeGrid(WHEEL_PRIZES);
      const subEl = document.getElementById('spinSubText');
      if (subEl) subEl.textContent = 'Error loading prizes: ' + e.message;
    }
  }

  // ── 8 unique wheel prizes (display only — one segment each) ─────────────
  const WHEEL_PRIZES = [
    { id: 'w1', name: 'Rs. 140',    color: '#E63946', prize_type: 'usdt',   prize_value: '0.5',  probability: '0.05' },
    { id: 'w2', name: 'Rs. 280',    color: '#d4a843', prize_type: 'usdt',   prize_value: '1.0',  probability: '0.02' },
    { id: 'w3', name: 'Rs. 28',     color: '#2A9D8F', prize_type: 'usdt',   prize_value: '0.1',  probability: '0.20' },
    { id: 'w4', name: 'Rs. 56',     color: '#457B9D', prize_type: 'usdt',   prize_value: '0.2',  probability: '0.10' },
    { id: 'w5', name: '50 Points',  color: '#1D3557', prize_type: 'points', prize_value: '50',   probability: '0.15' },
    { id: 'w6', name: '100 Points', color: '#6A0572', prize_type: 'points', prize_value: '100',  probability: '0.10' },
    { id: 'w7', name: '20 Points',  color: '#2196F3', prize_type: 'points', prize_value: '20',   probability: '0.25' },
    { id: 'w8', name: 'Try Again',  color: '#555555', prize_type: 'empty',  prize_value: '0',    probability: '0.13' }
  ];
  function drawWheel(rotationAngle) {
    if (!_ctx || !_prizes.length) return;
    const cx = 160, cy = 160, radius = 148;
    const segAngle = (2 * Math.PI) / _prizes.length;
    _ctx.clearRect(0, 0, 320, 320);

    _prizes.forEach((prize, i) => {
      const startAngle = rotationAngle + i * segAngle - Math.PI / 2;
      const endAngle   = startAngle + segAngle;

      // Segment fill
      _ctx.beginPath();
      _ctx.moveTo(cx, cy);
      _ctx.arc(cx, cy, radius, startAngle, endAngle);
      _ctx.closePath();
      _ctx.fillStyle = prize.color;
      _ctx.fill();

      // Segment border
      _ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      _ctx.lineWidth = 1.5;
      _ctx.stroke();

      // Prize label — show PKR instead of USDT
      _ctx.save();
      _ctx.translate(cx, cy);
      _ctx.rotate(startAngle + segAngle / 2);
      _ctx.textAlign = 'right';
      _ctx.fillStyle = '#ffffff';
      _ctx.font = 'bold 10px Inter, sans-serif';
      _ctx.shadowColor = 'rgba(0,0,0,0.5)';
      _ctx.shadowBlur  = 3;
      // Convert USDT prize name to PKR for wheel display
      let label = prize.name;
      if (prize.prize_type === 'usdt') {
        label = 'Rs.' + Math.round(parseFloat(prize.prize_value) * 280).toLocaleString('en-PK');
      }
      _ctx.fillText(label, radius - 8, 4);
      _ctx.restore();
    });

    // Outer ring
    _ctx.beginPath();
    _ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    _ctx.strokeStyle = 'rgba(212,168,67,0.6)';
    _ctx.lineWidth = 3;
    _ctx.stroke();

    // Center circle
    _ctx.beginPath();
    _ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    _ctx.fillStyle = '#1a1a1a';
    _ctx.fill();
    _ctx.strokeStyle = '#d4a843';
    _ctx.lineWidth = 2;
    _ctx.stroke();
  }

  // ── Spin animation ─────────────────────────────────────────────────────────
  async function doSpin() {
    if (_spinning || !_canSpin || !_prizes.length) return;
    _spinning = true;

    const btn = document.getElementById('spinBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

    // Call API first to get the actual result
    let result = null;
    try {
      const r = await window.RFTApi?.post('/spin/spin', {});
      if (!r?.success) {
        window.RFTCore?.showToast(r?.message || 'Spin failed', 'error');
        _spinning = false;
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        return;
      }
      result = r.data;
    } catch (e) {
      window.RFTCore?.showToast('Network error. Try again.', 'error');
      _spinning = false;
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      return;
    }

    // Map API result to one of the 8 wheel segments by prize_type
    let winnerIndex = 7; // default to "Try Again"
    if (result.prize.prize_type === 'usdt') {
      const pkr = Math.round(parseFloat(result.prize.prize_value) * 280);
      if (pkr >= 280)      winnerIndex = 1; // Rs. 280
      else if (pkr >= 140) winnerIndex = 0; // Rs. 140
      else if (pkr >= 56)  winnerIndex = 3; // Rs. 56
      else                 winnerIndex = 2; // Rs. 28
    } else if (result.prize.prize_type === 'points') {
      const pts = parseInt(result.prize.prize_value);
      if (pts >= 100)     winnerIndex = 5; // 100 Points
      else if (pts >= 50) winnerIndex = 4; // 50 Points
      else                winnerIndex = 6; // 20 Points
    }
    const segAngle    = (2 * Math.PI) / _prizes.length;

    // Target angle: spin 5-8 full rotations + land on winner segment
    // The pointer is at top (12 o'clock = -π/2)
    // Winner should end up pointing to top
    const targetSegCenter = winnerIndex * segAngle + segAngle / 2;
    const fullSpins       = (5 + Math.floor(Math.random() * 4)) * 2 * Math.PI;
    const targetAngle     = fullSpins + (2 * Math.PI - targetSegCenter);

    const startAngle  = _currentAngle;
    const totalChange = targetAngle;
    const duration    = 4000 + Math.random() * 1000; // 4-5 seconds
    const startTime   = performance.now();

    function easeOut(t) {
      // Cubic ease-out for smooth deceleration
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOut(progress);
      _currentAngle  = startAngle + totalChange * eased;

      drawWheel(_currentAngle % (2 * Math.PI));

      if (progress < 1) {
        _animFrame = requestAnimationFrame(animate);
      } else {
        // Animation complete
        _spinning = false;
        _canSpin  = result.can_spin;
        showResult(result);
        // Update spin count
        loadPrizes();
        loadHistory();
        // Update home balance display
        window.RFTTaskEngine?.refreshHomeBalance?.();
      }
    }

    _animFrame = requestAnimationFrame(animate);
  }

  // ── Show prize result ──────────────────────────────────────────────────────
  function showResult(result) {
    const card  = document.getElementById('spinResultCard');
    const icon  = document.getElementById('srcIcon');
    const title = document.getElementById('srcTitle');
    const val   = document.getElementById('srcValue');
    const sub   = document.getElementById('srcSub');
    if (!card) return;

    const prize = result.prize;

    if (prize.prize_type === 'empty') {
      if (icon)  icon.textContent  = '😔';
      if (title) title.textContent = 'Better Luck Next Time!';
      if (val)   val.textContent   = 'Try Again Tomorrow';
      if (sub)   sub.textContent   = result.spins_remaining > 0
        ? `You have ${result.spins_remaining} spin(s) left today`
        : '';
      card.style.display = 'block';
      card.className = 'spin-result-card src-empty';
    } else {
      const isUsdt = prize.prize_type === 'usdt';
      if (icon)  icon.textContent  = isUsdt ? '💰' : '⭐';
      if (title) title.textContent = '🎉 Congratulations!';
      if (val)   val.textContent   = prize.name;
      if (sub) {
        if (isUsdt) {
          sub.textContent = `Rs. ${prize.prize_value_pkr} credited to your wallet`;
        } else {
          sub.textContent = `${prize.prize_value} points added to your account`;
        }
      }
      card.style.display = 'block';
      card.className = 'spin-result-card src-win';
      // Confetti burst
      triggerConfetti();
    }

    // Scroll to result
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.RFTCore?.showToast(
      prize.prize_type === 'empty' ? 'Better luck next time!' : `You won ${prize.name}!`,
      prize.prize_type === 'empty' ? 'info' : 'success'
    );
  }

  function showLastSpin(last) {
    // subtle indication that today's spin was already used
    const sub = document.getElementById('spinSubText');
    if (sub && last.prize_type !== 'empty') {
      sub.textContent = `Last win: ${last.prize_name}`;
    }
  }

  function dismissResult() {
    const card = document.getElementById('spinResultCard');
    if (card) card.style.display = 'none';
  }

  // ── Prize grid — PKR display only ─────────────────────────────────────────
  function renderPrizeGrid(prizes) {
    const el = document.getElementById('spinPrizeGrid');
    if (!el) return;
    const PKR = 280;
    el.innerHTML = prizes.map(p => {
      let displayName = p.name;
      // Convert USDT values to PKR in the display name
      if (p.prize_type === 'usdt') {
        const pkrAmt = Math.round(parseFloat(p.prize_value) * PKR);
        displayName = 'Rs. ' + pkrAmt.toLocaleString('en-PK');
      }
      return `
        <div class="spg-item">
          <div class="spg-dot" style="background:${p.color}"></div>
          <div class="spg-name">${displayName}</div>
          <div class="spg-prob">${(parseFloat(p.probability) * 100).toFixed(0)}%</div>
        </div>
      `;
    }).join('');
  }

  // ── Spin history ───────────────────────────────────────────────────────────
  async function loadHistory() {
    const el = document.getElementById('spinHistoryList');
    if (!el) return;
    try {
      const r = await window.RFTApi?.get('/spin/history?limit=10');
      if (!r?.success || !r.data.length) {
        el.innerHTML = '<div class="tx-loading">No spins yet — give it a try!</div>';
        return;
      }
      const typeIcon = { usdt: '💰', points: '⭐', empty: '😔' };
      const PKR_RATE = 280;
      el.innerHTML = r.data.map(h => `
        <div class="spin-hist-row ${h.prize_type === 'empty' ? 'shr-empty' : 'shr-win'}">
          <div class="shr-icon">${typeIcon[h.prize_type] || '🎡'}</div>
          <div class="shr-info">
            <div class="shr-name">${
              h.prize_type === 'usdt'
                ? 'Rs. ' + Math.round(parseFloat(h.prize_value) * PKR_RATE).toLocaleString('en-PK')
                : h.prize_type === 'points'
                  ? h.prize_value + ' Points'
                  : 'Try Again'
            }</div>
            <div class="shr-date">${fmtDate(h.created_at)}</div>
          </div>
          <div class="shr-val ${h.prize_type === 'empty' ? '' : 'shr-val-win'}">
            ${h.prize_type === 'usdt'   ? '+Rs. ' + Math.round(parseFloat(h.prize_value) * PKR_RATE).toLocaleString('en-PK') :
              h.prize_type === 'points' ? '+' + h.prize_value + ' pts' : '—'}
          </div>
        </div>
      `).join('');
    } catch (_) {
      el.innerHTML = '<div class="tx-loading">Error loading history</div>';
    }
  }

  // ── Confetti burst ─────────────────────────────────────────────────────────
  function triggerConfetti() {
    const container = document.querySelector('.main-container');
    if (!container) return;
    const colors = ['#d4a843','#22c55e','#3b82f6','#ef4444','#a855f7','#06b6d4'];
    for (let i = 0; i < 40; i++) {
      const dot = document.createElement('div');
      dot.className = 'confetti-dot';
      dot.style.cssText = `
        position:absolute;
        width:${4 + Math.random()*6}px;
        height:${4 + Math.random()*6}px;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        border-radius:50%;
        left:${20 + Math.random()*60}%;
        top:${30 + Math.random()*20}%;
        animation:confettiFall ${1 + Math.random()*2}s ease-out forwards;
        pointer-events:none;
        z-index:9999;
      `;
      container.appendChild(dot);
      setTimeout(() => dot.remove(), 3000);
    }
  }

  function fmtDate(d) {
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

  function init() {
    document.addEventListener('rft:page:luckyPage', loadLuckyPage);
    window.RFTSpin = { loadLuckyPage, doSpin, dismissResult, loadHistory };
  }

  window.RFTSpin = { loadLuckyPage, doSpin, dismissResult, loadHistory, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
