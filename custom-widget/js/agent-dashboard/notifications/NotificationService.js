export class NotificationService {
    constructor({ documentRef = typeof document !== 'undefined' ? document : null } = {}) {
        this.document = documentRef;
        this.dismissTimeout = null;
    }

    notifyReassignment(data = {}, agentId) {
        if (!data || !Array.isArray(data.reassignments) || !agentId) {
            return;
        }

        const { reassignments, reason } = data;
        const myReassignments = reassignments.filter((item) => item.toAgent === agentId);

        let message = '';

        if (reason === 'agent_online' && myReassignments.length > 0) {
            message = `You received ${myReassignments.length} tickets (agent back online + redistribution)`;
        } else if (reason === 'agent_joined' && myReassignments.length > 0) {
            message = `You received ${myReassignments.length} tickets from the queue`;
        }

        if (message) {
            try {
                this.show(message, 'info');
            } catch (displayError) {
                console.error('Notification display failed:', displayError);
            }
        }
    }

    show(message, type = 'info') {
        if (!this.document || !this.document.body) {
            return;
        }

        const iconMap = {
            info: 'fa-info-circle text-blue-600',
            warning: 'fa-exclamation-triangle text-yellow-600',
            success: 'fa-check-circle text-green-600',
            error: 'fa-times-circle text-red-600'
        };

        const bgMap = {
            info: 'bg-blue-50 border-blue-200 text-blue-800',
            warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
            success: 'bg-green-50 border-green-200 text-green-800',
            error: 'bg-red-50 border-red-200 text-red-800'
        };

        let notification = this.document.getElementById('agent-notification');
        if (!notification) {
            notification = this.document.createElement('div');
            notification.id = 'agent-notification';
            notification.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm';
            this.document.body.appendChild(notification);
        }

        const variant = bgMap[type] || bgMap.info;
        const iconClass = iconMap[type] || iconMap.info;

        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm border ${variant}`;
        notification.innerHTML = `
            <div class="flex items-start gap-3">
                <i class="fas ${iconClass} mt-0.5"></i>
                <div class="flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <button type="button" data-notification-dismiss class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-sm"></i>
                </button>
            </div>
        `;

        const dismissButton = notification.querySelector('[data-notification-dismiss]');
        if (dismissButton) {
            dismissButton.addEventListener('click', () => {
                try {
                    this.remove(notification);
                } catch (removeError) {
                    console.error('Notification removal failed:', removeError);
                }
            }, { once: true });
        }

        if (this.dismissTimeout) {
            const timerContext = (this.document && this.document.defaultView) || globalThis;
            timerContext.clearTimeout(this.dismissTimeout);
        }

        const timerContext = (this.document && this.document.defaultView) || globalThis;
        this.dismissTimeout = timerContext.setTimeout(() => {
            try {
                this.remove(notification);
            } catch (removeError) {
                console.error('Notification auto-dismiss failed:', removeError);
            }
        }, 5000);
    }

    remove(notificationElement) {
        if (notificationElement && notificationElement.parentElement) {
            notificationElement.parentElement.removeChild(notificationElement);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NotificationService };
}
