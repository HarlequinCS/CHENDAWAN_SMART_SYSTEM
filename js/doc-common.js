window.TCVDoc = (function () {
  function fmt(n) {
    n = isNaN(n) ? 0 : n;
    return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  function setStatus(msg) {
    const el = document.getElementById('statusMsg');
    if (!el) return;
    el.textContent = msg;
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = '';
    }, 4000);
  }

  function saveDraft(storageKey, state) {
    window.__lastDraft = state;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setStatus('Draft saved on this device.');
    } catch (e) {
      setStatus('Draft saved for this session (browser storage unavailable).');
    }
  }

  function loadDraft(storageKey) {
    let state = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) state = JSON.parse(raw);
    } catch (e) {}
    if (!state && window.__lastDraft) state = window.__lastDraft;
    return state;
  }

  function downloadPdf(sheetId, filename, btnId) {
    const btn = document.getElementById(btnId || 'downloadBtn');
    const el = document.getElementById(sheetId);
    if (!el || typeof html2pdf === 'undefined') {
      setStatus('PDF library is not available.');
      return;
    }
    const original = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Preparing PDF...';
    }
    const panel = el.closest('.preview-panel');
    const prevOverflow = panel ? panel.style.overflow : '';
    const prevMax = panel ? panel.style.maxHeight : '';
    const prevHeight = panel ? panel.style.height : '';
    if (panel) {
      panel.style.overflow = 'visible';
      panel.style.maxHeight = 'none';
      panel.style.height = 'auto';
    }
    const restore = () => {
      if (panel) {
        panel.style.overflow = prevOverflow;
        panel.style.maxHeight = prevMax;
        panel.style.height = prevHeight;
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = original || 'Download PDF';
      }
    };
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      },
      pagebreak: { mode: ['css', 'legacy'] },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
    };
    html2pdf()
      .set(opt)
      .from(el)
      .save()
      .then(() => {
        restore();
        setStatus('PDF downloaded.');
      })
      .catch(() => {
        restore();
        setStatus('Something went wrong generating the PDF. Try again.');
      });
  }

  function safeFilename(prefix, ref) {
    const slug = (ref || prefix).replace(/[^a-z0-9\-_]+/gi, '_');
    return prefix + '_' + slug + '.pdf';
  }

  function companyDefaults() {
    const c = window.TCV_COMPANY || {};
    return {
      prepName: c.ownerName || '',
      prepTitle: c.ownerTitle || '',
      prepContact: c.contactLine || '',
      ssmNo: c.ssmNo || '',
      bankMethod: c.bankMethod || 'Online Banking Transfer / DuitNow',
      bankName: c.bankName || '',
      bankAccName: c.bankAccName || '',
      bankAccNo: c.bankAccNo || '',
    };
  }

  function bindLivePreview(renderFn) {
    const formPanel = document.querySelector('.form-panel');
    if (!formPanel) return;
    formPanel.addEventListener('input', (e) => {
      if (e.target.matches('input, textarea, select')) renderFn();
    });
    formPanel.addEventListener('change', (e) => {
      if (e.target.matches('select')) renderFn();
    });
  }

  function issueFingerprint(value) {
    function strip(obj) {
      if (obj == null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(strip);
      const out = {};
      Object.keys(obj)
        .sort()
        .forEach((k) => {
          if (
            /^(invNo|quoteNo|quoNo|receiptNo|rcpNo|pslNo|ndaNo|msaNo|slaNo|polNo|icaNo|docNo|cnNo|issueNo)$/i.test(
              k
            )
          ) {
            return;
          }
          out[k] = strip(obj[k]);
        });
      return out;
    }
    try {
      return JSON.stringify(strip(value));
    } catch (e) {
      return String(Date.now());
    }
  }

  function createIssueGate(opts) {
    opts = opts || {};
    let last = null;
    function unlockIssued() {
      if (window.TCVProjects && window.TCVProjects.lockIssued) window.TCVProjects.lockIssued(false);
      if (typeof opts.onReset === 'function') opts.onReset();
    }
    function reset() {
      last = null;
      unlockIssued();
      const url = new URL(window.location.href);
      if (url.searchParams.has('doc')) {
        url.searchParams.delete('doc');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    }
    function prime(value, number, id) {
      last = {
        fp: issueFingerprint(typeof value === 'function' ? value() : value),
        number: number,
        id: id,
      };
    }
    ['projectId', 'clientId', 'workerId'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', reset);
    });
    async function beforeDownload(downloadOpts) {
      const raw =
        typeof downloadOpts.fingerprint === 'function'
          ? downloadOpts.fingerprint()
          : downloadOpts.fingerprint;
      const fp = issueFingerprint(raw);
      if (last && last.fp === fp) {
        setStatus('Re-downloading ' + last.number + ' — already issued, books unchanged.');
        return { reused: true, number: last.number, id: last.id };
      }
      if (last && last.fp !== fp) {
        if (!confirm('This will issue a new number and post the books again. Continue?')) {
          return { cancelled: true };
        }
      }
      const result = await downloadOpts.commit();
      last = {
        fp: fp,
        number: result && result.number,
        id: result && result.id,
      };
      return { reused: false, result: result };
    }
    return { beforeDownload, reset, prime };
  }

  async function loadIssuedIfPresent(opts) {
    opts = opts || {};
    const id = new URLSearchParams(window.location.search).get('doc');
    if (!id || !window.TCVFirebase || !window.TCVFirebase.getDocument) return null;
    let doc;
    try {
      doc = await window.TCVFirebase.getDocument(id);
    } catch (e) {
      setStatus(e.message || 'Could not open that document.');
      return null;
    }
    if (!doc) {
      setStatus('That document was not found.');
      return null;
    }
    const allowed = opts.allowTypes || (opts.prefix ? [opts.prefix] : []);
    if (allowed.length && allowed.indexOf(doc.type) === -1) {
      setStatus('This document belongs to a different tool.');
      return null;
    }
    if (typeof opts.onBeforeApply === 'function') opts.onBeforeApply(doc);
    if (opts.numbering && opts.numbering.lockIssued) opts.numbering.lockIssued(true);
    if (window.TCVProjects && window.TCVProjects.lockIssued) window.TCVProjects.lockIssued(true);
    if (typeof opts.applyState === 'function') opts.applyState(doc.payload || { fields: {} });
    if (opts.noId && doc.number) {
      const noEl = document.getElementById(opts.noId);
      if (noEl) noEl.value = doc.number;
    }
    const issueEl = document.getElementById('issueNo');
    if (issueEl && doc.issue) issueEl.value = String(doc.issue);
    if (opts.issueGate && opts.issueGate.prime) {
      const fpSrc = typeof opts.fingerprint === 'function' ? opts.fingerprint() : doc.payload || {};
      opts.issueGate.prime(fpSrc, doc.number, doc.id);
    }
    if (opts.numbering && opts.numbering.refresh) opts.numbering.refresh();
    setStatus('Opened ' + (doc.number || 'issued document') + ' — re-download will not post again.');
    if (typeof opts.onAfterApply === 'function') opts.onAfterApply(doc);
    return doc;
  }

  function downloadBlob(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function bindDraftActions(opts) {
    const { storageKey, collectState, applyState, defaultState } = opts;
    const issueGate = opts.issueGate;

    document.getElementById('resetBtn').addEventListener('click', () => {
      if (confirm('Reset the form? This clears everything currently entered.')) {
        if (issueGate) issueGate.reset();
        applyState(defaultState());
        setStatus('Form reset.');
      }
    });

    document.getElementById('saveDraftBtn').addEventListener('click', () => {
      try {
        saveDraft(storageKey, collectState());
      } catch (e) {
        setStatus('Could not save draft.');
      }
    });

    document.getElementById('loadDraftBtn').addEventListener('click', () => {
      const state = loadDraft(storageKey);
      if (state) {
        if (issueGate) issueGate.reset();
        applyState(state);
        setStatus('Draft loaded.');
      } else {
        setStatus('No saved draft found.');
      }
    });

    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }
  }

  function amountInWords(n) {
    n = Math.round((parseFloat(n) || 0) * 100) / 100;
    const ones = [
      '',
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function belowThousand(num) {
      if (num === 0) return '';
      if (num < 20) return ones[num];
      if (num < 100) {
        const t = Math.floor(num / 10);
        const o = num % 10;
        return tens[t] + (o ? ' ' + ones[o] : '');
      }
      const h = Math.floor(num / 100);
      const rest = num % 100;
      return ones[h] + ' Hundred' + (rest ? ' ' + belowThousand(rest) : '');
    }

    function chunk(num) {
      if (num === 0) return 'Zero';
      const million = Math.floor(num / 1000000);
      const thousand = Math.floor((num % 1000000) / 1000);
      const rest = num % 1000;
      const parts = [];
      if (million) parts.push(belowThousand(million) + ' Million');
      if (thousand) parts.push(belowThousand(thousand) + ' Thousand');
      if (rest) parts.push(belowThousand(rest));
      return parts.join(' ');
    }

    const ringgit = Math.floor(n);
    const sen = Math.round((n - ringgit) * 100);
    let words = 'Ringgit Malaysia ' + chunk(ringgit);
    if (sen) words += ' and ' + chunk(sen) + ' Sen';
    return words + ' Only';
  }

  return {
    fmt,
    formatDate,
    setStatus,
    saveDraft,
    loadDraft,
    downloadPdf,
    safeFilename,
    companyDefaults,
    bindLivePreview,
    bindDraftActions,
    createIssueGate,
    loadIssuedIfPresent,
    downloadBlob,
    amountInWords,
  };
})();
