import { DashboardHeader } from './components/DashboardHeader';
import { WelcomeSection } from './components/WelcomeSection';
import { PriorityActions } from './components/PriorityActions';
import { QuickContact } from './components/QuickContact';
import { NextDeadline } from './components/NextDeadline';
import { CompactDocuments } from './components/CompactDocuments';
import { CompactRecommendations } from './components/CompactRecommendations';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <WelcomeSection />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <PriorityActions />
            <QuickContact />
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-4 sm:space-y-6">
            <NextDeadline />
            <CompactDocuments />
            <CompactRecommendations />
          </div>
        </div>
      </main>
    </div>
  );
}