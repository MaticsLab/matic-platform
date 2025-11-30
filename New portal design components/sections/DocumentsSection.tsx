import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form@7.55.0';
import { ApplicationData } from '../ApplicationForm';
import { Button } from '../ui/button';
import { Upload, FileText, X, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { cn } from '../ui/utils';
import { toast } from 'sonner@2.0.3';

interface DocumentsSectionProps {
  form: UseFormReturn<ApplicationData>;
  formData: ApplicationData;
  errors: any;
}

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  uploadProgress: number;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function DocumentsSection({ form, formData, errors }: DocumentsSectionProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const validFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: File type not supported`);
        continue;
      }
      
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File size exceeds 5MB`);
        continue;
      }
      
      validFiles.push(file);
    }

    // Upload files with simulated progress
    for (const file of validFiles) {
      const fileId = Math.random().toString(36).substring(7);
      const uploadedFile: UploadedFile = {
        id: fileId,
        file,
        uploadProgress: 0
      };

      // Add file immediately
      setUploadedFiles(prev => [...prev, uploadedFile]);

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadedFiles(prev =>
          prev.map(f =>
            f.id === fileId ? { ...f, uploadProgress: progress } : f
          )
        );
      }

      // Generate preview for images and PDFs
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadedFiles(prev =>
            prev.map(f =>
              f.id === fileId ? { ...f, preview: e.target?.result as string } : f
            )
          );
        };
        reader.readAsDataURL(file);
      }

      toast.success(`${file.name} uploaded successfully`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success('File removed');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 mb-2">Required Documents</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Official or unofficial transcript</li>
          <li>Resume or CV</li>
          <li>Letter of recommendation (optional but encouraged)</li>
        </ul>
      </div>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        )}
      >
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-gray-900 mb-2">
          Drag and drop files here
        </h3>
        <p className="text-gray-600 mb-4">
          or click to browse
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          Choose Files
        </Button>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <p className="text-xs text-gray-500 mt-4">
          Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 5MB per file)
        </p>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-gray-900">Uploaded Files ({uploadedFiles.length})</h3>
          
          <div className="space-y-2">
            {uploadedFiles.map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className="border border-gray-200 rounded-lg p-4 bg-white"
              >
                <div className="flex items-start gap-3">
                  {/* Preview or Icon */}
                  <div className="flex-shrink-0">
                    {uploadedFile.preview ? (
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="h-12 w-12 object-cover rounded"
                      />
                    ) : (
                      <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center">
                        <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-gray-900">
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(uploadedFile.file.size)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {uploadedFile.preview && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewFile(uploadedFile)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadedFile.id)}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {uploadedFile.uploadProgress < 100 ? (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                          <span>Uploading...</span>
                          <span>{uploadedFile.uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${uploadedFile.uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Upload complete</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && previewFile.preview && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div className="max-w-4xl max-h-[90vh] relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 bg-white/90 hover:bg-white"
              onClick={() => setPreviewFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={previewFile.preview}
              alt={previewFile.file.name}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
