// ============ VALORANT TACTICAL MAPS ============
// Simplified SVG top-down views with callout positions

const MAP_DATA = {
  Bind: {
    width: 400, height: 300,
    svg: `
      <rect x="0" y="0" width="400" height="300" fill="#1a1f2e" rx="8"/>
      <!-- A Site -->
      <rect x="30" y="30" width="120" height="100" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="90" y="85" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">A SITE</text>
      <!-- A Short -->
      <rect x="150" y="50" width="40" height="60" fill="#252b38" stroke="#444"/>
      <text x="170" y="85" fill="#555" font-size="8" text-anchor="middle">Short</text>
      <!-- Mid -->
      <rect x="160" y="120" width="80" height="60" fill="#252b38" stroke="#444"/>
      <text x="200" y="155" fill="#555" font-size="10" text-anchor="middle">MID</text>
      <!-- B Site -->
      <rect x="250" y="30" width="120" height="110" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="310" y="90" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">B SITE</text>
      <!-- Hookah -->
      <rect x="280" y="150" width="50" height="40" fill="#252b38" stroke="#444"/>
      <text x="305" y="175" fill="#555" font-size="8" text-anchor="middle">Hookah</text>
      <!-- B Long -->
      <rect x="340" y="150" width="40" height="80" fill="#252b38" stroke="#444"/>
      <text x="360" y="195" fill="#555" font-size="8" text-anchor="middle">Long B</text>
      <!-- Garden -->
      <rect x="250" y="150" width="30" height="40" fill="#252b38" stroke="#444"/>
      <text x="265" y="175" fill="#555" font-size="7" text-anchor="middle">Garden</text>
      <!-- Attacker Spawn -->
      <rect x="140" y="220" width="120" height="50" fill="#1e2430" stroke="#444" rx="4"/>
      <text x="200" y="250" fill="#555" font-size="10" text-anchor="middle">ATTACKER SPAWN</text>
      <!-- A Lobby -->
      <rect x="30" y="150" width="80" height="50" fill="#252b38" stroke="#444"/>
      <text x="70" y="180" fill="#555" font-size="8" text-anchor="middle">A Lobby</text>
    `
  },
  Haven: {
    width: 400, height: 340,
    svg: `
      <rect x="0" y="0" width="400" height="340" fill="#1a1f2e" rx="8"/>
      <!-- A Site -->
      <rect x="20" y="20" width="100" height="90" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="70" y="70" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">A SITE</text>
      <!-- B Site -->
      <rect x="150" y="20" width="100" height="90" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="200" y="70" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">B SITE</text>
      <!-- C Site -->
      <rect x="280" y="20" width="100" height="90" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="330" y="70" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">C SITE</text>
      <!-- Mid -->
      <rect x="150" y="130" width="100" height="60" fill="#252b38" stroke="#444"/>
      <text x="200" y="165" fill="#555" font-size="10" text-anchor="middle">MID</text>
      <!-- A Long -->
      <rect x="20" y="130" width="60" height="60" fill="#252b38" stroke="#444"/>
      <text x="50" y="165" fill="#555" font-size="8" text-anchor="middle">A Long</text>
      <!-- C Long -->
      <rect x="320" y="130" width="60" height="60" fill="#252b38" stroke="#444"/>
      <text x="350" y="165" fill="#555" font-size="8" text-anchor="middle">C Long</text>
      <!-- Garage/Window -->
      <rect x="150" y="200" width="50" height="40" fill="#252b38" stroke="#444"/>
      <text x="175" y="225" fill="#555" font-size="7" text-anchor="middle">Garage</text>
      <!-- Attacker Spawn -->
      <rect x="120" y="270" width="160" height="50" fill="#1e2430" stroke="#444" rx="4"/>
      <text x="200" y="300" fill="#555" font-size="10" text-anchor="middle">ATTACKER SPAWN</text>
    `
  },
  Ascent: {
    width: 400, height: 320,
    svg: `
      <rect x="0" y="0" width="400" height="320" fill="#1a1f2e" rx="8"/>
      <!-- A Site -->
      <rect x="30" y="30" width="120" height="100" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="90" y="85" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">A SITE</text>
      <!-- A Main -->
      <rect x="30" y="140" width="60" height="50" fill="#252b38" stroke="#444"/>
      <text x="60" y="170" fill="#555" font-size="8" text-anchor="middle">A Main</text>
      <!-- Heaven -->
      <rect x="100" y="30" width="50" height="30" fill="#303848" stroke="#444"/>
      <text x="125" y="50" fill="#555" font-size="7" text-anchor="middle">Heaven</text>
      <!-- Mid -->
      <rect x="160" y="100" width="80" height="80" fill="#252b38" stroke="#444"/>
      <text x="200" y="145" fill="#555" font-size="10" text-anchor="middle">MID</text>
      <!-- B Site -->
      <rect x="260" y="30" width="120" height="100" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="320" y="85" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">B SITE</text>
      <!-- B Main -->
      <rect x="310" y="140" width="60" height="50" fill="#252b38" stroke="#444"/>
      <text x="340" y="170" fill="#555" font-size="8" text-anchor="middle">B Main</text>
      <!-- Attacker Spawn -->
      <rect x="130" y="250" width="140" height="50" fill="#1e2430" stroke="#444" rx="4"/>
      <text x="200" y="280" fill="#555" font-size="10" text-anchor="middle">ATTACKER SPAWN</text>
    `
  },
  Split: {
    width: 400, height: 320,
    svg: `
      <rect x="0" y="0" width="400" height="320" fill="#1a1f2e" rx="8"/>
      <!-- A Site -->
      <rect x="30" y="30" width="110" height="90" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="85" y="80" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">A SITE</text>
      <!-- A Ramp -->
      <rect x="30" y="130" width="50" height="50" fill="#252b38" stroke="#444"/>
      <text x="55" y="160" fill="#555" font-size="7" text-anchor="middle">Ramp</text>
      <!-- Mid -->
      <rect x="150" y="90" width="100" height="70" fill="#252b38" stroke="#444"/>
      <text x="200" y="130" fill="#555" font-size="10" text-anchor="middle">MID</text>
      <!-- Vent -->
      <rect x="180" y="70" width="40" height="20" fill="#303848" stroke="#444"/>
      <text x="200" y="84" fill="#555" font-size="7" text-anchor="middle">Vent</text>
      <!-- Mail -->
      <rect x="160" y="170" width="40" height="30" fill="#252b38" stroke="#444"/>
      <text x="180" y="190" fill="#555" font-size="7" text-anchor="middle">Mail</text>
      <!-- B Site -->
      <rect x="270" y="30" width="110" height="90" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="325" y="80" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">B SITE</text>
      <!-- B Main -->
      <rect x="300" y="130" width="60" height="50" fill="#252b38" stroke="#444"/>
      <text x="330" y="160" fill="#555" font-size="8" text-anchor="middle">B Main</text>
      <!-- Attacker Spawn -->
      <rect x="130" y="250" width="140" height="50" fill="#1e2430" stroke="#444" rx="4"/>
      <text x="200" y="280" fill="#555" font-size="10" text-anchor="middle">ATTACKER SPAWN</text>
    `
  },
  Lotus: {
    width: 400, height: 340,
    svg: `
      <rect x="0" y="0" width="400" height="340" fill="#1a1f2e" rx="8"/>
      <!-- A Site -->
      <rect x="20" y="20" width="100" height="90" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="70" y="70" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">A SITE</text>
      <!-- A Main -->
      <rect x="20" y="120" width="50" height="40" fill="#252b38" stroke="#444"/>
      <text x="45" y="145" fill="#555" font-size="7" text-anchor="middle">A Main</text>
      <!-- A Root -->
      <rect x="80" y="120" width="40" height="40" fill="#252b38" stroke="#444"/>
      <text x="100" y="145" fill="#555" font-size="7" text-anchor="middle">Root</text>
      <!-- B Site -->
      <rect x="150" y="20" width="100" height="90" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="200" y="70" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">B SITE</text>
      <!-- B Main -->
      <rect x="170" y="120" width="60" height="40" fill="#252b38" stroke="#444"/>
      <text x="200" y="145" fill="#555" font-size="8" text-anchor="middle">B Main</text>
      <!-- C Site -->
      <rect x="280" y="20" width="100" height="90" fill="#2a3040" stroke="#444" rx="4"/>
      <text x="330" y="70" fill="#666" font-size="12" text-anchor="middle" font-weight="bold">C SITE</text>
      <!-- C Main -->
      <rect x="300" y="120" width="60" height="40" fill="#252b38" stroke="#444"/>
      <text x="330" y="145" fill="#555" font-size="8" text-anchor="middle">C Main</text>
      <!-- Rotate doors -->
      <rect x="130" y="170" width="140" height="30" fill="#303848" stroke="#555" stroke-dasharray="4"/>
      <text x="200" y="190" fill="#666" font-size="7" text-anchor="middle">ROTATE DOORS</text>
      <!-- Attacker Spawn -->
      <rect x="120" y="270" width="160" height="50" fill="#1e2430" stroke="#444" rx="4"/>
      <text x="200" y="300" fill="#555" font-size="10" text-anchor="middle">ATTACKER SPAWN</text>
    `
  }
};

