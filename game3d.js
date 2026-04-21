// ===================== MayhAim - Aim Trainer & Viscose Benchmark =====================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Sensitivity system: convert any game sens + DPI to cm/360, then to radians/pixel
// cm/360 = 2.54 * 360 / (gameSens * yawRate * DPI)
// yawRate per game:
const YAW_RATES = { valorant:0.07, cs2:0.022, overwatch:0.0066, apex:0.022, fortnite:0.5555 };

function getDPI() { return parseFloat($('#opt-dpi')?.value) || 800; }

function gameSensToCm360(mode, val) {
  if (mode === 'cm360') return val;
  const yaw = YAW_RATES[mode];
  return 2.54 * 360 / (val * yaw * getDPI());
}
function cm360ToGameSens(mode, cm360) {
  if (mode === 'cm360') return cm360;
  const yaw = YAW_RATES[mode];
  return 2.54 * 360 / (cm360 * yaw * getDPI());
}

const SENS_DEFAULTS = { cm360:{step:0.5,def:34}, valorant:{step:0.01,def:0.48}, cs2:{step:0.01,def:1.53}, overwatch:{step:0.1,def:5.09}, apex:{step:0.01,def:1.53}, fortnite:{step:0.1,def:6} };

function cm360ToRad(cm360) { return (2 * Math.PI * 2.54) / (cm360 * getDPI()); }

const DIFF = {
  easy:   { tR:[0.5,0.7], sp:[4,3], spd:1.2, gR:0.55, pR:[0.28,0.38], maxT:4, spawnRate:1.2, switchInt:2.5 },
  medium: { tR:[0.35,0.5], sp:[5,3.5], spd:2.5, gR:0.42, pR:[0.18,0.28], maxT:5, spawnRate:0.8, switchInt:1.8 },
  hard:   { tR:[0.23,0.33], sp:[7,5], spd:3.8, gR:0.33, pR:[0.13,0.21], maxT:6, spawnRate:0.55, switchInt:1.3 },
};

// ============================================================
// VISCOSE BENCHMARK - Medium + Hard tiers
// Medium: 8 thresholds, Hard: 6 thresholds per scenario
// ============================================================
const RANK_COLORS = ['#7c8389','#b97450','#c0c0c0','#e8c56d','#59c5c7','#d882f5','#2dbe73','#ff4655'];

// th = Medium (8), thH = Hard (6), thE = Easier (8)
const SCENARIOS = {
  // ═══ CONTROL TRACKING - Arm ═══
  // Seuils recalibrés : précision × 10 (500=50%, 900=90%)
  whisphereraw:   { cat:'control_tracking', sub:'arm', type:'track', label:'WhisphereRawControl', labelH:'WhisphereRawControl 30% Small', labelE:'WhisphereRawControl Larger',
    th:[500,600,680,750,800,840,870,900], thH:[700,748,792,828,858,888], thE:[420,525,615,695,755,808,848,875] },
  whisphere:      { cat:'control_tracking', sub:'arm', type:'track', label:'Whisphere', labelH:'Whisphere Small & Slow', labelE:'Whisphere 80%',
    th:[480,590,670,740,795,840,870,900], thH:[718,762,806,836,864,892], thE:[405,510,600,680,750,808,848,875] },
  smoothbot:      { cat:'control_tracking', sub:'arm', type:'track', label:'SmoothBot Invincible Goated', labelH:'SmoothBot Invincible Goated Smaller', labelE:'SmoothBot Goated 75%',
    th:[490,592,672,742,792,836,870,900], thH:[698,745,788,822,852,882], thE:[415,518,608,688,755,812,852,882] },
  // ═══ CONTROL TRACKING - Wrist ═══
  leaptrack:      { cat:'control_tracking', sub:'wrist', type:'track', label:'Leaptrack Goated', labelH:'Leaptrack Goated 80%', labelE:'Leaptrack Goated 60% Larger',
    th:[450,558,638,710,768,818,852,878], thH:[678,728,770,806,838,870], thE:[375,485,578,658,728,788,838,868] },
  ctrlsphere_aim: { cat:'control_tracking', sub:'wrist', type:'track', label:'Controlsphere rAim', labelH:'Controlsphere rAim', labelE:'Controlsphere rAim Easy 90%',
    th:[458,565,645,718,774,820,854,880], thH:[688,738,780,815,845,876], thE:[385,495,588,668,738,798,845,875] },
  vt_ctrlsphere:  { cat:'control_tracking', sub:'wrist', type:'track', label:'VT Controlsphere', labelH:'VT Controlsphere Intermediate Hard', labelE:'VT Controlsphere 80%',
    th:[465,570,650,720,775,820,854,880], thH:[686,736,778,812,842,873], thE:[392,498,590,668,738,798,842,872] },
  // ═══ CONTROL TRACKING - Fingertip ═══
  air_angelic:    { cat:'control_tracking', sub:'fingertip', type:'track', label:'Air Angelic 4', labelH:'Air Angelic 4 Voltaic', labelE:'Air Angelic 4 Easy 80%',
    th:[422,528,618,698,758,808,847,878], thH:[658,714,758,798,834,868], thE:[348,458,558,645,715,775,828,858] },
  cloverraw:      { cat:'control_tracking', sub:'fingertip', type:'track', label:'Cloverrawcontrol Easy', labelH:'Cloverrawcontrol', labelE:'Cloverrawcontrol Easy 80%',
    th:[435,540,625,705,763,812,850,880], thH:[670,722,765,802,838,870], thE:[360,470,565,648,718,778,832,862] },
  ctrlsphere_far: { cat:'control_tracking', sub:'fingertip', type:'track', label:'Controlsphere Far', labelH:'Controlsphere Far', labelE:'Controlsphere Far Larger 90%',
    th:[442,548,632,710,768,816,852,882], thH:[672,724,768,805,840,872], thE:[368,478,572,652,722,782,835,865] },
  // ═══ CONTROL TRACKING - Blending ═══
  pgti:           { cat:'control_tracking', sub:'blending', type:'track', label:'PGTI Voltaic Easy', labelH:'PGTI Voltaic', labelE:'PGTI Voltaic Easy 80%',
    th:[428,532,618,698,756,806,844,875], thH:[662,718,760,798,832,865], thE:[355,462,555,638,708,770,826,858] },
  air_celestial:  { cat:'control_tracking', sub:'blending', type:'track_pct', label:'Air CELESTIAL', labelH:'Air CELESTIAL', labelE:'Air CELESTIAL Slowed',
    th:[825,840,855,865,881,890,902,908], thH:[867,875,885,890,894,897], thE:[820,835,850,861,870,878,884,890] },
  whisphere_slow: { cat:'control_tracking', sub:'blending', type:'track', label:'Whisphere Slow', labelH:'Whisphere Extra Small & Slow', labelE:'Whisphere Slow 55%',
    th:[458,562,648,718,774,820,854,882], thH:[708,752,792,822,852,880], thE:[388,495,585,665,735,795,842,872] },

  // ═══ REACTIVE TRACKING ═══
  ground_plaza:   { cat:'reactive_tracking', sub:'control', type:'track_pct', label:'Ground Plaza Sparky', labelH:'Ground Plaza Sparky v3 Thin', labelE:'Air Voltaic Inv 7 Easy 80%',
    th:[862,872,882,888,894,900,905,909], thH:[881,886,891,895,898,901], thE:[780,812,838,855,868,878,886,893] },
  ctrlsphere_ow:  { cat:'reactive_tracking', sub:'control', type:'track', label:'Controlsphere OW', labelH:'Controlsphere OW 150%', labelE:'Controlsphere OW Long 90%',
    th:[438,542,623,703,760,810,847,878], thH:[675,725,768,804,837,870], thE:[368,475,568,648,718,778,832,862] },
  flicker_plaza:  { cat:'reactive_tracking', sub:'speed', type:'track_pct', label:'Flicker Plaza rAim', labelH:'Flicker Plaza', labelE:'Flicker Plaza Less Blinks',
    th:[860,870,881,891,900,908,913,917], thH:[890,896,901,905,910,914], thE:[858,871,883,890,895,900,904,909] },
  polarized_hell: { cat:'reactive_tracking', sub:'speed', type:'track', label:'Polarized Hell', labelH:'Polarized Hell 20% Slower', labelE:'Polarized Hell 40% Slower',
    th:[425,528,612,692,750,800,838,870], thH:[660,712,755,793,826,858], thE:[352,458,552,635,706,768,824,855] },
  air_pure:       { cat:'reactive_tracking', sub:'reading', type:'track_pct', label:'Air Pure', labelH:'Air Pure', labelE:'Air Pure Slower No UFO',
    th:[847,862,876,886,895,902,906,910], thH:[884,890,895,900,905,909], thE:[860,874,886,893,901,907,911,916] },
  air_voltaic:    { cat:'reactive_tracking', sub:'reading', type:'track', label:'Air Voltaic', labelH:'Air Voltaic Invincible 4', labelE:'Air Voltaic Easy 80%',
    th:[418,522,608,688,748,798,836,868], thH:[648,705,748,788,822,856], thE:[345,452,547,630,700,762,820,852] },

  // ═══ FLICK TECH ═══
  pokeball_frenzy:{ cat:'flick_tech', sub:'speed', type:'click', label:'Pokeball Frenzy', labelH:'Pokeball Frenzy Auto TE Wide', labelE:'Pokeball Frenzy TE Wide',
    th:[1950,2250,2550,2850,3150,3400,3600,3800], thH:[3550,3725,3850,4000,4100,4200], thE:[650,950,1250,1500,1750,2000,2300,2700] },
  w1w3ts_reload:  { cat:'flick_tech', sub:'speed', type:'click', useHits:true, label:'1w3ts Reload', labelH:'1w2ts Reload', labelE:'1w3ts Reload Larger',
    th:[66,76,86,96,106,116,126,135], thH:[106,114,121,127,133,138], thE:[36,43,50,58,70,82,92,102] },
  vox_ts2:        { cat:'flick_tech', sub:'speed', type:'click', useHits:true, label:'voxTargetSwitch 2', labelH:'voxTargetSwitch 2 20% Smaller', labelE:'voxTargetSwitch 2 Large',
    th:[78,88,98,107,116,123,130,136], thH:[103,111,116,121,127,133], thE:[67,78,87,95,103,110,117,123] },
  beants:         { cat:'flick_tech', sub:'stability', type:'click', useHits:true, label:'BeanTS', labelH:'BeanTS 30% Smaller', labelE:'BeanTS Larger',
    th:[88,103,115,127,136,143,149,156], thH:[119,127,134,139,143,147], thE:[65,78,90,100,110,120,130,142] },
  floatts:        { cat:'flick_tech', sub:'stability', type:'click', useHits:true, label:'FloatTS Angelic', labelH:'FloatTS Angelic', labelE:'FloatTS Angelic Easy Larger',
    th:[70,79,86,93,100,107,115,123], thH:[94,100,105,110,114,118], thE:[65,74,81,88,95,101,106,111] },
  waldots:        { cat:'flick_tech', sub:'micro', type:'click', useHits:true, label:'WaldoTS', labelH:'WaldoTS', labelE:'WaldoTS Novice',
    th:[108,117,126,135,144,153,162,170], thH:[145,153,160,166,173,178], thE:[65,78,90,100,110,120,130,140] },
  devts:          { cat:'flick_tech', sub:'micro', type:'click', useHits:true, label:'devTS NR Goated 5Bot', labelH:'devTS Goated NR Static Small 5Bot', labelE:'devTS Goated 5Bot',
    th:[600,650,705,760,810,840,870,900], thH:[750,775,800,825,850,870], thE:[350,400,450,500,550,600,640,680] },
  domiswitch:     { cat:'flick_tech', sub:'postflick', type:'click', label:'domiSwitch', labelH:'domiSwitch', labelE:'domiSwitch Easy Slower',
    th:[4200,4700,5200,5700,6150,6600,7100,7600], thH:[5550,5950,6250,6550,6850,7200], thE:[3200,3700,4200,4600,5000,5400,5800,6300] },
  tamts:          { cat:'flick_tech', sub:'postflick', type:'click', useHits:true, label:'tamTargetSwitch', labelH:'tamTargetSwitch Smooth', labelE:'tamTargetSwitch Smooth Easy',
    th:[22,26,29,32,34,36,38,41], thH:[32,35,37,39,42,45], thE:[7,11,15,18,21,24,26,28] },

  // ═══ CLICK TIMING ═══
  pasu_reload:    { cat:'click_timing', sub:'reading', type:'click', useHits:true, label:'Pasu Reload', labelH:'Pasu Reload Goated', labelE:'Pasu Slow',
    th:[70,85,100,115,130,142,155,165], thH:[110,120,130,140,150,160], thE:[76,88,100,110,120,130,140,150] },
  vt_bounceshot:  { cat:'click_timing', sub:'reading', type:'click', label:'VT Bounceshot', labelH:'VT Bounceshot Advanced', labelE:'B180 Voltaic Easy',
    th:[550,640,720,780,850,900,980,1060], thH:[730,790,850,910,950,1000], thE:[26,38,50,58,65,72,78,87] },
  ctrlsphere_clk: { cat:'click_timing', sub:'reading', type:'click', useHits:true, label:'Controlsphere Click', labelH:'Controlsphere Click Smaller', labelE:'Controlsphere Click Easy',
    th:[27,33,39,45,50,56,61,67], thH:[39,45,51,56,60,64], thE:[15,21,27,33,39,45,50,55] },
  popcorn_mv:     { cat:'click_timing', sub:'precision', type:'click', useHits:true, label:'Popcorn MV', labelH:'Popcorn MV Advanced', labelE:'Popcorn MV Novice',
    th:[150,190,240,280,330,380,430,480], thH:[290,330,370,420,460,500], thE:[50,100,150,190,230,270,300,330] },
  pasu_angelic:   { cat:'click_timing', sub:'precision', type:'click', useHits:true, label:'Pasu Angelic', labelH:'Pasu Angelic', labelE:'Pasu Angelic 20% Larger 80%',
    th:[72,79,85,90,96,103,110,115], thH:[87,94,102,110,118,125], thE:[51,58,65,72,78,84,90,97] },
  pasu_perfected: { cat:'click_timing', sub:'precision', type:'click', useHits:true, label:'1w2ts Pasu Perfected', labelH:'1w2ts Pasu Perfected 30% Smaller', labelE:'1w2ts Pasu Perfected Easy',
    th:[60,70,80,88,96,101,107,112], thH:[75,82,87,93,98,103], thE:[58,69,80,87,93,99,105,110] },
  pasu_micro:     { cat:'click_timing', sub:'ct_stability', type:'click', label:'1w3ts Pasu Perfected Micro', labelH:'1w3ts Pasu Perfected Micro Goated', labelE:'1w3ts Pasu Micro Larger 80%',
    th:[900,1000,1100,1200,1300,1400,1500,1600], thH:[1100,1200,1300,1400,1500,1560], thE:[600,700,800,900,1000,1100,1200,1300] },
  floatheads_t:   { cat:'click_timing', sub:'ct_stability', type:'click', label:'Floating Heads Timing', labelH:'Floating Heads Timing 400% Fixed', labelE:'Floating Heads 400% Larger',
    th:[1950,2300,2650,3000,3350,3650,3900,4200], thH:[3200,3484,3648,3848,4048,4248], thE:[400,700,1000,1350,1700,2050,2400,2750] },
  vox_click:      { cat:'click_timing', sub:'ct_stability', type:'click', useHits:true, label:'voxTargetClick', labelH:'VoxTargetSwitch Click Small', labelE:'voxTargetSwitch Click',
    th:[62,72,80,87,95,102,108,116], thH:[90,96,101,106,111,115], thE:[49,59,67,74,81,88,94,100] },

  // ═══ COURS DRILLS (not in benchmark, free play only) ═══
  crosshair_drill: { cat:'cours', sub:'placement', type:'click', label:'Crosshair Placement Drill' },
  deadzone_drill:  { cat:'cours', sub:'tracking', type:'track', label:'Deadzone Drill' },
  burst_drill:     { cat:'cours', sub:'burst', type:'click', label:'Burst Transfer Drill' },
  strafe_drill:    { cat:'cours', sub:'strafe', type:'track', label:'Strafe Drill' },
  reaction_drill:  { cat:'cours', sub:'reaction', type:'click', label:'Reaction Drill' },
  micro_drill:     { cat:'cours', sub:'micro_precision', type:'click', label:'Micro Precision Drill' },
};

// Current tier: 'easier', 'medium', or 'hard'
let currentTier = 'medium';

const CAT_LABELS = {
  control_tracking:'Control Tracking', reactive_tracking:'Reactive Tracking',
  flick_tech:'Flick Tech', click_timing:'Click Timing'
};
const SUB_LABELS = {
  arm:'Arm', wrist:'Wrist', fingertip:'Fingertip', blending:'Blending',
  control:'Control', speed:'Speed', reading:'Reading',
  stability:'Stability', micro:'Micro', postflick:'Post-Flick',
  precision:'Precision', ct_stability:'Stability'
};

// ---- THREADS CALCULATION ----
function getTh(key) {
  const s = SCENARIOS[key];
  if (!s || !s.th) return null;
  if (currentTier==='hard') return s.thH || s.th;
  if (currentTier==='easier') return s.thE || s.th;
  return s.th;
}
function getMaxThreads() { return currentTier === 'hard' ? 6 : 8; }
function getLabel(key) {
  if (currentTier==='hard') return SCENARIOS[key].labelH || SCENARIOS[key].label;
  if (currentTier==='easier') return SCENARIOS[key].labelE || SCENARIOS[key].label;
  return SCENARIOS[key].label;
}

function calcThreads(key, score) {
  const th = getTh(key);
  if (!th) return 0;
  for (let i = th.length - 1; i >= 0; i--) { if (score >= th[i]) return i + 1; }
  return 0;
}
function calcSubThreads(sub) {
  const entries = Object.entries(SCENARIOS).filter(([,v]) => v.sub === sub);
  return entries.reduce((sum,[k]) => sum + calcThreads(k, getBest(k)), 0);
}
function calcMaxSubThreads(sub) {
  return Object.values(SCENARIOS).filter(v => v.sub === sub).length * getMaxThreads();
}
function calcTotalThreads() {
  return Object.keys(SCENARIOS).filter(k=>SCENARIOS[k].th).reduce((sum, k) => sum + calcThreads(k, getBest(k)), 0);
}
function calcMaxTotal() { return Object.keys(SCENARIOS).filter(k=>SCENARIOS[k].th).length * getMaxThreads(); }
function calcRankFromThreads(threads) {
  const total = calcMaxTotal();
  const pct = threads / total;
  if (pct >= 0.9) return { label:'Mythic', color:'#ff4655' };
  if (pct >= 0.75) return { label:'Legendary', color:'#d882f5' };
  if (pct >= 0.6) return { label:'Diamond', color:'#59c5c7' };
  if (pct >= 0.45) return { label:'Platinum', color:'#2dbe73' };
  if (pct >= 0.3) return { label:'Gold', color:'#e8c56d' };
  if (pct >= 0.18) return { label:'Silver', color:'#c0c0c0' };
  if (pct >= 0.08) return { label:'Bronze', color:'#b97450' };
  if (threads > 0) return { label:'Iron', color:'#7c8389' };
  return { label:'Unranked', color:'#555' };
}

// ---- PERSISTENCE (per tier) ----
function loadBench() { try { return JSON.parse(localStorage.getItem('visc_bench_'+currentTier)) || {}; } catch { return {}; } }
function saveBest(key, score) {
  const b = loadBench(); if (!b[key] || score > b[key]) b[key] = score;
  localStorage.setItem('visc_bench_'+currentTier, JSON.stringify(b));
}
function getBenchmarkScore() {
  const sc = SCENARIOS[G.mode];
  if (sc && (sc.type === 'track' || sc.type === 'track_pct')) {
    return G.trackFrames > 0 ? Math.round(G.trackOnTarget / G.trackFrames * 1000) : 0;
  }
  // useHits=true → thresholds are calibrated in hit count, not raw score
  if (sc && sc.useHits) return G.hits;
  return G.score;
}
function getBest(key) { return loadBench()[key] || 0; }

// ---- PER-TIER HELPERS (for per-scenario difficulty locking) ----
function getThFor(key, tier) {
  const s = SCENARIOS[key];
  if (!s || !s.th) return null;
  if (tier==='hard') return s.thH || s.th;
  if (tier==='easier') return s.thE || s.th;
  return s.th;
}
function maxThreadsFor(tier) { return tier === 'hard' ? 6 : 8; }
function getBestFor(key, tier) {
  try { return (JSON.parse(localStorage.getItem('visc_bench_'+tier)) || {})[key] || 0; } catch { return 0; }
}
function calcThreadsFor(key, score, tier) {
  const th = getThFor(key, tier);
  if (!th) return 0;
  for (let i = th.length - 1; i >= 0; i--) { if (score >= th[i]) return i + 1; }
  return 0;
}
function isScenarioUnlocked(key, tier) {
  if (tier === 'easier') return true;
  const prevTier = tier === 'hard' ? 'medium' : 'easier';
  const best = getBestFor(key, prevTier);
  const threads = calcThreadsFor(key, best, prevTier);
  return threads >= maxThreadsFor(prevTier); // 8/8 on easier, 6/6 on medium required
}
function setCurrentTier(t) { currentTier = t; renderBenchmark(); }

// Toast visuel pour feedback "scénario verrouillé"
// Delegates to the global toast system (ui.js). Kept as alias for existing callers.
function _showLockToast(msg) {
  if (window.showToast) return window.showToast.lock(msg);
  console.warn('Lock toast fallback:', msg);
}

const DEF_SETTINGS = { hFov:103, sensMode:'cm360', sensVal:34, cm360:34, dpi:800, difficulty:'medium', duration:60, soundOn:true, soundVolume:0.5, soundPack:'clean',
  xhColor:'#00ff88', xhOpacity:1, xhOutline:1, xhOutlineOpacity:0.5, xhDot:false, xhDotSize:2,
  xhInnerLen:6, xhInnerThick:2, xhInnerGap:3, xhInnerShow:true,
  xhOuterLen:2, xhOuterThick:2, xhOuterGap:10, xhOuterShow:false,
  theme:'default', roomTheme:'clean_grey' };
function loadSettings() { try { return {...DEF_SETTINGS,...JSON.parse(localStorage.getItem('visc_settings'))}; } catch { return {...DEF_SETTINGS}; } }
function saveSettings(p) { const s = loadSettings(); Object.assign(s, p); localStorage.setItem('visc_settings', JSON.stringify(s)); }

