/**
 * Workforce register: employee, independent contractor, freelancer.
 * Firestore collection: workers
 */
window.TCVWorkers = (function () {
  const TYPES = ['employee', 'contractor', 'freelancer'];
  const EMP_ID_PREFIX = 'TCV-E-';
  const EMP_ID_RE = /^TCV-E-(\d+)$/i;
  let cache = [];
  let bound = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function db() {
    return window.TCVFirebase.db();
  }

  function typeLabel(t) {
    if (t === 'employee') return 'Employee';
    if (t === 'contractor') return 'Independent contractor';
    if (t === 'freelancer') return 'Freelancer';
    return t || 'Worker';
  }

  function isEmployee(t) {
    return t === 'employee';
  }

  function formatEmployeeId(n) {
    return EMP_ID_PREFIX + String(n).padStart(3, '0');
  }

  function parsedEmployeeSeq(value) {
    const m = EMP_ID_RE.exec(String(value || '').trim());
    return m ? parseInt(m[1], 10) : 0;
  }

  function nextEmployeeId(exceptId) {
    let max = 0;
    cache.forEach((w) => {
      if (exceptId && w.id === exceptId) return;
      max = Math.max(max, parsedEmployeeSeq(w.employeeId));
    });
    return formatEmployeeId(max + 1);
  }

  function employeeIdTaken(id, exceptId) {
    const needle = String(id || '').trim().toUpperCase();
    if (!needle) return false;
    return cache.some((w) => {
      if (exceptId && w.id === exceptId) return false;
      return String(w.employeeId || '').trim().toUpperCase() === needle;
    });
  }

  function assignEmployeeId(data, id) {
    const type = data.type || 'contractor';
    let employeeId = String(data.employeeId || '').trim();
    if (type !== 'employee') return employeeId;
    if (!employeeId || employeeIdTaken(employeeId, id)) return nextEmployeeId(id);
    return employeeId;
  }

  function sortRows(rows) {
    const order = { employee: 0, contractor: 1, freelancer: 2 };
    return rows.slice().sort((a, b) => {
      const ta = order[a.type] != null ? order[a.type] : 9;
      const tb = order[b.type] != null ? order[b.type] : 9;
      if (ta !== tb) return ta - tb;
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
  }

  function normalize(data, id) {
    const now = window.TCVFirebase.isoNow();
    let type = (data.type || 'contractor').trim();
    if (TYPES.indexOf(type) === -1) type = 'contractor';
    return {
      id: id,
      type: type,
      name: (data.name || '').trim(),
      nric: (data.nric || data.reg || '').trim(),
      employeeId: assignEmployeeId(Object.assign({}, data, { type: type }), id),
      position: (data.position || '').trim(),
      address: (data.address || '').trim(),
      phone: (data.phone || '').trim(),
      email: (data.email || '').trim(),
      bankName: (data.bankName || '').trim(),
      bankAcc: (data.bankAcc || '').trim(),
      epfNo: (data.epfNo || '').trim(),
      socsoNo: (data.socsoNo || '').trim(),
      eisNo: (data.eisNo || '').trim(),
      pcbStatus: (data.pcbStatus || '').trim(),
      notes: (data.notes || '').trim(),
      createdAt: data.createdAt || now,
      updatedAt: now,
    };
  }

  function putCache(row) {
    const idx = cache.findIndex((c) => c.id === row.id);
    if (idx >= 0) cache[idx] = row;
    else cache.push(row);
    cache = sortRows(cache);
  }

  async function refresh() {
    const snap = await db().collection('workers').get();
    cache = sortRows(snap.docs.map((d) => Object.assign({}, d.data(), { id: d.id })));
    return cache;
  }

  function list() {
    return cache.slice();
  }

  function get(id) {
    if (!id) return null;
    return cache.find((c) => c.id === id) || null;
  }

  async function upsert(data) {
    const col = db().collection('workers');
    const ref = data.id ? col.doc(data.id) : col.doc();
    const worker = normalize(data, ref.id);
    const { id, ...fields } = worker;
    await ref.set(fields, { merge: true });
    putCache(worker);
    return worker;
  }

  async function remove(id) {
    if (!id) return;
    await db().collection('workers').doc(id).delete();
    cache = cache.filter((c) => c.id !== id);
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? '' : value;
  }

  function applyToDocFields(worker) {
    if (!worker) {
      ['clientName', 'clientReg', 'clientAddr', 'clientSignName', 'clientType'].forEach((id) => setVal(id, ''));
      return;
    }
    setVal('clientName', worker.name);
    setVal('clientReg', worker.nric);
    setVal('clientAddr', worker.address);
    setVal('clientSignName', worker.name);
    setVal('clientType', 'individual');
    setVal('workerName', worker.name);
    setVal('workerNric', worker.nric);
    setVal('workerPosition', worker.position);
    setVal('workerEmployeeId', worker.employeeId);
    setVal('workerBankName', worker.bankName);
    setVal('workerBankAcc', worker.bankAcc);
    setVal('workerKind', worker.type);
  }

  function optionsHtml(selectedId, filterFn) {
    let items = list();
    if (typeof filterFn === 'function') items = items.filter(filterFn);
    let html = '<option value="">Select a worker…</option>';
    if (!items.length) {
      html += '<option value="" disabled>No matching workers yet — register one first</option>';
      return html;
    }
    const groups = [
      { type: 'employee', label: 'Employees' },
      { type: 'contractor', label: 'Independent contractors' },
      { type: 'freelancer', label: 'Freelancers' },
    ];
    groups.forEach((g) => {
      const rows = items.filter((c) => c.type === g.type);
      if (!rows.length) return;
      html += '<optgroup label="' + esc(g.label) + '">';
      rows.forEach((c) => {
        html +=
          '<option value="' +
          esc(c.id) +
          '"' +
          (c.id === selectedId ? ' selected' : '') +
          '>' +
          esc((c.name || 'Untitled') + (c.employeeId ? ' · ' + c.employeeId : '')) +
          '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  }

  function renderSummary(worker) {
    const box = document.getElementById(bound && bound.summaryId ? bound.summaryId : 'workerSummary');
    if (!box) return;
    if (!worker) {
      box.className = 'client-summary is-empty';
      box.innerHTML =
        (bound && bound.emptyHint) ||
        'No worker selected. <a href="../../tools/workforce/">Register a worker</a> first.';
      return;
    }
    const bits = [
      '<div><span class="name">' +
        esc(worker.name) +
        '</span><span class="tag">' +
        typeLabel(worker.type) +
        '</span></div>',
    ];
    if (worker.employeeId) bits.push('<div>Employee ID: ' + esc(worker.employeeId) + '</div>');
    if (worker.nric) bits.push('<div>NRIC: ' + esc(worker.nric) + '</div>');
    if (worker.position) bits.push('<div>' + esc(worker.position) + '</div>');
    if (worker.bankName || worker.bankAcc) {
      bits.push('<div>' + esc([worker.bankName, worker.bankAcc].filter(Boolean).join(' · ')) + '</div>');
    }
    box.className = 'client-summary';
    box.innerHTML = bits.join('');
  }

  function syncSelected() {
    const sel = document.getElementById(bound && bound.selectId ? bound.selectId : 'workerId');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = optionsHtml(current, bound && bound.filterFn);
    if (current) sel.value = current;
    const worker = get(sel.value);
    applyToDocFields(worker);
    renderSummary(worker);
  }

  function bindPicker(opts) {
    opts = opts || {};
    bound = {
      selectId: opts.selectId || 'workerId',
      summaryId: opts.summaryId || 'workerSummary',
      emptyHint: opts.emptyHint || '',
      filterFn: opts.filterFn || null,
      onChange: opts.onChange,
    };
    const sel = document.getElementById(bound.selectId);
    if (!sel) return bound;
    sel.addEventListener('change', () => {
      const worker = get(sel.value);
      applyToDocFields(worker);
      renderSummary(worker);
      if (typeof bound.onChange === 'function') bound.onChange();
    });
    syncSelected();
    return bound;
  }

  return {
    TYPES,
    typeLabel,
    isEmployee,
    refresh,
    list,
    get,
    upsert,
    remove,
    optionsHtml,
    bindPicker,
    syncSelected,
    applyToDocFields,
    nextEmployeeId,
    EMP_ID_PREFIX,
  };
})();
