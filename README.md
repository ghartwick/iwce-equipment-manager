# IWCE Equipment Manager Webapp

A modern, responsive equipment management web application built with React, TypeScript, and TailwindCSS. Features Boston Bruins themed dark mode design and comprehensive equipment tracking capabilities.

## Features

- **Equipment Management**: Add, edit, and delete equipment with comprehensive details
- **Repair Tracking**: Monitor equipment repair status with automatic alerts
- **Employee Assignment**: Track equipment assigned to specific employees
- **Site Management**: Organize equipment by location/site
- **Category System**: Organize equipment with customizable categories
- **Search & Filtering**: Find equipment quickly by name, serial number, employee, site, or repair status
- **Repair Alerts**: Get notified when equipment needs repair
- **Dark Mode**: Boston Bruins themed black and gold color scheme
- **Mobile Compatible**: Fully responsive design works on iOS and Android devices
- **Local Storage**: All data persists locally in the browser

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: TailwindCSS for modern, responsive design
- **Icons**: Lucide React for consistent iconography
- **Build Tool**: Vite for fast development and building
- **Data Storage**: Browser localStorage for data persistence
- **Theme**: Boston Bruins color scheme (black and gold)

## Installation

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Setup

1. Clone or download this project
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

The application will open at `http://localhost:5173` (or another available port).

## Usage

### Adding Equipment

1. Click the "Add Equipment" button in the header
2. Fill in the equipment details:
   - Equipment Name (required)
   - Serial Number (required)
   - Category (required)
   - Employee (optional)
   - Site (optional)
   - Repair Status (toggle)
   - Repair Description (shown when repair is enabled)
3. Click "Add Equipment" to save

### Managing Categories

1. Click the "+" icon next to "Categories" in the filter panel
2. Enter category name and description
3. Click "Add" to create the category

### Repair Management

- Toggle repair status on equipment to mark as needing repair
- Add repair descriptions for detailed information
- Equipment under repair shows with red highlighting
- Automatic repair alerts generated for equipment needing maintenance

### Equipment Alerts

- The alert bell icon shows the number of active alerts
- Red wrench icons indicate equipment needing repair
- Click the bell to toggle the alert panel
- Clear individual alerts as needed

## Data Structure

### Equipment

```typescript
interface Equipment {
  id: string;
  name: string;
  employee: string;
  site: string;
  category: string;
  serialNumber: string;
  repair: boolean;
  repairDescription: string;
  createdAt: string;
  updatedAt: string;
}
```

### Category

```typescript
interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
}
```

### Stock Alert

```typescript
interface StockAlert {
  id: string;
  productId: string;
  type: 'low_stock' | 'out_of_stock' | 'repair';
  message: string;
  createdAt: string;
}
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx
│   ├── ProductList.tsx
│   ├── ProductForm.tsx
│   ├── AlertPanel.tsx
│   ├── SearchBar.tsx
│   └── FilterPanel.tsx
├── hooks/              # Custom React hooks
│   └── useInventory.ts
├── lib/                # Utility functions
│   └── storage.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles
```

## Mobile Compatibility

This web application is fully compatible with:
- **iOS devices**: Works in Safari and can be added to home screen
- **Android devices**: Works in Chrome and other modern browsers
- **Responsive design**: Adapts to all screen sizes
- **Touch-friendly**: Optimized for mobile interactions

## Browser Compatibility

This application works in all modern browsers that support:
- ES2020 features
- localStorage API
- CSS Grid and Flexbox
- Responsive design principles

## Future Enhancements

- [ ] Export/import data functionality
- [ ] Barcode scanning support
- [ ] Advanced reporting and analytics
- [ ] Multi-user support with authentication
- [ ] Cloud storage integration
- [ ] PWA capabilities for offline use
- [ ] Push notifications for repair alerts
- [ ] Equipment maintenance scheduling

## License

This project is open source and available under the MIT License.
