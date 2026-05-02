/**
 * =============================================
 * متتبع الوقت اليومي + تايمر السبرينت
 * script.js — النسخة الكاملة النظيفة
 * =============================================
 */

// ==========================================
// 1. ثوابت ومتغيرات عامة
// ==========================================

const COLORS = {
  'دراسة':   '#4ade80',
  'استراحة': '#60a5fa',
  'صلاة':    '#f59e0b',
  'أكل':     '#f97316',
  'تسخيت':   '#f43f5e',
  'أخرى':    '#a78bfa',
};

const ACTIVITY_KEYS = ['دراسة', 'استراحة', 'صلاة', 'أكل', 'تسخيت', 'أخرى'];

/* حالة التايمر الرئيسي */
const state = {
  running:       false,
  totalSeconds:  600,
  remaining:     600,
  intervalNum:   1,
  currentSession: [],
  viewDate:      todayKey(),
  goalMinutes:   180,
  darkMode:      true,
  activePopup:   null,
  _wasRunning:   false,
};

let timerTick = null;

/* حالة تايمر السبرينت */
const sprint = {
  running:   false,
  elapsed:   0,
  tickId:    null,
  minimized: false,
  sessions:  [],       // [{start, end, duration(ثواني), date}]
  goalMin:   60,       // هدف الجلسة اليومية بالدقائق
  audioCtx:  null,
  beatCount: 0,
};

// ==========================================
// 2. حساب التاريخ (إصلاح UTC)
// ==========================================

function todayKey() {
  return localDateKey(new Date());
}

function localDateKey(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ✅ الحل الصحيح لتجنب مشكلة UTC عند التنقل بين الأيام */
function shiftDate(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d); // توقيت محلي
  date.setDate(date.getDate() + delta);
  return localDateKey(date);
}

function fmt2(n) { return String(n).padStart(2, '0'); }

