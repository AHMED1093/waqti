/**
 * =============================================
 * متتبع الوقت اليومي - script.js
 * Daily Time Tracker
 * =============================================
 */

// ==========================================
// 1. المتغيرات الأساسية
// ==========================================

const state = {
  running: false,
  totalSeconds: 600,       // 10 دقائق
  remaining: 600,
  intervalNum: 1,
  currentSession: [],
  viewDate: todayKey(),    // التاريخ المعروض في الداش بورد
  goalMinutes: 180,
  darkMode: true,
  activePopup: null,       // اسم البوب آب المفتوح حاليًا: 'activity' | 'quick' | 'export' | 'shortcuts'
};

let timerTick = null;

const COLORS = {
  'دراسة':   '#4ade80',
  'استراحة': '#60a5fa',
  'صلاة':    '#f59e0b',
  'أكل':     '#f97316',
  'تسخيت':   '#f43f5e',
  'أخرى':    '#a78bfa',
};

// ترتيب أزرار النشاط بالأرقام 1-6
const ACTIVITY_KEYS = ['دراسة', 'استراحة', 'صلاة', 'أكل', 'تسخيت', 'أخرى'];

// ==========================================
// 2. حساب التاريخ - الإصلاح الكامل
// ==========================================

/**
 * يحسب مفتاح اليوم بصيغة "YYYY-MM-DD"
 * نستخدم التوقيت المحلي بدلاً من UTC لتجنب مشكلة اليوم السابق
 */
function todayKey() {
  const d = new Date();
  return localDateKey(d);
}

/**
 * يحول كائن Date إلى مفتاح "YYYY-MM-DD" بالتوقيت المحلي
 */
function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * ✅ الإصلاح الأساسي: التنقل بين الأيام
 * المشكلة القديمة: new Date("2025-01-15") تُفسَّر كـ UTC فيصبح اليوم السابق بيومين
 * الحل: نشرّح المفتاح يدويًا ونبني التاريخ بالتوقيت المحلي
 */
function shiftDate(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d); // التوقيت المحلي بدون UTC
  date.setDate(date.getDate() + delta);
  return localDateKey(date);
}

// ==========================================
// 3. تهيئة التطبيق
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadTodayData();
  updateClock();
  setInterval(updateClock, 1000);
  renderRecent();
  updateGoalBar();
  updateStreak();
  setupEventListeners();
  setupKeyboard();
  injectSVGDefs();
  setActivityColors();
});

