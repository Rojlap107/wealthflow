/**
 * Personal Expense Tracker - Currency Conversion Module
 * Uses AI API for real-time currency conversion
 */

const Currency = {
    // Cache exchange rates with timestamp
    ratesCache: null,
    lastFetchTime: null,
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

    /**
     * Get API key from environment or config
     * The user will provide this
     */
    getApiConfig() {
        // This will be configured by the user
        return {
            apiKey: window.EXPENSE_TRACKER_CONFIG?.apiKey || '',
            apiEndpoint: window.EXPENSE_TRACKER_CONFIG?.apiEndpoint || ''
        };
    },

    /**
     * Convert amount from one currency to INR using AI API
     */
    async convertToINR(amount, fromCurrency) {
        // If already INR, return as-is
        if (fromCurrency === 'INR') {
            return amount;
        }

        const config = this.getApiConfig();

        // If no API configured, use fallback rates
        if (!config.apiKey || !config.apiEndpoint) {
            console.warn('AI API not configured, using fallback rates');
            return this.convertWithFallback(amount, fromCurrency);
        }

        try {
            // Check cache first
            if (this.isCacheValid()) {
                const rate = this.ratesCache[fromCurrency];
                if (rate) {
                    return amount * rate;
                }
            }

            // Fetch from AI API
            const response = await fetch(config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `What is the current exchange rate from ${fromCurrency} to INR? 
                     Please respond with ONLY a JSON object in this exact format:
                     {"rate": <number>, "currency": "${fromCurrency}"}
                     No other text, just the JSON.`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            // Parse AI response to extract rate
            const rate = this.parseExchangeRate(data, fromCurrency);

            if (rate) {
                // Update cache
                if (!this.ratesCache) this.ratesCache = {};
                this.ratesCache[fromCurrency] = rate;
                this.lastFetchTime = Date.now();

                // Save to localStorage
                Storage.set(Storage.KEYS.EXCHANGE_RATES, {
                    rates: this.ratesCache,
                    timestamp: this.lastFetchTime
                });

                return amount * rate;
            }

            throw new Error('Could not parse exchange rate from AI response');

        } catch (error) {
            console.error('Currency conversion error:', error);
            return this.convertWithFallback(amount, fromCurrency);
        }
    },

    /**
     * Parse exchange rate from AI response
     */
    parseExchangeRate(apiResponse, currency) {
        try {
            // Handle Gemini API response format
            const text = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[^}]+\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.rate;
            }

            // Try to find a number in the response
            const numberMatch = text.match(/(\d+\.?\d*)/);
            if (numberMatch) {
                return parseFloat(numberMatch[1]);
            }

            return null;
        } catch (e) {
            console.error('Error parsing exchange rate:', e);
            return null;
        }
    },

    /**
     * Check if cache is still valid
     */
    isCacheValid() {
        if (!this.ratesCache || !this.lastFetchTime) {
            // Try to load from localStorage
            const cached = Storage.get(Storage.KEYS.EXCHANGE_RATES);
            if (cached && cached.rates && cached.timestamp) {
                this.ratesCache = cached.rates;
                this.lastFetchTime = cached.timestamp;
            }
        }

        return this.ratesCache &&
            this.lastFetchTime &&
            (Date.now() - this.lastFetchTime) < this.CACHE_DURATION;
    },

    /**
     * Fallback conversion rates (approximate)
     * Used when AI API is not available
     */
    FALLBACK_RATES: {
        USD: 83.50,  // 1 USD = 83.50 INR
        EUR: 91.00,  // 1 EUR = 91.00 INR
        GBP: 106.00  // 1 GBP = 106.00 INR
    },

    /**
     * Convert using fallback rates
     */
    convertWithFallback(amount, fromCurrency) {
        const rate = this.FALLBACK_RATES[fromCurrency] || 1;
        return amount * rate;
    },

    /**
     * Get all available currencies
     */
    getAvailable() {
        return CURRENCIES;
    },

    /**
     * Get currency info by code
     */
    getByCode(code) {
        return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
    },

    /**
     * Format amount with currency symbol
     */
    format(amount, currencyCode = 'INR') {
        return formatCurrency(amount, currencyCode);
    },

    /**
     * Refresh exchange rates from AI API
     */
    async refreshRates() {
        const currencies = ['USD', 'EUR', 'GBP'];
        const config = this.getApiConfig();

        if (!config.apiKey || !config.apiEndpoint) {
            console.warn('AI API not configured');
            return false;
        }

        try {
            const response = await fetch(config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `What are the current exchange rates to INR for USD, EUR, and GBP?
                     Please respond with ONLY a JSON object in this exact format:
                     {"USD": <number>, "EUR": <number>, "GBP": <number>}
                     No other text, just the JSON.`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const jsonMatch = text.match(/\{[^}]+\}/);
            if (jsonMatch) {
                const rates = JSON.parse(jsonMatch[0]);
                this.ratesCache = rates;
                this.lastFetchTime = Date.now();

                Storage.set(Storage.KEYS.EXCHANGE_RATES, {
                    rates: this.ratesCache,
                    timestamp: this.lastFetchTime
                });

                return true;
            }

            return false;
        } catch (error) {
            console.error('Error refreshing rates:', error);
            return false;
        }
    }
};
