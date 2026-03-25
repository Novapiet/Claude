// ─── Data & State ───
const CATEGORIES = {
  expense: [
    { name: 'Food & Dining', icon: '🍔', color: '#ff6b6b' },
    { name: 'Transport', icon: '🚗', color: '#ffa94d' },
    { name: 'Shopping', icon: '🛍️', color: '#cc5de8' },
    { name: 'Housing', icon: '🏠', color: '#339af0' },
    { name: 'Utilities', icon: '💡', color: '#20c997' },
    { name: 'Healthcare', icon: '🏥', color: '#ff8787' },
    { name: 'Entertainment', icon: '🎬', color: '#845ef7' },
    { name: 'Education', icon: '📚', color: '#5c7cfa' },
    { name: 'Subscriptions', icon: '🔄', color: '#f06595' },
    { name: 'Other', icon: '📦', color: '#868e96' },
  ],
  income: [
    { name: 'Salary', icon: '💰', color: '#00c897' },
    { name: 'Freelance', icon: '💻', color: '#38d9a9' },
    { name: 'Investment', icon: '📈', color: '#69db7c' },
    { name: 'Gift', icon: '🎁', color: '#ffd43b' },
    { name: 'Other Income', icon: '💵', color: '#a9e34b' },
  ],
};

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: '$', AUD: '$' };

let state = {
  transactions: [],
  budgets: {},
  currency: 'USD',
};

function load() {
  try {
    const saved = localStorage.getItem('budgetflow');
    if (saved) state = { ...state, ...JSON.parse(saved) };
  } catch (e) { /* ignore */ }
}

function save() {
  localStorage.setItem('budgetflow', JSON.stringify(state));
}

function sym() {
  return CURRENCY_SYMBOLS[state.currency] || '$';
}

function fmt(n) {
  return sym() + Math.abs(n).toFixed(state.currency === 'JPY' ? 0 : 2);
}

// ─── DOM Refs ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const balanceEl = $('#balanceAmount');
const incomeEl = $('#totalIncome');
const expenseEl = $('#totalExpenses');
const listEl = $('#transactionsList');
const budgetsListEl = $('#budgetsList');
const addModal = $('#addModal');
const budgetModal = $('#budgetModal');
const settingsModal = $('#settingsModal');
const form = $('#transactionForm');
const budgetForm = $('#budgetForm');
const categorySelect = $('#category');
const budgetCategorySelect = $('#budgetCategory');
const filterCategory = $('#filterCategory');
const filterMonth = $('#filterMonth');

// ─── Init ───
load();
renderAll();
registerSW();

