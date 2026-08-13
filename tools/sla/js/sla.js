window.TCVLegal.boot({
  prefix: window.TCVNumbers.PREFIX.sla,
  storageKey: 'chendawan_sla_draft_v1',
  sheetId: 'sla-sheet',
  filePrefix: 'SLA',
  noId: 'docNo',
  hintId: 'docNoHint',
  relatedId: 'relatedNo',
  fieldIds: [
    'serviceCode', 'jobNo', 'issueNo', 'docNo', 'relatedNo',
    'clientName', 'clientAddr', 'projName', 'businessHours', 'supportChannel',
    'effDate', 'signDate', 'clientSignName', 'clientSignTitle',
  ],
  extraDefaults: function () {
    const c = window.TCV_COMPANY || {};
    return {
      businessHours: '9:00 a.m. to 6:00 p.m.',
      supportChannel: (c.email || 'iqbal.chendawan@gmail.com') + ' / ' + (c.phone || '+60 14-720 7787'),
    };
  },
});
