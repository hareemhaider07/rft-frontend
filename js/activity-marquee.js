/* ============================================================
   RFT Entertainment — Live Activity Marquee
   Simulates real-time platform activity on the home page
   ============================================================ */
(function () {
  'use strict';

  const avatarPool = [
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&h=80&q=70',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=80&h=80&q=70'
  ];

  let availableAvatars = [...avatarPool];

  function getUniqueAvatar() {
    if (availableAvatars.length === 0) availableAvatars = [...avatarPool];
    const i = Math.floor(Math.random() * availableAvatars.length);
    return availableAvatars.splice(i, 1)[0];
  }

  const prefixes = ['0300','0301','0302','0303','0304','0305','0306','0307',
                    '0308','0310','0312','0313','0315','0321','0333','0334','0340','0345'];

  const eventTypes = [
    {
      icon: '⭐',
      color: '#d4a843',
      descList: ['Activated VIP Bronze Plan','Upgraded to VIP Silver Plan',
                 'Activated VIP Gold Plan','Joined VIP Platinum Tier'],
      amounts: [3500, 7500, 15000, 30000, 50000],
      suffix: 'PKR'
    },
    {
      icon: '📹',
      color: '#22c55e',
      descList: ['Completed Daily Video Tasks','Earned Task Commission',
                 'Submitted Project Orders','Task Rating Bonus Claimed'],
      amounts: [240, 560, 1200, 2450, 4800],
      suffix: 'PKR'
    },
    {
      icon: '🎡',
      color: '#a855f7',
      descList: ['Lucky Draw Cash Reward','Won Spin Wheel Bonus',
                 'Lucky Spin Special Prize'],
      amounts: [150, 300, 800, 1500, 5000],
      suffix: 'PKR'
    },
    {
      icon: '💸',
      color: '#3b82f6',
      descList: ['Successful Withdrawal to Bank','Withdrew to Easypaisa',
                 'Withdrew to JazzCash','Withdrew via Raast'],
      amounts: [1200, 3400, 6800, 14500, 28000],
      suffix: 'PKR'
    },
    {
      icon: '👥',
      color: '#06b6d4',
      descList: ['Earned Referral Commission','Team Member Bonus Received',
                 'Level 1 Referral Reward'],
      amounts: [120, 280, 600, 1400, 3200],
      suffix: 'PKR'
    }
  ];

  function generateEvent() {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const end    = Math.floor(100 + Math.random() * 900);
    const user   = `${prefix}****${end}`;

    const group  = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const desc   = group.descList[Math.floor(Math.random() * group.descList.length)];
    const amount = group.amounts[Math.floor(Math.random() * group.amounts.length)];
    const secs   = Math.floor(Math.random() * 59) + 1;
    const timeStr = secs < 60 ? `${secs}s ago` : `${Math.floor(secs/60)}m ago`;

    return { user, desc, amount: amount.toLocaleString('en-PK'), avatar: getUniqueAvatar(),
             time: timeStr, icon: group.icon, color: group.color, suffix: group.suffix };
  }

  function createItemHTML(item) {
    return `<li class="activity-item">
      <div class="act-left">
        <img class="act-avatar" src="${item.avatar}" alt="" loading="lazy" onerror="this.src='https://placehold.co/36x36/1a1a1a/d4a843?text=${item.user.charAt(0)}'">
        <div class="act-info">
          <span class="act-user">${item.user}</span>
          <span class="act-desc"><span class="act-icon">${item.icon}</span> ${item.desc}</span>
        </div>
      </div>
      <div class="act-right">
        <span class="act-amount" style="color:${item.color}">+${item.amount} ${item.suffix}</span>
        <span class="act-time">${item.time}</span>
      </div>
    </li>`;
  }

  let scrollTimer = null;

  function startMarquee() {
    const listEl = document.getElementById('activityList');
    if (!listEl) return;

    // Clear any existing items + timer
    listEl.innerHTML = '';
    if (scrollTimer) clearInterval(scrollTimer);

    // Seed initial items
    for (let i = 0; i < 5; i++) {
      listEl.insertAdjacentHTML('beforeend', createItemHTML(generateEvent()));
    }

    const ITEM_HEIGHT = 64; // px — matches CSS .activity-item height

    function scrollNext() {
      listEl.style.transition = 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)';
      listEl.style.transform  = `translateY(-${ITEM_HEIGHT}px)`;

      setTimeout(() => {
        if (listEl.firstElementChild) listEl.firstElementChild.remove();
        listEl.insertAdjacentHTML('beforeend', createItemHTML(generateEvent()));
        listEl.style.transition = 'none';
        listEl.style.transform  = 'translateY(0)';
      }, 460);
    }

    scrollTimer = setInterval(scrollNext, 2400);
  }

  function stopMarquee() {
    if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null; }
  }

  function init() {
    // Start on home page, stop when navigating away to save resources
    document.addEventListener('rft:page:homePage', startMarquee);
    document.addEventListener('rft:auth:logout',   stopMarquee);

    // Also stop when navigating to any other page
    document.addEventListener('rft:page:tasksPage',         stopMarquee);
    document.addEventListener('rft:page:walletPage',         stopMarquee);
    document.addEventListener('rft:page:mypagePage',         stopMarquee);
    document.addEventListener('rft:page:luckyPage',          stopMarquee);
    document.addEventListener('rft:page:leaderboardPage',    stopMarquee);
  }

  window.RFTMarquee = { startMarquee, stopMarquee, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
