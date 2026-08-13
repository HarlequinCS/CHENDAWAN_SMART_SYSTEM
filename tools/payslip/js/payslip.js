const STORAGE_KEY = 'chendawan_payslip_draft_v1';
const D = window.TCVDoc;
const COMPANY = window.TCV_COMPANY || {};

function g(id) {
  return document.getElementById(id);
}

function val(id) {
  const el = g(id);
  return el ? el.value.trim() : '';
}

function num(id) {
  return parseFloat((g(id) && g(id).value) || 0) || 0;
}

function isEmployee() {
  return val('workerKind') === 'employee';
}

function money(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

function totals() {
  const gross = money(num('earnBasic') + num('earnAllow') + num('earnOt') + num('earnBonus') + num('earnOther'));
  let deductions;
  if (isEmployee()) {
    deductions = money(num('dedEpf') + num('dedSocso') + num('dedEis') + num('dedPcb') + num('dedOther'));
  } else {
    deductions = money(num('dedOtherAlt'));
  }
  return { gross, deductions, net: money(gross - deductions) };
}

function applyWorkerUi() {
  const emp = isEmployee();
  g('deductWrap').hidden = !emp;
  g('employerWrap').hidden = !emp;
  g('otherDedWrap').hidden = emp;
  g('basicLabel').textContent = emp ? 'Basic salary (RM)' : 'Fees (RM)';
  const t = totals();
  g('grossHint').textContent = 'Gross: RM ' + D.fmt(t.gross);
  g('netHint').textContent = 'Net pay: RM ' + D.fmt(t.net);
  g('netHintAlt').textContent = 'Net pay: RM ' + D.fmt(t.net);
}

function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const mi = parseInt(m, 10) - 1;
  return months[mi] ? months[mi] + ' ' + y : ym;
}

function firstLastOfMonth(ym) {
  if (!ym) return { from: '', to: '' };
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  const last = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: y + '-' + pad(m) + '-01',
    to: y + '-' + pad(m) + '-' + pad(last),
  };
}

function earnRows() {
  const emp = isEmployee();
  return [
    { label: emp ? 'Basic salary' : 'Fees', amount: num('earnBasic') },
    { label: 'Allowance', amount: num('earnAllow') },
    { label: 'Overtime', amount: num('earnOt') },
    { label: 'Bonus', amount: num('earnBonus') },
    { label: 'Other earnings', amount: num('earnOther') },
  ].filter((r) => r.amount);
}

function dedRows() {
  if (!isEmployee()) {
    const other = num('dedOtherAlt');
    return other ? [{ label: 'Other deductions', amount: other }] : [];
  }
  return [
    { label: 'EPF (employee)', amount: num('dedEpf') },
    { label: 'SOCSO (employee)', amount: num('dedSocso') },
    { label: 'EIS (employee)', amount: num('dedEis') },
    { label: 'PCB / tax', amount: num('dedPcb') },
    { label: 'Other deductions', amount: num('dedOther') },
  ].filter((r) => r.amount);
}

function fillTable(tbodyId, rows) {
  const body = g(tbodyId);
  body.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>—</td><td class="num">0.00</td>';
    body.appendChild(tr);
    return;
  }
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + r.label + '</td><td class="num">' + D.fmt(r.amount) + '</td>';
    body.appendChild(tr);
  });
}

