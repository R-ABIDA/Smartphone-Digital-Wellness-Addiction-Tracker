// SmartTracker Application Controller — Cleaned up & fixed

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    const state = {
        activeTab: 'dashboard',
        // Default/fallback metrics. Replaced by real device data automatically
        // when running as a native app with Usage Access granted (see
        // initNativeUsageData below). On web, these defaults are shown as-is.
        metrics: {
            daily_usage_hours: 4.2,
            night_usage_hours: 0.8,
            app_switching_frequency: 48,
            social_media_percentage: 42,
            total_sessions: 45,
            avg_session_duration_mins: 5.6
        },
        // Real per-app usage, when available from the native bridge.
        // Shape: [{ appName, packageName, category, totalTimeMinutes }]
        topApps: null,
        realData: null,
        focusTimer: {
            durationSeconds: 1500, // 25 min default
            timeLeft: 1500,
            intervalId: null,
            isRunning: false
        },
        detoxTasks: {},
        unlockedBadges: [],
        backendOnline: false
    };

    // --- Selectors ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const backendStatusDot = document.getElementById('backend-status-dot');
    const backendStatusText = document.getElementById('backend-status-text');
    const overallWellnessBadge = document.getElementById('wellness-score-value');

    // --- Initialize ---
    function init() {
        loadDataFromStorage();
        checkBackendStatus();
        setupNavigation();
        setupSliders();
        setupPredictor();
        setupFocusTimer();
        setupSoundscapes();
        setupDetoxTasks();

        // Initial render
        updateDashboardMetrics();
        renderCharts();
        renderTopApps();
        updateDetoxUI();

        // Periodically ping backend status (every 10s)
        setInterval(checkBackendStatus, 10000);

        // If running as a native app, pull real device usage data and
        // override the placeholder metrics with it. On web this is a no-op
        // and the app keeps showing the default/sample data above.
        initNativeUsageData();
    }

    async function initNativeUsageData() {
        if (!window.SmartTrackerNative || !window.SmartTrackerNative.isNative) {
            return; // running in a regular browser — keep default sample data
        }

        const result = await window.SmartTrackerNative.fetchRealMetrics();
        if (!result) return;

        if (result.unavailable) {
            renderNativeDataBanner(result);
            if (result.reason === 'PERMISSION_NOT_GRANTED') {
                setupPermissionPrompt();
            }
            return;
        }

        // Merge real metrics into state and persist, so the rest of the app
        // (charts, wellness score, predictor, top apps) works unmodified.
        state.metrics = Object.assign({}, state.metrics, result.metrics);
        state.topApps = (result.rawToday && result.rawToday.apps) ? result.rawToday.apps : null;
        state.realData = result;
        saveState();
        updateDashboardMetrics();
        renderCharts();
        renderTopApps();
        hideNativeDataBanner();
    }

    function renderNativeDataBanner(result) {
        let banner = document.getElementById('native-data-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'native-data-banner';
            banner.className = 'native-data-banner';
            document.querySelector('.main-content').insertBefore(banner, document.querySelector('.app-header').nextSibling);
        }

        if (result.reason === 'PERMISSION_NOT_GRANTED') {
            banner.innerHTML = `
                <span>Grant "Usage Access" permission to see your real screen time instead of sample data.</span>
                <button id="grant-usage-access-btn" class="glow-button primary">Grant Permission</button>
            `;
        } else if (result.reason === 'PLATFORM_NOT_SUPPORTED') {
            banner.innerHTML = `<span>This device doesn't support real usage tracking. Showing sample data.</span>`;
        } else {
            banner.innerHTML = `<span>Couldn't read device usage data. Showing sample data instead.</span>`;
        }
        banner.style.display = 'flex';
    }

    function hideNativeDataBanner() {
        const banner = document.getElementById('native-data-banner');
        if (banner) banner.style.display = 'none';
    }

    function setupPermissionPrompt() {
        const btn = document.getElementById('grant-usage-access-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                await window.SmartTrackerNative.requestPermission();
                // The user grants permission in system Settings and returns to the
                // app; re-check on next resume via the visibilitychange listener.
            });
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && window.SmartTrackerNative && window.SmartTrackerNative.isNative) {
            initNativeUsageData();
        }
    });

    // --- Persistence ---
    function loadDataFromStorage() {
        const savedMetrics = localStorage.getItem('smarttracker_metrics');
        if (savedMetrics) {
            try { state.metrics = JSON.parse(savedMetrics); } catch (e) { /* ignore corrupt data */ }
        }

        const savedTasks = localStorage.getItem('smarttracker_tasks');
        if (savedTasks) {
            try { state.detoxTasks = JSON.parse(savedTasks); } catch (e) { /* ignore corrupt data */ }
        }

        const savedBadges = localStorage.getItem('smarttracker_badges');
        if (savedBadges) {
            try { state.unlockedBadges = JSON.parse(savedBadges); } catch (e) { /* ignore corrupt data */ }
        }
    }

    function saveState() {
        localStorage.setItem('smarttracker_metrics', JSON.stringify(state.metrics));
        localStorage.setItem('smarttracker_tasks', JSON.stringify(state.detoxTasks));
        localStorage.setItem('smarttracker_badges', JSON.stringify(state.unlockedBadges));
    }

    // --- Navigation System ---
    function setupNavigation() {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetTab = item.getAttribute('data-tab');
                switchTab(targetTab);
            });
        });

        document.getElementById('trigger-prediction-view').addEventListener('click', () => {
            switchTab('predictor');
        });
    }

    function switchTab(tabId) {
        state.activeTab = tabId;

        navItems.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });

        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${tabId}`);
        });

        const titles = {
            dashboard: { title: "Digital Wellness Dashboard", sub: "Track, analyze, and build a healthier relationship with your phone." },
            predictor: { title: "Machine Learning Predictor", sub: "Analyze smartphone usage using a scikit-learn Random Forest model." },
            focus: { title: "Immersive Focus Mode", sub: "Drown out digital distractions with Web Audio synthesizers." },
            challenges: { title: "Detox Challenges & Goals", sub: "Earn achievements by forming mindful mobile routines." }
        };

        if (titles[tabId]) {
            document.getElementById('page-title').textContent = titles[tabId].title;
            document.getElementById('page-subtitle').textContent = titles[tabId].sub;
        }

        // Re-render charts whenever the dashboard tab becomes visible.
        // This matters because SVG charts sized off container layout can
        // come out wrong (or blank) if rendered while the tab is hidden —
        // re-rendering here, after the panel is visible, ensures the
        // charts always actually display.
        if (tabId === 'dashboard') {
            renderCharts();
            updateDashboardMetrics();
            renderTopApps();
        }
    }

    // --- API & Backend Check ---
    async function checkBackendStatus() {
        try {
            const res = await fetch('http://localhost:8000/health');
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'healthy') {
                    state.backendOnline = true;
                    backendStatusDot.className = 'status-dot online';
                    backendStatusText.textContent = 'Inference: API Online';
                    return;
                }
            }
        } catch (e) { /* backend not reachable — fall back below */ }

        state.backendOnline = false;
        backendStatusDot.className = 'status-dot offline';
        backendStatusText.textContent = 'Inference: Local Fallback';
    }

    // --- Dashboard Metric Rendering ---
    function updateDashboardMetrics() {
        const metrics = state.metrics;

        document.getElementById('dash-screen-time').textContent = metrics.daily_usage_hours.toFixed(1);
        document.getElementById('dash-pickups').textContent = Math.round(metrics.total_sessions);
        document.getElementById('dash-social-ratio').textContent = Math.round(metrics.social_media_percentage);
        document.getElementById('dash-night-time').textContent = metrics.night_usage_hours.toFixed(1);

        // Trend captions react to the actual numbers instead of being static text
        setTrend('dash-screen-trend', metrics.daily_usage_hours <= 4
            ? { cls: 'green', text: '↓ Within healthy daily range' }
            : { cls: 'red', text: '↑ Above the 4h recommended range' });

        setTrend('dash-pickups-trend', metrics.total_sessions <= 50
            ? { cls: 'yellow', text: '→ Balanced pickup pattern' }
            : { cls: 'red', text: '↑ Pickups higher than typical' });

        setTrend('dash-social-trend', metrics.social_media_percentage <= 35
            ? { cls: 'green', text: '↓ Within goal range' }
            : { cls: 'red', text: `↑ ${Math.round(metrics.social_media_percentage - 35)}% above goal` });

        setTrend('dash-night-trend', metrics.night_usage_hours <= 0.5
            ? { cls: 'green', text: '↑ Safe sleep threshold' }
            : { cls: 'red', text: '↓ Disrupting sleep window' });

        // Wellness score: basic deduction model
        let score = 100;
        score -= (metrics.daily_usage_hours > 4) ? (metrics.daily_usage_hours - 4) * 8 : 0;
        score -= (metrics.night_usage_hours > 0.5) ? (metrics.night_usage_hours - 0.5) * 15 : 0;
        score -= (metrics.social_media_percentage > 40) ? (metrics.social_media_percentage - 40) * 0.5 : 0;
        score -= (metrics.total_sessions > 50) ? (metrics.total_sessions - 50) * 0.4 : 0;

        score = Math.max(10, Math.min(100, Math.round(score)));
        overallWellnessBadge.textContent = score;

        // Push anonymized usage to Supabase (no-op if not configured / no network).
        syncMetricsToCloud(metrics, score);

        // Dynamic advice banner
        const adviceText = document.getElementById('dash-ai-insight');
        if (score >= 80) {
            adviceText.textContent = "Excellent digital balance. Your screen time metrics are healthy and nighttime usage is minimized. Keep it up!";
        } else if (score >= 50) {
            adviceText.textContent = `Moderate usage patterns. Night screen use (${metrics.night_usage_hours.toFixed(1)}h) or pickups (${Math.round(metrics.total_sessions)}x) are slightly high. Consider activating Focus Mode to lock in your focus.`;
        } else {
            adviceText.textContent = "High screen time and pickup frequency detected. We strongly suggest starting a Digital Detox Challenge or trying Focus Mode to reduce screen stimulation.";
        }
    }

    function setTrend(elementId, { cls, text }) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = `metric-trend ${cls}`;
        el.textContent = text;
    }

    let lastCloudSync = 0;
    function syncMetricsToCloud(metrics, wellnessScore) {
        if (!window.SmartTrackerCloud || !window.SmartTrackerCloud.isConfigured()) return;

        // Throttle: avoid hammering the DB on rapid re-renders.
        const now = Date.now();
        if (now - lastCloudSync < 3000) return;
        lastCloudSync = now;

        const apps = state.topApps; // null unless real native per-app data is available
        window.SmartTrackerCloud.syncToday(metrics, apps, wellnessScore).catch(err => {
            console.warn('[SmartTracker] cloud sync failed:', err);
        });
    }

    // --- Top Apps & Websites ---
    function renderTopApps() {
        const container = document.getElementById('top-apps-list');
        if (!container) return;

        const colorByCategory = { Social: '#f43f5e', Work: '#10b981', Entertainment: '#f59e0b', Gaming: '#6366f1', Other: '#94a3b8' };

        let apps = state.topApps;

        // Fall back to a clearly-labeled sample list when no real per-app
        // data is available yet (web preview, iOS, or permission not granted).
        // This keeps the section from being blank and makes it obvious to
        // the user that this is sample data, not silently wrong data.
        let isSample = false;
        if (!apps || apps.length === 0) {
            isSample = true;
            apps = [
                { appName: 'Instagram', category: 'Social', totalTimeMinutes: 62 },
                { appName: 'YouTube', category: 'Entertainment', totalTimeMinutes: 48 },
                { appName: 'Slack', category: 'Work', totalTimeMinutes: 35 },
                { appName: 'Chrome', category: 'Other', totalTimeMinutes: 24 },
                { appName: 'Clash Royale', category: 'Gaming', totalTimeMinutes: 18 }
            ];
        }

        const sorted = [...apps].sort((a, b) => b.totalTimeMinutes - a.totalTimeMinutes).slice(0, 6);
        const maxMinutes = Math.max(...sorted.map(a => a.totalTimeMinutes), 1);

        container.innerHTML = (isSample ? `<div class="sample-data-tag">Sample data — connect a device to see real apps</div>` : '') +
            sorted.map(app => {
                const name = app.appName || app.packageName || 'Unknown app';
                const category = app.category || 'Other';
                const color = colorByCategory[category] || colorByCategory.Other;
                const minutes = Math.round(app.totalTimeMinutes);
                const hrs = Math.floor(minutes / 60);
                const mins = minutes % 60;
                const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                const barWidth = Math.max(4, Math.round((app.totalTimeMinutes / maxMinutes) * 100));

                return `
                    <div class="top-app-row">
                        <span class="app-dot" style="background-color: ${color};"></span>
                        <span class="top-app-name">${escapeHtml(name)}</span>
                        <span class="top-app-cat">${escapeHtml(category)}</span>
                        <div class="top-app-bar-outer"><div class="top-app-bar-inner" style="width:${barWidth}%; background:${color};"></div></div>
                        <span class="top-app-time">${timeLabel}</span>
                    </div>`;
            }).join('');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Chart rendering ---
    function renderCharts() {
        // Only render when the dashboard panel is actually visible — SVG
        // charts measured against a hidden/zero-size container can come out
        // blank, so we defer until the tab is shown (also re-triggered in
        // switchTab when the user navigates back to Dashboard).
        const dashboardPanel = document.getElementById('panel-dashboard');
        if (!dashboardPanel || !dashboardPanel.classList.contains('active')) return;

        const weeklyScreenData = (state.realData && !state.realData.unavailable && state.realData.weeklyScreenHours && state.realData.weeklyScreenHours.length === 7)
            ? state.realData.weeklyScreenHours
            : [4.8, 5.1, 3.9, 4.5, 3.2, 5.8, state.metrics.daily_usage_hours];
        Charts.renderWeeklyTrend('weekly-trend-chart', weeklyScreenData);

        const colorByCategory = { Social: '#f43f5e', Work: '#10b981', Entertainment: '#f59e0b', Gaming: '#6366f1', Other: '#94a3b8' };
        let catData;
        if (state.realData && !state.realData.unavailable && state.realData.categoryBreakdown) {
            catData = state.realData.categoryBreakdown.map(c => ({
                label: c.label,
                value: c.value,
                color: colorByCategory[c.label] || colorByCategory.Other
            }));
        } else {
            const social = state.metrics.social_media_percentage;
            const work = 20;
            const gaming = Math.max(5, Math.min(25, 100 - social - work - 15));
            const entertainment = Math.max(0, 100 - social - work - gaming);
            catData = [
                { label: 'Social', value: Math.round(social), color: colorByCategory.Social },
                { label: 'Work', value: work, color: colorByCategory.Work },
                { label: 'Entertainment', value: Math.round(entertainment), color: colorByCategory.Entertainment },
                { label: 'Gaming', value: Math.round(gaming), color: colorByCategory.Gaming }
            ];
        }
        Charts.renderCategoryBreakdown('category-donut-chart', catData);

        const nightUsageTrend = (state.realData && !state.realData.unavailable && state.realData.weeklyNightHours && state.realData.weeklyNightHours.length === 7)
            ? state.realData.weeklyNightHours
            : [1.2, 0.9, 0.4, 0.7, 1.5, 0.5, state.metrics.night_usage_hours];
        const sleepQualityIndex = nightUsageTrend.map(h => Math.max(30, Math.min(100, Math.round(95 - h * 25))));
        Charts.renderSleepCorrelation('sleep-correlation-chart', nightUsageTrend, sleepQualityIndex);
    }

    // Re-render charts on resize so they stay crisp/correctly proportioned
    let resizeTimeout = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(renderCharts, 150);
    });

    // --- Sliders Synchronization ---
    function setupSliders() {
        const sliderMap = [
            { id: 'daily_usage_hours', format: v => `${parseFloat(v).toFixed(1)}h` },
            { id: 'night_usage_hours', format: v => `${parseFloat(v).toFixed(2)}h` },
            { id: 'app_switching_frequency', format: v => `${parseInt(v)} times` },
            { id: 'social_media_percentage', format: v => `${parseInt(v)}%` },
            { id: 'total_sessions', format: v => `${parseInt(v)} unlocks` },
            { id: 'avg_session_duration_mins', format: v => `${parseFloat(v).toFixed(1)}m` }
        ];

        sliderMap.forEach(slider => {
            const el = document.getElementById(slider.id);
            const valDisplay = document.getElementById(`val-${slider.id}`);

            valDisplay.textContent = slider.format(el.value);

            el.addEventListener('input', (e) => {
                valDisplay.textContent = slider.format(e.target.value);
            });
        });
    }

    // --- ML Predictor ---
    function setupPredictor() {
        const btnPredict = document.getElementById('btn-predict');
        const btnReset = document.getElementById('btn-reset-form');

        btnPredict.addEventListener('click', async () => {
            const payload = {
                daily_usage_hours: parseFloat(document.getElementById('daily_usage_hours').value),
                night_usage_hours: parseFloat(document.getElementById('night_usage_hours').value),
                app_switching_frequency: parseInt(document.getElementById('app_switching_frequency').value),
                social_media_percentage: parseFloat(document.getElementById('social_media_percentage').value),
                total_sessions: parseInt(document.getElementById('total_sessions').value),
                avg_session_duration_mins: parseFloat(document.getElementById('avg_session_duration_mins').value)
            };

            document.getElementById('predict-loading').style.display = 'inline-block';
            btnPredict.disabled = true;

            const resultPanel = document.getElementById('prediction-result-panel');
            const resultActiveContent = resultPanel.querySelector('.result-active-content');
            const emptyState = resultPanel.querySelector('.empty-state-message');

            try {
                let data = null;

                if (state.backendOnline) {
                    const response = await fetch('http://localhost:8000/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (response.ok) {
                        data = await response.json();
                    } else {
                        throw new Error('API failed status check');
                    }
                }

                if (!data) {
                    data = runLocalInference(payload);
                }

                emptyState.style.display = 'none';
                resultPanel.classList.remove('empty');
                resultActiveContent.style.display = 'flex';

                const riskBadge = document.getElementById('result-risk-badge');
                riskBadge.textContent = `${data.addiction_level} Risk`;
                riskBadge.className = `risk-badge ${data.addiction_level.toLowerCase()}`;

                const confPercent = Math.round(data.confidence * 100);
                document.getElementById('prediction-confidence').textContent = `${confPercent}%`;

                const circle = document.getElementById('confidence-gauge-circle');
                const circumference = 2 * Math.PI * 40;
                const offset = circumference * (1 - data.confidence);
                circle.style.strokeDashoffset = offset;

                const colorMap = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };
                circle.style.stroke = colorMap[data.addiction_level] || '#06b6d4';

                const pLow = Math.round(data.all_probabilities.Low * 100);
                const pMed = Math.round(data.all_probabilities.Medium * 100);
                const pHigh = Math.round(data.all_probabilities.High * 100);

                document.getElementById('prob-val-low').textContent = `${pLow}%`;
                document.getElementById('prob-val-med').textContent = `${pMed}%`;
                document.getElementById('prob-val-high').textContent = `${pHigh}%`;

                document.getElementById('prob-bar-low').style.width = `${pLow}%`;
                document.getElementById('prob-bar-med').style.width = `${pMed}%`;
                document.getElementById('prob-bar-high').style.width = `${pHigh}%`;

                document.getElementById('result-insight-text').textContent = data.insight;

            } catch (err) {
                console.error(err);
                alert('Prediction failed. Make sure variables are valid.');
            } finally {
                document.getElementById('predict-loading').style.display = 'none';
                btnPredict.disabled = false;
            }
        });

        btnReset.addEventListener('click', () => {
            document.querySelectorAll('#panel-predictor input[type="range"]').forEach(input => {
                input.value = input.defaultValue;
                input.dispatchEvent(new Event('input'));
            });
            const resultPanel = document.getElementById('prediction-result-panel');
            resultPanel.classList.add('empty');
            resultPanel.querySelector('.empty-state-message').style.display = 'flex';
            resultPanel.querySelector('.result-active-content').style.display = 'none';
        });
    }

    // Local heuristic fallback matching the FastAPI response shape
    function runLocalInference(req) {
        let score = 0.0;

        score += req.daily_usage_hours * 12;
        score += req.night_usage_hours * 25;
        score += req.social_media_percentage * 1.5;
        score += req.avg_session_duration_mins * 3.5;
        score += (req.app_switching_frequency > 100) ? 35 : (req.app_switching_frequency / 3);
        score += (req.total_sessions > 80) ? 40 : (req.total_sessions * 0.5);

        const normalized = score / 600;

        let level = "Low";
        let probabilities = { Low: 0.8, Medium: 0.15, High: 0.05 };

        if (normalized > 0.85) {
            level = "High";
            const highProb = Math.min(0.98, 0.45 + (normalized - 0.85));
            probabilities = {
                Low: parseFloat((0.02).toFixed(2)),
                Medium: parseFloat(((1 - highProb) * 0.8).toFixed(2)),
                High: parseFloat(highProb.toFixed(2))
            };
        } else if (normalized > 0.45) {
            level = "Medium";
            const medProb = Math.min(0.92, 0.5 + (normalized - 0.45));
            probabilities = {
                Low: parseFloat(((1 - medProb) * 0.6).toFixed(2)),
                Medium: parseFloat(medProb.toFixed(2)),
                High: parseFloat(((1 - medProb) * 0.4).toFixed(2))
            };
        } else {
            level = "Low";
            const lowProb = Math.min(0.99, 0.6 + (0.45 - normalized));
            probabilities = {
                Low: parseFloat(lowProb.toFixed(2)),
                Medium: parseFloat(((1 - lowProb) * 0.7).toFixed(2)),
                High: parseFloat(((1 - lowProb) * 0.3).toFixed(2))
            };
        }

        const sum = probabilities.Low + probabilities.Medium + probabilities.High;
        if (sum !== 1.0) {
            probabilities.Low += (1.0 - sum);
        }

        const confidence = probabilities[level];

        let insight = "";
        if (level === "Low") {
            insight = "Excellent! Your smartphone usage habits are balanced. Keep maintaining these healthy boundaries. (Fallback engine)";
        } else if (level === "Medium") {
            let advice = [];
            if (req.night_usage_hours > 1.2) advice.push("Reduce nighttime screen use to improve sleep quality.");
            if (req.social_media_percentage > 50) advice.push("Try setting app limits for social platforms.");
            if (req.app_switching_frequency > 80) advice.push("Reduce multi-tasking and app switching during deep work.");
            insight = `Moderate addiction risk. ${advice.join(' ') || 'Try using Focus Mode to build healthier habits.'} (Fallback engine)`;
        } else {
            let advice = [];
            if (req.daily_usage_hours > 6) advice.push("Screen time is very high; introduce digital detox breaks.");
            if (req.night_usage_hours > 1.8) advice.push("Sleep environment is highly disrupted; keep your phone away.");
            if (req.avg_session_duration_mins > 8) advice.push("Sessions are too prolonged; try the 20-20-20 rule.");
            insight = `High addiction risk! ${advice.join(' ')} Try enabling grayscale screen mode or schedule app blocks. (Fallback engine)`;
        }

        return {
            addiction_level: level,
            confidence: confidence,
            all_probabilities: probabilities,
            insight: insight
        };
    }

    // --- Focus Mode Timer ---
    function setupFocusTimer() {
        const btnToggle = document.getElementById('btn-timer-toggle');
        const btnReset = document.getElementById('btn-timer-reset');
        const btnDuration = document.getElementById('btn-timer-duration');
        const timerDisplay = document.getElementById('timer-countdown');
        const ring = document.getElementById('timer-progress-ring');

        const circumference = 2 * Math.PI * 90;

        function formatTime(sec) {
            const m = Math.floor(sec / 60).toString().padStart(2, '0');
            const s = (sec % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        }

        function updateTimerRing() {
            const percentage = state.focusTimer.timeLeft / state.focusTimer.durationSeconds;
            const offset = circumference * (1 - percentage);
            ring.style.strokeDashoffset = offset;
        }

        btnToggle.addEventListener('click', () => {
            if (state.focusTimer.isRunning) {
                clearInterval(state.focusTimer.intervalId);
                state.focusTimer.isRunning = false;
                btnToggle.textContent = 'Resume Focus';
                btnToggle.className = 'glow-button primary';
                stopBreathingGuide();
            } else {
                state.focusTimer.isRunning = true;
                btnToggle.textContent = 'Pause';
                btnToggle.className = 'glow-button secondary-style';

                const activeSound = document.querySelector('.sound-option.active').getAttribute('data-sound');
                if (activeSound !== 'none') {
                    Soundscape.play(activeSound);
                }

                if (document.getElementById('breathing-guide-toggle').checked) {
                    startBreathingGuide();
                }

                state.focusTimer.intervalId = setInterval(() => {
                    state.focusTimer.timeLeft--;
                    timerDisplay.textContent = formatTime(state.focusTimer.timeLeft);
                    updateTimerRing();

                    if (state.focusTimer.timeLeft <= 0) {
                        clearInterval(state.focusTimer.intervalId);
                        state.focusTimer.isRunning = false;
                        btnToggle.textContent = 'Start Focus';
                        btnToggle.className = 'glow-button primary';

                        Soundscape.stopCurrent();
                        Soundscape.playFocusEndChime();

                        unlockBadge('badge-focus-master');

                        alert('Focus session complete! Take a deep breath and a short break.');
                        resetTimer();
                    }
                }, 1000);
            }
        });

        function resetTimer() {
            clearInterval(state.focusTimer.intervalId);
            state.focusTimer.isRunning = false;
            state.focusTimer.timeLeft = state.focusTimer.durationSeconds;
            timerDisplay.textContent = formatTime(state.focusTimer.timeLeft);
            btnToggle.textContent = 'Start Focus';
            btnToggle.className = 'glow-button primary';
            ring.style.strokeDashoffset = 0;
            stopBreathingGuide();
            Soundscape.stopCurrent();
            document.querySelectorAll('.sound-option').forEach(opt => {
                opt.classList.toggle('active', opt.getAttribute('data-sound') === 'none');
            });
            document.getElementById('volume-slider').disabled = true;
        }

        btnReset.addEventListener('click', resetTimer);

        btnDuration.addEventListener('click', () => {
            if (state.focusTimer.isRunning) return;
            const currentDur = state.focusTimer.durationSeconds;
            if (currentDur === 1500) {
                state.focusTimer.durationSeconds = 900;
                btnDuration.textContent = '15 Min';
            } else {
                state.focusTimer.durationSeconds = 1500;
                btnDuration.textContent = '25 Min';
            }
            resetTimer();
        });
    }

    let breathingInterval = null;
    function startBreathingGuide() {
        const circle = document.getElementById('breath-circle');
        const label = document.getElementById('breath-label');

        let inhaleState = true;
        label.textContent = "Breathe In...";
        circle.className = 'breath-ring inhale';

        breathingInterval = setInterval(() => {
            inhaleState = !inhaleState;
            if (inhaleState) {
                label.textContent = "Breathe In...";
                circle.className = 'breath-ring inhale';
            } else {
                label.textContent = "Breathe Out...";
                circle.className = 'breath-ring exhale';
            }
        }, 4000);
    }

    function stopBreathingGuide() {
        clearInterval(breathingInterval);
        const circle = document.getElementById('breath-circle');
        const label = document.getElementById('breath-label');
        circle.className = 'breath-ring';
        label.textContent = "Focus Active";
    }

    // --- Soundscape Controls ---
    function setupSoundscapes() {
        const soundOptions = document.querySelectorAll('.sound-option');
        const volumeSlider = document.getElementById('volume-slider');
        const valVolume = document.getElementById('val-volume');

        soundOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const sound = opt.getAttribute('data-sound');

                soundOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                if (sound === 'none') {
                    volumeSlider.disabled = true;
                    Soundscape.stopCurrent();
                } else {
                    volumeSlider.disabled = false;
                    if (state.focusTimer.isRunning) {
                        Soundscape.play(sound);
                    }
                }
            });
        });

        volumeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            valVolume.textContent = `${Math.round(val * 100)}%`;
            Soundscape.setVolume(val);
        });
    }

    // --- Detox Tasks & Badges Checklist ---
    function setupDetoxTasks() {
        const taskCheckboxes = document.querySelectorAll('.detox-task');

        taskCheckboxes.forEach(cb => {
            const taskId = cb.getAttribute('data-id');

            if (state.detoxTasks[taskId]) {
                cb.checked = true;
            }

            cb.addEventListener('change', (e) => {
                state.detoxTasks[taskId] = e.target.checked;
                saveState();
                evaluateBadges();
                updateDetoxUI();
            });
        });
    }

    function evaluateBadges() {
        const tasks = state.detoxTasks;

        const anyDone = Object.values(tasks).some(v => v === true);
        if (anyDone) {
            unlockBadge('badge-first-step');
        }

        const dailyKeys = ['sleep-1hr', 'morning-30', 'limit-social', 'pickups-40'];
        const allDailyDone = dailyKeys.every(k => tasks[k] === true);
        if (allDailyDone) {
            unlockBadge('badge-offline-hero');
        }

        if (tasks['sleep-1hr'] === true && state.metrics.night_usage_hours <= 0.25) {
            unlockBadge('badge-night-owl');
        }
    }

    function unlockBadge(badgeId) {
        if (state.unlockedBadges.includes(badgeId)) return;

        state.unlockedBadges.push(badgeId);
        saveState();

        const badgeEl = document.getElementById(badgeId);
        if (badgeEl) {
            badgeEl.classList.remove('locked');
            badgeEl.style.transform = 'scale(1.1)';
            setTimeout(() => {
                badgeEl.style.transform = 'none';
            }, 300);
        }
    }

    function updateDetoxUI() {
        state.unlockedBadges.forEach(badgeId => {
            const el = document.getElementById(badgeId);
            if (el) el.classList.remove('locked');
        });
    }

    // Launch
    init();
});
