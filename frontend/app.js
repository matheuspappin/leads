/* ─────────────────────────────────────────
   Lead Hunter — Frontend App Logic
   Identidade Visual AKAAI CORE
   ───────────────────────────────────────── */

// ══════════════════════════════════════
//  PARTICLES — efeito AKAAI CORE
// ══════════════════════════════════════
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pts;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkPts(n) {
    pts = [];
    for (let i = 0; i < n; i++) {
      pts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Move
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
    // Lines
    const DIST = 120;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < DIST) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255,255,255,${0.12 * (1 - d/DIST)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    // Dots
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  mkPts(70);
  draw();
  window.addEventListener('resize', () => { resize(); mkPts(70); });
})();

const API = '';
let supabaseClient = null;
let currentUser = null;
let authToken = null;

let currentLeads  = [];
let currentSearch = null;
let sortField     = 'score';
let sortAsc       = false;
let activeFilter  = 'all';

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
});

async function initSupabase() {
  try {
    // Busca as configs do backend
    const res  = await fetch(`${API}/api/config`);
    const conf = await res.json();

    if (!conf.supabase_url || !conf.supabase_anon_key) {
      showAuthError('Configuração do servidor incompleta. Contate o administrador.');
      return;
    }

    supabaseClient = window.supabase.createClient(conf.supabase_url, conf.supabase_anon_key);

    // Verifica sessão existente
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      await onLogin(session);
    } else {
      window.location.href = '/login';
    }

    // Ouve mudanças de auth
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await onLogin(session);
      } else if (event === 'SIGNED_OUT') {
        onLogout();
      }
    });
    } catch (err) {
    console.error('Falha ao inicializar Supabase:', err);
    alert('Erro crítico: Falha ao inicializar o banco de dados. Recarregue a página.');
  }
}

// ══════════════════════════════════════
//  ON LOGIN / LOGOUT
// ══════════════════════════════════════
async function onLogin(session) {
  currentUser = session.user;
  authToken   = session.access_token;
  
  // Show app content, hide loader
  const loader = document.getElementById('initial-loader');
  const appContent = document.getElementById('app-content');
  if (loader) loader.style.display = 'none';
  if (appContent) appContent.style.display = 'flex';

  updateUserUI();
  await checkApiKeyStatus();
  checkApiStatus();
  loadStats();
}

function onLogout() {
  currentUser  = null;
  authToken    = null;
  currentLeads = [];
  currentSearch = null;
  window.location.href = '/login';
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
}

function updateUserUI() {
  if (!currentUser) return;
  const email   = currentUser.email || '';
  const initial = email.charAt(0).toUpperCase();
  document.getElementById('user-email').textContent  = email;
  document.getElementById('user-avatar').textContent = initial;
}

// ══════════════════════════════════════
//  API KEY STATUS
// ══════════════════════════════════════
async function checkApiKeyStatus() {
  try {
    const res  = await authFetch('/api/settings');
    const data = await res.json();
    const banner = document.getElementById('api-key-banner');
    const dot    = document.getElementById('status-dot');
    const txt    = document.getElementById('status-text');

    if (data.has_api_key) {
      banner.style.display = 'none';
      dot.className = 'status-dot ok';
      txt.textContent = 'API Key: Configurada';
      // Mostra chave mascarada nas configurações se abertas
      const el = document.getElementById('settings-current-key');
      if (el) el.textContent = data.masked_key ? `Chave atual: ${data.masked_key}` : '';
    } else {
      banner.style.display = 'flex';
      dot.className = 'status-dot error';
      txt.textContent = 'API Key: Não configurada';
    }
  } catch {}
}

async function checkApiStatus() {
  try {
    const res  = await fetch(`${API}/api/status`);
    const data = await res.json();
    if (!data.supabase_configured) {
      document.getElementById('status-dot').className = 'status-dot error';
      document.getElementById('status-text').textContent = 'Supabase não configurado';
    }
  } catch {
    document.getElementById('status-dot').className = 'status-dot error';
    document.getElementById('status-text').textContent = 'Backend offline';
  }
}