const XH_PRESETS = {
  dot:     { xhInnerShow:false, xhOuterShow:false, xhDot:true, xhDotSize:3, xhOutline:0, xhInnerGap:0, xhInnerLen:6, xhInnerThick:2, xhOuterLen:2, xhOuterThick:2, xhOuterGap:10 },
  classic: { xhInnerShow:true, xhInnerLen:6, xhInnerThick:2, xhInnerGap:3, xhOuterShow:false, xhDot:false, xhOutline:1, xhOuterLen:2, xhOuterThick:2, xhOuterGap:10 },
  plus:    { xhInnerShow:true, xhInnerLen:8, xhInnerThick:2, xhInnerGap:0, xhOuterShow:false, xhDot:false, xhOutline:0, xhOuterLen:2, xhOuterThick:2, xhOuterGap:10 },
  valorant:{ xhInnerShow:true, xhInnerLen:6, xhInnerThick:2, xhInnerGap:4, xhOuterShow:false, xhDot:false, xhOutline:1, xhOuterLen:2, xhOuterThick:2, xhOuterGap:10 },
  sniper:  { xhInnerShow:true, xhInnerLen:14, xhInnerThick:1, xhInnerGap:8, xhOuterShow:false, xhDot:true, xhDotSize:1.5, xhOutline:0, xhOuterLen:2, xhOuterThick:2, xhOuterGap:10 },
};

function updateSensDisplay() {
  const s = loadSettings();
  const cm = gameSensToCm360(s.sensMode, s.sensVal);
  const el = document.getElementById('sens-cm360-display');
  if (el) el.textContent = Math.round(cm * 10) / 10;
}

function initSettingsChips() {
  const s = loadSettings();

  // UI Theme chips
  document.getElementById('ui-theme-chips')?.addEventListener('click', e => {
    const chip = e.target.closest('.sett-theme-chip');
    if (!chip) return;
    const t = chip.dataset.theme;
    saveSettings({ theme: t }); applyTheme(t);
    document.querySelectorAll('.sett-theme-chip').forEach(c => c.classList.toggle('active', c.dataset.theme === t));
    const sel = document.getElementById('opt-theme'); if (sel) sel.value = t;
  });
  // Mark active
  document.querySelectorAll('.sett-theme-chip').forEach(c => c.classList.toggle('active', c.dataset.theme === (s.theme || 'default')));

  // Room theme chips — generate from ROOM_THEMES
  const roomGrid = document.getElementById('room-theme-chips');
  if (roomGrid) {
    roomGrid.innerHTML = '';
    Object.entries(ROOM_THEMES).forEach(([key, rt]) => {
      const bg = '#' + rt.bg.toString(16).padStart(6,'0');
      const floor = '#' + rt.floor.toString(16).padStart(6,'0');
      const btn = document.createElement('button');
      btn.className = 'sett-room-chip' + (key === (s.roomTheme || 'clean_grey') ? ' active' : '');
      btn.dataset.room = key;
      btn.innerHTML = `<span class="sett-room-swatch" style="background:linear-gradient(135deg,${bg} 50%,${floor} 50%)"></span>${rt.label}`;
      btn.addEventListener('click', () => {
        saveSettings({ roomTheme: key }); applyRoomTheme();
        document.querySelectorAll('.sett-room-chip').forEach(c => c.classList.toggle('active', c.dataset.room === key));
        const sel = document.getElementById('opt-room-theme'); if (sel) sel.value = key;
      });
      roomGrid.appendChild(btn);
    });
  }

  // FOV slider
  const fovSlider = document.getElementById('opt-fov');
  const fovVal = document.getElementById('opt-fov-val');
  if (fovSlider) {
    fovSlider.value = s.hFov || 103;
    if (fovVal) fovVal.textContent = s.hFov || 103;
    fovSlider.addEventListener('input', e => {
      const v = parseInt(e.target.value);
      if (fovVal) fovVal.textContent = v;
      saveSettings({ hFov: v });
      updateFOV();
    });
  }

  // Crosshair presets
  document.querySelectorAll('.xh-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = XH_PRESETS[btn.dataset.preset];
      if (!preset) return;
      saveSettings(preset);
      applySettings();
    });
  });

  // Sens display update
  updateSensDisplay();
}

function applySettings() {
  const s = loadSettings();
  $('#opt-dpi').value = s.dpi || 800;
  $('#opt-sens-mode').value = s.sensMode || 'cm360';
  $('#opt-sens-val').value = s.sensVal || 34;
  $('#opt-sens-val').step = (SENS_DEFAULTS[s.sensMode]||SENS_DEFAULTS.cm360).step;
  G.cm360 = s.cm360 || 34;
  $('#opt-diff').value = s.difficulty; $('#opt-duration').value = s.duration;
  $('#opt-sound').checked = s.soundOn;
  $('#opt-volume').value = s.soundVolume;
  $('#opt-volume-val').textContent = Math.round(s.soundVolume * 100) + '%';
  audioEngine.setVolume(s.soundVolume);
  audioEngine.setPack(s.soundPack);
  document.querySelectorAll('.sett-sound-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.pack === s.soundPack);
  });
  // Crosshair Valorant settings
  if ($('#xh-color')) $('#xh-color').value = s.xhColor || '#00ff88';
  if ($('#xh-opacity')) { $('#xh-opacity').value = s.xhOpacity ?? 1; $('#xh-opacity-val').textContent = s.xhOpacity ?? 1; }
  if ($('#xh-outline')) { $('#xh-outline').value = s.xhOutline ?? 1; $('#xh-outline-val').textContent = s.xhOutline ?? 1; }
  if ($('#xh-dot')) $('#xh-dot').checked = s.xhDot === true;
  if ($('#xh-dot-size')) { $('#xh-dot-size').value = s.xhDotSize ?? 2; $('#xh-dot-size-val').textContent = s.xhDotSize ?? 2; }
  if ($('#xh-inner-show')) $('#xh-inner-show').checked = s.xhInnerShow !== false;
  if ($('#xh-inner-len')) { $('#xh-inner-len').value = s.xhInnerLen ?? 6; $('#xh-inner-len-val').textContent = s.xhInnerLen ?? 6; }
  if ($('#xh-inner-thick')) { $('#xh-inner-thick').value = s.xhInnerThick ?? 2; $('#xh-inner-thick-val').textContent = s.xhInnerThick ?? 2; }
  if ($('#xh-inner-gap')) { $('#xh-inner-gap').value = s.xhInnerGap ?? 3; $('#xh-inner-gap-val').textContent = s.xhInnerGap ?? 3; }
  if ($('#xh-outer-show')) $('#xh-outer-show').checked = s.xhOuterShow === true;
  if ($('#xh-outer-len')) { $('#xh-outer-len').value = s.xhOuterLen ?? 2; $('#xh-outer-len-val').textContent = s.xhOuterLen ?? 2; }
  if ($('#xh-outer-thick')) { $('#xh-outer-thick').value = s.xhOuterThick ?? 2; $('#xh-outer-thick-val').textContent = s.xhOuterThick ?? 2; }
  if ($('#xh-outer-gap')) { $('#xh-outer-gap').value = s.xhOuterGap ?? 10; $('#xh-outer-gap-val').textContent = s.xhOuterGap ?? 10; }
  $('#opt-theme').value = s.theme;
  if ($('#opt-room-theme')) $('#opt-room-theme').value = s.roomTheme || 'clean_grey';
  applyCrosshair(); applyTheme(s.theme); applyRoomTheme();
  initSettingsChips(); updateSensDisplay();
}

function applyCrosshair() {
  const s = loadSettings();
  const c = s.xhColor || '#00ff88';
  const op = s.xhOpacity ?? 1;
  const ol = s.xhOutline ?? 0;
  const olOp = s.xhOutlineOpacity ?? 0.5;
  const iLen = s.xhInnerLen ?? 6;
  const iTh = s.xhInnerThick ?? 2;
  const iGap = s.xhInnerGap ?? 3;
  const iShow = s.xhInnerShow !== false;
  const oLen = s.xhOuterLen ?? 2;
  const oTh = s.xhOuterThick ?? 2;
  const oGap = s.xhOuterGap ?? 10;
  const oShow = s.xhOuterShow === true;
  const dot = s.xhDot === true;
  const dotSz = s.xhDotSize ?? 2;

  // Calculate SVG size to fit all elements
  const maxR = Math.max(iGap + iLen, oShow ? oGap + oLen : 0, 4) + ol + 2;
  const sz = maxR * 2;
  const cx = maxR, cy = maxR;

  let svg = `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" xmlns="http://www.w3.org/2000/svg">`;

  function drawLine(x1,y1,x2,y2,thick,color,opacity) {
    if (ol > 0) svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(0,0,0,${olOp})" stroke-width="${thick+ol*2}" stroke-linecap="round"/>`;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${thick}" stroke-linecap="round" opacity="${opacity}"/>`;
  }

  // Inner lines
  if (iShow) {
    drawLine(cx, cy-iGap, cx, cy-iGap-iLen, iTh, c, op); // top
    drawLine(cx, cy+iGap, cx, cy+iGap+iLen, iTh, c, op); // bottom
    drawLine(cx-iGap, cy, cx-iGap-iLen, cy, iTh, c, op); // left
    drawLine(cx+iGap, cy, cx+iGap+iLen, cy, iTh, c, op); // right
  }

  // Outer lines
  if (oShow) {
    drawLine(cx, cy-oGap, cx, cy-oGap-oLen, oTh, c, op);
    drawLine(cx, cy+oGap, cx, cy+oGap+oLen, oTh, c, op);
    drawLine(cx-oGap, cy, cx-oGap-oLen, cy, oTh, c, op);
    drawLine(cx+oGap, cy, cx+oGap+oLen, cy, oTh, c, op);
  }

  // Center dot
  if (dot) {
    if (ol > 0) svg += `<circle cx="${cx}" cy="${cy}" r="${dotSz+ol}" fill="rgba(0,0,0,${olOp})"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${dotSz}" fill="${c}" opacity="${op}"/>`;
  }

  svg += '</svg>';
  $('#crosshair-overlay').innerHTML = svg;
  $('#crosshair-overlay').style.filter = 'none';
  // Update preview box in menu
  const prev = $('#xh-preview');
  if (prev) prev.innerHTML = svg;
}
function applyTheme(t) { document.documentElement.dataset.theme = t; }

// ---- ROOM THEMES (KovaaK's style) ----
const ROOM_THEMES = {
  clean_grey: { label:'Clean Grey', bg:0xb8b8b8, floor:0xc0c0c0, wall:0xd0d0d0, wallBack:0xc8c8c8, ceil:0xd8d8d8, trim:0x999999, grid:[0x999999,0xaaaaaa], target:0x111111, targetE:0.15, ambient:0.5, sunColor:0xfff8f0, sunInt:1.0 },
  pure_dark:  { label:'Pure Dark', bg:0x0a0a0a, floor:0x111111, wall:0x151515, wallBack:0x121212, ceil:0x181818, trim:0x222222, grid:[0x1a1a1a,0x141414], target:0xff4444, targetE:0.5, ambient:0.3, sunColor:0xffffff, sunInt:0.8 },
  neon:       { label:'Neon', bg:0x08001a, floor:0x0a0018, wall:0x0d0022, wallBack:0x0a001a, ceil:0x10002a, trim:0x6600ff, grid:[0x2200aa,0x110066], target:0xff00ff, targetE:0.7, ambient:0.2, sunColor:0x8844ff, sunInt:0.6 },
  sunset:     { label:'Sunset', bg:0x4a2010, floor:0x5a3020, wall:0x6a3828, wallBack:0x553020, ceil:0x704030, trim:0xcc6633, grid:[0x553322,0x442211], target:0x111111, targetE:0.15, ambient:0.4, sunColor:0xffaa55, sunInt:1.2 },
  arctic:     { label:'Arctic', bg:0xd8e8f0, floor:0xe0eef5, wall:0xe8f2fa, wallBack:0xdcecf5, ceil:0xf0f8ff, trim:0x88bbdd, grid:[0xaaccdd,0xbbddee], target:0x1a1a2a, targetE:0.15, ambient:0.6, sunColor:0xeef4ff, sunInt:1.1 },
  matrix:     { label:'Matrix', bg:0x000a00, floor:0x001100, wall:0x001500, wallBack:0x001200, ceil:0x001a00, trim:0x00ff00, grid:[0x004400,0x002200], target:0x00ff00, targetE:0.6, ambient:0.15, sunColor:0x22ff22, sunInt:0.5 },
  oxide:      { label:'Oxide', bg:0x2a1a15, floor:0x3a2218, wall:0x442a1e, wallBack:0x382218, ceil:0x4a3020, trim:0x885533, grid:[0x332211,0x221100], target:0x111111, targetE:0.15, ambient:0.4, sunColor:0xffcc88, sunInt:0.9 },
  synthwave:  { label:'Synthwave', bg:0x1a0033, floor:0x220044, wall:0x2a0055, wallBack:0x240048, ceil:0x300060, trim:0xff0088, grid:[0x440066,0x330055], target:0x00ffff, targetE:0.6, ambient:0.2, sunColor:0xff44aa, sunInt:0.7 },
  clover_alt: { label:'Clover Alt', bg:0x0a1a12, floor:0x0d1f16, wall:0x10261b, wallBack:0x0e2118, ceil:0x132b1f, trim:0x1a5c3a, grid:[0x0e3320,0x0a2818], target:0x44ffaa, targetE:0.5, ambient:0.25, sunColor:0x66ffaa, sunInt:0.6 },
};

function applyRoomTheme() {
  const s = loadSettings();
  const t = ROOM_THEMES[s.roomTheme] || ROOM_THEMES.clean_grey;
  // Update materials
  M.floor.color.setHex(t.floor);
  M.wall.color.setHex(t.wall);
  M.wallBack.color.setHex(t.wallBack);
  M.ceiling.color.setHex(t.ceil);
  M.trim.color.setHex(t.trim);
  // Update all target materials
  [M.t1,M.t2,M.t3,M.t4,M.t5,M.t6].forEach(m => {
    m.color.setHex(t.target);
    m.emissive.setHex(t.target);
    m.emissiveIntensity = t.targetE;
  });
  // Scene background
  if (scene) scene.background = new THREE.Color(t.bg);
}

// ---- STATE ----
const G = { mode:'', diff:'medium', duration:60, cm360:34, soundOn:true, running:false, score:0, hits:0, misses:0, combo:0, bestCombo:0, timeLeft:60, reactionTimes:[], targets:[], spawnTimer:null, timerInterval:null, animFrame:null, yaw:0, pitch:0, locked:false, trackFrames:0, trackOnTarget:0, switchActiveIdx:0, switchTimer:0, switchInterval:2, benchmarkMode:false, recoilY:0, autoFireTimer:null, swayPhase:0 };
window._G = G; // expose for coaching.js hooks (const is not on window)

// ---- THREE.JS ----
let scene, camera, renderer, clock, roomGroup, targetsGroup;
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0,0);

function initThree() {
  scene = new THREE.Scene(); scene.background = new THREE.Color(0xb8b8b8);
  camera = new THREE.PerspectiveCamera(73, innerWidth/innerHeight, 0.1, 200);
  camera.position.set(0,1.7,0);
  renderer = new THREE.WebGLRenderer({ canvas:$('#game-canvas'), antialias:true, powerPreference:'high-performance' });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled = false; renderer.toneMapping = THREE.LinearToneMapping;
  clock = new THREE.Clock(); setupLights();
  roomGroup = new THREE.Group(); scene.add(roomGroup);
  targetsGroup = new THREE.Group(); scene.add(targetsGroup);
  addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; updateFOV(); renderer.setSize(innerWidth,innerHeight); });
}
function setupLights() {
  scene.children.filter(c=>c.isLight).forEach(l=>scene.remove(l));
  scene.add(new THREE.AmbientLight(0xffffff,0.5));
  const sun = new THREE.DirectionalLight(0xfff8f0,1); sun.position.set(5,15,5); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xaaccff,0x444422,0.4));
}
function updateFOV() { const h=(loadSettings().hFov||103)*Math.PI/180; camera.fov=2*Math.atan(Math.tan(h/2)/camera.aspect)*180/Math.PI; camera.updateProjectionMatrix(); }

const M = {
  floor: new THREE.MeshStandardMaterial({color:0xc0c0c0,roughness:0.85}),
  wall: new THREE.MeshStandardMaterial({color:0xd0d0d0,roughness:0.75}),
  wallBack: new THREE.MeshStandardMaterial({color:0xc8c8c8,roughness:0.8}),
  ceiling: new THREE.MeshStandardMaterial({color:0xd8d8d8,roughness:0.85}),
  trim: new THREE.MeshStandardMaterial({color:0x999999,roughness:0.5,metalness:0.2}),
  t1: new THREE.MeshStandardMaterial({color:0x111111,emissive:0x111111,emissiveIntensity:0.15}),
  t2: new THREE.MeshStandardMaterial({color:0x111111,emissive:0x111111,emissiveIntensity:0.15}),
  t3: new THREE.MeshStandardMaterial({color:0x111111,emissive:0x111111,emissiveIntensity:0.15}),
  t4: new THREE.MeshStandardMaterial({color:0x111111,emissive:0x111111,emissiveIntensity:0.15}),
  t5: new THREE.MeshStandardMaterial({color:0x111111,emissive:0x111111,emissiveIntensity:0.15}),
  t6: new THREE.MeshStandardMaterial({color:0x111111,emissive:0x111111,emissiveIntensity:0.15}),
  tDim: new THREE.MeshStandardMaterial({color:0x333333,emissive:0x222222,emissiveIntensity:0.08}),
};

// Dispose the per-instance GPU resources of a mesh. Materials live in the shared
// M map and are reused across many spheres, so we only dispose geometry here
// (disposing shared materials would break subsequent spawns).
function _disposeMesh(obj) {
  if (!obj) return;
  if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
  // Note: materials intentionally not disposed — they are shared globals (M.t1, M.t4, …)
  if (obj.children && obj.children.length) {
    for (const c of [...obj.children]) _disposeMesh(c);
  }
}
function clearScene() {
  while (roomGroup.children.length) {
    const c = roomGroup.children[0];
    _disposeMesh(c);
    roomGroup.remove(c);
  }
  while (targetsGroup.children.length) {
    const c = targetsGroup.children[0];
    _disposeMesh(c);
    targetsGroup.remove(c);
  }
  if (G._gridDots) {
    G._gridDots.forEach(m => { _disposeMesh(m); roomGroup.remove(m); });
    G._gridDots = [];
  }
  scene.fog = null;
  applyRoomTheme();
  setupRoomLights();
}

function setupRoomLights() {
  scene.children.filter(c=>c.isLight).forEach(l=>scene.remove(l));
  const s = loadSettings();
  const t = ROOM_THEMES[s.roomTheme] || ROOM_THEMES.clean_grey;
  scene.add(new THREE.AmbientLight(0xffffff, t.ambient));
  const sun = new THREE.DirectionalLight(t.sunColor, t.sunInt); sun.position.set(5,15,5); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xaaccff,0x444422,0.3));
}

function buildRoom(w,h,d) {
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(w,d),M.floor); fl.rotation.x=-Math.PI/2; roomGroup.add(fl);
  const rt=ROOM_THEMES[loadSettings().roomTheme]||ROOM_THEMES.clean_grey; const gr=new THREE.GridHelper(w,w,rt.grid[0],rt.grid[1]); gr.position.y=0.01; roomGroup.add(gr);
  const bw=new THREE.Mesh(new THREE.PlaneGeometry(w,h),M.wallBack); bw.position.set(0,h/2,-d/2); roomGroup.add(bw);
  const s1=new THREE.Mesh(new THREE.PlaneGeometry(d,h),M.wall); s1.position.set(-w/2,h/2,0); s1.rotation.y=Math.PI/2; roomGroup.add(s1);
  const s2=new THREE.Mesh(new THREE.PlaneGeometry(d,h),M.wall); s2.position.set(w/2,h/2,0); s2.rotation.y=-Math.PI/2; roomGroup.add(s2);
  const cl=new THREE.Mesh(new THREE.PlaneGeometry(w,d),M.ceiling); cl.position.set(0,h,0); cl.rotation.x=Math.PI/2; roomGroup.add(cl);
  const lG=new THREE.BoxGeometry(2,0.05,0.3), lM=new THREE.MeshBasicMaterial({color:0xddeeff});
  for(let x=-w/3;x<=w/3;x+=w/3){const l=new THREE.Mesh(lG,lM);l.position.set(x,h-0.05,-d/4);roomGroup.add(l);}
}

function mkSphere(x,y,z,r,mat) { const g=new THREE.SphereGeometry(r,12,8),m=new THREE.Mesh(g,mat||M.t1); m.position.set(x,y,z); targetsGroup.add(m); return m; }
function rand(a,b) { return a+Math.random()*(b-a); }

// ============================================================
// SCENARIO SPAWN/UPDATE IMPLEMENTATIONS
// Each scenario creates targets with specific movement patterns
// ============================================================

let trackTarget = null;
let switchTargets = [];

// ---- Helper: Tracking target factory ----
function mkTrackTarget(x,y,z,r,mat,props) {
  const mesh = mkSphere(x,y,z,r,mat||M.t4);
  trackTarget = { mesh, alive:true, x,y,z, ...props };
  G.targets.push(trackTarget);
}

// ---- Helper: Switch targets factory ----
function mkSwitchTargets(positions, r, props) {
  switchTargets = [];
  positions.forEach((p,i) => {
    const mat = i===0 ? M.t4 : M.tDim;
    const mesh = mkSphere(p[0],p[1],p[2],r,mat);
    const t = { mesh, alive:true, x:p[0],y:p[1],z:p[2], idx:i, ...props, phase:rand(0,Math.PI*2), phaseY:rand(0,Math.PI*2) };
    switchTargets.push(t); G.targets.push(t);
  });
  G.switchActiveIdx=0; G.switchTimer=0;
}

// ═══ DIFFICULTY-SCALED RADIUS HELPER ═══
// base = medium radius. easy: +30%, hard: -20%
function tR(base) { const d=G.diff; return d==='easy'?base*1.3:d==='hard'?base*0.80:base; }

// ═══ CONTROL TRACKING SPAWNS ═══

// Arm: large range movements
function spawn_whisphereraw() { mkTrackTarget(0,1.7,-10,tR(0.35),M.t4,{mv:'whisphereraw',orbitAngle:0,orbitR:4,orbitRTarget:4,orbitY:0,orbitSpeed:1.2}); }
function spawn_whisphere() { mkTrackTarget(0,1.7,-10,tR(0.5),M.t4,{mv:'whisphere',theta1:0,theta2:0,omega1:2.5,omega2:2.5,L1:3.5,L2:2.5}); }
function spawn_smoothbot() { mkTrackTarget(0,1.7,-10,tR(0.5),M.t3,{mv:'smoothbot',strafeVx:0,strafeTarget:0,strafeAccel:0,strafeCd:0,crouchVy:0,crouchTarget:1.7}); }

