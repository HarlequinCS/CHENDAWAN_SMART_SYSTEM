window.TCVLegal = (function () {
  const PICKER_FIELDS = [
    'clientId',
    'clientName',
    'clientAttn',
    'clientAddr',
    'clientReg',
    'clientSignName',
    'clientSignTitle',
    'clientType',
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
  ];

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function fill() {
    document.querySelectorAll('[data-bind]').forEach((el) => {
      const raw = val(el.dataset.bind);
      let shown = raw;
      if (el.dataset.format === 'date') {
        shown = window.TCVDoc.formatDate(raw) || '';
      }
      const ph = el.getAttribute('data-ph') || '—';
      el.textContent = shown || ph;
      el.classList.toggle('empty-ph', !shown);
    });
    const sheet = document.querySelector('.doc-sheet');
    const fallback = (sheet && sheet.getAttribute('data-default-client-type')) || 'business';
    const type = val('clientType') || fallback;
    document.querySelectorAll('[data-show-type]').forEach((el) => {
      el.hidden = el.getAttribute('data-show-type') !== type;
    });
  }

  function fieldIds(opts) {
    const ids = (opts.fieldIds || []).slice();
    PICKER_FIELDS.forEach((id) => {
      if (ids.indexOf(id) === -1 && document.getElementById(id)) ids.push(id);
    });
    return ids;
  }

  function boot(opts) {
    const D = window.TCVDoc;
    const N = window.TCVNumbers;
    const COMPANY = window.TCV_COMPANY || {};
    let numbering;

    function collectState() {
      const fields = {};
      fieldIds(opts).forEach((id) => {
        const el = document.getElementById(id);
        if (el) fields[id] = el.value;
      });
      return { fields };
    }

    function applyState(state) {
      Object.keys(state.fields || {}).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = state.fields[id];
      });
      if (window.TCVWorkers && document.getElementById('workerId')) {
        window.TCVWorkers.syncSelected();
      }
      if (window.TCVClients && document.querySelector('select#clientId')) {
        window.TCVClients.syncSelected();
      }
      if (window.TCVProjects && document.getElementById('projectId')) {
        window.TCVProjects.syncSelected();
      }
      if (numbering) numbering.refresh();
      else fill();
    }

    function defaultState() {
      const c = D.companyDefaults();
      const extra = typeof opts.extraDefaults === 'function' ? opts.extraDefaults() : {};
      return {
        fields: Object.assign(
          {
            serviceCode: '',
            jobNo: String(N.peekNextJob()),
            issueNo: '1',
            [opts.noId]: '',
            relatedNo: '',
            effDate: N.isoToday(),
            signDate: N.isoToday(),
            clientId: '',
            workerId: '',
            projectId: '',
            clientName: '',
            clientAddr: '',
            clientReg: '',
            clientSignName: '',
            clientSignTitle: '',
            clientType: '',
            projName: '',
            prepName: c.prepName,
            prepTitle: c.prepTitle,
            prepContact: c.prepContact,
            ssmNo: c.ssmNo,
          },
          extra
        ),
      };
    }

    document.addEventListener('DOMContentLoaded', () => {
      const brandName = document.getElementById('pv-companyName');
      const brandTag = document.getElementById('pv-companyTag');
      const brandShort = document.getElementById('pv-companyShort');
      if (brandName) brandName.textContent = COMPANY.legalName || 'TEAM CHENDAWAN VENTURES';
      if (brandTag) brandTag.textContent = COMPANY.tagline || '';
      if (brandShort) brandShort.textContent = COMPANY.shortName || '';

      const start = window.TCVFirebase && window.TCVFirebase.ready ? window.TCVFirebase.ready : Promise.resolve();
      start
        .then(() => {
          const loads = [];
          if (window.TCVClients) loads.push(window.TCVClients.refresh());
          if (window.TCVWorkers) loads.push(window.TCVWorkers.refresh());
          if (window.TCVProjects) loads.push(window.TCVProjects.refresh());
          return Promise.all(loads);
        })
        .then(() => {
          D.bindLivePreview(fill);
          if (window.TCVWorkers && document.getElementById('workerId')) {
            window.TCVWorkers.bindPicker({
              onChange: function () {
                if (numbering) numbering.refresh();
                else fill();
              },
              emptyHint: opts.workerEmptyHint || opts.clientEmptyHint || '',
              filterFn: opts.workerFilterFn || null,
            });
          }
          if (window.TCVClients && document.querySelector('select#clientId')) {
            window.TCVClients.bindPicker({
              onChange: function () {
                if (numbering) numbering.refresh();
                else fill();
              },
              emptyHint: opts.clientEmptyHint || '',
            });
          }
          numbering = N.bind({
            prefix: opts.prefix,
            noId: opts.noId,
            serviceId: 'serviceCode',
            jobId: 'jobNo',
            issueId: 'issueNo',
            relatedId: opts.relatedId || null,
            nextBtnId: 'nextJobBtn',
            hintId: opts.hintId,
            onChange: fill,
          });
          if (window.TCVProjects && document.getElementById('projectId')) {
            window.TCVProjects.bindPicker({
              prefix: opts.prefix,
              clientSelectId: document.querySelector('select#clientId') ? 'clientId' : null,
              onChange: function () {
                if (numbering) numbering.refresh();
                else fill();
              },
            });
          }
          D.bindDraftActions({
            storageKey: opts.storageKey,
            collectState,
            applyState,
            defaultState,
          });
          document.getElementById('downloadBtn').addEventListener('click', async () => {
            try {
              if (document.getElementById('projectId') && window.TCVFirebase) {
                await window.TCVFirebase.commitDocument({
                  type: opts.prefix,
                  noId: opts.noId,
                  collectState,
                });
                if (window.TCVProjects) await window.TCVProjects.refresh();
                fill();
              }
            } catch (e) {
              D.setStatus(e.message || 'Could not save document.');
              return;
            }
            const no = document.getElementById(opts.noId).value.trim() || opts.filePrefix;
            D.downloadPdf(opts.sheetId, D.safeFilename(opts.filePrefix, no));
          });
          applyState(defaultState());
          numbering.refresh();
        })
        .catch(() => {});
    });
  }

  return { fill, boot, val };
})();