/** تنسيق الوقت بنظام 12 ساعة: "03:25 م" */
function fmtTime12(date) {
  let h   = date.getHours();
  const m = fmt2(date.getMinutes());
  const p = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${fmt2(h)}:${m} ${p}`;
}

// ==========================================
// 3. اللوكال ستوريج
// ==========================================

function loadSettings() {
  const s = JSON.parse(localStorage.getItem('waqti_settings') || '{}');
  state.darkMode    = s.darkMode    ?? true;
  state.goalMinutes = s.goalMinutes ?? 180;
  sprint.goalMin    = s.sprintGoal  ?? 60;
  applyTheme();
  updateGoalDisplay();
}

function saveSettings() {
  localStorage.setItem('waqti_settings', JSON.stringify({
    darkMode:    state.darkMode,
    goalMinutes: state.goalMinutes,
    sprintGoal:  sprint.goalMin,
  }));
}

function loadTodayData() {
  const saved = localStorage.getItem(`waqti_${todayKey()}`);
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
    if (k && k.startsWith('waqti_') && !k.includes('settings') && !k.includes('sprint')) {
      dates.push(k.replace('waqti_', ''));
    }
  }
  return dates.sort().reverse();
}

/* ---- سبرينت ---- */
function loadSprintData() {
  const saved = localStorage.getItem(`waqti_sprint_${todayKey()}`);
  sprint.sessions = saved ? JSON.parse(saved) : [];
  updateSprintStats();
}

function saveSprintData() {
  const todaySess = sprint.sessions.filter(s => s.date === todayKey());
  localStorage.setItem(`waqti_sprint_${todayKey()}`, JSON.stringify(todaySess));
}

function getSprintDayData(dateKey) {
  const saved = localStorage.getItem(`waqti_sprint_${dateKey}`);
  return saved ? JSON.parse(saved) : [];
}

// ==========================================
// 4. التايمر الرئيسي — لا يقف أبداً بعد البدء
// ==========================================

/**
 * طابور البوب آبات المنتظرة
 * لو مرت 30 دقيقة والمستخدم لم يختر → 3 بوب آبات وراء بعض
 */
let popupQueue = [];    // عدد البوب آبات المنتظرة
let popupOpen  = false; // هل البوب آب مفتوح الآن؟

/** بدء التايمر — يُستدعى مرة واحدة فقط ثم لا يقف أبداً */
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
      // انتهى إنتيرفال — أضف للطابور واستمر فوراً
      state.intervalNum++;
      document.getElementById('intervalNum').textContent = state.intervalNum;
      state.remaining = state.totalSeconds;
      updateTimerDisplay();
      updateRing();

      popupQueue.push(Date.now());
      playIntervalSound();
      sendNotification();
      drainPopupQueue();
    }
  }, 1000);
}

/**
 * استنزاف الطابور — يعرض البوب آبات واحداً تلو الآخر
 * إذا كان البوب آب مفتوحاً، انتظر حتى يُغلق
 */
function drainPopupQueue() {
  if (popupOpen || popupQueue.length === 0) return;
  popupQueue.shift();
  showActivityPopup();
}

/** بعد البدء: زر Space لا يوقف التايمر — فقط يبدأ */
function toggleTimer() {
  if (!state.running) startTimer();
}

/** إعادة التعيين — فقط قبل البدء */
function resetTimer() {
  if (state.running) return;
  state.remaining   = state.totalSeconds;
  state.intervalNum = 1;
  popupQueue        = [];
  document.getElementById('intervalNum').textContent = 1;
  updateTimerDisplay();
  updateRing();
  updateStartBtn();
}

function updateStartBtn() {
  const btn   = document.getElementById('startBtn');
  const reset = document.getElementById('resetBtn');
  if (state.running) {
    btn.innerHTML     = '⏱ يعمل';
    btn.style.opacity = '0.65';
    btn.style.cursor  = 'not-allowed';
    if (reset) reset.disabled = true;
  } else {
    btn.innerHTML     = '▶ ابدأ <kbd>Space</kbd>';
    btn.style.opacity = '';
    btn.style.cursor  = '';
    if (reset) reset.disabled = false;
  }
}

function onIntervalEnd() { /* لم يعد يُستخدم مباشرة */ }

/**
 * Page Visibility API — التايمر يستمر حتى خارج التبويب
 * نحسب الوقت المنقضي عند العودة بدلاً من الإيقاف
 */
let _hiddenAt = null;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _hiddenAt = Date.now();
  } else {
    if (_hiddenAt !== null && state.running) {
      const elapsed = Math.floor((Date.now() - _hiddenAt) / 1000);
      _hiddenAt = null;

      let remaining = state.remaining - elapsed;
      let extra     = 0;

      while (remaining <= 0) {
        extra++;
        remaining += state.totalSeconds;
        state.intervalNum++;
      }

      state.remaining = remaining;
      document.getElementById('intervalNum').textContent = state.intervalNum;
      updateTimerDisplay();
      updateRing();

      if (extra > 0) {
        for (let i = 0; i < extra; i++) popupQueue.push(Date.now());
        playIntervalSound();
        sendNotification();
        drainPopupQueue();
      }
    }
    _hiddenAt = null;
  }
});

// ==========================================
// 5. تحديث واجهة التايمر الرئيسي
// ==========================================

function updateTimerDisplay() {
  const m = Math.floor(state.remaining / 60);
  const s = state.remaining % 60;
  document.getElementById('timerDisplay').textContent = `${fmt2(m)}:${fmt2(s)}`;
}

function updateRing() {
  const elapsed = state.totalSeconds - state.remaining;
  const offset  = 596.9 - (elapsed / state.totalSeconds) * 596.9;
  document.getElementById('ringProgress').setAttribute('stroke-dashoffset', offset);
}

function updateClock() {
  const now = new Date();
  document.getElementById('currentTime').textContent =
    now.toLocaleTimeString('ar-IQ', { hour12: true });
  document.getElementById('currentDate').textContent =
    now.toLocaleDateString('ar-IQ', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// ==========================================
// 6. البوب آب واختيار النشاط
// ==========================================

function showActivityPopup() {
  popupOpen = true;
  state.activePopup = 'activity';

  const pending  = popupQueue.length;
  const subtitle = document.getElementById('popupPending');
  if (subtitle) {
    if (pending > 0) {
      subtitle.textContent = `⚠️ ${pending + 1} إنتيرفال انتهت — اختر للأول`;
      subtitle.className   = 'urgent';
    } else {
      subtitle.textContent = 'انتهى إنتيرفال 10 دقائق!';
      subtitle.className   = '';
    }
  }

  document.getElementById('overlay').classList.add('active');
  document.getElementById('popup').classList.add('active');
  document.getElementById('customInputWrap').classList.remove('visible');
  document.getElementById('customActivity').value = '';
}

function hideActivityPopup() {
  popupOpen = false;
  state.activePopup = null;

  const overlay = document.getElementById('overlay');
  document.getElementById('popup').classList.remove('active');

  // انتظر انتهاء الترانزيشن (.35s) ثم افتح التالي أو أغلق الأوفرلاي
  setTimeout(() => {
    if (popupQueue.length > 0) {
      drainPopupQueue(); // الأوفرلاي يبقى active
    } else {
      overlay.classList.remove('active');
    }
  }, 380);
}

function selectActivity(activityName, durationMinutes = 10) {
  const now       = new Date();
  const endTime   = fmtTime12(now);
  const startD    = new Date(now.getTime() - durationMinutes * 60000);
  const startTime = fmtTime12(startD);

  state.currentSession.push({
    activity:  activityName,
    start:     startTime,
    end:       endTime,
    duration:  durationMinutes,
    timestamp: now.getTime(),
    color:     COLORS[activityName] || COLORS['أخرى'],
  });

  saveTodayData();
  renderRecent();
  updateGoalBar();
  hideActivityPopup();
  // ملاحظة: التايمر يستمر — لا نستدعي startTimer هنا
}

// ==========================================
// 7. الصوت
// ==========================================

function getAudioCtx() {
  if (!sprint.audioCtx) {
    sprint.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sprint.audioCtx;
}

/* صوت انتهاء الإنتيرفال الرئيسي */
function playIntervalSound() {
  try {
    const ctx   = getAudioCtx();
    const now   = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.4);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.45);
    });
  } catch (e) {}
}

/**
 * صوت السبرينت — نبضة هادئة كل ثانية تشبه دقات الساعة
 * استخدم صوت "woodblock" مُحاكى: نبضة قصيرة جداً بتردد منخفض
 */
function playSprintTick(isEven) {
  try {
    const ctx  = getAudioCtx();
    const now  = ctx.currentTime;

    // Woodblock مُحاكى: نبضتان بترددات مختلفة قليلاً
    const freq = isEven ? 480 : 420;

    const osc    = ctx.createOscillator();
    const gain   = ctx.createGain();
    // فلتر لجعل الصوت أكثر دفئاً
    const filter = ctx.createBiquadFilter();
    filter.type            = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value         = 2;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.type            = 'square';
    osc.frequency.value = freq;

    // هجوم سريع جداً + تلاشٍ سريع = نبضة حادة
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {}
}

/* نغمة لطيفة عند اكتمال كل دقيقة في السبرينت */
function playSprintMinuteBell() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    // نغمة واحدة ناعمة
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type            = 'sine';
    osc.frequency.value = 528; // تردد مريح
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.start(now); osc.stop(now + 0.85);
  } catch (e) {}
}

/* صوت حفظ الجلسة */
function playSprintSaveSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    [440, 554, 659].forEach((f, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = f;
      gain.gain.setValueAtTime(0.12, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);
      osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.4);
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
    Notification.requestPermission();
  }
}

// ==========================================
// 8. الداش بورد والإحصائيات
// ==========================================

function calcStats(data) {
  const stats = { 'دراسة':0, 'استراحة':0, 'صلاة':0, 'أكل':0, 'تسخيت':0, 'أخرى':0 };
  data.forEach(e => {
    const k = stats.hasOwnProperty(e.activity) ? e.activity : 'أخرى';
    stats[k] += e.duration;
  });
  return stats;
}

function updateDashboard() {
  const data  = getDayData(state.viewDate);
  const today = todayKey();

  document.getElementById('dashDate').textContent =
    state.viewDate === today ? 'اليوم' : formatDate(state.viewDate);
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
  renderSprintDashboard(state.viewDate);
}

function drawPieChart(stats) {
  const canvas = document.getElementById('pieChart');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const total = Object.values(stats).reduce((a,b)=>a+b, 0);
  const surfaceColor = getComputedStyle(document.body).getPropertyValue('--surface').trim();
  const legend = document.getElementById('pieLegend');
  legend.innerHTML = '';

  if (total === 0) {
    ctx.fillStyle = '#666'; ctx.font = '13px Cairo';
    ctx.textAlign = 'center'; ctx.fillText('لا توجد بيانات', W/2, H/2);
    return;
  }

  const cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 18;
  let startAngle = -Math.PI/2;

  Object.entries(stats).forEach(([name, val]) => {
    if (val === 0) return;
    const slice = (val/total) * 2 * Math.PI;
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

    const li = document.createElement('div');
    li.className = 'legend-item';
    li.innerHTML = `<div class="legend-dot" style="background:${COLORS[name]||COLORS['أخرى']}"></div>
                    <span>${name} ${Math.round(val/total*100)}%</span>`;
    legend.appendChild(li);
  });

  // دائرة داخلية (دونات)
  ctx.beginPath();
  ctx.arc(cx, cy, r*0.46, 0, 2*Math.PI);
  ctx.fillStyle = surfaceColor;
  ctx.fill();
}

function drawBarChart(stats) {
  const canvas = document.getElementById('barChart');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const entries = Object.entries(stats).filter(([,v])=>v>0);
  if (entries.length === 0) {
    ctx.fillStyle='#666'; ctx.font='13px Cairo';
    ctx.textAlign='center'; ctx.fillText('لا توجد بيانات', W/2, H/2);
    return;
  }

  const maxVal = Math.max(...entries.map(([,v])=>v));
  const pad    = 20, chartH = H - 50;
  const colW   = (W - pad*2) / entries.length;
  const barW   = Math.min(36, colW*0.6);

  entries.forEach(([name, val], i) => {
    const barH = (val/maxVal) * chartH;
    const x    = pad + i*colW + (colW-barW)/2;
    const y    = chartH - barH + 10;
    const col  = COLORS[name] || COLORS['أخرى'];

    const grad = ctx.createLinearGradient(x, y+barH, x, y);
    grad.addColorStop(0, col+'88'); grad.addColorStop(1, col);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 5); ctx.fill();

    ctx.fillStyle = col; ctx.font = 'bold 10px Cairo';
    ctx.textAlign = 'center'; ctx.fillText(`${val}د`, x+barW/2, y-4);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text3').trim()||'#555';
    ctx.font = '9px Cairo'; ctx.textAlign = 'center';
    ctx.fillText(name.slice(0,4), x+barW/2, H-4);
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
// 9. آخر الأنشطة والهدف
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

function updateGoalBar() {
  const studyMin = state.currentSession
    .filter(e => e.activity === 'دراسة')
    .reduce((s,e) => s+e.duration, 0);
  const pct = Math.min(100, (studyMin/state.goalMinutes)*100);
  document.getElementById('goalProgress').style.width = pct+'%';
  document.getElementById('goalText').textContent = `${studyMin} / ${state.goalMinutes} دقيقة`;
}

function updateGoalDisplay() {
  const h = Math.floor(state.goalMinutes/60);
  const m = state.goalMinutes%60;
  let txt = '';
  if (h>0) txt += `${h} ساعة`;
  if (m>0) txt += ` ${m} دقيقة`;
  document.getElementById('goalDisplay').textContent = txt.trim();
}

// ==========================================
// 9-B. التايم لاين القابل للطي
// ==========================================

let timelineCollapsed = false;

function setupTimelineToggle() {
  const btn = document.getElementById('timelineToggleBtn');
  const hdr = document.getElementById('timelineToggle');
  if (!btn) return;

  const doToggle = () => {
    timelineCollapsed = !timelineCollapsed;
    const tl   = document.getElementById('timeline');
    const icon = document.getElementById('timelineToggleIcon');
    const lbl  = document.getElementById('timelineToggleLabel');
    tl.classList.toggle('collapsed', timelineCollapsed);
    icon.textContent = timelineCollapsed ? '▼' : '▲';
    lbl.textContent  = timelineCollapsed ? 'توسيع' : 'طي';
  };

  btn.addEventListener('click', e => { e.stopPropagation(); doToggle(); });
  hdr.addEventListener('click', doToggle);
}

// ==========================================
// 10. الستريك والسجل
// ==========================================

function updateStreak() {
  const dates = getAllDates().filter(d => getDayData(d).length > 0);
  let streak  = 0;
  let cursor  = new Date(); cursor.setHours(0,0,0,0);
  for (let i=0; i<365; i++) {
    if (dates.includes(localDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate()-1);
    } else break;
  }
  document.getElementById('streakCount').textContent = streak;
}

function renderHistory() {
  const list  = document.getElementById('historyList');
  const today = todayKey();
  const dates = getAllDates().filter(d => getDayData(d).length>0 && d!==today);
  if (dates.length === 0) {
    list.innerHTML = '<p class="empty-msg">لا يوجد سجل بعد</p>';
    return;
  }
  list.innerHTML = '';
  dates.forEach(dateKey => {
    const data     = getDayData(dateKey);
    const stats    = calcStats(data);
    const totalMin = Object.values(stats).reduce((a,b)=>a+b, 0);
    const card     = document.createElement('div');
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
  const [y,m,d] = dateKey.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('ar-IQ',{
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
}

// ==========================================
// 11. الإكسبورت
// ==========================================

function exportCSV() {
  const dates = getAllDates().filter(d => getDayData(d).length>0);
  let csv = 'التاريخ,النشاط,البداية,النهاية,المدة (دقائق)\n';
  dates.forEach(dk => {
    getDayData(dk).forEach(e => {
      csv += `${dk},${e.activity},${e.start},${e.end},${e.duration}\n`;
    });
  });
  // إضافة السبرينت
  csv += '\nتايمر السبرينت\nالتاريخ,البداية,النهاية,المدة (ثواني)\n';
  dates.forEach(dk => {
    getSprintDayData(dk).forEach(e => {
      csv += `${dk},${e.start},${e.end},${e.duration}\n`;
    });
  });
  downloadFile('waqti_data.csv', csv, 'text/csv;charset=utf-8;');
}

function exportJSON() {
  const dates = getAllDates().filter(d => getDayData(d).length>0);
  const all   = {};
  dates.forEach(dk => {
    all[dk] = { activities: getDayData(dk), sprint: getSprintDayData(dk) };
  });
  downloadFile('waqti_data.json', JSON.stringify(all, null, 2), 'application/json');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob(['\uFEFF'+content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href:url, download:filename });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ==========================================
// 12. الثيم والتنقل
// ==========================================

function applyTheme() {
  document.body.classList.toggle('light', !state.darkMode);
  document.body.classList.toggle('dark',   state.darkMode);
  document.getElementById('themeToggle').innerHTML =
    (state.darkMode ? '🌙' : '☀️') + ' <kbd>T</kbd>';
}

function toggleTheme() {
  state.darkMode = !state.darkMode;
  applyTheme(); saveSettings();
  if (document.getElementById('page-dashboard').classList.contains('active')) updateDashboard();
}

function switchTab(tabName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${tabName}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');
  if (tabName === 'dashboard') { state.viewDate = todayKey(); updateDashboard(); }
  else if (tabName === 'history') renderHistory();
}

// ==========================================
// 13. البوب آبات
// ==========================================

function showQuickAdd() {
  state.activePopup = 'quick';
  document.getElementById('overlay').classList.add('active');
  document.getElementById('quickPopup').classList.add('active');
  document.getElementById('quickCustomWrap').classList.remove('visible');
  document.getElementById('quickCustomActivity').value = '';
}

function hideQuickAdd() {
  state.activePopup = null;
  document.getElementById('overlay').classList.remove('active');
  document.getElementById('quickPopup').classList.remove('active');
}

function showExportPopup() {
  state.activePopup = 'export';
  document.getElementById('overlay').classList.add('active');
  document.getElementById('exportPopup').classList.add('active');
}

function hideExportPopup() {
  state.activePopup = null;
  document.getElementById('overlay').classList.remove('active');
  document.getElementById('exportPopup').classList.remove('active');
}

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
// 14. ⚡ تايمر السبرينت — المنطق الكامل
// ==========================================

function sprintToggle() {
  sprint.running ? sprintPause() : sprintStart();
}

function sprintStart() {
  if (sprint.running) return;
  sprint.running   = true;
  sprint.beatCount = 0;
  document.getElementById('sprintWidget').classList.add('sw-running');
  document.getElementById('swStart').innerHTML = '⏸ إيقاف <kbd>S</kbd>';
  document.getElementById('swStatusLabel').textContent = 'يعمل';

  sprint.tickId = setInterval(() => {
    sprint.elapsed++;
    sprint.beatCount++;

    // دقة كل ثانية (تيك-توك)
    playSprintTick(sprint.beatCount % 2 === 0);

    // نغمة كل دقيقة كاملة
    if (sprint.elapsed % 60 === 0) playSprintMinuteBell();

    updateSprintDisplay();
  }, 1000);
}

function sprintPause() {
  if (!sprint.running) return;
  sprint.running = false;
  clearInterval(sprint.tickId); sprint.tickId = null;
  document.getElementById('sprintWidget').classList.remove('sw-running');
  document.getElementById('swStart').innerHTML = '▶ ابدأ <kbd>S</kbd>';
  document.getElementById('swStatusLabel').textContent = 'متوقف';
}

function sprintReset() {
  sprintPause();
  sprint.elapsed = 0;
  updateSprintDisplay();
  document.getElementById('swStatusLabel').textContent = 'جاهز';
}

/**
 * حفظ الجلسة الحالية وإعادة تعيين العداد
 */
function sprintSave() {
  if (sprint.elapsed < 5) return; // تجاهل الجلسات القصيرة جداً

  sprintPause();

  const now       = new Date();
  const endTime   = fmtTime12(now);
  const startD    = new Date(now.getTime() - sprint.elapsed*1000);
  const startTime = fmtTime12(startD);

  const session = {
    start:    startTime,
    end:      endTime,
    duration: sprint.elapsed,
    date:     todayKey(),
  };

  sprint.sessions.push(session);
  saveSprintData();
  playSprintSaveSound();

  // عرض آخر جلسة
  document.getElementById('swLastSession').style.display = 'flex';
  document.getElementById('swLastVal').textContent = secsToDisplay(sprint.elapsed);

  sprint.elapsed = 0;
  updateSprintDisplay();
  updateSprintStats();
  document.getElementById('swStatusLabel').textContent = 'تم الحفظ ✓';
  setTimeout(() => {
    document.getElementById('swStatusLabel').textContent = 'جاهز';
  }, 2000);
}

/** تحديث عرض الوقت الحالي للسبرينت */
function updateSprintDisplay() {
  const s   = sprint.elapsed;
  const m   = Math.floor(s/60);
  const sec = s%60;
  const str = fmt2(m)+':'+fmt2(sec);

  document.getElementById('swTime').textContent     = str;
  document.getElementById('swMiniTime').textContent = str;

  // حلقة SVG تدور كل 60 ثانية
  const circumference = 364.4; // 2π×58
  const progress      = (sec/60);
  const offset        = circumference - progress*circumference;
  document.getElementById('swRingArc').setAttribute('stroke-dashoffset', offset);

  // تحديث بارات الدقائق
  updateMinuteBars();
}

/** بارات الدقائق المنجزة — تُظهر كم دقيقة انتهت */
function updateMinuteBars() {
  const container   = document.getElementById('swMinuteBars');
  const totalMins   = Math.floor(sprint.elapsed/60);
  const secInMin    = sprint.elapsed%60;
  const BARS_SHOWN  = 12; // نعرض آخر 12 دقيقة

  container.innerHTML = '';

  for (let i=0; i<BARS_SHOWN; i++) {
    const bar = document.createElement('div');
    bar.className = 'sw-min-bar';

    const minIndex = Math.max(0, totalMins - BARS_SHOWN + 1) + i;

    if (minIndex < totalMins) {
      // دقيقة مكتملة — ارتفاع 100%
      bar.classList.add('filled');
      bar.style.height = '28px';
    } else if (minIndex === totalMins && sprint.running) {
      // الدقيقة الحالية — ارتفاع نسبي
      bar.classList.add('current');
      const h = Math.max(4, Math.round((secInMin/60)*28));
      bar.style.height = h+'px';
    } else {
      // فارغ
      bar.style.height = '4px';
    }

    container.appendChild(bar);
  }
}

/** تحديث الإحصائيات في الويدجيت */
function updateSprintStats() {
  const todaySessions = sprint.sessions.filter(s => s.date === todayKey());
  const totalSec      = todaySessions.reduce((sum,s) => sum+s.duration, 0);
  const bestSec       = todaySessions.reduce((mx,s)  => Math.max(mx,s.duration), 0);
  const avgSec        = todaySessions.length ? Math.round(totalSec/todaySessions.length) : 0;

  document.getElementById('swStatTotal').textContent = secsToDisplay(totalSec);
  document.getElementById('swStatCount').textContent = todaySessions.length;
  document.getElementById('swStatBest').textContent  = secsToDisplay(bestSec);
  document.getElementById('swStatAvg').textContent   = secsToDisplay(avgSec);

  // بروجريس بار الهدف
  const goalSec = sprint.goalMin * 60;
  const pct     = Math.min(100, (totalSec/goalSec)*100);
  document.getElementById('swGoalFill').style.width = pct+'%';
  document.getElementById('swGoalText').textContent =
    `${secsToDisplay(totalSec)} / ${sprint.goalMin} دقيقة`;

  // آخر جلسة
  if (todaySessions.length > 0) {
    const last = todaySessions[todaySessions.length-1];
    document.getElementById('swLastSession').style.display = 'flex';
    document.getElementById('swLastVal').textContent =
      `${last.start}–${last.end} (${secsToDisplay(last.duration)})`;
  }
}

/** تحويل الثواني إلى نص عرض */
function secsToDisplay(secs) {
  const m = Math.floor(secs/60);
  const s = secs%60;
  if (m >= 60) {
    const h = Math.floor(m/60);
    return `${h}:${fmt2(m%60)} س`;
  }
  return `${m}:${fmt2(s)}`;
}

// ==========================================
// 15. إحصائيات السبرينت في الداش بورد
// ==========================================

function renderSprintDashboard(dateKey) {
  const sessions  = getSprintDayData(dateKey);
  const section   = document.getElementById('sprintDashSection');

  if (sessions.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const totalSec  = sessions.reduce((s,x) => s+x.duration, 0);
  const bestSec   = sessions.reduce((mx,x) => Math.max(mx,x.duration), 0);
  const avgSec    = Math.round(totalSec/sessions.length);

  document.getElementById('sd-total').textContent = secsToDisplay(totalSec);
  document.getElementById('sd-count').textContent = sessions.length;
  document.getElementById('sd-best').textContent  = secsToDisplay(bestSec);
  document.getElementById('sd-avg').textContent   = secsToDisplay(avgSec);

  drawSprintBarChart(sessions);
  renderSprintTimeline(sessions);
}

function drawSprintBarChart(sessions) {
  const canvas = document.getElementById('sprintBarChart');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (sessions.length === 0) return;

  const maxSec = Math.max(...sessions.map(s => s.duration));
  const pad    = 15, chartH = H - 40;
  const colW   = (W - pad*2) / sessions.length;
  const barW   = Math.min(32, colW*0.6);

  sessions.forEach((sess, i) => {
    const barH = (sess.duration/maxSec)*chartH;
    const x    = pad + i*colW + (colW-barW)/2;
    const y    = chartH - barH + 10;

    const grad = ctx.createLinearGradient(x, y+barH, x, y);
    grad.addColorStop(0, '#22d3ee55');
    grad.addColorStop(1, '#4ade80');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 5); ctx.fill();

    ctx.fillStyle = '#4ade80'; ctx.font = 'bold 9px Cairo';
    ctx.textAlign = 'center';
    ctx.fillText(secsToDisplay(sess.duration), x+barW/2, y-4);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text3').trim()||'#555';
    ctx.font = '8px Cairo'; ctx.textAlign = 'center';
    ctx.fillText(`#${i+1}`, x+barW/2, H-5);
  });
}

