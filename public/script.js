// Render serveringizning mutlaq to'liq manzili
const API_URL = 'https://onrender.com';

// Render serveringizning mutlaq to'liq manzili
const API_URL = 'https://muxtasham-jgqv.onrender.com';

// Funksiyani global window obyektiga bog'laymiz (Tugma 100% ishlashi uchun)
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

// Admin panelidagi barcha ma'lumotlarni serverdan yuklash
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_URL}/data`);
        const data = await response.json();
        allStudents = data.students || [];
        renderStudents(allStudents);
        renderAttendance(data.attendance || []);
        renderTeachers(data.teachers || []);
    } catch (err) {
        console.error("Ma'lumotlarni yuklashda xatolik yuz berdi!");
    }
}

// Ism bo'yicha o'quvchilarni tezkor qidirish (Filter)
function filterStudents() {
    const query = document.getElementById('searchStudent').value.toLowerCase();
    const filtered = allStudents.filter(s => s.name.toLowerCase().includes(query));
    renderStudents(filtered);
}
// O'quvchilarni jadvalga chiqarish va qarzdorlarni qizil qilish
function renderStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    students.forEach(s => {
        const isDebtor = s.balance <= -150000 ? 'debtor-row' : '';
        const balanceClass = s.balance >= 0 ? 'status-paid' : 'status-debt';

        tbody.innerHTML += `
            <tr class="${isDebtor}">
                <td><strong>${s.name}</strong></td>
                <td>${s.phone}</td>
                <td>${s.birthYear}-yil</td>
                <td>${s.fee.toLocaleString()} so'm</td>
                <td><span class="status-badge ${balanceClass}">${s.balance.toLocaleString()} so'm</span></td>
                <td>
                    <div class="inline-form">
                        <input type="number" id="pay_${s.id}" placeholder="Summa" style="width:110px;">
                        <button class="btn" onclick="makePayment('${s.id}')">To'lash</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// Davomat tarixini jadvalga chiqarish
function renderAttendance(attendance) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    attendance.slice().reverse().forEach(a => {
        const statusBadge = a.status === 'keldi' ? '<span class="status-badge status-paid">Keldi</span>' : '<span class="status-badge status-debt">Kelmadi</span>';
        tbody.innerHTML += `
            <tr>
                <td>${a.date}</td>
                <td>${a.studentName}</td>
                <td>${a.teacherName}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
}

// O'qituvchilar ro'yxati va ularning oyligini chiqarish
function renderTeachers(teachers) {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    teachers.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${t.name}</strong></td>
                <td>${t.subject}</td>
                <td>${t.days.join(', ')} (${t.timeStart}-${t.timeEnd})</td>
                <td><span class="status-badge status-paid" style="background:rgba(56, 189, 248, 0.2); color:#38bdf8;">${t.salary.toLocaleString()} so'm</span></td>
                <td><code>${t.login} / ${t.password}</code></td>
            </tr>
        `;
    });
}
// Yangi o'quvchini bazaga qo'shish
async function saveStudent(e) {
    e.preventDefault();
    const name = document.getElementById('studName').value;
    const phone = document.getElementById('studPhone').value;
    const birthYear = document.getElementById('studBirth').value;
    const fee = document.getElementById('studFee').value;
    const parentChatId = document.getElementById('parentChatId').value;

    const response = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, birthYear, fee, parentChatId })
    });
    if (response.ok) {
        document.getElementById('studentForm').reset();
        loadDashboardData();
    }
}

