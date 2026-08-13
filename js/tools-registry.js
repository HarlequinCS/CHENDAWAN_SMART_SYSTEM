/**
 * Register tools here. Hub home reads this list to render the catalogue.
 *
 * status: 'ready' | 'coming-soon'
 */
window.CHENDAWAN_TOOLS = [
  {
    id: 'invoice',
    name: 'Invoice Generator',
    description: 'Build branded invoices with service codes and download as PDF.',
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
    href: '#',
    status: 'coming-soon',
  },
  {
    id: 'msa',
    name: 'Master Service Agreement',
    description: 'Generate the TCV master service agreement for a client.',
    href: '#',
    status: 'coming-soon',
  },
];
