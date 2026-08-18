/**
 * Dynamic Client-Side Toast Notification Engine (TypeScript)
 * Displays beautiful HSL styled non-blocking toast popups
 */

export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Hiển thị thông báo Toast nhanh trên màn hình
 *
 * @param {string} message - Nội dung thông báo
 * @param {ToastType} type - Phân loại hiển thị (info, success, warning, error)
 */
export function showToast(message: string, type: ToastType = 'info'): void {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    if (type === 'warning') icon = 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="fas ${icon} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger layout reflow to enable animations
    toast.offsetHeight;
    toast.classList.add('show');
    
    // Auto-dismiss and cleanup DOM
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 350);
    }, 4000);
}