function injectSVGDefs() {
  const svg = document.querySelector('.ring-svg');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6c63ff"/>
      <stop offset="100%" stop-color="#60a5fa"/>
    </linearGradient>`;
  svg.insertBefore(defs, svg.firstChild);
}

function setActivityColors() {
  document.querySelectorAll('.act-btn').forEach(btn => {
    const color = btn.dataset.color;
    if (color) btn.style.setProperty('--c', color);
  });
}

// ==========================================
// 4. اللوكال ستوريج
// ==========================================

function loadSettings() {
  const saved = localStorage.getItem('waqti_settings');
  if (saved) {
    const s = JSON.parse(saved);
    state.darkMode    = s.darkMode    ?? true;
    state.goalMinutes = s.goalMinutes ?? 180;
  }
  applyTheme();
  updateGoalDisplay();
}

function saveSettings() {
  localStorage.setItem('waqti_settings', JSON.stringify({
    darkMode: state.darkMode,
    goalMinutes: state.goalMinutes,
  }));
}

function loadTodayData() {
  const key = `waqti_${todayKey()}`;
  const saved = localStorage.getItem(key);
  state.currentSession = saved ? JSON.parse(saved) : [];
}

function saveTodayData() {
  localStorage.setItem(`waqti_${todayKey()}`, JSON.stringify(state.currentSession));
  updateStreak();
}

function getDayData(dateKey) {
  const saved = localStorage.getItem(`waqti_${dateKey}`);
  return saved ? JSON.parse(saved) : [];
}

function getAllDates() {
  const dates = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('waqti_') && k !== 'waqti_settings') {
      dates.push(k.replace('waqti_', ''));
    }
  }
  return dates.sort().reverse();
}

// ==========================================
// 5. منطق التايمر
// ==========================================

function toggleTimer() {
  state.running ? pauseTimer() : startTimer();
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  document.body.classList.add('running');
  updateStartBtn();

  timerTick = setInterval(() => {
    state.remaining--;
    updateTimerDisplay();
    updateRing();

    if (state.remaining <= 0) {
      clearInterval(timerTick);
      timerTick = null;
      state.running = false;
      document.body.classList.remove('running');
      updateStartBtn();
      onIntervalEnd();
    }
  }, 1000);
}

function pauseTimer() {
  if (!state.running) return;
  state.running = false;
  document.body.classList.remove('running');
  clearInterval(timerTick);
  timerTick = null;
  updateStartBtn();
}

function resetTimer() {
  pauseTimer();
  state.remaining    = state.totalSeconds;
  state.intervalNum  = 1;
  updateTimerDisplay();
  updateRing();
  updateStartBtn();
  document.getElementById('intervalNum').textContent = state.intervalNum;
}

function updateStartBtn() {
  const btn = document.getElementById('startBtn');
  if (state.running) {
    btn.innerHTML = '⏸ إيقاف <kbd>Space</kbd>';
  } else if (state.remaining < state.totalSeconds) {
    btn.innerHTML = '▶ استكمال <kbd>Space</kbd>';
  } else {
    btn.innerHTML = '▶ ابدأ <kbd>Space</kbd>';
  }
}

function onIntervalEnd() {
  playSound();
  sendNotification();
  showActivityPopup();
}

// ==========================================
// 6. تحديث واجهة التايمر
// ==========================================

function updateTimerDisplay() {
  const m = Math.floor(state.remaining / 60);
  const s = state.remaining % 60;
  document.getElementById('timerDisplay').textContent =
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateRing() {
  const total      = state.totalSeconds;
  const elapsed    = total - state.remaining;
  const circumference = 596.9;
  const offset     = circumference - (elapsed / total) * circumference;
  document.getElementById('ringProgress').setAttribute('stroke-dashoffset', offset);
}

function updateClock() {
  const now = new Date();
  document.getElementById('currentTime').textContent =
    now.toLocaleTimeString('ar-IQ', { hour12: true });
  document.getElementById('currentDate').textContent =
    now.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ==========================================
// 7. البوب آب الرئيسي
// ==========================================

function showActivityPopup() {
  state.activePopup = 'activity';
  document.getElementById('overlay').classList.add('active');
  const popup = document.getElementById('popup');
  popup.style.display = 'block';
  requestAnimationFrame(() => popup.classList.add('active'));
  document.getElementById('customInputWrap').classList.remove('visible');
  document.getElementById('customActivity').value = '';
}

function hideActivityPopup() {
  state.activePopup = null;
  document.getElementById('overlay').classList.remove('active');
  const popup = document.getElementById('popup');
  popup.classList.remove('active');
  setTimeout(() => { popup.style.display = 'none'; }, 350);
}

function selectActivity(activityName, durationMinutes = 10) {
  const now      = new Date();
  const endTime  = fmt2(now.getHours()) + ':' + fmt2(now.getMinutes());
  const startMs  = now.getTime() - durationMinutes * 60000;
  const startD   = new Date(startMs);
  const startTime = fmt2(startD.getHours()) + ':' + fmt2(startD.getMinutes());

  const entry = {
    activity:  activityName,
    start:     startTime,
    end:       endTime,
    duration:  durationMinutes,
    timestamp: now.getTime(),
    color:     COLORS[activityName] || COLORS['أخرى'],
  };

  state.currentSession.push(entry);
  saveTodayData();
  renderRecent();
  updateGoalBar();

  // ابدأ إنتيرفال جديد تلقائيًا
  state.remaining   = state.totalSeconds;
  state.intervalNum++;
  document.getElementById('intervalNum').textContent = state.intervalNum;
  updateTimerDisplay();
  updateRing();
  startTimer();
}

function fmt2(n) { return String(n).padStart(2, '0'); }

// ==========================================
// 8. الصوت والإشعارات
// ==========================================

function playSound() {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.4);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.4);
    });
  } catch (e) {}
}

function sendNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification('⏰ وقتي — انتهى الإنتيرفال!', {
      body: 'ماذا كنت تفعل في آخر 10 دقائق؟',
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => { if (p === 'granted') sendNotification(); });
  }
}

// ==========================================
// 9. Page Visibility API
// ==========================================

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state.running) { pauseTimer(); state._wasRunning = true; }
  } else {
    if (state._wasRunning) { state._wasRunning = false; startTimer(); }
  }
});

// ==========================================
// 10. الداش بورد
// ==========================================

function calcStats(data) {
  const stats = { 'دراسة': 0, 'استراحة': 0, 'صلاة': 0, 'أكل': 0, 'تسخيت': 0, 'أخرى': 0 };
  data.forEach(e => {
    const k = stats.hasOwnProperty(e.activity) ? e.activity : 'أخرى';
    stats[k] += e.duration;
  });
  return stats;
}

function updateDashboard() {
  const data  = getDayData(state.viewDate);
  const today = todayKey();

  // عرض التاريخ
  document.getElementById('dashDate').textContent =
    state.viewDate === today ? 'اليوم' : formatDate(state.viewDate);

  // تعطيل/تفعيل زر "التالي" إذا كنا في اليوم الحالي
  document.getElementById('nextDay').disabled = (state.viewDate >= today);

  const stats = calcStats(data);
  document.getElementById('stat-study').textContent   = `${stats['دراسة']} د`;
  document.getElementById('stat-break').textContent   = `${stats['استراحة']} د`;
  document.getElementById('stat-prayer').textContent  = `${stats['صلاة']} د`;
  document.getElementById('stat-food').textContent    = `${stats['أكل']} د`;
  document.getElementById('stat-waste').textContent   = `${stats['تسخيت']} د`;
  document.getElementById('stat-other').textContent   = `${stats['أخرى']} د`;

  drawPieChart(stats);
  drawBarChart(stats);
  renderTimeline(data);
}

function drawPieChart(stats) {
  const canvas = document.getElementById('pieChart');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  if (total === 0) {
    ctx.fillStyle = 'var(--text3)';
    ctx.font = '13px Cairo';
    ctx.textAlign = 'center';
    ctx.fillText('لا توجد بيانات', W / 2, H / 2);
    return;
  }

  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 18;
  let startAngle = -Math.PI / 2;
  const legend   = document.getElementById('pieLegend');
  legend.innerHTML = '';

  const surfaceColor = getComputedStyle(document.body)
    .getPropertyValue('--surface').trim() || '#1e2334';

  Object.entries(stats).forEach(([name, val]) => {
    if (val === 0) return;
    const slice = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle   = COLORS[name] || COLORS['أخرى'];
    ctx.fill();
    ctx.strokeStyle = surfaceColor;
    ctx.lineWidth   = 3;
    ctx.stroke();
    startAngle += slice;

    const pct = Math.round((val / total) * 100);
    const li  = document.createElement('div');
    li.className = 'legend-item';
    li.innerHTML = `<div class="legend-dot" style="background:${COLORS[name] || COLORS['أخرى']}"></div>
                    <span>${name} ${pct}%</span>`;
    legend.appendChild(li);
  });

  // دائرة داخلية
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.46, 0, 2 * Math.PI);
  ctx.fillStyle = surfaceColor;
  ctx.fill();
}

function drawBarChart(stats) {
  const canvas = document.getElementById('barChart');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const entries = Object.entries(stats).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    ctx.fillStyle = '#555';
    ctx.font = '13px Cairo';
    ctx.textAlign = 'center';
    ctx.fillText('لا توجد بيانات', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...entries.map(([, v]) => v));
  const pad    = 20;
  const chartH = H - 50;
  const colW   = (W - pad * 2) / entries.length;
  const barW   = Math.min(36, colW * 0.6);

  entries.forEach(([name, val], i) => {
    const barH = (val / maxVal) * chartH;
    const x    = pad + i * colW + (colW - barW) / 2;
    const y    = chartH - barH + 10;
    const col  = COLORS[name] || COLORS['أخرى'];

    const grad = ctx.createLinearGradient(x, y + barH, x, y);
    grad.addColorStop(0, col + '88');
    grad.addColorStop(1, col);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 5);
    ctx.fill();

    ctx.fillStyle  = col;
    ctx.font       = 'bold 10px Cairo';
    ctx.textAlign  = 'center';
    ctx.fillText(`${val}د`, x + barW / 2, y - 4);

    ctx.fillStyle  = getComputedStyle(document.body).getPropertyValue('--text3').trim() || '#555';
    ctx.font       = '9px Cairo';
    ctx.textAlign  = 'center';
    ctx.fillText(name.slice(0, 4), x + barW / 2, H - 4);
  });
}

function renderTimeline(data) {
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  if (data.length === 0) {
    container.innerHTML = '<p class="empty-msg">لا توجد بيانات لهذا اليوم</p>';
    return;
  }

  data.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'tl-item';
    div.style.setProperty('--c', entry.color || COLORS[entry.activity] || COLORS['أخرى']);
    div.innerHTML = `
      <span class="tl-time">${entry.start} ← ${entry.end}</span>
      <span class="tl-act">${entry.activity}</span>
      <span class="tl-dur">${entry.duration} د</span>`;
    container.appendChild(div);
  });
}

// ==========================================
// 11. آخر الأنشطة
// ==========================================

function renderRecent() {
  const list = document.getElementById('recentList');
  const data = state.currentSession.slice(-5).reverse();

  if (data.length === 0) {
    list.innerHTML = '<p class="empty-msg">لا توجد أنشطة بعد — اضغط <kbd>Space</kbd> للبدء</p>';
    return;
  }

  list.innerHTML = '';
  data.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'recent-item';
    div.style.setProperty('--c', entry.color || COLORS[entry.activity] || COLORS['أخرى']);
    div.innerHTML = `
      <span class="act-name">${entry.activity}</span>
      <span class="act-time">${entry.start} - ${entry.end}</span>
      <span class="act-dur">${entry.duration} د</span>`;
    list.appendChild(div);
  });
}

// ==========================================
// 12. الهدف اليومي
// ==========================================

function updateGoalBar() {
  const studyMinutes = state.currentSession
    .filter(e => e.activity === 'دراسة')
    .reduce((sum, e) => sum + e.duration, 0);

  const pct = Math.min(100, (studyMinutes / state.goalMinutes) * 100);
  document.getElementById('goalProgress').style.width = pct + '%';
  document.getElementById('goalText').textContent     = `${studyMinutes} / ${state.goalMinutes} دقيقة`;
}

function updateGoalDisplay() {
  const h = Math.floor(state.goalMinutes / 60);
  const m = state.goalMinutes % 60;
  let txt = '';
  if (h > 0) txt += `${h} ساعة`;
  if (m > 0) txt += ` ${m} دقيقة`;
  document.getElementById('goalDisplay').textContent = txt.trim();
}

// ==========================================
// 13. الستريك
// ==========================================

function updateStreak() {
  const dates = getAllDates().filter(d => getDayData(d).length > 0);
  if (dates.length === 0) {
    document.getElementById('streakCount').textContent = 0;
    return;
  }

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const key = localDateKey(cursor);
    if (dates.includes(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  document.getElementById('streakCount').textContent = streak;
}

// ==========================================
// 14. السجل
// ==========================================

function renderHistory() {
  const list  = document.getElementById('historyList');
  const today = todayKey();
  const dates = getAllDates().filter(d => getDayData(d).length > 0 && d !== today);

  if (dates.length === 0) {
    list.innerHTML = '<p class="empty-msg">لا يوجد سجل بعد</p>';
    return;
  }

  list.innerHTML = '';
  dates.forEach(dateKey => {
    const data     = getDayData(dateKey);
    const stats    = calcStats(data);
    const totalMin = Object.values(stats).reduce((a, b) => a + b, 0);

    const card = document.createElement('div');
    card.className = 'hist-card';
    card.innerHTML = `
      <div>
        <div class="hist-date">${formatDate(dateKey)}</div>
        <div class="hist-summary">📚 ${stats['دراسة']}د • المجموع: ${totalMin}د • ${data.length} إنتيرفال</div>
      </div>
      <span class="hist-arrow">◀</span>`;
    card.addEventListener('click', () => {
      state.viewDate = dateKey;
      switchTab('dashboard');
    });
    list.appendChild(card);
  });
}

function formatDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d); // توقيت محلي
  return date.toLocaleDateString('ar-IQ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ==========================================
// 15. الإكسبورت
// ==========================================

function exportCSV() {
  const dates = getAllDates().filter(d => getDayData(d).length > 0);
  let csv = 'التاريخ,النشاط,البداية,النهاية,المدة (دقائق)\n';
  dates.forEach(dk => {
    getDayData(dk).forEach(e => {
      csv += `${dk},${e.activity},${e.start},${e.end},${e.duration}\n`;
    });
  });
  downloadFile('waqti_data.csv', csv, 'text/csv;charset=utf-8;');
}

function exportJSON() {
  const dates = getAllDates().filter(d => getDayData(d).length > 0);
  const all   = {};
  dates.forEach(dk => { all[dk] = getDayData(dk); });
  downloadFile('waqti_data.json', JSON.stringify(all, null, 2), 'application/json');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// 16. الثيم
// ==========================================

function applyTheme() {
  document.body.classList.toggle('light', !state.darkMode);
  document.body.classList.toggle('dark',  state.darkMode);
  document.getElementById('themeToggle').innerHTML =
    (state.darkMode ? '🌙' : '☀️') + ' <kbd>T</kbd>';
}

function toggleTheme() {
  state.darkMode = !state.darkMode;
  applyTheme();
  saveSettings();
  if (document.getElementById('page-dashboard').classList.contains('active')) {
    updateDashboard();
  }
}

// ==========================================
// 17. التنقل بين التابس
// ==========================================

function switchTab(tabName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`page-${tabName}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');

  if (tabName === 'dashboard') {
    state.viewDate = todayKey(); // ابدأ دائمًا من اليوم
    updateDashboard();
  } else if (tabName === 'history') {
    renderHistory();
  }
}