// Wrist: tighter, faster direction changes
function spawn_leaptrack() { mkTrackTarget(0,1.7,-10,tR(0.45),M.t6,{mv:'leaptrack',phase:0,jumpTimer:0}); }
function spawn_ctrlsphere_aim() { mkTrackTarget(0,1.7,-10,tR(0.4),M.t4,{mv:'ctrlsphere_aim',spiralAngle:0,spiralR:2,spiralPulse:0}); }
function spawn_vt_ctrlsphere() { mkTrackTarget(0,1.7,-10,tR(0.4),M.t5,{mv:'vt_ctrlsphere',bx:0,by:1.7,bvx:0,bvy:0,attractX:0,attractY:1.7,attractTimer:0}); }

// Fingertip: tiny movements, small targets
function spawn_air_angelic() { mkTrackTarget(0,2,-10,tR(0.35),M.t5,{mv:'air_angelic'}); }
function spawn_cloverraw() { mkTrackTarget(0,1.7,-10,tR(0.35),M.t3,{mv:'cloverraw'}); }
function spawn_ctrlsphere_far() { mkTrackTarget(0,1.7,-14,tR(0.4),M.t4,{mv:'ctrlsphere_far',arcAngle:0,arcDir:1,passY:1.7,passPhase:0}); }

// Blending: mixed movement patterns
function spawn_pgti() { mkTrackTarget(0,1.7,-10,tR(0.4),M.t4,{mv:'pgti'}); }
function spawn_air_celestial() { mkTrackTarget(0,2,-10,tR(0.45),M.t5,{mv:'air_celestial',zipX:0,zipY:2,zipVx:0,zipVy:-0.5,zipPhase:'descend',zipDrift:0}); }
function spawn_whisphere_slow() { mkTrackTarget(0,1.7,-10,tR(0.5),M.t6,{mv:'whisphere_slow',bezPts:null,bezT:0,bezSpeed:0.3}); }

// ═══ REACTIVE TRACKING SPAWNS ═══
function spawn_ground_plaza() { const d=DIFF[G.diff]; mkTrackTarget(0,0.8,-10,tR(0.5),M.t3,{mv:'ground_plaza',vx:2*d.spd/2.5,vy:0,ct:0,nc:G.diff==='hard'?0.55:0.8}); }
function spawn_ctrlsphere_ow() { const d=DIFF[G.diff]; mkTrackTarget(0,1.7,-10,tR(0.45),M.t4,{mv:'ctrlsphere_ow',vx:1.5*d.spd/2.5,vy:0,ct:0,nc:G.diff==='hard'?0.65:1,crouchState:'stand',crouchTimer:0,crouchY:1.7}); }
function spawn_flicker_plaza() { mkTrackTarget(0,1.7,-10,tR(0.45),M.t2,{mv:'flicker_plaza',vx:3,vy:1,ct:0,nc:G.diff==='hard'?0.40:0.5}); }
function spawn_polarized_hell() { const d=DIFF[G.diff]; mkTrackTarget(0,1.7,-10,tR(0.5),M.t1,{mv:'polarized_hell',vx:2*d.spd/2.5,vy:1.5*d.spd/2.5,ct:0,nc:G.diff==='hard'?0.50:0.7,zigAngle:0}); }
function spawn_air_pure() { mkTrackTarget(0,2,-10,tR(0.4),M.t5,{mv:'air_pure',bx:0,by:2,bvx:1.5,bvy:0,gravity:4.5,bounceE:0.8,ct:0,nc:3}); }
function spawn_air_voltaic() { const d=DIFF[G.diff]; mkTrackTarget(0,2,-10,tR(0.45),M.t4,{mv:'air_voltaic',dashVx:0,dashVy:0,dashState:'hover',dashTimer:0,hoverX:0,hoverY:2}); }

// ═══ FLICK TECH SPAWNS ═══
// Pokeball Frenzy: fast random targets, click as many as possible before they expire
function spawn_pokeball_frenzy() {
  if(!G.running) return;
  G.targets = G.targets.filter(t => t.alive);
  const maxT = G.diff==='hard' ? 5 : G.diff==='easy' ? 3 : 4;
  if(G.targets.filter(t=>t.alive).length >= maxT) return;
  const r = G.diff==='hard' ? rand(0.22,0.30) : G.diff==='easy' ? rand(0.42,0.56) : rand(0.32,0.42);
  const z = G.diff==='hard' ? rand(-9,-12) : G.diff==='easy' ? rand(-7,-10) : rand(-8,-11);
  const x = rand(-4.5,4.5), y = rand(0.8,3.5);
  const mesh = mkSphere(x, y, z, r, M.t2);
  const spd = G.diff==='hard' ? rand(1.2,2.0) : G.diff==='easy' ? rand(0.6,1.2) : rand(0.9,1.6);
  const vx = rand(-spd,spd), vy = rand(-spd*0.5,spd*0.5);
  const ttl = G.diff==='hard' ? rand(1.1,1.6) : G.diff==='easy' ? rand(2.2,3.5) : rand(1.5,2.4);
  G.targets.push({mesh, alive:true, radius:r, spawnTime:Date.now(), vx, vy, dynamic:true, ttl, age:0, pokeball:true});
}
function spawn_w1w3ts_reload() {
  if(!G.running) return;
  const d=DIFF[G.diff];
  G.targets = G.targets.filter(t=>t.alive);
  const maxT = d.maxT || 3;
  while(G.targets.filter(t=>t.alive).length < maxT) {
    const r=rand(d.pR[0],d.pR[1]), x=rand(-5,5), y=rand(0.8,3.5);
    const mesh=mkSphere(x,y,-12,r,M.t1);
    G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now()});
  }
}
function spawn_vox_ts2() {
  const d=DIFF[G.diff];
  mkSwitchTargets([[-4,1.7,-10],[-1,2.5,-11],[2,1.2,-10],[4.5,2,-11]], tR(0.35), {mv:'switch_move', spd:d.spd*0.6});
  G.switchInterval = G.diff==='hard'?0.90:G.diff==='easy'?1.8:1.2;
}
function spawn_beants() {
  const d=DIFF[G.diff];
  mkSwitchTargets([[-3,2,-10],[3,2,-10]], tR(0.4), {mv:'switch_bounce', spd:d.spd*0.7});
  G.switchInterval = G.diff==='hard'?1.4:G.diff==='easy'?3.0:2;
}
function spawn_floatts() {
  const d=DIFF[G.diff];
  mkSwitchTargets([[-2,2.5,-10],[2,1.5,-10]], tR(0.45), {mv:'switch_float', spd:d.spd*0.5});
  G.switchInterval = G.diff==='hard'?1.6:G.diff==='easy'?3.5:2.5;
}
function spawn_waldots() {
  const d=DIFF[G.diff];
  mkSwitchTargets([[-3,1.5,-10],[0,2.8,-11],[3,1.8,-10]], tR(0.3), {mv:'switch_micro', spd:d.spd*0.3});
  G.switchInterval = G.diff==='hard'?1.2:G.diff==='easy'?2.5:1.8;
}
function spawn_devts() {
  const pos = [[-4,1.7,-10],[-2,2.5,-11],[0,1.5,-10],[2,2.5,-11],[4,1.7,-10]];
  mkSwitchTargets(pos, tR(0.35), {mv:'static', spd:0});
  G.switchInterval = G.diff==='hard'?0.75:G.diff==='easy'?1.5:1;
}
function spawn_domiswitch() {
  const d=DIFF[G.diff];
  mkSwitchTargets([[-3,1.7,-10],[3,1.7,-10]], tR(0.45), {mv:'switch_move', spd:d.spd});
  G.switchInterval = G.diff==='hard'?1.4:G.diff==='easy'?3.0:2;
}
function spawn_tamts() {
  const d=DIFF[G.diff];
  mkSwitchTargets([[-2,2,-10],[2,2,-10]], tR(0.4), {mv:'switch_smooth', spd:d.spd*0.4});
  G.switchInterval = G.diff==='hard'?2.0:G.diff==='easy'?4.0:3;
}

// ═══ CLICK TIMING SPAWNS ═══
// Pasu Reload: diagonal arc wall pattern, targets reload (respawn) after being clicked
function spawn_pasu_reload() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  const d=DIFF[G.diff];
  const maxT = G.diff==='hard' ? 3 : 5;
  if(G.targets.filter(t=>t.alive).length >= maxT) return;
  // Arc pattern positions — like Kovaaks 1wall5targets diagonal
  const wallZ = G.diff==='hard' ? -15 : G.diff==='easy' ? -11 : -13;
  const r = G.diff==='hard' ? rand(0.14,0.20) : G.diff==='easy' ? rand(0.22,0.32) : rand(0.13,0.2);
  const slots = [
    {x:-4.5,y:2.9},{x:-3,y:2.3},{x:-1.5,y:1.8},{x:0,y:1.55},{x:1.5,y:1.8},{x:3,y:2.3},{x:4.5,y:2.9},
    {x:-4,y:3.4},{x:4,y:3.4}
  ];
  const taken = new Set(G.targets.filter(t=>t.alive).map(t=>Math.round(t.mesh.position.x*2)));
  const free = slots.filter(p => !taken.has(Math.round(p.x*2)));
  const pos = free.length > 0 ? free[Math.floor(Math.random()*free.length)] : slots[Math.floor(Math.random()*slots.length)];
  const noise = G.diff==='hard' ? 0.08 : 0.18;
  const vx = rand(0.6,1.5)*(Math.random()<0.5?1:-1)*d.spd*0.18;
  const vy = rand(-0.4,0.4)*d.spd*0.1;
  const mesh=mkSphere(pos.x+rand(-noise,noise), pos.y+rand(-noise,noise), wallZ, r, M.t3);
  G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),vx,vy,dynamic:true});
}
function spawn_vt_bounceshot() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  const d=DIFF[G.diff];
  while(G.targets.filter(t=>t.alive).length < 4) {
    const r=rand(d.pR[0],d.pR[1]), x=rand(-5,5), y=rand(1,3);
    const mesh=mkSphere(x,y,-12,r,M.t2);
    const vx=rand(-3,3)*d.spd*0.2, vy=rand(-2,2)*d.spd*0.2;
    G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),vx,vy,dynamic:true,bounce:true});
  }
}
function spawn_ctrlsphere_clk() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  if(G.targets.filter(t=>t.alive).length >= 1) return;
  const r=rand(0.3,0.4), x=rand(-4,4), y=rand(1,3);
  const mesh=mkSphere(x,y,-11,r,M.t4);
  // Orbiting click target
  G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),dynamic:true,orbit:true,phase:rand(0,6.28),ox:x,oy:y});
}
function spawn_popcorn_mv() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  const d=DIFF[G.diff];
  if(G.targets.filter(t=>t.alive).length >= 5) return;
  const r=rand(d.pR[0],d.pR[1]);
  const x=rand(-5,5), baseY=rand(0.5,1.5);
  const mesh=mkSphere(x,baseY,rand(-11,-13),r,M.t2);
  G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),vy:rand(3,6),vx:rand(-1,1),dynamic:true,ttl:rand(0.8,1.8),age:0,pop:true});
}
function spawn_pasu_angelic() {
  if(!G.running) return;
  const d=DIFF[G.diff], sM=d.spd/2.5;
  G.targets=G.targets.filter(t=>t.alive);
  const maxT = G.diff==='hard'?6:G.diff==='easy'?3:4;
  while(G.targets.filter(t=>t.alive).length < maxT) {
    const r=rand(d.pR[0]*0.7,d.pR[1]*0.8), x=rand(-4,4), y=rand(1,3.5);
    const mesh=mkSphere(x,y,-13,r,M.t5);
    const vx=rand(-1.5,1.5)*sM, vy=rand(-1,1)*sM;
    G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),vx,vy,dynamic:true});
  }
}
function spawn_pasu_perfected() {
  if(!G.running) return;
  const d=DIFF[G.diff], sM=d.spd/2.5;
  G.targets=G.targets.filter(t=>t.alive);
  const maxT = G.diff==='hard'?5:G.diff==='easy'?2:3;
  while(G.targets.filter(t=>t.alive).length < maxT) {
    const r=rand(d.pR[0]*0.6,d.pR[1]*0.7), x=rand(-4,4), y=rand(1,3.5);
    const mesh=mkSphere(x,y,-14,r,M.t6);
    const vx=rand(-1,1)*sM, vy=rand(-0.8,0.8)*sM;
    G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),vx,vy,dynamic:true});
  }
}
function spawn_pasu_micro() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  while(G.targets.filter(t=>t.alive).length < 4) {
    const r=rand(0.2,0.3), x=rand(-5,5), y=rand(0.8,3.5);
    const mesh=mkSphere(x,y,-12,r,M.t1);
    const vx=rand(-2,2), vy=rand(-1.5,1.5);
    G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),vx,vy,dynamic:true});
  }
}
function spawn_floatheads_t() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  if(G.targets.filter(t=>t.alive).length >= 5) return;
  const r=rand(0.2,0.35), x=rand(-5,5);
  const mesh=mkSphere(x,0.3,rand(-11,-13),r,M.t1);
  G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),vy:rand(0.8,2),vx:rand(-0.3,0.3),dynamic:true,floater:true});
}
function spawn_vox_click() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  while(G.targets.filter(t=>t.alive).length < 3) {
    const r=rand(0.18,0.28), x=rand(-5,5), y=rand(0.8,3.5);
    const mesh=mkSphere(x,y,-12,r,M.t6);
    const vx=rand(-1.5,1.5), vy=rand(-1,1);
    G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now(),vx,vy,dynamic:true});
  }
}

// ============ COURS DRILL MODES ============

// Crosshair Placement Drill: targets appear at head height at fixed positions (like angles/corners)
function spawn_crosshair_drill() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  if(G.targets.filter(t=>t.alive).length >= 1) return;
  const d=DIFF[G.diff];
  // Head height = 1.7m, simulate peeking angles
  const headY = 1.7;
  const positions = [
    {x:-6,z:-12},{x:-4,z:-14},{x:-2,z:-10},{x:0,z:-13},{x:2,z:-11},
    {x:4,z:-14},{x:6,z:-12},{x:-5,z:-8},{x:5,z:-9},{x:-3,z:-15},
    {x:3,z:-15},{x:0,z:-8},{x:-6,z:-10},{x:6,z:-10}
  ];
  const pos = positions[Math.floor(Math.random()*positions.length)];
  const r = G.diff==='easy' ? 0.25 : G.diff==='hard' ? 0.15 : 0.2;
  const yOff = G.diff==='hard' ? rand(-0.2,0.2) : rand(-0.1,0.1); // slight variation
  const mesh = mkSphere(pos.x, headY + yOff, pos.z, r, M.t1);
  G.targets.push({mesh, alive:true, radius:r, spawnTime:Date.now()});
}

// Deadzone Drill: tracking target with direction changes + camera sway to simulate movement inaccuracy
function spawn_deadzone_drill() {
  if(!G.running) return;
  if(trackTarget && trackTarget.alive) return;
  const r = G.diff==='easy' ? 0.5 : G.diff==='hard' ? 0.28 : 0.38;
  const spd = G.diff==='easy' ? 1.5 : G.diff==='hard' ? 4.5 : 3;
  G.swayPhase = 0;
  mkTrackTarget(0, 1.7, -11, r, M.t4, {mv:'deadzone_drill', vx:rand(-1,1)*spd, vy:0, ct:0, nc:0.6+rand(0,0.5)});
}

// Burst Drill: targets requiring multiple hits (hold click to fire, spray pattern rises)
function spawn_burst_drill() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  if(G.targets.filter(t=>t.alive).length >= 1) return;
  const hp = G.diff==='easy' ? 3 : G.diff==='hard' ? 6 : 4;
  const r = G.diff==='easy' ? 0.3 : G.diff==='hard' ? 0.2 : 0.24;
  const spd = G.diff==='hard' ? 1.2 : G.diff==='medium' ? 0.6 : 0;
  const x = rand(-4,4), y = rand(1.2,2.8);
  const mesh = mkSphere(x, y, rand(-11,-13), r, M.t2);
  G.targets.push({mesh, alive:true, radius:r, spawnTime:Date.now(), hp, maxHp:hp,
    vx:spd?rand(-1,1)*spd:0, vy:spd?rand(-0.3,0.3)*spd:0, dynamic:spd>0, bounce:true});
}

// Strafe Drill: single tracking target at head height, pure horizontal movement
function spawn_strafe_drill() {
  if(!G.running) return;
  if(trackTarget && trackTarget.alive) return;
  const r = G.diff==='easy' ? 0.38 : G.diff==='hard' ? 0.2 : 0.28;
  const spd = G.diff==='easy' ? 1.5 : G.diff==='hard' ? 4.0 : 2.5;
  const dir = Math.random()>0.5?1:-1;
  mkTrackTarget(0, 1.7, -11, r, M.t4, {mv:'strafe_drill', vx:dir*spd, vy:0, ct:0});
}

// Reaction Drill: target appears at random position and auto-expires if not clicked in time
function spawn_reaction_drill() {
  if(!G.running) return;
  G.targets = G.targets.filter(t=>t.alive);
  if(G.targets.filter(t=>t.alive).length >= 1) return;
  const r = G.diff==='easy' ? 0.28 : G.diff==='hard' ? 0.16 : 0.21;
  const ttl = G.diff==='easy' ? 1.3 : G.diff==='hard' ? 0.55 : 0.85;
  const x = rand(-5,5), y = 1.7 + rand(-0.6,0.6);
  const mesh = mkSphere(x, y, rand(-10,-13), r, M.t3);
  G.targets.push({mesh, alive:true, radius:r, spawnTime:Date.now(), dynamic:true, reaction:true, ttl});
}

// Micro Precision Drill: very small static targets at varying angles — pure precision
function spawn_micro_drill() {
  if(!G.running) return;
  G.targets = G.targets.filter(t=>t.alive);
  if(G.targets.filter(t=>t.alive).length >= 1) return;
  const r = G.diff==='easy' ? 0.13 : G.diff==='hard' ? 0.06 : 0.09;
  const angles = [{x:-6,z:-12},{x:-5,z:-10},{x:-4,z:-13},{x:-2,z:-11},{x:0,z:-14},
    {x:2,z:-11},{x:4,z:-13},{x:5,z:-10},{x:6,z:-12},{x:-7,z:-9},{x:7,z:-9}];
  const pos = angles[Math.floor(Math.random()*angles.length)];
  const mesh = mkSphere(pos.x, 1.7+rand(-0.05,0.05), pos.z, r, M.t1);
  G.targets.push({mesh, alive:true, radius:r, spawnTime:Date.now()});
}

// Free play only — grille 3×3 fixe, 3 boules actives sur 9 cases
const GRIDSHOT_COLS=3, GRIDSHOT_ROWS=3, GRIDSHOT_ACTIVE=3;

// Positions exactes des 9 cases (fixes, pas d'offset)
function _gridPos(col, row) {
  return { x:(col-1)*3.2, y:0.9+row*1.55 };  // -3.2/0/3.2 × 0.9/2.45/4.0
}

function _mkGridTarget(col, row, r) {
  const {x,y} = _gridPos(col, row);
  const mesh = mkSphere(x, y, -11.5, r, M.t2);
  mesh.scale.setScalar(0.01);
  return { mesh, alive:true, radius:r, spawnTime:Date.now(),
    _cell:`${col},${row}`, baseX:x, baseY:y,
    scaleIn:true, scaleProgress:0 };
}

