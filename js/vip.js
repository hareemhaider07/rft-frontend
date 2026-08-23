/* ============================================================
   RFT Entertainment — VIP Module
   ============================================================ */
(function () {
  'use strict';

  const VIP_COLORS = ['#888888','#CD7F32','#C0C0C0','#FFD700','#E5E4E2','#B9F2FF'];
  const VIP_ICONS  = ['ph-star','ph-star-half','ph-star-fill','ph-crown-simple','ph-crown','ph-diamonds-four'];

  async function loadVipPage() {
    await Promise.all([loadVipStatus(), loadVipLevels()]);
  }

  async function loadVipStatus() {
    const card = document.getElementById('vipStatusCard');
    if (!card) return;
    try {
      const r = await window.RFTApi.get('/vip/status');
      if (!r.success) { card.innerHTML = '<div class="vsc-loading">Failed to load</div>'; return; }
      const d = r.data;
      const cur = d.current_vip || {};
      const nxt = d.next_vip;
      const color = VIP_COLORS[d.current_level] || '#888';
      card.innerHTML = `
        <div class="vsc-top">
          <div class="vsc-badge" style="background:${color}22;color:${color}">
            <i class="ph-bold ${VIP_ICONS[d.current_level]||'ph-star'}"></i>
          </div>
          <div class="vsc-info">
            <div class="vsc-level" style="color:${color}">${cur.name || 'VIP 0'}</div>
            <div class="vsc-deposited">Total deposited: <strong>${d.total_deposited_usdt} USDT</strong></div>
          </div>
        </div>
        ${nxt ? `
        <div class="vsc-progress-label">
          Progress to ${nxt.name}
          <span>${d.progress_pct}%</span>
        </div>
        <div class="vsc-progress-bar">
          <div class="vsc-progress-fill" style="width:${d.progress_pct}%;background:${VIP_COLORS[(d.current_level+1)]||'#d4a843'}"></div>
        </div>
        <div class="vsc-progress-sub">Need ${d.needed_for_next_usdt} more USDT to reach ${nxt.name}</div>
        ` : '<div class="vsc-max">🎉 You have reached the highest VIP level!</div>'}
        <div class="vsc-perks">
          <div class="vsc-perk"><i class="ph-bold ph-play-circle"></i><span>${cur.daily_task_limit === 0 ? 'Unlimited' : cur.daily_task_limit} tasks/day</span></div>
          <div class="vsc-perk"><i class="ph-bold ph-coins"></i><span>${cur.task_reward_usdt} USDT/task</span></div>
          <div class="vsc-perk"><i class="ph-bold ph-users-three"></i><span>${(parseFloat(cur.level1_commission_rate||0)*100).toFixed(0)}% L1 commission</span></div>
        </div>
      `;
    } catch (e) {
      card.innerHTML = '<div class="vsc-loading">Error loading VIP status</div>';
    }
  }

  async function loadVipLevels() {
    const list = document.getElementById('vipLevelsList');
    if (!list) return;
    try {
      const r = await window.RFTApi.get('/vip/levels');
      if (!r.success) return;
      const user = window.RFTCore.getCurrentUser();
      const currentLevel = user?.vip_level || 0;
      list.innerHTML = r.data.map(v => {
        const color = VIP_COLORS[v.level] || '#888';
        const isCurrent = v.level === currentLevel;
        const isUnlocked = v.level <= currentLevel;
        return `
          <div class="vip-level-card ${isCurrent ? 'vip-level-current' : ''} ${isUnlocked ? 'vip-level-unlocked' : ''}">
            <div class="vlc-head">
              <div class="vlc-badge" style="background:${color}22;color:${color}">
                <i class="ph-bold ${VIP_ICONS[v.level]||'ph-star'}"></i>
              </div>
              <div class="vlc-title">
                <strong style="color:${color}">${v.name}</strong>
                <small>Deposit ${v.required_deposit_usdt} USDT</small>
              </div>
              ${isCurrent ? '<span class="vlc-current-tag">Current</span>' : ''}
              ${isUnlocked && !isCurrent ? '<span class="vlc-unlocked-tag">✓ Unlocked</span>' : ''}
            </div>
            <div class="vlc-perks">
              <div class="vlc-perk"><i class="ph-bold ph-play-circle"></i>${v.daily_task_limit===0?'Unlimited':v.daily_task_limit} tasks/day</div>
              <div class="vlc-perk"><i class="ph-bold ph-coins"></i>${v.task_reward_usdt} USDT per task</div>
              <div class="vlc-perk"><i class="ph-bold ph-gift"></i>${v.referral_bonus_usdt} USDT referral bonus</div>
              <div class="vlc-perk"><i class="ph-bold ph-users-three"></i>L1: ${(v.level1_commission_rate*100).toFixed(0)}% / L2: ${(v.level2_commission_rate*100).toFixed(0)}% / L3: ${(v.level3_commission_rate*100).toFixed(0)}%</div>
              <div class="vlc-perk"><i class="ph-bold ph-arrow-up-right"></i>Min withdraw: ${v.min_withdraw_usdt} USDT</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      list.innerHTML = '<div class="vsc-loading">Error loading levels</div>';
    }
  }

  function init() {
    document.addEventListener('rft:page:vipPage', loadVipPage);
  }

  window.RFTVip = { loadVipPage, loadVipStatus, loadVipLevels, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
