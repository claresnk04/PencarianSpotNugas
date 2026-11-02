const API_BASE = 'http://localhost:3000/api/v1';

const sessionKey = 'snij_session';

function getSession() {
  try {
    const raw = localStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem(sessionKey, JSON.stringify({ token, user }));
}

function clearSession() {
  localStorage.removeItem(sessionKey);
}

function showMessage(message, isError = false) {
  const target = document.getElementById('formMessage');
  if (!target) {
    alert(message);
    return;
  }

  target.textContent = message;
  target.style.display = 'block';
  target.style.color = isError ? '#b91c1c' : '#166534';
  target.style.background = isError ? '#fee2e2' : '#dcfce7';
  target.style.border = `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`;
  target.style.padding = '10px 12px';
  target.style.borderRadius = '12px';
  target.style.marginBottom = '14px';
}

async function apiFetch(path, options = {}) {
  const session = getSession();
  const headers = { ...(options.headers || {}) };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = text;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || 'Permintaan gagal.';
    throw new Error(message);
  }

  return payload;
}

function redirectByRole() {
  const session = getSession();
  if (!session?.user) return;

  const destination = session.user.role === 'ADMIN' ? 'dashboard.html' : 'home.html';
  if (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('register.html')) {
    window.location.href = destination;
  }
}

async function loadPublicPlaces() {
  const placeList = document.getElementById('placesList');
  if (!placeList) return;

  try {
    const response = await apiFetch('/tempat?limit=6');
    const rows = response?.data || [];

    if (!rows.length) {
      placeList.innerHTML = '<div class="list-card"><div class="list-top"><strong>Belum ada data</strong></div><div style="color: var(--muted);">Belum ada tempat publik yang tersedia.</div></div>';
      return;
    }

    placeList.innerHTML = rows
      .map((place) => {
        const noise = place.noise_level || 'Sedang';
        const colokan = place.colokan_min ?? 0;
        const statusBadge = colokan >= 80 ? '<span class="badge success">Cocok</span>' : '<span class="badge warning">Umum</span>';

        return `
          <div class="list-card" style="margin-bottom:12px;">
            <div class="list-top">
              <strong>${place.nama_tempat}</strong>
              ${statusBadge}
            </div>
            <div style="color: var(--muted);">${place.alamat || 'Alamat belum tercantum'}</div>
            <div style="margin-top:8px; color: var(--muted);">Colokan ${colokan}% · Suasana ${noise}</div>
          </div>
        `;
      })
      .join('');
  } catch (error) {
    placeList.innerHTML = `<div class="list-card"><div class="list-top"><strong>Gagal memuat data</strong></div><div style="color: var(--muted);">${error.message}</div></div>`;
  }
}

async function loadDashboardQueue() {
  const tableBody = document.getElementById('antreanTableBody');
  if (!tableBody) return;

  try {
    const response = await apiFetch('/admin/antrean?limit=10');
    const rows = response?.data || [];

    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="5">Belum ada antrean kontribusi.</td></tr>';
      return;
    }

    const statusMap = {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      REVISION_NEEDED: 'pending',
    };

    tableBody.innerHTML = rows
      .map((entry) => {
        const statusLabel = entry.status === 'REVISION_NEEDED' ? 'Revisi' : entry.status;
        return `
          <tr>
            <td>${entry.nama_tempat}</td>
            <td>${entry.kontributor || 'Pengguna'}</td>
            <td><span class="status ${statusMap[entry.status] || 'pending'}">${statusLabel}</span></td>
            <td>${entry.alamat || '-'}</td>
            <td>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-primary" data-decision="APPROVED" data-id="${entry.id}" style="padding:8px 10px; font-size:0.8rem;">Setujui</button>
                <button class="btn btn-secondary" data-decision="REVISION_NEEDED" data-id="${entry.id}" style="padding:8px 10px; font-size:0.8rem;">Revisi</button>
                <button class="btn btn-soft" data-decision="REJECTED" data-id="${entry.id}" style="padding:8px 10px; font-size:0.8rem;">Tolak</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    document.querySelectorAll('[data-decision]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = Number(button.dataset.id);
        const decision = button.dataset.decision;

        let note = '';
        if (decision === 'REJECTED') {
          note = window.prompt('Masukkan alasan penolakan:', 'Alamat tidak jelas');
          if (note === null) return;
        }

        try {
          await apiFetch(`/admin/antrean/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: decision, catatan_admin: note || undefined }),
          });
          alert('Status kontribusi berhasil diupdate.');
          await loadDashboardQueue();
        } catch (error) {
          alert(error.message);
        }
      });
    });
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value.trim();

  if (!email || !password) {
    showMessage('Email dan password wajib diisi.', true);
    return;
  }

  try {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const user = response?.data?.user;
    if (!user) {
      throw new Error('Login berhasil, namun data user tidak lengkap.');
    }

    setSession(response.data.token, user);
    window.location.href = user.role === 'ADMIN' ? 'dashboard.html' : 'home.html';
  } catch (error) {
    showMessage(error.message, true);
  }
}

