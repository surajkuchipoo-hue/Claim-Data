import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  PacketRecord,
  ReturnCategory,
  SellerPanelConfig,
} from '../types/packet';
import {
  computePanelMetrics,
  MASTER_SHEET_HEADERS,
  PANEL_SHEET_HEADERS,
  recordsToCsv,
} from '../services/sheetsPayload';
import { PanelBrandLogo } from './PanelBrandLogo';

interface MasterLedgerProps {
  records: PacketRecord[];
  panels: SellerPanelConfig[];
  sheetTabName: string;
  isSyncReady: boolean;
  isSyncing: boolean;
  onSyncRecord: (record: PacketRecord) => void;
  onRequestBatchSync: (pendingRecords: PacketRecord[]) => void;
  onRequestClearLocalData: () => void;
  onNavigateToScan: () => void;
}

export function MasterLedger({
  records,
  panels,
  sheetTabName,
  isSyncReady,
  isSyncing,
  onSyncRecord,
  onRequestBatchSync,
  onRequestClearLocalData,
  onNavigateToScan,
}: MasterLedgerProps) {
  const [activeSheetView, setActiveSheetView] = useState<string>('master');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | ReturnCategory>('All');
  const [syncFilter, setSyncFilter] = useState<'All' | 'Synced' | 'Pending'>(
    'All'
  );

  const panelMetrics = useMemo(
    () => computePanelMetrics(records, panels),
    [records, panels]
  );

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (activeSheetView !== 'master' && rec.panelId !== activeSheetView) {
        return false;
      }
      if (typeFilter !== 'All' && rec.returnType !== typeFilter) {
        return false;
      }
      if (syncFilter === 'Synced' && rec.syncStatus !== 'Synced') {
        return false;
      }
      if (syncFilter === 'Pending' && rec.syncStatus === 'Synced') {
        return false;
      }
      if (query) {
        const matches =
          rec.trackingId.toLowerCase().includes(query) ||
          rec.panelName.toLowerCase().includes(query) ||
          rec.remark.toLowerCase().includes(query) ||
          rec.customNote.toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [records, activeSheetView, typeFilter, syncFilter, searchQuery]);

  const pendingInView = useMemo(
    () => filteredRecords.filter((r) => r.syncStatus !== 'Synced'),
    [filteredRecords]
  );

  const activePanelObj = panels.find((p) => p.id === activeSheetView);

  const handleExportCsv = () => {
    const csv = recordsToCsv(filteredRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug =
      activeSheetView === 'master'
        ? 'master-data'
        : activePanelObj?.name.toLowerCase().replace(/\s+/g, '-') || 'panel';
    link.href = url;
    link.download = `${slug}-scans.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Sheet Tabs: Master Data + Individual Seller Panel Tabs */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90"
        role="tablist"
        aria-label="Master Data and Seller Panel tab views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSheetView === 'master'}
          onClick={() => setActiveSheetView('master')}
          className={`whitespace-nowrap shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            activeSheetView === 'master'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          {sheetTabName} ({records.length})
        </button>

        {panelMetrics.map((pm) => (
          <button
            key={pm.panelId}
            type="button"
            role="tab"
            aria-selected={activeSheetView === pm.panelId}
            onClick={() => setActiveSheetView(pm.panelId)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
              activeSheetView === pm.panelId
                ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            <PanelBrandLogo panelName={pm.panelName} size={16} />
            <span>
              {pm.panelName} ({pm.totalCount})
            </span>
          </button>
        ))}
      </div>

      {/* Filters & Batch Actions Toolbar */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search Tracking ID or remarks"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Tracking ID, remark, note..."
                className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-950"
              />
            </div>

            <div
              className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80"
              role="group"
              aria-label="Filter by return category"
            >
              {(['All', 'Customer Return', 'RTO'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTypeFilter(cat)}
                  className={`whitespace-nowrap shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    typeFilter === cat
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div
              className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80"
              role="group"
              aria-label="Filter by sync state"
            >
              {(['All', 'Synced', 'Pending'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSyncFilter(st)}
                  className={`whitespace-nowrap shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    syncFilter === st
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {pendingInView.length > 0 && (
              <button
                type="button"
                disabled={isSyncing || !isSyncReady}
                onClick={() => onRequestBatchSync(pendingInView)}
                title={
                  !isSyncReady
                    ? 'Link your Google Sheet Apps Script URL first'
                    : 'Sync pending records to Master & Panel tabs in Google Sheet'
                }
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Sync Pending ({pendingInView.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRequestClearLocalData}
              disabled={records.length === 0}
              title="Clear scan rows from this app screen without touching Google Sheets"
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-red-200 bg-white px-3.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/60"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear Screen Data</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Sheet Header Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
          <div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {activeSheetView === 'master'
                ? `${sheetTabName} Tab View`
                : `${activePanelObj?.name} Tab View`}
            </span>
            <span aria-hidden="true"> · </span>
            <span>
              {activeSheetView === 'master'
                ? `All panels consolidated in 1 Google Sheet (${MASTER_SHEET_HEADERS.length} columns)`
                : `Tab "${activePanelObj?.name}" inside the same Google Sheet (${PANEL_SHEET_HEADERS.length} columns)`}
            </span>
          </div>
          <span className="font-mono-tabular font-medium text-slate-500 dark:text-slate-400">
            Showing {filteredRecords.length} row
            {filteredRecords.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* High-Density Data Table */}
        {filteredRecords.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No packet scans match the current view
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Clear your filters or log a new packet from Scan Station.
            </p>
            <button
              type="button"
              onClick={onNavigateToScan}
              className="mt-4 whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700"
            >
              Go to Scan Station
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-blue-950 bg-blue-900 text-white dark:border-slate-800 dark:bg-blue-950">
                  <th className="px-3.5 py-2.5 font-semibold">Tracking ID</th>
                  {activeSheetView === 'master' && (
                    <th className="px-3.5 py-2.5 font-semibold">Seller Panel</th>
                  )}
                  <th className="px-3.5 py-2.5 font-semibold">Return Type</th>
                  <th className="px-3.5 py-2.5 font-semibold">Remarks</th>
                  <th className="px-3.5 py-2.5 font-semibold">Mode</th>
                  <th className="px-3.5 py-2.5 font-semibold">Date &amp; Time</th>
                  <th className="px-3.5 py-2.5 font-semibold">Sheet Sync</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredRecords.map((rec) => {
                  const isCriticalRemark = rec.remark !== 'Good / Intact';
                  return (
                    <tr
                      key={rec.id}
                      className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3.5 py-2.5">
                        <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                          {rec.trackingId}
                        </span>
                        {rec.customNote && (
                          <p className="mt-0.5 max-w-[165px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {rec.customNote}
                          </p>
                        )}
                      </td>
                      {activeSheetView === 'master' && (
                        <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                          <div className="inline-flex items-center gap-2">
                            <PanelBrandLogo panelName={rec.panelName} size={18} />
                            <span>{rec.panelName}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {rec.returnType}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            isCriticalRemark
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isCriticalRemark ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                            aria-hidden="true"
                          />
                          {rec.remark}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {rec.entryMode}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-mono-tabular text-slate-600 dark:text-slate-400">
                        {rec.scanDate} · {rec.scanTime}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {rec.syncStatus === 'Synced' ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                              aria-hidden="true"
                            />
                          ) : rec.syncStatus === 'Sync Error' ? (
                            <AlertCircle
                              className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
                              aria-hidden="true"
                            />
                          ) : (
                            <Clock
                              className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`font-medium ${
                              rec.syncStatus === 'Synced'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : rec.syncStatus === 'Sync Error'
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {rec.syncStatus}
                          </span>
                        </div>
                        <p
                          title={rec.lastSyncError || undefined}
                          className="mt-0.5 max-w-[160px] truncate text-[11px] text-slate-400 dark:text-slate-500"
                        >
                          {rec.lastSyncError
                            ? rec.lastSyncError
                            : `M: ${rec.masterSynced ? 'OK' : 'Pending'} · P: ${
                                rec.panelSynced ? 'OK' : 'Pending'
                              }`}
                        </p>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        {rec.syncStatus !== 'Synced' ? (
                          <button
                            type="button"
                            disabled={isSyncing || !isSyncReady}
                            onClick={() => onSyncRecord(rec)}
                            className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Sync Now
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Synced
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
