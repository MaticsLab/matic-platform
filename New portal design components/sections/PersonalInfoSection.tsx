import { UseFormReturn } from 'react-hook-form@7.55.0';
import { ApplicationData } from '../ApplicationForm';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface PersonalInfoSectionProps {
  form: UseFormReturn<ApplicationData>;
  formData: ApplicationData;
  errors: any;
}

export function PersonalInfoSection({ form, formData, errors }: PersonalInfoSectionProps) {
  const { register } = form;

  return (
    <div className="space-y-6">
      {/* Name Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="firstName">
              First Name <span className="text-red-500">*</span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enter your legal first name as it appears on official documents</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="firstName"
            {...register('firstName', { required: true })}
            placeholder="John"
            aria-required="true"
            aria-invalid={errors.firstName ? 'true' : 'false'}
            className={errors.firstName ? 'border-red-500' : ''}
          />
          {errors.firstName && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>First name is required</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">
            Last Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lastName"
            {...register('lastName', { required: true })}
            placeholder="Doe"
            aria-required="true"
            aria-invalid={errors.lastName ? 'true' : 'false'}
            className={errors.lastName ? 'border-red-500' : ''}
          />
          {errors.lastName && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Last name is required</span>
            </div>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">
            Email Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            {...register('email', {
              required: true,
              pattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
            })}
            placeholder="john.doe@university.edu"
            aria-required="true"
            aria-invalid={errors.email ? 'true' : 'false'}
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Please enter a valid email address</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="phone">
              Phone Number <span className="text-red-500">*</span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Format: (123) 456-7890</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="phone"
            type="tel"
            {...register('phone', {
              required: true,
              pattern: /^[\d\s()+-]+$/
            })}
            placeholder="(555) 123-4567"
            aria-required="true"
            aria-invalid={errors.phone ? 'true' : 'false'}
            className={errors.phone ? 'border-red-500' : ''}
          />
          {errors.phone && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Please enter a valid phone number</span>
            </div>
          )}
        </div>
      </div>

      {/* Student Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">
            Date of Birth <span className="text-red-500">*</span>
          </Label>
          <Input
            id="dateOfBirth"
            type="date"
            {...register('dateOfBirth', { required: true })}
            aria-required="true"
            aria-invalid={errors.dateOfBirth ? 'true' : 'false'}
            className={errors.dateOfBirth ? 'border-red-500' : ''}
          />
          {errors.dateOfBirth && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Date of birth is required</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="studentId">
              Student ID <span className="text-red-500">*</span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Your 10-digit student identification number</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="studentId"
            {...register('studentId', {
              required: true,
              pattern: /^\d{10}$/
            })}
            placeholder="1234567890"
            maxLength={10}
            aria-required="true"
            aria-invalid={errors.studentId ? 'true' : 'false'}
            className={errors.studentId ? 'border-red-500' : ''}
          />
          {errors.studentId ? (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Student ID must be 10 digits</span>
            </div>
          ) : formData.studentId && (
            <div className="text-sm text-gray-500">
              {formData.studentId.length}/10 characters
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address">Street Address</Label>
          <Input
            id="address"
            {...register('address')}
            placeholder="123 Main Street, Apt 4B"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              {...register('city')}
              placeholder="Boston"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              {...register('state')}
              placeholder="MA"
              maxLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zipCode">ZIP Code</Label>
            <Input
              id="zipCode"
              {...register('zipCode')}
              placeholder="02101"
              maxLength={5}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
