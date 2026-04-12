// ═══════════════════════════════════════════════════════════════════════
// SUPABASE SETUP
// createClient connects us to our Supabase project.
// The anon key is safe to include in frontend code —
// actual data access is controlled by Row Level Security on the database.
// ═══════════════════════════════════════════════════════════════════════
const { createClient } = supabase;
const sb = createClient(
  'https://hhulborfcbfzmoehfdtf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhodWxib3JmY2Jmem1vZWhmZHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODY1NjgsImV4cCI6MjA5MDk2MjU2OH0.owE2Q1uTSOuj_xrwDkHPab4Gs3OCtjsxJHo-LAdyY3g'
);

// ═══════════════════════════════════════════════════════════════════════
// AUTH STATE
// These three variables track who is playing right now.
// ═══════════════════════════════════════════════════════════════════════
let currentUser    = null;   // Supabase user object, or null
let currentProfile = null;   // { id, username } from our profiles table, or null
let isGuest        = false;  // true when someone chose "play as guest"

// ── Screen switcher ──────────────────────────────────────────────────
// Only one screen is visible at a time.
function showScreen(name) {
  document.getElementById('auth-screen').style.display  = (name === 'auth')  ? 'flex' : 'none';
  document.getElementById('start-screen').style.display = (name === 'start') ? 'flex' : 'none';
  document.getElementById('game-screen').style.display  = (name === 'game')  ? 'flex' : 'none';
}

// ── Auth tab: switch between LOGIN and SIGN UP ───────────────────────
let currentAuthTab = 'login';

function showAuthTab(tab) {
  currentAuthTab = tab;
  const isLogin  = tab === 'login';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-signup').classList.toggle('active', !isLogin);
  // Show/hide the "confirm password" field
  document.getElementById('confirm-wrap').style.display = isLogin ? 'none' : '';
  document.getElementById('auth-submit-btn').textContent = isLogin ? t('auth.tab.login') : t('auth.tab.signup');
  document.getElementById('auth-error').textContent = '';
}

// ── Handle form submit (login or signup) ─────────────────────────────
async function submitAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = t('auth.err.empty');
    return;
  }

  const btn = document.getElementById('auth-submit-btn');
  btn.textContent = '...';
  btn.disabled    = true;

  try {
    let error, data;
    if (currentAuthTab === 'login') {
      ({ error, data } = await sb.auth.signInWithPassword({ email, password }));
    } else {
      const confirm = document.getElementById('auth-confirm').value;
      if (password !== confirm) {
        errEl.textContent = t('auth.err.mismatch');
        btn.textContent = t('auth.tab.signup');
        btn.disabled    = false;
        return;
      }
      ({ error, data } = await sb.auth.signUp({ email, password }));
    }

    if (error) {
      errEl.textContent = error.message;
      btn.textContent = currentAuthTab === 'login' ? t('auth.tab.login') : t('auth.tab.signup');
      btn.disabled    = false;
      return;
    }

    // Navigate immediately after success — don't rely on onAuthStateChange
    if (data?.session) {
      currentUser = data.session.user;
      await loadProfile(currentUser.id);
      btn.textContent = currentAuthTab === 'login' ? t('auth.tab.login') : t('auth.tab.signup');
      btn.disabled    = false;
      if (!currentProfile) {
        showUsernameModal();
      } else {
        updateStartScreenUser();
        showScreen('start');
      }
    } else {
      // signUp without email confirmation enabled returns no session
      errEl.textContent = t('auth.err.email_confirm');
      btn.textContent = t('auth.tab.signup');
      btn.disabled    = false;
    }
  } catch (err) {
    // Catch unexpected errors (network failures, etc.) and show them
    errEl.textContent = err.message || t('auth.err.generic');
    btn.textContent = currentAuthTab === 'login' ? t('auth.tab.login') : t('auth.tab.signup');
    btn.disabled    = false;
  }
}

