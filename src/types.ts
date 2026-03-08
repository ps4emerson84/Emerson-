export interface Product {
  id: string;
  code: string;
  description: string;
}

export interface Tare {
  id: string;
  name: string;
  weight: number;
  image?: string;
}

export type RecordType = 'weight' | 'unit';

export interface InventoryItem {
  id: string;
  productId: string;
  productCode: string;
  productDescription: string;
  sector: string;
  type: RecordType;
  quantity: number; // For unit or net weight
  grossWeight?: number;
  tareWeight?: number;
  tareIds?: string[];
  timestamp: number;
}

export interface InventorySession {
  id: string;
  name: string;
  sector: string;
  startTime: number;
  endTime?: number;
  items: InventoryItem[];
}

export const SECTORS = [
  'Hortifruti',
  'Açougue',
  'Padaria',
  'Frios',
  'Mercearia',
  'Depósito',
  'Bebidas',
  'Limpeza'
];
