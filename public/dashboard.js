console.log('✓ dashboard.js loaded');

// Register boxplot plugin if available
if (typeof window.ChartBoxPlot !== 'undefined') {
  Chart.register(window.ChartBoxPlot.BoxPlotController, window.ChartBoxPlot.BoxAndWiskers);
}

const tagCtx = document.getElementById('tagChart').getContext('2d');
const sentCtx = document.getElementById('sentChart').getContext('2d');
const tierCtx = document.getElementById('tierChart').getContext('2d');
const bubbleCtx = document.getElementById('bubbleChart').getContext('2d');
const timelineCtx = document.getElementById('timelineChart').getContext('2d');
const resolutionCtx = document.getElementById('resolutionChart').getContext('2d');
let tagChart, sentChart, tierChart, bubbleChart, timelineChart, resolutionChart;
let allFeedback = [];

// State for grouping
let currentGroupBy = 'tier';

// Modal state
let currentEditingId = null;
let currentEditingSentiment = 0;
let handleSentimentResize = null;

// Pagination and filtering state
let pageState = {
  sortKey: 'updated_desc',
  pageSize: 10,
  filterStatus: '',
  filterTier: '',
  filterSource: '',
  filterTag: '',
  filterSentiment: '',
  currentPage: 1,
  selectedId: null
};

// Setup grouping selector event listener
document.addEventListener('DOMContentLoaded', () => {
  const groupBySelect = document.getElementById('groupBySelect');
  if (groupBySelect) {
    groupBySelect.addEventListener('change', async (e) => {
      currentGroupBy = e.target.value;
      console.log(`📊 [GROUPBY] Changed to: ${currentGroupBy}`);
      
      try {
        const data = await fetch(`/analytics/sentiment-by-dimension?dimension=${currentGroupBy}`).then(r => r.json());
        console.log(`📊 [GROUPBY] Fetched data for dimension: ${currentGroupBy}`, Object.keys(data));
        renderTierSentimentChart(data);
      } catch (err) {
        console.error('❌ [GROUPBY] Error fetching data:', err);
      }
    });
  }
});

// ===== SUBMIT HANDLER =====
async function submit() {
  console.log('🔘 [SUBMIT] Button clicked');
  const feedback = (document.getElementById('modalFeedback').value || '').trim();
  const channel = document.getElementById('modalChannel').value;
  const source = document.getElementById('modalSource').value || 'user';
  const status = document.getElementById('modalStatus');
  const submitBtn = document.getElementById('modalSubmit');
  
  console.log('📝 [SUBMIT] Input:', { feedback: feedback.slice(0, 50), channel, source });
  
  if (!feedback) {
    console.warn('⚠️ [SUBMIT] No feedback provided');
    status.textContent = 'Please enter feedback';
    return;
  }
  
  setLoading(true);
  status.textContent = 'Submitting...';
  
  try {
    console.log('📤 [SUBMIT] Sending POST to /feedback');
    const res = await fetch('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, channel, source })
    });
    
    console.log('📥 [SUBMIT] Response status:', res.status);
    const data = await res.json();
    console.log('✅ [SUBMIT] Response data:', data);
    
    if (!res.ok) {
      status.textContent = 'Error: ' + (data.error || 'Unknown error');
      console.error('❌ [SUBMIT] Error from server:', data.error);
      return;
    }
    
    status.textContent = 'Saved! Analyzing...';
    document.getElementById('modalFeedback').value = '';
    console.log('💾 [SUBMIT] Feedback saved, refreshing data...');
    await new Promise(r => setTimeout(r, 500));
    await refreshAll();
    closeFeedbackModal();
  } catch (err) {
    console.error('❌ [SUBMIT] Exception:', err);
    status.textContent = 'Error: ' + err.message;
  } finally { 
    setLoading(false);
  }
}

// ===== REFRESH HANDLER =====
async function refreshAll(force = false) {
  console.log('🔄 [REFRESH] Loading data from /data and /summary', { force });
  
  try {
    const summaryUrl = force ? '/summary?refresh=1' : '/summary';
    const [dataRes, sumRes] = await Promise.all([
      fetch('/data').then(r => r.json()),
      fetch(summaryUrl).then(r => r.json())
    ]);
    
    console.log('📊 [REFRESH] Data response items:', dataRes?.length || 0);
    console.log('📊 [REFRESH] Summary tags:', sumRes?.tags?.length || 0);
    
    allFeedback = dataRes || [];
    renderTable(allFeedback);
    renderCharts(sumRes);
    await renderAdvancedCharts();
    renderGanttChart(allFeedback);
    console.log('✅ [REFRESH] UI updated');
  } catch (err) {
    console.error('❌ [REFRESH] Error:', err);
  }
}

// ===== APPLY FILTERS & SORTING =====
function applyFiltersAndSort(rows) {
  let filtered = [...rows];  // Clone array to avoid mutating original

  if (pageState.selectedId) {
    const selectedId = Number(pageState.selectedId);
    filtered = filtered.filter(r => r.id === selectedId);
  }

  if (pageState.filterStatus) {
    filtered = filtered.filter(r => r.status === pageState.filterStatus);
  }
  if (pageState.filterTier) {
    filtered = filtered.filter(r => r.user_tier === pageState.filterTier);
  }
  if (pageState.filterSource) {
    filtered = filtered.filter(r => r.channel === pageState.filterSource);
  }
  if (pageState.filterTag) {
    filtered = filtered.filter(r => r.tag === pageState.filterTag);
  }
  if (pageState.filterSentiment) {
    filtered = filtered.filter(r => {
      const sent = r.sentiment || 0;
      if (pageState.filterSentiment === 'positive') return sent > 0.3;
      if (pageState.filterSentiment === 'negative') return sent < -0.3;
      return sent >= -0.3 && sent <= 0.3;  // neutral
    });
  }

  const [fieldKey, direction] = pageState.sortKey.split('_');
  const field = fieldKey === 'updated' ? 'updated_at' : fieldKey === 'created' ? 'created_at' : null;
  console.log(`📊 [SORT-DEBUG] Before ${pageState.sortKey}:`, filtered.map(r => `ID${r.id}:${r[field] || r.created_at}`).join(' → '));

  filtered.sort((a, b) => {
    if (pageState.sortKey === 'positive_desc') {
      return (b.sentiment || 0) - (a.sentiment || 0);
    }
    if (pageState.sortKey === 'negative_desc') {
      return (a.sentiment || 0) - (b.sentiment || 0);
    }

    const valA = new Date(a[field] || a.created_at).getTime();
    const valB = new Date(b[field] || b.created_at).getTime();
    return direction === 'asc' ? valA - valB : valB - valA;
  });

  console.log(`📊 [SORT-DEBUG] After ${pageState.sortKey}:`, filtered.map(r => `ID${r.id}:${r[field] || r.created_at}`).join(' → '));
  console.log(`✓ [FILTER-SORT] Applied sort ${pageState.sortKey}, status="${pageState.filterStatus || 'all'}", tier="${pageState.filterTier || 'all'}", source="${pageState.filterSource || 'all'}"`);
  return filtered;
}

