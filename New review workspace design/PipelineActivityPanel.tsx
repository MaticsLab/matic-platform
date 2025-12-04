import { useState } from 'react';
import { Application } from '../App';
import { 
  X, Mail, ChevronDown, Send, Plus, Sparkles, Paperclip, 
  AtSign, ArrowRight, Star, MessageSquare, Users
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface PipelineActivityPanelProps {
  applications: Application[];
  onClose: () => void;
}

/**
 * Pipeline Activity Panel Component
 * 
 * Shows activity across the entire pipeline and allows mass email communication
 */
export function PipelineActivityPanel({ applications, onClose }: PipelineActivityPanelProps) {
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState<'comment' | 'email'>('email');
  const [comment, setComment] = useState('');

  // Mock pipeline-wide activity data
  const activities = [
    { id: 1, type: 'status', message: 'Jesus Sanchez moved to Initial Review', user: 'John Doe', time: '2 hours ago', applicationId: '1' },
    { id: 2, type: 'review', message: 'Review submitted for Maria Garcia (Score: 8.5)', user: 'Jane Smith', time: '4 hours ago', applicationId: '2' },
    { id: 3, type: 'email', message: 'Mass email sent to 15 applicants', user: 'John Doe', time: '1 day ago', applicationId: null },
    { id: 4, type: 'status', message: 'Sarah Williams approved', user: 'Jane Smith', time: '2 days ago', applicationId: '4' },
    { id: 5, type: 'comment', message: 'Added comment on Alex Johnson: "Excellent candidate"', user: 'John Doe', time: '2 days ago', applicationId: '3' },
    { id: 6, type: 'review', message: 'Review submitted for Emily Rodriguez (Score: 8.8)', user: 'Jane Smith', time: '3 days ago', applicationId: '6' },
    { id: 7, type: 'status', message: 'Michael Chen submitted application', user: 'System', time: '3 days ago', applicationId: '5' },
  ];

  const handleSendEmail = () => {
    toast.success('Email sent to all applicants');
    setEmailSubject('');
    setEmailBody('');
    setEmailTo('');
    setEmailCc('');
    setEmailBcc('');
  };

  const handleAddComment = () => {
    toast.success('Comment added to pipeline');
    setComment('');
  };

  return (
    <div className="bg-white flex flex-col h-full border-l border-gray-200">
      {/* Header */}
      <div className="px-6 py-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-gray-900">Pipeline Activity</h2>
              <p className="text-gray-500 text-xs mt-0.5">{applications.length} applications</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-2 text-sm">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                activity.type === 'status' ? 'bg-blue-100 text-blue-600' :
                activity.type === 'review' ? 'bg-green-100 text-green-600' :
                activity.type === 'email' ? 'bg-purple-100 text-purple-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                {activity.type === 'status' ? <ArrowRight className="w-3 h-3" /> :
                 activity.type === 'review' ? <Star className="w-3 h-3" /> :
                 activity.type === 'email' ? <Mail className="w-3 h-3" /> :
                 <MessageSquare className="w-3 h-3" />}
              </div>
              <div className="flex-1">
                <p className="text-gray-900">{activity.message}</p>
                <div className="flex items-center gap-1.5 text-gray-500 mt-0.5">
                  <span>{activity.user}</span>
                  <span>•</span>
                  <span>{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comment/Email Input */}
      <div className="border-t bg-white flex-shrink-0 p-4">
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
          {activeCommentTab === 'email' ? (
            <>
              {/* From field */}
              <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                <span className="text-gray-600 w-16">From</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-gray-900">Jesus</span>
                  <span className="text-gray-400">{"<jsanchez@bpnchicago.org>"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                </div>
              </div>
              
              {/* To field with recipient suggestion */}
              <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                <span className="text-gray-600 w-16">To</span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder={`All applicants (${applications.length})`}
                    className="flex-1 px-0 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  />
                  <button
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cc Bcc
                  </button>
                </div>
              </div>
              
              {/* Cc/Bcc fields - conditionally shown */}
              {showCcBcc && (
                <>
                  <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                    <span className="text-gray-600 w-16">Cc</span>
                    <input
                      type="text"
                      value={emailCc}
                      onChange={(e) => setEmailCc(e.target.value)}
                      placeholder=""
                      className="flex-1 px-0 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                    <span className="text-gray-600 w-16">Bcc</span>
                    <input
                      type="text"
                      value={emailBcc}
                      onChange={(e) => setEmailBcc(e.target.value)}
                      placeholder=""
                      className="flex-1 px-0 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                    />
                  </div>
                </>
              )}
              
              {/* Subject field */}
              <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                <span className="text-gray-600 w-16">Subject</span>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder=""
                  className="flex-1 px-0 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                />
              </div>
              
              {/* Email body */}
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Say something, press 'space' for AI, '/' for commands"
                rows={3}
                className="w-full px-0 py-3 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 resize-none"
              />
            </>
          ) : (
            /* Comment input */
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a pipeline note..."
              rows={2}
              className="w-full px-0 py-2 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 resize-none"
            />
          )}
          
          {/* Action bar */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-1">
              {/* Plus button */}
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                <Plus className="w-4 h-4" />
              </button>
              
              {/* Comment/Email Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-200 rounded transition-colors text-gray-700"
                >
                  <span className="capitalize">{activeCommentTab}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                
                {/* Dropdown menu */}
                {showTypeDropdown && (
                  <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                    <button
                      onClick={() => {
                        setActiveCommentTab('comment');
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                        activeCommentTab === 'comment' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      Comment
                    </button>
                    <button
                      onClick={() => {
                        setActiveCommentTab('email');
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                        activeCommentTab === 'email' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      Email
                    </button>
                  </div>
                )}
              </div>
              
              {/* AI icon */}
              <button 
                onClick={() => toast.info('AI assistant coming soon')}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              
              {/* Attachment icon */}
              <button 
                onClick={() => toast.info('Attachment feature coming soon')}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              
              {/* Mention icon */}
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                <AtSign className="w-4 h-4" />
              </button>
            </div>
            
            {/* Send button */}
            <button
              onClick={() => {
                if (activeCommentTab === 'comment') {
                  handleAddComment();
                } else {
                  handleSendEmail();
                }
              }}
              className="p-1.5 hover:bg-blue-100 rounded transition-colors text-blue-600"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}