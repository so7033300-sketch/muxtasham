/* =========================================================================
   SMART QR-ATTENDANCE CRM — script.js
   Bitta fayl ham index.html, ham admin.html uchun ishlaydi (feature-detection)
   ========================================================================= */

/* -------------------------------------------------------------------------
   0. UMUMIY YORDAMCHI FUNKSIYALAR
   ------------------------------------------------------------------------- */

function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('ru-RU').replace(/,/g, ' ') + " so'm";
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function apiGet(url) {
  const res = await fetch(url);
  return res.json();
}

async function apiSend(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({ success: false, message: 'Server javobini o\'qib bo\'lmadi.' }));
  return { ok: res.ok, data };
}

function showToast(message, type = 'ok') {
  const area = document.getElementById('toast-area');
  if (!area) return;
  const el = document.createElement('div');
  el.className = `glass toast ${type === 'ok' ? 'ok' : 'err'}`;
  el.textContent = message;
  area.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* -------------------------------------------------------------------------
   1. OSMA CHIROQ ZANJIRINI CHIZISH (2 qator, parallel)
   ------------------------------------------------------------------------- */

function renderLights() {
  const rows = [
    { id: 'bulbs-row1', count: 26, path: (x) => 6 + 40 * Math.sin((x / 1200) * Math.PI * 1.4) },
    { id: 'bulbs-row2', count: 22, path: (x) => 14 + 46 * Math.sin((x / 1200) * Math.PI * 1.4 + 0.4) }
  ];
  rows.forEach(row => {
    const g = document.getElementById(row.id);
    if (!g) return;
    let html = '';
    for (let i = 0; i < row.count; i++) {
      const x = (i / (row.count - 1)) * 1200;
      const y = row.path(x);
      html += `<circle class="bulb" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2"></circle>`;
    }
    g.innerHTML = html;
  });
}
renderLights();

/* -------------------------------------------------------------------------
   2. "BIP" OVOZI — Web Audio API orqali (tashqi fayl kerak emas)
   ------------------------------------------------------------------------- */

let audioCtx = null;
function playBeep(success = true) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = success ? 1046.5 : 300; // muvaffaqiyat: baland "bip", xato: past ton
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (success ? 0.16 : 0.28));
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + (success ? 0.18 : 0.3));
  } catch (e) {
    console.warn('Audio ijro etilmadi:', e.message);
  }
}

/* =========================================================================
   3. BOSH SAHIFA (index.html) MANTIQI
   ========================================================================= */

async function loadOverviewPage() {
  const totalEl = document.getElementById('ov-total');
  if (!totalEl) return; // bu sahifa emas

  const { data } = await apiSend('/api/overview', 'GET');
  if (!data.success) return;

  document.getElementById('ov-total').textContent = data.students.length;
  document.getElementById('ov-came').textContent = data.stats.kelgan;
  document.getElementById('ov-missed').textContent = data.stats.kelmagan;
  document.getElementById('ov-profit').textContent = fmtMoney(data.center_profit);

  const feedBody = document.getElementById('overview-feed-body');
  if (data.attendanceToday.length === 0) {
    feedBody.innerHTML = '<tr><td colspan="4" class="empty-state">Bugun hali davomat yo\'q.</td></tr>';
  } else {
    feedBody.innerHTML = data.attendanceToday.map(a => {
      const student = data.students.find(s => s.id === a.studentId);
      return `<tr>
        <td>${escapeHtml(a.studentName)}</td>
        <td>${escapeHtml(student ? student.group : '')}</td>
        <td><span class="badge ${a.status}">${a.status}</span></td>
        <td>${escapeHtml(a.time)}</td>
      </tr>`;
    }).join('');
  }

  renderHistoryTable(data.history);
}

function renderHistoryTable(history) {
  const table = document.getElementById('history-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!history || history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Arxiv bo\'sh.</td></tr>';
    return;
  }
  tbody.innerHTML = history.slice().reverse().map(h => {
    const totalSalary = Object.values(h.teacher_salary || {}).reduce((sum, t) => sum + (t.salary || 0), 0);
    return `<tr>
      <td>${escapeHtml(h.month)}</td>
      <td>${fmtMoney(h.center_profit)}</td>
      <td>${fmtMoney(totalSalary)}</td>
    </tr>`;
  }).join('');
}

