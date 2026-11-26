import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Keyboard,
  PackageCheck,
  RotateCcw,
  ScanBarcode,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type {
  EntryMode,
  PacketRecord,
  ReturnCategory,
  SellerPanelConfig,
  SheetsConfig,
  SyncStatus,
} from '../types/packet';
import {
  computeReturnSummary,
  findDuplicateScan,
  RETURN_REMARKS,
  validatePacketInput,
} from '../services/sheetsPayload';
import { PanelBrandLogo } from './PanelBrandLogo';

interface ScanStationProps {
  records: PacketRecord[];
  panels: SellerPanelConfig[];
  sheetsConfig: SheetsConfig;
  isSyncReady: boolean;
  onLogPacket: (input: {
    trackingId: string;
    panelId: string;
    returnType: ReturnCategory;
    remark: string;
    customNote: string;
    entryMode: EntryMode;
  }) => Promise<{
    record: PacketRecord | null;
    duplicateMatch?: PacketRecord;
    duplicateInSheet?: boolean;
  }>;
  onNavigateToSheetLink: () => void;
  onNavigateToLedger: () => void;
  onRequestClearLocalData: () => void;
}

export function ScanStation({
  records,
  panels,
  sheetsConfig,
  isSyncReady,
  onLogPacket,
  onNavigateToSheetLink,
  onNavigateToLedger,
  onRequestClearLocalData,
}: ScanStationProps) {
  const activePanels = panels.filter((p) => p.active);
  const [entryMode, setEntryMode] = useState<EntryMode>('Barcode Scanner');
  const [trackingId, setTrackingId] = useState('');
  const [panelId, setPanelId] = useState<string>(
    activePanels[0]?.id ?? panels[0]?.id ?? ''
  );
  const [returnType, setReturnType] =
    useState<ReturnCategory>('Customer Return');
  const [remark, setRemark] = useState<string>(
    RETURN_REMARKS['Customer Return'][1]
  );
  const [customNote, setCustomNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<{
    trackingId: string;
    existingRecord?: PacketRecord;
    inSheet?: boolean;
  } | null>(null);
  const [lastLogged, setLastLogged] = useState<{
    id: string;
    trackingId: string;
    panelName: string;
    syncStatus: SyncStatus;
    lastSyncError?: string;
  } | null>(null);

  const trackingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activePanels.some((p) => p.id === panelId) && activePanels[0]) {
      setPanelId(activePanels[0].id);
    }
  }, [activePanels, panelId]);

  useEffect(() => {
    const validRemarks = RETURN_REMARKS[returnType];
    if (!validRemarks.includes(remark)) {
      setRemark(validRemarks[0]);
    }
  }, [returnType, remark]);

  const summary = computeReturnSummary(records);

  const submitPacket = async () => {
    setValidationError(null);
    const check = validatePacketInput({
      trackingId,
      panelId,
      returnType,
      remark,
    });

    if (!check.valid) {
      setValidationError(check.error || 'Please check packet fields.');
      return;
    }

    const existing = findDuplicateScan(records, check.normalizedTrackingId);
    if (existing) {
      setDuplicateAlert({
        trackingId: existing.trackingId,
        existingRecord: existing,
      });
      setLastLogged(null);
      setTrackingId('');
      if (entryMode === 'Barcode Scanner') {
        requestAnimationFrame(() => {
          trackingInputRef.current?.focus();
        });
      }
      return;
    }

    const outcome = await onLogPacket({
      trackingId: check.normalizedTrackingId,
      panelId,
      returnType,
      remark,
      customNote: customNote.trim(),
      entryMode,
    });

    if (!outcome.record) {
      setDuplicateAlert({
        trackingId: check.normalizedTrackingId,
        existingRecord: outcome.duplicateMatch,
        inSheet: outcome.duplicateInSheet,
      });
      setLastLogged(null);
      setTrackingId('');
      if (entryMode === 'Barcode Scanner') {
        requestAnimationFrame(() => {
          trackingInputRef.current?.focus();
        });
      }
      return;
    }

    const saved = outcome.record;
    setDuplicateAlert(null);
    setLastLogged({
      id: saved.id,
      trackingId: saved.trackingId,
      panelName: saved.panelName,
      syncStatus: saved.syncStatus,
      lastSyncError: saved.lastSyncError,
    });
    setTrackingId('');
    setCustomNote('');

    if (entryMode === 'Barcode Scanner') {
      requestAnimationFrame(() => {
        trackingInputRef.current?.focus();
      });
    }
  };

  const liveLastLogged = lastLogged
    ? records.find((r) => r.id === lastLogged.id) ?? lastLogged
    : null;

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await submitPacket();
  };

  const recentScans = records.slice(0, 7);
  const syncPercent =
    summary.total > 0 ? Math.round((summary.synced / summary.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* KPI Metric Cards */}
      <section
        aria-label="Shift summary metrics"
        className="grid grid-cols-2 gap-3.5 lg:grid-cols-4"
      >
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Scanned
            </p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white">
            {summary.total}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Master Data entries
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Customer Returns
            </p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white">
            {summary.customerReturn}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Buyer-initiated returns
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              RTO Packets
            </p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white">
            {summary.rto}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {summary.flaggedIssues} flagged issues total
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Google Sheet Sync
            </p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white">
            {summary.synced}
            <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
              {' '}
              / {summary.total}
            </span>
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${syncPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {summary.pending > 0 ? `${summary.pending} pending` : 'Synced'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        {/* Left: Packet Scan & Classification Station */}
        <section
          aria-label="Packet scan entry form"
          className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                <ScanBarcode className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Packet Scan &amp; Classification
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Scan via USB/Bluetooth barcode gun or enter Tracking ID manually.
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
              role="group"
              aria-label="Packet input mode"
            >
              <button
                type="button"
                onClick={() => {
                  setEntryMode('Barcode Scanner');
                  trackingInputRef.current?.focus();
                }}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  entryMode === 'Barcode Scanner'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ScanBarcode className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Barcode Scanner</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryMode('Manual Entry');
                  trackingInputRef.current?.focus();
                }}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  entryMode === 'Manual Entry'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Manual Entry</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="mt-5 space-y-5">
            {/* Tracking ID Input */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="tracking-id-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Tracking ID / AWB Number
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {entryMode === 'Barcode Scanner'
                    ? 'Press Enter or scan barcode to log'
                    : 'Type AWB and click Save Packet'}
                </span>
              </div>
              <div className="mt-1.5 flex gap-2.5">
                <div className="relative flex-1">
                  <ScanBarcode
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    ref={trackingInputRef}
                    id="tracking-id-input"
                    type="text"
                    autoFocus
                    value={trackingId}
                    onChange={(e) => {
                      setTrackingId(e.target.value);
                      if (validationError) setValidationError(null);
                      if (duplicateAlert) setDuplicateAlert(null);
                    }}
                    placeholder={
                      entryMode === 'Barcode Scanner'
                        ? 'Focus here and scan packet barcode...'
                        : 'Enter Tracking ID (e.g. AMZ883920145)'
                    }
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2.5 pl-10 pr-3.5 font-mono-tabular text-sm font-medium text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <span>Save Packet</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {validationError && (
                <p
                  role="alert"
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{validationError}</span>
                </p>
              )}

              {duplicateAlert && (
                <div
                  role="alert"
                  className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-3.5 dark:border-red-900/70 dark:bg-red-950/50"
                >
                  <div className="flex items-start gap-2 text-xs text-red-950 dark:text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">
                        Duplicate Scan Blocked:{' '}
                        <span className="font-mono-tabular">
                          {duplicateAlert.trackingId}
                        </span>
                      </p>
                      <p className="mt-0.5 text-red-800 dark:text-red-300">
                        {duplicateAlert.existingRecord
                          ? `Already scanned on ${duplicateAlert.existingRecord.scanDate} at ${duplicateAlert.existingRecord.scanTime} under ${duplicateAlert.existingRecord.panelName} (${duplicateAlert.existingRecord.returnType} · ${duplicateAlert.existingRecord.remark}). Duplicate entry is not allowed.`
                          : 'This Tracking ID already exists in your linked Google Sheet. Duplicate entry is not allowed.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateAlert(null);
                      trackingInputRef.current?.focus();
                    }}
                    className="whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {liveLastLogged && !validationError && !duplicateAlert && (
                <p
                  className={`mt-2 flex items-center gap-1.5 text-xs ${
                    liveLastLogged.syncStatus === 'Synced'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : liveLastLogged.syncStatus === 'Sync Error'
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : isSyncReady
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {liveLastLogged.syncStatus === 'Synced' ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Synced <strong className="font-mono-tabular">{liveLastLogged.trackingId}</strong>{' '}
                        to {sheetsConfig.sheetTabName} &amp; {liveLastLogged.panelName} tab in Google Sheet.
                      </span>
                    </>
                  ) : liveLastLogged.syncStatus === 'Sync Error' ? (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Saved <strong className="font-mono-tabular">{liveLastLogged.trackingId}</strong>{' '}
                        locally, but Google Sheet sync failed: {liveLastLogged.lastSyncError || 'Check Apps Script deployment'}
                      </span>
                    </>
                  ) : isSyncReady ? (
                    <>
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Saved <strong className="font-mono-tabular">{liveLastLogged.trackingId}</strong>{' '}
                        instantly — syncing to Google Sheet in background...
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Saved <strong className="font-mono-tabular">{liveLastLogged.trackingId}</strong>{' '}
                        on screen (Pending Sync). Link Apps Script URL to sync to Google Sheet.
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Seller Panel Selection */}
            <div>
              <div className="flex items-center justify-between">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Seller Panel
                </span>
                <button
                  type="button"
                  onClick={onNavigateToSheetLink}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Manage Panels
                </button>
              </div>
              <div
                className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5"
                role="radiogroup"
                aria-label="Seller Panel"
              >
                {activePanels.map((panel) => {
                  const selected = panel.id === panelId;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPanelId(panel.id)}
                      className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-all ${
                        selected
                          ? 'border-blue-600 bg-blue-50/90 text-blue-950 shadow-xs ring-1 ring-blue-600/20 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                      }`}
                    >
                      <PanelBrandLogo panelName={panel.name} size={26} />
                      <span
                        className={`block w-full truncate text-xs ${
                          selected ? 'font-semibold' : 'font-medium'
                        }`}
                      >
                        {panel.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Return Type Toggle */}
            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Return Category
              </span>
              <div
                className="mt-2 grid grid-cols-2 gap-2.5"
                role="radiogroup"
                aria-label="Return Category"
              >
                {(['Customer Return', 'RTO'] as const).map((category) => {
                  const selected = returnType === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReturnType(category)}
                      className={`rounded-xl border px-4 py-2.5 text-left transition-all ${
                        selected
                          ? 'border-blue-600 bg-blue-50/80 text-blue-950 shadow-2xs dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {category === 'Customer Return' ? (
                          <RotateCcw className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                        ) : (
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                        )}
                        <span>{category}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        {category === 'Customer Return'
                          ? 'Wrong item, qty short, damaged'
                          : 'Missing packet, wrong packet, tampering'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Remarks / Issue Options */}
            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Packet Remarks ({returnType})
              </span>
              <div
                className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Packet Remarks"
              >
                {RETURN_REMARKS[returnType].map((option) => {
                  const selected = remark === option;
                  const isCritical =
                    option === 'Tampering Case' ||
                    option === 'Packet Missing' ||
                    option === 'Empty Box' ||
                    option === 'Wrong Received' ||
                    option === 'Wrong Packet';
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRemark(option)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all ${
                        selected
                          ? isCritical
                            ? 'border-red-600 bg-red-50 text-red-900 shadow-2xs dark:border-red-500 dark:bg-red-950/50 dark:text-red-200'
                            : 'border-blue-600 bg-blue-50 text-blue-950 shadow-2xs dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          option === 'Good / Intact'
                            ? 'bg-emerald-500'
                            : isCritical
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                        }`}
                      />
                      <span className="truncate">{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Custom Note */}
            <div>
              <label
                htmlFor="custom-note-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Inspection Note (Optional)
              </label>
              <input
                id="custom-note-input"
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Add SKU mismatch, seal condition, or unit count details..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-800"
              />
            </div>
          </form>
        </section>

        {/* Right: Recent Scans */}
        <aside className="space-y-5 lg:col-span-5">
          {/* Recent Scans Feed */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Recent Scans
                </h3>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono-tabular text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {records.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={onRequestClearLocalData}
                    className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Clear Screen</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNavigateToLedger}
                  className="whitespace-nowrap shrink-0 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Open Full Ledger
                </button>
              </div>
            </div>

            {recentScans.length === 0 ? (
              <div className="px-5 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                No packets scanned yet. Scan or type a Tracking ID to begin.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentScans.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="mt-0.5">
                        <PanelBrandLogo panelName={item.panelName} size={24} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-mono-tabular text-xs font-semibold text-slate-900 dark:text-white">
                          {item.trackingId}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {item.panelName} · {item.returnType}
                        </p>
                        <p
                          className={`mt-0.5 text-xs ${
                            item.remark !== 'Good / Intact'
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {item.remark}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                        {item.scanTime}
                      </p>
                      <p
                        className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium ${
                          item.syncStatus === 'Synced'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : item.syncStatus === 'Sync Error'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {item.syncStatus === 'Synced' ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : item.syncStatus === 'Sync Error' ? (
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Clock className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{item.syncStatus}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
