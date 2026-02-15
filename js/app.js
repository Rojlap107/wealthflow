/**
 * WealthFlow - Personal Expense Tracker
 * Handles routing, UI interactions, and app initialization
 */

const App = {
    currentPage: 'dashboard',
    currentTheme: 'dark',

    /**
     * Initialize the app
     */
    async init() {
        // Initialize theme first
        this.initTheme();

        // Initialize Auth
        await Auth.init();

        // Setup common handlers (theme, etc)
        this.setupThemeToggle();

        if (Auth.isAuthenticated()) {
            await this.startApp();
        } else {
            this.showAuthScreen();
        }

        // Setup global handlers
        this.setupAuthHandlers();

        console.log('WealthFlow Expense Tracker v4.0 initialized');
    },

    /**
     * Start the main application after login
     */
    async startApp() {
        // Hide auth screen, show main app
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';



        // Initialize storage first
        await Storage.init();

        // Initialize components
        await Profile.init();

        // Update global header with profile info immediately after profile init
        await this.updateGlobalHeader();

        await Dashboard.init();
        await Chatbot.init();

        // Setup navigation
        this.setupNavigation();

        // Setup modal handlers
        this.setupModal();

        // Setup form handlers
        this.setupForms();

        // Setup profile handlers
        this.setupProfileHandlers();

        // Setup category handlers
        this.setupCategoryHandlers();

        // Setup logout handler
        document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());
        document.getElementById('profileLogoutBtn')?.addEventListener('click', () => Auth.logout());

        // Show dashboard by default
        await this.navigateTo('dashboard');
    },

    /**
     * Show authentication screen
     */
    showAuthScreen() {
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    },

    /**
     * Setup Auth specific handlers
     */
    setupAuthHandlers() {
        const authForm = document.getElementById('authForm');
        const authToggleLink = document.getElementById('authToggleLink');
        const authTitle = document.getElementById('authTitle');
        const authSubmitBtn = document.getElementById('authSubmitBtn');
        const authToggleText = document.getElementById('authToggleText');

        let isLogin = true;

        if (authToggleLink) {
            authToggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                isLogin = !isLogin;
                authTitle.textContent = isLogin ? 'Login to WealthFlow' : 'Register for WealthFlow';
                authSubmitBtn.textContent = isLogin ? 'Login' : 'Register';
                authToggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
                authToggleLink.textContent = isLogin ? 'Register' : 'Login';

                // Toggle registration fields
                const regFields = document.getElementById('registerFields');
                if (regFields) {
                    if (isLogin) {
                        regFields.classList.add('hidden');
                        document.getElementById('regName').required = false;
                        document.getElementById('regDob').required = false;
                    } else {
                        regFields.classList.remove('hidden');
                        document.getElementById('regName').required = true;
                        document.getElementById('regDob').required = true;
                        this.renderRegistrationAvatars();
                    }
                }
            });
        }

        if (authForm) {
            authForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('authUsername').value;
                const password = document.getElementById('authPassword').value;

                let result;
                if (isLogin) {
                    result = await Auth.login(username, password);
                } else {
                    result = await Auth.register(username, password);
                }

                if (result.success) {
                    // specific logic for registration to save profile
                    if (!isLogin) {
                        const name = document.getElementById('regName').value;
                        const dob = document.getElementById('regDob').value;
                        const avatar = document.getElementById('regAvatarValue').value;

                        await Profile.save({
                            name: name,
                            dob: dob,
                            email: '', // Optional in this flow
                            profilePicture: avatar === 'initials' ? '' : avatar,
                            createdAt: Date.now(),
                            isSetup: true
                        });
                    }

                    this.showToast(isLogin ? 'Login successful!' : 'Registration successful!', 'success');
                    await this.startApp();
                } else {
                    this.showToast(result.error || 'Authentication failed', 'error');
                }
            });
        }
    },

    /**
     * Render icons for registration form
     */
    renderRegistrationAvatars() {
        const container = document.getElementById('regAvatarGrid');
        const hiddenInput = document.getElementById('regAvatarValue');
        if (!container) return;

        // Local Icons list (1.png to 14.png)
        const icons = [];
        for (let i = 1; i <= 14; i++) {
            icons.push({ id: `icon-${i}`, path: `/assets/icons/${i}.png` });
        }

        container.innerHTML = icons.map(icon => `
             <div class="avatar-option micro-option" data-reg-avatar="${icon.path}">
                 <div class="avatar-preview">
                     <img src="${icon.path}" alt="${icon.id}">
                 </div>
             </div>
         `).join('');

        // selection handler
        container.querySelectorAll('.avatar-option').forEach(opt => {
            opt.addEventListener('click', () => {
                container.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                hiddenInput.value = opt.dataset.regAvatar;
            });
        });
    },

    /**
     * Initialize theme from localStorage or system preference
     */
    initTheme() {
        // Check localStorage first
        const savedTheme = localStorage.getItem('ngul_theme');

        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
        }

        this.applyTheme(this.currentTheme);
    },

    /**
     * Setup theme toggle button
     */
    setupThemeToggle() {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Listen for system preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem('ngul_theme')) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    },

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('ngul_theme', this.currentTheme);
    },

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);

        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.getElementById('themeColorMeta');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'dark' ? '#000000' : '#f2f2f7');
        }

        // Toggle theme icons
        const sunIcon = document.querySelector('.theme-icon-sun');
        const moonIcon = document.querySelector('.theme-icon-moon');
        if (sunIcon && moonIcon) {
            if (theme === 'dark') {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            } else {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            }
        }
    },

    /**
     * Setup navigation handlers
     */
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                if (page === 'add') {
                    this.openAddEntryModal();
                } else if (page) {
                    this.navigateTo(page);
                }
            });
        });

        // Dashboard specific listeners
        document.getElementById('prevMonth')?.addEventListener('click', () => Dashboard.prevMonth());
        document.getElementById('nextMonth')?.addEventListener('click', () => Dashboard.nextMonth());

        // Entries page listeners
        document.getElementById('entriesPrevMonth')?.addEventListener('click', () => {
            Dashboard.prevMonth();
            this.renderEntriesPage();
        });
        document.getElementById('entriesNextMonth')?.addEventListener('click', () => {
            Dashboard.nextMonth();
            this.renderEntriesPage();
        });

        document.getElementById('seeAllEntriesBtn')?.addEventListener('click', () => this.navigateTo('entries'));

        // Header Avatar listener (goto profile)
        document.getElementById('headerAvatarContainer')?.addEventListener('click', () => this.navigateTo('profile'));

        // Manage Categories listener
        document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => this.navigateTo('categories'));

        // Back to Profile listener
        document.getElementById('backToProfileBtn')?.addEventListener('click', () => this.navigateTo('profile'));

        // Add Category from Header listener
        document.getElementById('addCategoryBtnHeader')?.addEventListener('click', () => this.openCategoryModal());
    },

    /**
     * Navigate to a page
     */
    async navigateTo(page) {
        this.currentPage = page;

        // Scroll to top when navigating
        window.scrollTo(0, 0);

        // Update active states
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const pageEl = document.getElementById(`page-${page}`);
        const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);

        if (pageEl) pageEl.classList.add('active');
        if (navEl) navEl.classList.add('active');

        // Refresh page-specific content
        if (page === 'dashboard') {
            await Dashboard.render();
        } else if (page === 'entries') {
            await this.renderEntriesPage();
        } else if (page === 'chat') {
            Chatbot.renderMessages();
            Chatbot.scrollToBottom();
        } else if (page === 'profile') {
            await this.renderProfilePage();
        } else if (page === 'categories') {
            await this.renderCategoryManagement();
        }
    },

    /**
     * Setup modal handlers
     */
    /**
     * Setup modal handlers
     */
    setupModal() {
        const overlay = document.getElementById('modalOverlay');
        const closeBtn = document.getElementById('modalClose');

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal();
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Custom Delete Confirmation Modal Handlers
        const deleteOverlay = document.getElementById('deleteConfirmOverlay');
        const deleteCloseBtn = document.getElementById('deleteConfirmClose');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

        if (deleteOverlay) {
            deleteOverlay.addEventListener('click', (e) => {
                if (e.target === deleteOverlay) {
                    this.closeDeleteModal();
                }
            });
        }

        if (deleteCloseBtn) deleteCloseBtn.addEventListener('click', () => this.closeDeleteModal());
        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());

        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                if (this.pendingDeleteAction) {
                    this.pendingDeleteAction();
                    this.pendingDeleteAction = null;
                }
                this.closeDeleteModal();
            });
        }
    },

    /**
     * Open add entry modal
     */
    async openAddEntryModal(existingEntry = null) {
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('entryForm');

        if (!modal || !form) return;

        // Reset form
        form.reset();

        // Set title
        if (title) {
            title.textContent = existingEntry ? 'Edit Entry' : 'Add Entry';
        }

        // Set default date to today
        const dateInput = document.getElementById('entryDate');
        if (dateInput && !existingEntry) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Populate categories
        await this.populateCategorySelect();

        // Set default type
        this.setEntryType('expense');

        // If editing, populate form
        if (existingEntry) {
            this.populateEntryForm(existingEntry);
        }

        // Store edit ID
        form.dataset.editId = existingEntry?.id || '';

        // Show modal
        modal.classList.add('active');
    },

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('modalOverlay');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    /**
     * Setup form handlers
     */
    setupForms() {
        // Entry type toggle
        document.querySelectorAll('.toggle-btn[data-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.setEntryType(type);
            });
        });

        // Entry category toggle (fixed/variable)
        document.querySelectorAll('.toggle-btn[data-entry-category]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.toggle-btn[data-entry-category]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Form submission
        const form = document.getElementById('entryForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEntrySubmit();
            });
        }

        // Delete button
        const deleteBtn = document.getElementById('deleteEntryBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleEntryDelete());
        }
    },

    /**
     * Set entry type (income/expense/investment)
     */
    async setEntryType(type) {
        document.querySelectorAll('.toggle-btn[data-type]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Update category dropdown
        await this.populateCategorySelect(type);

        // Update description placeholder
        const descInput = document.getElementById('entryCostHead');
        if (descInput) {
            if (type === 'income') {
                descInput.placeholder = 'Source of income? (e.g. Salary, Side Hustle)';
            } else if (type === 'investment') {
                descInput.placeholder = 'What did you invest in? (e.g. BTC, Apple Stock)';
            } else {
                descInput.placeholder = 'What was this expense for? (e.g. Coffee, Lunch)';
            }
        }
    },

    /**
     * Populate category select
     */
    async populateCategorySelect(type = 'expense') {
        const select = document.getElementById('entryCategory');
        if (!select) return;

        const categories = await Storage.get(Storage.KEYS.CATEGORIES);
        if (!categories) return;

        let catList = [];
        if (type === 'income') {
            catList = categories.income;
        } else if (type === 'expense') {
            catList = categories.expense;
        } else if (type === 'investment') {
            catList = categories.investment || [];
        }

        select.innerHTML = catList.map(cat =>
            `<option value="${cat.id}">${cat.name}</option>`
        ).join('');
    },

    /**
     * Populate form with existing entry data
     */
    populateEntryForm(entry) {
        document.getElementById('entryDate').value = entry.date;
        document.getElementById('entryCostHead').value = entry.costHead;
        document.getElementById('entryAmount').value = entry.amount;
        document.getElementById('entryCurrency').value = entry.currency;
        document.getElementById('entryCategory').value = entry.categoryId;
        document.getElementById('entryPaymentMethod').value = entry.paymentMethod;
        document.getElementById('entryNotes').value = entry.notes || '';

        // Set type
        this.setEntryType(entry.type);

        // Set entry category (fixed/variable)
        document.querySelectorAll('.toggle-btn[data-entry-category]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.entryCategory === entry.entryCategory);
        });

        // Show delete button for existing entries
        const deleteBtn = document.getElementById('deleteEntryBtn');
        if (deleteBtn) {
            deleteBtn.classList.remove('hidden');
        }
    },

    /**
     * Handle entry form submission
     */
    async handleEntrySubmit() {
        const form = document.getElementById('entryForm');
        const editId = form.dataset.editId;

        // Get form values
        const type = document.querySelector('.toggle-btn[data-type].active')?.dataset.type || 'expense';
        const entryCategory = document.querySelector('.toggle-btn[data-entry-category].active')?.dataset.entryCategory || 'variable';

        const entryData = {
            date: document.getElementById('entryDate').value,
            type: type,
            entryCategory: entryCategory,
            categoryId: document.getElementById('entryCategory').value,
            costHead: document.getElementById('entryCostHead').value,
            amount: parseFloat(document.getElementById('entryAmount').value),
            currency: document.getElementById('entryCurrency').value,
            paymentMethod: document.getElementById('entryPaymentMethod').value,
            notes: document.getElementById('entryNotes').value
        };

        // Convert to INR if different currency
        if (entryData.currency !== 'INR') {
            try {
                entryData.amountINR = await Currency.convertToINR(entryData.amount, entryData.currency);
            } catch (e) {
                entryData.amountINR = Currency.convertWithFallback(entryData.amount, entryData.currency);
            }
        } else {
            entryData.amountINR = entryData.amount;
        }

        // Save entry
        if (editId) {
            await Entries.update(editId, entryData);
            this.showToast('Entry updated!', 'success');
        } else {
            await Entries.add(entryData);
            this.showToast('Entry added!', 'success');
        }

        // Close modal and refresh
        this.closeModal();
        await Dashboard.render();

        if (this.currentPage === 'entries') {
            await this.renderEntriesPage();
        }
    },

    /**
     * Handle entry deletion
     */
    /**
     * Show custom delete confirmation
     */
    showDeleteConfirmation(message, onConfirm) {
        const overlay = document.getElementById('deleteConfirmOverlay');
        const messageEl = document.getElementById('deleteConfirmUiMessage');

        if (overlay && messageEl) {
            messageEl.textContent = message;
            this.pendingDeleteAction = onConfirm;
            overlay.classList.add('active');
        } else {
            // Fallback if modal elements missing
            if (confirm(message)) {
                onConfirm();
            }
        }
    },

    /**
     * Close delete confirmation modal
     */
    closeDeleteModal() {
        const overlay = document.getElementById('deleteConfirmOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        this.pendingDeleteAction = null;
    },

    /**
     * Handle entry deletion
     */
    async handleEntryDelete() {
        const form = document.getElementById('entryForm');
        const editId = form.dataset.editId;

        if (!editId) return;

        this.showDeleteConfirmation('Are you sure you want to delete this entry?', async () => {
            await Entries.delete(editId);
            this.showToast('Entry deleted', 'success');
            this.closeModal();
            await Dashboard.render();

            if (this.currentPage === 'entries') {
                await this.renderEntriesPage();
            }
        });
    },

    /**
     * Show entry detail (for editing)
     */
    async showEntryDetail(id) {
        const entry = await Entries.getById(id);
        if (entry) {
            this.openAddEntryModal(entry);
        }
    },

    /**
     * Render entries page
     */
    async renderEntriesPage() {
        const container = document.getElementById('entriesList');
        if (!container) return;

        const entries = await Entries.getByMonth(Dashboard.currentYear, Dashboard.currentMonth);
        const categories = await Storage.get(Storage.KEYS.CATEGORIES);

        // Sort by date descending
        const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                  <div class="empty-state-illustration">
                    <svg viewBox="0 0 24 24" width="80" height="80" fill="currentColor" style="opacity: 0.2; margin-bottom: 20px;">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <div class="empty-state-title">No entries this month</div>
                  <div class="empty-state-text">Tap the + button to build your wealth</div>
                </div>
            `;
            return;
        }

        // Group by date
        const grouped = {};
        sorted.forEach(entry => {
            const dateKey = entry.date;
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(entry);
        });

        container.innerHTML = Object.entries(grouped).map(([date, items]) => {
            const formattedDate = new Date(date).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
            });

            return `
                <div class="entries-date-group">
                  <div class="entries-date-header">${formattedDate}</div>
                  <div class="entries-items">
                    ${items.map(entry => {
                const catList = entry.type === 'income' ? categories.income : (entry.type === 'investment' ? categories.investment : categories.expense);
                const category = (catList || categories.expense).find(c => c.id === entry.categoryId) || { color: '#8e8e93', name: 'Other' };
                const catColor = category.color || '#8e8e93';
                const currencyInfo = CURRENCIES.find(c => c.code === entry.currency) || CURRENCIES[0];

                return `
                        <div class="entry-item" onclick="App.showEntryDetail('${entry.id}')">
                          <div class="entry-icon ${entry.type === 'investment' ? 'investment' : ''}" style="background-color: ${catColor}20; color: ${catColor}; border: 1.5px solid ${catColor}40;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${catColor};"></div>
                          </div>
                          <div class="entry-details">
                            <div class="entry-title">${entry.costHead}</div>
                            <div class="entry-meta">
                              ${entry.entryCategory === 'fixed' ? '<span class="entry-category-tag fixed">Fixed</span>' : ''}
                              <span class="entry-category-tag">${category.name || 'Other'}</span>
                            </div>
                          </div>
                          <div class="entry-amount-container">
                            <div class="entry-amount ${entry.type}">${entry.type === 'expense' ? '-' : '+'}${formatCurrency(entry.amountINR || entry.amount)}</div>
                            ${entry.currency !== 'INR' ? `<div class="entry-currency">${currencyInfo.symbol}${entry.amount}</div>` : ''}
                          </div>
                        </div>
                      `;
            }).join('')}
                  </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Update global header with profile information
     */
    async updateGlobalHeader() {
        const profile = await Profile.get();
        if (!profile) return;

        const headerName = document.getElementById('headerUserName');
        const headerAvatar = document.getElementById('headerAvatar');

        if (headerName && profile.name) {
            headerName.textContent = profile.name;
        }

        if (headerAvatar && profile.profilePicture) {
            if (profile.profilePicture === 'initials') {
                const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                headerAvatar.innerHTML = `<span style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--bg-tertiary); color: var(--text-primary); font-weight: 600;">${initials}</span>`;
            } else {
                headerAvatar.innerHTML = `<img src="${profile.profilePicture}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; display: block;">`;
            }
            // Ensure no background image interferes
            headerAvatar.style.backgroundImage = 'none';
        }
    },

    /**
     * Helper to calculate age from DOB
     */
    calculateAge(dobString) {
        if (!dobString) return '';
        const dob = new Date(dobString);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 10);

        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // ============================================
    // PROFILE PAGE METHODS
    // ============================================

    /**
     * Render profile page
     */
    async renderProfilePage() {
        const profile = await Profile.get();
        const goals = await Profile.getGoals();

        // Update profile display
        const profileDisplayName = document.getElementById('profileDisplayName');
        const profileDisplayMeta = document.getElementById('profileDisplayMeta');
        const avatarEl = document.getElementById('profileAvatar');

        if (profileDisplayName) profileDisplayName.textContent = profile?.name || 'Set up your profile';
        if (profileDisplayMeta) {
            const age = this.calculateAge(profile?.dob);
            profileDisplayMeta.textContent = age ? `${age} years old` : 'Tap to add your details';
        }

        if (profile && profile.name) {
            // Update Header
            const headerName = document.getElementById('headerUserName');
            if (headerName) headerName.textContent = profile.name;

            const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const avatarImg = profile.profilePicture
                ? `<img src="${profile.profilePicture}" alt="${profile.name}" style="width: 100%; height: 100%; object-fit: cover;">`
                : `<span style="color: white; font-weight: 600; display: flex; align-items: center; justify-content: center; height: 100%;">${initials}</span>`;

            if (avatarEl) avatarEl.innerHTML = avatarImg;

            // Sync with header avatar
            const headerAvatar = document.getElementById('headerAvatar');
            if (headerAvatar && profile.profilePicture) {
                headerAvatar.src = profile.profilePicture;
            } else if (headerAvatar) {
                // If no picture, we might need a placeholder or initials container
                const container = document.getElementById('headerAvatarContainer');
                if (container) container.innerHTML = avatarImg;
            }

            // Sync with chat user icons
            document.querySelectorAll('.chat-message.user .message-avatar').forEach(el => {
                el.innerHTML = avatarImg;
            });
        } else {
            if (profileDisplayName) profileDisplayName.textContent = 'Set up your profile';
            if (profileDisplayMeta) profileDisplayMeta.textContent = 'Tap to add your details';
            if (avatarEl) avatarEl.innerHTML = '<span></span>';
        }


        // Render goals
        this.renderGoals(goals);

        // Render category management
        await this.renderCategoryManagement();

        // Update feasibility analysis if goal exists
        if (goals.length > 0) {
            await this.renderFeasibilityAnalysis(goals[0]);
        }
    },

    /**
     * Render goals list
     */
    async renderGoals(goals) {
        const container = document.getElementById('goalContainer');
        if (!container) return;

        if (goals.length === 0) {
            container.innerHTML = `
                <div class="empty-goal">
                    <svg viewBox="0 0 24 24" width="60" height="60" fill="currentColor" style="opacity: 0.15; margin-bottom: 20px;">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
                    </svg>
                    <p class="empty-goal-text">Set a wealth goal to get personalized advice from WealthFlow AI</p>
                </div>
            `;
            document.getElementById('goalAnalysisCard')?.classList.add('hidden');
            return;
        }

        const investmentIcons = {
            savings: 'SAVINGS',
            fd: 'FD',
            mutual_funds: 'MF',
            stocks: 'STOCKS',
            mixed: 'MIXED'
        };

        const profile = await Profile.get();
        const currentAge = this.calculateAge(profile?.dob);

        container.innerHTML = goals.map(goal => {
            const yearsLeft = (currentAge > 0 && goal.targetAge) ? goal.targetAge - currentAge : 0;
            const icon = investmentIcons[goal.investmentType] || 'GOAL';

            // Get ROI display text from the constant (always up-to-date)
            const investmentData = INVESTMENT_ROI[goal.investmentType];
            const roiDisplay = investmentData ? investmentData.displayROI : (goal.expectedROI || 'N/A');

            return `
                <div class="goal-card" onclick="App.openGoalModal('${goal.id}')">
                    <div class="goal-header">
                        <div>
                            <div class="goal-title">${goal.name}</div>
                            <div class="goal-amount">${formatCurrency(goal.targetAmount)}</div>
                        </div>
                        <div class="goal-icon-container">
                            <span class="goal-icon">${icon}</span>
                            <span class="goal-roi">${roiDisplay} ROI</span>
                        </div>
                    </div>
                    <div class="goal-meta">
                        <span>By age ${goal.targetAge}</span>
                        <span>${yearsLeft > 0 ? yearsLeft + ' years left' : 'Set your age'}</span>
                    </div>
                    ${goal.requiredMonthlySavings ? `
                        <div class="goal-progress">
                            <div class="goal-progress-text">
                                <span>Required monthly: ${formatCurrency(goal.requiredMonthlySavings)}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    /**
     * Render feasibility analysis
     */
    async renderFeasibilityAnalysis(goal) {
        const card = document.getElementById('goalAnalysisCard');
        const bar = document.getElementById('feasibilityBar');
        const text = document.getElementById('feasibilityText');

        if (!card || !bar || !text) return;

        const analysis = await Profile.analyzeGoalFeasibility(goal);

        if (analysis.error) {
            card.classList.add('hidden');
            return;
        }

        card.classList.remove('hidden');

        // Update feasibility bar
        const percent = Math.min(parseFloat(analysis.feasibilityPercent), 100);
        bar.style.width = `${percent}%`;

        if (percent >= 80) {
            bar.className = 'feasibility-bar high';
        } else if (percent >= 40) {
            bar.className = 'feasibility-bar medium';
        } else {
            bar.className = 'feasibility-bar low';
        }

        // Update text
        if (analysis.feasible) {
            text.innerHTML = `<strong>On track!</strong> Your current wealth building of ${formatCurrency(analysis.currentSavings)}/month exceeds the required ${formatCurrency(analysis.requiredMonthly)}/month.`;
        } else {
            text.innerHTML = `You need to invest <strong>${formatCurrency(analysis.requiredMonthly)}/month</strong>, but currently putting in ${formatCurrency(analysis.currentSavings)}/month. Gap: <strong>${formatCurrency(analysis.gap)}/month</strong>. Ask WealthFlow AI for advice!`;
        }
    },

    /**
     * Setup profile page handlers
     */
    setupProfileHandlers() {
        // Edit profile buttons
        const editProfileBtn = document.getElementById('editProfileBtn');
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');

        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => this.openProfileModal());
        }
        if (changeAvatarBtn) {
            changeAvatarBtn.addEventListener('click', () => this.openProfileModal());
        }

        // Add goal button
        const addGoalBtn = document.getElementById('addGoalBtn');
        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', () => this.openGoalModal());
        }

        // Profile modal handlers
        const profileOverlay = document.getElementById('profileModalOverlay');
        const profileClose = document.getElementById('profileModalClose');
        const profileForm = document.getElementById('profileForm');

        if (profileOverlay) {
            profileOverlay.addEventListener('click', (e) => {
                if (e.target === profileOverlay) this.closeProfileModal();
            });
        }
        if (profileClose) {
            profileClose.addEventListener('click', () => this.closeProfileModal());
        }
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProfileSubmit();
            });
        }

        // Goal modal handlers
        const goalOverlay = document.getElementById('goalModalOverlay');
        const goalClose = document.getElementById('goalModalClose');
        const goalForm = document.getElementById('goalForm');
        const deleteGoalBtn = document.getElementById('deleteGoalBtn');

        if (goalOverlay) {
            goalOverlay.addEventListener('click', (e) => {
                if (e.target === goalOverlay) this.closeGoalModal();
            });
        }
        if (goalClose) {
            goalClose.addEventListener('click', () => this.closeGoalModal());
        }
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleGoalSubmit();
            });
        }
        if (deleteGoalBtn) {
            deleteGoalBtn.addEventListener('click', () => this.handleGoalDelete());
        }

        // Settings handlers
        const clearChatBtn = document.getElementById('clearChatBtn');
        const exportDataBtn = document.getElementById('exportDataBtn');
        const clearDataBtn = document.getElementById('clearDataBtn');

        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => {
                if (confirm('Clear all chat history?')) {
                    Chatbot.clearHistory();
                    this.showToast('Chat history cleared', 'success');
                }
            });
        }

        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => this.exportData());
        }

        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => {
                this.showDeleteConfirmation('Are you sure you want to clear ALL your data? This cannot be undone.', async () => {
                    await Storage.remove(Storage.KEYS.ENTRIES);
                    await Storage.remove(Storage.KEYS.FIXED_TEMPLATES);
                    await Storage.remove(Storage.KEYS.PROFILE);
                    await Storage.remove(Storage.KEYS.GOALS);
                    await Storage.remove(Storage.KEYS.CATEGORIES);
                    await Storage.remove(Storage.KEYS.CHAT_HISTORY); // Ensure chat is also cleared
                    location.reload();
                });
            });
        }

        // Theme and Logout (moved from header)
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('profileThemeToggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());
        document.getElementById('profileLogoutBtn')?.addEventListener('click', () => Auth.logout());

        const migrateLegacyDataBtn = document.getElementById('migrateLegacyDataBtn');
        if (migrateLegacyDataBtn) {
            migrateLegacyDataBtn.addEventListener('click', () => this.migrateLegacyData());
        }
    },

    /**
     * Migrate legacy localStorage data to SQLite backend
     */
    async migrateLegacyData() {
        const legacyKeys = {
            'expense_tracker_entries': Storage.KEYS.ENTRIES,
            'expense_tracker_fixed_templates': Storage.KEYS.FIXED_TEMPLATES,
            'expense_tracker_categories': Storage.KEYS.CATEGORIES,
            'expense_tracker_settings': Storage.KEYS.SETTINGS,
            'expense_tracker_chat_history': Storage.KEYS.CHAT_HISTORY,
            'ngul_profile': Storage.KEYS.PROFILE,
            'ngul_goals': Storage.KEYS.GOALS
        };

        let found = false;
        for (const oldKey in legacyKeys) {
            if (localStorage.getItem(oldKey)) {
                found = true;
                break;
            }
        }

        if (!found) {
            this.showToast('No legacy data found to migrate', 'info');
            return;
        }

        if (!confirm('Found data in localStorage from the previous version. Would you like to migrate it to the new server database? This will overwrite existing server data.')) {
            return;
        }

        this.showToast('Migrating data...', 'info');

        try {
            let count = 0;
            for (const oldKey in legacyKeys) {
                const newKey = legacyKeys[oldKey];
                const data = localStorage.getItem(oldKey);
                if (data) {
                    try {
                        const parsedData = JSON.parse(data);
                        await Storage.set(newKey, parsedData);
                        count++;
                    } catch (err) {
                        console.error(`Failed to parse/migrate ${oldKey}:`, err);
                    }
                }
            }

            this.showToast(`Successfully migrated ${count} data modules!`, 'success');

            // Rename old keys to backup names to avoid repeated prompts
            for (const oldKey in legacyKeys) {
                const data = localStorage.getItem(oldKey);
                if (data) {
                    localStorage.setItem(`legacy_backup_${oldKey}`, data);
                    localStorage.removeItem(oldKey);
                }
            }

            setTimeout(() => location.reload(), 2000);
        } catch (e) {
            console.error('Migration error:', e);
            this.showToast('Data migration failed. Check console for details.', 'error');
        }
    },

    /**
     * Open profile modal
     */
    async openProfileModal() {
        const modal = document.getElementById('profileModalOverlay');
        const profile = await Profile.get();

        // Populate form
        document.getElementById('profileName').value = profile?.name || '';
        document.getElementById('profileDob').value = profile?.dob || '';
        document.getElementById('profileEmail').value = profile?.email || '';

        // Reset and populate avatar selection
        this.selectedAvatar = profile?.profilePicture || 'initials';
        this.renderAvatarOptions(profile);
        this.setupAvatarSelectionHandlers();

        modal?.classList.add('active');
    },

    /**
     * Render avatar selection options
     */
    renderAvatarOptions(profile) {
        const container = document.getElementById('presetAvatars');
        if (!container) return;

        // Local Icons list (1.png to 14.png)
        const fruits = [];
        for (let i = 1; i <= 14; i++) {
            fruits.push({ id: `icon-${i}`, path: `assets/icons/${i}.png` });
        }

        // Update initials preview
        const initialsPreview = document.querySelector('.initials-preview');
        if (initialsPreview) {
            const name = document.getElementById('profileName').value || profile?.name || 'Ab';
            initialsPreview.textContent = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }

        container.innerHTML = fruits.map(fruit => `
            <div class="avatar-option ${this.selectedAvatar === fruit.path ? 'selected' : ''}" data-avatar="${fruit.path}">
                <div class="avatar-preview">
                    <img src="${fruit.path}" alt="${fruit.id}" onerror="this.src='https://ui-avatars.com/api/?name=${fruit.id}&background=random'">
                </div>
            </div>
        `).join('');

        // Handle initials selection state
        const initialsOption = document.querySelector('[data-avatar="initials"]');
        if (initialsOption) {
            initialsOption.classList.toggle('selected', this.selectedAvatar === 'initials' || !this.selectedAvatar);
        }
    },

    /**
     * Setup avatar selection handlers
     */
    setupAvatarSelectionHandlers() {
        const options = document.querySelectorAll('.avatar-option[data-avatar]');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                const avatar = opt.dataset.avatar;
                this.selectedAvatar = avatar;

                // Update selection UI
                document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });

        // Handle file upload
        const uploadInput = document.getElementById('avatarUpload');
        if (uploadInput) {
            uploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 1024 * 1024) {
                        this.showToast('Image size too large (max 1MB)', 'error');
                        return;
                    }

                    const base64 = await this.convertToBase64(file);
                    this.selectedAvatar = base64;

                    // Show a temporary preview or just mark as selected
                    this.showToast('Custom image uploaded', 'success');

                    // Update selection UI
                    document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
                    document.querySelector('.upload-option').classList.add('selected');
                }
            });
        }

        // Real-time initials update
        const nameInput = document.getElementById('profileName');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                const initialsPreview = document.querySelector('.initials-preview');
                if (initialsPreview) {
                    const name = e.target.value || 'Ab';
                    initialsPreview.textContent = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                }
            });
        }
    },

    /**
     * Convert file to base64
     */
    convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    /**
     * Close profile modal
     */
    closeProfileModal() {
        document.getElementById('profileModalOverlay')?.classList.remove('active');
    },

    /**
     * Handle profile form submit
     */
    async handleProfileSubmit() {
        const name = document.getElementById('profileName').value.trim();
        const dob = document.getElementById('profileDob').value; // Keep DOB as string
        const email = document.getElementById('profileEmail').value.trim();

        await Profile.update({
            name,
            dob, // Use dob directly
            email,
            profilePicture: this.selectedAvatar === 'initials' ? '' : this.selectedAvatar,
            isSetup: true
        });

        this.closeProfileModal();
        await this.renderProfilePage();
        await Dashboard.updateWelcomeMessage();
        await this.updateGlobalHeader();
        this.showToast('Profile updated!', 'success');
    },

    /**
     * Open goal modal
     */
    async openGoalModal(goalId = null) {
        const modal = document.getElementById('goalModalOverlay');
        const form = document.getElementById('goalForm');
        const title = document.getElementById('goalModalTitle');
        const deleteBtn = document.getElementById('deleteGoalBtn');

        form.reset();
        form.dataset.editId = goalId || '';

        if (goalId) {
            const goals = await Profile.getGoals();
            const goal = goals.find(g => g.id === goalId);

            if (goal) {
                title.textContent = 'Edit Goal';
                document.getElementById('goalName').value = goal.name;
                document.getElementById('goalAmount').value = goal.targetAmount;
                document.getElementById('goalAge').value = goal.targetAge;
                document.getElementById('goalType').value = goal.investmentType;
                document.getElementById('goalNotes').value = goal.notes || '';
                deleteBtn?.classList.remove('hidden');
            }
        } else {
            title.textContent = 'Add Savings Goal';
            deleteBtn?.classList.add('hidden');
        }

        modal?.classList.add('active');
    },

    /**
     * Close goal modal
     */
    closeGoalModal() {
        document.getElementById('goalModalOverlay')?.classList.remove('active');
    },

    /**
     * Handle goal form submit
     */
    async handleGoalSubmit() {
        const form = document.getElementById('goalForm');
        const editId = form.dataset.editId;

        const goalData = {
            name: document.getElementById('goalName').value.trim(),
            targetAmount: parseFloat(document.getElementById('goalAmount').value),
            targetAge: parseInt(document.getElementById('goalAge').value),
            investmentType: document.getElementById('goalType').value,
            notes: document.getElementById('goalNotes').value.trim()
        };

        if (editId) {
            await Profile.updateGoal(editId, goalData);
            this.showToast('Goal updated!', 'success');
        } else {
            await Profile.addGoal(goalData);
            this.showToast('Goal added!', 'success');
        }

        this.closeGoalModal();
        await this.renderProfilePage();
    },

    /**
     * Handle goal deletion
     */
    async handleGoalDelete() {
        const form = document.getElementById('goalForm');
        const editId = form.dataset.editId;

        if (editId) {
            this.showDeleteConfirmation('Delete this goal?', async () => {
                await Profile.deleteGoal(editId);
                this.closeGoalModal();
                await this.renderProfilePage();
                this.showToast('Goal deleted', 'success');
            });
        }
    },

    /**
     * Export data as JSON
     */
    async exportData() {
        const data = {
            profile: await Profile.get(),
            goals: await Profile.getGoals(),
            entries: await Entries.getAll(),
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ngul-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Data exported!', 'success');
    },

    // ============================================
    // CATEGORY MANAGEMENT METHODS
    // ============================================

    /**
     * Render category management lists
     */
    async renderCategoryManagement() {
        const categories = await Storage.get(Storage.KEYS.CATEGORIES);
        if (!categories) return;

        // Render expense categories
        const expenseContainer = document.getElementById('expenseCategoriesList');
        if (expenseContainer) {
            expenseContainer.innerHTML = categories.expense.map(cat => `
                <div class="category-item">
                    <div class="category-color-indicator" style="background-color: ${cat.color};"></div>
                    <div class="category-info">
                        <div class="category-name">${cat.name}</div>
                        <div class="category-icon-name">${cat.icon}</div>
                    </div>
                    <div class="category-actions">
                        <button class="category-action-btn" onclick="App.openCategoryModal('${cat.id}', 'expense')" title="Edit">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                            </svg>
                        </button>
                        <button class="category-action-btn delete" onclick="App.deleteCategoryConfirm('${cat.id}', 'expense')" title="Delete">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // Render income categories
        const incomeContainer = document.getElementById('incomeCategoriesList');
        if (incomeContainer) {
            incomeContainer.innerHTML = categories.income.map(cat => `
                <div class="category-item">
                    <div class="category-color-indicator" style="background-color: ${cat.color};"></div>
                    <div class="category-info">
                        <div class="category-name">${cat.name}</div>
                        <div class="category-icon-name">${cat.icon}</div>
                    </div>
                    <div class="category-actions">
                        <button class="category-action-btn" onclick="App.openCategoryModal('${cat.id}', 'income')" title="Edit">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                            </svg>
                        </button>
                        <button class="category-action-btn delete" onclick="App.deleteCategoryConfirm('${cat.id}', 'income')" title="Delete">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // Render investment categories
        const investmentContainer = document.getElementById('investmentCategoriesList');
        if (investmentContainer) {
            investmentContainer.innerHTML = (categories.investment || []).map(cat => `
                <div class="category-item">
                    <div class="category-color-indicator" style="background-color: ${cat.color};"></div>
                    <div class="category-info">
                        <div class="category-name">${cat.name}</div>
                        <div class="category-icon-name">${cat.icon}</div>
                    </div>
                    <div class="category-actions">
                        <button class="category-action-btn" onclick="App.openCategoryModal('${cat.id}', 'investment')" title="Edit">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                            </svg>
                        </button>
                        <button class="category-action-btn delete" onclick="App.deleteCategoryConfirm('${cat.id}', 'investment')" title="Delete">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    },

    /**
     * Open category modal
     */
    async openCategoryModal(categoryId = null, type = 'expense') {
        const modal = document.getElementById('categoryModalOverlay');
        const title = document.getElementById('categoryModalTitle');
        const form = document.getElementById('categoryForm');
        const deleteBtn = document.getElementById('deleteCategoryBtn');

        if (!modal || !form) return;

        // Reset form
        form.reset();
        deleteBtn.classList.add('hidden');

        // Set title
        if (title) {
            title.textContent = categoryId ? 'Edit Category' : 'Add Category';
        }

        // Set type toggle
        document.querySelectorAll('.toggle-btn[data-category-type]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.categoryType === type);
        });

        // If editing, populate form
        if (categoryId) {
            const categories = await Storage.get(Storage.KEYS.CATEGORIES);
            let catList = [];
            if (type === 'income') catList = categories.income;
            else if (type === 'investment') catList = categories.investment || [];
            else catList = categories.expense;

            const category = catList.find(c => c.id === categoryId);

            if (category) {
                document.getElementById('categoryName').value = category.name;
                document.getElementById('categoryIcon').value = category.icon;
                document.getElementById('categoryColor').value = category.color;
                deleteBtn.classList.remove('hidden');
            }
        }

        // Store edit info
        form.dataset.editId = categoryId || '';
        form.dataset.editType = type;

        // Show modal
        modal.classList.add('active');
    },

    /**
     * Close category modal
     */
    closeCategoryModal() {
        const modal = document.getElementById('categoryModalOverlay');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    /**
     * Setup category modal handlers
     */
    setupCategoryHandlers() {
        // Category modal handlers
        const categoryOverlay = document.getElementById('categoryModalOverlay');
        const categoryClose = document.getElementById('categoryModalClose');
        const categoryForm = document.getElementById('categoryForm');
        const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');

        if (categoryOverlay) {
            categoryOverlay.addEventListener('click', (e) => {
                if (e.target === categoryOverlay) this.closeCategoryModal();
            });
        }
        if (categoryClose) {
            categoryClose.addEventListener('click', () => this.closeCategoryModal());
        }
        if (categoryForm) {
            categoryForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCategorySubmit();
            });
        }
        if (deleteCategoryBtn) {
            deleteCategoryBtn.addEventListener('click', () => this.handleCategoryDelete());
        }

        // Category type toggle
        document.querySelectorAll('.toggle-btn[data-category-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.toggle-btn[data-category-type]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    },

    /**
     * Handle category form submission
     */
    async handleCategorySubmit() {
        const form = document.getElementById('categoryForm');
        const editId = form.dataset.editId;
        const editType = form.dataset.editType || 'expense';

        const categoryData = {
            id: editId || document.getElementById('categoryName').value.toLowerCase().replace(/\s+/g, '_'),
            name: document.getElementById('categoryName').value,
            icon: document.getElementById('categoryIcon').value,
            color: document.getElementById('categoryColor').value
        };

        const type = document.querySelector('.toggle-btn[data-category-type].active')?.dataset.categoryType || 'expense';

        // Get current categories
        const categories = await Storage.get(Storage.KEYS.CATEGORIES);
        const catList = type === 'income' ? categories.income : categories.expense;

        if (editId) {
            // Update existing category
            const index = catList.findIndex(c => c.id === editId);
            if (index !== -1) {
                catList[index] = { ...catList[index], ...categoryData };
            }
            this.showToast('Category updated!', 'success');
        } else {
            // Add new category
            catList.push(categoryData);
            this.showToast('Category added!', 'success');
        }

        // Save to storage
        if (type === 'income') {
            categories.income = catList;
        } else if (type === 'investment') {
            categories.investment = catList;
        } else {
            categories.expense = catList;
        }
        await Storage.set(Storage.KEYS.CATEGORIES, categories);

        // Close modal and refresh
        this.closeCategoryModal();
        await this.renderProfilePage();
    },

    /**
     * Handle category deletion
     */
    async handleCategoryDelete() {
        const form = document.getElementById('categoryForm');
        const editId = form.dataset.editId;
        const editType = form.dataset.editType || 'expense';

        if (!editId) return;

        if (confirm('Are you sure you want to delete this category?')) {
            const categories = await Storage.get(Storage.KEYS.CATEGORIES);
            const catList = editType === 'income' ? categories.income : categories.expense;

            // Remove category
            const filtered = catList.filter(c => c.id !== editId);

            if (editType === 'income') {
                categories.income = filtered;
            } else if (editType === 'investment') {
                categories.investment = filtered;
            } else {
                categories.expense = filtered;
            }

            await Storage.set(Storage.KEYS.CATEGORIES, categories);

            this.closeCategoryModal();
            await this.renderProfilePage();
            this.showToast('Category deleted', 'success');
        }
    },

    /**
     * Delete category with confirmation (called from onclick)
     */
    async deleteCategoryConfirm(categoryId, type) {
        this.showDeleteConfirmation('Are you sure you want to delete this category?', async () => {
            const categories = await Storage.get(Storage.KEYS.CATEGORIES);
            const catList = type === 'income' ? categories.income : categories.expense;

            // Remove category
            const filtered = catList.filter(c => c.id !== categoryId);

            if (type === 'income') {
                categories.income = filtered;
            } else {
                categories.expense = filtered;
            }

            await Storage.set(Storage.KEYS.CATEGORIES, categories);
            await this.renderProfilePage();
            this.showToast('Category deleted', 'success');
        });
    },

};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
});
