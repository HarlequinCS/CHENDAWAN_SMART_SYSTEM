(function () {
  document.documentElement.classList.add('js');
  const EMAIL = 'iqbal.chendawan@gmail.com';
  const WHATSAPP = '60147207787';
  const CONTACT_URL = 'api/contact.php';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function setupNav() {
    const toggle = qs('[data-nav-toggle]');
    const header = qs('.site-header');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = document.documentElement.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    qsa('.site-nav a').forEach((a) => {
      a.addEventListener('click', () => {
        document.documentElement.classList.remove('nav-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    });
    const onScroll = () => {
      if (!header) return;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function setupReveal() {
    const nodes = qsa('[data-reveal]');
    if (!nodes.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((el) => el.classList.add('is-in'));
      return;
    }
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    nodes.forEach((el) => io.observe(el));
  }

  function encodeBody(fields) {
    const lines = [
      'Name: ' + fields.name,
      'Email: ' + fields.email,
      'Phone: ' + fields.phone,
      'Company: ' + (fields.company || '—'),
      '',
      fields.message,
    ];
    return lines.join('\n');
  }

  function mailtoHref(fields) {
    const subject = encodeURIComponent('Project enquiry from ' + fields.name);
    const body = encodeURIComponent(encodeBody(fields));
    return 'mailto:' + EMAIL + '?subject=' + subject + '&body=' + body;
  }

  function whatsappHref(fields) {
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(encodeBody(fields));
  }

  function showFallback(form, fields, status, reason) {
    const box = qs('[data-form-fallback]', form);
    const mail = qs('[data-fallback-mail]', form);
    const wa = qs('[data-fallback-wa]', form);
    if (status) {
      status.textContent = reason || 'Could not send from this host. Use email or WhatsApp instead.';
      status.classList.remove('is-ok');
    }
    if (box) box.classList.add('is-on');
    if (mail) mail.href = mailtoHref(fields);
    if (wa) wa.href = whatsappHref(fields);
  }

  function readFields(form) {
    return {
      name: (qs('[name="name"]', form).value || '').trim(),
      email: (qs('[name="email"]', form).value || '').trim(),
      phone: (qs('[name="phone"]', form).value || '').trim(),
      company: (qs('[name="company"]', form).value || '').trim(),
      message: (qs('[name="message"]', form).value || '').trim(),
      website: (qs('[name="website"]', form).value || '').trim(),
    };
  }

  function setupForm() {
    const form = qs('#contactForm');
    if (!form) return;
    const status = qs('[data-form-status]', form);
    const submit = qs('[type="submit"]', form);

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fields = readFields(form);
      if (!fields.name || !fields.email || !fields.phone || !fields.message) {
        if (status) status.textContent = 'Please fill in name, email, phone, and message.';
        return;
      }
      if (fields.website) {
        if (status) {
          status.textContent = 'Thanks — we will get back to you.';
          status.classList.add('is-ok');
        }
        form.reset();
        return;
      }

      if (submit) submit.disabled = true;
      if (status) {
        status.textContent = 'Sending…';
        status.classList.remove('is-ok');
      }

      fetch(CONTACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: fields.name,
          email: fields.email,
          phone: fields.phone,
          company: fields.company,
          message: fields.message,
          source: location.href,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('bad-status');
          return res.json().catch(() => ({}));
        })
        .then((data) => {
          if (!data || data.ok !== true) throw new Error('not-ok');
          if (status) {
            status.textContent = 'Thanks — we received your message and will reply shortly.';
            status.classList.add('is-ok');
          }
          const box = qs('[data-form-fallback]', form);
          if (box) box.classList.remove('is-on');
          form.reset();
        })
        .catch(() => {
          showFallback(form, fields, status);
        })
        .finally(() => {
          if (submit) submit.disabled = false;
        });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    setupReveal();
    setupForm();
  });
})();
