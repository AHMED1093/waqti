/**
 * habits.js — نظام العادات
 * منطق موحّد وبسيط لكل أنواع العادات
 */

// ─────────────────────────────────────────
// 1. بيانات افتراضية
// ─────────────────────────────────────────

const HABITS_STORAGE_KEY = 'waqti_habits_list';
const HABITS_LOG_KEY     = 'waqti_habits_log';
const HABITS_ACHIEVE_KEY = 'waqti_habits_achievements';

const DEFAULT_HABITS = [
  { id:'h_study', name:'دراسة',  icon:'📚', color:'#4ade80', type:'daily', targetMinutes:360, targetType:'min', linkedActivity:'دراسة',  createdAt:Date.now() },
  { id:'h_waste', name:'تسخيت', icon:'📱', color:'#f43f5e', type:'daily', targetMinutes:120, targetType:'max', linkedActivity:'تسخيت', createdAt:Date.now() },
  { id:'h_read',  name:'قراءة', icon:'📖', color:'#60a5fa', type:'daily', targetMinutes:30,  targetType:'min', linkedActivity:null,      createdAt:Date.now() },
];

// ─────────────────────────────────────────
// 2. localStorage
// ─────────────────────────────────────────

function loadHabits() {
  const s = localStorage.getItem(HABITS_STORAGE_KEY);
  if (s) return JSON.parse(s);
  saveHabits(DEFAULT_HABITS);
  return DEFAULT_HABITS;
}
function saveHabits(h)   { localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(h)); }

function loadHabitsLog() {
  const s = localStorage.getItem(HABITS_LOG_KEY);
  return s ? JSON.parse(s) : {};
}
function saveHabitsLog(l) { localStorage.setItem(HABITS_LOG_KEY, JSON.stringify(l)); }

function loadAchievements()  { const s = localStorage.getItem(HABITS_ACHIEVE_KEY); return s ? JSON.parse(s) : {}; }
function saveAchievements(a) { localStorage.setItem(HABITS_ACHIEVE_KEY, JSON.stringify(a)); }

// ─────────────────────────────────────────
// 3. حسابات — منطق موحّد وواضح
// ─────────────────────────────────────────

/** دقائق مسجّلة لعادة في يوم */
function getProgress(habit, dateKey) {
  return (loadHabitsLog()[dateKey] || {})[habit.id] || 0;
}

/** إضافة دقائق */
function addMins(habitId, mins, dateKey) {
  const log = loadHabitsLog();
  if (!log[dateKey]) log[dateKey] = {};
  log[dateKey][habitId] = (log[dateKey][habitId] || 0) + mins;
  saveHabitsLog(log);
}

/**
 * حالة العادة:
 *   'done'     → min: وصل الهدف | max: سُجّل وقت ولم يتجاوز الحد
 *   'exceeded' → max فقط: تجاوز الحد
 *   'pending'  → لسه
 */
function habitStatus(habit, dateKey) {
  const p = getProgress(habit, dateKey);
  if (habit.targetType === 'min') {
    return p >= habit.targetMinutes ? 'done' : 'pending';
  } else { // max
    if (p === 0)                   return 'pending';
    if (p > habit.targetMinutes)   return 'exceeded';
    return 'done';
  }
}

/**
 * نسبة شريط التقدم 0-100
 * — للنوعين: الشريط يمتلئ مع تراكم الوقت (لا عكس أبداً)
 * — عند exceeded يبقى 100
 */
function progressPct(habit, dateKey) {
  const p = getProgress(habit, dateKey);
  if (!habit.targetMinutes) return 0;
  return Math.min(100, Math.round((p / habit.targetMinutes) * 100));
}

/** لون شريط التقدم */
function barColor(habit, dateKey) {
  const st  = habitStatus(habit, dateKey);
  const pct = progressPct(habit, dateKey);
  if (habit.targetType === 'max') {
    if (st === 'exceeded') return '#f43f5e';   // أحمر - تجاوز
    if (pct >= 75)         return '#f59e0b';   // برتقالي - تحذير
    return habit.color;
  }
  return habit.color;
}

