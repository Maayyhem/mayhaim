// ============ VALORANT TACTICAL MAPS ============
// Using official Valorant API minimap images (valorant-api.com)

// Custom scenario map storage
function getCustomScenarioMap(scenarioId) {
  try {
    const all = JSON.parse(localStorage.getItem('me_scenario_maps') || '{}');
    return all[scenarioId] || null;
  } catch { return null; }
}

function saveCustomScenarioMap(scenarioId, mapName, steps, rotation) {
  try {
    const all = JSON.parse(localStorage.getItem('me_scenario_maps') || '{}');
    const val = { map: mapName, steps: steps, rotation: rotation || 0 };
    all[scenarioId] = val;
    localStorage.setItem('me_scenario_maps', JSON.stringify(all));
    // Sync to DB if coach/admin logged in
    if (typeof pushStratToDB === 'function') pushStratToDB(scenarioId, val);
  } catch(e) { console.error('Failed to save custom map:', e); }
}

function deleteCustomScenarioMap(scenarioId) {
  try {
    const all = JSON.parse(localStorage.getItem('me_scenario_maps') || '{}');
    delete all[scenarioId];
    localStorage.setItem('me_scenario_maps', JSON.stringify(all));
  } catch(e) {}
}

const VALO_API = 'https://media.valorant-api.com/maps';

const MAP_DATA = {
  Bind: {
    img: `${VALO_API}/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/displayicon.png`,
    width: 1024, height: 1024
  },
  Haven: {
    img: `${VALO_API}/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/displayicon.png`,
    width: 1024, height: 1024
  },
  Ascent: {
    img: `${VALO_API}/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/displayicon.png`,
    width: 1024, height: 1024
  },
  Split: {
    img: `${VALO_API}/d960549e-485c-e861-8d71-aa9d1aed12a2/displayicon.png`,
    width: 1024, height: 1024
  },
  Icebox: {
    img: `${VALO_API}/e2ad5c54-4114-a870-9641-8ea21279579a/displayicon.png`,
    width: 1024, height: 1024
  },
  Breeze: {
    img: `${VALO_API}/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/displayicon.png`,
    width: 1024, height: 1024
  },
  Fracture: {
    img: `${VALO_API}/b529448b-4d60-346e-e89e-00a4c527a405/displayicon.png`,
    width: 1024, height: 1024
  },
  Pearl: {
    img: `${VALO_API}/fd267378-4d1d-484f-ff52-77821ed10dc2/displayicon.png`,
    width: 1024, height: 1024
  },
  Lotus: {
    img: `${VALO_API}/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/displayicon.png`,
    width: 1024, height: 1024
  },
  Sunset: {
    img: `${VALO_API}/92584fbe-486a-b1b2-9faa-39b0f486b498/displayicon.png`,
    width: 1024, height: 1024
  },
  Abyss: {
    img: `${VALO_API}/224b0a95-48b9-f703-1bd8-67aca101a61f/displayicon.png`,
    width: 1024, height: 1024
  },
  Corrode: {
    img: `${VALO_API}/1c18ab1f-420d-0d8b-71d0-77ad3c439115/displayicon.png`,
    width: 1024, height: 1024
  }
};

