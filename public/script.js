const API_URL = '/api';

// Tizimga xavfsiz va sahifa yangilanmasdan kirish funksiyasi
window.executeLogin = async function() {
    const login = document.getElementById('loginInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('errorMessage');
    
    if(!login || !password) {
        alert("Iltimos, login va parolni to'liq kiriting!");
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const data = await response.json();
        
        if (data.success) {
            if (data.role === 'admin') {
                window.location.href = '/admin.html';
            } else if (data.role === 'teacher') {
                localStorage.setItem('teacherId', data.teacherId);
                window.location.href = '/ustoz.html';
            }
        } else {
            errorDiv.style.display = 'block';
            errorDiv.innerText = data.message;
        }
    } catch (err) {
        errorDiv.style.display = 'block';
        errorDiv.innerText = "Server bilan aloqa uzildi!";
    }
}

window.logout = function() {
    localStorage.clear();
    window.location.href = '/index.html';
}
let allStudents = [];
let allTeachers = [];

// Admin panelidagi barcha ma'lumotlarni serverdan yuklash
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_URL}/data`);
        const data = await response.json();
        
        allStudents = data.students || [];
        allTeachers = data.teachers || [];
        
        // Dinamik ravishda o'quvchi qo'shish joyiga ustozlarni joylash
        const teacherSelect = document.getElementById('studTeacher');
        if (teacherSelect) {
            teacherSelect.innerHTML = '<option value="" disabled selected>Qaysi o\'qituvchiga qo\'shish...</option>';
            allTeachers.forEach(t => {
                teacherSelect.innerHTML += `<option value="${t.id}">${t.name} (${t.subject})</option>`;
            });
        }

        renderStudents(allStudents);
        renderAttendance(data.attendance || []);
        renderTeachers(allTeachers);

        // Serverdan kelayotgan markaz foydasini ekranga chiqarish
        const centerProfit = data.center_profit || 0;
        const profitDisplay = document.getElementById('centerProfitDisplay');
        if (profitDisplay) {
            profitDisplay.innerText = `${centerProfit.toLocaleString()} so'm`;
        }
    } catch (err) {
        console.error("Ma'lumotlarni yuklashda xatolik yuz berdi!");
    }
}

// USTOZ TANLANGANDA GURUH OPTIONLARINI JAVASCRIPTDA SILLIQ FILTRLASH
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
        teacherGroups.forEach(g => {
            groupSelect.innerHTML += `<option value="${g}">${g}</option>`;
        });
        document.getElementById('groupModeSelect').value = 'select';
        toggleGroupMode();
    }
}

window.toggleGroupMode = function() {
    const mode = document.getElementById('groupModeSelect').value;
    if (mode === 'select') {
        document.getElementById('existingGroupWrapper').style.display = 'block';
        document.getElementById('newGroupWrapper').style.display = 'none';
    } else {
        document.getElementById('existingGroupWrapper').style.display = 'none';
        document.getElementById('newGroupWrapper').style.display = 'block';
    }
}

