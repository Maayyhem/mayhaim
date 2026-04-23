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
    target:     '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'alert-octagon': '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    sword: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>',
    'refresh-cw': '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    dumbbell: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    key: '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    gem: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    'graduation-cap': '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
    'mouse-pointer': '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/>',
    palette: '<circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    'volume-2': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    'heart-pulse': '<path d="M19.5 12.572l-7.5 7.428l-7.5-7.428A5 5 0 0 1 12 6.006a5 5 0 0 1 7.5 6.572"/><path d="M3 12h4l2-4 4 8 2-4h4"/>',
    lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'cloud-sun': '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    'circle-dot': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
    square: '<rect x="3" y="3" width="18" height="18" rx="2"/>'
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
    success: icon('check-circle', 18),
    error:   icon('x', 18),
    warn:    icon('alert-triangle', 18),
    info:    icon('info', 18),
    lock:    icon('lock', 18),
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
    icon.innerHTML = opts.icon != null ? opts.icon : TOAST_ICONS[type] || '';
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

  // san() — XSS sanitizer alias used by coaching.js / coachplayer.js.
  // Historically these files had their own copy; centralising here avoids drift.
  // Uses &#x27; (numeric hex) for the apostrophe to match the pre-2.0.5 output
  // exactly, in case any cached render relies on byte equality.
  function san(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /* ============================================================
     LOG ERR — centralized network/async error logger
     Call sites do:
         fetch(...).catch(e => logErr('load-profile', e));
     instead of swallowing with `catch {}`. In dev this prints a
     structured line to the console; the global error boundary still
     handles uncaught throws separately.
     Pass opts.toast = true to also surface a toast (default: silent —
     the caller usually shows a contextual empty state).
     ============================================================ */
  function logErr(context, err, opts = {}) {
    const msg = err && err.message ? err.message : String(err || 'unknown');
    // Structured console entry — groups in DevTools under the context tag.
    if (console && console.warn) {
      console.warn('[mayhaim:' + context + ']', msg, err);
    }
    if (opts.toast) {
      showToast.error(opts.toastMessage || 'Erreur : ' + msg.slice(0, 140));
    }
  }

  /* ============================================================
     NETWORK STATUS BANNER
     A non-intrusive top banner when the browser reports offline.
     Auto-clears once the connection comes back. Works in Electron too
     (navigator.onLine is driven by the OS network stack).
     ============================================================ */
  function ensureNetBanner() {
    let b = document.getElementById('mayhaim-net-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'mayhaim-net-banner';
      b.setAttribute('role', 'status');
      b.setAttribute('aria-live', 'polite');
      b.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0',
        'z-index:99999',
        'background:#b63a3a', 'color:#fff',
        'font:600 0.82rem/1 system-ui,sans-serif',
        'text-align:center',
        'padding:8px 12px',
        'letter-spacing:0.4px',
        'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
        'transform:translateY(-100%)',
        'transition:transform 180ms ease',
      ].join(';');
      b.textContent = '⚠  Connexion perdue — les fonctionnalités en ligne sont indisponibles';
      document.body && document.body.appendChild(b);
    }
    return b;
  }
  function setNetStatus(online) {
    // Defer until body exists (script may load before DOMContentLoaded)
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => setNetStatus(online), { once: true });
      return;
    }
    const b = ensureNetBanner();
    if (online) {
      b.style.transform = 'translateY(-100%)';
    } else {
      b.style.transform = 'translateY(0)';
    }
  }
  window.addEventListener('online',  () => { setNetStatus(true);  showToast.success('Connexion rétablie'); });
  window.addEventListener('offline', () => { setNetStatus(false); });
  // Initial state on load (in case we booted offline)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    document.addEventListener('DOMContentLoaded', () => setNetStatus(false), { once: true });
  }

  /* ============================================================
     BACKGROUND FETCH + OFFLINE QUEUE
     Fire-and-forget POST helper. Si l'utilisateur est offline ou si
     le serveur renvoie 5xx, l'appel est mis en file (localStorage) et
     rejoué au retour du réseau. Les GET ne sont jamais queues (les
     réessais naturels suffisent). Limite 100 entrées (FIFO — on drop
     les plus anciennes), TTL 7 jours, 4xx = drop immédiat (pas de
     retry sur un token expiré).
     NB: ne marche qu'avec des bodies JSON-sérialisables (string/null).
     ============================================================ */
  var BG_QUEUE_KEY = 'mayhaim_bg_queue';
  var BG_QUEUE_MAX = 100;
  var BG_QUEUE_TTL_MS = 7 * 24 * 3600 * 1000;

  function bgQueueRead() {
    try {
      var raw = localStorage.getItem(BG_QUEUE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function bgQueueWrite(list) {
    try {
      // Garde les N dernières si on dépasse le cap (on sacrifie les plus vieilles)
      var trimmed = list.length > BG_QUEUE_MAX ? list.slice(-BG_QUEUE_MAX) : list;
      localStorage.setItem(BG_QUEUE_KEY, JSON.stringify(trimmed));
    } catch {}
  }
  function bgQueuePush(entry) {
    var list = bgQueueRead();
    list.push(entry);
    bgQueueWrite(list);
  }

  function bgFetch(url, opts) {
    opts = opts || {};
    var method = (opts.method || 'GET').toUpperCase();
    var shouldQueue = method !== 'GET';

    // Offline : on queue direct et on retourne un objet "ok: false, queued"
    if (shouldQueue && typeof navigator !== 'undefined' && navigator.onLine === false) {
      bgQueuePush({ url: url, opts: opts, method: method, ts: Date.now() });
      return Promise.resolve({ ok: false, queued: true, offline: true });
    }

    return fetch(url, opts).then(function (r) {
      // 5xx = problème serveur, on queue pour retry
      if (!r.ok && shouldQueue && r.status >= 500) {
        bgQueuePush({ url: url, opts: opts, method: method, ts: Date.now() });
      }
      return r;
    }).catch(function (e) {
      if (shouldQueue) {
        bgQueuePush({ url: url, opts: opts, method: method, ts: Date.now() });
      }
      logErr('bgFetch:' + method + ' ' + url, e);
      return { ok: false, queued: shouldQueue, error: e };
    });
  }

  async function flushBgQueue() {
    var list = bgQueueRead();
    if (list.length === 0) return { flushed: 0, requeued: 0, dropped: 0 };
    // Drop les entrées > TTL avant de retry
    var now = Date.now();
    var fresh = list.filter(function (e) { return (now - (e.ts || 0)) < BG_QUEUE_TTL_MS; });
    var droppedStale = list.length - fresh.length;
    // On vide la file immédiatement — les échecs seront remis à la fin
    bgQueueWrite([]);

    var ok = 0;
    var requeue = [];
    for (var i = 0; i < fresh.length; i++) {
      var e = fresh[i];
      try {
        var r = await fetch(e.url, e.opts);
        if (r.ok) { ok++; }
        else if (r.status >= 500) { requeue.push(e); }
        // 4xx → on drop (token expiré, payload rejeté, etc.)
      } catch (err) {
        requeue.push(e);
      }
    }
    if (requeue.length) bgQueueWrite(requeue);
    if (ok > 0 || droppedStale > 0) {
      console.info('[mayhaim:bg-flush]', { flushed: ok, requeued: requeue.length, dropped_stale: droppedStale });
    }
    return { flushed: ok, requeued: requeue.length, dropped: droppedStale };
  }

  // Flush automatique au retour online
  window.addEventListener('online', function () {
    // Léger delay pour laisser le réseau se stabiliser
    setTimeout(flushBgQueue, 500);
  });
  // Flush aussi au boot (si on a démarré online avec une queue pending)
  if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
    setTimeout(flushBgQueue, 2000);
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
    // Source de vérité : (1) Electron preload → package.json, (2) meta app-version (web),
    // (3) fallback hardcodé. Bump la meta dans index.html/profile.html à chaque release web.
    const metaVer = document.querySelector('meta[name="app-version"]')?.content;
    const version = window.MAYHAIM_VERSION || metaVer || '2.2.4';
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

      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <a href="https://mayhaim.vercel.app" target="_blank" class="btn-ghost" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <span>🌐</span> Site web
        </a>
        ${isElectron && window.MAYHAIM_UPDATER ? `
          <button id="about-check-updates" class="btn-ghost" style="display:inline-flex;align-items:center;gap:6px;">
            <span>⬇</span> Vérifier les mises à jour
          </button>
          <span id="about-updater-status" style="font-size:0.78rem;color:var(--dim);"></span>
        ` : ''}
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

    // Updater subscription lives for the lifetime of the modal; it's cleared
    // by the onClose hook below regardless of how the modal is dismissed
    // (× button, ESC, backdrop click, or explicit .close()).
    let unsubscribeUpdater = null;

    const modalInstance = showModal({
      title: 'À propos de MayhAim',
      content,
      size: 'md',
      onClose: () => { try { unsubscribeUpdater && unsubscribeUpdater(); } catch {} },
    });

    if (isElectron && window.MAYHAIM_UPDATER) {
      const btn = content.querySelector('#about-check-updates');
      const status = content.querySelector('#about-updater-status');
      const setStatus = (txt) => { if (status) status.textContent = txt || ''; };

      unsubscribeUpdater = window.MAYHAIM_UPDATER.onEvent(({ event, payload }) => {
        switch (event) {
          case 'checking': setStatus('Vérification…'); break;
          case 'available': setStatus(`v${payload.version} disponible, téléchargement…`); break;
          case 'not-available': setStatus(`À jour (v${payload.version || version})`); break;
          case 'progress': setStatus(`Téléchargement ${Math.round(payload.percent)}%`); break;
          case 'downloaded': setStatus(`v${payload.version} prête — redémarrer pour installer`); break;
          case 'error': setStatus(`Erreur : ${payload.message || 'inconnue'}`); break;
        }
      });

      btn && btn.addEventListener('click', async () => {
        btn.disabled = true;
        setStatus('Vérification…');
        try {
          const r = await window.MAYHAIM_UPDATER.check();
          if (!r.ok) setStatus(`Erreur : ${r.error || 'inconnue'}`);
          else if (r.latestVersion && r.latestVersion !== r.currentVersion) {
            // event handlers above will take it from here (update-available)
          } else {
            setStatus(`À jour (v${r.currentVersion})`);
          }
        } catch (e) {
          setStatus(`Erreur : ${e && e.message || 'inconnue'}`);
        } finally {
          setTimeout(() => { btn.disabled = false; }, 1500);
        }
      });
    }

    return modalInstance;
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
  window.san = san;
  window.logErr = logErr;
  window.mdToHtml = mdToHtml;
  window.bgFetch = bgFetch;
  window.flushBgQueue = flushBgQueue;

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
