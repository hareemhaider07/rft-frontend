/* ============================================================
   RFT Entertainment — Leaderboard Module
   Multi-tab rankings: weekly, monthly, tasks, referrals, spin
   ============================================================ */
(function () {
  'use strict';

  const TAB_DESCRIPTIONS = {
    weekly:    'Top USDT earners this week (task rewards)',
    monthly:   'Top USDT earners this month',
    tasks:     'Most tasks completed all time',
    referrals: 'Most members referred',
    spin:      'Biggest lucky draw winners'
  };

  const VIP_COLORS = ['#888888','#CD7F32','#C0C0C0','#FFD700','#E5E4E2','#B9F2FF'];
  const VIP_LABELS = ['VIP 0','VIP 1','VIP 2','VIP 3','VIP 4','VIP 5'];

  let _currentType = 'weekly';
  let _loading     = false;

  async function loadPage() {
    await load('weekly');
  }

  async function load(type, tabEl) {
    if (_loading) return;
    _loading = true;
    _currentType = type;

    // update active tab
    if (tabEl) {
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      tabEl.classList.add('active');
    } else {
      document.querySelectorAll('.lb-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === type);
      });
    }

    // description
    const descEl = document.getElementById('lbDescription');
    if (descEl) descEl.textContent = TAB_DESCRIPTIONS[type] || '';

    // show skeleton
    const listEl = document.getElementById('lbList');
    if (listEl) listEl.innerHTML = renderSkeleton();

    const podiumEl = document.getElementById('lbPodium');
    if (podiumEl) podiumEl.innerHTML = '';

    // spin refresh button
    const btn = document.getElementById('lbRefreshBtn');
    if (btn) btn.classList.add('spinning');

    try {
      const r = await window.RFTApi?.get(`/user/leaderboard?type=${type}&limit=20`);
      if (!r?.success) {
        if (listEl) listEl.innerHTML = '<div class="tx-loading">Failed to load — try again</div>';
        return;
      }

      const { leaders, my_rank, generated_at } = r.data;

      // My rank banner
      const myRankEl  = document.getElementById('lbMyRank');
      const myRankNum = document.getElementById('lbMyRankNum');
      if (myRankEl && my_rank) {
        myRankNum.textContent = '#' + my_rank;
        myRankEl.style.display = 'flex';
      } else if (myRankEl) {
        myRankEl.style.display = 'none';
      }

      // Podium (top 3)
      if (podiumEl) renderPodium(podiumEl, leaders.slice(0, 3));

      // Full list (positions 4+)
      if (listEl) {
        if (!leaders.length) {
          listEl.innerHTML = `
            <div class="lb-empty">
              <i class="ph-bold ph-trophy"></i>
              <p>No data yet</p>
              <small>Be the first to appear on the leaderboard!</small>
            </div>`;
        } else {
          const rest = leaders.slice(3);
          listEl.innerHTML = rest.length
            ? rest.map(l => renderRow(l)).join('')
            : '<div class="lb-empty-rest">Top 3 shown above</div>';
        }
      }

      // Last updated
      const updEl = document.getElementById('lbUpdated');
      if (updEl && generated_at) {
        updEl.textContent = 'Updated ' + fmtTime(generated_at);
      }

    } catch (e) {
      if (listEl) listEl.innerHTML = '<div class="tx-loading">Error loading leaderboard</div>';
    } finally {
      _loading = false;
      if (btn) btn.classList.remove('spinning');
    }
  }

  function renderPodium(el, top3) {
    if (!top3.length) { el.innerHTML = ''; return; }

    // Podium order: 2nd, 1st, 3rd
    const order = [top3[1], top3[0], top3[2]].filter(Boolean);
    const positions = top3[1] ? [2, 1, 3] : [1];
    const heights   = ['70px', '90px', '60px'];
    const medals    = ['🥈', '🥇', '🥉'];
    const podiumOrder = top3[1]
      ? [top3[1], top3[0], top3[2]].filter(Boolean)
      : [top3[0]];
    const posLabels = top3[1] ? [2, 1, 3] : [1];

    el.innerHTML = `
      <div class="lb-podium-inner">
        ${podiumOrder.map((leader, i) => {
          const pos = posLabels[i];
          const h   = heights[i] || '60px';
          const medal = medals[i] || '';
          const color = VIP_COLORS[leader.vip_level] || '#888';
          return `
            <div class="lb-podium-slot lb-pos-${pos}">
              <div class="lb-podium-avatar" style="border-color:${color}">
                ${leader.display_name.charAt(0).toUpperCase()}
              </div>
              <div class="lb-podium-name">${leader.display_name}</div>
              <div class="lb-podium-score">${leader.score_label}</div>
              <div class="lb-podium-vip" style="color:${color}">${VIP_LABELS[leader.vip_level]}</div>
              <div class="lb-podium-block" style="height:${h};background:${rankColor(pos)}">
                <span class="lb-podium-rank">${medal || '#'+pos}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderRow(leader) {
    const color = VIP_COLORS[leader.vip_level] || '#888';
    const rankColors = { 1:'#FFD700', 2:'#C0C0C0', 3:'#CD7F32' };
    const rc = rankColors[leader.rank] || 'var(--text-muted)';
    return `
      <div class="lb-row">
        <div class="lb-row-rank" style="color:${rc}">#${leader.rank}</div>
        <div class="lb-row-avatar" style="border-color:${color}">
          ${leader.display_name.charAt(0).toUpperCase()}
        </div>
        <div class="lb-row-info">
          <div class="lb-row-name">${leader.display_name}</div>
          <div class="lb-row-vip" style="color:${color}">${VIP_LABELS[leader.vip_level]}</div>
        </div>
        <div class="lb-row-score">
          <div class="lb-row-val">${leader.score_label}</div>
          ${leader.score_pkr ? `<div class="lb-row-pkr">Rs. ${Number(leader.score_pkr).toLocaleString()}</div>` : ''}
        </div>
      </div>
    `;
  }

  function rankColor(pos) {
    return pos === 1 ? '#d4a843' : pos === 2 ? '#888' : '#8B6B2B';
  }

  function renderSkeleton() {
    return Array.from({ length: 5 }).map(() => `
      <div class="lb-row lb-skeleton">
        <div class="skel skel-rank"></div>
        <div class="skel skel-avatar"></div>
        <div class="lb-row-info">
          <div class="skel skel-name"></div>
          <div class="skel skel-vip"></div>
        </div>
        <div class="skel skel-score"></div>
      </div>
    `).join('');
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  }

  function refresh() { load(_currentType); }

  function init() {
    document.addEventListener('rft:page:leaderboardPage', loadPage);
    window.RFTLeaderboard = { loadPage, load, refresh };
  }

  window.RFTLeaderboard = { loadPage, load, refresh, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
