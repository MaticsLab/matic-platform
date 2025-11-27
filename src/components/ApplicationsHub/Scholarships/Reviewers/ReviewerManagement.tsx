'use client'

import { useState, useMemo, useEffect } from 'react'
import { 
  Users, CheckCircle, RefreshCw, Search, Mail, 
  Link as LinkIcon, Shield, Clock, 
  UserPlus, Send, ExternalLink,
  Sparkles, Target, BarChart3, ArrowRight, Copy, Trash2,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'
import { workflowsClient, ReviewerType as WorkflowReviewerType } from '@/lib/api/workflows-client'
import { showToast } from '@/lib/toast'

interface Reviewer {
  id: string
  name: string
  email: string
  token: string
  assignedCount: number
  completedCount: number
  status: 'active' | 'completed' | 'expired'
  lastActive: string
  role: string
  reviewer_type_id?: string
}

interface Submission {
  id: string
  data: any
  metadata?: {
    assigned_reviewers?: string[]
    [key: string]: any
  }
  status?: string
}

interface ReviewerManagementProps {
  formId: string | null
  workspaceId?: string
}

export function ReviewerManagement({ formId, workspaceId }: ReviewerManagementProps) {
  const [reviewerTypes, setReviewerTypes] = useState<WorkflowReviewerType[]>([])
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [activeView, setActiveView] = useState<'team' | 'invite'>('team')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedReviewerId, setExpandedReviewerId] = useState<string | null>(null)
  
  const [newReviewerName, setNewReviewerName] = useState('')
  const [newReviewerEmail, setNewReviewerEmail] = useState('')
  const [selectedReviewerTypeId, setSelectedReviewerTypeId] = useState<string>('')
  const [assignmentStrategy, setAssignmentStrategy] = useState<'random' | 'manual'>('random')
  const [assignmentCount, setAssignmentCount] = useState(10)
  const [onlyUnassigned, setOnlyUnassigned] = useState(true) // New: only assign unassigned apps
  const [isAssigning, setIsAssigning] = useState(false)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([])
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3>(1)
  
  // New: For assigning more apps to existing reviewer
  const [assignToExistingReviewer, setAssignToExistingReviewer] = useState<Reviewer | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)

  useEffect(() => {
    if (formId) fetchReviewers()
  }, [formId])

  useEffect(() => {
    const fetchReviewerTypes = async () => {
      if (!workspaceId) return
      try {
        const types = await workflowsClient.listReviewerTypes(workspaceId)
        setReviewerTypes(types)
      } catch (error) {
        console.error('Failed to fetch reviewer types:', error)
      }
    }
    fetchReviewerTypes()
  }, [workspaceId])

  useEffect(() => {
    if (assignmentStrategy === 'manual' && formId && submissions.length === 0) {
      fetchSubmissions()
    }
  }, [assignmentStrategy, formId])

  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true)
    try {
      const data = await goClient.get<Submission[]>(`/forms/${formId}/submissions`)
      // Parse metadata if it's a string
      const parsed = (Array.isArray(data) ? data : []).map(sub => ({
        ...sub,
        metadata: typeof sub.metadata === 'string' ? JSON.parse(sub.metadata) : sub.metadata || {}
      }))
      setSubmissions(parsed)
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
    } finally {
      setIsLoadingSubmissions(false)
    }
  }

  const fetchReviewers = async () => {
    setIsLoading(true)
    try {
      const form = await goClient.get<Form>(`/forms/${formId}`)
      const settings = form.settings || {}
      setReviewers(settings.reviewers ? (settings.reviewers as Reviewer[]) : [])
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
      await goClient.patch(`/forms/${formId}`, {
        settings: { ...form.settings, reviewers: updatedReviewers }
      })
      setReviewers(updatedReviewers)
    } catch (error) {
      console.error('Failed to save reviewers:', error)
    }
  }

  const generateToken = () => 'rev_' + Math.random().toString(36).substr(2, 8)

  const handleCreateReviewer = async () => {
    if (!formId || !newReviewerName.trim()) return
    setIsAssigning(true)
    
    try {
      const reviewerId = Date.now().toString()
      const selectedType = reviewerTypes.find(t => t.id === selectedReviewerTypeId)
      
      const newReviewer: Reviewer = {
        id: reviewerId,
        name: newReviewerName,
        email: newReviewerEmail,
        token: generateToken(),
        assignedCount: 0,
        completedCount: 0,
        status: 'active',
        lastActive: 'Just now',
        role: selectedType?.name || 'External Reviewer',
        reviewer_type_id: selectedReviewerTypeId || undefined
      }
      
      const updated = [...reviewers, newReviewer]
      await saveReviewers(updated)
      
      if (assignmentStrategy === 'random') {
        const response = await goClient.post<{count: number}>(`/forms/${formId}/reviewers/${reviewerId}/assign`, {
          strategy: 'random', 
          count: assignmentCount, 
          reviewer_type_id: selectedReviewerTypeId || undefined,
          only_unassigned: onlyUnassigned
        })
        setReviewers(updated.map(r => r.id === reviewerId ? { ...r, assignedCount: response.count } : r))
        await fetchSubmissions() // Refresh to update assignment status
      } else if (assignmentStrategy === 'manual' && selectedSubmissionIds.length > 0) {
        const response = await goClient.post<{count: number}>(`/forms/${formId}/reviewers/${reviewerId}/assign`, {
          strategy: 'manual', 
          submission_ids: selectedSubmissionIds, 
          reviewer_type_id: selectedReviewerTypeId || undefined
        })
        setReviewers(updated.map(r => r.id === reviewerId ? { ...r, assignedCount: response.count } : r))
        await fetchSubmissions() // Refresh to update assignment status
      }

      showToast('Reviewer invited successfully', 'success')
      setActiveView('team')
      resetInviteForm()
    } catch (error) {
      console.error('Failed to create reviewer:', error)
      showToast('Failed to invite reviewer', 'error')
    } finally {
      setIsAssigning(false)
    }
  }

  const resetInviteForm = () => {
    setNewReviewerName('')
    setNewReviewerEmail('')
    setSelectedReviewerTypeId('')
    setAssignmentStrategy('random')
    setAssignmentCount(10)
    setOnlyUnassigned(true)
    setSelectedSubmissionIds([])
    setInviteStep(1)
    setAssignToExistingReviewer(null)
    setShowAssignModal(false)
  }

  // New: Handle assigning more applications to an existing reviewer
  const handleAssignMoreToReviewer = async () => {
    if (!formId || !assignToExistingReviewer) return
    setIsAssigning(true)
    
    try {
      let newAssignedCount = 0
      
      if (assignmentStrategy === 'random') {
        const response = await goClient.post<{count: number}>(`/forms/${formId}/reviewers/${assignToExistingReviewer.id}/assign`, {
          strategy: 'random', 
          count: assignmentCount, 
          only_unassigned: onlyUnassigned
        })
        newAssignedCount = response.count
      } else if (assignmentStrategy === 'manual' && selectedSubmissionIds.length > 0) {
        const response = await goClient.post<{count: number}>(`/forms/${formId}/reviewers/${assignToExistingReviewer.id}/assign`, {
          strategy: 'manual', 
          submission_ids: selectedSubmissionIds
        })
        newAssignedCount = response.count
      }

      // Update the reviewer's assigned count
      const updatedReviewers = reviewers.map(r => 
        r.id === assignToExistingReviewer.id 
          ? { ...r, assignedCount: r.assignedCount + newAssignedCount } 
          : r
      )
      await saveReviewers(updatedReviewers)
      await fetchSubmissions() // Refresh to update assignment status

      showToast(`Assigned ${newAssignedCount} more applications to ${assignToExistingReviewer.name}`, 'success')
      resetInviteForm()
    } catch (error) {
      console.error('Failed to assign more applications:', error)
      showToast('Failed to assign applications', 'error')
    } finally {
      setIsAssigning(false)
    }
  }

  const openAssignMoreModal = (reviewer: Reviewer) => {
    setAssignToExistingReviewer(reviewer)
    setAssignmentStrategy('random')
    setAssignmentCount(10)
    setOnlyUnassigned(true)
    setSelectedSubmissionIds([])
    setShowAssignModal(true)
    if (submissions.length === 0) {
      fetchSubmissions()
    }
  }

  const handleDeleteReviewer = async (id: string) => {
    if (!confirm('Remove this reviewer?')) return
    await saveReviewers(reviewers.filter(r => r.id !== id))
    showToast('Reviewer removed', 'success')
  }

  const handleUpdateReviewerRole = async (reviewerId: string, newRoleId: string) => {
    const selectedType = reviewerTypes.find(t => t.id === newRoleId)
    if (!selectedType) return
    
    const updatedReviewers = reviewers.map(r => 
      r.id === reviewerId ? { ...r, role: selectedType.name, reviewer_type_id: newRoleId } : r
    )
    await saveReviewers(updatedReviewers)
    showToast(`Role updated to ${selectedType.name}`, 'success')
  }

  const copyLink = (id: string, token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/external-review/${token}`)
    setCopiedId(id)
    showToast('Link copied', 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredReviewers = useMemo(() => {
    return reviewers.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.email.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch && (filterStatus === 'all' || r.status === filterStatus)
    })
  }, [reviewers, searchQuery, filterStatus])

  const stats = {
    total: reviewers.length,
    active: reviewers.filter(r => r.status === 'active').length,
    totalAssigned: reviewers.reduce((acc, r) => acc + r.assignedCount, 0),
    totalCompleted: reviewers.reduce((acc, r) => acc + r.completedCount, 0)
  }
  const completionRate = stats.totalAssigned > 0 ? Math.round((stats.totalCompleted / stats.totalAssigned) * 100) : 0

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Review Team</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage reviewers and track progress</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setActiveView('team')} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", activeView === 'team' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
              <Users className="w-4 h-4 inline mr-2" />Team
            </button>
            <button onClick={() => setActiveView('invite')} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", activeView === 'invite' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
              <UserPlus className="w-4 h-4 inline mr-2" />Invite
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeView === 'team' ? (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: Users, value: stats.total, label: 'Total Reviewers', color: 'blue' },
                { icon: Target, value: stats.totalAssigned, label: 'Total Assigned', color: 'green' },
                { icon: CheckCircle, value: stats.totalCompleted, label: 'Completed', color: 'purple' },
                { icon: BarChart3, value: `${completionRate}%`, label: 'Completion Rate', color: 'amber' }
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `bg-${stat.color}-50`)}>
                      <stat.icon className={cn("w-5 h-5", `text-${stat.color}-600`)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search reviewers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                {(['all', 'active', 'completed'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize", filterStatus === s ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700")}>{s}</button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredReviewers.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No reviewers yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Invite committee members to start reviewing</p>
                  <button onClick={() => setActiveView('invite')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                    <UserPlus className="w-4 h-4" />Invite Reviewer
                  </button>
                </div>
              ) : filteredReviewers.map((reviewer) => {
                const isExpanded = expandedReviewerId === reviewer.id
                const progressPercent = reviewer.assignedCount > 0 ? Math.round((reviewer.completedCount / reviewer.assignedCount) * 100) : 0
                
                return (
                  <div key={reviewer.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-all">
                    <div className="p-4 flex items-center gap-4">
                      <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold", reviewer.status === 'completed' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>
                        {reviewer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">{reviewer.name}</h3>
                          <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">{reviewer.role}</span>
                          {reviewer.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1 truncate"><Mail className="w-3.5 h-3.5" />{reviewer.email || 'No email'}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{reviewer.lastActive}</span>
                        </div>
                      </div>
                      <div className="w-40 flex-shrink-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium text-gray-900">{reviewer.completedCount}/{reviewer.assignedCount}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", progressPercent === 100 ? "bg-green-500" : "bg-blue-500")} style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => copyLink(reviewer.id, reviewer.token)} className={cn("p-2 rounded-lg transition-colors", copiedId === reviewer.id ? "bg-green-50 text-green-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100")} title="Copy link">
                          {copiedId === reviewer.id ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button onClick={() => window.open(`/external-review/${reviewer.token}`, '_blank')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Open portal">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button onClick={() => setExpandedReviewerId(isExpanded ? null : reviewer.id)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                          <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50/50">
                        <div className="pt-4 space-y-4">
                          {/* Role Assignment */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-700">Role:</span>
                            </div>
                            {reviewerTypes.length > 0 ? (
                              <select
                                value={reviewerTypes.find(t => t.name === reviewer.role)?.id || ''}
                                onChange={(e) => handleUpdateReviewerRole(reviewer.id, e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="" disabled>Select role...</option>
                                {reviewerTypes.map(type => (
                                  <option key={type.id} value={type.id}>
                                    {type.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                                {reviewer.role}
                              </span>
                            )}
                          </div>
                          
                          {/* Link and Status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                                <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
                                <code className="text-xs text-gray-600">/external-review/{reviewer.token}</code>
                              </div>
                              <span className={cn("px-2 py-1 text-xs font-medium rounded-full", reviewer.status === 'active' && "bg-green-100 text-green-700", reviewer.status === 'completed' && "bg-blue-100 text-blue-700", reviewer.status === 'expired' && "bg-gray-100 text-gray-600")}>
                                {reviewer.status.charAt(0).toUpperCase() + reviewer.status.slice(1)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => openAssignMoreModal(reviewer)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200">
                                <Target className="w-4 h-4" />Assign More
                              </button>
                              <button onClick={() => handleDeleteReviewer(reviewer.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium", inviteStep >= step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500")}>{step}</div>
                  {step < 3 && <div className={cn("w-16 h-0.5 mx-2", inviteStep > step ? "bg-blue-600" : "bg-gray-200")} />}
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              {inviteStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3"><UserPlus className="w-6 h-6 text-blue-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-900">Reviewer Details</h2>
                    <p className="text-sm text-gray-500">Enter the reviewer&apos;s information</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                      <input type="text" value={newReviewerName} onChange={(e) => setNewReviewerName(e.target.value)} placeholder="Dr. Jane Smith" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                      <input type="email" value={newReviewerEmail} onChange={(e) => setNewReviewerEmail(e.target.value)} placeholder="reviewer@university.edu" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Reviewer Role <span className="text-red-500">*</span>
                      </label>
                      {reviewerTypes.length > 0 ? (
                        <select value={selectedReviewerTypeId} onChange={(e) => setSelectedReviewerTypeId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Select a role...</option>
                          {reviewerTypes.map(type => (<option key={type.id} value={type.id}>{type.name}{type.description ? ` - ${type.description}` : ''}</option>))}
                        </select>
                      ) : (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-800 font-medium">No roles configured</p>
                          <p className="text-xs text-amber-600 mt-1">Go to Workflows → Reviewer Roles to create roles first, then come back to invite reviewers.</p>
                        </div>
                      )}
                      {selectedReviewerTypeId && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          {reviewerTypes.find(t => t.id === selectedReviewerTypeId)?.description || 'This role determines what the reviewer can access and evaluate.'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button onClick={() => setInviteStep(2)} disabled={!newReviewerName.trim() || !selectedReviewerTypeId} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                      Continue<ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {inviteStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3"><Target className="w-6 h-6 text-purple-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-900">Assignment Strategy</h2>
                    <p className="text-sm text-gray-500">How should applications be assigned?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setAssignmentStrategy('random')} className={cn("p-4 rounded-xl border-2 text-left transition-all", assignmentStrategy === 'random' ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                      <Sparkles className={cn("w-5 h-5 mb-2", assignmentStrategy === 'random' ? "text-blue-600" : "text-gray-400")} />
                      <h3 className="font-medium text-gray-900">Random Assignment</h3>
                      <p className="text-xs text-gray-500 mt-1">Auto-assign random applications</p>
                    </button>
                    <button onClick={() => setAssignmentStrategy('manual')} className={cn("p-4 rounded-xl border-2 text-left transition-all", assignmentStrategy === 'manual' ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                      <Target className={cn("w-5 h-5 mb-2", assignmentStrategy === 'manual' ? "text-blue-600" : "text-gray-400")} />
                      <h3 className="font-medium text-gray-900">Manual Selection</h3>
                      <p className="text-xs text-gray-500 mt-1">Choose specific applications</p>
                    </button>
                  </div>
                  
                  {/* Only Unassigned Toggle - shown for random strategy */}
                  {assignmentStrategy === 'random' && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Only unassigned applications</label>
                          <p className="text-xs text-gray-500 mt-0.5">Only assign applications not yet assigned to any reviewer</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOnlyUnassigned(!onlyUnassigned)}
                          className={cn(
                            "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                            onlyUnassigned ? "bg-blue-600" : "bg-gray-200"
                          )}
                        >
                          <span className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            onlyUnassigned ? "translate-x-5" : "translate-x-0"
                          )} />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Number of Applications</label>
                        <input type="number" min="1" max="100" value={assignmentCount} onChange={(e) => setAssignmentCount(parseInt(e.target.value) || 10)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      {submissions.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {submissions.filter(s => !s.metadata?.assigned_reviewers?.length).length} unassigned of {submissions.length} total applications
                        </p>
                      )}
                    </div>
                  )}
                  
                  {assignmentStrategy === 'manual' && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Select Applications ({selectedSubmissionIds.length})</label>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Unassigned</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded">Assigned</span>
                        </div>
                      </div>
                      <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-white">
                        {isLoadingSubmissions ? (
                          <div className="p-4 text-center text-gray-500 text-sm"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />Loading...</div>
                        ) : submissions.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">No submissions available</div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {submissions.map(sub => {
                              const data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data
                              const name = data.personal?.firstName ? `${data.personal.firstName} ${data.personal.lastName}` : `Submission #${sub.id.substring(0, 8)}`
                              const isSelected = selectedSubmissionIds.includes(sub.id)
                              const assignedReviewers = sub.metadata?.assigned_reviewers || []
                              const isAssigned = assignedReviewers.length > 0
                              const assignedToNames = assignedReviewers.map((rid: string) => {
                                const r = reviewers.find(rev => rev.id === rid)
                                return r?.name || `Reviewer ${rid.substring(0, 4)}`
                              })
                              
                              return (
                                <div 
                                  key={sub.id} 
                                  onClick={() => setSelectedSubmissionIds(isSelected ? selectedSubmissionIds.filter(id => id !== sub.id) : [...selectedSubmissionIds, sub.id])} 
                                  className={cn(
                                    "p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50",
                                    isSelected && "bg-blue-50",
                                    isAssigned && !isSelected && "bg-amber-50/50"
                                  )}
                                >
                                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0", isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300")}>
                                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-900 truncate block">{name}</span>
                                    {isAssigned && (
                                      <span className="text-xs text-amber-600">Assigned to: {assignedToNames.join(', ')}</span>
                                    )}
                                  </div>
                                  {!isAssigned && (
                                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex-shrink-0">New</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>{submissions.filter(s => !s.metadata?.assigned_reviewers?.length).length} unassigned</span>
                        <button 
                          type="button"
                          onClick={() => {
                            const unassignedIds = submissions
                              .filter(s => !s.metadata?.assigned_reviewers?.length)
                              .map(s => s.id)
                            setSelectedSubmissionIds(unassignedIds)
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Select all unassigned
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between pt-4">
                    <button onClick={() => setInviteStep(1)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Back</button>
                    <button onClick={() => setInviteStep(3)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Continue<ArrowRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}

              {inviteStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3"><Send className="w-6 h-6 text-green-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-900">Review & Send</h2>
                    <p className="text-sm text-gray-500">Confirm invitation details</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200"><span className="text-sm text-gray-500">Reviewer</span><span className="text-sm font-medium text-gray-900">{newReviewerName}</span></div>
                    {newReviewerEmail && <div className="flex justify-between py-2 border-b border-gray-200"><span className="text-sm text-gray-500">Email</span><span className="text-sm font-medium text-gray-900">{newReviewerEmail}</span></div>}
                    <div className="flex justify-between py-2 border-b border-gray-200"><span className="text-sm text-gray-500">Role</span><span className="text-sm font-medium text-gray-900">{reviewerTypes.find(t => t.id === selectedReviewerTypeId)?.name || 'External Reviewer'}</span></div>
                    <div className="flex justify-between py-2"><span className="text-sm text-gray-500">Applications</span><span className="text-sm font-medium text-gray-900">{assignmentStrategy === 'random' ? `${assignmentCount} (random)` : `${selectedSubmissionIds.length} selected`}</span></div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Secure Access Link</p>
                      <p className="text-blue-600 mt-0.5">A unique link will be generated. The reviewer will only see assigned applications.</p>
                    </div>
                  </div>
                  <div className="flex justify-between pt-4">
                    <button onClick={() => setInviteStep(2)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Back</button>
                    <button onClick={handleCreateReviewer} disabled={isAssigning} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {isAssigning ? <><RefreshCw className="w-4 h-4 animate-spin" />Creating...</> : <><Send className="w-4 h-4" />Generate Invite Link</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 text-center">
              <button onClick={() => { setActiveView('team'); resetInviteForm() }} className="text-sm text-gray-500 hover:text-gray-700">Cancel and return to team</button>
            </div>
          </div>
        )}
      </div>

      {/* Assign More Modal */}
      {showAssignModal && assignToExistingReviewer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Assign More Applications</h3>
                <p className="text-sm text-gray-500">to {assignToExistingReviewer.name}</p>
              </div>
              <button onClick={resetInviteForm} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Strategy Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setAssignmentStrategy('random')} className={cn("p-3 rounded-xl border-2 text-left transition-all", assignmentStrategy === 'random' ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                  <Sparkles className={cn("w-4 h-4 mb-1", assignmentStrategy === 'random' ? "text-blue-600" : "text-gray-400")} />
                  <h3 className="font-medium text-gray-900 text-sm">Random</h3>
                </button>
                <button onClick={() => setAssignmentStrategy('manual')} className={cn("p-3 rounded-xl border-2 text-left transition-all", assignmentStrategy === 'manual' ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                  <Target className={cn("w-4 h-4 mb-1", assignmentStrategy === 'manual' ? "text-blue-600" : "text-gray-400")} />
                  <h3 className="font-medium text-gray-900 text-sm">Manual</h3>
                </button>
              </div>

              {assignmentStrategy === 'random' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Only unassigned</label>
                      <p className="text-xs text-gray-500">Skip already assigned applications</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnlyUnassigned(!onlyUnassigned)}
                      className={cn(
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        onlyUnassigned ? "bg-blue-600" : "bg-gray-200"
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                        onlyUnassigned ? "translate-x-5" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of applications</label>
                    <input type="number" min="1" max="100" value={assignmentCount} onChange={(e) => setAssignmentCount(parseInt(e.target.value) || 10)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {submissions.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {submissions.filter(s => !s.metadata?.assigned_reviewers?.length).length} unassigned of {submissions.length} total
                    </p>
                  )}
                </div>
              )}

              {assignmentStrategy === 'manual' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Select ({selectedSubmissionIds.length})</label>
                    <button 
                      type="button"
                      onClick={() => {
                        const unassignedIds = submissions
                          .filter(s => !s.metadata?.assigned_reviewers?.includes(assignToExistingReviewer.id))
                          .map(s => s.id)
                        setSelectedSubmissionIds(unassignedIds)
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Select all available
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto bg-white">
                    {isLoadingSubmissions ? (
                      <div className="p-4 text-center text-gray-500 text-sm"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />Loading...</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {submissions.map(sub => {
                          const data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data
                          const name = data.personal?.firstName ? `${data.personal.firstName} ${data.personal.lastName}` : `#${sub.id.substring(0, 8)}`
                          const isSelected = selectedSubmissionIds.includes(sub.id)
                          const isAlreadyAssignedToThis = sub.metadata?.assigned_reviewers?.includes(assignToExistingReviewer.id)
                          
                          if (isAlreadyAssignedToThis) return null // Hide already assigned to this reviewer
                          
                          const assignedReviewers = sub.metadata?.assigned_reviewers || []
                          const isAssignedToOthers = assignedReviewers.length > 0
                          
                          return (
                            <div 
                              key={sub.id} 
                              onClick={() => setSelectedSubmissionIds(isSelected ? selectedSubmissionIds.filter(id => id !== sub.id) : [...selectedSubmissionIds, sub.id])} 
                              className={cn("p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50", isSelected && "bg-blue-50")}
                            >
                              <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300")}>
                                {isSelected && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className="text-sm text-gray-900 truncate flex-1">{name}</span>
                              {!isAssignedToOthers && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">New</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={resetInviteForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button 
                onClick={handleAssignMoreToReviewer} 
                disabled={isAssigning || (assignmentStrategy === 'manual' && selectedSubmissionIds.length === 0)}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isAssigning ? <><RefreshCw className="w-4 h-4 animate-spin" />Assigning...</> : <><Target className="w-4 h-4" />Assign</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
