// Error boundary para capturar problemas de inicialização
window.addEventListener('error', function(event) {
    const errorEl = document.getElementById('login-error');
    if(errorEl) errorEl.textContent = 'Erro Fatal JS: ' + event.message;
});

// Supabase Client Initialization
const supabaseUrl = 'https://rjrfltyygudfzbbyhlgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqcmZsdHl5Z3VkZnpiYnlobGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTQ4MTIsImV4cCI6MjEwNTUzMDgxMn0.ZtxYrvdlKU6MrpmH50uyn4TUSxEgPmppWOVDXJD2RPg';

let db; // Usando 'db' ao invés de 'supabase' para evitar conflito de nome com o script global
try {
    db = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (err) {
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('login-error').textContent = 'Erro ao carregar o Supabase local. Arquivo não encontrado.';
    });
}

// DOM Elements
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

const searchForm = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const cityInput = document.getElementById('city');
const maxLeadsInput = document.getElementById('max-leads');
const searchBtn = document.getElementById('search-btn');
const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const resultsCount = document.getElementById('results-count');
const leadsBody = document.getElementById('leads-body');
const exportBtn = document.getElementById('export-btn');

// New UI Elements
const navSearch = document.getElementById('nav-search');
const navHistory = document.getElementById('nav-history');
const viewSearch = document.getElementById('view-search');
const viewHistory = document.getElementById('view-history');
const historyBody = document.getElementById('history-body');
const totalLeadsStat = document.getElementById('total-leads-stat');
const totalSearchesStat = document.getElementById('total-searches-stat');
const currentQueryText = document.getElementById('current-query-text');
const suggPills = document.querySelectorAll('.sugg-pill');
const filterPills = document.querySelectorAll('.filter-pill');
const sortBtns = document.querySelectorAll('.sort-btn');

let currentUser = null;
let currentLeads = [];
let originalLeads = []; // Mantém a lista original para os filtros
let currentFilter = 'all';
let currentSort = 'score';

// Toggle Password Visibility
if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            togglePasswordBtn.textContent = 'Ocultar';
        } else {
            passwordInput.type = 'password';
            togglePasswordBtn.textContent = 'Mostrar';
        }
    });
}

// Navigation Logic
navSearch.addEventListener('click', (e) => {
    e.preventDefault();
    navSearch.classList.add('active');
    navHistory.classList.remove('active');
    viewSearch.classList.remove('hidden');
    viewHistory.classList.add('hidden');
});

navHistory.addEventListener('click', (e) => {
    e.preventDefault();
    navHistory.classList.add('active');
    navSearch.classList.remove('active');
    viewHistory.classList.remove('hidden');
    viewSearch.classList.add('hidden');
    loadHistory();
});

// Suggestion Pills Logic
suggPills.forEach(pill => {
    pill.addEventListener('click', () => {
        queryInput.value = pill.textContent;
    });
});

// Check session on load
async function checkSession() {
    try {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            currentUser = session.user;
            await window.api.saveSession({
                user_id: currentUser.id,
                email: currentUser.email,
                supabaseUrl: supabaseUrl,
                supabaseKey: supabaseKey,
                access_token: session.access_token,
                refresh_token: session.refresh_token
            });
            showApp();
        }
    } catch (err) {
        console.error("Erro na verificação de sessão:", err);
    }
}
checkSession();

// Auth Logic
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    loginError.textContent = 'Autenticando...';
    loginError.style.color = '#ccc';
    loginBtn.disabled = true;
    
    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        
        if (error) {
            loginError.style.color = '#ef4444';
            if (error.message.includes('Invalid login credentials')) {
                loginError.textContent = 'E-mail ou senha incorretos.';
            } else {
                loginError.textContent = 'Erro ao fazer login: ' + error.message;
            }
        } else if (data && data.user) {
            loginError.textContent = '';
            currentUser = data.user;
            await window.api.saveSession({
                user_id: currentUser.id,
                email: currentUser.email,
                supabaseUrl: supabaseUrl,
                supabaseKey: supabaseKey,
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            });
            showApp();
        } else {
            loginError.style.color = '#ef4444';
            loginError.textContent = 'Erro desconhecido. Não foi possível conectar ao servidor.';
        }
    } catch (err) {
        loginError.style.color = '#ef4444';
        loginError.textContent = 'Erro de rede ou configuração de banco. Verifique sua conexão.';
        console.error(err);
    } finally {
        loginBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', async () => {
    await db.auth.signOut();
    currentUser = null;
    hideApp();
});

