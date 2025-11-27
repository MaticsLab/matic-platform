'use client'

import { useState, useMemo, useEffect } from 'react'
import { Users, Plus, Copy, ExternalLink, Trash2, CheckCircle, RefreshCw, Search, Filter, Mail, Link as LinkIcon, MoreHorizontal, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'

interface Reviewer {
  id: string
  name: string
  email: string
  token: string
  assignedCount: number
  completedCount: number
  status: 'active' | 'completed' | 'expired'
  lastActive: string
  role: 'Committee Member' | 'External Reviewer' | 'Admin'
}

interface ReviewerManagementProps {
  formId: string | null
}

export function ReviewerManagement({ formId }: ReviewerManagementProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [newReviewerName, setNewReviewerName] = useState('')
  const [newReviewerEmail, setNewReviewerEmail] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (formId) {
      fetchReviewers()
    }
  }, [formId])

  const fetchReviewers = async () => {
    setIsLoading(true)
    try {
      const form = await goClient.get<Form>(`/forms/${formId}`)
      const settings = form.settings || {}
      if (settings.reviewers) {
        setReviewers(settings.reviewers as Reviewer[])
      } else {
        // Default mock data if empty
        setReviewers([])
      }
    } catch (error) {
      console.error('Failed to fetch reviewers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveReviewers = async (updatedReviewers: Reviewer[]) => {
    if (!formId) return
    try {
      const form = await goClient.get<Form>(`/forms/${formId}`)
      const updatedSettings = {
        ...form.settings,
        reviewers: updatedReviewers
      }
      await goClient.patch(`/forms/${formId}`, {
        settings: updatedSettings
      })
      setReviewers(updatedReviewers)
    } catch (error) {
      console.error('Failed to save reviewers:', error)
    }
  }

  const generateToken = () => 'rev_' + Math.random().toString(36).substr(2, 6)

  const handleCreateReviewer = async () => {
    const newReviewer: Reviewer = {
      id: Date.now().toString(),
      name: newReviewerName,
      email: newReviewerEmail,
      token: generateToken(),
      assignedCount: 10, // Default assignment
      completedCount: 0,
      status: 'active',
      lastActive: 'Just now',
      role: 'External Reviewer'
    }
    const updated = [...reviewers, newReviewer]
    await saveReviewers(updated)
    setShowInviteModal(false)
    setNewReviewerName('')
    setNewReviewerEmail('')
  }

  const handleDeleteReviewer = async (id: string) => {
    if (!confirm('Are you sure you want to remove this reviewer?')) return
    const updated = reviewers.filter(r => r.id !== id)
    await saveReviewers(updated)
  }

  const copyLink = (id: string, token: string) => {
    const url = `${window.location.origin}/external-review/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredReviewers = useMemo(() => {
    return reviewers.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filterStatus === 'all' || r.status === filterStatus
      return matchesSearch && matchesFilter
    })
  }, [reviewers, searchQuery, filterStatus])

  const stats = {
    total: reviewers.length,
    active: reviewers.filter(r => r.status === 'active').length,
    completed: reviewers.filter(r => r.status === 'completed').length,
    totalAssigned: reviewers.reduce((acc, r) => acc + r.assignedCount, 0),
    totalCompleted: reviewers.reduce((acc, r) => acc + r.completedCount, 0)
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* Header Stats */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Review Team</h2>
            <p className="text-gray-500 mt-1">Manage access and track progress for your scholarship committee.</p>
          </div>
          <button 
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm transition-all hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            Invite Reviewer
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Total Reviewers</p>
              <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-900">Reviews Completed</p>
              <p className="text-2xl font-bold text-green-700">{stats.totalCompleted} <span className="text-sm font-normal text-green-600">/ {stats.totalAssigned}</span></p>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-900">Active Now</p>
              <p className="text-2xl font-bold text-purple-700">{stats.active}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & List */}
      <div className="p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Toolbar */}
          <div className="flex gap-4 items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0 rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex gap-1 pr-2">
              <button 
                onClick={() => setFilterStatus('all')}
                className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors", filterStatus === 'all' ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50")}
              >
                All
              </button>
              <button 
                onClick={() => setFilterStatus('active')}
                className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors", filterStatus === 'active' ? "bg-green-50 text-green-700" : "text-gray-500 hover:bg-gray-50")}
              >
                Active
              </button>
              <button 
                onClick={() => setFilterStatus('completed')}
                className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-colors", filterStatus === 'completed' ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50")}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Reviewer Cards */}
          <div className="grid gap-4">
            {filteredReviewers.map((reviewer) => (
              <div key={reviewer.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold", 
                      reviewer.status === 'active' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    )}>
                      {reviewer.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-lg">{reviewer.name}</h3>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium border border-gray-200">
                          {reviewer.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {reviewer.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Active {reviewer.lastActive}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={cn("px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5",
                      reviewer.status === 'active' ? 'bg-green-100 text-green-700' :
                      reviewer.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", 
                        reviewer.status === 'active' ? 'bg-green-500' :
                        reviewer.status === 'completed' ? 'bg-blue-500' :
                        'bg-gray-500'
                      )} />
                      {reviewer.status.charAt(0).toUpperCase() + reviewer.status.slice(1)}
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-gray-700">Review Progress</span>
                      <span className="text-gray-500">{Math.round((reviewer.completedCount / reviewer.assignedCount) * 100)}% Complete</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", 
                          reviewer.completedCount === reviewer.assignedCount ? "bg-green-500" : "bg-blue-600"
                        )}
                        style={{ width: `${(reviewer.completedCount / reviewer.assignedCount) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {reviewer.completedCount} of {reviewer.assignedCount} applications reviewed
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center justify-end gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 max-w-[250px]">
                      <LinkIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <code className="text-xs text-gray-600 truncate flex-1">
                        .../external-review/{reviewer.token}
                      </code>
                      <button 
                        onClick={() => copyLink(reviewer.id, reviewer.token)}
                        className={cn("text-xs font-medium transition-colors", 
                          copiedId === reviewer.id ? "text-green-600" : "text-blue-600 hover:text-blue-700"
                        )}
                      >
                        {copiedId === reviewer.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <button 
                      onClick={() => handleDeleteReviewer(reviewer.id)}
                      className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredReviewers.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-medium">No reviewers found</h3>
                <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Invite Reviewer</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <Trash2 className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reviewer Name</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newReviewerName}
                  onChange={(e) => setNewReviewerName(e.target.value)}
                  placeholder="e.g. Dr. Smith"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newReviewerEmail}
                  onChange={(e) => setNewReviewerEmail(e.target.value)}
                  placeholder="reviewer@example.com"
                />
              </div>
              
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Strategy</label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="p-3 border border-blue-200 bg-blue-50 rounded-lg text-left hover:border-blue-300 transition-colors">
                    <span className="block text-sm font-semibold text-blue-900">Random Batch</span>
                    <span className="text-xs text-blue-700">Assign 10 random apps</span>
                  </button>
                  <button className="p-3 border border-gray-200 rounded-lg text-left hover:border-gray-300 hover:bg-gray-50 transition-colors">
                    <span className="block text-sm font-semibold text-gray-900">Manual Select</span>
                    <span className="text-xs text-gray-500">Choose specific apps</span>
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <Shield className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-600">
                  <p className="font-medium text-gray-900 mb-0.5">Secure Access</p>
                  Reviewers will receive a unique, time-limited link. They can only access assigned applications and cannot see other reviewers' scores.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
              <button 
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateReviewer}
                disabled={!newReviewerName}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                Generate Invite Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
