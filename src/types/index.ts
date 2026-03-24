export interface Equipment {
  id: string;
  name: string;
  employee: string;
  site: string;
  category: string;
  serialNumber: string;
  equipmentType: 'heavy' | 'field';
  repair: boolean;
  repairDescription: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  type: 'low_stock' | 'out_of_stock' | 'repair';
  message: string;
  createdAt: string;
  userId?: string;
  userName?: string;
}
