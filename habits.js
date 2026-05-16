/**
 * habits.js — نظام العادات (إعادة بناء كاملة)
 * ✅ مستقل 100% — لا يعتمد على أي دالة خارجية
 * ✅ يشتغل على الاستضافة وعلى localhost بدون مشاكل
 */

// ══════════════════════════════════════════
// 0. دوال التاريخ المحلية (مستقلة)
// ══════════════════════════════════════════

function _hbLocalDateKey(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _hbTodayKey() {
  return _hbLocalDateKey(new Date());
}

// ══════════════════════════════════════════
// 1. مفاتيح localStorage والبيانات الافتراضية
// ══════════════════════════════════════════

const HB_LIST_KEY    = 'waqti_habits_list';
const HB_LOG_KEY     = 'waqti_habits_log';
const HB_ACHIEVE_KEY = 'waqti_habits_achievements';

const HB_DEFAULTS = [
  {
    id: 'h_study',
    name: 'دراسة',
    icon: '📚',
    color: '#4ade80',
    type: 'daily',
    targetMinutes: 360,
    targetType: 'min',
    linkedActivity: 'دراسة',
    createdAt: Date.now(),
  },
  {
    id: 'h_waste',
    name: 'تسخيت',
    icon: '📱',
    color: '#f43f5e',
    type: 'daily',
    targetMinutes: 120,
    targetType: 'max',
    linkedActivity: 'تسخيت',
    createdAt: Date.now(),
  },
  {
    id: 'h_read',
    name: 'قراءة',
    icon: '📖',
    color: '#60a5fa',
    type: 'daily',
    targetMinutes: 30,
    targetType: 'min',
    linkedActivity: null,
    createdAt: Date.now(),
  },
];

// ══════════════════════════════════════════
// 2. localStorage — قراءة وحفظ
// ══════════════════════════════════════════

function _hbLoadHabits() {
  try {
    const s = localStorage.getItem(HB_LIST_KEY);
    if (s) return JSON.parse(s);
  } catch (e) { /* تجاهل */ }
  _hbSaveHabits(HB_DEFAULTS);
  return JSON.parse(JSON.stringify(HB_DEFAULTS)); // نسخة منفصلة
}

function _hbSaveHabits(list) {
  localStorage.setItem(HB_LIST_KEY, JSON.stringify(list));
}

function _hbLoadLog() {
  try {
    const s = localStorage.getItem(HB_LOG_KEY);
    return s ? JSON.parse(s) : {};
  } catch (e) { return {}; }
}

function _hbSaveLog(log) {
  localStorage.setItem(HB_LOG_KEY, JSON.stringify(log));
}

function _hbLoadAchievements() {
  try {
    const s = localStorage.getItem(HB_ACHIEVE_KEY);
    return s ? JSON.parse(s) : {};
  } catch (e) { return {}; }
}

function _hbSaveAchievements(a) {
  localStorage.setItem(HB_ACHIEVE_KEY, JSON.stringify(a));
}

// ══════════════════════════════════════════
// 3. منطق الحسابات
// ══════════════════════════════════════════

/** دقائق مسجّلة لعادة في يوم معيّن */
function _hbGetProgress(habitId, dateKey) {
  const log = _hbLoadLog();
  return (log[dateKey] || {})[habitId] || 0;
}

/** إضافة دقائق لعادة في يوم معيّن */
function _hbAddMins(habitId, mins, dateKey) {
  const log = _hbLoadLog();
  if (!log[dateKey]) log[dateKey] = {};
  log[dateKey][habitId] = (log[dateKey][habitId] || 0) + mins;
  _hbSaveLog(log);
}

/**
 * حالة العادة:
 *   'done'     → min: وصل الهدف | max: سُجّل وقت ولم يتجاوز الحد
 *   'exceeded' → max فقط: تجاوز الحد
 *   'pending'  → لم يُنجز بعد
 */
function _hbStatus(habit, dateKey) {
  const p = _hbGetProgress(habit.id, dateKey);
  if (habit.targetType === 'min') {
    return p >= habit.targetMinutes ? 'done' : 'pending';
  } else {
    if (p === 0)                 return 'pending';
    if (p > habit.targetMinutes) return 'exceeded';
    return 'done';
  }
}

/** نسبة شريط التقدم 0-100 */
function _hbProgressPct(habit, dateKey) {
  const p = _hbGetProgress(habit.id, dateKey);
  if (!habit.targetMinutes) return 0;
  return Math.min(100, Math.round((p / habit.targetMinutes) * 100));
}

/** لون شريط التقدم */
function _hbBarColor(habit, dateKey) {
  const st  = _hbStatus(habit, dateKey);
  const pct = _hbProgressPct(habit, dateKey);
  if (habit.targetType === 'max') {
    if (st === 'exceeded') return '#f43f5e';
    if (pct >= 75)         return '#f59e0b';
  }
  return habit.color;
}

/** تنسيق الدقائق → نص قابل للقراءة */
function _hbFmtMin(m) {
  if (!m || m <= 0) return '0 د';
  if (m < 60) return `${m} د`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}س ${r}د` : `${h} ساعة`;
}

/** نص تقدم البطاقة */
function _hbProgressLabel(habit, dateKey) {
  const p  = _hbGetProgress(habit.id, dateKey);
  const st = _hbStatus(habit, dateKey);
  if (habit.targetType === 'min') {
    return `${_hbFmtMin(p)} / ${_hbFmtMin(habit.targetMinutes)}`;
  } else {
    if (p === 0)           return `0 د / ${_hbFmtMin(habit.targetMinutes)}`;
    if (st === 'exceeded') return `⚠️ ${_hbFmtMin(p)} — تجاوزت بـ ${_hbFmtMin(p - habit.targetMinutes)}`;
    return `${_hbFmtMin(p)} / ${_hbFmtMin(habit.targetMinutes)} (متبقي ${_hbFmtMin(habit.targetMinutes - p)})`;
  }
}

/** عدد الأيام المتتالية الناجحة */
function _hbStreak(habit) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = _hbLocalDateKey(d);
    if (_hbStatus(habit, key) === 'done') {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

/** معدل الإنجاز آخر 7 أيام (بدون اليوم الحالي) */
function _hbCompletionRate(habit) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let done = 0;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (_hbStatus(habit, _hbLocalDateKey(d)) === 'done') done++;
  }
  return Math.round((done / 7) * 100);
}

/** بناء بيانات الهيتماب — آخر 84 يوم */
function _hbBuildHeatmap(habit) {
  const log    = _hbLoadLog();
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const result = [];
  for (let i = 83; i >= 0; i--) {
    const d    = new Date(today); d.setDate(d.getDate() - i);
    const key  = _hbLocalDateKey(d);
    const mins = (log[key] || {})[habit.id] || 0;
    const st   = _hbStatus(habit, key);
    let level  = 0;
    let exceeded = false;

    if (mins > 0) {
      if (habit.targetType === 'min') {
        const r = mins / habit.targetMinutes;
        level = r >= 1 ? 4 : r >= 0.75 ? 3 : r >= 0.5 ? 2 : 1;
      } else {
        if (st === 'exceeded') { level = 4; exceeded = true; }
        else {
          const r = mins / habit.targetMinutes;
          level = r >= 0.75 ? 3 : r >= 0.5 ? 2 : 1;
        }
      }
    }
    result.push({ key, mins, level, exceeded });
  }
  return result;
}

// ══════════════════════════════════════════
// 4. الإشعارات (Toast)
// ══════════════════════════════════════════

function _hbToast(html, type = '') {
  const t = document.createElement('div');
  t.className = 'habit-achievement-toast' + (type ? ` hat-${type}` : '');
  t.innerHTML = html;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 600);
  }, 3500);
}

// ══════════════════════════════════════════
// 5. ربط التايمر
// ══════════════════════════════════════════

// نتذكر ما أشعرنا به مرة واحدة فقط لكل حدث في نفس الجلسة
const _hbNotifiedCompleted = {};
const _hbNotifiedExceeded  = {};

/**
 * تُستدعى من script.js عند إنهاء أي نشاط
 * @param {string} activityName اسم النشاط (مثل 'دراسة')
 * @param {number} durationMinutes عدد الدقائق
 */
function onActivityCommitted(activityName, durationMinutes) {
  const habits  = _hbLoadHabits();
  const today   = _hbTodayKey();
  let   updated = false;

  habits.forEach(habit => {
    if (!habit.linkedActivity || habit.linkedActivity !== activityName) return;

    const before = _hbGetProgress(habit.id, today);
    _hbAddMins(habit.id, durationMinutes, today);
    const after  = _hbGetProgress(habit.id, today);
    updated = true;

    const notifKey = habit.id + today;

    if (habit.targetType === 'min') {
      if (before < habit.targetMinutes && after >= habit.targetMinutes && !_hbNotifiedCompleted[notifKey]) {
        _hbNotifiedCompleted[notifKey] = true;
        _hbToast(`
          <div class="hat-icon">${habit.icon}</div>
          <div class="hat-body">
            <div class="hat-title">✅ هدف مكتمل!</div>
            <div class="hat-name">${habit.name}</div>
            <div class="hat-desc">أحسنت! وصلت للهدف 🎉</div>
          </div>`, 'success');
      }
    } else {
      if (before <= habit.targetMinutes && after > habit.targetMinutes && !_hbNotifiedExceeded[notifKey]) {
        _hbNotifiedExceeded[notifKey] = true;
        _hbToast(`
          <div class="hat-icon">⚠️</div>
          <div class="hat-body">
            <div class="hat-title" style="color:#f43f5e">تجاوزت الحد!</div>
            <div class="hat-name">${habit.icon} ${habit.name}</div>
            <div class="hat-desc">وصلت ${_hbFmtMin(after)} — الحد ${_hbFmtMin(habit.targetMinutes)}</div>
          </div>`, 'exceeded');
      }
    }
  });

  if (updated) {
    _hbCheckAchievements();
    if (document.getElementById('page-habits')?.classList.contains('active')) {
      renderHabitsPage();
    }
  }
}

// ══════════════════════════════════════════
// 6. الإنجازات
// ══════════════════════════════════════════

const HB_ACHIEVEMENTS = [
  {
    id: 'first',
    icon: '🌱',
    name: 'البداية',
    desc: 'أكملت عادتك الأولى',
    check: (habits) => habits.some(h => _hbStatus(h, _hbTodayKey()) === 'done'),
  },
  {
    id: 'streak7',
    icon: '🔥',
    name: 'أسبوع ملتهب',
    desc: '7 أيام متتالية في أي عادة',
    check: (habits) => habits.some(h => _hbStreak(h) >= 7),
  },
  {
    id: 'streak30',
    icon: '💎',
    name: 'شهر من الذهب',
    desc: '30 يوماً متتالياً في أي عادة',
    check: (habits) => habits.some(h => _hbStreak(h) >= 30),
  },
  {
    id: 'perfect',
    icon: '⭐',
    name: 'يوم مثالي',
    desc: 'أنجزت جميع العادات في يوم واحد',
    check: (habits) => habits.length > 0 && habits.every(h => _hbStatus(h, _hbTodayKey()) === 'done'),
  },
  {
    id: 'no_waste',
    icon: '🧘',
    name: 'يوم بلا تسخيت',
    desc: 'لا تسخيت طوال اليوم',
    check: (habits) => {
      const w = habits.find(h => h.linkedActivity === 'تسخيت');
      return w && _hbGetProgress(w.id, _hbTodayKey()) === 0 && new Date().getHours() >= 20;
    },
  },
  {
    id: 'hero',
    icon: '🏆',
    name: 'بطل الدراسة',
    desc: 'دراسة 6 ساعات في يوم واحد',
    check: (habits) => {
      const s = habits.find(h => h.linkedActivity === 'دراسة');
      return s && _hbGetProgress(s.id, _hbTodayKey()) >= 360;
    },
  },
];

function _hbCheckAchievements() {
  const habits  = _hbLoadHabits();
  const earned  = _hbLoadAchievements();
  let   changed = false;

  HB_ACHIEVEMENTS.forEach(def => {
    if (!earned[def.id] && def.check(habits)) {
      earned[def.id] = { unlockedAt: Date.now() };
      changed = true;
      _hbToast(`
        <div class="hat-icon">${def.icon}</div>
        <div class="hat-body">
          <div class="hat-title">🏅 إنجاز مفتوح!</div>
          <div class="hat-name">${def.name}</div>
          <div class="hat-desc">${def.desc}</div>
        </div>`, 'achievement');
    }
  });

  if (changed) _hbSaveAchievements(earned);
}

// ══════════════════════════════════════════
// 7. رندر الصفحة
// ══════════════════════════════════════════

function renderHabitsPage() {
  const today  = _hbTodayKey();
  const habits = _hbLoadHabits();
  _hbRenderCards(habits, today);
  _hbRenderStats(habits, today);
  _hbRenderAchievements();
  // رندر مخطط الأسبوع بعد الإحصائيات
  _hbRenderWeekChart(habits);
  // رندر الهيتماب للعادة الأولى بشكل افتراضي
  if (habits.length > 0) _hbRenderHeatmap(habits[0]);
  else _hbRenderHeatmap(null);
}

/* ── بطاقات العادات ── */
function _hbRenderCards(habits, today) {
  const wrap = document.getElementById('habitsCardGrid');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!habits.length) {
    wrap.innerHTML = `
      <div class="habits-empty">
        <div class="habits-empty-icon">🌱</div>
        <p>لا توجد عادات بعد</p>
        <p style="font-size:.8rem;color:var(--text3)">ابدأ بإضافة عادتك الأولى!</p>
      </div>`;
    return;
  }

  habits.forEach(habit => {
    const st         = _hbStatus(habit, today);
    const pct        = _hbProgressPct(habit, today);
    const bc         = _hbBarColor(habit, today);
    const pl         = _hbProgressLabel(habit, today);
    const streak     = _hbStreak(habit);
    const rate       = _hbCompletionRate(habit);
    const isDone     = st === 'done';
    const isExceeded = st === 'exceeded';

    let badge = '';
    if (isDone)     badge = '<span class="hc-done-badge">✅</span>';
    if (isExceeded) badge = '<span class="hc-done-badge" style="filter:none">⚠️</span>';

    const card = document.createElement('div');
    const classes = ['habit-card', isDone ? 'is-done' : '', isExceeded ? 'is-exceeded' : ''].filter(Boolean).join(' ');
    card.className = classes;
    card.dataset.id = habit.id;
    card.style.setProperty('--hc', isExceeded ? '#f43f5e' : habit.color);

    card.innerHTML = `
      <div class="hc-header">
        <div class="hc-icon-wrap" style="background:${habit.color}22;border-color:${habit.color}44">
          <span class="hc-icon">${habit.icon}</span>
        </div>
        <div class="hc-info">
          <div class="hc-name">${habit.name}</div>
          <div class="hc-meta">
            <span class="hc-type-badge">${habit.type === 'daily' ? 'يومية' : 'أسبوعية'}</span>
            <span class="hc-target">🎯 ${habit.targetType === 'max' ? 'أقل من ' : ''}${_hbFmtMin(habit.targetMinutes)}</span>
          </div>
        </div>
        <div class="hc-actions">
          ${badge}
          <button class="hc-btn hc-add-btn"  data-id="${habit.id}" title="إضافة وقت">+</button>
          <button class="hc-btn hc-edit-btn" data-id="${habit.id}" title="تعديل">✏️</button>
          <button class="hc-btn hc-del-btn"  data-id="${habit.id}" title="حذف">🗑</button>
        </div>
      </div>
      <div class="hc-progress-wrap">
        <div class="hc-progress-bar">
          <div class="hc-progress-fill" style="width:${pct}%;background:${bc}"></div>
        </div>
        <div class="hc-progress-text${isExceeded ? ' hc-text-danger' : ''}">${pl}</div>
      </div>
      <div class="hc-footer">
        <div class="hc-stat"><span>🔥</span><span class="hc-stat-val">${streak}</span><span class="hc-stat-lbl"> يوم</span></div>
        <div class="hc-stat"><span>📊</span><span class="hc-stat-val">${rate}%</span><span class="hc-stat-lbl"> أسبوع</span></div>
        ${habit.linkedActivity ? `<div class="hc-linked">🔗 ${habit.linkedActivity}</div>` : ''}
      </div>`;

    wrap.appendChild(card);
  });

  // ربط الأحداث بعد إضافة البطاقات
  wrap.querySelectorAll('.hc-del-btn').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); _hbDeleteHabit(b.dataset.id); }));
  wrap.querySelectorAll('.hc-edit-btn').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); openHabitPopup(b.dataset.id); }));
  wrap.querySelectorAll('.hc-add-btn').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); _hbOpenQuickLog(b.dataset.id); }));
}

/* ── الإحصائيات العلوية ── */
function _hbRenderStats(habits, today) {
  const done = habits.filter(h => _hbStatus(h, today) === 'done').length;

  const el1 = document.getElementById('habitsStatToday');
  if (el1) el1.textContent = `${done} / ${habits.length}`;

  let bestStreak = 0;
  habits.forEach(h => { const s = _hbStreak(h); if (s > bestStreak) bestStreak = s; });
  const el2 = document.getElementById('habitsStatStreak');
  if (el2) el2.textContent = `${bestStreak} يوم`;

  const weekRate = habits.length
    ? Math.round(habits.reduce((s, h) => s + _hbCompletionRate(h), 0) / habits.length)
    : 0;
  const el3 = document.getElementById('habitsStatWeekRate');
  if (el3) el3.textContent = `${weekRate}%`;

  let bestH = null, worstH = null, bestR = -1, worstR = 101;
  habits.forEach(h => {
    const r = _hbCompletionRate(h);
    if (r > bestR)  { bestR  = r; bestH  = h; }
    if (r < worstR) { worstR = r; worstH = h; }
  });
  const el4 = document.getElementById('habitsStatBest');
  if (el4 && bestH)  el4.textContent = `${bestH.icon} ${bestH.name} (${bestR}%)`;
  else if (el4)      el4.textContent = '—';

  const el5 = document.getElementById('habitsStatWorst');
  if (el5 && worstH) el5.textContent = `${worstH.icon} ${worstH.name} (${worstR}%)`;
  else if (el5)      el5.textContent = '—';
}

/* ── مخطط الأسبوع ── */
function _hbRenderWeekChart(habits) {
  const canvas = document.getElementById('habitsWeekChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const log   = _hbLoadLog();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tc    = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#666';

  if (!habits.length) {
    ctx.fillStyle = tc;
    ctx.font = '12px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('لا توجد بيانات', W / 2, H / 2);
    return;
  }

  const pad = { t: 10, r: 10, b: 28, l: 10 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;
  const colW = cW / 7;

  for (let i = 6; i >= 0; i--) {
    const d   = new Date(today); d.setDate(d.getDate() - i);
    const key = _hbLocalDateKey(d);
    const dl  = log[key] || {};
    const di  = 6 - i;
    const x   = pad.l + di * colW + colW * 0.1;
    const w   = colW * 0.8;

    // خلفية العمود
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, pad.t, w, cH, 4);
    else               ctx.rect(x, pad.t, w, cH);
    ctx.fill();

    const bw = w / Math.max(habits.length, 1);
    habits.forEach((h, hi) => {
      const mins = dl[h.id] || 0;
      const pct  = Math.min(1, habit_targetMinutes_safe(h) > 0 ? mins / h.targetMinutes : 0);
      const barH = cH * pct;
      const bx   = x + hi * bw + bw * 0.1;
      const bw2  = bw * 0.8;
      const st   = _hbStatus(h, key);
      const col  = (h.targetType === 'max' && st === 'exceeded') ? '#f43f5e' : h.color;

      if (barH > 1) {
        const g = ctx.createLinearGradient(bx, pad.t + cH, bx, pad.t + cH - barH);
        g.addColorStop(0, col + '88');
        g.addColorStop(1, col);
        ctx.fillStyle = g;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, pad.t + cH - barH, bw2, barH, 3);
        else               ctx.rect(bx, pad.t + cH - barH, bw2, barH);
        ctx.fill();
      }
    });

    // اسم اليوم
    ctx.fillStyle = tc;
    ctx.font = '9px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      d.toLocaleDateString('ar-IQ', { weekday: 'short' }),
      pad.l + di * colW + colW / 2,
      H - 6
    );
  }

  // ليجند الألوان
  const legend = document.getElementById('habitsWeekLegend');
  if (legend) {
    legend.innerHTML = habits.map(h =>
      `<span class="hcl-item">
        <span class="hcl-dot" style="background:${h.color}"></span>
        <span class="hcl-name">${h.icon} ${h.name}</span>
      </span>`
    ).join('');
  }
}

function habit_targetMinutes_safe(h) {
  return h && h.targetMinutes > 0 ? h.targetMinutes : 1;
}

/* ── الهيتماب ── */
function _hbRenderHeatmap(habit) {
  const wrap = document.getElementById('habitsHeatmap');
  if (!wrap) return;
  wrap.innerHTML = '';

  // تحديث قائمة الاختيار
  const sel = document.getElementById('heatmapHabitSelect');
  if (sel) {
    const all = _hbLoadHabits();
    sel.innerHTML = all.map(h =>
      `<option value="${h.id}"${habit && h.id === habit.id ? ' selected' : ''}>${h.icon} ${h.name}</option>`
    ).join('');
    sel.onchange = () => {
      const found = all.find(h => h.id === sel.value);
      if (found) _hbRenderHeatmap(found);
    };
  }

  const title = document.getElementById('heatmapTitle');
  if (!habit) {
    if (title) title.textContent = '🗓 هيتماب العادات';
    wrap.innerHTML = '<p style="font-size:.75rem;color:var(--text3);padding:8px">أضف عادة لعرض الهيتماب</p>';
    return;
  }
  if (title) title.textContent = `${habit.icon} ${habit.name} — آخر 12 أسبوع`;

  const data = _hbBuildHeatmap(habit);
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  data.forEach(cell => {
    const sq = document.createElement('div');
    sq.className = 'hm-cell';

    if (cell.mins === 0) {
      sq.style.background = 'var(--bg3)';
    } else if (cell.exceeded) {
      const reds = ['', '#f43f5e33', '#f43f5e66', '#f43f5eaa', '#f43f5e'];
      sq.style.background = reds[cell.level] || '#f43f5e';
      sq.classList.add('hm-exceeded');
    } else {
      const shades = ['', habit.color + '33', habit.color + '66', habit.color + 'aa', habit.color];
      sq.style.background = shades[cell.level] || habit.color + '55';
    }

    sq.title = `${cell.key}\n${_hbFmtMin(cell.mins)}${cell.exceeded ? ' ⚠️ تجاوز' : ''}`;
    grid.appendChild(sq);
  });

  wrap.appendChild(grid);
}

/* ── الإنجازات ── */
function _hbRenderAchievements() {
  const wrap = document.getElementById('achievementsGrid');
  if (!wrap) return;
  wrap.innerHTML = '';

  const earned = _hbLoadAchievements();
  HB_ACHIEVEMENTS.forEach(def => {
    const ok  = !!earned[def.id];
    const div = document.createElement('div');
    div.className = `achievement-card ${ok ? 'unlocked' : 'locked'}`;
    const dt = ok
      ? new Date(earned[def.id].unlockedAt).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' })
      : '';
    div.innerHTML = `
      <div class="ach-icon">${ok ? def.icon : '🔒'}</div>
      <div class="ach-name">${def.name}</div>
      <div class="ach-desc">${def.desc}</div>
      ${ok ? `<div class="ach-date">${dt}</div>` : ''}`;
    wrap.appendChild(div);
  });
}

// ══════════════════════════════════════════
// 8. CRUD العادات
// ══════════════════════════════════════════

let _hbMode   = 'add';
let _hbEditId = null;

function openHabitPopup(editId = null) {
  _hbMode   = editId ? 'edit' : 'add';
  _hbEditId = editId;

  const popup = document.getElementById('habitFormPopup');
  const ttl   = document.getElementById('habitFormTitle');
  if (!popup) return;

  if (ttl) ttl.textContent = editId ? '✏️ تعديل العادة' : '✨ إضافة عادة جديدة';

  if (editId) {
    const h = _hbLoadHabits().find(x => x.id === editId);
    if (!h) return;
    document.getElementById('habitFormName').value       = h.name;
    document.getElementById('habitFormIcon').value       = h.icon;
    document.getElementById('habitFormTargetMins').value = h.targetMinutes;
    document.getElementById('habitFormTargetType').value = h.targetType;
    document.getElementById('habitFormType').value       = h.type;
    document.getElementById('habitFormLinked').value     = h.linkedActivity || '';
    _hbSetColor(h.color);
  } else {
    document.getElementById('habitFormName').value       = '';
    document.getElementById('habitFormIcon').value       = '⭐';
    document.getElementById('habitFormTargetMins').value = 30;
    document.getElementById('habitFormTargetType').value = 'min';
    document.getElementById('habitFormType').value       = 'daily';
    document.getElementById('habitFormLinked').value     = '';
    _hbSetColor('#6c63ff');
  }

  document.getElementById('habitOverlay').classList.add('active');
  popup.classList.add('active');
  document.getElementById('habitFormName').focus();
}

function closeHabitPopup() {
  document.getElementById('habitOverlay')?.classList.remove('active');
  document.getElementById('habitFormPopup')?.classList.remove('active');
}

function _hbSetColor(c) {
  const valEl     = document.getElementById('habitFormColorVal');
  const previewEl = document.getElementById('habitFormColorPreview');
  const pickerEl  = document.getElementById('habitFormColorPicker');
  if (valEl)     valEl.value = c;
  if (previewEl) previewEl.style.background = c;
  if (pickerEl)  pickerEl.value = c;
  document.querySelectorAll('.habit-color-swatch').forEach(s =>
    s.classList.toggle('selected', s.dataset.color === c));
}

function saveHabitForm() {
  const name   = document.getElementById('habitFormName').value.trim();
  const icon   = document.getElementById('habitFormIcon').value.trim() || '⭐';
  const color  = document.getElementById('habitFormColorVal').value || '#6c63ff';
  const tMins  = parseInt(document.getElementById('habitFormTargetMins').value) || 30;
  const tType  = document.getElementById('habitFormTargetType').value;
  const type   = document.getElementById('habitFormType').value;
  const linked = document.getElementById('habitFormLinked').value || null;

  if (!name) {
    document.getElementById('habitFormName').focus();
    return;
  }

  const habits = _hbLoadHabits();
  if (_hbMode === 'edit' && _hbEditId) {
    const idx = habits.findIndex(h => h.id === _hbEditId);
    if (idx >= 0) {
      habits[idx] = { ...habits[idx], name, icon, color, targetMinutes: tMins, targetType: tType, type, linkedActivity: linked };
    }
  } else {
    habits.push({
      id:             'h_' + Date.now(),
      name, icon, color,
      targetMinutes:  tMins,
      targetType:     tType,
      type,
      linkedActivity: linked,
      createdAt:      Date.now(),
    });
  }

  _hbSaveHabits(habits);
  closeHabitPopup();
  renderHabitsPage();
}

function _hbDeleteHabit(id) {
  if (!confirm('هل تريد حذف هذه العادة؟')) return;
  _hbSaveHabits(_hbLoadHabits().filter(h => h.id !== id));
  renderHabitsPage();
}

// ══════════════════════════════════════════
// 9. إضافة وقت يدوي (Quick Log)
// ══════════════════════════════════════════

let _hbQlId = null;

function _hbOpenQuickLog(id) {
  _hbQlId = id;
  const h = _hbLoadHabits().find(x => x.id === id);
  if (!h) return;

  const titleEl = document.getElementById('quickLogTitle');
  const minsEl  = document.getElementById('quickLogMins');
  if (titleEl) titleEl.textContent = `${h.icon} ${h.name}`;
  if (minsEl)  minsEl.value = '';

  document.getElementById('habitOverlay')?.classList.add('active');
  document.getElementById('habitQuickLogPopup')?.classList.add('active');
  minsEl?.focus();
}

function closeQuickLogPopup() {
  document.getElementById('habitOverlay')?.classList.remove('active');
  document.getElementById('habitQuickLogPopup')?.classList.remove('active');
  _hbQlId = null;
}

function saveQuickLog() {
  if (!_hbQlId) return;
  const minsEl = document.getElementById('quickLogMins');
  const mins   = parseInt(minsEl?.value) || 0;
  if (mins <= 0) { minsEl?.focus(); return; }

  const today = _hbTodayKey();
  const habit = _hbLoadHabits().find(h => h.id === _hbQlId);
  if (!habit) return;

  const before = _hbGetProgress(habit.id, today);
  _hbAddMins(_hbQlId, mins, today);
  const after  = _hbGetProgress(habit.id, today);

  if (habit.targetType === 'min' && before < habit.targetMinutes && after >= habit.targetMinutes) {
    _hbToast(`
      <div class="hat-icon">${habit.icon}</div>
      <div class="hat-body">
        <div class="hat-title">✅ هدف مكتمل!</div>
        <div class="hat-name">${habit.name}</div>
      </div>`, 'success');
  } else if (habit.targetType === 'max' && before <= habit.targetMinutes && after > habit.targetMinutes) {
    _hbToast(`
      <div class="hat-icon">⚠️</div>
      <div class="hat-body">
        <div class="hat-title" style="color:#f43f5e">تجاوزت الحد!</div>
        <div class="hat-name">${habit.icon} ${habit.name}</div>
      </div>`, 'exceeded');
  }

  _hbCheckAchievements();
  closeQuickLogPopup();
  renderHabitsPage();
}

// ══════════════════════════════════════════
// 10. تهيئة الأحداث
// ══════════════════════════════════════════

function _hbSetupEvents() {
  // زر إضافة عادة جديدة
  document.getElementById('addHabitBtn')?.addEventListener('click', () => openHabitPopup());

  // نموذج العادة
  document.getElementById('habitFormSave')?.addEventListener('click', saveHabitForm);
  document.getElementById('habitFormCancel')?.addEventListener('click', closeHabitPopup);
  document.getElementById('habitFormCancel2')?.addEventListener('click', closeHabitPopup);

  // ألوان العادة
  document.querySelectorAll('.habit-color-swatch').forEach(s =>
    s.addEventListener('click', () => _hbSetColor(s.dataset.color)));
  document.getElementById('habitFormColorPicker')?.addEventListener('input', e => _hbSetColor(e.target.value));

  // Quick Log
  document.getElementById('quickLogSave')?.addEventListener('click', saveQuickLog);
  document.getElementById('quickLogCancel')?.addEventListener('click', closeQuickLogPopup);
  document.getElementById('quickLogCancel2')?.addEventListener('click', closeQuickLogPopup);
  document.getElementById('quickLogMins')?.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveQuickLog();
    if (e.key === 'Escape') closeQuickLogPopup();
  });

  // نموذج العادة — keyboard
  document.getElementById('habitFormName')?.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveHabitForm();
    if (e.key === 'Escape') closeHabitPopup();
  });

  // الأوفرلاي — إغلاق عند الضغط خارج النافذة
  document.getElementById('habitOverlay')?.addEventListener('click', () => {
    closeHabitPopup();
    closeQuickLogPopup();
  });
}

// ══════════════════════════════════════════
// 11. التهيئة الرئيسية
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  _hbSetupEvents();
  // نؤخر فحص الإنجازات قليلاً لضمان تحميل كل شيء
  setTimeout(_hbCheckAchievements, 1500);
});

// ── ربط التبويبات (hook آمن لا يكسر switchTab الأصلي) ──
// نستخدم MutationObserver بدل تعديل window.switchTab مباشرة
// لأن هذا يضمن الشغل حتى لو script.js لم يُحمَّل بعد

(function _hbObserveTabs() {
  // ننتظر DOM
  const init = () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab === 'habits') {
          // نؤخر قليلاً لضمان أن صفحة العادات أصبحت active
          setTimeout(renderHabitsPage, 50);
        }
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