function renderTable(rows) {
  const filtered = applyFiltersAndSort(rows);
  const pageSize = parseInt(pageState.pageSize, 10);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  if (pageState.currentPage > totalPages) pageState.currentPage = totalPages;

  const startIdx = (pageState.currentPage - 1) * pageSize;
  const paged = filtered.slice(startIdx, startIdx + pageSize);

  console.log(`📋 [RENDER] Showing page ${pageState.currentPage}/${totalPages}, IDs:`, paged.map(r => r.id).join(', '));

  const table = document.querySelector('#table-body');
  if (!table) {
    console.warn('⚠️ Table body not found');
    return;
  }

  const [fieldKey] = pageState.sortKey.split('_');
  let whenLabel = 'Updated';
  let whenField = 'updated_at';
  
  if (fieldKey === 'created') {
    whenLabel = 'Created';
    whenField = 'created_at';
  } else if (fieldKey === 'positive' || fieldKey === 'negative') {
    whenLabel = 'Sentiment';
    whenField = null;  // No date field for sentiment
  }

  table.innerHTML = paged.map(r => {
    let whenVal;
    if (whenField) {
      whenVal = r[whenField] || r.created_at;
    } else {
      whenVal = r.sentiment?.toFixed(2) || 'N/A';
    }
    return `
      <tr data-id="${r.id}">
        <td>${r.id}</td>
        <td>
          <select class="status-select" data-id="${r.id}">
            <option value="To Do" ${r.status === 'To Do' ? 'selected' : ''}>To Do</option>
            <option value="in progress" ${r.status === 'in progress' ? 'selected' : ''}>In Progress</option>
            <option value="to be reviewed" ${r.status === 'to be reviewed' ? 'selected' : ''}>To Review</option>
            <option value="done" ${r.status === 'done' ? 'selected' : ''}>Done</option>
          </select>
        </td>
        <td>
          <select class="tag-select" data-id="${r.id}">
            <option value="Bug Report" ${r.tag === 'Bug Report' ? 'selected' : ''}>Bug Report</option>
            <option value="Feature Request" ${r.tag === 'Feature Request' ? 'selected' : ''}>Feature Request</option>
            <option value="Urgent" ${r.tag === 'Urgent' ? 'selected' : ''}>Urgent</option>
            <option value="Security" ${r.tag === 'Security' ? 'selected' : ''}>Security</option>
            <option value="Performance" ${r.tag === 'Performance' ? 'selected' : ''}>Performance</option>
            <option value="Praise" ${r.tag === 'Praise' ? 'selected' : ''}>Praise</option>
            <option value="Other" ${r.tag === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </td>
        <td style="cursor: pointer; color: #3b82f6;" onclick="openSentimentModal(${r.id}, ${r.sentiment || 0})" title="Click to edit sentiment">${r.sentiment?.toFixed ? r.sentiment.toFixed(2) : 'N/A'}</td>
        <td class="text-cell" data-id="${r.id}" contenteditable="true" title="Click to edit text" style="max-width: 260px; overflow: hidden;">${escapeHtml(r.text)}</td>
        <td><span class="tag" style="font-size: 11px;">${r.user_tier || 'unknown'}</span></td>
        <td>${r.channel || '-'}</td>
        <td><span class="pill" style="background:#1f2937;">${whenLabel}</span> ${typeof whenVal === 'string' && whenVal.includes('-') ? whenVal.slice(0, 16) : whenVal}</td>
        <td>
          <button class="small save-btn" data-id="${r.id}">Save</button>
        </td>
      </tr>`;
  }).join('');

  const paginationContainer = document.querySelector('#pagination-main');
  if (paginationContainer) {
    paginationContainer.innerHTML = '';
    if (totalPages > 1) {
      if (pageState.currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'small secondary';
        prevBtn.textContent = '← Previous';
        prevBtn.onclick = () => { pageState.currentPage--; renderTable(rows); };
        paginationContainer.appendChild(prevBtn);
      }

      for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'small ' + (i === pageState.currentPage ? '' : 'secondary');
        pageBtn.textContent = i;
        pageBtn.onclick = () => { pageState.currentPage = i; renderTable(rows); };
        paginationContainer.appendChild(pageBtn);
      }

      if (pageState.currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'small secondary';
        nextBtn.textContent = 'Next →';
        nextBtn.onclick = () => { pageState.currentPage++; renderTable(rows); };
        paginationContainer.appendChild(nextBtn);
      }
    }
  }

  table.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = parseInt(e.target.dataset.id, 10);
      const newStatus = e.target.value;
      console.log(`🔄 [STATUS-CHANGE] ID ${id} -> ${newStatus}`);
      await updateFeedbackStatus(id, newStatus);
      await refreshAll();
    });
  });

  table.querySelectorAll('.tag-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = parseInt(e.target.dataset.id, 10);
      const newTag = e.target.value;
      console.log(`🏷️ [TAG-CHANGE] ID ${id} -> ${newTag}`);
      await updateFeedbackTag(id, newTag);
      await refreshAll();
    });
  });

  table.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(e.target.dataset.id, 10);
      const row = e.target.closest('tr');
      const text = row.querySelector('.text-cell').textContent;
      console.log(`💾 [SAVE] ID ${id}, text: "${text.slice(0, 30)}..."`);
      await updateFeedbackText(id, text);
    });
  });
}

// ===== UPDATE FEEDBACK STATUS =====
async function updateFeedbackStatus(id, status) {
  console.log(`✏️ [UPDATE-STATUS] ID ${id} to "${status}"`);
  try {
    const res = await fetch(`/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ [UPDATE-STATUS] Success`);
    } else {
      console.error(`❌ [UPDATE-STATUS] Error:`, data.error);
    }
  } catch (err) {
    console.error(`❌ [UPDATE-STATUS] Exception:`, err);
  }
}

