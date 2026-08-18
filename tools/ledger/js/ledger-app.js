const L = window.TCVLedger;
const D = window.TCVDoc;
const COMPANY = window.TCV_COMPANY || {};

const VIEWS = {
  dashboard: { title: 'Dashboard', sub: 'Cash, receivables, payables, and this month’s result.' },
  sales: { title: 'Sales (AR)', sub: 'Add or edit invoices here, or post from an Invoice PDF. Record collections against the balance.' },
  purchases: { title: 'Purchases (AP)', sub: 'Supplier bills, contractor claims, and bill payments.' },
  pay: { title: 'Pay workforce', sub: 'Pay contractors and freelancers from Bank Islam. Employees with EPF/SOCSO still use the Payslip tool.' },
  expenses: { title: 'Expenses', sub: 'Paid-now costs. Drawings are not expenses — record those on Bank.' },
  bank: { title: 'Bank & park', sub: 'Operating bank, investment account, park/withdraw, drawings, and a simple reconcile.' },
  journal: { title: 'Journal', sub: 'Edit an unlocked journal, or post a manual one. Void creates a reversing entry.' },
  reports: { title: 'Reports', sub: 'Print or download A4 packs for the books and LHDN Form B.' },
  settings: { title: 'Settings', sub: 'Chart of accounts, SST, backup export, bank accounts, opening balances, and month lock.' },
};

let cache = {
  invoices: [],
  bills: [],
  expenses: [],
  journals: [],
  vendors: [],
  workerPayments: [],
};

