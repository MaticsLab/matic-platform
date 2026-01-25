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
<Link href="/" className="flex items-center">
          <span className="text-2xl font-black text-gray-900 tracking-tight">MaticsApp</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/workspaces">
                <Button>Go to Workspace</Button>
              </Link>
            ) : (
              <>
                <Link href="/signup-v2?mode=login">
                  <Button variant="ghost">Log in</Button>
                </Link>
                <Link href="/signup-v2">
                  <Button>Get started</Button>
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
            <Link href="/pricing" className="block text-gray-600 hover:text-gray-900">
              Pricing
            </Link>
            <div className="pt-4 border-t space-y-2">
              {isAuthenticated ? (
                <Link href="/workspaces" className="block">
                  <Button className="w-full">Go to Workspace</Button>
                </Link>
              ) : (
                <>
                  <Link href="/signup-v2?mode=login" className="block">
                    <Button variant="outline" className="w-full">Log in</Button>
                  </Link>
                  <Link href="/signup-v2" className="block">
                    <Button className="w-full">Get started</Button>
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
// ============================================================================
// Animated Icons Components
// ============================================================================
function AnimatedIcon({ icon: Icon, className, delay = 0 }: { 
  icon: any, 
  className?: string, 
  delay?: number 
}) {
  return (
    <div 
      className={`absolute animate-pulse opacity-20 ${className}`}
      style={{ animationDelay: `${delay}ms`, animationDuration: '3s' }}
    >
      <Icon className="w-8 h-8 text-gray-700" />
    </div>
  )
}

// ============================================================================
// Feature Tabs Data with Demo Content
// ============================================================================
const featureTabs = [
  {
    id: 'forms',
    label: 'Forms',
    title: 'Create any form you need',
    description: 'Build the exact form you need, in minutes.',
    features: [
      'Drag-and-drop form builder',
      'Over 25 field types',
      'Conditional logic & branching',
      'Custom styling & branding'
    ],
    color: 'blue',
    demoType: 'portal'
  },
  {
    id: 'tables', 
    label: 'Data Tables',
    title: 'Organize your data beautifully',
    description: 'Turn form responses into structured, searchable data.',
    features: [
      'Automatic data organization',
      'Advanced filtering & sorting',
      'Custom views & layouts',
      'Export to any format'
    ],
    color: 'purple',
    demoType: 'table'
  },
  {
    id: 'workflows',
    label: 'Workflows', 
    title: 'Automate your processes',
    description: 'Streamline reviews and approvals with smart workflows.',
    features: [
      'Multi-stage review processes',
      'Automatic notifications',
      'Custom approval rules',
      'Team collaboration tools'
    ],
    color: 'green',
    demoType: 'builder'
  },
  {
    id: 'signatures',
    label: 'Signatures',
    title: 'Collect digital signatures',
    description: 'Create, track, and e-sign documents seamlessly.',
    features: [
      'Electronic signature collection',
      'Secure document signing',
      'Automated agreement workflows',
      'Legal compliance & tracking'
    ],
    color: 'orange',
    demoType: 'signature'
  }
]

// ============================================================================
// Demo Content Components
// ============================================================================
function PortalDemo() {
  const [animatedFields, setAnimatedFields] = useState<Array<{id: number, type: string, label: string, selected?: boolean}>>([])
  
  const portalFields = [
    { type: 'auth', label: 'Sign Up / Login', selected: false },
    { type: 'form', label: 'Application Form', selected: false },
    { type: 'section', label: 'Personal Information', selected: false },
    { type: 'section', label: 'Educational Background', selected: false },
    { type: 'review', label: 'Review & Submit', selected: false },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedFields(prev => {
        if (prev.length >= portalFields.length) {
          return []
        }
        const nextField = portalFields[prev.length]
        return [...prev, { ...nextField, id: Date.now() + prev.length, selected: prev.length === 2 }]
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: '450px' }}>
      {/* Browser-like Header */}
      <div className="bg-gray-100 px-4 py-3 border-b flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 bg-red-400 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
        </div>
        <div className="flex-1 bg-white rounded px-3 py-1 text-xs text-gray-600 ml-4">
          maticsapp.com/forms/survey
        </div>
      </div>

      {/* Portal Builder Interface */}
      <div className="bg-white p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Portal Builder</h3>
              <p className="text-xs text-gray-500">Scholarship Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            </div>
            <button className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded">Preview</button>
            <button className="text-xs px-2 py-1 bg-green-500 text-white rounded">Saved</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-gray-50">
        <div className="flex">
          <button className="px-4 py-2 bg-blue-500 text-white text-sm font-medium">App</button>
          <button className="px-4 py-2 text-gray-600 text-sm">Forms</button>
          <button className="px-4 py-2 text-gray-600 text-sm">Database</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 h-full">
        {/* Left Sidebar - Portal Structure */}
        <div className="w-64 bg-gray-50 border-r p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900">Portal Structure</h4>
            <button className="w-6 h-6 bg-gray-800 text-white rounded flex items-center justify-center text-xs">+</button>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 p-2 text-xs text-teal-600 bg-teal-50 rounded">
              <span>🔐</span>
              <span>Sign Up / Login</span>
            </div>
            
            {animatedFields.map((field, index) => (
              <div 
                key={field.id}
                className={`flex items-center gap-2 p-2 text-xs rounded animate-fade-in-up ${
                  field.selected ? 'bg-yellow-100 text-gray-700' : 'text-gray-600'
                }`}
                style={{ 
                  animationDelay: `${index * 0.1}s`,
                  animationDuration: '0.4s',
                  animationFillMode: 'both'
                }}
              >
                {field.type === 'form' && <span>📝</span>}
                {field.type === 'section' && field.label.includes('Personal') && <span>👤</span>}
                {field.type === 'section' && field.label.includes('Educational') && <span>🎓</span>}
                {field.type === 'review' && <span>✅</span>}
                {field.type === 'auth' && <span>🔐</span>}
                <span>{field.label}</span>
                {index < 3 && (
                  <span className="ml-auto text-xs text-gray-400">{index + 2}</span>
                )}
              </div>
            ))}
            
            {/* After Submission - Static */}
            <div className="flex items-center gap-2 p-2 text-xs text-gray-600">
              <span>📊</span>
              <span>After Submission</span>
            </div>
            
            <div className="pl-6 space-y-1">
              <div className="flex items-center gap-2 p-1 text-xs text-gray-500">
                <span>📊</span>
                <span>Applicant Dashboard</span>
                <span className="ml-auto">▼</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Preview */}
        <div className="flex-1 p-6 bg-gray-50">
          <div className="bg-white rounded-lg border h-full p-6">
            {animatedFields.find(f => f.selected) ? (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Personal Information</h4>
                <p className="text-sm text-gray-500 mb-6">Add a description to help users</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="Enter your full name"
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="text-red-500 text-xs">*</span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input 
                      type="email" 
                      placeholder="Enter your email"
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="text-red-500 text-xs">*</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">+</span>
                </div>
                <p className="text-sm">Start building your form</p>
                <p className="text-xs text-gray-300 mt-1">Type <span className="bg-gray-100 px-1 rounded">/</span> for commands</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TableDemo() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Scholarship Applications</h3>
        <div className="flex items-center gap-2">
          <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
            45 New
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {[
          { name: 'Sarah Chen', status: 'Under Review', score: '94%', date: 'Jan 20' },
          { name: 'Marcus Johnson', status: 'Approved', score: '87%', date: 'Jan 19' },
          { name: 'Elena Rodriguez', status: 'Pending', score: '92%', date: 'Jan 18' },
          { name: 'David Kim', status: 'Under Review', score: '89%', date: 'Jan 17' }
        ].map((item, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-blue-600">
                  {item.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">{item.score}</span>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.status === 'Approved' ? 'bg-green-100 text-green-700' :
                item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {item.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BuilderDemo() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Workflow Builder</h3>
        <p className="text-sm text-gray-600">Design multi-stage review processes</p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Application Submitted</p>
            <p className="text-sm text-gray-500">Automatic trigger</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Initial Review</p>
            <p className="text-sm text-gray-500">Assigned to: Review Team</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Final Decision</p>
            <p className="text-sm text-gray-500">Send notification</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SignatureDemo() {
  return (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <span className="font-medium">BATES LAW FIRM</span>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mb-4">Request for Attorney Representation</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Full Name</label>
              <div className="mt-1 p-2 bg-gray-50 rounded border-2 border-dashed border-gray-300 text-sm text-gray-500">
                Enter your name
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Phone Number</label>
              <div className="mt-1 p-2 bg-gray-50 rounded border-2 border-dashed border-gray-300 text-sm text-gray-500">
                Enter phone
              </div>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <div className="mt-1 p-2 bg-gray-50 rounded border-2 border-dashed border-gray-300 text-sm text-gray-500">
              Enter email address
            </div>
          </div>
          
          <div className="border-2 border-dashed border-orange-300 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-2">Add signature</p>
            <div className="bg-white rounded p-4 border border-gray-200">
              <div className="text-2xl font-script text-gray-400 italic text-center">
                Samantha Jones
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <button className="bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-2 rounded-lg font-medium">
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
function HeroSection() {
  const { data } = useSession()
  const isAuthenticated = !!data?.user
  const [activeTab, setActiveTab] = useState('forms')
  
  return (
    <section className="relative pt-24 pb-16 overflow-hidden">
      {/* Background Gradient - Fillout Style */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-200 via-yellow-200 to-amber-300" />
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/50 via-amber-200/30 to-orange-300/40" />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-[10%] w-32 h-32 bg-white/20 rounded-full blur-xl animate-float" />
        <div className="absolute top-40 right-[15%] w-24 h-24 bg-orange-200/30 rounded-full blur-lg animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 left-[20%] w-20 h-20 bg-yellow-200/40 rounded-full blur-lg animate-float" style={{ animationDelay: '2s' }} />
      </div>
      
      {/* Floating Icons */}
      <AnimatedIcon icon={FileText} className="top-20 left-[15%]" delay={0} />
      <AnimatedIcon icon={Database} className="top-32 right-[20%]" delay={500} />
      <AnimatedIcon icon={Workflow} className="bottom-40 left-[25%]" delay={1000} />
      <AnimatedIcon icon={BarChart3} className="bottom-20 right-[15%]" delay={1500} />
      <AnimatedIcon icon={CheckCircle2} className="top-48 left-[8%]" delay={2000} />
      <AnimatedIcon icon={Users} className="top-60 right-[12%]" delay={2500} />
      
      <div className="relative w-full px-3">
        <div className="text-center max-w-5xl mx-auto">
          {/* Main Headline */}
          <h1 className="text-6xl md:text-8xl font-black text-gray-900 tracking-tight mb-8 leading-tight">
            Build, collect,
            <span className="block">review together</span>
          </h1>

          {/* CTA Button */}
          <div className="mb-20">
            {isAuthenticated ? (
              <Link href="/workspaces">
                <Button size="lg" className="bg-black hover:bg-gray-800 text-white text-lg px-10 py-6 rounded-lg font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
                  Go to Workspace
                  <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
              </Link>
            ) : (
              <Link href="/signup-v2">
                <Button size="lg" className="bg-black hover:bg-gray-800 text-white text-lg px-10 py-6 rounded-lg font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
                  Get started — it's free
                  <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
              </Link>
            )}
          </div>

          {/* Feature Tabs */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
            {/* Tab Navigation */}
            <div className="flex flex-wrap justify-center gap-8 mb-12">
              {featureTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-lg font-medium text-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-gray-900 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Tab Content */}
            {featureTabs.map((tab) => (
              activeTab === tab.id && (
                <div key={tab.id} className="text-left w-full px-4">
                  <div className="grid md:grid-cols-3 gap-12 items-center">
                    <div className="md:col-span-1">
                      <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium mb-4 ${
                        tab.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                        tab.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                        tab.color === 'green' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {tab.label.toUpperCase()}
                      </div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-4">
                        {tab.title}
                      </h3>
                      <p className="text-lg text-gray-600 mb-8">
                        {tab.description}
                      </p>
                      <ul className="space-y-4">
                        {tab.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-gray-900 rounded-full" />
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="md:col-span-2 rounded-2xl overflow-hidden">
                      {tab.demoType === 'portal' && <PortalDemo />}
                      {tab.demoType === 'table' && <TableDemo />}
                      {tab.demoType === 'builder' && <BuilderDemo />}
                      {tab.demoType === 'signature' && <SignatureDemo />}
                    </div>
                  </div>
                </div>
              )
            ))}
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
  const [activeView, setActiveView] = useState<'portal' | 'builder' | 'email-ai' | 'table'>('portal')
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
// "It All Starts" Section (Fillout Inspired)
// ============================================================================
function ItAllStartsSection() {
  const [animatedFields, setAnimatedFields] = useState<Array<{id: number, type: string, label: string, icon: any, color: string}>>([])
  
  const fieldTypes = [
    { type: 'text', label: 'Full Name', icon: Type, color: 'bg-blue-500' },
    { type: 'email', label: 'Email Address', icon: Mail, color: 'bg-green-500' },
    { type: 'phone', label: 'Phone Number', icon: Phone, color: 'bg-purple-500' },
    { type: 'dropdown', label: 'Department', icon: ChevronDown, color: 'bg-orange-500' },
    { type: 'textarea', label: 'Message', icon: MessageSquare, color: 'bg-pink-500' },
    { type: 'date', label: 'Preferred Date', icon: Calendar, color: 'bg-indigo-500' }
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedFields(prev => {
        if (prev.length >= 4) {
          return []
        }
        const nextField = fieldTypes[prev.length]
        return [...prev, { ...nextField, id: Date.now() + prev.length }]
      })
    }, 1500)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="pt-40 pb-24 bg-gray-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-full blur-2xl animate-float" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-2xl animate-float" style={{ animationDelay: '2s' }} />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          {/* Floating Icons */}
          <div className="relative inline-block">
            <div className="absolute -top-8 -left-8 w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center transform -rotate-12 animate-pulse">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white mb-6">
              It all starts with a form
            </h2>
            <div className="absolute -top-4 -right-12 w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center transform rotate-12 animate-pulse" style={{ animationDelay: '1s' }}>
              <ArrowRight className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Build the exact form you need, in minutes.
          </p>
        </div>

        {/* Animated Form Builder */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl p-8 relative overflow-hidden">
            {/* Builder Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Form Builder</h3>
                  <p className="text-gray-500 text-sm">maticsapp.com/forms/survey</p>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-2 border-b">
                <button className="px-4 py-2 bg-blue-500 text-white rounded-t-lg text-sm font-medium">App</button>
                <button className="px-4 py-2 text-gray-600 text-sm">Forms</button>
                <button className="px-4 py-2 text-gray-600 text-sm">Database</button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              {/* Left Side - Field Palette */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Field Types</h4>
                <div className="grid grid-cols-2 gap-3">
                  {fieldTypes.slice(0, 6).map((field, index) => (
                    <div 
                      key={field.type} 
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-500 ${
                        animatedFields.find(f => f.type === field.type) 
                          ? 'border-transparent bg-gray-100 opacity-50 scale-95' 
                          : 'border-gray-200 hover:border-blue-300 bg-white'
                      }`}
                      style={{ 
                        animationDelay: `${index * 0.2}s`,
                        transform: animatedFields.find(f => f.type === field.type) ? 'scale(0.95)' : 'scale(1)'
                      }}
                    >
                      <div className={`w-8 h-8 ${field.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <field.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{field.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side - Form Preview */}
              <div className="bg-gray-50 rounded-xl p-6 relative min-h-[400px]">
                <div className="text-center mb-6">
                  <h4 className="text-lg font-semibold text-gray-900">Live Preview</h4>
                  <p className="text-sm text-gray-500">Watch fields appear as you add them</p>
                </div>
                
                <div className="space-y-4">
                  {animatedFields.map((field, index) => (
                    <div 
                      key={field.id}
                      className="bg-white rounded-lg p-4 border-2 border-blue-200 animate-fade-in-up"
                      style={{ 
                        animationDelay: `${index * 0.1}s`,
                        animationDuration: '0.6s',
                        animationFillMode: 'both'
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-6 h-6 ${field.color} rounded flex items-center justify-center`}>
                          <field.icon className="w-3 h-3 text-white" />
                        </div>
                        <label className="text-sm font-medium text-gray-700">{field.label}</label>
                      </div>
                      <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-400">
                        {field.type === 'textarea' ? 'Enter your message here...' : 
                         field.type === 'dropdown' ? 'Select an option' :
                         field.type === 'date' ? 'Select a date' :
                         `Enter your ${field.label.toLowerCase()}`}
                      </div>
                    </div>
                  ))}
                  
                  {animatedFields.length > 0 && (
                    <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.8s' }}>
                      <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-colors">
                        Submit Form
                      </button>
                    </div>
                  )}
                  
                  {animatedFields.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Your form will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
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
          <Link href="/signup-v2">
            <Button size="lg" className="text-lg px-8 py-6 shadow-lg shadow-blue-500/25">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              View Pricing
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
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          {/* Logo and Description */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-6">
              <span className="text-3xl font-black text-amber-400 tracking-tight">MaticsApp</span>
            </Link>
            <p className="text-gray-400 mb-6 text-lg">
              The all-in-one form solution
            </p>
            <div className="flex gap-4">
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.627 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* General */}
          <div>
            <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">General</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/integrations" className="text-gray-400 hover:text-white transition-colors">Integrations</Link></li>
              <li><Link href="/careers" className="text-gray-400 hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="text-gray-400 hover:text-white transition-colors">Report abuse</Link></li>
              <li><Link href="/blog" className="text-gray-400 hover:text-white transition-colors">What's new</Link></li>
              <li><Link href="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/enterprise" className="text-gray-400 hover:text-white transition-colors">Enterprise</Link></li>
            </ul>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Product</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/forms" className="text-gray-400 hover:text-white transition-colors">Forms</Link></li>
              <li><Link href="/scheduling" className="text-gray-400 hover:text-white transition-colors">Scheduling</Link></li>
              <li><Link href="/pdf" className="text-gray-400 hover:text-white transition-colors">PDF generation</Link></li>
              <li><Link href="/payments" className="text-gray-400 hover:text-white transition-colors">Payments</Link></li>
              <li><Link href="/workflows" className="text-gray-400 hover:text-white transition-colors">Workflows</Link></li>
              <li><Link href="/conversion" className="text-gray-400 hover:text-white transition-colors">Conversion kit</Link></li>
              <li><Link href="/zite" className="text-gray-400 hover:text-white transition-colors">Zite</Link></li>
            </ul>
          </div>

          {/* AI Tools */}
          <div>
            <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">AI Tools</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/ai-quiz" className="text-gray-400 hover:text-white transition-colors">AI Quiz Maker</Link></li>
              <li><Link href="/ai-form" className="text-gray-400 hover:text-white transition-colors">AI Form Builder</Link></li>
              <li><Link href="/ai-survey" className="text-gray-400 hover:text-white transition-colors">AI Survey Maker</Link></li>
              <li><Link href="/google-import" className="text-gray-400 hover:text-white transition-colors">Import Google Form</Link></li>
              <li><Link href="/ai-signature" className="text-gray-400 hover:text-white transition-colors">AI Signature Maker</Link></li>
              <li><Link href="/survey-questions" className="text-gray-400 hover:text-white transition-colors">Survey questions</Link></li>
              <li><Link href="/pdf-to-form" className="text-gray-400 hover:text-white transition-colors">PDF to Form</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Resources</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/help" className="text-gray-400 hover:text-white transition-colors">Help Center</Link></li>
              <li><Link href="/about" className="text-gray-400 hover:text-white transition-colors">About MaticsApp</Link></li>
              <li><Link href="/status" className="text-gray-400 hover:text-white transition-colors">Status</Link></li>
              <li><Link href="/form-builder" className="text-gray-400 hover:text-white transition-colors">Form builder comparison</Link></li>
              <li><Link href="/vs-jotform" className="text-gray-400 hover:text-white transition-colors">MaticsApp vs Jotform</Link></li>
              <li><Link href="/vs-typeform" className="text-gray-400 hover:text-white transition-colors">vs Typeform</Link></li>
              <li><Link href="/vs-google-forms" className="text-gray-400 hover:text-white transition-colors">vs Google Forms</Link></li>
              <li><Link href="/vs-surveymonkey" className="text-gray-400 hover:text-white transition-colors">vs SurveyMonkey</Link></li>
              <li><Link href="/vs-formstack" className="text-gray-400 hover:text-white transition-colors">vs Formstack</Link></li>
              <li><Link href="/vs-formassembly" className="text-gray-400 hover:text-white transition-colors">vs FormAssembly</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex flex-wrap gap-6 mb-4 md:mb-0">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
              <span className="text-xs font-semibold">SOC II Type 2</span>
              <span className="text-xs">Compliant</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
              <span className="text-xs font-semibold">256-bit AES</span>
              <span className="text-xs">Data encryption</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
              <span className="text-xs font-semibold">24/5 Tech support</span>
              <span className="text-xs">Here if you need us</span>
            </div>
          </div>
          <div className="flex gap-6 text-xs text-gray-400">
            <Link href="/press" className="hover:text-white transition-colors">Press kit</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <span>© 2026 MaticsApp, Inc.</span>
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
      <ItAllStartsSection />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </main>
  )
}