/** نص تقدم البطاقة */
function progressLabel(habit, dateKey) {
  const p  = getProgress(habit, dateKey);
  const st = habitStatus(habit, dateKey);
  if (habit.targetType === 'min') {
    return `${fmtMin(p)} / ${fmtMin(habit.targetMinutes)}`;
  } else {
    if (p === 0)             return `0 د / ${fmtMin(habit.targetMinutes)}`;
    if (st === 'exceeded')   return `⚠️ ${fmtMin(p)} — تجاوزت بـ ${fmtMin(p - habit.targetMinutes)}`;
    return `${fmtMin(p)} / ${fmtMin(habit.targetMinutes)} (متبقي ${fmtMin(habit.targetMinutes - p)})`;
  }
}

function fmtMin(m) {
  if (!m || m <= 0) return '0 د';
  if (m < 60) return `${m} د`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}س ${r}د` : `${h} ساعة`;
}

/** streak — أيام متتالية ناجحة */
function habitStreak(habit) {
  const log   = loadHabitsLog();
  const today = new Date(); today.setHours(0,0,0,0);
  let streak  = 0;
  for (let i = 0; i < 365; i++) {
    const d   = new Date(today); d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const st  = habitStatus(habit, key);
    if (st === 'done') { streak++; }
    else if (i > 0)    { break; }
  }
  return streak;
}

/** معدل إنجاز آخر 7 أيام (أمس وما قبله) */
function completionRate(habit) {
  const today = new Date(); today.setHours(0,0,0,0);
  let done = 0;
  for (let i = 1; i <= 7; i++) {
    const d   = new Date(today); d.setDate(d.getDate() - i);
    if (habitStatus(habit, localDateKey(d)) === 'done') done++;
  }
  return Math.round((done / 7) * 100);
}

/**
 * هيتماب — آخر 84 يوم
 * level: 0=فارغ  1=خفيف  2=متوسط  3=كثير  4=كامل/تجاوز
 * exceeded: true إذا تجاوز حد max
 */
function buildHeatmap(habit) {
  const log    = loadHabitsLog();
  const today  = new Date(); today.setHours(0,0,0,0);
  const result = [];
  for (let i = 83; i >= 0; i--) {
    const d    = new Date(today); d.setDate(d.getDate() - i);
    const key  = localDateKey(d);
    const mins = (log[key] || {})[habit.id] || 0;
    const st   = habitStatus(habit, key);
    let level  = 0;
    let exceeded = false;

    if (mins > 0) {
      if (habit.targetType === 'min') {
        const r = mins / habit.targetMinutes;
        level = r >= 1 ? 4 : r >= 0.75 ? 3 : r >= 0.5 ? 2 : 1;
      } else { // max
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

// ─────────────────────────────────────────
// 4. ربط التايمر
// ─────────────────────────────────────────

// نتذكر ما أشعرنا به مرة واحدة فقط لكل حدث
const _notifiedCompleted = {};
const _notifiedExceeded  = {};

function onActivityCommitted(activityName, durationMinutes) {
  const habits = loadHabits();
  const today  = todayKey();
  let   updated = false;

  habits.forEach(habit => {
    if (!habit.linkedActivity || habit.linkedActivity !== activityName) return;

    const before = getProgress(habit, today);
    addMins(habit.id, durationMinutes, today);
    const after  = getProgress(habit, today);
    updated = true;

    if (habit.targetType === 'min') {
      // وصل الهدف لأول مرة
      const key = habit.id + today;
      if (before < habit.targetMinutes && after >= habit.targetMinutes && !_notifiedCompleted[key]) {
        _notifiedCompleted[key] = true;
        _toast(`<div class="hat-icon">${habit.icon}</div>
          <div class="hat-body">
            <div class="hat-title">✅ هدف مكتمل!</div>
            <div class="hat-name">${habit.name}</div>
            <div class="hat-desc">أحسنت! وصلت للهدف 🎉</div>
          </div>`, 'success');
      }
    } else { // max
      // تجاوز الحد لأول مرة اليوم
      const key = habit.id + today;
      if (before <= habit.targetMinutes && after > habit.targetMinutes && !_notifiedExceeded[key]) {
        _notifiedExceeded[key] = true;
        _toast(`<div class="hat-icon">⚠️</div>
          <div class="hat-body">
            <div class="hat-title" style="color:#f43f5e">تجاوزت الحد!</div>
            <div class="hat-name">${habit.icon} ${habit.name}</div>
            <div class="hat-desc">وصلت ${fmtMin(after)} — الحد ${fmtMin(habit.targetMinutes)}</div>
          </div>`, 'exceeded');
      }
    }
  });

  if (updated) {
    checkAchievements();
    if (document.getElementById('page-habits')?.classList.contains('active')) {
      renderHabitsPage();
    }
  }
}

function _toast(html, type='') {
  const t = document.createElement('div');
  t.className = 'habit-achievement-toast' + (type ? ` hat-${type}` : '');
  t.innerHTML = html;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 600); }, 3500);
}

// ─────────────────────────────────────────
// 5. الإنجازات
// ─────────────────────────────────────────

const ACHIEVEMENTS = [
  { id:'first',    icon:'🌱', name:'البداية',        desc:'أكملت عادتك الأولى',
    check: (h) => h.some(x => habitStatus(x, todayKey()) === 'done') },
  { id:'streak7',  icon:'🔥', name:'أسبوع ملتهب',   desc:'7 أيام متتالية في أي عادة',
    check: (h) => h.some(x => habitStreak(x) >= 7) },
  { id:'streak30', icon:'💎', name:'شهر من الذهب',  desc:'30 يوماً متتالياً في أي عادة',
    check: (h) => h.some(x => habitStreak(x) >= 30) },
  { id:'perfect',  icon:'⭐', name:'يوم مثالي',      desc:'أنجزت جميع العادات في يوم واحد',
    check: (h) => h.length > 0 && h.every(x => habitStatus(x, todayKey()) === 'done') },
  { id:'no_waste', icon:'🧘', name:'يوم بلا تسخيت', desc:'لا تسخيت طوال اليوم',
    check: (h) => { const w=h.find(x=>x.linkedActivity==='تسخيت'); return w && getProgress(w,todayKey())===0 && new Date().getHours()>=20; } },
  { id:'hero',     icon:'🏆', name:'بطل الدراسة',   desc:'دراسة 6 ساعات في يوم',
    check: (h) => { const s=h.find(x=>x.linkedActivity==='دراسة'); return s && getProgress(s,todayKey())>=360; } },
];

function checkAchievements() {
  const habits = loadHabits();
  const earned = loadAchievements();
  let changed  = false;
  ACHIEVEMENTS.forEach(def => {
    if (!earned[def.id] && def.check(habits)) {
      earned[def.id] = { unlockedAt: Date.now() };
      changed = true;
      _toast(`<div class="hat-icon">${def.icon}</div>
        <div class="hat-body">
          <div class="hat-title">🏅 إنجاز مفتوح!</div>
          <div class="hat-name">${def.name}</div>
          <div class="hat-desc">${def.desc}</div>
        </div>`, 'achievement');
    }
  });
  if (changed) saveAchievements(earned);
}

// ─────────────────────────────────────────
// 6. رندر الصفحة
// ─────────────────────────────────────────

function renderHabitsPage() {
  const today  = todayKey();
  const habits = loadHabits();
  _renderCards(habits, today);
  _renderStats(habits, today);
  _renderAchievements();
}

/* ── بطاقات ── */
function _renderCards(habits, today) {
  const wrap = document.getElementById('habitsCardGrid');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!habits.length) {
    wrap.innerHTML = `<div class="habits-empty">
      <div class="habits-empty-icon">🌱</div>
      <p>لا توجد عادات بعد</p>
      <p style="font-size:.8rem;color:var(--text3)">ابدأ بإضافة عادتك الأولى!</p>
    </div>`;
    return;
  }

  habits.forEach(habit => {
    const st   = habitStatus(habit, today);
    const pct  = progressPct(habit, today);
    const bc   = barColor(habit, today);
    const pl   = progressLabel(habit, today);
    const sk   = habitStreak(habit);
    const rate = completionRate(habit);

    const isDone     = st === 'done';
    const isExceeded = st === 'exceeded';

    let badge = '';
    if (isDone)     badge = '<span class="hc-done-badge">✅</span>';
    if (isExceeded) badge = '<span class="hc-done-badge" style="filter:none">⚠️</span>';

    const card = document.createElement('div');
    card.className = ['habit-card', isDone ? 'is-done' : '', isExceeded ? 'is-exceeded' : ''].filter(Boolean).join(' ');
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
            <span class="hc-type-badge">${habit.type==='daily'?'يومية':'أسبوعية'}</span>
            <span class="hc-target">🎯 ${habit.targetType==='max'?'أقل من ':''}${fmtMin(habit.targetMinutes)}</span>
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
        <div class="hc-progress-text${isExceeded?' hc-text-danger':''}">${pl}</div>
      </div>
      <div class="hc-footer">
        <div class="hc-stat"><span>🔥</span><span class="hc-stat-val">${sk}</span><span class="hc-stat-lbl"> يوم</span></div>
        <div class="hc-stat"><span>📊</span><span class="hc-stat-val">${rate}%</span><span class="hc-stat-lbl"> أسبوع</span></div>
        ${habit.linkedActivity?`<div class="hc-linked">🔗 ${habit.linkedActivity}</div>`:''}
      </div>`;

    wrap.appendChild(card);
  });

  wrap.querySelectorAll('.hc-del-btn').forEach(b  => b.addEventListener('click', e=>{e.stopPropagation();_deleteHabit(b.dataset.id);}));
  wrap.querySelectorAll('.hc-edit-btn').forEach(b => b.addEventListener('click', e=>{e.stopPropagation();openHabitPopup(b.dataset.id);}));
  wrap.querySelectorAll('.hc-add-btn').forEach(b  => b.addEventListener('click', e=>{e.stopPropagation();_openQuickLog(b.dataset.id);}));
}

