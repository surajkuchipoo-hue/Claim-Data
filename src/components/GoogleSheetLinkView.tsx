import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Plus,
  RefreshCw,
  Sheet,
  Trash2,
} from 'lucide-react';
import type {
  PacketRecord,
  SellerPanelConfig,
  SheetMetadata,
  SheetsConfig,
} from '../types/packet';
import {
  computePanelMetrics,
  extractSpreadsheetId,
  generateSingleSheetAppsScriptCode,
  MASTER_SHEET_HEADERS,
  PANEL_SHEET_HEADERS,
  sanitizeSheetTabName,
  validateAppsScriptUrl,
} from '../services/sheetsPayload';
import { PanelBrandLogo } from './PanelBrandLogo';

interface GoogleSheetLinkViewProps {
  sheetsConfig: SheetsConfig;
  onUpdateSheetsConfig: (next: SheetsConfig) => void;
  panels: SellerPanelConfig[];
  records: PacketRecord[];
  sheetMetadata: SheetMetadata | null;
  isBusy: boolean;
  isSyncReady: boolean;
  previewData: {
    title: string;
    tabName: string;
    rows: string[][];
  } | null;
  onTestAndSetupAppsScript: (rawUrl: string) => Promise<void>;
  onSaveSheetUrl: (rawIdOrUrl: string) => void;
  onAddSellerPanel: (name: string) => void;
  onUpdatePanel: (panel: SellerPanelConfig) => void;
  onRequestRemovePanel: (panel: SellerPanelConfig) => void;
  onRequestSyncAllPending: () => void;
  onFetchSheetPreview: (tabName: string) => Promise<void>;
}