function filterStudents() {
    const query = document.getElementById('searchStudent').value.toLowerCase();
    renderStudents(allStudents.filter(s => s.name.toLowerCase().includes(query)));
}
function renderStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
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
            </tr>`;
    });
}

function renderAttendance(attendance) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    attendance.slice().reverse().forEach(a => {
        const statusBadge = a.status === 'keldi' ? '<span class="status-badge status-paid">Keldi</span>' : '<span class="status-badge status-debt">Kelmadi</span>';
        tbody.innerHTML += `<tr><td>${a.date}</td><td>${a.studentName}</td><td>${a.teacherName}</td><td>${statusBadge}</td></tr>`;
    });
}

function renderTeachers(teachers) {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    teachers.forEach(t => {
        const daysText = Array.isArray(t.days) ? t.days.join(', ') : t.days;
        tbody.innerHTML += `
            <tr>
                <td><strong>${t.name}</strong></td>
                <td>${t.subject}</td>
                <td>${daysText} (${t.timeStart}-${t.timeEnd})</td>
                <td><span class="status-badge status-paid">${t.salary.toLocaleString()} so'm</span></td>
                <td><code>${t.login} / ${t.password}</code></td>
                <td><button class="btn danger-btn" style="padding:6px 12px; font-size:12px; width:auto;" onclick="deleteTeacher('${t.id}')">O'chirish</button></td>
            </tr>`;
    });
}
async function saveStudent(e) {
    e.preventDefault();
    const name = document.getElementById('studName').value;
    const phone = document.getElementById('studPhone').value;
    const birthYear = document.getElementById('studBirth').value;
    const fee = document.getElementById('studFee').value;
    const teacherId = document.getElementById('studTeacher').value;
    const parentChatId = document.getElementById('parentChatId').value;
    
    const mode = document.getElementById('groupModeSelect').value;
    let groupName = "";
    
    if (mode === 'select') {
        groupName = document.getElementById('studGroupSelect').value;
        if (!groupName) return alert("Iltimos, guruhni tanlang!");
    } else {
        groupName = document.getElementById('studNewGroupInput').value.trim();
        if (!groupName) return alert("Iltimos, yangi guruh nomini yozing!");
    }

    const response = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, birthYear, fee, parentChatId, teacherId, groupName })
    });
    if (response.ok) { 
        document.getElementById('studentForm').reset(); 
        document.getElementById('groupSelectionContainer').style.display='none'; 
        loadDashboardData(); 
    }
}

async function saveTeacher(e) {
    e.preventDefault();
    const name = document.getElementById('teachName').value;
    const subject = document.getElementById('teachSubject').value;
    const timeStart = document.getElementById('teachTimeStart').value;
    const timeEnd = document.getElementById('teachTimeEnd').value;
    const login = document.getElementById('teachLogin').value;
    const password = document.getElementById('teachPass').value;
    
    const checked = document.querySelectorAll('input[name="teachDaysCheck"]:checked');
    const days = []; 
    checked.forEach(b => days.push(b.value));
    if (days.length === 0) return alert("Iltimos, dars kunini tanlang!");

    const response = await fetch(`${API_URL}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, timeStart, timeEnd, days, login, password })
    });
    if (response.ok) { 
        document.getElementById('teacherForm').reset(); 
        loadDashboardData(); 
    }
}

async function makePayment(studentId) {
    const amt = document.getElementById(`pay_${studentId}`).value;
    if (!amt || amt <= 0) return alert("To'g'ri summa kiriting!");
    
    const response = await fetch(`${API_URL}/students/pay`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ studentId, amount: amt }) 
    });
    if (response.ok) loadDashboardData();
}

window.deleteTeacher = async function(id) {
    if (confirm("O'qituvchini tizimdan butunlay o'chirmoqchimisiz?")) { 
        await fetch(`${API_URL}/teachers/${id}`, { method: 'DELETE' }); 
        loadDashboardData(); 
    }
}

async function clearData(type) {
    if (confirm("Haqiqatdan ham ushbu ma'lumotlarni o'chirib, bazani tozalamoqchimisiz?")) { 
        await fetch(`${API_URL}/clear/${type}`, { method: 'DELETE' }); 
        loadDashboardData(); 
    }
}
const dayIndexMap = {"dushanba": 1, "seshanba": 2, "chorshanba": 3, "payshanba": 4, "juma": 5, "shanba": 6, "yakshanba": 0};

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
        document.getElementById('teacherDays').innerText = Array.isArray(teacher.days) ? teacher.days.join(', ') : teacher.days;
        document.getElementById('teacherTime').innerText = `${teacher.timeStart} - ${teacher.timeEnd}`;
        document.getElementById('teacherSalary').innerText = `${teacher.salary.toLocaleString()} so'm`;

        const isLessonTime = checkLessonTime(teacher);
        
        // FAQAT USHBU USTOZNING SHAXSIY GURUHIDAGI BOLALARNI FILTRLASH
        const filteredStudents = (data.students || []).filter(s => s.teacherId === currentTeacherId);
        renderTeacherStudents(filteredStudents, isLessonTime, currentTeacherId);
    } catch (err) { console.error(err); }
}

