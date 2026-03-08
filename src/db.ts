import { Product, Tare, InventorySession } from './types';

const STORAGE_KEYS = {
  PRODUCTS: 'superstock_products',
  TARAS: 'superstock_taras',
  SESSIONS: 'superstock_sessions',
};

// Initial mock data if empty
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', code: '7891001', description: 'Banana Prata' },
  { id: '2', code: '7891002', description: 'Maçã Gala' },
  { id: '3', code: '7892001', description: 'Alface Crespa' },
  { id: '4', code: '1001', description: 'Arroz 5kg' },
  { id: '5', code: '1002', description: 'Feijão Preto 1kg' },
];

const INITIAL_TARAS: Tare[] = [
  { id: 't1', name: 'Caixa Plástica', weight: 1.2 },
  { id: 't2', name: 'Carrinho', weight: 8.0 },
  { id: 't3', name: 'Bandeja Pequena', weight: 0.05 },
];

export const db = {
  getProducts: (): Product[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    return JSON.parse(data);
  },

  saveProduct: (product: Product) => {
    const products = db.getProducts();
    const index = products.findIndex(p => p.code === product.code);
    if (index >= 0) {
      products[index] = { ...products[index], ...product };
    } else {
      products.push(product);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },

  saveProducts: (newProducts: Product[]) => {
    const products = db.getProducts();
    const productMap = new Map(products.map(p => [p.code, p]));
    
    newProducts.forEach(newP => {
      const existing = productMap.get(newP.code);
      if (existing) {
        existing.description = newP.description;
      } else {
        productMap.set(newP.code, newP);
      }
    });
    
    const updated = Array.from(productMap.values());
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
  },

  getTaras: (): Tare[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TARAS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TARAS, JSON.stringify(INITIAL_TARAS));
      return INITIAL_TARAS;
    }
    return JSON.parse(data);
  },

  saveTare: (tare: Tare) => {
    const taras = db.getTaras();
    const index = taras.findIndex(t => t.id === tare.id);
    if (index >= 0) {
      taras[index] = tare;
    } else {
      taras.push(tare);
    }
    localStorage.setItem(STORAGE_KEYS.TARAS, JSON.stringify(taras));
  },

  deleteTare: (id: string) => {
    const taras = db.getTaras();
    const filtered = taras.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TARAS, JSON.stringify(filtered));
  },

  deleteProduct: (id: string) => {
    const products = db.getProducts();
    const filtered = products.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(filtered));
  },

  getSessions: (): InventorySession[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  saveSession: (session: InventorySession) => {
    const sessions = db.getSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },

  deleteSession: (id: string) => {
    const sessions = db.getSessions();
    const filtered = sessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(filtered));
  }
};
