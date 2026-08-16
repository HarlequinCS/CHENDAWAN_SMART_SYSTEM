const C = window.TCVClients;
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
  return val('clientType') === 'individual' ? 'individual' : 'business';
}

function applyTypeUi() {
  const isPerson = currentType() === 'individual';
  document.getElementById('typeBusiness').classList.toggle('is-on', !isPerson);
  document.getElementById('typeIndividual').classList.toggle('is-on', isPerson);
  document.getElementById('nameLabel').textContent = isPerson ? 'Full name' : 'Company name';
  document.getElementById('name').placeholder = isPerson
    ? 'e.g. Ahmad Bin Ali'
    : 'e.g. HRSB Holdings Sdn Bhd';
  document.getElementById('regLabel').textContent = isPerson ? 'NRIC no.' : 'Company registration no. (SSM)';
  document.getElementById('reg').placeholder = isPerson ? 'e.g. 041212-01-0085' : 'e.g. 202001234567 (1234567-A)';
  document.getElementById('attnWrap').hidden = isPerson;
  document.getElementById('signWrap').hidden = isPerson;
}

function blankForm() {
  setVal('clientRecordId', '');
  setVal('clientType', 'business');
  setVal('name', '');
  setVal('reg', '');
  setVal('address', '');
  setVal('attn', '');
  setVal('phone', '');
  setVal('email', '');
  setVal('signName', '');
  setVal('signTitle', '');
  setVal('notes', '');
  document.getElementById('formTitle').textContent = 'Register a Client';
  applyTypeUi();
  document.getElementById('statementWrap').hidden = true;
  renderList();
}

function loadIntoForm(client) {
  if (!client) return;
  setVal('clientRecordId', client.id);
  setVal('clientType', client.type);
  setVal('name', client.name);
  setVal('reg', client.reg);
  setVal('address', client.address);
  setVal('attn', client.attn);
  setVal('phone', client.phone);
  setVal('email', client.email);
  setVal('signName', client.signName);
  setVal('signTitle', client.signTitle);
  setVal('notes', client.notes);
  document.getElementById('formTitle').textContent = 'Edit Client';
  applyTypeUi();
  const wrap = document.getElementById('statementWrap');
  wrap.hidden = false;
  if (!val('stmtFrom') || !val('stmtTo')) {
    const y = new Date().getFullYear();
    setVal('stmtFrom', y + '-01-01');
    setVal('stmtTo', window.TCVNumbers ? window.TCVNumbers.isoToday() : '');
  }
  renderList();
}

function collectClient() {
  return {
    id: val('clientRecordId') || undefined,
    type: currentType(),
    name: val('name'),
    reg: val('reg'),
    address: val('address'),
    attn: val('attn'),
    phone: val('phone'),
    email: val('email'),
    signName: val('signName'),
    signTitle: val('signTitle'),
    notes: val('notes'),
  };
}