/* =========================================================================
   4. ADMIN PANEL (admin.html) MANTIQI
   ========================================================================= */

let ADMIN_STATE = { students: [], teachers: [] };

async function loadAdminData() {
  const totalEl = document.getElementById('stat-total');
  if (!totalEl) return; // bu admin sahifa emas

  const { data } = await apiSend('/api/overview', 'GET');
  if (!data.success) {
    showToast('Ma\'lumotlarni yuklashda xatolik.', 'err');
    return;
  }

  ADMIN_STATE.students = data.students;
  ADMIN_STATE.teachers = data.teachers;

  document.getElementById('stat-total').textContent = data.students.length;
  document.getElementById('stat-came').textContent = data.stats.kelgan;
  document.getElementById('stat-missed').textContent = data.stats.kelmagan;
  document.getElementById('stat-profit').textContent = fmtMoney(data.center_profit);

  renderTeacherSelects();
  renderStudentsTable();
  renderTeachersTable();
  renderLiveFeed(data.attendanceToday);
  renderHistoryTable(data.history);
}

function teacherName(teacherId) {
  const t = ADMIN_STATE.teachers.find(t => t.id === teacherId);
  return t ? t.name : '—';
}

function renderTeacherSelects() {
  const pairs = [
    { teacherSel: document.getElementById('f-teacher'), groupSel: document.getElementById('f-group') },
    { teacherSel: document.getElementById('e-teacher'), groupSel: document.getElementById('e-group') }
  ];
  pairs.forEach(({ teacherSel, groupSel }) => {
    if (!teacherSel) return;
    const current = teacherSel.value;
    teacherSel.innerHTML = '<option value="">— O\'qituvchi tanlang —</option>' +
      ADMIN_STATE.teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    if (current) teacherSel.value = current;
    if (groupSel) populateGroupOptions(groupSel, teacherSel.value, groupSel.value);
  });
}

// Tanlangan o'qituvchining guruhlarini Guruh select ichiga to'ldiradi.
// Har bir o'qituvchi faqat o'ziga tegishli guruhlar ro'yxatiga ega.
function populateGroupOptions(groupSel, teacherId, selectedValue) {
  if (!groupSel) return;
  if (!teacherId) {
    groupSel.innerHTML = '<option value="">— avval o\'qituvchini tanlang —</option>';
    groupSel.disabled = true;
    return;
  }
  const teacher = ADMIN_STATE.teachers.find(t => t.id === teacherId);
  const groups = teacher ? (teacher.groups || []) : [];
  groupSel.disabled = false;
  if (groups.length === 0) {
    groupSel.innerHTML = '<option value="">— bu o\'qituvchida guruh yo\'q —</option>';
    return;
  }
  groupSel.innerHTML = '<option value="">— Guruh tanlang —</option>' +
    groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
  if (selectedValue && groups.includes(selectedValue)) groupSel.value = selectedValue;
}

// O'qituvchi tanlanganda tegishli guruhlar ro'yxati yangilanishi uchun listenerlar
function initTeacherGroupLinking() {
  const fTeacher = document.getElementById('f-teacher');
  const fGroup = document.getElementById('f-group');
  if (fTeacher && fGroup) {
    fTeacher.addEventListener('change', () => populateGroupOptions(fGroup, fTeacher.value, ''));
  }
  const eTeacher = document.getElementById('e-teacher');
  const eGroup = document.getElementById('e-group');
  if (eTeacher && eGroup) {
    eTeacher.addEventListener('change', () => populateGroupOptions(eGroup, eTeacher.value, ''));
  }
}