/* ── إحصائيات ── */
function _renderStats(habits, today) {
  const done = habits.filter(h => habitStatus(h,today)==='done').length;
  document.getElementById('habitsStatToday')?.setAttribute('textContent', `${done} / ${habits.length}`);
  const el1 = document.getElementById('habitsStatToday'); if(el1) el1.textContent=`${done} / ${habits.length}`;

  let best=0; habits.forEach(h=>{const s=habitStreak(h);if(s>best)best=s;});
  const el2 = document.getElementById('habitsStatStreak'); if(el2) el2.textContent=`${best} يوم`;

  const wr = habits.length ? Math.round(habits.reduce((s,h)=>s+completionRate(h),0)/habits.length) : 0;
  const el3 = document.getElementById('habitsStatWeekRate'); if(el3) el3.textContent=`${wr}%`;

  let bestH=null,worstH=null,br=-1,wr2=101;
  habits.forEach(h=>{const r=completionRate(h);if(r>br){br=r;bestH=h;}if(r<wr2){wr2=r;worstH=h;}});
  const el4=document.getElementById('habitsStatBest');   if(el4&&bestH)  el4.textContent=`${bestH.icon} ${bestH.name} (${br}%)`;
  const el5=document.getElementById('habitsStatWorst');  if(el5&&worstH) el5.textContent=`${worstH.icon} ${worstH.name} (${wr2}%)`;

  _renderWeekChart(habits);
  _renderHeatmap(habits[0]||null);
}

