export type ReturnCategory = 'Customer Return' | 'RTO';

export type EntryMode = 'Barcode Scanner' | 'Manual Entry';

export type SyncStatus = 'Synced' | 'Pending Sync' | 'Partial Sync' | 'Sync Error';

export interface SellerPanelConfig {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface PacketRecord {
  id: string;
  trackingId: string;
  panelId: string;
  panelName: string;
  returnType: ReturnCategory;
  remark: string;
  customNote: string;
  entryMode: EntryMode;
  scanDate: string;
  scanTime: string;
  scannedAtIso: string;
  syncStatus: SyncStatus;
  masterSynced: boolean;
  panelSynced: boolean;
  lastSyncError?: string;
}

export interface SheetsConfig {
  appsScriptWebhookUrl: string;
  appsScriptVerifiedAt?: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTabName: string;
}

export interface SyncDispatchResult {
  masterSynced: boolean;
  panelSynced: boolean;
  syncStatus: SyncStatus;
  duplicateBlocked?: boolean;
  errorMessage?: string;
  masterTarget: string;
  panelTarget: string;
}

export interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  tabs: string[];
  existingTrackingIds?: string[];
}
