import { UseFormReturn } from 'react-hook-form@7.55.0';
import { ApplicationData } from '../ApplicationForm';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertCircle, User } from 'lucide-react';

interface ReferencesSectionProps {
  form: UseFormReturn<ApplicationData>;
  formData: ApplicationData;
  errors: any;
}

export function ReferencesSection({ form, formData, errors }: ReferencesSectionProps) {
  const { register } = form;

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 mb-2">Reference Requirements</h3>
        <p className="text-sm text-blue-700">
          Please provide contact information for two academic or professional references who can speak 
          to your qualifications. They will be contacted directly via email.
        </p>
      </div>

      {/* Reference 1 */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-900">
          <User className="h-5 w-5" />
          <h3>Reference 1 <span className="text-red-500">*</span></h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reference1Name">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reference1Name"
              {...register('reference1Name', { required: true })}
              placeholder="Dr. Jane Smith"
              aria-required="true"
              aria-invalid={errors.reference1Name ? 'true' : 'false'}
              className={errors.reference1Name ? 'border-red-500' : ''}
            />
            {errors.reference1Name && (
              <div className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Reference name is required</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference1Email">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reference1Email"
              type="email"
              {...register('reference1Email', {
                required: true,
                pattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
              })}
              placeholder="jane.smith@university.edu"
              aria-required="true"
              aria-invalid={errors.reference1Email ? 'true' : 'false'}
              className={errors.reference1Email ? 'border-red-500' : ''}
            />
            {errors.reference1Email && (
              <div className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Valid email address is required</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference1Title">
              Title/Position
            </Label>
            <Input
              id="reference1Title"
              {...register('reference1Title')}
              placeholder="Professor of Computer Science"
            />
          </div>
        </div>
      </div>

      {/* Reference 2 */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-900">
          <User className="h-5 w-5" />
          <h3>Reference 2 <span className="text-red-500">*</span></h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reference2Name">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reference2Name"
              {...register('reference2Name', { required: true })}
              placeholder="Prof. John Doe"
              aria-required="true"
              aria-invalid={errors.reference2Name ? 'true' : 'false'}
              className={errors.reference2Name ? 'border-red-500' : ''}
            />
            {errors.reference2Name && (
              <div className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Reference name is required</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference2Email">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reference2Email"
              type="email"
              {...register('reference2Email', {
                required: true,
                pattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
              })}
              placeholder="john.doe@company.com"
              aria-required="true"
              aria-invalid={errors.reference2Email ? 'true' : 'false'}
              className={errors.reference2Email ? 'border-red-500' : ''}
            />
            {errors.reference2Email && (
              <div className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Valid email address is required</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference2Title">
              Title/Position
            </Label>
            <Input
              id="reference2Title"
              {...register('reference2Title')}
              placeholder="Senior Software Engineer"
            />
          </div>
        </div>
      </div>

      {/* Important Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="text-amber-900 mb-2">Important Note</h3>
        <p className="text-sm text-amber-800">
          Your references will receive an email request to submit a letter of recommendation on your behalf. 
          Please ensure you have their permission before listing them as references.
        </p>
      </div>
    </div>
  );
}