// ===== UPDATE FEEDBACK TEXT =====
async function updateFeedbackText(id, text) {
  console.log(`✏️ [UPDATE-TEXT] ID ${id}`);
  try {
    const res = await fetch(`/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ [UPDATE-TEXT] Success`);
      await new Promise(r => setTimeout(r, 300));
      await refreshAll();
    } else {
      console.error(`❌ [UPDATE-TEXT] Error:`, data.error);
    }
  } catch (err) {
    console.error(`❌ [UPDATE-TEXT] Exception:`, err);
  }
}

// ===== UPDATE FEEDBACK TAG =====
async function updateFeedbackTag(id, tag) {
  console.log(`✏️ [UPDATE-TAG] ID ${id} to "${tag}"`);
  try {
    const res = await fetch(`/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ [UPDATE-TAG] Success`);
    } else {
      console.error(`❌ [UPDATE-TAG] Error:`, data.error);
    }
  } catch (err) {
    console.error(`❌ [UPDATE-TAG] Exception:`, err);
  }
}

// ===== RENDER CHARTS =====
async function renderAdvancedCharts() {
  console.log('📊 [ADVANCED-CHARTS] Fetching advanced analytics data');
  
  try {
    const [dimensionData, timelineData, urgencyData, resolutionData] = await Promise.all([
      fetch(`/analytics/sentiment-by-dimension?dimension=${currentGroupBy}`).then(r => r.json()),
      fetch('/analytics/status-timeline').then(r => r.json()),
      fetch('/analytics/urgency-impact').then(r => r.json()),
      fetch('/analytics/resolution-time').then(r => r.json())
    ]);
    
    renderTierSentimentChart(dimensionData);
    renderStatusTimelineChart(timelineData);
    renderUrgencyImpactChart(urgencyData);
    renderResolutionTimeChart(resolutionData);
    
    console.log('✅ [ADVANCED-CHARTS] All advanced charts rendered with grouping:', currentGroupBy);
  } catch (err) {
    console.error('❌ [ADVANCED-CHARTS] Error:', err);
  }
}

function renderTierSentimentChart(tierData) {
  console.log('📈 [TIER-SENTIMENT] Creating box plot with @sgratzl plugin');
  
  if (tierChart) tierChart.destroy();
  
  const dimensions = Object.keys(tierData).sort();
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa', '#fb923c'];
  
  // Transform data into boxplot format - create data array for each position
  const boxPlotData = dimensions.map((dim, idx) => {
    const values = tierData[dim] || [];
    if (values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    const q1Idx = Math.floor(len * 0.25);
    const medianIdx = Math.floor(len * 0.5);
    const q3Idx = Math.floor(len * 0.75);
    
    return {
      min: sorted[0],
      q1: sorted[q1Idx],
      median: sorted[medianIdx],
      q3: sorted[q3Idx],
      max: sorted[len - 1]
    };
  }).filter(d => d !== null);
  
  // Single dataset with all box plots
  const datasets = [{
    label: 'Sentiment',
    data: boxPlotData,
    backgroundColor: dimensions.map((dim, idx) => colors[idx % colors.length] + '80'),
    borderColor: dimensions.map((dim, idx) => colors[idx % colors.length]),
    borderWidth: 2,
    outlierColor: dimensions.map((dim, idx) => colors[idx % colors.length]),
    itemRadius: 0
  }];
  
  tierChart = new Chart(tierCtx, {
    type: 'boxplot',
    data: {
      labels: dimensions,
      datasets
    },
    options: {
      responsive: true,
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const dimensionValue = dimensions[idx];
          // Toggle filter based on currentGroupBy
          if (currentGroupBy === 'tier') {
            pageState.filterTier = pageState.filterTier === dimensionValue ? '' : dimensionValue;
            const filterTierDropdown = document.getElementById('filterTier');
            if (filterTierDropdown) filterTierDropdown.value = pageState.filterTier;
          } else if (currentGroupBy === 'status') {
            pageState.filterStatus = pageState.filterStatus === dimensionValue ? '' : dimensionValue;
            const filterStatusDropdown = document.getElementById('filterStatus');
            if (filterStatusDropdown) filterStatusDropdown.value = pageState.filterStatus;
          } else if (currentGroupBy === 'tag') {
            pageState.filterTag = pageState.filterTag === dimensionValue ? '' : dimensionValue;
            const filterTagDropdown = document.getElementById('filterTag');
            if (filterTagDropdown) filterTagDropdown.value = pageState.filterTag;
          } else if (currentGroupBy === 'channel') {
            pageState.filterSource = pageState.filterSource === dimensionValue ? '' : dimensionValue;
            const filterSourceDropdown = document.getElementById('filterSource');
            if (filterSourceDropdown) filterSourceDropdown.value = pageState.filterSource;
          }
          pageState.currentPage = 1;
          console.log(`📊 [BOX-PLOT-CLICK] ${currentGroupBy} filter: ${pageState[currentGroupBy === 'tier' ? 'filterTier' : currentGroupBy === 'status' ? 'filterStatus' : currentGroupBy === 'tag' ? 'filterTag' : 'filterSource'] || 'cleared'}`);
          renderTable(allFeedback);
          updateChartIndicators();
        }
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#e2e8f0',
            padding: 15,
            font: { size: 13 }
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
          borderColor: '#475569',
          borderWidth: 1,
          padding: 12
        }
      },
      scales: {
        x: {
          ticks: { color: '#e2e8f0', font: { size: 12 } },
          grid: { color: '#1f2937' }
        },
        y: {
          min: -1.1,
          max: 1.1,
          ticks: { color: '#e2e8f0', font: { size: 12 } },
          title: { display: true, text: 'Sentiment', color: '#e2e8f0' },
          grid: { color: '#1f2937' }
        }
      }
    }
  });
  
  console.log('✅ [TIER-SENTIMENT] Box plot created with proper elements');
}

