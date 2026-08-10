let itemCount = 0;
let noteCount = 0;

const STORAGE_KEY = 'chendawan_invoice_draft_v1';

function fmt(n) {
  n = isNaN(n) ? 0 : n;
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function makeItemBlock(id, data) {
  data = data || {};
  const div = document.createElement('div');
  div.className = 'item-block';
  div.dataset.id = id;
  div.innerHTML = `
    <button type="button" class="remove-btn" data-remove="${id}">Remove</button>
    <label class="first">Description</label>
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
  const block = makeItemBlock(id, data);
  document.getElementById('itemsContainer').appendChild(block);
  attachItemListeners(block);
  renderPreview();
}

function attachItemListeners(block) {
  block.querySelectorAll('input,textarea').forEach((el) => {
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

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function renderPreview() {
  const g = (id) => document.getElementById(id);
  const val = (id) => (g(id) ? g(id).value.trim() : '');

  g('pv-clientName').textContent = val('clientName') || '[Client company name]';
  g('pv-clientName').className = val('clientName') ? 'name' : 'name empty-ph';
  g('pv-clientAttn').textContent = val('clientAttn');
  g('pv-clientAddr').textContent = val('clientAddr');

  g('pv-invNo').textContent = val('invNo') || '—';
  g('pv-invNo2').textContent = val('invNo') || '—';
  g('pv-invDate').textContent = formatDate(val('invDate')) || '—';
  g('pv-invDue').textContent = val('invDue') || '—';
  g('pv-invQuote').textContent = val('invQuote') || '—';

  g('pv-projName').textContent = val('projName') || '—';
  g('pv-projStage').textContent = val('projStage') || '—';

  g('pv-scheduleNote').textContent = val('scheduleNote') || '—';

  g('pv-bankAccName').textContent = val('bankAccName') || '—';
  g('pv-bankName').textContent = val('bankName') || '—';
  g('pv-bankAccNo').textContent = val('bankAccNo') || '—';
  g('pv-bankMethod').textContent = val('bankMethod') || '—';

  g('pv-prepName').textContent = val('prepName') || '—';
  g('pv-prepTitle').textContent = val('prepTitle') || '';
  g('pv-prepContact').textContent = val('prepContact') || '';

  const body = g('pv-itemsBody');
  body.innerHTML = '';
  let subtotal = 0;
  document.querySelectorAll('.item-block').forEach((block) => {
    const desc = block.querySelector('.it-desc').value.trim();
    const sub = block.querySelector('.it-sub').value.trim();
    const qty = block.querySelector('.it-qty').value.trim();
    const price = parseFloat(block.querySelector('.it-price').value) || 0;
    let amount = parseFloat(block.querySelector('.it-amount').value);
    if (isNaN(amount)) amount = 0;
    subtotal += amount;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="item-name">${desc || '&nbsp;'}</div><div class="item-sub">${sub}</div></td>
      <td class="qty">${qty}</td>
      <td class="num">${fmt(price)}</td>
      <td class="num">${fmt(amount)}</td>
    `;
    body.appendChild(tr);
  });

  const sstPct = parseFloat(g('sstPct').value) || 0;
  const sstVal = subtotal * (sstPct / 100);
  const total = subtotal + sstVal;
  g('pv-subtotal').textContent = 'RM ' + fmt(subtotal);
  g('pv-sstLabel').textContent = 'SST (' + sstPct + '%)';
  g('pv-sstVal').textContent = 'RM ' + fmt(sstVal);
  g('pv-total').textContent = 'RM ' + fmt(total);

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
  renderPreview();
}

function defaultState() {
  return {
    fields: {
      bankMethod: 'Online Banking Transfer / DuitNow',
      prepName: 'Muhammad Saiful Iqbal Bin Abdul Rani',
      prepTitle: 'Founder / Project Manager, Team ChendAwan',
      prepContact: '+60 14-7207787  |  chendawan25@gmail.com',
      sstPct: '0',
    },
    items: [{ desc: '', sub: '', qty: '1', price: '', amount: '' }],
    notes: [
      'This invoice is issued under the terms and conditions of the referenced quotation.',
      'Please settle payment by the due date to keep the project on schedule.',
    ],
  };
}

function setStatus(msg) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  setTimeout(() => {
    if (el.textContent === msg) el.textContent = '';
  }, 4000);
}

function bindFormListeners() {
  const formPanel = document.querySelector('.form-panel');
  formPanel.addEventListener('input', (e) => {
    if (e.target.matches('input, textarea, select')) {
      renderPreview();
    }
  });

  document.getElementById('addItemBtn').addEventListener('click', () => addItem());
  document.getElementById('addNoteBtn').addEventListener('click', () => addNote());
  document.getElementById('sstPct').addEventListener('input', renderPreview);

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset the form? This clears everything currently entered.')) {
      applyState(defaultState());
      setStatus('Form reset.');
    }
  });

  document.getElementById('saveDraftBtn').addEventListener('click', () => {
    try {
      const state = collectState();
      window.__lastDraft = state;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setStatus('Draft saved on this device.');
      } catch (e) {
        setStatus('Draft saved for this session (browser storage unavailable).');
      }
    } catch (e) {
      setStatus('Could not save draft.');
    }
  });

  document.getElementById('loadDraftBtn').addEventListener('click', () => {
    let state = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) {}
    if (!state && window.__lastDraft) state = window.__lastDraft;
    if (state) {
      applyState(state);
      setStatus('Draft loaded.');
    } else {
      setStatus('No saved draft found.');
    }
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
    const btn = document.getElementById('downloadBtn');
    btn.disabled = true;
    btn.textContent = 'Preparing PDF...';
    const el = document.getElementById('invoice-sheet');
    const invNo = document.getElementById('invNo').value.trim() || 'invoice';
    const filename = 'Invoice_' + invNo.replace(/[^a-z0-9\-_]+/gi, '_') + '.pdf';
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
    };
    html2pdf()
      .set(opt)
      .from(el)
      .save()
      .then(() => {
        btn.disabled = false;
        btn.textContent = 'Download PDF';
        setStatus('PDF downloaded.');
      })
      .catch(() => {
        btn.disabled = false;
        btn.textContent = 'Download PDF';
        setStatus('Something went wrong generating the PDF. Try again.');
      });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindFormListeners();
  applyState(defaultState());
});
