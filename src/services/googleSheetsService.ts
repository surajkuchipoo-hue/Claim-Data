import type {
  PacketRecord,
  SellerPanelConfig,
  SheetMetadata,
  SheetsConfig,
  SyncDispatchResult,
} from '../types/packet';
import {
  buildAppsScriptBatchPayload,
  buildAppsScriptPayload,
  buildSetupTabsPayload,
  deduplicateBatchRecords,
  deriveSyncStatus,
  normalizeTrackingId,
  sanitizeSheetTabName,
  validateAppsScriptUrl,
} from './sheetsPayload';

async function parseAppsScriptResponse<T extends { ok?: boolean; error?: string }>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Apps Script returned HTTP ${res.status}`);
  }
  const trimmed = text.trim();
  if (trimmed.startsWith('<')) {
    throw new Error(
      'Apps Script returned a Google login page instead of JSON. In Apps Script click Deploy -> Manage deployments -> Edit -> set "Who has access" to "Anyone" and deploy a New version.'
    );
  }
  let data: T;
  try {
    data = JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      'Invalid response from Apps Script Web App. Make sure Code.gs is saved and deployed as a New version.'
    );
  }
  if (!data.ok) {
    const rawErr = data.error || 'Apps Script execution failed.';
    if (/appendRow\(\)\s+must\s+not\s+be\s+empty|rowContents/i.test(rawErr)) {
      throw new Error(
        'Your Apps Script Web App is still running an older Code.gs version. Open Google Sheet Link -> Copy Apps Script Code -> paste & Save in Apps Script -> Deploy -> Manage deployments -> Edit (pencil) -> Version: New version -> Deploy.'
      );
    }
    throw new Error(rawErr);
  }
  return data;
}

export async function setupAndTestAppsScript(
  rawUrl: string,
  config: SheetsConfig,
  panels: SellerPanelConfig[]
): Promise<SheetMetadata> {
  const check = validateAppsScriptUrl(rawUrl);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid Google Apps Script URL.');
  }

  const payload = buildSetupTabsPayload(config, panels);
  const res = await fetch(check.cleaned, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseAppsScriptResponse<{
    ok?: boolean;
    scriptVersion?: number;
    spreadsheetId?: string;
    title?: string;
    tabs?: string[];
    existingTrackingIds?: string[];
    error?: string;
  }>(res);

  if (!data.scriptVersion || data.scriptVersion < 3) {
    throw new Error(
      'Apps Script URL is still running an older Code.gs deployment. Copy the latest Code.gs -> paste & Save in Apps Script -> Deploy -> Manage deployments -> Edit (pencil) -> Version: New version -> Deploy.'
    );
  }

  return {
    spreadsheetId: data.spreadsheetId || '',
    title: data.title || 'Connected Google Sheet',
    tabs: Array.isArray(data.tabs) ? data.tabs : [],
    existingTrackingIds: Array.isArray(data.existingTrackingIds)
      ? data.existingTrackingIds
      : [],
  };
}

export async function readAppsScriptPreview(
  rawUrl: string,
  tabName: string
): Promise<{ title: string; tabName: string; rows: string[][] }> {
  const check = validateAppsScriptUrl(rawUrl);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid Google Apps Script URL.');
  }
  const sep = check.cleaned.includes('?') ? '&' : '?';
  const safeTab = sanitizeSheetTabName(tabName || 'Master Data');
  const res = await fetch(
    `${check.cleaned}${sep}action=preview&tab=${encodeURIComponent(safeTab)}`,
    {
      method: 'GET',
      mode: 'cors',
    }
  );
  const data = await parseAppsScriptResponse<{
    ok?: boolean;
    title?: string;
    tabName?: string;
    rows?: string[][];
    error?: string;
  }>(res);

  return {
    title: data.title || 'Google Sheet',
    tabName: data.tabName || safeTab,
    rows: Array.isArray(data.rows) ? data.rows : [],
  };
}

export async function syncPacketRecordViaAppsScript(
  rawUrl: string,
  record: PacketRecord,
  config: SheetsConfig
): Promise<SyncDispatchResult> {
  const check = validateAppsScriptUrl(rawUrl);
  const masterTab = sanitizeSheetTabName(config.sheetTabName || 'Master Data');
  const panelTab = sanitizeSheetTabName(record.panelName || 'Seller Panel');

  if (!check.valid) {
    return {
      masterSynced: record.masterSynced,
      panelSynced: record.panelSynced,
      syncStatus: deriveSyncStatus(
        record.masterSynced,
        record.panelSynced,
        true
      ),
      errorMessage: check.error,
      masterTarget: masterTab,
      panelTarget: panelTab,
    };
  }

  try {
    const payload = buildAppsScriptPayload(record, config);
    const res = await fetch(check.cleaned, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const body = await parseAppsScriptResponse<{
      ok?: boolean;
      duplicateBlocked?: boolean;
      duplicateTrackingId?: string;
      masterSynced?: boolean;
      panelSynced?: boolean;
      error?: string;
    }>(res);

    if (body.duplicateBlocked) {
      return {
        masterSynced: false,
        panelSynced: false,
        syncStatus: 'Sync Error',
        duplicateBlocked: true,
        errorMessage: `Duplicate blocked: ${body.duplicateTrackingId || record.trackingId} already exists in Google Sheet.`,
        masterTarget: masterTab,
        panelTarget: panelTab,
      };
    }

    const masterSynced = record.masterSynced || Boolean(body.masterSynced);
    const panelSynced = record.panelSynced || Boolean(body.panelSynced);

    return {
      masterSynced,
      panelSynced,
      syncStatus: deriveSyncStatus(masterSynced, panelSynced, false),
      masterTarget: masterTab,
      panelTarget: panelTab,
    };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Failed to reach Google Apps Script Web App.';
    return {
      masterSynced: record.masterSynced,
      panelSynced: record.panelSynced,
      syncStatus: deriveSyncStatus(
        record.masterSynced,
        record.panelSynced,
        true
      ),
      errorMessage:
        msg === 'Failed to fetch'
          ? 'Could not reach Apps Script Web App. Check that Deploy -> Who has access is set to "Anyone" and a New version is deployed.'
          : msg,
      masterTarget: masterTab,
      panelTarget: panelTab,
    };
  }
}

export async function syncBatchRecordsViaAppsScript(
  rawUrl: string,
  records: PacketRecord[],
  config: SheetsConfig
): Promise<Map<string, SyncDispatchResult>> {
  const results = new Map<string, SyncDispatchResult>();
  if (records.length === 0) {
    return results;
  }
  if (records.length === 1) {
    const single = await syncPacketRecordViaAppsScript(rawUrl, records[0], config);
    results.set(records[0].id, single);
    return results;
  }

  const check = validateAppsScriptUrl(rawUrl);
  const masterTab = sanitizeSheetTabName(config.sheetTabName || 'Master Data');

  if (!check.valid) {
    for (const rec of records) {
      results.set(rec.id, {
        masterSynced: rec.masterSynced,
        panelSynced: rec.panelSynced,
        syncStatus: deriveSyncStatus(rec.masterSynced, rec.panelSynced, true),
        errorMessage: check.error,
        masterTarget: masterTab,
        panelTarget: sanitizeSheetTabName(rec.panelName || 'Seller Panel'),
      });
    }
    return results;
  }

  try {
    const { unique, duplicates } = deduplicateBatchRecords(records);
    for (const dup of duplicates) {
      results.set(dup.id, {
        masterSynced: false,
        panelSynced: false,
        syncStatus: 'Sync Error',
        duplicateBlocked: true,
        errorMessage: `Duplicate blocked: ${dup.trackingId} was scanned more than once.`,
        masterTarget: masterTab,
        panelTarget: sanitizeSheetTabName(dup.panelName || 'Seller Panel'),
      });
    }

    if (unique.length === 0) {
      return results;
    }

    const payload = buildAppsScriptBatchPayload(unique, config);
    const res = await fetch(check.cleaned, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseAppsScriptResponse<{
      ok?: boolean;
      batchCount?: number;
      skippedDuplicates?: string[];
      error?: string;
    }>(res);

    const skippedSet = new Set(
      (data.skippedDuplicates || []).map((id) => normalizeTrackingId(id))
    );

    for (const rec of unique) {
      const norm = normalizeTrackingId(rec.trackingId);
      const panelTarget = sanitizeSheetTabName(rec.panelName || 'Seller Panel');
      if (skippedSet.has(norm)) {
        results.set(rec.id, {
          masterSynced: false,
          panelSynced: false,
          syncStatus: 'Sync Error',
          duplicateBlocked: true,
          errorMessage: `Duplicate blocked: ${rec.trackingId} already exists in Google Sheet.`,
          masterTarget: masterTab,
          panelTarget,
        });
      } else {
        results.set(rec.id, {
          masterSynced: true,
          panelSynced: true,
          syncStatus: 'Synced',
          masterTarget: masterTab,
          panelTarget,
        });
      }
    }
    return results;
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Failed to reach Google Apps Script Web App.';
    // Automatic fallback if deployed Code.gs is v3 without appendBatch
    if (/No row data received/i.test(msg)) {
      for (const rec of records) {
        const single = await syncPacketRecordViaAppsScript(rawUrl, rec, config);
        results.set(rec.id, single);
      }
      return results;
    }

    const friendly =
      msg === 'Failed to fetch'
        ? 'Could not reach Apps Script Web App. Check that Deploy -> Who has access is set to "Anyone" and a New version is deployed.'
        : msg;

    for (const rec of records) {
      results.set(rec.id, {
        masterSynced: rec.masterSynced,
        panelSynced: rec.panelSynced,
        syncStatus: deriveSyncStatus(rec.masterSynced, rec.panelSynced, true),
        errorMessage: friendly,
        masterTarget: masterTab,
        panelTarget: sanitizeSheetTabName(rec.panelName || 'Seller Panel'),
      });
    }
    return results;
  }
}