function renderStatusTimelineChart(timelineData) {
  console.log('📈 [STATUS-TIMELINE] Creating workflow timeline');
  
  if (timelineChart) timelineChart.destroy();
  
  const statusTypes = [...new Set(timelineData.map(r => r.status))];
  const dates = [...new Set(timelineData.map(r => r.date))].sort();
  
  const datasets = statusTypes.map((status, idx) => {
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];
    return {
      label: status,
      data: dates.map(date => {
        const record = timelineData.find(r => r.date === date && r.status === status);
        return record?.count || 0;
      }),
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length] + '33',
      tension: 0.4,
      fill: true
    };
  });
  
  timelineChart = new Chart(timelineCtx, {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const datasetIdx = elements[0].datasetIndex;
          const status = statusTypes[datasetIdx];
          pageState.filterStatus = pageState.filterStatus === status ? '' : status;
          pageState.filterTag = '';
          pageState.filterSentiment = '';
          pageState.currentPage = 1;
          console.log(`📊 [TIMELINE-CLICK] Status filter: ${pageState.filterStatus || 'cleared'}`);
          renderTable(allFeedback);
          updateChartIndicators();
        }
      },
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      scales: {
        x: { ticks: { color: '#e2e8f0' } },
        y: { ticks: { color: '#e2e8f0' }, stacked: false }
      }
    }
  });
  
  console.log('✅ [STATUS-TIMELINE] Chart created');
}

function renderUrgencyImpactChart(urgencyData) {
  console.log('📈 [URGENCY-IMPACT] Creating bubble chart');
  
  if (bubbleChart) bubbleChart.destroy();
  
  const bubbleDatasets = [{
    label: 'Feedback Priority Matrix',
    data: urgencyData.map(item => ({
      x: item.urgency_score * 100,
      y: item.impact * 100,
      r: Math.sqrt(item.impact || 1) * 8
    })),
    backgroundColor: 'rgba(59, 130, 246, 0.6)',
    borderColor: '#3b82f6',
    borderWidth: 2
  }];
  
  bubbleChart = new Chart(bubbleCtx, {
    type: 'bubble',
    data: { datasets: bubbleDatasets },
    options: {
      responsive: true,
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const item = urgencyData[idx];
          if (item && item.id) {
            // Check if already filtered to this item (by checking all three filters match)
            const feedbackItem = allFeedback.find(f => f.id === item.id);
            if (feedbackItem) {
              // Toggle: if already filtered to this item, clear the filters
              const isCurrentFilter = pageState.filterStatus === feedbackItem.status && 
                                     pageState.filterTag === feedbackItem.tag && 
                                     pageState.filterTier === feedbackItem.user_tier;
              
              if (isCurrentFilter) {
                pageState.filterStatus = '';
                pageState.filterTag = '';
                pageState.filterTier = '';
                console.log(`📊 [BUBBLE-CLICK] Filters cleared`);
              } else {
                pageState.filterStatus = feedbackItem.status || '';
                pageState.filterTag = feedbackItem.tag || '';
                pageState.filterTier = feedbackItem.user_tier || '';
                console.log(`📊 [BUBBLE-CLICK] Filtered to feedback ID: ${item.id}`);
              }
              pageState.currentPage = 1;
              renderTable(allFeedback);
              updateChartIndicators();
            }
          }
        }
      },
      plugins: {
        legend: { labels: { color: '#e2e8f0' } },
        tooltip: { callbacks: { label: (ctx) => `Urgency: ${(ctx.raw.x).toFixed(0)}%, Impact: ${(ctx.raw.y).toFixed(0)}%` } }
      },
      scales: {
        x: { ticks: { color: '#e2e8f0' }, title: { display: true, text: 'Urgency →', color: '#e2e8f0' } },
        y: { ticks: { color: '#e2e8f0' }, title: { display: true, text: 'Impact →', color: '#e2e8f0' } }
      }
    }
  });
  
  console.log('✅ [URGENCY-IMPACT] Chart created');
}

function renderResolutionTimeChart(resolutionData) {
  console.log('📈 [RESOLUTION-TIME] Creating performance chart');
  
  if (resolutionChart) resolutionChart.destroy();
  
  // Only keep actionable tags (task-like)
  const actionable = new Set(['Bug Report', 'Feature Request', 'Urgent', 'Security', 'Performance']);
  const filtered = resolutionData.filter(r => actionable.has(r.tag));
  const fTags = filtered.map(r => r.tag || 'untagged');
  const fHours = filtered.map(r => r.avg_hours || 0);
  const fCounts = filtered.map(r => r.count || 0);

  if (!filtered.length) {
    console.warn('⚠️ [RESOLUTION-TIME] No actionable tags to display');
    return;
  }
  
  // Define colors by tag type for consistency
  const getColorForTag = (tag) => {
    const tagColors = {
      'Bug Report': '#ef4444',      // red
      'Security': '#f59e0b',         // amber/orange
      'Performance': '#ec4899',      // pink
      'Urgent': '#dc2626',           // dark red
      'Feature Request': '#22c55e',  // green
      'Other': '#6b7280'             // gray fallback
    };
    return tagColors[tag] || '#94a3b8';
  };
  
  resolutionChart = new Chart(resolutionCtx, {
    type: 'bar',
    data: {
      labels: fTags,
      datasets: [{
        label: 'Avg Resolution Time (hours)',
        data: fHours,
        backgroundColor: fTags.map(tag => getColorForTag(tag)),
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const tag = fTags[idx];
          pageState.filterTag = pageState.filterTag === tag ? '' : tag;
          pageState.filterSentiment = '';
          pageState.filterStatus = '';
          pageState.currentPage = 1;
          console.log(`📊 [RESOLUTION-CLICK] Tag filter: ${pageState.filterTag || 'cleared'}`);
          const filterTagDropdown = document.getElementById('filterTag');
          if (filterTagDropdown) filterTagDropdown.value = pageState.filterTag;
          renderTable(allFeedback);
          updateChartIndicators();
        }
      },
      indexAxis: 'y',
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      scales: { 
        x: { 
          ticks: { color: '#e2e8f0' },
          beginAtZero: true
        }, 
        y: { ticks: { color: '#e2e8f0' } } 
      }
    }
  });
  
  console.log('✅ [RESOLUTION-TIME] Chart created');
}