function renderStudentsTable() {
  const body = document.getElementById('students-table-body');
  if (!body) return;
  if (ADMIN_STATE.students.length === 0) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">Hali o\'quvchi qo\'shilmagan.</td></tr>';
    return;
  }
  body.innerHTML = ADMIN_STATE.students.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.group)}</td>
      <td>${escapeHtml(teacherName(s.teacherId))}</td>
      <td>${fmtMoney(s.fee)}</td>
      <td>${fmtMoney(s.balance)}</td>
      <td>${escapeHtml(s.studQrCode) || '—'}</td>
      <td>${escapeHtml(s.lessonStart) || '—'} – ${escapeHtml(s.lessonEnd) || '—'}</td>
      <td>
        <button class="btn sm" onclick="openEditModal('${s.id}')">✏️ Tahrirlash</button>
        <button class="btn sm danger" onclick="deleteStudent('${s.id}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

function renderTeachersTable() {
  const body = document.getElementById('teachers-table-body');
  if (!body) return;
  if (ADMIN_STATE.teachers.length === 0) {
    body.innerHTML = '<tr><td colspan="4" class="empty-state">Hali o\'qituvchi qo\'shilmagan.</td></tr>';
    return;
  }
  body.innerHTML = ADMIN_STATE.teachers.map(t => {
    const groups = t.groups || [];
    const badges = groups.length
      ? groups.map(g => `<span class="badge keldi group-badge" data-teacher="${t.id}" data-group="${escapeHtml(g)}" title="O'chirish uchun bosing" style="cursor:pointer; margin:2px 4px 2px 0; display:inline-block;">${escapeHtml(g)} ✕</span>`).join('')
      : '<span style="color:var(--text-dim); font-size:0.8rem;">guruh yo\'q</span>';
    return `
    <tr>
      <td>${escapeHtml(t.name)}</td>
      <td>
        <div style="margin-bottom:8px; max-width:260px;">${badges}</div>
        <div style="display:flex; gap:6px;">
          <input type="text" id="new-group-${t.id}" placeholder="Yangi guruh nomi" style="max-width:150px; padding:6px 10px; font-size:0.78rem;" />
          <button class="btn sm add-group-btn" data-teacher="${t.id}">+ Guruh</button>
        </div>
      </td>
      <td>${fmtMoney(t.salary)}</td>
      <td><button class="btn sm danger" onclick="deleteTeacher('${t.id}')">🗑 O'chirish</button></td>
    </tr>
  `;
  }).join('');
}

async function addGroupToTeacher(teacherId) {
  const input = document.getElementById(`new-group-${teacherId}`);
  if (!input) return;
  const group = input.value.trim();
  if (!group) return;
  const { ok, data } = await apiSend(`/api/teachers/${teacherId}/groups`, 'POST', { group });
  if (ok && data.success) {
    showToast(`✅ "${group}" guruhi qo'shildi.`, 'ok');
    loadAdminData();
  } else {
    showToast(`⚠️ ${data.message || 'Guruh qo\'shishda xatolik.'}`, 'err');
  }
}

async function removeGroupFromTeacher(teacherId, group) {
  if (!confirm(`"${group}" guruhini o'chirishni tasdiqlaysizmi?`)) return;
  const { ok, data } = await apiSend(`/api/teachers/${teacherId}/groups/${encodeURIComponent(group)}`, 'DELETE');
  if (ok && data.success) {
    showToast('Guruh o\'chirildi.', 'ok');
    loadAdminData();
  } else {
    showToast(`⚠️ ${data.message || 'O\'chirishda xatolik.'}`, 'err');
  }
}

// Guruh qo'shish tugmasi va guruh belgisini o'chirish uchun delegatsiyalangan listener
function initTeachersTableEvents() {
  const body = document.getElementById('teachers-table-body');
  if (!body) return;
  body.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.add-group-btn');
    if (addBtn) {
      addGroupToTeacher(addBtn.dataset.teacher);
      return;
    }
    const badge = e.target.closest('.group-badge');
    if (badge) {
      removeGroupFromTeacher(badge.dataset.teacher, badge.dataset.group);
    }
  });
}

