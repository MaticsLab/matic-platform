import { useState } from 'react';
import { ApplicationList } from './components/ApplicationList';
import { ApplicationDetail } from './components/ApplicationDetail';
import { Header } from './components/Header';
import { PipelineHeader } from './components/PipelineHeader';
import { PipelineActivityPanel } from './components/PipelineActivityPanel';
import { Toaster } from 'sonner@2.0.3';

export type ApplicationStatus = 'Submitted' | 'Initial Review' | 'Under Review' | 'Final Review' | 'Approved' | 'Rejected';

export interface Application {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  status: ApplicationStatus;
  submittedDate: string;
  reviewedCount: number;
  totalReviewers: number;
  avatar?: string;
  priority?: 'high' | 'medium' | 'low';
  score?: number;
  assignedTo?: string[];
  tags?: string[];
  lastActivity?: string;
}

const mockApplications: Application[] = [
  {
    id: '1',
    firstName: 'Jesus',
    lastName: 'Sanchez',
    email: 'jsanchez5710s@gmail.com',
    dateOfBirth: '2005-11-06',
    gender: 'Female, Non-binary',
    status: 'Initial Review',
    submittedDate: '2024-12-01',
    reviewedCount: 0,
    totalReviewers: 2,
    avatar: 'J',
    priority: 'high',
    assignedTo: ['John Doe'],
    tags: ['first-gen', 'stem'],
    lastActivity: '2 hours ago'
  },
  {
    id: '2',
    firstName: 'Maria',
    lastName: 'Garcia',
    email: 'mgarcia@gmail.com',
    dateOfBirth: '2004-03-15',
    gender: 'Female',
    status: 'Under Review',
    submittedDate: '2024-11-28',
    reviewedCount: 1,
    totalReviewers: 2,
    avatar: 'M',
    priority: 'medium',
    score: 8.5,
    assignedTo: ['John Doe', 'Jane Smith'],
    tags: ['arts', 'international'],
    lastActivity: '1 day ago'
  },
  {
    id: '3',
    firstName: 'Alex',
    lastName: 'Johnson',
    email: 'ajohnson@gmail.com',
    dateOfBirth: '2003-07-22',
    gender: 'Non-binary',
    status: 'Final Review',
    submittedDate: '2024-11-25',
    reviewedCount: 2,
    totalReviewers: 2,
    avatar: 'A',
    priority: 'medium',
    score: 9.2,
    assignedTo: ['Jane Smith'],
    tags: ['stem', 'leadership'],
    lastActivity: '3 days ago'
  },
  {
    id: '4',
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'swilliams@gmail.com',
    dateOfBirth: '2005-01-10',
    gender: 'Female',
    status: 'Approved',
    submittedDate: '2024-11-20',
    reviewedCount: 2,
    totalReviewers: 2,
    avatar: 'S',
    score: 9.8,
    assignedTo: ['John Doe', 'Jane Smith'],
    tags: ['stem', 'first-gen'],
    lastActivity: '5 days ago'
  },
  {
    id: '5',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'mchen@gmail.com',
    dateOfBirth: '2004-09-14',
    gender: 'Male',
    status: 'Submitted',
    submittedDate: '2024-12-02',
    reviewedCount: 0,
    totalReviewers: 2,
    avatar: 'M',
    priority: 'low',
    assignedTo: [],
    tags: ['stem'],
    lastActivity: '1 hour ago'
  },
  {
    id: '6',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'erodriguez@gmail.com',
    dateOfBirth: '2005-05-20',
    gender: 'Female',
    status: 'Under Review',
    submittedDate: '2024-11-29',
    reviewedCount: 1,
    totalReviewers: 2,
    avatar: 'E',
    priority: 'high',
    score: 8.8,
    assignedTo: ['John Doe'],
    tags: ['arts', 'community-service'],
    lastActivity: '6 hours ago'
  }
];

export default function App() {
  const [applications, setApplications] = useState<Application[]>(mockApplications);
  const [selectedApp, setSelectedApp] = useState<Application | null>(mockApplications[0]);
  const [committee, setCommittee] = useState('reading committee');
  const [activeTab, setActiveTab] = useState('Queue');
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPipelineActivity, setShowPipelineActivity] = useState(false);

  // Update selected app when applications change
  const handleStatusChange = (appId: string, newStatus: ApplicationStatus) => {
    setApplications(prev => 
      prev.map(app => 
        app.id === appId 
          ? { ...app, status: newStatus, lastActivity: 'Just now' }
          : app
      )
    );
    if (selectedApp?.id === appId) {
      setSelectedApp(prev => prev ? { ...prev, status: newStatus, lastActivity: 'Just now' } : null);
    }
  };

  const handleCloseDetail = () => {
    setSelectedApp(null);
  };

  const handleClosePipelineActivity = () => {
    setShowPipelineActivity(false);
  };

  // Filter applications
  const filteredApplications = applications.filter(app => {
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    const matchesSearch = searchQuery === '' || 
      `${app.firstName} ${app.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
      <Toaster position="top-right" richColors />
      
      <Header 
        committee={committee}
        onCommitteeChange={setCommittee}
      />
      
      <PipelineHeader 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        applications={applications}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        committee={committee}
        onCommitteeChange={setCommittee}
        onOpenPipelineActivity={() => setShowPipelineActivity(true)}
      />

      <div className={`flex-1 min-h-0 ${selectedApp || showPipelineActivity ? 'grid grid-cols-1 md:grid-cols-[400px_1fr] lg:grid-cols-[480px_1fr]' : ''}`}>
        <div className={`${selectedApp || showPipelineActivity ? 'hidden md:block' : ''} h-full overflow-hidden`}>
          <ApplicationList 
            applications={filteredApplications}
            selectedId={selectedApp?.id}
            onSelect={setSelectedApp}
          />
        </div>
        {selectedApp && !showPipelineActivity && (
          <div className="h-full overflow-hidden">
            <ApplicationDetail 
              application={selectedApp}
              onStatusChange={handleStatusChange}
              onClose={handleCloseDetail}
            />
          </div>
        )}
        {showPipelineActivity && (
          <div className="h-full overflow-hidden">
            <PipelineActivityPanel 
              applications={applications}
              onClose={handleClosePipelineActivity}
            />
          </div>
        )}
      </div>
    </div>
  );
}