function renderCharts(summary) {
  console.log('📈 [RENDER-CHARTS] Creating charts');
  const tags = summary.tags || [];
  const sentiments = summary.sentiment || [];
  
  console.log('  - Tags:', tags.length, tags.map(t => `${t.tag}:${t.count}`).join(', '));
  console.log('  - Sentiments:', sentiments.length, sentiments.map(s => `${s.sentiment_bucket}:${s.count}`).join(', '));
  
  const tagLabels = tags.map(t => t.tag || 'Other');
  const tagCounts = tags.map(t => t.count);
  const sentLabels = sentiments.map(s => s.sentiment_bucket || 'unknown');
  const sentCounts = sentiments.map(s => s.count);

  if (tagChart) tagChart.destroy();
  tagChart = new Chart(tagCtx, {
    type: 'doughnut',
    data: { labels: tagLabels, datasets: [{ data: tagCounts, backgroundColor: ['#22c55e','#3b82f6','#f59e0b','#ef4444','#a855f7','#6b7280'] }] },
    options: {
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const tag = tagLabels[idx];
          pageState.filterTag = pageState.filterTag === tag ? '' : tag;
          pageState.filterSentiment = '';
          pageState.currentPage = 1;
          console.log(`📊 [CHART-CLICK] Tag filter: ${pageState.filterTag || 'all'}`);
          const filterTagDropdown = document.getElementById('filterTag');
          if (filterTagDropdown) filterTagDropdown.value = pageState.filterTag;
          renderTable(allFeedback);
          updateChartIndicators();
        }
      },
      plugins: { legend: { labels: { color: '#e2e8f0' } } }
    }
  });

  if (sentChart) sentChart.destroy();
  sentChart = new Chart(sentCtx, {
    type: 'bar',
    data: { 
      labels: sentLabels, 
      datasets: [{ 
        label: 'Count', 
        data: sentCounts, 
        backgroundColor: sentLabels.map(s => {
          if (s === 'positive') return '#22c55e';
          if (s === 'negative') return '#ef4444';
          return '#f59e0b';  // neutral
        })
      }] 
    },
    options: {
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const sent = sentLabels[idx];
          pageState.filterSentiment = pageState.filterSentiment === sent ? '' : sent;
          pageState.filterTag = '';
          pageState.currentPage = 1;
          console.log(`📊 [CHART-CLICK] Sentiment filter: ${pageState.filterSentiment || 'all'}`);
          renderTable(allFeedback);
          updateChartIndicators();
        }
      },
      scales: { x: { ticks: { color: '#e2e8f0' } }, y: { ticks: { color: '#e2e8f0' } } },
      plugins: { legend: { labels: { color: '#e2e8f0' } } }
    }
  });
  console.log('✅ [RENDER-CHARTS] Charts created with color-coded sentiment');
  updateChartIndicators();
}

// ===== UPDATE CHART FILTER INDICATORS =====
function updateChartIndicators() {
  const tagCtxCanvas = document.getElementById('tagChart');
  const sentCtxCanvas = document.getElementById('sentChart');
  
  // Remove previous indicators
  document.querySelectorAll('.chart-filter-indicator').forEach(el => el.remove());
  
  if (pageState.filterTag) {
    const indicator = document.createElement('div');
    indicator.className = 'chart-filter-indicator';
    indicator.textContent = `📌 Filtered by tag: ${pageState.filterTag}`;
    indicator.style.cssText = 'font-size: 12px; color: #22c55e; margin-top: 8px; font-weight: 600;';
    tagCtxCanvas.parentElement.appendChild(indicator);
  }
  
  if (pageState.filterSentiment) {
    const indicator = document.createElement('div');
    indicator.className = 'chart-filter-indicator';
    indicator.textContent = `📊 Filtered by sentiment: ${pageState.filterSentiment}`;
    indicator.style.cssText = 'font-size: 12px; color: #22c55e; margin-top: 8px; font-weight: 600;';
    sentCtxCanvas.parentElement.appendChild(indicator);
  }
  
  // Add indicators for tier, status filters from advanced charts
  const tierCtxCanvas = document.getElementById('tierChart');
  const timelineCtxCanvas = document.getElementById('timelineChart');
  const resolutionCtxCanvas = document.getElementById('resolutionChart');
  const bubbleCtxCanvas = document.getElementById('bubbleChart');
  
  if (pageState.filterTier) {
    const indicator = document.createElement('div');
    indicator.className = 'chart-filter-indicator';
    indicator.textContent = `👤 Filtered by tier: ${pageState.filterTier}`;
    indicator.style.cssText = 'font-size: 12px; color: #22c55e; margin-top: 8px; font-weight: 600;';
    if (tierCtxCanvas) tierCtxCanvas.parentElement.appendChild(indicator);
  }
  
  if (pageState.filterStatus) {
    const indicator = document.createElement('div');
    indicator.className = 'chart-filter-indicator';
    indicator.textContent = `📋 Filtered by status: ${pageState.filterStatus}`;
    indicator.style.cssText = 'font-size: 12px; color: #22c55e; margin-top: 8px; font-weight: 600;';
    if (timelineCtxCanvas) timelineCtxCanvas.parentElement.appendChild(indicator);
  }
  
  if (pageState.filterTag) {
    const indicator = document.createElement('div');
    indicator.className = 'chart-filter-indicator';
    indicator.textContent = `🏷️ Filtered by tag: ${pageState.filterTag}`;
    indicator.style.cssText = 'font-size: 12px; color: #22c55e; margin-top: 8px; font-weight: 600;';
    if (tierCtxCanvas) tierCtxCanvas.parentElement.appendChild(indicator);
  }
}