function renderLiveFeed(attendanceToday) {
  const body = document.getElementById('live-feed-body');
  if (!body) return;
  if (!attendanceToday || attendanceToday.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="empty-state">Hali skaner qilinmadi.</td></tr>';
    return;
  }
  body.innerHTML = attendanceToday.map(a => `
    <tr>
      <td>${escapeHtml(a.studentName)}</td>
      <td><span class="badge ${a.status}">${a.status}</span></td>
      <td>${escapeHtml(a.time)}</td>
    </tr>
  `).join('');
}

function prependLiveFeedRow(record) {
  const body = document.getElementById('live-feed-body');
  if (!body) return;
  const emptyRow = body.querySelector('.empty-state');
  if (emptyRow) emptyRow.closest('tr').remove();

  const tr = document.createElement('tr');
  tr.className = 'row-in';
  tr.innerHTML = `
    <td>${escapeHtml(record.studentName)}</td>
    <td><span class="badge ${record.status}">${record.status}</span></td>
    <td>${escapeHtml(record.time)}</td>
  `;
  body.insertBefore(tr, body.firstChild);
}

function pulseCard(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.remove('pulse');
  // reflow trigger to restart animation
  void card.offsetWidth;
  card.classList.add('pulse');
}

/* -------------------------------------------------------------------------
   4.1 QR-DAVOMATNI YUBORISH (sahifa yangilanmasdan)
   ------------------------------------------------------------------------- */

let SCAN_LOCK = false;

async function submitAttendance(rawCode) {
  const code = String(rawCode || '').trim();
  if (!code) return;
  if (SCAN_LOCK) return; // ketma-ket tasodifiy qayta yuborishning oldini olish
  SCAN_LOCK = true;
  setTimeout(() => { SCAN_LOCK = false; }, 900);

  const { ok, data } = await apiSend('/api/attendance/qr', 'POST', { code });

  if (ok && data.success) {
    playBeep(true);
    prependLiveFeedRow(data.record);
    document.getElementById('stat-came').textContent = data.stats.kelgan;
    document.getElementById('stat-missed').textContent = data.stats.kelmagan;
    pulseCard('card-came');
    showToast(`✅ ${data.student.name} — davomatga olindi (${data.record.time})`, 'ok');

    // Fon jadvalini ham (o'quvchi balansi o'zgargani uchun) yangilaymiz
    const idx = ADMIN_STATE.students.findIndex(s => s.id === data.student.id);
    if (idx !== -1) {
      ADMIN_STATE.students[idx].balance = data.student.balance;
      renderStudentsTable();
    }
  } else {
    playBeep(false);
    showToast(`⚠️ ${data.message || 'Xatolik yuz berdi'}`, 'err');
  }
}

function initManualScanInput() {
  const input = document.getElementById('manualQrInput');
  if (!input) return;

  // Skaner apparati "Enter" bosadi — shu bilan avtomatik yuboriladi
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAttendance(input.value);
      input.value = '';
    }
  });

  // Fokusni faqat "bo'sh joyda" (hech qanday forma maydoni band bo'lmaganda)
  // shu inputga qaytaramiz — aks holda boshqa maydonlarga yozish imkonsiz bo'lib qolardi.
  const isFormField = (el) => el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
  const refocus = () => {
    const active = document.activeElement;
    const modalOpen = !!document.querySelector('.modal-overlay.open');
    const somethingElseFocused = isFormField(active) && active !== input;
    if (!modalOpen && !somethingElseFocused && active !== input) {
      input.focus();
    }
  };
  setInterval(refocus, 1200);
  input.focus();
}

/* -------------------------------------------------------------------------
   4.2 KAMERA ORQALI QR-SKANER (html5-qrcode kutubxonasi)
   ------------------------------------------------------------------------- */

let CAMERA_STARTED = false;
let HTML5_QR_INSTANCE = null;

function setCameraStatus(text, isError) {
  const el = document.getElementById('camera-status');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? 'var(--danger)' : 'var(--text-dim)';
}