function $(id) {
  return document.getElementById(id);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function rm(n) {
  return 'RM ' + D.fmt(L.money(n));
}

function today() {
  return window.TCVNumbers.isoToday();
}

function thisMonth() {
  return today().slice(0, 7);
}

function status(msg) {
  D.setStatus(msg);
}

function clientName(id) {
  const c = window.TCVClients && window.TCVClients.get(id);
  return c ? c.name : '';
}

function projectName(id) {
  const p = window.TCVProjects && window.TCVProjects.get(id);
  return p ? p.name : '';
}

function workerName(id) {
  const w = window.TCVWorkers && window.TCVWorkers.get(id);
  return w ? w.name : '';
}

function accountOptions(selected, filterFn) {
  let rows = L.listAccounts();
  if (filterFn) rows = rows.filter(filterFn);
  return rows
    .map((a) => {
      return (
        '<option value="' +
        esc(a.code) +
        '"' +
        (a.code === selected ? ' selected' : '') +
        '>' +
        esc(a.code + ' · ' + a.name) +
        '</option>'
      );
    })
    .join('');
}

function bankLabel(b) {
  const bits = [b.name];
  if (b.accountName) bits.push(b.accountName);
  if (b.accountNo) bits.push(b.accountNo);
  if (L.isInvestmentAccount(b)) bits.push('parked');
  return bits.join(' · ');
}

function bankOptions(selected) {
  return L.listBankAccounts()
    .map((b) => {
      return (
        '<option value="' +
        esc(b.id) +
        '"' +
        (b.id === selected ? ' selected' : '') +
        '>' +
        esc(bankLabel(b)) +
        '</option>'
      );
    })
    .join('');
}

function firstInvestment() {
  return L.listBankAccounts().find((b) => L.isInvestmentAccount(b)) || null;
}

function glNet(bals, code) {
  return (bals[code] && bals[code].net) || 0;
}

function cashSplit(bals) {
  const seen = {};
  let operating = 0;
  let invested = 0;
  L.listBankAccounts().forEach((b) => {
    if (seen[b.glCode]) return;
    seen[b.glCode] = true;
    const n = glNet(bals, b.glCode);
    if (L.isInvestmentAccount(b)) invested += n;
    else operating += n;
  });
  return { operating, invested, total: L.money(operating + invested) };
}

function projectOptions(selected) {
  const rows = window.TCVProjects ? window.TCVProjects.list() : [];
  let html = '<option value="">No project</option>';
  rows.forEach((p) => {
    html +=
      '<option value="' +
      esc(p.id) +
      '"' +
      (p.id === selected ? ' selected' : '') +
      '>' +
      esc(window.TCVProjects.label(p)) +
      '</option>';
  });
  return html;
}

function vendorOptions(selected) {
  let html = '<option value="">Select vendor…</option>';
  cache.vendors.forEach((v) => {
    html +=
      '<option value="' +
      esc(v.id) +
      '"' +
      (v.id === selected ? ' selected' : '') +
      '>' +
      esc(v.name) +
      '</option>';
  });
  return html;
}

function workerOptions(selected, kinds) {
  let html = '<option value="">Select a worker…</option>';
  const rows = window.TCVWorkers ? window.TCVWorkers.list() : [];
  rows.forEach((w) => {
    if (kinds && kinds.indexOf(w.type) === -1) return;
    const kind = window.TCVWorkers.typeLabel ? window.TCVWorkers.typeLabel(w.type) : w.type;
    html +=
      '<option value="' +
      esc(w.id) +
      '"' +
      (w.id === selected ? ' selected' : '') +
      '>' +
      esc((w.name || 'Untitled') + ' · ' + kind) +
      '</option>';
  });
  return html;
}

async function refreshData() {
  await L.ensureSeeded();
  const [invoices, bills, expenses, journals, vendors, workerPayments] = await Promise.all([
    L.listInvoices(),
    L.listBills(),
    L.listExpenses(),
    L.listJournals(),
    L.listVendors(),
    L.listWorkerPayments(),
  ]);
  cache = { invoices, bills, expenses, journals, vendors, workerPayments };
}

function currentView() {
  const hash = (location.hash || '#dashboard').replace('#', '');
  return VIEWS[hash] ? hash : 'dashboard';
}

function setNav(view) {
  document.querySelectorAll('#ledgerNav a').forEach((a) => {
    a.classList.toggle('is-on', a.getAttribute('data-view') === view);
  });
  $('viewTitle').textContent = VIEWS[view].title;
  $('viewSub').textContent = VIEWS[view].sub;
}

function formVal(root, name) {
  const el = root.querySelector('[name="' + name + '"]');
  if (!el) return '';
  if (el.type === 'checkbox') return el.checked;
  return el.value.trim();
}

function setForm(form, name, value) {
  const el = form.querySelector('[name="' + name + '"]');
  if (el) el.value = value == null ? '' : value;
}

function clientOptions(selected) {
  let html = '<option value="">Select client…</option>';
  const rows = window.TCVClients ? window.TCVClients.list() : [];
  rows.forEach((c) => {
    html +=
      '<option value="' +
      esc(c.id) +
      '"' +
      (c.id === selected ? ' selected' : '') +
      '>' +
      esc(c.name) +
      '</option>';
  });
  return html;
}

let pendingJournalId = '';

function expenseCodes() {
  return accountOptions('6090', (a) => a.type === 'expense');
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const month = thisMonth();
  const bals = L.balancesFromJournals(cache.journals);
  const monthBals = L.balancesFromJournals(cache.journals, { from: month + '-01', to: month + '-31' });
  const cash = cashSplit(bals);
  const ar = cache.invoices.reduce((s, i) => {
    if (i.status === 'void' || i.status === 'paid' || i.status === 'credited') return s;
    return s + L.money(i.balance);
  }, 0);
  const ap = cache.bills.reduce((s, i) => s + L.money(i.balance), 0);
  let income = 0;
  let expense = 0;
  Object.keys(monthBals).forEach((code) => {
    const row = monthBals[code];
    if (row.account.type === 'income') income += row.net;
    if (row.account.type === 'expense') expense += row.net;
  });
  const unpaid = cache.invoices.filter((i) => i.status !== 'paid' && i.status !== 'void');
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  unpaid.forEach((i) => {
    aging[L.agingBuckets(i.date, i.dueDate)] += L.money(i.balance);
  });
  const projects = window.TCVProjects ? window.TCVProjects.list() : [];
  const projRows = projects
    .map((p) => {
      const billed = cache.invoices.filter((i) => i.projectId === p.id).reduce((s, i) => s + L.money(i.total), 0);
      const collected = cache.invoices
        .filter((i) => i.projectId === p.id)
        .reduce((s, i) => s + L.money(i.total - i.balance), 0);
      let costs = 0;
      cache.journals.forEach((j) => {
        if (j.projectId !== p.id || !L.isLiveJournal(j)) return;
        (j.lines || []).forEach((l) => {
          const acc = L.accountByCode(l.accountCode);
          if (acc && acc.type === 'expense') costs += L.money(l.debit - l.credit);
        });
      });
      return { p, billed, collected, costs };
    })
    .filter((r) => r.billed || r.collected || r.costs);

  const cashRows = L.listBankAccounts()
    .map((b) => {
      const n = glNet(bals, b.glCode);
      return (
        '<tr><td>' +
        esc(b.name) +
        '</td><td>' +
        esc(L.isInvestmentAccount(b) ? 'Invested' : 'Operating') +
        '</td><td class="num">' +
        rm(n) +
        '</td></tr>'
      );
    })
    .join('');

  $('viewRoot').innerHTML =
    '<div class="kpi-grid">' +
    kpi('Cash in bank', rm(cash.operating)) +
    kpi('Invested / parked', rm(cash.invested)) +
    kpi('AR outstanding', rm(ar)) +
    kpi('AP outstanding', rm(ap)) +
    kpi('This month P&amp;L', rm(income - expense)) +
    '</div>' +
    '<div class="panel"><h2>Where the money sits</h2>' +
    '<table class="data-table"><thead><tr><th>Account</th><th>Kind</th><th class="num">Balance</th></tr></thead><tbody>' +
    cashRows +
    '<tr><td><strong>Total liquid</strong></td><td></td><td class="num"><strong>' +
    rm(cash.total) +
    '</strong></td></tr></tbody></table>' +
    '<p class="muted">Park funds from Bank &amp; park. Moving money to the investment account is not an expense.</p></div>' +
    '<div class="panel"><h2>Unpaid invoices aging</h2>' +
    '<table class="data-table"><thead><tr><th>Current (0–30)</th><th>31–60</th><th>61–90</th><th>90+</th></tr></thead>' +
    '<tbody><tr><td>' +
    rm(aging.current) +
    '</td><td>' +
    rm(aging.d30) +
    '</td><td>' +
    rm(aging.d60) +
    '</td><td>' +
    rm(aging.d90) +
    '</td></tr></tbody></table></div>' +
    '<div class="panel"><h2>Project billed vs costs</h2>' +
    (projRows.length
      ? '<table class="data-table"><thead><tr><th>Project</th><th class="num">Billed</th><th class="num">Collected</th><th class="num">Costs</th><th class="num">Margin</th></tr></thead><tbody>' +
        projRows
          .map((r) => {
            return (
              '<tr><td>' +
              esc(r.p.name) +
              '</td><td class="num">' +
              rm(r.billed) +
              '</td><td class="num">' +
              rm(r.collected) +
              '</td><td class="num">' +
              rm(r.costs) +
              '</td><td class="num">' +
              rm(r.billed - r.costs) +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>'
      : '<p class="muted">No project activity yet.</p>') +
    '</div>';
}

function kpi(lab, val) {
  return '<div class="kpi"><div class="lab">' + lab + '</div><div class="val">' + val + '</div></div>';
}

function invoiceStatusSelect(id, current) {
  const cur = String(current || 'issued');
  return (
    '<select class="status-select tag ' +
    esc(cur) +
    '" data-inv-status="' +
    esc(id) +
    '" aria-label="Invoice status">' +
    (L.INVOICE_STATUSES || ['issued', 'partial', 'paid', 'credited', 'void'])
      .map((s) => {
        return '<option value="' + s + '"' + (s === cur ? ' selected' : '') + '>' + s + '</option>';
      })
      .join('') +
    '</select>'
  );
}

/* ---------- Sales ---------- */
function renderSales() {
  const rows = cache.invoices
    .map((i) => {
      return (
        '<tr><td>' +
        esc(i.number) +
        '</td><td>' +
        esc(i.date) +
        '</td><td>' +
        esc(clientName(i.clientId) || '—') +
        '</td><td>' +
        esc(projectName(i.projectId) || '—') +
        '</td><td class="num">' +
        rm(i.total) +
        '</td><td class="num">' +
        rm(i.balance) +
        '</td><td>' +
        invoiceStatusSelect(i.id, i.status) +
        '</td><td class="actions">' +
        (i.status !== 'void'
          ? '<button class="btn ghost" data-edit-inv="' +
            esc(i.id) +
            '">Edit</button>'
          : '') +
        (i.balance > 0 && i.status !== 'void'
          ? ' <button class="btn ghost" data-pay="' +
            esc(i.id) +
            '" data-bal="' +
            i.balance +
            '">Pay</button>'
          : '') +
        '</td></tr>'
      );
    })
    .join('');
  $('viewRoot').innerHTML =
    '<div class="panel"><h2 id="invFormTitle">Add / edit invoice</h2>' +
    '<p class="muted">Type an invoice here, or edit one from the list. Downloading an Invoice PDF still posts automatically. Changing status posts or voids the matching bank and AR journals so cash, outstanding, and reports stay in line.</p>' +
    '<form id="invForm" class="form-grid">' +
    '<input type="hidden" name="id" value="">' +
    '<div><label>Number</label><input name="number" placeholder="INV/2026/001-WSD-100/01"></div>' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Due date</label><input type="date" name="dueDate" value="' +
    today() +
    '"></div>' +
    '<div><label>Client</label><select name="clientId">' +
    clientOptions('') +
    '</select></div>' +
    '<div><label>Project</label><select name="projectId">' +
    projectOptions('') +
    '</select></div>' +
    '<div><label>Subtotal (RM)</label><input type="number" step="0.01" name="subtotal" value="0"></div>' +
    '<div><label>SST (RM)</label><input type="number" step="0.01" name="sst" value="0"></div>' +
    '<div><label>Total (RM)</label><input type="number" step="0.01" name="total" value="0"></div>' +
    '<div><label>Status</label><select name="status">' +
    (L.INVOICE_STATUSES || [])
      .map((s) => '<option value="' + s + '"' + (s === 'issued' ? ' selected' : '') + '>' + s + '</option>')
      .join('') +
    '</select></div>' +
    '<div class="span-2"><label>Memo</label><input type="text" name="memo"></div>' +
    '</form><div class="btn-row"><button class="btn" id="invSaveBtn">Save invoice</button>' +
    '<button class="btn ghost" id="invNewBtn">New</button></div></div>' +
    '<div class="panel"><h2>Record a collection</h2>' +
    '<p class="muted">Prefer the Receipt tool so the client gets a PDF. This posts cash against an invoice without a receipt.</p>' +
    '<form id="arPayForm" class="form-grid">' +
    '<div><label>Invoice</label><select name="invoiceId">' +
    cache.invoices
      .filter((i) => i.balance > 0)
      .map((i) => '<option value="' + esc(i.id) + '">' + esc(i.number + ' · ' + rm(i.balance) + ' left') + '</option>')
      .join('') +
    '</select></div>' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount" required></div>' +
    '<div><label>Bank</label><select name="bankAccountId">' +
    bankOptions((L.defaultBankAccount() || {}).id) +
    '</select></div></form>' +
    '<div class="btn-row"><button class="btn" id="arPayBtn">Post payment</button>' +
    '<button class="btn ghost" id="orphanBtn">Post missing invoices</button></div></div>' +
    '<div class="panel"><h2>Invoices</h2>' +
    (rows
      ? '<table class="data-table"><thead><tr><th>Number</th><th>Date</th><th>Client</th><th>Project</th><th class="num">Total</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<p class="muted">No invoices yet. Add one above or download an Invoice PDF.</p>') +
    '</div>';

  function fillInvoice(inv) {
    const form = $('invForm');
    setForm(form, 'id', inv ? inv.id : '');
    setForm(form, 'number', inv ? inv.number : '');
    setForm(form, 'date', inv ? inv.date : today());
    setForm(form, 'dueDate', inv ? inv.dueDate || inv.date : today());
    setForm(form, 'clientId', inv ? inv.clientId : '');
    setForm(form, 'projectId', inv ? inv.projectId : '');
    setForm(form, 'subtotal', inv ? inv.subtotal : 0);
    setForm(form, 'sst', inv ? inv.sst : 0);
    setForm(form, 'total', inv ? inv.total : 0);
    setForm(form, 'status', inv ? inv.status || 'issued' : 'issued');
    setForm(form, 'memo', inv ? inv.memo : '');
    $('invFormTitle').textContent = inv ? 'Edit invoice' : 'Add / edit invoice';
    $('invSaveBtn').textContent = inv ? 'Save changes' : 'Save invoice';
  }

  $('invForm').addEventListener('input', (e) => {
    if (e.target.name === 'subtotal' || e.target.name === 'sst') {
      const form = $('invForm');
      const total = L.money(formVal(form, 'subtotal')) + L.money(formVal(form, 'sst'));
      setForm(form, 'total', total.toFixed(2));
    }
  });
  $('invSaveBtn').addEventListener('click', async () => {
    const form = $('invForm');
    const payload = {
      id: formVal(form, 'id'),
      number: formVal(form, 'number'),
      date: formVal(form, 'date'),
      dueDate: formVal(form, 'dueDate'),
      clientId: formVal(form, 'clientId'),
      projectId: formVal(form, 'projectId'),
      subtotal: formVal(form, 'subtotal'),
      sst: formVal(form, 'sst'),
      total: formVal(form, 'total'),
      status: formVal(form, 'status'),
      memo: formVal(form, 'memo'),
    };
    try {
      if (payload.id) {
        await L.updateInvoice(payload);
        if (payload.status) await L.setInvoiceStatus(payload.id, payload.status);
      } else {
        const row = await L.recordManualInvoice(payload);
        if (payload.status && payload.status !== 'issued' && row && row.id) {
          await L.setInvoiceStatus(row.id, payload.status);
        }
      }
      status(payload.id ? 'Invoice updated.' : 'Invoice saved.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not save invoice.');
    }
  });
  $('invNewBtn').addEventListener('click', () => fillInvoice(null));
  $('viewRoot').querySelectorAll('[data-edit-inv]').forEach((btn) => {
    btn.addEventListener('click', () => {
      fillInvoice(cache.invoices.find((i) => i.id === btn.getAttribute('data-edit-inv')));
      $('invForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  $('viewRoot').querySelectorAll('[data-inv-status]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await L.setInvoiceStatus(sel.getAttribute('data-inv-status'), sel.value);
        status('Status set to ' + sel.value + '.');
        await reload();
      } catch (e) {
        status(e.message || 'Could not change status.');
      }
    });
  });

  $('arPayBtn').addEventListener('click', async () => {
    const form = $('arPayForm');
    try {
      await L.recordInvoicePayment({
        invoiceId: formVal(form, 'invoiceId'),
        date: formVal(form, 'date'),
        amount: formVal(form, 'amount'),
        bankAccountId: formVal(form, 'bankAccountId'),
      });
      status('Payment posted.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not post payment.');
    }
  });
  $('orphanBtn').addEventListener('click', async () => {
    try {
      const orphans = await L.listOrphanInvoices();
      for (const doc of orphans) {
        await L.onDocumentCommitted({
          type: 'INV',
          documentId: doc.id,
          number: doc.number,
          projectId: doc.projectId,
          clientId: doc.clientId,
          payload: doc.payload || {},
        });
      }
      status(orphans.length ? 'Posted ' + orphans.length + ' missing invoice(s).' : 'No missing invoices.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not post orphans.');
    }
  });
  $('viewRoot').querySelectorAll('[data-pay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = $('arPayForm');
      form.querySelector('[name="invoiceId"]').value = btn.getAttribute('data-pay');
      form.querySelector('[name="amount"]').value = btn.getAttribute('data-bal');
    });
  });
}

/* ---------- Purchases ---------- */
function renderPurchases() {
  const rows = cache.bills
    .map((b) => {
      const who = b.vendorName || workerName(b.workerId) || '—';
      return (
        '<tr><td>' +
        esc(b.date) +
        '</td><td>' +
        esc(who) +
        '</td><td>' +
        esc(projectName(b.projectId) || '—') +
        '</td><td>' +
        esc(b.memo || '') +
        '</td><td class="num">' +
        rm(b.amount) +
        '</td><td class="num">' +
        rm(b.balance) +
        '</td><td><span class="tag ' +
        esc(b.status) +
        '">' +
        esc(b.status) +
        '</span></td><td class="actions">' +
        (b.balance > 0
          ? '<button class="btn ghost" data-bill="' + esc(b.id) + '" data-bal="' + b.balance + '">Pay</button> '
          : '') +
        '<button class="btn ghost" data-edit-bill="' +
        esc(b.id) +
        '">Edit</button>' +
        '</td></tr>'
      );
    })
    .join('');
  $('viewRoot').innerHTML =
    '<div class="panel"><h2 id="billFormTitle">Record a bill</h2>' +
    '<form id="billForm" class="form-grid">' +
    '<input type="hidden" name="id" value="">' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Due</label><input type="date" name="dueDate" value="' +
    today() +
    '"></div>' +
    '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount" required></div>' +
    '<div><label>Expense account</label><select name="accountCode">' +
    expenseCodes() +
    '</select></div>' +
    '<div><label>Vendor</label><select name="vendorId">' +
    vendorOptions('') +
    '</select></div>' +
    '<div><label>Or worker</label><select name="workerId">' +
    workerOptions('') +
    '</select></div>' +
    '<div><label>Project</label><select name="projectId">' +
    projectOptions('') +
    '</select></div>' +
    '<div class="span-2"><label>Memo</label><input type="text" name="memo" placeholder="e.g. ICA milestone 1"></div>' +
    '<div class="span-2"><label>New vendor name (if not listed)</label><input type="text" name="newVendor"></div>' +
    '</form><div class="btn-row"><button class="btn" id="billBtn">Save bill</button>' +
    '<button class="btn ghost" id="billNewBtn">New</button></div></div>' +
    '<div class="panel"><h2>Pay a bill</h2>' +
    '<form id="billPayForm" class="form-grid">' +
    '<div><label>Bill</label><select name="billId">' +
    cache.bills
      .filter((b) => b.balance > 0)
      .map((b) => '<option value="' + esc(b.id) + '">' + esc((b.memo || b.id) + ' · ' + rm(b.balance)) + '</option>')
      .join('') +
    '</select></div>' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount"></div>' +
    '<div><label>Bank</label><select name="bankAccountId">' +
    bankOptions((L.defaultBankAccount() || {}).id) +
    '</select></div></form>' +
    '<div class="btn-row"><button class="btn" id="billPayBtn">Post payment</button></div></div>' +
    '<div class="panel"><h2>Bills</h2>' +
    (rows
      ? '<table class="data-table"><thead><tr><th>Date</th><th>Payee</th><th>Project</th><th>Memo</th><th class="num">Amount</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<p class="muted">No bills yet.</p>') +
    '</div>';

  $('billBtn').addEventListener('click', async () => {
    const form = $('billForm');
    try {
      let vendorId = formVal(form, 'vendorId');
      let vendorName = '';
      const newName = formVal(form, 'newVendor');
      if (newName) {
        const v = await L.upsertVendor({ name: newName });
        vendorId = v.id;
        vendorName = v.name;
      } else if (vendorId) {
        const v = cache.vendors.find((x) => x.id === vendorId);
        vendorName = v ? v.name : '';
      }
      const payload = {
        id: formVal(form, 'id'),
        date: formVal(form, 'date'),
        dueDate: formVal(form, 'dueDate'),
        amount: formVal(form, 'amount'),
        accountCode: formVal(form, 'accountCode'),
        vendorId,
        vendorName,
        workerId: formVal(form, 'workerId'),
        projectId: formVal(form, 'projectId'),
        memo: formVal(form, 'memo'),
      };
      if (payload.id) await L.updateBill(payload);
      else await L.recordBill(payload);
      status(payload.id ? 'Bill updated.' : 'Bill saved.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not save bill.');
    }
  });
  $('billNewBtn').addEventListener('click', () => {
    const form = $('billForm');
    setForm(form, 'id', '');
    setForm(form, 'memo', '');
    setForm(form, 'amount', '');
    setForm(form, 'newVendor', '');
    $('billFormTitle').textContent = 'Record a bill';
    $('billBtn').textContent = 'Save bill';
  });
  $('viewRoot').querySelectorAll('[data-edit-bill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = cache.bills.find((x) => x.id === btn.getAttribute('data-edit-bill'));
      if (!b) return;
      const form = $('billForm');
      setForm(form, 'id', b.id);
      setForm(form, 'date', b.date);
      setForm(form, 'dueDate', b.dueDate || b.date);
      setForm(form, 'amount', b.amount);
      setForm(form, 'accountCode', b.accountCode);
      setForm(form, 'vendorId', b.vendorId);
      setForm(form, 'workerId', b.workerId);
      setForm(form, 'projectId', b.projectId);
      setForm(form, 'memo', b.memo);
      $('billFormTitle').textContent = 'Edit bill';
      $('billBtn').textContent = 'Save changes';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  $('billPayBtn').addEventListener('click', async () => {
    const form = $('billPayForm');
    try {
      await L.payBill({
        billId: formVal(form, 'billId'),
        date: formVal(form, 'date'),
        amount: formVal(form, 'amount'),
        bankAccountId: formVal(form, 'bankAccountId'),
      });
      status('Bill payment posted.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not pay bill.');
    }
  });
  $('viewRoot').querySelectorAll('[data-bill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = $('billPayForm');
      form.querySelector('[name="billId"]').value = btn.getAttribute('data-bill');
      form.querySelector('[name="amount"]').value = btn.getAttribute('data-bal');
    });
  });
}

