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

  g('pv-clientName').textContent = val('clientName') || '[Select a client]';
  g('pv-clientName').className = val('clientName') ? 'name' : 'name empty-ph';
  g('pv-clientAttn').textContent = val('clientAttn');
  g('pv-clientAddr').textContent = val('clientAddr');
  if (g('pv-clientReg')) {
    const reg = val('clientReg');
    const type = val('clientType');
    g('pv-clientReg').textContent = reg
      ? (type === 'individual' ? 'NRIC No. ' : 'Registration No. ') + reg
      : '';
  }

  g('pv-invNo').textContent = val('invNo') || '—';
  g('pv-invNo2').textContent = val('invNo') || '—';
  g('pv-invDate').textContent = D.formatDate(val('invDate')) || '—';
  g('pv-invDue').textContent = val('invDue') || '—';
  g('pv-invQuote').textContent = val('invQuote') || '—';

  const cn = isCreditNote();
  if (g('pv-docTitle')) g('pv-docTitle').textContent = cn ? 'CREDIT NOTE' : 'INVOICE';
  if (g('pv-noLab')) g('pv-noLab').textContent = cn ? 'Credit Note No. ' : 'Invoice No. ';
  if (g('pv-dateLab')) g('pv-dateLab').textContent = cn ? 'Credit Note Date ' : 'Invoice Date ';
  if (g('pv-refLab')) g('pv-refLab').textContent = cn ? 'Against Invoice ' : 'Reference Quotation ';
  if (g('pv-dueRow')) g('pv-dueRow').hidden = cn;
  if (g('pv-totalLab')) g('pv-totalLab').textContent = cn ? 'CREDIT TOTAL' : 'TOTAL DUE';
  if (g('pv-scheduleWrap')) g('pv-scheduleWrap').hidden = cn;
  if (g('pv-payWrap')) g('pv-payWrap').hidden = cn;
  if (g('pv-thanks')) {
    g('pv-thanks').textContent = cn
      ? 'This credit note reduces the amount due on the invoice named above.'
      : 'Thank you for your business.';
  }

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
    'docKind',
    'sourceInvId',
  ];
  const fields = {};
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) fields[id] = el.value;
  });
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
  if (window.TCVClients) window.TCVClients.syncSelected();
  if (window.TCVProjects) window.TCVProjects.syncSelected();
  (state.items || []).forEach((it) => addItem(it));
  (state.notes || []).forEach((n) => addNote(n));
  applyKindUi();
  if (numbering) numbering.refresh();
  else renderPreview();
}

function defaultSstPct() {
  try {
    if (window.TCVLedger && window.TCVLedger.getMeta && window.TCVLedger.getMeta().sstRegistered) {
      return '6';
    }
  } catch (e) {}
  return '0';
}

function isCreditNote() {
  const el = document.getElementById('docKind');
  return el && el.value === 'CN';
}

function currentPrefix() {
  return isCreditNote() ? window.TCVNumbers.PREFIX.creditNote : window.TCVNumbers.PREFIX.invoice;
}

function applyKindUi() {
  const cn = isCreditNote();
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const hide = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !!on;
  };
  document.getElementById('kindInv').classList.toggle('is-on', !cn);
  document.getElementById('kindCn').classList.toggle('is-on', cn);
  setText('formHeading', cn ? 'Build a Credit Note' : 'Build an Invoice');
  setText(
    'formSub',
    cn
      ? 'Credit the remaining amount on an issued invoice. The original INV stays on the books.'
      : 'Fill in the fields — the preview on the right updates live. When it\'s ready, download it as a PDF.'
  );
  setText('detailsLegend', cn ? 'Credit Note Details' : 'Invoice Details');
  setText('noLabel', cn ? 'Credit note no.' : 'Invoice no.');
  setText('dateLabel', cn ? 'Credit note date' : 'Invoice date');
  setText('quoteLabel', cn ? 'Against invoice' : 'Reference quotation no.');
  setText(
    'quoteHint',
    cn
      ? 'Pick an issued invoice or type the invoice number. Remaining AR is credited when the invoice is in the books.'
      : 'Pick an issued quotation, or type a custom reference.'
  );
  setText('kindHint', cn
    ? 'Select the invoice to reverse. Remaining AR is filled in; reduce lines for a partial credit.'
    : 'Use a credit note to reverse part of an issued invoice without editing it.');
  hide('payFieldset', cn);
  hide('scheduleFieldset', cn);
  const dueWrap = document.getElementById('invDue');
  if (dueWrap && dueWrap.closest('div')) dueWrap.closest('div').hidden = cn;
  if (numbering && numbering.setPrefix) numbering.setPrefix(currentPrefix());
  if (window.TCVProjects && window.TCVProjects.setPrefix) window.TCVProjects.setPrefix(currentPrefix());
  const issued = numbering && numbering.isIssuedLocked && numbering.isIssuedLocked();
  if (!issued && window.TCVProjects) {
    const pid = (document.getElementById('projectId') || {}).value;
    const project = pid ? window.TCVProjects.get(pid) : null;
    const issueEl = document.getElementById('issueNo');
    if (project && issueEl) issueEl.value = String(window.TCVProjects.peekIssue(project, currentPrefix()));
  }
  refreshQuoteSelect();
  if (numbering) numbering.refresh();
  else renderPreview();
}