/* ── مخطط الأسبوع ── */
function _renderWeekChart(habits) {
  const canvas = document.getElementById('habitsWeekChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);

  const log   = loadHabitsLog();
  const today = new Date(); today.setHours(0,0,0,0);
  const tc    = getComputedStyle(document.body).getPropertyValue('--text3').trim()||'#666';

  if (!habits.length) { ctx.fillStyle=tc; ctx.font='12px Cairo'; ctx.textAlign='center'; ctx.fillText('لا توجد بيانات',W/2,H/2); return; }

  const pad={t:10,r:10,b:28,l:10};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const colW=cW/7;

  for (let i=6;i>=0;i--) {
    const d   = new Date(today); d.setDate(d.getDate()-i);
    const key = localDateKey(d);
    const dl  = loadHabitsLog()[key]||{};
    const di  = 6-i;
    const x   = pad.l+di*colW+colW*.1, w=colW*.8;

    ctx.fillStyle='rgba(255,255,255,0.03)';
    ctx.beginPath(); ctx.roundRect(x,pad.t,w,cH,4); ctx.fill();

    const bw = w/habits.length;
    habits.forEach((h,hi)=>{
      const mins = dl[h.id]||0;
      // الشريط يعرض الوقت الفعلي — حتى لو ما وصل الهدف
      const pct  = Math.min(1, mins/h.targetMinutes);
      const barH = cH*pct;
      const bx   = x+hi*bw+bw*.1;
      const bw2  = bw*.8;
      const st   = habitStatus(h, key);
      const col  = (h.targetType==='max'&&st==='exceeded') ? '#f43f5e' : h.color;

      if (barH>0) {
        const g=ctx.createLinearGradient(bx,pad.t+cH,bx,pad.t+cH-barH);
        g.addColorStop(0,col+'88'); g.addColorStop(1,col);
        ctx.fillStyle=g;
        ctx.beginPath(); ctx.roundRect(bx,pad.t+cH-barH,bw2,barH,3); ctx.fill();
      }

      // خط الهدف الأفقي
      const goalY = pad.t + cH - cH; // top = 100%
      // نرسم خط أفقي عند مستوى الهدف بدل الأعلى
      const goalLineY = pad.t + cH*(1-1); // always top for now
    });

    ctx.fillStyle=tc; ctx.font='9px Cairo'; ctx.textAlign='center';
    ctx.fillText(d.toLocaleDateString('ar-IQ',{weekday:'short'}), pad.l+di*colW+colW/2, H-6);
  }
}

/* ── هيتماب ── */
function _renderHeatmap(habit) {
  const wrap = document.getElementById('habitsHeatmap');
  if (!wrap) return;
  wrap.innerHTML = '';

  const title = document.getElementById('heatmapTitle');

  if (!habit) { wrap.innerHTML='<p style="font-size:.75rem;color:var(--text3)">أضف عادة لعرض الهيتماب</p>'; return; }
  if (title) title.textContent=`${habit.icon} ${habit.name} — آخر 12 أسبوع`;

  // قائمة اختيار
  const sel = document.getElementById('heatmapHabitSelect');
  if (sel) {
    const all = loadHabits();
    sel.innerHTML = all.map(h=>`<option value="${h.id}"${h.id===habit.id?' selected':''}>${h.icon} ${h.name}</option>`).join('');
    sel.onchange = () => { const f=all.find(h=>h.id===sel.value); if(f) _renderHeatmap(f); };
  }

  const data = buildHeatmap(habit);
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  data.forEach(cell => {
    const sq = document.createElement('div');
    sq.className = 'hm-cell';

    if (cell.mins === 0) {
      sq.style.background = 'var(--bg3)';
    } else if (cell.exceeded) {
      // تجاوز حد max → تدرج أحمر
      const reds = ['','#f43f5e33','#f43f5e66','#f43f5eaa','#f43f5e'];
      sq.style.background = reds[cell.level]||'#f43f5e';
      sq.classList.add('hm-exceeded');
    } else {
      // عادي → لون العادة
      const shades = ['', habit.color+'33', habit.color+'66', habit.color+'aa', habit.color];
      sq.style.background = shades[cell.level]||habit.color+'55';
    }

    sq.title = `${cell.key}\n${fmtMin(cell.mins)}${cell.exceeded?' ⚠️ تجاوز':''}`;
    grid.appendChild(sq);
  });

  wrap.appendChild(grid);
}

/* ── الإنجازات ── */
function _renderAchievements() {
  const wrap = document.getElementById('achievementsGrid');
  if (!wrap) return;
  wrap.innerHTML = '';
  const earned = loadAchievements();
  ACHIEVEMENTS.forEach(def => {
    const ok = !!earned[def.id];
    const d  = document.createElement('div');
    d.className = `achievement-card ${ok?'unlocked':'locked'}`;
    const dt = ok ? new Date(earned[def.id].unlockedAt).toLocaleDateString('ar-IQ',{day:'numeric',month:'short'}) : '';
    d.innerHTML = `<div class="ach-icon">${ok?def.icon:'🔒'}</div><div class="ach-name">${def.name}</div><div class="ach-desc">${def.desc}</div>${ok?`<div class="ach-date">${dt}</div>`:''}`;
    wrap.appendChild(d);
  });
}

// ─────────────────────────────────────────
// 7. CRUD
// ─────────────────────────────────────────

let _mode='add', _editId=null;

function openHabitPopup(editId=null) {
  _mode=editId?'edit':'add'; _editId=editId;
  const popup=document.getElementById('habitFormPopup');
  const ttl=document.getElementById('habitFormTitle');
  if(!popup) return;
  ttl.textContent = editId ? '✏️ تعديل العادة' : '✨ إضافة عادة جديدة';
  if (editId) {
    const h=loadHabits().find(x=>x.id===editId); if(!h) return;
    document.getElementById('habitFormName').value       = h.name;
    document.getElementById('habitFormIcon').value       = h.icon;
    document.getElementById('habitFormTargetMins').value = h.targetMinutes;
    document.getElementById('habitFormTargetType').value = h.targetType;
    document.getElementById('habitFormType').value       = h.type;
    document.getElementById('habitFormLinked').value     = h.linkedActivity||'';
    _setColor(h.color);
  } else {
    document.getElementById('habitFormName').value       = '';
    document.getElementById('habitFormIcon').value       = '⭐';
    document.getElementById('habitFormTargetMins').value = 30;
    document.getElementById('habitFormTargetType').value = 'min';
    document.getElementById('habitFormType').value       = 'daily';
    document.getElementById('habitFormLinked').value     = '';
    _setColor('#6c63ff');
  }
  document.getElementById('habitOverlay').classList.add('active');
  popup.classList.add('active');
  document.getElementById('habitFormName').focus();
}

function closeHabitPopup() {
  document.getElementById('habitOverlay').classList.remove('active');
  document.getElementById('habitFormPopup').classList.remove('active');
}

function _setColor(c) {
  document.getElementById('habitFormColorVal').value = c;
  document.getElementById('habitFormColorPreview').style.background = c;
  document.querySelectorAll('.habit-color-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.color===c));
}

function saveHabitForm() {
  const name   = document.getElementById('habitFormName').value.trim();
  const icon   = document.getElementById('habitFormIcon').value.trim()||'⭐';
  const color  = document.getElementById('habitFormColorVal').value;
  const tMins  = parseInt(document.getElementById('habitFormTargetMins').value)||30;
  const tType  = document.getElementById('habitFormTargetType').value;
  const type   = document.getElementById('habitFormType').value;
  const linked = document.getElementById('habitFormLinked').value||null;
  if (!name) { document.getElementById('habitFormName').focus(); return; }
  const habits = loadHabits();
  if (_mode==='edit'&&_editId) {
    const i=habits.findIndex(h=>h.id===_editId);
    if(i>=0) habits[i]={...habits[i],name,icon,color,targetMinutes:tMins,targetType:tType,type,linkedActivity:linked};
  } else {
    habits.push({id:'h_'+Date.now(),name,icon,color,targetMinutes:tMins,targetType:tType,type,linkedActivity:linked,createdAt:Date.now()});
  }
  saveHabits(habits); closeHabitPopup(); renderHabitsPage();
}

function _deleteHabit(id) {
  if(!confirm('هل تريد حذف هذه العادة؟')) return;
  saveHabits(loadHabits().filter(h=>h.id!==id));
  renderHabitsPage();
}

// ─────────────────────────────────────────
// 8. إضافة وقت يدوي
// ─────────────────────────────────────────

let _qlId=null;

function _openQuickLog(id) {
  _qlId=id;
  const h=loadHabits().find(x=>x.id===id); if(!h) return;
  document.getElementById('quickLogTitle').textContent=`${h.icon} ${h.name}`;
  document.getElementById('quickLogMins').value='';
  document.getElementById('habitOverlay').classList.add('active');
  document.getElementById('habitQuickLogPopup').classList.add('active');
  document.getElementById('quickLogMins').focus();
}

function closeQuickLogPopup() {
  document.getElementById('habitOverlay').classList.remove('active');
  document.getElementById('habitQuickLogPopup').classList.remove('active');
  _qlId=null;
}

function saveQuickLog() {
  if (!_qlId) return;
  const mins=parseInt(document.getElementById('quickLogMins').value)||0;
  if (mins<=0) { document.getElementById('quickLogMins').focus(); return; }
  const today=todayKey();
  const habit=loadHabits().find(h=>h.id===_qlId);
  const before=getProgress(habit,today);
  addMins(_qlId,mins,today);
  const after=getProgress(habit,today);
  if (habit.targetType==='min'&&before<habit.targetMinutes&&after>=habit.targetMinutes)
    _toast(`<div class="hat-icon">${habit.icon}</div><div class="hat-body"><div class="hat-title">✅ هدف مكتمل!</div><div class="hat-name">${habit.name}</div></div>`,'success');
  else if (habit.targetType==='max'&&before<=habit.targetMinutes&&after>habit.targetMinutes)
    _toast(`<div class="hat-icon">⚠️</div><div class="hat-body"><div class="hat-title" style="color:#f43f5e">تجاوزت الحد!</div><div class="hat-name">${habit.icon} ${habit.name}</div></div>`,'exceeded');
  checkAchievements();
  closeQuickLogPopup();
  renderHabitsPage();
}

// ─────────────────────────────────────────
// 9. تهيئة
// ─────────────────────────────────────────

function _setupHabitsEvents() {
  document.getElementById('addHabitBtn')?.addEventListener('click',()=>openHabitPopup());
  document.getElementById('habitFormSave')?.addEventListener('click',saveHabitForm);
  document.getElementById('habitFormCancel')?.addEventListener('click',closeHabitPopup);
  document.querySelectorAll('.habit-color-swatch').forEach(s=>s.addEventListener('click',()=>_setColor(s.dataset.color)));
  document.getElementById('habitFormColorPicker')?.addEventListener('input',e=>_setColor(e.target.value));
  document.getElementById('quickLogSave')?.addEventListener('click',saveQuickLog);
  document.getElementById('quickLogCancel')?.addEventListener('click',closeQuickLogPopup);
  document.getElementById('quickLogMins')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveQuickLog();if(e.key==='Escape')closeQuickLogPopup();});
  document.getElementById('habitFormName')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveHabitForm();if(e.key==='Escape')closeHabitPopup();});
  document.getElementById('habitOverlay')?.addEventListener('click',()=>{closeHabitPopup();closeQuickLogPopup();});
}

document.addEventListener('DOMContentLoaded',()=>{
  _setupHabitsEvents();
  setTimeout(checkAchievements,1200);
});

const _origSwitch=window.switchTab;
window.switchTab=function(t){
  if(typeof _origSwitch==='function') _origSwitch(t);
  if(t==='habits') renderHabitsPage();
};
