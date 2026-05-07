/**
 * firebase.js — نظام المزامنة والمقارنة Real-Time
 * يُحمَّل كـ ES Module منفصل
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, set, update, onValue, get }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// ─── إعدادات Firebase ───────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBW_cc4iRrBclqK6xSJDb_goaLt1WOTs-E",
  authDomain:        "waqti-97e97.firebaseapp.com",
  databaseURL:       "https://waqti-97e97-default-rtdb.firebaseio.com",
  projectId:         "waqti-97e97",
  storageBucket:     "waqti-97e97.firebasestorage.app",
  messagingSenderId: "227376312121",
  appId:             "1:227376312121:web:b01d54d2ef7ab51ce782e8",
  measurementId:     "G-YPNZ0S3CSH"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ─── الحالة الداخلية ─────────────────────────
const fbState = {
  myId:       null,
  friendId:   null,
  connected:  false,
  unsubMe:    null,   // دالة إلغاء الاستماع لبيانات المستخدم
  unsubFriend: null,  // دالة إلغاء الاستماع لبيانات الصديق
  myData:     null,
  friendData: null,
};

// ─── حساب إحصائيات اليوم من localStorage ────
function calcTodayStats() {
  // اليوم
  const y   = new Date().getFullYear();
  const m   = String(new Date().getMonth()+1).padStart(2,'0');
  const d   = String(new Date().getDate()).padStart(2,'0');
  const dk  = `${y}-${m}-${d}`;

  const raw  = localStorage.getItem(`waqti_${dk}`);
  const data = raw ? JSON.parse(raw) : [];

  let studyTime        = 0; // بالدقائق
  let breakTime        = 0;
  let procrastination  = 0;

  data.forEach(e => {
    if (e.activity === 'دراسة')   studyTime       += (e.duration || 0);
    if (e.activity === 'استراحة') breakTime        += (e.duration || 0);
    if (e.activity === 'تسخيت')   procrastination  += (e.duration || 0);
  });

  const sessionsCount = data.length;

  // حساب الستريك
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const cur = new Date(today); cur.setDate(today.getDate()-i);
    const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    const day = JSON.parse(localStorage.getItem(`waqti_${key}`) || '[]');
    if (day.length > 0) streak++;
    else break;
  }

  // Focus Score = نسبة الدراسة / (دراسة + تسخيت) × 100
  const total  = studyTime + procrastination;
  const focusScore = total > 0 ? Math.round((studyTime / total) * 100) : 0;

  return { studyTime, breakTime, procrastination, sessionsCount, streak, focusScore };
}

// ─── رفع بيانات المستخدم لـ Firebase ─────────
export async function syncToFirebase() {
  if (!fbState.connected || !fbState.myId) return;
  try {
    const stats = calcTodayStats();
    await update(ref(db, `/users/${fbState.myId}`), {
      studyTime:          stats.studyTime,
      breakTime:          stats.breakTime,
      focusScore:         stats.focusScore,
      sessionsCount:      stats.sessionsCount,
      streak:             stats.streak,
      procrastinationTime: stats.procrastination,
      updatedAt:          Date.now(),
    });
  } catch (e) {
    console.warn('Firebase sync error:', e);
  }
}

// ─── الاتصال والاستماع ───────────────────────
export function connectComparison(myId, friendId) {
  if (!myId || !friendId) return false;
  if (myId === friendId)  return false;

  fbState.myId      = myId.trim();
  fbState.friendId  = friendId.trim();
  fbState.connected = true;

  // حفظ في localStorage للمرة القادمة
  localStorage.setItem('waqti_fbMyId',     fbState.myId);
  localStorage.setItem('waqti_fbFriendId', fbState.friendId);

  // استمع لبيانات نفسي
  fbState.unsubMe = onValue(ref(db, `/users/${fbState.myId}`), snap => {
    fbState.myData = snap.val();
    renderComparison();
  });

  // استمع لبيانات الصديق
  fbState.unsubFriend = onValue(ref(db, `/users/${fbState.friendId}`), snap => {
    fbState.friendData = snap.val();
    renderComparison();
  });

  // ارفع بياناتي الحالية
  syncToFirebase();
  return true;
}

export function disconnectComparison() {
  if (fbState.unsubMe)     { fbState.unsubMe();     fbState.unsubMe = null; }
  if (fbState.unsubFriend) { fbState.unsubFriend();  fbState.unsubFriend = null; }
  fbState.connected  = false;
  fbState.myData     = null;
  fbState.friendData = null;

  const board = document.getElementById('cmpBoard');
  const setup = document.getElementById('cmpSetupCard');
  if (board) board.style.display = 'none';
  if (setup) setup.style.display = 'block';
  updateStatus('', '');
}

// ─── عرض المقارنة ────────────────────────────
function fmt(min) {
  if (!min && min !== 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
}

function renderComparison() {
  const me  = fbState.myData     || {};
  const fr  = fbState.friendData || {};

  // ── قيم ──
  const vals = {
    myStudy:    me.studyTime           || 0,
    frStudy:    fr.studyTime           || 0,
    myStreak:   me.streak              || 0,
    frStreak:   fr.streak              || 0,
    myScore:    me.focusScore          || 0,
    frScore:    fr.focusScore          || 0,
    mySessions: me.sessionsCount       || 0,
    frSessions: fr.sessionsCount       || 0,
    myProc:     me.procrastinationTime || 0,
    frProc:     fr.procrastinationTime || 0,
  };

  // ── تحديث الخلايا ──
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  const setWin = (myId, frId, myV, frV, higherWins = true) => {
    const myEl = document.getElementById(myId);
    const frEl = document.getElementById(frId);
    if (!myEl || !frEl) return;
    myEl.classList.remove('cmp-win','cmp-lose');
    frEl.classList.remove('cmp-win','cmp-lose');
    if (myV === frV) return;
    const myWins = higherWins ? myV > frV : myV < frV;
    myEl.classList.add(myWins ? 'cmp-win' : 'cmp-lose');
    frEl.classList.add(myWins ? 'cmp-lose' : 'cmp-win');
  };

  set('cv-myStudy',    fmt(vals.myStudy));
  set('cv-frStudy',    fmt(vals.frStudy));
  set('cv-myStreak',   `${vals.myStreak} 🔥`);
  set('cv-frStreak',   `${vals.frStreak} 🔥`);
  set('cv-myScore',    `${vals.myScore}%`);
  set('cv-frScore',    `${vals.frScore}%`);
  set('cv-mySessions', vals.mySessions);
  set('cv-frSessions', vals.frSessions);
  set('cv-myProc',     fmt(vals.myProc));
  set('cv-frProc',     fmt(vals.frProc));

  // ── اللون الأخضر للفائز ──
  setWin('cv-myStudy',    'cv-frStudy',    vals.myStudy,    vals.frStudy);
  setWin('cv-myStreak',   'cv-frStreak',   vals.myStreak,   vals.frStreak);
  setWin('cv-myScore',    'cv-frScore',    vals.myScore,    vals.frScore);
  setWin('cv-mySessions', 'cv-frSessions', vals.mySessions, vals.frSessions);
  setWin('cv-myProc',     'cv-frProc',     vals.myProc,     vals.frProc, false); // أقل تسخيت = أفضل

  // ── تحديد الفائز الكلي ──
  let myPoints = 0, frPoints = 0;
  if (vals.myStudy    > vals.frStudy)    myPoints++; else if (vals.frStudy    > vals.myStudy)    frPoints++;
  if (vals.myStreak   > vals.frStreak)   myPoints++; else if (vals.frStreak   > vals.myStreak)   frPoints++;
  if (vals.myScore    > vals.frScore)    myPoints++; else if (vals.frScore    > vals.myScore)    frPoints++;
  if (vals.mySessions > vals.frSessions) myPoints++; else if (vals.frSessions > vals.mySessions) frPoints++;
  if (vals.myProc     < vals.frProc)     myPoints++; else if (vals.frProc     < vals.myProc)     frPoints++;

  const winCard = document.getElementById('cmpWinnerCard');
  const winText = document.getElementById('cmpWinnerText');
  if (winCard && winText) {
    winCard.className = 'cmp-winner-card';
    if (myPoints > frPoints) {
      winText.textContent = 'أنت المتقدم 🔥';
      winCard.classList.add('cmp-i-win');
    } else if (frPoints > myPoints) {
      winText.textContent = 'صديقك متفوق 😏';
      winCard.classList.add('cmp-fr-win');
    } else {
      winText.textContent = 'تعادل 🤝';
      winCard.classList.add('cmp-tie');
    }
  }

  // ── آخر تحديث ──
  const lastEl = document.getElementById('cmpLastUpdate');
  if (lastEl) {
    const ts = Math.max(me.updatedAt||0, fr.updatedAt||0);
    if (ts) {
      const d = new Date(ts);
      lastEl.textContent = `آخر تحديث: ${d.toLocaleTimeString('ar-IQ', {hour12:true})}`;
    }
  }
}

// ─── أحداث واجهة المقارنة ────────────────────
function updateStatus(msg, type) {
  const el = document.getElementById('cmpStatus');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'cmp-status' + (type ? ` cmp-status-${type}` : '');
}

function initCompareUI() {
  // استعادة الـ IDs المحفوظة
  const savedMy  = localStorage.getItem('waqti_fbMyId');
  const savedFr  = localStorage.getItem('waqti_fbFriendId');
  if (savedMy)  { const el = document.getElementById('myUserId');     if(el) el.value = savedMy;  }
  if (savedFr)  { const el = document.getElementById('friendUserId'); if(el) el.value = savedFr; }

  // توليد ID عشوائي
  document.getElementById('genIdBtn')?.addEventListener('click', () => {
    const id = 'user_' + Math.random().toString(36).slice(2,8);
    const el = document.getElementById('myUserId');
    if (el) { el.value = id; }
  });

  // زر الاتصال
  document.getElementById('cmpConnectBtn')?.addEventListener('click', () => {
    const myId  = document.getElementById('myUserId')?.value?.trim();
    const frId  = document.getElementById('friendUserId')?.value?.trim();
    if (!myId || !frId) { updateStatus('أدخل المعرّفين أولاً', 'err'); return; }
    if (myId === frId)   { updateStatus('لا يمكن مقارنة نفسك!', 'err'); return; }

    updateStatus('جارٍ الاتصال...', 'loading');
    const ok = connectComparison(myId, frId);
    if (ok) {
      document.getElementById('cmpSetupCard').style.display = 'none';
      document.getElementById('cmpBoard').style.display     = 'block';
      document.getElementById('cmpMyName').textContent      = myId;
      document.getElementById('cmpFriendName').textContent  = frId;
      document.getElementById('cmpIdsLabel').textContent    = `${myId} vs ${frId}`;
      updateStatus('متصل ✓', 'ok');
    } else {
      updateStatus('حدث خطأ في الاتصال', 'err');
    }
  });

  // زر قطع الاتصال
  document.getElementById('cmpDisconnectBtn')?.addEventListener('click', () => {
    disconnectComparison();
  });
}

// ─── تشغيل تلقائي عند تحميل الصفحة ──────────
window.addEventListener('DOMContentLoaded', () => {
  initCompareUI();

  // إذا كان متصلاً من قبل، أعد الاتصال تلقائياً
  const savedMy = localStorage.getItem('waqti_fbMyId');
  const savedFr = localStorage.getItem('waqti_fbFriendId');
  if (savedMy && savedFr) {
    const myInput = document.getElementById('myUserId');
    const frInput = document.getElementById('friendUserId');
    if (myInput) myInput.value = savedMy;
    if (frInput) frInput.value = savedFr;
  }
});

// ─── تصدير للاستخدام من script.js ────────────
window._fbSync = syncToFirebase;
