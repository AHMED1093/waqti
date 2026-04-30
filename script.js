/**
 * =============================================
 * متتبع الوقت اليومي - الملف الرئيسي
 * Daily Time Tracker - script.js
 * =============================================
 */

// ==========================================
// 1. المتغيرات الأساسية (State Variables)
// ==========================================

/** حالة التايمر الرئيسية */
const state = {
  running: false,           // هل التايمر يعمل الآن؟
  totalSeconds: 600,        // 10 دقائق = 600 ثانية
  remaining: 600,           // الثواني المتبقية في الإنتيرفال الحالي
  intervalNum: 1,           // رقم الإنتيرفال الحالي
  currentSession: [],       // أنشطة اليوم الحالي
  viewDate: todayKey(),     // التاريخ المعروض في الداش بورد
  goalMinutes: 180,         // هدف الدراسة اليومي (3 ساعات افتراضي)
  darkMode: true,           // الوضع الداكن
};

/** المؤقت الرئيسي (Interval ID) */
let timerTick = null;

/** ألوان الأنشطة */
const COLORS = {
  'دراسة':   '#4ade80',
  'استراحة': '#60a5fa',
  'صلاة':    '#f59e0b',
  'أكل':     '#f97316',
  'تسخيت':   '#f43f5e',
  'أخرى':    '#a78bfa',
};

/** مفتاح اللوكال ستوريج لليوم الحالي */
function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ==========================================
// 2. تهيئة التطبيق عند التحميل
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
  injectSVGDefs();
  setActivityColors();
});

/** حقن تعريف الجراديينت داخل الـ SVG */
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

/** ضبط ألوان CSS لكل زر نشاط */
function setActivityColors() {
  document.querySelectorAll('.act-btn').forEach(btn => {
    const color = btn.dataset.color;
    if (color) btn.style.setProperty('--c', color);
  });
}

// ==========================================
// 3. تحميل وحفظ البيانات (LocalStorage)
// ==========================================

/** تحميل إعدادات المستخدم */
function loadSettings() {
  const saved = localStorage.getItem('waqti_settings');
  if (saved) {
    const s = JSON.parse(saved);
    state.darkMode = s.darkMode ?? true;
    state.goalMinutes = s.goalMinutes ?? 180;
  }
  applyTheme();
  updateGoalDisplay();
}

/** حفظ الإعدادات */
function saveSettings() {
  localStorage.setItem('waqti_settings', JSON.stringify({
    darkMode: state.darkMode,
    goalMinutes: state.goalMinutes,
  }));
}

