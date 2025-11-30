import { UseFormReturn } from 'react-hook-form@7.55.0';
import { ApplicationData } from '../ApplicationForm';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { AlertCircle, FileText } from 'lucide-react';
import { cn } from '../ui/utils';

interface EssaySectionProps {
  form: UseFormReturn<ApplicationData>;
  formData: ApplicationData;
  errors: any;
}

const ESSAY_LIMITS = {
  essay1: { min: 250, max: 500 },
  essay2: { min: 250, max: 500 },
  essay3: { min: 0, max: 300 }
};

export function EssaySection({ form, formData, errors }: EssaySectionProps) {
  const { register } = form;

  const getWordCount = (text: string | undefined) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getCharacterCount = (text: string | undefined) => {
    return text?.length || 0;
  };

  const getCounterColor = (count: number, min: number, max: number) => {
    if (count === 0) return 'text-gray-500';
    if (count < min) return 'text-orange-600';
    if (count > max) return 'text-red-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-8">
      {/* Essay 1 */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <Label htmlFor="essay1" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Essay 1: Why do you deserve this scholarship? <span className="text-red-500">*</span>
            </Label>
            <p className="text-sm text-gray-600 mt-1">
              Tell us about your background, achievements, and why you're a strong candidate for this scholarship.
            </p>
          </div>
        </div>
        
        <Textarea
          id="essay1"
          {...register('essay1', {
            required: true,
            validate: (value) => {
              const count = getWordCount(value);
              return count >= ESSAY_LIMITS.essay1.min && count <= ESSAY_LIMITS.essay1.max;
            }
          })}
          placeholder="Share your story..."
          rows={8}
          aria-required="true"
          aria-invalid={errors.essay1 ? 'true' : 'false'}
          className={cn(
            "resize-y min-h-[200px]",
            errors.essay1 ? 'border-red-500' : ''
          )}
        />
        
        <div className="flex items-center justify-between text-sm">
          {errors.essay1 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Essay must be between {ESSAY_LIMITS.essay1.min}-{ESSAY_LIMITS.essay1.max} words</span>
            </div>
          )}
          <div
            className={cn(
              "ml-auto",
              getCounterColor(
                getWordCount(formData.essay1),
                ESSAY_LIMITS.essay1.min,
                ESSAY_LIMITS.essay1.max
              )
            )}
          >
            {getWordCount(formData.essay1)}/{ESSAY_LIMITS.essay1.max} words
          </div>
        </div>
      </div>

      {/* Essay 2 */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <Label htmlFor="essay2" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Essay 2: What are your career goals? <span className="text-red-500">*</span>
            </Label>
            <p className="text-sm text-gray-600 mt-1">
              Describe your career aspirations and how this scholarship will help you achieve them.
            </p>
          </div>
        </div>
        
        <Textarea
          id="essay2"
          {...register('essay2', {
            required: true,
            validate: (value) => {
              const count = getWordCount(value);
              return count >= ESSAY_LIMITS.essay2.min && count <= ESSAY_LIMITS.essay2.max;
            }
          })}
          placeholder="Describe your goals..."
          rows={8}
          aria-required="true"
          aria-invalid={errors.essay2 ? 'true' : 'false'}
          className={cn(
            "resize-y min-h-[200px]",
            errors.essay2 ? 'border-red-500' : ''
          )}
        />
        
        <div className="flex items-center justify-between text-sm">
          {errors.essay2 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Essay must be between {ESSAY_LIMITS.essay2.min}-{ESSAY_LIMITS.essay2.max} words</span>
            </div>
          )}
          <div
            className={cn(
              "ml-auto",
              getCounterColor(
                getWordCount(formData.essay2),
                ESSAY_LIMITS.essay2.min,
                ESSAY_LIMITS.essay2.max
              )
            )}
          >
            {getWordCount(formData.essay2)}/{ESSAY_LIMITS.essay2.max} words
          </div>
        </div>
      </div>

      {/* Essay 3 - Optional */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <Label htmlFor="essay3" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Essay 3: Additional Information (Optional)
            </Label>
            <p className="text-sm text-gray-600 mt-1">
              Share any additional information you'd like the selection committee to know.
            </p>
          </div>
        </div>
        
        <Textarea
          id="essay3"
          {...register('essay3', {
            validate: (value) => {
              if (!value) return true;
              const count = getWordCount(value);
              return count <= ESSAY_LIMITS.essay3.max;
            }
          })}
          placeholder="Optional additional information..."
          rows={6}
          className={cn(
            "resize-y min-h-[150px]",
            errors.essay3 ? 'border-red-500' : ''
          )}
        />
        
        <div className="flex items-center justify-between text-sm">
          {errors.essay3 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Essay must be under {ESSAY_LIMITS.essay3.max} words</span>
            </div>
          )}
          <div
            className={cn(
              "ml-auto",
              getCounterColor(
                getWordCount(formData.essay3),
                0,
                ESSAY_LIMITS.essay3.max
              )
            )}
          >
            {getWordCount(formData.essay3)}/{ESSAY_LIMITS.essay3.max} words
          </div>
        </div>
      </div>

      {/* Writing Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="text-amber-900 mb-2">Writing Tips</h3>
        <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
          <li>Be authentic and share your unique perspective</li>
          <li>Use specific examples to illustrate your points</li>
          <li>Proofread carefully for grammar and spelling</li>
          <li>Stay within the word count limits</li>
        </ul>
      </div>
    </div>
  );
}
