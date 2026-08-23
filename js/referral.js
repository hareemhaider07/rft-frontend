/* ============================================================
   RFT Entertainment — Referral & Team Module
   ============================================================ */
(function () {
  'use strict';

  let currentTeamLevel = 1;

  async function loadReferralPage() {
    await loadReferralInfo();
    await loadTeamTab(1);
  }

  async function loadReferralInfo() {
    const card = document.getElementById('referralLinkCard');
    if (!card) return;
    try {
      const r = await window.RFTApi.get('/referral/info');
      if (!r.success) { card.innerHTML = '<div class="rlc-loading">Failed to load</div>'; return; }
      const d = r.data;
      card.innerHTML = `
        <div class="rlc-title">Your Referral Link</div>
        <div class="rlc-link-row">
          <div class="rlc-link" id="referralLinkText">${d.referral_link}</div>
          <button class="copy-btn" onclick="copyText('referralLinkText')"><i class="ph-bold ph-copy"></i></button>
        </div>
        <div class="rlc-code-row">
          Code: <strong id="referralCodeText">${d.referral_code}</strong>
          <button class="copy-btn" onclick="copyText('referralCodeText')"><i class="ph-bold ph-copy"></i></button>
        </div>
        <div class="rlc-share-row">
          <button class="rlc-share-btn" onclick="shareReferral('${d.referral_link}')">
            <i class="ph-bold ph-share-network"></i> Share Link
          </button>
          <button class="rlc-share-btn whatsapp" onclick="shareWhatsapp('${d.referral_link}')">
            <i class="ph-bold ph-whatsapp-logo"></i> WhatsApp
          </button>
        </div>
        <div class="rlc-stats">
          <div class="rlc-stat"><div class="rlc-stat-val">${d.team_count.total}</div><div class="rlc-stat-label">Total Team</div></div>
          <div class="rlc-stat"><div class="rlc-stat-val">${d.team_count.level1}</div><div class="rlc-stat-label">Level 1</div></div>
          <div class="rlc-stat"><div class="rlc-stat-val">${d.team_count.level2}</div><div class="rlc-stat-label">Level 2</div></div>
          <div class="rlc-stat"><div class="rlc-stat-val">${d.team_count.level3}</div><div class="rlc-stat-label">Level 3</div></div>
        </div>
        <div class="rlc-commission">
          <div class="rlc-comm-title">Total Commissions Earned</div>
          <div class="rlc-comm-val">${d.total_commission_usdt} USDT</div>
          <div class="rlc-comm-pkr">≈ Rs. ${Number(d.total_commission_pkr).toLocaleString()}</div>
        </div>
        <div class="rlc-rates">
          <div class="rlc-rate"><span>L1 Commission</span><strong>${d.commission_rates.level1}</strong></div>
          <div class="rlc-rate"><span>L2 Commission</span><strong>${d.commission_rates.level2}</strong></div>
          <div class="rlc-rate"><span>L3 Commission</span><strong>${d.commission_rates.level3}</strong></div>
        </div>
      `;
    } catch (e) {
      card.innerHTML = '<div class="rlc-loading">Error loading referral info</div>';
    }
  }

  async function loadTeamTab(level, tabEl) {
    currentTeamLevel = level;
    // update active tab
    if (tabEl) {
      document.querySelectorAll('#referralPage .tx-tab').forEach(t => t.classList.remove('active'));
      tabEl.classList.add('active');
    }
    const list = document.getElementById('teamList');
    if (!list) return;
    list.innerHTML = '<div class="tx-loading">Loading…</div>';
    try {
      const r = await window.RFTApi.get(`/referral/team?level=${level}`);
      if (!r.success || !r.data.members.length) {
        list.innerHTML = `<div class="team-empty"><i class="ph-bold ph-users"></i><p>No Level ${level} members yet</p><small>Share your referral link to grow your team</small></div>`;
        return;
      }
      list.innerHTML = r.data.members.map(m => `
        <div class="team-member-row">
          <div class="tmr-avatar">${(m.name||'U').charAt(0).toUpperCase()}</div>
          <div class="tmr-info">
            <div class="tmr-name">${m.name||'—'}</div>
            <div class="tmr-phone">${m.phone}</div>
          </div>
          <div class="tmr-right">
            <div class="tmr-vip">VIP ${m.vip_level||0}</div>
            <div class="tmr-comm">+${m.total_commission_usdt} USDT</div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = '<div class="tx-loading">Error loading team</div>';
    }
  }

  function shareReferral(link) {
    if (navigator.share) {
      navigator.share({ title: 'Join RFT Entertainment', text: 'Earn USDT by watching videos! Use my referral link:', url: link })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(link).then(() => {
        window.RFTCore?.showToast('Referral link copied!', 'success');
      });
    }
  }

  function shareWhatsapp(link) {
    const msg = encodeURIComponent(`🎬 Join RFT Entertainment and earn USDT daily! Watch videos, complete tasks, and withdraw easily.\n\n🔗 Register here: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  function init() {
    document.addEventListener('rft:page:referralPage', loadReferralPage);
    // expose loadTeamTab globally for inline onclick
    window.loadTeamTab = loadTeamTab;
  }

  window.RFTReferral = { loadReferralPage, loadReferralInfo, loadTeamTab, shareReferral, shareWhatsapp, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
