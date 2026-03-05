import { Equipment, Category, StockAlert } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'inventory-products',
  CATEGORIES: 'inventory-categories',
  ALERTS: 'inventory-alerts',
} as const;

export class LocalStorage {
  static getProducts(): Equipment[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return data ? JSON.parse(data) : [];
  }

  static saveProducts(products: Equipment[]): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }

  static getCategories(): Category[] {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return data ? JSON.parse(data) : [];
  }

  static saveCategories(categories: Category[]): void {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }

  static getAlerts(): StockAlert[] {
    const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
    return data ? JSON.parse(data) : [];
  }

  static saveAlerts(alerts: StockAlert[]): void {
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
  }
}
