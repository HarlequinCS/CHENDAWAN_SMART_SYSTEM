const STORAGE_KEY = 'chendawan_receipt_draft_v1';
const D = window.TCVDoc;
const COMPANY = window.TCV_COMPANY || {};

let noteCount = 0;
let wordsManual = false;

function addNote(text) {
  noteCount++;
  const div = document.createElement('div');
  div.className = 'note-item';
  div.innerHTML = `
    <textarea class="note-text" placeholder="Add a note...">${text || ''}</textarea>
    <button type="button" title="Remove">&times;</button>
  `;
  document.getElementById('notesContainer').appendChild(div);
  div.querySelector('textarea').addEventListener('input', renderPreview);
  div.querySelector('button').addEventListener('click', () => {
    div.remove();
    renderPreview();
  });
  renderPreview();
}

function renderPreview() {
  const g = (id) => document.getElementById(id);
  const val = (id) => (g(id) ? g(id).value.trim() : '');

  g('pv-companyName').textContent = COMPANY.legalName || 'TEAM CHENDAWAN VENTURES';
  g('pv-companyTag').textContent = COMPANY.tagline || '';
  g('pv-companyShort').textContent = COMPANY.shortName || '';

  g('pv-clientName').textContent = val('clientName') || '[Select a client]';
  g('pv-clientName').className = val('clientName') ? 'name' : 'name empty-ph';
  g('pv-clientAttn').textContent = val('clientAttn');
  if (g('pv-clientAddr')) g('pv-clientAddr').textContent = val('clientAddr');
  if (g('pv-clientReg')) {
    const reg = val('clientReg');
    const type = val('clientType');
    g('pv-clientReg').textContent = reg
      ? (type === 'individual' ? 'NRIC No. ' : 'Registration No. ') + reg
      : '';
  }

  g('pv-receiptNo').textContent = val('receiptNo') || '—';
  g('pv-receiptDate').textContent = D.formatDate(val('receiptDate')) || '—';
  g('pv-refInvoice').textContent = val('refInvoice') || '—';
  g('pv-projName').textContent = val('projName') || '—';
  g('pv-projFor').textContent = val('projFor') || '—';

  const amount = parseFloat(g('amount').value) || 0;
  g('pv-amount').textContent = 'RM ' + D.fmt(amount);
  g('pv-payMethod').textContent = val('payMethod') || '—';
  g('pv-payRef').textContent = val('payRef') || '—';
  g('pv-amountWords').textContent = val('amountWords') || '—';
  g('pv-outstanding').textContent = val('outstanding') || '—';
  g('pv-ackNote').textContent = val('ackNote') || '—';

  g('pv-prepName').textContent = val('prepName') || '—';
  g('pv-prepTitle').textContent = val('prepTitle') || '';
  g('pv-prepContact').textContent = val('prepContact') || '';
  g('pv-ssmNo').textContent = val('ssmNo') ? 'SSM Registration No.: ' + val('ssmNo') : '';

  const notesList = g('pv-notesList');
  notesList.innerHTML = '';
  document.querySelectorAll('.note-text').forEach((t) => {
    const text = t.value.trim();
    if (text) {
      const li = document.createElement('li');
      li.textContent = text;
      notesList.appendChild(li);
    }
  });
}

function collectState() {
  const notes = [];
  document.querySelectorAll('.note-text').forEach((t) => notes.push(t.value));
  const fieldIds = [
    'clientId',
    'projectId',
    'docYear',
    'clientName',
    'clientAttn',
    'clientAddr',
    'clientReg',
    'clientType',
    'serviceCode',
    'jobNo',
    'issueNo',
    'receiptNo',
    'receiptDate',
    'refInvoice',
    'projName',
    'projFor',
    'amount',
    'bankAccountId',
    'payMethod',
    'payRef',
    'amountWords',
    'outstanding',
    'ackNote',
    'prepName',
    'prepTitle',
    'prepContact',
    'ssmNo',
  ];
  const fields = {};
  fieldIds.forEach((id) => (fields[id] = document.getElementById(id).value));
  return { fields, notes, wordsManual };
}