// Scenario annotations - positions, smokes, flashes, movements per step
const SCENARIO_ANNOTATIONS = {
  1: { // B Site Take - Bind
    map: 'Bind',
    steps: [
      { label: "Smokes", elements: [
        { type:'smoke', x:305, y:155, label:'Hookah' },
        { type:'smoke', x:360, y:170, label:'Long B' },
      ]},
      { label: "Flash", elements: [
        { type:'flash', x:310, y:130 },
        { type:'player', x:280, y:200, label:'Flasher', team:'T' },
      ]},
      { label: "Entry", elements: [
        { type:'player', x:290, y:80, label:'Entry', team:'T' },
        { type:'arrow', x1:280, y1:200, x2:290, y2:100 },
      ]},
      { label: "Clear Garden", elements: [
        { type:'player', x:260, y:160, label:'Support', team:'T' },
        { type:'arrow', x1:260, y1:200, x2:260, y2:160 },
      ]},
      { label: "Plant", elements: [
        { type:'plant', x:310, y:70 },
        { type:'player', x:310, y:90, label:'Planter', team:'T' },
      ]},
    ]
  },
  2: { // A Site Hold - Ascent
    map: 'Ascent',
    steps: [
      { label: "Positions", elements: [
        { type:'player', x:60, y:60, label:'Generator', team:'CT' },
        { type:'player', x:125, y:45, label:'Heaven', team:'CT' },
      ]},
      { label: "Crossfire", elements: [
        { type:'sightline', x1:60, y1:60, x2:60, y2:160 },
        { type:'sightline', x1:125, y1:45, x2:60, y2:160 },
      ]},
      { label: "If Push", elements: [
        { type:'arrow', x1:60, y1:160, x2:60, y2:80, color:'#ff4444' },
        { type:'text', x:100, y:200, label:'CALL + ROTATE' },
      ]},
    ]
  },
  3: { // A Site Retake - Haven
    map: 'Haven',
    steps: [
      { label: "Regroup", elements: [
        { type:'player', x:50, y:200, label:'P1', team:'CT' },
        { type:'player', x:80, y:200, label:'P2', team:'CT' },
        { type:'player', x:65, y:220, label:'P3', team:'CT' },
      ]},
      { label: "Utils", elements: [
        { type:'flash', x:50, y:130 },
        { type:'smoke', x:70, y:110 },
      ]},
      { label: "Flash Long A", elements: [
        { type:'flash', x:40, y:110 },
        { type:'arrow', x1:50, y1:200, x2:50, y2:130 },
      ]},
      { label: "Swing Together", elements: [
        { type:'player', x:50, y:60, label:'P1', team:'CT' },
        { type:'player', x:80, y:60, label:'P2', team:'CT' },
        { type:'arrow', x1:50, y1:130, x2:50, y2:60 },
        { type:'arrow', x1:80, y1:130, x2:80, y2:60 },
      ]},
      { label: "Defuse", elements: [
        { type:'plant', x:70, y:50 },
        { type:'player', x:100, y:80, label:'Cover', team:'CT' },
      ]},
    ]
  },
  4: { // Mid Control - Split
    map: 'Split',
    steps: [
      { label: "Smoke Vent + Mail", elements: [
        { type:'smoke', x:200, y:80 },
        { type:'smoke', x:180, y:185 },
      ]},
      { label: "Clear Mid", elements: [
        { type:'flash', x:200, y:120 },
        { type:'arrow', x1:200, y1:240, x2:200, y2:130 },
      ]},
      { label: "Hold Mid", elements: [
        { type:'player', x:200, y:130, label:'Hold', team:'T' },
        { type:'sightline', x1:200, y1:130, x2:200, y2:80 },
      ]},
      { label: "Execute A or B", elements: [
        { type:'arrow', x1:200, y1:130, x2:85, y2:80, color:'#58a6ff' },
        { type:'arrow', x1:200, y1:130, x2:325, y2:80, color:'#58a6ff' },
        { type:'text', x:200, y:210, label:'DECIDE BASED ON INFO' },
      ]},
    ]
  },
  5: { // Full Execute - Lotus
    map: 'Lotus',
    steps: [
      { label: "Drone/Haunt", elements: [
        { type:'flash', x:70, y:50 },
        { type:'arrow', x1:70, y1:200, x2:70, y2:60 },
      ]},
      { label: "Smokes", elements: [
        { type:'smoke', x:80, y:55, label:'Tree' },
        { type:'smoke', x:40, y:40, label:'Rubble' },
      ]},
      { label: "Flash + Stun", elements: [
        { type:'flash', x:60, y:80 },
        { type:'flash', x:90, y:80 },
      ]},
      { label: "Entry", elements: [
        { type:'player', x:45, y:50, label:'Entry 1', team:'T' },
        { type:'player', x:100, y:50, label:'Entry 2', team:'T' },
        { type:'arrow', x1:45, y1:145, x2:45, y2:50 },
        { type:'arrow', x1:100, y1:145, x2:100, y2:50 },
      ]},
      { label: "Plant Default", elements: [
        { type:'plant', x:70, y:55 },
        { type:'player', x:45, y:80, label:'Post 1', team:'T' },
        { type:'player', x:100, y:80, label:'Post 2', team:'T' },
      ]},
    ]
  },
};

