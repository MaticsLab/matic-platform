import { Card } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';

export function QuickContact() {
  const [message, setMessage] = useState('');

  return (
    <Card className="p-4 sm:p-6 border border-gray-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg text-gray-900">Contact Support</h2>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 -ml-2 sm:ml-0">
          View all messages
        </Button>
      </div>

      <div className="space-y-3">
        <Textarea
          placeholder="Have a question? Need help with your application?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[100px] resize-none border-gray-200"
        />
        <div className="flex justify-end">
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto touch-manipulation min-h-[44px] sm:min-h-0">
            <Send className="w-4 h-4" />
            Send Message
          </Button>
        </div>
      </div>
    </Card>
  );
}