function spawn_gridshot() {
  if(!G.running) return;
  // Nettoyer
  G.targets.forEach(t=>{if(t.alive){t.alive=false;targetsGroup.remove(t.mesh);}});
  G.targets=[];
  // Indicateurs de grille (très discrets) pour visualiser les 9 cases
  if(!G._gridDots) G._gridDots=[];
  G._gridDots.forEach(m=>roomGroup.remove(m)); G._gridDots=[];
  const rDot = DIFF[G.diff].gR * 0.22;
  for(let ro=0;ro<GRIDSHOT_ROWS;ro++) for(let co=0;co<GRIDSHOT_COLS;co++) {
    const {x,y}=_gridPos(co,ro);
    const dot=new THREE.Mesh(new THREE.SphereGeometry(rDot,8,6),
      new THREE.MeshBasicMaterial({color:0x444444,transparent:true,opacity:0.35}));
    dot.position.set(x,y,-11.5); roomGroup.add(dot); G._gridDots.push(dot);
  }
  // 3 boules actives aléatoires
  const r=DIFF[G.diff].gR;
  const cells=[];
  for(let ro=0;ro<GRIDSHOT_ROWS;ro++) for(let co=0;co<GRIDSHOT_COLS;co++) cells.push([co,ro]);
  for(let i=cells.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
  cells.slice(0,GRIDSHOT_ACTIVE).forEach(([co,ro])=>G.targets.push(_mkGridTarget(co,ro,r)));
}

function _respawnGridshotCell() {
  // Réapparition dans une case libre aléatoire
  if(!G.running) return;
  const r=DIFF[G.diff].gR;
  const occupied=new Set(G.targets.filter(t=>t.alive).map(t=>t._cell));
  const free=[];
  for(let ro=0;ro<GRIDSHOT_ROWS;ro++) for(let co=0;co<GRIDSHOT_COLS;co++) {
    const k=`${co},${ro}`; if(!occupied.has(k)) free.push([co,ro]);
  }
  if(!free.length) return;
  const [col,row]=free[Math.floor(Math.random()*free.length)];
  G.targets.push(_mkGridTarget(col,row,r));
}

function updateGridshot(dt) {
  if(!G.running) return;
  const t0=Date.now()/1000;
  G.targets.forEach(t=>{
    if(!t.alive) return;
    // Pop-in animation
    if(t.scaleIn) {
      t.scaleProgress = Math.min(1, (t.scaleProgress||0) + dt*10);
      const s = t.scaleProgress < 0.7
        ? t.scaleProgress/0.7
        : 1 + 0.12*Math.sin((t.scaleProgress-0.7)/0.3*Math.PI);
      t.mesh.scale.setScalar(s);
      if(t.scaleProgress>=1) { t.mesh.scale.setScalar(1); t.scaleIn=false; }
    }
    // Positions fixes — pas de drift
  });
}
function spawn_speedflick() {
  if(!G.running) return;
  G.targets=G.targets.filter(t=>t.alive);
  if(G.targets.filter(t=>t.alive).length >= 1) return;
  const d=DIFF[G.diff], r=rand(d.tR[0],d.tR[1]);
  const a=rand(-0.8,0.8), va=rand(-0.3,0.35), dist=rand(8,13);
  const x=Math.max(-7, Math.min(7, Math.sin(a)*dist));
  const y=Math.max(0.5, Math.min(3.8, 1.7+Math.tan(va)*dist));
  const z=Math.min(-5, -Math.abs(Math.cos(a)*dist));
  const mesh=mkSphere(x,y,z,r,M.t1);
  G.targets.push({mesh,alive:true,radius:r,spawnTime:Date.now()});
}

// ============================================================
// UPDATE FUNCTIONS
// ============================================================

function updateTrackTarget(dt) {
  if(!trackTarget||!trackTarget.alive) return;
  const t=trackTarget, d=DIFF[G.diff], spd=d.spd;
  // Amplitude modifier: easy=wider range, hard=tighter but faster
  const tA = G.diff==='easy'?1.3:G.diff==='hard'?0.72:1.0;
  t.phase = (t.phase||0) + dt;

  switch(t.mv) {
    // ═══ CONTROL TRACKING — ARM ═══

    case 'whisphereraw':
      // 3D Elliptical Orbit — target orbits a center point in 3D, radius pulses over time
      { const orbitSpd = G.diff==='hard'?0.50:G.diff==='easy'?0.22:0.35;
        const pulseInt = G.diff==='hard'?1.4:G.diff==='easy'?3.2:2.2;
        const rMin = G.diff==='hard'?3.0:G.diff==='easy'?2.0:2.5;
        const rMax = G.diff==='hard'?6.0:G.diff==='easy'?4.5:5.5;
        t.orbitAngle += dt * spd * orbitSpd;
        t.orbitRTarget = t.orbitRTarget || 4;
        t.orbitR += (t.orbitRTarget - t.orbitR) * dt * 1.5;
        t.orbitPulse = (t.orbitPulse||0) + dt;
        if(t.orbitPulse > pulseInt) { t.orbitPulse = 0; t.orbitRTarget = rand(rMin,rMax)*tA; }
        const ecc = G.diff==='hard'?0.75:G.diff==='easy'?0.45:0.6;
        t.x = Math.cos(t.orbitAngle) * t.orbitR * tA;
        t.z = -10 + Math.sin(t.orbitAngle) * t.orbitR * ecc * tA;
        t.y = 1.7 + Math.sin(t.orbitAngle * 0.7) * 1.3 * tA + Math.sin(t.phase * spd * 0.12) * 0.5;
      }
      break;

    case 'whisphere':
      // Double Pendulum (chaotic) — simulated, produces unpredictable but smooth motion
      { const dpSpd = G.diff==='hard'?0.6:G.diff==='easy'?0.25:0.4;
        const dpAmp = G.diff==='hard'?3.8:G.diff==='easy'?2.6:3.2;
        const dpYAmp = G.diff==='hard'?1.7:G.diff==='easy'?1.1:1.4;
        const L1 = G.diff==='hard'?1.1:G.diff==='easy'?0.9:1.0;
        const L2 = G.diff==='hard'?0.9:G.diff==='easy'?0.7:0.8;
        t.dpT = (t.dpT||0) + dt * spd * dpSpd;
        const fm1 = Math.sin(t.dpT * 0.13) * 0.5;
        const fm2 = Math.cos(t.dpT * 0.09) * 0.7;
        const a1 = Math.sin(t.dpT * (0.7 + fm1)) * 1.8;
        const a2 = Math.sin(t.dpT * (1.1 + fm2) + a1 * 0.6) * 1.3;
        const px = L1 * Math.sin(a1) + L2 * Math.sin(a1 + a2);
        const py = -L1 * Math.cos(a1) - L2 * Math.cos(a1 + a2);
        t.x = px * dpAmp * tA;
        t.y = 1.7 + py * dpYAmp * tA;
        t.z = -10 + Math.sin(t.dpT * 0.17) * 1.5 * tA;
      }
      break;

    case 'smoothbot':
      // Realistic AD-AD Strafe — acceleration/deceleration like a real FPS player
      { const maxSpd = spd * (G.diff==='hard'?1.3:G.diff==='easy'?0.7:1.0);
        const accel = maxSpd * 5.5; // Fast acceleration (like counter-strafe)
        const decel = maxSpd * 4.0;
        // Pick a new strafe target periodically
        t.strafeCd = (t.strafeCd||0) + dt;
        const cdTime = G.diff==='hard'?0.4:G.diff==='easy'?1.0:0.65;
        if(t.strafeCd > cdTime + (t.strafeCdExtra||0)) {
          t.strafeCd = 0;
          t.strafeCdExtra = rand(0, cdTime * 0.8);
          // Decide: full reverse, stop, or jiggle
          const r = Math.random();
          if(r < 0.5) t.strafeTarget = -Math.sign(t.strafeVx||1) * rand(maxSpd*0.7, maxSpd);
          else if(r < 0.75) t.strafeTarget = 0; // counter-strafe stop
          else t.strafeTarget = (t.strafeVx||0) + rand(-maxSpd*0.3, maxSpd*0.3); // jiggle
          // Occasional crouch
          if(Math.random() < 0.25) t.crouchTarget = rand(0.8, 1.2);
          else t.crouchTarget = rand(1.5, 1.9);
        }
        // Accelerate toward target velocity (feels like real movement)
        const diff = (t.strafeTarget||0) - (t.strafeVx||0);
        if(Math.abs(diff) > 0.1) {
          t.strafeVx = (t.strafeVx||0) + Math.sign(diff) * Math.min(accel * dt, Math.abs(diff));
        } else { t.strafeVx = t.strafeTarget||0; }
        // Crouch interpolation (smooth)
        t.crouchY = (t.crouchY||1.7) + ((t.crouchTarget||1.7) - (t.crouchY||1.7)) * dt * 6;
        t.x += (t.strafeVx||0) * dt;
        t.y = t.crouchY;
        // Wall bounce
        if(t.x > 5.5) { t.x = 5.5; t.strafeVx = -Math.abs(t.strafeVx)*0.5; t.strafeTarget = -Math.abs(t.strafeTarget); }
        if(t.x < -5.5) { t.x = -5.5; t.strafeVx = Math.abs(t.strafeVx)*0.5; t.strafeTarget = Math.abs(t.strafeTarget); }
      }
      break;

    // ═══ CONTROL TRACKING — WRIST ═══

    case 'leaptrack':
      // Leaptrack: jumps to a new position, then drifts slowly (kept — already unique)
      t.jumpTimer = (t.jumpTimer||0) + dt;
      { const leapInt = G.diff==='hard'?0.65:G.diff==='easy'?1.35:0.95;
        const xRange = G.diff==='hard'?3.5:G.diff==='easy'?5.5:4.5;
        const yLo   = G.diff==='hard'?1.1:G.diff==='easy'?0.6:0.8;
        const yHi   = G.diff==='hard'?2.8:G.diff==='easy'?3.3:3.0;
        if(t.jumpTimer > leapInt) {
          t.jumpTimer=0;
          t.x = rand(-xRange, xRange);
          t.y = rand(yLo, yHi);
          t.vx = rand(-0.5,0.5)*spd*0.4;
          t.vy = rand(-0.3,0.3)*spd*0.3;
        }
        t.x = Math.max(-5.5,Math.min(5.5, t.x + (t.vx||0)*dt));
        t.y = Math.max(0.5, Math.min(3.5, t.y + (t.vy||0)*dt));
      }
      break;

    case 'ctrlsphere_aim':
      // Expanding/Contracting Spiral — radius pulses while angle advances, creates hypnotic spiral
      { const spdMult = G.diff==='hard'?1.3:G.diff==='easy'?0.7:1.0;
        const pulseMult = G.diff==='hard'?0.22:G.diff==='easy'?0.10:0.15;
        t.spiralAngle += dt * spd * 0.6 * spdMult;
        t.spiralPulse += dt * spd * pulseMult;
        // Radius range scales with difficulty: hard = wider swings, easy = tighter
        const rMin = (G.diff==='hard'?0.3:G.diff==='easy'?0.8:0.5)*tA;
        const rMax = (G.diff==='hard'?3.8:G.diff==='easy'?2.5:3.2)*tA;
        t.spiralR = rMin + (rMax-rMin) * (0.5 + 0.5*Math.sin(t.spiralPulse));
        t.x = Math.cos(t.spiralAngle) * t.spiralR;
        t.y = 1.7 + Math.sin(t.spiralAngle) * t.spiralR * 0.45;
        t.z = -10 + Math.sin(t.spiralAngle * 0.5) * 1.5 * tA;
      }
      break;

    case 'vt_ctrlsphere':
      // Guided Brownian Motion — random walk with central attractor (looks organic/alive)
      { const spdMult = G.diff==='hard'?1.4:G.diff==='easy'?0.65:1.0;
        const attract = G.diff==='hard'?1.8:G.diff==='easy'?2.8:2.2;
        // Random impulses at varying intervals
        t.attractTimer = (t.attractTimer||0) + dt;
        const impulseRate = G.diff==='hard'?0.08:G.diff==='easy'?0.18:0.12;
        if(t.attractTimer > impulseRate) {
          t.attractTimer = 0;
          // Random nudge
          t.bvx += rand(-1,1) * spd * spdMult * 0.6;
          t.bvy += rand(-0.5,0.5) * spd * spdMult * 0.4;
        }
        // Attractor pulls back toward a drifting center
        t.attractX = (t.attractX||0) + Math.sin(t.phase*0.3)*dt*0.5;
        t.attractY = 1.7 + Math.sin(t.phase*0.2)*0.4;
        t.bvx += ((t.attractX||0) - (t.bx||0)) * attract * dt;
        t.bvy += ((t.attractY||1.7) - (t.by||1.7)) * attract * dt;
        // Damping (friction)
        t.bvx *= Math.exp(-2.5*dt);
        t.bvy *= Math.exp(-2.5*dt);
        // Clamp speed
        const maxV = spd * 1.5;
        const curV = Math.sqrt(t.bvx*t.bvx + t.bvy*t.bvy);
        if(curV > maxV) { t.bvx *= maxV/curV; t.bvy *= maxV/curV; }
        t.bx = (t.bx||0) + t.bvx * dt;
        t.by = (t.by||1.7) + t.bvy * dt;
        // Soft bounds
        t.bx = Math.max(-4*tA, Math.min(4*tA, t.bx));
        t.by = Math.max(0.6, Math.min(3.0, t.by));
        t.x = t.bx; t.y = t.by;
        t.z = -10 + Math.sin(t.phase*0.25)*(G.diff==='hard'?1.2:G.diff==='easy'?0.4:0.8);
      }
      break;

    // ═══ CONTROL TRACKING — FINGERTIP ═══

    case 'air_angelic':
      // Air Angelic: graceful 3D floating with 6 independent sine terms — micro-tracking in 3D
      { const fMult = G.diff==='hard'?1.3:G.diff==='easy'?0.7:1.0;  // frequency multiplier
        const aMult = G.diff==='hard'?1.15:G.diff==='easy'?0.8:1.0; // amplitude multiplier
        t.x = Math.sin(t.phase*spd*0.18*fMult)*1.8*tA*aMult + Math.sin(t.phase*spd*0.31*fMult)*0.6*tA*aMult;
        t.y = 2 + Math.sin(t.phase*spd*0.14*fMult)*0.7*tA*aMult + Math.cos(t.phase*spd*0.22*fMult)*0.25*tA;
        t.z = -10 + Math.cos(t.phase*spd*0.11*fMult)*1.6*tA + Math.sin(t.phase*spd*0.19*fMult)*0.5*tA;
      }
      break;

    case 'cloverraw':
      // Lissajous Clover figure-8 pattern — predictable path but requires smooth tracking
      { const fMult = G.diff==='hard'?1.25:G.diff==='easy'?0.75:1.0;
        const xAmp = G.diff==='hard'?4.0:G.diff==='easy'?2.8:3.5;
        const yAmp = G.diff==='hard'?1.7:G.diff==='easy'?1.1:1.4;
        const freq = spd*0.22*fMult;
        t.x = Math.sin(2*t.phase*freq)*xAmp*tA;
        t.y = 1.7 + Math.sin(t.phase*freq)*yAmp*tA;
        t.z = -10 + Math.cos(t.phase*freq*1.3)*0.6*tA;
      }
      break;

    case 'ctrlsphere_far':
      // Flyby Arc — target makes wide passes like an aircraft, far away, smooth curves
      { const arcSpd = spd * (G.diff==='hard'?0.45:G.diff==='easy'?0.25:0.35);
        t.arcAngle += dt * arcSpd * (t.arcDir||1);
        // Figure-of-8 flyby at far distance
        const progress = t.arcAngle;
        t.x = Math.sin(progress) * 5 * tA;
        t.passPhase = (t.passPhase||0) + dt * arcSpd * 0.7;
        t.y = 1.7 + Math.sin(t.passPhase) * 1.2 * tA;
        // Depth varies — comes closer on passes, farther on turns
        t.z = -14 + Math.cos(progress * 2) * 3 * tA;
        // Occasionally reverse direction for unpredictability
        t.arcRev = (t.arcRev||0) + dt;
        if(t.arcRev > (G.diff==='hard'?3:G.diff==='easy'?6:4.5)) {
          t.arcRev = 0;
          if(Math.random() < 0.4) t.arcDir *= -1;
        }
      }
      break;

    // ═══ CONTROL TRACKING — BLENDING ═══

    case 'pgti':
      // PGT Invincible: smooth base + reactive kicks (kept — already distinctive)
      { const baseX = Math.sin(t.phase*spd*0.28)*4.2*tA + Math.sin(t.phase*spd*0.47)*0.9*tA;
        const baseY = 1.7 + Math.sin(t.phase*spd*0.22)*1.4*tA;
        t.kTimer = (t.kTimer||0) + dt;
        const kBase = G.diff==='hard'?0.7:G.diff==='easy'?2.5:1.5;
        const kRange = G.diff==='hard'?1.1:G.diff==='easy'?2.0:1.5;
        if(t.kTimer > (t.kInt||kBase)) { t.kTimer=0; t.kInt=kBase+Math.random()*kRange; t.kx=rand(-1,1)*spd*0.5; t.ky=rand(-0.4,0.4)*spd*0.3; }
        t.kx = (t.kx||0)*Math.exp(-3*dt); t.ky = (t.ky||0)*Math.exp(-3*dt);
        t.x = baseX + t.kx;
        t.y = baseY + t.ky;
        t.z = -10 + Math.cos(t.phase*spd*0.18)*2*tA;
      }
      break;

    case 'air_celestial':
      // Zipline Elevator — rises/descends with lateral drift, like riding a zipline or elevator
      { const zipSpd = spd * (G.diff==='hard'?1.2:G.diff==='easy'?0.6:0.9);
        // State machine: descend → drift → ascend → drift
        t.zipTimer = (t.zipTimer||0) + dt;
        const driftLen = G.diff==='hard'?1.2:G.diff==='easy'?2.5:1.8;
        const riseLen = G.diff==='hard'?1.5:G.diff==='easy'?2.8:2.0;
        switch(t.zipPhase) {
          case 'descend':
            t.zipVy = -zipSpd * 0.5;
            t.zipVx = (t.zipDrift||0);
            if(t.zipY <= 0.7 || t.zipTimer > riseLen) { t.zipPhase='drift_low'; t.zipTimer=0; t.zipDrift=rand(-1,1)*zipSpd*0.6; }
            break;
          case 'drift_low':
            t.zipVy = Math.sin(t.phase*1.5)*0.15;
            t.zipVx = (t.zipDrift||0) + Math.sin(t.phase*0.8)*zipSpd*0.3;
            if(t.zipTimer > driftLen) { t.zipPhase='ascend'; t.zipTimer=0; }
            break;
          case 'ascend':
            t.zipVy = zipSpd * 0.55;
            t.zipVx = (t.zipDrift||0);
            if(t.zipY >= 3.2 || t.zipTimer > riseLen) { t.zipPhase='drift_high'; t.zipTimer=0; t.zipDrift=rand(-1,1)*zipSpd*0.6; }
            break;
          case 'drift_high':
            t.zipVy = Math.sin(t.phase*1.2)*0.15;
            t.zipVx = (t.zipDrift||0) + Math.cos(t.phase*0.9)*zipSpd*0.3;
            if(t.zipTimer > driftLen) { t.zipPhase='descend'; t.zipTimer=0; }
            break;
        }
        t.zipX = (t.zipX||0) + (t.zipVx||0)*dt;
        t.zipY = (t.zipY||2) + (t.zipVy||0)*dt;
        // Bounds
        t.zipX = Math.max(-5.5*tA, Math.min(5.5*tA, t.zipX));
        t.zipY = Math.max(0.5, Math.min(3.5, t.zipY));
        if(Math.abs(t.zipX) >= 5.5*tA) t.zipDrift *= -0.8;
        t.x = t.zipX; t.y = t.zipY;
        t.z = -10 + Math.sin(t.phase*0.2)*1.5*tA;
      }
      break;

    case 'whisphere_slow':
      // Random Bézier Curves — follows randomly generated smooth curves, never the same path twice
      { const bezSpd = spd * (G.diff==='hard'?0.45:G.diff==='easy'?0.2:0.3);
        // Generate new Bézier control points when needed
        if(!t.bezPts || t.bezT >= 1) {
          const prev = t.bezPts ? { x:t.bezPts.x3, y:t.bezPts.y3 } : { x:0, y:1.7 };
          const x3 = rand(-5,5)*tA, y3 = rand(0.6,3.2);
          // Control points create smooth continuation from previous endpoint
          const cx1 = prev.x + rand(-2,2)*tA, cy1 = prev.y + rand(-0.8,0.8);
          const cx2 = x3 + rand(-2,2)*tA, cy2 = y3 + rand(-0.8,0.8);
          t.bezPts = { x0:prev.x, y0:prev.y, cx1, cy1, cx2, cy2, x3, y3 };
          t.bezT = 0;
        }
        t.bezT += dt * bezSpd;
        if(t.bezT > 1) t.bezT = 1;
        // Cubic Bézier interpolation
        const u = t.bezT, u2=u*u, u3=u2*u;
        const c0=(1-u)*(1-u)*(1-u), c1=3*(1-u)*(1-u)*u, c2=3*(1-u)*u2, c3=u3;
        const bp = t.bezPts;
        t.x = c0*bp.x0 + c1*bp.cx1 + c2*bp.cx2 + c3*bp.x3;
        t.y = c0*bp.y0 + c1*bp.cy1 + c2*bp.cy2 + c3*bp.y3;
        // Clamp
        t.x = Math.max(-6*tA, Math.min(6*tA, t.x));
        t.y = Math.max(0.5, Math.min(3.5, t.y));
        t.z = -10 + Math.sin(t.phase*0.15)*1.5*tA;
      }
      break;

    // ═══ REACTIVE TRACKING ═══

    case 'ground_plaza':
      // Ground Plaza: ground-level strafing (kept — already unique with locked Y)
      t.ct = (t.ct||0)+dt;
      { const ncMin = G.diff==='hard'?0.5:G.diff==='easy'?1.0:0.6;
        const ncMax = G.diff==='hard'?1.0:G.diff==='easy'?2.0:1.4;
        if(t.ct >= (t.nc||ncMax)) {
          t.ct=0; t.nc=rand(ncMin,ncMax);
          const vMult = G.diff==='hard'?1.1:G.diff==='easy'?0.6:0.85;
          t.vx = rand(-1,1)*spd*vMult;
          t.vx += (Math.random()>0.5?1:-1)*spd*0.12;
        }
        t.x += (t.vx||0)*dt;
        t.y = 0.8 + Math.sin(Date.now()*0.0035)*0.12;
        t.x = Math.max(-6.5, Math.min(6.5, t.x));
        if(t.x >= 6.5 || t.x <= -6.5) t.vx *= -1;
      }
      break;

    case 'ctrlsphere_ow':
      // ADAD + Crouch Spam — realistic OW strafing with sudden crouch dips
      t.ct = (t.ct||0)+dt;
      { const ncMin = G.diff==='hard'?0.35:G.diff==='easy'?0.9:0.55;
        const ncMax = G.diff==='hard'?0.75:G.diff==='easy'?1.6:1.1;
        if(t.ct >= (t.nc||ncMax)) {
          t.ct=0; t.nc=rand(ncMin,ncMax);
          const vMult = G.diff==='hard'?1.1:G.diff==='easy'?0.6:0.85;
          // ADAD: reverse or change strafe direction
          const r = Math.random();
          if(r < 0.6) t.vx = -Math.sign(t.vx||1) * rand(0.5,1)*spd*vMult; // counter-strafe
          else t.vx = rand(-1,1)*spd*vMult; // random new direction
        }
        // Crouch system: independent timer, sudden dips
        t.crouchTimer = (t.crouchTimer||0) + dt;
        const crouchCd = G.diff==='hard'?0.6:G.diff==='easy'?1.5:1.0;
        if(t.crouchTimer > crouchCd) {
          t.crouchTimer = 0;
          if(Math.random() < 0.45) {
            t.crouchState = 'crouch';
            t.crouchY = 0.9; // head dips to knee level
          } else {
            t.crouchState = 'stand';
            t.crouchY = 1.7;
          }
        }
        // Smooth crouch interpolation
        const targetCY = t.crouchState==='crouch' ? 0.9 : 1.7;
        t.crouchY = t.crouchY + (targetCY - t.crouchY) * Math.min(1, dt * 12);
        t.x += (t.vx||0)*dt;
        t.y = t.crouchY;
        t.x = Math.max(-5.5, Math.min(5.5, t.x));
        if(t.x >= 5.5 || t.x <= -5.5) t.vx *= -1;
      }
      break;

    case 'flicker_plaza':
      // Flicker Plaza: teleports to new position at rapid intervals (kept — already unique)
      t.ct = (t.ct||0)+dt;
      { const ncMin = G.diff==='hard'?0.22:G.diff==='easy'?0.55:0.3;
        const ncMax = G.diff==='hard'?0.5:G.diff==='easy'?1.0:0.7;
        const xRange = G.diff==='hard'?4.5:G.diff==='easy'?6.0:5.5;
        const yMin  = G.diff==='hard'?1.2:G.diff==='easy'?0.8:1.0;
        const yMax  = G.diff==='hard'?3.0:G.diff==='easy'?3.4:3.2;
        if(t.ct >= (t.nc||ncMax)) {
          t.ct=0; t.nc=rand(ncMin,ncMax);
          t.x = rand(-xRange, xRange);
          t.y = rand(yMin, yMax);
          t.vx=0; t.vy=0;
        }
        t.x += (t.vx||0)*dt; t.y += (t.vy||0)*dt;
        t.x = Math.max(-6, Math.min(6, t.x));
        t.y = Math.max(0.4, Math.min(3.6, t.y));
      }
      break;

    case 'polarized_hell':
      // Zigzag Angular — sharp 45°/90° direction changes instead of random angles, very snappy
      t.ct = (t.ct||0)+dt;
      { const ncMin = G.diff==='hard'?0.15:G.diff==='easy'?0.4:0.18;
        const ncMax = G.diff==='hard'?0.35:G.diff==='easy'?0.75:0.45;
        if(t.ct >= (t.nc||ncMax)) {
          t.ct=0; t.nc=rand(ncMin,ncMax);
          // Pick from fixed angles: 0, 45, 90, 135, 180, 225, 270, 315
          const angles = [0, Math.PI/4, Math.PI/2, Math.PI*3/4, Math.PI, Math.PI*5/4, Math.PI*3/2, Math.PI*7/4];
          // Bias toward angles that are 90° or 135° from current (sharp turns)
          const prevAng = t.zigAngle || 0;
          const offsets = [Math.PI/2, Math.PI*3/4, -Math.PI/2, -Math.PI*3/4, Math.PI];
          const newAng = prevAng + offsets[Math.floor(Math.random()*offsets.length)];
          t.zigAngle = newAng;
          const mag = spd*(G.diff==='hard'?1.3:G.diff==='easy'?0.7:1.0);
          t.vx = Math.cos(newAng)*mag;
          t.vy = Math.sin(newAng)*mag*0.55;
        }
        t.x += (t.vx||0)*dt; t.y += (t.vy||0)*dt;
        t.x = Math.max(-6, Math.min(6, t.x));
        t.y = Math.max(0.5, Math.min(3.5, t.y));
        if(t.x >= 6 || t.x <= -6) { t.vx *= -1; t.zigAngle = Math.PI - t.zigAngle; }
        if(t.y >= 3.5 || t.y <= 0.5) { t.vy *= -1; t.zigAngle = -t.zigAngle; }
      }
      break;

    case 'air_pure':
      // Physics Bounce — real ball physics with gravity, bounces off floor/walls, loses energy then relaunches
      { const grav = G.diff==='hard'?5.5:G.diff==='easy'?3.5:4.5;
        const bounceE = G.diff==='hard'?0.82:G.diff==='easy'?0.92:0.85;
        const maxVx = spd * (G.diff==='hard'?1.8:G.diff==='easy'?1.1:1.5);
        const launchForce = G.diff==='hard'?1.2:G.diff==='easy'?0.8:1.0;
        const nudgeInt = G.diff==='hard'?1.5:G.diff==='easy'?4:3;
        const nudgeStr = G.diff==='hard'?0.6:G.diff==='easy'?0.25:0.4;
        const xBound = G.diff==='hard'?6.5:G.diff==='easy'?5:6;
        // Apply gravity
        t.bvy = (t.bvy||0) - grav * dt;
        t.bx = (t.bx||0) + (t.bvx||1.5) * dt;
        t.by = (t.by||2) + t.bvy * dt;
        // Floor bounce
        if(t.by <= 0.5) {
          t.by = 0.5;
          t.bvy = Math.abs(t.bvy) * bounceE;
          if(Math.abs(t.bvy) < 0.8) {
            t.bvy = rand(3,5) * launchForce;
            t.bvx = rand(-1,1) * spd * 0.8;
          }
        }
        // Ceiling bounce
        if(t.by >= 3.8) { t.by = 3.8; t.bvy = -Math.abs(t.bvy)*bounceE; }
        // Wall bounce
        if(t.bx >= xBound) { t.bx = xBound; t.bvx = -Math.abs(t.bvx)*0.95; }
        if(t.bx <= -xBound) { t.bx = -xBound; t.bvx = Math.abs(t.bvx)*0.95; }
        // Occasional horizontal nudge
        t.ct = (t.ct||0)+dt;
        if(t.ct > (t.nc||nudgeInt)) {
          t.ct=0; t.nc = rand(nudgeInt*0.6, nudgeInt*1.4);
          t.bvx += rand(-1,1)*spd*nudgeStr;
          t.bvx = Math.max(-maxVx, Math.min(maxVx, t.bvx));
        }
        t.x = t.bx; t.y = t.by;
      }
      break;

    case 'air_voltaic':
      // Dash + Hover — fast dash in a direction, then slow hover/float, then dash again
      { const dashSpd = spd * (G.diff==='hard'?1.8:G.diff==='easy'?1.0:1.4);
        const hoverSpd = spd * 0.15;
        t.dashTimer = (t.dashTimer||0) + dt;
        const dashDur = G.diff==='hard'?0.18:G.diff==='easy'?0.35:0.25;
        const hoverDur = G.diff==='hard'?0.5:G.diff==='easy'?1.2:0.8;
        if(t.dashState === 'dash') {
          t.x += (t.dashVx||0)*dt;
          t.y += (t.dashVy||0)*dt;
          // Decelerate during dash
          t.dashVx *= Math.exp(-2*dt);
          t.dashVy *= Math.exp(-2*dt);
          if(t.dashTimer > dashDur) {
            t.dashState = 'hover';
            t.dashTimer = 0;
            t.hoverX = t.x; t.hoverY = t.y;
          }
        } else {
          // Hover: gentle floating around the dash endpoint
          t.x = (t.hoverX||0) + Math.sin(t.phase*1.5)*0.4*tA;
          t.y = (t.hoverY||2) + Math.cos(t.phase*1.2)*0.25*tA;
          if(t.dashTimer > hoverDur) {
            t.dashState = 'dash';
            t.dashTimer = 0;
            // Pick a new dash direction (away from current position for variety)
            const ang = Math.random()*Math.PI*2;
            t.dashVx = Math.cos(ang)*dashSpd;
            t.dashVy = Math.sin(ang)*dashSpd*0.5;
          }
        }
        // Bounds
        t.x = Math.max(-6, Math.min(6, t.x));
        t.y = Math.max(0.5, Math.min(3.5, t.y));
        if(Math.abs(t.x) >= 6) { t.dashVx *= -1; t.hoverX = t.x; }
        if(t.y >= 3.5 || t.y <= 0.5) { t.dashVy *= -1; t.hoverY = t.y; }
      }
      break;
    case 'deadzone_drill':
      // Target moves with direction changes
      t.ct = (t.ct||0)+dt;
      if(t.ct >= (t.nc||0.8)) {
        t.ct=0; t.nc=0.3+rand(0,0.7);
        t.vx=rand(-1,1)*spd*(G.diff==='hard'?1.1:0.75);
        t.vy=rand(-0.3,0.3)*spd*0.3;
      }
      t.x += (t.vx||0)*dt; t.y += (t.vy||0)*dt;
      t.x=Math.max(-5,Math.min(5,t.x)); t.y=Math.max(0.8,Math.min(3.2,t.y));
      // Camera sway: simulate player movement inaccuracy
      G.swayPhase += dt;
      { const swAmt = G.diff==='hard'?0.005:G.diff==='easy'?0.0015:0.003;
        G.pitch += Math.sin(G.swayPhase*7.3)*swAmt*dt;
        G.yaw   += Math.sin(G.swayPhase*5.1)*swAmt*0.4*dt;
        G.pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, G.pitch));
        camera.rotation.y=G.yaw; camera.rotation.x=G.pitch; }
      break;
    case 'strafe_drill':
      // Pure horizontal strafe at head height — simulates a player strafing
      t.x += (t.vx||0)*dt;
      if(t.x > 5.5 || t.x < -5.5) { t.vx = -(t.vx||2.5); t.x = Math.max(-5.5, Math.min(5.5, t.x)); }
      t.y = 1.7; // fixed head height
      // Occasional direction/speed change
      t.ct = (t.ct||0)+dt;
      const strafeCd = G.diff==='easy'?2.5:G.diff==='hard'?0.9:1.6;
      if(t.ct > strafeCd) {
        t.ct=0;
        const sSpd = G.diff==='easy'?rand(1.2,2.2):G.diff==='hard'?rand(3.5,5.5):rand(2,3.5);
        t.vx = (Math.random()>0.5?1:-1)*sSpd;
      }
      break;
  }

  t.mesh.position.set(t.x, Math.max(0.3,t.y), t.z);

  raycaster.setFromCamera(center,camera);
  const hits = raycaster.intersectObject(t.mesh);
  G.trackFrames++;
  if(hits.length>0) { G.trackOnTarget++; G.score+=1; }
  const pct = G.trackFrames>0 ? Math.round(G.trackOnTarget/G.trackFrames*100) : 0;
  $('#tracking-fill').style.width = pct+'%';
  $('#tracking-pct').textContent = pct+'%';
  updateHUD();
}

