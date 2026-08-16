/**
 * Shared client registry (businesses and individuals).
 * Source of truth: Cloud Firestore. Cache is in memory after refresh().
 */
window.TCVClients = (function () {
  const LOCAL_KEY = 'tcv_clients_v1';
  const SNAPSHOT_IDS = [
    'clientName',
    'clientAttn',
    'clientAddr',
    'clientReg',
    'clientSignName',
    'clientSignTitle',
    'clientType',
  ];

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

  function sortRows(rows) {
    return rows.slice().sort((a, b) => {
      if (a.type !== b.type) return a.type === 'business' ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
  }

  function normalize(data, id) {
    const now = window.TCVFirebase.isoNow();
    const client = {
      id: id,
      type: data.type === 'individual' ? 'individual' : 'business',
      name: (data.name || '').trim(),
      reg: (data.reg || '').trim(),
      address: (data.address || '').trim(),
      attn: (data.attn || '').trim(),
      phone: (data.phone || '').trim(),
      email: (data.email || '').trim(),
      signName: (data.signName || '').trim(),
      signTitle: (data.signTitle || '').trim(),
      notes: (data.notes || '').trim(),
      createdAt: data.createdAt || now,
      updatedAt: now,
    };
    if (client.type === 'individual') {
      client.signName = client.signName || client.name;
      client.signTitle = '';
      client.attn = '';
    }
    return client;
  }

  function putCache(client) {
    const idx = cache.findIndex((c) => c.id === client.id);
    if (idx >= 0) cache[idx] = client;
    else cache.push(client);
    cache = sortRows(cache);
  }

  async function refresh() {
    const snap = await db().collection('clients').get();
    cache = sortRows(
      snap.docs.map((d) => Object.assign({}, d.data(), { id: d.id }))
    );
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
    const col = db().collection('clients');
    const ref = data.id ? col.doc(data.id) : col.doc();
    const client = normalize(data, ref.id);
    const { id, ...fields } = client;
    await ref.set(fields, { merge: true });
    putCache(client);
    return client;
  }

  async function remove(id) {
    if (!id) return;
    await db().collection('clients').doc(id).delete();
    cache = cache.filter((c) => c.id !== id);
  }

  function localList() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const listNow = raw ? JSON.parse(raw) : [];
      return Array.isArray(listNow) ? listNow : [];
    } catch (e) {
      return [];
    }
  }

  async function importLocal() {
    const rows = localList();
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i] || !rows[i].name) continue;
      await upsert(rows[i]);
      n++;
    }
    return n;
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? '' : value;
  }

  function applyToInputs(client) {
    if (!client) {
      SNAPSHOT_IDS.forEach((id) => setVal(id, ''));
      return;
    }
    const isPerson = client.type === 'individual';
    setVal('clientName', client.name);
    setVal('clientAttn', isPerson ? client.attn || '' : client.attn);
    setVal('clientAddr', client.address);
    setVal('clientReg', client.reg);
    setVal('clientSignName', client.signName || (isPerson ? client.name : ''));
    setVal('clientSignTitle', client.signTitle || '');
    setVal('clientType', client.type);
  }

  function optionsHtml(selectedId) {
    const items = list();
    let html = '<option value="">Select a client…</option>';
    if (!items.length) {
      html += '<option value="" disabled>No clients yet — register one first</option>';
      return html;
    }
    const groups = [
      { type: 'business', label: 'Businesses' },
      { type: 'individual', label: 'Individuals' },
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
          esc(c.name || 'Untitled') +
          '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  }

  function renderSummary(client, orphaned) {
    const box = document.getElementById(bound && bound.summaryId ? bound.summaryId : 'clientSummary');
    if (!box) return;
    if (orphaned) {
      box.className = 'client-summary';
      box.innerHTML =
        'This document still has the saved details, but the client is no longer in the registry.';
      return;
    }
    if (!client) {
      box.className = 'client-summary is-empty';
      box.innerHTML =
        (bound && bound.emptyHint) ||
        'No client selected. <a href="../clients/">Register a client</a> first.';
      return;
    }
    const tag = client.type === 'individual' ? 'Individual' : 'Business';
    const regLabel = client.type === 'individual' ? 'NRIC' : 'SSM';
    const bits = [
      '<div><span class="name">' +
        esc(client.name) +
        '</span><span class="tag">' +
        tag +
        '</span></div>',
    ];
    if (client.reg) bits.push('<div>' + regLabel + ': ' + esc(client.reg) + '</div>');
    if (client.attn) bits.push('<div>Attn: ' + esc(client.attn) + '</div>');
    if (client.address) bits.push('<div>' + esc(client.address) + '</div>');
    const contact = [client.phone, client.email].filter(Boolean).join(' · ');
    if (contact) bits.push('<div>' + esc(contact) + '</div>');
    box.className = 'client-summary';
    box.innerHTML = bits.join('');
  }

  function syncSelected() {
    const sel = document.getElementById(bound && bound.selectId ? bound.selectId : 'clientId');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = optionsHtml(current);
    if (current) sel.value = current;
    const client = get(sel.value);
    if (sel.value && !client) {
      renderSummary(null, true);
      return;
    }
    if (client) {
      applyToInputs(client);
      renderSummary(client, false);
      return;
    }
    const nameEl = document.getElementById('clientName');
    const leftover = nameEl ? nameEl.value.trim() : '';
    if (leftover) {
      const match = list().find((c) => c.name === leftover);
      if (match) {
        sel.value = match.id;
        applyToInputs(match);
        renderSummary(match, false);
        return;
      }
      renderSummary(null, true);
      return;
    }
    applyToInputs(null);
    renderSummary(null, false);
  }

  function bindPicker(opts) {
    opts = opts || {};
    bound = {
      selectId: opts.selectId || 'clientId',
      summaryId: opts.summaryId || 'clientSummary',
      emptyHint: opts.emptyHint || '',
      onChange: opts.onChange,
    };
    const sel = document.getElementById(bound.selectId);
    if (!sel) return bound;
    sel.addEventListener('change', () => {
      const client = get(sel.value);
      applyToInputs(client);
      renderSummary(client, false);
      if (window.TCVProjects) window.TCVProjects.syncSelected();
      if (typeof bound.onChange === 'function') bound.onChange();
    });
    syncSelected();
    return bound;
  }

  function exportJson() {
    return JSON.stringify({ version: 1, clients: list() }, null, 2);
  }

  async function importJson(raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const incoming = (data && data.clients) || data;
    if (!Array.isArray(incoming)) throw new Error('Invalid client file.');
    for (let i = 0; i < incoming.length; i++) {
      const c = incoming[i];
      if (!c || !c.name) continue;
      await upsert(c);
    }
    return list().length;
  }

  return {
    LOCAL_KEY,
    refresh,
    list,
    get,
    upsert,
    remove,
    localList,
    importLocal,
    optionsHtml,
    bindPicker,
    syncSelected,
    applyToInputs,
    exportJson,
    importJson,
  };
})();
