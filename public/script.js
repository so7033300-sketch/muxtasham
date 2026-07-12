const API_URL = '/api';
let allStudents = [], allTeachers = [];

window.executeLogin = async function() {
    const login = document.getElementById('loginInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('errorMessage');
    if(!login || !password) return alert("Iltimos, login va parolni to'liq kiriting!");
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const data = await response.json();
        if (data.success) {
            if (data.role === 'admin') window.location.href = '/admin.html';
            else if (data.role === 'teacher') {
                localStorage.setItem('teacherId', data.teacherId);
                window.location.href = '/ustoz.html';
            }
        } else { errorDiv.style.display = 'block'; errorDiv.innerText = data.message; }
    } catch (err) { errorDiv.style.display = 'block'; errorDiv.innerText = "Server xatosi!"; }
}

window.logout = function() { localStorage.clear(); window.location.href = '/index.html'; }

async function loadDashboardData() {
    try {
        const response = await fetch(`${API_URL}/data`);
        const data = await response.json();
        allStudents = data.students || [];
        allTeachers = data.teachers || [];
        
        const teacherSelect = document.getElementById('studTeacher');
        if (teacherSelect) {
            teacherSelect.innerHTML = '<option value="" disabled selected>Qaysi o\'qituvchiga qo\'shish...</option>';
            allTeachers.forEach(t => { teacherSelect.innerHTML += `<option value="${t.id}">${t.name} (${t.subject})</option>`; });
        }
        renderStudents(allStudents);
        renderAttendance(data.attendance || []);
        renderTeachers(allTeachers);
        renderFinancialArchive(data.history || { center_profit: [], teacher_salary: [] });

        if (document.getElementById('centerProfitDisplay')) document.getElementById('centerProfitDisplay').innerText = `${(data.center_profit || 0).toLocaleString()} so'm`;
    } catch (err) { console.error(err); }
}
window.onTeacherSelected = function() {
    const teacherId = document.getElementById('studTeacher').value;
    const container = document.getElementById('groupSelectionContainer');
    const groupSelect = document.getElementById('studGroupSelect');
    if (!teacherId) return;
    container.style.display = 'block';

    const teacherGroups = [];
    allStudents.forEach(s => {
        if (s.teacherId === teacherId && s.groupName && s.groupName !== "undefined" && !teacherGroups.includes(s.groupName)) {
            teacherGroups.push(s.groupName);
        }
    });

    groupSelect.innerHTML = '';
    if (teacherGroups.length === 0) {
        groupSelect.innerHTML = '<option value="" disabled selected>Mavjud guruh yo\'q, yangi oching</option>';
        document.getElementById('groupModeSelect').value = 'create';
        toggleGroupMode();
    } else {
        groupSelect.innerHTML = '<option value="" disabled selected>Guruhni tanlang...</option>';
        teacherGroups.forEach(g => { groupSelect.innerHTML += `<option value="${g}">${g}</option>`; });
        document.getElementById('groupModeSelect').value = 'select';
        toggleGroupMode();
    }
}

window.toggleGroupMode = function() {
    const mode = document.getElementById('groupModeSelect').value;
    document.getElementById('existingGroupWrapper').style.display = mode === 'select' ? 'block' : 'none';
    document.getElementById('newGroupWrapper').style.display = mode === 'create' ? 'block' : 'none';
}