// ===== GANTT CHART / TIMELINE VIEW =====
function renderGanttChart(data) {
  console.log('📅 [GANTT] Rendering timeline view');
  
  const container = document.getElementById('ganttContainer');
  if (!container) {
    console.warn('⚠️ [GANTT] Container not found');
    return;
  }
  
  const groupBy = document.getElementById('ganttGroupBy')?.value || 'status';
  
  // Group feedback by selected dimension
  const groups = {};
  data.forEach(item => {
    let key = item[groupBy] || item.user_tier || 'unknown';
    if (groupBy === 'tier') key = item.user_tier || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  
  // Get date range
  const allDates = data.map(item => new Date(item.created_at || item.updated_at));
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
  
  // Color schemes
  const statusColors = {
    'To Do': '#ef4444',
    'in progress': '#f59e0b',
    'to be reviewed': '#3b82f6',
    'done': '#22c55e',
    'unknown': '#6b7280'
  };
  
  const tierColors = {
    'free': '#6b7280',
    'pro': '#3b82f6',
    'business': '#22c55e',
    'enterprise': '#f59e0b',
    'developer': '#a78bfa',
    'tester': '#fb923c',
    'unknown': '#94a3b8'
  };
  
  const tagColors = {
    'bug': '#ef4444',
    'feature-request': '#3b82f6',
    'security': '#f59e0b',
    'performance': '#a78bfa',
    'feedback': '#22c55e',
    'unknown': '#6b7280'
  };
  
  const colorMap = groupBy === 'status' ? statusColors : (groupBy === 'tier' ? tierColors : tagColors);
  
  // Build HTML
  let html = `
    <div style="min-width: ${daysDiff * 60 + 200}px;">
      <div style="display: flex; border-bottom: 2px solid #1f2937; padding-bottom: 8px; margin-bottom: 8px;">
        <div style="width: 180px; font-weight: 600; color: #94a3b8; font-size: 13px; padding: 8px;">
          ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
        </div>
        <div style="flex: 1; display: flex; gap: 2px;">
  `;
  
  // Date headers
  for (let i = 0; i < daysDiff; i++) {
    const date = new Date(minDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    html += `<div style="width: 60px; text-align: center; font-size: 11px; color: #64748b;">${dateStr}</div>`;
  }
  
  html += `</div></div>`;
  
  // Render each group
  Object.keys(groups).sort().forEach(groupKey => {
    const items = groups[groupKey];
    
    // Calculate positions with overlap detection
    const itemsWithPositions = items.map(item => {
      const createdDate = new Date(item.created_at);
      const updatedDate = new Date(item.updated_at);
      const startDay = Math.floor((createdDate - minDate) / (1000 * 60 * 60 * 24));
      const endDay = Math.floor((updatedDate - minDate) / (1000 * 60 * 60 * 24));
      const duration = Math.max(1, endDay - startDay + 1);
      
      return {
        item,
        startDay,
        endDay,
        duration,
        row: 0  // Will be calculated
      };
    });
    
    // Sort by start day, then duration
    itemsWithPositions.sort((a, b) => a.startDay - b.startDay || a.duration - b.duration);
    
    // Assign rows to avoid overlaps
    const rows = [];
    itemsWithPositions.forEach(itemPos => {
      let assignedRow = 0;
      
      // Find the first row where this item doesn't overlap
      for (let r = 0; r < rows.length; r++) {
        const hasOverlap = rows[r].some(existing => {
          return !(itemPos.endDay < existing.startDay || itemPos.startDay > existing.endDay);
        });
        
        if (!hasOverlap) {
          assignedRow = r;
          rows[r].push(itemPos);
          break;
        }
      }
      
      // If no suitable row found, create a new one
      if (assignedRow === 0 && (rows.length === 0 || rows.every(row => 
        row.some(existing => !(itemPos.endDay < existing.startDay || itemPos.startDay > existing.endDay))
      ))) {
        assignedRow = rows.length;
        rows[assignedRow] = [itemPos];
      }
      
      itemPos.row = assignedRow;
    });
    
    const rowCount = rows.length;
    const rowHeight = 28; // Height per row
    const containerHeight = rowCount * rowHeight + 8;
    
    html += `
      <div style="display: flex; align-items: flex-start; margin-bottom: 4px; min-height: ${containerHeight}px;">
        <div style="width: 180px; padding: 8px; font-size: 13px; color: #e2e8f0; font-weight: 500;">
          ${groupKey} <span style="color: #64748b; font-size: 11px;">(${items.length})</span>
        </div>
        <div style="flex: 1; position: relative; height: ${containerHeight}px; display: flex; gap: 2px;">
    `;
    
    // Timeline cells
    for (let i = 0; i < daysDiff; i++) {
      html += `<div style="width: 60px; height: 100%; border-left: 1px solid #1f2937; position: relative;"></div>`;
    }
    
    // Overlay feedback bars
    html += `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">`;
    
    itemsWithPositions.forEach(itemPos => {
      const { item, startDay, duration, row } = itemPos;
      const color = statusColors[item.status] || colorMap[groupKey] || '#6b7280';
      const leftPos = startDay * 62; // 60px width + 2px gap
      const width = duration * 62 - 4;
      const topPos = row * rowHeight + 4;
      
      html += `
        <div style="
          position: absolute;
          left: ${leftPos}px;
          width: ${width}px;
          height: 22px;
          top: ${topPos}px;
          background: ${color}88;
          border: 2px solid ${color};
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          color: #fff;
          padding: 2px 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        " title="${item.text?.substring(0, 100) || 'No text'} (ID: ${item.id}, ${item.status})">
          #${item.id} ${item.text?.substring(0, 20) || ''}
        </div>
      `;
    });
    
    html += `</div></div></div>`;
  });
  
  html += `</div>`;
  
  container.innerHTML = html;
  console.log('✅ [GANTT] Timeline rendered with', Object.keys(groups).length, 'groups');
}

// ===== SENTIMENT EDITING =====
function openSentimentModal(id, currentSentiment) {
  currentEditingId = id;
  currentEditingSentiment = currentSentiment || 0;
  
  document.getElementById('sentimentLabel').textContent = `Feedback ID: ${id}`;
  
  // Initialize slider UI
  const slider = document.getElementById('sentimentSlider');
  if (slider) {
    slider.value = String(currentEditingSentiment);
    slider.oninput = (e) => {
      const v = parseFloat(e.target.value);
      currentEditingSentiment = isNaN(v) ? 0 : Math.max(-1, Math.min(1, v));
      updateSentimentSliderUI(currentEditingSentiment);
    };
  }
  
  document.getElementById('sentimentModal').classList.add('active');
  console.log(`💬 [SENTIMENT] Opened editor for ID ${id}, current: ${currentSentiment}`);

  // Reposition tooltip on resize while modal is open
  handleSentimentResize = () => updateSentimentSliderUI(currentEditingSentiment);
  window.addEventListener('resize', handleSentimentResize);
  // Ensure initial tooltip is positioned after layout
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => updateSentimentSliderUI(currentEditingSentiment));
  } else {
    setTimeout(() => updateSentimentSliderUI(currentEditingSentiment), 0);
  }
}

// Update slider label, emoji, and optional styling
function updateSentimentSliderUI(v) {
  const slider = document.getElementById('sentimentSlider');
  const wrap = document.getElementById('sentimentSliderWrap');
  const tooltip = document.getElementById('sentimentTooltip');
  const tEmoji = document.getElementById('sentimentTooltipEmoji');
  const tValue = document.getElementById('sentimentTooltipValue');
  // Emoji mapping
  let emoji = '😐';
  if (v <= -0.6) emoji = '😠';
  else if (v < -0.2) emoji = '😞';
  else if (v > 0.6) emoji = '😄';
  else if (v > 0.2) emoji = '😊';
  if (tEmoji) tEmoji.textContent = emoji;
  // Gradient and title
  if (slider) {
    const pct = Math.round(((v + 1) / 2) * 100);
    slider.style.background = `linear-gradient(90deg, #ef4444 0%, #ef4444 ${pct}%, #1f2937 ${pct}%, #1f2937 100%)`;
    slider.title = (v >= 0 ? '+' : '') + v.toFixed(2); // native tooltip
    if (wrap && tooltip) {
      const wrapWidth = wrap.clientWidth || 0;
      const x = (pct / 100) * wrapWidth;
      const clampedX = Math.max(8, Math.min(wrapWidth - 8, x));
      tooltip.style.left = clampedX + 'px';
      if (tValue) tValue.textContent = (v >= 0 ? '+' : '') + v.toFixed(2);
    }
  }
}

function closeSentimentModal() {
  document.getElementById('sentimentModal').classList.remove('active');
  currentEditingId = null;
  if (handleSentimentResize) {
    window.removeEventListener('resize', handleSentimentResize);
    handleSentimentResize = null;
  }
}

function saveSentimentEdit() {
  if (!currentEditingId) return;
  console.log(`💾 [SENTIMENT] Saving ID ${currentEditingId} to ${currentEditingSentiment}`);
  updateFeedbackSentiment(currentEditingId, currentEditingSentiment);
  closeSentimentModal();
}

async function updateFeedbackSentiment(id, sentiment) {
  console.log(`✏️ [UPDATE-SENTIMENT] ID ${id} to ${sentiment}`);
  try {
    const res = await fetch(`/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentiment })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ [UPDATE-SENTIMENT] Success`);
      await refreshAll(true);  // Force refresh to update chart
    } else {
      console.error(`❌ [UPDATE-SENTIMENT] Error:`, data.error);
    }
  } catch (err) {
    console.error(`❌ [UPDATE-SENTIMENT] Exception:`, err);
  }
}

