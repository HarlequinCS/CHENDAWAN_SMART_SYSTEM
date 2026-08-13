/**
 * TCV document numbering
 *
 * QUO/2026/001-WSD-100/01
 * INV/2026/001-WSD-100/01
 * RCP/2026/001-WSD-100/01
 *
 * PREFIX / YEAR / JOB - SERVICE CODE [ - ISSUE ]
 * Issue is omitted when it is 1. A second invoice for the same job:
 * INV/2026/001-WSD-100/01-002
 */
window.TCVNumbers = (function () {
  const SEQ_KEY = 'tcv_job_seq_v1';
  const PREFIX = { quotation: 'QUO', invoice: 'INV', receipt: 'RCP' };

  function pad(n, width) {
    return String(parseInt(n, 10) || 0).padStart(width || 3, '0');
  }

  function yearNow() {
    return new Date().getFullYear();
  }

  function isoToday() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function isoPlusDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + (parseInt(days, 10) || 0));
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function getLastJob() {
    try {
      const n = parseInt(localStorage.getItem(SEQ_KEY), 10);
      return isNaN(n) ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function peekNextJob() {
    return getLastJob() + 1;
  }

  function commitJob(n) {
    const job = parseInt(n, 10);
    if (!job) return;
    try {
      if (job > getLastJob()) localStorage.setItem(SEQ_KEY, String(job));
    } catch (e) {}
  }

  function build(opts) {
    const prefix = opts.prefix;
    const code = (opts.code || '').trim();
    const job = parseInt(opts.job, 10);
    const year = parseInt(opts.year, 10) || yearNow();
    const issue = parseInt(opts.issue, 10) || 1;
    if (!prefix || !code || !job) return '';
    let no = prefix + '/' + year + '/' + pad(job, 3) + '-' + code;
    if (issue > 1) no += '-' + pad(issue, 3);
    return no;
  }

  function parse(str) {
    const s = (str || '').trim();
    if (!s) return null;
    const long = /^(QUO|INV|RCP)\/(\d{4})\/(\d+)-([A-Z]{3}-\d{3}\/\d{2})(?:-(\d+))?$/i.exec(s);
    if (long) {
      return {
        prefix: long[1].toUpperCase(),
        year: parseInt(long[2], 10),
        job: parseInt(long[3], 10),
        code: long[4].toUpperCase(),
        issue: parseInt(long[5], 10) || 1,
      };
    }
    const short = /^(QUO|INV|RCP)\/(\d+)-([A-Z]{3}-\d{3}\/\d{2})(?:-(\d+))?$/i.exec(s);
    if (short) {
      return {
        prefix: short[1].toUpperCase(),
        year: yearNow(),
        job: parseInt(short[2], 10),
        code: short[3].toUpperCase(),
        issue: parseInt(short[4], 10) || 1,
      };
    }
    return null;
  }

  function convert(str, newPrefix) {
    const p = parse(str);
    if (!p) return '';
    return build({ prefix: newPrefix, year: p.year, job: p.job, code: p.code, issue: 1 });
  }

  function applyServiceToForm(code) {
    const svc = window.tcvFindService(code);
    if (!svc) return;
    const proj = document.getElementById('projName');
    if (proj && !proj.value.trim()) proj.value = svc.name;
    const first = document.querySelector('.item-block .it-code');
    if (first) {
      const prevEmpty = !first.value;
      if (prevEmpty) {
        first.value = code;
        const desc = first.closest('.item-block').querySelector('.it-desc');
        if (desc && !desc.value.trim()) desc.value = svc.name;
      }
    }
  }

  function bind(opts) {
    const noEl = document.getElementById(opts.noId);
    const serviceEl = document.getElementById(opts.serviceId);
    const jobEl = document.getElementById(opts.jobId);
    const issueEl = document.getElementById(opts.issueId);
    const relatedEl = opts.relatedId ? document.getElementById(opts.relatedId) : null;
    const nextBtn = opts.nextBtnId ? document.getElementById(opts.nextBtnId) : null;
    const hintEl = opts.hintId ? document.getElementById(opts.hintId) : null;
    const prefix = opts.prefix;

    if (serviceEl && !serviceEl.options.length) {
      serviceEl.innerHTML = window.tcvServiceOptionsHtml('');
    }

    function refresh() {
      const parsedRelated = relatedEl ? parse(relatedEl.value) : null;
      const code = serviceEl.value;
      const job = parseInt(jobEl.value, 10);
      const issue = issueEl ? parseInt(issueEl.value, 10) || 1 : 1;
      const year = parsedRelated ? parsedRelated.year : yearNow();
      const no = build({ prefix, year, job, code, issue });
      noEl.value = no;
      if (hintEl) {
        hintEl.textContent = no
          ? 'Format: ' + prefix + '/YYYY/JOB-' + 'SERVICE  ·  e.g. ' + no
          : 'Select a service code to generate ' + prefix + '/YYYY/NNN-WSD-100/01';
      }
      if (typeof opts.onChange === 'function') opts.onChange();
    }

    serviceEl.addEventListener('change', () => {
      applyServiceToForm(serviceEl.value);
      if (!jobEl.value) jobEl.value = String(peekNextJob());
      refresh();
    });

    jobEl.addEventListener('input', refresh);
    if (issueEl) issueEl.addEventListener('input', refresh);

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        jobEl.value = String(peekNextJob());
        refresh();
      });
    }

    if (relatedEl) {
      relatedEl.addEventListener('input', () => {
        const p = parse(relatedEl.value);
        if (!p) {
          refresh();
          return;
        }
        if (serviceEl.value !== p.code) {
          serviceEl.value = p.code;
          applyServiceToForm(p.code);
        }
        jobEl.value = String(p.job);
        if (issueEl && !issueEl.value) issueEl.value = '1';
        refresh();
      });
    }

    return {
      refresh,
      commit: function () {
        commitJob(jobEl.value);
      },
    };
  }

  return {
    PREFIX,
    pad,
    yearNow,
    isoToday,
    isoPlusDays,
    getLastJob,
    peekNextJob,
    commitJob,
    build,
    parse,
    convert,
    applyServiceToForm,
    bind,
  };
})();
