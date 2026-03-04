// ─── SETTINGS ────────────────────────────────────────────────────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyyGF8yYXy6ELT3ojMsrruhSHDKM6LegMxoxoPixuuszVW6FvRLRo0e5wU9g8ru-30q/exec';

let records = [];
let editingId = null;
let deleteTargetId = null;

// ─── AUTH / LOGIN ─────────────────────────────────────────────────────────────
window.onload = () => {
  if (sessionStorage.getItem('isLoggedIn') === 'true') {
    document.getElementById('login-overlay').style.display = 'none';
    applyRolePermissions(); // เช็คสิทธิ์เมื่อโหลดหน้า
    fetchData();
  }
};

function checkLogin() {
  // ดึงค่ามา ตัดช่องว่างหน้าหลังทิ้ง และแปลงเป็นตัวพิมพ์เล็กทั้งหมด
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value.trim();

  // 1. สิทธิ์ Admin (จัดการได้ทั้งหมด)
  if (u === 'admin' && p === '1234') { 
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('role', 'admin');
    finishLogin();
  } 
  // 2. สิทธิ์ น้องๆ/ผู้ใช้ทั่วไป (ดูได้อย่างเดียว)
  else if (u === 'user' && p === '1234') { 
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('role', 'user');
    finishLogin();
  } 
  else {
    document.getElementById('login-error').style.display = 'block';
  }
}
function finishLogin() {
  document.getElementById('login-overlay').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('login-overlay').style.display = 'none';
    applyRolePermissions(); // จัดการหน้าตาตามสิทธิ์
    fetchData();
  }, 300);
}

function logout() {
  sessionStorage.clear();
  location.reload();
}

// ─── ROLE MANAGEMENT ──────────────────────────────────────────────────────────
function applyRolePermissions() {
  const role = sessionStorage.getItem('role');
  const formPanel = document.getElementById('form-panel');
  const appContainer = document.getElementById('app-container');

  if (role === 'user') {
    // ถ้าระดับ User ให้ซ่อนฟอร์มด้านซ้าย และขยายตารางให้เต็มจอ
    if (formPanel) formPanel.style.display = 'none';
    if (appContainer) appContainer.style.gridTemplateColumns = '1fr'; 
  } else {
    // ถ้าระดับ Admin ให้แสดงตามปกติ
    if (formPanel) formPanel.style.display = 'block';
    if (appContainer) appContainer.style.gridTemplateColumns = '380px 1fr';
  }
}

// ─── API CONNECT ──────────────────────────────────────────────────────────────
async function fetchData() {
  showLoading('กำลังโหลดข้อมูลจาก Google Sheets...');
  try {
    const res = await fetch(GAS_URL + "?action=read");
    if(res.ok) {
      records = await res.json();
    }
  } catch(e) {
    console.error(e);
    showToast('ดึงข้อมูลไม่ได้ ใช้งานโหมด Offline ชั่วคราว', 'warn');
  }
  populateWardFilter();
  applyFilters();
  updateStats();
  hideLoading();
}