function renderSprintTimeline(sessions) {
  const container = document.getElementById('sprintTimeline');
  container.innerHTML = '';
  sessions.forEach((sess, i) => {
    const div = document.createElement('div');
    div.className = 'tl-item';
    div.style.setProperty('--c', '#4ade80');
    div.innerHTML = `
      <span class="tl-time">${sess.start} ← ${sess.end}</span>
      <span class="tl-act">جلسة #${i+1}</span>
      <span class="tl-dur">${secsToDisplay(sess.duration)}</span>`;
    container.appendChild(div);
  });
}

// ==========================================
// 16. الويدجيت القابل للسحب
// ==========================================

function setupSprintDrag() {
  const widget = document.getElementById('sprintWidget');
  const handle = document.getElementById('swHeader');
  let dragging = false, ox = 0, oy = 0;

  const onDown = (cx, cy) => {
    dragging = true;
    const rect = widget.getBoundingClientRect();
    ox = cx - rect.left; oy = cy - rect.top;
    widget.style.transition = 'none';
  };
  const onMove = (cx, cy) => {
    if (!dragging) return;
    let x = Math.max(0, Math.min(window.innerWidth  - widget.offsetWidth,  cx - ox));
    let y = Math.max(0, Math.min(window.innerHeight - widget.offsetHeight, cy - oy));
    widget.style.left = x+'px'; widget.style.top = y+'px';
    widget.style.bottom = 'auto'; widget.style.right = 'auto';
  };
  const onUp = () => { dragging = false; widget.style.transition = ''; };

  handle.addEventListener('mousedown',  e => onDown(e.clientX, e.clientY));
  document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  document.addEventListener('mouseup',   onUp);

  handle.addEventListener('touchstart',  e => { onDown(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive:false });
  document.addEventListener('touchmove',  e => { if(dragging){onMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault();} }, { passive:false });
  document.addEventListener('touchend',   onUp);
}

function sprintMinimize() {
  sprint.minimized = true;
  document.getElementById('sprintWidget').classList.add('minimized');
}

function sprintExpand() {
  sprint.minimized = false;
  document.getElementById('sprintWidget').classList.remove('minimized');
}

// ==========================================
// 17. نظام الكيبورد الكامل
// ==========================================

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    const tag     = document.activeElement.tagName.toLowerCase();
    const isInput = tag==='input' || tag==='textarea';

    /* ========= Escape — يعمل دائماً ========= */
    if (e.key === 'Escape') {
      if (state.activePopup === 'quick')     { hideQuickAdd();     return; }
      if (state.activePopup === 'export')    { hideExportPopup();  return; }
      if (state.activePopup === 'shortcuts') { hideShortcuts();    return; }
      return;
    }

    if (isInput) return; // لا اختصارات داخل الإن بوت

    /* ========= بوب آب النشاط مفتوح ========= */
    if (state.activePopup === 'activity' || state.activePopup === 'quick') {
      if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const activity = ACTIVITY_KEYS[parseInt(e.key)-1];
        const isQuick  = state.activePopup === 'quick';
        if (activity === 'أخرى') {
          const wrapId  = isQuick ? 'quickCustomWrap'  : 'customInputWrap';
          const inputId = isQuick ? 'quickCustomActivity' : 'customActivity';
          document.getElementById(wrapId).classList.add('visible');
          document.getElementById(inputId).focus();
        } else {
          if (isQuick) {
            const dur = parseInt(document.getElementById('quickDuration').value)||10;
            hideQuickAdd(); selectActivity(activity, dur);
          } else {
            hideActivityPopup(); selectActivity(activity);
          }
        }
        return;
      }
    }

    /* ========= بوب آب الإكسبورت مفتوح ========= */
    if (state.activePopup === 'export') {
      if (e.key==='c'||e.key==='C') { exportCSV(); return; }
      if (e.key==='j'||e.key==='J') { exportJSON(); return; }
      return;
    }

    /* ========= لا بوب آب مفتوح ========= */

    // Space — يبدأ التايمر فقط، لا يوقفه
    if (e.code==='Space'||e.key===' ') {
      e.preventDefault();
      if (!state.running) startTimer();
      return;
    }

    // Alt+رقم — التنقل
    if (e.altKey) {
      if (e.key==='1') { e.preventDefault(); switchTab('timer');     return; }
      if (e.key==='2') { e.preventDefault(); switchTab('dashboard'); return; }
      if (e.key==='3') { e.preventDefault(); switchTab('history');   return; }
    }

    // أسهم — التنقل بين أيام الداش بورد
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      if (e.key==='ArrowLeft')  { e.preventDefault(); state.viewDate=shiftDate(state.viewDate,-1); updateDashboard(); return; }
      if (e.key==='ArrowRight') {
        e.preventDefault();
        const next=shiftDate(state.viewDate,+1);
        if (next<=todayKey()) { state.viewDate=next; updateDashboard(); }
        return;
      }
    }

    // R — ريست (فقط قبل البدء)
    if (e.key==='r'||e.key==='R') { if (!state.running) resetTimer(); return; }

    // Q — إضافة سريعة
    if (e.key==='q'||e.key==='Q') { showQuickAdd(); return; }

    // S — تايمر السبرينت ابدأ/إيقاف
    if (e.key==='s'||e.key==='S') { e.preventDefault(); sprintToggle(); return; }

    // X — حفظ جلسة السبرينت
    if (e.key==='x'||e.key==='X') { e.preventDefault(); sprintSave(); return; }

    // Z — ريست السبرينت
    if (e.key==='z'||e.key==='Z') { e.preventDefault(); sprintReset(); return; }

    // M — تصغير/توسيع ويدجيت السبرينت
    if (e.key==='m'||e.key==='M') {
      e.preventDefault();
      sprint.minimized ? sprintExpand() : sprintMinimize();
      return;
    }

    // T — تبديل الثيم
    if (e.key==='t'||e.key==='T') { toggleTheme(); return; }

    // E — الإكسبورت
    if (e.key==='e'||e.key==='E') { showExportPopup(); return; }

    // H — لوحة الاختصارات
    if (e.key==='h'||e.key==='H') {
      state.activePopup==='shortcuts' ? hideShortcuts() : showShortcuts();
      return;
    }

    // + / - — تغيير الهدف
    if (e.key==='+'||e.key==='=') {
      state.goalMinutes=Math.min(720,state.goalMinutes+30);
      updateGoalDisplay(); updateGoalBar(); saveSettings(); return;
    }
    if (e.key==='-'||e.key==='_') {
      state.goalMinutes=Math.max(30,state.goalMinutes-30);
      updateGoalDisplay(); updateGoalBar(); saveSettings(); return;
    }

    // C/J مباشرة (بدون بوب آب)
    if (!state.activePopup) {
      if (e.key==='c'||e.key==='C') { exportCSV(); return; }
      if (e.key==='j'||e.key==='J') { exportJSON(); return; }
    }
  });
}

