/**
 * Personal Expense Tracker - Entries Module
 * Handles CRUD operations for income/expense entries
 */

const Entries = {
    /**
     * Get all entries
     */
    async getAll() {
        return (await Storage.get(Storage.KEYS.ENTRIES)) || [];
    },

    /**
     * Get entries for a specific month
     */
    async getByMonth(year, month) {
        const entries = await this.getAll();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        return entries.filter(entry => entry.date.startsWith(monthKey));
    },

    /**
     * Get entry by ID
     */
    async getById(id) {
        const entries = await this.getAll();
        return entries.find(entry => entry.id === id);
    },

    /**
     * Add new entry
     */
    async add(entryData) {
        const entries = await this.getAll();

        const newEntry = {
            id: generateUUID(),
            date: entryData.date,
            type: entryData.type, // 'income' or 'expense'
            entryCategory: entryData.entryCategory, // 'fixed' or 'variable'
            categoryId: entryData.categoryId,
            costHead: entryData.costHead,
            amount: parseFloat(entryData.amount),
            currency: entryData.currency,
            amountINR: entryData.amountINR || entryData.amount, // Will be calculated if different currency
            paymentMethod: entryData.paymentMethod || 'other',
            notes: entryData.notes || '',
            tags: entryData.tags || [],
            createdAt: Date.now()
        };

        // If it's a fixed entry, also add to templates
        if (entryData.entryCategory === 'fixed') {
            await this.addFixedTemplate(newEntry);
        }

        entries.push(newEntry);
        await Storage.set(Storage.KEYS.ENTRIES, entries);

        return newEntry;
    },

    /**
     * Update existing entry
     */
    async update(id, updates) {
        const entries = await this.getAll();
        const index = entries.findIndex(entry => entry.id === id);

        if (index === -1) return null;

        entries[index] = {
            ...entries[index],
            ...updates,
            updatedAt: Date.now()
        };

        await Storage.set(Storage.KEYS.ENTRIES, entries);
        return entries[index];
    },

    /**
     * Delete entry by ID
     */
    async delete(id) {
        const entries = await this.getAll();
        const filtered = entries.filter(entry => entry.id !== id);
        await Storage.set(Storage.KEYS.ENTRIES, filtered);
        return true;
    },

    /**
     * Add a fixed template
     */
    async addFixedTemplate(entry) {
        const templates = (await Storage.get(Storage.KEYS.FIXED_TEMPLATES)) || [];

        const template = {
            id: generateUUID(),
            type: entry.type,
            entryCategory: 'fixed',
            categoryId: entry.categoryId,
            costHead: entry.costHead,
            amount: entry.amount,
            currency: entry.currency,
            amountINR: entry.amountINR,
            paymentMethod: entry.paymentMethod,
            notes: entry.notes,
            tags: entry.tags,
            createdAt: Date.now()
        };

        templates.push(template);
        await Storage.set(Storage.KEYS.FIXED_TEMPLATES, templates);

        return template;
    },

    /**
     * Get all fixed templates
     */
    async getFixedTemplates() {
        return (await Storage.get(Storage.KEYS.FIXED_TEMPLATES)) || [];
    },

    /**
     * Delete fixed template
     */
    async deleteFixedTemplate(id) {
        const templates = (await Storage.get(Storage.KEYS.FIXED_TEMPLATES)) || [];
        const filtered = templates.filter(t => t.id !== id);
        await Storage.set(Storage.KEYS.FIXED_TEMPLATES, filtered);
        return true;
    },

    /**
     * Calculate totals for a month
     */
    async calculateMonthlyTotals(year, month) {
        const entries = await this.getByMonth(year, month);

        let totalIncome = 0;
        let totalExpense = 0;
        let totalInvestment = 0;

        entries.forEach(entry => {
            const amount = entry.amountINR || entry.amount;
            if (entry.type === 'income') {
                totalIncome += amount;
            } else if (entry.type === 'expense') {
                totalExpense += amount;
            } else if (entry.type === 'investment') {
                totalInvestment += amount;
            }
        });

        return {
            income: totalIncome,
            expense: totalExpense,
            investment: totalInvestment,
            savings: totalIncome - totalExpense - totalInvestment
        };
    },

    /**
     * Get category breakdown for expenses
     */
    async getCategoryBreakdown(year, month) {
        const entries = await this.getByMonth(year, month);
        const categories = await Storage.get(Storage.KEYS.CATEGORIES);
        const breakdown = {};

        entries.filter(e => e.type === 'expense').forEach(entry => {
            const catId = entry.categoryId;
            if (!breakdown[catId]) {
                const catInfo = categories.expense.find(c => c.id === catId) || { name: 'Other', color: '#8e8e93' };
                breakdown[catId] = {
                    ...catInfo,
                    total: 0,
                    count: 0
                };
            }
            breakdown[catId].total += entry.amountINR || entry.amount;
            breakdown[catId].count += 1;
        });

        // Sort by total (descending)
        return Object.values(breakdown).sort((a, b) => b.total - a.total);
    },

    /**
     * Get income source breakdown
     */
    async getIncomeBreakdown(year, month) {
        const entries = await this.getByMonth(year, month);
        const categories = await Storage.get(Storage.KEYS.CATEGORIES);
        const breakdown = {};

        entries.filter(e => e.type === 'income').forEach(entry => {
            const catId = entry.categoryId;
            if (!breakdown[catId]) {
                const catInfo = categories.income.find(c => c.id === catId) || { name: 'Other', color: '#8e8e93' };
                breakdown[catId] = {
                    ...catInfo,
                    total: 0,
                    count: 0
                };
            }
            breakdown[catId].total += entry.amountINR || entry.amount;
            breakdown[catId].count += 1;
        });

        return Object.values(breakdown).sort((a, b) => b.total - a.total);
    },

    /**
     * Get investment breakdown
     */
    async getInvestmentBreakdown(year, month) {
        const entries = await this.getByMonth(year, month);
        const categories = await Storage.get(Storage.KEYS.CATEGORIES);
        const breakdown = {};

        entries.filter(e => e.type === 'investment').forEach(entry => {
            const catId = entry.categoryId;
            if (!breakdown[catId]) {
                const catInfo = categories.investment.find(c => c.id === catId) || { name: 'Other', color: '#8e8e93' };
                breakdown[catId] = {
                    ...catInfo,
                    total: 0,
                    count: 0
                };
            }
            breakdown[catId].total += entry.amountINR || entry.amount;
            breakdown[catId].count += 1;
        });

        return Object.values(breakdown).sort((a, b) => b.total - a.total);
    },

    /**
     * Get currency breakdown
     */
    async getCurrencyBreakdown(year, month) {
        const entries = await this.getByMonth(year, month);
        const breakdown = {};

        entries.forEach(entry => {
            const currency = entry.currency;
            if (!breakdown[currency]) {
                const currInfo = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
                breakdown[currency] = {
                    ...currInfo,
                    income: 0,
                    expense: 0,
                    total: 0
                };
            }

            if (entry.type === 'income') {
                breakdown[currency].income += entry.amount;
            } else {
                breakdown[currency].expense += entry.amount;
            }
            breakdown[currency].total = breakdown[currency].income - breakdown[currency].expense;
        });

        return Object.values(breakdown);
    },

    /**
     * Get monthly trend data (last 6 months)
     */
    async getMonthlyTrend() {
        const trend = [];
        const today = new Date();

        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const totals = await this.calculateMonthlyTotals(date.getFullYear(), date.getMonth());

            trend.push({
                month: getMonthName(date.getMonth()).substring(0, 3),
                year: date.getFullYear(),
                ...totals
            });
        }

        return trend;
    },

    /**
     * Search entries
     */
    async search(query) {
        const entries = await this.getAll();
        const lowerQuery = query.toLowerCase();

        return entries.filter(entry =>
            entry.costHead.toLowerCase().includes(lowerQuery) ||
            (entry.notes && entry.notes.toLowerCase().includes(lowerQuery)) ||
            (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
        );
    },

    /**
     * Get financial summary for AI context
     */
    async getFinancialSummary() {
        const today = new Date();
        const currentMonth = await this.calculateMonthlyTotals(today.getFullYear(), today.getMonth());
        const entries = await this.getByMonth(today.getFullYear(), today.getMonth());
        const categoryBreakdown = await this.getCategoryBreakdown(today.getFullYear(), today.getMonth());
        const incomeBreakdown = await this.getIncomeBreakdown(today.getFullYear(), today.getMonth());
        const investmentBreakdown = await this.getInvestmentBreakdown(today.getFullYear(), today.getMonth());
        const trend = await this.getMonthlyTrend();
        const fixedTemplates = await this.getFixedTemplates();

        return {
            currentMonth: {
                name: getMonthName(today.getMonth()),
                year: today.getFullYear(),
                ...currentMonth
            },
            entriesCount: entries.length,
            expenseCategories: categoryBreakdown,
            incomeSources: incomeBreakdown,
            investments: investmentBreakdown,
            monthlyTrend: trend,
            fixedEntries: fixedTemplates,
            allCurrentEntries: entries
        };
    }
};
