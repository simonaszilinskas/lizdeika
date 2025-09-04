/**
 * Authentication and user action functions for the agent dashboard
 * Extracted from agent-dashboard.js for better modularity
 */

/**
 * Logout function for agent dashboard
 * Clears all authentication data and redirects to login
 */
export async function logoutAgent() {
    if (confirm('Ar tikrai norite atsijungti?')) {
        try {
            // Call backend logout endpoint to invalidate refresh token
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                await fetch('http://localhost:3002/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ refreshToken })
                });
            }
        } catch (error) {
            console.error('Logout API call failed:', error);
        }
        
        // Clear all stored authentication data
        localStorage.removeItem('agent_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('agentUser'); // Clear old system data too
        
        // Clear any agent status data
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('agentStatus_')) {
                localStorage.removeItem(key);
            }
        });
        
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

/**
 * Opens the user management interface in settings
 */
export function openUserManagement() {
    window.location.href = 'settings.html#users';
}