// ══════════════════════════════════════
//  SETTINGS MODAL
// ══════════════════════════════════════
async function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('settings-error').textContent = '';
  document.getElementById('input-api-key').value = '';

  // Carrega info da API Key atual
  try {
    const res  = await authFetch('/api/settings');
    const data = await res.json();
    const el   = document.getElementById('settings-current-key');
    el.textContent = data.has_api_key
      ? `✅ Chave atual: ${data.masked_key}`
      : '⚠️ Nenhuma API Key configurada ainda';
  } catch {}
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ══════════════════════════════════════
//  MANUAL MODAL
// ══════════════════════════════════════
function openManual() {
  document.getElementById('manual-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeManual() {
  document.getElementById('manual-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function saveSettings(e) {
  e.preventDefault();
  const key    = document.getElementById('input-api-key').value.trim();
  const errEl  = document.getElementById('settings-error');
  errEl.textContent = '';

  if (!key) {
    errEl.textContent = 'Por favor, cole sua API Key antes de salvar.';
    return;
  }

  const spinner = document.getElementById('save-spinner');
  const btnText = document.getElementById('btn-save-text');
  spinner.style.display = 'block';
  btnText.style.display = 'none';

  try {
    const res  = await authFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_api_key: key }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || 'Erro ao salvar');
    showToast('✅ API Key salva com sucesso!', 'success');
    closeSettings();
    await checkApiKeyStatus();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    spinner.style.display = 'none';
    btnText.style.display = '';
  }
}

// ══════════════════════════════════════
//  AUTH FETCH HELPER
// ══════════════════════════════════════
function authFetch(url, options = {}) {
  return fetch(`${API}${url}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${authToken}`,
    },
  });
}

// ══════════════════════════════════════
//  STATS (sidebar)
// ══════════════════════════════════════
async function loadStats() {
  if (!authToken) return;
  try {
    const res  = await authFetch('/api/history');
    const data = await res.json();
    document.getElementById('stat-searches').textContent = data.length;
    const total = data.reduce((a, b) => a + (b.total_leads || 0), 0);
    document.getElementById('stat-total').textContent = total;
  } catch {}
}

// ══════════════════════════════════════
//  PANELS & NAVIGATION
// ══════════════════════════════════════
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');
  document.getElementById('top-bar-title').textContent =
    name === 'search' ? 'Nova Busca' : 'Histórico de Buscas';
  if (name === 'history') loadHistory();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ══════════════════════════════════════
//  QUICK NICHE BUTTONS
// ══════════════════════════════════════
function setNiche(val) {
  document.getElementById('input-query').value = val;
  document.getElementById('input-query').focus();
}

// ══════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════
async function handleSearch(e) {
  e.preventDefault();

  const query = document.getElementById('input-query').value.trim();
  const city  = document.getElementById('input-city').value.trim();
  if (!query || !city) return;

  const reqPhone   = document.getElementById('chk-req-phone').checked;
  const reqReviews = document.getElementById('chk-req-reviews').checked;
  const openOnly   = document.getElementById('chk-open-only').checked;

  setLoadingState(true);
  hideResults();

  try {
    const res = await authFetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, city, req_phone: reqPhone, req_reviews: reqReviews, open_only: openOnly }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erro ao buscar leads');
    }

    const data = await res.json();
    currentSearch = { search_id: data.search_id, query, city };
    currentLeads  = data.leads || [];
    sortField     = 'score';
    sortAsc       = false;
    activeFilter  = 'all';

    renderResults(data);
    loadStats();

    if (data.from_cache) {
      showToast('📦 Resultado obtido do cache (economizando cota da API)', 'warn');
    } else {
      showToast(`✅ ${data.total} leads encontrados para "${query}" em ${city}!`, 'success');
    }

  } catch (err) {
    showToast(`❌ ${err.message}`, 'error', 6000);
    if (err.message && err.message.includes('API Key')) {
      document.getElementById('api-key-banner').style.display = 'flex';
    }
  } finally {
    setLoadingState(false);
  }
}

