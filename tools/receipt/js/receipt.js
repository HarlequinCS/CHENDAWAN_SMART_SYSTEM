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

  g('pv-clientName').textContent = val('clientName') || '[Client company name]';
  g('pv-clientName').className = val('clientName') ? 'name' : 'name empty-ph';
  g('pv-clientAttn').textContent = val('clientAttn');

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
    'clientName',
    'clientAttn',
    'receiptNo',
    'receiptDate',
    'refInvoice',
    'projName',
    'projFor',
    'amount',
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
  (state.notes || []).forEach((n) => addNote(n));
  renderPreview();
}

function defaultState() {
  const c = D.companyDefaults();
  return {
    fields: {
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

document.addEventListener('DOMContentLoaded', () => {
  D.bindLivePreview(renderPreview);
  D.bindDraftActions({ storageKey: STORAGE_KEY, collectState, applyState, defaultState });

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
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const no = document.getElementById('receiptNo').value.trim() || 'receipt';
    D.downloadPdf('receipt-sheet', D.safeFilename('Receipt', no));
  });
  applyState(defaultState());
});
