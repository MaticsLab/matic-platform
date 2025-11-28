'use client'

import { useState, useEffect } from 'react'
import { Mail, Send, Clock, FileText, Users, ChevronRight, Plus, Search, Tag } from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { Form, FormField, FormSubmission } from '@/types/forms'

interface CommunicationsCenterProps {
  workspaceId: string
  formId: string | null
}

export function CommunicationsCenter({ workspaceId, formId }: CommunicationsCenterProps) {
  const [activeView, setActiveView] = useState<'compose' | 'templates' | 'history'>('compose')
  const [fields, setFields] = useState<FormField[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'submitted' | 'draft' | 'approved' | 'rejected'>('all')
  const [messageBody, setMessageBody] = useState('')
  const [subject, setSubject] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!formId) return
      try {
        const form = await goClient.get<Form>(`/forms/${formId}`)
        setFields(form.fields || [])
        
        const subs = await goClient.get<FormSubmission[]>(`/forms/${formId}/submissions`)
        setSubmissions(subs || [])
      } catch (error) {
        console.error('Failed to fetch data:', error)
      }
    }
    fetchData()
  }, [formId])

  const getRecipientCount = () => {
    if (recipientFilter === 'all') return submissions.length
    return submissions.filter(s => s.status === recipientFilter).length
  }

  const insertMergeTag = (tagName: string) => {
    setMessageBody(prev => prev + ` {${tagName}} `)
  }

  const handleSend = () => {
    alert(`Simulating sending email to ${getRecipientCount()} recipients.\n\nSubject: ${subject}\nBody: ${messageBody}`)
    // In a real app, this would call an API endpoint
  }

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
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col rounded-l-2xl">
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
                <button 
                  onClick={handleSend}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2"
                >
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
                    <button 
                      onClick={() => setRecipientFilter('all')}
                      className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1 transition-colors ${
                        recipientFilter === 'all' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Users className="w-3 h-3" />
                      All Applicants
                    </button>
                    <button 
                      onClick={() => setRecipientFilter('submitted')}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        recipientFilter === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Submitted Only
                    </button>
                    <button 
                      onClick={() => setRecipientFilter('approved')}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        recipientFilter === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Finalists (Approved)
                    </button>
                    <div className="ml-auto text-sm text-gray-500 font-medium self-center">
                      Targeting {getRecipientCount()} recipients
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                {/* Editor Placeholder */}
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <div className="border border-gray-300 rounded-lg overflow-hidden flex-1 min-h-[300px] flex flex-col">
                    <div className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex flex-wrap gap-2 items-center">
                      <button className="p-1 hover:bg-gray-200 rounded text-sm font-bold w-8">B</button>
                      <button className="p-1 hover:bg-gray-200 rounded text-sm italic w-8">I</button>
                      <button className="p-1 hover:bg-gray-200 rounded text-sm underline w-8">U</button>
                      <div className="w-px h-4 bg-gray-300 mx-1 self-center"></div>
                      <span className="text-xs font-medium text-gray-500 mr-1">Merge Tags:</span>
                      <div className="flex gap-2 overflow-x-auto max-w-[400px] pb-1">
                        <button 
                          onClick={() => insertMergeTag('First Name')}
                          className="px-2 py-1 hover:bg-gray-200 rounded text-xs bg-white border border-gray-300 whitespace-nowrap flex items-center gap-1"
                        >
                          <Tag className="w-3 h-3 text-blue-500" />
                          {'{First Name}'}
                        </button>
                        {fields.slice(0, 5).map(field => (
                          <button 
                            key={field.id}
                            onClick={() => insertMergeTag(field.label)}
                            className="px-2 py-1 hover:bg-gray-200 rounded text-xs bg-white border border-gray-300 whitespace-nowrap flex items-center gap-1"
                          >
                            <Tag className="w-3 h-3 text-gray-400" />
                            {`{${field.label}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      className="flex-1 p-4 focus:outline-none resize-none font-mono text-sm"
                      placeholder="Type your message here..."
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
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
