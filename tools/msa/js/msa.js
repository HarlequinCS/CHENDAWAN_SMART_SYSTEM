window.TCVLegal.boot({
  prefix: window.TCVNumbers.PREFIX.msa,
  storageKey: 'chendawan_msa_draft_v1',
  sheetId: 'msa-sheet',
  filePrefix: 'MSA',
  noId: 'docNo',
  hintId: 'docNoHint',
  relatedId: 'relatedNo',
  fieldIds: [
    'serviceCode', 'jobNo', 'issueNo', 'docNo', 'relatedNo',
    'clientName', 'clientAddr', 'effDate', 'signDate',
    'clientSignName', 'clientSignTitle',
  ],
});