/* ---------- Pay workforce ---------- */
function renderPay() {
  const defBank = L.defaultBankAccount() || {};
  const rows = (cache.workerPayments || [])
    .map((p) => {
      return (
        '<tr><td>' +
        esc(p.date) +
        '</td><td>' +
        esc(p.workerName || workerName(p.workerId) || '—') +
        '</td><td>' +
        esc(p.workerKind === 'employee' ? 'Employee' : p.workerKind === 'freelancer' ? 'Freelancer' : 'Contractor') +
        '</td><td>' +
        esc(projectName(p.projectId) || '—') +
        '</td><td>' +
        esc(p.memo || '') +
        '</td><td class="num">' +
        rm(p.amount) +
        '</td></tr>'
      );
    })
    .join('');
  $('viewRoot').innerHTML =
    '<div class="panel"><h2>Pay a contractor</h2>' +
    '<p class="muted">Contractors and freelancers only. Employees with EPF/SOCSO must use <a href="../payslip/">Payslip / Payment Advice</a>. Register people first in <a href="../workforce/">Workforce</a>.</p>' +
    '<form id="payForm" class="form-grid">' +
    '<div><label>Worker</label><select name="workerId">' +
    workerOptions('', ['contractor', 'freelancer']) +
    '</select></div>' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount" required></div>' +
    '<div><label>Project</label><select name="projectId">' +
    projectOptions('') +
    '</select></div>' +
    '<div><label>Pay from bank</label><select name="bankAccountId">' +
    bankOptions(defBank.id) +
    '</select></div>' +
    '<div class="span-2"><label>Memo</label><input type="text" name="memo" placeholder="e.g. Milestone 1 — ICA"></div>' +
    '<div class="span-2"><label class="check-row"><input type="checkbox" name="paidNow" checked> Paid now from this bank. Uncheck to record an unpaid bill instead.</label></div>' +
    '</form><div class="btn-row"><button class="btn" id="payBtn">Post payment</button></div></div>' +
    '<div class="panel"><h2>Recent workforce payments</h2>' +
    (rows
      ? '<table class="data-table"><thead><tr><th>Date</th><th>Worker</th><th>Type</th><th>Project</th><th>Memo</th><th class="num">Amount</th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<p class="muted">No workforce payments yet.</p>') +
    '</div>';

  $('payBtn').addEventListener('click', async () => {
    const form = $('payForm');
    const workerId = formVal(form, 'workerId');
    const worker = window.TCVWorkers ? window.TCVWorkers.get(workerId) : null;
    try {
      const date = formVal(form, 'date');
      const sameDayPsl = cache.journals.some(
        (j) => L.isLiveJournal(j) && j.sourceType === 'PSL' && j.workerId === workerId && j.date === date
      );
      if (
        sameDayPsl &&
        !confirm('A payslip or payment advice already exists for this worker on this date. Post anyway?')
      ) {
        return;
      }
      await L.payWorker({
        workerId,
        workerName: worker ? worker.name : '',
        workerKind: worker ? worker.type : 'contractor',
        date: formVal(form, 'date'),
        amount: formVal(form, 'amount'),
        projectId: formVal(form, 'projectId'),
        bankAccountId: formVal(form, 'bankAccountId') || defBank.id,
        memo: formVal(form, 'memo'),
        paidNow: !!form.querySelector('[name="paidNow"]').checked,
      });
      status('Payment posted from ' + (defBank.name || 'the main bank') + '.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not post payment.');
    }
  });
}

