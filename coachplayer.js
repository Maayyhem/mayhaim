// ============================================================
// coachplayer.js — Coach ↔ Joueur
// Dépend de : coachingToken, coachingUser, coachingUserRole, API_BASE
// ============================================================

// XSS sanitization
function san(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// ── Helpers API ──────────────────────────────────────────────
async function cpFetch(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + coachingToken
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(API_BASE + path, opts);
    return await r.json();
  } catch (e) {
    return { error: 'Erreur réseau' };
  }
}

function cpEl(id) { return document.getElementById(id); }

function cpMsg(id, txt, ok) {
  const el = cpEl(id);
  if (!el) return;
  el.textContent = txt;
  el.style.color = ok ? 'var(--accent)' : '#ff4655';
  el.style.display = txt ? 'block' : 'none';
}

// Rank → color map
const CP_RANK_COLORS = {
  'Wool':'#aaa','Linen':'#c8b89a','Silk':'#e0c97f',
  'Cashmere':'#7ec8e3','Velvet':'#a78bfa','Diamond':'#67e8f9',
  'Marble':'#f0abfc','Crystal':'#e879f9','Unranked':'#666'
};

function cpRankBadge(rank) {
  const col = CP_RANK_COLORS[rank] || '#aaa';
  return `<span style="background:${col}22;color:${col};border:1px solid ${col}55;
    padding:2px 10px;border-radius:20px;font-size:0.78rem;font-weight:700">${rank||'Unranked'}</span>`;
}

function cpRelativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'Il y a quelques secondes';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d}j`;
  if (d < 30) return `Il y a ${Math.floor(d/7)} sem.`;
  return `Il y a ${Math.floor(d/30)} mois`;
}

// ── Init — appelé quand le coaching screen s'ouvre ───────────
function cpInit() {
  if (!coachingUser) return;
  const isAdmin   = coachingUserRole === 'admin';
  const isCoach   = coachingUserRole === 'coach' || isAdmin;
  const isStudent = coachingUserRole === 'student';

  // Afficher/masquer les onglets selon le rôle (admin voit aussi les onglets student)
  document.querySelectorAll('.cp-student-tab').forEach(el => {
    el.style.display = (isStudent || isAdmin) ? '' : 'none';
  });

  // Section admin
  const adminSection = cpEl('cp-admin-section');
  if (adminSection) adminSection.style.display = isAdmin ? 'block' : 'none';

  // Pré-charger le bon contenu selon le rôle
  if (isCoach)   cpLoadPlayers();
  if (isAdmin)   cpLoadAdminRelationships();
  if (isStudent) { cpLoadMyCoach(); cpCheckPendingBadge(); cpCheckNotifications(); }
}

// Badge de notification sur l'onglet "Mon Coach"
async function cpCheckPendingBadge() {
  const data = await cpFetch('GET', '/coaching?view=pending');
  const count = (data.pending || []).length;
  const tab = document.querySelector('.ch-tab-btn[data-tab="cp-mon-coach"]');
  if (!tab) return;
  const existing = tab.querySelector('.cp-badge');
  if (existing) existing.remove();
  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'cp-badge';
    badge.textContent = count;
    tab.appendChild(badge);
  }
}

// Vue admin — toutes les relations
async function cpLoadAdminRelationships() {
  const data = await cpFetch('GET', '/coaching?view=all-relationships');
  const el = cpEl('cp-all-relationships');
  if (!el) return;
  const rels = data.relationships || [];
  if (rels.length === 0) {
    el.innerHTML = '<p class="ch-empty">Aucune relation de coaching pour l\'instant.</p>';
    return;
  }
  const statusColor = { pending:'#e8c56d', active:'#4ade80', declined:'#f87171', ended:'#888' };
  const statusLabel = { pending:'En attente', active:'Actif', declined:'Refusé', ended:'Terminé' };
  el.innerHTML = `
    <table class="cp-stats-table">
      <thead><tr>
        <th>Coach</th><th>Joueur</th><th>Statut</th><th>Date</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${rels.map(r => `
          <tr>
            <td style="color:var(--accent);font-weight:600">${r.coach_username}
              <span style="font-size:0.7rem;color:var(--dim);margin-left:4px">(${r.coach_role})</span></td>
            <td>${r.player_username}</td>
            <td><span style="color:${statusColor[r.status]||'#aaa'};font-weight:600">
              ${statusLabel[r.status]||r.status}</span></td>
            <td style="color:var(--dim);font-size:0.78rem">
              ${new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
            <td>
              ${r.status === 'pending' ? `
                <button onclick="cpAdminAccept(${r.rel_id})"
                  style="font-size:0.7rem;padding:3px 10px;background:rgba(74,222,128,0.15);
                    border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:5px;cursor:pointer">
                  Accepter</button>` : ''}
              ${r.status === 'active' ? `
                <button onclick="cpAdminEnd(${r.rel_id})"
                  style="font-size:0.7rem;padding:3px 10px;background:rgba(255,70,85,0.12);
                    border:1px solid rgba(255,70,85,0.3);color:#ff4655;border-radius:5px;cursor:pointer">
                  Terminer</button>` : ''}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function cpAdminAccept(relId) {
  await cpFetch('POST', '/coaching', { action: 'accept', rel_id: relId });
  cpLoadAdminRelationships();
  cpLoadPlayers();
}

async function cpAdminEnd(relId) {
  if (!confirm('Terminer cette relation ?')) return;
  await cpFetch('POST', '/coaching', { action: 'end', rel_id: relId });
  cpLoadAdminRelationships();
  cpLoadPlayers();
}

// ── Hook sur les tabs cp-* ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Délégation sur les onglets Coach/Player
  document.querySelectorAll('.ch-tabs').forEach(tabs => {
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('.ch-tab-btn');
      if (!btn) return;
      const tabId = btn.dataset.tab;
      if (!tabId || !tabId.startsWith('cp-')) return;
      // Charger les données à la demande
      if (tabId === 'ch-students')    cpLoadPlayers();
      if (tabId === 'cp-mon-coach')   cpLoadMyCoach();
      if (tabId === 'cp-mon-plan')    cpLoadPlan();
      if (tabId === 'cp-feedbacks')   cpLoadFeedbacks();
    });
  });

  // Boutons statiques
  const invitePlayerBtn = cpEl('cp-invite-player-btn');
  if (invitePlayerBtn) invitePlayerBtn.addEventListener('click', cpInvitePlayer);

  const inviteCoachBtn = cpEl('cp-invite-coach-btn');
  if (inviteCoachBtn) inviteCoachBtn.addEventListener('click', cpInviteCoach);

  const endBtn = cpEl('cp-end-coaching-btn');
  if (endBtn) endBtn.addEventListener('click', cpEndCoaching);

  // Modal player tabs (délégation)
  document.addEventListener('click', e => {
    const tab = e.target.closest('.cp-modal-tab');
    if (tab && tab.dataset.ptab) {
      document.querySelectorAll('.cp-modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.cp-modal-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = cpEl(tab.dataset.ptab);
      if (panel) panel.classList.add('active');
      if (tab.dataset.ptab === 'cp-pt-messages') cpLoadMessages();
      if (tab.dataset.ptab === 'cp-pt-progress') cpLoadProgression();
      if (tab.dataset.ptab === 'cp-pt-vods' && cpCurrentPlayer) cpLoadPlayerVods(cpCurrentPlayer.id);
    }

    // Fermer modal player
    if (e.target.id === 'cp-player-modal-close' || e.target.id === 'cp-player-modal') {
      cpEl('cp-player-modal').classList.remove('active');
    }
  });
});

// ════════════════════════════════════════════════════════════
// COACH — gestion des joueurs
// ════════════════════════════════════════════════════════════

async function cpLoadPlayers() {
  // Demandes en attente
  const pendingData = await cpFetch('GET', '/coaching?view=pending');
  renderCoachPending(pendingData.pending || []);

  // Joueurs actifs
  const playersData = await cpFetch('GET', '/coaching?view=my-players');
  renderPlayersList(playersData.players || []);
}

function renderCoachPending(pending) {
  const el = cpEl('cp-coach-pending');
  if (!el) return;
  if (pending.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `<h3 class="cp-sub-title">Demandes en attente (${pending.length})</h3>
    ${pending.map(r => `
      <div class="cp-pending-card">
        <span class="cp-pending-name">${icon('user',16)} ${r.player_username}</span>
        ${r.message ? `<span class="cp-pending-msg">"${r.message}"</span>` : ''}
        <div class="cp-pending-actions">
          <button class="btn-primary" style="font-size:0.75rem;padding:5px 14px"
            onclick="cpAccept(${r.rel_id})">&#10003; Accepter</button>
          <button class="btn-secondary" style="font-size:0.75rem;padding:5px 14px;opacity:0.7"
            onclick="cpDecline(${r.rel_id})">&#10005; Refuser</button>
        </div>
      </div>`).join('')}`;
}

function renderPlayersList(players) {
  const el = cpEl('cp-players-list');
  if (!el) return;
  if (players.length === 0) {
    el.innerHTML = '<p class="ch-empty" style="margin-top:24px">Aucun joueur suivi pour l\'instant.<br>Invite un joueur par son pseudo ci-dessus.</p>';
    return;
  }
  // Compute aggregate stats
  const totalGames   = players.reduce((s, p) => s + (p.total_games || 0), 0);
  const weekGames    = players.reduce((s, p) => s + (p.games_this_week || 0), 0);
  const activePlayers = players.filter(p => p.games_this_week > 0).length;
  const avgAcc = players.filter(p => p.total_games > 0).length
    ? Math.round(players.filter(p => p.total_games > 0).reduce((s, p) => s + Number(p.avg_accuracy || 0), 0) / players.filter(p => p.total_games > 0).length)
    : null;

  el.innerHTML = `
    <div class="cp-coach-summary">
      <div class="cp-coach-stat"><span class="cp-coach-stat-val">${players.length}</span><span class="cp-coach-stat-lbl">Joueurs</span></div>
      <div class="cp-coach-stat"><span class="cp-coach-stat-val">${activePlayers}</span><span class="cp-coach-stat-lbl">Actifs 7j</span></div>
      <div class="cp-coach-stat"><span class="cp-coach-stat-val">${weekGames}</span><span class="cp-coach-stat-lbl">Parties / sem.</span></div>
      <div class="cp-coach-stat"><span class="cp-coach-stat-val">${totalGames.toLocaleString()}</span><span class="cp-coach-stat-lbl">Total parties</span></div>
      ${avgAcc !== null ? `<div class="cp-coach-stat"><span class="cp-coach-stat-val">${avgAcc}%</span><span class="cp-coach-stat-lbl">Préc. moy.</span></div>` : ''}
    </div>
    <h3 class="cp-sub-title" style="margin-top:16px">Mes joueurs actifs (${players.length})</h3>
    <div class="cp-players-grid">
      ${players.map(p => {
        const lastSeen = p.last_played ? cpRelativeTime(p.last_played) : 'Jamais joué';
        const weekBadge = p.games_this_week > 0
          ? `<span class="cp-week-badge">${p.games_this_week} cette semaine</span>`
          : '';
        return `
        <div class="cp-player-card" onclick="cpOpenPlayer(${p.id}, '${san(p.username)}', ${p.rel_id}, '${san(p.current_rank || '')}')">
          <div class="cp-player-avatar">${p.username[0].toUpperCase()}</div>
          <div class="cp-player-info">
            <div class="cp-player-name">${san(p.username)} ${cpRankBadge(p.current_rank)}</div>
            <div class="cp-player-meta">
              ${p.total_games > 0
                ? `${p.total_games} parties · Record ${(p.best_score||0).toLocaleString()} · ${Math.round(p.avg_accuracy)}% préc.`
                : (p.objective ? san(p.objective) : 'Aucune partie jouée')}
            </div>
            <div class="cp-player-last">${lastSeen} ${weekBadge}</div>
          </div>
          <span style="color:var(--accent);font-size:1.2rem">&#8250;</span>
        </div>`;
      }).join('')}
    </div>`;
}

async function cpInvitePlayer() {
  const input = cpEl('cp-invite-player-input');
  const username = input?.value?.trim();
  if (!username) return;
  cpMsg('cp-invite-player-msg', '');
  const data = await cpFetch('POST', '/coaching', { action: 'request', target_username: username });
  if (data.error) {
    cpMsg('cp-invite-player-msg', data.error, false);
  } else {
    cpMsg('cp-invite-player-msg', `Demande envoyée à ${username} !`, true);
    if (input) input.value = '';
    setTimeout(cpLoadPlayers, 800);
  }
}

async function cpAccept(relId) {
  const data = await cpFetch('POST', '/coaching', { action: 'accept', rel_id: relId });
  if (!data.error) cpLoadPlayers();
}

async function cpDecline(relId) {
  const data = await cpFetch('POST', '/coaching', { action: 'decline', rel_id: relId });
  if (!data.error) cpLoadPlayers();
}

// ── Ouvrir le modal d'un joueur ─────────────────────────────
let cpCurrentPlayer = null;

async function cpOpenPlayer(playerId, username, relId, rank) {
  cpCurrentPlayer = { id: playerId, username, relId, rank };
  const modal = cpEl('cp-player-modal');
  if (!modal) return;

  // Reset tabs
  document.querySelectorAll('.cp-modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.cp-modal-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.cp-modal-tab[data-ptab="cp-pt-stats"]')?.classList.add('active');
  cpEl('cp-pt-stats')?.classList.add('active');

  // Header
  cpEl('cp-player-modal-header').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div class="cp-player-avatar" style="width:48px;height:48px;font-size:1.4rem">
        ${username[0].toUpperCase()}</div>
      <div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--txt)">${san(username)} ${cpRankBadge(rank)}</div>
        <div style="font-size:0.8rem;color:var(--dim)" id="cp-modal-energy-summary">Chargement...</div>
      </div>
      <button onclick="cpEndRelationship(${relId})"
        style="margin-left:auto;font-size:0.72rem;padding:4px 10px;opacity:0.5;background:rgba(255,70,85,0.15);
          border:1px solid rgba(255,70,85,0.3);color:#ff4655;border-radius:6px;cursor:pointer">
        Retirer du roster
      </button>
    </div>`;

  // Charger stats
  cpEl('cp-pt-stats').innerHTML = '<p class="ch-empty">Chargement...</p>';
  _cpPlanRowId = 0;
  cpEl('cp-pt-plan').innerHTML  = cpRenderPlanForm(playerId);
  cpAddPlanRow(); // default empty row
  cpEl('cp-pt-feedback').innerHTML = cpRenderFeedbackForm(playerId);

  modal.classList.add('active');

  cpLoadPlayerStats(playerId);
}

async function cpLoadPlayerStats(playerId) {
  const el = cpEl('cp-pt-stats');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty">Chargement…</p>';

  // Fetch enriched stats AND benchmark bests in parallel
  const [statsRes, benchRes] = await Promise.all([
    cpFetch('GET', `/coaching?view=player-stats&player_id=${playerId}`),
    cpFetch('GET', `/coaching?view=player-history&player_id=${playerId}`)
  ]);

  const s = statsRes.stats || {};
  const activity = statsRes.activity_30 || [];
  const recent   = statsRes.recent_games || [];
  const wk       = statsRes.week_cmp || {};
  const history  = benchRes.history || [];

  // Week comparison deltas
  const wkGames = wk.this_week || 0;
  const wkGamesLast = wk.last_week || 0;
  const wkDelta  = wkGames - wkGamesLast;
  const wkBest   = wk.best_this_week || 0;
  const wkBestLast = wk.best_last_week || 0;
  const wkBestDelta = wkBest - wkBestLast;

  function delta(d, unit='') {
    if (d === 0) return `<span style="color:var(--dim)">±0${unit}</span>`;
    return d > 0
      ? `<span style="color:#4ade80">↑+${d}${unit}</span>`
      : `<span style="color:#f87171">↓${d}${unit}</span>`;
  }

  el.innerHTML = `
    <!-- Summary stats -->
    <div class="cp-modal-stats-row">
      <div class="cp-ms"><span class="cp-ms-val">${s.total_games||0}</span><span class="cp-ms-lbl">Parties</span></div>
      <div class="cp-ms"><span class="cp-ms-val">${s.best_score?Number(s.best_score).toLocaleString():'—'}</span><span class="cp-ms-lbl">Record</span></div>
      <div class="cp-ms"><span class="cp-ms-val">${s.avg_accuracy!=null?s.avg_accuracy+'%':'—'}</span><span class="cp-ms-lbl">Préc. moy.</span></div>
      <div class="cp-ms"><span class="cp-ms-val">${wkGames}</span><span class="cp-ms-lbl">Cette sem. ${delta(wkDelta)}</span></div>
      <div class="cp-ms"><span class="cp-ms-val">${wkBest?Number(wkBest).toLocaleString():'—'}</span><span class="cp-ms-lbl">Record sem. ${wkBestDelta?delta(wkBestDelta,''):'—'}</span></div>
    </div>

    <!-- Activity chart -->
    <div class="cp-modal-section-title">${icon('trending-up',16)} Activité 30j</div>
    <div class="cp-modal-chart-wrap"><canvas id="cp-modal-activity-chart"></canvas></div>

    <!-- Recent games -->
    <div class="cp-modal-section-title" style="margin-top:14px">${icon('gamepad',16)} Parties récentes</div>
    <div class="cp-modal-recent">
      ${recent.length === 0
        ? '<p class="ch-empty" style="font-size:0.82rem;padding:8px 0">Aucune partie.</p>'
        : recent.map(g => {
            const sc = typeof SCENARIOS!=='undefined'?SCENARIOS:{}
            const label = sc[g.mode]?.label || g.mode.replace(/_/g,' ');
            const date  = new Date(g.played_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
            const accCol = g.accuracy>=80?'#4ade80':g.accuracy>=60?'#facc15':'#f87171';
            return `<div class="cp-modal-recent-row">
              <span class="cp-modal-recent-mode">${san(label)}</span>
              <span class="cp-modal-recent-score">${Number(g.score).toLocaleString()}</span>
              <span style="color:${accCol};font-size:0.78rem">${g.accuracy}%</span>
              <span class="cp-modal-recent-date">${date}</span>
            </div>`;
          }).join('')
      }
    </div>

    <!-- Benchmark bests table (existing) -->
    <div class="cp-modal-section-title" style="margin-top:14px">${icon('chart',16)} Bests Benchmark</div>
    <div id="cp-pt-bm"></div>`;

  // Draw activity chart
  _cpModalRenderActivityChart(activity);

  // Render benchmark bests table
  const bests = history
    .filter(h => typeof SCENARIOS!=='undefined' && SCENARIOS[h.mode]?.th)
    .reduce((acc, h) => {
      const key = h.mode;
      if (!acc[key] || h.score > acc[key].score) acc[key] = h;
      return acc;
    }, {});

  const bmEl = cpEl('cp-pt-bm');
  if (bmEl) {
    const rows2 = Object.values(bests);
    if (rows2.length === 0) {
      bmEl.innerHTML = '<p class="ch-empty" style="font-size:0.82rem">Aucun score benchmark.</p>';
    } else {
      cpEl('cp-modal-energy-summary').textContent = `${rows2.length} scénarios joués`;
      bmEl.innerHTML = `<table class="cp-stats-table">
        <thead><tr><th>Scénario</th><th>Score</th><th>Acc.</th></tr></thead>
        <tbody>${rows2.map(r => `<tr>
          <td style="color:var(--txt)">${san((typeof SCENARIOS!=='undefined'?SCENARIOS:{})[r.mode]?.label||r.mode)}</td>
          <td style="text-align:right">${Number(r.score).toLocaleString()}</td>
          <td style="text-align:right">${r.accuracy||0}%</td>
        </tr>`).join('')}</tbody>
      </table>`;
    }
  }
}

let _cpModalChart = null;
function _cpModalRenderActivityChart(activity30) {
  const canvas = document.getElementById('cp-modal-activity-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0,10));
  }
  const map = {};
  activity30.forEach(r => { map[r.day] = r.games; });
  const values = days.map(d => map[d]||0);
  const labels = days.map(d => {
    const dt = new Date(d+'T00:00:00');
    return dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
  });
  if (_cpModalChart) { _cpModalChart.destroy(); _cpModalChart = null; }
  _cpModalChart = new Chart(canvas, {
    type:'bar',
    data:{ labels, datasets:[{
      data: values,
      backgroundColor: values.map(v => v>0?'rgba(255,70,85,0.65)':'rgba(255,255,255,0.04)'),
      borderRadius:2
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ctx.parsed.y+' partie'+(ctx.parsed.y!==1?'s':'') }}},
      scales:{
        x:{ grid:{display:false}, ticks:{ color:'#555', font:{size:8}, maxRotation:0, callback:function(v,i){ return i%7===0?this.getLabelForValue(v):''; }}},
        y:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#555',stepSize:1}, beginAtZero:true }
      }
    }
  });
}

