/**
 * Jobs / projects in Firestore. One project = one job number for the year.
 */
window.TCVProjects = (function () {
  let cache = [];
  let bound = null;
  let issuedLock = false;

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
      const y = (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0);
      if (y) return y;
      return (parseInt(b.jobNo, 10) || 0) - (parseInt(a.jobNo, 10) || 0);
    });
  }

  function label(p) {
    let no = '';
    try {
      if (window.TCVNumbers && window.TCVNumbers.build) {
        no = window.TCVNumbers.build({
          prefix: 'JOB',
          year: p.year,
          job: p.jobNo,
          code: p.serviceCode,
          issue: 1,
        }).replace(/^JOB\//, '');
      }
    } catch (e) {}
    const fallback = p.jobNo ? String(p.jobNo) : '';
    return (p.name || 'Untitled') + (no || fallback ? '  ·  ' + (no || fallback) : '');
  }

  async function refresh() {
    const snap = await db().collection('projects').get();
    cache = sortRows(snap.docs.map((d) => Object.assign({}, d.data(), { id: d.id })));
    return cache;
  }

  function list() {
    return cache.slice();
  }

  function listByClient(clientId) {
    if (!clientId) return list();
    return cache.filter((p) => p.clientId === clientId);
  }

  function get(id) {
    if (!id) return null;
    return cache.find((p) => p.id === id) || null;
  }

  function findByNumber(parsed) {
    if (!parsed) return null;
    return (
      cache.find(
        (p) =>
          parseInt(p.year, 10) === parseInt(parsed.year, 10) &&
          parseInt(p.jobNo, 10) === parseInt(parsed.job, 10) &&
          String(p.serviceCode || '').toUpperCase() === String(parsed.code || '').toUpperCase()
      ) || null
    );
  }

  async function upsert(data) {
    const col = db().collection('projects');
    const now = window.TCVFirebase.isoNow();
    let ref;
    let jobNo = parseInt(data.jobNo, 10);
    let year = parseInt(data.year, 10) || window.TCVNumbers.yearNow();
    const existing = data.id ? get(data.id) : null;
    if (data.id) {
      ref = col.doc(data.id);
      if (existing) {
        jobNo = existing.jobNo;
        year = existing.year;
      }
    } else {
      ref = col.doc();
      jobNo = await window.TCVFirebase.nextJobNo(year);
    }
    const project = {
      id: ref.id,
      clientId: (data.clientId || '').trim(),
      name: (data.name || '').trim(),
      serviceCode: (data.serviceCode || '').trim(),
      status: data.status || 'active',
      notes: (data.notes || '').trim(),
      jobNo,
      year,
      issues: (existing && existing.issues) || data.issues || {},
      createdAt: data.createdAt || now,
      updatedAt: now,
    };
    const { id, ...fields } = project;
    await ref.set(fields, { merge: true });
    const idx = cache.findIndex((p) => p.id === project.id);
    if (idx >= 0) cache[idx] = project;
    else cache.push(project);
    cache = sortRows(cache);
    return project;
  }

  async function remove(id) {
    if (!id) return;
    await db().collection('projects').doc(id).delete();
    cache = cache.filter((p) => p.id !== id);
  }

  async function listDocuments(projectId) {
    const snap = await db().collection('documents').where('projectId', '==', projectId).get();
    return snap.docs
      .map((d) => Object.assign({}, d.data(), { id: d.id }))
      .sort((a, b) => String(b.issuedAt || '').localeCompare(String(a.issuedAt || '')));
  }

  function peekIssue(project, prefix) {
    if (!project) return 1;
    const issues = project.issues || {};
    return (parseInt(issues[prefix], 10) || 0) + 1;
  }

  function applyToForm(project, prefix, opts) {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v == null ? '' : v;
    };
    if (!project) {
      set('jobNo', '');
      set('issueNo', '1');
      set('docYear', '');
      return;
    }
    set('jobNo', String(project.jobNo || ''));
    set('serviceCode', project.serviceCode || '');
    set('docYear', String(project.year || ''));
    if (!issuedLock) set('issueNo', String(peekIssue(project, prefix)));
    const projName = document.getElementById('projName');
    if (projName && !projName.value.trim() && project.name) projName.value = project.name;
    const forceClient = opts && opts.forceClient;
    if (project.clientId) {
      const clientEl = document.getElementById('clientId');
      if (clientEl && (forceClient || !clientEl.value) && clientEl.value !== project.clientId) {
        clientEl.value = project.clientId;
        if (clientEl.tagName === 'SELECT' && window.TCVClients && window.TCVClients.syncSelected) {
          window.TCVClients.syncSelected();
        }
      }
    }
    if (window.TCVNumbers) window.TCVNumbers.applyServiceToForm(project.serviceCode);
  }

  function optionTag(p, selectedId) {
    return (
      '<option value="' +
      esc(p.id) +
      '"' +
      (p.id === selectedId ? ' selected' : '') +
      '>' +
      esc(label(p)) +
      '</option>'
    );
  }

  function optionsHtml(clientId, selectedId) {
    const all = list();
    let html = '<option value="">Select a project…</option>';
    if (!all.length) {
      html += '<option value="" disabled>No projects yet — create one first</option>';
      return html;
    }
    if (clientId) {
      const mine = all.filter((p) => p.clientId === clientId);
      const others = all.filter((p) => p.clientId !== clientId);
      if (mine.length) {
        html += '<optgroup label="This client">';
        mine.forEach((p) => {
          html += optionTag(p, selectedId);
        });
        html += '</optgroup>';
      }
      if (others.length) {
        html += '<optgroup label="Other jobs">';
        others.forEach((p) => {
          html += optionTag(p, selectedId);
        });
        html += '</optgroup>';
      }
      return html;
    }
    all.forEach((p) => {
      html += optionTag(p, selectedId);
    });
    return html;
  }

  function syncSelected() {
    if (!bound) return;
    const sel = document.getElementById(bound.projectSelectId);
    if (!sel) return;
    const clientEl = bound.clientSelectId ? document.getElementById(bound.clientSelectId) : null;
    const clientId = clientEl && clientEl.tagName === 'SELECT' ? clientEl.value : '';
    const current = sel.value;
    sel.innerHTML = optionsHtml(clientId, current);
    if (current && Array.prototype.some.call(sel.options, (o) => o.value === current)) {
      sel.value = current;
    } else {
      sel.value = '';
    }
    const project = get(sel.value);
    applyToForm(project, bound.prefix);
    if (typeof bound.onChange === 'function') bound.onChange();
  }

  function bindPicker(opts) {
    opts = opts || {};
    const defaultClientEl = document.getElementById('clientId');
    const defaultClientSelect =
      defaultClientEl && defaultClientEl.tagName === 'SELECT' ? 'clientId' : null;
    bound = {
      projectSelectId: opts.projectSelectId || 'projectId',
      clientSelectId: Object.prototype.hasOwnProperty.call(opts, 'clientSelectId')
        ? opts.clientSelectId
        : defaultClientSelect,
      prefix: opts.prefix,
      onChange: opts.onChange,
    };
    const sel = document.getElementById(bound.projectSelectId);
    if (!sel) return bound;
    sel.addEventListener('change', () => {
      applyToForm(get(sel.value), bound.prefix, { forceClient: true });
      if (typeof bound.onChange === 'function') bound.onChange();
    });
    syncSelected();
    return bound;
  }

  return {
    refresh,
    list,
    listByClient,
    get,
    findByNumber,
    upsert,
    remove,
    listDocuments,
    peekIssue,
    applyToForm,
    bindPicker,
    syncSelected,
    setPrefix: function (prefix) {
      if (bound) bound.prefix = prefix;
    },
    lockIssued: function (on) {
      issuedLock = !!on;
    },
    label,
  };
})();
