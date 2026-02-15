/**
 * Personal Expense Tracker - Dashboard Module
 * Handles dashboard rendering and statistics
 */

const Dashboard = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),

  /**
   * Initialize dashboard
   */
  async init() {
    await this.render();
    this.updateMonthDisplay();
  },

  /**
   * Render the dashboard
   */
  async render() {
    const totals = await Entries.calculateMonthlyTotals(this.currentYear, this.currentMonth);

    // Update summary cards
    this.updateSummaryCards(totals);

    // Update category chart based on current selection
    let breakdown = [];
    let total = 0;
    const type = this.currentChartType || 'expense';

    if (type === 'income') {
      breakdown = await Entries.getIncomeBreakdown(this.currentYear, this.currentMonth);
      total = totals.income;
    } else if (type === 'investment') {
      breakdown = await Entries.getInvestmentBreakdown(this.currentYear, this.currentMonth);
      total = totals.investment;
    } else {
      breakdown = await Entries.getCategoryBreakdown(this.currentYear, this.currentMonth);
      total = totals.expense;
    }

    this.updateCategoryChart(breakdown, total, type);

    // Update trend chart
    await this.updateTrendChart();

    // Setup summary card listeners
    this.setupSummaryListeners();
  },

  currentChartType: 'expense',

  /**
   * Setup listeners for summary cards
   */
  setupSummaryListeners() {
    const incomeCard = document.querySelector('.summary-card.income');
    const expenseCard = document.querySelector('.summary-card.expense');
    const investmentCard = document.querySelector('.summary-card.investment');

    if (incomeCard) {
      incomeCard.onclick = () => {
        this.currentChartType = 'income';
        this.render();
      };
      incomeCard.style.cursor = 'pointer';
    }
    if (expenseCard) {
      expenseCard.onclick = () => {
        this.currentChartType = 'expense';
        this.render();
      };
      expenseCard.style.cursor = 'pointer';
    }
    if (investmentCard) {
      investmentCard.onclick = () => {
        this.currentChartType = 'investment';
        this.render();
      };
      investmentCard.style.cursor = 'pointer';
    }
  },

  /**
   * Update summary cards
   */
  updateSummaryCards(totals) {
    const incomeEl = document.getElementById('totalIncome');
    const expenseEl = document.getElementById('totalExpense');
    const investmentEl = document.getElementById('totalInvestment');

    if (incomeEl) {
      incomeEl.textContent = formatCurrency(totals.income);
    }
    if (expenseEl) {
      expenseEl.textContent = formatCurrency(totals.expense);
    }
    if (investmentEl) {
      investmentEl.textContent = formatCurrency(totals.investment);
    }
  },

  /**
   * Update category bar chart
   */
  updateCategoryChart(breakdown, total, type = 'expense') {
    const container = document.getElementById('categoryChart');
    const title = document.getElementById('categoryChartTitle');

    if (title) {
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      title.textContent = `${typeLabel} by Category`;
    }

    if (!container) return;

    if (breakdown.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-illustration">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" style="opacity: 0.2; margin-bottom: 10px;">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
          </div>
          <div class="empty-state-text">No ${type}s this month</div>
        </div>
      `;
      return;
    }

    const maxAmount = breakdown[0]?.total || 1;

    container.innerHTML = breakdown.slice(0, 5).map(cat => {
      const percentage = total > 0 ? (cat.total / total * 100).toFixed(0) : 0;
      const barWidth = (cat.total / maxAmount * 100).toFixed(0);

      return `
        <div class="category-bar-item">
          <div class="category-dot" style="background-color: ${cat.color}"></div>
          <div class="category-bar-info">
            <div class="category-bar-header">
              <span class="category-bar-name">${cat.name}</span>
              <span class="category-bar-amount">${formatCurrency(cat.total)} (${percentage}%)</span>
            </div>
            <div class="category-bar-track">
              <div class="category-bar-fill" style="width: ${barWidth}%; background: ${cat.color}"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Update recent entries list
   */
  async updateRecentEntries(entries) {
    const container = document.getElementById('recentEntries');
    if (!container) return;

    // Sort by date descending and take first 5
    const recent = [...entries]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-illustration">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" style="opacity: 0.2; margin-bottom: 10px;">
              <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
            </svg>
          </div>
          <div class="empty-state-title">No entries yet</div>
          <div class="empty-state-text">Tap the + button to add your first entry</div>
        </div>
      `;
      return;
    }

    const categories = await Storage.get(Storage.KEYS.CATEGORIES);

    container.innerHTML = recent.map(entry => {
      const catList = entry.type === 'income' ? categories.income : categories.expense;
      const category = catList.find(c => c.id === entry.categoryId) || { color: '#8e8e93', name: 'Other' };
      const currencyInfo = CURRENCIES.find(c => c.code === entry.currency) || CURRENCIES[0];

      return `
        <div class="entry-item" data-id="${entry.id}" onclick="App.showEntryDetail('${entry.id}')">
          <div class="entry-icon" style="background-color: ${category.color}20; color: ${category.color}; border: 1.5px solid ${category.color}40;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${category.color};"></div>
          </div>
          <div class="entry-details">
            <div class="entry-title">${entry.costHead}</div>
            <div class="entry-meta">
              <span class="entry-date">${formatDate(entry.date)}</span>
              ${entry.entryCategory === 'fixed' ? '<span class="entry-category-tag fixed">Fixed</span>' : ''}
            </div>
          </div>
          <div class="entry-amount-container">
            <div class="entry-amount ${entry.type}">${entry.type === 'expense' ? '-' : '+'}${formatCurrency(entry.amountINR || entry.amount)}</div>
            ${entry.currency !== 'INR' ? `<div class="entry-currency">${currencyInfo.symbol}${entry.amount}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Update trend chart (simple bar representation)
   */
  async updateTrendChart() {
    const container = document.getElementById('trendChart');
    if (!container) return;

    const trend = await Entries.getMonthlyTrend();
    const maxValue = Math.max(...trend.flatMap(t => [t.income, t.expense]), 1);

    container.innerHTML = `
      <div class="trend-chart">
        <div class="trend-bars">
          ${trend.map(t => `
            <div class="trend-month">
              <div class="trend-bar-group">
                <div class="trend-bar income" style="height: ${(t.income / maxValue * 100).toFixed(0)}%" title="Income: ${formatCurrency(t.income)}"></div>
                <div class="trend-bar expense" style="height: ${(t.expense / maxValue * 100).toFixed(0)}%" title="Expense: ${formatCurrency(t.expense)}"></div>
              </div>
              <span class="trend-label">${t.month}</span>
            </div>
          `).join('')}
        </div>
        <div class="trend-legend">
          <span class="legend-item"><span class="legend-dot income"></span> Income</span>
          <span class="legend-item"><span class="legend-dot expense"></span> Expense</span>
        </div>
      </div>
    `;
  },

  /**
   * Update month display
   */
  updateMonthDisplay() {
    const monthDisplay = document.getElementById('monthDisplay');
    if (monthDisplay) {
      monthDisplay.textContent = `${getMonthName(this.currentMonth)} ${this.currentYear}`;
    }
  },

  /**
   * Navigate to previous month
   */
  async prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.updateMonthDisplay();
    await this.render();
  },

  /**
   * Navigate to next month
   */
  async nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.updateMonthDisplay();
    await this.render();
  },

  /**
   * Get quick stats
   */
  async getQuickStats() {
    const entries = await Entries.getByMonth(this.currentYear, this.currentMonth);
    const totals = await Entries.calculateMonthlyTotals(this.currentYear, this.currentMonth);

    // Find highest expense
    const expenses = entries.filter(e => e.type === 'expense');
    const highestExpense = expenses.reduce((max, e) =>
      (e.amountINR || e.amount) > (max?.amountINR || max?.amount || 0) ? e : max, null);

    // Calculate savings rate
    const savingsRate = totals.income > 0
      ? ((totals.savings / totals.income) * 100).toFixed(0)
      : 0;

    return {
      highestExpense,
      savingsRate,
      transactionCount: entries.length
    };
  }
};