function handleRegisterSubmit() {
  const name = document.getElementById('regName')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim();
  const password = document.getElementById('regPassword')?.value.trim();

  if (!name || !email || !password) {
    showMessage('Harap lengkapi semua field pendaftaran.', true);
    return;
  }

  sessionStorage.setItem('snij_register_email', email);
  sessionStorage.setItem('snij_register_password', password);
  showMessage('Backend saat ini belum menyediakan endpoint register. Gunakan akun demo: admin@snij.test / Admin123! atau user@snij.test / User123!');
  window.location.href = 'login.html';
}

async function handleContributionSubmit(event) {
  event.preventDefault();

  const session = getSession();
  if (!session?.user) {
    window.location.href = 'login.html';
    return;
  }

  const payload = {
    nama_tempat: document.getElementById('contributionName')?.value.trim(),
    alamat: document.getElementById('contributionAddress')?.value.trim(),
    colokan_min: Number(document.getElementById('contributionColokan')?.value || 0),
    noise_level: document.getElementById('contributionNoise')?.value || 'Sedang',
  };

  try {
    await apiFetch('/kontribusi', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    document.getElementById('contributionForm').reset();
    alert('Kontribusi berhasil dikirim dan menunggu moderasi.');
    await loadPublicPlaces();
  } catch (error) {
    alert(error.message);
  }
}

function bindAuthForms() {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLoginSubmit);
  }

  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', handleRegisterSubmit);
  }
}

function bindContributionForm() {
  const form = document.getElementById('contributionForm');
  if (form) {
    form.addEventListener('submit', handleContributionSubmit);
  }
}

function applyPageState() {
  const yearNodes = document.querySelectorAll('#year');
  yearNodes.forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  const page = window.location.pathname.split('/').pop();
  const session = getSession();

  if ((page === 'home.html' || page === 'dashboard.html') && !session) {
    window.location.href = 'login.html';
    return;
  }

  if (page === 'home.html' && session?.user?.role === 'ADMIN') {
    window.location.href = 'dashboard.html';
    return;
  }

  if (page === 'dashboard.html' && session?.user?.role !== 'ADMIN') {
    window.location.href = 'home.html';
    return;
  }

  if ((page === 'login.html' || page === 'register.html') && session) {
    redirectByRole();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  applyPageState();

  const page = window.location.pathname.split('/').pop();
  if (page === 'login.html') {
    const pendingEmail = sessionStorage.getItem('snij_register_email');
    const pendingPassword = sessionStorage.getItem('snij_register_password');

    if (pendingEmail && pendingPassword) {
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      if (emailInput) emailInput.value = pendingEmail;
      if (passwordInput) passwordInput.value = pendingPassword;
      sessionStorage.removeItem('snij_register_email');
      sessionStorage.removeItem('snij_register_password');
    }
  }

  bindAuthForms();
  bindContributionForm();

  if (page === 'home.html') {
    await loadPublicPlaces();
  }

  if (page === 'dashboard.html') {
    await loadDashboardQueue();
  }
});
