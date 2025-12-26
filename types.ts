export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ReceiptData {
  storeName: string;
  date: string;
  totalAmount: number;
  currency: string;
  items: ReceiptItem[];
  trustScore: number; // 0 to 100
  fraudNotes?: string;
  originalImage?: string; // Base64
}

export interface DistributionPhoto {
  base64: string;
  caption: string;
  timestamp: string;
}

export interface ImpactReport {
  id: string;
  campaignName: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  beneficiariesCount: number;
  date: string;
  totalSpend: number;
  currency: string; // Added currency field
  receipts: ReceiptData[];
  photos: DistributionPhoto[];
  story: string;
  status: 'draft' | 'published';
  language: string;
}

export type ViewState = 'landing' | 'dashboard' | 'create-receipt' | 'create-photos' | 'create-summary' | 'view-report' | 'donors' | 'how-it-works' | 'features';