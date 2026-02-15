/**
 * Personal Expense Tracker - Storage Module
 * Handles all data persistence via server-side SQLite
 */

const Storage = {
    KEYS: {
        ENTRIES: 'expense_tracker_entries',
        FIXED_TEMPLATES: 'expense_tracker_fixed_templates',
        CATEGORIES: 'expense_tracker_categories',
        SETTINGS: 'expense_tracker_settings',
        CHAT_HISTORY: 'expense_tracker_chat_history',
        EXCHANGE_RATES: 'expense_tracker_exchange_rates',
        PROFILE: 'ngul_profile',
        GOALS: 'ngul_goals'
    },

    /**
     * Get data from SQLite via Backend (session-based auth)
     */
    async get(key) {
        try {
            if (!Auth.isAuthenticated()) return null;

            const response = await fetch(`/api/storage/${key}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                return data;
            }
            return null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    /**
     * Save data to SQLite via Backend (session-based auth)
     */
    async set(key, value) {
        try {
            if (!Auth.isAuthenticated()) return false;

            const response = await fetch('/api/storage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key, value })
            });
            return response.ok;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    /**
     * Remove data from SQLite via Backend (session-based auth)
     */
    async remove(key) {
        try {
            if (!Auth.isAuthenticated()) return false;

            const response = await fetch(`/api/storage/${key}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            return response.ok;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    },

    /**
     * Initialize default data structures
     */
    async init() {
        if (!Auth.isAuthenticated()) return;

        // Initialize entries array if not exists
        if (!(await this.get(this.KEYS.ENTRIES))) {
            await this.set(this.KEYS.ENTRIES, []);
        }

        // Initialize fixed templates if not exists
        if (!(await this.get(this.KEYS.FIXED_TEMPLATES))) {
            await this.set(this.KEYS.FIXED_TEMPLATES, []);
        }

        // Initialize default categories
        let currentCategories = await this.get(this.KEYS.CATEGORIES);
        if (!currentCategories || Object.keys(currentCategories).length === 0 || !currentCategories.expense) {
            await this.set(this.KEYS.CATEGORIES, DEFAULT_CATEGORIES);
        } else if (!currentCategories.investment) {
            // Migration: add investment categories if missing
            currentCategories.investment = DEFAULT_CATEGORIES.investment;
            await this.set(this.KEYS.CATEGORIES, currentCategories);
        }

        // Initialize settings
        if (!(await this.get(this.KEYS.SETTINGS))) {
            await this.set(this.KEYS.SETTINGS, {
                baseCurrency: 'INR',
                theme: 'dark'
            });
        }

        // Initialize chat history
        if (!(await this.get(this.KEYS.CHAT_HISTORY))) {
            await this.set(this.KEYS.CHAT_HISTORY, []);
        }

        // Check and populate fixed entries for current month
        await this.populateFixedEntriesForMonth();
    },

    /**
     * Auto-populate fixed entries for current month if not already done
     */
    async populateFixedEntriesForMonth() {
        const templates = (await this.get(this.KEYS.FIXED_TEMPLATES)) || [];
        const entries = (await this.get(this.KEYS.ENTRIES)) || [];

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

        let modified = false;
        templates.forEach(template => {
            // Check if this template has been applied for current month
            const alreadyExists = entries.some(entry =>
                entry.templateId === template.id &&
                entry.date.startsWith(monthKey)
            );

            if (!alreadyExists) {
                // Create new entry from template for this month
                const newEntry = {
                    ...template,
                    id: generateUUID(),
                    templateId: template.id,
                    date: `${monthKey}-01`,
                    createdAt: Date.now()
                };
                entries.push(newEntry);
                modified = true;
            }
        });

        if (modified) {
            await this.set(this.KEYS.ENTRIES, entries);
        }
    }
};

/**
 * Default expense and income categories
 */
const DEFAULT_CATEGORIES = {
    expense: [
        { id: 'housing', name: 'Housing', icon: 'home', color: '#ff9f0a' },
        { id: 'food', name: 'Food & Dining', icon: 'restaurant', color: '#ff6482' },
        { id: 'transport', name: 'Transportation', icon: 'directions_car', color: '#0a84ff' },
        { id: 'utilities', name: 'Utilities', icon: 'lightbulb', color: '#64d2ff' },
        { id: 'shopping', name: 'Shopping', icon: 'shopping_cart', color: '#bf5af2' },
        { id: 'entertainment', name: 'Entertainment', icon: 'movie', color: '#ff375f' },
        { id: 'healthcare', name: 'Healthcare', icon: 'medical_services', color: '#30d158' },
        { id: 'education', name: 'Education', icon: 'school', color: '#5e5ce6' },
        { id: 'subscriptions', name: 'Subscriptions', icon: 'credit_card', color: '#ac8e68' },
        { id: 'gifts', name: 'Gifts & Donations', icon: 'card_giftcard', color: '#ff9f0a' },
        { id: 'travel', name: 'Travel', icon: 'flight', color: '#00c7be' },
        { id: 'other', name: 'Other', icon: 'category', color: '#8e8e93' }
    ],
    income: [
        { id: 'salary', name: 'Salary', icon: 'payments', color: '#30d158' },
        { id: 'freelance', name: 'Freelance', icon: 'computer', color: '#bf5af2' },
        { id: 'investment_return', name: 'Investment Return', icon: 'trending_up', color: '#0a84ff' },
        { id: 'rental', name: 'Rental Income', icon: 'home', color: '#ff9f0a' },
        { id: 'gift', name: 'Gift', icon: 'redeem', color: '#ff6482' },
        { id: 'other', name: 'Other', icon: 'account_balance_wallet', color: '#8e8e93' }
    ],
    investment: [
        { id: 'mutual_funds', name: 'Mutual Funds', icon: 'analytics', color: '#5e5ce6' },
        { id: 'stocks', name: 'Stocks', icon: 'show_chart', color: '#30d158' },
        { id: 'fixed_deposit', name: 'Fixed Deposit', icon: 'lock', color: '#ff9f0a' },
        { id: 'gold', name: 'Gold', icon: 'stars', color: '#ffd60a' },
        { id: 'real_estate', name: 'Real Estate', icon: 'apartment', color: '#0a84ff' },
        { id: 'other', name: 'Other', icon: 'account_balance', color: '#8e8e93' }
    ]
};

/**
 * Supported currencies
 */
const CURRENCIES = [
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' }
];

/**
 * Payment methods
 */
const PAYMENT_METHODS = [
    { id: 'cash', name: 'Cash', icon: 'cash' },
    { id: 'upi', name: 'UPI', icon: 'smartphone' },
    { id: 'credit_card', name: 'Credit Card', icon: 'credit_card' },
    { id: 'debit_card', name: 'Debit Card', icon: 'credit_card' },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: 'account_balance' },
    { id: 'other', name: 'Other', icon: 'more_horiz' }
];

/**
 * Generate UUID for entries
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Format currency amount
 */
function formatCurrency(amount, currency = 'INR') {
    const currencyInfo = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    const formattedAmount = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
    return `${currencyInfo.symbol}${formattedAmount}`;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Get month name
 */
function getMonthName(monthIndex) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
}
