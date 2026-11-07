/**
 * SalesPulse Analytics Dashboard
 * Pure Vanilla JavaScript (No backend, WebStorage for persistence, Zero CSS variables)
 */

(function () {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_KEY = 'salespulse_transactions_v1';
  const MONTHLY_TARGET = 100000; // $100k target

  // Chart instances
  let revenueTrendChart = null;
  let categoryChart = null;
  let channelChart = null;

  // State Management
  let transactions = [];
  let filteredTransactions = [];
  let currentPage = 1;
  const rowsPerPage = 10;
  let sortColumn = 'date';
  let sortDirection = 'desc'; // 'asc' or 'desc'
  let selectedIds = new Set();

  // --- Seed Data Generator ---
  function generateInitialData() {
    const categories = [
      'Enterprise Software',
      'Cloud Infrastructure',
      'Consulting & Training',
      'Hardware & Peripherals',
      'Maintenance & Support',
      'Custom Solutions'
    ];

    const channels = [
      'Direct Sales',
      'Online Portal',
      'Partner / Reseller',
      'Inside Sales',
      'Enterprise Outbound'
    ];

    const products = [
      { name: 'Enterprise Cloud Suite', category: 'Enterprise Software', basePrice: 4200 },
      { name: 'CyberSecurity Shield Pro', category: 'Enterprise Software', basePrice: 2800 },
      { name: 'Dedicated Server Tier-1', category: 'Cloud Infrastructure', basePrice: 1950 },
      { name: 'Hybrid Cloud Node', category: 'Cloud Infrastructure', basePrice: 3400 },
      { name: 'Cloud Migration Workshop', category: 'Consulting & Training', basePrice: 5000 },
      { name: 'Executive AI Strategy Audit', category: 'Consulting & Training', basePrice: 7500 },
      { name: 'Network Gateway Switch', category: 'Hardware & Peripherals', basePrice: 1200 },
      { name: 'High-Performance Workstation', category: 'Hardware & Peripherals', basePrice: 2900 },
      { name: 'Annual 24/7 SLA Support', category: 'Maintenance & Support', basePrice: 6200 },
      { name: 'Custom ERP Data Connector', category: 'Custom Solutions', basePrice: 8900 }
    ];

    const customers = [
      'Acme Global Corp',
      'TechFlow Dynamics',
      'Global Logistics Inc',
      'Nexus Retail Group',
      'Apex Financial Partners',
      'Starlight Media Works',
      'Vanguard Health Systems',
      'Quantum Leap AI',
      'Hyperion Systems LLC',
      'Echo Energy Solutions',
      'Meridian BioTech',
      'Summit Peak Ventures',
      'CloudWave Media',
      'Horizon Aerospace',
      'Sterling Capital'
    ];

    const sample = [];
    const now = new Date();

    // Create 32 realistic sales transactions spanning the last 55 days
    for (let i = 1; i <= 32; i++) {
      const prod = products[i % products.length];
      const cust = customers[(i * 3) % customers.length];
      const chan = channels[i % channels.length];
      const daysAgo = Math.floor((i * 1.6) % 55);
      const dateObj = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const dateStr = dateObj.toISOString().split('T')[0];

      const units = 1 + (i % 4);
      const variance = (i % 5) * 120 - 200;
      const amount = Math.max(450, (prod.basePrice * units) + variance);

      // Status distribution: mostly completed, a few pending, rare refunded
      let status = 'Completed';
      if (i % 7 === 0) status = 'Pending';
      if (i === 11 || i === 25) status = 'Refunded';

      const orderId = `ORD-${9000 + i}`;

      sample.push({
        id: 'txn_' + (1000 + i),
        orderId: orderId,
        date: dateStr,
        customer: cust,
        product: prod.name,
        category: prod.category,
        channel: chan,
        units: units,
        amount: parseFloat(amount.toFixed(2)),
        status: status
      });
    }

    return sample;
  }

  // --- LocalStorage Operations ---
  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        transactions = JSON.parse(raw);
      } else {
        transactions = generateInitialData();
        saveTransactions();
      }
    } catch (e) {
      console.warn('Could not read WebStorage, using initial state in memory:', e);
      transactions = generateInitialData();
    }
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      updateStorageStatusIndicator();
    } catch (e) {
      console.error('Error saving to WebStorage:', e);
      showToast('Storage quota exceeded or disabled', 'danger');
    }
  }

  function updateStorageStatusIndicator() {
    const el = document.getElementById('storage-status-text');
    if (el) {
      el.textContent = `WebStorage Active (${transactions.length} orders)`;
    }
  }

  // --- Date & Number Format Helpers ---
  function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  }

  function formatNumber(val) {
    return new Intl.NumberFormat('en-US').format(val || 0);
  }

  // --- Category Options Populator ---
  function populateCategoryFilter() {
    const select = document.getElementById('filter-category');
    if (!select) return;

    const currentVal = select.value;
    const cats = Array.from(new Set(transactions.map(t => t.category))).sort();

    select.innerHTML = '<option value="all">All Categories</option>';
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });

    if (cats.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  // --- Filtering & Sorting ---
  function applyFilters() {
    const timeframe = document.getElementById('filter-timeframe').value;
    const category = document.getElementById('filter-category').value;
    const status = document.getElementById('filter-status').value;
    const search = (document.getElementById('search-input').value || '').trim().toLowerCase();

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    filteredTransactions = transactions.filter(item => {
      // Timeframe check
      const itemDate = new Date(item.date);
      if (timeframe === 'today') {
        if (item.date !== todayStr) return false;
      } else if (timeframe === 'last7') {
        const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 7) return false;
      } else if (timeframe === 'last30') {
        const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 30) return false;
      } else if (timeframe === 'last90') {
        const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 90) return false;
      } else if (timeframe === 'thisyear') {
        if (itemDate.getFullYear() !== now.getFullYear()) return false;
      }

      // Category check
      if (category !== 'all' && item.category !== category) {
        return false;
      }

      // Status check
      if (status !== 'all' && item.status !== status) {
        return false;
      }

      // Search keyword
      if (search) {
        const haystack = `${item.orderId} ${item.customer} ${item.product} ${item.category} ${item.channel} ${item.amount}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });

    // Apply Sorting
    filteredTransactions.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (sortColumn === 'amount' || sortColumn === 'units') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Reset pagination to first page
    currentPage = 1;
    selectedIds.clear();
    updateSelectionActions();

    // Render all components
    renderKPIs();
    renderCharts();
    renderTopProductsAndTarget();
    renderTable();

    // Filter count status
    const countEl = document.getElementById('filtered-records-count');
    if (countEl) {
      countEl.textContent = `Showing ${filteredTransactions.length} of ${transactions.length} orders`;
    }
  }

  // --- KPI Computation & Rendering ---
  function renderKPIs() {
    // Only completed transactions count toward recognized revenue
    const completedItems = filteredTransactions.filter(t => t.status === 'Completed');
    const totalRev = completedItems.reduce((acc, t) => acc + t.amount, 0);
    const totalUnits = filteredTransactions.reduce((acc, t) => acc + (t.units || 1), 0);
    const orderCount = filteredTransactions.length;
    const completedCount = completedItems.length;
    const aov = completedCount > 0 ? (totalRev / completedCount) : 0;
    const estProfit = totalRev * 0.42;

    // Elements
    const revEl = document.getElementById('kpi-revenue');
    const ordersEl = document.getElementById('kpi-orders');
    const ordersUnitsEl = document.getElementById('kpi-orders-units');
    const aovEl = document.getElementById('kpi-aov');
    const profitEl = document.getElementById('kpi-profit');

    if (revEl) revEl.textContent = formatCurrency(totalRev);
    if (ordersEl) ordersEl.textContent = formatNumber(orderCount);
    if (ordersUnitsEl) ordersUnitsEl.textContent = `${formatNumber(totalUnits)} units sold`;
    if (aovEl) aovEl.textContent = formatCurrency(aov);
    if (profitEl) profitEl.textContent = formatCurrency(estProfit);

    // Dynamic trend badge for Revenue vs all average
    const revTrendEl = document.getElementById('kpi-revenue-trend');
    if (revTrendEl) {
      if (totalRev > 50000) {
        revTrendEl.className = 'kpi-pill pill-positive';
        revTrendEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg> High Vol`;
      } else {
        revTrendEl.className = 'kpi-pill pill-neutral';
        revTrendEl.textContent = `${completedCount} completed`;
      }
    }
  }

  // --- Monthly Target & Top Products ---
  function renderTopProductsAndTarget() {
    const completedItems = filteredTransactions.filter(t => t.status === 'Completed');
    const totalRev = completedItems.reduce((acc, t) => acc + t.amount, 0);

    // Target Progress
    const targetPercent = Math.min(100, Math.round((totalRev / MONTHLY_TARGET) * 100));
    const targetFill = document.getElementById('target-progress-fill');
    const targetText = document.getElementById('target-percent-text');
    const targetCurrentRev = document.getElementById('target-current-revenue');
    const targetRemaining = document.getElementById('target-remaining');

    if (targetFill) targetFill.style.width = `${targetPercent}%`;
    if (targetText) targetText.textContent = `${targetPercent}% of Goal`;
    if (targetCurrentRev) targetCurrentRev.textContent = `Current: ${formatCurrency(totalRev)}`;
    if (targetRemaining) {
      const remaining = Math.max(0, MONTHLY_TARGET - totalRev);
      targetRemaining.textContent = remaining === 0 ? 'Goal Achieved!' : `Remaining: ${formatCurrency(remaining)}`;
    }

    // Top Products
    const prodMap = {};
    filteredTransactions.forEach(t => {
      if (!prodMap[t.product]) {
        prodMap[t.product] = {
          name: t.product,
          category: t.category,
          amount: 0,
          units: 0
        };
      }
      if (t.status !== 'Refunded') {
        prodMap[t.product].amount += t.amount;
      }
      prodMap[t.product].units += (t.units || 1);
    });

    const topList = Object.values(prodMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    const container = document.getElementById('top-products-list');
    if (!container) return;

    if (topList.length === 0) {
      container.innerHTML = '<div style="font-size: 13px; color: #64748b; padding: 10px 0;">No product data for this selection</div>';
      return;
    }

    container.innerHTML = topList.map(prod => `
      <div class="top-product-item">
        <div>
          <div class="prod-name" title="${prod.name}">${prod.name}</div>
          <div class="prod-category">${prod.category}</div>
        </div>
        <div class="prod-stats">
          <div class="prod-amount">${formatCurrency(prod.amount)}</div>
          <div class="prod-units">${prod.units} units sold</div>
        </div>
      </div>
    `).join('');
  }

  // --- Visualizations / Charts ---
  function renderCharts() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded. Visualizations running in fallback mode.');
      renderFallbackCharts();
      return;
    }

    renderRevenueTrendChart();
    renderCategoryChart();
    renderChannelChart();
  }

  // Chart 1: Revenue Timeline
  function renderRevenueTrendChart() {
    const canvas = document.getElementById('chart-revenue-trend');
    if (!canvas) return;

    // Aggregate by date
    const dateMap = {};
    // Sort transactions chronologically
    const chronoSorted = [...filteredTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    chronoSorted.forEach(t => {
      if (!dateMap[t.date]) {
        dateMap[t.date] = { revenue: 0, profit: 0 };
      }
      if (t.status === 'Completed') {
        dateMap[t.date].revenue += t.amount;
        dateMap[t.date].profit += (t.amount * 0.42);
      }
    });

    let labels = Object.keys(dateMap);
    let revData = labels.map(d => dateMap[d].revenue);
    let profitData = labels.map(d => Math.round(dateMap[d].profit));

    // If empty data or 1 day, provide minimal placeholder
    if (labels.length === 0) {
      labels = ['No Data'];
      revData = [0];
      profitData = [0];
    }

    if (revenueTrendChart) {
      revenueTrendChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    revenueTrendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Revenue',
            data: revData,
            backgroundColor: '#2563eb',
            borderRadius: 4,
            barPercentage: 0.6
          },
          {
            label: 'Est. Profit',
            data: profitData,
            backgroundColor: '#10b981',
            borderRadius: 4,
            barPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: function (context) {
                return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              maxRotation: 45
            }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: function (val) {
                return '$' + (val >= 1000 ? (val / 1000) + 'k' : val);
              }
            }
          }
        }
      }
    });
  }

  // Chart 2: Category Donut
  function renderCategoryChart() {
    const canvas = document.getElementById('chart-categories');
    if (!canvas) return;

    const catMap = {};
    filteredTransactions.forEach(t => {
      if (t.status !== 'Refunded') {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      }
    });

    const labels = Object.keys(catMap);
    const dataVals = Object.values(catMap);
    const totalCatRev = dataVals.reduce((a, b) => a + b, 0);

    const colors = [
      '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'
    ];

    if (categoryChart) {
      categoryChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataVals.length ? dataVals : [1],
          backgroundColor: dataVals.length ? colors.slice(0, labels.length) : ['#cbd5e1'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: function (context) {
                const val = context.parsed;
                const pct = totalCatRev > 0 ? Math.round((val / totalCatRev) * 100) : 0;
                return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Populate the side legend list
    const legendList = document.getElementById('category-legend-list');
    if (legendList) {
      legendList.innerHTML = labels.map((cat, idx) => {
        const val = catMap[cat];
        const pct = totalCatRev > 0 ? Math.round((val / totalCatRev) * 100) : 0;
        const color = colors[idx % colors.length];
        return `
          <div class="cat-item-row">
            <div class="cat-item-left">
              <span class="cat-color-badge" style="background-color: ${color}"></span>
              <span>${cat}</span>
            </div>
            <div class="cat-item-val">${pct}%</div>
          </div>
        `;
      }).join('');
    }
  }

  // Chart 3: Channel Breakdown
  function renderChannelChart() {
    const canvas = document.getElementById('chart-channels');
    if (!canvas) return;

    const channelMap = {};
    filteredTransactions.forEach(t => {
      channelMap[t.channel] = (channelMap[t.channel] || 0) + (t.status === 'Completed' ? t.amount : 0);
    });

    const labels = Object.keys(channelMap);
    const dataVals = Object.values(channelMap);

    if (channelChart) {
      channelChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    channelChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue',
          data: dataVals,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: function (ctx) {
                return ` Revenue: ${formatCurrency(ctx.parsed.x)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: function (val) {
                return '$' + (val >= 1000 ? (val / 1000) + 'k' : val);
              }
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#334155',
              font: { size: 12, weight: 500 }
            }
          }
        }
      }
    });
  }

  // Fallback Charts: High-fidelity Pure HTML5 Canvas 2D rendering when offline / without CDN
  function renderFallbackCharts() {
    renderCanvasTimelineFallback();
    renderCanvasCategoryFallback();
    renderCanvasChannelFallback();
  }

  function renderCanvasTimelineFallback() {
    const canvas = document.getElementById('chart-revenue-trend');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth || 600;
    const height = canvas.parentElement.clientHeight || 260;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Aggregate by date
    const dateMap = {};
    const chronoSorted = [...filteredTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    chronoSorted.forEach(t => {
      if (!dateMap[t.date]) dateMap[t.date] = { revenue: 0, profit: 0 };
      if (t.status === 'Completed') {
        dateMap[t.date].revenue += t.amount;
        dateMap[t.date].profit += (t.amount * 0.42);
      }
    });

    const dates = Object.keys(dateMap);
    if (dates.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText('No transaction data available for current filter', 30, height / 2);
      return;
    }

    const maxRev = Math.max(...dates.map(d => dateMap[d].revenue), 1000);
    const paddingLeft = 60;
    const paddingBottom = 40;
    const paddingTop = 20;
    const plotWidth = width - paddingLeft - 20;
    const plotHeight = height - paddingBottom - paddingTop;
    const barGroupWidth = plotWidth / dates.length;
    const barWidth = Math.max(6, Math.min(18, (barGroupWidth - 8) / 2));

    // Draw grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = paddingTop + (plotHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const val = Math.round(maxRev - (maxRev / 4) * i);
      ctx.fillText('$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val), paddingLeft - 8, y + 3);
    }

    // Draw bars
    dates.forEach((d, i) => {
      const groupX = paddingLeft + i * barGroupWidth + (barGroupWidth / 2) - barWidth;
      const rev = dateMap[d].revenue;
      const profit = dateMap[d].profit;
      const revHeight = (rev / maxRev) * plotHeight;
      const profitHeight = (profit / maxRev) * plotHeight;

      // Revenue bar
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(groupX - (barWidth / 2), height - paddingBottom - revHeight, barWidth - 2, revHeight);

      // Profit bar
      ctx.fillStyle = '#10b981';
      ctx.fillRect(groupX + (barWidth / 2), height - paddingBottom - profitHeight, barWidth - 2, profitHeight);

      // Date labels (every Nth to avoid crowding)
      if (dates.length <= 12 || i % Math.ceil(dates.length / 10) === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        const shortDate = d.slice(5);
        ctx.fillText(shortDate, groupX, height - paddingBottom + 16);
      }
    });
  }

  function renderCanvasCategoryFallback() {
    const canvas = document.getElementById('chart-categories');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth || 300;
    const height = canvas.parentElement.clientHeight || 220;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const catMap = {};
    filteredTransactions.forEach(t => {
      if (t.status !== 'Refunded') {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      }
    });

    const labels = Object.keys(catMap);
    const dataVals = Object.values(catMap);
    const total = dataVals.reduce((a, b) => a + b, 0);

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    let startAngle = 0;
    dataVals.forEach((val, i) => {
      const sliceAngle = (val / total) * 2 * Math.PI;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Donut hole
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.65, 0, 2 * Math.PI);
    ctx.fill();

    // Side list
    const legendList = document.getElementById('category-legend-list');
    if (legendList) {
      legendList.innerHTML = labels.map((cat, idx) => {
        const val = catMap[cat];
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        const color = colors[idx % colors.length];
        return `
          <div class="cat-item-row">
            <div class="cat-item-left">
              <span class="cat-color-badge" style="background-color: ${color}"></span>
              <span>${cat}</span>
            </div>
            <div class="cat-item-val">${pct}%</div>
          </div>
        `;
      }).join('');
    }
  }

  function renderCanvasChannelFallback() {
    const canvas = document.getElementById('chart-channels');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth || 500;
    const height = canvas.parentElement.clientHeight || 260;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const channelMap = {};
    filteredTransactions.forEach(t => {
      channelMap[t.channel] = (channelMap[t.channel] || 0) + (t.status === 'Completed' ? t.amount : 0);
    });

    const labels = Object.keys(channelMap);
    const dataVals = Object.values(channelMap);
    const maxVal = Math.max(...dataVals, 1000);

    const padLeft = 130;
    const padRight = 30;
    const padTop = 20;
    const padBottom = 20;
    const rowHeight = (height - padTop - padBottom) / Math.max(1, labels.length);

    labels.forEach((ch, idx) => {
      const y = padTop + idx * rowHeight;
      const barH = Math.min(22, rowHeight - 12);
      const val = channelMap[ch];
      const barW = ((val / maxVal) * (width - padLeft - padRight));

      // Label
      ctx.fillStyle = '#334155';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(ch, padLeft - 10, y + (barH / 2) + 4);

      // Bar
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(padLeft, y, Math.max(2, barW), barH);

      // Value
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatCurrency(val), padLeft + barW + 8, y + (barH / 2) + 4);
    });
  }

  // --- Transactions Table & Pagination ---
  function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    const totalCount = filteredTransactions.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));

    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * rowsPerPage;
    const pageItems = filteredTransactions.slice(startIdx, startIdx + rowsPerPage);

    // Update pagination labels
    const pageStartEl = document.getElementById('page-start');
    const pageEndEl = document.getElementById('page-end');
    const pageTotalEl = document.getElementById('page-total');
    const curPageNumEl = document.getElementById('current-page-num');
    const totalPagesNumEl = document.getElementById('total-pages-num');

    if (pageStartEl) pageStartEl.textContent = totalCount === 0 ? 0 : startIdx + 1;
    if (pageEndEl) pageEndEl.textContent = Math.min(startIdx + rowsPerPage, totalCount);
    if (pageTotalEl) pageTotalEl.textContent = totalCount;
    if (curPageNumEl) curPageNumEl.textContent = currentPage;
    if (totalPagesNumEl) totalPagesNumEl.textContent = totalPages;

    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;

    // Check All Checkbox status
    const selectAllBox = document.getElementById('select-all-checkbox');
    if (selectAllBox) {
      const allCurrentSelected = pageItems.length > 0 && pageItems.every(item => selectedIds.has(item.id));
      selectAllBox.checked = allCurrentSelected;
    }

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px; color: #64748b;">
            No transactions match the selected filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(item => {
      const isChecked = selectedIds.has(item.id);
      let badgeClass = 'badge-completed';
      if (item.status === 'Pending') badgeClass = 'badge-pending';
      if (item.status === 'Refunded') badgeClass = 'badge-refunded';

      return `
        <tr data-id="${item.id}">
          <td>
            <input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
          </td>
          <td><span class="order-code">${escapeHtml(item.orderId)}</span></td>
          <td>${item.date}</td>
          <td><span class="customer-name">${escapeHtml(item.customer)}</span></td>
          <td>
            <div>${escapeHtml(item.product)}</div>
            <div style="font-size: 11px; color: #64748b;">${escapeHtml(item.category)}</div>
          </td>
          <td><span class="channel-tag">${escapeHtml(item.channel)}</span></td>
          <td class="text-right">${item.units || 1}</td>
          <td class="text-right" style="font-weight: 600; color: #0f172a;">${formatCurrency(item.amount)}</td>
          <td class="text-center"><span class="badge ${badgeClass}">${item.status}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon edit-btn" title="Edit" data-id="${item.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-icon delete-btn" title="Delete" data-id="${item.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- Modal: Add / Edit Transaction ---
  function openModal(transactionToEdit = null) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('transaction-form');

    form.reset();

    if (transactionToEdit) {
      title.textContent = `Edit Transaction (${transactionToEdit.orderId})`;
      document.getElementById('form-edit-id').value = transactionToEdit.id;
      document.getElementById('form-customer').value = transactionToEdit.customer;
      document.getElementById('form-date').value = transactionToEdit.date;
      document.getElementById('form-product').value = transactionToEdit.product;
      document.getElementById('form-category').value = transactionToEdit.category;
      document.getElementById('form-channel').value = transactionToEdit.channel;
      document.getElementById('form-status').value = transactionToEdit.status;
      document.getElementById('form-units').value = transactionToEdit.units || 1;
      document.getElementById('form-amount').value = transactionToEdit.amount;
    } else {
      title.textContent = 'Record New Transaction';
      document.getElementById('form-edit-id').value = '';
      document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('open');
  }

  function closeModal() {
    const modal = document.getElementById('transaction-modal');
    modal.classList.remove('open');
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('form-edit-id').value;
    const customer = document.getElementById('form-customer').value.trim();
    const date = document.getElementById('form-date').value;
    const product = document.getElementById('form-product').value.trim();
    const category = document.getElementById('form-category').value;
    const channel = document.getElementById('form-channel').value;
    const status = document.getElementById('form-status').value;
    const units = parseInt(document.getElementById('form-units').value, 10) || 1;
    const amount = parseFloat(document.getElementById('form-amount').value) || 0;

    if (!customer || !product || isNaN(amount) || amount <= 0) {
      showToast('Please provide valid customer, product and amount values', 'danger');
      return;
    }

    if (editId) {
      // Update existing
      const idx = transactions.findIndex(t => t.id === editId);
      if (idx !== -1) {
        transactions[idx] = {
          ...transactions[idx],
          customer,
          date,
          product,
          category,
          channel,
          status,
          units,
          amount
        };
        showToast(`Transaction ${transactions[idx].orderId} updated`, 'success');
      }
    } else {
      // Create new
      const nextNum = 9000 + transactions.length + 1;
      const newTxn = {
        id: 'txn_' + Date.now(),
        orderId: `ORD-${nextNum}`,
        customer,
        date,
        product,
        category,
        channel,
        status,
        units,
        amount
      };
      transactions.unshift(newTxn);
      showToast(`New sale recorded (${newTxn.orderId})`, 'success');
    }

    saveTransactions();
    populateCategoryFilter();
    applyFilters();
    closeModal();
  }

  // --- Deletion Handlers ---
  function deleteTransaction(id) {
    const item = transactions.find(t => t.id === id);
    if (!item) return;

    if (confirm(`Are you sure you want to delete order ${item.orderId} for ${item.customer}?`)) {
      transactions = transactions.filter(t => t.id !== id);
      selectedIds.delete(id);
      saveTransactions();
      applyFilters();
      showToast(`Order ${item.orderId} deleted`, 'info');
    }
  }

  function deleteSelectedTransactions() {
    if (selectedIds.size === 0) return;

    if (confirm(`Permanently delete ${selectedIds.size} selected transaction(s)?`)) {
      transactions = transactions.filter(t => !selectedIds.has(t.id));
      selectedIds.clear();
      saveTransactions();
      applyFilters();
      showToast('Selected transactions deleted', 'info');
    }
  }

  function updateSelectionActions() {
    const count = selectedIds.size;
    const btn = document.getElementById('btn-delete-selected');
    const badge = document.getElementById('selected-count');

    if (btn && badge) {
      badge.textContent = count;
      btn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  // --- CSV Export ---
  function exportCSV() {
    if (filteredTransactions.length === 0) {
      showToast('No records to export in current filter view', 'danger');
      return;
    }

    const headers = ['Order ID', 'Date', 'Customer', 'Product', 'Category', 'Channel', 'Units', 'Amount', 'Status'];
    const rows = filteredTransactions.map(t => [
      `"${t.orderId}"`,
      `"${t.date}"`,
      `"${(t.customer || '').replace(/"/g, '""')}"`,
      `"${(t.product || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.channel || '').replace(/"/g, '""')}"`,
      t.units || 1,
      t.amount.toFixed(2),
      `"${t.status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `salespulse-export-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filteredTransactions.length} records to CSV`, 'success');
  }

  // --- Reset to Default Dataset ---
  function resetData() {
    if (confirm('Reset sales database to original sample data? Any manual entries will be restored to initial state.')) {
      transactions = generateInitialData();
      saveTransactions();
      populateCategoryFilter();
      applyFilters();
      showToast('Sample dataset restored', 'info');
    }
  }

  // --- Toast Notification System ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Filter controls
    document.getElementById('filter-timeframe').addEventListener('change', applyFilters);
    document.getElementById('filter-category').addEventListener('change', applyFilters);
    document.getElementById('filter-status').addEventListener('change', applyFilters);
    document.getElementById('search-input').addEventListener('input', debounce(applyFilters, 250));

    // Export & Reset buttons
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-reset-data').addEventListener('click', resetData);

    // Modal controls
    document.getElementById('btn-open-modal').addEventListener('click', () => openModal());
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('transaction-form').addEventListener('submit', handleFormSubmit);

    // Close modal on click outside
    document.getElementById('transaction-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Bulk Delete
    document.getElementById('btn-delete-selected').addEventListener('click', deleteSelectedTransactions);

    // Pagination
    document.getElementById('btn-prev-page').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });

    document.getElementById('btn-next-page').addEventListener('click', () => {
      const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });

    // Table sorting headers
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'desc';
        }
        applyFilters();
      });
    });

    // Table Row delegation (Edit, Delete, Checkbox)
    document.getElementById('table-body').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-btn');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const item = transactions.find(t => t.id === id);
        if (item) openModal(item);
        return;
      }

      const delBtn = e.target.closest('.delete-btn');
      if (delBtn) {
        const id = delBtn.getAttribute('data-id');
        deleteTransaction(id);
        return;
      }

      const checkbox = e.target.closest('.row-checkbox');
      if (checkbox) {
        const id = checkbox.getAttribute('data-id');
        if (checkbox.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
        updateSelectionActions();
      }
    });

    // Select All Checkbox
    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const startIdx = (currentPage - 1) * rowsPerPage;
      const pageItems = filteredTransactions.slice(startIdx, startIdx + rowsPerPage);

      pageItems.forEach(item => {
        if (isChecked) {
          selectedIds.add(item.id);
        } else {
          selectedIds.delete(item.id);
        }
      });

      renderTable();
      updateSelectionActions();
    });
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // --- Application Initialization ---
  function init() {
    loadTransactions();
    populateCategoryFilter();
    setupEventListeners();
    applyFilters();
    updateStorageStatusIndicator();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
