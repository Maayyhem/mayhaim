// ui.js — Global UI helpers for MayhAim.
// Exposes on `window`:
//   showToast(message, opts)      → toast notification
//   showModal(opts)               → generic modal (returns { close })
//   showConfirm(message, opts)    → confirm dialog (returns Promise<boolean>)
//   copyToClipboard(text)         → helper, toasts on success
// Plus registers a global error boundary so uncaught crashes surface
// as toasts instead of silently breaking the app.
//
// Loaded early (before game3d.js / coaching.js) so those scripts can
// call showToast() at any time. Keep dependencies to ZERO — pure DOM.

(function () {
  'use strict';

  /* ============================================================
     TOAST
     ============================================================ */
  const TOAST_ICONS = {
    success: '✓',
    error:   '✕',
    warn:    '⚠',
    info:    'ℹ',
    lock:    '🔒',
  };
  const DEFAULT_DURATION = {
    success: 2800,
    error:   4500,
    warn:    3500,
    info:    2800,
    lock:    2800,
  };

  function ensureToastContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  /**
   * showToast(message, opts?)
   *   opts.type:     'info' | 'success' | 'error' | 'warn' | 'lock'   (default 'info')
   *   opts.duration: ms before auto-dismiss. 0 = sticky. (default per type)
   *   opts.icon:     override icon char
   *   opts.closable: show ✕ close button (default true if sticky, false otherwise)
   * Returns the toast DOM element (so caller can force-dismiss via .remove()).
   */
  function showToast(message, opts = {}) {
    if (!document.body) {
      // DOM not ready — defer until it is.
      document.addEventListener('DOMContentLoaded', () => showToast(message, opts), { once: true });
      return null;
    }
    const type = opts.type || 'info';
    const duration = opts.duration != null ? opts.duration : DEFAULT_DURATION[type];
    const container = ensureToastContainer();

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = opts.icon != null ? opts.icon : TOAST_ICONS[type] || '';
    el.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = message;
    el.appendChild(body);

    const showClose = opts.closable != null ? opts.closable : duration === 0;
    if (showClose) {
      const btn = document.createElement('button');
      btn.className = 'toast-close';
      btn.setAttribute('aria-label', 'Fermer');
      btn.textContent = '×';
      btn.addEventListener('click', () => dismiss(el));
      el.appendChild(btn);
    }

    container.appendChild(el);

    if (duration > 0) {
      setTimeout(() => dismiss(el), duration);
    }
    return el;
  }
  function dismiss(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  }

  // Shorthand helpers
  showToast.success = (m, o) => showToast(m, { ...o, type: 'success' });
  showToast.error   = (m, o) => showToast(m, { ...o, type: 'error'   });
  showToast.warn    = (m, o) => showToast(m, { ...o, type: 'warn'    });
  showToast.info    = (m, o) => showToast(m, { ...o, type: 'info'    });
  showToast.lock    = (m, o) => showToast(m, { ...o, type: 'lock'    });

  /* ============================================================
     MODAL
     ============================================================ */
  /**
   * showModal({ title, content, footer, size, onClose, closeOnBackdrop })
   *   content: string (HTML) | HTMLElement | () => HTMLElement
   *   footer:  string (HTML) | HTMLElement | null
   *   size:    'sm' | 'md' | 'lg'  (default 'md' = 520px)
   *   onClose: callback when modal closes
   *   closeOnBackdrop: boolean (default true)
   * Returns { close, panel, backdrop }.
   */
  function showModal(opts = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const panel = document.createElement('div');
    panel.className = 'modal-panel';
    if (opts.size === 'sm') panel.style.maxWidth = '360px';
    if (opts.size === 'lg') panel.style.maxWidth = '760px';

    // Header
    if (opts.title != null) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      const h = document.createElement('h3');
      h.className = 'modal-title';
      h.textContent = opts.title;
      header.appendChild(h);
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close';
      closeBtn.setAttribute('aria-label', 'Fermer');
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => close());
      header.appendChild(closeBtn);
      panel.appendChild(header);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    const content = typeof opts.content === 'function' ? opts.content() : opts.content;
    if (typeof content === 'string') body.innerHTML = content;
    else if (content instanceof HTMLElement) body.appendChild(content);
    panel.appendChild(body);

    // Footer
    if (opts.footer != null) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      if (typeof opts.footer === 'string') footer.innerHTML = opts.footer;
      else if (opts.footer instanceof HTMLElement) footer.appendChild(opts.footer);
      panel.appendChild(footer);
    }

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    // Trigger open transition next frame
    requestAnimationFrame(() => backdrop.classList.add('open'));

    const closeOnBackdrop = opts.closeOnBackdrop !== false;
    if (closeOnBackdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
      });
    }
    const escHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);

    function close() {
      backdrop.classList.remove('open');
      document.removeEventListener('keydown', escHandler);
      setTimeout(() => {
        if (backdrop.parentNode) backdrop.remove();
        if (typeof opts.onClose === 'function') opts.onClose();
      }, 200);
    }

    return { close, panel, backdrop, body };
  }

  /* ============================================================
     CONFIRM — replaces ugly window.confirm()
     ============================================================ */
  function showConfirm(message, opts = {}) {
    return new Promise((resolve) => {
      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.gap = '12px';

      const cancel = document.createElement('button');
      cancel.className = 'btn-ghost';
      cancel.textContent = opts.cancelLabel || 'Annuler';

      const confirm = document.createElement('button');
      confirm.className = 'btn-primary';
      confirm.textContent = opts.confirmLabel || 'Confirmer';
      if (opts.destructive) confirm.style.background = '#ff6b6b';

      footer.appendChild(cancel);
      footer.appendChild(confirm);

      const m = showModal({
        title: opts.title || 'Confirmation',
        content: `<p style="font-size:0.95rem;line-height:1.55;color:var(--txt);margin:0;">${escapeHtml(message)}</p>`,
        footer,
        size: 'sm',
        onClose: () => resolve(false),
      });
      cancel.addEventListener('click', () => { resolve(false); m.close(); });
      confirm.addEventListener('click', () => { resolve(true); m.close(); });
    });
  }

  /* ============================================================
     CLIPBOARD HELPER
     ============================================================ */
  async function copyToClipboard(text, successMsg = 'Copié !') {
    try {
      await navigator.clipboard.writeText(text);
      showToast.success(successMsg);
      return true;
    } catch {
      // Fallback for older contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast.success(successMsg);
        return true;
      } catch (e) {
        showToast.error('Copie impossible');
        return false;
      } finally {
        ta.remove();
      }
    }
  }

  /* ============================================================
     GLOBAL ERROR BOUNDARY
     Catches uncaught errors and unhandled promise rejections.
     Shows a discreet toast so the user knows something went wrong,
     without crashing the whole app.
     ============================================================ */
  let _errorFloodGate = 0;
  function handleGlobalError(reason) {
    // Rate-limit: max 1 error toast per 3s
    const now = Date.now();
    if (now - _errorFloodGate < 3000) return;
    _errorFloodGate = now;

    const msg = reason?.message || String(reason || 'Erreur inconnue');
    // Always log full details to console for devs
    console.error('[MayhAim error]', reason);
    // Show user-facing toast only for "real" errors (skip noisy irrelevant ones)
    if (/ResizeObserver|Non-Error promise rejection captured|Script error\.?$/i.test(msg)) return;
    showToast.error(`Erreur : ${msg.slice(0, 140)}`, { duration: 5000 });
  }
  window.addEventListener('error', (e) => handleGlobalError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => handleGlobalError(e.reason));

  /* ============================================================
     UTILITIES
     ============================================================ */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============================================================
     ABOUT MODAL — version + changelog
     ============================================================ */
  // Mini-markdown → HTML (headings, bold, italic, lists, links). Safe: escapes first.
  function mdToHtml(md) {
    if (!md) return '';
    let html = escapeHtml(md);
    // Headings
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // Bold + italic + inline code
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Lists
    html = html.replace(/(^|\n)((?:- .+(?:\n|$))+)/g, (_, pre, block) => {
      const items = block.trim().split(/\n/).map(l => '<li>' + l.replace(/^- /, '') + '</li>').join('');
      return pre + '<ul>' + items + '</ul>';
    });
    // Paragraphs
    html = html.split(/\n{2,}/).map(p => {
      if (/^<(h[1-6]|ul|ol|pre|blockquote)/i.test(p.trim())) return p;
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
    return html;
  }

  function showAbout() {
    const version = window.MAYHAIM_VERSION || '1.4.2';
    const isElectron = !!window.MAYHAIM_IS_ELECTRON;
    const changelog = window.MAYHAIM_CHANGELOG;

    const content = document.createElement('div');
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <img src="build/icon.png" alt="" style="width:64px;height:64px;border-radius:14px;box-shadow:var(--sh-md);">
        <div>
          <div style="font-size:1.5rem;font-weight:900;letter-spacing:1px;line-height:1;">
            MAYH<span style="color:var(--accent);">AIM</span>
          </div>
          <div style="font-size:0.78rem;color:var(--dim);margin-top:4px;letter-spacing:1.5px;text-transform:uppercase;">
            Aim Trainer &middot; Coaching Hub
          </div>
          <div style="font-size:0.8rem;color:var(--dim);margin-top:8px;">
            Version <strong style="color:var(--txt);">${escapeHtml(version)}</strong> ${isElectron ? '&middot; Desktop' : '&middot; Web'}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
        <a href="https://mayhaim.vercel.app" target="_blank" class="btn-ghost" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <span>🌐</span> Site web
        </a>
      </div>

      ${changelog ? `
        <div style="border-top:1px solid var(--border);padding-top:16px;">
          <div style="font-size:0.7rem;color:var(--dim);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Changelog</div>
          <div class="about-changelog" style="font-size:0.85rem;color:var(--txt);line-height:1.6;max-height:360px;overflow-y:auto;padding-right:8px;">
            ${mdToHtml(changelog)}
          </div>
        </div>
      ` : ''}

      <div style="border-top:1px solid var(--border);margin-top:18px;padding-top:14px;font-size:0.72rem;color:var(--dim);line-height:1.6;text-align:center;">
        © 2026 MayhAim. Designed for aim lovers.<br>
        Not affiliated with Riot Games or Valorant.
      </div>
    `;

    // Inject scoped styles for the changelog markdown render (once)
    if (!document.getElementById('about-changelog-styles')) {
      const s = document.createElement('style');
      s.id = 'about-changelog-styles';
      s.textContent = `
        .about-changelog h2 { font-size:1rem; margin:14px 0 6px; color:var(--accent); font-weight:800; }
        .about-changelog h3 { font-size:0.9rem; margin:10px 0 4px; color:var(--txt); font-weight:700; }
        .about-changelog h4 { font-size:0.8rem; margin:8px 0 4px; color:var(--dim); font-weight:700; text-transform:uppercase; letter-spacing:1px; }
        .about-changelog ul { padding-left: 20px; margin: 4px 0 10px; }
        .about-changelog li { margin-bottom: 3px; }
        .about-changelog p  { margin-bottom: 8px; }
        .about-changelog strong { color: var(--txt); }
        .about-changelog em { color: var(--gold); font-style: italic; }
        .about-changelog code { background: var(--card-h); padding: 1px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85em; }
      `;
      document.head.appendChild(s);
    }

    return showModal({
      title: 'À propos de MayhAim',
      content,
      size: 'md',
    });
  }

  /* ============================================================
     EXPORTS
     ============================================================ */
  window.showToast = showToast;
  window.showModal = showModal;
  window.showConfirm = showConfirm;
  window.showAbout = showAbout;
  window.copyToClipboard = copyToClipboard;
  window.escapeHtml = escapeHtml;
  window.mdToHtml = mdToHtml;
})();
