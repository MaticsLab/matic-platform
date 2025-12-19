import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  Download, 
  Activity, 
  Users, 
  Settings,
  Clock,
  Mail,
  User,
  Tag,
  CheckCircle2,
  XCircle,
  Clock3,
  MessageSquare,
  Star,
  MoreVertical,
  Plus
} from 'lucide-react';

interface Application {
  id: string;
  applicantName: string;
  email: string;
  status: 'committee-review' | 'initial-review' | 'approved' | 'rejected';
  reviewsCompleted: number;
  reviewsTotal: number;
  submittedAt: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  reviewers: string[];
  score?: number;
}

const mockApplications: Application[] = [
  {
    id: '1',
    applicantName: 'Unknown',
    email: 'edorantes@bpncchicago.org',
    status: 'committee-review',
    reviewsCompleted: 0,
    reviewsTotal: 2,
    submittedAt: 'Just now',
    priority: 'high',
    tags: [],
    reviewers: []
  },
  {
    id: '2',
    applicantName: 'Unknown',
    email: 'jose674011@gmail.com',
    status: 'initial-review',
    reviewsCompleted: 0,
    reviewsTotal: 2,
    submittedAt: 'Just now',
    priority: 'medium',
    tags: [],
    reviewers: []
  },
  {
    id: '3',
    applicantName: 'Sarah Chen',
    email: 'schen@example.edu',
    status: 'committee-review',
    reviewsCompleted: 1,
    reviewsTotal: 2,
    submittedAt: '2 hours ago',
    priority: 'high',
    tags: ['STEM', 'First-Gen'],
    reviewers: ['Dr. Smith'],
    score: 85
  },
  {
    id: '4',
    applicantName: 'Michael Rodriguez',
    email: 'mrodriguez@example.org',
    status: 'initial-review',
    reviewsCompleted: 2,
    reviewsTotal: 2,
    submittedAt: '5 hours ago',
    priority: 'medium',
    tags: ['Arts'],
    reviewers: ['Prof. Johnson', 'Dr. Lee'],
    score: 92
  }
];

export function ApplicationReview() {
  const [selectedApp, setSelectedApp] = useState<Application>(mockApplications[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('In the game scholarship');

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'committee-review':
        return 'bg-blue-500';
      case 'initial-review':
        return 'bg-purple-500';
      case 'approved':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: Application['status']) => {
    switch (status) {
      case 'committee-review':
        return 'Committee Review';
      case 'initial-review':
        return 'Initial Review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: Application['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h1 className="text-gray-900">The Logan Scholarship</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-500 text-sm">4 applications</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500 text-sm">2 pending review</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2">
              <Users className="w-4 h-4" />
              Team
            </button>
            <button className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Portal Editor
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Applications List */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>In the game scholarship</option>
                <option>All applications</option>
                <option>Committee Review</option>
                <option>Initial Review</option>
              </select>
              <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <select className="text-gray-600 border-0 focus:outline-none focus:ring-0 p-0 pr-6">
                <option>Sort by: Most Recent</option>
                <option>Sort by: Priority</option>
                <option>Sort by: Score</option>
                <option>Sort by: Status</option>
              </select>
              <div className="flex gap-2">
                <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                  <Download className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                  <Activity className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Applications List */}
          <div className="flex-1 overflow-y-auto">
            {mockApplications.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full p-4 border-b border-gray-200 text-left hover:bg-gray-50 transition-colors ${
                  selectedApp.id === app.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">{app.applicantName}</span>
                        {app.priority === 'high' && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{app.email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${getStatusColor(app.status)} text-white`}>
                    {getStatusLabel(app.status)}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {app.reviewsCompleted}/{app.reviewsTotal}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {app.submittedAt}
                    </span>
                  </div>
                </div>

                {app.score && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${app.score}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{app.score}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Application Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-gray-900">{selectedApp.applicantName}</h2>
                  <p className="text-sm text-gray-600">{selectedApp.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MessageSquare className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 px-6">
            <div className="flex gap-6">
              <button className="px-1 py-3 border-b-2 border-blue-500 text-blue-600">
                Overview
              </button>
              <button className="px-1 py-3 border-b-2 border-transparent text-gray-600 hover:text-gray-900">
                Activity
              </button>
              <button className="px-1 py-3 border-b-2 border-transparent text-gray-600 hover:text-gray-900">
                Documents
              </button>
              <button className="px-1 py-3 border-b-2 border-transparent text-gray-600 hover:text-gray-900">
                Reviews
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Progress Timeline */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-gray-900 mb-4">Review Progress</h3>
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10">
                    <div className="h-full bg-blue-500 w-1/2" />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mb-2">
                      1
                    </div>
                    <span className="text-sm text-blue-600">Committee Review</span>
                    <span className="text-xs text-gray-500 mt-1">Current</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center mb-2">
                      2
                    </div>
                    <span className="text-sm text-gray-600">Final Review</span>
                    <span className="text-xs text-gray-500 mt-1">Pending</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center mb-2">
                      3
                    </div>
                    <span className="text-sm text-gray-600">Decision</span>
                    <span className="text-xs text-gray-500 mt-1">Pending</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white mb-1">Ready to Review</h3>
                    <p className="text-blue-100 text-sm">Complete your review to move this application forward</p>
                  </div>
                  <button className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                    Start Review
                  </button>
                </div>
              </div>

              {/* Application Details Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Personal Info */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-blue-500" />
                    <h3 className="text-gray-900">Personal Information</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
                      <p className="text-gray-900 mt-1">{selectedApp.applicantName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Application ID</label>
                      <p className="text-gray-900 mt-1">#{selectedApp.id}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Submitted</label>
                      <p className="text-gray-900 mt-1">{selectedApp.submittedAt}</p>
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Mail className="w-5 h-5 text-blue-500" />
                    <h3 className="text-gray-900">Contact</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Email</label>
                      <p className="text-gray-900 mt-1">{selectedApp.email}</p>
                    </div>
                    <button className="text-blue-600 text-sm hover:underline">
                      Send message
                    </button>
                  </div>
                </div>

                {/* Reviewers */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      <h3 className="text-gray-900">Reviewers</h3>
                    </div>
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  {selectedApp.reviewers.length === 0 ? (
                    <div className="text-center py-4">
                      <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No reviewers assigned</p>
                      <button className="text-blue-600 text-sm mt-2 hover:underline">
                        Assign reviewers
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedApp.reviewers.map((reviewer, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">
                            {reviewer.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">{reviewer}</p>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5 text-blue-500" />
                      <h3 className="text-gray-900">Tags</h3>
                    </div>
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  {selectedApp.tags.length === 0 ? (
                    <div className="text-center py-4">
                      <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No tags</p>
                      <button className="text-blue-600 text-sm mt-2 hover:underline">
                        Add tags
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedApp.tags.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Review Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-blue-500" />
                  <h3 className="text-gray-900">Review Summary</h3>
                  <span className="ml-auto text-sm text-gray-500">{selectedApp.reviewsCompleted}/{selectedApp.reviewsTotal} completed</span>
                </div>
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No reviews submitted yet</p>
                  <button className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Start Review
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 pb-8">
                <button className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Approve Application
                </button>
                <button className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Reject Application
                </button>
                <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <Clock3 className="w-5 h-5" />
                  Request Revision
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
