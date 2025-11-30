import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form@7.55.0';
import { ApplicationSidebar } from './ApplicationSidebar';
import { ProgressHeader } from './ProgressHeader';
import { PersonalInfoSection } from './sections/PersonalInfoSection';
import { AcademicInfoSection } from './sections/AcademicInfoSection';
import { EssaySection } from './sections/EssaySection';
import { DocumentsSection } from './sections/DocumentsSection';
import { ReferencesSection } from './sections/ReferencesSection';
import { ReviewSection } from './sections/ReviewSection';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export interface ApplicationData {
  // Personal Info
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  studentId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Academic Info
  institution?: string;
  major?: string;
  gpa?: string;
  expectedGraduation?: string;
  academicLevel?: string;
  
  // Essays
  essay1?: string;
  essay2?: string;
  essay3?: string;
  
  // Documents
  documents?: File[];
  
  // References
  reference1Name?: string;
  reference1Email?: string;
  reference1Title?: string;
  reference2Name?: string;
  reference2Email?: string;
  reference2Title?: string;
}

interface SectionConfig {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  required: string[];
}

const sections: SectionConfig[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    component: PersonalInfoSection,
    required: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'studentId']
  },
  {
    id: 'academic',
    title: 'Academic Information',
    component: AcademicInfoSection,
    required: ['institution', 'major', 'gpa', 'expectedGraduation', 'academicLevel']
  },
  {
    id: 'essays',
    title: 'Essays',
    component: EssaySection,
    required: ['essay1', 'essay2']
  },
  {
    id: 'documents',
    title: 'Documents',
    component: DocumentsSection,
    required: []
  },
  {
    id: 'references',
    title: 'References',
    component: ReferencesSection,
    required: ['reference1Name', 'reference1Email', 'reference2Name', 'reference2Email']
  },
  {
    id: 'review',
    title: 'Review & Submit',
    component: ReviewSection,
    required: []
  }
];

export function ApplicationForm() {
  const [currentSection, setCurrentSection] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [versionHistory, setVersionHistory] = useState<{ date: Date; data: ApplicationData }[]>([]);

  const form = useForm<ApplicationData>({
    mode: 'onBlur',
    defaultValues: {}
  });

  const { watch, formState: { errors } } = form;
  const formData = watch();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveVersion();
      }
      
      // Ctrl/Cmd + Right Arrow to go to next section
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        if (canProceed() && currentSection < sections.length - 1) {
          nextSection();
        }
      }
      
      // Ctrl/Cmd + Left Arrow to go to previous section
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentSection > 0) {
          prevSection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSection, formData]);

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem('scholarship-application');
    const savedHistory = localStorage.getItem('scholarship-application-history');
    
    if (saved) {
      const data = JSON.parse(saved);
      form.reset(data.formData);
    }
    
    if (savedHistory) {
      const history = JSON.parse(savedHistory);
      setVersionHistory(history.map((h: any) => ({ ...h, date: new Date(h.date) })));
    }
  }, []);

  const saveVersion = () => {
    const newVersion = {
      date: new Date(),
      data: { ...formData }
    };
    
    const newHistory = [...versionHistory, newVersion].slice(-10); // Keep last 10 versions
    setVersionHistory(newHistory);
    
    localStorage.setItem('scholarship-application-history', JSON.stringify(
      newHistory.map(h => ({ ...h, date: h.date.toISOString() }))
    ));
    
    toast.success('Version saved successfully!');
  };

  const restoreVersion = (version: { date: Date; data: ApplicationData }) => {
    form.reset(version.data);
    toast.success(`Restored version from ${version.date.toLocaleString()}`);
  };

  const calculateProgress = () => {
    const allFields = sections.flatMap(s => s.required);
    const filledFields = allFields.filter(field => {
      const value = formData[field as keyof ApplicationData];
      return value && value !== '';
    });
    
    return Math.round((filledFields.length / allFields.length) * 100);
  };

  const getSectionCompletion = (sectionIndex: number) => {
    const section = sections[sectionIndex];
    if (section.required.length === 0) return 100;
    
    const filled = section.required.filter(field => {
      const value = formData[field as keyof ApplicationData];
      return value && value !== '';
    });
    
    return Math.round((filled.length / section.required.length) * 100);
  };

  const isSectionComplete = (sectionIndex: number) => {
    return getSectionCompletion(sectionIndex) === 100;
  };

  const canProceed = () => {
    if (currentSection === sections.length - 1) return true;
    return getSectionCompletion(currentSection) >= 50; // Allow proceeding with 50% completion
  };

  const goToSection = (index: number) => {
    setCurrentSection(index);
  };

  const nextSection = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate all required fields
    const allComplete = sections.slice(0, -1).every((_, idx) => isSectionComplete(idx));
    
    if (!allComplete) {
      toast.error('Please complete all required sections before submitting.');
      return;
    }
    
    toast.success('Application submitted successfully!');
    // Here you would typically send the data to a server
  };

  const CurrentSectionComponent = sections[currentSection].component;
  const progress = calculateProgress();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <ApplicationSidebar
        sections={sections}
        currentSection={currentSection}
        onSectionChange={goToSection}
        getSectionCompletion={getSectionCompletion}
        isSectionComplete={isSectionComplete}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Progress Header */}
        <ProgressHeader
          progress={progress}
          isSaving={false}
          lastSaved={null}
          onSave={saveVersion}
          versionHistory={versionHistory}
          onRestoreVersion={restoreVersion}
        />

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-gray-900 mb-2">
                {sections[currentSection].title}
              </h1>
            </div>

            <CurrentSectionComponent
              form={form}
              formData={formData}
              errors={errors}
              onSubmit={currentSection === sections.length - 1 ? handleSubmit : undefined}
            />

            {/* Navigation Buttons */}
            {currentSection !== sections.length - 1 && (
              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={prevSection}
                  disabled={currentSection === 0}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                <Button
                  onClick={nextSection}
                  disabled={!canProceed()}
                >
                  {currentSection === sections.length - 2 ? 'Review Application' : 'Next Section'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}