function renderPreview() {
  applyWorkerUi();
  const emp = isEmployee();
  const t = totals();

  g('pv-companyName').textContent = COMPANY.legalName || 'TEAM CHENDAWAN VENTURES';
  g('pv-companyTag').textContent = COMPANY.tagline || '';
  g('pv-companyShort').textContent = COMPANY.shortName || '';
  g('pv-docTitle').textContent = emp ? 'PAYSLIP' : 'PAYMENT ADVICE';
  g('pv-payeeEyebrow').textContent = emp ? 'EMPLOYEE' : 'PAYEE';
  g('pv-workerName').textContent = val('workerName') || '[Select a worker]';
  g('pv-workerName').className = val('workerName') ? 'name' : 'name empty-ph';
  g('pv-workerIdLine').textContent = val('workerEmployeeId') ? 'Employee ID: ' + val('workerEmployeeId') : '';
  g('pv-workerNric').textContent = val('workerNric') ? 'NRIC No. ' + val('workerNric') : '';
  g('pv-workerPosition').textContent = val('workerPosition') || '';

  g('pv-pslNo').textContent = val('pslNo') || '—';
  g('pv-month').textContent = monthLabel(val('payMonth')) || '—';
  const from = D.formatDate(val('periodFrom'));
  const to = D.formatDate(val('periodTo'));
  g('pv-period').textContent = from && to ? from + ' – ' + to : '—';
  g('pv-payDate').textContent = D.formatDate(val('payDate')) || '—';
  g('pv-projName').textContent = val('projName') || (window.TCVProjects && window.TCVProjects.get(val('projectId'))
    ? window.TCVProjects.get(val('projectId')).name
    : '—');

  fillTable('pv-earnBody', earnRows());
  fillTable('pv-dedBody', dedRows());
  g('pv-gross').textContent = 'RM ' + D.fmt(t.gross);
  g('pv-dedTotal').textContent = 'RM ' + D.fmt(t.deductions);
  g('pv-netLabel').textContent = emp ? 'NET PAY' : 'AMOUNT PAYABLE';
  g('pv-net').textContent = 'RM ' + D.fmt(t.net);

  g('pv-employerBlock').hidden = !emp;
  g('pv-erEpf').textContent = 'RM ' + D.fmt(num('erEpf'));
  g('pv-erSocso').textContent = 'RM ' + D.fmt(num('erSocso'));
  g('pv-erEis').textContent = 'RM ' + D.fmt(num('erEis'));
  g('pv-erHrdf').textContent = 'RM ' + D.fmt(num('erHrdf'));

  g('pv-bankName').textContent = val('workerBankName') || '—';
  g('pv-bankAcc').textContent = val('workerBankAcc') || '—';
  g('pv-notes').textContent = val('notes') || '';

  g('pv-thanks').textContent = emp
    ? 'This payslip is issued by TEAM CHENDAWAN VENTURES for record purposes.'
    : 'This payment advice is issued by TEAM CHENDAWAN VENTURES. It is not a payslip and does not create an employment relationship.';
  const c = D.companyDefaults();
  g('pv-prepName').textContent = c.prepName || '';
  g('pv-prepTitle').textContent = c.prepTitle || '';
  g('pv-prepContact').textContent = COMPANY.contactLine || (COMPANY.phone + '  |  ' + COMPANY.email);
  g('pv-ssmNo').textContent = c.ssmNo ? 'SSM Registration No.: ' + c.ssmNo : '';
}

function collectState() {
  const fieldIds = [
    'workerId',
    'workerName',
    'workerNric',
    'workerPosition',
    'workerEmployeeId',
    'workerBankName',
    'workerBankAcc',
    'workerKind',
    'projectId',
    'docYear',
    'serviceCode',
    'jobNo',
    'issueNo',
    'pslNo',
    'payMonth',
    'periodFrom',
    'periodTo',
    'payDate',
    'earnBasic',
    'earnAllow',
    'earnOt',
    'earnBonus',
    'earnOther',
    'dedEpf',
    'dedSocso',
    'dedEis',
    'dedPcb',
    'dedOther',
    'dedOtherAlt',
    'erEpf',
    'erSocso',
    'erEis',
    'erHrdf',
    'bankAccountId',
    'notes',
    'projName',
  ];
  const fields = {};
  fieldIds.forEach((id) => {
    const el = g(id);
    if (el) fields[id] = el.value;
  });
  const t = totals();
  return {
    fields,
    paidNow: g('paidNow').checked,
    totals: t,
    isEmployee: isEmployee(),
  };
}

function applyState(state) {
  Object.keys(state.fields || {}).forEach((id) => {
    const el = g(id);
    if (el) el.value = state.fields[id];
  });
  if (typeof state.paidNow === 'boolean') g('paidNow').checked = state.paidNow;
  if (window.TCVWorkers) window.TCVWorkers.syncSelected();
  if (window.TCVProjects) window.TCVProjects.syncSelected();
  if (numbering) numbering.refresh();
  else renderPreview();
}