// Yangi o'qituvchini bazaga qo'shish
async function saveTeacher(e) {
    e.preventDefault();
    const name = document.getElementById('teachName').value;
    const subject = document.getElementById('teachSubject').value;
    const timeStart = document.getElementById('teachTimeStart').value;
    const timeEnd = document.getElementById('teachTimeEnd').value;
    const daysStr = document.getElementById('teachDays').value;
    const login = document.getElementById('teachLogin').value;
    const password = document.getElementById('teachPass').value;
    const days = daysStr.split(',').map(d => d.trim());

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

// O'quvchi to'lovini qabul qilish
async function makePayment(studentId) {
    const amountInput = document.getElementById(`pay_${studentId}`);
    const amount = amountInput.value;
    if (!amount || amount <= 0) return alert("To'g'ri summa kiriting!");

    const response = await fetch(`${API_URL}/students/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, amount })
    });
    if (response.ok) {
        amountInput.value = '';
        loadDashboardData();
    }
}

// Jadvallarni o'chirish va tozalash funksiyasi
async function clearData(type) {
    if (confirm("Ma'lumotlarni o'chirib, bazani tozalamoqchimisiz?")) {
        const response = await fetch(`${API_URL}/clear/${type}`, { method: 'DELETE' });
        if (response.ok) loadDashboardData();
    }
}
const dayIndexMap = {"dushanba": 1, "seshanba": 2, "chorshanba": 3, "payshanba": 4, "juma": 5, "shanba": 6, "yakshanba": 0};

// O'qituvchining shaxsiy ma'lumotlarini yuklash
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
        renderTeacherStudents(data.students || [], isLessonTime, currentTeacherId);
    } catch (err) { console.error(err); }
}

// Dars kunlari va soatini tekshirib tugmalarni bloklash funksiyasi
function checkLessonTime(teacher) {
    const now = new Date();
    const currentDayIndex = now.getDay();
    const currentTimeStr = now.toTimeString().substring(0, 5);
    const hasLessonToday = teacher.days.some(day => dayIndexMap[day.toLowerCase().trim()] === currentDayIndex);
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

// Ustoz panelida bolalar ro'yxatini chiqarish
function renderTeacherStudents(students, isLessonTime, teacherId) {
    const tbody = document.getElementById('teacherStudentsTable') || document.getElementById('teacherTeacherStudentsTable');
    if (!tbody) return;
    tbody.innerHTML = '';

    students.forEach(s => {
        const isDebtor = s.balance <= -150000 ? 'debtor-row' : '';
        const balanceClass = s.balance >= 0 ? 'status-paid' : 'status-debt';
        const disabledAttr = isLessonTime ? '' : 'disabled';
        const btnClassExtension = isLessonTime ? '' : 'btn-disabled';

        tbody.innerHTML += `
            <tr class="${isDebtor}">
                <td><strong>${s.name}</strong></td>
                <td>${s.phone}</td>
                <td>${s.birthYear}-yil</td>
                <td><span class="status-badge ${balanceClass}">${s.balance.toLocaleString()} so'm</span></td>
                <td>
                    <div style="display: flex; gap: 10px;">
                        <button ${disabledAttr} class="btn btn-success ${btnClassExtension}" onclick="submitAttendance('${s.id}', 'keldi', '${teacherId}')">Keldi</button>
                        <button ${disabledAttr} class="btn btn-danger-action ${btnClassExtension}" onclick="submitAttendance('${s.id}', 'kelmadi', '${teacherId}')">Kelmadi</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// Davomat belgilash va serverga yuborish
async function submitAttendance(studentId, status, teacherId) {
    if (!confirm(`O'quvchini '${status.toUpperCase()}' deb belgilamoqchimisiz?`)) return;
    try {
        const response = await fetch(`${API_URL}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId, studentId, status })
        });
        if (response.ok) {
            alert("Davomat saqlandi va balanslar muvaffaqiyatli taqsimlandi!");
            loadTeacherDashboard();
        }
    } catch (err) { alert("Server bilan aloqa uzildi!"); }
}

// Sahifaga mos qismlarni avtomatik yuklash (Global Routing Boshqaruvchisi)
window.onload = function() {
    if (document.getElementById('studentsTableBody')) {
        loadDashboardData();
        document.getElementById('studentForm').addEventListener('submit', saveStudent);
        document.getElementById('teacherForm').addEventListener('submit', saveTeacher);
    }
    if (document.getElementById('teacherStudentsTable') || document.getElementById('teacherTeacherStudentsTable')) {
        loadTeacherDashboard();
    }
};