// ===== MODAL HANDLERS =====
function openFeedbackModal() {
  document.getElementById('feedbackModal').classList.add('active');
  document.getElementById('modalFeedback').focus();
  console.log('📝 [MODAL] Feedback form opened');
}

function closeFeedbackModal() {
  document.getElementById('feedbackModal').classList.remove('active');
  document.getElementById('modalFeedback').value = '';
  document.getElementById('modalSource').value = '';
  document.getElementById('modalStatus').textContent = '';
  console.log('📝 [MODAL] Feedback form closed');
}

function submitFeedbackModal() {
  submit();
}

function renderSearch(rows) {
  console.log(`🔍 [RENDER-SEARCH] Rendering ${rows?.length || 0} results`);
  const box = document.getElementById('searchResults');
  if (!rows.length) { 
    box.innerHTML = '<p style="color:#94a3b8">No matches</p>'; 
    return; 
  }
  box.innerHTML = rows.map(r => {
    const id = r.id ?? r.metadata?.id ?? '';
    const tag = r.tag || r.metadata?.tag || 'Pending';
    const text = escapeHtml(r.text || r.metadata?.text || '');
    return `
    <div class="pill search-pill" data-id="${id}" style="display:block; margin-top:6px; cursor:pointer;">
      ${id ? `<span style="color:#94a3b8">#${id}</span> · ` : ''}<strong>${tag}</strong> — ${text}
    </div>`;
  }).join('');

  box.querySelectorAll('.search-pill').forEach((el, idx) => {
    const hit = rows[idx];
    const id = hit?.id ?? hit?.metadata?.id;
    if (!id) return;
    el.addEventListener('click', () => {
      pageState.selectedId = Number(id);
      pageState.filterStatus = '';
      pageState.filterTier = '';
      pageState.filterSource = '';
      pageState.filterTag = '';
      pageState.filterSentiment = '';
      pageState.currentPage = 1;

      if (filterStatusSelect) filterStatusSelect.value = '';
      if (filterTierSelect) filterTierSelect.value = '';
      if (filterSourceSelect) filterSourceSelect.value = '';
      const filterTagDropdown = document.getElementById('filterTag');
      if (filterTagDropdown) filterTagDropdown.value = '';

      renderTable(allFeedback);
      updateChartIndicators();
      updateSelectionIndicator();
      box.innerHTML = '';
      if (searchInput) searchInput.value = '';

      setTimeout(() => {
        const rowEl = document.querySelector(`#table-body tr[data-id="${id}"]`);
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          rowEl.style.transition = rowEl.style.transition || 'background-color 0.6s ease';
          const originalBg = rowEl.style.backgroundColor;
          rowEl.style.backgroundColor = '#0f172a';
          setTimeout(() => { rowEl.style.backgroundColor = originalBg; }, 1200);
        }
      }, 30);
    });
  });
}

// ===== UPDATE SELECTION INDICATOR =====
function updateSelectionIndicator() {
  const indicator = document.getElementById('selectionIndicator');
  if (!indicator) return;

  if (pageState.selectedId) {
    const selectedItem = allFeedback.find(f => f.id === pageState.selectedId);
    const tag = selectedItem?.tag || 'Unknown';
    const id = pageState.selectedId;
    indicator.innerHTML = `
      <div class="selection-chip">
        <span>📌 Viewing: #${id} · ${tag}</span>
        <span class="selection-chip-close" onclick="clearSelection()">×</span>
      </div>
    `;
  } else {
    indicator.innerHTML = '';
  }
}

function clearSelection() {
  pageState.selectedId = null;
  pageState.currentPage = 1;
  renderTable(allFeedback);
  updateSelectionIndicator();
  updateChartIndicators();
  console.log('🔍 [SELECTION] Cleared');
}

// ===== HELPERS =====
function setLoading(isLoading) {
  document.getElementById('submit').disabled = isLoading;
  console.log(`⏳ [LOADING] Submit button disabled: ${isLoading}`);
}

function debounce(fn, wait) {
  let t; 
  return (...args) => { 
    clearTimeout(t); 
    t = setTimeout(() => {
      console.log(`⏱️ [DEBOUNCE] Executing debounced function after ${wait}ms`);
      fn(...args); 
    }, wait); 
  };
}

