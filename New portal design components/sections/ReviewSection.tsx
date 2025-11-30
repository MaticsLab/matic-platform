import { useState } from 'react';
import { ApplicationData } from '../ApplicationForm';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Send, Printer, CheckCircle, AlertTriangle, Edit } from 'lucide-react';
import { cn } from '../ui/utils';

interface ReviewSectionProps {
  formData: ApplicationData;
  onSubmit?: () => void;
}

export function ReviewSection({ formData, onSubmit }: ReviewSectionProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToAccuracy, setAgreedToAccuracy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async () => {
    if (!agreedToTerms || !agreedToAccuracy) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    onSubmit?.();
    setIsSubmitting(false);
  };

  const getCompletionStatus = () => {
    const requiredFields = [
      formData.firstName,
      formData.lastName,
      formData.email,
      formData.phone,
      formData.dateOfBirth,
      formData.studentId,
      formData.institution,
      formData.major,
      formData.gpa,
      formData.expectedGraduation,
      formData.academicLevel,
      formData.essay1,
      formData.essay2,
      formData.reference1Name,
      formData.reference1Email,
      formData.reference2Name,
      formData.reference2Email
    ];

    const filledCount = requiredFields.filter(field => field && field !== '').length;
    const isComplete = filledCount === requiredFields.length;

    return { filledCount, total: requiredFields.length, isComplete };
  };

  const status = getCompletionStatus();

  return (
    <div className="space-y-6">
      {/* Completion Status */}
      <div
        className={cn(
          "border rounded-lg p-4",
          status.isComplete
            ? "bg-green-50 border-green-200"
            : "bg-orange-50 border-orange-200"
        )}
      >
        <div className="flex items-start gap-3">
          {status.isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
          )}
          <div className="flex-1">
            <h3
              className={cn(
                status.isComplete ? "text-green-900" : "text-orange-900"
              )}
            >
              {status.isComplete
                ? "Application Complete!"
                : "Application Incomplete"}
            </h3>
            <p
              className={cn(
                "text-sm mt-1",
                status.isComplete ? "text-green-700" : "text-orange-700"
              )}
            >
              {status.isComplete
                ? "All required fields have been completed. Review your information below and submit when ready."
                : `${status.filledCount} of ${status.total} required fields completed. Please complete all sections before submitting.`}
            </p>
          </div>
        </div>
      </div>

      {/* Application Summary */}
      <div className="space-y-6 print:space-y-4">
        {/* Personal Information */}
        <Section title="Personal Information">
          <InfoRow label="Name" value={`${formData.firstName || ''} ${formData.lastName || ''}`} />
          <InfoRow label="Email" value={formData.email} />
          <InfoRow label="Phone" value={formData.phone} />
          <InfoRow label="Date of Birth" value={formData.dateOfBirth} />
          <InfoRow label="Student ID" value={formData.studentId} />
          {formData.address && (
            <InfoRow
              label="Address"
              value={`${formData.address}, ${formData.city || ''}, ${formData.state || ''} ${formData.zipCode || ''}`}
            />
          )}
        </Section>

        {/* Academic Information */}
        <Section title="Academic Information">
          <InfoRow label="Institution" value={formData.institution} />
          <InfoRow label="Major" value={formData.major} />
          <InfoRow label="GPA" value={formData.gpa} />
          <InfoRow label="Academic Level" value={formData.academicLevel} />
          <InfoRow label="Expected Graduation" value={formData.expectedGraduation} />
        </Section>

        {/* Essays */}
        <Section title="Essays">
          <EssayPreview
            title="Essay 1: Why do you deserve this scholarship?"
            content={formData.essay1}
          />
          <EssayPreview
            title="Essay 2: What are your career goals?"
            content={formData.essay2}
          />
          {formData.essay3 && (
            <EssayPreview
              title="Essay 3: Additional Information"
              content={formData.essay3}
            />
          )}
        </Section>

        {/* References */}
        <Section title="References">
          <div className="space-y-4">
            <div>
              <h4 className="text-gray-900 mb-2">Reference 1</h4>
              <InfoRow label="Name" value={formData.reference1Name} />
              <InfoRow label="Email" value={formData.reference1Email} />
              <InfoRow label="Title" value={formData.reference1Title} />
            </div>
            <div>
              <h4 className="text-gray-900 mb-2">Reference 2</h4>
              <InfoRow label="Name" value={formData.reference2Name} />
              <InfoRow label="Email" value={formData.reference2Email} />
              <InfoRow label="Title" value={formData.reference2Title} />
            </div>
          </div>
        </Section>
      </div>

      {/* Certifications */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4 print:hidden">
        <h3 className="text-gray-900">Certification</h3>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-1"
            />
            <label
              htmlFor="terms"
              className="text-sm text-gray-700 cursor-pointer flex-1"
            >
              I certify that I have read and agree to the{' '}
              <a href="#" className="text-blue-600 hover:underline">
                terms and conditions
              </a>{' '}
              of this scholarship program.
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="accuracy"
              checked={agreedToAccuracy}
              onCheckedChange={(checked) => setAgreedToAccuracy(checked as boolean)}
              className="mt-1"
            />
            <label
              htmlFor="accuracy"
              className="text-sm text-gray-700 cursor-pointer flex-1"
            >
              I certify that all information provided in this application is true and accurate to the 
              best of my knowledge. I understand that providing false information may result in 
              disqualification.
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap print:hidden">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!status.isComplete || !agreedToTerms || !agreedToAccuracy || isSubmitting}
          className="flex-1 min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Application
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print Application
        </Button>
      </div>

      {!status.isComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 print:hidden">
          <p className="text-sm text-amber-800">
            Please complete all required sections before submitting your application. 
            Use the sidebar to navigate to incomplete sections.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-6 print:border-0 print:p-4">
      <h3 className="text-gray-900 mb-4 pb-2 border-b">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <dt className="text-gray-600">{label}</dt>
      <dd className="col-span-2 text-gray-900">{value || '—'}</dd>
    </div>
  );
}

function EssayPreview({ title, content }: { title: string; content?: string }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!content) return null;

  const preview = content.slice(0, 200);
  const shouldTruncate = content.length > 200;

  return (
    <div className="space-y-2">
      <h4 className="text-gray-900">{title}</h4>
      <div className="text-sm text-gray-700 whitespace-pre-wrap">
        {expanded || !shouldTruncate ? content : `${preview}...`}
      </div>
      {shouldTruncate && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-sm text-blue-600 hover:underline print:hidden"
        >
          Read more
        </button>
      )}
    </div>
  );
}
