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
// Approximate positions based on actual map layouts
const SCENARIO_ANNOTATIONS = {
  1: { // B Site Take - Bind
    map: 'Bind',
    steps: [
      { label: "Smokes", elements: [
        { type:'smoke', x:620, y:340, label:'Hookah' },
        { type:'smoke', x:720, y:280, label:'Elbow' },
      ]},
      { label: "Flash", elements: [
        { type:'flash', x:650, y:420 },
        { type:'player', x:600, y:520, label:'Flasher', team:'T' },
      ]},
      { label: "Entry", elements: [
        { type:'player', x:660, y:300, label:'Entry', team:'T' },
        { type:'arrow', x1:600, y1:520, x2:660, y2:320 },
      ]},
      { label: "Clear Garden", elements: [
        { type:'player', x:560, y:400, label:'Support', team:'T' },
        { type:'arrow', x1:560, y1:520, x2:560, y2:400 },
      ]},
      { label: "Plant", elements: [
        { type:'plant', x:640, y:280 },
        { type:'player', x:640, y:320, label:'Planter', team:'T' },
      ]},
    ]
  },
  2: { // A Site Hold - Ascent
    map: 'Ascent',
    steps: [
      { label: "Positions", elements: [
        { type:'player', x:300, y:280, label:'Generator', team:'CT' },
        { type:'player', x:380, y:200, label:'Heaven', team:'CT' },
      ]},
      { label: "Crossfire", elements: [
        { type:'sightline', x1:300, y1:280, x2:300, y2:500 },
        { type:'sightline', x1:380, y1:200, x2:300, y2:500 },
      ]},
      { label: "If Push", elements: [
        { type:'arrow', x1:300, y1:500, x2:300, y2:300, color:'#ff4444' },
        { type:'text', x:400, y:550, label:'CALL + ROTATE' },
      ]},
    ]
  },
  3: { // A Site Retake - Haven
    map: 'Haven',
    steps: [
      { label: "Regroup", elements: [
        { type:'player', x:250, y:550, label:'P1', team:'CT' },
        { type:'player', x:300, y:550, label:'P2', team:'CT' },
        { type:'player', x:275, y:600, label:'P3', team:'CT' },
      ]},
      { label: "Utils", elements: [
        { type:'flash', x:250, y:400 },
        { type:'smoke', x:300, y:380 },
      ]},
      { label: "Flash Long A", elements: [
        { type:'flash', x:220, y:380 },
        { type:'arrow', x1:250, y1:550, x2:250, y2:400 },
      ]},
      { label: "Swing Together", elements: [
        { type:'player', x:250, y:280, label:'P1', team:'CT' },
        { type:'player', x:320, y:280, label:'P2', team:'CT' },
        { type:'arrow', x1:250, y1:400, x2:250, y2:280 },
        { type:'arrow', x1:300, y1:400, x2:320, y2:280 },
      ]},
      { label: "Defuse", elements: [
        { type:'plant', x:280, y:260 },
        { type:'player', x:360, y:320, label:'Cover', team:'CT' },
      ]},
    ]
  },
  4: { // Mid Control - Split
    map: 'Split',
    steps: [
      { label: "Smoke Vent + Mail", elements: [
        { type:'smoke', x:500, y:320 },
        { type:'smoke', x:460, y:480 },
      ]},
      { label: "Clear Mid", elements: [
        { type:'flash', x:500, y:400 },
        { type:'arrow', x1:500, y1:620, x2:500, y2:400 },
      ]},
      { label: "Hold Mid", elements: [
        { type:'player', x:500, y:400, label:'Hold', team:'T' },
        { type:'sightline', x1:500, y1:400, x2:500, y2:300 },
      ]},
      { label: "Execute A or B", elements: [
        { type:'arrow', x1:500, y1:400, x2:300, y2:280, color:'#58a6ff' },
        { type:'arrow', x1:500, y1:400, x2:700, y2:280, color:'#58a6ff' },
        { type:'text', x:500, y:560, label:'DECIDE BASED ON INFO' },
      ]},
    ]
  },
  5: { // Full Execute - Lotus
    map: 'Lotus',
    steps: [
      { label: "Drone/Haunt", elements: [
        { type:'flash', x:280, y:250 },
        { type:'arrow', x1:280, y1:550, x2:280, y2:260 },
      ]},
      { label: "Smokes", elements: [
        { type:'smoke', x:320, y:240, label:'Tree' },
        { type:'smoke', x:220, y:220, label:'Rubble' },
      ]},
      { label: "Flash + Stun", elements: [
        { type:'flash', x:260, y:300 },
        { type:'flash', x:340, y:300 },
      ]},
      { label: "Entry", elements: [
        { type:'player', x:240, y:240, label:'Entry 1', team:'T' },
        { type:'player', x:360, y:240, label:'Entry 2', team:'T' },
        { type:'arrow', x1:240, y1:450, x2:240, y2:240 },
        { type:'arrow', x1:360, y1:450, x2:360, y2:240 },
      ]},
      { label: "Plant Default", elements: [
        { type:'plant', x:300, y:250 },
        { type:'player', x:240, y:300, label:'Post 1', team:'T' },
        { type:'player', x:360, y:300, label:'Post 2', team:'T' },
      ]},
    ]
  },
};

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

  // Real minimap image (rotated)
  svg += `<g transform="rotate(${rot} ${w/2} ${h/2})">`;
  svg += `<image href="${mapData.img}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
  svg += `</g>`;

  // Semi-transparent overlay for better annotation visibility
  svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="rgba(0,0,0,0.15)"/>`;

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