function money(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

function itemsTotal(items, sstPct) {
  let subtotal = 0;
  (items || []).forEach((it) => {
    subtotal += money(it.amount);
  });
  subtotal = money(subtotal);
  const sst = money(subtotal * ((parseFloat(sstPct) || 0) / 100));
  return { subtotal, sst, total: money(subtotal + sst) };
}

function scaleItems(items, originalTotal, remaining) {
  if (!originalTotal || remaining >= originalTotal - 0.009) return items || [];
  const factor = remaining / originalTotal;
  return (items || []).map((it) => {
    const amt = money((parseFloat(it.amount) || 0) * factor);
    const price = money((parseFloat(it.price) || 0) * factor);
    return Object.assign({}, it, {
      amount: amt ? amt.toFixed(2) : it.amount,
      price: price ? price.toFixed(2) : it.price,
    });
  });
}

async function refreshQuoteSelect() {
  const cn = isCreditNote();
  let invoices = [];
  if (cn && window.TCVLedger && window.TCVLedger.listInvoices) {
    try {
      invoices = await window.TCVLedger.listInvoices();
    } catch (e) {}
  }
  await D.fillIssuedSelect({
    selectId: 'invQuote',
    types: cn ? ['INV'] : ['QUO'],
    emptyLabel: cn ? 'Select an invoice…' : 'No quotation',
    labelFn: cn
      ? function (d) {
          const row = invoices.find((i) => i.number === d.number || i.id === d.id);
          const bal = row ? money(row.balance) : null;
          return (d.number || 'INV') + (bal == null ? '' : '  ·  RM ' + D.fmt(bal) + ' remaining');
        }
      : null,
  });
}

async function fillFromQuotation(docId) {
  if (!docId || !window.TCVFirebase) return;
  const doc = await window.TCVFirebase.getDocument(docId);
  if (!doc || doc.type !== 'QUO') return;
  const payload = doc.payload || {};
  const fields = payload.fields || {};
  const proj = document.getElementById('projName');
  if (proj && fields.projName) proj.value = fields.projName;
  const box = document.getElementById('itemsContainer');
  if (box && payload.items && payload.items.length) {
    box.innerHTML = '';
    itemCount = 0;
    payload.items.forEach((it) => addItem(it));
  }
  renderPreview();
}

async function fillFromSourceInvoice(docId) {
  if (!docId || !window.TCVFirebase) return;
  const doc = await window.TCVFirebase.getDocument(docId);
  if (!doc || doc.type !== 'INV') return;
  const payload = doc.payload || {};
  const fields = Object.assign({}, payload.fields || {});
  fields.docKind = 'CN';
  fields.sourceInvId = doc.id;
  fields.invQuote = doc.number || fields.invNo || '';
  fields.invNo = '';
  fields.issueNo = '1';
  fields.invDate = window.TCVNumbers.isoToday();
  let items = (payload.items || []).slice();
  if (window.TCVLedger && window.TCVLedger.findInvoiceByNumber) {
    const inv = await window.TCVLedger.findInvoiceByNumber(doc.number);
    if (inv) {
      const orig = itemsTotal(items, fields.sstPct);
      items = scaleItems(items, orig.total, money(inv.balance));
    }
  }
  applyState({ fields: fields, items: items, notes: payload.notes || [] });
}

function defaultState() {
  const c = D.companyDefaults();
  const N = window.TCVNumbers;
  return {
    fields: {
      serviceCode: '',
      jobNo: '',
      issueNo: '1',
      invNo: '',
      invDate: N.isoToday(),
      invDue: 'Upon Receipt',
      bankMethod: c.bankMethod,
      bankAccName: c.bankAccName,
      bankName: c.bankName,
      bankAccNo: c.bankAccNo,
      prepName: c.prepName,
      prepTitle: c.prepTitle,
      prepContact: c.prepContact,
      ssmNo: c.ssmNo,
      sstPct: defaultSstPct(),
      docKind: 'INV',
      sourceInvId: '',
    },
    items: [{ code: '', desc: '', sub: '', qty: '1', price: '', amount: '' }],
    notes: [
      'This invoice is issued under the terms and conditions of the referenced quotation.',
      'Please settle payment by the due date to keep the project on schedule.',
    ],
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
      if (window.TCVLedger && window.TCVLedger.ensureSeeded) return window.TCVLedger.ensureSeeded();
    })
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
      D.bindDraftActions({
        storageKey: STORAGE_KEY,
        collectState,
        applyState,
        defaultState,
        issueGate: issueGate,
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
      if (window.TCVProjects) {
        window.TCVProjects.bindPicker({
          prefix: window.TCVNumbers.PREFIX.invoice,
          onChange: () => {
            refreshQuoteSelect();
            if (numbering) numbering.refresh();
            else renderPreview();
          },
        });
      }
      document.getElementById('kindInv').addEventListener('click', () => {
        document.getElementById('docKind').value = 'INV';
        applyKindUi();
      });
      document.getElementById('kindCn').addEventListener('click', () => {
        document.getElementById('docKind').value = 'CN';
        applyKindUi();
      });
      document.getElementById('invQuote').addEventListener('change', () => {
        const docId = D.selectedIssuedId('invQuote');
        const source = document.getElementById('sourceInvId');
        if (source) source.value = isCreditNote() ? docId : '';
        if (isCreditNote()) {
          if (docId) {
            fillFromSourceInvoice(docId).catch((e) => {
              D.setStatus(e.message || 'Could not load that invoice.');
            });
          }
          return;
        }
        if (docId) {
          fillFromQuotation(docId).catch((e) => {
            D.setStatus(e.message || 'Could not load that quotation.');
          });
        } else if (numbering) numbering.refresh();
        else renderPreview();
      });
      document.getElementById('addItemBtn').addEventListener('click', () => addItem());
      document.getElementById('addNoteBtn').addEventListener('click', () => addNote());
      document.getElementById('downloadBtn').addEventListener('click', async () => {
        try {
          if (isCreditNote() && !document.getElementById('invQuote').value.trim()) {
            D.setStatus('Select or enter the invoice this credit note is against.');
            return;
          }
          const decision = await issueGate.beforeDownload({
            fingerprint: collectState,
            commit: () =>
              window.TCVFirebase.commitDocument({
                type: currentPrefix(),
                noId: 'invNo',
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
        const invNo = document.getElementById('invNo').value.trim() || (isCreditNote() ? 'credit-note' : 'invoice');
        D.downloadPdf('invoice-sheet', D.safeFilename(isCreditNote() ? 'CreditNote' : 'Invoice', invNo));
      });
      return D.loadIssuedIfPresent({
        allowTypes: [window.TCVNumbers.PREFIX.invoice, window.TCVNumbers.PREFIX.creditNote],
        applyState: applyState,
        numbering: numbering,
        issueGate: issueGate,
        noId: 'invNo',
        fingerprint: collectState,
        onBeforeApply: (doc) => {
          document.getElementById('docKind').value = doc.type === 'CN' ? 'CN' : 'INV';
          if (numbering && numbering.setPrefix) numbering.setPrefix(currentPrefix());
          if (window.TCVProjects && window.TCVProjects.setPrefix) {
            window.TCVProjects.setPrefix(currentPrefix());
          }
        },
      }).then((doc) => {
        if (!doc) {
          applyState(defaultState());
          numbering.refresh();
        }
      });
    })
    .catch(() => {});
});