/* ---------- Expenses / bank / journal ---------- */
function renderExpenses() {
  const rows = cache.expenses
    .map((e) => {
      const acc = L.accountByCode(e.accountCode);
      return (
        '<tr><td>' +
        esc(e.date) +
        '</td><td>' +
        esc(acc ? acc.name : e.accountCode) +
        '</td><td>' +
        esc(projectName(e.projectId) || '—') +
        '</td><td>' +
        esc(e.memo || '') +
        '</td><td class="num">' +
        rm(e.amount) +
        '</td><td class="actions"><button class="btn ghost" data-edit-exp="' +
        esc(e.id) +
        '">Edit</button></td></tr>'
      );
    })
    .join('');
  $('viewRoot').innerHTML =
    '<div class="panel"><h2 id="expFormTitle">Paid expense</h2>' +
    '<form id="expForm" class="form-grid">' +
    '<input type="hidden" name="id" value="">' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount" required></div>' +
    '<div><label>Category</label><select name="accountCode">' +
    expenseCodes() +
    '</select></div>' +
    '<div><label>Project</label><select name="projectId">' +
    projectOptions('') +
    '</select></div>' +
    '<div><label>Bank</label><select name="bankAccountId">' +
    bankOptions((L.defaultBankAccount() || {}).id) +
    '</select></div>' +
    '<div class="span-2"><label>Memo</label><input type="text" name="memo" placeholder="e.g. Domain renewal"></div>' +
    '</form><div class="btn-row"><button class="btn" id="expBtn">Save expense</button>' +
    '<button class="btn ghost" id="expNewBtn">New</button></div></div>' +
    '<div class="panel"><h2>Recent expenses</h2>' +
    (rows
      ? '<table class="data-table"><thead><tr><th>Date</th><th>Category</th><th>Project</th><th>Memo</th><th class="num">Amount</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<p class="muted">No paid expenses yet.</p>') +
    '</div>';
  $('expBtn').addEventListener('click', async () => {
    const form = $('expForm');
    const payload = {
      id: formVal(form, 'id'),
      date: formVal(form, 'date'),
      amount: formVal(form, 'amount'),
      accountCode: formVal(form, 'accountCode'),
      projectId: formVal(form, 'projectId'),
      bankAccountId: formVal(form, 'bankAccountId'),
      memo: formVal(form, 'memo'),
    };
    try {
      if (payload.id) await L.updateExpense(payload);
      else await L.recordExpense(payload);
      status(payload.id ? 'Expense updated.' : 'Expense saved.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not save expense.');
    }
  });
  $('expNewBtn').addEventListener('click', () => {
    const form = $('expForm');
    setForm(form, 'id', '');
    setForm(form, 'amount', '');
    setForm(form, 'memo', '');
    $('expFormTitle').textContent = 'Paid expense';
    $('expBtn').textContent = 'Save expense';
  });
  $('viewRoot').querySelectorAll('[data-edit-exp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const e = cache.expenses.find((x) => x.id === btn.getAttribute('data-edit-exp'));
      if (!e) return;
      const form = $('expForm');
      setForm(form, 'id', e.id);
      setForm(form, 'date', e.date);
      setForm(form, 'amount', e.amount);
      setForm(form, 'accountCode', e.accountCode);
      setForm(form, 'projectId', e.projectId);
      setForm(form, 'bankAccountId', e.bankAccountId);
      setForm(form, 'memo', e.memo);
      $('expFormTitle').textContent = 'Edit expense';
      $('expBtn').textContent = 'Save changes';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function bankLines(bank) {
  const code = bank.glCode;
  const lines = [];
  cache.journals.forEach((j) => {
    if (!L.isLiveJournal(j)) return;
    (j.lines || []).forEach((l) => {
      if (l.accountCode !== code) return;
      if (j.bankAccountId && j.bankAccountId !== bank.id && L.listBankAccounts().length > 1) {
        const others = L.listBankAccounts().filter((b) => b.id !== bank.id && b.glCode === code);
        if (others.length && j.bankAccountId !== bank.id) return;
      }
      lines.push({
        date: j.date,
        memo: j.memo,
        sourceType: j.sourceType,
        debit: l.debit,
        credit: l.credit,
        journalId: j.id,
      });
    });
  });
  lines.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return lines;
}

function renderBank() {
  const banks = L.listBankAccounts();
  const selected = ($('bankPick') && $('bankPick').value) || (banks[0] && banks[0].id) || '';
  const bank = banks.find((b) => b.id === selected) || banks[0];
  const invested = firstInvestment();
  const lines = bank ? bankLines(bank) : [];
  const viewingInvest = bank && L.isInvestmentAccount(bank);
  const defaultTo = viewingInvest
    ? (L.defaultBankAccount() || {}).id
    : (invested && invested.id) || '';
  let run = 0;
  const body = lines
    .map((l) => {
      run = L.money(run + l.debit - l.credit);
      return (
        '<tr><td>' +
        esc(l.date) +
        '</td><td>' +
        esc(l.memo) +
        '</td><td>' +
        esc(l.sourceType) +
        '</td><td class="num">' +
        (l.debit ? D.fmt(l.debit) : '') +
        '</td><td class="num">' +
        (l.credit ? D.fmt(l.credit) : '') +
        '</td><td class="num">' +
        D.fmt(run) +
        '</td><td class="actions">' +
        (l.journalId
          ? '<button class="btn ghost" data-edit-bank-jnl="' + esc(l.journalId) + '">Edit</button>'
          : '') +
        '</td></tr>'
      );
    })
    .join('');
  $('viewRoot').innerHTML =
    '<div class="panel"><h2>Account</h2>' +
    '<div class="form-grid"><div><label>Account</label><select id="bankPick">' +
    bankOptions(bank ? bank.id : '') +
    '</select></div>' +
    '<div><label>Ledger balance</label><input value="' +
    (bank ? rm(run) : '') +
    '" readonly></div>' +
    '<div><label>Statement balance (RM)</label><input id="stmtBal" type="number" step="0.01" placeholder="Type the statement total"></div></div>' +
    '<p class="muted" id="reconDiff">' +
    (viewingInvest
      ? 'Parked money stays a company asset. It is not an expense and does not hit the P&amp;L until you record a return.'
      : 'Difference shows after you enter a statement balance.') +
    '</p></div>' +
    '<div class="panel"><h2>Park or withdraw</h2>' +
    '<p class="muted">Move money between Bank Islam and the investment account. This only swaps assets — cash in bank goes down, invested goes up, or the reverse.</p>' +
    '<form id="xferForm" class="form-grid">' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount"></div>' +
    '<div><label>From</label><select name="fromBankId">' +
    bankOptions(bank ? bank.id : '') +
    '</select></div>' +
    '<div><label>To</label><select name="toBankId">' +
    bankOptions(defaultTo) +
    '</select></div>' +
    '<div class="span-2"><label>Memo</label><input type="text" name="memo" placeholder="Park funds in investment"></div>' +
    '</form>' +
    '<div class="btn-row"><button class="btn" id="xferBtn">Transfer</button></div></div>' +
    (viewingInvest
      ? '<div class="panel"><h2>Investment return</h2>' +
        '<p class="muted">When the parked money earns a dividend or profit, record it here. That increases the investment balance and Other income.</p>' +
        '<form id="retForm" class="form-grid">' +
        '<div><label>Date</label><input type="date" name="date" value="' +
        today() +
        '"></div>' +
        '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount"></div>' +
        '<div class="span-2"><label>Memo</label><input type="text" name="memo" value="Investment return"></div>' +
        '</form><div class="btn-row"><button class="btn" id="retBtn">Record return</button></div></div>'
      : '') +
    '<div class="panel"><h2>Owner drawing</h2>' +
    '<form id="drawForm" class="form-grid">' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount"></div>' +
    '<div><label>From</label><select name="bankAccountId">' +
    bankOptions(bank ? bank.id : '') +
    '</select></div>' +
    '<div><label>Memo</label><input type="text" name="memo" value="Owner drawing"></div>' +
    '</form><div class="btn-row"><button class="btn" id="drawBtn">Record drawing</button></div></div>' +
    '<div class="panel"><h2>Register</h2>' +
    (body
      ? '<table class="data-table"><thead><tr><th>Date</th><th>Memo</th><th>Source</th><th class="num">In</th><th class="num">Out</th><th class="num">Balance</th><th></th></tr></thead><tbody>' +
        body +
        '</tbody></table>'
      : '<p class="muted">No movements on this account yet.</p>') +
    '</div>';

  $('bankPick').addEventListener('change', renderBank);
  $('stmtBal').addEventListener('input', () => {
    const stmt = parseFloat($('stmtBal').value) || 0;
    const diff = L.money(stmt - run);
    $('reconDiff').textContent =
      'Statement ' + rm(stmt) + ' vs ledger ' + rm(run) + ' · difference ' + rm(diff);
  });
  $('drawBtn').addEventListener('click', async () => {
    const form = $('drawForm');
    try {
      await L.recordDrawing({
        date: formVal(form, 'date'),
        amount: formVal(form, 'amount'),
        bankAccountId: formVal(form, 'bankAccountId'),
        memo: formVal(form, 'memo'),
      });
      status('Drawing posted. It will not appear on the P&L.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not record drawing.');
    }
  });
  $('xferBtn').addEventListener('click', async () => {
    const form = $('xferForm');
    try {
      await L.recordTransfer({
        date: formVal(form, 'date'),
        amount: formVal(form, 'amount'),
        fromBankId: formVal(form, 'fromBankId'),
        toBankId: formVal(form, 'toBankId'),
        memo: formVal(form, 'memo'),
      });
      status('Transfer posted.');
      await reload();
    } catch (e) {
      status(e.message || 'Could not transfer.');
    }
  });
  if ($('retBtn')) {
    $('retBtn').addEventListener('click', async () => {
      const form = $('retForm');
      try {
        await L.recordInvestmentReturn({
          date: formVal(form, 'date'),
          amount: formVal(form, 'amount'),
          bankAccountId: bank.id,
          memo: formVal(form, 'memo'),
        });
        status('Investment return posted to Other income.');
        await reload();
      } catch (e) {
        status(e.message || 'Could not record return.');
      }
    });
  }
  $('viewRoot').querySelectorAll('[data-edit-bank-jnl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingJournalId = btn.getAttribute('data-edit-bank-jnl');
      window.location.hash = '#journal';
    });
  });
}