function renderList() {
  const q = val('search').toLowerCase();
  const active = val('clientRecordId');
  const box = document.getElementById('clientList');
  const rows = C.list().filter((c) => {
    if (!q) return true;
    return [c.name, c.reg, c.attn, c.email, c.phone, c.address]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  if (!rows.length) {
    box.innerHTML =
      '<p class="list-empty">' +
      (C.list().length
        ? 'No clients match that search.'
        : 'No clients yet. Register a business or an individual on the left.') +
      '</p>';
    return;
  }
  box.innerHTML = '';
  rows.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'client-card' + (c.id === active ? ' is-active' : '');
    const tag = c.type === 'individual' ? 'Individual' : 'Business';
    const extra = [c.reg, c.attn, c.address].filter(Boolean).join(' · ');
    btn.innerHTML =
      '<div class="card-top"><span class="card-name"></span><span class="tag"></span></div>' +
      '<div class="card-meta"></div>';
    btn.querySelector('.card-name').textContent = c.name || 'Untitled';
    btn.querySelector('.tag').textContent = tag;
    btn.querySelector('.tag').className = 'tag';
    btn.querySelector('.card-meta').textContent = extra || 'No extra details';
    btn.addEventListener('click', () => loadIntoForm(C.get(c.id)));
    box.appendChild(btn);
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function rm(n) {
  return 'RM ' + D.fmt(n);
}

function renderStatementSheet(client, stmt) {
  const company = window.TCV_COMPANY || {};
  const sheet = document.getElementById('statement-sheet');
  const rowsHtml = stmt.rows
    .map((r) => {
      return (
        '<tr><td>' +
        esc(D.formatDate(r.date) || r.date) +
        '</td><td>' +
        esc(r.number) +
        '</td><td>' +
        esc(r.type) +
        '</td><td class="num">' +
        (r.debit ? rm(r.debit) : '') +
        '</td><td class="num">' +
        (r.credit ? rm(r.credit) : '') +
        '</td><td class="num">' +
        rm(r.balance) +
        '</td></tr>'
      );
    })
    .join('');
  sheet.innerHTML =
    '<div class="doc-header"><div><img src="../../assets/logo.png" alt="ChendAwan">' +
    '<div class="doc-brand-name">' +
    esc(company.legalName || 'TEAM CHENDAWAN VENTURES') +
    '</div><div class="doc-brand-tag">' +
    esc(company.tagline || '') +
    '</div></div><div class="doc-title"><div class="big">STATEMENT</div>' +
    '<div class="small">' +
    esc(company.shortName || '') +
    '</div></div></div><hr class="rule">' +
    '<div class="meta-grid"><div class="bill-to"><div class="eyebrow">Client</div><div class="name">' +
    esc(client.name) +
    '</div><div class="line">' +
    esc(client.reg ? (client.type === 'individual' ? 'NRIC No. ' : 'Registration No. ') + client.reg : '') +
    '</div><div class="line">' +
    esc(client.address || '') +
    '</div></div><div class="meta-right"><div><span class="lab">Period</span><span class="val">' +
    esc(D.formatDate(stmt.from) + ' — ' + D.formatDate(stmt.to)) +
    '</span></div><div><span class="lab">Phone</span><span class="val">' +
    esc(company.phone || '+60 14-720 7787') +
    '</span></div><div><span class="lab">Email</span><span class="val">' +
    esc(company.email || '') +
    '</span></div></div></div>' +
    '<table class="items stmt-table"><thead><tr><th>Date</th><th>Number</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead><tbody>' +
    '<tr class="is-open"><td colspan="5">Opening balance</td><td class="num">' +
    rm(stmt.opening) +
    '</td></tr>' +
    (rowsHtml || '<tr><td colspan="6">No invoices, receipts, or credit notes in this period.</td></tr>') +
    '<tr class="is-close"><td colspan="5">Amount due</td><td class="num">' +
    rm(stmt.closing) +
    '</td></tr></tbody></table>' +
    '<p class="stmt-meta" style="margin-top:18px;">Positive balance is amount still owed to TEAM CHENDAWAN VENTURES.</p>';
}

async function prepareStatement() {
  const id = val('clientRecordId');
  const client = C.get(id);
  if (!client) {
    D.setStatus('Select a client first.');
    return null;
  }
  if (!window.TCVLedger || !window.TCVLedger.clientStatement) {
    D.setStatus('Ledger is not available.');
    return null;
  }
  await window.TCVLedger.ensureSeeded();
  const stmt = await window.TCVLedger.clientStatement(id, val('stmtFrom'), val('stmtTo'));
  renderStatementSheet(client, stmt);
  document.getElementById('statementPrint').hidden = false;
  return { client, stmt };
}

async function downloadStatement() {
  try {
    const built = await prepareStatement();
    if (!built) return;
    const slug = (built.client.name || 'client').replace(/[^a-z0-9\-_]+/gi, '_');
    D.downloadPdf(
      'statement-sheet',
      'Statement_' + slug + '_' + built.stmt.from + '_' + built.stmt.to + '.pdf',
      'stmtBtn'
    );
  } catch (e) {
    D.setStatus(e.message || 'Could not build the statement.');
  }
}

async function printStatement() {
  try {
    const built = await prepareStatement();
    if (!built) return;
    D.printPdf('statement-sheet', 'stmtPrintBtn');
  } catch (e) {
    D.setStatus(e.message || 'Could not build the statement.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('typeBusiness').addEventListener('click', () => {
    setVal('clientType', 'business');
    applyTypeUi();
  });
  document.getElementById('typeIndividual').addEventListener('click', () => {
    setVal('clientType', 'individual');
    applyTypeUi();
  });
  document.getElementById('search').addEventListener('input', renderList);
  document.getElementById('newBtn').addEventListener('click', () => {
    blankForm();
    D.setStatus('Ready for a new client.');
  });
  document.getElementById('stmtBtn').addEventListener('click', () => {
    downloadStatement();
  });
  document.getElementById('stmtPrintBtn').addEventListener('click', () => {
    printStatement();
  });
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const data = collectClient();
    if (!data.name) {
      D.setStatus('Enter a name before saving.');
      return;
    }
    try {
      const saved = await C.upsert(data);
      loadIntoForm(saved);
      D.setStatus('Client saved to Firebase.');
    } catch (e) {
      D.setStatus(e.message || 'Could not save client.');
    }
  });
  document.getElementById('deleteBtn').addEventListener('click', async () => {
    const id = val('clientRecordId');
    if (!id) {
      D.setStatus('Select a client to delete.');
      return;
    }
    const client = C.get(id);
    if (!client || !confirm('Delete ' + client.name + '? Documents already filled will keep their saved details.')) {
      return;
    }
    try {
      await C.remove(id);
      blankForm();
      D.setStatus('Client deleted.');
    } catch (e) {
      D.setStatus(e.message || 'Could not delete client.');
    }
  });
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([C.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chendawan-clients.json';
    a.click();
    URL.revokeObjectURL(a.href);
    D.setStatus('Client backup downloaded.');
  });
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await C.importJson(String(reader.result || ''));
        blankForm();
        D.setStatus('Clients imported to Firebase.');
      } catch (err) {
        D.setStatus('Could not import that file.');
      }
    };
    reader.readAsText(file);
  });
  applyTypeUi();
  const boot = window.TCVFirebase && window.TCVFirebase.ready ? window.TCVFirebase.ready : Promise.resolve();
  boot
    .then(() => C.refresh())
    .then(() => {
      const localBtn = document.getElementById('importLocalBtn');
      if (localBtn) {
        localBtn.addEventListener('click', async () => {
          const n = C.localList().length;
          if (!n) {
            D.setStatus('No clients stored in this browser.');
            return;
          }
          if (!confirm('Import ' + n + ' client(s) from this browser into Firebase?')) return;
          try {
            await C.importLocal();
            blankForm();
            D.setStatus('Imported ' + n + ' client(s) to Firebase.');
          } catch (e) {
            D.setStatus(e.message || 'Could not import local clients.');
          }
        });
      }
      renderList();
    })
    .catch(() => {});
});