function escapeHtml(str='') {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

console.log('🎯 [INIT] Starting initialization...');

const openFeedbackBtn = document.getElementById('openFeedbackBtn');
const submitBtn = document.getElementById('modalSubmit');
const refreshBtn = document.getElementById('refresh');
const searchInput = document.getElementById('search');
const whenSelect = document.getElementById('whenSelect');
const sentimentSort = document.getElementById('sentimentSort');
const pageSizeSelect = document.getElementById('pageSize');
const filterStatusSelect = document.getElementById('filterStatus');
const filterTierSelect = document.getElementById('filterTier');
const filterSourceSelect = document.getElementById('filterSource');
const ganttGroupBy = document.getElementById('ganttGroupBy');

console.log('✓ [INIT] Elements found:', { 
  openFeedbackBtn: !!openFeedbackBtn,
  submitBtn: !!submitBtn, 
  refreshBtn: !!refreshBtn, 
  searchInput: !!searchInput,
  whenSelect: !!whenSelect,
  sentimentSort: !!sentimentSort,
  pageSizeSelect: !!pageSizeSelect,
  filterStatusSelect: !!filterStatusSelect,
  filterTierSelect: !!filterTierSelect,
  filterSourceSelect: !!filterSourceSelect,
  ganttGroupBy: !!ganttGroupBy
});

if (openFeedbackBtn) {
  openFeedbackBtn.onclick = openFeedbackModal;
  console.log('✓ [INIT] Open feedback button listener attached');
}

if (submitBtn) {
  submitBtn.onclick = submit;
  console.log('✓ [INIT] Submit button listener attached');
} else {
  console.error('❌ [INIT] Submit button NOT found!');
}

if (refreshBtn) {
  refreshBtn.onclick = () => refreshAll(true);
  console.log('✓ [INIT] Refresh button listener attached');
} else {
  console.error('❌ [INIT] Refresh button NOT found!');
}

// Sort & Filter listeners
if (whenSelect) {
  whenSelect.addEventListener('change', (e) => {
    pageState.sortKey = e.target.value;
    pageState.currentPage = 1;
    if (sentimentSort) sentimentSort.value = ''; // Clear sentiment sort
    console.log(`🔄 [SORT] Changed to: ${pageState.sortKey}`);
    renderTable(allFeedback);
  });
  console.log('✓ [INIT] When/sort listener attached');
}

if (sentimentSort) {
  sentimentSort.addEventListener('change', (e) => {
    if (e.target.value) {
      pageState.sortKey = e.target.value;
      if (whenSelect) whenSelect.value = ''; // Clear when sort
    } else {
      pageState.sortKey = 'updated_desc'; // Default
    }
    pageState.currentPage = 1;
    console.log(`🔄 [SENTIMENT-SORT] Changed to: ${pageState.sortKey}`);
    renderTable(allFeedback);
  });
  console.log('✓ [INIT] Sentiment sort listener attached');
}

if (ganttGroupBy) {
  ganttGroupBy.addEventListener('change', () => {
    renderGanttChart(allFeedback);
  });
  console.log('✓ [INIT] Gantt group-by listener attached');
}

if (pageSizeSelect) {
  pageSizeSelect.addEventListener('change', (e) => {
    pageState.pageSize = e.target.value;
    pageState.currentPage = 1;  // Reset pagination
    console.log(`🔄 [PAGE-SIZE] Changed to: ${pageState.pageSize}`);
    renderTable(allFeedback);
  });
  console.log('✓ [INIT] Page size listener attached');
}

if (filterStatusSelect) {
  filterStatusSelect.addEventListener('change', (e) => {
    pageState.filterStatus = e.target.value;
    pageState.currentPage = 1;
    console.log(`🔄 [FILTER-STATUS] Changed to: ${pageState.filterStatus || 'all'}`);
    renderTable(allFeedback);
  });
  console.log('✓ [INIT] Status filter listener attached');
}

if (filterTierSelect) {
  filterTierSelect.addEventListener('change', (e) => {
    pageState.filterTier = e.target.value;
    pageState.currentPage = 1;  // Reset pagination
    console.log(`🔄 [FILTER-TIER] Changed to: ${pageState.filterTier || 'all'}`);
    renderTable(allFeedback);
  });
  console.log('✓ [INIT] Tier filter listener attached');
}

if (filterSourceSelect) {
  filterSourceSelect.addEventListener('change', (e) => {
    pageState.filterSource = e.target.value;
    pageState.currentPage = 1;  // Reset pagination
    console.log(`🔄 [FILTER-SOURCE] Changed to: ${pageState.filterSource || 'all'}`);
    renderTable(allFeedback);
  });
  console.log('✓ [INIT] Source filter listener attached');
}

const filterTagSelect = document.getElementById('filterTag');
if (filterTagSelect) {
  filterTagSelect.addEventListener('change', (e) => {
    pageState.filterTag = e.target.value;
    pageState.currentPage = 1;  // Reset pagination
    console.log(`🔄 [FILTER-TAG] Changed to: ${pageState.filterTag || 'all'}`);
    renderTable(allFeedback);
  });
  console.log('✓ [INIT] Tag filter listener attached');
}

if (searchInput) {
  searchInput.addEventListener('input', debounce(async (e) => {
    const q = e.target.value.trim();
    const hadSelection = pageState.selectedId !== null;
    pageState.selectedId = null;
    if (hadSelection) {
      renderTable(allFeedback);
      updateChartIndicators();
      updateSelectionIndicator();
    }
    console.log(`🔍 [SEARCH] Query: "${q}"`);
    if (!q) { 
      console.log('🔍 [SEARCH] Query empty, clearing results');
      document.getElementById('searchResults').innerHTML = ''; 
      return; 
    }
    try {
      console.log('🔍 [SEARCH] Fetching from /search...');
      const res = await fetch('/search?q=' + encodeURIComponent(q));
      const data = await res.json();
      console.log(`✅ [SEARCH] Got ${data?.length || 0} results`);
      renderSearch(data);
    } catch (err) {
      console.error('❌ [SEARCH] Error:', err);
    }
  }, 300));
  console.log('✓ [INIT] Search input listener attached');
} else {
  console.error('❌ [INIT] Search input NOT found!');
}

console.log('🚀 [INIT] Loading initial data...');
refreshAll();

// ===== SENTIMENT STAR HANDLERS =====
document.querySelectorAll('#sentimentStars span').forEach(star => {
  star.addEventListener('click', (e) => {
    const value = parseFloat(e.target.dataset.value);
    currentEditingSentiment = value;
    
    // Update UI
    document.querySelectorAll('#sentimentStars span').forEach(s => {
      s.classList.toggle('active', parseFloat(s.dataset.value) === value);
    });
    
    console.log(`⭐ [SENTIMENT] Selected ${value}`);
  });
});

// Close modals on background click
document.getElementById('sentimentModal').addEventListener('click', (e) => {
  if (e.target.id === 'sentimentModal') closeSentimentModal();
});
document.getElementById('feedbackModal').addEventListener('click', (e) => {
  if (e.target.id === 'feedbackModal') closeFeedbackModal();
});
