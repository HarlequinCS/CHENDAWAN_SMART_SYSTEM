const STORAGE_KEY = 'chendawan_invoice_draft_v2';
const D = window.TCVDoc;
const COMPANY = window.TCV_COMPANY || {};

let itemCount = 0;
let noteCount = 0;

function makeItemBlock(id, data) {
  data = data || {};
  const div = document.createElement('div');
  div.className = 'item-block';
  div.dataset.id = id;
  div.innerHTML = `
    <button type="button" class="remove-btn" data-remove="${id}">Remove</button>
    <label class="first">Service code</label>
    <select class="it-code">${window.tcvServiceOptionsHtml(data.code || '')}</select>
    <label>Description</label>
    <input type="text" class="it-desc" value="${data.desc || ''}" placeholder="e.g. Phase A: Comprehensive Development">
    <label>Sub-description</label>
    <textarea class="it-sub" placeholder="brief detail of the work covered">${data.sub || ''}</textarea>
    <div class="row3">
      <div><label>Qty label</label><input type="text" class="it-qty" value="${data.qty || '1'}" placeholder="1 Module"></div>
      <div><label>Unit price (RM)</label><input type="number" class="it-price" value="${data.price != null ? data.price : ''}" step="0.01" placeholder="0.00"></div>
      <div><label>Amount (RM)</label><input type="number" class="it-amount" value="${data.amount != null ? data.amount : ''}" step="0.01" placeholder="0.00"></div>
    </div>
  `;
  return div;
}

function addItem(data) {
  itemCount++;
  const id = 'item' + itemCount;
  const primary = (document.getElementById('serviceCode') || {}).value || '';
  const seeded = data || { code: primary, desc: '', sub: '', qty: '1', price: '', amount: '' };
  if (!seeded.code && primary) seeded.code = primary;
  const block = makeItemBlock(id, seeded);
  document.getElementById('itemsContainer').appendChild(block);
  attachItemListeners(block);
  if (seeded.code && !seeded.desc) {
    const svc = window.tcvFindService(seeded.code);
    const descInput = block.querySelector('.it-desc');
    if (svc && descInput && !descInput.value.trim()) descInput.value = svc.name;
  }
  renderPreview();
}

function attachItemListeners(block) {
  const codeSel = block.querySelector('.it-code');
  const descInput = block.querySelector('.it-desc');
  codeSel.addEventListener('change', () => {
    const svc = window.tcvFindService(codeSel.value);
    if (svc && !descInput.value.trim()) descInput.value = svc.name;
    renderPreview();
  });
  block.querySelectorAll('input,textarea,select').forEach((el) => {
    el.addEventListener('input', renderPreview);
  });
  block.querySelector('[data-remove]').addEventListener('click', () => {
    block.remove();
    renderPreview();
  });
}

function makeNoteRow(id, text) {
  const div = document.createElement('div');
  div.className = 'note-item';
  div.dataset.id = id;
  div.innerHTML = `
    <textarea class="note-text" placeholder="Add a note...">${text || ''}</textarea>
    <button type="button" data-remove="${id}" title="Remove">&times;</button>
  `;
  return div;
}