function checkLessonTime(teacher) {
    const now = new Date();
    const currentDayIndex = now.getDay();
    const currentTimeStr = now.toTimeString().substring(0, 5);
    const teacherDaysString = Array.isArray(teacher.days) ? teacher.days.join(' ').toLowerCase() : String(teacher.days).toLowerCase();
    
    const daysUz = { 0: "yakshanba", 1: "dushanba", 2: "seshanba", 3: "chorshanba", 4: "payshanba", 5: "juma", 6: "shanba" };
    const todayName = daysUz[currentDayIndex];
    const hasLessonToday = teacherDaysString.includes(todayName);
    const noticeDiv = document.getElementById('timeStatusNotice');
    if (!noticeDiv) return false;

    if (!hasLessonToday) {
        noticeDiv.innerHTML = `⚠️ Bugun dars kuningiz emas. Davomat tizimi yopiq.`;
        noticeDiv.style.color = '#f87171';
        return false;
    }
    if (currentTimeStr >= teacher.timeStart && currentTimeStr <= teacher.timeEnd) {
        noticeDiv.innerHTML = `✅ Dars vaqti faol (${teacher.timeStart} - ${teacher.timeEnd}). Davomat qilishingiz mumkin.`;
        noticeDiv.style.color = '#4ade80';
        return true;
    } else {
        noticeDiv.innerHTML = `🔒 Dars vaqti emas (Hozirgi vaqt: ${currentTimeStr}). Davomat tizimi yopilgan.`;
        noticeDiv.style.color = '#eab308';
        return false;
    }
}

function renderTeacherStudents(students, isLessonTime, teacherId) {
    const container = document.getElementById('teacherGroupsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (students.length === 0) {
        container.innerHTML = `<div class="card glass-container" style="max-width: 100%; text-align: center; color: #64748b;">Hozircha guruhlaringizda o'quvchilar mavjud emas.</div>`;
        return;
    }

    const groups = {};
    students.forEach(s => {
        const gName = s.groupName || "Asosiy Guruh";
        if (!groups[gName]) { groups[gName] = []; }
        groups[gName].push(s);
    });

    for (const groupName in groups) {
        const groupStudents = groups[groupName];

        const groupCard = document.createElement('div');
        groupCard.className = 'card glass-container';
        groupCard.style.maxWidth = '100%';
        groupCard.style.marginBottom = '30px';

        groupCard.innerHTML = `<h3 class="group-title">📦 Guruh: ${groupName} (${groupStudents.length} ta o'quvchi)</h3>`;

        const tableResponsive = document.createElement('div');
        tableResponsive.className = 'table-responsive';

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Ism Familya</th>
                    <th>Telefon raqam</th>
                    <th>Tug'ilgan yili</th>
                    <th>O'quvchi Balansi</th>
                    <th>Davomat (Faqat dars vaqtida)</th>
                </tr>
            </thead>
        `;

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

            tbody.innerHTML += `
                <tr class="${isDebtor}">
                    <td><strong>${s.name}</strong></td>
                    <td>${s.phone}</td>
                    <td>${s.birthYear}-yil</td>
                    <td><span class="status-badge ${balanceClass}">${s.balance.toLocaleString()} so'm</span></td>
                    <td>${attendanceCellContent}</td>
                </tr>`;
        });

        table.appendChild(tbody);
        tableResponsive.appendChild(table);
        groupCard.appendChild(tableResponsive);
        container.appendChild(groupCard);
    }
}

async function submitAttendance(studentId, status, teacherId) {
    if (!confirm(`O'quvchini '${status.toUpperCase()}' deb belgilamoqchimisiz? (Bu dars uchun amalni qaytarib bo'lmaydi)`)) return;
    try {
        const response = await fetch(`${API_URL}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId, studentId, status })
        });
        if (response.ok) {
            alert("Davomat muvaffaqiyatli saqlandi va ushbu o'quvchi uchun qulflandi!");
            // Ma'lumotlarni qayta yuklab, tugmalarni zudlik bilan muzlatish
            await loadTeacherDashboard();
        }
    } catch (err) { alert("Server bilan aloqa uzildi!"); }
}

// MUTLAQ TO'G'RILANGAN JONLI QULFLASH TIZIMI INITIALIZATIONI
window.onload = function() {
    if (document.getElementById('studentsTableBody')) {
        loadDashboardData();
        document.getElementById('studentForm').addEventListener('submit', saveStudent);
        document.getElementById('teacherForm').addEventListener('submit', saveTeacher);
    }
    if (document.getElementById('teacherGroupsContainer')) {
        loadTeacherDashboard();
    }
};
