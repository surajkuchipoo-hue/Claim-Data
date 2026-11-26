import type {
  PacketRecord,
  ReturnCategory,
  SellerPanelConfig,
  SheetsConfig,
  SyncStatus,
} from '../types/packet';

export const RETURN_REMARKS: Record<ReturnCategory, readonly string[]> = {
  'Customer Return': [
    'Good / Intact',
    'Wrong Received',
    'Qty Short Received',
    'Damaged Item',
    'Empty Box',
    'Other',
  ],
  RTO: [
    'Good / Intact',
    'Packet Missing',
    'Wrong Packet',
    'Tampering Case',
    'Damaged in Transit',
    'Label Unreadable',
    'Other',
  ],
};

export const MASTER_SHEET_HEADERS = [
  'Tracking ID',
  'Seller Panel',
  'Return Type',
  'Remarks',
  'Custom Note',
  'Entry Mode',
  'Scan Date',
  'Scan Time',
] as const;

export const PANEL_SHEET_HEADERS = [
  'Tracking ID',
  'Return Type',
  'Remarks',
  'Custom Note',
  'Entry Mode',
  'Scan Date',
  'Scan Time',
] as const;

export const DEFAULT_SELLER_PANELS: SellerPanelConfig[] = [
  {
    id: 'panel-ajio',
    name: 'Ajio',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-meesho',
    name: 'Meesho',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-firstcry',
    name: 'FirstCry',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-snapdeal',
    name: 'Snapdeal',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-nykaa',
    name: 'Nykaa',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-myntra',
    name: 'Myntra',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-flipkart',
    name: 'Flipkart',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-amazon',
    name: 'Amazon',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-shopify',
    name: 'Shopify',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'panel-cred',
    name: 'CRED',
    active: true,
    createdAt: '2026-11-18T08:00:00.000Z',
  },
];

export const DEFAULT_SHEETS_CONFIG: SheetsConfig = {
  appsScriptWebhookUrl: '',
  spreadsheetId: '',
  spreadsheetTitle: 'Vardhman Claim Pkt. Data Workbook',
  sheetTabName: 'Master Data',
};