function addNote(text) {
  noteCount++;
  const id = 'note' + noteCount;
  const row = makeNoteRow(id, text);
  document.getElementById('notesContainer').appendChild(row);
  row.querySelector('textarea').addEventListener('input', renderPreview);
  row.querySelector('[data-remove]').addEventListener('click', () => {
    row.remove();
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
  g('pv-clientAddr').textContent = val('clientAddr');

  g('pv-invNo').textContent = val('invNo') || '—';
  g('pv-invNo2').textContent = val('invNo') || '—';
  g('pv-invDate').textContent = D.formatDate(val('invDate')) || '—';
  g('pv-invDue').textContent = val('invDue') || '—';
  g('pv-invQuote').textContent = val('invQuote') || '—';

  g('pv-projName').textContent = val('projName') || '—';
  g('pv-projStage').textContent = val('projStage') || '—';
  g('pv-scheduleNote').textContent = val('scheduleNote') || '—';

  g('pv-bankAccName').textContent = val('bankAccName') || '—';
  g('pv-bankName').textContent = val('bankName') || '—';
  g('pv-bankAccNo').textContent = val('bankAccNo') || '—';
  g('pv-bankMethod').textContent = val('bankMethod') || '—';
  g('pv-payFootnote').textContent =
    'Please use the Invoice No. as the payment reference and email proof of payment to ' +
    (COMPANY.email || 'iqbal.chendawan@gmail.com') +
    '.';

  g('pv-prepName').textContent = val('prepName') || '—';
  g('pv-prepTitle').textContent = val('prepTitle') || '';
  g('pv-prepContact').textContent = val('prepContact') || '';
  g('pv-ssmNo').textContent = val('ssmNo') ? 'SSM Registration No.: ' + val('ssmNo') : '';

  const body = g('pv-itemsBody');
  body.innerHTML = '';
  let subtotal = 0;
  document.querySelectorAll('.item-block').forEach((block) => {
    const code = block.querySelector('.it-code').value;
    const svc = window.tcvFindService(code);
    const desc = block.querySelector('.it-desc').value.trim();
    const sub = block.querySelector('.it-sub').value.trim();
    const qty = block.querySelector('.it-qty').value.trim();
    const price = parseFloat(block.querySelector('.it-price').value) || 0;
    let amount = parseFloat(block.querySelector('.it-amount').value);
    if (isNaN(amount)) amount = 0;
    subtotal += amount;
    const codeLine = code ? `<div class="item-code">${code}${svc ? ' — ' + svc.name : ''}</div>` : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${codeLine}<div class="item-name">${desc || '&nbsp;'}</div><div class="item-sub">${sub}</div></td>
      <td class="qty">${qty}</td>
      <td class="num">${D.fmt(price)}</td>
      <td class="num">${D.fmt(amount)}</td>
    `;
    body.appendChild(tr);
  });

  const sstPct = parseFloat(g('sstPct').value) || 0;
  const sstVal = subtotal * (sstPct / 100);
  const total = subtotal + sstVal;
  g('pv-subtotal').textContent = 'RM ' + D.fmt(subtotal);
  g('pv-sstLabel').textContent = 'SST (' + sstPct + '%)';
  g('pv-sstVal').textContent = 'RM ' + D.fmt(sstVal);
  g('pv-total').textContent = 'RM ' + D.fmt(total);

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
  const items = [];
  document.querySelectorAll('.item-block').forEach((block) => {
    items.push({
      code: block.querySelector('.it-code').value,
      desc: block.querySelector('.it-desc').value,
      sub: block.querySelector('.it-sub').value,
      qty: block.querySelector('.it-qty').value,
      price: block.querySelector('.it-price').value,
      amount: block.querySelector('.it-amount').value,
    });
  });
  const notes = [];
  document.querySelectorAll('.note-text').forEach((t) => notes.push(t.value));

  const fieldIds = [
    'clientName',
    'clientAttn',
    'clientAddr',
    'serviceCode',
    'jobNo',
    'issueNo',
    'invNo',
    'invDate',
    'invDue',
    'invQuote',
    'projName',
    'projStage',
    'sstPct',
    'scheduleNote',
    'bankAccName',
    'bankName',
    'bankAccNo',
    'bankMethod',
    'prepName',
    'prepTitle',
    'prepContact',
    'ssmNo',
  ];
  const fields = {};
  fieldIds.forEach((id) => (fields[id] = document.getElementById(id).value));
  return { fields, items, notes };
}

function applyState(state) {
  document.getElementById('itemsContainer').innerHTML = '';
  document.getElementById('notesContainer').innerHTML = '';
  itemCount = 0;
  noteCount = 0;

  Object.keys(state.fields || {}).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = state.fields[id];
  });
  (state.items || []).forEach((it) => addItem(it));
  (state.notes || []).forEach((n) => addNote(n));
  if (numbering) numbering.refresh();
  else renderPreview();
}

function defaultState() {
  const c = D.companyDefaults();
  const N = window.TCVNumbers;
  return {
    fields: {
      serviceCode: '',
      jobNo: String(N.peekNextJob()),
      issueNo: '1',
      invNo: '',
      invDate: N.isoToday(),
      invDue: 'Upon Receipt',
      bankMethod: c.bankMethod,
      prepName: c.prepName,
      prepTitle: c.prepTitle,
      prepContact: c.prepContact,
      ssmNo: c.ssmNo,
      sstPct: '0',
    },
    items: [{ code: '', desc: '', sub: '', qty: '1', price: '', amount: '' }],
    notes: [
      'This invoice is issued under the terms and conditions of the referenced quotation.',
      'Please settle payment by the due date to keep the project on schedule.',
    ],
  };
}

let numbering;

document.addEventListener('DOMContentLoaded', () => {
  D.bindLivePreview(renderPreview);
  D.bindDraftActions({
    storageKey: STORAGE_KEY,
    collectState,
    applyState,
    defaultState,
  });
  numbering = window.TCVNumbers.bind({
    prefix: window.TCVNumbers.PREFIX.invoice,
    noId: 'invNo',
    serviceId: 'serviceCode',
    jobId: 'jobNo',
    issueId: 'issueNo',
    relatedId: 'invQuote',
    nextBtnId: 'nextJobBtn',
    hintId: 'invNoHint',
    onChange: renderPreview,
  });
  document.getElementById('addItemBtn').addEventListener('click', () => addItem());
  document.getElementById('addNoteBtn').addEventListener('click', () => addNote());
  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (numbering) numbering.commit();
    const invNo = document.getElementById('invNo').value.trim() || 'invoice';
    D.downloadPdf('invoice-sheet', D.safeFilename('Invoice', invNo));
  });
  applyState(defaultState());
  numbering.refresh();
});
