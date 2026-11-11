/* ─────────────────────────────────────────
   Lead Hunter — Login App Logic
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

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
});

async function initSupabase() {
  try {
    const res  = await fetch(`${API}/api/config`);
    const conf = await res.json();

    if (!conf.supabase_url || !conf.supabase_anon_key) {
      showAuthError('login-error', 'Configuração do servidor incompleta. Contate o administrador.');
      return;
    }

    supabaseClient = window.supabase.createClient(conf.supabase_url, conf.supabase_anon_key);

    // Verifica sessão existente
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      // Já está logado, vai pra home
      window.location.href = '/app';
    }

    // Ouve mudanças de auth (se logar com sucesso, vai pra home)
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        window.location.href = '/app';
      }
    });
  } catch (err) {
    console.error('Falha ao inicializar Supabase:', err);
    showAuthError('login-error', 'Não foi possível conectar ao servidor. Tente recarregar a página.');
  }
}

function showAuthError(id, msg) {
  document.getElementById(id).textContent = msg;
}



function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
  } else {
    inp.type = 'password';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

function translateAuthError(msg) {
  if (!msg) return 'Erro desconhecido';
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed'))       return 'Por favor, confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered'))   return 'Este e-mail já está cadastrado. Tente fazer login.';
  if (msg.includes('Password should be'))        return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('rate limit'))                return 'Muitas tentativas. Aguarde alguns segundos.';
  return msg;
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const btnText = document.getElementById('btn-login-text');
  const spinner = document.getElementById('login-spinner');
  
  if (!supabaseClient) return;
  document.getElementById('login-error').textContent = '';
  btnText.style.display = 'none';
  spinner.style.display = 'block';
  document.getElementById('btn-login').disabled = true;

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    
    if (error) {
      btnText.style.display = 'block';
      spinner.style.display = 'none';
      document.getElementById('btn-login').disabled = false;
      showAuthError('login-error', translateAuthError(error.message));
    } else if (data && data.session) {
      window.location.href = '/app';
    } else {
      // Caso estranho onde não tem erro mas não tem sessão
      btnText.style.display = 'block';
      spinner.style.display = 'none';
      document.getElementById('btn-login').disabled = false;
      showAuthError('login-error', 'Erro ao iniciar sessão. Tente novamente.');
    }
  } catch (err) {
    console.error(err);
    btnText.style.display = 'block';
    spinner.style.display = 'none';
    document.getElementById('btn-login').disabled = false;
    showAuthError('login-error', 'Erro de conexão com o servidor.');
  }
}
