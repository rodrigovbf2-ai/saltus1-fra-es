import type { Timestamp } from 'firebase/firestore';

export type UnitStatus = 'disponivel' | 'reservado' | 'vendido';

export interface Development {
  id: string;
  name: string;
  subtitle: string;
  floorLabel: string;
  floorPlanUrl: string;
  isPublished: boolean;
  ownerId: string;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

export interface FloorPlan {
  id: string;
  developmentId: string;
  label: string;
  order: number;
  floorPlanUrl: string;
  isPublished: boolean;
  ownerId: string;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

export interface Unit {
  id: string;
  developmentId: string;
  floorId?: string;
  code: string;
  typology: string;
  floor: string;
  areaSqm: number;
  price: number;
  orientation: string;
  status: UnitStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  ownerId: string;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

export interface UnitPrivateNote {
  developmentId: string;
  unitId: string;
  buyerName: string;
  buyerContact: string;
  notes: string;
  ownerId: string;
  updatedAt?: Timestamp | Date | null;
}

export interface ActivityLog {
  id: string;
  developmentId: string;
  unitId: string;
  unitCode: string;
  previousStatus: UnitStatus | 'novo';
  newStatus: UnitStatus;
  actorUid: string;
  actorName: string;
  ownerId: string;
  createdAt?: Timestamp | Date | null;
}

export interface StatusStyleMeta {
  key: UnitStatus;
  label: string;
  shortLabel: string;
  hex: string;
  rgb: [number, number, number];
  zoneFill: string;
  zoneActiveFill: string;
  zoneBorder: string;
  solidButton: string;
  softBadge: string;
  outlineButton: string;
  activeButton: string;
}

export const STATUS_META: Record<UnitStatus, StatusStyleMeta> = {
  disponivel: {
    key: 'disponivel',
    label: 'Disponível',
    shortLabel: 'Disponível',
    hex: '#16A34A',
    rgb: [22, 163, 74],
    zoneFill: 'rgba(22, 163, 74, 0.32)',
    zoneActiveFill: 'rgba(22, 163, 74, 0.52)',
    zoneBorder: '#15803D',
    solidButton: 'bg-green-600 text-white hover:bg-green-700',
    softBadge: 'bg-green-50 text-green-800 border border-green-300',
    outlineButton: 'border-slate-200 text-slate-700 hover:border-green-500 hover:bg-green-50 hover:text-green-800',
    activeButton: 'bg-green-600 text-white border-green-700 shadow-xs',
  },
  reservado: {
    key: 'reservado',
    label: 'Reservado',
    shortLabel: 'Reservado',
    hex: '#2563EB',
    rgb: [37, 99, 235],
    zoneFill: 'rgba(37, 99, 235, 0.34)',
    zoneActiveFill: 'rgba(37, 99, 235, 0.54)',
    zoneBorder: '#1D4ED8',
    solidButton: 'bg-blue-600 text-white hover:bg-blue-700',
    softBadge: 'bg-blue-50 text-blue-800 border border-blue-300',
    outlineButton: 'border-slate-200 text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800',
    activeButton: 'bg-blue-600 text-white border-blue-700 shadow-xs',
  },
  vendido: {
    key: 'vendido',
    label: 'Vendido',
    shortLabel: 'Vendido',
    hex: '#DC2626',
    rgb: [220, 38, 38],
    zoneFill: 'rgba(220, 38, 38, 0.34)',
    zoneActiveFill: 'rgba(220, 38, 38, 0.54)',
    zoneBorder: '#B91C1C',
    solidButton: 'bg-red-600 text-white hover:bg-red-700',
    softBadge: 'bg-red-50 text-red-800 border border-red-300',
    outlineButton: 'border-slate-200 text-slate-700 hover:border-red-500 hover:bg-red-50 hover:text-red-800',
    activeButton: 'bg-red-600 text-white border-red-700 shadow-xs',
  },
};

export function formatCurrencyEUR(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatArea(area: number): string {
  return `${new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: 1,
  }).format(area)} m²`;
}
