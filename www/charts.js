// SmartTracker Dynamic SVG Chart Builder — Fixed & Improved

class SVGChartBuilder {
    constructor() {}

    // --- Line Area Chart (Weekly Screen Time) ---
    renderWeeklyTrend(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        // Use fixed logical dimensions so the chart always renders correctly
        const width = 500;
        const height = 220;
        const padding = { top: 20, right: 20, bottom: 36, left: 38 };

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const maxVal = Math.max(...data, 8);

        const getX = (i) => padding.left + (i * (width - padding.left - padding.right) / (data.length - 1));
        const getY = (v) => height - padding.bottom - (v * (height - padding.top - padding.bottom) / maxVal);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'svg-chart');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width = '100%';
        svg.style.height = '100%';

        // Defs
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <linearGradient id="line-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#6366f1" stop-opacity="0.02"/>
            </linearGradient>`;
        svg.appendChild(defs);

        // Grid lines
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const yVal = (maxVal / steps) * i;
            const yCoor = getY(yVal);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'svg-grid-line');
            line.setAttribute('x1', padding.left);
            line.setAttribute('y1', yCoor);
            line.setAttribute('x2', width - padding.right);
            line.setAttribute('y2', yCoor);
            gridGroup.appendChild(line);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('class', 'svg-axis-label');
            text.setAttribute('x', padding.left - 6);
            text.setAttribute('y', yCoor + 4);
            text.setAttribute('text-anchor', 'end');
            text.textContent = `${yVal.toFixed(0)}h`;
            gridGroup.appendChild(text);
        }
        svg.appendChild(gridGroup);

        // Build bezier path + area
        let pathD = '';
        let areaD = `M ${getX(0)} ${height - padding.bottom}`;
        for (let i = 0; i < data.length; i++) {
            const x = getX(i), y = getY(data[i]);
            if (i === 0) {
                pathD += `M ${x} ${y}`;
            } else {
                const px = getX(i - 1), py = getY(data[i - 1]);
                const cpX = px + (x - px) / 2;
                pathD += ` C ${cpX} ${py}, ${cpX} ${y}, ${x} ${y}`;
            }
            areaD += ` L ${x} ${y}`;
            if (i === data.length - 1) areaD += ` L ${x} ${height - padding.bottom} Z`;
        }

        const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        areaPath.setAttribute('d', areaD);
        areaPath.setAttribute('fill', 'url(#line-area-grad)');
        svg.appendChild(areaPath);

        const strokePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        strokePath.setAttribute('class', 'svg-line');
        strokePath.setAttribute('d', pathD);
        svg.appendChild(strokePath);

        // Dots + X labels
        for (let i = 0; i < data.length; i++) {
            const x = getX(i), y = getY(data[i]);

            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('class', 'svg-dot');
            dot.setAttribute('cx', x);
            dot.setAttribute('cy', y);
            dot.setAttribute('r', '5');
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${days[i]}: ${data[i].toFixed(1)} hrs`;
            dot.appendChild(title);
            svg.appendChild(dot);

            // Value label above dot
            const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            valText.setAttribute('class', 'svg-dot-label');
            valText.setAttribute('x', x);
            valText.setAttribute('y', y - 10);
            valText.setAttribute('text-anchor', 'middle');
            valText.textContent = data[i].toFixed(1);
            svg.appendChild(valText);

