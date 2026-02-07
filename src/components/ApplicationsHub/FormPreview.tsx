'use client'

interface FormPreviewProps {
  form: any
  size?: 'small' | 'medium' | 'large'
}

export function FormPreview({ form, size = 'medium' }: FormPreviewProps) {
  // Get theme color from form settings
  const themeColor = form.settings?.branding?.primary_color || form.settings?.formTheme?.primaryColor || '#8B5CF6'
  
  // Size configurations
  const dimensions = {
    small: { 
      containerClass: 'w-full aspect-[4/3]', 
      progressHeight: 'h-1', 
      paddingClass: 'p-2.5',
      titleHeight: 'h-1.5',
      labelHeight: 'h-1',
      inputHeight: 'h-3',
      buttonHeight: 'h-4',
      spacing: 'space-y-1.5',
      fieldSpacing: 'space-y-1'
    },
    medium: { 
      containerClass: 'w-48 h-32', 
      progressHeight: 'h-1.5', 
      paddingClass: 'p-3',
      titleHeight: 'h-1.5',
      labelHeight: 'h-1',
      inputHeight: 'h-4',
      buttonHeight: 'h-5',
      spacing: 'space-y-2',
      fieldSpacing: 'space-y-1'
    },
    large: { 
      containerClass: 'w-64 h-48', 
      progressHeight: 'h-2', 
      paddingClass: 'p-4',
      titleHeight: 'h-2',
      labelHeight: 'h-1.5',
      inputHeight: 'h-5',
      buttonHeight: 'h-6',
      spacing: 'space-y-3',
      fieldSpacing: 'space-y-1.5'
    }
  }

  const config = dimensions[size]

  return (
    <div className={`${config.containerClass} bg-white rounded-lg shadow-sm overflow-hidden flex flex-col`}>
      {/* Progress bar at top */}
      <div className={config.progressHeight} style={{ backgroundColor: themeColor }}></div>
      
      {/* Form content preview */}
      <div className={`${config.paddingClass} flex-1 flex flex-col ${config.spacing}`}>
        {/* Title */}
        <div className={`${config.titleHeight} bg-gray-900 rounded w-3/4`}></div>
        
        {/* Form fields preview */}
        <div className={`flex-1 ${config.spacing}`}>
          {/* Field 1 */}
          <div className={config.fieldSpacing}>
            <div className={`${config.labelHeight} bg-gray-300 rounded w-2/5`}></div>
            <div className={`${config.inputHeight} bg-gray-100 border border-gray-200 rounded`}></div>
          </div>
          
          {/* Field 2 */}
          <div className={config.fieldSpacing}>
            <div className={`${config.labelHeight} bg-gray-300 rounded w-3/5`}></div>
            <div className={`${config.inputHeight} bg-gray-100 border border-gray-200 rounded`}></div>
          </div>
          
          {/* Field 3 (only for medium/large) */}
          {size !== 'small' && (
            <div className={config.fieldSpacing}>
              <div className={`${config.labelHeight} bg-gray-300 rounded w-1/3`}></div>
              <div className={`${config.inputHeight} bg-gray-100 border border-gray-200 rounded`}></div>
            </div>
          )}
        </div>
        
        {/* Button */}
        <div 
          className={`${config.buttonHeight} rounded flex items-center justify-center text-[8px] font-semibold text-white`}
          style={{ backgroundColor: themeColor }}
        >
          Continue
        </div>
      </div>
    </div>
  )
}
