/* ============================================================
   RFT Entertainment — Leaderboard Module
   Multi-tab rankings: weekly, monthly, tasks, referrals, spin
   ============================================================ */
(function () {
  'use strict';

  const TAB_DESCRIPTIONS = {
    weekly:    'Top earners this week (task rewards in PKR)',
    monthly:   'Top earners this month (PKR)',
    tasks:     'Most tasks completed all time',
    referrals: 'Most members referred',
    spin:      'Biggest lucky draw winners (PKR)'
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

    if (tabEl) {
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      tabEl.classList.add('active');
    } else {
      document.querySelectorAll('.lb-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === type);
      });
    }

    const descEl = document.getElementById('lbDescription');
    if (descEl) descEl.textContent = TAB_DESCRIPTIONS[type] || '';

    const listEl   = document.getElementById('lbList');
    const podiumEl = document.getElementById('lbPodium');
    if (listEl)   listEl.innerHTML   = renderSkeleton();
    if (podiumEl) podiumEl.innerHTML = '';

    const btn = document.getElementById('lbRefreshBtn');
    if (btn) btn.classList.add('spinning');

    // Dummy data per type
    const DUMMY = {
      weekly: [
        { rank:1, display_name:'H***n',  vip_level:3, score:'14,200', score_label:'Rs. 14,200', score_pkr:'14200' },
        { rank:2, display_name:'A***d',  vip_level:2, score:'9,800',  score_label:'Rs. 9,800',  score_pkr:'9800'  },
        { rank:3, display_name:'M***a',  vip_level:2, score:'7,560',  score_label:'Rs. 7,560',  score_pkr:'7560'  },
        { rank:4, display_name:'F***a',  vip_level:1, score:'5,040',  score_label:'Rs. 5,040',  score_pkr:'5040'  },
        { rank:5, display_name:'Z***b',  vip_level:1, score:'3,920',  score_label:'Rs. 3,920',  score_pkr:'3920'  },
        { rank:6, display_name:'S***a',  vip_level:0, score:'2,800',  score_label:'Rs. 2,800',  score_pkr:'2800'  },
        { rank:7, display_name:'U***r',  vip_level:0, score:'2,240',  score_label:'Rs. 2,240',  score_pkr:'2240'  },
      ],
      monthly: [
        { rank:1, display_name:'H***n',  vip_level:3, score:'52,640', score_label:'Rs. 52,640', score_pkr:'52640' },
        { rank:2, display_name:'M***a',  vip_level:2, score:'38,920', score_label:'Rs. 38,920', score_pkr:'38920' },
        { rank:3, display_name:'A***d',  vip_level:2, score:'29,400', score_label:'Rs. 29,400', score_pkr:'29400' },
        { rank:4, display_name:'R***a',  vip_level:1, score:'18,760', score_label:'Rs. 18,760', score_pkr:'18760' },
        { rank:5, display_name:'K***n',  vip_level:1, score:'14,280', score_label:'Rs. 14,280', score_pkr:'14280' },
      ],
      tasks: [
        { rank:1, display_name:'A***d',  vip_level:2, score:'342', score_label:'342 tasks',  score_pkr:null },
        { rank:2, display_name:'H***n',  vip_level:3, score:'298', score_label:'298 tasks',  score_pkr:null },
        { rank:3, display_name:'S***a',  vip_level:1, score:'245', score_label:'245 tasks',  score_pkr:null },
        { rank:4, display_name:'Z***b',  vip_level:1, score:'210', score_label:'210 tasks',  score_pkr:null },
        { rank:5, display_name:'F***a',  vip_level:0, score:'187', score_label:'187 tasks',  score_pkr:null },
      ],
      referrals: [
        { rank:1, display_name:'H***n',  vip_level:3, score:'24', score_label:'24 referrals', score_pkr:null },
        { rank:2, display_name:'M***a',  vip_level:2, score:'18', score_label:'18 referrals', score_pkr:null },
        { rank:3, display_name:'A***d',  vip_level:2, score:'14', score_label:'14 referrals', score_pkr:null },
        { rank:4, display_name:'R***a',  vip_level:1, score:'9',  score_label:'9 referrals',  score_pkr:null },
        { rank:5, display_name:'U***r',  vip_level:0, score:'6',  score_label:'6 referrals',  score_pkr:null },
      ],
      spin: [
        { rank:1, display_name:'F***a',  vip_level:2, score:'3,920', score_label:'Rs. 3,920 won', score_pkr:'3920' },
        { rank:2, display_name:'Z***b',  vip_level:1, score:'2,800', score_label:'Rs. 2,800 won', score_pkr:'2800' },
        { rank:3, display_name:'K***n',  vip_level:1, score:'1,960', score_label:'Rs. 1,960 won', score_pkr:'1960' },
        { rank:4, display_name:'H***n',  vip_level:3, score:'1,400', score_label:'Rs. 1,400 won', score_pkr:'1400' },
        { rank:5, display_name:'S***a',  vip_level:0, score:'840',   score_label:'Rs. 840 won',   score_pkr:'840'  },
      ],
    };

    try {
      // Try real API first
      const r = await window.RFTApi?.get(`/user/leaderboard?type=${type}&limit=20`);
      let leaders = (r?.success && r.data.leaders?.length) ? r.data.leaders : (DUMMY[type] || DUMMY.weekly);
      const my_rank     = r?.data?.my_rank || null;
      const generated_at= r?.data?.generated_at || new Date().toISOString();

      // My rank banner
      const myRankEl  = document.getElementById('lbMyRank');
      const myRankNum = document.getElementById('lbMyRankNum');
      if (myRankEl) {
        if (my_rank) { myRankNum.textContent = '#' + my_rank; myRankEl.style.display = 'flex'; }
        else myRankEl.style.display = 'none';
      }

      if (podiumEl) renderPodium(podiumEl, leaders.slice(0, 3));

      if (listEl) {
        const rest = leaders.slice(3);
        listEl.innerHTML = rest.length
          ? rest.map(l => renderRow(l)).join('')
          : '<div class="lb-empty-rest">Top 3 shown above</div>';
      }

      const updEl = document.getElementById('lbUpdated');
      if (updEl) updEl.textContent = 'Updated ' + fmtTime(generated_at);

    } catch (e) {
      // Show dummy data on error
      const leaders = DUMMY[type] || DUMMY.weekly;
      if (podiumEl) renderPodium(podiumEl, leaders.slice(0, 3));
      if (listEl) {
        const rest = leaders.slice(3);
        listEl.innerHTML = rest.length ? rest.map(l => renderRow(l)).join('') : '';
      }
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