function updateSwitchTargets(dt) {
  if(switchTargets.length<2) return;
  const d=DIFF[G.diff], spd=d.spd;

  switchTargets.forEach(t => {
    if(!t.alive) return;
    if(t.mv==='static') return;

    if(t.mv==='switch_bounce') {
      t.vx = t.vx || rand(1,3)*(t.idx===0?1:-1)*spd*0.2;
      t.vy = t.vy || rand(1,2)*spd*0.2;
      t.x += t.vx*dt; t.y += t.vy*dt;
      if(t.x<-6||t.x>6){t.vx*=-1; t.x=Math.max(-6,Math.min(6,t.x));}
      if(t.y<0.5||t.y>3.5){t.vy*=-1; t.y=Math.max(0.5,Math.min(3.5,t.y));}
    } else if(t.mv==='switch_float') {
      t.phase += dt*(t.spd||1)*0.3;
      t.phaseY += dt*(t.spd||1)*0.35;
      const bx = t.idx===0?-2:2;
      t.x = bx+Math.sin(t.phase)*3; t.y=2+Math.sin(t.phaseY)*1.5; t.z=-10+Math.sin(t.phase*0.5)*2;
    } else if(t.mv==='switch_micro') {
      t.phase += dt*(t.spd||1)*0.5;
      const bx = [-3,0,3][t.idx]||0;
      t.x = bx+Math.sin(t.phase)*0.8; t.y=(t.idx===1?2.8:1.5)+Math.cos(t.phase*1.3)*0.4;
    } else if(t.mv==='switch_smooth') {
      t.phase += dt*(t.spd||1)*0.2;
      const bx = t.idx===0?-2:2;
      t.x = bx+Math.sin(t.phase)*2; t.y=2+Math.sin(t.phase*0.7)*0.8;
    } else {
      // switch_move (default)
      t.phase += dt*(t.spd||2)*0.3;
      t.phaseY += dt*(t.spd||2)*0.2;
      const bx = [-3,0,3,4.5][t.idx]||0;
      t.x = Math.max(-7, Math.min(7, bx+Math.sin(t.phase)*2.2));
      t.y = (t.y||1.7)+Math.sin(t.phaseY)*0.02;
      t.z = -10+Math.cos(t.phase*0.6)*1;
    }
    t.mesh.position.set(t.x,Math.max(0.3,Math.min(4.5,t.y)),Math.min(-4,t.z));
  });

  // Switch active target on click-based modes
  G.switchTimer += dt;
  if(G.switchTimer >= G.switchInterval) {
    G.switchTimer=0;
    G.switchActiveIdx = (G.switchActiveIdx+1) % switchTargets.length;
    switchTargets.forEach((t,i) => { t.mesh.material = i===G.switchActiveIdx ? M.t4 : M.tDim; });
    audioEngine.play('countdown');
  }
}

function updateDynamic(dt) {
  G.targets.forEach(t => {
    if(!t.alive||!t.dynamic) return;
    if(t.pop) {
      t.vy -= 6*dt; t.mesh.position.x += (t.vx||0)*dt; t.mesh.position.y += t.vy*dt;
      t.age += dt;
      if(t.age > t.ttl || t.mesh.position.y < -1) { t.alive=false; targetsGroup.remove(t.mesh); G.misses++; G.combo=0; updateHUD(); }
    } else if(t.pokeball) {
      // Pokeball Frenzy: drifting targets that shrink and expire
      t.age += dt;
      t.mesh.position.x += (t.vx||0)*dt; t.mesh.position.y += (t.vy||0)*dt;
      if(t.mesh.position.x < -6.5||t.mesh.position.x > 6.5) t.vx *= -1;
      if(t.mesh.position.y < 0.3||t.mesh.position.y > 4.5) t.vy *= -1;
      const lifeFrac = Math.min(1, t.age / t.ttl);
      t.mesh.scale.setScalar(Math.max(0.6, 1 - lifeFrac * 0.35));
      if(t.age >= t.ttl) { t.alive=false; targetsGroup.remove(t.mesh); G.misses++; G.combo=0; updateHUD(); }
    } else if(t.floater) {
      t.mesh.position.y += t.vy*dt; t.mesh.position.x += (t.vx||0)*dt;
      if(t.mesh.position.y > 5) { t.alive=false; targetsGroup.remove(t.mesh); G.misses++; G.combo=0; updateHUD(); }
    } else if(t.reaction) {
      // Reaction Drill: target auto-expires if not clicked in time
      const age = (Date.now()-t.spawnTime)/1000;
      if(age > t.ttl) { t.alive=false; targetsGroup.remove(t.mesh); G.misses++; G.combo=0; updateHUD(); }
      else { const frac=age/t.ttl; t.mesh.material.emissiveIntensity=0.3+frac*0.7; } // pulse red as timer runs out
    } else if(t.orbit) {
      t.phase += dt*1.5;
      t.mesh.position.x = t.ox + Math.sin(t.phase)*1.5;
      t.mesh.position.y = t.oy + Math.cos(t.phase)*1;
    } else if(t.bounce) {
      t.mesh.position.x += (t.vx||0)*dt; t.mesh.position.y += (t.vy||0)*dt;
      if(t.mesh.position.x<-5.5||t.mesh.position.x>5.5) t.vx*=-1;
      if(t.mesh.position.y<0.5||t.mesh.position.y>4) t.vy*=-1;
      t.mesh.position.x=Math.max(-5.5,Math.min(5.5,t.mesh.position.x));
      t.mesh.position.y=Math.max(0.5,Math.min(4,t.mesh.position.y));
    } else {
      // Default Pasu-style diagonal
      t.mesh.position.x += (t.vx||0)*dt; t.mesh.position.y += (t.vy||0)*dt;
      if(t.mesh.position.x<-5.5||t.mesh.position.x>5.5) t.vx*=-1;
      if(t.mesh.position.y<0.5||t.mesh.position.y>4) t.vy*=-1;
      t.mesh.position.x=Math.max(-5.5,Math.min(5.5,t.mesh.position.x));
      t.mesh.position.y=Math.max(0.5,Math.min(4,t.mesh.position.y));
    }
  });
}

// ---- Determine scenario type ----
function isTrackMode(m) { const s=SCENARIOS[m]; return s && (s.type==='track'||s.type==='track_pct'); }
function isSwitchMode(m) {
  return ['vox_ts2','beants','floatts','waldots','devts','domiswitch','tamts'].includes(m);
}
function isDynamicMode(m) {
  return ['pasu_reload','vt_bounceshot','ctrlsphere_clk','popcorn_mv','pasu_angelic','pasu_perfected','pasu_micro','floatheads_t','vox_click','pokeball_frenzy'].includes(m);
}

// ---- SHOOTING ----
function shoot() {
  if(!G.running) return;
  if(isTrackMode(G.mode)) return; // tracking modes don't click

  // Switch modes: click = check if crosshair on active target
  if(isSwitchMode(G.mode)) {
    raycaster.setFromCamera(center,camera);
    const active = switchTargets[G.switchActiveIdx];
    if(active && active.alive) {
      const hits = raycaster.intersectObject(active.mesh);
      if(hits.length > 0) {
        G.hits++; G.combo++; G.bestCombo=Math.max(G.bestCombo,G.combo);
        const rt=Date.now()-active.spawnTime; G.reactionTimes.push(rt);
        let pts=100*Math.min(1+G.combo*0.1,3);
        if(rt<300) pts*=1.5; else if(rt<500) pts*=1.2;
        pts=Math.round(pts); G.score+=pts;
        try { checkInRunTrophies(); } catch(e){}
        showHitmarker(); addPopup(pts);
        audioEngine.play(G.combo%5===0&&G.combo>0?'combo':'hit');
        // Switch to next immediately
        G.switchTimer=0;
        G.switchActiveIdx=(G.switchActiveIdx+1)%switchTargets.length;
        switchTargets.forEach((t,i)=>{t.mesh.material=i===G.switchActiveIdx?M.t4:M.tDim;});
        updateHUD(); return;
      }
    }
    { const mp=_missPos(); G.clickLog.push({x:mp.tx,y:mp.ty,hit:false,err:mp.err,t:Date.now()-G.startTime}); }
    G.misses++; G.combo=0; audioEngine.play('miss'); updateHUD(); return;
  }

  // Click modes
  // Burst drill: apply recoil to aim per shot
  if(G.mode==='burst_drill') {
    const recoilPerShot = G.diff==='hard'?0.007:G.diff==='easy'?0.003:0.005;
    G.pitch -= recoilPerShot; // recoil pushes crosshair up
    G.pitch = Math.max(-Math.PI/2.2, G.pitch);
    camera.rotation.x = G.pitch;
  }
  raycaster.setFromCamera(center,camera);
  const meshes=G.targets.filter(t=>t.alive).map(t=>t.mesh);
  const intersects=raycaster.intersectObjects(meshes);
  if(intersects.length>0) {
    const hm=intersects[0].object;
    const tgt=G.targets.find(t=>t.alive&&t.mesh===hm);
    if(tgt) {
      // Burst drill: targets need multiple hits
      if(tgt.hp !== undefined) {
        tgt.hp--;
        showHitmarker(); audioEngine.play('hit');
        // Visual feedback: scale down as HP depletes
        const pct = tgt.hp/tgt.maxHp;
        tgt.mesh.scale.setScalar(0.6+pct*0.4);
        if(tgt.hp <= 0) { hitTarget(tgt); }
        return;
      }
      hitTarget(tgt); return;
    }
  }
  { const mp=_missPos(); G.clickLog.push({x:mp.tx,y:mp.ty,hit:false,err:mp.err,t:Date.now()-G.startTime}); }
  G.misses++; G.combo=0; audioEngine.play('miss'); updateHUD();
}

function _missPos() {
  // Returns the screen-projected position of the nearest alive target AND
  // the crosshair position (always center = 0.5,0.5).
  // The heatmap uses targetPos to show where the target was, and
  // the distance crosshair→target gives the "aim error" vector.
  const alive = G.targets.filter(t => t.alive);
  if (!alive.length) return {x:0.5, y:0.5, tx:0.5, ty:0.5};
  let best = null, bestDist = Infinity;
  for (const t of alive) {
    try {
      const sp = t.mesh.position.clone().project(camera);
      const dx = sp.x, dy = sp.y;
      const d = dx*dx + dy*dy;
      if (d < bestDist) {
        bestDist = d;
        best = {
          x:  0.5,             // crosshair always at center
          y:  0.5,
          tx: (sp.x+1)/2,     // target's screen position
          ty: (1-sp.y)/2,
          err: Math.sqrt(d),   // aim error in NDC units
        };
      }
    } catch(e) {}
  }
  return best || {x:0.5, y:0.5, tx:0.5, ty:0.5, err:0};
}

function hitTarget(t) {
  // Guard against late clicks after a target has been destroyed between the
  // raycast find and this handler (async spawn/update can race).
  if (!t || !t.alive || !t.mesh) return;
  const rt=Date.now()-t.spawnTime; G.reactionTimes.push(rt);
  G.hits++; G.combo++; G.bestCombo=Math.max(G.bestCombo,G.combo);
  try { const sp=t.mesh.position.clone().project(camera); G.clickLog.push({x:(sp.x+1)/2,y:(1-sp.y)/2,hit:true,t:Date.now()-G.startTime}); } catch(e){}
  let pts=100*Math.min(1+G.combo*0.1,3);
  if(rt<300) pts*=1.5; else if(rt<500) pts*=1.2;
  pts=Math.round(pts); G.score+=pts;
  try { checkInRunTrophies(); } catch(e){}
  showHitmarker(); addPopup(pts);
  audioEngine.play(G.combo%5===0&&G.combo>0?'combo':'hit');
  t.alive=false;
  const mesh=t.mesh; let a=0;
  const anim=()=>{a+=0.08;mesh.scale.setScalar(Math.max(0,1-a*3));if(a<0.35)requestAnimationFrame(anim);else targetsGroup.remove(mesh);};
  anim(); updateHUD();

  // Respawn for specific modes
  if(G.mode==='gridshot') setTimeout(()=>_respawnGridshotCell(),60);
  else if(G.mode==='speedflick') setTimeout(()=>spawn_speedflick(),80);
  else if(G.mode==='ctrlsphere_clk') setTimeout(()=>spawn_ctrlsphere_clk(),50);
  else if(G.mode==='pokeball_frenzy') setTimeout(()=>spawn_pokeball_frenzy(),60);
  else if(G.mode==='pasu_reload') setTimeout(()=>spawn_pasu_reload(),120);
}

function showHitmarker() { const h=$('#hitmarker');h.classList.remove('hidden');h.classList.add('show');setTimeout(()=>{h.classList.remove('show');h.classList.add('hidden');},100); }
function addPopup(pts) { const f=$('#kill-feed'),e=document.createElement('div');e.className='kill-entry';e.textContent='+'+pts+(G.combo>=5?' x'+G.combo:'');if(G.combo>=5)e.style.color='#e8c56d';f.appendChild(e);setTimeout(()=>e.remove(),1500); }

// ---- MOUSE (hardware jump filter only — no rolling average to avoid blocking flicks) ----
let lastMoveTime = 0;
let skipFrames = 0;
function onMouseMove(e) {
  if(!G.locked||!G.running) return;
  const now = performance.now();
  const rawX = e.movementX, rawY = e.movementY;
  // Skip first 3 frames after pointer lock (browser sends garbage deltas)
  if (skipFrames > 0) { skipFrames--; lastMoveTime = now; return; }
  // Absolute spike filter — catches hardware/driver glitch teleports only
  if (Math.abs(rawX) > 300 || Math.abs(rawY) > 300) return;
  // Skip first move after long pause (re-lock, tab switch)
  if (now - lastMoveTime > 300 && lastMoveTime > 0) { lastMoveTime = now; return; }
  lastMoveTime = now;
  const s = cm360ToRad(G.cm360);
  G.yaw -= rawX * s;
  G.pitch -= rawY * s;
  G.pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, G.pitch));
  camera.rotation.order = 'YXZ';
  camera.rotation.y = G.yaw;
  camera.rotation.x = G.pitch;
  // Trail recording (30fps sample)
  if(G.running && now - G._lastTrailSample >= 33) {
    G._lastTrailSample = now;
    const t = Date.now() - G.startTime;
    G.trailLog.push({t, yaw: G.yaw, pitch: G.pitch});
    if(G.trailLog.length > 2000) G.trailLog.shift(); // cap at ~66s
  }
}
function lockPointer() { const c=$('#game-canvas');(c.requestPointerLock||c.mozRequestPointerLock).call(c); }
// pointerlockchange handled in pause section; reset mouse filter on lock change


