/**
 * Coconut - Authentication Module
 * Manages user sessions, login, and registration
 * Uses server-side sessions (cookies) for security
 */

const Auth = {
    user: null,

    /**
     * Initialize auth state — check server session
     */
    async init() {
        try {
            const response = await fetch('/api/auth/session', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    this.user = data.user;
                }
            }
        } catch (e) {
            console.error('Session check failed:', e);
        }
    },

    /**
     * Register a new user
     */
    async register(username, password) {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            this.user = data.user;
            return { success: true };
        }
        return { success: false, error: data.error };
    },

    /**
     * Login user
     */
    async login(username, password) {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            this.user = data.user;
            return { success: true };
        }
        return { success: false, error: data.error };
    },

    /**
     * Logout
     */
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {
            console.error('Logout error:', e);
        }
        this.user = null;
        location.reload();
    },

    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return !!this.user;
    },
};
