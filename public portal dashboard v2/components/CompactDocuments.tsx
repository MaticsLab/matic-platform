import { Card } from './ui/card';
import { Button } from './ui/button';
import { FileText, ChevronDown, ChevronUp, Download, Eye, Calendar, File } from 'lucide-react';
import { Badge } from './ui/badge';
import { useState } from 'react';

interface Document {
  id: string;
  name: string;
  status: 'submitted';
  uploadedDate: string;
  fileSize: string;
  fileType: string;
  reviewStatus: 'approved' | 'under-review' | 'pending';
}

const documents: Document[] = [
  {
    id: '1',
    name: 'Official Transcript',
    status: 'submitted',
    uploadedDate: 'Feb 10, 2025',
    fileSize: '2.3 MB',
    fileType: 'PDF',
    reviewStatus: 'approved',
  },
  {
    id: '2',
    name: 'Personal Statement',
    status: 'submitted',
    uploadedDate: 'Feb 8, 2025',
    fileSize: '1.8 MB',
    fileType: 'PDF',
    reviewStatus: 'under-review',
  },
  {
    id: '3',
    name: 'Budget Proposal',
    status: 'submitted',
    uploadedDate: 'Feb 5, 2025',
    fileSize: '856 KB',
    fileType: 'PDF',
    reviewStatus: 'approved',
  },
];

const getStatusBadge = (status: Document['reviewStatus']) => {
  switch (status) {
    case 'approved':
      return (
        <div className="flex items-center gap-1.5 text-green-600">
          <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div>
          <span className="text-xs">Approved</span>
        </div>
      );
    case 'under-review':
      return (
        <div className="flex items-center gap-1.5 text-blue-600">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
          <span className="text-xs">Under Review</span>
        </div>
      );
    case 'pending':
      return (
        <div className="flex items-center gap-1.5 text-gray-600">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
          <span className="text-xs">Pending</span>
        </div>
      );
  }
};

function DocumentItem({ doc }: { doc: Document }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 sm:p-4 text-left touch-manipulation active:bg-gray-50"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            <h3 className="text-sm text-gray-900">{doc.name}</h3>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs text-gray-500 mb-3 pt-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{doc.uploadedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <File className="w-3.5 h-3.5" />
              <span>{doc.fileSize} {doc.fileType}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors touch-manipulation min-h-[44px] sm:min-h-0 sm:py-1.5">
              <Eye className="w-3.5 h-3.5" />
              View
            </button>
            <button className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors touch-manipulation min-h-[44px] sm:min-h-0 sm:py-1.5">
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CompactDocuments() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="p-4 sm:p-6 border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-4 touch-manipulation"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg text-gray-900">Documents</h2>
          <Badge variant="outline" className="text-xs">
            {documents.length} submitted
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />
        )}
      </button>

      {/* Preview - show first 2 documents */}
      {!isExpanded && (
        <div className="space-y-2.5">
          {documents.slice(0, 2).map((doc) => (
            <DocumentItem key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      {/* Expanded - show all documents */}
      {isExpanded && (
        <div className="space-y-2.5">
          {documents.map((doc) => (
            <DocumentItem key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </Card>
  );
}