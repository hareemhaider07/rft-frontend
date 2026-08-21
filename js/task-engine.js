/* ============================================
   RFT Entertainment - Task Engine JavaScript
   Video task engine, task hall, task management
   ============================================ */

(function() {
    'use strict';

    // ==================== TASK CONFIGURATION ====================

    const TASK_CONFIG = {
        dailyLimit: 10,
        rewardPerTask: 0.1, // USDT
        pkrRate: 280, // 1 USDT = 280 PKR
        taskTypes: ['youtube', 'tiktok', 'instagram', 'facebook']
    };

    // ==================== TASK DATA ====================

    /**
     * Get tasks from API
     */
    async function getTasksFromAPI() {
        try {
            const response = await window.RFTApi?.get('/tasks');
            if (response.success && response.data) {
                return response.data;
            }
            return { tasks: [], stats: { completed_today: 0, remaining_today: TASK_CONFIG.dailyLimit, daily_limit: TASK_CONFIG.dailyLimit } };
        } catch (error) {
            console.error('Get tasks error:', error);
            return { tasks: [], stats: { completed_today: 0, remaining_today: TASK_CONFIG.dailyLimit, daily_limit: TASK_CONFIG.dailyLimit } };
        }
    }

    // ==================== TASK MANAGEMENT ====================

    /**
     * Get available tasks
     */
    async function getAvailableTasks() {
        const data = await getTasksFromAPI();
        return data.tasks || [];
    }

    /**
     * Complete task
     */
    async function completeTask(taskId) {
        try {
            const response = await window.RFTApi?.post(`/tasks/${taskId}/complete`, {
                session_id: 'session_' + Date.now(),
                watch_duration_seconds: 150
            });

            if (response.success) {
                window.RFTCore?.showToast?.(`Task completed! +${response.data.reward_usdt} USDT`, 'success');
                
                // Update user balance in local state
                const user = window.RFTCore?.getCurrentUser();
                if (user) {
                    window.RFTCore?.setCurrentUser({
                        ...user,
                        balance_usdt: response.data.new_balance_usdt
                    });
                }

                return { success: true, ...response.data };
            }

            return { success: false, message: response.message || 'Task completion failed' };
        } catch (error) {
            console.error('Complete task error:', error);
            return { success: false, message: error.message || 'Task completion failed' };
        }
    }

    /**
     * Get task statistics
     */
    async function getTaskStats() {
        const data = await getTasksFromAPI();
        return {
            total: data.tasks?.length || 0,
            today: data.stats?.completed_today || 0,
            remaining: data.stats?.remaining_today || TASK_CONFIG.dailyLimit,
            daily_limit: data.stats?.daily_limit || TASK_CONFIG.dailyLimit
        };
    }

    // ==================== TASK HALL UI ====================

    /**
     * Render task hall
     */
    function renderTaskHall() {
        const container = document.getElementById('rftTaskHall');
        if (!container) return;

        const tasks = getAvailableTasks();
        const stats = getTaskStats();

        // Update stats
        const statsContainer = container.querySelector('.rft-task-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="rft-task-stat-card rft-task-stat-done">
                    <div class="rft-task-stat-value">${stats.today}</div>
                    <div class="rft-task-stat-label">Completed</div>
                </div>
                <div class="rft-task-stat-card rft-task-stat-left">
                    <div class="rft-task-stat-value">${stats.remaining}</div>
                    <div class="rft-task-stat-label">Remaining</div>
                </div>
            `;
        }

        // Render tasks
        const taskList = container.querySelector('.rft-task-list');
        if (taskList) {
            taskList.innerHTML = tasks.map(task => `
                <div class="rft-engine-task-card" data-task-id="${task.id}">
                    <div class="rft-engine-card-main">
                        <div class="rft-engine-poster-wrap">
                            <img src="${task.thumbnail}" alt="${task.title}">
                            <button class="rft-engine-play" onclick="RFTTaskEngine.startTask('${task.id}')">
                                <i class="ph-bold ph-play"></i>
                            </button>
                        </div>
                        <div class="rft-engine-card-body">
                            <div class="rft-engine-card-top">
                                <strong>${task.title}</strong>
                                <div class="rft-engine-meta">
                                    <span>${task.duration}</span>
                                    <span>${task.type}</span>
                                </div>
                            </div>
                            <div class="rft-engine-bottom">
                                <span>Reward:</span>
                                <em>${task.reward} USDT (${task.rewardPKR} PKR)</em>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    /**
     * Start task
     */
    function startTask(taskId) {
        const task = getSampleTasks().find(t => t.id === taskId);
        if (!task) return;

        // Show task preview modal
        const modal = document.getElementById('rftTaskPreview');
        if (modal) {
            modal.innerHTML = `
                <div class="rft-task-preview-content">
                    <button class="rft-task-preview-close" onclick="RFTTaskEngine.closeTaskPreview()">
                        <i class="ph-bold ph-x"></i>
                    </button>
                    <div class="rft-task-preview-video">
                        <img src="${task.thumbnail}" alt="${task.title}">
                        <div class="rft-task-preview-overlay">
                            <button class="rft-task-preview-play" onclick="RFTTaskEngine.playTask('${task.id}')">
                                <i class="ph-bold ph-play"></i>
                            </button>
                        </div>
                    </div>
                    <div class="rft-task-preview-info">
                        <h3>${task.title}</h3>
                        <p>${task.description}</p>
                        <div class="rft-task-preview-meta">
                            <span><i class="ph-bold ph-clock"></i> ${task.duration}</span>
                            <span><i class="ph-bold ph-coins"></i> ${task.reward} USDT (${task.rewardPKR} PKR)</span>
                        </div>
                    </div>
                </div>
            `;
            modal.classList.add('show');
        }
    }

    /**
     * Play task (simulate)
     */
    function playTask(taskId) {
        // Simulate task completion
        setTimeout(() => {
            completeTask(taskId);
            closeTaskPreview();
            renderTaskHall();
        }, 3000);
    }

    /**
     * Close task preview
     */
    function closeTaskPreview() {
        const modal = document.getElementById('rftTaskPreview');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // ==================== MEMBER RANKINGS ====================

    /**
     * Render member rankings
     */
    function renderMemberRankings() {
        const container = document.getElementById('rftVideoMemberRank');
        if (!container) return;

        const rankings = [
            { id: 'RFT4821', name: '•••821', activity: 'Weekly activity', reward: '0.80 USDT' },
            { id: 'RFT7316', name: '•••316', activity: 'Weekly activity', reward: '0.40 USDT' },
            { id: 'RFT9134', name: '•••134', activity: 'Weekly activity', reward: '1.68 USDT' },
            { id: 'RFT2057', name: '•••057', activity: 'Weekly activity', reward: '0.24 USDT' },
            { id: 'RFT6543', name: '•••543', activity: 'Weekly activity', reward: '2.62 USDT' }
        ];

        container.innerHTML = `
            <div class="rft-video-member-rank-head">
                <span>Member Rankings</span>
                <span>Weekly Activity</span>
            </div>
            ${rankings.map((rank, index) => `
                <div class="rft-video-member-row">
                    <div class="avatar">${rank.id.slice(-2)}</div>
                    <div class="name">
                        Congratulations ${rank.name}
                        <small style="display:block;color:#6e6e73;font-size:7px">${rank.activity}</small>
                    </div>
                    <div class="reward">${rank.reward}</div>
                </div>
            `).join('')}
        `;
    }

    // ==================== INITIALIZATION ====================

    function init() {
        // Listen for page changes
        document.addEventListener('rft:render', () => {
            renderTaskHall();
            renderMemberRankings();
        });

        // Initial render
        if (document.getElementById('rftTaskHall')) {
            renderTaskHall();
        }
        
        if (document.getElementById('rftVideoMemberRank')) {
            renderMemberRankings();
        }
    }

    // ==================== EXPORTS ====================

    window.RFTTaskEngine = {
        getSampleTasks,
        getUserCompletedTasks,
        saveUserCompletedTasks,
        getAvailableTasks,
        completeTask,
        getTaskStats,
        renderTaskHall,
        startTask,
        playTask,
        closeTaskPreview,
        renderMemberRankings,
        init
    };

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

})();
