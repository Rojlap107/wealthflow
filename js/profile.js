/**
 * Coconut - Profile & Goals Module
 * Manages user profile data and financial goals
 */

/**
 * Investment ROI (Return on Investment) data
 * Based on current Indian market averages (2024-2025)
 */
const INVESTMENT_ROI = {
    savings: {
        name: 'Savings Account',
        roi: 0.035,  // 3.5% — average across major Indian banks (SBI, HDFC, ICICI)
        displayROI: '3.5%',
        description: 'Low risk, liquid, government insured'
    },
    fd: {
        name: 'Fixed Deposit',
        roi: 0.065,  // 6.5% — average FD rate for 1-5 year tenure at major banks
        displayROI: '6.5%',
        description: 'Low risk, fixed returns, government insured'
    },
    mutual_funds: {
        name: 'Mutual Funds',
        roi: 0.12,   // 12% — long-term average for equity mutual funds in India
        displayROI: '12%',
        description: 'Moderate risk, professionally managed'
    },
    stocks: {
        name: 'Stocks',
        roi: 0.14,   // 14% — Nifty 50 long-term CAGR (20-year historical average)
        displayROI: '14%',
        description: 'High risk, high potential returns'
    },
    mixed: {
        name: 'Mixed Portfolio',
        roi: 0.09,   // 9% — balanced 60/40 equity-debt allocation average
        displayROI: '9%',
        description: 'Balanced risk, diversified allocation'
    }
};

