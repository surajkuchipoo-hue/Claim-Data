import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAppsScriptBatchPayload,
  buildAppsScriptPayload,
  buildMasterRow,
  buildPanelRow,
  buildSetupTabsPayload,
  computePanelMetrics,
  computeReturnSummary,
  deduplicateBatchRecords,
  DEFAULT_SELLER_PANELS,
  DEFAULT_SHEETS_CONFIG,
  deriveSyncStatus,
  extractSpreadsheetId,
  findDuplicateScan,
  formatScanTimestamp,
  generateSingleSheetAppsScriptCode,
  MASTER_SHEET_HEADERS,
  normalizeTrackingId,
  PANEL_SHEET_HEADERS,
  recordsToCsv,
  sanitizeSheetTabName,
  validateAppsScriptUrl,
  validatePacketInput,
} from './sheetsPayload';
import type { PacketRecord } from '../types/packet';

const sampleRecord: PacketRecord = {
  id: 'SCN-1001',
  trackingId: 'AWB99482011',
  panelId: 'panel-ajio',
  panelName: 'Ajio',
  returnType: 'Customer Return',
  remark: 'Wrong Received',
  customNote: 'Received blue mug instead of steel flask',
  entryMode: 'Barcode Scanner',
  scanDate: '2026-11-18',
  scanTime: '10:15:30',
  scannedAtIso: '2026-11-18T10:15:30.000Z',
  syncStatus: 'Pending Sync',
  masterSynced: false,
  panelSynced: false,
};

test('normalizeTrackingId trims spaces and uppercases barcodes', () => {
  assert.equal(normalizeTrackingId('  awb 9948 2011 '), 'AWB99482011');
  assert.equal(normalizeTrackingId('rto-7712'), 'RTO-7712');
});

test('validatePacketInput rejects empty or short tracking IDs', () => {
  const emptyRes = validatePacketInput({
    trackingId: '   ',
    panelId: 'panel-amazon',
    returnType: 'Customer Return',
    remark: 'Wrong Received',
  });
  assert.equal(emptyRes.valid, false);

  const shortRes = validatePacketInput({
    trackingId: 'AB1',
    panelId: 'panel-amazon',
    returnType: 'RTO',
    remark: 'Tampering Case',
  });
  assert.equal(shortRes.valid, false);

  const validRes = validatePacketInput({
    trackingId: ' awb12345 ',
    panelId: 'panel-amazon',
    returnType: 'RTO',
    remark: 'Tampering Case',
  });
  assert.equal(validRes.valid, true);
  assert.equal(validRes.normalizedTrackingId, 'AWB12345');
});

test('findDuplicateScan and deduplicateBatchRecords block duplicates regardless of case/spacing', () => {
  const match = findDuplicateScan([sampleRecord], ' awb99482011 ');
  assert.ok(match);
  assert.equal(match.id, 'SCN-1001');
  assert.equal(findDuplicateScan([sampleRecord], 'AWB00000000'), undefined);

  const dupRecord: PacketRecord = {
    ...sampleRecord,
    id: 'SCN-1009',
    trackingId: 'awb 99482011',
  };
  const deduped = deduplicateBatchRecords([sampleRecord, dupRecord]);
  assert.equal(deduped.unique.length, 1);
  assert.equal(deduped.duplicates.length, 1);
  assert.equal(deduped.duplicates[0].id, 'SCN-1009');
});

test('sanitizeSheetTabName strips prohibited Google Sheets characters', () => {
  assert.equal(
    sanitizeSheetTabName('Master: [Data] / *2026*?'),
    'Master Data 2026'
  );
  assert.equal(sanitizeSheetTabName('   '), 'Master Data');
});

test('extractSpreadsheetId parses full Google Sheets URLs and raw IDs', () => {
  assert.equal(
    extractSpreadsheetId(
      'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'
    ),
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  );
  assert.equal(
    extractSpreadsheetId('  1AbCdEfGhIjK_12345  '),
    '1AbCdEfGhIjK_12345'
  );
});

test('buildMasterRow and buildPanelRow omit Scan ID and ISO Timestamp (8-col and 7-col)', () => {
  assert.equal(MASTER_SHEET_HEADERS.length, 8);
  assert.equal(PANEL_SHEET_HEADERS.length, 7);
  assert.equal((MASTER_SHEET_HEADERS as readonly string[]).includes('Scan ID'), false);
  assert.equal((MASTER_SHEET_HEADERS as readonly string[]).includes('ISO Timestamp'), false);
  assert.equal((PANEL_SHEET_HEADERS as readonly string[]).includes('Scan ID'), false);
  assert.equal((PANEL_SHEET_HEADERS as readonly string[]).includes('ISO Timestamp'), false);

  const masterRow = buildMasterRow(sampleRecord);
  assert.equal(masterRow.length, 8);
  assert.equal(masterRow[0], 'AWB99482011');
  assert.equal(masterRow[1], 'Ajio');
  assert.equal(masterRow[2], 'Customer Return');
  assert.equal(masterRow[3], 'Wrong Received');

  const panelRow = buildPanelRow(sampleRecord);
  assert.equal(panelRow.length, 7);
  assert.equal(panelRow[0], 'AWB99482011');
  assert.equal(panelRow[1], 'Customer Return');
  assert.equal(panelRow[2], 'Wrong Received');
});