// ==========================================
// 18. الإضافة السريعة
// ==========================================

function showQuickAdd() {
  state.activePopup = 'quick';
  document.getElementById('overlay').classList.add('active');
  const popup = document.getElementById('quickPopup');
  popup.style.display = 'block';
  requestAnimationFrame(() => popup.classList.add('active'));
  document.getElementById('quickCustomWrap').classList.remove('visible');
  document.getElementById('quickCustomActivity').value = '';
}

function hideQuickAdd() {
  state.activePopup = null;
  document.getElementById('overlay').classList.remove('active');
  const popup = document.getElementById('quickPopup');
  popup.classList.remove('active');
  setTimeout(() => { popup.style.display = 'none'; }, 350);
}

// ==========================================
// 19. بوب آب الإكسبورت
// ==========================================

function showExportPopup() {
  state.activePopup = 'export';
  document.getElementById('overlay').classList.add('active');
  const popup = document.getElementById('exportPopup');
  popup.style.display = 'block';
  requestAnimationFrame(() => popup.classList.add('active'));
}

function hideExportPopup() {
  state.activePopup = null;
  document.getElementById('overlay').classList.remove('active');
  const popup = document.getElementById('exportPopup');
  popup.classList.remove('active');
  setTimeout(() => { popup.style.display = 'none'; }, 350);
}

