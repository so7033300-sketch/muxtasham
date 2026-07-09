// RENDER SERVER INTEGRATSIYASI (CHALKAShLIKSIZ JONLI REJIM)
// DIQQAT: Render sizga server ochgach beradigan havolasini (linkini) kelajakda mana shu pastga yozib qo'yasiz:
const RENDER_BACKEND_URL = window.location.origin; 

async function uploadLocalDataToBackend() {
    console.log("⏳ Render pullik serveriga zaxira nusxa yuklanmoqda...");
    
    let dataToSend = {
        teachers: JSON.parse(localStorage.getItem('teachers')) || [],
        students: JSON.parse(localStorage.getItem('students')) || [],
        excelLog: JSON.parse(localStorage.getItem('excelLog')) || []
    };

    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/save-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        });
        const result = await response.json();
        if (result.success) {
            alert("🟢 Daxshat! Hamma ma'lumotlar pullik Render serveriga 100% xavfsiz yuklandi! 👍");
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert("❌ Serverga yuklashda xatolik bo'ldi: " + error.message);
    }
}
async function downloadDataFromBackend() {
    if (!confirm("Diqqat! Serverdan yuklasangiz, hozirgi brauzeringizdagi ma'lumotlar o'chib ketadi. Rozimisiz?")) return;
    
    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/load-all`);
        const result = await response.json();
        if (result.success) {
            localStorage.setItem('teachers', JSON.stringify(result.teachers || []));
            localStorage.setItem('students', JSON.stringify(result.students || []));
            localStorage.setItem('excelLog', JSON.stringify(result.excelLog || []));
            alert("📥 Serverdagi barcha ma'lumotlar kompyuteringizga muvaffaqiyatli qayta tiklandi! 🎉");
            window.location.reload();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert("❌ Serverdan yuklab olishda xatolik: " + error.message);
    }
}