test('deriveSyncStatus handles synced, partial, pending, and error states', () => {
  assert.equal(deriveSyncStatus(true, true, false), 'Synced');
  assert.equal(deriveSyncStatus(true, false, true), 'Partial Sync');
  assert.equal(deriveSyncStatus(false, true, false), 'Partial Sync');
  assert.equal(deriveSyncStatus(false, false, true), 'Sync Error');
  assert.equal(deriveSyncStatus(false, false, false), 'Pending Sync');
});

test('computePanelMetrics and computeReturnSummary aggregate counts accurately', () => {
  const rtoRecord: PacketRecord = {
    ...sampleRecord,
    id: 'SCN-1002',
    trackingId: 'RTO55100',
    panelId: 'panel-meesho',
    panelName: 'Meesho',
    returnType: 'RTO',
    remark: 'Tampering Case',
    syncStatus: 'Synced',
    masterSynced: true,
    panelSynced: true,
  };
  const records = [sampleRecord, rtoRecord];
  const summary = computeReturnSummary(records);
  assert.equal(summary.total, 2);
  assert.equal(summary.customerReturn, 1);
  assert.equal(summary.rto, 1);
  assert.equal(summary.flaggedIssues, 2);
  assert.equal(summary.synced, 1);
  assert.equal(summary.pending, 1);

  const panelMetrics = computePanelMetrics(records, DEFAULT_SELLER_PANELS);
  assert.equal(panelMetrics.length, 10);
  assert.equal(panelMetrics[9].panelName, 'CRED');
  assert.equal(panelMetrics[0].totalCount, 1);
  assert.equal(panelMetrics[0].customerReturnCount, 1);
  assert.equal(panelMetrics[1].totalCount, 1);
  assert.equal(panelMetrics[1].rtoCount, 1);
});

test('formatScanTimestamp and recordsToCsv produce valid formats', () => {
  const ts = formatScanTimestamp(new Date('2026-11-18T09:05:03.000Z'));
  assert.match(ts.scanDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(ts.scanTime, /^\d{2}:\d{2}:\d{2}$/);

  const csv = recordsToCsv([sampleRecord]);
  assert.ok(csv.includes('Tracking ID,Seller Panel,Return Type'));
  assert.ok(csv.includes('AWB99482011,Ajio,Customer Return'));
});

test('validateAppsScriptUrl accepts valid Apps Script URLs and rejects invalid domains', () => {
  const ok = validateAppsScriptUrl(
    ' https://script.google.com/macros/s/AKfycbx123/exec '
  );
  assert.equal(ok.valid, true);
  assert.equal(
    ok.cleaned,
    'https://script.google.com/macros/s/AKfycbx123/exec'
  );

  const badDomain = validateAppsScriptUrl('https://example.com/webhook');
  assert.equal(badDomain.valid, false);

  const empty = validateAppsScriptUrl('   ');
  assert.equal(empty.valid, false);
});

test('buildAppsScriptPayload, buildSetupTabsPayload, and generateSingleSheetAppsScriptCode route Master + Panel tabs with highlighted headings', () => {
  const payload = buildAppsScriptPayload(sampleRecord, DEFAULT_SHEETS_CONFIG);
  assert.equal(payload.action, 'appendScan');
  assert.equal(payload.masterTabName, 'Master Data');
  assert.equal(payload.panelTabName, 'Ajio');
  assert.equal(payload.masterRow.length, 8);
  assert.equal(payload.panelRow.length, 7);

  const setup = buildSetupTabsPayload(DEFAULT_SHEETS_CONFIG, DEFAULT_SELLER_PANELS);
  assert.equal(setup.action, 'setupTabs');
  assert.equal(setup.masterTabName, 'Master Data');
  assert.equal(setup.panelNames.length, 10);
  assert.ok(setup.panelNames.includes('CRED'));

  const batchPayload = buildAppsScriptBatchPayload(
    [sampleRecord],
    DEFAULT_SHEETS_CONFIG
  );
  assert.equal(batchPayload.action, 'appendBatch');
  assert.equal(batchPayload.items.length, 1);
  assert.equal(batchPayload.items[0].masterRow.length, 8);
  assert.equal(batchPayload.items[0].panelRow.length, 7);

  const script = generateSingleSheetAppsScriptCode('Master Data');
  assert.ok(script.includes('function doPost(e)'));
  assert.ok(script.includes("data.action === 'setupTabs'"));
  assert.ok(script.includes("data.action === 'appendBatch'"));
  assert.ok(script.includes('appendRowsFast'));
  assert.ok(script.includes('ensureTabWithHeaders'));
  assert.ok(script.includes('getTrackingIdSet'));
  assert.ok(script.includes('duplicateBlocked'));
  assert.ok(script.includes('skippedDuplicates'));
  assert.ok(script.includes("setBackground('#1E3A8A')"));
  assert.ok(script.includes("setFontColor('#FFFFFF')"));
  assert.ok(script.includes('setFrozenRows(1)'));
  assert.ok(script.includes('scriptVersion: 5'));
});