function filterStudents() {
    const query = document.getElementById('searchStudent').value.toLowerCase();
    renderStudents(allStudents.filter(s => s.name.toLowerCase().includes(query)));
}
function renderStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return; tbody.innerHTML = '';
    students.forEach(s => {
        const isDebtor = s.balance <= -150000 ? 'debtor-row' : '';
        const balanceClass = s.balance >= 0 ? 'status-paid' : 'status-debt';
        const tObj = allTeachers.find(t => t.id === s.teacherId);
        const displayName = tObj ? `${tObj.name} - ${s.groupName}` : 'Guruhsiz';

        tbody.innerHTML += `
            <tr class="${isDebtor}">
                <td><strong>${s.name}</strong></td>
                <td>${s.phone}</td>
                <td><span class="status-badge" style="background:rgba(129,140,248,0.15); color:#818cf8;">${displayName}</span></td>
                <td>${s.fee.toLocaleString()} so'm</td>
                <td><span class="status-badge ${balanceClass}">${s.balance.toLocaleString()} so'm</span></td>
                <td>
                    <div class="inline-form">
                        <input type="number" id="pay_${s.id}" placeholder="Summa" style="width:110px;">
                        <button class="btn" onclick="makePayment('${s.id}')">To'lash</button>
                    </div>
                </td>
                <td><button class="btn danger-btn" style="padding:6px 12px; font-size:12px; width:auto;" onclick="deleteStudent('${s.id}')">O'chirish</button></td>
            </tr>`;
    });
}

function renderAttendance(attendance) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return; tbody.innerHTML = '';
    attendance.slice().reverse().forEach(a => {
        const badge = a.status === 'keldi' ? '<span class="status-badge status-paid">Keldi</span>' : '<span class="status-badge status-debt">Kelmadi</span>';
        tbody.innerHTML += `<tr><td>${a.date}</td><td>${a.studentName}</td><td>${a.teacherName}</td><td>${badge}</td></tr>`;
    });
}

function renderTeachers(teachers) {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return; tbody.innerHTML = '';
    teachers.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${t.name}</strong></td>
                <td>${t.subject}</td>
                <td>${t.days.join(', ')} (${t.timeStart}-${t.timeEnd})</td>
                <td><span class="status-badge status-paid">${t.salary.toLocaleString()} so'm</span></td>
                <td><code>${t.login} / ${t.password}</code></td>
                <td><button class="btn danger-btn" style="padding:6px 12px; font-size:12px; width:auto;" onclick="deleteTeacher('${t.id}')">O'chirish</button></td>
            </tr>`;
    });
}

function renderFinancialArchive(history) {
    const centerTbody = document.getElementById('centerArchiveTableBody');
    const teacherTbody = document.getElementById('teacherArchiveTableBody');
    
    if (centerTbody) {
        if (!history.center_profit || history.center_profit.length === 0) {
            centerTbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#64748b;">Hozircha arxivlangan foyda yo'q.</td></tr>`;
        } else {
            centerTbody.innerHTML = '';
            history.center_profit.slice().reverse().forEach(item => {
                centerTbody.innerHTML += `<tr><td><span class="time-badge">${item.date}</span></td><td><strong style="color:#22c55e;">+${item.amount.toLocaleString()} so'm</strong></td></tr>`;
            });
        }
    }

    if (teacherTbody) {
        if (!history.teacher_salary || history.teacher_salary.length === 0) {
            teacherTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">Hozircha arxivlangan oyliklar yo'q.</td></tr>`;
        } else {
            teacherTbody.innerHTML = '';
            history.teacher_salary.slice().reverse().forEach(item => {
                teacherTbody.innerHTML += `<tr><td><span class="time-badge">${item.date}</span></td><td><strong>${item.teacherName}</strong></td><td>${item.subject}</td><td><span class="status-badge status-paid">${item.salary.toLocaleString()} so'm</span></td></tr>`;
            });
        }
    }
}
async function saveStudent(e) {
    if(e) e.preventDefault();
    const name = document.getElementById('studName').value;
    const phone = document.getElementById('studPhone').value;
    const birthYear = document.getElementById('studBirth').value;
    const fee = document.getElementById('studFee').value;
    const teacherId = document.getElementById('studTeacher').value;
    const parentChatId = document.getElementById('parentChatId').value;
    const mode = document.getElementById('groupModeSelect').value;
    let groupName = mode === 'select' ? document.getElementById('studGroupSelect').value : document.getElementById('studNewGroupInput').value.trim();

    if (!name || !phone || !birthYear || !fee || !teacherId || !groupName) return alert("Ma'lumotlarni to'liq kiriting!");

    const response = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, birthYear, fee, parentChatId, teacherId, groupName })
    });
    if (response.ok) { alert("O'quvchi saqlandi!"); document.getElementById('studentForm').reset(); document.getElementById('groupSelectionContainer').style.display='none'; loadDashboardData(); }
}