function collectJournalLines() {
  const lines = [];
  $('manLines')
    .querySelectorAll('tbody tr')
    .forEach((tr) => {
      const code = tr.querySelector('select').value;
      const debit = tr.querySelector('[data-dr]').value;
      const credit = tr.querySelector('[data-cr]').value;
      if (!code || (!parseFloat(debit) && !parseFloat(credit))) return;
      try {
        lines.push(L.line(code, debit, credit));
      } catch (e) {}
    });
  return lines;
}

function fillJournal(j) {
  const form = $('manForm');
  setForm(form, 'id', j ? j.id : '');
  setForm(form, 'date', j ? j.date : today());
  setForm(form, 'memo', j ? j.memo : '');
  const tbody = $('manLines').querySelector('tbody');
  tbody.innerHTML = '';
  const lines = j && j.lines && j.lines.length ? j.lines : [{}, {}];
  lines.forEach((l) => {
    tbody.insertAdjacentHTML('beforeend', manLine(l.accountCode, l.debit, l.credit));
  });
  $('manTitle').textContent = j ? 'Edit journal' : 'Manual journal';
  $('manBtn').textContent = j ? 'Save changes' : 'Post journal';
}

function renderJournal() {
  const rows = cache.journals
    .slice(0, 80)
    .map((j) => {
      const lines = (j.lines || [])
        .map((l) => esc(l.accountCode) + ' Dr ' + D.fmt(l.debit) + ' Cr ' + D.fmt(l.credit))
        .join('<br>');
      return (
        '<tr><td>' +
        esc(j.date) +
        '</td><td>' +
        esc(j.sourceType) +
        '</td><td>' +
        esc(j.memo) +
        (j.reversedBy ? ' <span class="tag">voided</span>' : '') +
        '</td><td>' +
        lines +
        '</td><td class="actions">' +
        (!j.reversedBy && j.sourceType !== 'void'
          ? '<button class="btn ghost" data-edit-jnl="' +
            esc(j.id) +
            '">Edit</button> <button class="btn danger" data-void="' +
            esc(j.id) +
            '">Void</button>'
          : '') +
        '</td></tr>'
      );
    })
    .join('');
  $('viewRoot').innerHTML =
    '<div class="panel"><h2 id="manTitle">Manual journal</h2>' +
    '<p class="muted">Edit any unlocked journal from the list, or post a new adjustment. Debits must equal credits.</p>' +
    '<form id="manForm" class="form-grid">' +
    '<input type="hidden" name="id" value="">' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div class="span-2"><label>Memo</label><input type="text" name="memo"></div></form>' +
    '<table class="data-table" id="manLines"><thead><tr><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>' +
    manLine() +
    manLine() +
    '</tbody></table>' +
    '<div class="btn-row"><button class="btn ghost" id="addLineBtn">Add line</button>' +
    '<button class="btn" id="manBtn">Post journal</button>' +
    '<button class="btn ghost" id="manNewBtn">New</button></div></div>' +
    '<div class="panel"><h2>Recent journals</h2>' +
    (rows
      ? '<table class="data-table"><thead><tr><th>Date</th><th>Source</th><th>Memo</th><th>Lines</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<p class="muted">No journals yet.</p>') +
    '</div>';

  $('addLineBtn').addEventListener('click', () => {
    $('manLines').querySelector('tbody').insertAdjacentHTML('beforeend', manLine());
  });
  $('manBtn').addEventListener('click', async () => {
    const form = $('manForm');
    const lines = collectJournalLines();
    const id = formVal(form, 'id');
    try {
      if (id) {
        await L.updateJournal(id, {
          date: formVal(form, 'date'),
          memo: formVal(form, 'memo') || 'Manual journal',
          lines,
        });
        status('Journal updated.');
      } else {
        await L.postJournal({
          date: formVal(form, 'date'),
          memo: formVal(form, 'memo') || 'Manual journal',
          sourceType: 'manual',
          sourceId: 'man_' + Date.now(),
          lines,
          allowDuplicate: true,
        });
        status('Journal posted.');
      }
      await reload();
    } catch (e) {
      status(e.message || 'Could not save journal.');
    }
  });
  $('manNewBtn').addEventListener('click', () => fillJournal(null));
  $('viewRoot').querySelectorAll('[data-edit-jnl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const j = cache.journals.find((x) => x.id === btn.getAttribute('data-edit-jnl'));
      if (!j) return;
      fillJournal(j);
      $('manForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  $('viewRoot').querySelectorAll('[data-void]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Void this journal with a reversing entry? Posted source documents are not deleted.')) return;
      try {
        await L.reverseJournal(btn.getAttribute('data-void'), today());
        status('Reversing journal posted.');
        await reload();
      } catch (e) {
        status(e.message || 'Could not void.');
      }
    });
  });
  if (pendingJournalId) {
    const j = cache.journals.find((x) => x.id === pendingJournalId);
    pendingJournalId = '';
    if (j) fillJournal(j);
  }
}

