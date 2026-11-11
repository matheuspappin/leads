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
let supabase = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
});

async function initSupabase() {
  try {
    const res  = await fetch(`${API}/api/config`);
    const conf = await res.json();

    if (!conf.supabase_url || !conf.supabase_anon_key) {
      showAuthError('register-error', 'Configuração do servidor incompleta. Contate o administrador.');
      return;
    }

    supabase = window.supabase.createClient(conf.supabase_url, conf.supabase_anon_key);

    // Verifica sessão existente
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Já está logado, vai pra home
      window.location.href = '/app';
    }

    // Ouve mudanças de auth (se logar com sucesso, vai pra home)
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        window.location.href = '/app';
      }
    });
  } catch (err) {
    console.error('Falha ao inicializar Supabase:', err);
    showAuthError('register-error', 'Não foi possível conectar ao servidor. Tente recarregar a página.');
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

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-password').value;
  const conf  = document.getElementById('reg-confirm').value;
  const btnText = document.getElementById('btn-register-text');
  const spinner = document.getElementById('register-spinner');

  document.getElementById('register-error').textContent = '';

  if (pass !== conf) {
    showAuthError('register-error', 'As senhas não coincidem.');
    return;
  }

  if (!supabase) return;
  btnText.style.display = 'none';
  spinner.style.display = 'block';
  document.getElementById('btn-register').disabled = true;

  try {
    const { data, error } = await supabase.auth.signUp({ email, password: pass });

    btnText.style.display = 'block';
    spinner.style.display = 'none';
    document.getElementById('btn-register').disabled = false;

    if (error) {
      showAuthError('register-error', translateAuthError(error.message));
    } else {
      // Pode exigir confirmação de e-mail, então verificamos a sessão gerada
      if (data.session) {
        window.location.href = '/app';
      } else {
        document.getElementById('form-register').reset();
        showAuthError('register-error', '✅ Conta criada! Verifique seu e-mail para confirmar e depois faça login.');
        document.getElementById('register-error').style.color = '#00d4aa';
      }
    }
  } catch (err) {
    console.error(err);
    btnText.style.display = 'block';
    spinner.style.display = 'none';
    document.getElementById('btn-register').disabled = false;
    showAuthError('register-error', 'Erro de conexão com o servidor.');
  }
}
