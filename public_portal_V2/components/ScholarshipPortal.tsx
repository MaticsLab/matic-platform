import { useState } from 'react';
import { 
  Home, 
  MessageCircle, 
  FileText, 
  ClipboardList, 
  File,
  DollarSign,
  Calendar,
  Settings,
  Award,
  ChevronRight,
  Bell,
  Menu,
  X,
  Layers,
  List
} from 'lucide-react';
import logoImage from 'figma:asset/4e755e9106121b931299b33c6038f396b9d38aca.png';

type NavigationMode = 'portal' | 'application';

interface NavItem {
  id: string;
  name: string;
  icon: any;
  badge?: string;
}

export function ScholarshipPortal() {
  const [navMode, setNavMode] = useState<NavigationMode>('application');
  const [activeSection, setActiveSection] = useState('introduction');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showSectionsPopover, setShowSectionsPopover] = useState(false);

  // Portal navigation items
  const portalNavItems: NavItem[] = [
    { id: 'home', name: 'Home', icon: Home },
    { id: 'messages', name: 'Messages', icon: MessageCircle, badge: '3' },
    { id: 'files', name: 'Files', icon: FileText },
    { id: 'tasks', name: 'Tasks', icon: Calendar, badge: '2' },
  ];

  // Application section items
  const applicationSections: NavItem[] = [
    { id: 'introduction', name: 'Introduction', icon: Home },
    { id: 'timeline', name: 'Scholarship Timeline', icon: Calendar },
    { id: 'personal', name: 'Personal and Academic Informati...', icon: FileText },
    { id: 'universities', name: 'Universities Applied to/ College Fit', icon: Award },
    { id: 'financial', name: 'Financial Information and Need', icon: DollarSign },
    { id: 'documents', name: 'Additional Documents', icon: File },
    { id: 'scholarships', name: 'Scholarships Applied to', icon: Award },
    { id: 'leadership', name: 'Leadership Experience', icon: Award },
    { id: 'questions', name: 'Short Form Questions', icon: ClipboardList },
    { id: 'review', name: 'Review & Submit', icon: ChevronRight },
  ];

  const currentNavItems = navMode === 'portal' ? portalNavItems : applicationSections;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-[#1a1f2e] text-white transition-all duration-300 flex flex-col overflow-hidden`}>
        {/* Logo/Brand Section */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <Award className="w-5 h-5 text-[#1a1f2e]" />
            </div>
            <span className="font-medium text-sm">Logan Scholarship</span>
          </div>
        </div>

        {/* Portal Button */}
        {navMode === 'application' && (
          <div className="p-3 border-b border-gray-700">
            <button
              onClick={() => {
                setNavMode('portal');
                setActiveSection('home');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors bg-[#0f1419] text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <Layers className="w-4 h-4" />
              Portal
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-2">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Settings at Bottom */}
        <div className="p-2 border-t border-gray-700">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 relative">
          {/* Progress indicator as bottom border */}
          {navMode === 'application' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-100">
              <div 
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${(currentStep / 10) * 100}%` }}
              ></div>
            </div>
          )}
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
              >
                <ChevronRight 
                  className={`w-5 h-5 transition-transform duration-300 ${
                    isSidebarOpen ? 'rotate-180' : 'rotate-0'
                  }`} 
                />
              </button>
            </div>
            <div>
              <h1 className="text-gray-900">
                {navMode === 'application' ? 'The Logan Scholarship' : 'Dashboard'}
              </h1>
              {navMode === 'application' && (
                <p className="text-xs text-gray-500">Step {currentStep} of 10</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {navMode === 'portal' && (
              <button 
                onClick={() => {
                  setNavMode('application');
                  setActiveSection('introduction');
                }}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-all text-sm flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Continue Application
              </button>
            )}
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm shadow-sm">
              Save & Exit
            </button>
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm">
                JD
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {navMode === 'application' && activeSection === 'introduction' && (
            <div className="max-w-4xl mx-auto p-8">
              {/* Application Form Content */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <h2 className="text-gray-900 mb-4">Welcome to the Logan Scholarship Application!</h2>
                
                <p className="text-gray-600 mb-6">
                  We're thrilled that you've taken the first step towards joining our amazing community of Kelly alumni.
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-gray-900 mb-3">Program Description</h3>
                    <p className="text-gray-600 leading-relaxed">
                      The Logan Scholarship offers Female and Non-Binary Identifying Kelly College Prep High School 
                      students financial contributions and a mentorship program designed to promote academic achievement 
                      and post-secondary educational advancement.
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-600 leading-relaxed">
                      Logan Scholars are motivated students with strong potential who demonstrate financial need. 
                      Scholars can receive up to $20,000 toward their education at a four-year university and take 
                      part in a mentoring program in partnership with the Brighton Park Neighborhood Council.
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-600 leading-relaxed">
                      The mentoring program helps prepare scholars for the transition from high school to University. 
                      Nominations will be evaluated based on the following criteria: (1) Academic Potential & Readiness; 
                      (2) Motivation & Goal Clarity; (3) need; (4) leadership potential; and, (5) Diversity, Service & 
                      Community Impact.
                    </p>
                  </div>

                  <div className="pt-6">
                    <h3 className="text-gray-900 mb-3">Program Eligibility</h3>
                    <ul className="space-y-2 text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Must be a current student at Kelly College Prep High School</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Female or Non-Binary identifying</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Demonstrate financial need</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Show strong academic potential and motivation</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                  <button className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Save Progress
                  </button>
                  <button 
                    onClick={() => {
                      setActiveSection('timeline');
                      setCurrentStep(2);
                    }}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {navMode === 'application' && activeSection !== 'introduction' && (
            <div className="max-w-4xl mx-auto p-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <h2 className="text-gray-900 mb-4">
                  {applicationSections.find(s => s.id === activeSection)?.name || 'Section'}
                </h2>
                <p className="text-gray-600 mb-6">
                  This section's content will be displayed here. Click through the navigation to switch between different sections.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <p className="text-sm text-gray-500 text-center">
                    Section content placeholder - customize based on the selected section
                  </p>
                </div>

                <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-gray-200">
                  <button 
                    onClick={() => {
                      const currentIndex = applicationSections.findIndex(s => s.id === activeSection);
                      if (currentIndex > 0) {
                        setActiveSection(applicationSections[currentIndex - 1].id);
                        setCurrentStep(currentIndex);
                      }
                    }}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => {
                      const currentIndex = applicationSections.findIndex(s => s.id === activeSection);
                      if (currentIndex < applicationSections.length - 1) {
                        setActiveSection(applicationSections[currentIndex + 1].id);
                        setCurrentStep(currentIndex + 2);
                      }
                    }}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {navMode === 'portal' && activeSection === 'home' && (
            <div className="max-w-6xl mx-auto p-8">
              {/* Dashboard/Home Content */}
              <div className="mb-8">
                <h2 className="text-gray-900 mb-2">Welcome back! 👋</h2>
                <p className="text-gray-600">Here's what's happening with your scholarship application.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Application Progress</p>
                      <h4 className="text-gray-900">30% Complete</h4>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '30%' }}></div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Next Deadline</p>
                      <h4 className="text-gray-900">March 10, 2026</h4>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">64 days remaining</p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Tasks Pending</p>
                      <h4 className="text-gray-900">2 Tasks</h4>
                    </div>
                  </div>
                  <button className="text-sm text-blue-600 hover:text-blue-700">View tasks →</button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setNavMode('application');
                      setActiveSection('introduction');
                    }}
                    className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-gray-900 text-sm">Continue Application</h4>
                      <p className="text-xs text-gray-500">Pick up where you left off</p>
                    </div>
                  </button>

                  <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="text-gray-900 text-sm">Contact Support</h4>
                      <p className="text-xs text-gray-500">Get help with your application</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {navMode === 'portal' && activeSection !== 'home' && (
            <div className="max-w-6xl mx-auto p-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <h2 className="text-gray-900 mb-4">
                  {portalNavItems.find(item => item.id === activeSection)?.name || 'Portal Section'}
                </h2>
                <p className="text-gray-600 mb-6">
                  Content for the {activeSection} section would be displayed here.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-12 border border-gray-200 text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    {portalNavItems.find(item => item.id === activeSection)?.icon && (
                      <div className="w-8 h-8 text-gray-400">
                        {(() => {
                          const Icon = portalNavItems.find(item => item.id === activeSection)?.icon;
                          return Icon ? <Icon className="w-full h-full" /> : null;
                        })()}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    This section is ready to be customized with {activeSection} content
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}