// ==========================================
// 20. لوحة الاختصارات
// ==========================================

function showShortcuts() {
  state.activePopup = 'shortcuts';
  document.getElementById('shortcutsOverlay').classList.add('active');
  document.getElementById('shortcutsPanel').classList.add('active');
}

function hideShortcuts() {
  state.activePopup = null;
  document.getElementById('shortcutsOverlay').classList.remove('active');
  document.getElementById('shortcutsPanel').classList.remove('active');
}

// ==========================================
// 21. نظام الكيبورد الكامل
// ==========================================

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    const tag     = document.activeElement.tagName.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea';

    // ====== مفاتيح تعمل دائمًا حتى داخل الإن بوت ======

    // Escape — إغلاق أي بوب آب مفتوح
    if (e.key === 'Escape') {
      if (state.activePopup === 'quick')     { hideQuickAdd();     return; }
      if (state.activePopup === 'export')    { hideExportPopup();  return; }
      if (state.activePopup === 'shortcuts') { hideShortcuts();    return; }
      // بوب آب النشاط لا يُغلق بـ Escape (إجباري)
    }

    // إذا كان المستخدم يكتب في إن بوت، نتجاهل باقي الاختصارات
    if (isInput) return;

    // ====== البوب آب مفتوح - اختيار نشاط ======
    if (state.activePopup === 'activity' || state.activePopup === 'quick') {
      if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const idx      = parseInt(e.key) - 1;
        const activity = ACTIVITY_KEYS[idx];
        const isQuick  = state.activePopup === 'quick';

        if (activity === 'أخرى') {
          // إظهار حقل الإدخال المخصص
          const wrapId = isQuick ? 'quickCustomWrap' : 'customInputWrap';
          const inputId = isQuick ? 'quickCustomActivity' : 'customActivity';
          document.getElementById(wrapId).classList.add('visible');
          document.getElementById(inputId).focus();
        } else {
          if (isQuick) {
            const dur = parseInt(document.getElementById('quickDuration').value) || 10;
            hideQuickAdd();
            selectActivity(activity, dur);
          } else {
            hideActivityPopup();
            selectActivity(activity);
          }
        }
        return;
      }
    }

    // بوب آب الإكسبورت
    if (state.activePopup === 'export') {
      if (e.key === 'c' || e.key === 'C') { exportCSV(); return; }
      if (e.key === 'j' || e.key === 'J') { exportJSON(); return; }
      return; // لا نسمح بأي اختصار آخر وهو مفتوح
    }

    // ====== الاختصارات العامة (لا يوجد بوب آب مفتوح) ======

    // Space — ابدأ / إيقاف التايمر
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      // فقط إذا كنا في صفحة التايمر أو التايمر شغّال
      toggleTimer();
      return;
    }

    // Alt + رقم — التنقل بين الصفحات
    if (e.altKey) {
      if (e.key === '1') { e.preventDefault(); switchTab('timer');     return; }
      if (e.key === '2') { e.preventDefault(); switchTab('dashboard'); return; }
      if (e.key === '3') { e.preventDefault(); switchTab('history');   return; }
    }

    // ← → — التنقل بين الأيام في الداش بورد
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        // الاتجاه: RTL فـ ← = تقدم (اليوم التالي)، → = تراجع (اليوم السابق)
        // لكن منطقيًا: ← يعني "السابق" (أقدم)، → يعني "التالي" (أحدث)
        if (e.key === 'ArrowLeft') {
          // يوم سابق (أقدم)
          state.viewDate = shiftDate(state.viewDate, -1);
          updateDashboard();
        } else {
          // يوم تالٍ (أحدث) — لا نتجاوز اليوم
          const next = shiftDate(state.viewDate, +1);
          if (next <= todayKey()) {
            state.viewDate = next;
            updateDashboard();
          }
        }
        return;
      }
    }

    // R — إعادة تعيين
    if (e.key === 'r' || e.key === 'R') { resetTimer(); return; }

    // Q — إضافة سريعة
    if (e.key === 'q' || e.key === 'Q') { showQuickAdd(); return; }

    // T — تبديل الثيم
    if (e.key === 't' || e.key === 'T') { toggleTheme(); return; }

    // E — الإكسبورت
    if (e.key === 'e' || e.key === 'E') { showExportPopup(); return; }

    // H — لوحة الاختصارات
    if (e.key === 'h' || e.key === 'H') {
      state.activePopup === 'shortcuts' ? hideShortcuts() : showShortcuts();
      return;
    }

    // + / = — زيادة الهدف
    if (e.key === '+' || e.key === '=') {
      state.goalMinutes = Math.min(720, state.goalMinutes + 30);
      updateGoalDisplay();
      updateGoalBar();
      saveSettings();
      return;
    }

    // - — تقليل الهدف
    if (e.key === '-' || e.key === '_') {
      state.goalMinutes = Math.max(30, state.goalMinutes - 30);
      updateGoalDisplay();
      updateGoalBar();
      saveSettings();
      return;
    }

    // C — CSV (إذا لم يكن بوب آب مفتوح)
    if ((e.key === 'c' || e.key === 'C') && !state.activePopup) { exportCSV(); return; }

    // J — JSON
    if ((e.key === 'j' || e.key === 'J') && !state.activePopup) { exportJSON(); return; }
  });
}

