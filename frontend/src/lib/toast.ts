type ToastType = 'success' | 'error' | 'loading';

const STYLE: Record<ToastType, { icon: string; color: string }> = {
  success: { icon: '✓', color: '#10b981' },
  error: { icon: '✕', color: '#ef4444' },
  loading: { icon: '⟳', color: '#6b7280' },
};

class ToastManager {
  private container: HTMLElement | null = null;
  private toasts: Map<string, HTMLElement> = new Map();

  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  private show(message: string, type: ToastType) {
    const container = this.ensureContainer();
    const id = `toast-${Date.now()}`;
    const { icon: iconText, color } = STYLE[type];

    if (this.toasts.has(id)) {
      this.remove(id);
    }

    const toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = `
      background: white;
      color: #1f2937;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 300px;
      max-width: 500px;
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      border-left: 4px solid ${color};
    `;

    const icon = document.createElement('span');
    icon.style.cssText = `
      font-size: 20px;
      color: ${color};
      font-weight: bold;
      ${type === 'loading' ? 'animation: spin 1s linear infinite;' : ''}
    `;
    icon.textContent = iconText;

    const text = document.createElement('span');
    text.style.cssText = 'flex: 1; font-size: 14px;';
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #9ca3af;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => this.remove(id);

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeBtn);

    container.appendChild(toast);
    this.toasts.set(id, toast);

    if (type !== 'loading') {
      setTimeout(() => this.remove(id), 3000);
    }

    return id;
  }

  private remove(id: string) {
    const toast = this.toasts.get(id);
    if (toast) {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        toast.remove();
        this.toasts.delete(id);

        if (this.toasts.size === 0 && this.container) {
          this.container.remove();
          this.container = null;
        }
      }, 300);
    }
  }

  success(message: string) {
    return this.show(message, 'success');
  }

  error(message: string) {
    return this.show(message, 'error');
  }

  loading(message: string) {
    return this.show(message, 'loading');
  }

  dismiss(id: string) {
    this.remove(id);
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
document.head.appendChild(style);

export const toast = new ToastManager();

