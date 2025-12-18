'use client'

import { Card } from '@/ui-components/card'
import { Button } from '@/ui-components/button'
import { Textarea } from '@/ui-components/textarea'
import { MessageSquare, Send } from 'lucide-react'
import { useState } from 'react'

interface QuickContactProps {
  formId: string
  isPreview?: boolean
  themeColor?: string
}

export function QuickContact({
  formId,
  isPreview = false,
  themeColor = '#3B82F6'
}: QuickContactProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim() || isPreview) return
    
    setSending(true)
    // TODO: Implement message sending logic
    setTimeout(() => {
      setMessage('')
      setSending(false)
    }, 1000)
  }

  return (
    <Card className="p-4 sm:p-6 border border-gray-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg text-gray-900">Contact Support</h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs hover:text-blue-700 -ml-2 sm:ml-0"
          style={{ color: themeColor }}
        >
          View all messages
        </Button>
      </div>

      <div className="space-y-3">
        <Textarea
          placeholder="Have a question? Need help with your application?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[100px] resize-none border-gray-200"
          disabled={isPreview}
        />
        <div className="flex justify-end">
          <Button 
            className="gap-2 w-full sm:w-auto touch-manipulation min-h-[44px] sm:min-h-0"
            onClick={handleSend}
            disabled={!message.trim() || sending || isPreview}
            style={{ backgroundColor: themeColor }}
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
