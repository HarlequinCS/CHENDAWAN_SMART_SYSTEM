/**
 * Firebase Auth + Firestore for ChendAwan Tools.
 * Pages load the compat CDN, firebase-config.js, then this file.
 */
window.TCVFirebase = (function () {
  let app;
  let auth;
  let db;

  function loginHref() {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    if (path.indexOf('/tools/') !== -1) return '../../login.html';
    return 'login.html';
  }

  function homeHref() {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    if (path.indexOf('/tools/') !== -1) return '../../';
    return 'index.html';
  }

  function init() {
    if (db) return { app, auth, db };
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK did not load.');
    }
    if (!window.TCV_FIREBASE_CONFIG || !window.TCV_FIREBASE_CONFIG.apiKey) {
      throw new Error('Missing js/firebase-config.js — copy it from firebase-config.example.js.');
    }
    app = firebase.apps && firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(window.TCV_FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    return { app, auth, db };
  }

  function getDb() {
    init();
    return db;
  }

  function getAuth() {
    init();
    return auth;
  }

  function currentUser() {
    return getAuth().currentUser;
  }

  function requireAuth() {
    try {
      init();
    } catch (e) {
      document.documentElement.classList.remove('auth-wait');
      if ((window.location.pathname || '').indexOf('login.html') === -1) {
        window.location.href = loginHref();
      }
      return Promise.reject(e);
    }
    document.documentElement.classList.add('auth-wait');
    return new Promise((resolve, reject) => {
      const unsub = getAuth().onAuthStateChanged((user) => {
        unsub();
        if (!user) {
          window.location.href = loginHref();
          reject(new Error('Not signed in'));
          return;
        }
        document.documentElement.classList.remove('auth-wait');
        resolve(user);
      });
    });
  }

  function signIn(email, password) {
    return getAuth().signInWithEmailAndPassword(email, password);
  }

  function signOut() {
    return getAuth().signOut().then(() => {
      window.location.href = loginHref();
    });
  }

  function isoNow() {
    return new Date().toISOString();
  }

  async function nextJobNo(year) {
    year = parseInt(year, 10) || new Date().getFullYear();
    const ref = getDb().collection('counters').doc('jobs');
    return getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      let last = 0;
      if (snap.exists) {
        const data = snap.data() || {};
        if (parseInt(data.year, 10) === year) last = parseInt(data.last, 10) || 0;
      }
      const next = last + 1;
      tx.set(ref, { year, last: next, updatedAt: isoNow() }, { merge: true });
      return next;
    });
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  async function commitDocument(opts) {
    const prefix = opts.type;
    const projectId = val('projectId');
    if (!projectId) throw new Error('Select a project first.');
    const clientId = val('clientId') || '';
    const workerId = val('workerId') || '';
    const pref = getDb().collection('projects').doc(projectId);
    const docRef = getDb().collection('documents').doc();
    const payload = typeof opts.collectState === 'function' ? opts.collectState() : {};
    const result = await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(pref);
      if (!snap.exists) throw new Error('Project not found.');
      const p = snap.data() || {};
      const issues = Object.assign({}, p.issues || {});
      const issue = (parseInt(issues[prefix], 10) || 0) + 1;
      issues[prefix] = issue;
      const number = window.TCVNumbers.build({
        prefix,
        year: p.year,
        job: p.jobNo,
        code: p.serviceCode,
        issue,
      });
      if (!number) throw new Error('Could not build a document number. Check the project service code.');
      tx.update(pref, { issues: issues, updatedAt: isoNow() });
      tx.set(docRef, {
        type: prefix,
        projectId,
        clientId: clientId || p.clientId || '',
        workerId: workerId || '',
        year: p.year,
        jobNo: p.jobNo,
        serviceCode: p.serviceCode,
        issue,
        number,
        issuedAt: isoNow(),
        payload,
      });
      return { number, issue, id: docRef.id, year: p.year, jobNo: p.jobNo, serviceCode: p.serviceCode };
    });
    if (window.TCVLedger && typeof window.TCVLedger.onDocumentCommitted === 'function') {
      await window.TCVLedger.onDocumentCommitted({
        type: prefix,
        documentId: result.id,
        number: result.number,
        projectId,
        clientId: clientId || '',
        workerId,
        payload,
      });
    }
    const issueEl = document.getElementById('issueNo');
    const noEl = document.getElementById(opts.noId);
    if (issueEl) issueEl.value = String(result.issue);
    if (noEl) noEl.value = result.number;
    return result;
  }

  async function afterAuth(fn) {
    await ready;
    const loads = [];
    if (window.TCVClients && window.TCVClients.refresh) loads.push(window.TCVClients.refresh());
    if (window.TCVWorkers && window.TCVWorkers.refresh) loads.push(window.TCVWorkers.refresh());
    if (window.TCVProjects && window.TCVProjects.refresh) loads.push(window.TCVProjects.refresh());
    await Promise.all(loads);
    if (typeof fn === 'function') return fn();
  }

  const ready = (function () {
    const skip = document.body && document.body.getAttribute('data-auth') === 'skip';
    if (skip) {
      try {
        init();
      } catch (e) {}
      return Promise.resolve(null);
    }
    try {
      return requireAuth();
    } catch (e) {
      document.documentElement.classList.remove('auth-wait');
      return Promise.reject(e);
    }
  })();

  return {
    init,
    db: getDb,
    auth: getAuth,
    currentUser,
    requireAuth,
    signIn,
    signOut,
    loginHref,
    homeHref,
    nextJobNo,
    commitDocument,
    isoNow,
    afterAuth,
    ready,
  };
})();