// ─── Tabs ───
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(tc => tc.classList.remove('active'));
    tab.classList.add('active');
    $(`#tab-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'analytics') renderAnalytics();
  });
});

// ─── Type Toggle ───
$$('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    populateCategories(btn.dataset.type);
  });
});

// ─── Modals ───
$('#addBtn').addEventListener('click', () => {
  form.reset();
  $('#editId').value = '';
  $('#modalTitle').textContent = 'Add Transaction';
  $$('.type-btn').forEach(b => b.classList.remove('active'));
  $('.type-btn[data-type="expense"]').classList.add('active');
  populateCategories('expense');
  $('#date').value = new Date().toISOString().split('T')[0];
  openModal(addModal);
});

$('#closeModal').addEventListener('click', () => closeModal(addModal));
$('#closeBudgetModal').addEventListener('click', () => closeModal(budgetModal));
$('#closeSettingsModal').addEventListener('click', () => closeModal(settingsModal));
$('#settingsBtn').addEventListener('click', () => {
  $('#currencySelect').value = state.currency;
  openModal(settingsModal);
});

[addModal, budgetModal, settingsModal].forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
});

function openModal(m) { m.classList.add('show'); }
function closeModal(m) { m.classList.remove('show'); }

// ─── Populate Categories ───
function populateCategories(type) {
  const cats = CATEGORIES[type];
  categorySelect.innerHTML = cats.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
}

function populateBudgetCategories() {
  budgetCategorySelect.innerHTML = CATEGORIES.expense
    .filter(c => !state.budgets[c.name])
    .map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
}

function populateFilters() {
  // Category filter
  const allCats = [...CATEGORIES.expense, ...CATEGORIES.income];
  filterCategory.innerHTML = '<option value="all">All Categories</option>' +
    allCats.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');

  // Month filter
  const months = new Set();
  state.transactions.forEach(t => {
    const d = new Date(t.date);
    months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  });
  const sorted = [...months].sort().reverse();
  filterMonth.innerHTML = '<option value="all">All Time</option>' +
    sorted.map(m => {
      const [y, mo] = m.split('-');
      const label = new Date(y, mo-1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return `<option value="${m}">${label}</option>`;
    }).join('');
}

// ─── Form Submit ───
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const type = $('.type-btn.active').dataset.type;
  const editId = $('#editId').value;

  const tx = {
    id: editId || Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type,
    amount: parseFloat($('#amount').value),
    description: $('#description').value.trim(),
    category: categorySelect.value,
    date: $('#date').value,
  };

  if (editId) {
    const idx = state.transactions.findIndex(t => t.id === editId);
    if (idx !== -1) state.transactions[idx] = tx;
  } else {
    state.transactions.push(tx);
  }

  save();
  closeModal(addModal);
  renderAll();
});

// ─── Budget Form ───
budgetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const cat = budgetCategorySelect.value;
  const amount = parseFloat($('#budgetAmount').value);
  if (cat && amount > 0) {
    state.budgets[cat] = amount;
    save();
    closeModal(budgetModal);
    renderAll();
  }
});

// ─── Filters ───
filterCategory.addEventListener('change', renderTransactions);
filterMonth.addEventListener('change', renderTransactions);

// ─── Settings ───
$('#currencySelect').addEventListener('change', (e) => {
  state.currency = e.target.value;
  save();
  renderAll();
});

$('#exportDataBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'budgetflow-export.json'; a.click();
  URL.revokeObjectURL(url);
});

$('#importDataBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.transactions) {
        state = { ...state, ...data };
        save();
        renderAll();
        closeModal(settingsModal);
      }
    } catch (err) { alert('Invalid file format'); }
  };
  reader.readAsText(file);
});

$('#clearDataBtn').addEventListener('click', () => {
  if (confirm('Delete all transactions and budgets? This cannot be undone.')) {
    state.transactions = [];
    state.budgets = {};
    save();
    renderAll();
    closeModal(settingsModal);
  }
});

// ─── Rendering ───
function renderAll() {
  renderBalance();
  populateFilters();
  renderTransactions();
  renderBudgets();
}

function renderBalance() {
  const income = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  balanceEl.textContent = fmt(income - expenses);
  balanceEl.style.color = income - expenses >= 0 ? 'var(--text)' : 'var(--expense)';
  incomeEl.textContent = fmt(income);
  expenseEl.textContent = fmt(expenses);
}

function renderTransactions() {
  const catFilter = filterCategory.value;
  const monthFilter = filterMonth.value;

  let txs = [...state.transactions];

  if (catFilter !== 'all') txs = txs.filter(t => t.category === catFilter);
  if (monthFilter !== 'all') {
    txs = txs.filter(t => {
      const d = new Date(t.date);
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      return ym === monthFilter;
    });
  }

  txs.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (txs.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No transactions yet. Tap + to add one.</p>';
    return;
  }

  const allCats = [...CATEGORIES.expense, ...CATEGORIES.income];
  listEl.innerHTML = txs.map(t => {
    const cat = allCats.find(c => c.name === t.category) || { icon: '📦', color: '#868e96' };
    return `
      <div class="transaction-item" data-id="${t.id}">
        <div class="transaction-left">
          <div class="transaction-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div>
          <div class="transaction-info">
            <div class="transaction-desc">${escHtml(t.description)}</div>
            <div class="transaction-cat">${t.category} &middot; ${formatDate(t.date)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center">
          <span class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</span>
          <div class="transaction-actions">
            <button class="action-btn edit" onclick="editTransaction('${t.id}')" title="Edit">&#9998;</button>
            <button class="action-btn delete" onclick="deleteTransaction('${t.id}')" title="Delete">&times;</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderBudgets() {
  const cats = Object.keys(state.budgets);
  if (cats.length === 0) {
    budgetsListEl.innerHTML = '<p class="empty-state">No budgets set. Tap + to create one.</p>';
    return;
  }

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  budgetsListEl.innerHTML = cats.map(cat => {
    const limit = state.budgets[cat];
    const spent = state.transactions
      .filter(t => t.type === 'expense' && t.category === cat && t.date.startsWith(thisMonth))
      .reduce((s, t) => s + t.amount, 0);
    const pct = Math.min((spent / limit) * 100, 100);
    const over = spent > limit;
    const catInfo = CATEGORIES.expense.find(c => c.name === cat) || { icon: '📦', color: '#868e96' };
    const barColor = over ? 'var(--expense)' : pct > 75 ? '#ffa94d' : 'var(--income)';

    return `
      <div class="budget-item">
        <div class="budget-header">
          <h4>${catInfo.icon} ${cat}</h4>
          <span>${fmt(spent)} / ${fmt(limit)}</span>
        </div>
        <div class="budget-bar">
          <div class="budget-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="budget-footer">
          <span class="${over ? 'over-budget' : ''}">${over ? 'Over by ' + fmt(spent - limit) : fmt(limit - spent) + ' remaining'}</span>
          <button class="budget-remove" onclick="removeBudget('${cat}')">Remove</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Analytics ───
let expenseChart = null;
let trendChart = null;

$$('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAnalytics();
  });
});

function getFilteredByPeriod() {
  const period = $('.period-btn.active').dataset.period;
  const now = new Date();
  let txs = [...state.transactions];

  if (period === 'month') {
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    txs = txs.filter(t => t.date.startsWith(ym));
  } else if (period === 'year') {
    const y = `${now.getFullYear()}`;
    txs = txs.filter(t => t.date.startsWith(y));
  }
  return txs;
}

function renderAnalytics() {
  const txs = getFilteredByPeriod();
  const expenses = txs.filter(t => t.type === 'expense');
  const income = txs.filter(t => t.type === 'income');

  // Expense by category (pie/doughnut)
  const catTotals = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });

  const labels = Object.keys(catTotals);
  const data = Object.values(catTotals);
  const colors = labels.map(l => {
    const c = CATEGORIES.expense.find(cat => cat.name === l);
    return c ? c.color : '#868e96';
  });

  const ctx1 = $('#expenseChart').getContext('2d');
  if (expenseChart) expenseChart.destroy();

  if (labels.length > 0) {
    expenseChart = new Chart(ctx1, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#e8e8f0', padding: 12, font: { size: 12 } } },
          title: { display: true, text: 'Expenses by Category', color: '#e8e8f0', font: { size: 14 } }
        }
      }
    });
  } else {
    ctx1.clearRect(0, 0, ctx1.canvas.width, ctx1.canvas.height);
    ctx1.fillStyle = '#8888a0';
    ctx1.textAlign = 'center';
    ctx1.fillText('No expense data for this period', ctx1.canvas.width/2, 125);
  }

  // Trend chart (bar)
  const monthlyData = {};
  txs.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    monthlyData[key][t.type] += t.amount;
  });

  const months = Object.keys(monthlyData).sort();
  const monthLabels = months.map(m => {
    const [y, mo] = m.split('-');
    return new Date(y, mo-1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });

  const ctx2 = $('#trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();

  if (months.length > 0) {
    trendChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          { label: 'Income', data: months.map(m => monthlyData[m].income), backgroundColor: '#00c89788', borderRadius: 4 },
          { label: 'Expenses', data: months.map(m => monthlyData[m].expense), backgroundColor: '#ff6b6b88', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#8888a0' }, grid: { display: false } },
          y: { ticks: { color: '#8888a0' }, grid: { color: '#2a2a4422' } },
        },
        plugins: {
          legend: { labels: { color: '#e8e8f0' } },
          title: { display: true, text: 'Income vs Expenses', color: '#e8e8f0', font: { size: 14 } }
        }
      }
    });
  }

  // Summary cards
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const savings = totalIncome - totalExpense;
  const avgExpense = expenses.length > 0 ? totalExpense / expenses.length : 0;
  const topCat = labels.length > 0 ? labels[data.indexOf(Math.max(...data))] : 'N/A';

  $('#analyticsSummary').innerHTML = `
    <div class="summary-card">
      <div class="label">Total Income</div>
      <div class="value" style="color:var(--income)">${fmt(totalIncome)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Expenses</div>
      <div class="value" style="color:var(--expense)">${fmt(totalExpense)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Net Savings</div>
      <div class="value" style="color:${savings >= 0 ? 'var(--income)' : 'var(--expense)'}">${savings >= 0 ? '+' : '-'}${fmt(savings)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Top Category</div>
      <div class="value" style="font-size:14px">${topCat}</div>
    </div>
  `;
}

// ─── Actions ───
window.editTransaction = function(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  $('#editId').value = tx.id;
  $('#modalTitle').textContent = 'Edit Transaction';
  $$('.type-btn').forEach(b => b.classList.remove('active'));
  $(`.type-btn[data-type="${tx.type}"]`).classList.add('active');
  populateCategories(tx.type);
  $('#amount').value = tx.amount;
  $('#description').value = tx.description;
  categorySelect.value = tx.category;
  $('#date').value = tx.date;
  openModal(addModal);
};

window.deleteTransaction = function(id) {
  if (confirm('Delete this transaction?')) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    save();
    renderAll();
  }
};

window.removeBudget = function(cat) {
  delete state.budgets[cat];
  save();
  renderAll();
};

// Override FAB for budget tab
$('#addBtn').addEventListener('click', () => {
  const activeTab = $('.tab.active').dataset.tab;
  if (activeTab === 'budgets') {
    populateBudgetCategories();
    if (budgetCategorySelect.options.length === 0) {
      alert('All categories have budgets set.');
      return;
    }
    budgetForm.reset();
    openModal(budgetModal);
  }
});

// ─── Helpers ───
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ─── Service Worker ───
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ─── Load Chart.js from CDN ───
(function loadChartJS() {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
  script.onload = () => {
    // Charts ready when analytics tab is opened
  };
  document.head.appendChild(script);
})();
