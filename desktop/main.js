const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');

// Evita erro de cache no Windows
app.setPath('userData', path.join(__dirname, '.electron-data'));
// Desativa aceleração de hardware que às vezes causa erros de GPU Cache
app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'app.html'));
  
  // Abre o painel de desenvolvedor automaticamente para depuração
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Shared CRM Session Logic
ipcMain.handle('save-session', async (event, sessionData) => {
  try {
    const sessionPath = path.join(os.homedir(), '.crm-session.json');
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save CRM session:', error);
    return false;
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DETECTORES DE TIPO DE SITE
// ──────────────────────────────────────────────────────────────────────────────

// Sites de redes sociais / link agregadores (sem site próprio)
const SOCIAL_DOMAINS = [
  'instagram.com', 'instagr.am',
  'facebook.com', 'fb.com', 'fb.me',
  'wa.me', 'whatsapp.com',
  'linktr.ee', 'linktree.com',
  'beacons.ai', 'msha.ke', 'bio.site',
  'taplink.cc', 'lnk.bio',
  'twitter.com', 'x.com',
  'tiktok.com', 'youtube.com',
];

// Construtores de site gratuitos / subdominios não-exclusivos
// Indica que o negócio não tem site profissional próprio → oportunidade de venda
const FREE_BUILDER_DOMAINS = [
  // Construtores Drag & Drop
  { domain: 'netlify.app',       name: 'Netlify' },
  { domain: 'netlify.com',       name: 'Netlify' },
  { domain: 'canva.site',        name: 'Canva' },
  { domain: 'canva.link',        name: 'Canva' },
  { domain: 'my.canva.site',     name: 'Canva' },
  { domain: 'wix.com',          name: 'Wix' },
  { domain: 'wixsite.com',      name: 'Wix' },
  { domain: 'weebly.com',       name: 'Weebly' },
  { domain: 'webnode.com.br',   name: 'Webnode' },
  { domain: 'webnode.com',      name: 'Webnode' },
  { domain: 'jimdo.com',        name: 'Jimdo' },
  { domain: 'squarespace.com',  name: 'Squarespace' },
  { domain: 'godaddysites.com', name: 'GoDaddy Sites' },
  { domain: 'site123.com',      name: 'Site123' },
  { domain: 'zyrosite.com',     name: 'Zyro' },
  // Blogs / CMS grátis
  { domain: 'blogspot.com',     name: 'Blogspot' },
  { domain: 'wordpress.com',    name: 'WordPress.com' },
  { domain: 'tumblr.com',       name: 'Tumblr' },
  // Dev / Hosting gratuito
  { domain: 'sites.google.com', name: 'Google Sites' },
  { domain: 'notion.site',      name: 'Notion' },
  { domain: 'vercel.app',       name: 'Vercel' },
  { domain: 'github.io',        name: 'GitHub Pages' },
  { domain: 'netlify.com',      name: 'Netlify' },
  { domain: '000webhostapp.com',name: '000webhost' },
  { domain: 'infinityfreeapp.com', name: 'InfinityFree' },
  // Lojas / E-commerce simples
  { domain: 'loja.vc',          name: 'Loja.vc' },
  { domain: 'lojaintegrada.com.br', name: 'Loja Integrada' },
  { domain: 'nuvemshop.com.br', name: 'Nuvemshop' },
  { domain: 'bagy.com.br',      name: 'Bagy' },
];

// Diretórios e marketplaces (a empresa está listada, mas não tem site próprio)
// Indica que o negócio depende de plataformas de terceiros
const DIRECTORY_DOMAINS = [
  // Saúde
  { domain: 'doctoralia.com.br',  name: 'Doctoralia' },
  { domain: 'doctoralia.com',     name: 'Doctoralia' },
  { domain: 'boaconsulta.com',    name: 'Boa Consulta' },
  { domain: 'clinicorp.com',      name: 'Clinicorp' },
  { domain: 'saude.gov.br',       name: 'Saúde Gov' },
  // Guias e listas
  { domain: 'telelistas.net',     name: 'Telelistas' },
  { domain: 'apontador.com.br',   name: 'Apontador' },
  { domain: 'yellowpages.com.br', name: 'Yellow Pages' },
  { domain: 'guiamais.com.br',    name: 'Guia Mais' },
  { domain: 'yelp.com.br',        name: 'Yelp' },
  { domain: 'yelp.com',           name: 'Yelp' },
  { domain: 'foursquare.com',     name: 'Foursquare' },
  { domain: 'tripadvisor.com.br', name: 'TripAdvisor' },
  { domain: 'tripadvisor.com',    name: 'TripAdvisor' },
  // Delivery / Marketplace
  { domain: 'ifood.com.br',       name: 'iFood' },
  { domain: 'delivery.com.br',    name: 'Delivery.com' },
  { domain: 'rappi.com.br',       name: 'Rappi' },
  { domain: 'ubereats.com',       name: 'Uber Eats' },
  { domain: 'loggi.com',          name: 'Loggi' },
  // Outros diretórios
  { domain: 'encontraki.com.br',  name: 'Encontraki' },
  { domain: 'jusbrasil.com.br',   name: 'JusBrasil' },
  { domain: 'advfn.com.br',       name: 'ADVFN' },
];

/**
 * Analisa uma URL e retorna o tipo de site e o nome do provedor.
 * @param {string} url
 * @returns {{ type: 'none'|'social'|'free_builder'|'directory'|'professional', provider: string }}
 */
function classifySite(url) {
  if (!url || url.trim() === '') {
    return { type: 'none', provider: '' };
  }

  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    hostname = url.toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];
  }

  // 1. Verifica redes sociais
  for (const social of SOCIAL_DOMAINS) {
    if (hostname === social || hostname.endsWith('.' + social)) {
      return { type: 'social', provider: social };
    }
  }

  // 2. Verifica construtores gratuitos
  for (const builder of FREE_BUILDER_DOMAINS) {
    if (hostname === builder.domain || hostname.endsWith('.' + builder.domain)) {
      return { type: 'free_builder', provider: builder.name };
    }
  }

  // 3. Verifica diretórios
  for (const dir of DIRECTORY_DOMAINS) {
    if (hostname === dir.domain || hostname.endsWith('.' + dir.domain)) {
      return { type: 'directory', provider: dir.name };
    }
  }

  // 4. Site profissional próprio
  return { type: 'professional', provider: '' };
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

const normalizeText = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
const cleanPhoneDigits = (str) => (str || '').replace(/\D/g, '');
const cleanCanonicalUrl = (url) => {
  if (!url) return '';
  return url.split('?')[0].replace(/\/+$/, '');
};

// ──────────────────────────────────────────────────────────────────────────────
// ALGORITMO ESPECIALISTA DE SCORE (0 a 100)
// ──────────────────────────────────────────────────────────────────────────────

const calculateScoreExpert = (lead) => {
  let score = 0;
  const reasons = [];

  const siteClassification = lead.site_classification || { type: 'none', provider: '' };
  const hasPhone = Boolean(lead.phone && lead.phone.trim() !== '');
  const rating = lead.rating || 0;
  const userRatings = lead.user_ratings || 0;

  // 1. OPORTUNIDADE DE SITE (0 a 55 pontos)
  switch (siteClassification.type) {
    case 'none':
      if (hasPhone || userRatings > 0) {
        score += 40;
        reasons.push("Sem website cadastrado (Excelente oportunidade para desenvolvimento de site comercial)");
      } else {
        score += 5;
        reasons.push("Perfil incompleto sem site e sem telefone");
      }
      break;
    case 'social':
      score += 50;
      reasons.push(`Usa rede social como site (${siteClassification.provider}) — Altíssima probabilidade de fechamento para landing page profissional`);
      break;
    case 'free_builder':
      score += 45;
      reasons.push(`Site em construtor gratuito (${siteClassification.provider}) — Oportunidade imediata: precisa de site profissional próprio`);
      break;
    case 'directory':
      score += 35;
      reasons.push(`Listado em diretório (${siteClassification.provider}) — Sem site próprio, depende de plataforma de terceiros`);
      break;
    case 'professional':
      if (lead.site_offline) {
        score += 55;
        reasons.push("Site atual está offline ou quebrado (Dor imediata: necessita de novo site)");
      }
      break;
  }

  // 2. REPUTAÇÃO E AVALIAÇÕES NO GOOGLE (0 a 25 pontos)
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

  // 3. CANAL DIRETO E CONTACTABILIDADE (0 a 20 pontos)
  const phoneClean = cleanPhoneDigits(lead.phone);
  const isMobile = phoneClean.length >= 10 && !lead.phone.startsWith('0800');
  
  if (lead.whatsapp || isMobile) {
    score += 15;
    reasons.push("Possui WhatsApp/celular validado (Pronto para abordagem direta pelo bot)");
  } else if (hasPhone) {
    score += 5;
    reasons.push("Possui telefone fixo cadastrado");
  }

  // 4. REGRA DE SEGURANÇA PARA LEADS FANTASMAS / VAZIOS
  if (siteClassification.type === 'none' && !hasPhone && userRatings === 0 && rating === 0) {
    score = 0;
    reasons.length = 0;
    reasons.push("Perfil vazio ou inativo — sem dados de contato, sem site e sem avaliações");
  }

  return {
    score: Math.min(score, 100),
    reasons: reasons
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// SCRAPING LOGIC — PLAYWRIGHT
// ──────────────────────────────────────────────────────────────────────────────

ipcMain.handle('search-leads', async (event, query, city, limit = 60, existingData = [], searchFilters = {}) => {
  let browser;

  const {
    onlyNoSite = false,
    onlyNoPhone = false,
    requirePhone = false,
    onlySocial = false,
    onlyFreeBuilder = false,   // NOVO: apenas construtores gratuitos
    onlyDirectory = false,     // NOVO: apenas diretórios (ex: Doctoralia)
    onlySiteOffline = false,   // NOVO: apenas sites offline
  } = (searchFilters || {});

  // Processa dados existentes para deduplicação
  let knownUrls = new Set();
  let knownPhones = new Set();
  let knownNames = new Set();

  if (Array.isArray(existingData)) {
    existingData.forEach(u => knownUrls.add(cleanCanonicalUrl(u)));
  } else if (existingData && typeof existingData === 'object') {
    (existingData.urls || []).forEach(u => knownUrls.add(cleanCanonicalUrl(u)));
    (existingData.phones || []).forEach(p => knownPhones.add(cleanPhoneDigits(p)));
    (existingData.names || []).forEach(n => knownNames.add(normalizeText(n)));
  }

  const seenSessionUrls = new Set();
  const seenSessionNames = new Set();
  const seenSessionPhones = new Set();

  // CORREÇÃO PRINCIPAL: todos os leads coletados, sem separação que causava o bug do limite
  const allLeads = [];
  // Lista de triagem separada apenas para informação, mas TODOS contam no limite
  const triageLeads = [];

  const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

  try {
    browser = await chromium.launch({ headless: false });
    
    // Aba 1: Mantém o feed de pesquisa aberto permanentemente
    const searchPage = await browser.newPage();
    // Aba 2: Trabalhadora para inspecionar fichas individuais sem perder o feed
    const detailPage = await browser.newPage();

    event.sender.send('search-status', 'Abrindo Google Maps...');
    await searchPage.goto(`https://www.google.com/maps/search/${encodeURIComponent(query + ' em ' + city)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    event.sender.send('search-status', `Buscando até atingir ${limit} leads...`);
    await searchPage.waitForSelector('div[role="feed"]', { timeout: 20000 });

    let scrollAttempts = 0;
    const maxScrollRounds = 80; // Aumentado de 40 para 80 para cobertura completa da área
    let endOfFeedDetected = false;

    // CORREÇÃO: Loop baseado no TOTAL de leads coletados (não só os "válidos")
    while (allLeads.length < limit && scrollAttempts < maxScrollRounds && !endOfFeedDetected) {
      scrollAttempts++;

      // Detecta fim do feed
      const feedEnded = await searchPage.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (!feed) return false;
        const text = feed.innerText || '';
        return /fim dos resultados|você chegou ao fim|end of results|no more results/i.test(text);
      });

      if (feedEnded) {
        event.sender.send('search-status', `(${allLeads.length}/${limit}) Fim dos resultados do Google Maps detectado. Encerrando busca.`);
        endOfFeedDetected = true;
        break;
      }

      // Extrai candidatos limpos diretamente do feed na searchPage
      const candidates = await searchPage.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (!feed) return [];

        const rawCards = Array.from(feed.querySelectorAll('div[jsaction]'));
        const list = [];
        const seenFeed = new Set();

        for (const card of rawCards) {
          const a = card.querySelector('a[href*="/maps/place/"]');
          if (!a) continue;

          const rawUrl = a.href;
          const cleanUrl = rawUrl.split('?')[0];
          if (seenFeed.has(cleanUrl)) continue;

          const cardText = card.innerText || '';

          // Filtro Estrito Anti-Anúncios e Sitelinks
          const isAd = rawUrl.includes('/aclk?') || 
                       rawUrl.includes('googleadservices') ||
                       /\b(anúncio|patrocinado|sponsored)\b/i.test(cardText) ||
                       cardText.startsWith('Anúncio') ||
                       cardText.startsWith('Patrocinado');
          if (isAd) continue;

          // Ignora empresas permanentemente fechadas
          if (/fechado permanentemente|permanently closed/i.test(cardText)) continue;

          // Extrai o nome exclusivamente do cabeçalho da empresa
          const headlineEl = card.querySelector('.fontHeadlineSmall') || 
                             card.querySelector('div[role="heading"]') || 
                             card.querySelector('h3');
          let name = headlineEl ? headlineEl.innerText.trim() : (a.getAttribute('aria-label') || '').trim();

          // Descarte de botões de ação do anúncio
          if (!name || /^acessar o site/i.test(name) || /^anúncio/i.test(name) || /^patrocinado/i.test(name) || /^rotas para/i.test(name) || /^ligar para/i.test(name)) {
            continue;
          }

          seenFeed.add(cleanUrl);
          list.push({ name, url: rawUrl, cleanUrl });
        }
        return list;
      });

      // Filtra candidatos não processados ainda
      const newCandidates = candidates.filter(c => {
        const canUrl = cleanCanonicalUrl(c.url);
        const normName = normalizeText(c.name);
        if (seenSessionUrls.has(canUrl) || knownUrls.has(canUrl)) return false;
        if (seenSessionNames.has(normName) || knownNames.has(normName)) return false;
        return true;
      });

      // Se não encontrou novos neste frame, rola a página para carregar mais
      if (newCandidates.length === 0) {
        event.sender.send('search-status', `(${allLeads.length}/${limit}) Rolando feed para carregar mais empresas...`);
        await searchPage.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollBy(0, 10000);
        });
        await searchPage.waitForTimeout(2500);
        continue;
      }

      event.sender.send('search-status', `Encontrados ${newCandidates.length} novos estabelecimentos. Inspecionando...`);

      // Itera sobre os novos candidatos
      for (const item of newCandidates) {
        // CORREÇÃO: compara com total de leads coletados (não só validLeads)
        if (allLeads.length >= limit) break;

        const canUrl = cleanCanonicalUrl(item.url);
        const normName = normalizeText(item.name);
        seenSessionUrls.add(canUrl);
        seenSessionNames.add(normName);

        event.sender.send('search-status', `(${allLeads.length}/${limit}) Inspecionando: ${item.name}...`);

        let lead = {
          name: item.name,
          url: item.url,
          cleanUrl: canUrl,
          phone: '',
          whatsapp: '',
          website: '',
          address: '',
          rating: 0,
          user_ratings: 0,
          site_offline: false,
          site_classification: { type: 'none', provider: '' },
          score: 0,
          score_reasons: [],
          is_triage: false,
        };

        try {
          // Navega até a ficha do Google Maps
          await detailPage.goto(lead.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await detailPage.waitForSelector('h1.DUwDvf, div[role="main"], div.TIHn2', { timeout: 10000 }).catch(() => {});
          await detailPage.waitForTimeout(1500);

          const details = await detailPage.evaluate(() => {
            const h1 = document.querySelector('h1.DUwDvf') || document.querySelector('div[role="main"] h1') || document.querySelector('h1');
            const placeName = h1 && h1.innerText && !h1.innerText.includes('Resultados') ? h1.innerText.trim() : '';

            // Website com desempacotamento de redirecionador
            const siteA = document.querySelector('a[data-item-id="authority"]') ||
                          document.querySelector('a[aria-label*="site" i]') ||
                          document.querySelector('a[aria-label*="website" i]') ||
                          document.querySelector('a[data-tooltip*="site" i]') ||
                          document.querySelector('a[data-tooltip*="website" i]');
            let website = siteA ? siteA.href : '';
            if (website.includes('google.com/url?q=')) {
              try {
                const u = new URL(website);
                website = u.searchParams.get('q') || website;
              } catch(e) {}
            }

            // Telefone com limpeza
            const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]') ||
                             document.querySelector('[data-item-id="phone"]') ||
                             document.querySelector('button[data-tooltip*="telefone" i]') ||
                             document.querySelector('button[data-tooltip*="Copiar" i]') ||
                             document.querySelector('button[aria-label*="telefone" i]') ||
                             document.querySelector('button[aria-label*="Telefone" i]');
            let phone = phoneBtn ? (phoneBtn.innerText || phoneBtn.getAttribute('aria-label') || '') : '';
            phone = phone.replace(/Endereço de telefone:?\s*|\s*|Telefone:?\s*/gi, '').trim();

            // Endereço
            const addrBtn = document.querySelector('button[data-item-id="address"]') ||
                            document.querySelector('button[data-tooltip*="endereço" i]') ||
                            document.querySelector('button[aria-label*="endereço" i]');
            let address = addrBtn ? (addrBtn.innerText || addrBtn.getAttribute('aria-label') || '') : '';
            address = address.replace(/Endereço:?\s*|\s*/gi, '').trim();

            // Avaliações e Rating
            let rating = 0, user_ratings = 0;
            const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]') ||
                             document.querySelector('span.ceNzKf');
            if (ratingEl) {
              const m = (ratingEl.innerText || ratingEl.getAttribute('aria-label') || '').match(/([\d,.]+)/);
              if (m) rating = parseFloat(m[1].replace(',', '.'));
            }

            const reviewsEl = document.querySelector('div.F7nice span:last-child') ||
                              document.querySelector('span[aria-label*="avaliações" i]') ||
                              document.querySelector('span[aria-label*="comentários" i]');
            if (reviewsEl) {
              const rm = (reviewsEl.innerText || reviewsEl.getAttribute('aria-label') || '').match(/([\d,.]+)/);
              if (rm) user_ratings = parseInt(rm[1].replace(/[.,]/g, ''));
            }

            return { placeName, website, phone, address, rating, user_ratings };
          });

          if (details.placeName && !details.placeName.startsWith('Acessar o site')) {
            lead.name = details.placeName;
          }
          lead.website = details.website || '';
          lead.phone = details.phone || '';
          lead.address = details.address || '';
          lead.rating = details.rating || 0;
          lead.user_ratings = details.user_ratings || 0;

          // Classifica o tipo de site
          lead.site_classification = classifySite(lead.website);

          // ──────────────────────────────────────────────────────────
          // ANÁLISE DE SITE & MINERAÇÃO DE WHATSAPP DIRETO DO SITE
          // ──────────────────────────────────────────────────────────
          if (lead.website && lead.site_classification.type === 'professional') {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 7000);
              event.sender.send('search-status', `Analisando site de ${lead.name}...`);

              const resp = await fetch(lead.website, {
                signal: controller.signal,
                method: 'GET',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8'
                }
              });
              clearTimeout(timeoutId);

              if (resp.status === 404 || resp.status >= 500) {
                lead.site_offline = true;
              } else {
                // Site ativo! Busca WhatsApp no HTML se não tem celular
                const cleanCurrentPhone = cleanPhoneDigits(lead.phone);
                const needsMobile = !lead.phone || lead.phone.startsWith('0800') || cleanCurrentPhone.length < 10;

                if (needsMobile) {
                  const html = await resp.text();
                  
                  // Busca link wa.me ou api.whatsapp.com
                  const waMatch = html.match(/(?:https?:\/\/)?(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/|web\.whatsapp\.com\/send\?phone=)(\+?55\d{10,11}|\d{10,11})/i);
                  if (waMatch && waMatch[1]) {
                    lead.whatsapp = waMatch[1].replace(/\D/g, '');
                  }

                  // Se não achou link, busca celular brasileiro no HTML
                  if (!lead.whatsapp) {
                    const cellMatch = html.match(/(?:whatsapp|whats|contato|atendimento)[^<>{}\\n]{0,60}?(?:\+?55\s*)?(?:\(?([1-9][0-9])\)?\s*)(9\s*[0-9]{4}[-\s]?[0-9]{4})/i);
                    if (cellMatch) {
                      lead.whatsapp = cellMatch[0].replace(/\D/g, '');
                    }
                  }

                  if (lead.whatsapp && lead.whatsapp.length >= 10) {
                    lead.phone = lead.whatsapp;
                  }
                }
              }
            } catch (e) {
              const errStr = e.toString().toLowerCase();
              if (errStr.includes('enotfound') || errStr.includes('econnrefused')) {
                lead.site_offline = true;
              }
            }
          } else if (lead.site_classification.type === 'social') {
            // Extrai WhatsApp de links wa.me que vieram como site
            const websiteLower = lead.website.toLowerCase();
            if (websiteLower.includes('wa.me/') || websiteLower.includes('whatsapp.com')) {
              const waDigits = lead.website.replace(/\D/g, '');
              if (waDigits.length >= 10) {
                lead.whatsapp = waDigits;
                if (!lead.phone || lead.phone.startsWith('0800')) lead.phone = waDigits;
              }
            }
          }

          // ─── APLICAÇÃO DOS FILTROS DA BUSCA ───
          const siteType = lead.site_classification.type;
          const hasWebsite = siteType !== 'none';
          const isSocialOrLinktree = siteType === 'social';
          const isFreeBuilder = siteType === 'free_builder';
          const isDirectory = siteType === 'directory';
          const hasRealWebsite = siteType === 'professional' && !lead.site_offline;
          const hasPhone = Boolean(lead.phone && lead.phone.trim() !== '');

          // --- Filtros de exclusão ---
          let shouldSkip = false;
          let skipReason = '';

          // Filtro: Sem Site (apenas quem não tem site algum)
          if (onlyNoSite && !onlySocial && !onlyFreeBuilder && !onlyDirectory) {
            if (hasWebsite) {
              shouldSkip = true;
              skipReason = `possui site (${siteType})`;
            }
          }

          // Filtro: Rede Social / Linktree
          if (onlySocial && !onlyNoSite && !onlyFreeBuilder && !onlyDirectory) {
            if (!isSocialOrLinktree) {
              shouldSkip = true;
              skipReason = 'não usa rede social como site';
            }
          }

          // Filtro: Construtor Gratuito (Netlify, Canva, Wix...)
          if (onlyFreeBuilder && !onlyNoSite && !onlySocial && !onlyDirectory) {
            if (!isFreeBuilder) {
              shouldSkip = true;
              skipReason = `não usa construtor gratuito (tipo: ${siteType})`;
            }
          }

          // Filtro: Diretório (Doctoralia, Apontador...)
          if (onlyDirectory && !onlyNoSite && !onlySocial && !onlyFreeBuilder) {
            if (!isDirectory) {
              shouldSkip = true;
              skipReason = `não está em diretório (tipo: ${siteType})`;
            }
          }

          // Filtro: Site Offline
          if (onlySiteOffline) {
            if (!lead.site_offline) {
              shouldSkip = true;
              skipReason = 'site está online';
            }
          }

          // Combinação de múltiplos filtros: aceita qualquer um dos selecionados
          if ((onlyNoSite || onlySocial || onlyFreeBuilder || onlyDirectory) &&
              (onlyNoSite || onlySocial || onlyFreeBuilder || onlyDirectory)) {
            const multiFilter = (onlyNoSite || onlySocial || onlyFreeBuilder || onlyDirectory);
            if (multiFilter) {
              // Verifica se pelo menos UM dos filtros ativos passa
              const passNoSite = onlyNoSite && !hasWebsite;
              const passSocial = onlySocial && isSocialOrLinktree;
              const passFreeBuilder = onlyFreeBuilder && isFreeBuilder;
              const passDirectory = onlyDirectory && isDirectory;

              const anyPass = passNoSite || passSocial || passFreeBuilder || passDirectory;
              const allActive = [onlyNoSite, onlySocial, onlyFreeBuilder, onlyDirectory].filter(Boolean).length > 1;

              if (allActive) {
                // Com múltiplos filtros ativos, basta um passar
                if (!anyPass) {
                  shouldSkip = true;
                  skipReason = 'não se encaixa em nenhum dos filtros de site selecionados';
                } else {
                  shouldSkip = false; // Override: passou em pelo menos um
                }
              }
            }
          }

          // Filtro de Telefone
          if (!shouldSkip) {
            if (onlyNoPhone) {
              if (hasPhone) {
                shouldSkip = true;
                skipReason = 'possui telefone';
              }
            } else if (requirePhone) {
              if (!hasPhone) {
                shouldSkip = true;
                skipReason = 'sem telefone/WhatsApp';
              }
            }
          }

          if (shouldSkip) {
            event.sender.send('search-status', `(${allLeads.length}/${limit}) Ignorando "${lead.name}" (${skipReason})...`);
            continue;
          }

          // Checa duplicidade por telefone
          const phoneDigits = cleanPhoneDigits(lead.phone);
          if (phoneDigits) {
            if (seenSessionPhones.has(phoneDigits) || knownPhones.has(phoneDigits)) {
              continue;
            }
            seenSessionPhones.add(phoneDigits);
          }

          // Calcula Score Especialista
          const scored = calculateScoreExpert(lead);
          lead.score = scored.score;
          lead.score_reasons = scored.reasons;

          // CORREÇÃO: marca como triagem mas INCLUI no allLeads (conta para o limite!)
          if (!lead.phone || lead.score === 0) {
            lead.is_triage = true;
            triageLeads.push(lead);
          }

          // TODOS os leads vão para allLeads — isso corrige o bug de pegar poucos leads
          allLeads.push(lead);

          event.sender.send('search-status', `(${allLeads.length}/${limit}) ✓ ${lead.name} — Score: ${lead.score}`);

          // Jitter aleatório respeitoso
          if (allLeads.length < limit) {
            const waitTime = randomDelay(1200, 2500);
            await detailPage.waitForTimeout(waitTime);
          }

        } catch (itemErr) {
          console.error(`Erro ao inspecionar ${item.name}:`, itemErr.message);
        }
      }

      // Rola o feed na searchPage para carregar mais na próxima rodada se ainda faltar
      if (allLeads.length < limit) {
        event.sender.send('search-status', `(${allLeads.length}/${limit}) Rolando feed para mais resultados...`);
        await searchPage.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollBy(0, 10000);
        });
        await searchPage.waitForTimeout(2500);
      }
    }

    await browser.close();

    const validLeads = allLeads.filter(l => !l.is_triage);
    event.sender.send('search-status', `Busca finalizada! ${allLeads.length} leads coletados (${validLeads.length} válidos, ${triageLeads.length} em triagem).`);
    
    // Retorna no formato compatível com renderer.js (validLeads + triageLeads separados mas todos coletados)
    return { validLeads, triageLeads };

  } catch (error) {
    if (browser) await browser.close();
    console.error('Erro na busca de leads:', error);
    throw new Error(error.message);
  }
});