function manLine(code, dr, cr) {
  return (
    '<tr><td><select>' +
    accountOptions(code || '') +
    '</select></td><td><input data-dr type="number" step="0.01" value="' +
    (dr ? esc(dr) : '') +
    '"></td><td><input data-cr type="number" step="0.01" value="' +
    (cr ? esc(cr) : '') +
    '"></td></tr>'
  );
}

/* ---------- Reports ---------- */
function monthRange(ym) {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  const last = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return { from: ym + '-01', to: ym + '-' + pad(last), label: ym };
}

function ytdRange(ym) {
  return { from: ym.slice(0, 4) + '-01-01', to: monthRange(ym).to };
}

function renderReports() {
  const ym = thisMonth();
  $('viewRoot').innerHTML =
    '<div class="form-grid"><div><label>Month</label><input type="month" id="repMonth" value="' +
    ym +
    '"></div></div>' +
    '<div class="report-tabs" id="repTabs">' +
    '<button data-rep="pl" class="is-on">Profit &amp; loss</button>' +
    '<button data-rep="bs">Balance sheet</button>' +
    '<button data-rep="cash">Cash movement</button>' +
    '<button data-rep="aging">AR / AP aging</button>' +
    '<button data-rep="project">Project profitability</button>' +
    '<button data-rep="tax">LHDN tax pack</button>' +
    '</div>' +
    '<div class="btn-row"><button class="btn" id="repPdfBtn">Download PDF</button><button class="btn ghost" id="repPrintBtn">Print</button></div>' +
    '<div class="panel" id="repPreview"></div>';
  let kind = 'pl';
  function paint() {
    const range = monthRange($('repMonth').value || ym);
    const html = reportHtml(kind, range);
    $('repPreview').innerHTML = html;
    $('report-sheet').innerHTML = html;
  }
  $('repTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-rep]');
    if (!btn) return;
    kind = btn.getAttribute('data-rep');
    $('repTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b === btn));
    paint();
  });
  $('repMonth').addEventListener('change', paint);
  $('repPdfBtn').addEventListener('click', () => {
    $('reportPrint').hidden = false;
    D.downloadPdf('report-sheet', D.safeFilename('Ledger', kind + '_' + ($('repMonth').value || ym)));
  });
  $('repPrintBtn').addEventListener('click', () => {
    $('reportPrint').hidden = false;
  });
  paint();
}

function reportHeader(title, range) {
  return (
    '<div class="doc-header"><div><img src="../../assets/logo.png" alt=""><div class="doc-brand-name">' +
    esc(COMPANY.legalName || 'TEAM CHENDAWAN VENTURES') +
    '</div><div class="doc-brand-tag">Sole proprietorship · SSM ' +
    esc(COMPANY.ssmNo || '') +
    '</div></div><div class="doc-title"><div class="big" style="font-size:22px">' +
    title +
    '</div><div class="small">' +
    esc(range.from) +
    ' to ' +
    esc(range.to) +
    '</div></div></div><hr class="rule">'
  );
}

function reportTable(rows) {
  return (
    '<table class="items"><tbody>' +
    rows
      .map((r) => {
        if (r.head) return '<tr class="totals-row"><td colspan="2"><strong>' + r.label + '</strong></td></tr>';
        if (r.total) {
          return (
            '<tr class="totals-row total-due-row"><td class="lab">' +
            r.label +
            '</td><td class="val num">' +
            rm(r.amount) +
            '</td></tr>'
          );
        }
        if (!r.amount && r.hideZero) return '';
        return '<tr><td>' + esc(r.label) + '</td><td class="num">' + rm(r.amount) + '</td></tr>';
      })
      .join('') +
    '</tbody></table>'
  );
}

function plRows(bals, drawingsNet) {
  const income = [];
  const costs = [];
  const overhead = [];
  let inc = 0;
  let cost = 0;
  let ovh = 0;
  Object.keys(bals)
    .sort()
    .forEach((code) => {
      const row = bals[code];
      if (!row.net) return;
      if (row.account.type === 'income') {
        income.push({ label: row.account.name, amount: row.net });
        inc += row.net;
      } else if (row.account.type === 'expense') {
        const item = { label: row.account.name, amount: row.net };
        if (code[0] === '5') {
          costs.push(item);
          cost += row.net;
        } else {
          overhead.push(item);
          ovh += row.net;
        }
      }
    });
  const gp = inc - cost;
  const np = gp - ovh;
  return {
    rows: [{ head: true, label: 'Income' }]
      .concat(income)
      .concat([{ total: true, label: 'Total income', amount: inc }])
      .concat([{ head: true, label: 'Direct costs' }])
      .concat(costs)
      .concat([{ total: true, label: 'Gross profit', amount: gp }])
      .concat([{ head: true, label: 'Overheads' }])
      .concat(overhead)
      .concat([{ total: true, label: 'Net profit / (loss)', amount: np }]),
    income: inc,
    costs: cost,
    overhead: ovh,
    net: np,
    drawings: drawingsNet || 0,
  };
}