function applyState(state) {
  document.getElementById('notesContainer').innerHTML = '';
  noteCount = 0;
  wordsManual = !!state.wordsManual;
  Object.keys(state.fields || {}).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = state.fields[id];
  });
  if (window.TCVClients) window.TCVClients.syncSelected();
  if (window.TCVProjects) window.TCVProjects.syncSelected();
  (state.notes || []).forEach((n) => addNote(n));
  if (numbering) numbering.refresh();
  else renderPreview();
  refreshRefSelect();
}

async function refreshRefSelect() {
  let invoices = [];
  if (window.TCVLedger && window.TCVLedger.listInvoices) {
    try {
      invoices = await window.TCVLedger.listInvoices();
    } catch (e) {}
  }
  const projectId = (document.getElementById('projectId') || {}).value || '';
  const rows = await D.fillIssuedSelect({
    selectId: 'refInvoice',
    types: ['INV'],
    needProjectLabel: 'Select a project first',
    emptyLabel: 'Issued invoices…',
    noneLabel: 'No invoices issued yet',
    labelFn: function (d) {
      const row = invoices.find((i) => i.number === d.number || i.id === d.id);
      const bal = row ? Math.round((parseFloat(row.balance) || 0) * 100) / 100 : null;
      return (d.number || 'INV') + (bal == null ? '' : '  ·  RM ' + D.fmt(bal) + ' remaining');
    },
  });
  const pick = document.getElementById('refInvoicePick');
  if (!pick || !projectId) return;
  const seen = {};
  Array.prototype.forEach.call(pick.options, (o) => {
    if (o.value) seen[o.value] = true;
  });
  let added = 0;
  invoices.forEach((row) => {
    if (!row.number || seen[row.number] || row.projectId !== projectId) return;
    const opt = document.createElement('option');
    opt.value = row.number;
    const bal = Math.round((parseFloat(row.balance) || 0) * 100) / 100;
    opt.textContent = row.number + '  ·  RM ' + D.fmt(bal) + ' remaining';
    pick.appendChild(opt);
    seen[row.number] = true;
    added++;
  });
  if (((rows && rows.length) || added) && pick.options[0] && !pick.options[0].value) {
    pick.options[0].textContent = 'Issued invoices…';
  }
}

async function fillFromInvoice(docId, number) {
  const setIf = (id, v) => {
    const el = document.getElementById(id);
    if (el && v) el.value = v;
  };
  let fields = {};
  let invNumber = String(number || '').trim();
  if (docId && window.TCVFirebase) {
    const doc = await window.TCVFirebase.getDocument(docId);
    if (doc && doc.type === 'INV') {
      fields = (doc.payload && doc.payload.fields) || {};
      invNumber = doc.number || invNumber;
      setIf('projName', fields.projName);
      setIf('projFor', fields.projStage);
    }
  }
  let remaining = parseFloat(fields.amount);
  if (window.TCVLedger && window.TCVLedger.findInvoiceByNumber && invNumber) {
    const inv = await window.TCVLedger.findInvoiceByNumber(invNumber);
    if (inv) remaining = parseFloat(inv.balance);
  }
  if (!isNaN(remaining) && remaining >= 0) {
    const amt = document.getElementById('amount');
    if (amt) amt.value = remaining.toFixed(2);
    const words = document.getElementById('amountWords');
    if (words) words.value = D.amountInWords(remaining);
    const out = document.getElementById('outstanding');
    if (out) out.value = remaining ? 'RM ' + D.fmt(remaining) : 'Nil / Paid in Full';
  }
  renderPreview();
}

function defaultState() {
  const c = D.companyDefaults();
  const N = window.TCVNumbers;
  return {
    fields: {
      serviceCode: '',
      jobNo: '',
      issueNo: '1',
      receiptNo: '',
      receiptDate: N.isoToday(),
      payMethod: c.bankMethod,
      prepName: c.prepName,
      prepTitle: c.prepTitle,
      prepContact: c.prepContact,
      ssmNo: c.ssmNo,
      outstanding: 'Nil / Paid in Full',
      ackNote:
        'This receipt confirms receipt of the payment for the above project. The remaining balance, if any, will be invoiced upon completion of subsequent milestones.',
    },
    notes: [
      'This receipt is issued as proof of payment and does not replace the original invoice or quotation.',
    ],
    wordsManual: false,
  };
}