function cpBuildScenarioOptions(selected) {
  const opts = ['<option value="">-- Scénario --</option>'];
  if (typeof SCENARIOS !== 'undefined') {
    const cats = {};
    Object.entries(SCENARIOS).forEach(([k, v]) => {
      const c = v.cat || 'other';
      if (!cats[c]) cats[c] = [];
      cats[c].push({ k, label: v.label || k });
    });
    Object.entries(cats).forEach(([cat, list]) => {
      const catLabel = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      opts.push(`<optgroup label="${catLabel}">`);
      list.forEach(({ k, label }) => {
        opts.push(`<option value="${k}"${k === selected ? ' selected' : ''}>${label}</option>`);
      });
      opts.push('</optgroup>');
    });
  }
  return opts.join('');
}

function cpRenderPlanForm(playerId) {
  return `
    <h3 class="cp-sub-title">Assigner un plan</h3>
    <input id="cp-plan-title" class="cp-input" placeholder="Titre (ex: Semaine reactive tracking)" style="margin-bottom:8px">
    <textarea id="cp-plan-desc" class="cp-textarea" rows="2" placeholder="Description / objectif général..."></textarea>
    <div class="cp-plan-rows-header">
      <span style="font-size:0.78rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:1px">Exercices</span>
      <button class="wu-btn" style="font-size:0.75rem;padding:4px 12px" onclick="cpAddPlanRow()">+ Ajouter</button>
    </div>
    <div id="cp-plan-rows" class="cp-plan-rows"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0">
      <input id="cp-plan-target-scenario" class="cp-input" placeholder="Scénario objectif (opt.)">
      <input id="cp-plan-target-energy" class="cp-input" type="number" min="0" max="100" placeholder="Energy cible (ex: 75)">
    </div>
    <div id="cp-plan-msg" class="cp-msg"></div>
    <button class="btn-primary" style="width:100%" onclick="cpSubmitPlan(${playerId})">Assigner ce plan</button>`;
}

