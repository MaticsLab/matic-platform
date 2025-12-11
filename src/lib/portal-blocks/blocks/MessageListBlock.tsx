'use client';

/**
 * Message List Block
 * 
 * Displays a thread of messages between the applicant and staff,
 * with optional reply functionality.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card';
import { Button } from '@/ui-components/button';
import { Textarea } from '@/ui-components/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/ui-components/avatar';
import { MessageSquare, Send, User } from 'lucide-react';
import type { BlockComponentProps } from '../BlockRenderer';

interface Message {
  id: string;
  content: string;
  sender: {
    name: string;
    avatar?: string;
    isStaff: boolean;
  };
  timestamp: string;
}

interface MessageConfig {
  title?: string;
  allowReply?: boolean;
  placeholder?: string;
  emptyMessage?: string;
}

interface MessageListBlockProps extends BlockComponentProps {
  block: BlockComponentProps['block'] & {
    type: 'message-list';
    category: 'display';
    config: MessageConfig;
  };
}

export default function MessageListBlock({ 
  block, 
  mode, 
  context,
  className 
}: MessageListBlockProps) {
  const { 
    title = 'Messages',
    allowReply = true,
    placeholder = 'Type your message...',
    emptyMessage = 'No messages yet',
  } = block.config;
  
  const [newMessage, setNewMessage] = React.useState('');
  
  // Get messages from context
  const messages: Message[] = context?.messages || [];
  
  const handleSend = () => {
    if (!newMessage.trim()) return;
    // In real usage, this would trigger an API call
    console.log('Sending message:', newMessage);
    setNewMessage('');
  };
  
  return (
    <Card className={cn(className)}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          {title}
          {messages.length > 0 && (
            <span className="text-sm font-normal text-gray-400">
              ({messages.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Messages */}
        <div className="max-h-80 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{emptyMessage}</p>
            </div>
          ) : (
            messages.map((message) => (
              <div 
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.sender.isStaff ? 'flex-row' : 'flex-row-reverse'
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={message.sender.avatar} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                
                <div className={cn(
                  'flex-1 max-w-[80%]',
                  message.sender.isStaff ? 'text-left' : 'text-right'
                )}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {message.sender.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(message.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={cn(
                    'inline-block px-3 py-2 rounded-lg text-sm',
                    message.sender.isStaff 
                      ? 'bg-gray-100 text-gray-800' 
                      : 'bg-blue-500 text-white'
                  )}>
                    {message.content}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Reply Input */}
        {allowReply && mode !== 'preview' && (
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={placeholder}
                className="min-h-[60px] resize-none"
              />
              <Button 
                onClick={handleSend}
                disabled={!newMessage.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Edit mode info */}
        {mode === 'edit' && (
          <p className="text-xs text-gray-400 text-center py-2 border-t italic">
            Messages will appear here when staff communicates with applicant
          </p>
        )}
      </CardContent>
    </Card>
  );
}