const Profile = {
    STORAGE_KEYS: {
        PROFILE: Storage.KEYS.PROFILE,
        GOALS: Storage.KEYS.GOALS
    },

    /**
     * Initialize profile
     */
    async init() {
        await this.ensureProfile();
    },

    /**
     * Create default profile if none exists
     */
    async ensureProfile() {
        if (!(await this.get())) {
            await this.save({
                name: '',
                age: null,
                email: '',
                profilePicture: '',
                createdAt: Date.now(),
                isSetup: false
            });
        }
    },

    /**
     * Get profile data
     */
    async get() {
        return await Storage.get(this.STORAGE_KEYS.PROFILE);
    },

    /**
     * Save profile data
     */
    async save(profileData) {
        return await Storage.set(this.STORAGE_KEYS.PROFILE, profileData);
    },

    /**
     * Update profile fields
     */
    async update(updates) {
        const current = (await this.get()) || {};
        const updated = { ...current, ...updates, updatedAt: Date.now() };
        return await this.save(updated);
    },

    /**
     * Check if profile is complete
     */
    async isComplete() {
        const profile = await this.get();
        return profile && profile.name && profile.dob && profile.isSetup;
    },

    /**
     * Helper to calculate age from DOB
     */
    calculateAge(dobString) {
        if (!dobString) return 0;
        const dob = new Date(dobString);
        if (isNaN(dob.getTime())) return 0;

        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    },

    // ============================================
    // SAVINGS GOALS
    // ============================================

    /**
     * Get all goals
     */
    async getGoals() {
        return (await Storage.get(this.STORAGE_KEYS.GOALS)) || [];
    },

    /**
     * Add a new savings goal
     */
    async addGoal(goalData) {
        const goals = await this.getGoals();
        const profile = await this.get();
        const currentAge = this.calculateAge(profile?.dob);

        const newGoal = {
            id: 'goal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            targetAmount: parseFloat(goalData.targetAmount),
            targetAge: parseInt(goalData.targetAge),
            investmentType: goalData.investmentType || 'savings',
            monthlySavingsTarget: goalData.monthlySavingsTarget || 0,
            name: goalData.name || 'Savings Goal',
            notes: goalData.notes || '',
            createdAt: Date.now(),
            isActive: true
        };

        // Calculate required monthly savings using realistic ROI
        if (profile && currentAge > 0 && newGoal.targetAge > currentAge) {
            const yearsLeft = newGoal.targetAge - currentAge;
            const monthsLeft = yearsLeft * 12;

            // Get ROI for the investment type
            const investmentData = INVESTMENT_ROI[newGoal.investmentType] || INVESTMENT_ROI.savings;
            const annualROI = investmentData.roi;
            const monthlyROI = annualROI / 12;

            // Calculate required monthly savings using Future Value of Annuity formula
            if (monthlyROI > 0) {
                const factor = (Math.pow(1 + monthlyROI, monthsLeft) - 1) / monthlyROI;
                newGoal.requiredMonthlySavings = Math.ceil(newGoal.targetAmount / factor);
            } else {
                newGoal.requiredMonthlySavings = Math.ceil(newGoal.targetAmount / monthsLeft);
            }

            // Store the ROI used for this goal
            newGoal.expectedROI = investmentData.displayROI;
            newGoal.investmentName = investmentData.name;
        }

        goals.push(newGoal);
        await Storage.set(this.STORAGE_KEYS.GOALS, goals);
        return newGoal;
    },

    /**
     * Update a goal
     */
    async updateGoal(goalId, updates) {
        const goals = await this.getGoals();
        const index = goals.findIndex(g => g.id === goalId);

        if (index !== -1) {
            goals[index] = { ...goals[index], ...updates, updatedAt: Date.now() };

            // Recalculate required monthly savings with ROI
            const profile = await this.get();
            const currentAge = this.calculateAge(profile?.dob);
            const goal = goals[index];

            if (profile && currentAge > 0 && goal.targetAge > currentAge) {
                const yearsLeft = goal.targetAge - currentAge;
                const monthsLeft = yearsLeft * 12;
                const investmentData = INVESTMENT_ROI[goal.investmentType] || INVESTMENT_ROI.savings;
                const monthlyROI = investmentData.roi / 12;

                if (monthlyROI > 0) {
                    const factor = (Math.pow(1 + monthlyROI, monthsLeft) - 1) / monthlyROI;
                    goal.requiredMonthlySavings = Math.ceil(goal.targetAmount / factor);
                } else {
                    goal.requiredMonthlySavings = Math.ceil(goal.targetAmount / monthsLeft);
                }
                goal.expectedROI = investmentData.displayROI;
                goal.investmentName = investmentData.name;
            }

            await Storage.set(this.STORAGE_KEYS.GOALS, goals);
            return goals[index];
        }
        return null;
    },

    /**
     * Delete a goal
     */
    async deleteGoal(goalId) {
        const goals = (await this.getGoals()).filter(g => g.id !== goalId);
        await Storage.set(this.STORAGE_KEYS.GOALS, goals);
        return true;
    },

    /**
     * Get primary (first active) goal
     */
    async getPrimaryGoal() {
        return (await this.getGoals()).find(g => g.isActive) || null;
    },

    /**
     * Calculate goal feasibility
     */
    async analyzeGoalFeasibility(goal = null) {
        const profile = await this.get();
        goal = goal || (await this.getPrimaryGoal());
        const currentAge = this.calculateAge(profile?.dob);

        if (!profile || !goal || currentAge === 0) {
            return { feasible: false, error: 'Missing profile or goal data' };
        }

        const yearsLeft = goal.targetAge - currentAge;
        if (yearsLeft <= 0) {
            return { feasible: false, error: 'Target age must be greater than current age' };
        }

        const monthsLeft = yearsLeft * 12;

        // Use the ROI-aware required savings if available, otherwise fallback to linear
        const requiredMonthly = goal.requiredMonthlySavings || Math.ceil(goal.targetAmount / monthsLeft);

        // Get current financial data
        const summary = await Entries.getFinancialSummary();
        const currentSavings = summary.currentMonth.savings;
        const currentIncome = summary.currentMonth.income;
        const currentExpense = summary.currentMonth.expense;

        // Calculate feasibility
        const gap = requiredMonthly - currentSavings;
        const efficiency = currentIncome > 0 ? (currentSavings / currentIncome) * 100 : 0;

        // Calculate feasibility based on current savings vs required
        const feasibilityPercent = requiredMonthly > 0
            ? (currentSavings / requiredMonthly) * 100
            : 100;

        return {
            feasible: currentSavings >= requiredMonthly,
            yearsLeft,
            monthsLeft,
            requiredMonthly: Math.ceil(requiredMonthly),
            currentSavings,
            currentIncome,
            currentExpense,
            gap: Math.ceil(gap),
            feasibilityPercent: Math.min(feasibilityPercent, 100).toFixed(0),
            savingsRate: efficiency.toFixed(0),
            topExpenses: summary.expenseCategories.slice(0, 5)
        };
    },

    /**
     * Get financial summary for AI context
     */
    async getProfileContext() {
        const profile = await this.get();
        const goal = await this.getPrimaryGoal();
        const analysis = await this.analyzeGoalFeasibility(goal);

        return {
            profile,
            goal,
            analysis
        };
    }
};

// Profile.init() will be called from App.startApp() after authentication is confirmed