// ---- GAME LOOP ----
function gameLoop() {
  G.animFrame=requestAnimationFrame(gameLoop);
  const dt=clock.getDelta();
  if(G.running) {
    if(isTrackMode(G.mode)) updateTrackTarget(dt);
    if(isSwitchMode(G.mode)) updateSwitchTargets(dt);
    if(isDynamicMode(G.mode)) updateDynamic(dt);
    if(G.mode==='gridshot') updateGridshot(dt);
  }
  renderer.render(scene,camera);
}

function updateHUD() { const t=G.hits+G.misses,a=t>0?Math.round(G.hits/t*100):100; $('#hud-score').textContent=G.score.toLocaleString(); $('#hud-combo').textContent='x'+G.combo; $('#hud-acc').textContent=a+'%'; }

function startTimer() { clearInterval(G.timerInterval); G.timeLeft=G.duration;$('#hud-timer').textContent=G.timeLeft;$('#hud-timer').classList.remove('urgent');G.timerInterval=setInterval(()=>{G.timeLeft--;$('#hud-timer').textContent=G.timeLeft;if(G.timeLeft<=10)$('#hud-timer').classList.add('urgent');if(G.timeLeft<=0)endGame();},1000); }

// ---- SPAWN MAP ----
const SPAWN_MAP = {
  whisphereraw:spawn_whisphereraw, whisphere:spawn_whisphere, smoothbot:spawn_smoothbot,
  leaptrack:spawn_leaptrack, ctrlsphere_aim:spawn_ctrlsphere_aim, vt_ctrlsphere:spawn_vt_ctrlsphere,
  air_angelic:spawn_air_angelic, cloverraw:spawn_cloverraw, ctrlsphere_far:spawn_ctrlsphere_far,
  pgti:spawn_pgti, air_celestial:spawn_air_celestial, whisphere_slow:spawn_whisphere_slow,
  ground_plaza:spawn_ground_plaza, ctrlsphere_ow:spawn_ctrlsphere_ow,
  flicker_plaza:spawn_flicker_plaza, polarized_hell:spawn_polarized_hell,
  air_pure:spawn_air_pure, air_voltaic:spawn_air_voltaic,
  pokeball_frenzy:spawn_pokeball_frenzy, w1w3ts_reload:spawn_w1w3ts_reload, vox_ts2:spawn_vox_ts2,
  beants:spawn_beants, floatts:spawn_floatts, waldots:spawn_waldots, devts:spawn_devts,
  domiswitch:spawn_domiswitch, tamts:spawn_tamts,
  pasu_reload:spawn_pasu_reload, vt_bounceshot:spawn_vt_bounceshot, ctrlsphere_clk:spawn_ctrlsphere_clk,
  popcorn_mv:spawn_popcorn_mv, pasu_angelic:spawn_pasu_angelic, pasu_perfected:spawn_pasu_perfected,
  pasu_micro:spawn_pasu_micro, floatheads_t:spawn_floatheads_t, vox_click:spawn_vox_click,
  gridshot:spawn_gridshot, speedflick:spawn_speedflick,
  crosshair_drill:spawn_crosshair_drill, deadzone_drill:spawn_deadzone_drill, burst_drill:spawn_burst_drill,
  strafe_drill:spawn_strafe_drill, reaction_drill:spawn_reaction_drill, micro_drill:spawn_micro_drill,
};

// Modes that need interval respawn
const INTERVAL_MODES = {
  crosshair_drill:150, burst_drill:400, reaction_drill:200, micro_drill:150,
  w1w3ts_reload:200, pasu_reload:150, vt_bounceshot:300, ctrlsphere_clk:100,
  popcorn_mv:400, pasu_angelic:300, pasu_perfected:300, pasu_micro:200,
  floatheads_t:600, vox_click:250, pokeball_frenzy:180,
};

function startGame(mode) {
  // Safety: prevent launching a benchmark scenario that's locked at the current tier
  if (G.benchmarkMode && SCENARIOS[mode]?.th && !isScenarioUnlocked(mode, currentTier)) {
    const prevTier = currentTier === 'hard' ? 'medium' : 'easier';
    const prevLbl = currentTier === 'hard' ? 'Medium' : 'Easier';
    const curLbl = currentTier === 'hard' ? 'Hard' : 'Medium';
    const maxPrev = maxThreadsFor(prevTier);
    _showLockToast(`Verrouillé en ${curLbl}. Obtiens ${maxPrev}/${maxPrev} Threads en ${prevLbl} d'abord.`);
    return;
  }
  G.mode=mode;
  if(G.benchmarkMode) { G.diff=currentTier==='easier'?'easy':currentTier==='hard'?'hard':'medium'; G.duration=60; }
  else { G.diff=$('#opt-diff').value; G.duration=parseInt($('#opt-duration').value); }
  const sMode=$('#opt-sens-mode').value, sVal=parseFloat($('#opt-sens-val').value)||34;
  const dpi=parseInt($('#opt-dpi').value)||800;
  G.cm360=gameSensToCm360(sMode, sVal);
  G.soundOn=$('#opt-sound').checked;
  audioEngine.enabled=G.soundOn; audioEngine.init();
  saveSettings({sensMode:sMode,sensVal:sVal,cm360:G.cm360,dpi:dpi,difficulty:G.diff,duration:G.duration,soundOn:G.soundOn});

  G.score=0;G.hits=0;G.misses=0;G.combo=0;G.bestCombo=0;G.reactionTimes=[];G.targets=[];G.clickLog=[];
  G.yaw=0;G.pitch=0;G.trackFrames=0;G.trackOnTarget=0;G.recoilY=0;G.swayPhase=0;
  G.trailLog=[];G.startTime=Date.now();G._lastTrailSample=0;
  G._trophies = {};
  G.targets=[]; trackTarget=null; switchTargets=[];
  if(G.autoFireTimer){clearInterval(G.autoFireTimer);G.autoFireTimer=null;}
  skipFrames=3;
  G.switchActiveIdx=0;G.switchTimer=0;

  const sc=SCENARIOS[mode];
  $('#hud-mode').textContent = sc ? (G.benchmarkMode ? getLabel(mode) : sc.label) : mode;
  $('#hud-diff').textContent = G.benchmarkMode
    ? (window._coachLaunchSource?.tab==='ch-daily-training' ? 'Daily' : 'Benchmark')
    : G.diff;
  $('#hud-score').textContent='0'; $('#hud-combo').textContent='x0'; $('#hud-acc').textContent='100%';
  $('#kill-feed').innerHTML='';

  const showBar = isTrackMode(mode);
  $('#tracking-bar').classList.toggle('hidden',!showBar);
  if(showBar){$('#tracking-fill').style.width='0%';$('#tracking-pct').textContent='0%';}

  showScreen('game-screen');
  clearScene(); camera.position.set(0,1.7,0);
  buildRoom(20,8,30);
  updateFOV(); camera.rotation.order='YXZ'; camera.rotation.set(0,0,0);
  setTimeout(()=>{renderer.setSize(innerWidth,innerHeight);updateFOV();},50);

  $('#click-to-start').classList.remove('hidden');
  const handler=()=>{ $('#click-to-start').removeEventListener('click',handler); lockPointer(); $('#click-to-start').classList.add('hidden'); doCountdown(()=>{G.running=true;startTimer();doSpawn();}); };
  const resume=()=>{ if(!G.running)return; lockPointer(); $('#click-to-start').classList.add('hidden'); };
  $('#click-to-start').addEventListener('click',handler);
  $('#click-to-start').addEventListener('click',resume);
}

function doCountdown(cb) {
  let c=3; const el=document.createElement('div');
  el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:8rem;font-weight:900;color:#ff4655;text-shadow:0 0 60px rgba(255,70,85,0.6);z-index:300;pointer-events:none;';
  document.body.appendChild(el); el.textContent=c; audioEngine.play('countdown');
  const ci=setInterval(()=>{c--;if(c>0){el.textContent=c;audioEngine.play('countdown');}else{el.textContent='GO!';audioEngine.play('start');clearInterval(ci);setTimeout(()=>{el.remove();cb();},300);}},700);
}

function doSpawn() {
  const fn=SPAWN_MAP[G.mode]; if(fn) fn();
  const iv=INTERVAL_MODES[G.mode];
  if(iv) G.spawnTimer=setInterval(()=>{const f=SPAWN_MAP[G.mode];if(f)f();}, iv);
}

