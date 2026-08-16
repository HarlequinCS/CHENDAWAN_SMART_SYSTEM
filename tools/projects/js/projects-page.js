const C = window.TCVClients;
const P = window.TCVProjects;
const D = window.TCVDoc;

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value == null ? '' : value;
}

function blankForm() {
  setVal('projectRecordId', '');
  setVal('clientId', '');
  setVal('name', '');
  setVal('serviceCode', '');
  setVal('notes', '');
  document.getElementById('formTitle').textContent = 'New Project';
  document.getElementById('docHistory').innerHTML = '';
  renderList();
}

function loadIntoForm(project) {
  if (!project) return;
  setVal('projectRecordId', project.id);
  setVal('clientId', project.clientId);
  setVal('name', project.name);
  setVal('serviceCode', project.serviceCode);
  setVal('notes', project.notes);
  document.getElementById('formTitle').textContent = 'Edit Project';
  renderList();
  renderHistory(project.id);
}

async function renderHistory(projectId) {
  const box = document.getElementById('docHistory');
  if (!projectId) {
    box.innerHTML = '';
    return;
  }
  try {
    const docs = await P.listDocuments(projectId);
    if (!docs.length) {
      box.innerHTML = '<p class="list-empty">No documents issued for this project yet.</p>';
      return;
    }
    const ul = document.createElement('div');
    ul.className = 'client-list';
    docs.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'client-card';
      row.innerHTML = '<div class="card-top"><span class="card-name"></span><span class="tag"></span></div><div class="card-meta"></div>';
      row.querySelector('.card-name').textContent = d.number || d.type;
      row.querySelector('.tag').textContent = d.type || '';
      row.querySelector('.card-meta').textContent =
        (d.issuedAt ? String(d.issuedAt).slice(0, 10) : '') +
        (d.issue > 1 ? '  ·  issue ' + d.issue : '');
      const href =
        window.TCVNumbers && window.TCVNumbers.toolHref
          ? window.TCVNumbers.toolHref(d.type, d.id)
          : '';
      if (href) {
        const link = document.createElement('a');
        link.className = 'client-card';
        link.href = href;
        link.innerHTML = row.innerHTML;
        ul.appendChild(link);
      } else {
        ul.appendChild(row);
      }
    });
    box.innerHTML = '<p class="tools-label" style="margin:18px 0 10px;">Issued documents</p>';
    box.appendChild(ul);
  } catch (e) {
    box.innerHTML = '<p class="list-empty">Could not load document history.</p>';
  }
}

function renderList() {
  const q = val('search').toLowerCase();
  const active = val('projectRecordId');
  const box = document.getElementById('projectList');
  const rows = P.list().filter((p) => {
    if (!q) return true;
    const client = C.get(p.clientId);
    return [p.name, p.serviceCode, String(p.jobNo), client && client.name]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  if (!rows.length) {
    box.innerHTML =
      '<p class="list-empty">' +
      (P.list().length ? 'No projects match that search.' : 'No projects yet. Create one on the left.') +
      '</p>';
    return;
  }
  box.innerHTML = '';
  rows.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'client-card' + (p.id === active ? ' is-active' : '');
    const client = C.get(p.clientId);
    btn.innerHTML =
      '<div class="card-top"><span class="card-name"></span><span class="tag"></span></div>' +
      '<div class="card-meta"></div>';
    btn.querySelector('.card-name').textContent = p.name || 'Untitled';
    btn.querySelector('.tag').textContent = window.TCVNumbers.pad(p.jobNo, 3);
    btn.querySelector('.card-meta').textContent = [
      client && client.name,
      p.year,
      p.serviceCode,
    ]
      .filter(Boolean)
      .join(' · ');
    btn.addEventListener('click', () => loadIntoForm(P.get(p.id)));
    box.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('serviceCode').innerHTML = window.tcvServiceOptionsHtml('');
  document.getElementById('search').addEventListener('input', renderList);
  document.getElementById('newBtn').addEventListener('click', () => {
    blankForm();
    D.setStatus('Ready for a new project.');
  });
  document.getElementById('saveBtn').addEventListener('click', async () => {
    if (!val('clientId')) {
      D.setStatus('Select a client first.');
      return;
    }
    if (!val('name')) {
      D.setStatus('Enter a project name.');
      return;
    }
    if (!val('serviceCode')) {
      D.setStatus('Select a service code.');
      return;
    }
    try {
      const saved = await P.upsert({
        id: val('projectRecordId') || undefined,
        clientId: val('clientId'),
        name: val('name'),
        serviceCode: val('serviceCode'),
        notes: val('notes'),
      });
      loadIntoForm(saved);
      D.setStatus('Project saved. Job no. ' + window.TCVNumbers.pad(saved.jobNo, 3) + '.');
    } catch (e) {
      D.setStatus(e.message || 'Could not save project.');
    }
  });
  document.getElementById('deleteBtn').addEventListener('click', async () => {
    const id = val('projectRecordId');
    if (!id) {
      D.setStatus('Select a project to delete.');
      return;
    }
    const project = P.get(id);
    if (!project || !confirm('Delete project “' + project.name + '”? Issued document records stay in Firebase.')) {
      return;
    }
    try {
      await P.remove(id);
      blankForm();
      D.setStatus('Project deleted.');
    } catch (e) {
      D.setStatus(e.message || 'Could not delete project.');
    }
  });

  const boot = window.TCVFirebase && window.TCVFirebase.ready ? window.TCVFirebase.ready : Promise.resolve();
  boot
    .then(() => Promise.all([C.refresh(), P.refresh()]))
    .then(async () => {
      const sel = document.getElementById('clientId');
      sel.innerHTML = C.optionsHtml('');
      renderList();
      try {
        if (window.TCVFirebase.peekNextJobNo) {
          const next = await window.TCVFirebase.peekNextJobNo();
          const hint = document.getElementById('jobHint');
          if (hint) {
            hint.textContent =
              'Next new project will be job ' +
              window.TCVNumbers.pad(next, 3) +
              ' for this year (assigned from Firebase, not this browser).';
          }
        }
      } catch (e) {}
    })
    .catch((err) => {
      D.setStatus((err && err.message) || 'Could not load projects.');
    });
});