async function syncToGoogleSheets(payload, msgSuccess) {
  showLoading('กำลังบันทึกข้อมูล...');
  try {
    await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
    showToast(msgSuccess, 'success');
    await fetchData(); 
  } catch(e) {
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
  }
  hideLoading();
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function showLoading(txt) {
  document.getElementById('loading-text').textContent = txt;
  document.getElementById('loading-overlay').style.display = 'flex';
}
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

function updateStats() {
  document.getElementById('stat-total').textContent = records.length;
  document.getElementById('stat-research').textContent = records.filter(r=>r.type==='วิจัย'||r.type==='R2R').length;
  document.getElementById('stat-cqi').textContent = records.filter(r=>r.type==='CQI').length;
  document.getElementById('stat-innov').textContent = records.filter(r=>r.type==='นวัตกรรม').length;
}

function selectType(el) {
  document.querySelectorAll('.type-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('f-type').value = el.dataset.val;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
function saveRecord() {
  const type = document.getElementById('f-type').value;
  const ward = document.getElementById('f-ward').value;
  const title = document.getElementById('f-title').value.trim();
  const author = document.getElementById('f-author').value.trim();
  const year = document.getElementById('f-year').value;
  const link = document.getElementById('f-link').value.trim();
  const note = document.getElementById('f-note').value.trim();

  const selOpt = document.getElementById('f-ward').options[document.getElementById('f-ward').selectedIndex];
  const dept = selOpt && selOpt.parentNode.tagName==='OPTGROUP' ? selOpt.parentNode.label : '';

  if (!type || !ward || !title || !author) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error'); return;
  }

  const payload = {
    action: editingId ? 'update' : 'create',
    data: { id: editingId || Date.now().toString(), type, dept, ward, title, author, year, link, note }
  };

  syncToGoogleSheets(payload, editingId ? '✅ อัปเดตผลงานสำเร็จ' : '✅ บันทึกผลงานใหม่สำเร็จ');
  resetForm();
}

function editRecord(id) {
  const r = records.find(r=>r.id==id);
  if (!r) return;
  editingId = id;
  
  document.querySelectorAll('.type-pill').forEach(p=>{
    p.classList.remove('active');
    if(p.dataset.val===r.type) p.classList.add('active');
  });
  document.getElementById('f-type').value = r.type;
  document.getElementById('f-ward').value = r.ward;
  document.getElementById('f-title').value = r.title;
  document.getElementById('f-author').value = r.author;
  document.getElementById('f-year').value = r.year;
  document.getElementById('f-link').value = r.link;
  document.getElementById('f-note').value = r.note;

  document.getElementById('form-heading').textContent = '✏️ แก้ไขผลงาน';
  document.getElementById('edit-banner').classList.add('open');
  window.scrollTo(0,0);
}

function promptDelete(id) {
  deleteTargetId = id;
  openModal('delete-modal');
}

function confirmDelete() {
  if (!deleteTargetId) return;
  const payload = { action: 'delete', data: { id: deleteTargetId } };
  closeModal('delete-modal');
  syncToGoogleSheets(payload, '🗑️ ลบผลงานสำเร็จ');
  deleteTargetId = null;
}

// ─── FILTER & RENDER ──────────────────────────────────────────────────────────
function applyFilters() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const t = document.getElementById('filter-type').value;
  const w = document.getElementById('filter-ward').value;
  const role = sessionStorage.getItem('role'); // อ่านสิทธิ์
  
  const filtered = records.filter(r => 
    (!q || r.title.toLowerCase().includes(q) || r.author.toLowerCase().includes(q)) &&
    (!t || r.type === t) && (!w || r.ward === w)
  );
  
  const tbody = document.getElementById('records-body');
  document.getElementById('list-count').textContent = filtered.length + ' รายการ';
  
  if (!filtered.length) {
    tbody.innerHTML = '';
    document.getElementById('empty-state').style.display = 'block';
  } else {
    document.getElementById('empty-state').style.display = 'none';
    tbody.innerHTML = filtered.map(r => {
      // ✅ สร้างปุ่มแสดงผลตามสิทธิ์ (Admin / User)
      let actionBtnsHTML = '';
      if (role === 'admin') {
        actionBtnsHTML = `
          <button class="btn btn-sm btn-outline" onclick="viewRecord('${r.id}')">👁️</button>
          <button class="btn btn-sm btn-warn" onclick="editRecord('${r.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="promptDelete('${r.id}')">🗑️</button>
        `;
      } else {
        actionBtnsHTML = `
          <button class="btn btn-sm btn-outline" onclick="viewRecord('${r.id}')">👁️ ดูรายละเอียด</button>
        `;
      }

      return `
        <tr>
          <td><span class="type-tag tag-${r.type}">${r.type}</span></td>
          <td class="td-title">${r.title}<small>${r.author}</small></td>
          <td style="font-size:12px;color:var(--muted);">${r.ward}</td>
          <td style="font-size:12px;">${r.year}</td>
          <td>
            ${r.link ? `<a href="${r.link}" target="_blank" style="color:var(--blue);text-decoration:none;font-size:12px;font-weight:600;">🔗 เปิดดู</a>` : '<span style="color:#ccc;font-size:12px;">-</span>'}
          </td>
          <td>
            <div class="action-btns">${actionBtnsHTML}</div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

function populateWardFilter() {
  const wards = [...new Set(records.map(r=>r.ward))].sort();
  const sel = document.getElementById('filter-ward');
  sel.innerHTML = '<option value="">ทุกหน่วยงาน</option>' + wards.map(w=>`<option>${w}</option>`).join('');
}

function viewRecord(id) {
  const r = records.find(r=>r.id==id);
  document.getElementById('view-modal-body').innerHTML = `
    <div class="detail-row"><span class="detail-label">ประเภท</span><span class="detail-val">${r.type}</span></div>
    <div class="detail-row"><span class="detail-label">ชื่องาน</span><span class="detail-val">${r.title}</span></div>
    <div class="detail-row"><span class="detail-label">ผู้จัดทำ</span><span class="detail-val">${r.author}</span></div>
    <div class="detail-row"><span class="detail-label">หน่วยงาน</span><span class="detail-val">${r.ward}</span></div>
    <div class="detail-row"><span class="detail-label">ปีงบประมาณ</span><span class="detail-val">${r.year}</span></div>
    ${r.link ? `<div class="detail-row"><span class="detail-label">ลิงก์ผลงาน</span><span class="detail-val"><a href="${r.link}" target="_blank" style="color:var(--blue);">🔗 คลิกเพื่อเปิดดูเอกสาร</a></span></div>` : ''}
    ${r.note ? `<div class="detail-row"><span class="detail-label">หมายเหตุ</span><span class="detail-val">${r.note}</span></div>` : ''}
  `;
  openModal('view-modal');
}

function resetForm() {
  editingId = null;
  document.getElementById('f-title').value = '';
  document.getElementById('f-author').value = '';
  document.getElementById('f-link').value = '';
  document.getElementById('f-note').value = '';
  document.getElementById('edit-banner').classList.remove('open');
  document.getElementById('form-heading').textContent = '➕ เพิ่มผลงานวิชาการ';
}

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.className = type;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
