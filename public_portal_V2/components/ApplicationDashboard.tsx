import { Bell, Settings, LogOut, Calendar, CheckCircle2, Clock, FileText, MessageCircle, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function ApplicationDashboard() {
  const [message, setMessage] = useState('');

  const applicationSteps = [
    { name: 'Personal Information', status: 'completed', completedDate: 'Jan 15, 2026' },
    { name: 'Academic Records', status: 'completed', completedDate: 'Jan 18, 2026' },
    { name: 'Essay Submission', status: 'completed', completedDate: 'Jan 20, 2026' },
    { name: 'Recommendation Letters', status: 'completed', completedDate: 'Jan 22, 2026' },
    { name: 'Final Review', status: 'pending', completedDate: null },
  ];

  const recentActivity = [
    { action: 'Application submitted successfully', date: 'Jan 23, 2026', icon: CheckCircle2, color: 'text-green-600' },
    { action: 'All documents verified', date: 'Jan 22, 2026', icon: FileText, color: 'text-blue-600' },
    { action: 'Essay reviewed and approved', date: 'Jan 20, 2026', icon: CheckCircle2, color: 'text-green-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-gray-900">The Logan Scholarship</h1>
                <p className="text-xs text-gray-500">Application Portal</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-sm">
                Continue Application
              </button>
              <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-gray-900 mb-2">Good morning, Jose674011 👋</h2>
          <p className="text-gray-600">Here's an overview of your scholarship application.</p>
        </div>

        {/* Status Banner */}
        <div className="mb-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-white mb-1">Application Submitted Successfully!</h3>
                <p className="text-green-50 text-sm">Your application is under review. We'll notify you of any updates.</p>
                <div className="mt-3 inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  Status: Submitted
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-green-50 text-sm">Submitted on</p>
              <p className="text-white">Jan 23, 2026</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Next Deadline Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Next Deadline</p>
                <h4 className="text-gray-900">March 10, 2026</h4>
              </div>
            </div>
            <p className="text-sm text-gray-600">Document Submission</p>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">64 days remaining</p>
            </div>
          </div>

          {/* Application Progress Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Application Progress</p>
                <h4 className="text-gray-900">80% Complete</h4>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full" style={{ width: '80%' }}></div>
            </div>
            <p className="text-xs text-gray-500">4 of 5 sections completed</p>
          </div>

          {/* Total Documents Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Documents</p>
                <h4 className="text-gray-900">12 Files</h4>
              </div>
            </div>
            <p className="text-sm text-gray-600">All verified ✓</p>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button className="text-xs text-blue-600 hover:text-blue-700">View all documents →</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Application Timeline */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-gray-900 mb-6">Application Timeline</h3>
            <div className="space-y-6">
              {applicationSteps.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        step.status === 'completed'
                          ? 'bg-green-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    {index < applicationSteps.length - 1 && (
                      <div
                        className={`w-0.5 h-12 ${
                          step.status === 'completed' ? 'bg-green-200' : 'bg-gray-200'
                        }`}
                      ></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-gray-900">{step.name}</h4>
                      {step.status === 'completed' && (
                        <span className="text-xs text-gray-500">{step.completedDate}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {step.status === 'completed' ? 'Completed' : 'Pending review'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 ${activity.color}`}>
                      <activity.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{activity.date}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-700 mt-4">
                View all activity →
              </button>
            </div>

            {/* Important Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <h4 className="text-amber-900 text-sm mb-1">Action Required</h4>
                  <p className="text-xs text-amber-700">
                    Complete the final review section to proceed with your application.
                  </p>
                  <button className="text-xs text-amber-800 hover:text-amber-900 mt-2 underline">
                    Complete now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Support Section */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-gray-600" />
              <h3 className="text-gray-900">Contact Support</h3>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700">
              View all messages →
            </button>
          </div>
          
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Have a question? Need help with your application?"
            className="w-full border border-gray-300 rounded-lg p-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
          
          <div className="flex justify-end mt-4">
            <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Send Message
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