// Render map with annotations for a given step
function renderTacticalMap(containerId, scenarioId, stepIndex) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const annotations = SCENARIO_ANNOTATIONS[scenarioId];
  if (!annotations) {
    container.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">Map non disponible pour ce scenario</p>';
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

  let svg = `<svg width="100%" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="border-radius:8px;max-height:300px">`;

  // Base map
  svg += mapData.svg;

  // Draw step annotations
  if (step && step.elements) {
    step.elements.forEach(el => {
      switch(el.type) {
        case 'smoke':
          svg += `<circle cx="${el.x}" cy="${el.y}" r="14" fill="rgba(150,150,150,0.4)" stroke="#999" stroke-width="1" stroke-dasharray="3"/>`;
          if (el.label) svg += `<text x="${el.x}" y="${el.y+4}" fill="#aaa" font-size="7" text-anchor="middle">${el.label}</text>`;
          break;
        case 'flash':
          svg += `<circle cx="${el.x}" cy="${el.y}" r="8" fill="rgba(255,220,50,0.5)" stroke="#ffdd33" stroke-width="1"/>`;
          svg += `<text x="${el.x}" y="${el.y+3}" fill="#fff" font-size="7" text-anchor="middle">F</text>`;
          break;
        case 'player':
          const color = el.team === 'T' ? '#ff4655' : '#58a6ff';
          svg += `<circle cx="${el.x}" cy="${el.y}" r="8" fill="${color}" stroke="#fff" stroke-width="1.5" opacity="0.9"/>`;
          if (el.label) svg += `<text x="${el.x}" y="${el.y+20}" fill="${color}" font-size="7" text-anchor="middle" font-weight="bold">${el.label}</text>`;
          break;
        case 'arrow':
          const ac = el.color || '#3fb950';
          svg += `<defs><marker id="arrowhead-${el.x1}" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="${ac}"/></marker></defs>`;
          svg += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${ac}" stroke-width="2" marker-end="url(#arrowhead-${el.x1})" opacity="0.8"/>`;
          break;
        case 'sightline':
          svg += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="rgba(255,70,85,0.4)" stroke-width="1" stroke-dasharray="4"/>`;
          break;
        case 'plant':
          svg += `<rect x="${el.x-6}" y="${el.y-6}" width="12" height="12" fill="rgba(255,70,85,0.6)" stroke="#ff4655" stroke-width="1.5" rx="2"/>`;
          svg += `<text x="${el.x}" y="${el.y+3}" fill="#fff" font-size="7" text-anchor="middle">X</text>`;
          break;
        case 'text':
          svg += `<text x="${el.x}" y="${el.y}" fill="var(--accent)" font-size="9" text-anchor="middle" font-weight="bold">${el.label}</text>`;
          break;
      }
    });
  }

  svg += '</svg>';

  // Step navigation
  let nav = '<div class="map-step-nav">';
  annotations.steps.forEach((s, i) => {
    const active = i === stepIndex ? ' active' : '';
    nav += `<button class="map-step-btn${active}" onclick="renderTacticalMap('${containerId}', ${scenarioId}, ${i})">${i+1}. ${s.label}</button>`;
  });
  nav += '</div>';

  container.innerHTML = nav + '<div class="map-svg-wrap">' + svg + '</div>';
}
