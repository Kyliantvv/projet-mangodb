const API = 'http://localhost:8000';

let editingId = null;

// ---------- Boot ----------

document.addEventListener('DOMContentLoaded', loadUsers);

// ---------- Load ----------

async function loadUsers() {
  document.getElementById('advanced-banner').classList.add('hidden');
  const res = await fetch(`${API}/users`);
  const users = await res.json();
  renderTable(users);
}

async function loadAdvanced() {
  document.getElementById('advanced-banner').classList.remove('hidden');
  const res = await fetch(`${API}/users/advanced`);
  const users = await res.json();
  renderTable(users);
}

// ---------- Render ----------

function renderTable(users) {
  const tbody = document.getElementById('users-body');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Aucun utilisateur trouvé.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${esc(u.name)}</td>
      <td>${esc(u.email)}</td>
      <td>${(u.addresses || []).map(a =>
        `<span class="pill">${esc(a.street)}, ${esc(a.city)}</span>`
      ).join('')}</td>
      <td>${esc(u.preferences?.theme ?? 'light')}</td>
      <td><span class="badge ${u.preferences?.notifications ? 'on' : 'off'}">
        ${u.preferences?.notifications ? 'Oui' : 'Non'}
      </span></td>
      <td>
        <button onclick="editUser('${u.id}')">Modifier</button>
        <button class="danger" onclick="deleteUser('${u.id}')">Supprimer</button>
      </td>
    </tr>
  `).join('');
}

// ---------- Modal ----------

function openModal(user = null) {
  editingId = user ? user.id : null;
  document.getElementById('modal-title').textContent = user ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur';

  document.getElementById('f-name').value        = user?.name ?? '';
  document.getElementById('f-email').value       = user?.email ?? '';
  document.getElementById('f-theme').value       = user?.preferences?.theme ?? 'light';
  document.getElementById('f-notifications').checked = user?.preferences?.notifications ?? true;

  const addrs = (user?.addresses || []).map(a => `${a.street}, ${a.city}, ${a.country}`).join('\n');
  document.getElementById('f-addresses').value = addrs;

  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function closeModal() {
  editingId = null;
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
}

async function editUser(id) {
  const res = await fetch(`${API}/users/${id}`);
  const user = await res.json();
  openModal(user);
}

// ---------- Save ----------

async function saveUser() {
  const name  = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const theme = document.getElementById('f-theme').value;
  const notif = document.getElementById('f-notifications').checked;
  const rawAddresses = document.getElementById('f-addresses').value.trim();

  if (!name || !email) { alert('Nom et email obligatoires.'); return; }

  const addresses = rawAddresses
    ? rawAddresses.split('\n').filter(l => l.trim()).map(line => {
        const parts = line.split(',').map(p => p.trim());
        return { street: parts[0] || '', city: parts[1] || '', country: parts[2] || '' };
      })
    : [];

  const payload = {
    name,
    email,
    addresses,
    preferences: { theme, notifications: notif }
  };

  const url    = editingId ? `${API}/users/${editingId}` : `${API}/users`;
  const method = editingId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) { alert('Erreur lors de la sauvegarde.'); return; }

  closeModal();
  loadUsers();
}

// ---------- Delete ----------

async function deleteUser(id) {
  if (!confirm('Supprimer cet utilisateur ?')) return;
  await fetch(`${API}/users/${id}`, { method: 'DELETE' });
  loadUsers();
}

// ---------- Util ----------

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
