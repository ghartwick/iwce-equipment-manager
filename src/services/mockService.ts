// Mock service for testing without Firebase
import { Equipment, Category, StockAlert } from '../types';

// Mock data
const mockEquipment: Equipment[] = [
  {
    id: 'eq-1',
    name: 'Radio Set 1',
    employee: 'John Doe',
    site: 'Main Office',
    category: 'cat-1',
    serialNumber: 'RS001',
    repair: false,
    repairDescription: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'eq-2',
    name: 'Radio Set 2',
    employee: 'Jane Smith',
    site: 'Branch Office',
    category: 'cat-1',
    serialNumber: 'RS002',
    repair: true,
    repairDescription: 'Antenna needs replacement',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockCategories: Category[] = [
  {
    id: 'cat-1',
    name: 'Radio Equipment',
    description: 'Two-way radios and communication devices',
    color: '#FFD700'
  }
];

const mockAlerts: StockAlert[] = [
  {
    id: 'alert-1',
    productId: 'eq-2',
    type: 'repair',
    message: 'Radio Set 2 needs repair: Antenna needs replacement',
    createdAt: new Date().toISOString()
  }
];

// Mock functions
export const getEquipment = async (): Promise<Equipment[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockEquipment;
};

export const addEquipment = async (equipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newEquipment: Equipment = {
    ...equipment,
    id: `eq-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  mockEquipment.push(newEquipment);
};

export const updateEquipment = async (id: string, equipment: Partial<Equipment>): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockEquipment.findIndex(eq => eq.id === id);
  if (index !== -1) {
    mockEquipment[index] = { ...mockEquipment[index], ...equipment, updatedAt: new Date().toISOString() };
  }
};

export const deleteEquipment = async (id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockEquipment.findIndex(eq => eq.id === id);
  if (index !== -1) {
    mockEquipment.splice(index, 1);
  }
};

export const getCategories = async (): Promise<Category[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockCategories;
};

export const addCategory = async (category: Omit<Category, 'id'>): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newCategory: Category = {
    ...category,
    id: `cat-${Date.now()}`
  };
  mockCategories.push(newCategory);
};

export const updateCategory = async (id: string, category: Partial<Category>): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockCategories.findIndex(cat => cat.id === id);
  if (index !== -1) {
    mockCategories[index] = { ...mockCategories[index], ...category };
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockCategories.findIndex(cat => cat.id === id);
  if (index !== -1) {
    mockCategories.splice(index, 1);
  }
};

export const getAlerts = async (): Promise<StockAlert[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockAlerts;
};

export const addAlert = async (alert: Omit<StockAlert, 'id'>): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newAlert: StockAlert = {
    ...alert,
    id: `alert-${Date.now()}`
  };
  mockAlerts.push(newAlert);
};

export const deleteAlert = async (id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockAlerts.findIndex(alert => alert.id === id);
  if (index !== -1) {
    mockAlerts.splice(index, 1);
  }
};