// ==========================================
// 22. ربط أحداث الماوس / اللمس
// ==========================================

function setupEventListeners() {

  // — التايمر —
  document.getElementById('startBtn').addEventListener('click', toggleTimer);
  document.getElementById('resetBtn').addEventListener('click', resetTimer);
  document.getElementById('quickAddBtn').addEventListener('click', showQuickAdd);

  // — التابس —
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // — الأدوات العلوية —
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('exportBtn').addEventListener('click', showExportPopup);
  document.getElementById('helpBtn').addEventListener('click', showShortcuts);

  // — الداش بورد: التنقل بين الأيام (✅ إصلاح بالكامل) —
  document.getElementById('prevDay').addEventListener('click', () => {
    state.viewDate = shiftDate(state.viewDate, -1);
    updateDashboard();
  });

  document.getElementById('nextDay').addEventListener('click', () => {
    const next = shiftDate(state.viewDate, +1);
    if (next <= todayKey()) {
      state.viewDate = next;
      updateDashboard();
    }
  });

  // — الهدف —
  document.getElementById('goalPlus').addEventListener('click', () => {
    state.goalMinutes = Math.min(720, state.goalMinutes + 30);
    updateGoalDisplay(); updateGoalBar(); saveSettings();
  });

  document.getElementById('goalMinus').addEventListener('click', () => {
    state.goalMinutes = Math.max(30, state.goalMinutes - 30);
    updateGoalDisplay(); updateGoalBar(); saveSettings();
  });

  // — بوب آب النشاط الرئيسي —
  document.querySelectorAll('#popup .act-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.activity;
      if (act === 'أخرى') {
        document.getElementById('customInputWrap').classList.add('visible');
        document.getElementById('customActivity').focus();
      } else {
        hideActivityPopup();
        selectActivity(act);
      }
    });
  });

  document.getElementById('confirmCustom').addEventListener('click', () => {
    const val = document.getElementById('customActivity').value.trim();
    if (val) { hideActivityPopup(); selectActivity(val); }
  });

  document.getElementById('customActivity').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirmCustom').click();
  });

  // — الإضافة السريعة —
  document.querySelectorAll('#quickPopup .act-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.activity;
      if (act === 'أخرى') {
        document.getElementById('quickCustomWrap').classList.add('visible');
        document.getElementById('quickCustomActivity').focus();
      } else {
        const dur = parseInt(document.getElementById('quickDuration').value) || 10;
        hideQuickAdd();
        selectActivity(act, dur);
      }
    });
  });

  document.getElementById('confirmQuickCustom').addEventListener('click', () => {
    const val = document.getElementById('quickCustomActivity').value.trim();
    const dur = parseInt(document.getElementById('quickDuration').value) || 10;
    if (val) { hideQuickAdd(); selectActivity(val, dur); }
  });

  document.getElementById('quickCustomActivity').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirmQuickCustom').click();
  });

  document.getElementById('closeQuickPopup').addEventListener('click', hideQuickAdd);

  // — الإكسبورت —
  document.getElementById('exportCSVBtn').addEventListener('click', exportCSV);
  document.getElementById('exportJSONBtn').addEventListener('click', exportJSON);
  document.getElementById('closeExport').addEventListener('click', hideExportPopup);

  // — لوحة الاختصارات —
  document.getElementById('closeShortcuts').addEventListener('click', hideShortcuts);
  document.getElementById('shortcutsOverlay').addEventListener('click', hideShortcuts);

  // — الأوفرلاي (للبوب آبات القابلة للإغلاق) —
  document.getElementById('overlay').addEventListener('click', () => {
    if (state.activePopup === 'quick')  { hideQuickAdd();    return; }
    if (state.activePopup === 'export') { hideExportPopup(); return; }
    // بوب آب النشاط الإجباري لا يُغلق بالنقر على الخلفية
  });

  // — طلب إذن الإشعارات —
  document.getElementById('startBtn').addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, { once: true });
}

// ==========================================
// 23. تهيئة نهائية
// ==========================================

window.addEventListener('load', () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  updateTimerDisplay();
  updateRing();
});