export function GoogleSheetLinkView({
  sheetsConfig,
  onUpdateSheetsConfig,
  panels,
  records,
  sheetMetadata,
  isBusy,
  isSyncReady,
  previewData,
  onTestAndSetupAppsScript,
  onSaveSheetUrl,
  onAddSellerPanel,
  onUpdatePanel,
  onRequestRemovePanel,
  onRequestSyncAllPending,
  onFetchSheetPreview,
}: GoogleSheetLinkViewProps) {
  const [webhookInput, setWebhookInput] = useState(
    sheetsConfig.appsScriptWebhookUrl
  );
  const [sheetUrlInput, setSheetUrlInput] = useState(
    sheetsConfig.spreadsheetId
  );
  const [tabNameInput, setTabNameInput] = useState(sheetsConfig.sheetTabName);
  const [previewTab, setPreviewTab] = useState(sheetsConfig.sheetTabName);
  const [copiedScript, setCopiedScript] = useState<'idle' | 'copied' | 'selected'>('idle');
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [newPanelName, setNewPanelName] = useState('');
  const [panelError, setPanelError] = useState<string | null>(null);
  const scriptTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setWebhookInput(sheetsConfig.appsScriptWebhookUrl);
  }, [sheetsConfig.appsScriptWebhookUrl]);

  useEffect(() => {
    setSheetUrlInput(sheetsConfig.spreadsheetId);
  }, [sheetsConfig.spreadsheetId]);

  useEffect(() => {
    setTabNameInput(sheetsConfig.sheetTabName);
  }, [sheetsConfig.sheetTabName]);

  const panelMetrics = computePanelMetrics(records, panels);
  const pendingCount = records.filter((r) => r.syncStatus !== 'Synced').length;
  const resolvedSheetId = extractSpreadsheetId(sheetsConfig.spreadsheetId);
  const hasValidWebhook = validateAppsScriptUrl(
    sheetsConfig.appsScriptWebhookUrl
  ).valid;
  const appsScriptCode = generateSingleSheetAppsScriptCode(
    sheetsConfig.sheetTabName
  );

  const previewTabChoices = [
    sheetsConfig.sheetTabName || 'Master Data',
    ...panels.filter((p) => p.active).map((p) => p.name),
  ];

  const handleCopyAppsScript = async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(appsScriptCode);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const temp = document.createElement('textarea');
        temp.value = appsScriptCode;
        temp.setAttribute('readonly', '');
        temp.style.position = 'fixed';
        temp.style.left = '-9999px';
        document.body.appendChild(temp);
        temp.select();
        copied = document.execCommand('copy');
        document.body.removeChild(temp);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedScript('copied');
      window.setTimeout(() => setCopiedScript('idle'), 2200);
    } else {
      setShowScriptCode(true);
      setCopiedScript('selected');
      requestAnimationFrame(() => {
        scriptTextareaRef.current?.focus();
        scriptTextareaRef.current?.select();
      });
    }
  };

  const handleAddPanelSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanedName = newPanelName.trim();
    if (!cleanedName) {
      setPanelError('Enter a Seller Panel name.');
      return;
    }
    if (
      panels.some((p) => p.name.toLowerCase() === cleanedName.toLowerCase())
    ) {
      setPanelError('A Seller Panel with this name already exists.');
      return;
    }
    setPanelError(null);
    onAddSellerPanel(cleanedName);
    setNewPanelName('');
  };

  return (
    <div className="space-y-6">
      {/* 1 Google Sheet Workbook Overview */}
      <section
        aria-label="Single Google Sheet Apps Script flow"
        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900/90"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Link Google Sheet via Apps Script (1 Sheet: Master + Panel Tabs)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Ek hi Google Sheet file me{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {sheetsConfig.sheetTabName}
              </strong>{' '}
              tab + har Seller Panel ka alag tab automatically create aur sync hota hai.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
              isSyncReady
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isSyncReady ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            {isSyncReady
              ? 'Apps Script Connected (Auto-Sync Active)'
              : 'Paste Apps Script Web App URL below'}
          </span>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-200/80 dark:divide-slate-800 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                01
              </span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Update Code.gs
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Google Sheet →{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                Extensions → Apps Script
              </strong>{' '}
              kholein, purana code delete karein, naya script paste karke{' '}
              <strong className="text-slate-800 dark:text-slate-200">Save</strong>{' '}
              karein.
            </p>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                02
              </span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Deploy New Version (Anyone)
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <strong className="text-slate-800 dark:text-slate-200">
                Deploy → Manage deployments → Edit → New version
              </strong>{' '}
              (ya New deployment → Web app) me{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                Who has access: Anyone
              </strong>{' '}
              select karke Deploy karein.
            </p>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                03
              </span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Click Test &amp; Create All Tabs
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              URL paste karke{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                Test &amp; Create All Tabs
              </strong>{' '}
              dabate hi aapki sheet me{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {sheetsConfig.sheetTabName}
              </strong>{' '}
              + sabhi {panels.filter((p) => p.active).length} panel tabs turant ban jayenge.
            </p>
          </div>
        </div>
      </section>

      {/* Apps Script Connection & Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section
          aria-label="Apps Script sheet configuration"
          className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Google Apps Script Connection
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Code.gs update karne ke baad New Version deploy karna zaroori hai.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyAppsScript}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {copiedScript === 'copied' ? (
                <>
                  <Check
                    className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>Copied Script!</span>
                </>
              ) : copiedScript === 'selected' ? (
                <>
                  <Copy
                    className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <span>Press Ctrl+C to Copy</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Apps Script Code</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="apps-script-url-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Apps Script Web App URL
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2 sm:flex-nowrap">
                <input
                  id="apps-script-url-input"
                  type="url"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                />
                <button
                  type="button"
                  disabled={isBusy || !webhookInput.trim()}
                  onClick={() => onTestAndSetupAppsScript(webhookInput)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Test &amp; Create All Tabs</span>
                </button>
              </div>
              {sheetsConfig.appsScriptVerifiedAt && (
                <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  Verified — scans sync automatically to{' '}
                  <strong>{sheetsConfig.sheetTabName}</strong> and each Seller Panel tab.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="target-tab-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Master Tab Name
                </label>
                <input
                  id="target-tab-input"
                  type="text"
                  value={tabNameInput}
                  onChange={(e) => {
                    setTabNameInput(e.target.value);
                    onUpdateSheetsConfig({
                      ...sheetsConfig,
                      sheetTabName: sanitizeSheetTabName(
                        e.target.value || 'Master Data'
                      ),
                    });
                  }}
                  placeholder="Master Data"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="sheet-url-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Google Sheet URL or ID (Optional)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="sheet-url-input"
                    type="text"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="Auto-filled on Test or paste URL"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                  />
                  <button
                    type="button"
                    disabled={isBusy || !sheetUrlInput.trim()}
                    onClick={() => onSaveSheetUrl(sheetUrlInput)}
                    className="whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            <details
              open={showScriptCode}
              onToggle={(e) =>
                setShowScriptCode((e.target as HTMLDetailsElement).open)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
            >
              <summary className="cursor-pointer font-medium text-slate-800 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white">
                View Apps Script Code (Master + Panel Tabs)
              </summary>
              <textarea
                ref={scriptTextareaRef}
                readOnly
                aria-label="Google Apps Script Code"
                value={appsScriptCode}
                onFocus={(e) => e.target.select()}
                rows={12}
                className="mt-2.5 w-full rounded-lg border border-slate-200 bg-white p-3 font-mono-tabular text-[11px] text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-blue-500"
              />
            </details>
          </div>
        </section>

        {/* Right: Linked Sheet Status & Quick Actions */}
        <section
          aria-label="Linked sheet status and sync queue"
          className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3.5 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sheet Connection &amp; Queue
            </h3>
            {resolvedSheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${resolvedSheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                <span>Open Sheet</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Status</span>
              <span
                className={`font-semibold ${
                  isSyncReady
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {hasValidWebhook
                  ? 'Connected via Apps Script'
                  : 'Waiting for Apps Script URL'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                Spreadsheet Name
              </span>
              <span className="max-w-[210px] truncate font-medium text-slate-900 dark:text-slate-100">
                {sheetMetadata?.title ||
                  sheetsConfig.spreadsheetTitle ||
                  'Not verified yet'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                Spreadsheet ID
              </span>
              <span className="max-w-[200px] truncate font-mono-tabular font-medium text-slate-900 dark:text-slate-100">
                {resolvedSheetId || 'Auto-detected on Test'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                Pending Local Queue
              </span>
              <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                {pendingCount} scan{pendingCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {sheetMetadata && sheetMetadata.tabs.length > 0 && (
            <div className="mt-4 border-t border-slate-200/80 pt-3.5 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tabs in Your Google Sheet ({sheetMetadata.tabs.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {sheetMetadata.tabs.map((tab) => (
                  <span key={tab} className="inline-flex items-center gap-1">
                    <CheckCircle2
                      className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    <span>{tab}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={!isSyncReady || isBusy || pendingCount === 0}
              onClick={onRequestSyncAllPending}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Sync All Pending ({pendingCount})</span>
            </button>

            <button
              type="button"
              disabled={!isSyncReady || isBusy}
              onClick={() => onFetchSheetPreview(previewTab)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Preview Sheet Tab</span>
            </button>
          </div>
        </section>
      </div>

      {/* Seller Panels Manager */}
      <section
        aria-label="Seller panel registry"
        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900/90"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Seller Panel Tabs in Your Google Sheet
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Each active Seller Panel gets its own tab inside your linked
              Google Sheet alongside {sheetsConfig.sheetTabName}.
            </p>
          </div>

          <form
            onSubmit={handleAddPanelSubmit}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              aria-label="New Seller Panel Name"
              value={newPanelName}
              onChange={(e) => {
                setNewPanelName(e.target.value);
                if (panelError) setPanelError(null);
              }}
              placeholder="New Panel (e.g. Tatacliq)"
              className="w-48 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Panel</span>
            </button>
          </form>
        </div>

        {panelError && (
          <p
            role="alert"
            className="px-6 pt-3 text-xs font-medium text-red-600 dark:text-red-400"
          >
            {panelError}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                <th className="px-5 py-2.5 font-medium">Seller Panel / Tab</th>
                <th className="px-4 py-2.5 font-medium">Screen Scans</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {panels.map((panel) => {
                const metric = panelMetrics.find((m) => m.panelId === panel.id);
                return (
                  <tr
                    key={panel.id}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="inline-flex items-center gap-2.5">
                        <PanelBrandLogo panelName={panel.name} size={22} />
                        <span>{panel.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-slate-700 dark:text-slate-300">
                      {metric?.totalCount ?? 0} total · {metric?.pendingCount ?? 0}{' '}
                      pending
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePanel({ ...panel, active: !panel.active })
                        }
                        className={`whitespace-nowrap shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          panel.active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {panel.active ? 'Enabled' : 'Paused'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!isSyncReady || isBusy}
                          onClick={() => {
                            setPreviewTab(panel.name);
                            onFetchSheetPreview(panel.name);
                          }}
                          className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Preview Tab
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestRemovePanel(panel)}
                          aria-label={`Remove ${panel.name}`}
                          className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Schema Reference & Live Google Sheet Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
            <Sheet
              className="h-4 w-4 text-blue-700 dark:text-blue-400"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Tab Column Schema
            </h3>
          </div>
          <div className="mt-4 space-y-4 text-xs">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {sheetsConfig.sheetTabName} Tab ({MASTER_SHEET_HEADERS.length}{' '}
                columns)
              </p>
              <p className="mt-1 font-mono-tabular text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                {MASTER_SHEET_HEADERS.join(' · ')}
              </p>
            </div>
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Seller Panel Tabs ({PANEL_SHEET_HEADERS.length} columns)
              </p>
              <p className="mt-1 font-mono-tabular text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                {PANEL_SHEET_HEADERS.join(' · ')}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Google Sheet Preview
            </h3>
            <div className="flex items-center gap-2">
              <select
                aria-label="Select sheet tab to preview"
                value={previewTab}
                onChange={(e) => setPreviewTab(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-blue-500"
              >
                {previewTabChoices.map((tab) => (
                  <option key={tab} value={tab}>
                    {tab}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!isSyncReady || isBusy}
                onClick={() => onFetchSheetPreview(previewTab)}
                className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Load Tab
              </button>
            </div>
          </div>

          {!previewData ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Select a tab and click <strong>Load Tab</strong> after connecting
              your Apps Script URL to inspect live rows from Google Sheets.
            </div>
          ) : previewData.rows.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Tab &ldquo;{previewData.tabName}&rdquo; has no rows yet.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <p className="mb-2 font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                {previewData.title} → {previewData.tabName} (
                {previewData.rows.length} rows)
              </p>
              <table className="w-full border-collapse text-left text-[11px]">
                <tbody>
                  {previewData.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        idx === 0
                          ? 'border-b border-blue-950 bg-blue-900 font-semibold text-white dark:border-slate-800 dark:bg-blue-950'
                          : 'border-b border-slate-100 text-slate-600 dark:border-slate-800 dark:text-slate-300'
                      }
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="whitespace-nowrap px-2.5 py-1.5">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