// ══════════════════════════════════════
//  RENDER RESULTS
// ══════════════════════════════════════
function renderResults(data) {
  document.getElementById('results-section').style.display = 'block';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('results-title').textContent = `"${data.query}" em ${data.city}`;
  document.getElementById('results-count').textContent = `${data.total} leads`;
  const cacheBadge = document.getElementById('cache-badge');
  cacheBadge.style.display = data.from_cache ? 'inline-flex' : 'none';
  renderTable();
}

function renderTable() {
  let leads = [...currentLeads];
  if (activeFilter === 'no-site')   leads = leads.filter(l => !l.has_website);
  if (activeFilter === 'no-phone')  leads = leads.filter(l => !l.has_phone);
  if (activeFilter === 'bad-rating') leads = leads.filter(l => l.rating > 0 && l.rating < 4.0);
  if (activeFilter === 'no-reviews') leads = leads.filter(l => l.user_ratings === 0);
  if (activeFilter === 'low-score') leads = leads.filter(l => l.score >= 40);

  let centerLat = 0, centerLng = 0;
  if (sortField === 'distance' && currentLeads.length > 0) {
    centerLat = currentLeads.reduce((sum, l) => sum + (l.lat || 0), 0) / currentLeads.length;
    centerLng = currentLeads.reduce((sum, l) => sum + (l.lng || 0), 0) / currentLeads.length;
  }

  leads.sort((a, b) => {
    if (sortField === 'distance') {
      const distA = Math.pow((a.lat || centerLat) - centerLat, 2) + Math.pow((a.lng || centerLng) - centerLng, 2);
      const distB = Math.pow((b.lat || centerLat) - centerLat, 2) + Math.pow((b.lng || centerLng) - centerLng, 2);
      return sortAsc ? distB - distA : distA - distB;
    }

    let va = a[sortField], vb = b[sortField];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const tbody = document.getElementById('leads-tbody');
  tbody.innerHTML = '';

  if (leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhum lead corresponde ao filtro</td></tr>`;
    return;
  }

  leads.forEach(lead => {
    const row = document.createElement('tr');
    row.onclick = () => openModal(lead);

    let scoreClass = 'low';
    if (lead.score >= 60) scoreClass = 'high';
    else if (lead.score >= 30) scoreClass = 'medium';

    const stars = lead.rating > 0
      ? `<span class="stars-icon">${'★'.repeat(Math.round(lead.rating))}${'☆'.repeat(5 - Math.round(lead.rating))}</span>`
      : '';

    const websiteLower = (lead.website || '').toLowerCase();
    const isInsta = websiteLower.includes('instagram.com') || websiteLower.includes('instagr.am');
    const isFb = websiteLower.includes('facebook.com') || websiteLower.includes('fb.com') || websiteLower.includes('fb.me');
    let siteChip = '<span class="chip chip-red">✗ Sem Site</span>';
    if (lead.has_website) {
       if (isInsta) {
         siteChip = '<span class="chip" style="color:#e1306c; border-color:rgba(225,48,108,0.3); background:rgba(225,48,108,0.1)">📸 Instagram</span>';
       } else if (isFb) {
         siteChip = '<span class="chip" style="color:#1877f2; border-color:rgba(24,119,242,0.3); background:rgba(24,119,242,0.1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> Facebook</span>';
       } else {
         siteChip = '<span class="chip chip-green">✓ Site</span>';
       }
    }

    const globeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    const instaIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
    const fbIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`;
    const siteIcon = isInsta ? instaIcon : (isFb ? fbIcon : globeIcon);

    row.innerHTML = `
      <td>
        <div class="lead-name">${escHtml(lead.name)}</div>
        <div class="lead-address">${escHtml(lead.address)}</div>
        <div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">
          ${siteChip}
          ${lead.has_phone   ? '<span class="chip chip-green">✓ Tel</span>'  : '<span class="chip chip-red">✗ Sem Tel</span>'}
        </div>
      </td>
      <td>
        ${lead.phone
          ? `<div class="contact-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="tel:${lead.phone}" onclick="event.stopPropagation()">${escHtml(lead.phone)}</a></div>`
          : '<div class="no-data">Sem telefone</div>'}
        ${lead.website
          ? `<div class="contact-item">${siteIcon}<a href="${lead.website}" target="_blank" onclick="event.stopPropagation()">${shortUrl(lead.website)}</a></div>`
          : '<div class="no-data" style="margin-top:3px">Sem site</div>'}
      </td>
      <td>
        <div class="rating-wrap">
          ${lead.rating > 0
            ? `<div class="stars"><span class="stars-val">${lead.rating.toFixed(1)}</span>${stars}</div><div class="reviews-count">${lead.user_ratings.toLocaleString('pt-BR')} avaliações</div>`
            : '<div class="no-data">Sem avaliações</div>'}
        </div>
      </td>
      <td>
        <div style="text-align:center">
          <div class="score-badge ${scoreClass}">${lead.score}</div>
        </div>
      </td>
      <td>
        <div class="actions-cell" onclick="event.stopPropagation()">
          ${lead.maps_url
            ? `<a class="action-btn" href="${lead.maps_url}" target="_blank" title="Abrir no Google Maps">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
               </a>`
            : ''}
          ${lead.phone
            ? `<a class="action-btn" href="https://wa.me/${sanitizePhone(lead.phone)}" target="_blank" title="WhatsApp">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
               </a>`
            : ''}
          <button class="action-btn" title="Ver detalhes" onclick="openModal(${JSON.stringify(lead).split('"').join('&quot;')})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ══════════════════════════════════════
//  FILTER & SORT
// ══════════════════════════════════════
function applyFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTable();
}

function sortLeads(field, btn) {
  if (sortField === field) sortAsc = !sortAsc;
  else { sortField = field; sortAsc = false; }
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTable();
}

// ══════════════════════════════════════
//  EXPORT CSV
// ══════════════════════════════════════
async function exportCSV() {
  if (!currentSearch) return;
  try {
    const url = `${API}/api/export/${currentSearch.search_id}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${authToken}` } });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leads_${currentSearch.search_id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('📁 Download do CSV iniciado!', 'success');
  } catch {
    showToast('Erro ao exportar CSV', 'error');
  }
}