function initCameraScanner() {
  const readerEl = document.getElementById('qr-reader');
  const startBtn = document.getElementById('startCameraBtn');
  if (!readerEl || !startBtn) return;

  startBtn.addEventListener('click', async () => {
    if (CAMERA_STARTED) return;

    if (typeof Html5Qrcode === 'undefined') {
      setCameraStatus('❌ Skaner kutubxonasi yuklanmadi (internet aloqasi yoki reklama blokerini tekshiring), sahifani yangilab qayta urinib ko\'ring.', true);
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Kamera so\'ralmoqda...';
    setCameraStatus('Brauzer kamera ruxsatini so\'ramoqda — chiqqan oynada "Ruxsat berish / Allow" tugmasini bosing.');

    try {
      HTML5_QR_INSTANCE = new Html5Qrcode('qr-reader');

      const startWith = async (cameraConfig) => {
        return HTML5_QR_INSTANCE.start(
          cameraConfig,
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (decodedText) => {
            if (SCAN_LOCK) return;
            submitAttendance(decodedText);
          },
          () => { /* har bir frame skan qilinmasa jim o'tkaziladi */ }
        );
      };

      // Avval orqa kamerani (telefon) so'raymiz, topilmasa mavjud birinchi kamerani ishlatamiz
      try {
        await startWith({ facingMode: 'environment' });
      } catch (envErr) {
        console.warn('Orqa kamera topilmadi, mavjud kameralar ro\'yxatidan foydalanilmoqda:', envErr);
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          throw new Error('Hech qanday kamera topilmadi.');
        }
        await startWith(cameras[0].id);
      }

      CAMERA_STARTED = true;
      startBtn.style.display = 'none';
      setCameraStatus('✅ Kamera ishga tushdi — QR-kodni ramka ichiga tuting.');
    } catch (err) {
      console.error('Kamera xatoligi:', err);
      startBtn.disabled = false;
      startBtn.textContent = '📷 Kamerani qayta urinish';
      let msg = 'Kamerani ishga tushirib bo\'lmadi: ' + (err && err.message ? err.message : err);
      if (String(err).toLowerCase().includes('permission') || String(err).toLowerCase().includes('notallowed')) {
        msg = '❌ Kameraga ruxsat berilmadi. Brauzer manzil satridagi 🔒/ⓘ belgisini bosib, Camera → Allow qiling, so\'ng sahifani yangilang.';
      } else if (String(err).toLowerCase().includes('notfound')) {
        msg = '❌ Kamera topilmadi. Qurilmangizda kamera borligini va boshqa dastur (Zoom, Skype va h.k.) uni band qilib turmaganini tekshiring.';
      } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        msg = '❌ Kamera faqat HTTPS orqali ishlaydi. Sahifani https:// manzili orqali oching.';
      }
      setCameraStatus(msg, true);
    }
  });
}

/* -------------------------------------------------------------------------
   4.3 O'QUVCHI QO'SHISH / TAHRIRLASH / O'CHIRISH
   ------------------------------------------------------------------------- */

function initAddStudentForm() {
  const form = document.getElementById('addStudentForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      group: document.getElementById('f-group').value.trim(),
      teacherId: document.getElementById('f-teacher').value || null,
      fee: Number(document.getElementById('f-fee').value),
      studQrCode: document.getElementById('f-qrcode').value.trim(),
      lessonStart: document.getElementById('f-lesson-start').value,
      lessonEnd: document.getElementById('f-lesson-end').value,
      parentChatId: document.getElementById('f-parent-chat').value.trim()
    };

    const { ok, data } = await apiSend('/api/students', 'POST', payload);
    if (ok && data.success) {
      showToast(`✅ ${data.student.name} ro'yxatga qo'shildi.`, 'ok');
      form.reset();
      loadAdminData();
    } else {
      showToast(`⚠️ ${data.message || 'Qo\'shishda xatolik.'}`, 'err');
    }
  });
}