// ==========================================
// 18. ربط أحداث الواجهة
// ==========================================

function setupEventListeners() {

  /* ---- التايمر الرئيسي ---- */
  document.getElementById('startBtn').addEventListener('click', toggleTimer);
  document.getElementById('resetBtn').addEventListener('click', resetTimer);
  document.getElementById('quickAddBtn').addEventListener('click', showQuickAdd);

  /* ---- التابس ---- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  /* ---- التوب بار ---- */
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('exportBtn').addEventListener('click', showExportPopup);
  document.getElementById('helpBtn').addEventListener('click', showShortcuts);

  /* ---- داش بورد أيام ---- */
  document.getElementById('prevDay').addEventListener('click', () => {
    state.viewDate = shiftDate(state.viewDate, -1); updateDashboard();
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    const next = shiftDate(state.viewDate, +1);
    if (next <= todayKey()) { state.viewDate = next; updateDashboard(); }
  });

  /* ---- الهدف ---- */
  document.getElementById('goalPlus').addEventListener('click', () => {
    state.goalMinutes=Math.min(720,state.goalMinutes+30);
    updateGoalDisplay(); updateGoalBar(); saveSettings();
  });
  document.getElementById('goalMinus').addEventListener('click', () => {
    state.goalMinutes=Math.max(30,state.goalMinutes-30);
    updateGoalDisplay(); updateGoalBar(); saveSettings();
  });

  /* ---- بوب آب النشاط ---- */
  document.querySelectorAll('#popup .act-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.activity==='أخرى') {
        document.getElementById('customInputWrap').classList.add('visible');
        document.getElementById('customActivity').focus();
      } else {
        hideActivityPopup(); selectActivity(btn.dataset.activity);
      }
    });
  });
  document.getElementById('confirmCustom').addEventListener('click', () => {
    const val = document.getElementById('customActivity').value.trim();
    if (val) { hideActivityPopup(); selectActivity(val); }
  });
  document.getElementById('customActivity').addEventListener('keydown', e => {
    if (e.key==='Enter') document.getElementById('confirmCustom').click();
  });

  /* ---- الإضافة السريعة ---- */
  document.querySelectorAll('#quickPopup .act-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dur = parseInt(document.getElementById('quickDuration').value)||10;
      if (btn.dataset.activity==='أخرى') {
        document.getElementById('quickCustomWrap').classList.add('visible');
        document.getElementById('quickCustomActivity').focus();
      } else {
        hideQuickAdd(); selectActivity(btn.dataset.activity, dur);
      }
    });
  });
  document.getElementById('confirmQuickCustom').addEventListener('click', () => {
    const val = document.getElementById('quickCustomActivity').value.trim();
    const dur = parseInt(document.getElementById('quickDuration').value)||10;
    if (val) { hideQuickAdd(); selectActivity(val, dur); }
  });
  document.getElementById('quickCustomActivity').addEventListener('keydown', e => {
    if (e.key==='Enter') document.getElementById('confirmQuickCustom').click();
  });
  document.getElementById('closeQuickPopup').addEventListener('click', hideQuickAdd);

  /* ---- الإكسبورت ---- */
  document.getElementById('exportCSVBtn').addEventListener('click', exportCSV);
  document.getElementById('exportJSONBtn').addEventListener('click', exportJSON);
  document.getElementById('closeExport').addEventListener('click', hideExportPopup);

  /* ---- الاختصارات ---- */
  document.getElementById('closeShortcuts').addEventListener('click', hideShortcuts);
  document.getElementById('shortcutsOverlay').addEventListener('click', hideShortcuts);

  /* ---- الأوفرلاي — بوب آب النشاط إجباري لا يُغلق بالنقر ---- */
  document.getElementById('overlay').addEventListener('click', () => {
    if (state.activePopup==='quick')  { hideQuickAdd();    return; }
    if (state.activePopup==='export') { hideExportPopup(); return; }
    // state.activePopup === 'activity' → لا نغلقه، إجباري
  });

  /* ---- ألوان أزرار النشاط ---- */
  document.querySelectorAll('.act-btn').forEach(btn => {
    if (btn.dataset.color) btn.style.setProperty('--c', btn.dataset.color);
  });

  /* ---- تايمر السبرينت ---- */
  document.getElementById('swStart').addEventListener('click', sprintToggle);
  document.getElementById('swSave').addEventListener('click', sprintSave);
  document.getElementById('swReset').addEventListener('click', sprintReset);
  document.getElementById('swMinimize').addEventListener('click', sprintMinimize);
  document.getElementById('swExpand').addEventListener('click', sprintExpand);

  /* ---- إذن الإشعارات ---- */
  document.getElementById('startBtn').addEventListener('click', () => {
    if ('Notification' in window && Notification.permission==='default') {
      Notification.requestPermission();
    }
  }, { once:true });
}

// ==========================================
// 19. التهيئة النهائية
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadTodayData();
  loadSprintData();
  updateClock();
  setInterval(updateClock, 1000);
  renderRecent();
  updateGoalBar();
  updateStreak();
  setupEventListeners();
  setupKeyboard();
  setupSprintDrag();
  setupTimelineToggle();
  updateTimerDisplay();
  updateRing();
  updateSprintDisplay();
  updateMinuteBars();

  if ('Notification' in window && Notification.permission==='default') {
    Notification.requestPermission();
  }
});