/** تحميل بيانات اليوم الحالي */
function loadTodayData() {
  const key = `waqti_${todayKey()}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    state.currentSession = JSON.parse(saved);
  } else {
    state.currentSession = [];
  }
}

/** حفظ بيانات اليوم */
function saveTodayData() {
  const key = `waqti_${todayKey()}`;
  localStorage.setItem(key, JSON.stringify(state.currentSession));
  updateStreak();
}

/** جلب بيانات يوم معين */
function getDayData(dateKey) {
  const saved = localStorage.getItem(`waqti_${dateKey}`);
  return saved ? JSON.parse(saved) : [];
}

/** جلب كل التواريخ المحفوظة */
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
// 4. منطق التايمر الأساسي
// ==========================================

/** بدء أو إيقاف التايمر */
function toggleTimer() {
  if (state.running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

/** بدء التايمر */
function startTimer() {
  if (state.running) return;
  state.running = true;
  document.body.classList.add('running');
  document.getElementById('startBtn').textContent = '⏸ إيقاف';

  timerTick = setInterval(() => {
    state.remaining--;
    updateTimerDisplay();
    updateRing();

    if (state.remaining <= 0) {
      // انتهى الإنتيرفال
      clearInterval(timerTick);
      timerTick = null;
      state.running = false;
      document.body.classList.remove('running');
      onIntervalEnd();
    }
  }, 1000);
}

/** إيقاف التايمر مؤقتًا */
function pauseTimer() {
  if (!state.running) return;
  state.running = false;
  document.body.classList.remove('running');
  clearInterval(timerTick);
  timerTick = null;
  document.getElementById('startBtn').textContent = '▶ استكمال';
}

/** إعادة تعيين التايمر */
function resetTimer() {
  pauseTimer();
  state.remaining = state.totalSeconds;
  state.intervalNum = 1;
  updateTimerDisplay();
  updateRing();
  document.getElementById('startBtn').textContent = '▶ ابدأ';
  document.getElementById('intervalNum').textContent = state.intervalNum;
}

/** عند انتهاء كل إنتيرفال */
function onIntervalEnd() {
  playSound();
  sendNotification();
  showActivityPopup();
}

// ==========================================
// 5. تحديث واجهة التايمر
// ==========================================

/** تحديث عرض الوقت */
function updateTimerDisplay() {
  const m = Math.floor(state.remaining / 60);
  const s = state.remaining % 60;
  document.getElementById('timerDisplay').textContent =
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** تحديث حلقة الدائرة */
function updateRing() {
  const total = state.totalSeconds;
  const elapsed = total - state.remaining;
  const circumference = 596.9; // 2 * π * 95
  const offset = circumference - (elapsed / total) * circumference;
  const ring = document.getElementById('ringProgress');
  ring.setAttribute('stroke-dashoffset', offset);
}

/** تحديث الساعة الحالية */
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-IQ', { hour12: true });
  const dateStr = now.toLocaleDateString('ar-IQ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('currentTime').textContent = timeStr;
  document.getElementById('currentDate').textContent = dateStr;
}

// ==========================================
// 6. البوب آب واختيار النشاط
// ==========================================

/** إظهار البوب آب */
function showActivityPopup() {
  document.getElementById('overlay').classList.add('active');
  const popup = document.getElementById('popup');
  popup.style.display = 'block';
  requestAnimationFrame(() => popup.classList.add('active'));
  // إخفاء حقل الإدخال المخصص
  document.getElementById('customInputWrap').classList.remove('visible');
  document.getElementById('customActivity').value = '';
}

/** إخفاء البوب آب */
function hideActivityPopup() {
  document.getElementById('overlay').classList.remove('active');
  const popup = document.getElementById('popup');
  popup.classList.remove('active');
  setTimeout(() => popup.style.display = 'none', 350);
}

/** تسجيل النشاط عند الاختيار */
function selectActivity(activityName, durationMinutes = 10) {
  const now = new Date();
  const endTime = now.toLocaleTimeString('ar-IQ', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const startMs = now.getTime() - durationMinutes * 60000;
  const startDate = new Date(startMs);
  const startTime = startDate.toLocaleTimeString('ar-IQ', { hour12: false, hour: '2-digit', minute: '2-digit' });

  const entry = {
    activity: activityName,
    start: startTime,
    end: endTime,
    duration: durationMinutes,
    timestamp: now.getTime(),
    color: COLORS[activityName] || COLORS['أخرى'],
  };

  state.currentSession.push(entry);
  saveTodayData();
  renderRecent();
  updateGoalBar();

  // ابدأ الإنتيرفال التالي تلقائيًا
  state.remaining = state.totalSeconds;
  state.intervalNum++;
  document.getElementById('intervalNum').textContent = state.intervalNum;
  updateTimerDisplay();
  updateRing();
  startTimer();
}

// ==========================================
// 7. الصوت والإشعارات
// ==========================================

/** تشغيل صوت تنبيه بدون ملفات خارجية */
function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784]; // دو، مي، صول
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
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
  } catch (e) {
    console.log('الصوت غير متاح');
  }
}

/** إرسال إشعار Notification */
function sendNotification() {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('⏰ وقتي - انتهى الإنتيرفال!', {
        body: 'ماذا كنت تفعل في آخر 10 دقائق؟',
        icon: '⏱',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') sendNotification();
      });
    }
  }
}

// ==========================================
// 8. Page Visibility API - إدارة التبويب
// ==========================================

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // المستخدم خرج من التبويب - أوقف التايمر
    if (state.running) {
      pauseTimer();
      state._wasRunning = true;
    }
  } else {
    // عاد المستخدم - أكمل التايمر
    if (state._wasRunning) {
      state._wasRunning = false;
      startTimer();
    }
  }
});

// ==========================================
// 9. الداش بورد والإحصائيات
// ==========================================

/** حساب إجمالي الوقت لكل نشاط */
function calcStats(data) {
  const stats = { 'دراسة': 0, 'استراحة': 0, 'صلاة': 0, 'أكل': 0, 'تسخيت': 0, 'أخرى': 0 };
  data.forEach(entry => {
    const key = stats.hasOwnProperty(entry.activity) ? entry.activity : 'أخرى';
    stats[key] += entry.duration;
  });
  return stats;
}

/** تحديث الداش بورد */
function updateDashboard() {
  const data = getDayData(state.viewDate);

  // تحديث التاريخ المعروض
  if (state.viewDate === todayKey()) {
    document.getElementById('dashDate').textContent = 'اليوم';
  } else {
    document.getElementById('dashDate').textContent = formatDate(state.viewDate);
  }

  const stats = calcStats(data);

  // تحديث البطاقات
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

/** رسم الباي شارت باستخدام الكانفاس */
function drawPieChart(stats) {
  const canvas = document.getElementById('pieChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  if (total === 0) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#555';
    ctx.font = '14px Cairo';
    ctx.textAlign = 'center';
    ctx.fillText('لا توجد بيانات', W / 2, H / 2);
    return;
  }

  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 20;
  let startAngle = -Math.PI / 2;
  const legend = document.getElementById('pieLegend');
  legend.innerHTML = '';

  Object.entries(stats).forEach(([name, val]) => {
    if (val === 0) return;
    const slice = (val / total) * 2 * Math.PI;

    // رسم القطعة
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = COLORS[name] || COLORS['أخرى'];
    ctx.fill();

    // فجوة بيضاء بين القطع
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#1e2334';
    ctx.lineWidth = 3;
    ctx.stroke();

    startAngle += slice;

    // الأسطورة (legend)
    const pct = Math.round((val / total) * 100);
    const li = document.createElement('div');
    li.className = 'legend-item';
    li.innerHTML = `<div class="legend-dot" style="background:${COLORS[name]}"></div>
                    <span>${name} ${pct}%</span>`;
    legend.appendChild(li);
  });

  // دائرة داخلية بيضاء (دونات)
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.48, 0, 2 * Math.PI);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#1e2334';
  ctx.fill();
}

/** رسم البار شارت باستخدام الكانفاس */
function drawBarChart(stats) {
  const canvas = document.getElementById('barChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const entries = Object.entries(stats).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    ctx.fillStyle = '#555';
    ctx.font = '14px Cairo';
    ctx.textAlign = 'center';
    ctx.fillText('لا توجد بيانات', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...entries.map(([, v]) => v));
  const barW = Math.min(40, (W - 40) / entries.length - 10);
  const chartH = H - 50;
  const padLeft = 10;

  entries.forEach(([name, val], i) => {
    const barH = (val / maxVal) * chartH;
    const x = padLeft + i * ((W - padLeft * 2) / entries.length) + (((W - padLeft * 2) / entries.length) - barW) / 2;
    const y = chartH - barH + 10;

    // الشريط
    const grad = ctx.createLinearGradient(x, y + barH, x, y);
    const col = COLORS[name] || COLORS['أخرى'];
    grad.addColorStop(0, col + '99');
    grad.addColorStop(1, col);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 6);
    ctx.fill();

    // القيمة فوق الشريط
    ctx.fillStyle = col;
    ctx.font = 'bold 11px Cairo';
    ctx.textAlign = 'center';
    ctx.fillText(`${val}د`, x + barW / 2, y - 5);

    // اسم النشاط تحت
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text3').trim() || '#555';
    ctx.font = '10px Cairo';
    ctx.textAlign = 'center';
    const shortName = name.slice(0, 4);
    ctx.fillText(shortName, x + barW / 2, H - 5);
  });
}

/** رسم التايم لاين */
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
      <span class="tl-dur">${entry.duration} د</span>
    `;
    container.appendChild(div);
  });
}

