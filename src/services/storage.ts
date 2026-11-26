import type {
  PacketRecord,
  SellerPanelConfig,
  SheetsConfig,
} from '../types/packet';
import {
  DEFAULT_SELLER_PANELS,
  DEFAULT_SHEETS_CONFIG,
} from './sheetsPayload';

const RECORDS_KEY = 'parcelsync_packet_records_v2';
const PANELS_KEY = 'parcelsync_seller_panels_v3';
const CONFIG_KEY = 'parcelsync_sheets_config_v1';

export const SEED_PACKET_RECORDS: PacketRecord[] = [
  {
    id: 'SCN-1006',
    trackingId: 'AMZ883920145',
    panelId: 'panel-amazon',
    panelName: 'Amazon',
    returnType: 'Customer Return',
    remark: 'Wrong Received',
    customNote: 'Outer label matched, inside item is a different SKU',
    entryMode: 'Barcode Scanner',
    scanDate: '2026-11-18',
    scanTime: '11:42:18',
    scannedAtIso: '2026-11-18T11:42:18.000Z',
    syncStatus: 'Pending Sync',
    masterSynced: false,
    panelSynced: false,
  },
  {
    id: 'SCN-1005',
    trackingId: 'FKT772190441',
    panelId: 'panel-flipkart',
    panelName: 'Flipkart',
    returnType: 'RTO',
    remark: 'Tampering Case',
    customNote: 'Bottom tape cut and resealed with clear tape',
    entryMode: 'Barcode Scanner',
    scanDate: '2026-11-18',
    scanTime: '11:36:04',
    scannedAtIso: '2026-11-18T11:36:04.000Z',
    syncStatus: 'Pending Sync',
    masterSynced: false,
    panelSynced: false,
  },
  {
    id: 'SCN-1004',
    trackingId: 'MSH661049218',
    panelId: 'panel-meesho',
    panelName: 'Meesho',
    returnType: 'Customer Return',
    remark: 'Qty Short Received',
    customNote: 'Ordered 4-pack, returned only 2 units',
    entryMode: 'Manual Entry',
    scanDate: '2026-11-18',
    scanTime: '11:20:51',
    scannedAtIso: '2026-11-18T11:20:51.000Z',
    syncStatus: 'Pending Sync',
    masterSynced: false,
    panelSynced: false,
  },
  {
    id: 'SCN-1003',
    trackingId: 'MYN550291834',
    panelId: 'panel-myntra',
    panelName: 'Myntra',
    returnType: 'RTO',
    remark: 'Packet Missing',
    customNote: 'Manifest shows packet dispatched, empty polybag arrived',
    entryMode: 'Barcode Scanner',
    scanDate: '2026-11-18',
    scanTime: '10:58:12',
    scannedAtIso: '2026-11-18T10:58:12.000Z',
    syncStatus: 'Pending Sync',
    masterSynced: false,
    panelSynced: false,
  },
  {
    id: 'SCN-1002',
    trackingId: 'AJI440192831',
    panelId: 'panel-ajio',
    panelName: 'Ajio',
    returnType: 'RTO',
    remark: 'Wrong Packet',
    customNote: 'Different courier bag exchanged at hub',
    entryMode: 'Barcode Scanner',
    scanDate: '2026-11-18',
    scanTime: '10:41:09',
    scannedAtIso: '2026-11-18T10:41:09.000Z',
    syncStatus: 'Pending Sync',
    masterSynced: false,
    panelSynced: false,
  },
  {
    id: 'SCN-1001',
    trackingId: 'SHP330184920',
    panelId: 'panel-shopify',
    panelName: 'Shopify',
    returnType: 'Customer Return',
    remark: 'Good / Intact',
    customNote: 'Size issue return, original tags intact',
    entryMode: 'Barcode Scanner',
    scanDate: '2026-11-18',
    scanTime: '10:15:33',
    scannedAtIso: '2026-11-18T10:15:33.000Z',
    syncStatus: 'Pending Sync',
    masterSynced: false,
    panelSynced: false,
  },
];

export function loadPacketRecords(): PacketRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(SEED_PACKET_RECORDS));
      return SEED_PACKET_RECORDS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return SEED_PACKET_RECORDS;
    }
    return parsed.map((item) => ({
      ...item,
      masterSynced:
        typeof item.masterSynced === 'boolean'
          ? item.masterSynced
          : item.syncStatus === 'Synced',
      panelSynced:
        typeof item.panelSynced === 'boolean'
          ? item.panelSynced
          : item.syncStatus === 'Synced',
    }));
  } catch {
    return SEED_PACKET_RECORDS;
  }
}

export function savePacketRecords(records: PacketRecord[]): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // ignore storage quota errors
  }
}

export function loadSellerPanels(): SellerPanelConfig[] {
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    if (!raw) {
      localStorage.setItem(PANELS_KEY, JSON.stringify(DEFAULT_SELLER_PANELS));
      return DEFAULT_SELLER_PANELS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_SELLER_PANELS;
    }
    return parsed.map((p) => ({
      id: p.id,
      name: p.name,
      active: typeof p.active === 'boolean' ? p.active : true,
      createdAt: p.createdAt || new Date().toISOString(),
    }));
  } catch {
    return DEFAULT_SELLER_PANELS;
  }
}

export function saveSellerPanels(panels: SellerPanelConfig[]): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(panels));
  } catch {
    // ignore storage quota errors
  }
}

export function loadSheetsConfig(): SheetsConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_SHEETS_CONFIG));
      return DEFAULT_SHEETS_CONFIG;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      appsScriptWebhookUrl:
        typeof parsed.appsScriptWebhookUrl === 'string'
          ? parsed.appsScriptWebhookUrl
          : '',
      appsScriptVerifiedAt:
        typeof parsed.appsScriptVerifiedAt === 'string'
          ? parsed.appsScriptVerifiedAt
          : undefined,
      spreadsheetId:
        typeof parsed.spreadsheetId === 'string'
          ? parsed.spreadsheetId
          : typeof parsed.masterSpreadsheetId === 'string'
            ? parsed.masterSpreadsheetId
            : '',
      spreadsheetTitle:
        typeof parsed.spreadsheetTitle === 'string'
          ? parsed.spreadsheetTitle
          : typeof parsed.masterSpreadsheetTitle === 'string'
            ? parsed.masterSpreadsheetTitle
            : DEFAULT_SHEETS_CONFIG.spreadsheetTitle,
      sheetTabName:
        typeof parsed.sheetTabName === 'string'
          ? parsed.sheetTabName
          : typeof parsed.masterTabName === 'string'
            ? parsed.masterTabName
            : DEFAULT_SHEETS_CONFIG.sheetTabName,
    };
  } catch {
    return DEFAULT_SHEETS_CONFIG;
  }
}

export function saveSheetsConfig(config: SheetsConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore storage quota errors
  }
}
