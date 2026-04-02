// ============================================================
// coachplayer.js — Coach ↔ Joueur
// Dépend de : coachingToken, coachingUser, coachingUserRole, API_BASE
// ============================================================

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

// ── Init — appelé quand le coaching screen s'ouvre ───────────
function cpInit() {
  if (!coachingUser) return;
  const isAdmin   = coachingUserRole === 'admin';
  const isCoach   = coachingUserRole === 'coach' || isAdmin;
  const isStudent = coachingUserRole === 'student';

  // Afficher/masquer les onglets selon le rôle
  document.querySelectorAll('.cp-student-tab').forEach(el => {
    el.style.display = isStudent ? '' : 'none';
  });

  // Section admin
  const adminSection = cpEl('cp-admin-section');
  if (adminSection) adminSection.style.display = isAdmin ? 'block' : 'none';

  // Pré-charger le bon contenu selon le rôle
  if (isCoach)   cpLoadPlayers();
  if (isAdmin)   cpLoadAdminRelationships();
  if (isStudent) { cpLoadMyCoach(); cpCheckPendingBadge(); }
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
        <span class="cp-pending-name">&#128100; ${r.player_username}</span>
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
  el.innerHTML = `<h3 class="cp-sub-title">Mes joueurs actifs (${players.length})</h3>
    <div class="cp-players-grid">
      ${players.map(p => `
        <div class="cp-player-card" onclick="cpOpenPlayer(${p.id}, '${p.username}', ${p.rel_id})">
          <div class="cp-player-avatar">${p.username[0].toUpperCase()}</div>
          <div class="cp-player-info">
            <span class="cp-player-name">${p.username}</span>
            <span class="cp-player-meta">Cliquer pour voir les stats</span>
          </div>
          <span style="color:var(--accent);font-size:1.2rem">&#8250;</span>
        </div>`).join('')}
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

async function cpOpenPlayer(playerId, username, relId) {
  cpCurrentPlayer = { id: playerId, username, relId };
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
        <div style="font-size:1.2rem;font-weight:700;color:var(--txt)">${username}</div>
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
  cpEl('cp-pt-plan').innerHTML  = cpRenderPlanForm(playerId);
  cpEl('cp-pt-feedback').innerHTML = cpRenderFeedbackForm(playerId);

  modal.classList.add('active');

  // Fetch best scores
  const data = await cpFetch('GET', `/benchmark?view=best&user_id=${encodeURIComponent(playerId)}`);
  cpRenderPlayerStats(data.best || [], playerId);
}

function cpRenderPlayerStats(bests, playerId) {
  if (bests.length === 0) {
    cpEl('cp-pt-stats').innerHTML = '<p class="ch-empty">Ce joueur n\'a pas encore de runs benchmark.</p>';
    cpEl('cp-modal-energy-summary').textContent = 'Aucun run benchmark';
    return;
  }

  const avgEnergy = (bests.reduce((s, r) => s + (r.energy || 0), 0) / bests.length).toFixed(1);
  cpEl('cp-modal-energy-summary').textContent = `${avgEnergy} energy moy. sur ${bests.length} scénarios`;

  const rows = bests.map(r => `
    <tr>
      <td style="color:var(--txt)">${r.scenario}</td>
      <td style="text-align:right">${r.score?.toLocaleString() || 0}</td>
      <td style="text-align:right">${r.accuracy || 0}%</td>
      <td style="text-align:right">${(r.energy || 0).toFixed(1)}</td>
      <td style="text-align:right">${cpRankBadge(r.rank_name)}</td>
    </tr>`).join('');

  cpEl('cp-pt-stats').innerHTML = `
    <table class="cp-stats-table">
      <thead><tr>
        <th>Scénario</th><th>Score</th><th>Acc.</th><th>Energy</th><th>Rang</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function cpRenderPlanForm(playerId) {
  return `
    <h3 class="cp-sub-title">Assigner un plan</h3>
    <input id="cp-plan-title" class="cp-input" placeholder="Titre du plan (ex: Semaine reactive tracking)" style="margin-bottom:8px">
    <textarea id="cp-plan-desc" class="cp-textarea" rows="2" placeholder="Description / objectif général..."></textarea>
    <h4 style="color:var(--dim);font-size:0.8rem;margin:12px 0 6px">Exercices (1 par ligne : scénario | reps | note)</h4>
    <textarea id="cp-plan-scenarios" class="cp-textarea" rows="5"
      placeholder="ground_plaza | 3 | Focus sur la hauteur&#10;air_pure | 2 | Prendre son temps&#10;flicker_plaza | 3 | Réagir vite"></textarea>
    <input id="cp-plan-target-scenario" class="cp-input" placeholder="Scénario objectif (optionnel)" style="margin:8px 0">
    <input id="cp-plan-target-energy" class="cp-input" type="number" placeholder="Energy cible (ex: 75)" style="margin-bottom:12px">
    <div id="cp-plan-msg" class="cp-msg"></div>
    <button class="btn-primary" style="width:100%" onclick="cpSubmitPlan(${playerId})">Assigner ce plan</button>`;
}

async function cpSubmitPlan(playerId) {
  const title    = cpEl('cp-plan-title')?.value?.trim();
  const desc     = cpEl('cp-plan-desc')?.value?.trim();
  const rawLines = cpEl('cp-plan-scenarios')?.value?.trim();
  const tgtScen  = cpEl('cp-plan-target-scenario')?.value?.trim();
  const tgtEn    = parseFloat(cpEl('cp-plan-target-energy')?.value) || null;

  if (!title) { cpMsg('cp-plan-msg', 'Le titre est requis', false); return; }

  // Parser les lignes scénarios
  const scenarios = (rawLines || '').split('\n')
    .map(l => l.trim()).filter(Boolean)
    .map(l => {
      const parts = l.split('|').map(p => p.trim());
      return { scenario: parts[0], reps: parseInt(parts[1]) || 1, note: parts[2] || '', done: false };
    });

  const data = await cpFetch('POST', '/training-plan', {
    player_id: playerId, title, description: desc,
    scenarios, target_scenario: tgtScen || null, target_energy: tgtEn
  });

  if (data.error) {
    cpMsg('cp-plan-msg', data.error, false);
  } else {
    cpMsg('cp-plan-msg', 'Plan assigné avec succès !', true);
  }
}

function cpRenderFeedbackForm(playerId) {
  return `
    <h3 class="cp-sub-title">Nouveau feedback</h3>
    <textarea id="cp-fb-content" class="cp-textarea" rows="3" placeholder="Feedback général sur la progression cette semaine..."></textarea>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">
      <div>
        <label style="font-size:0.75rem;color:var(--dim);display:block;margin-bottom:4px">&#128994; Points forts</label>
        <textarea id="cp-fb-strengths" class="cp-textarea" rows="2" placeholder="Ce qui est bien..."></textarea>
      </div>
      <div>
        <label style="font-size:0.75rem;color:var(--dim);display:block;margin-bottom:4px">&#128308; Points à améliorer</label>
        <textarea id="cp-fb-weaknesses" class="cp-textarea" rows="2" placeholder="Ce qui doit progresser..."></textarea>
      </div>
    </div>
    <textarea id="cp-fb-objective" class="cp-textarea" rows="2" placeholder="&#127945; Objectif pour la semaine prochaine..."></textarea>
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
        <p class="cp-fb-content">${f.content}</p>
        ${f.strengths ? `<div class="cp-fb-row"><span style="color:#4ade80">+ </span>${f.strengths}</div>` : ''}
        ${f.weaknesses ? `<div class="cp-fb-row"><span style="color:#f87171">- </span>${f.weaknesses}</div>` : ''}
        ${f.week_objective ? `<div class="cp-fb-row"><span style="color:var(--accent)">&#127945; </span>${f.week_objective}</div>` : ''}
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

function renderStudentPending(pending) {
  const el = cpEl('cp-student-pending');
  if (!el || pending.length === 0) { if (el) el.innerHTML = ''; return; }
  el.innerHTML = `<h3 class="cp-sub-title" style="margin-top:24px">Demandes en attente (${pending.length})</h3>
    ${pending.map(r => `
      <div class="cp-pending-card">
        <span class="cp-pending-name">&#127942; ${r.coach_username} veut te coacher</span>
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
      <div style="font-size:3rem;margin-bottom:12px">&#128203;</div>
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
        <h3 style="color:var(--txt);font-size:1.1rem;margin:0 0 4px">${plan.title}</h3>
        ${plan.description ? `<p style="color:var(--dim);font-size:0.85rem;margin:0">${plan.description}</p>` : ''}
        <div style="font-size:0.75rem;color:var(--dim);margin-top:4px">
          Coach : <strong style="color:var(--accent)">${plan.coach_username || 'Coach'}</strong>
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
        &#127945; Objectif : atteindre <strong>${plan.target_scenario}</strong>
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
                ${s.scenario} <span style="color:var(--dim);font-weight:400">× ${s.reps}</span>
              </div>
              ${s.note ? `<div style="font-size:0.78rem;color:var(--dim);margin-top:2px">${s.note}</div>` : ''}
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
      <div style="font-size:3rem;margin-bottom:12px">&#128172;</div>
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
          <span style="font-weight:600;color:var(--txt)">${f.coach_username || 'Coach'}</span>
          <span class="cp-fb-date">${new Date(f.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'})}</span>
        </div>
        ${f.scenario ? `<div style="margin-left:auto;font-size:0.75rem;color:var(--dim)">sur ${f.scenario}</div>` : ''}
      </div>
      <p class="cp-fb-content">${f.content}</p>
      ${f.strengths || f.weaknesses ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          ${f.strengths ? `<div class="cp-fb-section good"><span>&#128994; Points forts</span><p>${f.strengths}</p></div>` : '<div></div>'}
          ${f.weaknesses ? `<div class="cp-fb-section bad"><span>&#128308; À améliorer</span><p>${f.weaknesses}</p></div>` : ''}
        </div>` : ''}
      ${f.week_objective ? `
        <div class="cp-fb-section objective">
          <span>&#127945; Objectif semaine prochaine</span>
          <p>${f.week_objective}</p>
        </div>` : ''}
    </div>`).join('');
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
});