// Scenario annotations - coordinates are in 1024x1024 space matching the minimap
// These are starting templates; use the Map Editor to calibrate for your exact minimap orientation.
const SCENARIO_ANNOTATIONS = {
  1: { // B Site Execute - Bind
    map: 'Bind',
    steps: [
      { label: "Setup", elements: [
        { type:'player', x:540, y:610, label:'T1', team:'T' },
        { type:'player', x:590, y:650, label:'T2', team:'T' },
        { type:'player', x:480, y:640, label:'T3', team:'T' },
      ]},
      { label: "Smokes", elements: [
        { type:'smoke', x:560, y:490, label:'Hookah' },
        { type:'smoke', x:650, y:440, label:'Elbow' },
        { type:'smoke', x:490, y:430, label:'Garden' },
      ]},
      { label: "Flash + Entry", elements: [
        { type:'flash', x:590, y:460 },
        { type:'player', x:610, y:420, label:'Entry', team:'T' },
        { type:'arrow', x1:590, y1:610, x2:610, y2:430 },
      ]},
      { label: "Plant", elements: [
        { type:'plant', x:640, y:400 },
        { type:'player', x:680, y:440, label:'Anchor', team:'T' },
        { type:'player', x:600, y:460, label:'Planter', team:'T' },
      ]},
    ]
  },
  2: { // A Site Defense - Ascent
    map: 'Ascent',
    steps: [
      { label: "Default Positions", elements: [
        { type:'player', x:310, y:350, label:'Main', team:'CT' },
        { type:'player', x:270, y:290, label:'Heaven', team:'CT' },
        { type:'player', x:380, y:410, label:'Generator', team:'CT' },
      ]},
      { label: "Crossfire Setup", elements: [
        { type:'sightline', x1:310, y1:350, x2:310, y2:560 },
        { type:'sightline', x1:270, y1:290, x2:310, y2:560 },
        { type:'sightline', x1:380, y1:410, x2:420, y2:560 },
      ]},
      { label: "If They Push", elements: [
        { type:'smoke', x:310, y:520 },
        { type:'flash', x:280, y:490 },
        { type:'arrow', x1:310, y1:560, x2:310, y2:370, color:'#ff4444' },
        { type:'text', x:510, y:610, label:'COMM + ROTATE' },
      ]},
    ]
  },
  3: { // A Site Retake - Haven
    map: 'Haven',
    steps: [
      { label: "Regroup CT", elements: [
        { type:'player', x:500, y:600, label:'P1', team:'CT' },
        { type:'player', x:540, y:620, label:'P2', team:'CT' },
        { type:'player', x:460, y:620, label:'P3', team:'CT' },
      ]},
      { label: "Utility", elements: [
        { type:'smoke', x:320, y:490, label:'Long' },
        { type:'flash', x:340, y:450 },
        { type:'smoke', x:390, y:430, label:'Switch' },
      ]},
      { label: "Rotate + Flash", elements: [
        { type:'flash', x:310, y:420 },
        { type:'arrow', x1:500, y1:600, x2:340, y2:450 },
        { type:'arrow', x1:500, y1:600, x2:460, y2:440 },
      ]},
      { label: "Swing + Defuse", elements: [
        { type:'player', x:310, y:370, label:'P1', team:'CT' },
        { type:'player', x:390, y:380, label:'P2', team:'CT' },
        { type:'plant', x:350, y:360 },
        { type:'player', x:430, y:410, label:'Cover', team:'CT' },
      ]},
    ]
  },
  4: { // Mid Control - Split
    map: 'Split',
    steps: [
      { label: "Mid Smokes", elements: [
        { type:'smoke', x:500, y:400, label:'Vent' },
        { type:'smoke', x:470, y:480, label:'Mail' },
      ]},
      { label: "Clear Mid", elements: [
        { type:'flash', x:505, y:460 },
        { type:'arrow', x1:500, y1:620, x2:500, y2:470 },
        { type:'player', x:500, y:620, label:'Push', team:'T' },
      ]},
      { label: "Hold Mid", elements: [
        { type:'player', x:500, y:450, label:'Mid', team:'T' },
        { type:'sightline', x1:500, y1:450, x2:500, y2:350 },
      ]},
      { label: "Split A or B", elements: [
        { type:'arrow', x1:500, y1:450, x2:300, y2:310, color:'#58a6ff' },
        { type:'arrow', x1:500, y1:450, x2:700, y2:310, color:'#58a6ff' },
        { type:'text', x:500, y:540, label:'READ + DECIDE' },
      ]},
    ]
  },
  5: { // A Site Execute - Lotus
    map: 'Lotus',
    steps: [
      { label: "Info Util", elements: [
        { type:'flash', x:300, y:360, label:'Haunt' },
        { type:'player', x:340, y:560, label:'IGL', team:'T' },
        { type:'arrow', x1:340, y1:560, x2:300, y2:370 },
      ]},
      { label: "Smokes", elements: [
        { type:'smoke', x:260, y:310, label:'Tree' },
        { type:'smoke', x:340, y:300, label:'Rubble' },
        { type:'smoke', x:280, y:270, label:'Heaven' },
      ]},
      { label: "Flash + Push", elements: [
        { type:'flash', x:290, y:320 },
        { type:'flash', x:330, y:320 },
        { type:'player', x:270, y:290, label:'E1', team:'T' },
        { type:'player', x:350, y:290, label:'E2', team:'T' },
        { type:'arrow', x1:290, y1:450, x2:280, y2:300 },
        { type:'arrow', x1:340, y1:450, x2:350, y2:300 },
      ]},
      { label: "Plant", elements: [
        { type:'plant', x:300, y:280 },
        { type:'player', x:270, y:310, label:'Post 1', team:'T' },
        { type:'player', x:340, y:320, label:'Post 2', team:'T' },
        { type:'player', x:450, y:390, label:'Flank W.', team:'T' },
      ]},
    ]
  },
};

// Render blank minimap (no annotations) — used in scenario modal
function renderBlankMap(containerId, mapName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const mapData = MAP_DATA[mapName];
  if (!mapData) { container.innerHTML = ''; return; }
  const w = mapData.width, h = mapData.height;
  container.innerHTML = `<svg width="100%" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="border-radius:8px;max-height:280px;background:#0a0e14">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#0d1117"/>
    <image href="${mapData.img}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" onerror="this.style.display='none'"/>
  </svg>`;
}