let _cpPlanRowId = 0;
function cpAddPlanRow(scenario = '', reps = 3, note = '') {
  const wrap = cpEl('cp-plan-rows');
  if (!wrap) return;
  const id = ++_cpPlanRowId;
  const row = document.createElement('div');
  row.className = 'cp-plan-row';
  row.id = `cp-plan-row-${id}`;
  row.innerHTML = `
    <select class="cp-plan-row-scenario cp-select">${cpBuildScenarioOptions(scenario)}</select>
    <input type="number" class="cp-plan-row-reps cp-input" value="${reps}" min="1" max="20" style="width:58px;flex-shrink:0" title="Répétitions">
    <input type="text" class="cp-plan-row-note cp-input" value="${note}" placeholder="Note optionnelle" style="flex:1;min-width:0">
    <button class="cp-plan-row-del" onclick="document.getElementById('cp-plan-row-${id}').remove()" title="Supprimer">✕</button>`;
  wrap.appendChild(row);
}

async function cpSubmitPlan(playerId) {
  const title   = cpEl('cp-plan-title')?.value?.trim();
  const desc    = cpEl('cp-plan-desc')?.value?.trim();
  const tgtScen = cpEl('cp-plan-target-scenario')?.value?.trim();
  const tgtEn   = parseFloat(cpEl('cp-plan-target-energy')?.value) || null;

  if (!title) { cpMsg('cp-plan-msg', 'Le titre est requis', false); return; }

  const rows = [...(cpEl('cp-plan-rows')?.querySelectorAll('.cp-plan-row') || [])];
  const scenarios = rows.map(row => ({
    scenario: row.querySelector('.cp-plan-row-scenario')?.value || '',
    reps: parseInt(row.querySelector('.cp-plan-row-reps')?.value) || 1,
    note: row.querySelector('.cp-plan-row-note')?.value?.trim() || '',
    done: false
  })).filter(s => s.scenario);

  if (!scenarios.length) { cpMsg('cp-plan-msg', 'Ajoute au moins un exercice', false); return; }

  const data = await cpFetch('POST', '/training-plan', {
    player_id: playerId, title, description: desc,
    scenarios, target_scenario: tgtScen || null, target_energy: tgtEn
  });

  if (data.error) {
    cpMsg('cp-plan-msg', data.error, false);
  } else {
    cpMsg('cp-plan-msg', '✓ Plan assigné avec succès !', true);
    if (cpEl('cp-plan-title'))  cpEl('cp-plan-title').value = '';
    if (cpEl('cp-plan-desc'))   cpEl('cp-plan-desc').value  = '';
    if (cpEl('cp-plan-rows'))   cpEl('cp-plan-rows').innerHTML = '';
    _cpPlanRowId = 0;
    cpAddPlanRow();
  }
}

function cpRenderFeedbackForm(playerId) {
  return `
    <h3 class="cp-sub-title">Nouveau feedback</h3>
    <textarea id="cp-fb-content" class="cp-textarea" rows="3" placeholder="Feedback général sur la progression cette semaine..."></textarea>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">
      <div>
        <label style="font-size:0.75rem;color:var(--dim);display:block;margin-bottom:4px"><span style="color:#4ade80">${icon('check-circle',14)}</span> Points forts</label>
        <textarea id="cp-fb-strengths" class="cp-textarea" rows="2" placeholder="Ce qui est bien..."></textarea>
      </div>
      <div>
        <label style="font-size:0.75rem;color:var(--dim);display:block;margin-bottom:4px"><span style="color:#ff4655">${icon('alert-triangle',14)}</span> Points à améliorer</label>
        <textarea id="cp-fb-weaknesses" class="cp-textarea" rows="2" placeholder="Ce qui doit progresser..."></textarea>
      </div>
    </div>
    <textarea id="cp-fb-objective" class="cp-textarea" rows="2" placeholder="Objectif pour la semaine prochaine..."></textarea>
    <div id="cp-fb-msg" class="cp-msg" style="margin-top:8px"></div>
    <button class="btn-primary" style="width:100%;margin-top:10px" onclick="cpSubmitFeedback(${playerId})">Envoyer le feedback</button>
    <div id="cp-fb-history"></div>`;
}