export function normalizeTrackingId(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

export function sanitizeSheetTabName(name: string): string {
  // Google Sheets prohibits : \ / ? * [ ] and limits tab names to 100 chars
  const cleaned = name
    .replace(/[:\\/?*\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'Master Data';
  }
  return cleaned.slice(0, 100);
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

export function validatePacketInput(params: {
  trackingId: string;
  panelId: string;
  returnType: ReturnCategory;
  remark: string;
}): { valid: boolean; normalizedTrackingId: string; error?: string } {
  const normalizedTrackingId = normalizeTrackingId(params.trackingId);
  if (!normalizedTrackingId) {
    return {
      valid: false,
      normalizedTrackingId,
      error: 'Enter or scan a Tracking ID before saving.',
    };
  }
  if (normalizedTrackingId.length < 4) {
    return {
      valid: false,
      normalizedTrackingId,
      error: 'Tracking ID must be at least 4 characters.',
    };
  }
  if (!params.panelId.trim()) {
    return {
      valid: false,
      normalizedTrackingId,
      error: 'Select a Seller Panel.',
    };
  }
  if (!params.remark.trim()) {
    return {
      valid: false,
      normalizedTrackingId,
      error: 'Select a packet remark or issue status.',
    };
  }
  return {
    valid: true,
    normalizedTrackingId,
  };
}

export function findDuplicateScan(
  records: PacketRecord[],
  rawTrackingId: string
): PacketRecord | undefined {
  const normalized = normalizeTrackingId(rawTrackingId);
  if (!normalized) {
    return undefined;
  }
  return records.find(
    (record) => normalizeTrackingId(record.trackingId) === normalized
  );
}

export function deduplicateBatchRecords(records: PacketRecord[]): {
  unique: PacketRecord[];
  duplicates: PacketRecord[];
} {
  const seen = new Set<string>();
  const unique: PacketRecord[] = [];
  const duplicates: PacketRecord[] = [];

  for (const record of records) {
    const key = normalizeTrackingId(record.trackingId);
    if (!key) continue;
    if (seen.has(key)) {
      duplicates.push(record);
    } else {
      seen.add(key);
      unique.push(record);
    }
  }
  return { unique, duplicates };
}

export function formatScanTimestamp(date: Date): {
  scanDate: string;
  scanTime: string;
  scannedAtIso: string;
} {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return {
    scanDate: `${year}-${month}-${day}`,
    scanTime: `${hours}:${minutes}:${seconds}`,
    scannedAtIso: date.toISOString(),
  };
}

export function buildMasterRow(record: PacketRecord): string[] {
  return [
    record.trackingId,
    record.panelName,
    record.returnType,
    record.remark,
    record.customNote || '-',
    record.entryMode,
    record.scanDate,
    record.scanTime,
  ];
}

export function buildPanelRow(record: PacketRecord): string[] {
  return [
    record.trackingId,
    record.returnType,
    record.remark,
    record.customNote || '-',
    record.entryMode,
    record.scanDate,
    record.scanTime,
  ];
}

export function deriveSyncStatus(
  masterSynced: boolean,
  panelSynced: boolean,
  hasError: boolean
): SyncStatus {
  if (masterSynced && panelSynced) {
    return 'Synced';
  }
  if (masterSynced || panelSynced) {
    return 'Partial Sync';
  }
  return hasError ? 'Sync Error' : 'Pending Sync';
}

export interface PanelMetricSummary {
  panelId: string;
  panelName: string;
  totalCount: number;
  customerReturnCount: number;
  rtoCount: number;
  issueCount: number;
  syncedCount: number;
  pendingCount: number;
}

export function computePanelMetrics(
  records: PacketRecord[],
  panels: SellerPanelConfig[]
): PanelMetricSummary[] {
  return panels.map((panel) => {
    const panelRecords = records.filter((r) => r.panelId === panel.id);
    return {
      panelId: panel.id,
      panelName: panel.name,
      totalCount: panelRecords.length,
      customerReturnCount: panelRecords.filter(
        (r) => r.returnType === 'Customer Return'
      ).length,
      rtoCount: panelRecords.filter((r) => r.returnType === 'RTO').length,
      issueCount: panelRecords.filter((r) => r.remark !== 'Good / Intact').length,
      syncedCount: panelRecords.filter((r) => r.syncStatus === 'Synced').length,
      pendingCount: panelRecords.filter((r) => r.syncStatus !== 'Synced').length,
    };
  });
}

export function computeReturnSummary(records: PacketRecord[]) {
  const total = records.length;
  const customerReturn = records.filter(
    (r) => r.returnType === 'Customer Return'
  ).length;
  const rto = records.filter((r) => r.returnType === 'RTO').length;
  const flaggedIssues = records.filter(
    (r) => r.remark !== 'Good / Intact'
  ).length;
  const synced = records.filter((r) => r.syncStatus === 'Synced').length;
  const pending = records.filter((r) => r.syncStatus !== 'Synced').length;

  return {
    total,
    customerReturn,
    rto,
    flaggedIssues,
    synced,
    pending,
  };
}

export function recordsToCsv(records: PacketRecord[]): string {
  const escapeCell = (value: string) => {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = MASTER_SHEET_HEADERS.map(escapeCell).join(',');
  const bodyLines = records.map((r) =>
    buildMasterRow(r).map(escapeCell).join(',')
  );
  return [headerLine, ...bodyLines].join('\n');
}

export function validateAppsScriptUrl(rawUrl: string): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  const cleaned = rawUrl.trim();
  if (!cleaned) {
    return {
      valid: false,
      cleaned: '',
      error: 'Paste your Google Apps Script Web App URL.',
    };
  }
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'https:') {
      return {
        valid: false,
        cleaned,
        error: 'Apps Script Web App URL must start with https://.',
      };
    }
    if (
      parsed.hostname !== 'script.google.com' &&
      !parsed.hostname.endsWith('.googleusercontent.com')
    ) {
      return {
        valid: false,
        cleaned,
        error:
          'URL must be a Google Apps Script Web App URL (https://script.google.com/macros/s/.../exec).',
      };
    }
    return { valid: true, cleaned };
  } catch {
    return {
      valid: false,
      cleaned,
      error: 'Enter a valid https://script.google.com/macros/s/.../exec URL.',
    };
  }
}

export function buildSetupTabsPayload(
  config: SheetsConfig,
  panels: SellerPanelConfig[]
) {
  const masterTabName = sanitizeSheetTabName(config.sheetTabName || 'Master Data');
  const panelNames = panels
    .filter((p) => p.active)
    .map((p) => sanitizeSheetTabName(p.name));

  return {
    action: 'setupTabs',
    masterTabName,
    panelNames,
    masterHeaders: [...MASTER_SHEET_HEADERS],
    panelHeaders: [...PANEL_SHEET_HEADERS],
  };
}

export function buildAppsScriptPayload(
  record: PacketRecord,
  config: SheetsConfig
) {
  const masterTabName = sanitizeSheetTabName(config.sheetTabName || 'Master Data');
  const panelTabName = sanitizeSheetTabName(record.panelName || 'Seller Panel');

  return {
    action: 'appendScan',
    masterTabName,
    panelTabName,
    masterHeaders: [...MASTER_SHEET_HEADERS],
    panelHeaders: [...PANEL_SHEET_HEADERS],
    masterRow: buildMasterRow(record),
    panelRow: buildPanelRow(record),
    syncMaster: !record.masterSynced,
    syncPanel: !record.panelSynced,
  };
}

export function buildAppsScriptBatchPayload(
  records: PacketRecord[],
  config: SheetsConfig
) {
  const masterTabName = sanitizeSheetTabName(config.sheetTabName || 'Master Data');
  return {
    action: 'appendBatch',
    masterTabName,
    masterHeaders: [...MASTER_SHEET_HEADERS],
    panelHeaders: [...PANEL_SHEET_HEADERS],
    items: records.map((record) => ({
      id: record.id,
      panelTabName: sanitizeSheetTabName(record.panelName || 'Seller Panel'),
      masterRow: buildMasterRow(record),
      panelRow: buildPanelRow(record),
      syncMaster: !record.masterSynced,
      syncPanel: !record.panelSynced,
    })),
  };
}

export function generateSingleSheetAppsScriptCode(defaultTabName: string): string {
  const safeTab = sanitizeSheetTabName(defaultTabName || 'Master Data')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  return `function ensureTabWithHeaders(ss, tabName, headers, forceStyle) {
  var sheet = ss.getSheetByName(tabName);
  var isNew = false;
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    isNew = true;
  }
  var lastRow = sheet.getLastRow();
  if ((isNew || lastRow <= 1 || forceStyle) && Array.isArray(headers) && headers.length > 0) {
    if (lastRow === 0) {
      sheet.appendRow(headers);
    } else if (lastRow === 1) {
      sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).clearContent();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange
      .setBackground('#1E3A8A')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(10)
      .setVerticalAlignment('middle');
    sheet.setRowHeight(1, 28);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function normId(val) {
  return String(val || '').replace(/\\s+/g, '').toUpperCase();
}

function getTrackingColIndex(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1 || sheet.getLastRow() < 1) return 1;
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  for (var c = 0; c < headerRow.length; c++) {
    if (String(headerRow[c] || '').trim().toLowerCase() === 'tracking id') {
      return c + 1;
    }
  }
  return 1;
}

function getTrackingIdSet(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return map;
  var col = getTrackingColIndex(sheet);
  var vals = sheet.getRange(2, col, lastRow - 1, 1).getDisplayValues();
  for (var r = 0; r < vals.length; r++) {
    var k = normId(vals[r][0]);
    if (k) map[k] = true;
  }
  return map;
}

function extractTrackingFromRow(row, headers) {
  if (!Array.isArray(row) || row.length === 0) return '';
  if (Array.isArray(headers)) {
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim().toLowerCase() === 'tracking id' && i < row.length) {
        return normId(row[i]);
      }
    }
  }
  return normId(row[0]);
}

function appendRowsFast(sheet, rows) {
  if (!rows || rows.length === 0) return;
  if (rows.length === 1) {
    sheet.appendRow(rows[0]);
    return;
  }
  var startRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'preview') {
    var tab = (e.parameter && e.parameter.tab) || '${safeTab}';
    var sh = ss.getSheetByName(tab);
    var rows = sh && sh.getLastRow() > 0
      ? sh.getRange(1, 1, Math.min(sh.getLastRow(), 25), Math.min(sh.getLastColumn(), 10)).getDisplayValues()
      : [];
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      scriptVersion: 5,
      rows: rows,
      tabName: tab,
      title: ss.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  var tabs = ss.getSheets().map(function(s) { return s.getName(); });
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    scriptVersion: 5,
    spreadsheetId: ss.getId(),
    title: ss.getName(),
    tabs: tabs
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var masterName = data.masterTabName || '${safeTab}';

    if (data.action === 'setupTabs') {
      var masterSh = ensureTabWithHeaders(ss, masterName, data.masterHeaders, true);
      var panels = Array.isArray(data.panelNames) ? data.panelNames : [];
      for (var i = 0; i < panels.length; i++) {
        if (panels[i] && panels[i] !== masterName) {
          ensureTabWithHeaders(ss, panels[i], data.panelHeaders, true);
        }
      }
      var allTabs = ss.getSheets().map(function(s) { return s.getName(); });
      var existingMap = getTrackingIdSet(masterSh);
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        scriptVersion: 5,
        spreadsheetId: ss.getId(),
        title: ss.getName(),
        tabs: allTabs,
        existingTrackingIds: Object.keys(existingMap)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'appendBatch' && Array.isArray(data.items)) {
      var mBatchTab = ensureTabWithHeaders(ss, masterName, data.masterHeaders, false);
      var mSeen = getTrackingIdSet(mBatchTab);
      var pSeenMap = {};
      var masterRows = [];
      var panelGroups = {};
      var skippedDuplicates = [];

      for (var k = 0; k < data.items.length; k++) {
        var item = data.items[k];
        var tId = extractTrackingFromRow(item.masterRow, data.masterHeaders) || extractTrackingFromRow(item.panelRow, data.panelHeaders);
        if (tId && mSeen[tId]) {
          skippedDuplicates.push(tId);
          continue;
        }
        if (tId) mSeen[tId] = true;
        if (item.syncMaster !== false && Array.isArray(item.masterRow) && item.masterRow.length > 0) {
          masterRows.push(item.masterRow);
        }
        if (item.syncPanel !== false && item.panelTabName && Array.isArray(item.panelRow) && item.panelRow.length > 0) {
          if (!pSeenMap[item.panelTabName]) {
            var pSh = ensureTabWithHeaders(ss, item.panelTabName, data.panelHeaders, false);
            pSeenMap[item.panelTabName] = { sheet: pSh, seen: getTrackingIdSet(pSh) };
          }
          if (!tId || !pSeenMap[item.panelTabName].seen[tId]) {
            if (tId) pSeenMap[item.panelTabName].seen[tId] = true;
            if (!panelGroups[item.panelTabName]) panelGroups[item.panelTabName] = [];
            panelGroups[item.panelTabName].push(item.panelRow);
          }
        }
      }
      if (masterRows.length > 0) {
        appendRowsFast(mBatchTab, masterRows);
      }
      var panelTabKeys = Object.keys(panelGroups);
      for (var p = 0; p < panelTabKeys.length; p++) {
        var pName = panelTabKeys[p];
        appendRowsFast(pSeenMap[pName].sheet, panelGroups[pName]);
      }
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        scriptVersion: 5,
        batchCount: masterRows.length,
        skippedDuplicates: skippedDuplicates,
        spreadsheetId: ss.getId(),
        title: ss.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var masterSynced = false;
    var panelSynced = false;
    var mRow = Array.isArray(data.masterRow) && data.masterRow.length > 0 ? data.masterRow : data.row;
    var pRow = Array.isArray(data.panelRow) && data.panelRow.length > 0 ? data.panelRow : null;
    var scanId = extractTrackingFromRow(mRow, data.masterHeaders) || extractTrackingFromRow(pRow, data.panelHeaders);

    if (data.syncMaster !== false && Array.isArray(mRow) && mRow.length > 0) {
      var mTab = ensureTabWithHeaders(ss, masterName, data.masterHeaders, false);
      var mIds = getTrackingIdSet(mTab);
      if (scanId && mIds[scanId]) {
        return ContentService.createTextOutput(JSON.stringify({
          ok: true,
          scriptVersion: 5,
          duplicateBlocked: true,
          duplicateTrackingId: scanId,
          masterSynced: false,
          panelSynced: false,
          spreadsheetId: ss.getId(),
          title: ss.getName()
        })).setMimeType(ContentService.MimeType.JSON);
      }
      mTab.appendRow(mRow);
      masterSynced = true;
    }

    if (data.syncPanel !== false && data.panelTabName && Array.isArray(pRow) && pRow.length > 0) {
      var pTab = ensureTabWithHeaders(ss, data.panelTabName, data.panelHeaders, false);
      var pIds = getTrackingIdSet(pTab);
      if (!scanId || !pIds[scanId]) {
        pTab.appendRow(pRow);
      }
      panelSynced = true;
    }

    if (!masterSynced && !panelSynced && (data.syncMaster !== false || data.syncPanel !== false)) {
      throw new Error('No row data received for Master or Panel tab.');
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      scriptVersion: 5,
      duplicateBlocked: false,
      masterSynced: masterSynced,
      panelSynced: panelSynced,
      spreadsheetId: ss.getId(),
      title: ss.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;
}
