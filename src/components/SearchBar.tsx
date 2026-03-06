import { Search } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function SearchBar({ searchTerm, onSearchChange }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-yellow-400" />
      <input
        type="text"
        placeholder="Search equipment by name, serial number, employee, site, repair status, or description..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-yellow-600 rounded-lg bg-black text-yellow-100 placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
      />
    </div>
  );
}
