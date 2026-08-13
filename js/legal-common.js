window.TCVLegal = (function () {
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
  }

  function boot(opts) {
    const D = window.TCVDoc;
    const N = window.TCVNumbers;
    const COMPANY = window.TCV_COMPANY || {};
    let numbering;

    function collectState() {
      const fields = {};
      opts.fieldIds.forEach((id) => {
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
            clientName: '',
            clientAddr: '',
            clientReg: '',
            clientSignName: '',
            clientSignTitle: '',
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

      D.bindLivePreview(fill);
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
      D.bindDraftActions({
        storageKey: opts.storageKey,
        collectState,
        applyState,
        defaultState,
      });
      document.getElementById('downloadBtn').addEventListener('click', () => {
        if (numbering) numbering.commit();
        const no = document.getElementById(opts.noId).value.trim() || opts.filePrefix;
        D.downloadPdf(opts.sheetId, D.safeFilename(opts.filePrefix, no));
      });
      applyState(defaultState());
      numbering.refresh();
    });
  }

  return { fill, boot, val };
})();
