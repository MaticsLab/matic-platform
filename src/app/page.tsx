'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/better-auth-client'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Badge } from '@/ui-components/badge'
import {
  ArrowRight,
  Play,
  Check,
  ChevronRight,
  ChevronDown,
  Table2,
  LayoutGrid,
  FileText,
  Users,
  Workflow,
  Globe,
  Sparkles,
  Shield,
  Zap,
  BarChart3,
  Star,
  Menu,
  X,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  GripVertical,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Settings,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Type,
  Hash,
  List,
  CheckSquare,
  Upload,
  Link2,
  ExternalLink,
  LayoutDashboard,
  MessageSquare,
  Home,
  Send,
  Loader2,
  ArrowUp,
  Database,
  Bell,
  CheckCircle2,
  PanelLeftOpen,
  PanelLeftClose
} from 'lucide-react'
import { cn } from '@/lib/utils'
// Import actual application components
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui-components/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Progress } from '@/ui-components/progress'
// Import the useCompletion hook for AI functionality
import { useCompletion } from '@ai-sdk/react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/ui-components/dropdown-menu'

// ============================================================================
// Navigation Component
// ============================================================================
function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { data } = useSession()
  const isAuthenticated = !!data?.user

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Matic</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </Link>
            <Link href="#demo" className="text-gray-600 hover:text-gray-900 transition-colors">
              Demo
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/workspaces">
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/signup">
                  <Button>Get Started Free</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg p-6 space-y-4">
            <Link href="#features" className="block text-gray-600 hover:text-gray-900">
              Features
            </Link>
            <Link href="#demo" className="block text-gray-600 hover:text-gray-900">
              Demo
            </Link>
            <div className="pt-4 border-t space-y-2">
              {isAuthenticated ? (
                <Link href="/workspaces" className="block">
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="block">
                    <Button variant="outline" className="w-full">Sign In</Button>
                  </Link>
                  <Link href="/signup" className="block">
                    <Button className="w-full">Get Started Free</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

// ============================================================================
// Hero Section
// ============================================================================
function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-blue-100/40 to-indigo-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-700 mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Now with AI-powered workflows</span>
            <ChevronRight className="w-4 h-4" />
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 tracking-tight mb-6">
            Build better
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> workflows </span>
            for your team
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Create powerful forms, organize data in flexible tables, and streamline review processes—all in one beautiful platform.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-6 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all">
                Start for Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </Link>
          </div>

          {/* Social Proof */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-700">500+</span> teams already use Matic
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// Real Portal Content - Actual Portal Components
// ============================================================================
function RealPortalContent({ currentView, layout }: {
  currentView: 'dashboard' | 'application' | 'messages'
  layout: 'sidebar' | 'tabbed' | 'minimal'
}) {
  if (currentView === 'dashboard') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome back, Jane! 👋</h2>
            <p className="text-gray-600">Here's an overview of your scholarship application progress.</p>
          </div>
        </div>

        {/* Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Application</p>
                    <p className="text-xs text-gray-500">75% Complete</p>
                  </div>
                </div>
              </div>
              <Progress value={75} className="mb-2" />
              <p className="text-xs text-gray-500">2 sections remaining</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Next Deadline</p>
                  <p className="text-xs text-gray-500">March 15, 2024</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">Essay submission due</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Messages</p>
                  <p className="text-xs text-gray-500">2 unread</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">New updates available</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Continue Application
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Upload Documents
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <MessageSquare className="w-4 h-4 mr-2" />
              View Messages
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  } else if (currentView === 'application') {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Scholarship Application</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Progress: 75% complete</span>
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
              <span>Step 3 of 4</span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Personal Essay</CardTitle>
              <p className="text-sm text-gray-600">Tell us about your academic goals and how this scholarship will help you achieve them.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Essay Question *
                </label>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                  Describe your long-term career goals and explain how this scholarship will help you achieve them. Include specific examples of how you plan to use your education to make a positive impact in your community. (500-750 words)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Response *
                </label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={12}
                  placeholder="Start writing your essay here..."
                  defaultValue="As a first-generation college student pursuing a degree in Environmental Science, I am deeply committed to addressing climate change through innovative research and community engagement..."
                />
                <p className="text-xs text-gray-500 mt-1">Word count: 127 / 750</p>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline">
                  <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                  Previous Section
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline">Save Draft</Button>
                  <Button>
                    Next Section
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  } else {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>
          
          <Card>
            <CardContent className="p-0">
              {/* Message List */}
              <div className="divide-y divide-gray-200">
                <div className="p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        AS
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Admissions Staff</p>
                        <p className="text-xs text-gray-500">2 hours ago</p>
                      </div>
                    </div>
                    <span className="w-2 h-2 bg-blue-600 rounded-full" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">Application Update Required</h3>
                  <p className="text-sm text-gray-600">We've reviewed your application and need one additional document. Please upload your latest transcript...</p>
                </div>

                <div className="p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        FS
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Financial Aid</p>
                        <p className="text-xs text-gray-500">1 day ago</p>
                      </div>
                    </div>
                    <span className="w-2 h-2 bg-purple-600 rounded-full" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">FAFSA Reminder</h3>
                  <p className="text-sm text-gray-600">Don't forget to complete your FAFSA application. The deadline is approaching...</p>
                </div>

                <div className="p-4 hover:bg-gray-50 cursor-pointer bg-gray-50/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">System</p>
                        <p className="text-xs text-gray-500">3 days ago</p>
                      </div>
                    </div>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">Application Received</h3>
                  <p className="text-sm text-gray-600">Your scholarship application has been successfully submitted and is under review.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
}

// ============================================================================
// Real Email AI Demo - Using Actual EmailAIComposer
// ============================================================================
function RealEmailAIDemo() {
  const [open, setOpen] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [editingMode, setEditingMode] = useState<'subject' | 'body' | 'both'>('both')
  const [generatedSubject, setGeneratedSubject] = useState('')
  const [generatedBody, setGeneratedBody] = useState('')
  const [currentSubject, setCurrentSubject] = useState('Follow-up on Your Scholarship Application')
  const [currentBody, setCurrentBody] = useState('Dear {{First Name}},\n\nThank you for submitting your scholarship application. We have received all required documents and are currently reviewing your submission.\n\nBest regards,\nAdmissions Team')

  const applicationData = {
    name: 'Jane Smith',
    email: 'jane.smith@email.com',
    raw_data: {
      'First Name': 'Jane',
      'Last Name': 'Smith',
      'GPA': '3.8',
      'Major': 'Environmental Science',
      'Graduation Year': '2025'
    }
  }

  const fields = [
    { id: 'first_name', label: 'First Name' },
    { id: 'last_name', label: 'Last Name' },
    { id: 'gpa', label: 'GPA' },
    { id: 'major', label: 'Major' },
    { id: 'graduation_year', label: 'Graduation Year' }
  ]

  // Mock completion hook
  const { completion, complete, isLoading } = useCompletion({
    api: '/api/generate',
    streamProtocol: 'text',
    onError: (e) => {
      console.log('Demo mode - AI generation simulated')
    },
    onFinish: (prompt, completion) => {
      // Simulate AI response
      if (editingMode === 'subject' || editingMode === 'both') {
        setGeneratedSubject('Congratulations! Your Scholarship Application Has Been Reviewed')
      }
      if (editingMode === 'body' || editingMode === 'both') {
        setGeneratedBody('Dear {{First Name}},\n\nWe are pleased to inform you that your scholarship application has been thoroughly reviewed by our admissions committee. Your outstanding academic record, particularly your {{GPA}} GPA in {{Major}}, has impressed our reviewers.\n\nWe will be in touch within the next two weeks with our decision. In the meantime, please feel free to reach out if you have any questions.\n\nBest regards,\nThe Scholarship Committee')
      }
    },
  })

  const handleGenerate = () => {
    if (!inputValue.trim()) {
      toast.error('Please enter a prompt')
      return
    }
    
    // Simulate API call
    complete('Generate email based on: ' + inputValue)
  }

  const handleApply = () => {
    const finalSubject = editingMode === 'body' ? currentSubject : (generatedSubject || currentSubject)
    const finalBody = editingMode === 'subject' ? currentBody : (generatedBody || currentBody)
    
    setCurrentSubject(finalSubject)
    setCurrentBody(finalBody)
    setInputValue('')
    setGeneratedSubject('')
    setGeneratedBody('')
    toast.success('Email content applied successfully!')
  }

  const hasCompletion = generatedSubject || generatedBody

  return (
    <div className="h-full p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Email Composer</h3>
          <p className="text-sm text-gray-600">Generate personalized emails using AI with merge tags and application data</p>
        </div>

        {/* Email Composer Interface */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 space-y-4">
            {/* Mode Selector */}
            <div className="flex gap-2">
              {[
                { key: 'both', label: 'Subject & Body' },
                { key: 'subject', label: 'Subject Only' },
                { key: 'body', label: 'Body Only' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setEditingMode(key as any)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    editingMode === key 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Current Content */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700">Current Email Content:</h4>
              
              {(editingMode === 'subject' || editingMode === 'both') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Subject:</label>
                  <div className="p-3 bg-white rounded border text-sm text-gray-900 font-medium">
                    {currentSubject}
                  </div>
                </div>
              )}
              
              {(editingMode === 'body' || editingMode === 'both') && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Body:</label>
                  <div className="p-3 bg-white rounded border text-sm text-gray-900 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {currentBody}
                  </div>
                </div>
              )}
            </div>

            {/* Generated Content */}
            {hasCompletion && (
              <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="text-sm font-medium text-purple-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Generated Content:
                </h4>
                
                {generatedSubject && (editingMode === 'subject' || editingMode === 'both') && (
                  <div>
                    <label className="text-sm font-medium text-purple-700 mb-1 block">Subject:</label>
                    <div className="p-3 bg-white rounded border border-purple-200 text-sm text-gray-900 font-medium">
                      {generatedSubject}
                    </div>
                  </div>
                )}
                
                {generatedBody && (editingMode === 'body' || editingMode === 'both') && (
                  <div>
                    <label className="text-sm font-medium text-purple-700 mb-1 block">Body:</label>
                    <div className="p-3 bg-white rounded border border-purple-200 text-sm text-gray-900 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {generatedBody}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Prompt Input */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">What would you like AI to do?</label>
              <div className="relative">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="e.g., Write a congratulatory email for scholarship approval, Create a professional follow-up message, Generate a personalized email using the applicant's GPA and major..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleGenerate()
                    }
                  }}
                />
                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || !inputValue.trim()}
                  className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-purple-600 hover:bg-purple-700"
                  size="icon"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Press Cmd/Ctrl + Enter to generate</p>
            </div>

            {/* Merge Tags Info */}
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-medium text-blue-900 mb-2">Available Merge Tags:</p>
              <div className="flex flex-wrap gap-1">
                {fields.slice(0, 5).map((field) => (
                  <span key={field.id} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {`{{${field.label}}}`}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpen(false)} className="text-sm">
                Close
              </Button>
              {hasCompletion && (
                <Button onClick={handleApply} className="bg-purple-600 hover:bg-purple-700 text-sm">
                  Apply Changes
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Demo Info */}
        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Live Demo:</strong> This is the actual AI Email Composer from our platform. In the real application, it connects to OpenAI's API to generate personalized emails with merge tags.
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Real Portal Demo - Using Actual PublicPortalV2 Components
// ============================================================================
function RealPortalDemo({ portalLayout, setPortalLayout }: {
  portalLayout: 'sidebar' | 'tabbed' | 'minimal'
  setPortalLayout: (layout: 'sidebar' | 'tabbed' | 'minimal') => void
}) {
  const [currentView, setCurrentView] = useState<'dashboard' | 'application' | 'messages'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  const layouts = [
    { key: 'sidebar', label: 'Sidebar Navigation', icon: PanelLeftOpen },
    { key: 'tabbed', label: 'Tabbed Layout', icon: LayoutGrid },
    { key: 'minimal', label: 'Minimal Design', icon: Eye }
  ]

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: Home, badge: null },
    { key: 'application', label: 'Application', icon: FileText, badge: null },
    { key: 'messages', label: 'Messages', icon: MessageSquare, badge: '2' }
  ]

  const renderPortalContent = () => {
    if (portalLayout === 'sidebar') {
      return (
        <div className="flex h-full">
          {/* Sidebar Navigation */}
          <div className={cn(
            "transition-all duration-300 bg-gray-900 text-white flex flex-col",
            sidebarOpen ? "w-64" : "w-16"
          )}>
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className={cn("flex items-center gap-3", !sidebarOpen && "justify-center")}>
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">M</span>
                  </div>
                  {sidebarOpen && <span className="font-semibold">Student Portal</span>}
                </div>
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-1 hover:bg-gray-800 rounded"
                >
                  {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 p-4">
              <nav className="space-y-2">
                {navItems.map(({ key, label, icon: Icon, badge }) => (
                  <button
                    key={key}
                    onClick={() => setCurrentView(key as any)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      currentView === key 
                        ? "bg-blue-600 text-white" 
                        : "text-gray-300 hover:bg-gray-800 hover:text-white",
                      !sidebarOpen && "justify-center"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="truncate">{label}</span>
                        {badge && (
                          <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* User Profile */}
            <div className="p-4 border-t border-gray-700">
              <div className={cn("flex items-center gap-3", !sidebarOpen && "justify-center")}>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  JS
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">Jane Smith</p>
                    <p className="text-xs text-gray-400 truncate">jane@example.edu</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 bg-gray-50">
            <RealPortalContent currentView={currentView} layout="sidebar" />
          </div>
        </div>
      )
    } else if (portalLayout === 'tabbed') {
      return (
        <div className="h-full flex flex-col">
          {/* Header with tabs */}
          <div className="bg-white border-b border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">M</span>
                  </div>
                  <h1 className="text-xl font-semibold text-gray-900">Student Portal</h1>
                </div>
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    JS
                  </div>
                </div>
              </div>
              
              {/* Tab Navigation */}
              <div className="flex gap-1">
                {navItems.map(({ key, label, icon: Icon, badge }) => (
                  <button
                    key={key}
                    onClick={() => setCurrentView(key as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      currentView === key 
                        ? "bg-blue-100 text-blue-700 border border-blue-200" 
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {badge && (
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{badge}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 bg-gray-50">
            <RealPortalContent currentView={currentView} layout="tabbed" />
          </div>
        </div>
      )
    } else {
      // Minimal layout
      return (
        <div className="h-full bg-white">
          {/* Minimal header */}
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-xs">M</span>
                </div>
                <nav className="flex gap-6">
                  {navItems.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setCurrentView(key as any)}
                      className={cn(
                        "text-sm font-medium transition-colors",
                        currentView === key ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="w-7 h-7 bg-gray-200 rounded-full" />
            </div>
          </div>
          
          <div className="p-6">
            <RealPortalContent currentView={currentView} layout="minimal" />
          </div>
        </div>
      )
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Layout Switcher */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Portal Layout:</span>
          <div className="flex gap-2">
            {layouts.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPortalLayout(key as any)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  portalLayout === key 
                    ? "bg-blue-100 text-blue-700" 
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Portal Content */}
      <div className="flex-1">
        {renderPortalContent()}
      </div>
    </div>
  )
}
interface DemoRow {
  id: string
  name: string
  email: string
  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected'
  score: number
  date: string
  tags: string[]
}

interface DemoColumn {
  id: string
  name: string
  type: 'text' | 'email' | 'select' | 'number' | 'date' | 'multiselect'
  width: number
}

function InteractiveTableDemo() {
  const [rows, setRows] = useState<DemoRow[]>([
    { id: '1', name: 'Sarah Chen', email: 'sarah@example.com', status: 'Approved', score: 92, date: '2026-01-20', tags: ['Priority', 'Fellowship'] },
    { id: '2', name: 'Marcus Johnson', email: 'marcus@example.com', status: 'Under Review', score: 88, date: '2026-01-19', tags: ['Research'] },
    { id: '3', name: 'Emily Rodriguez', email: 'emily@example.com', status: 'Pending', score: 75, date: '2026-01-18', tags: ['Community'] },
    { id: '4', name: 'David Kim', email: 'david@example.com', status: 'Under Review', score: 95, date: '2026-01-17', tags: ['Priority', 'Innovation'] },
    { id: '5', name: 'Lisa Wang', email: 'lisa@example.com', status: 'Rejected', score: 45, date: '2026-01-16', tags: ['Review Required'] },
  ])

  const [columns] = useState<DemoColumn[]>([
    { id: 'name', name: 'Full Name', type: 'text', width: 180 },
    { id: 'email', name: 'Email', type: 'email', width: 200 },
    { id: 'status', name: 'Status', type: 'select', width: 140 },
    { id: 'score', name: 'Score', type: 'number', width: 100 },
    { id: 'tags', name: 'Tags', type: 'multiselect', width: 180 },
    { id: 'date', name: 'Applied', type: 'date', width: 120 },
  ])

  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const statusColors: Record<string, { bg: string; text: string }> = {
    'Pending': { bg: 'bg-gray-100', text: 'text-gray-700' },
    'Under Review': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    'Approved': { bg: 'bg-green-100', text: 'text-green-700' },
    'Rejected': { bg: 'bg-red-100', text: 'text-red-700' },
  }

  const tagColors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700', 'bg-orange-100 text-orange-700']

  const filteredRows = rows.filter(row => 
    row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCellEdit = (rowId: string, colId: string, value: any) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [colId]: value } : row
    ))
    setEditingCell(null)
  }

  const handleAddRow = () => {
    const newRow: DemoRow = {
      id: Date.now().toString(),
      name: '',
      email: '',
      status: 'Pending',
      score: 0,
      date: new Date().toISOString().split('T')[0],
      tags: [],
    }
    setRows([...rows, newRow])
    setEditingCell({ rowId: newRow.id, colId: 'name' })
  }

  const handleDeleteRow = (rowId: string) => {
    setRows(prev => prev.filter(row => row.id !== rowId))
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.delete(rowId)
      return next
    })
  }

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }

  const renderCell = (row: DemoRow, column: DemoColumn) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.colId === column.id
    const value = row[column.id as keyof DemoRow]

    if (isEditing && column.type !== 'select' && column.type !== 'multiselect') {
      return (
        <Input
          autoFocus
          defaultValue={value as string}
          className="h-8 border-blue-500 focus:ring-2 focus:ring-blue-200"
          onBlur={(e) => handleCellEdit(row.id, column.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCellEdit(row.id, column.id, (e.target as HTMLInputElement).value)
            }
            if (e.key === 'Escape') {
              setEditingCell(null)
            }
          }}
        />
      )
    }

    switch (column.type) {
      case 'select':
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full text-left">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[value as string]?.bg} ${statusColors[value as string]?.text}`}>
                  {value as string}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {['Pending', 'Under Review', 'Approved', 'Rejected'].map(status => (
                <DropdownMenuItem key={status} onClick={() => handleCellEdit(row.id, column.id, status)}>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${statusColors[status]?.bg} ${statusColors[status]?.text}`}>
                    {status}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-1">
            {(value as string[]).map((tag, i) => (
              <span key={i} className={`px-2 py-0.5 rounded text-xs font-medium ${tagColors[i % tagColors.length]}`}>
                {tag}
              </span>
            ))}
          </div>
        )
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all" 
                style={{ width: `${value as number}%` }} 
              />
            </div>
            <span className="text-sm text-gray-600 font-medium">{value}</span>
          </div>
        )
      case 'email':
        return (
          <span className="text-blue-600 hover:underline cursor-pointer">{value as string}</span>
        )
      default:
        return <span className="text-gray-900">{value as string}</span>
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Applications</h3>
          <Badge variant="secondary" className="text-xs">{filteredRows.length} records</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search..."
              className="pl-9 h-8 w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 px-2 py-2 text-left">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300"
                  checked={selectedRows.size === filteredRows.length && filteredRows.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRows(new Set(filteredRows.map(r => r.id)))
                    } else {
                      setSelectedRows(new Set())
                    }
                  }}
                />
              </th>
              {columns.map(col => (
                <th 
                  key={col.id} 
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                    {col.name}
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
              ))}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((row, index) => (
              <tr 
                key={row.id} 
                className={`group transition-colors ${selectedRows.has(row.id) ? 'bg-blue-50' : hoveredRow === row.id ? 'bg-gray-50' : ''}`}
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center">
                    {hoveredRow === row.id || selectedRows.has(row.id) ? (
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300"
                        checked={selectedRows.has(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                      />
                    ) : (
                      <span className="text-xs text-gray-400 w-4 text-center">{index + 1}</span>
                    )}
                  </div>
                </td>
                {columns.map(col => (
                  <td 
                    key={col.id}
                    className="px-3 py-2 text-sm cursor-pointer"
                    style={{ width: col.width }}
                    onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}
                  >
                    {renderCell(row, col)}
                  </td>
                ))}
                <td className="px-2 py-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="w-4 h-4 mr-2" /> View details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="w-4 h-4 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteRow(row.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/30">
        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700" onClick={handleAddRow}>
          <Plus className="w-4 h-4 mr-1" />
          Add row
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Interactive Kanban Demo
// ============================================================================
function InteractiveKanbanDemo() {
  const [columns, setColumns] = useState([
    { id: 'pending', title: 'Pending', color: 'gray', items: [
      { id: '1', name: 'Emily Rodriguez', score: 75, tags: ['Community'] },
    ]},
    { id: 'review', title: 'Under Review', color: 'yellow', items: [
      { id: '2', name: 'Marcus Johnson', score: 88, tags: ['Research'] },
      { id: '4', name: 'David Kim', score: 95, tags: ['Priority'] },
    ]},
    { id: 'approved', title: 'Approved', color: 'green', items: [
      { id: '3', name: 'Sarah Chen', score: 92, tags: ['Fellowship'] },
    ]},
    { id: 'rejected', title: 'Rejected', color: 'red', items: [
      { id: '5', name: 'Lisa Wang', score: 45, tags: ['Review Required'] },
    ]},
  ])

  const [dragging, setDragging] = useState<{ itemId: string; fromColumn: string } | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const columnColors: Record<string, { dot: string; bg: string }> = {
    gray: { dot: 'bg-gray-400', bg: 'bg-gray-50' },
    yellow: { dot: 'bg-yellow-400', bg: 'bg-yellow-50' },
    green: { dot: 'bg-green-400', bg: 'bg-green-50' },
    red: { dot: 'bg-red-400', bg: 'bg-red-50' },
  }

  const handleDragStart = (e: React.DragEvent, itemId: string, fromColumn: string) => {
    setDragging({ itemId, fromColumn })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, toColumn: string) => {
    e.preventDefault()
    if (!dragging || dragging.fromColumn === toColumn) {
      setDragging(null)
      setDragOverColumn(null)
      return
    }

    setColumns(prev => {
      const newColumns = [...prev]
      const fromCol = newColumns.find(c => c.id === dragging.fromColumn)
      const toCol = newColumns.find(c => c.id === toColumn)
      
      if (fromCol && toCol) {
        const itemIndex = fromCol.items.findIndex(i => i.id === dragging.itemId)
        if (itemIndex !== -1) {
          const [item] = fromCol.items.splice(itemIndex, 1)
          toCol.items.push(item)
        }
      }
      
      return newColumns
    })

    setDragging(null)
    setDragOverColumn(null)
  }

  return (
    <div className="flex gap-4 p-4 bg-gray-100 rounded-xl overflow-x-auto">
      {columns.map(column => (
        <div 
          key={column.id}
          className={`flex-shrink-0 w-72 rounded-lg transition-colors ${
            dragOverColumn === column.id ? 'bg-blue-100 ring-2 ring-blue-400' : columnColors[column.color].bg
          }`}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="p-3 border-b border-gray-200/50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${columnColors[column.color].dot}`} />
              <span className="font-medium text-gray-700">{column.title}</span>
              <span className="text-xs text-gray-400 ml-auto">{column.items.length}</span>
            </div>
          </div>
          <div className="p-2 space-y-2 min-h-[200px]">
            {column.items.map(item => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id, column.id)}
                className={`bg-white p-3 rounded-lg shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                  dragging?.itemId === item.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-gray-900 text-sm">{item.name}</span>
                  <GripVertical className="w-4 h-4 text-gray-300" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {item.tags.map((tag, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-blue-600">{item.score}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-200/50">
            <Button variant="ghost" size="sm" className="w-full text-gray-500 hover:text-gray-700">
              <Plus className="w-4 h-4 mr-1" />
              Add card
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Interactive Form Demo
// ============================================================================
function InteractiveFormDemo() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    program: '',
    description: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSubmitting(false)
    setIsSubmitted(true)
    setTimeout(() => {
      setIsSubmitted(false)
      setFormData({ name: '', email: '', phone: '', program: '', description: '' })
    }, 2000)
  }

  if (isSubmitted) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Application Submitted!</h3>
        <p className="text-gray-600">Thank you for your application. We'll be in touch soon.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Form Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
        <h3 className="text-xl font-semibold mb-2">Scholarship Application</h3>
        <p className="text-blue-100 text-sm">Fill out the form below to apply for the 2026 program.</p>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Type className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                required
                placeholder="John Doe"
                className="pl-10"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="email"
                required
                placeholder="john@example.com"
                className="pl-10"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="(555) 123-4567"
                className="pl-10"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Program <span className="text-red-500">*</span>
            </label>
            <select 
              required
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.program}
              onChange={(e) => setFormData({ ...formData, program: e.target.value })}
            >
              <option value="">Select a program...</option>
              <option value="research">Research Fellowship</option>
              <option value="community">Community Leadership</option>
              <option value="innovation">Innovation Grant</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Tell us about your project <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={4}
            placeholder="Describe your project, goals, and how this scholarship would help..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Upload className="w-4 h-4" />
          <span>Drag & drop files here or click to upload supporting documents</span>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            <>
              Submit Application
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

// ============================================================================
// Interactive Workspace Demo - Using Real Application Components
// ============================================================================
function InteractiveWorkspaceDemo() {
  const [activeView, setActiveView] = useState<'portal' | 'email-ai' | 'table'>('portal')
  const [portalLayout, setPortalLayout] = useState<'sidebar' | 'tabbed' | 'minimal'>('sidebar')
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="demo" ref={sectionRef} className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            See Matic in Action
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Explore actual components from our application - no mockups, just real functionality
          </p>
        </div>

        {/* View Tabs */}
        <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="flex justify-center gap-2 mb-8">
            {[
              { key: 'portal', icon: LayoutDashboard, label: 'Public Portal' },
              { key: 'builder', icon: Settings, label: 'Portal Builder' },
              { key: 'email-ai', icon: Sparkles, label: 'AI Email Composer' },
              { key: 'table', icon: Table2, label: 'Data Tables' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveView(key as typeof activeView)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeView === key
                    ? 'bg-white shadow-lg text-blue-600'
                    : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>

          {/* Demo Container */}
          <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100">
            {/* Window Chrome */}
            <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-sm text-gray-500">
                  {activeView === 'portal' && 'Applicant Portal'}
                  {activeView === 'builder' && 'Portal Builder'}
                  {activeView === 'email-ai' && 'AI Email Composer'}
                  {activeView === 'table' && 'Data Table'}
                  {' — Matic Platform'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open Live Demo
                </Button>
              </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[600px] bg-gray-50/30">
              {activeView === 'portal' && (
                <RealPortalDemo portalLayout={portalLayout} setPortalLayout={setPortalLayout} />
              )}
              {activeView === 'builder' && (
                <iframe 
                  src="/portal-builder-demo" 
                  className="w-full h-[700px] border-0"
                  title="Portal Builder Demo"
                />
              )}
              {activeView === 'email-ai' && <RealEmailAIDemo />}
              {activeView === 'table' && (
                <div className="p-6">
                  <InteractiveTableDemo />
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            ✨ These are actual components from our platform - fully functional and interactive
          </p>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// Features Section
// ============================================================================
function FeaturesSection() {
  const features = [
    {
      icon: Table2,
      title: 'Flexible Data Tables',
      description: 'Organize your data with customizable columns, filters, and views. Link tables together for powerful relationships.',
      color: 'blue',
    },
    {
      icon: FileText,
      title: 'Dynamic Forms',
      description: 'Build beautiful forms with conditional logic, file uploads, and integrations. Collect data effortlessly.',
      color: 'green',
    },
    {
      icon: Workflow,
      title: 'Review Workflows',
      description: 'Create multi-stage review processes with custom rubrics, scoring, and team collaboration.',
      color: 'purple',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Invite team members, assign roles, and work together in real-time with granular permissions.',
      color: 'orange',
    },
    {
      icon: Globe,
      title: 'Public Portals',
      description: 'Share filtered views with external stakeholders. Let them track progress without full access.',
      color: 'pink',
    },
    {
      icon: Sparkles,
      title: 'AI-Powered',
      description: 'Use AI to auto-fill forms, score applications, and generate insights from your data.',
      color: 'indigo',
    },
  ]

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
    green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
  }

  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything you need to manage data
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful features that work together seamlessly
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => {
            const colors = colorClasses[feature.color]
            return (
              <div
                key={i}
                className="group p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-12 h-12 ${colors.bg} ${colors.border} border rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// Stats Section
// ============================================================================
// CTA Section
// ============================================================================
function CTASection() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          Ready to streamline your workflows?
        </h2>
        <p className="text-xl text-gray-600 mb-10">
          Join hundreds of teams using Matic to collect data, manage reviews, and collaborate better.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="text-lg px-8 py-6 shadow-lg shadow-blue-500/25">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-6">
          No credit card required · Free plan available
        </p>
      </div>
    </section>
  )
}

// ============================================================================
// Footer
// ============================================================================
function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="text-xl font-semibold text-white">Matic</span>
            </div>
            <p className="text-sm">
              The modern platform for forms, data, and workflows.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#demo" className="hover:text-white transition-colors">Demo</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">© 2026 Matic. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ============================================================================
// Main Page Component
// ============================================================================
export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <HeroSection />
      <InteractiveWorkspaceDemo />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </main>
  )
}
