/**
 * Smart Ledger — chart of accounts, balanced journals, period lock.
 * Posting uses account codes, never display names.
 */
window.TCVLedger = (function () {
  const CODES = {
    BANK: '1000',
    INVESTMENT: '1010',
    AR: '1100',
    AP: '2000',
    SST: '2100',
    EPF_PAY: '2200',
    SOCSO_PAY: '2210',
    EIS_PAY: '2220',
    PCB_PAY: '2230',
    HRDF_PAY: '2240',
    CAPITAL: '3000',
    DRAWINGS: '3100',
    EARNINGS: '3900',
    REVENUE: '4000',
    OTHER_INCOME: '4100',
    CONTRACTOR: '5000',
    PROJECT_COST: '5100',
    SALARY: '5200',
    ER_EPF: '5300',
    ER_SOCSO: '5310',
    ER_EIS: '5320',
    ER_HRDF: '5330',
    SOFTWARE: '6000',
    HOSTING: '6010',
    MARKETING: '6020',
    TRAVEL: '6030',
    OFFICE: '6040',
    BANK_CHARGES: '6050',
    PROF_FEES: '6060',
    INSURANCE: '6070',
    MISC: '6090',
  };

  const SEED_ACCOUNTS = [
    { code: '1000', name: 'Bank — Bank Islam', type: 'asset', taxFlag: '' },
    { code: '1010', name: 'Investment account', type: 'asset', taxFlag: '' },
    { code: '1100', name: 'Accounts receivable', type: 'asset', taxFlag: '' },
    { code: '2000', name: 'Accounts payable', type: 'liability', taxFlag: '' },
    { code: '2100', name: 'SST payable', type: 'liability', taxFlag: 'sst' },
    { code: '2200', name: 'EPF payable', type: 'liability', taxFlag: '' },
    { code: '2210', name: 'SOCSO payable', type: 'liability', taxFlag: '' },
    { code: '2220', name: 'EIS payable', type: 'liability', taxFlag: '' },
    { code: '2230', name: 'PCB payable', type: 'liability', taxFlag: '' },
    { code: '2240', name: 'HRDF payable', type: 'liability', taxFlag: '' },
    { code: '3000', name: 'Opening capital', type: 'equity', taxFlag: '' },
    { code: '3100', name: 'Owner drawings', type: 'equity', taxFlag: '' },
    { code: '3900', name: 'Current earnings', type: 'equity', taxFlag: '' },
    { code: '4000', name: 'Professional services', type: 'income', taxFlag: '' },
    { code: '4100', name: 'Other income', type: 'income', taxFlag: '' },
    { code: '5000', name: 'Contractor / ICA costs', type: 'expense', taxFlag: '' },
    { code: '5100', name: 'Other project costs', type: 'expense', taxFlag: '' },
    { code: '5200', name: 'Salary expense', type: 'expense', taxFlag: '' },
    { code: '5300', name: 'Employer EPF', type: 'expense', taxFlag: '' },
    { code: '5310', name: 'Employer SOCSO', type: 'expense', taxFlag: '' },
    { code: '5320', name: 'Employer EIS', type: 'expense', taxFlag: '' },
    { code: '5330', name: 'Employer HRDF', type: 'expense', taxFlag: '' },
    { code: '6000', name: 'Software', type: 'expense', taxFlag: '' },
    { code: '6010', name: 'Hosting', type: 'expense', taxFlag: '' },
    { code: '6020', name: 'Marketing', type: 'expense', taxFlag: '' },
    { code: '6030', name: 'Travel', type: 'expense', taxFlag: '' },
    { code: '6040', name: 'Office', type: 'expense', taxFlag: '' },
    { code: '6050', name: 'Bank charges', type: 'expense', taxFlag: '' },
    { code: '6060', name: 'Professional fees', type: 'expense', taxFlag: '' },
    { code: '6070', name: 'Insurance', type: 'expense', taxFlag: '' },
    { code: '6090', name: 'Miscellaneous', type: 'expense', taxFlag: '' },
  ];

  const SEED_VERSION = 2;
  const MAIN_BANK = {
    name: 'Bank Islam',
    accountName: 'Saiful Iqbal',
    accountNo: '01050026135751',
    glCode: '1000',
    kind: 'operating',
    openingBalance: 380,
  };

  const INVESTMENT_ACCOUNT = {
    name: 'Investment account',
    accountName: 'Saiful Iqbal',
    accountNo: '',
    glCode: '1010',
    kind: 'investment',
    openingBalance: 0,
  };

  let accounts = [];
  let bankAccounts = [];
  let meta = { defaultBankAccountId: '', sstRegistered: false };
  let seeded = false;

  function db() {
    return window.TCVFirebase.db();
  }

  function now() {
    return window.TCVFirebase.isoNow();
  }

  function money(n) {
    return Math.round((parseFloat(n) || 0) * 100) / 100;
  }

  function periodKey(dateStr) {
    const s = String(dateStr || '').slice(0, 10);
    return s.length >= 7 ? s.slice(0, 7) : '';
  }

  function accountByCode(code) {
    return accounts.find((a) => a.code === code) || null;
  }

  function accountById(id) {
    return accounts.find((a) => a.id === id) || null;
  }

  function listAccounts() {
    return accounts.slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }

  function isInvestmentAccount(bank) {
    if (!bank) return false;
    return bank.kind === 'investment' || bank.glCode === CODES.INVESTMENT;
  }

  function listBankAccounts() {
    return bankAccounts.slice().sort((a, b) => {
      const ak = isInvestmentAccount(a) ? 1 : 0;
      const bk = isInvestmentAccount(b) ? 1 : 0;
      if (ak !== bk) return ak - bk;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function defaultBankAccount() {
    if (meta.defaultBankAccountId) {
      const found = bankAccounts.find((b) => b.id === meta.defaultBankAccountId);
      if (found && !isInvestmentAccount(found)) return found;
    }
    return listBankAccounts().find((b) => !isInvestmentAccount(b)) || bankAccounts[0] || null;
  }

  function hasInvestmentAccount() {
    return bankAccounts.some(isInvestmentAccount);
  }

  function bankGlCode(bankAccountId) {
    const bank = bankAccountId
      ? bankAccounts.find((b) => b.id === bankAccountId)
      : defaultBankAccount();
    return (bank && bank.glCode) || CODES.BANK;
  }

  async function loadCaches() {
    const [accSnap, bankSnap, metaSnap] = await Promise.all([
      db().collection('accounts').get(),
      db().collection('bankAccounts').get(),
      db().collection('meta').doc('ledger').get(),
    ]);
    accounts = accSnap.docs.map((d) => Object.assign({}, d.data(), { id: d.id }));
    bankAccounts = bankSnap.docs.map((d) => Object.assign({}, d.data(), { id: d.id }));
    if (metaSnap.exists) meta = Object.assign({}, meta, metaSnap.data());
  }

  async function wipeCollection(name) {
    const snap = await db().collection(name).get();
    let batch = db().batch();
    let n = 0;
    const commits = [];
    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
      n += 1;
      if (n >= 400) {
        commits.push(batch.commit());
        batch = db().batch();
        n = 0;
      }
    });
    if (n) commits.push(batch.commit());
    if (commits.length) await Promise.all(commits);
  }

  async function seedMissingAccounts() {
    const have = {};
    accounts.forEach((a) => {
      have[a.code] = a;
    });
    const writes = [];
    SEED_ACCOUNTS.forEach((row) => {
      if (!have[row.code]) {
        const ref = db().collection('accounts').doc();
        writes.push(ref.set(Object.assign({}, row, { createdAt: now(), updatedAt: now() })));
      } else if (row.code === CODES.BANK && have[row.code].name !== row.name) {
        writes.push(
          db()
            .collection('accounts')
            .doc(have[row.code].id)
            .set({ name: row.name, updatedAt: now() }, { merge: true })
        );
      }
    });
    if (writes.length) {
      await Promise.all(writes);
      await loadCaches();
    }
  }

  async function seedMainBankAndCapital() {
    const date = (window.TCVNumbers && window.TCVNumbers.isoToday()) || now().slice(0, 10);
    const ref = db().collection('bankAccounts').doc();
    await ref.set({
      name: MAIN_BANK.name,
      accountName: MAIN_BANK.accountName,
      accountNo: MAIN_BANK.accountNo,
      glCode: MAIN_BANK.glCode,
      kind: MAIN_BANK.kind,
      openingBalance: MAIN_BANK.openingBalance,
      openingDate: date,
      createdAt: now(),
      updatedAt: now(),
    });
    await saveMeta({
      defaultBankAccountId: ref.id,
      sstRegistered: false,
      seedVersion: SEED_VERSION,
    });
    await loadCaches();
    seeded = true;
    if (MAIN_BANK.openingBalance) {
      await recordOpening({
        date: date,
        accountCode: MAIN_BANK.glCode,
        amount: MAIN_BANK.openingBalance,
      });
    }
  }

  async function resetLedgerBooks() {
    seeded = false;
    const cols = [
      'journals',
      'invoices',
      'creditNotes',
      'bills',
      'billPayments',
      'expenses',
      'periods',
      'bankAccounts',
      'vendors',
      'recurring',
      'workerPayments',
    ];
    for (let i = 0; i < cols.length; i++) {
      await wipeCollection(cols[i]);
    }
    await db().collection('meta').doc('ledger').delete();
    meta = { defaultBankAccountId: '', sstRegistered: false };
    bankAccounts = [];
    await loadCaches();
    await seedMissingAccounts();
    await seedMainBankAndCapital();
    await seedInvestmentAccount();
    seeded = true;
  }

  async function seedInvestmentAccount() {
    if (hasInvestmentAccount()) return;
    const ref = db().collection('bankAccounts').doc();
    await ref.set({
      name: INVESTMENT_ACCOUNT.name,
      accountName: INVESTMENT_ACCOUNT.accountName,
      accountNo: INVESTMENT_ACCOUNT.accountNo,
      glCode: INVESTMENT_ACCOUNT.glCode,
      kind: INVESTMENT_ACCOUNT.kind,
      openingBalance: INVESTMENT_ACCOUNT.openingBalance,
      openingDate: '',
      createdAt: now(),
      updatedAt: now(),
    });
    await loadCaches();
  }

  async function ensureSeeded() {
    if (
      seeded &&
      accounts.length &&
      meta.seedVersion === SEED_VERSION &&
      bankAccounts.length &&
      hasInvestmentAccount() &&
      accountByCode(CODES.INVESTMENT)
    ) {
      return;
    }
    await loadCaches();
    if (meta.seedVersion !== SEED_VERSION) {
      await resetLedgerBooks();
      return;
    }
    await seedMissingAccounts();
    if (!bankAccounts.length) await seedMainBankAndCapital();
    await seedInvestmentAccount();
    seeded = true;
  }

  async function saveMeta(patch) {
    meta = Object.assign({}, meta, patch, { updatedAt: now() });
    await db().collection('meta').doc('ledger').set(meta, { merge: true });
  }

  async function upsertAccount(data) {
    const col = db().collection('accounts');
    const ref = data.id ? col.doc(data.id) : col.doc();
    const row = {
      code: String(data.code || '').trim(),
      name: String(data.name || '').trim(),
      type: data.type || 'expense',
      taxFlag: data.taxFlag || '',
      updatedAt: now(),
    };
    if (!data.id) row.createdAt = now();
    await ref.set(row, { merge: true });
    await loadCaches();
    return Object.assign({ id: ref.id }, row);
  }

  async function upsertBankAccount(data) {
    const col = db().collection('bankAccounts');
    const ref = data.id ? col.doc(data.id) : col.doc();
    const row = {
      name: String(data.name || '').trim(),
      accountName: String(data.accountName || '').trim(),
      accountNo: String(data.accountNo || '').trim(),
      kind: data.kind === 'investment' ? 'investment' : 'operating',
      glCode: String(
        data.glCode || (data.kind === 'investment' ? CODES.INVESTMENT : CODES.BANK)
      ).trim(),
      openingBalance: money(data.openingBalance),
      openingDate: data.openingDate || '',
      updatedAt: now(),
    };
    if (!data.id) row.createdAt = now();
    await ref.set(row, { merge: true });
    await loadCaches();
    if (!meta.defaultBankAccountId && row.kind !== 'investment') {
      await saveMeta({ defaultBankAccountId: ref.id });
    }
    return Object.assign({ id: ref.id }, row);
  }

  function line(code, debit, credit, memo) {
    const acc = accountByCode(code);
    if (!acc) throw new Error('Unknown account code ' + code);
    return {
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      debit: money(debit),
      credit: money(credit),
      memo: memo || '',
    };
  }

  async function findJournalBySource(sourceType, sourceId) {
    if (!sourceType || !sourceId) return null;
    const id = ('src_' + sourceType + '_' + sourceId).replace(/\//g, '_');
    const snap = await db().collection('journals').doc(id).get();
    if (!snap.exists) return null;
    return Object.assign({}, snap.data(), { id: snap.id });
  }

  function journalRef(entry) {
    if (entry.sourceType && entry.sourceId && !entry.allowDuplicate) {
      const id = ('src_' + entry.sourceType + '_' + entry.sourceId).replace(/\//g, '_');
      return db().collection('journals').doc(id);
    }
    return db().collection('journals').doc();
  }

  async function postJournal(entry) {
    await ensureSeeded();
    const date = String(entry.date || '').slice(0, 10);
    const pk = periodKey(date);
    if (!pk) throw new Error('Journal date is required.');
    const lines = (entry.lines || [])
      .map((l) => ({
        accountId: l.accountId,
        accountCode: l.accountCode || '',
        accountName: l.accountName || '',
        debit: money(l.debit),
        credit: money(l.credit),
        memo: l.memo || '',
      }))
      .filter((l) => l.debit || l.credit);
    const dr = money(lines.reduce((s, l) => s + l.debit, 0));
    const cr = money(lines.reduce((s, l) => s + l.credit, 0));
    if (!lines.length) throw new Error('Journal has no lines.');
    if (Math.abs(dr - cr) > 0.009) {
      throw new Error('Journal is not balanced (Dr ' + dr.toFixed(2) + ' / Cr ' + cr.toFixed(2) + ').');
    }
    let allowDup = !!entry.allowDuplicate;
    if (entry.sourceType && entry.sourceId && !allowDup) {
      const existing = await findJournalBySource(entry.sourceType, entry.sourceId);
      if (existing && !existing.reversedBy) {
        return existing.id;
      }
      if (existing && existing.reversedBy) allowDup = true;
    }
    const jRef = journalRef(Object.assign({}, entry, { allowDuplicate: allowDup }));
    const periodRef = db().collection('periods').doc(pk);
    const payload = {
      date,
      period: pk,
      memo: entry.memo || '',
      sourceType: entry.sourceType || 'manual',
      sourceId: entry.sourceId || '',
      projectId: entry.projectId || '',
      clientId: entry.clientId || '',
      workerId: entry.workerId || '',
      vendorId: entry.vendorId || '',
      bankAccountId: entry.bankAccountId || '',
      fromBankAccountId: entry.fromBankAccountId || '',
      lines,
      debitTotal: dr,
      creditTotal: cr,
      locked: false,
      reversedBy: '',
      reversesId: entry.reversesId || '',
      createdAt: now(),
    };
    await db().runTransaction(async (tx) => {
      const periodSnap = await tx.get(periodRef);
      if (periodSnap.exists && periodSnap.data().locked) {
        throw new Error('Period ' + pk + ' is locked and cannot be posted to.');
      }
      tx.set(jRef, payload);
    });
    return jRef.id;
  }

  async function updateJournal(journalId, entry) {
    await ensureSeeded();
    if (!journalId) throw new Error('Select a journal to edit.');
    const date = String(entry.date || '').slice(0, 10);
    const pk = periodKey(date);
    if (!pk) throw new Error('Journal date is required.');
    const lines = (entry.lines || [])
      .map((l) => ({
        accountId: l.accountId,
        accountCode: l.accountCode || '',
        accountName: l.accountName || '',
        debit: money(l.debit),
        credit: money(l.credit),
        memo: l.memo || '',
      }))
      .filter((l) => l.debit || l.credit);
    const dr = money(lines.reduce((s, l) => s + l.debit, 0));
    const cr = money(lines.reduce((s, l) => s + l.credit, 0));
    if (!lines.length) throw new Error('Journal has no lines.');
    if (Math.abs(dr - cr) > 0.009) {
      throw new Error('Journal is not balanced (Dr ' + dr.toFixed(2) + ' / Cr ' + cr.toFixed(2) + ').');
    }
    const ref = db().collection('journals').doc(journalId);
    const newPeriodRef = db().collection('periods').doc(pk);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Journal not found.');
      const old = snap.data() || {};
      if (old.reversedBy) throw new Error('Voided journals cannot be edited. Post a new journal instead.');
      if (old.sourceType === 'void') throw new Error('Reversing journals cannot be edited.');
      const oldPeriodRef = db().collection('periods').doc(old.period || pk);
      const newPeriodSnap = await tx.get(newPeriodRef);
      const oldPeriodSnap = await tx.get(oldPeriodRef);
      if (oldPeriodSnap.exists && oldPeriodSnap.data().locked) {
        throw new Error('Period ' + (old.period || pk) + ' is locked and cannot be edited.');
      }
      if (pk !== old.period && newPeriodSnap.exists && newPeriodSnap.data().locked) {
        throw new Error('Period ' + pk + ' is locked and cannot be posted to.');
      }
      tx.update(ref, {
        date,
        period: pk,
        memo: entry.memo != null ? entry.memo : old.memo || '',
        projectId: entry.projectId != null ? entry.projectId : old.projectId || '',
        clientId: entry.clientId != null ? entry.clientId : old.clientId || '',
        workerId: entry.workerId != null ? entry.workerId : old.workerId || '',
        vendorId: entry.vendorId != null ? entry.vendorId : old.vendorId || '',
        bankAccountId: entry.bankAccountId != null ? entry.bankAccountId : old.bankAccountId || '',
        lines,
        debitTotal: dr,
        creditTotal: cr,
        updatedAt: now(),
      });
    });
    return journalId;
  }

  async function reverseJournal(journalId, date) {
    const snap = await db().collection('journals').doc(journalId).get();
    if (!snap.exists) throw new Error('Journal not found.');
    const j = snap.data();
    if (j.reversedBy) throw new Error('Journal is already voided.');
    const lines = (j.lines || []).map((l) => ({
      accountId: l.accountId,
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.credit,
      credit: l.debit,
      memo: 'Reversal of ' + (j.memo || journalId),
    }));
    const newId = await postJournal({
      date: date || window.TCVNumbers.isoToday(),
      memo: 'Void / reverse: ' + (j.memo || journalId),
      sourceType: 'void',
      sourceId: journalId,
      projectId: j.projectId,
      clientId: j.clientId,
      workerId: j.workerId,
      reversesId: journalId,
      lines,
      allowDuplicate: true,
    });
    await db().collection('journals').doc(journalId).set({ reversedBy: newId, locked: true }, { merge: true });
    return newId;
  }

  async function setPeriodLocked(yyyyMm, locked) {
    await db().collection('periods').doc(yyyyMm).set(
      { locked: !!locked, updatedAt: now() },
      { merge: true }
    );
  }

  async function isPeriodLocked(yyyyMm) {
    const snap = await db().collection('periods').doc(yyyyMm).get();
    return !!(snap.exists && snap.data().locked);
  }

  async function listJournals(opts) {
    opts = opts || {};
    let q = db().collection('journals');
    if (opts.period) q = q.where('period', '==', opts.period);
    const snap = await q.get();
    let rows = snap.docs.map((d) => Object.assign({}, d.data(), { id: d.id }));
    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return rows;
  }

  async function listInvoices() {
    const snap = await db().collection('invoices').get();
    return snap.docs
      .map((d) => Object.assign({}, d.data(), { id: d.id }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  async function listBills() {
    const snap = await db().collection('bills').get();
    return snap.docs
      .map((d) => Object.assign({}, d.data(), { id: d.id }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  async function listExpenses() {
    const snap = await db().collection('expenses').get();
    return snap.docs
      .map((d) => Object.assign({}, d.data(), { id: d.id }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  async function listVendors() {
    const snap = await db().collection('vendors').get();
    return snap.docs
      .map((d) => Object.assign({}, d.data(), { id: d.id }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  async function upsertVendor(data) {
    const col = db().collection('vendors');
    const ref = data.id ? col.doc(data.id) : col.doc();
    const row = {
      name: String(data.name || '').trim(),
      notes: String(data.notes || '').trim(),
      updatedAt: now(),
    };
    if (!data.id) row.createdAt = now();
    await ref.set(row, { merge: true });
    return Object.assign({ id: ref.id }, row);
  }

  function invoiceTotalsFromPayload(payload) {
    const fields = (payload && payload.fields) || {};
    const items = (payload && payload.items) || [];
    let subtotal = 0;
    items.forEach((it) => {
      subtotal += money(it.amount);
    });
    subtotal = money(subtotal);
    const sstPct = money(fields.sstPct);
    const sst = money(subtotal * (sstPct / 100));
    return { subtotal, sstPct, sst, total: money(subtotal + sst) };
  }

  async function postInvoiceIssued(opts) {
    await ensureSeeded();
    const existing = await db().collection('invoices').doc(opts.documentId).get();
    if (existing.exists) return opts.documentId;
    const t = invoiceTotalsFromPayload(opts.payload);
    const fields = (opts.payload && opts.payload.fields) || {};
    const date = (fields.invDate || '').slice(0, 10) || window.TCVNumbers.isoToday();
    const dueRaw = fields.invDue || '';
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : date;
    const lines = [line(CODES.AR, t.total, 0, opts.number)];
    if (t.subtotal) lines.push(line(CODES.REVENUE, 0, t.subtotal, opts.number));
    if (t.sst) lines.push(line(CODES.SST, 0, t.sst, opts.number));
    if (lines.length === 1 && t.total === 0) return opts.documentId;
    const jid = await postJournal({
      date,
      memo: 'Invoice issued ' + (opts.number || ''),
      sourceType: 'INV',
      sourceId: opts.documentId,
      projectId: opts.projectId,
      clientId: opts.clientId,
      lines,
    });
    await db().collection('invoices').doc(opts.documentId).set({
      number: opts.number,
      documentId: opts.documentId,
      clientId: opts.clientId || '',
      projectId: opts.projectId || '',
      date,
      dueDate,
      dueLabel: dueRaw,
      subtotal: t.subtotal,
      sstPct: t.sstPct,
      sst: t.sst,
      total: t.total,
      balance: t.total,
      status: t.total ? 'issued' : 'paid',
      journalId: jid,
      createdAt: now(),
    });
    return opts.documentId;
  }

  async function postCreditNote(opts) {
    await ensureSeeded();
    const existing = await db().collection('creditNotes').doc(opts.documentId).get();
    if (existing.exists) return opts.documentId;
    const t = invoiceTotalsFromPayload(opts.payload);
    const fields = (opts.payload && opts.payload.fields) || {};
    const against = String(fields.invQuote || fields.againstInv || '').trim();
    if (!against) throw new Error('Select the invoice this credit note is against.');
    const inv = await findInvoiceByNumber(against);
    if (!inv) throw new Error('Invoice ' + against + ' was not found in the ledger. Issue the invoice first.');
    const remaining = money(inv.balance);
    if (remaining <= 0) {
      throw new Error(
        'Invoice ' +
          inv.number +
          ' is already fully paid or credited. Record a refund from Bank if you need to return cash.'
      );
    }
    if (t.total > remaining + 0.009) {
      throw new Error(
        'Credit of RM ' +
          t.total.toFixed(2) +
          ' exceeds remaining balance RM ' +
          remaining.toFixed(2) +
          ' on ' +
          inv.number +
          '.'
      );
    }
    const date = (fields.invDate || '').slice(0, 10) || window.TCVNumbers.isoToday();
    const lines = [];
    if (t.subtotal) lines.push(line(CODES.REVENUE, t.subtotal, 0, opts.number));
    if (t.sst) lines.push(line(CODES.SST, t.sst, 0, opts.number));
    if (t.total) lines.push(line(CODES.AR, 0, t.total, inv.number));
    if (!lines.length) return opts.documentId;
    const jid = await postJournal({
      date,
      memo: 'Credit note ' + (opts.number || '') + ' on ' + inv.number,
      sourceType: 'CN',
      sourceId: opts.documentId,
      projectId: opts.projectId || inv.projectId,
      clientId: opts.clientId || inv.clientId,
      lines,
    });
    const newBal = money(remaining - t.total);
    let status = 'issued';
    if (newBal <= 0) status = 'credited';
    else if (newBal < money(inv.total)) status = 'partial';
    await db().collection('invoices').doc(inv.id).set(
      { balance: Math.max(0, newBal), status, updatedAt: now() },
      { merge: true }
    );
    await db().collection('creditNotes').doc(opts.documentId).set({
      number: opts.number,
      documentId: opts.documentId,
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      clientId: opts.clientId || inv.clientId || '',
      projectId: opts.projectId || inv.projectId || '',
      date,
      subtotal: t.subtotal,
      sstPct: t.sstPct,
      sst: t.sst,
      total: t.total,
      journalId: jid,
      createdAt: now(),
    });
    return opts.documentId;
  }

  async function invoiceIssueLines(number, subtotal, sst, total) {
    const lines = [line(CODES.AR, total, 0, number)];
    const rest = money(total - sst);
    if (rest) lines.push(line(CODES.REVENUE, 0, rest, number));
    if (sst) lines.push(line(CODES.SST, 0, sst, number));
    return lines;
  }

  async function recordManualInvoice(data) {
    await ensureSeeded();
    const sst = money(data.sst);
    const subtotal = money(data.subtotal != null && data.subtotal !== '' ? data.subtotal : money(data.total) - sst);
    const total = money(data.total != null && data.total !== '' ? data.total : subtotal + sst);
    if (total <= 0) throw new Error('Enter an invoice total.');
    const date = data.date || window.TCVNumbers.isoToday();
    const dueDate = data.dueDate || date;
    const ref = db().collection('invoices').doc();
    const number = String(data.number || '').trim() || 'INV-MAN-' + date.replace(/-/g, '');
    const jid = await postJournal({
      date,
      memo: data.memo || 'Invoice ' + number,
      sourceType: 'INV',
      sourceId: ref.id,
      projectId: data.projectId || '',
      clientId: data.clientId || '',
      lines: await invoiceIssueLines(number, subtotal, sst, total),
    });
    const row = {
      number,
      documentId: '',
      clientId: data.clientId || '',
      projectId: data.projectId || '',
      date,
      dueDate,
      dueLabel: dueDate,
      subtotal,
      sstPct: 0,
      sst,
      total,
      balance: total,
      status: 'issued',
      memo: data.memo || '',
      journalId: jid,
      manual: true,
      createdAt: now(),
    };
    await ref.set(row);
    return Object.assign({ id: ref.id }, row);
  }

  async function updateInvoice(data) {
    await ensureSeeded();
    if (!data.id) throw new Error('Select an invoice to edit.');
    const ref = db().collection('invoices').doc(data.id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Invoice not found.');
    const inv = snap.data() || {};
    if (inv.status === 'void') throw new Error('Voided invoices cannot be edited.');
    const paid = money((inv.total || 0) - (inv.balance || 0));
    const sst = money(data.sst != null && data.sst !== '' ? data.sst : inv.sst);
    const subtotal = money(data.subtotal != null && data.subtotal !== '' ? data.subtotal : inv.subtotal);
    const total = money(data.total != null && data.total !== '' ? data.total : subtotal + sst);
    if (total < paid - 0.009) {
      throw new Error('Total cannot be less than already collected (RM ' + paid.toFixed(2) + ').');
    }
    const number = String(data.number || inv.number || '').trim();
    const date = data.date || inv.date;
    const memo = data.memo != null ? data.memo : inv.memo || '';
    if (inv.journalId) {
      await updateJournal(inv.journalId, {
        date,
        memo: memo || 'Invoice ' + number,
        projectId: data.projectId != null ? data.projectId : inv.projectId,
        clientId: data.clientId != null ? data.clientId : inv.clientId,
        lines: await invoiceIssueLines(number, subtotal, sst, total),
      });
    }
    const balance = money(total - paid);
    let statusVal = String(data.status || '').trim().toLowerCase();
    if (INVOICE_STATUSES.indexOf(statusVal) === -1) {
      statusVal = 'issued';
      if (balance <= 0) statusVal = 'paid';
      else if (paid > 0) statusVal = 'partial';
    }
    await ref.set(
      {
        number,
        date,
        dueDate: data.dueDate || inv.dueDate || date,
        dueLabel: data.dueDate || inv.dueLabel || '',
        clientId: data.clientId != null ? data.clientId : inv.clientId || '',
        projectId: data.projectId != null ? data.projectId : inv.projectId || '',
        subtotal,
        sst,
        total,
        balance: Math.max(0, balance),
        status: statusVal,
        memo,
        updatedAt: now(),
      },
      { merge: true }
    );
    return data.id;
  }

  const INVOICE_STATUSES = ['issued', 'partial', 'paid', 'credited', 'void'];

  function journalMentionsInvoice(j, inv) {
    const number = String(inv.number || '');
    const sourceId = String(j.sourceId || '');
    const memo = String(j.memo || '');
    if (inv.journalId && j.id === inv.journalId) return true;
    if (j.sourceType === 'INV' && (sourceId === inv.documentId || sourceId === inv.id)) return true;
    if (j.sourceType === 'ARPAY' && sourceId.indexOf('pay_' + inv.id + '_') === 0) return true;
    if (number && (memo.indexOf(number) !== -1 || sourceId === inv.documentId || sourceId === inv.id)) return true;
    return (j.lines || []).some((l) => number && String(l.memo || '').indexOf(number) !== -1);
  }

  function invoiceJournalRole(j, inv) {
    if (!j || j.reversedBy || j.sourceType === 'void') return '';
    if (!journalMentionsInvoice(j, inv)) return '';
    const sourceId = String(j.sourceId || '');
    if (inv.journalId && j.id === inv.journalId) return 'issue';
    if (j.sourceType === 'INV' && (sourceId === inv.documentId || sourceId === inv.id)) return 'issue';
    if (j.sourceType === 'CN') return 'credit';
    if (j.sourceType === 'ARPAY' || j.sourceType === 'RCP') return 'collect';
    const lines = j.lines || [];
    const arCredit = lines.some((l) => l.accountCode === CODES.AR && money(l.credit) > 0);
    const arDebit = lines.some((l) => l.accountCode === CODES.AR && money(l.debit) > 0);
    const bankHit = lines.some((l) => l.accountCode === CODES.BANK || l.accountCode === CODES.INVESTMENT);
    if (arCredit && bankHit) return 'collect';
    if (arDebit && !bankHit) return 'issue';
    return '';
  }

  async function reverseInvoiceCollections(inv) {
    const journals = await listJournals();
    const targets = journals.filter((j) => invoiceJournalRole(j, inv) === 'collect');
    for (let i = 0; i < targets.length; i++) {
      await reverseJournal(targets[i].id);
    }
    return targets.length;
  }

  async function reverseInvoiceIssue(inv) {
    const journals = await listJournals();
    const targets = journals.filter((j) => invoiceJournalRole(j, inv) === 'issue');
    for (let i = 0; i < targets.length; i++) {
      await reverseJournal(targets[i].id);
    }
    return targets.length;
  }

  async function creditedOnInvoice(inv) {
    const notes = await listCreditNotes();
    return money(
      notes
        .filter((n) => n.invoiceId === inv.id || n.invoiceNumber === inv.number)
        .reduce((s, n) => s + money(n.total), 0)
    );
  }

  async function collectedOnInvoice(inv) {
    const journals = await listJournals();
    let collected = 0;
    journals.forEach((j) => {
      if (invoiceJournalRole(j, inv) !== 'collect') return;
      (j.lines || []).forEach((l) => {
        if (l.accountCode === CODES.AR) collected += money(l.credit) - money(l.debit);
      });
    });
    return money(Math.max(0, collected));
  }

  async function postInvoiceCollection(inv, amount) {
    const payAmt = money(amount);
    if (payAmt <= 0) return '';
    const bank = defaultBankAccount();
    const bankCode = bankGlCode(bank && bank.id);
    const payId = 'pay_' + inv.id + '_' + Date.now();
    return postJournal({
      date: window.TCVNumbers.isoToday(),
      memo: 'Payment on ' + (inv.number || inv.id),
      sourceType: 'ARPAY',
      sourceId: payId,
      projectId: inv.projectId,
      clientId: inv.clientId,
      bankAccountId: (bank && bank.id) || '',
      lines: [line(bankCode, payAmt, 0, inv.number), line(CODES.AR, 0, payAmt, inv.number)],
      allowDuplicate: true,
    });
  }

  async function setInvoiceStatus(id, status) {
    await ensureSeeded();
    const wanted = String(status || '').trim().toLowerCase();
    if (INVOICE_STATUSES.indexOf(wanted) === -1) {
      throw new Error('Choose issued, partial, paid, credited, or void.');
    }
    const ref = db().collection('invoices').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Invoice not found.');
    const inv = Object.assign({}, snap.data(), { id: snap.id });
    const total = money(inv.total);
    const credits = await creditedOnInvoice(inv);
    const patch = { status: wanted, updatedAt: now() };

    if (wanted === 'issued') {
      await reverseInvoiceCollections(inv);
      patch.balance = money(Math.max(0, total - credits));
      if (credits > 0 && patch.balance > 0) patch.status = 'partial';
      else if (credits > 0 && patch.balance <= 0) patch.status = 'credited';
    } else if (wanted === 'paid') {
      const collected = await collectedOnInvoice(inv);
      const outstanding = money(Math.max(0, total - credits - collected));
      if (outstanding > 0) await postInvoiceCollection(inv, outstanding);
      patch.balance = 0;
    } else if (wanted === 'void') {
      await reverseInvoiceCollections(inv);
      await reverseInvoiceIssue(inv);
      patch.balance = 0;
    } else if (wanted === 'credited') {
      await reverseInvoiceCollections(inv);
      patch.balance = 0;
    } else if (wanted === 'partial') {
      const collected = await collectedOnInvoice(inv);
      patch.balance = money(Math.max(0, total - credits - collected));
    }

    await ref.set(patch, { merge: true });
    return id;
  }

  async function findInvoiceByNumber(number) {
    const n = String(number || '').trim();
    if (!n) return null;
    const snap = await db().collection('invoices').where('number', '==', n).limit(1).get();
    if (snap.empty) return null;
    return Object.assign({}, snap.docs[0].data(), { id: snap.docs[0].id });
  }

  async function applyReceipt(opts) {
    await ensureSeeded();
    const fields = (opts.payload && opts.payload.fields) || {};
    const amount = money(fields.amount);
    if (amount <= 0) return '';
    const date = (fields.receiptDate || '').slice(0, 10) || window.TCVNumbers.isoToday();
    const bankCode = bankGlCode(fields.bankAccountId);
    const inv = await findInvoiceByNumber(fields.refInvoice);
    const lines = [];
    if (amount) lines.push(line(bankCode, amount, 0, opts.number));
    if (inv) {
      const applyAmt = money(Math.min(amount, inv.balance));
      if (applyAmt) lines.push(line(CODES.AR, 0, applyAmt, inv.number));
      const leftover = money(amount - applyAmt);
      if (leftover) lines.push(line(CODES.OTHER_INCOME, 0, leftover, 'Unapplied ' + opts.number));
      const jid = await postJournal({
        date,
        memo: 'Receipt ' + (opts.number || '') + ' on ' + inv.number,
        sourceType: 'RCP',
        sourceId: opts.documentId,
        projectId: opts.projectId || inv.projectId,
        clientId: opts.clientId || inv.clientId,
        bankAccountId: fields.bankAccountId || '',
        lines,
      });
      const newBal = money(inv.balance - applyAmt);
      let status = 'issued';
      if (newBal <= 0) status = 'paid';
      else if (newBal < inv.total) status = 'partial';
      await db().collection('invoices').doc(inv.id).set(
        { balance: Math.max(0, newBal), status, updatedAt: now() },
        { merge: true }
      );
      return jid;
    }
    if (amount) lines.push(line(CODES.OTHER_INCOME, 0, amount, 'Unapplied receipt'));
    if (!lines.length) return '';
    return postJournal({
      date,
      memo: 'Receipt ' + (opts.number || '') + ' (no invoice)',
      sourceType: 'RCP',
      sourceId: opts.documentId,
      projectId: opts.projectId,
      clientId: opts.clientId,
      bankAccountId: fields.bankAccountId || '',
      lines,
    });
  }

  async function postPayslip(opts) {
    await ensureSeeded();
    const payload = opts.payload || {};
    const fields = payload.fields || {};
    const t = payload.totals || {};
    const date = (fields.payDate || '').slice(0, 10) || window.TCVNumbers.isoToday();
    const paidNow = payload.paidNow !== false;
    const bankCode = bankGlCode(fields.bankAccountId);
    const creditTarget = paidNow ? bankCode : CODES.AP;
    const lines = [];
    if (payload.isEmployee) {
      const gross = money(t.gross);
      const net = money(t.net);
      const epfE = money(fields.dedEpf);
      const socsoE = money(fields.dedSocso);
      const eisE = money(fields.dedEis);
      const pcb = money(fields.dedPcb);
      const other = money(fields.dedOther);
      const epfR = money(fields.erEpf);
      const socsoR = money(fields.erSocso);
      const eisR = money(fields.erEis);
      const hrdf = money(fields.erHrdf);
      if (gross) lines.push(line(CODES.SALARY, gross, 0, opts.number));
      if (epfR) lines.push(line(CODES.ER_EPF, epfR, 0, opts.number));
      if (socsoR) lines.push(line(CODES.ER_SOCSO, socsoR, 0, opts.number));
      if (eisR) lines.push(line(CODES.ER_EIS, eisR, 0, opts.number));
      if (hrdf) lines.push(line(CODES.ER_HRDF, hrdf, 0, opts.number));
      if (net) lines.push(line(creditTarget, 0, net, opts.number));
      if (epfE + epfR) lines.push(line(CODES.EPF_PAY, 0, epfE + epfR, opts.number));
      if (socsoE + socsoR) lines.push(line(CODES.SOCSO_PAY, 0, socsoE + socsoR, opts.number));
      if (eisE + eisR) lines.push(line(CODES.EIS_PAY, 0, eisE + eisR, opts.number));
      if (pcb) lines.push(line(CODES.PCB_PAY, 0, pcb, opts.number));
      if (hrdf) lines.push(line(CODES.HRDF_PAY, 0, hrdf, opts.number));
      if (other) lines.push(line(CODES.AP, 0, other, 'Other deduction ' + opts.number));
    } else {
      const gross = money(t.gross);
      const net = money(t.net);
      const other = money(fields.dedOtherAlt);
      if (gross) lines.push(line(CODES.CONTRACTOR, gross, 0, opts.number));
      if (net) lines.push(line(creditTarget, 0, net, opts.number));
      if (other) lines.push(line(CODES.AP, 0, other, 'Deduction ' + opts.number));
    }
    if (!lines.length) return '';
    const jid = await postJournal({
      date,
      memo: (payload.isEmployee ? 'Payslip ' : 'Payment advice ') + (opts.number || ''),
      sourceType: 'PSL',
      sourceId: opts.documentId,
      projectId: opts.projectId,
      workerId: opts.workerId || fields.workerId || '',
      bankAccountId: fields.bankAccountId || '',
      lines,
    });
    if (!paidNow) {
      const net = money(t.net);
      if (net > 0) {
        await recordBill({
          skipJournal: true,
          date,
          amount: net,
          accountCode: payload.isEmployee ? CODES.SALARY : CODES.CONTRACTOR,
          workerId: opts.workerId || fields.workerId || '',
          vendorName: fields.workerName || '',
          projectId: opts.projectId || '',
          memo: (payload.isEmployee ? 'Payslip ' : 'Payment advice ') + (opts.number || ''),
          sourceType: 'PSL',
          sourceId: opts.documentId,
        });
      }
    }
    return jid;
  }

  async function onDocumentCommitted(info) {
    await ensureSeeded();
    const type = info.type;
    if (type === 'INV') return postInvoiceIssued(info);
    if (type === 'CN') return postCreditNote(info);
    if (type === 'RCP') return applyReceipt(info);
    if (type === 'PSL') return postPayslip(info);
  }

  async function recordBill(data) {
    await ensureSeeded();
    const ref = data.id ? db().collection('bills').doc(data.id) : db().collection('bills').doc();
    const amount = money(data.amount);
    const date = data.date || window.TCVNumbers.isoToday();
    const expenseCode = data.accountCode || CODES.CONTRACTOR;
    let jid = data.journalId || '';
    if (!data.skipJournal) {
      jid = await postJournal({
        date,
        memo: 'Bill ' + (data.memo || ref.id),
        sourceType: 'BILL',
        sourceId: ref.id,
        projectId: data.projectId || '',
        vendorId: data.vendorId || '',
        workerId: data.workerId || '',
        lines: [line(expenseCode, amount, 0, data.memo), line(CODES.AP, 0, amount, data.memo)],
      });
    }
    const row = {
      vendorId: data.vendorId || '',
      vendorName: data.vendorName || '',
      workerId: data.workerId || '',
      projectId: data.projectId || '',
      accountCode: expenseCode,
      date,
      dueDate: data.dueDate || date,
      amount,
      balance: amount,
      status: 'unpaid',
      memo: data.memo || '',
      journalId: jid,
      sourceType: data.sourceType || 'BILL',
      sourceId: data.sourceId || ref.id,
      createdAt: now(),
    };
    await ref.set(row);
    return Object.assign({ id: ref.id }, row);
  }

  async function updateBill(data) {
    await ensureSeeded();
    if (!data.id) throw new Error('Select a bill to edit.');
    const ref = db().collection('bills').doc(data.id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Bill not found.');
    const bill = snap.data() || {};
    const paid = money((bill.amount || 0) - (bill.balance || 0));
    const amount = money(data.amount);
    if (amount <= 0) throw new Error('Enter a bill amount.');
    if (amount < paid - 0.009) {
      throw new Error('Amount cannot be less than already paid (RM ' + paid.toFixed(2) + ').');
    }
    const date = data.date || bill.date;
    const expenseCode = data.accountCode || bill.accountCode || CODES.CONTRACTOR;
    const memo = data.memo != null ? data.memo : bill.memo || '';
    if (bill.journalId && bill.sourceType !== 'PSL') {
      await updateJournal(bill.journalId, {
        date,
        memo: memo || 'Bill',
        projectId: data.projectId != null ? data.projectId : bill.projectId,
        vendorId: data.vendorId != null ? data.vendorId : bill.vendorId,
        workerId: data.workerId != null ? data.workerId : bill.workerId,
        lines: [line(expenseCode, amount, 0, memo), line(CODES.AP, 0, amount, memo)],
      });
    }
    const balance = money(amount - paid);
    await ref.set(
      {
        date,
        dueDate: data.dueDate || bill.dueDate || date,
        amount,
        balance: Math.max(0, balance),
        status: balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        accountCode: expenseCode,
        vendorId: data.vendorId != null ? data.vendorId : bill.vendorId || '',
        vendorName: data.vendorName != null ? data.vendorName : bill.vendorName || '',
        workerId: data.workerId != null ? data.workerId : bill.workerId || '',
        projectId: data.projectId != null ? data.projectId : bill.projectId || '',
        memo,
        updatedAt: now(),
      },
      { merge: true }
    );
    return data.id;
  }

  async function payBill(data) {
    await ensureSeeded();
    const billRef = db().collection('bills').doc(data.billId);
    const snap = await billRef.get();
    if (!snap.exists) throw new Error('Bill not found.');
    const bill = snap.data();
    const amount = money(Math.min(data.amount, bill.balance));
    if (amount <= 0) throw new Error('Nothing left to pay on this bill.');
    const date = data.date || window.TCVNumbers.isoToday();
    const bankCode = bankGlCode(data.bankAccountId);
    const payRef = db().collection('billPayments').doc();
    const jid = await postJournal({
      date,
      memo: 'Pay bill ' + (bill.memo || data.billId),
      sourceType: 'BILLPAY',
      sourceId: payRef.id,
      projectId: bill.projectId,
      vendorId: bill.vendorId,
      workerId: bill.workerId,
      bankAccountId: data.bankAccountId || '',
      lines: [line(CODES.AP, amount, 0), line(bankCode, 0, amount)],
    });
    const newBal = money(bill.balance - amount);
    await billRef.set(
      {
        balance: Math.max(0, newBal),
        status: newBal <= 0 ? 'paid' : 'partial',
        updatedAt: now(),
      },
      { merge: true }
    );
    await payRef.set({
      billId: data.billId,
      amount,
      date,
      bankAccountId: data.bankAccountId || '',
      journalId: jid,
      createdAt: now(),
    });
    return jid;
  }

  async function recordExpense(data) {
    await ensureSeeded();
    const amount = money(data.amount);
    const date = data.date || window.TCVNumbers.isoToday();
    const expenseCode = data.accountCode || CODES.MISC;
    const bankCode = bankGlCode(data.bankAccountId);
    const ref = db().collection('expenses').doc();
    const jid = await postJournal({
      date,
      memo: data.memo || 'Expense',
      sourceType: 'EXP',
      sourceId: ref.id,
      projectId: data.projectId || '',
      vendorId: data.vendorId || '',
      bankAccountId: data.bankAccountId || '',
      lines: [line(expenseCode, amount, 0, data.memo), line(bankCode, 0, amount, data.memo)],
    });
    const row = {
      date,
      amount,
      accountCode: expenseCode,
      projectId: data.projectId || '',
      vendorId: data.vendorId || '',
      memo: data.memo || '',
      bankAccountId: data.bankAccountId || '',
      journalId: jid,
      createdAt: now(),
    };
    await ref.set(row);
    return Object.assign({ id: ref.id }, row);
  }

  async function updateExpense(data) {
    await ensureSeeded();
    if (!data.id) throw new Error('Select an expense to edit.');
    const ref = db().collection('expenses').doc(data.id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Expense not found.');
    const exp = snap.data() || {};
    const amount = money(data.amount);
    if (amount <= 0) throw new Error('Enter an amount.');
    const date = data.date || exp.date;
    const expenseCode = data.accountCode || exp.accountCode || CODES.MISC;
    const bankCode = bankGlCode(data.bankAccountId || exp.bankAccountId);
    const memo = data.memo != null ? data.memo : exp.memo || '';
    if (exp.journalId) {
      await updateJournal(exp.journalId, {
        date,
        memo: memo || 'Expense',
        projectId: data.projectId != null ? data.projectId : exp.projectId,
        bankAccountId: data.bankAccountId != null ? data.bankAccountId : exp.bankAccountId,
        lines: [line(expenseCode, amount, 0, memo), line(bankCode, 0, amount, memo)],
      });
    }
    await ref.set(
      {
        date,
        amount,
        accountCode: expenseCode,
        projectId: data.projectId != null ? data.projectId : exp.projectId || '',
        memo,
        bankAccountId: data.bankAccountId != null ? data.bankAccountId : exp.bankAccountId || '',
        updatedAt: now(),
      },
      { merge: true }
    );
    return data.id;
  }

  async function payWorker(data) {
    await ensureSeeded();
    const amount = money(data.amount);
    if (amount <= 0) throw new Error('Enter an amount to pay.');
    if (!data.workerId) throw new Error('Select a worker.');
    const date = data.date || window.TCVNumbers.isoToday();
    const kind = data.workerKind || 'contractor';
    if (kind === 'employee') {
      throw new Error('Pay employees from the Payslip tool so EPF/SOCSO are posted.');
    }
    const costCode = CODES.CONTRACTOR;
    const bankId = data.bankAccountId || (defaultBankAccount() && defaultBankAccount().id) || '';
    const bankCode = bankGlCode(bankId);
    const name = data.workerName || 'worker';
    const memo = data.memo || 'Pay ' + name;
    const paidNow = data.paidNow !== false;
    if (!paidNow) {
      return recordBill({
        date,
        dueDate: data.dueDate || date,
        amount,
        accountCode: costCode,
        workerId: data.workerId,
        vendorName: name,
        projectId: data.projectId || '',
        memo,
      });
    }
    const ref = db().collection('workerPayments').doc();
    const jid = await postJournal({
      date,
      memo,
      sourceType: 'WPAY',
      sourceId: ref.id,
      projectId: data.projectId || '',
      workerId: data.workerId,
      bankAccountId: bankId,
      lines: [line(costCode, amount, 0, memo), line(bankCode, 0, amount, memo)],
      allowDuplicate: true,
    });
    const row = {
      workerId: data.workerId,
      workerName: name,
      workerKind: kind,
      date,
      amount,
      projectId: data.projectId || '',
      bankAccountId: bankId,
      memo,
      paidNow: true,
      journalId: jid,
      createdAt: now(),
    };
    await ref.set(row);
    return Object.assign({ id: ref.id }, row);
  }

  async function listWorkerPayments() {
    const snap = await db().collection('workerPayments').get();
    return snap.docs
      .map((d) => Object.assign({}, d.data(), { id: d.id }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  async function recordDrawing(data) {
    await ensureSeeded();
    const amount = money(data.amount);
    const date = data.date || window.TCVNumbers.isoToday();
    const bankCode = bankGlCode(data.bankAccountId);
    return postJournal({
      date,
      memo: data.memo || 'Owner drawing',
      sourceType: 'DRAW',
      sourceId: 'draw_' + Date.now(),
      bankAccountId: data.bankAccountId || '',
      lines: [line(CODES.DRAWINGS, amount, 0), line(bankCode, 0, amount)],
      allowDuplicate: true,
    });
  }

  async function recordTransfer(data) {
    await ensureSeeded();
    const amount = money(data.amount);
    if (amount <= 0) throw new Error('Enter an amount to transfer.');
    const date = data.date || window.TCVNumbers.isoToday();
    const from = bankAccounts.find((b) => b.id === data.fromBankId);
    const to = bankAccounts.find((b) => b.id === data.toBankId);
    const fromCode = bankGlCode(data.fromBankId);
    const toCode = bankGlCode(data.toBankId);
    if (!from || !to || data.fromBankId === data.toBankId) {
      throw new Error('Choose two different accounts.');
    }
    let memo = data.memo;
    if (!memo) {
      if (isInvestmentAccount(to) && !isInvestmentAccount(from)) memo = 'Park funds in investment';
      else if (isInvestmentAccount(from) && !isInvestmentAccount(to)) memo = 'Withdraw from investment';
      else memo = 'Bank transfer';
    }
    return postJournal({
      date,
      memo,
      sourceType: 'XFER',
      sourceId: 'xfer_' + Date.now(),
      bankAccountId: data.toBankId || '',
      fromBankAccountId: data.fromBankId || '',
      lines: [line(toCode, amount, 0, memo), line(fromCode, 0, amount, memo)],
      allowDuplicate: true,
    });
  }

  async function recordInvestmentReturn(data) {
    await ensureSeeded();
    const amount = money(data.amount);
    if (amount <= 0) throw new Error('Enter the return amount.');
    const date = data.date || window.TCVNumbers.isoToday();
    const bankId = data.bankAccountId || '';
    const bank = bankAccounts.find((b) => b.id === bankId);
    const bankCode = bankGlCode(bankId);
    if (!isInvestmentAccount(bank)) throw new Error('Pick the investment account.');
    return postJournal({
      date,
      memo: data.memo || 'Investment return',
      sourceType: 'INVRET',
      sourceId: 'invret_' + Date.now(),
      bankAccountId: bankId,
      lines: [line(bankCode, amount, 0, data.memo || 'Investment return'), line(CODES.OTHER_INCOME, 0, amount)],
      allowDuplicate: true,
    });
  }

  async function recordOpening(data) {
    await ensureSeeded();
    const amount = money(data.amount);
    const date = data.date || window.TCVNumbers.isoToday();
    const acc = accountByCode(data.accountCode);
    if (!acc) throw new Error('Unknown account.');
    const isDebitNormal = acc.type === 'asset' || acc.type === 'expense' || acc.code === CODES.DRAWINGS;
    const lines = isDebitNormal
      ? [line(acc.code, amount, 0, 'Opening'), line(CODES.CAPITAL, 0, amount, 'Opening')]
      : [line(acc.code, 0, amount, 'Opening'), line(CODES.CAPITAL, amount, 0, 'Opening')];
    return postJournal({
      date,
      memo: 'Opening balance ' + acc.code,
      sourceType: 'OPEN',
      sourceId: 'open_' + acc.code + '_' + date,
      lines,
    });
  }

  function balancesFromJournals(journals, opts) {
    opts = opts || {};
    const from = opts.from || '';
    const to = opts.to || '';
    const map = {};
    listAccounts().forEach((a) => {
      map[a.code] = { account: a, debit: 0, credit: 0, net: 0 };
    });
    journals.forEach((j) => {
      if (j.reversedBy) return;
      if (from && j.date < from) return;
      if (to && j.date > to) return;
      (j.lines || []).forEach((l) => {
        const code = l.accountCode;
        if (!map[code]) {
          map[code] = {
            account: { code, name: l.accountName, type: 'expense' },
            debit: 0,
            credit: 0,
            net: 0,
          };
        }
        map[code].debit = money(map[code].debit + money(l.debit));
        map[code].credit = money(map[code].credit + money(l.credit));
      });
    });
    Object.keys(map).forEach((code) => {
      const row = map[code];
      const t = row.account.type;
      if (t === 'asset' || t === 'expense') row.net = money(row.debit - row.credit);
      else row.net = money(row.credit - row.debit);
    });
    return map;
  }

  function agingBuckets(dateStr, dueStr) {
    const due = dueStr && /^\d{4}-\d{2}-\d{2}$/.test(dueStr) ? dueStr : dateStr;
    const d = new Date(due + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.floor((today - d) / 86400000);
    if (days <= 30) return 'current';
    if (days <= 60) return 'd30';
    if (days <= 90) return 'd60';
    return 'd90';
  }

  async function recordInvoicePayment(data) {
    await ensureSeeded();
    const invSnap = await db().collection('invoices').doc(data.invoiceId).get();
    if (!invSnap.exists) throw new Error('Invoice not found.');
    const inv = Object.assign({}, invSnap.data(), { id: invSnap.id });
    const amount = money(Math.min(data.amount, inv.balance));
    if (amount <= 0) throw new Error('Nothing left to collect on this invoice.');
    const date = data.date || window.TCVNumbers.isoToday();
    const bankCode = bankGlCode(data.bankAccountId);
    const payId = 'pay_' + inv.id + '_' + Date.now();
    const jid = await postJournal({
      date,
      memo: 'Payment on ' + (inv.number || inv.id),
      sourceType: 'ARPAY',
      sourceId: payId,
      projectId: inv.projectId,
      clientId: inv.clientId,
      bankAccountId: data.bankAccountId || '',
      lines: [line(bankCode, amount, 0, inv.number), line(CODES.AR, 0, amount, inv.number)],
      allowDuplicate: true,
    });
    const newBal = money(inv.balance - amount);
    await db().collection('invoices').doc(inv.id).set(
      {
        balance: Math.max(0, newBal),
        status: newBal <= 0 ? 'paid' : 'partial',
        updatedAt: now(),
      },
      { merge: true }
    );
    return jid;
  }

  async function listCreditNotes() {
    const snap = await db().collection('creditNotes').get();
    return snap.docs
      .map((d) => Object.assign({}, d.data(), { id: d.id }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function eventDate(row) {
    return String(row.date || '').slice(0, 10);
  }

  async function clientStatement(clientId, from, to) {
    await ensureSeeded();
    if (!clientId) throw new Error('Select a client first.');
    from = String(from || '').slice(0, 10);
    to = String(to || '').slice(0, 10);
    if (!from || !to) throw new Error('Choose a statement period.');
    const [invoices, creditNotes, docSnap, journals] = await Promise.all([
      listInvoices(),
      listCreditNotes(),
      db().collection('documents').where('clientId', '==', clientId).get(),
      listJournals(),
    ]);
    const reversedReceipts = {};
    journals.forEach((j) => {
      if (j.sourceType === 'RCP' && j.sourceId && j.reversedBy) reversedReceipts[j.sourceId] = true;
    });
    const events = [];
    invoices
      .filter((i) => i.clientId === clientId && i.status !== 'void')
      .forEach((i) => {
        events.push({
          date: eventDate(i),
          number: i.number || '',
          type: 'INV',
          debit: money(i.total),
          credit: 0,
        });
      });
    creditNotes
      .filter((c) => c.clientId === clientId)
      .forEach((c) => {
        events.push({
          date: eventDate(c),
          number: c.number || '',
          type: 'CN',
          debit: 0,
          credit: money(c.total),
        });
      });
    docSnap.docs.forEach((d) => {
      const row = Object.assign({}, d.data(), { id: d.id });
      if (row.type === 'RCP') {
        if (reversedReceipts[row.id]) return;
        const fields = (row.payload && row.payload.fields) || {};
        events.push({
          date: String(fields.receiptDate || row.issuedAt || '').slice(0, 10),
          number: row.number || '',
          type: 'RCP',
          debit: 0,
          credit: money(fields.amount),
        });
      }
      if (row.type === 'CN' && !creditNotes.some((c) => c.documentId === row.id || c.id === row.id)) {
        const fields = (row.payload && row.payload.fields) || {};
        const items = (row.payload && row.payload.items) || [];
        const t = invoiceTotalsFromPayload({ fields: fields, items: items });
        events.push({
          date: String(fields.invDate || row.issuedAt || '').slice(0, 10),
          number: row.number || '',
          type: 'CN',
          debit: 0,
          credit: money(t.total),
        });
      }
    });
    events.sort((a, b) => {
      const d = String(a.date).localeCompare(String(b.date));
      if (d) return d;
      return String(a.number).localeCompare(String(b.number));
    });
    let opening = 0;
    const rows = [];
    events.forEach((ev) => {
      if (!ev.date) return;
      if (ev.date < from) {
        opening = money(opening + ev.debit - ev.credit);
        return;
      }
      if (ev.date > to) return;
      rows.push(ev);
    });
    let running = opening;
    const lined = rows.map((ev) => {
      running = money(running + ev.debit - ev.credit);
      return Object.assign({}, ev, { balance: running });
    });
    return {
      clientId,
      from,
      to,
      opening,
      closing: running,
      rows: lined,
    };
  }

  async function dumpCollection(name) {
    const snap = await db().collection(name).get();
    return snap.docs.map((d) => JSON.parse(JSON.stringify(Object.assign({ id: d.id }, d.data()))));
  }

  async function exportBackup() {
    await ensureSeeded();
    const names = [
      'clients',
      'projects',
      'workers',
      'documents',
      'invoices',
      'creditNotes',
      'bills',
      'billPayments',
      'expenses',
      'journals',
      'accounts',
      'bankAccounts',
      'vendors',
      'workerPayments',
      'periods',
    ];
    const collections = {};
    for (let i = 0; i < names.length; i++) {
      collections[names[i]] = await dumpCollection(names[i]);
    }
    const metaSnap = await db().collection('meta').doc('ledger').get();
    return {
      exportedAt: now(),
      app: 'ChendAwan Tools',
      meta: metaSnap.exists ? JSON.parse(JSON.stringify(metaSnap.data())) : {},
      collections,
    };
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function journalsCsv(journals) {
    const header = ['date', 'memo', 'source', 'account', 'debit', 'credit'];
    const lines = [header.join(',')];
    (journals || []).forEach((j) => {
      (j.lines || []).forEach((l) => {
        lines.push(
          [
            csvCell(j.date),
            csvCell(j.memo),
            csvCell((j.sourceType || '') + (j.sourceId ? ' ' + j.sourceId : '')),
            csvCell((l.accountCode || '') + ' ' + (l.accountName || '')),
            csvCell(money(l.debit).toFixed(2)),
            csvCell(money(l.credit).toFixed(2)),
          ].join(',')
        );
      });
    });
    return lines.join('\r\n');
  }

  async function listOrphanInvoices() {
    const [docSnap, invSnap] = await Promise.all([
      db().collection('documents').where('type', '==', 'INV').get(),
      db().collection('invoices').get(),
    ]);
    const posted = {};
    invSnap.docs.forEach((d) => {
      posted[d.id] = true;
    });
    return docSnap.docs
      .filter((d) => !posted[d.id])
      .map((d) => Object.assign({}, d.data(), { id: d.id }));
  }

  return {
    CODES,
    SEED_ACCOUNTS,
    money,
    periodKey,
    ensureSeeded,
    resetLedgerBooks,
    loadCaches,
    listAccounts,
    listBankAccounts,
    accountByCode,
    accountById,
    defaultBankAccount,
    isInvestmentAccount,
    bankGlCode,
    saveMeta,
    getMeta: function () {
      return Object.assign({}, meta);
    },
    upsertAccount,
    upsertBankAccount,
    postJournal,
    updateJournal,
    reverseJournal,
    setPeriodLocked,
    isPeriodLocked,
    listJournals,
    listInvoices,
    listCreditNotes,
    listBills,
    listExpenses,
    listVendors,
    upsertVendor,
    onDocumentCommitted,
    recordManualInvoice,
    updateInvoice,
    setInvoiceStatus,
    INVOICE_STATUSES,
    recordBill,
    updateBill,
    payBill,
    recordExpense,
    updateExpense,
    payWorker,
    listWorkerPayments,
    recordDrawing,
    recordTransfer,
    recordInvestmentReturn,
    recordOpening,
    balancesFromJournals,
    agingBuckets,
    findInvoiceByNumber,
    recordInvoicePayment,
    listOrphanInvoices,
    clientStatement,
    exportBackup,
    journalsCsv,
    line,
  };
})();