let numbering;
let issueGate;

document.addEventListener('DOMContentLoaded', () => {
  const start = window.TCVFirebase && window.TCVFirebase.afterAuth
    ? window.TCVFirebase.afterAuth()
    : Promise.resolve();
  start
    .then(() => {
      issueGate = D.createIssueGate({
        onReset: () => {
          if (numbering) numbering.lockIssued(false);
        },
      });
      D.bindLivePreview(renderPreview);
      if (window.TCVClients) {
        window.TCVClients.bindPicker({
          onChange: () => {
            if (numbering) numbering.refresh();
            else renderPreview();
          },
        });
      }
      D.bindDraftActions({ storageKey: STORAGE_KEY, collectState, applyState, defaultState, issueGate: issueGate });

      numbering = window.TCVNumbers.bind({
        prefix: window.TCVNumbers.PREFIX.receipt,
        noId: 'receiptNo',
        serviceId: 'serviceCode',
        jobId: 'jobNo',
        issueId: 'issueNo',
        relatedId: 'refInvoice',
        nextBtnId: 'nextJobBtn',
        hintId: 'receiptNoHint',
        onChange: renderPreview,
      });
      if (window.TCVProjects) {
        window.TCVProjects.bindPicker({
          prefix: window.TCVNumbers.PREFIX.receipt,
          onChange: () => {
            refreshRefSelect();
            if (numbering) numbering.refresh();
            else renderPreview();
          },
        });
      }
      if (window.TCVLedger) {
        window.TCVLedger.ensureSeeded().then(() => {
          refreshRefSelect();
          const sel = document.getElementById('bankAccountId');
          if (!sel) return;
          const banks = window.TCVLedger.listBankAccounts();
          const def = window.TCVLedger.defaultBankAccount();
          sel.innerHTML = '<option value="">Default bank</option>';
          banks.forEach((b) => {
            sel.innerHTML +=
              '<option value="' +
              b.id +
              '">' +
              (b.name || 'Bank') +
              (b.accountNo ? ' · ' + b.accountNo : '') +
              '</option>';
          });
          if (def) sel.value = def.id;
        });
      }

      document.getElementById('amount').addEventListener('input', () => {
        if (!wordsManual) {
          const n = parseFloat(document.getElementById('amount').value) || 0;
          document.getElementById('amountWords').value = D.amountInWords(n);
        }
        renderPreview();
      });
      document.getElementById('amountWords').addEventListener('input', () => {
        wordsManual = true;
      });

      document.getElementById('addNoteBtn').addEventListener('click', () => addNote());
      document.getElementById('refInvoice').addEventListener('change', () => {
        const docId = D.selectedIssuedId('refInvoice');
        const number = document.getElementById('refInvoice').value.trim();
        if (docId || number) {
          fillFromInvoice(docId, number).catch((e) => {
            D.setStatus(e.message || 'Could not load that invoice.');
          });
        } else if (numbering) numbering.refresh();
        else renderPreview();
      });
      document.getElementById('downloadBtn').addEventListener('click', async () => {
        try {
          const decision = await issueGate.beforeDownload({
            fingerprint: collectState,
            commit: () =>
              window.TCVFirebase.commitDocument({
                type: window.TCVNumbers.PREFIX.receipt,
                noId: 'receiptNo',
                collectState,
              }),
          });
          if (decision.cancelled) return;
          if (!decision.reused && window.TCVProjects) await window.TCVProjects.refresh();
          renderPreview();
        } catch (e) {
          D.setStatus(e.message || 'Could not save document.');
          return;
        }
        const no = document.getElementById('receiptNo').value.trim() || 'receipt';
        D.downloadPdf('receipt-sheet', D.safeFilename('Receipt', no));
      });
      return D.loadIssuedIfPresent({
        prefix: window.TCVNumbers.PREFIX.receipt,
        applyState: applyState,
        numbering: numbering,
        issueGate: issueGate,
        noId: 'receiptNo',
        fingerprint: collectState,
      }).then((doc) => {
        if (!doc) {
          applyState(defaultState());
          numbering.refresh();
        }
      });
    })
    .catch(() => {});
});
