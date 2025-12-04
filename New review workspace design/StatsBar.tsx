import { Circle, Filter, RefreshCw } from 'lucide-react';

export function StatsBar() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50">
          <Circle className="w-2 h-2 fill-orange-500 text-orange-500" />
          <span className="text-orange-700">1</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50">
          <Circle className="w-2 h-2 fill-blue-500 text-blue-500" />
          <span className="text-blue-700">0</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50">
          <Circle className="w-2 h-2 fill-green-500 text-green-500" />
          <span className="text-green-700">0</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50">
          <Circle className="w-2 h-2 fill-red-500 text-red-500" />
          <span className="text-red-700">0</span>
        </div>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700">
        <Filter className="w-4 h-4" />
        <span>Filters</span>
      </button>

      <button className="px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700">
        <RefreshCw className="w-4 h-4" />
      </button>

      <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white">
        Review
      </button>
    </div>
  );
}