function endGame() {
  if (!G.running) return; // guard against double-calls (stale interval, resume race)
  G.running=false; clearInterval(G.timerInterval); clearInterval(G.spawnTimer); G.spawnTimer=null;
  if(G.autoFireTimer){ clearInterval(G.autoFireTimer); G.autoFireTimer=null; }
  if(document.exitPointerLock) document.exitPointerLock();
  G.targets.forEach(t=>{if(t.alive){t.alive=false;targetsGroup.remove(t.mesh);}});
  G.targets=[]; trackTarget=null; switchTargets=[];
  audioEngine.play('end');

  const total=G.hits+G.misses;
  let acc;
  if(isTrackMode(G.mode)) acc = G.trackFrames>0?Math.round(G.trackOnTarget/G.trackFrames*100):0;
  else acc = total>0?Math.round(G.hits/total*100):0;
  const avgR=G.reactionTimes.length>0?Math.round(G.reactionTimes.reduce((a,b)=>a+b)/G.reactionTimes.length):0;

  // Mode name in header
  const rModeEl = $('#res-mode-name');
  if(rModeEl) rModeEl.textContent = (SCENARIOS[G.mode] ? (G.benchmarkMode ? getLabel(G.mode) : SCENARIOS[G.mode].label) : G.mode.replace(/_/g,' ')).toUpperCase();

  $('#r-score').textContent=G.score.toLocaleString();
  $('#r-acc').textContent=acc+'%'; $('#r-hits').textContent=G.hits;
  $('#r-misses').textContent=G.misses; $('#r-react').textContent=avgR>0?avgR+'ms':'N/A';
  $('#r-combo').textContent=G.bestCombo;

  // PB comparison
  if(!G.benchmarkMode) {
    const prevPB = getModeLocalPB(G.mode);
    const pbWrap = $('#res-pb-wrap');
    if(pbWrap) {
      pbWrap.style.display = '';
      if(prevPB === 0) {
        pbWrap.innerHTML = `<div class="res-pb-badge res-pb-first">${icon('target',16)} Premier score enregistré !</div>`;
      } else if(G.score > prevPB) {
        const delta = G.score - prevPB;
        pbWrap.innerHTML = `<div class="res-pb-badge res-pb-new">${icon('trophy',16)} NOUVEAU RECORD &nbsp;+${delta.toLocaleString()} pts</div>`;
      } else {
        const delta = G.score - prevPB;
        pbWrap.innerHTML = `<div class="res-pb-badge res-pb-below">Record : ${prevPB.toLocaleString()} pts &nbsp;<span>${delta >= 0 ? '+' : ''}${delta.toLocaleString()}</span></div>`;
      }
      setModeLocalPB(G.mode, G.score);
    }
  } else {
    const pbWrap = $('#res-pb-wrap'); if(pbWrap) pbWrap.style.display='none';
  }

  const rk=$('#res-rank'), tw=$('#res-threads-wrap');

  // Always save score for any scenario with benchmark thresholds (regardless of benchmarkMode)
  if (SCENARIOS[G.mode]?.th) {
    const _autoScore = getBenchmarkScore();
    if (_autoScore > 0) saveBest(G.mode, _autoScore);
  }

  if(G.benchmarkMode && SCENARIOS[G.mode]) {
    const benchScore = getBenchmarkScore();
    const threads = calcThreads(G.mode, benchScore);
    const mt = getMaxThreads();
    rk.textContent = threads+'/'+mt+' Threads';
    rk.style.color = RANK_COLORS[Math.min(threads,7)]; rk.style.borderColor = RANK_COLORS[Math.min(threads,7)];
    tw.classList.remove('hidden');
    $('#r-threads').textContent = threads+'/'+mt;
    // Return destination depends on launch source
    const _src = window._coachLaunchSource;
    if (_src && _src.tab === 'ch-daily-training') {
      // Mark this scenario as "done for today" in the Daily Training rotation.
      // Only fires when the scenario was launched from the Daily list (dailyKey
      // was set by dtLaunch); free-play completions don't count.
      if (_src.dailyKey && typeof window._dtMarkDone === 'function') {
        try { window._dtMarkDone(_src.dailyKey); } catch {}
      }
      $('#btn-menu').innerHTML = `${icon('calendar',16)} Daily Training`;
      $('#btn-menu').onclick = () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('coaching-screen')?.classList.add('active');
        if (typeof coachingSwitchTab === 'function') coachingSwitchTab('ch-daily-training');
      };
    } else {
      $('#btn-menu').textContent = 'Benchmark';
      $('#btn-menu').onclick = () => { showScreen('benchmark-screen'); renderBenchmark(); };
    }
  } else {
    const r=calcRankFromThreads(Math.round(G.score/100));
    rk.textContent=r.label; rk.style.color=r.color; rk.style.borderColor=r.color;
    tw.classList.add('hidden');
    $('#btn-menu').textContent='Menu'; $('#btn-menu').onclick=()=>showScreen('menu-screen');
  }

  saveCareer(G.score, acc);
  // Missions — use G.bestCombo as max streak (G.combo resets on miss, G.bestCombo tracks the peak)
  updateMissions('score',    G.score);
  updateMissions('hits',     G.hits);
  updateMissions('accuracy', acc);
  updateMissions('streak',   G.bestCombo);
  updateMissions('sessions', 1);
  // Save to server if logged in
  if(typeof coachingToken !== 'undefined' && coachingToken) {
    // On préfère window.bgFetch (offline queue + retry sur 5xx), avec fallback
    // vers fetch brut si ui.js n'a pas encore injecté le helper.
    const _post = (window.bgFetch || fetch);

    // Historique général
    _post('/api/history', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+coachingToken},
      body: JSON.stringify({ mode:G.mode, score:G.score, accuracy:acc, hits:G.hits, misses:G.misses, avg_reaction:avgR, best_combo:G.bestCombo, duration:G.duration })
    });

    // Run benchmark persisté en DB
    const isBench  = !!(G.benchmarkMode && SCENARIOS[G.mode]);
    const bScore   = isBench ? getBenchmarkScore() : G.score;
    const threads  = isBench ? calcThreads(G.mode, bScore) : 0;
    const maxTh    = getMaxThreads();
    const energy   = isBench ? Math.round(threads / maxTh * 100) : 0;
    const _TNAMES  = ['Unranked','Iron','Bronze','Silver','Gold','Platinum','Diamond','Legendary','Mythic'];
    const rankName = isBench ? (_TNAMES[Math.min(threads, 8)] || 'Unranked') : null;
    _post('/api/benchmark', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+coachingToken},
      body: JSON.stringify({ scenario:G.mode, score:bScore, accuracy:acc, hits:G.hits, misses:G.misses,
        energy, rank_name:rankName, difficulty:currentTier||G.diff, duration:G.duration, is_benchmark:isBench })
    });
  }
  // Check achievements
  if (typeof checkAndUnlockAchievements === 'function') {
    const avgR = G.reactionTimes.length > 0 ? Math.round(G.reactionTimes.reduce((a,b)=>a+b,0)/G.reactionTimes.length) : 0;
    const _bmThreads = (G.benchmarkMode && SCENARIOS[G.mode]) ? calcThreads(G.mode, getBenchmarkScore()) : 0;
    const _gameEndData = {
      score: G.score, accuracy: acc, bestCombo: G.bestCombo, hits: G.hits,
      avgReaction: avgR, isDaily: G.benchmarkMode && G.mode === window._dailyMode,
      isBenchmark: !!(G.benchmarkMode && SCENARIOS[G.mode]),
      threads: _bmThreads, tier: currentTier, duration: G.duration,
    };
    checkAndUnlockAchievements(_gameEndData);
    if (typeof updateWeeklyChallenges === 'function') updateWeeklyChallenges(_gameEndData);
  }
  // Save replay
  try {
    localStorage.setItem('mayhaim_replay', JSON.stringify({
      mode: G.mode, score: G.score, duration: G.duration,
      trail: G.trailLog, clicks: G.clickLog,
      ts: Date.now()
    }));
  } catch(e) {}
  const replayBtn = $('#btn-replay');
  if(replayBtn) replayBtn.style.display = G.trailLog.length > 5 ? '' : 'none';

  // ─── BATCH B: World percentile ───
  const percEl = document.getElementById('res-percentile');
  if (percEl) { percEl.style.display = 'none'; percEl.className = 'res-percentile'; }
  try {
    const _apiBase = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
    fetch(`${_apiBase}/api/coaching?view=percentile&mode=${encodeURIComponent(G.mode)}&score=${G.score}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !percEl || d.total < 2) return;
        const p = d.percentile;
        percEl.innerHTML = `${icon('globe',16)} Top ${p}% mondial (${d.total} joueurs)`;
        if (p <= 1) percEl.classList.add('top1');
        else if (p <= 5) percEl.classList.add('top5');
        percEl.style.display = '';
      }).catch(() => {});
  } catch {}

  // ─── BATCH A: analytics (gauges, histogram, sparkline, run history) ───
  try {
    const scores = computeRunScores();
    const isTrack = (typeof isTrackMode === 'function') && isTrackMode(G.mode);

    // Show/hide speed & consistency gauges based on meaningful data
    const speedGaugeEl = document.querySelector('.res-gauge[data-gauge="speed"]');
    const consiGaugeEl = document.querySelector('.res-gauge[data-gauge="consistency"]');
    const hasReactions = G.reactionTimes && G.reactionTimes.length >= 3;

    if (speedGaugeEl) speedGaugeEl.style.opacity = (!isTrack && !hasReactions) ? '0.4' : '1';
    if (consiGaugeEl) consiGaugeEl.style.opacity = (!isTrack && !hasReactions) ? '0.4' : '1';

    renderGauge('.res-gauge[data-gauge="precision"]',   scores.precision   ?? 0);
    renderGauge('.res-gauge[data-gauge="speed"]',       scores.speed       ?? 0);
    renderGauge('.res-gauge[data-gauge="consistency"]', scores.consistency ?? 0);

    // Persist run history (before sparkline so the current run shows)
    const runEntry = {
      score: G.score, acc, hits: G.hits, misses: G.misses,
      avgR, bestCombo: G.bestCombo,
      precision: scores.precision, speed: scores.speed, consistency: scores.consistency,
      duration: G.duration, ts: Date.now()
    };
    saveRunHistoryEntry(G.mode, runEntry);

    renderRunsSparkline(G.mode);
    renderReactionHistogram();
  } catch(e) { console.warn('[BATCH A] analytics failed', e); }

  showScreen('results-screen');

  // Hooks coaching (définis dans coaching.js, chargé avant game3d.js)
  if (typeof _updateCoachingReturnBtn === 'function') _updateCoachingReturnBtn();
  if (typeof _renderHeatmap === 'function') _renderHeatmap();

  // Cloud sync — debounced push after game end
  if (typeof debouncedSync === 'function') debouncedSync();
}

function showScreen(id) {
  const OVERLAYS = ['game-screen', 'results-screen'];
  const HUB_REMAP = {
    'menu-screen':     'hub-home',
    'free-play-screen':'hub-freeplay',
    'settings-screen': 'hub-settings',
    'benchmark-screen':'hub-viscose',
  };

  if (OVERLAYS.includes(id)) {
    // Overlay — on ajoute juste active sans cacher les autres
    document.getElementById(id)?.classList.add('active');
    return;
  }

  // Cacher les overlays si on revient au hub
  OVERLAYS.forEach(oid => document.getElementById(oid)?.classList.remove('active'));

  // Remapper vers un panel du hub
  if (HUB_REMAP[id]) {
    // S'assurer que coaching-screen est visible
    $$('.screen').forEach(s => {
      if (!OVERLAYS.includes(s.id)) s.classList.remove('active');
    });
    document.getElementById('coaching-screen')?.classList.add('active');
    // Switcher vers le bon panel
    if (typeof coachingSwitchTab === 'function') {
      coachingSwitchTab(HUB_REMAP[id]);
    }
    // Si c'est le viscose benchmark, le rendre
    if (id === 'benchmark-screen' && typeof renderBenchmark === 'function') {
      setTimeout(() => renderBenchmark(), 50);
    }
    return;
  }

  // Écrans normaux (auth-screen, coaching-screen...)
  $$('.screen').forEach(s => {
    if (!OVERLAYS.includes(s.id)) s.classList.remove('active');
  });
  document.getElementById(id)?.classList.add('active');
}

// ---- CAREER ----
function loadCareer() { try{return JSON.parse(localStorage.getItem('visc_career'))||{best:0,acc:0,games:0};}catch{return{best:0,acc:0,games:0};} }
function saveCareer(score,accuracy) { const s=loadCareer(); s.best=Math.max(s.best,score); s.acc=s.games>0?((s.acc*s.games)+accuracy)/(s.games+1):accuracy; s.games++; localStorage.setItem('visc_career',JSON.stringify(s)); updateMenuStats(); }

// ---- PER-MODE PERSONAL BEST ----
function getModeLocalPB(mode) { return parseInt(localStorage.getItem('visc_pb_'+mode)||'0'); }
function setModeLocalPB(mode, score) { if(score>getModeLocalPB(mode)) localStorage.setItem('visc_pb_'+mode, score); }
function updateMenuStats() { const s=loadCareer(); $('#menu-best').textContent=s.best.toLocaleString(); $('#menu-acc').textContent=Math.round(s.acc)+'%'; $('#menu-games').textContent=s.games; }

// ============================================================
// BATCH A — POST-RUN ANALYTICS
// Run history (last 20 per mode) + Precision/Speed/Consistency scoring
// + reaction histogram + sparkline + in-run trophy toasts
// ============================================================

// ---- PER-MODE RUN HISTORY (last 20) ----
const RUN_HISTORY_MAX = 20;
function getRunHistory(mode) {
  try { return JSON.parse(localStorage.getItem('visc_runs_'+mode)) || []; }
  catch { return []; }
}
function saveRunHistoryEntry(mode, entry) {
  const arr = getRunHistory(mode);
  arr.push(entry);
  while (arr.length > RUN_HISTORY_MAX) arr.shift();
  try { localStorage.setItem('visc_runs_'+mode, JSON.stringify(arr)); } catch {}
  return arr;
}

// ---- SCORE HELPERS ----
function _mean(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function _stdev(arr) {
  if (arr.length < 2) return 0;
  const m = _mean(arr);
  return Math.sqrt(arr.reduce((s,v)=>s+(v-m)*(v-m),0)/arr.length);
}
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Compute 3 Aim-Lab-style scores from the current run (0-100 each).
 *   precision   — accuracy% for click, trackOnTarget%% for track.
 *   speed       — how fast you engage: avgReaction 200ms→100, 800ms→0 (click only).
 *                 For track: how quickly you reach on-target (we approximate via
 *                 trackOnTarget ratio of the first 3 seconds vs whole run).
 *   consistency — stability: low reaction stdev → high. stdev 30ms→100, 250ms→0.
 *                 For track: mapped from trackOnTarget% directly (stable = high).
 */
function computeRunScores() {
  try {
    const isTrack = (typeof isTrackMode === 'function') && isTrackMode(G.mode);
    const total   = G.hits + G.misses;
    let precision, speed, consistency;

    if (isTrack) {
      const onT = (G.trackFrames > 0) ? G.trackOnTarget / G.trackFrames : 0;
      precision   = Math.round(onT * 100);
      speed       = Math.round(_clamp((onT - 0.3) / 0.6 * 100, 0, 100));
      consistency = Math.round(_clamp(onT * 110 - 10, 0, 100));
    } else {
      const acc = total > 0 ? G.hits / total : 0;
      precision = Math.round(acc * 100);

      const rt = (G.reactionTimes || []).filter(v => v > 0 && v < 5000);
      const avg = _mean(rt);
      if (avg > 0) {
        speed = Math.round(_clamp((800 - avg) / 6, 0, 100));
      } else {
        speed = 0;
      }
      if (rt.length >= 3) {
        const sd = _stdev(rt);
        consistency = Math.round(_clamp((250 - sd) / 2.2, 0, 100));
      } else {
        consistency = precision;
      }
    }
    return {
      precision:   isNaN(precision)   ? 0 : precision,
      speed:       isNaN(speed)       ? 0 : speed,
      consistency: isNaN(consistency) ? 0 : consistency
    };
  } catch(e) {
    console.warn('[computeRunScores] failed:', e);
    return { precision: 0, speed: 0, consistency: 0 };
  }
}

// ---- GAUGE RENDER ----
function _gaugeTier(pct) {
  if (pct >= 85) return 'elite';
  if (pct >= 65) return 'high';
  if (pct >= 40) return 'mid';
  return 'low';
}
function renderGauge(rootSelector, pct) {
  const el = document.querySelector(rootSelector);
  if (!el) return;
  const p = _clamp(pct|0, 0, 100);
  el.setAttribute('data-tier', _gaugeTier(p));
  const fg = el.querySelector('.res-gauge-fg');
  const valEl = el.querySelector('.res-gauge-val');
  const C = 326.72; // 2π·52
  const finalOffset = C * (1 - p/100);

  if (fg) {
    // Fallback: set final value immediately so the gauge is correct even if
    // RAF is paused (hidden tab). The CSS transition still plays when visible.
    fg.style.strokeDashoffset = C;
    requestAnimationFrame(() => { fg.style.strokeDashoffset = finalOffset; });
    setTimeout(() => { fg.style.strokeDashoffset = finalOffset; }, 1000);
  }
  if (valEl) {
    // Animated count-up, with synchronous fallback if RAF never fires.
    const dur = 700;
    const t0 = performance.now();
    const from = parseInt(valEl.textContent) || 0;
    let done = false;
    const step = (now) => {
      if (done) return;
      const k = _clamp((now - t0) / dur, 0, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      valEl.textContent = Math.round(from + (p - from) * ease);
      if (k < 1) requestAnimationFrame(step);
      else done = true;
    };
    requestAnimationFrame(step);
    setTimeout(() => { if (!done) { valEl.textContent = p; done = true; } }, 1000);
  }
}

// ---- REACTION TIME HISTOGRAM (Chart.js) ----
let _resHistChart = null;
let _resSparkChart = null;
function renderReactionHistogram() {
  const card = document.getElementById('res-hist-card');
  const canvas = document.getElementById('res-reaction-hist');
  const statsEl = document.getElementById('res-hist-stats');
  if (!card || !canvas) return;
  const rt = (G.reactionTimes || []).filter(v => v > 0 && v < 2000);
  if (rt.length < 3 || typeof Chart === 'undefined') {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';

  // Buckets: 100ms wide, 150..850
  const edges = [150,250,350,450,550,650,750,850];
  const labels = edges.slice(0, -1).map((e,i)=> `${e}-${edges[i+1]}`);
  const buckets = new Array(edges.length-1).fill(0);
  rt.forEach(v => {
    for (let i=0; i<edges.length-1; i++) {
      if (v >= edges[i] && v < edges[i+1]) { buckets[i]++; break; }
    }
  });

  const avg = Math.round(_mean(rt));
  const median = (() => {
    const s = rt.slice().sort((a,b)=>a-b);
    const m = Math.floor(s.length/2);
    return s.length % 2 ? s[m] : Math.round((s[m-1]+s[m])/2);
  })();
  const best = Math.min(...rt);
  const sd = Math.round(_stdev(rt));

  if (statsEl) {
    statsEl.innerHTML =
      `<span>Moy <b>${avg}ms</b></span>` +
      `<span>Médiane <b>${median}ms</b></span>` +
      `<span>Best <b>${best}ms</b></span>` +
      `<span>σ <b>${sd}ms</b></span>`;
  }

  if (_resHistChart) { _resHistChart.destroy(); _resHistChart = null; }
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#ff4655';
  const dim    = css.getPropertyValue('--dim').trim()    || '#8b949e';
  const border = css.getPropertyValue('--border').trim() || '#30363d';

  _resHistChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: buckets,
        backgroundColor: buckets.map(() => accent + 'cc'),
        borderColor: accent,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { ticks: { color: dim, font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: dim, font: { size: 9 } }, grid: { color: border }, beginAtZero: true }
      }
    }
  });
}

function renderRunsSparkline(mode) {
  const wrap = document.getElementById('res-sparkline-wrap');
  const canvas = document.getElementById('res-runs-spark');
  if (!wrap || !canvas) return;
  const hist = getRunHistory(mode);
  if (hist.length < 2 || typeof Chart === 'undefined') {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  const last5 = hist.slice(-5);
  const labels = last5.map((_, i) => i === last5.length - 1 ? 'Cette run' : '');
  const scores = last5.map(r => r.score);

  if (_resSparkChart) { _resSparkChart.destroy(); _resSparkChart = null; }
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#ff4655';
  const dim    = css.getPropertyValue('--dim').trim()    || '#8b949e';

  _resSparkChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: scores,
        borderColor: accent,
        backgroundColor: accent + '22',
        fill: true,
        tension: 0.35,
        pointRadius: scores.map((_,i) => i === scores.length - 1 ? 4 : 2),
        pointBackgroundColor: scores.map((_,i) => i === scores.length - 1 ? accent : dim),
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true, aspectRatio: 6,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: (ctx) => ctx.raw.toLocaleString() + ' pts' }
      } },
      scales: { x: { display: false }, y: { display: false } },
      layout: { padding: 4 },
    }
  });
}

// ---- IN-RUN TROPHY TOASTS ----
// Fires on specific milestones during a run. State is cleared at startGame.
function _trophy(msg, ico) {
  if (!window.showToast) return;
  try {
    const el = window.showToast(msg, { type: 'info', icon: ico || icon('trophy',18), duration: 1600 });
    if (el && el.classList) { el.classList.remove('toast--info'); el.classList.add('toast--trophy'); }
  } catch {}
}
function checkInRunTrophies() {
  if (!G._trophies) G._trophies = {};
  const T = G._trophies;
  if (!T.c10 && G.combo === 10) { T.c10 = 1; _trophy('Combo x10 !', icon('flame',18)); }
  if (!T.c20 && G.combo === 20) { T.c20 = 1; _trophy('Combo x20 !', icon('check-circle',18)); }
  if (!T.c30 && G.combo === 30) { T.c30 = 1; _trophy('Combo x30 — insane !', icon('zap',18)); }
  if (!T.c50 && G.combo === 50) { T.c50 = 1; _trophy('Combo x50 — GOD MODE', icon('crown',18)); }
  if (!T.h50 && G.hits === 50) { T.h50 = 1; _trophy('50 hits !', icon('target',18)); }
  if (!T.h100 && G.hits === 100) { T.h100 = 1; _trophy('100 hits !', icon('target',18)); }
  if (!T.h200 && G.hits === 200) { T.h200 = 1; _trophy('200 hits — monstre', icon('zap',18)); }
  // Sub-200ms rush: 5 reactions in a row below 200ms
  if (!T.rush && G.reactionTimes.length >= 5) {
    const last5 = G.reactionTimes.slice(-5);
    if (last5.every(v => v < 200)) { T.rush = 1; _trophy('Flash rush — 5× <200ms', icon('zap',18)); }
  }
}

// ============ MISSIONS ============
let activeMissions = [];

const MISSION_DEFS = [
  { id:'score_500',   type:'score',    target:500,   label:'Marquer 500 points',          xp:30  },
  { id:'score_1000',  type:'score',    target:1000,  label:'Marquer 1 000 points',         xp:60  },
  { id:'score_2500',  type:'score',    target:2500,  label:'Marquer 2 500 points',         xp:120 },
  { id:'score_5000',  type:'score',    target:5000,  label:'Marquer 5 000 points',         xp:200 },
  { id:'hits_20',     type:'hits',     target:20,    label:'Toucher 20 cibles',            xp:30  },
  { id:'hits_50',     type:'hits',     target:50,    label:'Toucher 50 cibles',            xp:60  },
  { id:'hits_100',    type:'hits',     target:100,   label:'Toucher 100 cibles',           xp:100 },
  { id:'hits_200',    type:'hits',     target:200,   label:'Toucher 200 cibles',           xp:180 },
  { id:'acc_70',      type:'accuracy', target:70,    label:'Finir avec 70% de précision',  xp:40  },
  { id:'acc_80',      type:'accuracy', target:80,    label:'Finir avec 80% de précision',  xp:80  },
  { id:'acc_90',      type:'accuracy', target:90,    label:'Finir avec 90% de précision',  xp:150 },
  { id:'streak_5',    type:'streak',   target:5,     label:'5 kills consécutifs',          xp:50  },
  { id:'streak_10',   type:'streak',   target:10,    label:'10 kills consécutifs',         xp:100 },
  { id:'streak_20',   type:'streak',   target:20,    label:'20 kills consécutifs',         xp:200 },
  { id:'session_3',   type:'sessions', target:3,     label:'Jouer 3 sessions',             xp:40  },
  { id:'session_5',   type:'sessions', target:5,     label:'Jouer 5 sessions',             xp:80  },
  { id:'session_10',  type:'sessions', target:10,    label:'Jouer 10 sessions',            xp:150 },
];

function loadMissions() {
  try {
    const saved = JSON.parse(localStorage.getItem('valAim3D_missions') || '[]');
    activeMissions = saved.filter(m => m && m.id && m.type && typeof m.progress === 'number');
  } catch { activeMissions = []; }
  fillMissions();
}

function saveMissions() {
  localStorage.setItem('valAim3D_missions', JSON.stringify(activeMissions));
}

// Keep exactly 3 active missions at all times.
// Completed missions are kept in history (max 3) and their id returns to the pool.
function fillMissions() {
  const activeIds = activeMissions.filter(m => !m.completed).map(m => m.id);
  const needed = 3 - activeIds.length;
  if (needed > 0) {
    const pool = MISSION_DEFS.filter(d => !activeIds.includes(d.id));
    for (let i = 0; i < needed && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const def = pool.splice(idx, 1)[0];
      activeMissions.push({ ...def, progress: 0, completed: false });
    }
  }
  // Keep at most 3 completed entries as history
  const done = activeMissions.filter(m => m.completed)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 3);
  activeMissions = [...activeMissions.filter(m => !m.completed), ...done];
  saveMissions();
}

// Called at end of each game with the session's final stats.
// type: 'score' | 'hits' | 'accuracy' | 'streak' | 'sessions'
function updateMissions(type, value) {
  let anyCompleted = false;
  activeMissions.forEach(m => {
    if (m.completed || m.type !== type) return;
    if (type === 'accuracy' || type === 'streak') {
      m.progress = Math.round(value);
      if (value >= m.target) { m.completed = true; m.completedAt = Date.now(); anyCompleted = true; addXP(m.xp); }
    } else {
      m.progress = Math.min(m.progress + value, m.target);
      if (m.progress >= m.target) { m.completed = true; m.completedAt = Date.now(); anyCompleted = true; addXP(m.xp); }
    }
  });
  if (anyCompleted) fillMissions();
  else saveMissions();
  renderMissions();
}

function renderMissions() {
  const container = document.getElementById('missions-container');
  if (!container) return;
  const active = activeMissions.filter(m => !m.completed);
  const done   = activeMissions.filter(m => m.completed);
  container.innerHTML = [...active, ...done].map(m => {
    const pct = Math.min(100, Math.round(m.progress / m.target * 100));
    return `<div class="mission-card${m.completed ? ' completed' : ''}">
      <div class="mission-header">
        <span class="mission-label">${m.label}</span>
        <span class="mission-xp">+${m.xp} XP</span>
      </div>
      <div class="mission-progress-bar"><div class="mission-progress-fill" style="width:${pct}%"></div></div>
      <div class="mission-footer">
        <span>${m.progress}/${m.target}</span>
        ${m.completed ? '<span class="mission-done">✓ Complétée</span>' : `<span>${pct}%</span>`}
      </div>
    </div>`;
  }).join('');
}

// ============ XP & LEVELS ============
// Cumulative XP needed to reach each level (index = level - 1)
const XP_LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,
                   4000, 5000, 6200, 7600, 9200, 11000, 13200, 15700, 18500, 22000];
const MAX_LEVEL = XP_LEVELS.length;

const LEVEL_NAMES = [
  '', 'Rookie','Rookie','Rookie',
  'Contender','Contender','Contender',
  'Rising','Rising','Rising',
  'Veteran','Veteran','Veteran',
  'Expert','Expert','Expert',
  'Elite','Elite',
  'Master','Master'
];

function loadXP() { return parseInt(localStorage.getItem('valAim3D_xp') || '0', 10); }
function saveXP(xp) { localStorage.setItem('valAim3D_xp', String(xp)); }

function getLevel(xp) {
  let level = 1;
  for (let i = 1; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i]) level = i + 1; else break;
  }
  return Math.min(level, MAX_LEVEL);
}

function getLevelProgress(xp) {
  const level = getLevel(xp);
  if (level >= MAX_LEVEL) return { current: xp, needed: xp, pct: 100 };
  const lo = XP_LEVELS[level - 1], hi = XP_LEVELS[level];
  return { current: xp - lo, needed: hi - lo, pct: Math.round((xp - lo) / (hi - lo) * 100) };
}

function addXP(amount) {
  const prev = loadXP();
  const oldLevel = getLevel(prev);
  const newXP = prev + amount;
  saveXP(newXP);
  const newLevel = getLevel(newXP);
  renderLevelUI();
  if (newLevel > oldLevel) showLevelUp(newLevel);
}

function renderLevelUI() {
  const xp = loadXP();
  const level = getLevel(xp);
  const prog = getLevelProgress(xp);
  const name = LEVEL_NAMES[level - 1] || 'Rookie';
  const levelEl = document.getElementById('menu-level');
  const fillEl  = document.getElementById('menu-xp-fill');
  const textEl  = document.getElementById('menu-xp-text');
  if (levelEl) levelEl.textContent = 'Niv. ' + level + ' — ' + name;
  if (fillEl)  fillEl.style.width = prog.pct + '%';
  if (textEl)  textEl.textContent = prog.current + ' / ' + prog.needed + ' XP';
}

function showLevelUp(level) {
  const n = document.createElement('div');
  n.className = 'levelup-notif';
  n.innerHTML = icon('trophy',20) + ' Niveau ' + level + ' — ' + (LEVEL_NAMES[level - 1] || '') + ' !';
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

// ============================================================
// BENCHMARK DASHBOARD
// ============================================================
function renderBenchmark() {
  const total=calcTotalThreads(), max=calcMaxTotal();
  const rank=calcRankFromThreads(total);
  $('#bench-overall-rank').textContent=rank.label; $('#bench-overall-rank').style.color=rank.color;
  $('#bench-overall-threads').textContent=total+' / '+max+' Threads';

  // Update global tier chips
  document.querySelectorAll('.bench-gtier-chip').forEach(c=>c.classList.toggle('active',c.dataset.tier===currentTier));

  const container=$('#bench-categories'); container.innerHTML='';
  const cats=['control_tracking','reactive_tracking','flick_tech','click_timing'];

  // Snapshot previous threads for delta display
  const _prevSnap = JSON.parse(localStorage.getItem('visc_snap_'+currentTier) || '{}');
  const _newSnap  = {};

  cats.forEach(catKey => {
    const col=document.createElement('div'); col.className='bench-cat';
    col.innerHTML=`<div class="bench-cat-title">${CAT_LABELS[catKey]}</div>`;
    const subs=[...new Set(Object.values(SCENARIOS).filter(v=>v.cat===catKey).map(v=>v.sub))];

    subs.forEach(sub => {
      const subTh=calcSubThreads(sub), subMax=calcMaxSubThreads(sub);
      const div=document.createElement('div'); div.className='bench-sub';
      div.innerHTML=`<div class="bench-sub-title"><span>${SUB_LABELS[sub]||sub}</span><span class="bench-sub-threads" style="color:${RANK_COLORS[Math.min(Math.floor(subTh/subMax*7),7)]}">${subTh}/${subMax}</span></div>`;

      Object.entries(SCENARIOS).filter(([,v])=>v.cat===catKey&&v.sub===sub).forEach(([key,sc])=>{
        const best=getBest(key), threads=calcThreads(key,best);
        _newSnap[key] = threads;
        const _prev = _prevSnap[key] ?? null;
        const _delta = _prev !== null ? threads - _prev : null;
        const _deltaHtml = _delta === null ? '' : _delta > 0
          ? `<span class="bench-delta bench-delta-up">↑+${_delta}</span>`
          : _delta < 0 ? `<span class="bench-delta bench-delta-down">↓${_delta}</span>`
          : '';
        const pct=Math.min(100,threads/getMaxThreads()*100);
        const mt=getMaxThreads();
        const wrap=document.createElement('div'); wrap.className='bench-scenario-wrap';

        // Per-tier chips [E][M][H] with lock
        const tierChipsHtml = ['easier','medium','hard'].map(t => {
          const unlocked = isScenarioUnlocked(key, t);
          const bestT = getBestFor(key, t);
          const thT = calcThreadsFor(key, bestT, t);
          const mtT = maxThreadsFor(t);
          const lbl = t==='easier'?'E':t==='medium'?'M':'H';
          if (!unlocked) {
            const prevT = t==='hard'?'medium':'easier';
            const prevLbl = t==='hard'?'Medium':'Easier';
            const mxT = maxThreadsFor(prevT);
            return `<span class="bsc-chip locked" title="Obtenir ${mxT}/${mxT} threads en ${prevLbl} pour débloquer">${icon('lock',14)}</span>`;
          }
          const active = t === currentTier;
          return `<span class="bsc-chip${active?' active':''} tier-${t}" data-key="${key}" data-tier="${t}" title="${t} · ${thT}/${mtT} threads">${lbl}<sub>${thT}</sub></span>`;
        }).join('');

        const rowLocked = !isScenarioUnlocked(key, currentTier);
        const row=document.createElement('div'); row.className='bench-scenario' + (rowLocked ? ' bench-scenario-locked' : '');
        row.innerHTML=`
          <span class="bench-scenario-name">${rowLocked?icon('lock',14)+' ':''}${getLabel(key)}</span>
          <span class="bsc-chips">${tierChipsHtml}</span>
          <span class="bench-scenario-score ${best>0?'has-score':''}">${best>0?best.toLocaleString():'-'}</span>
          <div class="bench-thread-bar"><div class="bench-thread-fill" style="width:${pct}%;background:${RANK_COLORS[Math.min(threads,7)]}"></div></div>
          <span class="bench-scenario-threads">${threads}/${mt} ${_deltaHtml}</span>
          <span class="bench-th-toggle" title="Voir les seuils">&#9660;</span>`;

        // Threshold table
        const thTable=document.createElement('div'); thTable.className='bench-th-table hidden';
        const thArr=getTh(key)||[];
        thTable.innerHTML=`<table class="bench-th-inner">
          <thead><tr>${thArr.map((_,i)=>`<th>${i+1}/${mt}</th>`).join('')}</tr></thead>
          <tbody><tr>${thArr.map((v,i)=>`<td style="color:${RANK_COLORS[Math.min(i,7)]}">${v.toLocaleString()}</td>`).join('')}</tr></tbody>
        </table>`;

        const toggle=row.querySelector('.bench-th-toggle');
        toggle.addEventListener('click', e=>{
          e.stopPropagation();
          const hidden=thTable.classList.toggle('hidden');
          toggle.textContent=hidden?'▼':'▲';
        });
        // Tier chip click: set tier + launch
        row.querySelectorAll('.bsc-chip:not(.locked)').forEach(chip=>{
          chip.addEventListener('click', e=>{
            e.stopPropagation();
            currentTier = chip.dataset.tier;
            window._coachLaunchSource = null; // benchmark, pas daily training
            G.benchmarkMode = true;
            startGame(chip.dataset.key);
          });
        });
        // Row click: launch with current tier
        row.addEventListener('click', ()=>{ window._coachLaunchSource=null; G.benchmarkMode=true; startGame(key); });

        wrap.appendChild(row);
        wrap.appendChild(thTable);
        div.appendChild(wrap);
      });
      col.appendChild(div);
    });
    container.appendChild(col);
  });
  // Persist snapshot for next session's delta
  localStorage.setItem('visc_snap_'+currentTier, JSON.stringify(_newSnap));

  // Expose for Daily Training in coaching.js
  window._viscData = { SCENARIOS, getThFor, maxThreadsFor, getBestFor, calcThreadsFor, isScenarioUnlocked,
    setTier:(t)=>{currentTier=t;}, getTier:()=>currentTier, getBest, calcThreads, renderBenchmark };
}