            const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xLabel.setAttribute('class', 'svg-axis-label');
            xLabel.setAttribute('x', x);
            xLabel.setAttribute('y', height - 10);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.textContent = days[i];
            svg.appendChild(xLabel);
        }

        container.appendChild(svg);
    }

    // --- Donut Chart (Category Shares) with external legend ---
    renderCategoryBreakdown(containerId, dataset) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const width = 200;
        const height = 200;
        const radius = 72;
        const cx = width / 2, cy = height / 2;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'svg-chart');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width = '100%';
        svg.style.height = '100%';

        const total = dataset.reduce((s, d) => s + d.value, 0);
        let accAngle = -Math.PI / 2; // start from top

        const innerR = radius * 0.55;

        // Background circle
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttribute('cx', cx);
        bgCircle.setAttribute('cy', cy);
        bgCircle.setAttribute('r', radius);
        bgCircle.setAttribute('fill', 'none');
        bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.06)');
        bgCircle.setAttribute('stroke-width', '28');
        svg.appendChild(bgCircle);

        dataset.forEach((item) => {
            const angle = (item.value / total) * 2 * Math.PI;
            const startAngle = accAngle;
            const endAngle = accAngle + angle;

            const x1 = cx + radius * Math.cos(startAngle);
            const y1 = cy + radius * Math.sin(startAngle);
            const x2 = cx + radius * Math.cos(endAngle);
            const y2 = cy + radius * Math.sin(endAngle);

            const largeArc = angle > Math.PI ? 1 : 0;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = [
                `M ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            ].join(' ');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', item.color);
            path.setAttribute('stroke-width', '26');
            path.setAttribute('stroke-linecap', 'butt');
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${item.label}: ${item.value}%`;
            path.appendChild(title);
            svg.appendChild(path);

            accAngle = endAngle;
        });

        // Center cutout
        const cutout = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cutout.setAttribute('cx', cx);
        cutout.setAttribute('cy', cy);
        cutout.setAttribute('r', innerR);
        cutout.setAttribute('fill', '#141a29');
        svg.appendChild(cutout);

        // Center text
        const topLabel = dataset.reduce((a, b) => a.value > b.value ? a : b);
        const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        centerText.setAttribute('x', cx);
        centerText.setAttribute('y', cy - 4);
        centerText.setAttribute('text-anchor', 'middle');
        centerText.setAttribute('fill', '#f3f4f6');
        centerText.setAttribute('font-size', '15');
        centerText.setAttribute('font-weight', '700');
        centerText.textContent = `${topLabel.value}%`;
        svg.appendChild(centerText);

        const centerSub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        centerSub.setAttribute('x', cx);
        centerSub.setAttribute('y', cy + 12);
        centerSub.setAttribute('text-anchor', 'middle');
        centerSub.setAttribute('fill', '#9ca3af');
        centerSub.setAttribute('font-size', '8');
        centerSub.textContent = topLabel.label;
        svg.appendChild(centerSub);

        container.appendChild(svg);

        // Render legend
        const legendEl = document.getElementById('donut-legend');
        if (legendEl) {
            legendEl.innerHTML = dataset.map(d => `
                <div class="legend-item">
                    <span class="legend-dot" style="background:${d.color};"></span>
                    <span class="legend-label">${d.label}</span>
                    <span class="legend-val">${d.value}%</span>
                </div>`).join('');
        }
    }

    // --- Double Axis Overlay Chart (Night Usage vs Sleep Quality) ---
    renderSleepCorrelation(containerId, usageData, sleepData) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const width = 420;
        const height = 200;
        const padding = { top: 20, right: 38, bottom: 36, left: 38 };
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const maxUsage = Math.max(...usageData, 3);

        const getX = (i) => padding.left + (i * (width - padding.left - padding.right) / (days.length - 1));
        const getYUsage = (v) => height - padding.bottom - (v * (height - padding.top - padding.bottom) / maxUsage);
        const getYSleep = (v) => height - padding.bottom - (v * (height - padding.top - padding.bottom) / 100);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'svg-chart');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width = '100%';
        svg.style.height = '100%';

        // Defs
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.1"/>
            </linearGradient>`;
        svg.appendChild(defs);

        // Grid lines (for sleep %)
        const gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        [0, 25, 50, 75, 100].forEach(v => {
            const yCoor = getYSleep(v);
            const gl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gl.setAttribute('class', 'svg-grid-line');
            gl.setAttribute('x1', padding.left);
            gl.setAttribute('y1', yCoor);
            gl.setAttribute('x2', width - padding.right);
            gl.setAttribute('y2', yCoor);
            gridG.appendChild(gl);
        });
        svg.appendChild(gridG);

        // Bars (night usage)
        const colWidth = (width - padding.left - padding.right) / days.length * 0.5;
        usageData.forEach((v, i) => {
            const x = getX(i) - colWidth / 2;
            const y = getYUsage(v);
            const barH = Math.max(height - padding.bottom - y, 2);
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', colWidth);
            rect.setAttribute('height', barH);
            rect.setAttribute('rx', '3');
            rect.setAttribute('fill', 'url(#bar-grad)');
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            t.textContent = `Night Use: ${v.toFixed(1)}h`;
            rect.appendChild(t);
            svg.appendChild(rect);
        });

        // Line (sleep quality)
        let lineD = '';
        sleepData.forEach((v, i) => {
            const x = getX(i), y = getYSleep(v);
            lineD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
        });
        const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        linePath.setAttribute('d', lineD);
        linePath.setAttribute('fill', 'none');
        linePath.setAttribute('stroke', '#06b6d4');
        linePath.setAttribute('stroke-width', '2.5');
        linePath.setAttribute('stroke-linecap', 'round');
        svg.appendChild(linePath);

        // Sleep dots + x labels + axis labels
        sleepData.forEach((v, i) => {
            const x = getX(i), y = getYSleep(v);

            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', x);
            dot.setAttribute('cy', y);
            dot.setAttribute('r', '4');
            dot.setAttribute('fill', '#0d1117');
            dot.setAttribute('stroke', '#06b6d4');
            dot.setAttribute('stroke-width', '2');
            const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            t2.textContent = `Sleep Index: ${v}%`;
            dot.appendChild(t2);
            svg.appendChild(dot);

            const xL = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xL.setAttribute('class', 'svg-axis-label');
            xL.setAttribute('x', x);
            xL.setAttribute('y', height - 10);
            xL.setAttribute('text-anchor', 'middle');
            xL.textContent = days[i];
            svg.appendChild(xL);
        });

        // Left axis labels (night usage in amber)
        [0, maxUsage].forEach(v => {
            const la = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            la.setAttribute('class', 'svg-axis-label');
            la.setAttribute('x', padding.left - 6);
            la.setAttribute('y', getYUsage(v) + 4);
            la.setAttribute('text-anchor', 'end');
            la.setAttribute('fill', '#f59e0b');
            la.textContent = `${v.toFixed(0)}h`;
            svg.appendChild(la);
        });

        // Right axis labels (sleep quality in cyan)
        [0, 100].forEach(v => {
            const ra = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            ra.setAttribute('class', 'svg-axis-label');
            ra.setAttribute('x', width - padding.right + 6);
            ra.setAttribute('y', getYSleep(v) + 4);
            ra.setAttribute('text-anchor', 'start');
            ra.setAttribute('fill', '#06b6d4');
            ra.textContent = `${v}%`;
            svg.appendChild(ra);
        });

        container.appendChild(svg);
    }
}

const Charts = new SVGChartBuilder();
window.Charts = Charts;