function showApp() {
    loginContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    userEmailSpan.textContent = currentUser.email;
    loadStats(); // Load initial stats on login
}

function hideApp() {
    loginContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    emailInput.value = '';
    passwordInput.value = '';
}

// Load Global Stats
async function loadStats() {
    if(!currentUser) return;
    try {
        const { data, error } = await db.from('scraped_searches').select('total_leads').eq('user_id', currentUser.id);
        if(!error && data) {
            totalSearchesStat.textContent = data.length;
            const leadsSum = data.reduce((acc, curr) => acc + (curr.total_leads || 0), 0);
            totalLeadsStat.textContent = leadsSum;
        }
    } catch(e) {
        console.error('Erro ao carregar stats', e);
    }
}

// History Logic
async function loadHistory() {
    historyBody.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Carregando histórico...</div>';
    try {
        const { data, error } = await db.from('scraped_searches')
            .select('*, scraped_leads(count)')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (data.length === 0) {
            historyBody.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Nenhuma busca encontrada.</div>';
            return;
        }

        historyBody.innerHTML = '';
        data.forEach(item => {
            const dateStr = new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
            const leadsCount = (item.scraped_leads && item.scraped_leads[0]) ? item.scraped_leads[0].count : (item.total_leads || 0);
            
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-info">
                    <span class="hist-query">${item.query}</span>
                    <div class="history-meta">
                        <span class="meta-item">📍 ${item.city}</span>
                        <span class="meta-item">⏱ ${dateStr}</span>
                    </div>
                </div>
                <div class="history-actions">
                    <span class="hist-leads-pill">${leadsCount} leads</span>
                    <button class="hist-delete-btn" title="Excluir (Em breve)" onclick="alert('Excluir histórico em breve')">🗑️</button>
                </div>
            `;
            
            card.addEventListener('click', (e) => {
                if(e.target.closest('.hist-delete-btn')) return; // Ignore click on delete
                loadPastSearch(item);
            });
            
            historyBody.appendChild(card);
        });
    } catch(err) {
        historyBody.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--danger);">Erro ao carregar histórico.</div>';
        console.error(err);
    }
}

async function loadPastSearch(searchItem) {
    // 1. Switch back to search view
    navSearch.classList.add('active');
    navHistory.classList.remove('active');
    viewSearch.classList.remove('hidden');
    viewHistory.classList.add('hidden');
    
    // 2. Fetch leads from Supabase
    resultsCount.textContent = '...';
    leadsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px;">Carregando leads salvos na nuvem...</td></tr>';
    currentQueryText.textContent = `"${searchItem.query}" em ${searchItem.city}`;
    exportBtn.disabled = true;
    
    try {
        const { data, error } = await db.from('scraped_leads')
            .select('*')
            .eq('search_id', searchItem.id);
            
        if (error) throw error;
        
        originalLeads = data;
        
        // Reset filters and sorts to default
        currentFilter = 'all';
        currentSort = 'score';
        filterPills.forEach(p => p.classList.remove('active'));
        if(filterPills.length > 0) filterPills[0].classList.add('active');
        sortBtns.forEach(p => p.classList.remove('active'));
        if(sortBtns.length > 0) sortBtns[0].classList.add('active');
        
        renderLeads();
        exportBtn.disabled = false;
        
    } catch (e) {
        console.error(e);
        leadsBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--danger); padding: 40px;">Erro ao carregar leads do histórico:<br>${e.message || JSON.stringify(e)}</td></tr>`;
    }
}

// escHtml, shortUrl, sanitizePhone helpers
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

// Render Leads Function
function renderLeads() {
    let filtered = [...originalLeads];

    // Aplica o filtro
    if (currentFilter === 'no-site' || currentFilter === 'nosite') {
        filtered = filtered.filter(l => {
            const t = (l.site_classification || {}).type || (l.website ? 'professional' : 'none');
            return t === 'none';
        });
    } else if (currentFilter === 'social') {
        filtered = filtered.filter(l => {
            const t = (l.site_classification || {}).type;
            return t === 'social' || (l.website && /instagram\.com|facebook\.com|linktr\.ee|wa\.me/i.test(l.website));
        });
    } else if (currentFilter === 'freebuilder') {
        filtered = filtered.filter(l => {
            const t = (l.site_classification || {}).type;
            return t === 'free_builder';
        });
    } else if (currentFilter === 'directory') {
        filtered = filtered.filter(l => {
            const t = (l.site_classification || {}).type;
            return t === 'directory';
        });
    } else if (currentFilter === 'siteoffline') {
        filtered = filtered.filter(l => Boolean(l.site_offline));
    } else if (currentFilter === 'no-phone' || currentFilter === 'nophone') {
        filtered = filtered.filter(l => !l.phone || l.phone.trim() === '');
    } else if (currentFilter === 'low-rating' || currentFilter === 'lowscore') {
        filtered = filtered.filter(l => l.rating && l.rating > 0 && l.rating < 4.0);
    } else if (currentFilter === 'no-reviews' || currentFilter === 'noreviews') {
        filtered = filtered.filter(l => l.user_ratings === 0);
    } else if (currentFilter === 'low-score' || currentFilter === 'highopportunity') {
        filtered = filtered.filter(l => (l.score || 0) >= 40);
    }

    // Aplica a ordenação
    if(currentSort === 'score') {
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (currentSort === 'rating') {
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (currentSort === 'reviews') {
        filtered.sort((a, b) => (b.user_ratings || 0) - (a.user_ratings || 0));
    } else if (currentSort === 'name') {
        filtered.sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB);
        });
    }

    currentLeads = filtered;
    leadsBody.innerHTML = '';
    resultsCount.textContent = currentLeads.length;

    if (currentLeads.length === 0) {
        leadsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">Nenhum lead encontrado com este filtro.</td></tr>';
        return;
    }

    currentLeads.forEach(lead => {
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
        const hasPhone = Boolean(lead.phone && lead.phone.trim() !== '');

        // site_classification vem do main.js; fallback para versão legada
        const siteClass = lead.site_classification || {};
        const siteType = siteClass.type || (lead.website ? 'professional' : 'none');
        const siteProvider = siteClass.provider || '';
        const hasWebsite = siteType !== 'none';

        let siteChip = '<span class="chip chip-red">✗ Sem Site</span>';
        if (lead.site_offline) {
            siteChip = `<span class="chip chip-red" style="background:rgba(239,68,68,0.2)">💀 Site Offline</span>`;
        } else if (siteType === 'social') {
           if (isInsta) {
             siteChip = '<span class="chip" style="color:#e1306c; border-color:rgba(225,48,108,0.3); background:rgba(225,48,108,0.1)">📸 Instagram</span>';
           } else if (isFb) {
             siteChip = '<span class="chip" style="color:#1877f2; border-color:rgba(24,119,242,0.3); background:rgba(24,119,242,0.1)">📘 Facebook</span>';
           } else {
             siteChip = `<span class="chip" style="color:#10b981; border-color:rgba(16,185,129,0.3); background:rgba(16,185,129,0.1)">🔗 ${escHtml(siteProvider || 'Social')}</span>`;
           }
        } else if (siteType === 'free_builder') {
            siteChip = `<span class="chip" style="color:#f59e0b; border-color:rgba(245,158,11,0.3); background:rgba(245,158,11,0.1)">🔨 ${escHtml(siteProvider || 'Construtor')}</span>`;
        } else if (siteType === 'directory') {
            siteChip = `<span class="chip" style="color:#a78bfa; border-color:rgba(167,139,250,0.3); background:rgba(167,139,250,0.1)">📋 ${escHtml(siteProvider || 'Diretório')}</span>`;
        } else if (hasWebsite) {
            siteChip = '<span class="chip chip-green">✓ Site</span>';
        }
        
        let triageChip = (lead.score === 0 || !lead.phone) ? '<span class="chip" style="color:#f59e0b; border-color:rgba(245,158,11,0.3); background:rgba(245,158,11,0.1)">⚠️ Triagem</span>' : '';
        let whatsappBadge = lead.whatsapp ? '<span class="chip chip-green" title="WhatsApp verificado">📱 WhatsApp</span>' : '';

        const globeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
        const instaIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
        const fbIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`;
        const siteIcon = isInsta ? instaIcon : (isFb ? fbIcon : globeIcon);

        row.innerHTML = `
          <td>
            <div class="lead-name">${escHtml(lead.name)} ${triageChip}</div>
            <div class="lead-address">${escHtml(lead.address)}</div>
            <div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">
              ${siteChip}
              ${hasPhone ? '<span class="chip chip-green">✓ Tel</span>'  : '<span class="chip chip-red">✗ Sem Tel</span>'}
              ${whatsappBadge}
            </div>
          </td>
          <td>
            ${lead.phone
              ? `<div class="contact-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="tel:${sanitizePhone(lead.phone)}" onclick="event.stopPropagation()">${escHtml(lead.phone)}</a></div>`
              : '<div class="no-data">Sem telefone</div>'}
            ${lead.website
              ? `<div class="contact-item">${siteIcon}<a href="${lead.website}" target="_blank" onclick="event.stopPropagation()">${shortUrl(lead.website)}</a></div>`
              : '<div class="no-data" style="margin-top:3px">Sem site</div>'}
          </td>
          <td>
            <div class="rating-wrap">
              ${lead.rating > 0
                ? `<div class="stars"><span class="stars-val">${lead.rating.toFixed(1)}</span>${stars}</div><div class="reviews-count">${(lead.user_ratings || 0).toLocaleString('pt-BR')} avaliações</div>`
                : '<div class="no-data">Sem avaliações</div>'}
            </div>
          </td>
          <td>
            <div style="text-align:center">
              <div class="score-badge ${scoreClass}">${lead.score || 0}</div>
            </div>
          </td>
          <td>
            <div class="actions-cell" onclick="event.stopPropagation()">
              ${(lead.url || lead.maps_url)
                ? `<a class="action-btn" href="${lead.url || lead.maps_url}" target="_blank" title="Abrir no Google Maps">
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
        leadsBody.appendChild(row);
    });
}

// Algoritmo Especialista de Score (Sincronizado com backend)
function calculateScore(lead) {
    let score = 0;
    const reasons = [];

    const hasWebsite = Boolean(lead.website && lead.website.trim() !== '');
    const hasPhone = Boolean(lead.phone && lead.phone.trim() !== '');
    const rating = lead.rating || 0;
    const userRatings = lead.user_ratings || 0;
    const websiteLower = (lead.website || '').toLowerCase();

    const isSocialOrLinktree = websiteLower.includes('instagram.com') || 
                               websiteLower.includes('instagr.am') || 
                               websiteLower.includes('facebook.com') || 
                               websiteLower.includes('fb.com') || 
                               websiteLower.includes('fb.me') || 
                               websiteLower.includes('linktr.ee') || 
                               websiteLower.includes('wa.me') ||
                               websiteLower.includes('whatsapp.com');

    // 1. Oportunidade de Site
    if (isSocialOrLinktree) {
        score += 50;
        reasons.push("Usa rede social ou Linktree como site (Altíssima probabilidade de fechamento para landing page profissional)");
    } else if (lead.site_offline) {
        score += 55;
        reasons.push("Site atual está offline ou quebrado (Dor imediata e urgente: necessita de novo site)");
    } else if (!hasWebsite) {
        if (hasPhone || userRatings > 0) {
            score += 40;
            reasons.push("Sem website cadastrado (Excelente oportunidade para desenvolvimento de site comercial)");
        } else {
            score += 5;
            reasons.push("Perfil incompleto sem site e sem telefone");
        }
    }

    // 2. Reputação e Avaliações
    if (rating > 0 && rating < 4.0) {
        score += 20;
        reasons.push(`Nota baixa (${rating}★) — oportunidade para gestão de reputação e novos clientes`);
    }

    if (userRatings > 0 && userRatings <= 15) {
        score += 15;
        reasons.push(`Poucos reviews (${userRatings}) — potencial de aceleração com posicionamento local e SEO`);
    } else if (userRatings > 15 && userRatings <= 50) {
        score += 10;
        reasons.push(`Volume moderado de reviews (${userRatings}) — negócio ativo em expansão comercial`);
    } else if (userRatings > 50 && rating >= 4.5) {
        score += 5;
        reasons.push(`Negócio consolidado (${userRatings} reviews) — oportunidade para automação e chatbot de WhatsApp`);
    }

    // 3. Canal de Contato
    const phoneClean = (lead.phone || '').replace(/\D/g, '');
    const isMobile = phoneClean.length >= 10 && !lead.phone.startsWith('0800');

    if (lead.whatsapp || isMobile) {
        score += 15;
        reasons.push("Possui WhatsApp/celular validado (Pronto para abordagem direta pelo bot)");
    } else if (hasPhone) {
        score += 5;
        reasons.push("Possui telefone fixo cadastrado");
    }

    // Regra para perfis vazios / inativos
    if (!hasWebsite && !hasPhone && userRatings === 0 && rating === 0) {
        score = 0;
        reasons.length = 0;
        reasons.push("Perfil vazio ou inativo — sem dados de contato, sem site e sem avaliações");
    }

    return {
        score: Math.min(score, 100),
        reasons: reasons
    };
}

// Pre-Search Filter Pills Logic
const preFilterNoSite = document.getElementById('filter-pre-no-site');
const preFilterNoPhone = document.getElementById('filter-pre-no-phone');
const preFilterRequirePhone = document.getElementById('filter-pre-require-phone');
const preFilterSocial = document.getElementById('filter-pre-social');
const preFilterFreeBuilder = document.getElementById('filter-pre-free-builder');   // NOVO
const preFilterDirectory = document.getElementById('filter-pre-directory');         // NOVO
const preFilterSiteOffline = document.getElementById('filter-pre-site-offline');   // NOVO

const labelNoSite = document.getElementById('label-pre-no-site');
const labelNoPhone = document.getElementById('label-pre-no-phone');
const labelRequirePhone = document.getElementById('label-pre-require-phone');
const labelSocial = document.getElementById('label-pre-social');
const labelFreeBuilder = document.getElementById('label-pre-free-builder');   // NOVO
const labelDirectory = document.getElementById('label-pre-directory');         // NOVO
const labelSiteOffline = document.getElementById('label-pre-site-offline');   // NOVO

const updateFilterPillUI = () => {
    if (labelNoSite) labelNoSite.classList.toggle('active', Boolean(preFilterNoSite?.checked));
    if (labelNoPhone) labelNoPhone.classList.toggle('active', Boolean(preFilterNoPhone?.checked));
    if (labelRequirePhone) labelRequirePhone.classList.toggle('active', Boolean(preFilterRequirePhone?.checked));
    if (labelSocial) labelSocial.classList.toggle('active', Boolean(preFilterSocial?.checked));
    if (labelFreeBuilder) labelFreeBuilder.classList.toggle('active', Boolean(preFilterFreeBuilder?.checked));
    if (labelDirectory) labelDirectory.classList.toggle('active', Boolean(preFilterDirectory?.checked));
    if (labelSiteOffline) labelSiteOffline.classList.toggle('active', Boolean(preFilterSiteOffline?.checked));
};

// Filtros mutuamente exclusivos: Sem Telefone vs Exigir Telefone
if (preFilterNoPhone && preFilterRequirePhone) {
    preFilterNoPhone.addEventListener('change', () => {
        if (preFilterNoPhone.checked) preFilterRequirePhone.checked = false;
        updateFilterPillUI();
    });
    preFilterRequirePhone.addEventListener('change', () => {
        if (preFilterRequirePhone.checked) preFilterNoPhone.checked = false;
        updateFilterPillUI();
    });
}

// Todos os outros filtros simplesmente atualizam o UI
[preFilterNoSite, preFilterSocial, preFilterFreeBuilder, preFilterDirectory, preFilterSiteOffline].forEach(el => {
    if (el) el.addEventListener('change', updateFilterPillUI);
});

// Search Logic
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput.value;
    const city = cityInput.value;
    const maxLeads = parseInt(maxLeadsInput.value) || 60;
    
    searchBtn.disabled = true;
    statusBar.classList.remove('hidden');
    statusText.textContent = 'Iniciando busca no Playwright...';
    leadsBody.innerHTML = '';
    currentLeads = [];
    resultsCount.textContent = '0';
    exportBtn.disabled = true;

    try {
        // Create search record in Supabase
        const { data: searchRecord, error: searchError } = await db
            .from('scraped_searches')
            .insert([{ 
                user_id: currentUser.id, 
                query: query, 
                city: city,
                source: 'desktop'
            }])
            .select()
            .single();

        if(searchError) console.error("Erro ao salvar busca:", searchError);

        // Deduplicação multi-nível (URLs, telefones e nomes já cadastrados)
        statusText.textContent = 'Verificando banco de dados para evitar duplicações...';
        const { data: existingRecords } = await db
            .from('scraped_leads')
            .select('maps_url, phone, name')
            .eq('user_id', currentUser.id);
            
        const existingUrls = existingRecords ? existingRecords.map(r => r.maps_url).filter(Boolean) : [];
        const existingPhones = existingRecords ? existingRecords.map(r => (r.phone || '').replace(/\D/g, '')).filter(Boolean) : [];
        const existingNames = existingRecords ? existingRecords.map(r => (r.name || '').trim()).filter(Boolean) : [];

        // Filtros configurados pelo usuário na hora da busca
        const searchFilters = {
            onlyNoSite: Boolean(preFilterNoSite?.checked),
            onlyNoPhone: Boolean(preFilterNoPhone?.checked),
            requirePhone: Boolean(preFilterRequirePhone?.checked),
            onlySocial: Boolean(preFilterSocial?.checked),
            onlyFreeBuilder: Boolean(preFilterFreeBuilder?.checked),   // NOVO: Netlify, Canva, Wix...
            onlyDirectory: Boolean(preFilterDirectory?.checked),       // NOVO: Doctoralia, Apontador...
            onlySiteOffline: Boolean(preFilterSiteOffline?.checked),   // NOVO: sites offline
        };

        // Chamada IPC para o Playwright (main.js)
        statusText.textContent = 'Iniciando extração inteligente no Google Maps...';
        let response = await window.api.searchLeads(query, city, maxLeads, {
            urls: existingUrls,
            phones: existingPhones,
            names: existingNames
        }, searchFilters);
        
        let results = [];
        if (Array.isArray(response)) {
             results = response;
        } else if (response && response.validLeads) {
             results = [...response.validLeads, ...response.triageLeads];
        }
        
        originalLeads = results;
        currentQueryText.textContent = `"${query}" em ${city}`;
        
        // Aplica filtros e re-renderiza
        renderLeads();

        exportBtn.disabled = false;
        searchBtn.disabled = false;
        statusBar.classList.add('hidden');
        
        // Atualiza stats globais
        loadStats();

        // Salva os leads com deduplicação local de lote no Supabase
        if (results.length > 0 && searchRecord && searchRecord.id) {
            const uniqueBatch = [];
            const seenBatchPhones = new Set();
            const seenBatchUrls = new Set();

            results.forEach(l => {
                const p = (l.phone || '').replace(/\D/g, '');
                const u = (l.url || '').split('?')[0];
                if (p && seenBatchPhones.has(p)) return;
                if (u && seenBatchUrls.has(u)) return;
                if (p) seenBatchPhones.add(p);
                if (u) seenBatchUrls.add(u);
                uniqueBatch.push(l);
            });

            const leadsToInsert = uniqueBatch.map(l => ({
                search_id: searchRecord.id,
                user_id: currentUser.id,
                place_id: (l.url || 'no-id').split('?')[0],
                name: l.name,
                address: l.address,
                phone: l.phone,
                website: l.website,
                rating: l.rating,
                user_ratings: l.user_ratings,
                maps_url: l.url,
                has_website: Boolean(l.website),
                has_phone: Boolean(l.phone),
                score: l.score,
                score_reasons: JSON.stringify(l.score_reasons),
                site_type: (l.site_classification || {}).type || null,
                site_provider: (l.site_classification || {}).provider || null,
                site_offline: Boolean(l.site_offline),
                is_triage: Boolean(l.is_triage),
            }));
            
            await db.from('scraped_leads').insert(leadsToInsert);
            
            await db.from('scraped_searches')
                .update({ total_leads: uniqueBatch.length })
                .eq('id', searchRecord.id);
        }

    } catch (error) {
        searchBtn.disabled = false;
        setTimeout(() => {
            if(statusText.textContent.includes('finalizada') || statusText.textContent.includes('Erro')) {
                statusBar.classList.add('hidden');
            }
        }, 5000);
    }
});

// Playwright Status Updates
window.api.onSearchStatus((status) => {
    statusText.textContent = status;
});

// CSV Export
exportBtn.addEventListener('click', () => {
    if(currentLeads.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,Nome,Score,Telefone,Site,Avaliacao,Reviews,Endereco,MapsLink\n";
    currentLeads.forEach(row => {
        csvContent += `"${row.name || ''}","${row.score || 0}","${row.phone || ''}","${row.website || ''}","${row.rating || 0}","${row.user_ratings || 0}","${row.address || ''}","${row.url || ''}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "leads_desktop_score.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
});

// Modal Funcionality
function openModal(lead) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  let scoreClass = 'low';
  if (lead.score >= 60) scoreClass = 'high';
  else if (lead.score >= 30) scoreClass = 'medium';

  let reasonsHtml = '';
  try {
      const reasons = typeof lead.score_reasons === 'string' ? JSON.parse(lead.score_reasons) : (lead.score_reasons || []);
      reasonsHtml = reasons.map(r => `<div class="score-reason">${escHtml(r)}</div>`).join('') || '<div class="score-reason">Perfil bem preenchido</div>';
  } catch (e) {
      reasonsHtml = '<div class="score-reason">Perfil analisado</div>';
  }

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
          <a href="tel:${sanitizePhone(lead.phone)}">${escHtml(lead.phone)}</a>
        </div>` : '<div class="modal-detail" style="color:var(--text-muted)"><span>📵 Sem telefone cadastrado</span></div>'}
      ${lead.website ? `
        <div class="modal-detail">
          ${siteIcon}
          <a href="${lead.website}" target="_blank">${escHtml(lead.website)}</a>
        </div>` : '<div class="modal-detail" style="color:var(--text-muted)"><span>🌐 Sem site cadastrado</span></div>'}
      ${lead.rating > 0 ? `
        <div class="modal-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>${lead.rating.toFixed(1)} ★ — ${(lead.user_ratings || 0).toLocaleString('pt-BR')} avaliações</span>
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

    ${(lead.url || lead.maps_url) ? `
    <div class="modal-section">
      <a class="modal-btn-maps" href="${lead.url || lead.maps_url}" target="_blank">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Abrir no Google Maps
      </a>
    </div>` : ''}

    ${lead.phone ? `
    <div class="modal-section" style="margin-bottom:0">
      <a class="modal-btn-maps" href="https://wa.me/${sanitizePhone(lead.phone)}" target="_blank" style="background:rgba(0,229,160,0.1);border-color:rgba(0,229,160,0.25);color:var(--accent-teal)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Enviar WhatsApp
      </a>
    </div>` : ''}
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    window.closeModal();
  }
});
