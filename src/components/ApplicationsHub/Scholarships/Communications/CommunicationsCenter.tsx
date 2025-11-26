'use client'

import { useState } from 'react'
import { Mail, Send, Clock, FileText, Users, ChevronRight, Plus, Search } from 'lucide-react'

interface CommunicationsCenterProps {
  workspaceId: string
  formId: string | null
}

export function CommunicationsCenter({ workspaceId, formId }: CommunicationsCenterProps) {
  const [activeView, setActiveView] = useState<'compose' | 'templates' | 'history'>('compose')

  const templates = [
    { id: 1, name: 'Application Received', subject: 'We received your application', type: 'Automated' },
    { id: 2, name: 'Interview Invitation', subject: 'Invitation to Interview: Fall Scholarship', type: 'Manual' },
    { id: 3, name: 'Award Letter', subject: 'Congratulations! Scholarship Award Notification', type: 'Manual' },
    { id: 4, name: 'Rejection Letter', subject: 'Update on your application', type: 'Manual' },
  ]

  const history = [
    { id: 1, subject: 'Reminder: Deadline Approaching', sent: '2 hours ago', recipients: 45, status: 'Delivered' },
    { id: 2, subject: 'Application Received', sent: 'Yesterday', recipients: 1, status: 'Opened' },
    { id: 3, subject: 'Welcome to the Portal', sent: '3 days ago', recipients: 12, status: 'Delivered' },
  ]

  return (
    <div className="h-full flex bg-white">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4">
          <button 
            onClick={() => setActiveView('compose')}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Message
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          <button
            onClick={() => setActiveView('compose')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeView === 'compose' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Send className="w-4 h-4" />
            Compose
          </button>
          <button
            onClick={() => setActiveView('templates')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeView === 'templates' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Templates
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeView === 'history' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            History
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeView === 'compose' && (
          <div className="h-full flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
              <div className="flex gap-2">
                <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Save Draft</button>
                <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Recipients */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                  <div className="flex flex-wrap gap-2">
                    <button className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      All Applicants (142)
                    </button>
                    <button className="px-3 py-1 bg-white text-gray-600 rounded-full text-sm font-medium border border-gray-200 hover:bg-gray-50">
                      Submitted Only (89)
                    </button>
                    <button className="px-3 py-1 bg-white text-gray-600 rounded-full text-sm font-medium border border-gray-200 hover:bg-gray-50">
                      Draft Status (53)
                    </button>
                    <button className="px-3 py-1 bg-white text-gray-600 rounded-full text-sm font-medium border border-gray-200 hover:bg-gray-50">
                      + Custom Filter
                    </button>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email subject..."
                  />
                </div>

                {/* Editor Placeholder */}
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <div className="border border-gray-300 rounded-lg overflow-hidden flex-1 min-h-[300px] flex flex-col">
                    <div className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex gap-2">
                      <button className="p-1 hover:bg-gray-200 rounded text-sm font-bold">B</button>
                      <button className="p-1 hover:bg-gray-200 rounded text-sm italic">I</button>
                      <button className="p-1 hover:bg-gray-200 rounded text-sm underline">U</button>
                      <div className="w-px h-4 bg-gray-300 mx-1 self-center"></div>
                      <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs bg-white border border-gray-300">
                        {'{First Name}'}
                      </button>
                      <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs bg-white border border-gray-300">
                        {'{Application Status}'}
                      </button>
                    </div>
                    <textarea 
                      className="flex-1 p-4 focus:outline-none resize-none"
                      placeholder="Type your message here..."
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'templates' && (
          <div className="h-full flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Email Templates</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {template.type}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{template.subject}</p>
                </div>
              ))}
              <button className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center text-gray-500 hover:text-blue-600">
                <Plus className="w-8 h-8 mb-2" />
                <span className="font-medium">Create New Template</span>
              </button>
            </div>
          </div>
        )}

        {activeView === 'history' && (
          <div className="h-full flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Sent History</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Recipients</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sent</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.subject}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.recipients}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.sent}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-gray-400 hover:text-gray-600">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
