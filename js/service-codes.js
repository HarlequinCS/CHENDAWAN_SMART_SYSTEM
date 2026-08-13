/**
 * Registered service codes (ChendAwan.md).
 * Documents should reference these codes on line items.
 */
window.TCV_SERVICE_CODES = [
  { code: 'WSD-100/01', group: 'WSD', name: 'Custom Web Portal Development' },
  { code: 'WSD-100/02', group: 'WSD', name: 'E-Commerce Platform Integration' },
  { code: 'WSD-100/03', group: 'WSD', name: 'System API Integration & Automation' },
  { code: 'WSD-100/04', group: 'WSD', name: 'UI/UX Design & Interface Overhaul' },
  { code: 'CYB-200/01', group: 'CYB', name: 'Comprehensive Vulnerability Assessment' },
  { code: 'CYB-200/02', group: 'CYB', name: 'Web Application Penetration Testing' },
  { code: 'CYB-200/03', group: 'CYB', name: 'Network Security Architecture Review' },
  { code: 'CYB-200/04', group: 'CYB', name: 'Threat Intelligence & Incident Reporting' },
  { code: 'IOT-300/01', group: 'IOT', name: 'Smart System Architecture & Design' },
  { code: 'IOT-300/02', group: 'IOT', name: 'Microcontroller & Sensor Integration' },
  { code: 'IOT-300/03', group: 'IOT', name: 'Real-Time Data Streaming (MQTT/WebSockets)' },
  { code: 'IOT-300/04', group: 'IOT', name: 'IoT Analytics Dashboard Development' },
  { code: 'DBM-400/01', group: 'DBM', name: 'Database Architecture & Design' },
  { code: 'DBM-400/02', group: 'DBM', name: 'Secure Database Migration' },
  { code: 'DBM-400/03', group: 'DBM', name: 'Database Query Optimization & Maintenance' },
  { code: 'ITC-500/01', group: 'ITC', name: 'Technical Project Management Services' },
  { code: 'ITC-500/02', group: 'ITC', name: 'Enterprise IT Infrastructure Consulting' },
  { code: 'ITC-500/03', group: 'ITC', name: 'Code Review & Quality Assurance' },
];

window.TCV_SERVICE_GROUPS = {
  WSD: 'Web & Software Development',
  CYB: 'Cybersecurity Consulting',
  IOT: 'Internet of Things Systems',
  DBM: 'Database Management',
  ITC: 'IT Consultancy & Project Management',
};

window.tcvFindService = function (code) {
  return (window.TCV_SERVICE_CODES || []).find((s) => s.code === code) || null;
};

window.tcvServiceOptionsHtml = function (selected) {
  const codes = window.TCV_SERVICE_CODES || [];
  const groups = window.TCV_SERVICE_GROUPS || {};
  let html = '<option value="">— Select service code —</option>';
  let lastGroup = '';
  codes.forEach((s) => {
    if (s.group !== lastGroup) {
      if (lastGroup) html += '</optgroup>';
      html += `<optgroup label="${s.group} — ${groups[s.group] || s.group}">`;
      lastGroup = s.group;
    }
    const sel = s.code === selected ? ' selected' : '';
    html += `<option value="${s.code}"${sel}>${s.code} — ${s.name}</option>`;
  });
  if (lastGroup) html += '</optgroup>';
  return html;
};