// ══════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════
async function loadHistory() {
  const container = document.getElementById('history-list');
  container.innerHTML = `<div class="empty-state"><div class="loading-ring"></div></div>`;

  try {
    const res  = await authFetch('/api/history');
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Nenhuma busca ainda</h3>
          <p>Faça uma busca para ela aparecer aqui</p>
        </div>`;
      return;
    }

    container.innerHTML = '';
    data.forEach(s => {
      const card = document.createElement('div');
      card.className = 'history-card';
      const date = new Date(s.created_at).toLocaleString('pt-BR');
      card.innerHTML = `
        <div class="history-info">
          <div class="history-query">${escHtml(s.query)}</div>
          <div class="history-meta">
            <span>📍 ${escHtml(s.city)}</span>
            <span>🕐 ${date}</span>
          </div>
        </div>
        <div class="history-actions">
          <div class="history-leads-badge">${s.total_leads} leads</div>
          <button class="btn-del" title="Excluir" onclick="deleteSearch(${s.id}, event)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>`;
      card.onclick = () => loadHistorySearch(s.id, s.query, s.city);
      container.appendChild(card);
    });
  } catch {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Erro ao carregar histórico</h3></div>`;
  }
}

async function loadHistorySearch(id, query, city) {
  try {
    const res  = await authFetch(`/api/search/${id}`);
    const data = await res.json();
    currentSearch = { search_id: id, query, city };
    currentLeads  = (data.leads || []).map(l => ({
      ...l,
      score_reasons: l.score_reasons || [],
      has_website: Boolean(l.has_website),
      has_phone:   Boolean(l.has_phone),
    }));
    activeFilter = 'all';
    sortField    = 'score';
    sortAsc      = false;
    showPanel('search');
    renderResults({ query, city, total: currentLeads.length, from_cache: false });
    showToast(`🔄 Busca "${query}" carregada do histórico`, 'success');
  } catch {
    showToast('Erro ao carregar busca do histórico', 'error');
  }
}

async function deleteSearch(id, e) {
  e.stopPropagation();
  if (!confirm('Excluir esta busca e todos os leads?')) return;
  try {
    await authFetch(`/api/search/${id}`, { method: 'DELETE' });
    showToast('🗑️ Busca excluída', 'warn');
    loadHistory();
    loadStats();
  } catch {
    showToast('Erro ao excluir', 'error');
  }
}

// ══════════════════════════════════════
//  MODAL
// ══════════════════════════════════════
function openModal(lead) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  let scoreClass = 'low';
  if (lead.score >= 60) scoreClass = 'high';
  else if (lead.score >= 30) scoreClass = 'medium';

  const reasonsHtml = (lead.score_reasons || [])
    .map(r => `<div class="score-reason">${escHtml(r)}</div>`)
    .join('') || '<div class="score-reason">Perfil bem preenchido</div>';

  const websiteLower = (lead.website || '').toLowerCase();
  const isInsta = websiteLower.includes('instagram.com') || websiteLower.includes('instagr.am');
  const isFb = websiteLower.includes('facebook.com') || websiteLower.includes('fb.com') || websiteLower.includes('fb.me');
  const globeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
  const instaIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
  const fbIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`;
  const siteIcon = isInsta ? instaIcon : (isFb ? fbIcon : globeIcon);

  content.innerHTML = `
    <div class="modal-company">${escHtml(lead.name)}</div>
    <div class="modal-address">📍 ${escHtml(lead.address)}</div>

    <div class="modal-section">
      <div class="modal-section-title">Contato</div>
      ${lead.phone ? `
        <div class="modal-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <a href="tel:${lead.phone}">${escHtml(lead.phone)}</a>
        </div>` : '<div class="modal-detail" style="color:var(--text-muted)"><span>📵 Sem telefone cadastrado</span></div>'}
      ${lead.website ? `
        <div class="modal-detail">
          ${siteIcon}
          <a href="${lead.website}" target="_blank">${escHtml(lead.website)}</a>
        </div>` : '<div class="modal-detail" style="color:var(--text-muted)"><span>🌐 Sem site cadastrado</span></div>'}
      ${lead.rating > 0 ? `
        <div class="modal-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>${lead.rating.toFixed(1)} ★ — ${lead.user_ratings.toLocaleString('pt-BR')} avaliações</span>
        </div>` : ''}
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Score de Oportunidade</div>
      <div class="score-card">
        <div class="score-big">${lead.score}</div>
        <div class="score-info">
          <div class="score-label">Por que este lead é uma oportunidade?</div>
          ${reasonsHtml}
        </div>
      </div>
    </div>

    ${lead.maps_url ? `
    <div class="modal-section">
      <a class="modal-btn-maps" href="${lead.maps_url}" target="_blank">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Abrir no Google Maps
      </a>
    </div>` : ''}

    ${lead.phone ? `
    <div class="modal-section" style="margin-bottom:0">
      <a class="modal-btn-maps" href="https://wa.me/${sanitizePhone(lead.phone)}" target="_blank" style="background:rgba(0,229,160,0.1);border-color:rgba(0,229,160,0.25);color:var(--accent-3)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Enviar WhatsApp
      </a>
    </div>` : ''}
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeSettings();
    closeManual();
  }
});

// ══════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════
function setLoadingState(loading) {
  const btn  = document.getElementById('btn-search');
  const txt  = document.getElementById('btn-search-text');
  const load = document.getElementById('loading-state');
  btn.disabled = loading;
  txt.textContent = loading ? 'Buscando...' : 'Buscar Leads';
  load.style.display = loading ? 'block' : 'none';
}

function hideResults() {
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
}

function setAuthLoading(form, loading) {
  const spinner = document.getElementById(`${form}-spinner`);
  const btnText = document.getElementById(`btn-${form}-text`);
  spinner.style.display = loading ? 'block' : 'none';
  btnText.style.display = loading ? 'none' : '';
  document.getElementById(`btn-${form}`).disabled = loading;
}

let toastTimer;
function showToast(msg, type = '', duration = 3500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.style.opacity = isText ? '0.5' : '1';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortUrl(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

function sanitizePhone(phone) {
  return phone.replace(/\D/g, '');
}