function openEditModal(studentId) {
  const student = ADMIN_STATE.students.find(s => s.id === studentId);
  if (!student) return;

  document.getElementById('e-id').value = student.id;
  document.getElementById('e-name').value = student.name || '';
  document.getElementById('e-teacher').value = student.teacherId || '';
  populateGroupOptions(document.getElementById('e-group'), student.teacherId || '', student.group || '');
  document.getElementById('e-fee').value = student.fee || 0;
  document.getElementById('e-balance').value = student.balance || 0;
  document.getElementById('e-qrcode').value = student.studQrCode || '';
  document.getElementById('e-lesson-start').value = student.lessonStart || '';
  document.getElementById('e-lesson-end').value = student.lessonEnd || '';
  document.getElementById('e-parent-chat').value = student.parentChatId || '';

  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

function initEditModal() {
  const form = document.getElementById('editStudentForm');
  if (!form) return;

  document.getElementById('closeModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') closeEditModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('e-id').value;
    const payload = {
      name: document.getElementById('e-name').value.trim(),
      group: document.getElementById('e-group').value.trim(),
      teacherId: document.getElementById('e-teacher').value || null,
      fee: Number(document.getElementById('e-fee').value),
      balance: Number(document.getElementById('e-balance').value),
      studQrCode: document.getElementById('e-qrcode').value.trim(),
      lessonStart: document.getElementById('e-lesson-start').value,
      lessonEnd: document.getElementById('e-lesson-end').value,
      parentChatId: document.getElementById('e-parent-chat').value.trim()
    };

    const { ok, data } = await apiSend(`/api/students/${id}`, 'PUT', payload);
    if (ok && data.success) {
      showToast(`✅ ${data.student.name} ma'lumotlari yangilandi.`, 'ok');
      closeEditModal();
      loadAdminData();
    } else {
      showToast(`⚠️ ${data.message || 'Saqlashda xatolik.'}`, 'err');
    }
  });
}

async function deleteStudent(id) {
  if (!confirm('O\'quvchini ro\'yxatdan o\'chirishni tasdiqlaysizmi?')) return;
  const { ok, data } = await apiSend(`/api/students/${id}`, 'DELETE');
  if (ok && data.success) {
    showToast('O\'quvchi o\'chirildi.', 'ok');
    loadAdminData();
  } else {
    showToast(`⚠️ ${data.message || 'O\'chirishda xatolik.'}`, 'err');
  }
}

/* -------------------------------------------------------------------------
   4.4 O'QITUVCHI QO'SHISH / O'CHIRISH
   ------------------------------------------------------------------------- */

function initAddTeacherForm() {
  const form = document.getElementById('addTeacherForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('f-teacher-name');
    const name = nameInput.value.trim();
    if (!name) return;

    const { ok, data } = await apiSend('/api/teachers', 'POST', { name });
    if (ok && data.success) {
      showToast(`✅ ${data.teacher.name} o'qituvchilar ro'yxatiga qo'shildi.`, 'ok');
      nameInput.value = '';
      loadAdminData();
    } else {
      showToast(`⚠️ ${data.message || 'Qo\'shishda xatolik.'}`, 'err');
    }
  });
}

async function deleteTeacher(id) {
  if (!confirm('O\'qituvchini o\'chirishni tasdiqlaysizmi?')) return;
  const { ok, data } = await apiSend(`/api/teachers/${id}`, 'DELETE');
  if (ok && data.success) {
    showToast('O\'qituvchi o\'chirildi.', 'ok');
    loadAdminData();
  } else {
    showToast(`⚠️ ${data.message || 'O\'chirishda xatolik.'}`, 'err');
  }
}

/* -------------------------------------------------------------------------
   4.5 DAVRIY YANGILANISH (boshqa qurilmadan ham skaner bo'lishi mumkin)
   ------------------------------------------------------------------------- */

function initPeriodicRefresh() {
  const isAdmin = !!document.getElementById('stat-total');
  const isOverview = !!document.getElementById('ov-total');
  if (isAdmin) setInterval(loadAdminData, 15000);
  if (isOverview) setInterval(loadOverviewPage, 15000);
}

/* =========================================================================
   5. ISHGA TUSHIRISH
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Bosh sahifa
  loadOverviewPage();

  // Admin panel
  loadAdminData();
  initCameraScanner();
  initManualScanInput();
  initAddStudentForm();
  initEditModal();
  initAddTeacherForm();
  initTeacherGroupLinking();
  initTeachersTableEvents();
  initPeriodicRefresh();
});
