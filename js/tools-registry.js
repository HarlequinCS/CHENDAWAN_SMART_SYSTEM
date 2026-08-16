/**
 * Register tools here. Hub home reads this list to render the catalogue.
 *
 * status: 'ready' | 'coming-soon'
 */
window.CHENDAWAN_TOOLS = [
  {
    id: 'clients',
    name: 'Clients',
    description: 'Register businesses and individuals once, then pick them on every document.',
    href: 'tools/clients/',
    status: 'ready',
    group: 'records',
  },
  {
    id: 'projects',
    name: 'Projects',
    description: 'Create a job for a client. Document numbers and issues follow the project.',
    href: 'tools/projects/',
    status: 'ready',
    group: 'records',
  },
  {
    id: 'workforce',
    name: 'Workforce',
    description: 'Register employees, independent contractors, and freelancers you pay.',
    href: 'tools/workforce/',
    status: 'ready',
    group: 'records',
  },
  {
    id: 'invoice',
    name: 'Invoice Generator',
    description: 'Build branded invoices and credit notes, then download as PDF.',
    href: 'tools/invoice/',
    status: 'ready',
  },
  {
    id: 'quotation',
    name: 'Quotation Builder',
    description: 'Draft client quotations with matching ChendAwan branding.',
    href: 'tools/quotation/',
    status: 'ready',
  },
  {
    id: 'receipt',
    name: 'Receipt Maker',
    description: 'Issue payment receipts linked to invoice references.',
    href: 'tools/receipt/',
    status: 'ready',
  },
  {
    id: 'nda',
    name: 'Mutual NDA',
    description: 'Fill a mutual non-disclosure agreement for client work.',
    href: 'tools/nda/',
    status: 'ready',
  },
  {
    id: 'msa',
    name: 'Master Service Agreement',
    description: 'Generate the TCV master service agreement for a client.',
    href: 'tools/msa/',
    status: 'ready',
  },
  {
    id: 'sla',
    name: 'Service Level Agreement',
    description: 'Issue an SLA with response times and support terms.',
    href: 'tools/sla/',
    status: 'ready',
  },
  {
    id: 'privacy',
    name: 'Privacy Policy',
    description: 'Generate the TEAM CHENDAWAN VENTURES PDPA privacy policy.',
    href: 'tools/privacy/',
    status: 'ready',
  },
  {
    id: 'ica',
    name: 'Independent Contractor Agreement',
    description: 'Engage a freelancer or contractor with Appendix A scope and fees.',
    href: 'tools/ica/',
    status: 'ready',
  },
  {
    id: 'payslip',
    name: 'Payslip / Payment Advice',
    description: 'Issue a payslip for employees or a payment advice for contractors.',
    href: 'tools/payslip/',
    status: 'ready',
  },
  {
    id: 'ledger',
    name: 'Smart Ledger',
    description: 'Hybrid books: invoices, bills, bank, payroll journals, and tax pack.',
    href: 'tools/ledger/',
    status: 'ready',
    group: 'finance',
  },
];