function defaultState() {
  const N = window.TCVNumbers;
  const today = N.isoToday();
  const ym = today.slice(0, 7);
  const range = firstLastOfMonth(ym);
  return {
    fields: {
      workerId: '',
      projectId: '',
      serviceCode: '',
      jobNo: String(N.peekNextJob()),
      issueNo: '1',
      pslNo: '',
      payMonth: ym,
      periodFrom: range.from,
      periodTo: range.to,
      payDate: today,
      earnBasic: '0',
      earnAllow: '0',
      earnOt: '0',
      earnBonus: '0',
      earnOther: '0',
      dedEpf: '0',
      dedSocso: '0',
      dedEis: '0',
      dedPcb: '0',
      dedOther: '0',
      dedOtherAlt: '0',
      erEpf: '0',
      erSocso: '0',
      erEis: '0',
      erHrdf: '0',
      bankAccountId: '',
      notes: '',
    },
    paidNow: true,
  };
}

async function fillBankSelect() {
  const sel = g('bankAccountId');
  if (!sel || !window.TCVLedger) return;
  try {
    await window.TCVLedger.ensureSeeded();
    const banks = window.TCVLedger.listBankAccounts();
    const current = sel.value;
    const def = window.TCVLedger.defaultBankAccount();
    sel.innerHTML = '<option value="">Default bank</option>';
    banks.forEach((b) => {
      sel.innerHTML +=
        '<option value="' +
        b.id +
        '"' +
        (b.id === current ? ' selected' : '') +
        '>' +
        (b.name || 'Bank') +
        (b.accountNo ? ' · ' + b.accountNo : '') +
        '</option>';
    });
    if (current) sel.value = current;
    else if (def) sel.value = def.id;
  } catch (e) {}
}

let numbering;

document.addEventListener('DOMContentLoaded', () => {
  const start = window.TCVFirebase && window.TCVFirebase.afterAuth
    ? window.TCVFirebase.afterAuth()
    : Promise.resolve();
  start
    .then(() => {
      D.bindLivePreview(renderPreview);
      if (window.TCVWorkers) {
        window.TCVWorkers.bindPicker({
          onChange: () => {
            if (numbering) numbering.refresh();
            else renderPreview();
          },
          emptyHint: 'No worker selected. <a href="../../tools/workforce/">Register a worker</a> first.',
        });
      }
      D.bindDraftActions({ storageKey: STORAGE_KEY, collectState, applyState, defaultState });
      numbering = window.TCVNumbers.bind({
        prefix: window.TCVNumbers.PREFIX.payslip,
        noId: 'pslNo',
        serviceId: 'serviceCode',
        jobId: 'jobNo',
        issueId: 'issueNo',
        hintId: 'pslNoHint',
        onChange: renderPreview,
      });
      if (window.TCVProjects) {
        window.TCVProjects.bindPicker({
          prefix: window.TCVNumbers.PREFIX.payslip,
          clientSelectId: null,
          onChange: () => {
            if (numbering) numbering.refresh();
            else renderPreview();
          },
        });
      }
      g('payMonth').addEventListener('change', () => {
        const range = firstLastOfMonth(val('payMonth'));
        if (range.from) g('periodFrom').value = range.from;
        if (range.to) g('periodTo').value = range.to;
        renderPreview();
      });
      g('downloadBtn').addEventListener('click', async () => {
        if (!val('workerId')) {
          D.setStatus('Select a worker first.');
          return;
        }
        try {
          await window.TCVFirebase.commitDocument({
            type: window.TCVNumbers.PREFIX.payslip,
            noId: 'pslNo',
            collectState,
          });
          if (window.TCVProjects) await window.TCVProjects.refresh();
          renderPreview();
        } catch (e) {
          D.setStatus(e.message || 'Could not save document.');
          return;
        }
        const no = val('pslNo') || 'payslip';
        const emp = isEmployee();
        D.downloadPdf('payslip-sheet', D.safeFilename(emp ? 'Payslip' : 'PaymentAdvice', no));
      });
      applyState(defaultState());
      numbering.refresh();
      return fillBankSelect();
    })
    .catch(() => {});
});