async function cpSubmitFeedback(playerId) {
  const content   = cpEl('cp-fb-content')?.value?.trim();
  const strengths = cpEl('cp-fb-strengths')?.value?.trim();
  const weaknesses= cpEl('cp-fb-weaknesses')?.value?.trim();
  const objective = cpEl('cp-fb-objective')?.value?.trim();

  if (!content) { cpMsg('cp-fb-msg', 'Le feedback ne peut pas être vide', false); return; }

  const data = await cpFetch('POST', '/feedback', {
    player_id: playerId, content, strengths, weaknesses, week_objective: objective
  });

  if (data.error) {
    cpMsg('cp-fb-msg', data.error, false);
  } else {
    cpMsg('cp-fb-msg', 'Feedback envoyé !', true);
    // Vider les champs
    ['cp-fb-content','cp-fb-strengths','cp-fb-weaknesses','cp-fb-objective'].forEach(id => {
      const el = cpEl(id); if (el) el.value = '';
    });
    // Recharger l'historique des feedbacks
    cpLoadFeedbackHistory(playerId);
  }
}

async function cpLoadFeedbackHistory(playerId) {
  const data = await cpFetch('GET', `/feedback?player_id=${playerId}&limit=5`);
  const el = cpEl('cp-fb-history');
  if (!el) return;
  const fbs = data.feedbacks || [];
  if (fbs.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = `<h4 class="cp-sub-title" style="margin-top:20px">Feedbacks précédents</h4>
    ${fbs.map(f => `
      <div class="cp-feedback-card">
        <div class="cp-fb-date">${new Date(f.created_at).toLocaleDateString('fr-FR')}</div>
        <p class="cp-fb-content">${san(f.content)}</p>
        ${f.strengths ? `<div class="cp-fb-row"><span style="color:#4ade80">+ </span>${san(f.strengths)}</div>` : ''}
        ${f.weaknesses ? `<div class="cp-fb-row"><span style="color:#f87171">- </span>${san(f.weaknesses)}</div>` : ''}
        ${f.week_objective ? `<div class="cp-fb-row"><span style="color:var(--accent)">${icon('target',14)} </span>${san(f.week_objective)}</div>` : ''}
      </div>`).join('')}`;
}

async function cpEndRelationship(relId) {
  if (!confirm('Retirer ce joueur de ton roster ?')) return;
  await cpFetch('POST', '/coaching', { action: 'end', rel_id: relId });
  cpEl('cp-player-modal').classList.remove('active');
  cpLoadPlayers();
}

// ════════════════════════════════════════════════════════════
// JOUEUR — mon coach, mon plan, feedbacks
// ════════════════════════════════════════════════════════════

let cpMyRelId = null;

async function cpLoadMyCoach() {
  const data = await cpFetch('GET', '/coaching?view=my-coach');
  const coach = data.coach;
  const activeEl = cpEl('cp-active-coach-section');
  const noEl     = cpEl('cp-no-coach-section');
  if (!activeEl || !noEl) return;

  if (coach) {
    cpMyRelId = coach.rel_id;
    activeEl.style.display = 'block';
    noEl.style.display = 'none';
    cpEl('cp-coach-card').innerHTML = `
      <div class="cp-coach-card-inner">
        <div class="cp-player-avatar" style="width:52px;height:52px;font-size:1.5rem">
          ${coach.username[0].toUpperCase()}</div>
        <div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--txt)">${coach.username}</div>
          ${coach.bio ? `<div style="font-size:0.82rem;color:var(--dim);margin-top:3px">${coach.bio}</div>` : ''}
          <div style="font-size:0.75rem;color:var(--dim);margin-top:4px">
            Coach depuis ${new Date(coach.created_at).toLocaleDateString('fr-FR')}</div>
        </div>
      </div>`;
  } else {
    activeEl.style.display = 'none';
    noEl.style.display = 'block';
  }

  // Demandes en attente côté joueur
  const pendingData = await cpFetch('GET', '/coaching?view=pending');
  renderStudentPending(pendingData.pending || []);
}

async function cpCheckNotifications() {
  if (!coachingToken) return;
  // Ne vérifier les badges que si l'élève a un coach actif
  const coachData = await cpFetch('GET', '/coaching?view=my-coach');
  if (!coachData.coach) return;

  const lastSeenPlan = localStorage.getItem('visc_last_seen_plan') || '0';
  const lastSeenFb   = localStorage.getItem('visc_last_seen_fb')   || '0';
  const lastSeenVods = localStorage.getItem('visc_last_seen_vods') || '0';
  try {
    const [planRes, fbRes, vodRes] = await Promise.all([
      cpFetch('GET', '/training-plan'),
      cpFetch('GET', '/feedback?limit=1'),
      cpFetch('GET', '/coaching?view=my-vods')
    ]);
    // Plan badge
    const plan = planRes.plan;
    const badgePlan = document.getElementById('badge-plan');
    if (badgePlan && plan && plan.updated_at && plan.updated_at > lastSeenPlan) {
      badgePlan.style.display = '';
    }
    // Feedback badge
    const fbs = fbRes.feedbacks || [];
    const badgeFb = document.getElementById('badge-feedback');
    if (badgeFb && fbs.length > 0 && fbs[0].created_at > lastSeenFb) {
      badgeFb.style.display = '';
    }
    // VOD badge — au moins une VOD commentée après lastSeen
    const vods = vodRes.vods || [];
    const badgeVods = document.getElementById('badge-vods');
    if (badgeVods) {
      const hasNew = vods.some(v => v.reviewed && v.created_at > lastSeenVods);
      badgeVods.style.display = hasNew ? '' : 'none';
    }
  } catch(e) {}
}

function renderStudentPending(pending) {
  const el = cpEl('cp-student-pending');
  if (!el || pending.length === 0) { if (el) el.innerHTML = ''; return; }
  el.innerHTML = `<h3 class="cp-sub-title" style="margin-top:24px">Demandes en attente (${pending.length})</h3>
    ${pending.map(r => `
      <div class="cp-pending-card">
        <span class="cp-pending-name">${icon('trophy',16)} ${r.coach_username} veut te coacher</span>
        ${r.message ? `<span class="cp-pending-msg">"${r.message}"</span>` : ''}
        <div class="cp-pending-actions">
          <button class="btn-primary" style="font-size:0.75rem;padding:5px 14px"
            onclick="cpAcceptAsStudent(${r.rel_id})">&#10003; Accepter</button>
          <button class="btn-secondary" style="font-size:0.75rem;padding:5px 14px;opacity:0.7"
            onclick="cpDeclineAsStudent(${r.rel_id})">&#10005; Refuser</button>
        </div>
      </div>`).join('')}`;
}

async function cpInviteCoach() {
  const input = cpEl('cp-invite-coach-input');
  const username = input?.value?.trim();
  if (!username) return;
  cpMsg('cp-invite-coach-msg', '');
  const data = await cpFetch('POST', '/coaching', { action: 'request', target_username: username });
  if (data.error) {
    cpMsg('cp-invite-coach-msg', data.error, false);
  } else {
    cpMsg('cp-invite-coach-msg', `Demande envoyée à ${username} !`, true);
    if (input) input.value = '';
    setTimeout(cpLoadMyCoach, 800);
  }
}

async function cpAcceptAsStudent(relId) {
  await cpFetch('POST', '/coaching', { action: 'accept', rel_id: relId });
  cpLoadMyCoach();
}

async function cpDeclineAsStudent(relId) {
  await cpFetch('POST', '/coaching', { action: 'decline', rel_id: relId });
  cpLoadMyCoach();
}

async function cpEndCoaching() {
  if (!cpMyRelId) return;
  if (!confirm('Terminer le coaching avec ton coach ?')) return;
  await cpFetch('POST', '/coaching', { action: 'end', rel_id: cpMyRelId });
  cpMyRelId = null;
  cpLoadMyCoach();
}

// ── Plan d'entraînement (vue joueur) ────────────────────────
async function cpLoadPlan() {
  const data = await cpFetch('GET', '/training-plan');
  const el = cpEl('cp-plan-content');
  if (!el) return;

  const plan = data.plan;
  if (!plan) {
    el.innerHTML = `<div style="text-align:center;padding:40px 20px">
      <div style="font-size:3rem;margin-bottom:12px">${icon('clipboard',24)}</div>
      <p class="ch-empty">Ton coach n'a pas encore assigné de plan d'entraînement.</p>
    </div>`;
    return;
  }

  const scenarios = Array.isArray(plan.scenarios) ? plan.scenarios : JSON.parse(plan.scenarios || '[]');
  const done = scenarios.filter(s => s.done).length;
  const pct  = scenarios.length ? Math.round(done / scenarios.length * 100) : 0;

  el.innerHTML = `
    <div class="cp-plan-header">
      <div>
        <h3 style="color:var(--txt);font-size:1.1rem;margin:0 0 4px">${san(plan.title)}</h3>
        ${plan.description ? `<p style="color:var(--dim);font-size:0.85rem;margin:0">${san(plan.description)}</p>` : ''}
        <div style="font-size:0.75rem;color:var(--dim);margin-top:4px">
          Coach : <strong style="color:var(--accent)">${san(plan.coach_username || 'Coach')}</strong>
          &nbsp;·&nbsp; Assigné le ${new Date(plan.created_at).toLocaleDateString('fr-FR')}
        </div>
      </div>
      <div class="cp-plan-progress">
        <div style="font-size:1.5rem;font-weight:700;color:var(--accent)">${pct}%</div>
        <div style="font-size:0.75rem;color:var(--dim)">${done}/${scenarios.length} faits</div>
      </div>
    </div>
    <div class="cp-progress-bar"><div class="cp-progress-fill" style="width:${pct}%"></div></div>
    ${plan.target_scenario ? `
      <div class="cp-plan-target">
        ${icon('target',14)} Objectif : atteindre <strong>${san(plan.target_scenario)}</strong>
        ${plan.target_energy ? ` avec <strong>${plan.target_energy}</strong> energy` : ''}
      </div>` : ''}
    <div class="cp-scenarios-checklist" id="cp-plan-checklist">
      ${scenarios.map((s, i) => `
        <div class="cp-check-item ${s.done ? 'done' : ''}" id="cp-check-${i}">
          <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer">
            <input type="checkbox" ${s.done ? 'checked' : ''}
              onchange="cpToggleScenario(${plan.id}, ${i}, this.checked)"
              style="margin-top:3px;accent-color:var(--accent)">
            <div>
              <div style="font-weight:600;color:${s.done ? 'var(--dim)' : 'var(--txt)'};
                ${s.done ? 'text-decoration:line-through' : ''}">
                ${san(s.scenario)} <span style="color:var(--dim);font-weight:400">× ${s.reps}</span>
              </div>
              ${s.note ? `<div style="font-size:0.78rem;color:var(--dim);margin-top:2px">${san(s.note)}</div>` : ''}
            </div>
          </label>
        </div>`).join('')}
    </div>`;
}

async function cpToggleScenario(planId, idx, checked) {
  // Récupérer le plan actuel
  const data = await cpFetch('GET', `/training-plan?plan_id=${planId}`);
  if (!data.plan) return;

  const scenarios = Array.isArray(data.plan.scenarios)
    ? data.plan.scenarios : JSON.parse(data.plan.scenarios || '[]');
  if (scenarios[idx]) scenarios[idx].done = checked;

  await cpFetch('PATCH', '/training-plan', { plan_id: planId, scenarios });

  // Mettre à jour l'UI localement sans reload complet
  const item = cpEl(`cp-check-${idx}`);
  if (item) {
    item.classList.toggle('done', checked);
    const label = item.querySelector('div>div:first-child');
    if (label) {
      label.style.textDecoration = checked ? 'line-through' : '';
      label.style.color = checked ? 'var(--dim)' : 'var(--txt)';
    }
  }
  // Recalcul progression dans la foulée
  cpLoadPlan();
}

// ── Feedbacks (vue joueur) ───────────────────────────────────
async function cpLoadFeedbacks() {
  const data = await cpFetch('GET', '/feedback?limit=20');
  const el = cpEl('cp-feedbacks-list');
  if (!el) return;

  const fbs = data.feedbacks || [];
  if (fbs.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:40px 20px">
      <div style="font-size:3rem;margin-bottom:12px">${icon('message',24)}</div>
      <p class="ch-empty">Aucun feedback reçu pour l'instant.</p>
    </div>`;
    return;
  }

  el.innerHTML = fbs.map(f => `
    <div class="cp-feedback-card">
      <div class="cp-fb-header">
        <div class="cp-player-avatar" style="width:34px;height:34px;font-size:1rem">
          ${(f.coach_username||'?')[0].toUpperCase()}</div>
        <div>
          <span style="font-weight:600;color:var(--txt)">${san(f.coach_username || 'Coach')}</span>
          <span class="cp-fb-date">${new Date(f.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'})}</span>
        </div>
        ${f.scenario ? `<div style="margin-left:auto;font-size:0.75rem;color:var(--dim)">sur ${san(f.scenario)}</div>` : ''}
      </div>
      <p class="cp-fb-content">${san(f.content)}</p>
      ${f.strengths || f.weaknesses ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          ${f.strengths ? `<div class="cp-fb-section good"><span><span style="color:#4ade80">${icon('check-circle',14)}</span> Points forts</span><p>${san(f.strengths)}</p></div>` : '<div></div>'}
          ${f.weaknesses ? `<div class="cp-fb-section bad"><span><span style="color:#ff4655">${icon('alert-triangle',14)}</span> À améliorer</span><p>${san(f.weaknesses)}</p></div>` : ''}
        </div>` : ''}
      ${f.week_objective ? `
        <div class="cp-fb-section objective">
          <span>${icon('target',14)} Objectif semaine prochaine</span>
          <p>${san(f.week_objective)}</p>
        </div>` : ''}
    </div>`).join('');
}

// ── Messages coach ↔ joueur (dans la modale joueur) ─────────

async function cpLoadMessages() {
  if (!cpCurrentPlayer) return;
  const listEl = cpEl('cp-pt-messages-list');
  if (!listEl) return;
  listEl.innerHTML = '<p style="padding:12px;color:var(--dim);font-size:0.8rem">Chargement…</p>';
  const data = await cpFetch('GET', `/coaching?view=messages&rel_id=${cpCurrentPlayer.relId}`);
  cpRenderMessages(data.messages || []);
}

function cpRenderMessages(msgs) {
  const el = cpEl('cp-pt-messages-list');
  if (!el) return;
  if (!msgs.length) {
    el.innerHTML = '<p style="padding:12px;text-align:center;color:var(--dim);font-size:0.8rem">Aucun message</p>';
    return;
  }
  const myId = typeof coachingUser !== 'undefined' ? coachingUser?.id : null;
  el.innerHTML = msgs.map(m => {
    const mine = String(m.sender_id) === String(myId);
    const ago = typeof timeAgo === 'function' ? timeAgo(m.created_at) : '';
    return `<div class="msg-bubble ${mine ? 'msg-mine' : 'msg-theirs'}">
      ${!mine ? `<div class="msg-sender">${san(m.sender_username || '?')}</div>` : ''}
      <div class="msg-text">${san(m.content)}</div>
      ${ago ? `<div class="msg-time">${ago}</div>` : ''}
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function cpSendMessage() {
  if (!cpCurrentPlayer) return;
  const input = cpEl('cp-msg-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  await cpFetch('POST', '/coaching', { action: 'send-message', rel_id: cpCurrentPlayer.relId, content });
  cpLoadMessages();
}

// ── Progression joueur (chart + tableau) ────────────────────

async function cpLoadProgression() {
  if (!cpCurrentPlayer) return;
  const data = await cpFetch('GET', `/coaching?view=player-history&player_id=${cpCurrentPlayer.id}`);
  const history = data.history || [];
  cpRenderProgressionChart(history);
  cpRenderProgressionTable(history, cpEl('cp-pt-progress-table'));
}

function cpRenderProgressionChart(history) {
  const canvas = cpEl('cp-player-chart');
  if (!canvas || !window.Chart) return;
  if (window._cpProgressChart) { window._cpProgressChart.destroy(); window._cpProgressChart = null; }
  if (!history.length) return;
  const palette = ['#ff4655','#4ade80','#60a5fa','#fbbf24','#c084fc','#f87171','#34d399','#818cf8'];
  const modes = [...new Set(history.map(h => h.mode))];
  const modeColor = {};
  modes.forEach((m, i) => modeColor[m] = palette[i % palette.length]);
  const sorted = [...history].reverse();
  window._cpProgressChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(h => new Date(h.played_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })),
      datasets: [{ data: sorted.map(h => h.score), backgroundColor: sorted.map(h => modeColor[h.mode] + 'bb'), borderColor: sorted.map(h => modeColor[h.mode]), borderWidth: 1, borderRadius: 3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        title: (items) => { const h = sorted[items[0].dataIndex]; return `${new Date(h.played_at).toLocaleDateString('fr-FR')} — ${h.mode.replace(/_/g,' ')}`; },
        label: (item) => ` Score : ${item.raw.toLocaleString()}`
      }}},
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
      }
    }
  });
}

function cpRenderProgressionTable(history, el) {
  if (!el) return;
  if (!history.length) { el.innerHTML = '<p class="ch-empty" style="padding:8px">Aucune partie enregistrée</p>'; return; }
  const recent = history.slice(0, 15);
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.78rem">
    <thead><tr style="color:var(--dim);border-bottom:1px solid var(--border)">
      <th style="padding:6px 8px;text-align:left">Date</th>
      <th style="padding:6px 8px;text-align:left">Mode</th>
      <th style="padding:6px 8px;text-align:right">Score</th>
      <th style="padding:6px 8px;text-align:right">Précision</th>
    </tr></thead>
    <tbody>${recent.map(h => `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <td style="padding:5px 8px;color:var(--dim)">${new Date(h.played_at).toLocaleDateString('fr-FR')}</td>
      <td style="padding:5px 8px">${san(h.mode.replace(/_/g,' '))}</td>
      <td style="padding:5px 8px;text-align:right;color:var(--accent);font-weight:700">${Number(h.score).toLocaleString()}</td>
      <td style="padding:5px 8px;text-align:right">${h.accuracy != null ? h.accuracy + '%' : '—'}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// ── VODs — étudiant ──────────────────────────────────────────

async function cpLoadMyVods() {
  const el = cpEl('cp-vods-list');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty">Chargement...</p>';
  const data = await cpFetch('GET', '/coaching?view=my-vods');
  const vods = data.vods || [];
  if (!vods.length) {
    el.innerHTML = '<p class="ch-empty">Aucune VOD soumise pour l\'instant.</p>';
    return;
  }
  el.innerHTML = vods.map(v => {
    const date = new Date(v.created_at).toLocaleDateString('fr-FR');
    const reviewedBadge = v.reviewed
      ? `<span style="background:#4ade8022;color:#4ade80;border:1px solid #4ade8055;padding:2px 8px;border-radius:12px;font-size:0.72rem">✓ Commenté</span>`
      : `<span style="background:rgba(255,255,255,0.06);color:var(--dim);border:1px solid var(--border);padding:2px 8px;border-radius:12px;font-size:0.72rem">En attente</span>`;
    return `
    <div class="cp-vod-card" style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
        <div>
          <div style="font-weight:600;color:var(--txt);margin-bottom:4px">${san(v.title)}</div>
          <div style="font-size:0.75rem;color:var(--dim)">${date}</div>
        </div>
        ${reviewedBadge}
      </div>
      <a href="${san(v.url)}" target="_blank" rel="noopener noreferrer"
         style="font-size:0.78rem;color:var(--accent);word-break:break-all">${san(v.url)}</a>
      ${v.notes ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--dim);border-top:1px solid var(--border);padding-top:8px">${san(v.notes)}</div>` : ''}
      ${v.coach_feedback ? `
        <div style="margin-top:10px;background:rgba(0,200,136,0.08);border:1px solid rgba(0,200,136,0.2);border-radius:8px;padding:10px">
          <div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:4px">${icon('message',14)} Feedback coach</div>
          <div style="font-size:0.82rem;color:var(--txt)">${san(v.coach_feedback)}</div>
        </div>` : ''}
    </div>`;
  }).join('');
}

async function cpSubmitVod() {
  const url = cpEl('cp-vod-url')?.value?.trim();
  const title = cpEl('cp-vod-title')?.value?.trim();
  const notes = cpEl('cp-vod-notes')?.value?.trim();
  const msgEl = cpEl('cp-vod-submit-msg');

  if (!url) { cpMsg('cp-vod-submit-msg', 'Le lien est requis.', false); return; }
  if (!title) { cpMsg('cp-vod-submit-msg', 'Le titre est requis.', false); return; }

  if (msgEl) { msgEl.textContent = 'Envoi...'; msgEl.style.color = 'var(--dim)'; msgEl.style.display = 'block'; }

  const data = await cpFetch('POST', '/coaching', { action: 'submit-vod', url, title, notes: notes || null });
  if (data.error) {
    cpMsg('cp-vod-submit-msg', data.error, false);
  } else {
    cpMsg('cp-vod-submit-msg', '✓ VOD soumise avec succès !', true);
    if (cpEl('cp-vod-url')) cpEl('cp-vod-url').value = '';
    if (cpEl('cp-vod-title')) cpEl('cp-vod-title').value = '';
    if (cpEl('cp-vod-notes')) cpEl('cp-vod-notes').value = '';
    setTimeout(() => { cpLoadMyVods(); }, 600);
  }
}

// ── VODs — coach (modal joueur, onglet VODs) ─────────────────

async function cpLoadPlayerVods(playerId) {
  const el = cpEl('cp-pt-vods-list');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty">Chargement...</p>';
  // On filtre côté client après avoir récupéré toutes les VODs du coach
  const data = await cpFetch('GET', '/coaching?view=student-vods');
  const vods = (data.vods || []).filter(v => String(v.student_id) === String(playerId));
  if (!vods.length) {
    el.innerHTML = '<p class="ch-empty">Cet élève n\'a soumis aucune VOD.</p>';
    return;
  }
  el.innerHTML = vods.map(v => {
    const date = new Date(v.created_at).toLocaleDateString('fr-FR');
    const reviewedBadge = v.reviewed
      ? `<span style="background:#4ade8022;color:#4ade80;border:1px solid #4ade8055;padding:2px 8px;border-radius:12px;font-size:0.72rem">✓ Commenté</span>`
      : `<span style="background:rgba(255,200,0,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);padding:2px 8px;border-radius:12px;font-size:0.72rem">Nouveau</span>`;
    return `
    <div class="cp-vod-card" style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px" id="vod-card-${v.id}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
        <div>
          <div style="font-weight:600;color:var(--txt);margin-bottom:4px">${san(v.title)}</div>
          <div style="font-size:0.75rem;color:var(--dim)">${date}</div>
        </div>
        ${reviewedBadge}
      </div>
      <a href="${san(v.url)}" target="_blank" rel="noopener noreferrer"
         style="font-size:0.78rem;color:var(--accent);word-break:break-all">${san(v.url)}</a>
      ${v.notes ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--dim);border-top:1px solid var(--border);padding-top:8px">${san(v.notes)}</div>` : ''}
      ${v.coach_feedback ? `
        <div style="margin-top:10px;background:rgba(0,200,136,0.08);border:1px solid rgba(0,200,136,0.2);border-radius:8px;padding:10px;margin-bottom:8px">
          <div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:4px">${icon('message',14)} Mon feedback</div>
          <div style="font-size:0.82rem;color:var(--txt)">${san(v.coach_feedback)}</div>
        </div>` : ''}
      <div style="margin-top:10px" id="vod-fb-wrap-${v.id}">
        <textarea id="vod-fb-${v.id}" class="cp-input" placeholder="Laisser un feedback..." rows="2"
          style="width:100%;resize:vertical;font-family:inherit;font-size:0.82rem;padding:7px 10px;
                 background:var(--card);border:1px solid var(--border);border-radius:7px;color:var(--txt)"
        >${san(v.coach_feedback || '')}</textarea>
        <button class="btn-primary" style="margin-top:6px;width:100%;font-size:0.8rem"
          onclick="cpSaveVodFeedback(${v.id}, ${playerId})">${icon('message',14)} Sauvegarder le feedback</button>
        <div id="vod-fb-msg-${v.id}" class="cp-msg" style="margin-top:4px"></div>
      </div>
    </div>`;
  }).join('');
}

async function cpSaveVodFeedback(vodId, playerId) {
  const feedback = cpEl(`vod-fb-${vodId}`)?.value?.trim();
  const data = await cpFetch('POST', '/coaching', { action: 'vod-feedback', vod_id: vodId, feedback: feedback || '' });
  if (data.error) {
    cpMsg(`vod-fb-msg-${vodId}`, data.error, false);
  } else {
    cpMsg(`vod-fb-msg-${vodId}`, '✓ Feedback sauvegardé', true);
    setTimeout(() => cpLoadPlayerVods(playerId), 700);
  }
}

// ── Hook dans l'init global du coaching ─────────────────────
// Patch : on surcharge showApp pour appeler cpInit
const _origShowApp = typeof showApp === 'function' ? showApp : null;
// Alternative : event-based init quand le coaching screen devient actif
document.addEventListener('click', e => {
  if (e.target.id === 'btn-coaching' || e.target.closest('#btn-coaching')) {
    setTimeout(cpInit, 100);
  }
  if (e.target.closest('.ch-tab-btn')?.dataset.tab === 'ch-students') {
    setTimeout(cpLoadPlayers, 50);
  }
  if (e.target.closest('.ch-tab-btn')?.dataset.tab === 'cp-mes-vods') {
    setTimeout(cpLoadMyVods, 50);
    localStorage.setItem('visc_last_seen_vods', new Date().toISOString());
    const bv = document.getElementById('badge-vods');
    if (bv) bv.style.display = 'none';
  }
});
