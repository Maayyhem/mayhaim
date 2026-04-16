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
     SVG ICON HELPER
     Returns an SVG string for the given icon name.
     Usage: icon('home')  or  icon('home', 24)
     ============================================================ */
  var ICON_PATHS = {
    home:       '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    zap:        '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    chart:      '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    calendar:   '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    user:       '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    gamepad:    '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/>',
    training:   '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    trending:   '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>',
    trophy:     '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    medal:      '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>',
    bot:        '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    crosshair:  '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
    brain:      '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>',
    video:      '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    book:       '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    flame:      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    users:      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    map:        '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    wrench:     '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    message:    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    teacher:    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    film:       '<rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/>',
    clipboard:  '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    feedback:   '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    admin:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search:     '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    bell:       '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    play:       '<polygon points="5 3 19 12 5 21 5 3"/>',
    target:     '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'
  };

  function icon(name, size) {
    size = size || 20;
    var p = ICON_PATHS[name];
    if (!p) return '';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }
  window.icon = icon;

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
    const version = window.MAYHAIM_VERSION || '2.0.0';
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

  /* ============================================================
     AUTO-INIT: replace data-icon placeholders with SVG icons
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-icon]').forEach(function (el) {
      var name = el.dataset.icon;
      if (icon(name)) el.innerHTML = icon(name);
    });
  });
})();
