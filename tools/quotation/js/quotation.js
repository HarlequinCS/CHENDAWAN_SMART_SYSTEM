const STORAGE_KEY = 'chendawan_quotation_draft_v1';
const D = window.TCVDoc;
const COMPANY = window.TCV_COMPANY || {};

let itemCount = 0;
let extraCount = 0;
let scheduleCount = 0;
let termCount = 0;

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
    <input type="text" class="it-desc" value="${data.desc || ''}" placeholder="e.g. Phase / Deliverable Name">
    <label>Sub-description</label>
    <textarea class="it-sub" placeholder="brief description of what this phase / item covers">${data.sub || ''}</textarea>
    <div class="row3">
      <div><label>Qty label</label><input type="text" class="it-qty" value="${data.qty || '1'}" placeholder="1"></div>
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
  const codeSel = block.querySelector('.it-code');
  const descInput = block.querySelector('.it-desc');
  codeSel.addEventListener('change', () => {
    const svc = window.tcvFindService(codeSel.value);
    if (svc && !descInput.value.trim()) descInput.value = svc.name;
    renderPreview();
  });
  block.querySelectorAll('input,textarea,select').forEach((el) => el.addEventListener('input', renderPreview));
  block.querySelector('[data-remove]').addEventListener('click', () => {
    block.remove();
    renderPreview();
  });
  if (seeded.code && !seeded.desc) {
    const svc = window.tcvFindService(seeded.code);
    if (svc && descInput && !descInput.value.trim()) descInput.value = svc.name;
  }
  renderPreview();
}

function makeTextRow(className, textClass, placeholder, text) {
  const div = document.createElement('div');
  div.className = 'note-item';
  div.innerHTML = `
    <textarea class="${textClass}" placeholder="${placeholder}">${text || ''}</textarea>
    <button type="button" title="Remove">&times;</button>
  `;
  return div;
}

function addDynamicRow(containerId, className, placeholder, text, counterName) {
  if (counterName === 'extra') extraCount++;
  if (counterName === 'schedule') scheduleCount++;
  if (counterName === 'term') termCount++;
  const row = makeTextRow('note-item', className, placeholder, text);
  document.getElementById(containerId).appendChild(row);
  row.querySelector('textarea').addEventListener('input', renderPreview);
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    renderPreview();
  });
  renderPreview();
}

function collectTexts(selector) {
  return Array.from(document.querySelectorAll(selector)).map((t) => t.value);
}