// Render map with real minimap image + SVG annotation overlay
function renderTacticalMap(containerId, scenarioId, stepIndex) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Check for custom user annotations first, then fall back to defaults
  const customAnns = getCustomScenarioMap(scenarioId);
  const annotations = customAnns || SCENARIO_ANNOTATIONS[scenarioId];
  if (!annotations) {
    container.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">Map non disponible - clique "Editer la map" pour en creer une !</p>';
    return;
  }

  const mapData = MAP_DATA[annotations.map];
  if (!mapData) {
    container.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">Map non trouvee</p>';
    return;
  }

  const step = annotations.steps[stepIndex] || annotations.steps[0];
  const w = mapData.width;
  const h = mapData.height;

  const rot = annotations.rotation || 0;

  // SVG with embedded minimap image as background
  let svg = `<svg width="100%" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="border-radius:8px;max-height:400px;background:#0a0e14">`;

  // Fallback background pattern (grid) in case image doesn't load
  svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="#0d1117"/>`;
  svg += `<defs><pattern id="mgrid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/></pattern></defs>`;
  svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#mgrid)"/>`;

  // Real minimap image (rotated)
  svg += `<g transform="rotate(${rot} ${w/2} ${h/2})">`;
  svg += `<image href="${mapData.img}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" onerror="this.style.display='none'"/>`;
  svg += `</g>`;

  // Semi-transparent overlay for better annotation visibility
  svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="rgba(0,0,0,0.2)"/>`;

  // Draw step annotations (scaled for 1024x1024)
  if (step && step.elements) {
    step.elements.forEach(el => {
      switch(el.type) {
        case 'smoke':
          svg += `<circle cx="${el.x}" cy="${el.y}" r="36" fill="rgba(150,150,150,0.45)" stroke="#bbb" stroke-width="2.5" stroke-dasharray="8"/>`;
          if (el.label) svg += `<text x="${el.x}" y="${el.y+5}" fill="#ddd" font-size="18" text-anchor="middle" font-weight="bold" style="text-shadow:0 0 6px #000">${el.label}</text>`;
          break;
        case 'flash':
          svg += `<circle cx="${el.x}" cy="${el.y}" r="20" fill="rgba(255,220,50,0.6)" stroke="#ffdd33" stroke-width="2.5"/>`;
          svg += `<text x="${el.x}" y="${el.y+7}" fill="#fff" font-size="18" text-anchor="middle" font-weight="bold" style="text-shadow:0 0 4px #000">F</text>`;
          break;
        case 'player':
          const color = el.team === 'T' ? '#ff4655' : '#58a6ff';
          svg += `<circle cx="${el.x}" cy="${el.y}" r="20" fill="${color}" stroke="#fff" stroke-width="3" opacity="0.9"/>`;
          if (el.label) svg += `<text x="${el.x}" y="${el.y+45}" fill="${color}" font-size="18" text-anchor="middle" font-weight="bold" style="text-shadow:0 0 6px #000,0 0 3px #000">${el.label}</text>`;
          break;
        case 'arrow':
          const ac = el.color || '#3fb950';
          const aid = `ah-${el.x1}-${el.y1}`;
          svg += `<defs><marker id="${aid}" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="${ac}"/></marker></defs>`;
          svg += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${ac}" stroke-width="4" marker-end="url(#${aid})" opacity="0.85"/>`;
          break;
        case 'sightline':
          svg += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="rgba(255,70,85,0.5)" stroke-width="2.5" stroke-dasharray="10"/>`;
          break;
        case 'plant':
          svg += `<rect x="${el.x-15}" y="${el.y-15}" width="30" height="30" fill="rgba(255,70,85,0.7)" stroke="#ff4655" stroke-width="3" rx="4"/>`;
          svg += `<text x="${el.x}" y="${el.y+7}" fill="#fff" font-size="18" text-anchor="middle" font-weight="bold">X</text>`;
          break;
        case 'text':
          svg += `<text x="${el.x}" y="${el.y}" fill="#ffcc44" font-size="22" text-anchor="middle" font-weight="bold" style="text-shadow:0 0 8px #000,0 0 4px #000">${el.label}</text>`;
          break;
      }
    });
  }

  svg += '</svg>';

  // Map name badge
  let badge = `<div style="text-align:center;padding:6px 0;font-size:0.8rem;color:var(--dim);letter-spacing:1px">${annotations.map.toUpperCase()}</div>`;

  // Step navigation
  let nav = '<div class="map-step-nav">';
  annotations.steps.forEach((s, i) => {
    const active = i === stepIndex ? ' active' : '';
    nav += `<button class="map-step-btn${active}" onclick="renderTacticalMap('${containerId}', ${scenarioId}, ${i})">${i+1}. ${s.label}</button>`;
  });
  nav += '</div>';

  container.innerHTML = badge + nav + '<div class="map-svg-wrap">' + svg + '</div>';
}
