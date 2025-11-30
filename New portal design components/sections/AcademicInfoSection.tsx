import { UseFormReturn } from 'react-hook-form@7.55.0';
import { ApplicationData } from '../ApplicationForm';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { AlertCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface AcademicInfoSectionProps {
  form: UseFormReturn<ApplicationData>;
  formData: ApplicationData;
  errors: any;
}

export function AcademicInfoSection({ form, formData, errors }: AcademicInfoSectionProps) {
  const { register, setValue } = form;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="institution">
          Institution Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="institution"
          {...register('institution', { required: true })}
          placeholder="University of Example"
          aria-required="true"
          aria-invalid={errors.institution ? 'true' : 'false'}
          className={errors.institution ? 'border-red-500' : ''}
        />
        {errors.institution && (
          <div className="flex items-center gap-1 text-red-600 text-sm">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Institution name is required</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="major">
            Major/Field of Study <span className="text-red-500">*</span>
          </Label>
          <Input
            id="major"
            {...register('major', { required: true })}
            placeholder="Computer Science"
            aria-required="true"
            aria-invalid={errors.major ? 'true' : 'false'}
            className={errors.major ? 'border-red-500' : ''}
          />
          {errors.major && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Major is required</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="academicLevel">
            Academic Level <span className="text-red-500">*</span>
          </Label>
          <Select
            onValueChange={(value) => setValue('academicLevel', value)}
            value={formData.academicLevel}
          >
            <SelectTrigger
              id="academicLevel"
              aria-required="true"
              aria-invalid={errors.academicLevel ? 'true' : 'false'}
              className={errors.academicLevel ? 'border-red-500' : ''}
            >
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="freshman">Freshman</SelectItem>
              <SelectItem value="sophomore">Sophomore</SelectItem>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="graduate">Graduate Student</SelectItem>
            </SelectContent>
          </Select>
          {errors.academicLevel && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Academic level is required</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="gpa">
              GPA <span className="text-red-500">*</span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enter your cumulative GPA on a 4.0 scale</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="gpa"
            type="number"
            step="0.01"
            min="0"
            max="4.0"
            {...register('gpa', {
              required: true,
              min: 0,
              max: 4.0
            })}
            placeholder="3.75"
            aria-required="true"
            aria-invalid={errors.gpa ? 'true' : 'false'}
            className={errors.gpa ? 'border-red-500' : ''}
          />
          {errors.gpa ? (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>GPA must be between 0.00 and 4.00</span>
            </div>
          ) : formData.gpa && parseFloat(formData.gpa) >= 3.5 && (
            <div className="text-sm text-green-600">
              Excellent academic standing!
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="expectedGraduation">
            Expected Graduation <span className="text-red-500">*</span>
          </Label>
          <Input
            id="expectedGraduation"
            type="month"
            {...register('expectedGraduation', { required: true })}
            aria-required="true"
            aria-invalid={errors.expectedGraduation ? 'true' : 'false'}
            className={errors.expectedGraduation ? 'border-red-500' : ''}
          />
          {errors.expectedGraduation && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Expected graduation date is required</span>
            </div>
          )}
        </div>
      </div>

      {/* Additional Academic Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 mb-2">Academic Achievements</h3>
        <p className="text-sm text-blue-700">
          In the essays section, you'll have the opportunity to highlight your academic achievements, 
          research experience, and academic goals.
        </p>
      </div>
    </div>
  );
}