function fillList(listId, texts) {
  const list = document.getElementById(listId);
  list.innerHTML = '';
  texts.forEach((text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const li = document.createElement('li');
    li.textContent = trimmed;
    list.appendChild(li);
  });
  if (!list.children.length) {
    const li = document.createElement('li');
    li.className = 'empty-ph';
    li.textContent = '—';
    list.appendChild(li);
  }
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

  g('pv-quoteNo').textContent = val('quoteNo') || '—';
  g('pv-quoteDate').textContent = D.formatDate(val('quoteDate')) || '—';
  g('pv-quoteValid').textContent = D.formatDate(val('quoteValid')) || '—';
  g('pv-projName').textContent = val('projName') || '—';
  g('pv-projSummary').textContent = val('projSummary') || '—';

  g('pv-prepName').textContent = val('prepName') || '—';
  g('pv-prepTitle').textContent = val('prepTitle') || '';
  g('pv-prepContact').textContent = val('prepContact') || '';
  g('pv-ssmNo').textContent = val('ssmNo') ? 'SSM Registration No.: ' + val('ssmNo') : '';

  const body = g('pv-itemsBody');
  body.innerHTML = '';
  let total = 0;
  document.querySelectorAll('#itemsContainer .item-block').forEach((block) => {
    const code = block.querySelector('.it-code').value;
    const svc = window.tcvFindService(code);
    const desc = block.querySelector('.it-desc').value.trim();
    const sub = block.querySelector('.it-sub').value.trim();
    const qty = block.querySelector('.it-qty').value.trim();
    const price = parseFloat(block.querySelector('.it-price').value) || 0;
    let amount = parseFloat(block.querySelector('.it-amount').value);
    if (isNaN(amount)) amount = 0;
    total += amount;
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
  g('pv-total').textContent = 'RM ' + D.fmt(total);

  fillList('pv-extrasList', collectTexts('.extra-text'));
  fillList('pv-scheduleList', collectTexts('.schedule-text'));
  fillList('pv-termsList', collectTexts('.term-text'));
}

function collectState() {
  const items = [];
  document.querySelectorAll('#itemsContainer .item-block').forEach((block) => {
    items.push({
      code: block.querySelector('.it-code').value,
      desc: block.querySelector('.it-desc').value,
      sub: block.querySelector('.it-sub').value,
      qty: block.querySelector('.it-qty').value,
      price: block.querySelector('.it-price').value,
      amount: block.querySelector('.it-amount').value,
    });
  });
  const fieldIds = [
    'clientName',
    'clientAttn',
    'clientAddr',
    'serviceCode',
    'jobNo',
    'issueNo',
    'quoteNo',
    'quoteDate',
    'quoteValid',
    'projName',
    'projSummary',
    'prepName',
    'prepTitle',
    'prepContact',
    'ssmNo',
  ];
  const fields = {};
  fieldIds.forEach((id) => (fields[id] = document.getElementById(id).value));
  return {
    fields,
    items,
    extras: collectTexts('.extra-text'),
    schedule: collectTexts('.schedule-text'),
    terms: collectTexts('.term-text'),
  };
}

function applyState(state) {
  document.getElementById('itemsContainer').innerHTML = '';
  document.getElementById('extrasContainer').innerHTML = '';
  document.getElementById('scheduleContainer').innerHTML = '';
  document.getElementById('termsContainer').innerHTML = '';
  itemCount = extraCount = scheduleCount = termCount = 0;

  Object.keys(state.fields || {}).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = state.fields[id];
  });
  (state.items || []).forEach((it) => addItem(it));
  (state.extras || []).forEach((t) =>
    addDynamicRow('extrasContainer', 'extra-text', 'Item outside scope and how it will be billed', t, 'extra')
  );
  (state.schedule || []).forEach((t) =>
    addDynamicRow('scheduleContainer', 'schedule-text', 'e.g. 20% Deposit: Upon project confirmation', t, 'schedule')
  );
  (state.terms || []).forEach((t) => addDynamicRow('termsContainer', 'term-text', 'Add a term...', t, 'term'));
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
      quoteNo: '',
      quoteDate: N.isoToday(),
      quoteValid: N.isoPlusDays(30),
      prepName: c.prepName,
      prepTitle: c.prepTitle,
      prepContact: c.prepContact,
      ssmNo: c.ssmNo,
    },
    items: [{ code: '', desc: '', sub: '', qty: '1', price: '', amount: '' }],
    extras: [''],
    schedule: [
      '20% Deposit: Upon project confirmation and commencement.',
      '40% Progress Payment: Upon deployment to staging / mid-project milestone.',
      '40% Final Balance: Upon sign-off and delivery to production.',
    ],
    terms: [
      'Changes in scope after sign-off will be billed separately as a new module.',
      'The client shall provide feedback or sign-off within a reasonable number of working days.',
      'Deliverables transfer to the client upon full payment.',
    ],
  };
}

let numbering;

document.addEventListener('DOMContentLoaded', () => {
  D.bindLivePreview(renderPreview);
  D.bindDraftActions({ storageKey: STORAGE_KEY, collectState, applyState, defaultState });
  numbering = window.TCVNumbers.bind({
    prefix: window.TCVNumbers.PREFIX.quotation,
    noId: 'quoteNo',
    serviceId: 'serviceCode',
    jobId: 'jobNo',
    issueId: 'issueNo',
    nextBtnId: 'nextJobBtn',
    hintId: 'quoteNoHint',
    onChange: renderPreview,
  });
  document.getElementById('addItemBtn').addEventListener('click', () => addItem());
  document.getElementById('addExtraBtn').addEventListener('click', () =>
    addDynamicRow('extrasContainer', 'extra-text', 'Item outside scope and how it will be billed', '', 'extra')
  );
  document.getElementById('addScheduleBtn').addEventListener('click', () =>
    addDynamicRow('scheduleContainer', 'schedule-text', 'e.g. 20% Deposit: Upon project confirmation', '', 'schedule')
  );
  document.getElementById('addTermBtn').addEventListener('click', () =>
    addDynamicRow('termsContainer', 'term-text', 'Add a term...', '', 'term')
  );
  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (numbering) numbering.commit();
    const no = document.getElementById('quoteNo').value.trim() || 'quotation';
    D.downloadPdf('quote-sheet', D.safeFilename('Quotation', no));
  });
  applyState(defaultState());
  numbering.refresh();
});
