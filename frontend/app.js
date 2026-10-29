const API = 'http://localhost:3000/api';
const $ = (id) => document.getElementById(id);
let drives = [];
let adminToken = sessionStorage.getItem('cpt_admin_token') || '';
let toastTimer;

function showToast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function setMessage(id, message, isError = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#ef4444' : '#10b981';
}

async function api(path, options = {}) {
    const headers = {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
    };
    const res = await fetch(`${API}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function renderDrives() {
    const grid = $('driveGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const list = drives;
    const countEl = $('resultsLabel');
    if (countEl) countEl.textContent = `${list.length} opportunities`;
    
    if (list.length === 0) {
        grid.innerHTML = '<div class="no-drives" style="padding: 20px; text-align: center; color: #6b7280;">No matching opportunities found.</div>';
        return;
    }
    
    list.forEach(d => {
        const card = document.createElement('div');
        card.className = 'drive-card';
        card.innerHTML = `
            <h3>${d.company_name}</h3>
            <p><strong>Role:</strong> ${d.role}</p>
            <p>${d.description}</p>
            <p><strong>Min CGPA:</strong> ${d.min_cgpa}</p>
            <p><strong>Deadline:</strong> ${d.deadline ? new Date(d.deadline).toLocaleDateString() : 'No deadline'}</p>
            <span class="status-badge ${d.status}">${d.status.toUpperCase()}</span>
            ${!adminToken && d.status === 'open' ? `<button class="btn apply-btn" data-id="${d.drive_id}">Apply Now</button>` : ''}
        `;
        grid.appendChild(card);
    });
}

async function loadDrives() {
    try {
        const data = await api('/drives');
        drives = Array.isArray(data) ? data : (data.drives || []);
        renderDrives();
    } catch (err) {
        setMessage('errorLabel', 'Could not load placement drives.', true);
    }
}

function openLogin() {
    const modal = $('adminModal');
    if (modal) modal.style.display = 'flex';
}

function closeLogin() {
    const modal = $('adminModal');
    if (modal) modal.style.display = 'none';
    setMessage('loginMessage', '');
}

// Admin Panel Toggle
const adminOpenBtn = $('#adminOpen');
if (adminOpenBtn) {
    adminOpenBtn.addEventListener('click', () => {
        if (adminToken) {
            showAdmin();
        } else {
            openLogin();
        }
    });
}

// Login Route Handler
const loginFrm = $('#loginForm');
if (loginFrm) {
    loginFrm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passwordEl = $('#adminPassword');
        const password = passwordEl ? passwordEl.value : '';
        setMessage('loginMessage', 'Signing in...');
        try {
            const data = await api('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ password })
            });
            adminToken = data.token;
            sessionStorage.setItem('cpt_admin_token', adminToken);
            closeLogin();
            showAdmin();
            showToast('Logged in successfully');
        } catch (err) {
            setMessage('loginMessage', err.message, true);
        }
    });
}

function showAdmin() {
    const panel = $('adminPanel');
    if (panel) panel.style.display = 'block';
    loadApplications();
}

const logoutBtn = $('#adminLogout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        adminToken = '';
        sessionStorage.removeItem('cpt_admin_token');
        const panel = $('adminPanel');
        if (panel) panel.style.display = 'none';
        loadDrives();
        showToast('Logged out');
    });
}

async function loadApplications() {
    try {
        const data = await api('/applications');
        const rows = Array.isArray(data) ? data : (data.applications || []);
        const container = $('applicationRows');
        if (!container) return;
        container.innerHTML = '';
        
        rows.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${a.student_name}</td>
                <td>${a.roll_number}</td>
                <td>${a.drive_id}</td>
                <td>${a.status}</td>
            `;
            container.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// Create new Drive Form Handler
const drvForm = $('driveForm');
if (drvForm) {
    drvForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            company_name: $('compName').value,
            role: $('roleName').value,
            description: $('driveDesc').value,
            min_cgpa: parseFloat($('minCgpa').value),
            drive_id: $('driveId').value,
            deadline: $('deadlineDate').value
        };
        try {
            await api('/drives', { method: 'POST', body: JSON.stringify(body) });
            $('driveForm').reset();
            loadDrives();
            showToast('Placement drive created!');
        } catch (err) {
            alert(err.message);
        }
    });
}

// Initialize Web App
window.addEventListener('DOMContentLoaded', () => {
    loadDrives();
    if (adminToken) showAdmin();
});