function reportHtml(kind, range) {
  const bals = L.balancesFromJournals(cache.journals, { from: range.from, to: range.to });
  const ytd = L.balancesFromJournals(cache.journals, { from: range.from.slice(0, 4) + '-01-01', to: range.to });
  const drawings = (ytd['3100'] && ytd['3100'].net) || 0;
  if (kind === 'pl') {
    const pl = plRows(bals, drawings);
    return reportHeader('PROFIT & LOSS', range) + reportTable(pl.rows);
  }
  if (kind === 'bs') {
    const all = L.balancesFromJournals(cache.journals, { to: range.to });
    const ytdPl = plRows(L.balancesFromJournals(cache.journals, { from: range.to.slice(0, 4) + '-01-01', to: range.to }));
    const rows = [];
    let assets = 0;
    let liab = 0;
    rows.push({ head: true, label: 'Assets' });
    const seenGl = {};
    L.listBankAccounts().forEach((b) => {
      if (seenGl[b.glCode]) return;
      seenGl[b.glCode] = true;
      const n = L.money((all[b.glCode] && all[b.glCode].net) || 0);
      const tag = L.isInvestmentAccount(b) ? ' (invested)' : '';
      rows.push({ label: b.name + tag, amount: n });
      assets += n;
    });
    ['1100'].forEach((c) => {
      const n = (all[c] && all[c].net) || 0;
      if (n) {
        rows.push({ label: all[c].account.name, amount: n });
        assets += n;
      }
    });
    rows.push({ total: true, label: 'Total assets', amount: assets });
    rows.push({ head: true, label: 'Liabilities' });
    Object.keys(all)
      .sort()
      .forEach((code) => {
        const row = all[code];
        if (row.account.type === 'liability' && row.net) {
          rows.push({ label: row.account.name, amount: row.net });
          liab += row.net;
        }
      });
    rows.push({ total: true, label: 'Total liabilities', amount: liab });
    const capital = (all['3000'] && all['3000'].net) || 0;
    const draw = (all['3100'] && all['3100'].net) || 0;
    const equity = capital - draw + ytdPl.net;
    rows.push({ head: true, label: 'Equity' });
    rows.push({ label: 'Opening capital', amount: capital });
    rows.push({ label: 'Owner drawings', amount: -draw });
    rows.push({ label: 'Current earnings', amount: ytdPl.net });
    rows.push({ total: true, label: 'Total equity', amount: equity });
    rows.push({ total: true, label: 'Liabilities + equity', amount: liab + equity });
    return reportHeader('BALANCE SHEET', { from: 'As at', to: range.to }) + reportTable(rows);
  }
  if (kind === 'cash') {
    const rows = [];
    L.listBankAccounts().forEach((b) => {
      rows.push({ head: true, label: b.name + (L.isInvestmentAccount(b) ? ' (invested)' : '') });
      let inAmt = 0;
      let outAmt = 0;
      cache.journals.forEach((j) => {
        if (!L.isLiveJournal(j)) return;
        if (j.date < range.from || j.date > range.to) return;
        (j.lines || []).forEach((l) => {
          if (l.accountCode !== b.glCode) return;
          inAmt += L.money(l.debit);
          outAmt += L.money(l.credit);
        });
      });
      rows.push({ label: 'Cash in', amount: inAmt });
      rows.push({ label: 'Cash out', amount: outAmt });
      rows.push({ total: true, label: 'Net movement', amount: inAmt - outAmt });
    });
    return reportHeader('CASH MOVEMENT', range) + reportTable(rows);
  }
  if (kind === 'aging') {
    const ar = { current: 0, d30: 0, d60: 0, d90: 0 };
    const ap = { current: 0, d30: 0, d60: 0, d90: 0 };
    cache.invoices.forEach((i) => {
      if (!i.balance || i.status === 'void') return;
      ar[L.agingBuckets(i.date, i.dueDate)] += L.money(i.balance);
    });
    cache.bills.forEach((b) => {
      if (!b.balance) return;
      ap[L.agingBuckets(b.date, b.dueDate)] += L.money(b.balance);
    });
    const rows = [
      { head: true, label: 'Accounts receivable' },
      { label: 'Current (0–30)', amount: ar.current },
      { label: '31–60 days', amount: ar.d30 },
      { label: '61–90 days', amount: ar.d60 },
      { label: '90+ days', amount: ar.d90 },
      { total: true, label: 'AR total', amount: ar.current + ar.d30 + ar.d60 + ar.d90 },
      { head: true, label: 'Accounts payable' },
      { label: 'Current (0–30)', amount: ap.current },
      { label: '31–60 days', amount: ap.d30 },
      { label: '61–90 days', amount: ap.d60 },
      { label: '90+ days', amount: ap.d90 },
      { total: true, label: 'AP total', amount: ap.current + ap.d30 + ap.d60 + ap.d90 },
    ];
    return reportHeader('AR / AP AGING', { from: 'As at', to: today() }) + reportTable(rows);
  }
  if (kind === 'project') {
    const projects = window.TCVProjects ? window.TCVProjects.list() : [];
    let html = reportHeader('PROJECT PROFITABILITY', range);
    html +=
      '<table class="items"><thead><tr><th>Project</th><th class="num">Income</th><th class="num">Costs</th><th class="num">Margin</th></tr></thead><tbody>';
    projects.forEach((p) => {
      let inc = 0;
      let cost = 0;
      cache.journals.forEach((j) => {
        if (j.projectId !== p.id || !L.isLiveJournal(j)) return;
        if (j.date < range.from || j.date > range.to) return;
        (j.lines || []).forEach((l) => {
          const acc = L.accountByCode(l.accountCode);
          if (!acc) return;
          if (acc.type === 'income') inc += L.money(l.credit - l.debit);
          if (acc.type === 'expense') cost += L.money(l.debit - l.credit);
        });
      });
      if (!inc && !cost) return;
      html +=
        '<tr><td>' +
        esc(p.name) +
        '</td><td class="num">' +
        rm(inc) +
        '</td><td class="num">' +
        rm(cost) +
        '</td><td class="num">' +
        rm(inc - cost) +
        '</td></tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  const ytdPl = plRows(ytd, drawings);
  const sst = (ytd['2100'] && ytd['2100'].net) || 0;
  const rows = ytdPl.rows.concat([
    { head: true, label: 'Not deductible / not on P&L' },
    { label: 'Owner drawings (not an expense)', amount: drawings },
    { head: true, label: 'SST' },
    {
      label: L.getMeta().sstRegistered ? 'SST payable' : 'SST (unregistered — no SST return)',
      amount: sst,
    },
    { total: true, label: 'Taxable income (P&L net)', amount: ytdPl.net },
  ]);
  return (
    reportHeader('LHDN TAX PACK (Form B worksheet)', ytdRange(range.from.slice(0, 7))) +
    '<p class="muted">Sole proprietorship. Drawings are listed separately and are not deducted as expenses. This is a worksheet, not a filed return.</p>' +
    reportTable(rows)
  );
}

/* ---------- Settings ---------- */
function renderSettings() {
  const accRows = L.listAccounts()
    .map((a) => {
      return (
        '<tr><td>' +
        esc(a.code) +
        '</td><td>' +
        esc(a.name) +
        '</td><td>' +
        esc(a.type) +
        '</td><td class="actions"><button class="btn ghost" data-edit-acc="' +
        esc(a.id) +
        '">Edit</button></td></tr>'
      );
    })
    .join('');
  const bankRows = L.listBankAccounts()
    .map((b) => {
      return (
        '<tr><td>' +
        esc(b.name) +
        '</td><td>' +
        esc(L.isInvestmentAccount(b) ? 'Investment' : 'Operating') +
        '</td><td>' +
        esc(b.accountName || '') +
        '</td><td>' +
        esc(b.accountNo) +
        '</td><td>' +
        esc(b.glCode) +
        '</td><td class="num">' +
        rm(b.openingBalance) +
        '</td><td class="actions"><button class="btn ghost" data-edit-bank="' +
        esc(b.id) +
        '">Edit</button></td></tr>'
      );
    })
    .join('');
  $('viewRoot').innerHTML =
    '<div class="panel"><h2>Lock a month</h2>' +
    '<form id="lockForm" class="form-grid"><div><label>Month</label><input type="month" name="period" value="' +
    thisMonth() +
    '"></div></form>' +
    '<div class="btn-row"><button class="btn" id="lockBtn">Lock month</button><button class="btn ghost" id="unlockBtn">Unlock</button></div>' +
    '<p class="muted">Locked months reject new journals (including invoice and payslip posts).</p></div>' +
    '<div class="panel"><h2>SST</h2>' +
    '<label class="check-row"><input type="checkbox" id="sstRegistered"' +
    (L.getMeta().sstRegistered ? ' checked' : '') +
    '> SST registered</label>' +
    '<p class="muted">Leave off until SSM/SST actually applies. Does not rewrite old invoices. New invoices default to 6% when this is on.</p>' +
    '<div class="btn-row"><button class="btn" id="sstSaveBtn">Save SST setting</button></div></div>' +
    '<div class="panel"><h2>Backup</h2>' +
    '<p class="muted">GitHub Pages has no undo if Firebase is wiped. Export a JSON dump of clients, projects, journals, and related collections. Journals also download as CSV for a spreadsheet. Export only — there is no import.</p>' +
    '<div class="btn-row"><button class="btn" id="backupJsonBtn">Download JSON</button>' +
    '<button class="btn ghost" id="backupCsvBtn">Download journals CSV</button></div></div>' +
    '<div class="panel"><h2>Bank &amp; investment accounts</h2>' +
    '<form id="bankForm" class="form-grid">' +
    '<input type="hidden" name="id" value="">' +
    '<div><label>Name</label><input name="name" placeholder="Bank Islam or Investment account"></div>' +
    '<div><label>Kind</label><select name="kind">' +
    '<option value="operating">Operating bank</option>' +
    '<option value="investment">Investment (park funds)</option>' +
    '</select></div>' +
    '<div><label>Account name</label><input name="accountName" placeholder="Saiful Iqbal"></div>' +
    '<div><label>Account no.</label><input name="accountNo"></div>' +
    '<div><label>GL code</label><select name="glCode">' +
    accountOptions('1000', (a) => a.type === 'asset') +
    '</select></div>' +
    '<div><label>Opening balance (RM)</label><input type="number" step="0.01" name="openingBalance" value="0"></div>' +
    '<div><label>Opening date</label><input type="date" name="openingDate"></div>' +
    '</form><div class="btn-row"><button class="btn" id="bankSaveBtn">Save account</button>' +
    '<button class="btn ghost" id="bankNewBtn">New</button></div>' +
    '<p class="muted">Operating cash uses 1000. Parked money uses 1010 so the dashboard and balance sheet stay separate. Fill in the investment account number when you have it.</p>' +
    (bankRows
      ? '<table class="data-table"><thead><tr><th>Name</th><th>Kind</th><th>Account name</th><th>Account no.</th><th>GL</th><th class="num">Opening</th><th></th></tr></thead><tbody>' +
        bankRows +
        '</tbody></table>'
      : '') +
    '</div>' +
    '<div class="panel"><h2 id="accFormTitle">Chart of accounts</h2>' +
    '<form id="accForm" class="form-grid">' +
    '<input type="hidden" name="id" value="">' +
    '<div><label>Code</label><input name="code" placeholder="6080"></div>' +
    '<div><label>Name</label><input name="name"></div>' +
    '<div><label>Type</label><select name="type">' +
    ['asset', 'liability', 'equity', 'income', 'expense']
      .map((t) => '<option value="' + t + '">' + t + '</option>')
      .join('') +
    '</select></div></form>' +
    '<div class="btn-row"><button class="btn" id="accBtn">Save account</button>' +
    '<button class="btn ghost" id="accNewBtn">New</button></div>' +
    '<table class="data-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th></th></tr></thead><tbody>' +
    accRows +
    '</tbody></table></div>' +
    '<div class="panel"><h2>Opening balance journal</h2>' +
    '<p class="muted">Posts to the account against Opening capital. Use for AR/AP brought forward.</p>' +
    '<form id="openForm" class="form-grid">' +
    '<div><label>Date</label><input type="date" name="date" value="' +
    today() +
    '"></div>' +
    '<div><label>Account</label><select name="accountCode">' +
    accountOptions('1100') +
    '</select></div>' +
    '<div><label>Amount (RM)</label><input type="number" step="0.01" name="amount"></div>' +
    '</form><div class="btn-row"><button class="btn" id="openBtn">Post opening</button></div></div>';

  $('lockBtn').addEventListener('click', async () => {
    try {
      await L.setPeriodLocked(formVal($('lockForm'), 'period'), true);
      status('Month locked.');
    } catch (e) {
      status(e.message);
    }
  });
  $('unlockBtn').addEventListener('click', async () => {
    try {
      await L.setPeriodLocked(formVal($('lockForm'), 'period'), false);
      status('Month unlocked.');
    } catch (e) {
      status(e.message);
    }
  });
  $('sstSaveBtn').addEventListener('click', async () => {
    try {
      await L.saveMeta({ sstRegistered: !!$('sstRegistered').checked });
      status(
        L.getMeta().sstRegistered
          ? 'SST registered. New invoices default to 6%.'
          : 'SST left unregistered. New invoices default to 0%.'
      );
    } catch (e) {
      status(e.message);
    }
  });
  $('backupJsonBtn').addEventListener('click', async () => {
    try {
      status('Preparing backup…');
      const data = await L.exportBackup();
      const day = today();
      D.downloadBlob('tcv-backup-' + day + '.json', JSON.stringify(data, null, 2), 'application/json');
      status('JSON backup downloaded.');
    } catch (e) {
      status(e.message || 'Could not export backup.');
    }
  });
  $('backupCsvBtn').addEventListener('click', async () => {
    try {
      status('Preparing journals CSV…');
      const journals = await L.listJournals();
      D.downloadBlob('tcv-journals-' + today() + '.csv', L.journalsCsv(journals), 'text/csv');
      status('Journals CSV downloaded.');
    } catch (e) {
      status(e.message || 'Could not export journals.');
    }
  });
  $('bankSaveBtn').addEventListener('click', async () => {
    const form = $('bankForm');
    try {
      await L.upsertBankAccount({
        id: formVal(form, 'id') || undefined,
        name: formVal(form, 'name'),
        kind: formVal(form, 'kind'),
        accountName: formVal(form, 'accountName'),
        accountNo: formVal(form, 'accountNo'),
        glCode: formVal(form, 'glCode'),
        openingBalance: formVal(form, 'openingBalance'),
        openingDate: formVal(form, 'openingDate'),
      });
      status('Account saved.');
      await reload();
    } catch (e) {
      status(e.message);
    }
  });
  $('bankNewBtn').addEventListener('click', () => {
    const form = $('bankForm');
    setForm(form, 'id', '');
    setForm(form, 'name', '');
    setForm(form, 'kind', 'operating');
    setForm(form, 'accountName', '');
    setForm(form, 'accountNo', '');
    setForm(form, 'glCode', '1000');
    setForm(form, 'openingBalance', 0);
    setForm(form, 'openingDate', '');
  });
  const kindEl = $('bankForm').querySelector('[name="kind"]');
  if (kindEl) {
    kindEl.addEventListener('change', () => {
      const form = $('bankForm');
      if (formVal(form, 'kind') === 'investment' && !formVal(form, 'id')) {
        setForm(form, 'glCode', '1010');
        if (!formVal(form, 'name')) setForm(form, 'name', 'Investment account');
      }
    });
  }
  $('viewRoot').querySelectorAll('[data-edit-bank]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = L.listBankAccounts().find((x) => x.id === btn.getAttribute('data-edit-bank'));
      if (!b) return;
      const form = $('bankForm');
      setForm(form, 'id', b.id);
      setForm(form, 'name', b.name);
      setForm(form, 'kind', L.isInvestmentAccount(b) ? 'investment' : 'operating');
      setForm(form, 'accountName', b.accountName);
      setForm(form, 'accountNo', b.accountNo);
      setForm(form, 'glCode', b.glCode);
      setForm(form, 'openingBalance', b.openingBalance);
      setForm(form, 'openingDate', b.openingDate);
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  $('accBtn').addEventListener('click', async () => {
    const form = $('accForm');
    try {
      await L.upsertAccount({
        id: formVal(form, 'id') || undefined,
        code: formVal(form, 'code'),
        name: formVal(form, 'name'),
        type: formVal(form, 'type'),
      });
      status('Account saved.');
      await reload();
    } catch (e) {
      status(e.message);
    }
  });
  $('accNewBtn').addEventListener('click', () => {
    const form = $('accForm');
    setForm(form, 'id', '');
    setForm(form, 'code', '');
    setForm(form, 'name', '');
    $('accFormTitle').textContent = 'Chart of accounts';
    $('accBtn').textContent = 'Save account';
  });
  $('viewRoot').querySelectorAll('[data-edit-acc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = L.listAccounts().find((x) => x.id === btn.getAttribute('data-edit-acc'));
      if (!a) return;
      const form = $('accForm');
      setForm(form, 'id', a.id);
      setForm(form, 'code', a.code);
      setForm(form, 'name', a.name);
      setForm(form, 'type', a.type);
      $('accFormTitle').textContent = 'Edit account';
      $('accBtn').textContent = 'Save changes';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  $('openBtn').addEventListener('click', async () => {
    const form = $('openForm');
    try {
      await L.recordOpening({
        date: formVal(form, 'date'),
        accountCode: formVal(form, 'accountCode'),
        amount: formVal(form, 'amount'),
      });
      status('Opening journal posted.');
      await reload();
    } catch (e) {
      status(e.message);
    }
  });
}

const RENDER = {
  dashboard: renderDashboard,
  sales: renderSales,
  purchases: renderPurchases,
  pay: renderPay,
  expenses: renderExpenses,
  bank: renderBank,
  journal: renderJournal,
  reports: renderReports,
  settings: renderSettings,
};

async function reload() {
  await refreshData();
  const view = currentView();
  setNav(view);
  RENDER[view]();
}

document.addEventListener('DOMContentLoaded', () => {
  const start = window.TCVFirebase.afterAuth
    ? window.TCVFirebase.afterAuth()
    : Promise.resolve();
  start
    .then(() => reload())
    .catch((err) => {
      D.setStatus((err && err.message) || 'Could not load the ledger.');
    });
  window.addEventListener('hashchange', () => {
    const view = currentView();
    setNav(view);
    RENDER[view]();
  });
});
