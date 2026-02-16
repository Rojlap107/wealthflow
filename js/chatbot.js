/**
 * Coconut AI - Financial Advisor Chatbot Module
 * AI-powered financial advisor using the configured API
 */

const Chatbot = {
    messages: [],
    isTyping: false,

    /**
     * Initialize chatbot
     */
    async init() {
        await this.loadHistory();
        await this.renderMessages();
        this.setupEventListeners();
    },

    /**
     * Load chat history from storage
     */
    async loadHistory() {
        const history = await Storage.get(Storage.KEYS.CHAT_HISTORY);
        this.messages = history || [];

        // Auto-migration: Fix legacy branding in existing messages
        let historyModified = false;
        this.messages.forEach(msg => {
            if (msg.content && msg.content.includes('Coconut AI')) {
                msg.content = msg.content.replace(/Coconut AI/g, 'WealthFlow AI');
                historyModified = true;
            }
        });

        if (historyModified) {
            await this.saveHistory();
        }

        // Add welcome message if no history
        if (this.messages.length === 0) {
            this.messages.push({
                role: 'assistant',
                content: `Hello! I'm **WealthFlow AI**, your personal financial advisor. I can help you understand your spending patterns, provide budgeting tips, and answer questions about your finances.

Try asking me things like:
• "How much did I spend this month?"
• "What's my biggest expense category?"
• "Give me tips to save more money"
• "Compare my spending to last month"`,
                timestamp: Date.now()
            });
            await this.saveHistory();
        }
    },

    async saveHistory() {
        // Keep only last 100 messages to avoid storage issues
        const toSave = this.messages.slice(-100);
        await Storage.set(Storage.KEYS.CHAT_HISTORY, toSave);
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('chatSendBtn');
        const clearBtn = document.getElementById('clearChatBtn');
        const voiceBtn = document.getElementById('voiceInputBtn');

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear your chat history?')) {
                    this.clearHistory();
                }
            });
        }

        if (voiceBtn) {
            this.setupVoiceInput(voiceBtn, input);
        }

        // Close context menu when clicking elsewhere
        document.addEventListener('click', () => this.hideContextMenu());
        document.addEventListener('scroll', () => this.hideContextMenu(), true);
    },

    /**
     * Setup Voice-to-Text (Web Speech API)
     */
    setupVoiceInput(btn, input) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            btn.style.display = 'none'; // Hide if not supported
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let isListening = false;

        btn.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });

        recognition.onstart = () => {
            isListening = true;
            btn.classList.add('listening');
            input.placeholder = 'Listening...';
        };

        recognition.onend = () => {
            isListening = false;
            btn.classList.remove('listening');
            input.placeholder = 'Ask about your finances...';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            input.value = transcript;
            // Optional: Auto-send
            // this.sendMessage(); 
            input.focus();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            isListening = false;
            btn.classList.remove('listening');
            input.placeholder = 'Error using voice input';
            setTimeout(() => {
                input.placeholder = 'Ask about your finances...';
            }, 2000);
        };
    },

    /**
     * Send a message
     */
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input?.value.trim();

        if (!message || this.isTyping) return;

        // Add user message
        this.messages.push({
            role: 'user',
            content: message,
            timestamp: Date.now()
        });

        input.value = '';
        this.renderMessages();
        this.scrollToBottom();

        // Show typing indicator
        this.isTyping = true;
        this.renderTypingIndicator();

        try {
            // Get AI response
            const response = await this.getAIResponse(message);

            // Remove typing indicator before starting the type effect
            this.removeTypingIndicator();

            // Create temporary message object for typing effect
            const aiMsg = {
                role: 'assistant',
                content: '',
                timestamp: Date.now()
            };
            this.messages.push(aiMsg);

            // Render the empty message container
            this.renderMessages();
            this.scrollToBottom();

            // Find the last message content element
            const messageElements = document.querySelectorAll('.chat-message.assistant .message-content');
            const targetElement = messageElements[messageElements.length - 1];

            if (targetElement) {
                await this.typeEffect(targetElement, response, aiMsg);
            } else {
                aiMsg.content = response;
                this.renderMessages();
            }

            this.saveHistory();
        } catch (error) {
            console.error('Chatbot error:', error);
            this.removeTypingIndicator();
            this.messages.push({
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: Date.now()
            });
            this.renderMessages();
        }

        this.isTyping = false;
        this.scrollToBottom();
    },

    /**
     * Simulate a typing effect for AI responses
     */
    async typeEffect(element, text, msgObject) {
        const words = text.split(' ');
        let currentText = '';

        for (let i = 0; i < words.length; i++) {
            currentText += words[i] + ' ';
            msgObject.content = currentText.trim();
            element.innerHTML = this.formatMessageContent(msgObject.content);
            this.scrollToBottom();
            // Faster for longer texts, slower for short bursts
            const delay = Math.min(60, Math.max(20, 1000 / words.length));
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    },

    /**
     * Remove typing indicator from the UI
     */
    removeTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) indicator.remove();
    },

    /**
     * Get AI response using backend API
     */
    async getAIResponse(userMessage) {
        // Get financial context
        const financialSummary = await Entries.getFinancialSummary();

        // Get profile and goal context
        const profileContext = typeof Profile !== 'undefined' ? Profile.getProfileContext() : {};
        const profile = profileContext.profile || {};
        const goal = profileContext.goal;
        const analysis = profileContext.analysis || {};

        // Build goal context string
        let goalContext = '';
        if (goal && profile.age) {
            goalContext = `
User's Savings Goal:
- Goal Name: ${goal.name}
- Target Amount: ₹${goal.targetAmount.toLocaleString('en-IN')}
- Target Age: ${goal.targetAge} (${goal.targetAge - profile.age} years left)
- Investment Type: ${goal.investmentType}
- Required Monthly Savings: ₹${analysis.requiredMonthly?.toLocaleString('en-IN') || 'N/A'}
- Current Monthly Savings: ₹${analysis.currentSavings?.toLocaleString('en-IN') || 0}
- Gap: ₹${analysis.gap?.toLocaleString('en-IN') || 0}/month
- Feasibility: ${analysis.feasible ? 'On Track' : 'Needs Adjustment'} (${analysis.feasibilityPercent || 0}%)`;
        }

        // Build conversation history for AI context (last 10 messages for memory)
        const conversationHistory = this.messages
            .slice(-10)
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');

        // Build context for AI
        // Build context for AI
        const systemContext = `You are WealthFlow AI, a helpful personal financial advisor assistant. You have access to the user's financial data and should provide personalized, realistic advice.

=== IMPORTANT RESTRICTIONS ===
1. SCOPE: You ONLY provide financial education and advice. Topics include: budgeting, saving, investing, expense tracking, financial planning, debt management, and related personal finance matters.
2. OFF-TOPIC: If the user asks about anything unrelated to finance (e.g., general knowledge, coding, entertainment, news, etc.), politely decline and remind them you're a financial advisor.
3. NO IMAGE ANALYSIS: If asked to read, analyze, or describe images, politely explain you cannot process images and can only assist with financial questions.
4. PROFESSIONALISM: Decline any requests containing profanity, inappropriate content, or offensive language. Respond politely but firmly.
5. CONVERSATION MEMORY: You have access to recent conversation history below. Use it to provide contextual and personalized responses.

=== USER PROFILE ===
- Name: ${profile.name || 'Not set'}
- Age: ${profile.age || 'Not set'}
${goalContext}

=== CURRENT FINANCIAL DATA ===
- Month: ${financialSummary.currentMonth.name} ${financialSummary.currentMonth.year}
- Total Income: ₹${financialSummary.currentMonth.income.toLocaleString('en-IN')}
- Total Expenses: ₹${financialSummary.currentMonth.expense.toLocaleString('en-IN')}
- Savings: ₹${financialSummary.currentMonth.savings.toLocaleString('en-IN')}
- Number of transactions: ${financialSummary.entriesCount}

Top Expense Categories:
${financialSummary.expenseCategories.slice(0, 5).map(c => `- ${c.name}: ₹${c.total.toLocaleString('en-IN')}`).join('\n')}

Income Sources:
${financialSummary.incomeSources.map(s => `- ${s.name}: ₹${s.total.toLocaleString('en-IN')}`).join('\n')}

Monthly Trend (last 6 months):
${financialSummary.monthlyTrend.map(t => `- ${t.month}: Income ₹${t.income.toLocaleString('en-IN')}, Expense ₹${t.expense.toLocaleString('en-IN')}`).join('\n')}

Fixed Recurring Entries:
${financialSummary.fixedEntries.map(e => `- ${e.costHead}: ${e.type === 'income' ? '+' : '-'}₹${e.amount.toLocaleString('en-IN')}`).join('\n')}

Recent Transactions:
${financialSummary.allCurrentEntries.slice(-5).map(e => `- ${e.date}: ${e.costHead} - ${e.type === 'income' ? '+' : '-'}₹${(e.amountINR || e.amount).toLocaleString('en-IN')}`).join('\n')}

=== RECENT CONVERSATION HISTORY ===
${conversationHistory || 'No previous messages.'}

=== RESPONSE GUIDELINES ===
- **BE HUMAN AND CONVERSATIONAL**: Respond like a friendly financial advisor, not a robot
- **MATCH RESPONSE LENGTH TO QUESTION**: 
  * Simple greetings ("hi", "hello") → Brief, warm greeting (1-2 sentences max)
  * Quick questions → Short, direct answers
  * Complex financial questions → More detailed but still focused responses
- **AVOID ESSAYS**: Never dump all financial data unprompted. Only share relevant info when asked
- Be concise and friendly, address the user by name if available
- Use Indian Rupee (₹) for amounts
- Only provide detailed analysis when specifically asked
- When discussing savings goals, be REALISTIC and HONEST
- Don't sugarcoat - if finances need work, say so kindly but clearly
- Remember details from the conversation history to provide continuity
- Use casual, friendly language - not formal or robotic`;


        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    system_context: systemContext,
                    message: userMessage
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `API error: ${response.status}`);
            }

            const data = await response.json();
            return data.response || 'I apologize, I could not generate a response. Please try again.';

        } catch (error) {
            console.error('AI API error:', error);
            return await this.getOfflineResponse(userMessage);
        }
    },

    /**
     * Provide offline responses when API is not available
     */
    async getOfflineResponse(userMessage) {
        const summary = await Entries.getFinancialSummary();
        const lowerMessage = userMessage.toLowerCase();

        // Simple pattern matching for common questions
        if (lowerMessage.includes('spend') || lowerMessage.includes('expense')) {
            const total = summary.currentMonth.expense;
            const topCat = summary.expenseCategories[0];
            return `**Your Spending Summary**\n\nThis month you've spent **${formatCurrency(total)}** total.\n\n${topCat ? `Your biggest expense category is **${topCat.name}** at ${formatCurrency(topCat.total)}.` : 'Start adding expenses to see your breakdown!'}\n\n*Note: AI features are offline. Configure your API key for personalized advice.*`;
        }

        if (lowerMessage.includes('income') || lowerMessage.includes('earn')) {
            return `**Your Income Summary**\n\nThis month your total income is **${formatCurrency(summary.currentMonth.income)}**.\n\n${summary.incomeSources.length > 0 ? `Income sources:\n${summary.incomeSources.map(s => `• ${s.name}: ${formatCurrency(s.total)}`).join('\n')}` : 'Add income entries to track your earnings!'}\n\n*Note: AI features are offline. Configure your API key for personalized advice.*`;
        }

        if (lowerMessage.includes('saving') || lowerMessage.includes('save')) {
            const savings = summary.currentMonth.savings;
            const savingsRate = summary.currentMonth.income > 0
                ? ((savings / summary.currentMonth.income) * 100).toFixed(0)
                : 0;

            return `**Your Savings**\n\nThis month: **${formatCurrency(savings)}**\nSavings rate: **${savingsRate}%**\n\n${savings > 0 ? 'Great job saving money!' : 'Try to increase your savings by reducing discretionary spending.'}\n\n*Note: AI features are offline. Configure your API key for personalized advice.*`;
        }

        if (lowerMessage.includes('category') || lowerMessage.includes('breakdown')) {
            const cats = summary.expenseCategories.slice(0, 5);
            if (cats.length === 0) {
                return 'No expense data yet this month. Add some expenses to see your category breakdown!';
            }
            return `**Expense Breakdown**\n\n${cats.map(c => `• ${c.name}: ${formatCurrency(c.total)}`).join('\n')}\n\n*Note: AI features are offline. Configure your API key for personalized advice.*`;
        }

        // Default response
        return `I can help you with:\n• **Spending summary** - "How much did I spend?"\n• **Income overview** - "What's my income?"\n• **Savings info** - "How much did I save?"\n• **Category breakdown** - "Show my expense categories"\n\n*Note: For personalized AI advice, please configure your API key in the app settings.*`;
    },

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        container.innerHTML = this.messages.map((msg, idx) => `
      <div class="chat-message ${msg.role}" data-index="${idx}">
        <div class="message-content">${this.formatMessageContent(msg.content)}</div>
      </div>
    `).join('');

        // Attach context menu events to each message
        this.attachContextMenuEvents();
    },

    /**
     * Attach context menu events to chat messages
     */
    attachContextMenuEvents() {
        const messages = document.querySelectorAll('.chat-message');
        let longPressTimer = null;

        messages.forEach(msg => {
            const idx = parseInt(msg.dataset.index);

            // Right-click for desktop
            msg.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY, idx);
            });

            // Long-press for mobile
            msg.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => {
                    const touch = e.touches[0];
                    this.showContextMenu(touch.clientX, touch.clientY, idx);
                }, 500);
            });

            msg.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });

            msg.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
        });
    },

    /**
     * Show context menu
     */
    showContextMenu(x, y, msgIndex) {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'chat-context-menu';
        menu.innerHTML = `
            <button class="context-menu-item" data-action="copy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
            </button>
            <button class="context-menu-item" data-action="share">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share
            </button>
            <button class="context-menu-item delete" data-action="delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete
            </button>
        `;

        // Position menu
        menu.style.cssText = `
            position: fixed;
            left: ${Math.min(x, window.innerWidth - 150)}px;
            top: ${Math.min(y, window.innerHeight - 150)}px;
            z-index: 1000;
        `;

        // Add click handlers
        menu.querySelectorAll('.context-menu-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.handleContextAction(action, msgIndex);
                this.hideContextMenu();
            });
        });

        document.body.appendChild(menu);
        this.activeContextMenu = menu;
    },

    /**
     * Hide context menu
     */
    hideContextMenu() {
        if (this.activeContextMenu) {
            this.activeContextMenu.remove();
            this.activeContextMenu = null;
        }
    },

    /**
     * Handle context menu action
     */
    async handleContextAction(action, msgIndex) {
        const msg = this.messages[msgIndex];
        if (!msg) return;

        switch (action) {
            case 'copy':
                try {
                    await navigator.clipboard.writeText(msg.content);
                    App.showToast('Message copied!', 'success');
                } catch (e) {
                    App.showToast('Failed to copy', 'error');
                }
                break;

            case 'share':
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: 'WealthFlow AI Chat',
                            text: msg.content
                        });
                    } catch (e) {
                        // User cancelled or error
                        if (e.name !== 'AbortError') {
                            App.showToast('Share failed', 'error');
                        }
                    }
                } else {
                    // Fallback: copy to clipboard
                    try {
                        await navigator.clipboard.writeText(msg.content);
                        App.showToast('Copied to clipboard (share not supported)', 'success');
                    } catch (e) {
                        App.showToast('Share not supported', 'error');
                    }
                }
                break;

            case 'delete':
                if (confirm('Delete this message?')) {
                    this.messages.splice(msgIndex, 1);
                    await this.saveHistory();
                    this.renderMessages();
                    App.showToast('Message deleted', 'success');
                }
                break;
        }
    },

    /**
     * Format message content (markdown to HTML)
     */
    formatMessageContent(content) {
        // Process line by line for better control
        let lines = content.split('\n');
        let result = [];
        let inTable = false;
        let tableRows = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Check if this is a table row (starts with |)
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                // Skip separator rows like |---|---|
                if (line.includes('---')) {
                    continue;
                }
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                // Parse table cells
                let cells = line.split('|').filter(c => c.trim() !== '');
                tableRows.push(cells.map(c => this.formatInline(c.trim())));
            } else {
                // If we were in a table, close it
                if (inTable) {
                    result.push(this.renderTable(tableRows));
                    inTable = false;
                    tableRows = [];
                }

                // Horizontal rule
                if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
                    result.push('<hr style="border: none; border-top: 1px solid var(--border-color); margin: 12px 0;">');
                    continue;
                }

                // Headers
                if (line.startsWith('### ')) {
                    result.push(`<div style="font-weight: 600; font-size: 1rem; margin: 12px 0 6px;">${this.formatInline(line.substring(4))}</div>`);
                    continue;
                }
                if (line.startsWith('## ')) {
                    result.push(`<div style="font-weight: 600; font-size: 1.1rem; margin: 12px 0 6px;">${this.formatInline(line.substring(3))}</div>`);
                    continue;
                }
                if (line.startsWith('# ')) {
                    result.push(`<div style="font-weight: 700; font-size: 1.2rem; margin: 12px 0 6px;">${this.formatInline(line.substring(2))}</div>`);
                    continue;
                }

                // Bullet points
                if (line.match(/^[-•*] /)) {
                    result.push(`<div style="padding-left: 16px; margin: 3px 0;">• ${this.formatInline(line.substring(2))}</div>`);
                    continue;
                }

                // Numbered lists
                let numMatch = line.match(/^(\d+)\. (.+)$/);
                if (numMatch) {
                    result.push(`<div style="padding-left: 16px; margin: 3px 0;">${numMatch[1]}. ${this.formatInline(numMatch[2])}</div>`);
                    continue;
                }

                // Regular line
                if (line.trim() === '') {
                    result.push('<br>');
                } else {
                    result.push(this.formatInline(line));
                }
            }
        }

        // Close any remaining table
        if (inTable) {
            result.push(this.renderTable(tableRows));
        }

        return result.join('');
    },

    /**
     * Format inline elements (bold, italic, code)
     */
    formatInline(text) {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code style="background: var(--bg-tertiary); padding: 1px 4px; border-radius: 3px; font-size: 0.9em;">$1</code>');
    },

    /**
     * Render a table from rows
     */
    renderTable(rows) {
        if (rows.length === 0) return '';
        let html = '<table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.9em;">';
        rows.forEach((row, idx) => {
            const tag = idx === 0 ? 'th' : 'td';
            const style = idx === 0
                ? 'style="text-align: left; padding: 6px 8px; border-bottom: 2px solid var(--border-color); font-weight: 600;"'
                : 'style="text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border-color);"';
            html += '<tr>' + row.map(cell => `<${tag} ${style}>${cell}</${tag}>`).join('') + '</tr>';
        });
        html += '</table>';
        return html;
    },

    /**
     * Render typing indicator
     */
    renderTypingIndicator() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        container.innerHTML += `
      <div class="chat-message assistant typing-indicator">
        <div class="message-content">
          <div class="typing-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;
        this.scrollToBottom();
    },

    /**
     * Scroll to bottom of chat
     */
    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    },

    /**
     * Clear chat history
     */
    async clearHistory() {
        this.messages = [];
        await Storage.remove(Storage.KEYS.CHAT_HISTORY);
        await this.loadHistory();
        await this.renderMessages();
    }
};