// ==========================================
// 10. آخر الأنشطة في صفحة التايمر
// ==========================================

/** عرض آخر 5 أنشطة */
function renderRecent() {
  const list = document.getElementById('recentList');
  const data = state.currentSession.slice(-5).reverse();

  if (data.length === 0) {
    list.innerHTML = '<p class="empty-msg">لا توجد أنشطة بعد. اضغط ابدأ!</p>';
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
      <span class="act-dur">${entry.duration} د</span>
    `;
    list.appendChild(div);
  });
}

// ==========================================
// 11. الهدف اليومي وشريط التقدم
// ==========================================

/** تحديث شريط هدف الدراسة */
function updateGoalBar() {
  const studyMinutes = state.currentSession
    .filter(e => e.activity === 'دراسة')
    .reduce((sum, e) => sum + e.duration, 0);

  const pct = Math.min(100, (studyMinutes / state.goalMinutes) * 100);
  document.getElementById('goalProgress').style.width = pct + '%';
  document.getElementById('goalText').textContent = `${studyMinutes} / ${state.goalMinutes} دقيقة`;
}

/** تحديث عرض الهدف */
function updateGoalDisplay() {
  const h = Math.floor(state.goalMinutes / 60);
  const m = state.goalMinutes % 60;
  let txt = '';
  if (h > 0) txt += `${h} ساعة`;
  if (m > 0) txt += ` ${m} دقيقة`;
  document.getElementById('goalDisplay').textContent = txt.trim();
}

// ==========================================
// 12. نظام الستريك (Streak)
// ==========================================

/** حساب وتحديث عدد الأيام المتتالية */
function updateStreak() {
  const dates = getAllDates().filter(d => getDayData(d).length > 0);
  if (dates.length === 0) {
    document.getElementById('streakCount').textContent = 0;
    return;
  }

  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const key = current.toISOString().slice(0, 10);
    if (dates.includes(key)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  document.getElementById('streakCount').textContent = streak;
}

// ==========================================
// 13. السجل التاريخي
// ==========================================

/** عرض صفحة السجل */
function renderHistory() {
  const list = document.getElementById('historyList');
  const dates = getAllDates().filter(d => getDayData(d).length > 0 && d !== todayKey());

  if (dates.length === 0) {
    list.innerHTML = '<p class="empty-msg">لا يوجد سجل بعد</p>';
    return;
  }

  list.innerHTML = '';
  dates.forEach(dateKey => {
    const data = getDayData(dateKey);
    const stats = calcStats(data);
    const totalMin = Object.values(stats).reduce((a, b) => a + b, 0);
    const studyMin = stats['دراسة'];

    const card = document.createElement('div');
    card.className = 'hist-card';
    card.innerHTML = `
      <div>
        <div class="hist-date">${formatDate(dateKey)}</div>
        <div class="hist-summary">📚 ${studyMin}د دراسة • المجموع: ${totalMin}د • ${data.length} إنتيرفال</div>
      </div>
      <span class="hist-arrow">◀</span>
    `;
    card.addEventListener('click', () => {
      state.viewDate = dateKey;
      switchTab('dashboard');
      updateDashboard();
    });
    list.appendChild(card);
  });
}

/** تنسيق التاريخ للعرض */
function formatDate(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ==========================================
// 14. تصدير البيانات (Export)
// ==========================================

/** تصدير بصيغة CSV */
function exportCSV() {
  const dates = getAllDates().filter(d => getDayData(d).length > 0);
  let csv = 'التاريخ,النشاط,البداية,النهاية,المدة (دقائق)\n';

  dates.forEach(dateKey => {
    getDayData(dateKey).forEach(entry => {
      csv += `${dateKey},${entry.activity},${entry.start},${entry.end},${entry.duration}\n`;
    });
  });

  downloadFile('waqti_data.csv', csv, 'text/csv;charset=utf-8;');
}

/** تصدير بصيغة JSON */
function exportJSON() {
  const dates = getAllDates().filter(d => getDayData(d).length > 0);
  const allData = {};
  dates.forEach(dateKey => {
    allData[dateKey] = getDayData(dateKey);
  });

  downloadFile('waqti_data.json', JSON.stringify(allData, null, 2), 'application/json');
}

/** تنزيل ملف */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// 15. الثيم (Dark/Light Mode)
// ==========================================

/** تطبيق الثيم */
function applyTheme() {
  document.body.classList.toggle('light', !state.darkMode);
  document.body.classList.toggle('dark', state.darkMode);
  document.getElementById('themeToggle').textContent = state.darkMode ? '🌙' : '☀️';
}

/** تبديل الثيم */
function toggleTheme() {
  state.darkMode = !state.darkMode;
  applyTheme();
  saveSettings();
  // إعادة رسم الشارتات بعد تغيير الثيم
  if (document.getElementById('page-dashboard').classList.contains('active')) {
    updateDashboard();
  }
}

// ==========================================
// 16. التنقل بين التابس
// ==========================================

/** التبديل بين صفحات التطبيق */
function switchTab(tabName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`page-${tabName}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');

  if (tabName === 'dashboard') {
    state.viewDate = todayKey();
    updateDashboard();
  } else if (tabName === 'history') {
    renderHistory();
  }
}

// ==========================================
// 17. الإضافة السريعة (Quick Add)
// ==========================================

/** إظهار بوب آب الإضافة السريعة */
function showQuickAdd() {
  document.getElementById('overlay').classList.add('active');
  const popup = document.getElementById('quickPopup');
  popup.style.display = 'block';
  requestAnimationFrame(() => popup.classList.add('active'));
  document.getElementById('quickCustomWrap').classList.remove('visible');
}

/** إخفاء بوب آب الإضافة السريعة */
function hideQuickAdd() {
  document.getElementById('overlay').classList.remove('active');
  const popup = document.getElementById('quickPopup');
  popup.classList.remove('active');
  setTimeout(() => popup.style.display = 'none', 350);
}

// ==========================================
// 18. ربط الأحداث (Event Listeners)
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

  // — الثيم —
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // — الداش بورد: التنقل بين الأيام —
  document.getElementById('prevDay').addEventListener('click', () => {
    const d = new Date(state.viewDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    state.viewDate = d.toISOString().slice(0, 10);
    updateDashboard();
  });

  document.getElementById('nextDay').addEventListener('click', () => {
    const d = new Date(state.viewDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    if (next <= todayKey()) {
      state.viewDate = next;
      updateDashboard();
    }
  });

  // — الهدف اليومي —
  document.getElementById('goalPlus').addEventListener('click', () => {
    state.goalMinutes = Math.min(720, state.goalMinutes + 30);
    updateGoalDisplay();
    updateGoalBar();
    saveSettings();
  });

  document.getElementById('goalMinus').addEventListener('click', () => {
    state.goalMinutes = Math.max(30, state.goalMinutes - 30);
    updateGoalDisplay();
    updateGoalBar();
    saveSettings();
  });

  // — بوب آب النشاط الرئيسي —
  document.querySelectorAll('#popup .act-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const activity = btn.dataset.activity;
      if (activity === 'أخرى') {
        document.getElementById('customInputWrap').classList.add('visible');
        document.getElementById('customActivity').focus();
      } else {
        hideActivityPopup();
        selectActivity(activity);
      }
    });
  });

  document.getElementById('confirmCustom').addEventListener('click', () => {
    const val = document.getElementById('customActivity').value.trim();
    if (val) {
      hideActivityPopup();
      selectActivity(val);
    }
  });

  document.getElementById('customActivity').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirmCustom').click();
  });

  // — بوب آب الإضافة السريعة —
  document.querySelectorAll('#quickPopup .act-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const activity = btn.dataset.activity;
      if (activity === 'أخرى') {
        document.getElementById('quickCustomWrap').classList.add('visible');
        document.getElementById('quickCustomActivity').focus();
      } else {
        const dur = parseInt(document.getElementById('quickDuration').value) || 10;
        hideQuickAdd();
        selectActivity(activity, dur);
      }
    });
  });

  document.getElementById('confirmQuickCustom').addEventListener('click', () => {
    const val = document.getElementById('quickCustomActivity').value.trim();
    const dur = parseInt(document.getElementById('quickDuration').value) || 10;
    if (val) {
      hideQuickAdd();
      selectActivity(val, dur);
    }
  });

  document.getElementById('closeQuickPopup').addEventListener('click', hideQuickAdd);

  // — الإكسبورت —
  document.getElementById('exportBtn').addEventListener('click', () => {
    document.getElementById('overlay').classList.add('active');
    const popup = document.getElementById('exportPopup');
    popup.style.display = 'block';
    requestAnimationFrame(() => popup.classList.add('active'));
  });

  document.getElementById('closeExport').addEventListener('click', () => {
    document.getElementById('overlay').classList.remove('active');
    const popup = document.getElementById('exportPopup');
    popup.classList.remove('active');
    setTimeout(() => popup.style.display = 'none', 350);
  });

  document.getElementById('exportCSV').addEventListener('click', exportCSV);
  document.getElementById('exportJSON').addEventListener('click', exportJSON);

  // — طلب إذن الإشعارات عند البدء —
  document.getElementById('startBtn').addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, { once: true });

  // — إغلاق الأوفرلاي بالنقر عليه —
  document.getElementById('overlay').addEventListener('click', () => {
    // لا نغلق بوب آب الإنتيرفال لأنه إجباري
    hideQuickAdd();
    document.getElementById('exportPopup').classList.remove('active');
    setTimeout(() => {
      document.getElementById('exportPopup').style.display = 'none';
    }, 350);
    document.getElementById('overlay').classList.remove('active');
  });
}

// ==========================================
// 19. طلب الإشعارات تلقائيًا
// ==========================================

// طلب الإذن عند تحميل الصفحة
window.addEventListener('load', () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  updateTimerDisplay();
  updateRing();
});