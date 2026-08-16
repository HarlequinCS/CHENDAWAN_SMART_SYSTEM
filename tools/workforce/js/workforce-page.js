const W = window.TCVWorkers;
const D = window.TCVDoc;

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value == null ? '' : value;
}

function currentType() {
  const t = val('workerType');
  return W.TYPES.indexOf(t) >= 0 ? t : 'employee';
}

function previewEmployeeId() {
  const hint = document.getElementById('employeeIdHint');
  if (currentType() !== 'employee') return;
  const existing = val('employeeId');
  if (existing) {
    if (hint) hint.textContent = 'Assigned automatically. This ID stays with the employee.';
    return;
  }
  const next = W.nextEmployeeId(val('workerRecordId') || undefined);
  setVal('employeeId', next);
  if (hint) hint.textContent = 'Will be assigned on save: ' + next;
}

function applyTypeUi() {
  const t = currentType();
  document.querySelectorAll('.type-toggle [data-type]').forEach((btn) => {
    btn.classList.toggle('is-on', btn.getAttribute('data-type') === t);
  });
  const emp = t === 'employee';
  document.getElementById('empWrap').hidden = !emp;
  document.getElementById('posWrap').hidden = emp;
  document.getElementById('statWrap').hidden = !emp;
  if (emp) previewEmployeeId();
  else if (!val('workerRecordId')) setVal('employeeId', '');
}

function blankForm() {
  setVal('workerRecordId', '');
  setVal('workerType', 'employee');
  ['name', 'nric', 'employeeId', 'position', 'positionAlt', 'address', 'phone', 'email', 'bankName', 'bankAcc', 'epfNo', 'socsoNo', 'eisNo', 'pcbStatus', 'notes'].forEach((id) =>
    setVal(id, '')
  );
  document.getElementById('formTitle').textContent = 'Register a Worker';
  applyTypeUi();
  renderList();
}

function loadIntoForm(w) {
  if (!w) return;
  setVal('workerRecordId', w.id);
  setVal('workerType', w.type);
  setVal('name', w.name);
  setVal('nric', w.nric);
  setVal('employeeId', w.employeeId);
  setVal('position', w.position);
  setVal('positionAlt', w.type === 'employee' ? '' : w.position);
  setVal('address', w.address);
  setVal('phone', w.phone);
  setVal('email', w.email);
  setVal('bankName', w.bankName);
  setVal('bankAcc', w.bankAcc);
  setVal('epfNo', w.epfNo);
  setVal('socsoNo', w.socsoNo);
  setVal('eisNo', w.eisNo);
  setVal('pcbStatus', w.pcbStatus);
  setVal('notes', w.notes);
  document.getElementById('formTitle').textContent = 'Edit Worker';
  applyTypeUi();
  renderList();
}

function collect() {
  const type = currentType();
  return {
    id: val('workerRecordId') || undefined,
    type: type,
    name: val('name'),
    nric: val('nric'),
    employeeId: type === 'employee' ? val('employeeId') : val('workerRecordId') ? val('employeeId') : '',
    position: type === 'employee' ? val('position') : val('positionAlt'),
    address: val('address'),
    phone: val('phone'),
    email: val('email'),
    bankName: val('bankName'),
    bankAcc: val('bankAcc'),
    epfNo: val('epfNo'),
    socsoNo: val('socsoNo'),
    eisNo: val('eisNo'),
    pcbStatus: val('pcbStatus'),
    notes: val('notes'),
  };
}

function renderList() {
  const q = val('search').toLowerCase();
  const active = val('workerRecordId');
  const box = document.getElementById('workerList');
  const rows = W.list().filter((w) => {
    if (!q) return true;
    return [w.name, w.nric, w.employeeId, w.position, w.email, w.type].join(' ').toLowerCase().includes(q);
  });
  if (!rows.length) {
    box.innerHTML =
      '<p class="list-empty">' +
      (W.list().length ? 'No workers match that search.' : 'No workers yet. Register someone on the left.') +
      '</p>';
    return;
  }
  box.innerHTML = '';
  rows.forEach((w) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'client-card' + (w.id === active ? ' is-active' : '');
    btn.innerHTML =
      '<div class="card-top"><span class="card-name"></span><span class="tag"></span></div><div class="card-meta"></div>';
    btn.querySelector('.card-name').textContent = w.name || 'Untitled';
    btn.querySelector('.tag').textContent = W.typeLabel(w.type);
    btn.querySelector('.card-meta').textContent =
      [w.employeeId, w.nric, w.position, w.bankName].filter(Boolean).join(' · ') || 'No extra details';
    btn.addEventListener('click', () => loadIntoForm(W.get(w.id)));
    box.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.type-toggle [data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setVal('workerType', btn.getAttribute('data-type'));
      applyTypeUi();
    });
  });
  document.getElementById('search').addEventListener('input', renderList);
  document.getElementById('newBtn').addEventListener('click', () => {
    blankForm();
    D.setStatus('Ready for a new worker.');
  });
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const data = collect();
    if (!data.name) {
      D.setStatus('Enter a name before saving.');
      return;
    }
    try {
      const saved = await W.upsert(data);
      loadIntoForm(saved);
      D.setStatus(
        saved.type === 'employee' && saved.employeeId
          ? 'Worker saved. Employee ID ' + saved.employeeId + '.'
          : 'Worker saved to Firebase.'
      );
    } catch (e) {
      D.setStatus(e.message || 'Could not save worker.');
    }
  });
  document.getElementById('deleteBtn').addEventListener('click', async () => {
    const id = val('workerRecordId');
    if (!id) {
      D.setStatus('Select a worker to delete.');
      return;
    }
    const w = W.get(id);
    if (!w || !confirm('Delete ' + w.name + '?')) return;
    try {
      await W.remove(id);
      blankForm();
      D.setStatus('Worker deleted.');
    } catch (e) {
      D.setStatus(e.message || 'Could not delete.');
    }
  });
  const boot = window.TCVFirebase && window.TCVFirebase.ready ? window.TCVFirebase.ready : Promise.resolve();
  boot
    .then(() => W.refresh())
    .then(async () => {
      const missing = W.list().filter((w) => w.type === 'employee' && !String(w.employeeId || '').trim());
      for (let i = 0; i < missing.length; i++) {
        await W.upsert(missing[i]);
      }
      applyTypeUi();
      renderList();
    })
    .catch(() => {});
});