async function saveTeacher(e) {
    if(e) e.preventDefault();
    const name = document.getElementById('teachName').value;
    const subject = document.getElementById('teachSubject').value;
    const timeStart = document.getElementById('teachTimeStart').value;
    const timeEnd = document.getElementById('teachTimeEnd').value;
    const login = document.getElementById('teachLogin').value;
    const password = document.getElementById('teachPass').value;
    const checked = document.querySelectorAll('input[name="teachDaysCheck"]:checked');
    const days = []; checked.forEach(b => days.push(b.value));

    if (!name || !subject || !timeStart || !timeEnd || !login || !password || days.length === 0) return alert("Ma'lumotlarni to'liq kiriting!");

    const response = await fetch(`${API_URL}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, timeStart, timeEnd, days, login, password })
    });
    if (response.ok) { alert("O'qituvchi saqlandi!"); document.getElementById('teacherForm').reset(); loadDashboardData(); }
}

async function makePayment(studentId) {
    const amt = document.getElementById(`pay_${studentId}`).value;
    if (!amt || amt <= 0) return alert("To'g'ri summa kiriting!");
    const response = await fetch(`${API_URL}/students/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, amount: amt }) });
    if (response.ok) loadDashboardData();
}

window.deleteStudent = async function(id) { if (confirm("O'quvchi o'chirilsinmi?")) { await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' }); loadDashboardData(); } }
window.deleteTeacher = async function(id) { if (confirm("O'qituvchi o'chirilsinmi?")) { await fetch(`${API_URL}/teachers/${id}`, { method: 'DELETE' }); loadDashboardData(); } }
async function clearData(type) { if (confirm("Tozalansinmi?")) { await fetch(`${API_URL}/clear/${type}`, { method: 'DELETE' }); loadDashboardData(); } }

async function loadTeacherDashboard() {
    const currentTeacherId = localStorage.getItem('teacherId');
    if (!currentTeacherId) return;
    try {
        const response = await fetch(`${API_URL}/data`);
        const data = await response.json();
        const teacher = data.teachers.find(t => t.id === currentTeacherId);
        if (!teacher) { logout(); return; }

        document.getElementById('teacherNameHeader').innerText = teacher.name;
        document.getElementById('teacherSubject').innerText = teacher.subject;
        document.getElementById('teacherDays').innerText = teacher.days.join(', ');
        document.getElementById('teacherTime').innerText = `${teacher.timeStart} - ${teacher.timeEnd}`;
        document.getElementById('teacherSalary').innerText = `${teacher.salary.toLocaleString()} so'm`;

        const isLessonTime = checkLessonTime(teacher);
        const filteredStudents = (data.students || []).filter(s => s.teacherId === currentTeacherId);
        renderTeacherStudents(filteredStudents, isLessonTime, currentTeacherId);
    } catch (err) { console.error(err); }
}

function checkLessonTime(teacher) {
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tashkent"}));
    const currentDayIndex = now.getDay();
    const currentTimeStr = now.toTimeString().substring(0, 5);
    const teacherDaysString = teacher.days.join(' ').toLowerCase();
    
    const daysUz = { 1: "dushanba", 2: "seshanba", 3: "chorshanba", 4: "payshanba", 5: "juma", 6: "shanba", 0: "yakshanba" };
    const todayName = daysUz[currentDayIndex];
    const hasLessonToday = teacherDaysString.includes(todayName);
    const noticeDiv = document.getElementById('timeStatusNotice');
    if (!noticeDiv) return false;

    if (!hasLessonToday) { noticeDiv.innerHTML = `⚠️ Bugun dars kuningiz emas.`; noticeDiv.style.color = '#f87171'; return false; }
    if (currentTimeStr >= teacher.timeStart && currentTimeStr <= teacher.timeEnd) {
        noticeDiv.innerHTML = `✅ Dars vaqti faol. Davomat qilishingiz mumkin.`; noticeDiv.style.color = '#4ade80'; return true;
    } else { noticeDiv.innerHTML = `🔒 Dars vaqti emas.`; noticeDiv.style.color = '#eab308'; return false; }
}

function renderTeacherStudents(students, isLessonTime, teacherId) {
    const container = document.getElementById('teacherGroupsContainer');
    if (!container) return; container.innerHTML = '';
    if (students.length === 0) { container.innerHTML = `<div class="card glass-container" style="text-align:center;color:#64748b;">O'quvchilar yo'q.</div>`; return; }
    
    const groups = {};
    students.forEach(s => { const gName = s.groupName || "Asosiy Guruh"; if (!groups[gName]) groups[gName] = []; groups[gName].push(s); });

    for (const groupName in groups) {
        const groupStudents = groups[groupName];
        const groupCard = document.createElement('div');
        groupCard.className = 'card glass-container'; groupCard.style.maxWidth = '100%'; groupCard.style.marginBottom = '30px';
        groupCard.innerHTML = `<h3 class="group-title">📦 Guruh: ${groupName} (${groupStudents.length} ta o'quvchi)</h3>`;
        const tableResponsive = document.createElement('div'); tableResponsive.className = 'table-responsive';
        const table = document.createElement('table');
        table.innerHTML = `<thead><tr><th>Ism Familya</th><th>Telefon raqam</th><th>Tug'ilgan yili</th><th>O'quvchi Balansi</th><th>Davomat</th></tr></thead>`;
        const tbody = document.createElement('tbody');

        groupStudents.forEach(s => {
            const isDebtor = s.balance <= -150000 ? 'debtor-row' : '';
            const balanceClass = s.balance >= 0 ? 'status-paid' : 'status-debt';
            const isButtonActive = isLessonTime && !s.attendedToday;
            const disabledAttr = isButtonActive ? '' : 'disabled';
            const btnClassExtension = isButtonActive ? '' : 'btn-disabled';

            const attendanceCellContent = s.attendedToday 
                ? `<span class="status-badge status-paid" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600;">🔒 Belgilandi</span>`
                : `<div style="display: flex; gap: 10px;">
                        <button ${disabledAttr} class="btn btn-success ${btnClassExtension}" onclick="submitAttendance('${s.id}', 'keldi', '${teacherId}')">Keldi</button>
                        <button ${disabledAttr} class="btn btn-danger-action ${btnClassExtension}" onclick="submitAttendance('${s.id}', 'kelmadi', '${teacherId}')">Kelmadi</button>
                   </div>`;

            tbody.innerHTML += `<tr class="${isDebtor}"><td><strong>${s.name}</strong></td><td>${s.phone}</td><td>${s.birthYear}-yil</td><td><span class="status-badge ${balanceClass}">${s.balance.toLocaleString()} so'm</span></td><td>${attendanceCellContent}</td></tr>`;
        });
        table.appendChild(tbody); tableResponsive.appendChild(table); groupCard.appendChild(tableResponsive); container.appendChild(groupCard);
    }
}

async function submitAttendance(studentId, status, teacherId) {
    if (!confirm("Davomat saqlansinmi?")) return;
    try {
        const response = await fetch(`${API_URL}/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId, studentId, status }) });
        if (response.ok) { alert("Davomat saqlandi va qulflandi!"); await loadTeacherDashboard(); }
    } catch (err) { alert("Server bilan aloqa uzildi!"); }
}

window.onload = function() {
    if (document.getElementById('studentsTableBody')) {
        loadDashboardData();
        document.getElementById('studentForm').addEventListener('submit', saveStudent);
        document.getElementById('teacherForm').addEventListener('submit', saveTeacher);
    }
    if (document.getElementById('teacherGroupsContainer')) { loadTeacherDashboard(); }
};
