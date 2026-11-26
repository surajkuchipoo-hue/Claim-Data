import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Link2,
  Menu,
  Moon,
  ScanBarcode,
  Sheet,
  Sun,
  Table2,
  X,
} from 'lucide-react';
import type {
  EntryMode,
  PacketRecord,
  ReturnCategory,
  SellerPanelConfig,
  SheetMetadata,
  SheetsConfig,
} from './types/packet';
import {
  readAppsScriptPreview,
  setupAndTestAppsScript,
  syncBatchRecordsViaAppsScript,
  syncPacketRecordViaAppsScript,
} from './services/googleSheetsService';
import {
  extractSpreadsheetId,
  findDuplicateScan,
  formatScanTimestamp,
  normalizeTrackingId,
  validateAppsScriptUrl,
} from './services/sheetsPayload';
import {
  loadPacketRecords,
  loadSellerPanels,
  loadSheetsConfig,
  savePacketRecords,
  saveSellerPanels,
  saveSheetsConfig,
} from './services/storage';
import { ScanStation } from './components/ScanStation';

const MasterLedger = lazy(() =>
  import('./components/MasterLedger').then((m) => ({ default: m.MasterLedger }))
);
const GoogleSheetLinkView = lazy(() =>
  import('./components/GoogleSheetLinkView').then((m) => ({
    default: m.GoogleSheetLinkView,
  }))
);
const ConfirmDialog = lazy(() =>
  import('./components/ConfirmDialog').then((m) => ({
    default: m.ConfirmDialog,
  }))
);

type ActiveView = 'scan' | 'ledger' | 'sheet-link';

