function renderTools() {
  const root = document.getElementById('hubSections');
  if (!root || !Array.isArray(window.CHENDAWAN_TOOLS)) return;
  root.innerHTML = '';

  const groups = [
    { id: 'records', label: 'Records' },
    { id: 'documents', label: 'Documents' },
    { id: 'finance', label: 'Finance' },
  ];

  groups.forEach((group) => {
    const tools = window.CHENDAWAN_TOOLS.filter((tool) => {
      const g = tool.group || 'documents';
      return g === group.id;
    });
    if (!tools.length) return;

    const label = document.createElement('p');
    label.className = 'tools-label';
    label.textContent = group.label;
    root.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'tools-grid';
    tools.forEach((tool) => {
      const isReady = tool.status === 'ready';
      const el = document.createElement(isReady ? 'a' : 'div');
      el.className = 'tool-tile' + (isReady ? '' : ' is-soon');
      if (isReady) el.href = tool.href;
      else el.setAttribute('aria-disabled', 'true');
      el.innerHTML =
        '<div class="tool-tile-top">' +
        '<h2 class="tool-name"></h2>' +
        (isReady
          ? '<span class="tool-badge">Open</span>'
          : '<span class="tool-badge soon">Coming soon</span>') +
        '</div>' +
        '<p class="tool-desc"></p>';
      el.querySelector('.tool-name').textContent = tool.name;
      el.querySelector('.tool-desc').textContent = tool.description;
      grid.appendChild(el);
    });
    root.appendChild(grid);
  });
}

function applySession(user) {
  const emailEl = document.getElementById('sessionEmail');
  const out = document.getElementById('signOutBtn');
  const inn = document.getElementById('signInLink');
  if (emailEl) emailEl.textContent = user && user.email ? user.email : '';
  if (out) {
    out.hidden = !user;
    if (user && !out.dataset.bound) {
      out.dataset.bound = '1';
      out.addEventListener('click', () => window.TCVFirebase.signOut());
    }
  }
  if (inn) inn.hidden = !!user;
}

document.addEventListener('DOMContentLoaded', () => {
  applySession(null);
  const boot = window.TCVFirebase && window.TCVFirebase.ready
    ? window.TCVFirebase.ready
    : Promise.resolve();
  boot.then(() => {
    applySession(window.TCVFirebase && window.TCVFirebase.currentUser());
    renderTools();
  }).catch(() => {
    applySession(null);
  });
});