// ── Log out ──────────────────────────────────────────────────────────
async function handleSignOut() {
  await sb.auth.signOut();
  currentUser    = null;
  currentProfile = null;
  isGuest        = false;
  showAuthTab('login');
  showScreen('auth');
}

// ── Guest mode ───────────────────────────────────────────────────────
// Lets someone play without an account. Scores are not saved.
function playAsGuest() {
  isGuest        = true;
  currentUser    = null;
  currentProfile = null;
  updateStartScreenUser();
  showScreen('start');
}

// ── React to auth state changes ──────────────────────────────────────
// INITIAL_SESSION fires on page load when the user already has a saved
// session (returning visitor). We handle fresh logins directly in
// submitAuth() to avoid the two code paths conflicting.
// SIGNED_OUT fires when the user logs out — we send them back to auth.
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'INITIAL_SESSION' && session) {
    // Returning visitor — restore their session automatically.
    currentUser = session.user;
    try {
      await loadProfile(currentUser.id);
    } catch (err) {
      console.error('onAuthStateChange loadProfile error:', err);
    }
    if (!currentProfile) {
      showUsernameModal();
    } else {
      updateStartScreenUser();
      showScreen('start');
    }
  } else if (event === 'SIGNED_OUT' && !isGuest) {
    // Logged out (and not in guest mode) — send back to auth.
    currentUser    = null;
    currentProfile = null;
    showScreen('auth');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════════════════════════════════════

// Fetch this user's profile row from the database.
// maybeSingle() returns null (no error) when no row is found,
// whereas single() would return an error — which would cause a silent crash.
async function loadProfile(userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error('Failed to load profile: ' + error.message);
  currentProfile = data ?? null;
}

function showUsernameModal() {
  document.getElementById('username-modal').style.display = 'flex';
}

// Save the chosen username and move to the start screen.
async function saveUsername() {
  const val   = document.getElementById('username-input').value.trim();
  const errEl = document.getElementById('username-error');
  errEl.textContent = '';

  if (val.length < 2)  { errEl.textContent = t('username.err.min'); return; }
  if (val.length > 16) { errEl.textContent = t('username.err.max'); return; }

  const { error } = await sb
    .from('profiles')
    .insert({ id: currentUser.id, username: val });

  if (error) {
    // Error code 23505 = unique constraint violation (username taken)
    errEl.textContent = error.code === '23505'
      ? t('username.err.taken')
      : error.message;
    return;
  }

  currentProfile = { id: currentUser.id, username: val };
  document.getElementById('username-modal').style.display = 'none';
  updateStartScreenUser();
  showScreen('start');
}

// ── Update the "playing as" info on the start screen ────────────────
function updateStartScreenUser() {
  const el = document.getElementById('start-user-info');
  if (currentProfile) {
    el.innerHTML = `
      <span style="font-size:7px; color:#6b7280; letter-spacing:1px;">${t('user.playing_as')}</span>
      <span style="font-size:11px; color:#facc15;">${currentProfile.username}</span>
      <button onclick="handleSignOut()"
              style="background:none; border:none; color:#4b5563; font-size:7px;
                     font-family:'Press Start 2P',monospace; cursor:pointer;
                     text-decoration:underline; margin-top:2px;">
        ${t('user.logout')}
      </button>
    `;
  } else {
    // Guest
    el.innerHTML = `
      <span style="font-size:7px; color:#4b5563;">${t('user.guest_notice')}</span>
      <button onclick="isGuest=false; showScreen('auth');"
              style="background:none; border:none; color:#facc15; font-size:7px;
                     font-family:'Press Start 2P',monospace; cursor:pointer;
                     text-decoration:underline; margin-top:2px;">
        ${t('user.login_link')}
      </button>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════

async function openLeaderboard() {
  document.getElementById('lb-overlay').style.display = 'flex';
  document.getElementById('lb-content').innerHTML =
    `<p style="font-size:8px; color:#6b7280; text-align:center; padding:28px;">${t('lb.loading')}</p>`;

  // Fetch more rows than needed so we can deduplicate per user client-side
  const { data, error } = await sb
    .from('scores')
    .select('username, score')
    .order('score', { ascending: false })
    .limit(500);

  if (error) {
    document.getElementById('lb-content').innerHTML =
      `<p style="font-size:8px; color:#f87171; text-align:center; padding:16px;">${t('lb.error')}</p>`;
    return;
  }

  // Keep only each user's highest score (data is already sorted desc, so first hit = best)
  const seen = new Set();
  const top = (data ?? []).filter(row => {
    if (seen.has(row.username)) return false;
    seen.add(row.username);
    return true;
  }).slice(0, 10);

  if (!top.length) {
    document.getElementById('lb-content').innerHTML =
      `<p style="font-size:8px; color:#6b7280; text-align:center; padding:28px;">${t('lb.empty')}</p>`;
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  document.getElementById('lb-content').innerHTML = `
    <table class="lb-table">
      <thead>
        <tr>
          <th>${t('lb.rank')}</th>
          <th>${t('lb.player')}</th>
          <th style="text-align:right;">${t('lb.streak')}</th>
        </tr>
      </thead>
      <tbody>
        ${top.map((row, i) => `
          <tr>
            <td class="lb-rank">${medals[i] ?? '#' + (i + 1)}</td>
            <td>${row.username}</td>
            <td class="lb-score">${row.score}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function closeLb() {
  document.getElementById('lb-overlay').style.display = 'none';
}

function closeLbOverlay(e) {
  if (e.target === document.getElementById('lb-overlay')) closeLb();
}

function closePrivacy(e) {
  if (e.target === document.getElementById('privacy-overlay'))
    document.getElementById('privacy-overlay').style.display = 'none';
}

// ── Submit a score to the database ───────────────────────────────────
async function submitScore(score) {
  // Only save if logged in and score is greater than 0
  if (!currentUser || !currentProfile || score <= 0) return false;
  const { error } = await sb.from('scores').insert({
    user_id:  currentUser.id,
    username: currentProfile.username,  // denormalised for fast leaderboard reads
    score:    score,
  });
  return !error;
}

// ── Called at end of every run (loss or all Pokémon used) ────────────
async function handleGameOver(finalScore) {
  const msgEl = document.getElementById('score-save-msg');
  if (currentProfile) {
    msgEl.style.color = '#6b7280';
    msgEl.textContent = t('score.saving');
    const saved = await submitScore(finalScore);
    msgEl.style.color = saved ? '#4ade80' : '#f87171';
    msgEl.textContent = saved
      ? tf('score.saved', finalScore)
      : t('score.error');
  } else if (isGuest && finalScore > 0) {
    msgEl.style.color = '#facc15';
    msgEl.textContent = t('score.guest');
  } else {
    msgEl.textContent = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════
let pokemonData     = [];
let enemyPokemon    = null;
let playerPokemon   = null;
let currentCategory = null;
let dropdownIndex   = -1;
let streak          = 0;
let usedIds         = new Set();
let lastWinner      = null;
let battleDone      = false;
let browseIndex     = 0;
let currentLang     = 'en';
let lastResultKey   = null;

// ── Translations ─────────────────────────────────────────────────────
// Populated by loadTranslations() from locales/en.json + locales/de.json
let TRANSLATIONS = { en: {}, de: {} };

// t(key) — look up a translation key in the current language, fall back to EN
function t(key) { return TRANSLATIONS[currentLang][key] ?? TRANSLATIONS.en[key] ?? key; }

// tf(key, ...args) — same as t(), but replaces {0}, {1}, … with the given values
function tf(key, ...args) {
  let str = t(key);
  args.forEach((val, i) => { str = str.replace(`{${i}}`, val); });
  return str;
}

// Return a Pokémon's name in the active language.
// Falls back to display_name (EN) if the JSON hasn't been re-fetched yet.
function pkmName(pkm) {
  if (!pkm) return '';
  if (currentLang === 'de') return pkm.name_ger ?? pkm.display_name;
  return pkm.name_en ?? pkm.display_name;
}

async function loadTranslations() {
  try {
    const [enRes, deRes] = await Promise.all([
      fetch('./locales/en.json'),
      fetch('./locales/de.json'),
    ]);
    TRANSLATIONS.en = await enRes.json();
    TRANSLATIONS.de = await deRes.json();
  } catch (err) {
    console.error('Could not load translation files:', err);
  }
  // Apply the (possibly already-chosen) language now that strings are loaded
  applyLanguage(currentLang);
}

function applyLanguage(lang) {
  currentLang = lang;
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('lang-de').classList.toggle('active', lang === 'de');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml).replace(/\n/g, '<br/>');
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  // Auth submit button text depends on which tab is active
  const submitBtn = document.getElementById('auth-submit-btn');
  if (submitBtn && !submitBtn.disabled) {
    submitBtn.textContent = currentAuthTab === 'login'
      ? t('auth.tab.login')
      : t('auth.tab.signup');
  }
  // Rebuild dynamic HTML sections that contain translated strings
  updateStartScreenUser();

  // Refresh Pokémon names that are currently visible on the cards
  if (enemyPokemon && document.getElementById('content-1').style.display !== 'none') {
    document.getElementById('name-1').textContent = pkmName(enemyPokemon);
  }
  if (playerPokemon && document.getElementById('player-preview').style.display !== 'none') {
    document.getElementById('player-name').textContent = pkmName(playerPokemon);
    document.getElementById('pkm-input').value = pkmName(playerPokemon);
  }
  // Rebuild eliminated modal if it's currently open
  if (document.getElementById('elim-overlay').style.display !== 'none') {
    openEliminated();
  }

  if (currentCategory) {
    document.getElementById('category-badge').textContent = t('cat.' + currentCategory.key);
  }
  if (lastResultKey && document.getElementById('result-banner').style.display !== 'none') {
    document.getElementById('result-text').textContent = t(lastResultKey);
  }
  if (enemyPokemon && document.getElementById('content-1').style.display !== 'none') {
    document.getElementById('stats-1').innerHTML = renderStats(enemyPokemon.stats);
  }
  if (playerPokemon && document.getElementById('player-preview').style.display !== 'none') {
    document.getElementById('player-stats').innerHTML = battleDone
      ? renderStats(playerPokemon.stats)
      : renderStatsHidden(playerPokemon.stats);
  }
}

const CATEGORIES = [
  { key: 'attack' },
  { key: 'hp' },
  { key: 'sp_attack' },
  { key: 'defense' },
  { key: 'sp_defense' },
  { key: 'speed' },
];

const STAT_COLORS = {
  hp:'#22c55e', attack:'#ef4444', defense:'#3b82f6',
  sp_attack:'#a855f7', sp_defense:'#06b6d4', speed:'#eab308',
};

// ═══════════════════════════════════════════════════════════════════════
// INIT
// Loads Pokémon data, then checks if there's already a logged-in session.
// ═══════════════════════════════════════════════════════════════════════
async function init() {
  // Load translation files first so all UI strings are ready
  await loadTranslations();

  // Load Pokémon data from local JSON file
  try {
    const res = await fetch('./pkm/pokemon.json');
    if (!res.ok) throw new Error(`Could not load pokemon.json (${res.status})`);
    const json = await res.json();
    pokemonData = json.pokemon;
  } catch (err) {
    document.getElementById('start-error').textContent = `⚠ ${err.message}`;
    document.getElementById('start-error').style.display = '';
  }

  // Check if there is already an active session (returning visitor).
  // onAuthStateChange handles the result — if there's a session it fires
  // immediately; if not, we explicitly show the auth screen.
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    showScreen('auth');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// START / RESTART
// ═══════════════════════════════════════════════════════════════════════

function startGame() {
  if (!pokemonData.length) return;
  showScreen('game');
  resetState();
  newRound();
}

// Restart goes back to the start screen (not directly into a new game),
// so the player can check the leaderboard between runs.
function restartGame() {
  showScreen('start');
  resetState();
}

function resetState() {
  streak        = 0;
  usedIds       = new Set();
  lastWinner    = null;
  battleDone    = false;
  browseIndex   = -1;
  lastResultKey = null;
  document.getElementById('streak-count').textContent    = '0';
  document.getElementById('result-banner').style.display = 'none';
  document.getElementById('game-error').style.display    = 'none';
  document.getElementById('score-save-msg').textContent  = '';
  document.getElementById('arrow-prev').disabled         = true;
  document.getElementById('arrow-next').disabled         = true;
  document.getElementById('cell-battle').style.display      = 'flex';
  document.getElementById('cell-next').style.display        = 'flex';
  document.getElementById('newgame-controls').style.display = 'none';
  resetCardStyles();
}

// ═══════════════════════════════════════════════════════════════════════
// GAME LOGIC
// ═══════════════════════════════════════════════════════════════════════

function newRound() {
  battleDone = false;
  document.getElementById('result-banner').style.display = 'none';

  document.getElementById('pkm-input').value = '';
  document.getElementById('player-preview').style.display = 'none';
  document.getElementById('player-hint').style.display = '';
  playerPokemon = null;
  browseIndex   = -1;
  setBattleBtn(false);
  setNextBtn(false);
  updateArrows();

  if (lastWinner) {
    enemyPokemon = lastWinner;
    lastWinner   = null;
  } else {
    const available = pokemonData.filter(p => !usedIds.has(p.id));
    if (!available.length) {
      showGameError(t('err.all_used'));
      handleGameOver(streak);
      setTimeout(restartGame, 2000);
      return;
    }
    enemyPokemon = available[Math.floor(Math.random() * available.length)];
  }
  usedIds.add(enemyPokemon.id);

  let challengers = pokemonData.filter(p => !usedIds.has(p.id));
  let validCats   = getValidCategories(enemyPokemon, challengers);

  if (!validCats.length) {
    const fallback = pokemonData.filter(p => !usedIds.has(p.id));
    if (!fallback.length) {
      showGameError(t('err.all_used'));
      handleGameOver(streak);
      setTimeout(restartGame, 2000);
      return;
    }
    enemyPokemon = fallback[Math.floor(Math.random() * fallback.length)];
    usedIds.add(enemyPokemon.id);
    challengers = pokemonData.filter(p => !usedIds.has(p.id));
    validCats   = getValidCategories(enemyPokemon, challengers);
  }

  currentCategory = validCats[Math.floor(Math.random() * validCats.length)];
  document.getElementById('category-badge').textContent = t('cat.' + currentCategory.key);
  displayEnemy(enemyPokemon);
}

function getValidCategories(enemy, available) {
  return CATEGORIES.filter(cat =>
    available.some(p => p.stats[cat.key] > enemy.stats[cat.key])
  );
}

// ── doBattle ─────────────────────────────────────────────────────────
// On loss: captures the streak before resetting it, then calls
// handleGameOver() to save the score to Supabase.
async function doBattle() {
  if (!playerPokemon || !enemyPokemon || !currentCategory || battleDone) return;

  document.getElementById('player-types').style.visibility = 'visible';
  document.getElementById('player-stats').innerHTML = renderStats(playerPokemon.stats);

  const ps = playerPokemon.stats[currentCategory.key];
  const es = enemyPokemon.stats[currentCategory.key];

  const banner = document.getElementById('result-banner');
  const text   = document.getElementById('result-text');
  banner.style.display = '';
  text.classList.remove('result-pop');
  void text.offsetWidth;
  text.classList.add('result-pop');

  if (ps > es) {
    lastResultKey = 'result.win';
    text.textContent = t('result.win');
    text.style.color = '#4ade80';
    streak++;
    lastWinner = playerPokemon;
    usedIds.add(playerPokemon.id);

  } else if (ps === es) {
    lastResultKey = 'result.tie';
    text.textContent = t('result.tie');
    text.style.color = '#facc15';
    usedIds.add(playerPokemon.id);
    lastWinner = enemyPokemon;
    usedIds.delete(enemyPokemon.id);

  } else {
    // ── Loss ──────────────────────────────────────────────────────
    lastResultKey = 'result.lose';
    text.textContent = t('result.lose');
    text.style.color = '#f87171';

    const finalScore = streak;   // capture streak BEFORE resetting to 0
    streak = 0;

    lastWinner = enemyPokemon;
    usedIds.add(playerPokemon.id);
    usedIds.delete(enemyPokemon.id);
    document.getElementById('cell-battle').style.display      = 'none';
    document.getElementById('cell-next').style.display        = 'none';
    document.getElementById('newgame-controls').style.display = 'flex';

    // Submit score to leaderboard (runs in background, doesn't block UI)
    handleGameOver(finalScore);
  }

  battleDone = true;
  updateStreak();
  setBattleBtn(false);
  if (ps > es || ps === es) setNextBtn(true);
}

function doNextRound() {
  if (!battleDone) return;
  setNextBtn(false);
  animateTransition(lastWinner && lastWinner.id === playerPokemon?.id);
  setTimeout(() => {
    resetCardStyles();
    newRound();
  }, 600);
}

// ── Card animations ───────────────────────────────────────────────────
function animateTransition(playerWon) {
  const leftCard  = document.getElementById('card-left');
  const rightCard = document.getElementById('card-right');
  if (playerWon) {
    const lr = leftCard.getBoundingClientRect();
    const rr = rightCard.getBoundingClientRect();
    leftCard.style.transition  = 'opacity 0.25s ease';
    leftCard.style.opacity     = '0';
    rightCard.style.transition = 'transform 0.55s cubic-bezier(0.4,0,0.2,1)';
    rightCard.style.transform  = `translate(${lr.left - rr.left}px, ${lr.top - rr.top}px)`;
  } else {
    rightCard.style.transition = 'transform 0.4s ease-in, opacity 0.4s ease';
    rightCard.style.transform  = 'translateX(60px)';
    rightCard.style.opacity    = '0';
  }
}

function resetCardStyles() {
  ['card-left', 'card-right'].forEach(id => {
    const el = document.getElementById(id);
    el.style.transition = 'none';
    el.style.transform  = '';
    el.style.opacity    = '';
    void el.offsetWidth;
    el.style.transition = '';
  });
}

// ── Display helpers ───────────────────────────────────────────────────
function displayEnemy(pkm) {
  document.getElementById('loading-1').style.display  = 'flex';
  document.getElementById('content-1').style.display  = 'none';
  const img = document.getElementById('sprite-1');
  img.src = pkm.sprite; img.alt = pkmName(pkm);
  img.onload = () => {
    document.getElementById('id-1').textContent   = `#${String(pkm.id).padStart(3,'0')}`;
    document.getElementById('name-1').textContent = pkmName(pkm);
    document.getElementById('types-1').innerHTML  = renderTypes(pkm.types);
    document.getElementById('stats-1').innerHTML  = renderStats(pkm.stats);
    document.getElementById('loading-1').style.display = 'none';
    document.getElementById('content-1').style.display = 'flex';
  };
}

function displayPlayer(pkm) {
  const preview = document.getElementById('player-preview');
  preview.style.display = 'none';
  const img = document.getElementById('player-sprite');
  img.src = pkm.sprite; img.alt = pkmName(pkm);
  img.onload = () => {
    document.getElementById('player-id').textContent          = `#${String(pkm.id).padStart(3,'0')}`;
    document.getElementById('player-name').textContent        = pkmName(pkm);
    document.getElementById('player-types').innerHTML         = renderTypes(pkm.types);
    document.getElementById('player-stats').innerHTML         = renderStatsHidden(pkm.stats);
    document.getElementById('player-types').style.visibility = 'hidden';
    document.getElementById('player-stats').style.visibility = 'visible';
    document.getElementById('player-hint').style.display     = 'none';
    preview.style.display = 'flex';
    preview.classList.add('fade-in');
    setBattleBtn(true);
  };
}

function renderTypes(types) {
  return types.map(t =>
    `<span class="type-${t}" style="color:inherit;font-size:9px;padding:3px 8px;border-radius:999px;font-weight:bold;font-family:sans-serif;">${t}</span>`
  ).join('');
}

function renderStats(stats) {
  return Object.entries(stats).map(([key, val]) => `
    <div class="stat-row">
      <span class="stat-label">${t('stat.' + key)}</span>
      <div class="stat-bar-bg">
        <div class="stat-bar" style="width:${Math.min(100,(val/255)*100)}%;background:${STAT_COLORS[key]};"></div>
      </div>
      <span class="stat-val">${val}</span>
    </div>
  `).join('');
}

function renderStatsHidden(stats) {
  return Object.entries(stats).map(([key]) => `
    <div class="stat-row">
      <span class="stat-label" style="color:#6b7280;">${t('stat.' + key)}</span>
      <div class="stat-bar-bg">
        <div class="stat-bar" style="width:100%;background:#4b5563;"></div>
      </div>
      <span class="stat-val" style="color:#6b7280;">???</span>
    </div>
  `).join('');
}

// ── Button helpers ────────────────────────────────────────────────────
function setBattleBtn(on) {
  const b = document.getElementById('battle-btn');
  b.disabled      = !on;
  b.style.opacity = on ? '1' : '0.4';
}

function setNextBtn(on) {
  const b = document.getElementById('next-btn');
  b.disabled      = !on;
  b.style.opacity = on ? '1' : '0.4';
}

function updateStreak() {
  const el = document.getElementById('streak-count');
  el.textContent = streak;
  el.classList.remove('streak-bump');
  void el.offsetWidth;
  if (streak > 0) el.classList.add('streak-bump');
}

// ── Autocomplete ──────────────────────────────────────────────────────
function getMatches(query) {
  const available = pokemonData.filter(p => !usedIds.has(p.id));
  if (!query) return available;
  const q = query.toLowerCase();
  return available.filter(p =>
    p.name.includes(q) ||
    (p.name_en  ?? p.display_name).toLowerCase().includes(q) ||
    (p.name_ger ?? '').toLowerCase().includes(q)
  );
}

function onSearch() { dropdownIndex = -1; openDropdown(); }

function openDropdown() {
  const matches = getMatches(document.getElementById('pkm-input').value);
  const dd = document.getElementById('dropdown');
  if (!matches.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = matches.map((p, i) => `
    <div class="dropdown-item" data-index="${i}" onmousedown="selectPokemon('${p.name}')">
      <img src="${p.sprite}" alt="${pkmName(p)}" />
      <span>${pkmName(p)}</span>
      <span style="margin-left:auto;font-size:9px;color:#6b7280;">#${String(p.id).padStart(3,'0')}</span>
    </div>
  `).join('');
  dd._matches = matches;
  dd.style.display = '';
}

function onKeyDown(e) {
  const dd    = document.getElementById('dropdown');
  const items = dd.querySelectorAll('.dropdown-item');
  if      (e.key === 'ArrowDown')  { e.preventDefault(); dropdownIndex = Math.min(dropdownIndex+1, items.length-1); highlightItem(items); }
  else if (e.key === 'ArrowUp')    { e.preventDefault(); dropdownIndex = Math.max(dropdownIndex-1, 0); highlightItem(items); }
  else if (e.key === 'Enter' && dropdownIndex >= 0 && dd._matches) selectPokemon(dd._matches[dropdownIndex].name);
  else if (e.key === 'Escape') closeDropdown();
}

function highlightItem(items) {
  items.forEach((el, i) => el.classList.toggle('active', i === dropdownIndex));
}

function selectPokemon(name) {
  const pkm = pokemonData.find(p => p.name === name);
  if (!pkm) return;
  playerPokemon = pkm;
  document.getElementById('pkm-input').value = pkmName(pkm);
  closeDropdown();
  const sorted = availableSorted();
  browseIndex = sorted.findIndex(p => p.id === pkm.id);
  if (browseIndex < 0) browseIndex = 0;
  updateArrows();
  displayPlayer(pkm);
}

// ── Browse by Pokédex number ──────────────────────────────────────────
function availableSorted() {
  return pokemonData.filter(p => !usedIds.has(p.id)).sort((a, b) => a.id - b.id);
}

function updateArrows() {
  const len = availableSorted().length;
  document.getElementById('arrow-prev').disabled = browseIndex <= 0;
  document.getElementById('arrow-next').disabled = browseIndex >= len - 1;
}

function browsePrev() {
  const sorted = availableSorted();
  if (browseIndex <= 0) return;
  browseIndex--;
  selectPokemon(sorted[browseIndex].name);
}

function browseNext() {
  const sorted = availableSorted();
  if (browseIndex >= sorted.length - 1) return;
  browseIndex++;
  selectPokemon(sorted[browseIndex].name);
}

function closeDropdown() { document.getElementById('dropdown').style.display = 'none'; }

document.addEventListener('click', e => {
  if (!e.target.closest('#pkm-input') && !e.target.closest('#dropdown')) closeDropdown();
});

function showGameError(msg) {
  const el = document.getElementById('game-error');
  el.textContent = `⚠ ${msg}`;
  el.style.display = '';
}

// ── Rules modal ───────────────────────────────────────────────────────
function toggleRules() {
  const overlay = document.getElementById('rules-overlay');
  const isOpen  = overlay.style.display === 'flex';
  overlay.style.display = isOpen ? 'none' : 'flex';
}
function closeRules(e) {
  if (e.target === document.getElementById('rules-overlay')) {
    document.getElementById('rules-overlay').style.display = 'none';
  }
}
function closeRulesBtn() {
  document.getElementById('rules-overlay').style.display = 'none';
}

// ── Eliminated modal ──────────────────────────────────────────────────
function openEliminated() {
  const eliminated = pokemonData
    .filter(p => usedIds.has(p.id))
    .sort((a, b) => a.id - b.id);
  const emptyEl = document.getElementById('elim-empty');
  const gridEl  = document.getElementById('elim-grid');
  if (eliminated.length === 0) {
    emptyEl.style.display = '';
    gridEl.style.display  = 'none';
  } else {
    emptyEl.style.display = 'none';
    gridEl.style.display  = 'grid';
    gridEl.innerHTML = eliminated.map(p => `
      <div style="display:flex; flex-direction:column; align-items:center; gap:4px; opacity:0.7;">
        <img src="${p.sprite}" alt="${pkmName(p)}"
             style="width:56px;height:56px;image-rendering:pixelated;filter:grayscale(100%);" />
        <span style="font-size:6px; color:#6b7280; text-align:center; line-height:1.4;">
          ${pkmName(p)}
        </span>
      </div>
    `).join('');
  }
  document.getElementById('elim-overlay').style.display = 'flex';
}

function closeEliminated(e) {
  if (e.target === document.getElementById('elim-overlay')) {
    document.getElementById('elim-overlay').style.display = 'none';
  }
}

// ── Kick everything off ───────────────────────────────────────────────
init();