interface PendingConfirmState {
  title: string;
  description: string;
  details: string[];
  confirmLabel: string;
  variant: 'primary' | 'danger';
  action: () => Promise<void>;
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('scan');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('vardhman_theme_v1');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('vardhman_theme_v1', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const [records, setRecords] = useState<PacketRecord[]>(() =>
    loadPacketRecords()
  );
  const [panels, setPanels] = useState<SellerPanelConfig[]>(() =>
    loadSellerPanels()
  );
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig>(() =>
    loadSheetsConfig()
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetMetadata, setSheetMetadata] = useState<SheetMetadata | null>(
    null
  );
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [previewData, setPreviewData] = useState<{
    title: string;
    tabName: string;
    rows: string[][];
  } | null>(null);
  const [confirmState, setConfirmState] = useState<PendingConfirmState | null>(
    null
  );
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    savePacketRecords(records);
  }, [records]);

  useEffect(() => {
    saveSellerPanels(panels);
  }, [panels]);

  useEffect(() => {
    saveSheetsConfig(sheetsConfig);
  }, [sheetsConfig]);

  const isSyncReady = validateAppsScriptUrl(
    sheetsConfig.appsScriptWebhookUrl
  ).valid;
  const resolvedSheetId = extractSpreadsheetId(sheetsConfig.spreadsheetId);

  const bgQueueRef = useRef<PacketRecord[]>([]);
  const bgWorkerRunningRef = useRef(false);
  const sheetsConfigRef = useRef(sheetsConfig);
  sheetsConfigRef.current = sheetsConfig;
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const sheetTrackingIdsRef = useRef<Set<string>>(new Set());

  const drainBackgroundSyncQueue = useCallback(async () => {
    if (bgWorkerRunningRef.current) return;
    bgWorkerRunningRef.current = true;
    try {
      while (bgQueueRef.current.length > 0) {
        const currentConfig = sheetsConfigRef.current;
        if (!validateAppsScriptUrl(currentConfig.appsScriptWebhookUrl).valid) {
          bgQueueRef.current = [];
          break;
        }
        const batch = bgQueueRef.current.splice(0, bgQueueRef.current.length);
        const resultMap = await syncBatchRecordsViaAppsScript(
          currentConfig.appsScriptWebhookUrl,
          batch,
          currentConfig
        );

        let firstError = '';
        const blockedIds = new Set<string>();
        setRecords((prev) =>
          prev
            .map((item) => {
              const res = resultMap.get(item.id);
              if (!res) return item;
              if (res.duplicateBlocked) {
                blockedIds.add(item.id);
                sheetTrackingIdsRef.current.add(
                  normalizeTrackingId(item.trackingId)
                );
                if (!firstError && res.errorMessage) {
                  firstError = res.errorMessage;
                }
                return null;
              }
              if (res.syncStatus === 'Synced') {
                sheetTrackingIdsRef.current.add(
                  normalizeTrackingId(item.trackingId)
                );
              }
              if (!firstError && res.errorMessage) {
                firstError = res.errorMessage;
              }
              return {
                ...item,
                masterSynced: res.masterSynced,
                panelSynced: res.panelSynced,
                syncStatus: res.syncStatus,
                lastSyncError: res.errorMessage,
              };
            })
            .filter((item): item is PacketRecord => item !== null)
        );
        if (blockedIds.size > 0) {
          recordsRef.current = recordsRef.current.filter(
            (r) => !blockedIds.has(r.id)
          );
        }
        if (firstError) {
          setNotice({
            type: 'error',
            text: firstError,
          });
        }
      }
    } finally {
      bgWorkerRunningRef.current = false;
    }
  }, []);

  const handleLogPacket = async (input: {
    trackingId: string;
    panelId: string;
    returnType: ReturnCategory;
    remark: string;
    customNote: string;
    entryMode: EntryMode;
  }): Promise<{
    record: PacketRecord | null;
    duplicateMatch?: PacketRecord;
    duplicateInSheet?: boolean;
  }> => {
    const normalized = normalizeTrackingId(input.trackingId);
    const existingOnScreen = findDuplicateScan(recordsRef.current, normalized);
    if (existingOnScreen) {
      return { record: null, duplicateMatch: existingOnScreen };
    }
    if (sheetTrackingIdsRef.current.has(normalized)) {
      return { record: null, duplicateInSheet: true };
    }

    const panel = panels.find((p) => p.id === input.panelId) ?? panels[0];
    const now = new Date();
    const ts = formatScanTimestamp(now);
    const id = `SCN-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    const newRecord: PacketRecord = {
      id,
      trackingId: normalized,
      panelId: panel.id,
      panelName: panel.name,
      returnType: input.returnType,
      remark: input.remark,
      customNote: input.customNote,
      entryMode: input.entryMode,
      scanDate: ts.scanDate,
      scanTime: ts.scanTime,
      scannedAtIso: ts.scannedAtIso,
      syncStatus: 'Pending Sync',
      masterSynced: false,
      panelSynced: false,
    };

    recordsRef.current = [newRecord, ...recordsRef.current];
    setRecords((prev) =>
      findDuplicateScan(prev, normalized) ? prev : [newRecord, ...prev]
    );

    if (isSyncReady) {
      bgQueueRef.current.push(newRecord);
      void drainBackgroundSyncQueue();
    }

    return { record: newRecord };
  };

  const handleSyncSingleRecord = useCallback(
    async (record: PacketRecord) => {
      if (!isSyncReady) {
        setNotice({
          type: 'error',
          text: 'Link your Google Sheet Apps Script URL first in Google Sheet Link.',
        });
        return;
      }

      setIsSyncing(true);
      try {
        const result = await syncPacketRecordViaAppsScript(
          sheetsConfig.appsScriptWebhookUrl,
          record,
          sheetsConfig
        );
        setRecords((prev) =>
          prev.map((item) =>
            item.id === record.id
              ? {
                  ...item,
                  masterSynced: result.masterSynced,
                  panelSynced: result.panelSynced,
                  syncStatus: result.syncStatus,
                  lastSyncError: result.errorMessage,
                }
              : item
          )
        );
        if (result.errorMessage) {
          setNotice({
            type: 'error',
            text: result.errorMessage,
          });
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [sheetsConfig, isSyncReady]
  );

  const executeBatchSync = useCallback(
    async (pendingList: PacketRecord[]) => {
      if (!isSyncReady) return;

      setIsSyncing(true);
      try {
        const resultMap = await syncBatchRecordsViaAppsScript(
          sheetsConfig.appsScriptWebhookUrl,
          pendingList,
          sheetsConfig
        );

        let syncedCount = 0;
        let failedCount = 0;
        let lastErr = '';

        for (const rec of pendingList) {
          const res = resultMap.get(rec.id);
          if (res?.syncStatus === 'Synced') {
            syncedCount += 1;
            sheetTrackingIdsRef.current.add(normalizeTrackingId(rec.trackingId));
          } else {
            failedCount += 1;
            if (res?.duplicateBlocked) {
              sheetTrackingIdsRef.current.add(
                normalizeTrackingId(rec.trackingId)
              );
            }
            if (res?.errorMessage) lastErr = res.errorMessage;
          }
        }

        setRecords((prev) =>
          prev.map((item) => {
            const res = resultMap.get(item.id);
            if (!res) return item;
            return {
              ...item,
              masterSynced: res.masterSynced,
              panelSynced: res.panelSynced,
              syncStatus: res.syncStatus,
              lastSyncError: res.errorMessage,
            };
          })
        );

        setNotice({
          type: failedCount === 0 ? 'success' : 'error',
          text:
            failedCount === 0
              ? `Synced ${syncedCount} packet record(s) to ${sheetsConfig.sheetTabName} & Panel tabs in Google Sheet.`
              : `Synced ${syncedCount} record(s); ${failedCount} skipped/failed${
                  lastErr ? ` (${lastErr})` : ''
                }.`,
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [sheetsConfig, isSyncReady]
  );

  const requestBatchSync = (pendingList: PacketRecord[]) => {
    const affectedPanels = Array.from(
      new Set(pendingList.map((r) => r.panelName))
    );
    setConfirmState({
      title: `Sync ${pendingList.length} Pending Scan(s) to Google Sheet?`,
      description:
        'Each record will be appended to both the Master Data tab and its Seller Panel tab inside your linked Google Sheet.',
      details: [
        `Master Tab: ${sheetsConfig.sheetTabName} (${pendingList.length} rows)`,
        `Panel Tabs: ${affectedPanels.join(', ')}`,
      ],
      confirmLabel: 'Sync to Google Sheet',
      variant: 'primary',
      action: async () => {
        await executeBatchSync(pendingList);
      },
    });
  };

  const handleSaveSheetUrl = (rawIdOrUrl: string) => {
    const id = extractSpreadsheetId(rawIdOrUrl);
    if (!id) {
      setNotice({
        type: 'error',
        text: 'Paste a valid Google Sheet URL or Spreadsheet ID.',
      });
      return;
    }
    setSheetsConfig((prev) => ({
      ...prev,
      spreadsheetId: id,
    }));
    setNotice({
      type: 'success',
      text: `Saved Google Sheet link (${id}).`,
    });
  };

  const handleTestAndSetupAppsScript = async (rawUrl: string) => {
    setIsSyncing(true);
    setNotice(null);
    try {
      const meta = await setupAndTestAppsScript(rawUrl, sheetsConfig, panels);
      const cleanedUrl = rawUrl.trim();
      if (meta.existingTrackingIds) {
        for (const tid of meta.existingTrackingIds) {
          sheetTrackingIdsRef.current.add(normalizeTrackingId(tid));
        }
      }
      setSheetsConfig((prev) => ({
        ...prev,
        appsScriptWebhookUrl: cleanedUrl,
        appsScriptVerifiedAt: new Date().toISOString(),
        spreadsheetId: meta.spreadsheetId || prev.spreadsheetId,
        spreadsheetTitle: meta.title || prev.spreadsheetTitle,
      }));
      setSheetMetadata(meta);
      setNotice({
        type: 'success',
        text: `Connected "${meta.title}" — verified ${meta.tabs.length} tabs (${meta.tabs.join(', ')}).`,
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to reach Apps Script Web App URL. Make sure deployment access is set to "Anyone".',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchSheetPreview = async (tabName: string) => {
    if (!isSyncReady) return;
    setIsSyncing(true);
    try {
      const res = await readAppsScriptPreview(
        sheetsConfig.appsScriptWebhookUrl,
        tabName
      );
      setPreviewData(res);
    } catch (err) {
      setNotice({
        type: 'error',
        text:
          err instanceof Error ? err.message : 'Unable to fetch sheet preview.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddSellerPanel = (name: string) => {
    const newPanel: SellerPanelConfig = {
      id: `panel-${Date.now().toString(36)}`,
      name,
      active: true,
      createdAt: new Date().toISOString(),
    };
    setPanels((prev) => [...prev, newPanel]);
    setNotice({
      type: 'success',
      text: `Added Seller Panel "${name}". Click "Test & Create All Tabs" to add its tab in Google Sheet right away, or scan a packet to auto-create it.`,
    });
  };

  const handleUpdatePanel = (updated: SellerPanelConfig) => {
    setPanels((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const requestRemovePanel = (panel: SellerPanelConfig) => {
    setConfirmState({
      title: `Remove Seller Panel "${panel.name}"?`,
      description:
        'Removing this panel hides it from new scans. Existing scan history on screen and in Google Sheets remains preserved.',
      details: [`Panel: ${panel.name}`],
      confirmLabel: 'Remove Panel',
      variant: 'danger',
      action: async () => {
        setPanels((prev) => prev.filter((p) => p.id !== panel.id));
        setNotice({
          type: 'success',
          text: `Removed panel "${panel.name}".`,
        });
      },
    });
  };

  const requestClearLocalData = () => {
    const count = records.length;
    setConfirmState({
      title: 'Clear Scan Data from App Screen?',
      description:
        'This removes all scanned rows from this app screen and local browser storage. Your Google Sheet data will NOT be modified or deleted.',
      details: [
        `Rows to remove from app screen: ${count}`,
        'Google Sheet data: Completely untouched and safe',
      ],
      confirmLabel: 'Clear App Screen Data',
      variant: 'danger',
      action: async () => {
        setRecords([]);
        setNotice({
          type: 'success',
          text: `Cleared ${count} scan record(s) from the app screen. Google Sheet data was not touched.`,
        });
      },
    });
  };

  const handleConfirmExecute = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState(null);
    } catch (err) {
      setNotice({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Operation failed while updating Google Sheet.',
      });
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const viewMeta: Record<ActiveView, { label: string; breadcrumb: string }> = {
    scan: {
      label: 'Scan Station',
      breadcrumb: 'Operations / Scan Station',
    },
    ledger: {
      label: 'Packet Ledger',
      breadcrumb: 'Operations / Master & Panel Tabs',
    },
    'sheet-link': {
      label: 'Google Sheet Link',
      breadcrumb: 'Integrations / Apps Script Sheet Link',
    },
  };

  const navItems: Array<{
    id: ActiveView;
    label: string;
    icon: typeof ScanBarcode;
  }> = [
    { id: 'scan', label: 'Scan Station', icon: ScanBarcode },
    { id: 'ledger', label: 'Packet Ledger', icon: Table2 },
    { id: 'sheet-link', label: 'Google Sheet Link', icon: Link2 },
  ];

  const pendingTotal = records.filter((r) => r.syncStatus !== 'Synced').length;

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-[#090e1a] dark:text-slate-100">
      {/* Desktop Sidebar (240px) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200/80 px-4 dark:border-slate-800">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm">
            <Sheet className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-display text-[13px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              Vardhman Claim
            </span>
            <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Packet Data Console
            </span>
          </div>
        </div>

        <nav
          aria-label="Primary workspace navigation"
          className="flex-1 space-y-1.5 p-3"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="m-3 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Sync Summary
          </p>
          <p className="mt-1 font-mono-tabular text-slate-700 dark:text-slate-300">
            {records.length} scans · {pendingTotal} pending
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {sheetsConfig.sheetTabName} + {panels.filter((p) => p.active).length} tabs
          </p>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
              <span className="font-display text-[13px] font-bold leading-tight text-slate-900 dark:text-white">
                Vardhman Claim Pkt. Data
              </span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <nav className="space-y-1.5 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-sm sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {viewMeta[activeView].breadcrumb}
              </p>
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-white">
                {viewMeta[activeView].label}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
              }
              aria-label={
                theme === 'dark'
                  ? 'Switch to Light Mode'
                  : 'Switch to Dark Mode'
              }
              title={
                theme === 'dark'
                  ? 'Switch to Light Mode'
                  : 'Switch to Dark Mode'
              }
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {resolvedSheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${resolvedSheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span>Open Sheet</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setActiveView('sheet-link')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                isSyncReady
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isSyncReady ? 'Sheet Linked' : 'Link Google Sheet'}</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1220px] flex-1 space-y-5 p-4 sm:p-6">
          {notice && (
            <div
              role="status"
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-2xs ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-200'
                  : 'border-red-200 bg-red-50 text-red-900 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-200'
              }`}
            >
              <span>{notice.text}</span>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setNotice(null)}
                className="rounded p-0.5 opacity-75 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {activeView === 'scan' && (
            <ScanStation
              records={records}
              panels={panels}
              sheetsConfig={sheetsConfig}
              isSyncReady={isSyncReady}
              onLogPacket={handleLogPacket}
              onNavigateToSheetLink={() => setActiveView('sheet-link')}
              onNavigateToLedger={() => setActiveView('ledger')}
              onRequestClearLocalData={requestClearLocalData}
            />
          )}

          {activeView !== 'scan' && (
            <Suspense
              fallback={
                <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-xs font-medium text-slate-500 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
                  Loading view...
                </div>
              }
            >
              {activeView === 'ledger' && (
                <MasterLedger
                  records={records}
                  panels={panels}
                  sheetTabName={sheetsConfig.sheetTabName}
                  isSyncReady={isSyncReady}
                  isSyncing={isSyncing}
                  onSyncRecord={handleSyncSingleRecord}
                  onRequestBatchSync={requestBatchSync}
                  onRequestClearLocalData={requestClearLocalData}
                  onNavigateToScan={() => setActiveView('scan')}
                />
              )}

              {activeView === 'sheet-link' && (
                <GoogleSheetLinkView
                  sheetsConfig={sheetsConfig}
                  onUpdateSheetsConfig={setSheetsConfig}
                  panels={panels}
                  records={records}
                  sheetMetadata={sheetMetadata}
                  isBusy={isSyncing}
                  isSyncReady={isSyncReady}
                  previewData={previewData}
                  onTestAndSetupAppsScript={handleTestAndSetupAppsScript}
                  onSaveSheetUrl={handleSaveSheetUrl}
                  onAddSellerPanel={handleAddSellerPanel}
                  onUpdatePanel={handleUpdatePanel}
                  onRequestRemovePanel={requestRemovePanel}
                  onRequestSyncAllPending={() => {
                    const pending = records.filter(
                      (r) => r.syncStatus !== 'Synced'
                    );
                    if (pending.length > 0) requestBatchSync(pending);
                  }}
                  onFetchSheetPreview={handleFetchSheetPreview}
                />
              )}
            </Suspense>
          )}
        </main>
      </div>

      {/* Confirmation Dialog for Mutating / Destructive Operations */}
      {confirmState && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open={Boolean(confirmState)}
            title={confirmState.title}
            description={confirmState.description}
            details={confirmState.details}
            confirmLabel={confirmState.confirmLabel}
            variant={confirmState.variant}
            busy={confirmBusy}
            onConfirm={handleConfirmExecute}
            onCancel={() => {
              if (!confirmBusy) setConfirmState(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