// ---- EVENTS ----
document.addEventListener('mousemove',onMouseMove);
document.addEventListener('mousedown',e=>{
  if(e.button===0&&G.running&&G.locked) {
    shoot();
    if(G.mode==='burst_drill') {
      G.autoFireTimer=setInterval(()=>{ if(G.running&&G.locked)shoot(); },65);
    }
  }
});
document.addEventListener('mouseup',e=>{
  if(e.button===0) {
    if(G.autoFireTimer){ clearInterval(G.autoFireTimer); G.autoFireTimer=null; }
  }
});
$$('.mode-card').forEach(c=>c.addEventListener('click',()=>{G.benchmarkMode=false;startGame(c.dataset.mode);}));
$('#btn-retry')?.addEventListener('click',()=>startGame(G.mode));
// btn-menu onclick is always set by endGame() before results screen appears — no permanent listener needed
$('#btn-benchmark')?.addEventListener('click',()=>{showScreen('benchmark-screen');renderBenchmark();});
$('#btn-bench-back')?.addEventListener('click',()=>showScreen('menu-screen'));
$('#btn-freeplay')?.addEventListener('click',()=>showScreen('free-play-screen'));
$('#btn-freeplay-back')?.addEventListener('click',()=>showScreen('menu-screen'));
$('#btn-settings-menu')?.addEventListener('click',()=>showScreen('settings-screen'));
$('#btn-settings-back')?.addEventListener('click',()=>showScreen('menu-screen'));
// _viscData exposed in renderBenchmark() — also init here for early access
window._viscData = { SCENARIOS, getThFor, maxThreadsFor, getBestFor, calcThreadsFor, isScenarioUnlocked,
  setTier:(t)=>{currentTier=t;}, getTier:()=>currentTier, getBest, calcThreads, renderBenchmark };

$('#opt-sens-mode').addEventListener('change',e=>{
  const mode=e.target.value;
  const newVal = cm360ToGameSens(mode, G.cm360);
  $('#opt-sens-val').value = Math.round(newVal*100)/100;
  $('#opt-sens-val').step = (SENS_DEFAULTS[mode]||SENS_DEFAULTS.cm360).step;
  saveSettings({sensMode:mode,sensVal:newVal,cm360:G.cm360});
  updateSensDisplay();
});
$('#opt-sens-val').addEventListener('input',e=>{
  const mode=$('#opt-sens-mode').value, val=parseFloat(e.target.value)||34;
  G.cm360=gameSensToCm360(mode, val);
  saveSettings({sensMode:mode,sensVal:val,cm360:G.cm360});
  updateSensDisplay();
});
$('#opt-dpi').addEventListener('input',e=>{
  const dpi=parseInt(e.target.value)||800;
  const mode=$('#opt-sens-mode').value, val=parseFloat($('#opt-sens-val').value)||34;
  G.cm360=gameSensToCm360(mode, val);
  saveSettings({dpi:dpi,cm360:G.cm360});
});
$('#opt-diff').addEventListener('change',e=>saveSettings({difficulty:e.target.value}));
$('#opt-duration').addEventListener('change',e=>saveSettings({duration:parseInt(e.target.value)}));
$('#opt-sound').addEventListener('change',e=>saveSettings({soundOn:e.target.checked}));
$('#opt-volume').addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  $('#opt-volume-val').textContent = Math.round(v * 100) + '%';
  audioEngine.setVolume(v);
  saveSettings({ soundVolume: v });
});
document.querySelectorAll('.sett-sound-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.sett-sound-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const pack = chip.dataset.pack;
    audioEngine.setPack(pack);
    saveSettings({ soundPack: pack });
  });
});
$('#sound-test-btn').addEventListener('click', () => {
  audioEngine.init();
  audioEngine.play('hit');
  setTimeout(() => audioEngine.play('headshot'), 300);
  setTimeout(() => audioEngine.play('combo'), 600);
});
// Crosshair Valorant settings
function xhBind(id, key, parse, valId) {
  const el = $(id); if(!el) return;
  el.addEventListener('input', e => {
    const v = parse ? parse(e.target.value) : e.target.value;
    if (valId) $(valId).textContent = v;
    saveSettings({[key]: v});
    applyCrosshair();
  });
}
function xhCheck(id, key) {
  const el = $(id); if(!el) return;
  el.addEventListener('change', e => { saveSettings({[key]: e.target.checked}); applyCrosshair(); });
}
xhBind('#xh-color','xhColor',null,null);
xhBind('#xh-opacity','xhOpacity',parseFloat,'#xh-opacity-val');
xhBind('#xh-outline','xhOutline',parseFloat,'#xh-outline-val');
xhCheck('#xh-dot','xhDot');
xhBind('#xh-dot-size','xhDotSize',parseFloat,'#xh-dot-size-val');
xhCheck('#xh-inner-show','xhInnerShow');
xhBind('#xh-inner-len','xhInnerLen',parseInt,'#xh-inner-len-val');
xhBind('#xh-inner-thick','xhInnerThick',parseFloat,'#xh-inner-thick-val');
xhBind('#xh-inner-gap','xhInnerGap',parseInt,'#xh-inner-gap-val');
xhCheck('#xh-outer-show','xhOuterShow');
xhBind('#xh-outer-len','xhOuterLen',parseInt,'#xh-outer-len-val');
xhBind('#xh-outer-thick','xhOuterThick',parseFloat,'#xh-outer-thick-val');
xhBind('#xh-outer-gap','xhOuterGap',parseInt,'#xh-outer-gap-val');
$('#opt-theme').addEventListener('change',e=>{saveSettings({theme:e.target.value});applyTheme(e.target.value);});
$('#opt-room-theme').addEventListener('change',e=>{saveSettings({roomTheme:e.target.value});applyRoomTheme();});
document.addEventListener('contextmenu',e=>{if(G.running)e.preventDefault();});

// ============ PAUSE MENU ============
let paused = false;
let pauseTimeLeft = 0;

function pauseGame() {
  if (!G.running || paused) return;
  paused = true;
  clearInterval(G.timerInterval);
  clearInterval(G.spawnTimer); G.spawnTimer = null;
  pauseTimeLeft = G.timeLeft;
  if (document.exitPointerLock) document.exitPointerLock();

  // Update pause info
  const pm = $('#pause-mode');
  if (pm) pm.textContent = G.mode.replace(/_/g,' ');
  const ps = $('#pause-score');
  if (ps) ps.textContent = 'Score: ' + G.score;
  const pt = $('#pause-time');
  if (pt) pt.textContent = 'Temps: ' + G.timeLeft + 's';

  $('#pause-menu').classList.remove('hidden');
  $('#click-to-start').classList.add('hidden');
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  $('#pause-menu').classList.add('hidden');
  G.timeLeft = pauseTimeLeft;
  G.running = false;

  const btn = $('#click-to-start');
  btn.classList.remove('hidden');

  function doResume() {
    btn.removeEventListener('click', doResume);
    btn.classList.add('hidden');
    lockPointer();
    G.running = true;
    clearInterval(G.timerInterval);
    G.timerInterval = setInterval(() => {
      G.timeLeft--;
      $('#hud-timer').textContent = G.timeLeft;
      if (G.timeLeft <= 5) $('#hud-timer').classList.add('urgent');
      if (G.timeLeft <= 0) endGame();
    }, 1000);
    const iv = INTERVAL_MODES[G.mode];
    if (iv) G.spawnTimer = setInterval(() => { const f = SPAWN_MAP[G.mode]; if(f) f(); }, iv);
  }
  btn.addEventListener('click', doResume);
}

function quitToMenu() {
  paused = false;
  G.running = false;
  clearInterval(G.timerInterval); clearInterval(G.spawnTimer); G.spawnTimer = null;
  if (document.exitPointerLock) document.exitPointerLock();
  G.targets.forEach(t => { if(t.alive) { t.alive = false; targetsGroup.remove(t.mesh); } });
  G.targets = []; trackTarget = null; switchTargets = [];
  $('#pause-menu').classList.add('hidden');
  showScreen('menu-screen');
}

function quitToBenchmark() {
  paused = false;
  G.running = false;
  clearInterval(G.timerInterval); clearInterval(G.spawnTimer); G.spawnTimer = null;
  if (document.exitPointerLock) document.exitPointerLock();
  G.targets.forEach(t => { if(t.alive) { t.alive = false; targetsGroup.remove(t.mesh); } });
  G.targets = []; trackTarget = null; switchTargets = [];
  $('#pause-menu').classList.add('hidden');
  showScreen('benchmark-screen');
  renderBenchmark();
}

function pauseToSettings() {
  quitToMenu();
  // Scroll to crosshair section after showing menu
  setTimeout(() => {
    const xhSection = document.querySelector('#xh-preview');
    if (xhSection) xhSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ESC key handler
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (paused) {
      resumeGame();
    } else if (G.running) {
      e.preventDefault();
      pauseGame();
    }
  }
});

// Pause buttons
$('#pause-resume')?.addEventListener('click', resumeGame);
$('#pause-restart')?.addEventListener('click', () => {
  paused = false;
  G.running = false;
  clearInterval(G.timerInterval); clearInterval(G.spawnTimer); G.spawnTimer = null;
  G.targets.forEach(t => { if(t.alive) { t.alive = false; targetsGroup.remove(t.mesh); } });
  G.targets = []; trackTarget = null; switchTargets = [];
  $('#pause-menu').classList.add('hidden');
  startGame(G.mode);
});
$('#pause-settings')?.addEventListener('click', pauseToSettings);
$('#pause-benchmark')?.addEventListener('click', quitToBenchmark);
$('#pause-menu-btn')?.addEventListener('click', quitToMenu);

// Pointer lock change: pause when pointer is lost during play
document.addEventListener('pointerlockchange', () => {
  G.locked = !!document.pointerLockElement;
  lastMoveTime = 0;
  skipFrames = 3;
  if (!G.locked && G.running && !paused) {
    pauseGame();
  }
});

// ---- INIT ----
initThree(); gameLoop(); applySettings(); updateMenuStats(); loadMissions(); renderMissions(); renderLevelUI();

// ---- SESSION REPLAY ----
let _rpl = { data: null, playing: false, elapsed: 0, lastRaf: null, raf: null, speed: 1 };

function showReplay() {
  const raw = localStorage.getItem('mayhaim_replay');
  if (!raw) return;
  let data;
  try { data = JSON.parse(raw); } catch(e) { return; }
  _rpl.data = data;
  _rpl.playing = true;
  _rpl.elapsed = 0;
  _rpl.lastRaf = null;
  _rpl.speed = parseFloat($('#rpl-speed')?.value || 1);

  const overlay = $('#replay-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  const modeLabel = (typeof SCENARIOS !== 'undefined' && SCENARIOS[data.mode]?.label) || data.mode.replace(/_/g,' ');
  const modeLblEl = $('#rpl-mode-lbl');
  if (modeLblEl) modeLblEl.textContent = modeLabel + ' · ' + data.duration + 's';

  const canvas = $('#rpl-canvas');
  if (!canvas) return;
  // Set canvas internal resolution
  canvas.width  = 720;
  canvas.height = 405;

  const scrub = $('#rpl-scrub');
  if (scrub) scrub.value = 0;

  cancelAnimationFrame(_rpl.raf);
  _rpl.raf = requestAnimationFrame(_replayTick);
}

function hideReplay() {
  const overlay = $('#replay-overlay');
  if (overlay) overlay.style.display = 'none';
  _rpl.playing = false;
  cancelAnimationFrame(_rpl.raf);
}

function replayToggle() {
  // Si la lecture est terminée, repartir depuis le début
  const totalMs = (_rpl.data?.duration || 0) * 1000;
  if (!_rpl.playing && totalMs > 0 && _rpl.elapsed >= totalMs) {
    _rpl.elapsed = 0;
    const scrub = $('#rpl-scrub');
    if (scrub) scrub.value = 0;
  }
  _rpl.playing = !_rpl.playing;
  const btn = $('#rpl-playpause');
  if (btn) btn.textContent = _rpl.playing ? '⏸ Pause' : '▶ Play';
  if (_rpl.playing) {
    _rpl.lastRaf = null;
    _rpl.raf = requestAnimationFrame(_replayTick);
  }
}

function replaySetSpeed() {
  _rpl.speed = parseFloat($('#rpl-speed')?.value || 1);
}

function replayScrub(val) {
  if (!_rpl.data) return;
  const totalMs = _rpl.data.duration * 1000;
  _rpl.elapsed = (parseFloat(val) / 100) * totalMs;
  _rpl.playing = false;
  const btn = $('#rpl-playpause');
  if (btn) btn.textContent = '▶ Play';
  _replayDraw(_rpl.elapsed);
}

function _replayTick(now) {
  if (!_rpl.playing || !_rpl.data) return;
  if (_rpl.lastRaf !== null) {
    _rpl.elapsed += (now - _rpl.lastRaf) * _rpl.speed;
  }
  _rpl.lastRaf = now;

  const totalMs = _rpl.data.duration * 1000;
  if (_rpl.elapsed >= totalMs) {
    _rpl.elapsed = totalMs;
    _rpl.playing = false;
    const btn = $('#rpl-playpause');
    if (btn) btn.textContent = '▶ Play';
  }

  _replayDraw(_rpl.elapsed);

  const scrub = $('#rpl-scrub');
  if (scrub) scrub.value = ((_rpl.elapsed / totalMs) * 100).toFixed(1);
  const timeEl = $('#rpl-time');
  if (timeEl) timeEl.textContent = (_rpl.elapsed/1000).toFixed(1)+'s / '+_rpl.data.duration+'s';

  if (_rpl.playing) _rpl.raf = requestAnimationFrame(_replayTick);
}

function _replayDraw(elapsed) {
  const canvas = $('#rpl-canvas');
  if (!canvas || !_rpl.data) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const { trail, clicks } = _rpl.data;

  // Background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#ffffff08';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += W/8) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y <= H; y += H/6) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Center crosshair
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
  ctx.setLineDash([]);

  // Draw trail (only if we have trail data)
  const visibleTrail = trail.filter(p => p.t <= elapsed);
  if (trail.length > 0 && visibleTrail.length > 0) {
    const yaws = trail.map(p => p.yaw), pitches = trail.map(p => p.pitch);
    let minY = Math.min(...yaws), maxY = Math.max(...yaws);
    let minP = Math.min(...pitches), maxP = Math.max(...pitches);

    const padY = Math.max((maxY - minY) * 0.15, 0.05);
    const padP = Math.max((maxP - minP) * 0.15, 0.03);
    minY -= padY; maxY += padY;
    minP -= padP; maxP += padP;
    const rangeY = maxY - minY || 1, rangeP = maxP - minP || 1;

    const toX = yaw   => W * (1 - (yaw   - minY) / rangeY);
    const toY = pitch => H * ((pitch - minP) / rangeP);

    ctx.lineWidth = 1.5;
    const tc = visibleTrail.length;
    for (let i = 1; i < tc; i++) {
      const age = tc - i;
      const alpha = Math.max(0.05, 1 - age / Math.min(tc, 120));
      ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.5).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(toX(visibleTrail[i-1].yaw), toY(visibleTrail[i-1].pitch));
      ctx.lineTo(toX(visibleTrail[i].yaw),   toY(visibleTrail[i].pitch));
      ctx.stroke();
    }

    // Crosshair at current position
    const last = visibleTrail[tc - 1];
    const cx = toX(last.yaw), cy = toY(last.pitch);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00ff88cc'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx-10,cy); ctx.lineTo(cx+10,cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy-10); ctx.lineTo(cx,cy+10); ctx.stroke();
  }

  // Draw clicks — always shown regardless of trail (screen [0,1] → canvas px)
  const visClicks = clicks.filter(c => (c.t || 0) <= elapsed);
  visClicks.forEach(c => {
    const sx = W * c.x, sy = H * c.y;
    const fade = Math.max(0, 1 - (elapsed - (c.t || 0)) / 3000);
    const alpha = Math.max(0.25, fade);
    const radius = c.hit ? 7 : 5;
    ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = c.hit
      ? `rgba(34,197,94,${alpha.toFixed(2)})`
      : `rgba(239,68,68,${alpha.toFixed(2)})`;
    ctx.fill();
    if (c.hit) {
      ctx.strokeStyle = `rgba(134,239,172,${(alpha * 0.6).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, radius + 4, 0, Math.PI * 2); ctx.stroke();
    }
  });
}

// ============================================================
// ═══ DATA RESET — bump DATA_VERSION to force wipe on all clients ═══
// ============================================================
const DATA_VERSION = 2; // bump this number to force a localStorage reset for all users
(function checkDataVersion() {
  const stored = parseInt(localStorage.getItem('mayhaim_data_version') || '0', 10);
  if (stored < DATA_VERSION) {
    // Preserve auth token and settings only
    const token = localStorage.getItem('ch_token');
    const settings = localStorage.getItem('valAim3Dv3_settings');
    localStorage.clear();
    if (token) localStorage.setItem('ch_token', token);
    if (settings) localStorage.setItem('valAim3Dv3_settings', settings);
    localStorage.setItem('mayhaim_data_version', String(DATA_VERSION));
    console.log('[reset] localStorage wiped (data version ' + stored + ' → ' + DATA_VERSION + ')');
  }
})();

// ============================================================
// ═══ CLOUD SYNC — bidirectional localStorage ↔ server ═══
// ============================================================

let _syncInProgress = false;
let _syncDebounce = null;

// Collect all localStorage data into one blob
function _collectLocalData() {
  const data = {};
  // Benchmark best scores per tier
  for (const tier of ['medium', 'hard', 'easier']) {
    try { data['bench_' + tier] = JSON.parse(localStorage.getItem('visc_bench_' + tier)) || {}; } catch { data['bench_' + tier] = {}; }
  }
  // Run history per mode
  data.runs = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('visc_runs_')) {
      const mode = k.replace('visc_runs_', '');
      try { data.runs[mode] = JSON.parse(localStorage.getItem(k)) || []; } catch { data.runs[mode] = []; }
    }
  }
  // Achievement stats & unlocked
  try { data.ach_stats = JSON.parse(localStorage.getItem('ach_stats')) || {}; } catch { data.ach_stats = {}; }
  try { data.ach_unlocked = JSON.parse(localStorage.getItem('ach_unlocked')) || []; } catch { data.ach_unlocked = []; }
  // Weekly challenges
  try { data.weekly_challenges = JSON.parse(localStorage.getItem('weekly_challenges')) || {}; } catch { data.weekly_challenges = {}; }
  // XP & missions
  data.xp = parseInt(localStorage.getItem('valAim3D_xp') || '0', 10);
  try { data.missions = JSON.parse(localStorage.getItem('valAim3D_missions')) || []; } catch { data.missions = []; }
  // Settings
  try { data.settings = JSON.parse(localStorage.getItem('valAim3Dv3_settings')) || {}; } catch { data.settings = {}; }
  return data;
}

// Apply merged data back to localStorage
function _applyMergedData(data) {
  if (!data || typeof data !== 'object') return;
  // Benchmark
  for (const tier of ['medium', 'hard', 'easier']) {
    if (data['bench_' + tier]) localStorage.setItem('visc_bench_' + tier, JSON.stringify(data['bench_' + tier]));
  }
  // Runs
  if (data.runs) {
    for (const [mode, arr] of Object.entries(data.runs)) {
      localStorage.setItem('visc_runs_' + mode, JSON.stringify(arr));
    }
  }
  // Achievements
  if (data.ach_stats) localStorage.setItem('ach_stats', JSON.stringify(data.ach_stats));
  if (data.ach_unlocked) localStorage.setItem('ach_unlocked', JSON.stringify(data.ach_unlocked));
  // Weekly
  if (data.weekly_challenges) localStorage.setItem('weekly_challenges', JSON.stringify(data.weekly_challenges));
  // XP
  if (typeof data.xp === 'number') localStorage.setItem('valAim3D_xp', String(data.xp));
  // Missions
  if (data.missions) localStorage.setItem('valAim3D_missions', JSON.stringify(data.missions));
  // Settings
  if (data.settings && Object.keys(data.settings).length > 0) {
    localStorage.setItem('valAim3Dv3_settings', JSON.stringify(data.settings));
    if (typeof applySettings === 'function') applySettings();
  }
}

// Push local data to server, receive merged, apply locally
async function cloudSync(direction) {
  if (_syncInProgress) return;
  const token = (typeof coachingToken !== 'undefined' && coachingToken) ? coachingToken : localStorage.getItem('ch_token');
  if (!token) { console.log('[sync] skip — no token'); return; }
  _syncInProgress = true;
  _updateSyncUI('syncing');
  console.log('[sync]', direction, 'starting…');
  try {
    const apiBase = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '/api';
    if (direction === 'pull') {
      const res = await fetch(apiBase + '/profile?action=sync-pull', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      console.log('[sync] pull response:', res.status);
      if (!res.ok) { const t = await res.text(); throw new Error('sync pull ' + res.status + ': ' + t.substring(0,200)); }
      const { data } = await res.json();
      const keys = data ? Object.keys(data).length : 0;
      console.log('[sync] pull got', keys, 'keys');
      if (keys > 0) _applyMergedData(data);
    } else {
      const clientData = _collectLocalData();
      console.log('[sync] push payload keys:', Object.keys(clientData).join(','));
      const res = await fetch(apiBase + '/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ action: 'sync-push', client_data: clientData })
      });
      console.log('[sync] push response:', res.status);
      if (!res.ok) { const t = await res.text(); throw new Error('sync push ' + res.status + ': ' + t.substring(0,200)); }
      const { data } = await res.json();
      if (data) _applyMergedData(data);
      console.log('[sync] push+merge OK');
    }
    _updateSyncUI('synced');
  } catch (e) {
    console.warn('[sync]', e.message);
    _updateSyncUI('error');
  } finally {
    _syncInProgress = false;
  }
}

// Debounced sync — called after each game end
function debouncedSync() {
  if (_syncDebounce) clearTimeout(_syncDebounce);
  _syncDebounce = setTimeout(() => cloudSync('push'), 2000);
}

// UI indicator
function _updateSyncUI(state) {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  el.className = 'sync-indicator sync-' + state;
  if (state === 'syncing') { el.innerHTML = `${icon('cloud',14)} Sync…`; el.title = 'Synchronisation en cours'; }
  else if (state === 'synced') { el.innerHTML = `${icon('cloud',14)} ✓`; el.title = 'Données synchronisées'; setTimeout(() => { if(el.className.includes('synced')) { el.innerHTML = icon('cloud',14); el.title='Synchronisé'; } }, 3000); }
  else if (state === 'error') { el.innerHTML = `${icon('cloud',14)} ✗`; el.title = 'Erreur de synchronisation'; }
  else { el.innerHTML = icon('cloud',14); el.title = 'Cloud sync'; }
}

// Called from coaching.js on login
function onLoginSync() { cloudSync('pull').then(() => cloudSync('push')); }
// Called from coaching.js on logout — reset indicator
function onLogoutSync() { _updateSyncUI('idle'); }

