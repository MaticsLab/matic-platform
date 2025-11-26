"use client";

import { useState, useCallback, memo } from 'react';
import { FormField, FieldType, FormTemplate } from '@/types/request';
import { Card } from '@/ui-components/card';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select';
import { Checkbox } from '@/ui-components/checkbox';
import { Textarea } from '@/ui-components/textarea';
import { Plus, Trash2, GripVertical, X, Eye, ChevronDown, ChevronRight, Layers, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormBuilderProps {
  onSave: (formData: {
    id?: string;
    name: string;
    request_type: string;
    description: string;
    fields: FormField[];
    workflow_template_id?: string;
  }) => void;
  onCancel?: () => void;
  template?: FormTemplate | null;
  workflows?: Array<{ id: string; name: string }>;
}

const FIELD_TYPES: FieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'item_list', 'email', 'phone', 'url', 'group', 'repeater'];

interface FieldEditorProps {
  field: FormField;
  depth?: number;
  activeFieldId: string | null;
  setActiveFieldId: (id: string | null) => void;
  updateField: (id: string, updates: Partial<FormField>) => void;
  addField: (parentId?: string) => void;
  removeField: (id: string) => void;
  addOption: (fieldId: string) => void;
  updateOption: (fieldId: string, optionIndex: number, value: string) => void;
  removeOption: (fieldId: string, optionIndex: number) => void;
}

const FieldEditor = memo(({ 
  field, 
  depth = 0,
  activeFieldId,
  setActiveFieldId,
  updateField,
  addField,
  removeField,
  addOption,
  updateOption,
  removeOption
}: FieldEditorProps) => {
  const isContainer = field.type === 'group' || field.type === 'repeater';
  const isActive = activeFieldId === field.id;

  return (
    <div className={cn(
      "border rounded-lg transition-all duration-200",
      isActive ? "border-blue-500 shadow-sm bg-white" : "border-gray-200 bg-gray-50 hover:border-gray-300",
      depth > 0 && "ml-6 mt-2"
    )}>
      {/* Field Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setActiveFieldId(isActive ? null : field.id);
        }}
      >
        <div className="flex items-center gap-3">
          <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
          <div className="flex flex-col">
            <span className="font-medium text-sm text-gray-900">
              {field.label || 'Untitled Field'}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {field.name} • {field.type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isContainer && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                addField(field.id);
              }}
            >
              <Plus className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              removeField(field.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
          <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", isActive && "rotate-90")} />
        </div>
      </div>

      {/* Field Settings (Expanded) */}
      {isActive && (
        <div 
          className="p-4 border-t border-gray-100 bg-white rounded-b-lg space-y-4" 
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Label</Label>
              <Input
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Internal Name</Label>
              <Input
                value={field.name}
                onChange={(e) => updateField(field.id, { name: e.target.value })}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Type</Label>
              <Select 
                value={field.type} 
                onValueChange={(value: FieldType) => updateField(field.id, { type: value })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Placeholder</Label>
              <Input
                value={field.placeholder || ''}
                onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                className="h-8"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`required-${field.id}`}
                checked={field.required}
                onCheckedChange={(checked) => updateField(field.id, { required: !!checked })}
              />
              <Label htmlFor={`required-${field.id}`} className="text-sm">Required</Label>
            </div>
          </div>

          {/* Type Specific Settings */}
          {field.type === 'select' && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Options</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => addOption(field.id)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Option
                </Button>
              </div>
              <div className="space-y-2">
                {field.options?.map((option, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(field.id, idx, e.target.value)}
                      className="h-8 text-sm"
                      placeholder={`Option ${idx + 1}`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => removeOption(field.id, idx)}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isContainer && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-gray-500">
                  {field.type === 'repeater' ? 'Repeater Fields' : 'Group Fields'}
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => addField(field.id)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Sub-field
                </Button>
              </div>
              {field.subFields && field.subFields.length > 0 ? (
                <div className="space-y-2 pl-2 border-l-2 border-gray-100">
                  {field.subFields.map((subField) => (
                    <FieldEditor 
                      key={subField.id} 
                      field={subField} 
                      depth={depth + 1}
                      activeFieldId={activeFieldId}
                      setActiveFieldId={setActiveFieldId}
                      updateField={updateField}
                      addField={addField}
                      removeField={removeField}
                      addOption={addOption}
                      updateOption={updateOption}
                      removeOption={removeOption}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 rounded border border-dashed text-xs text-gray-400">
                  No sub-fields yet
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Render children even if not active, but only for containers */}
      {!isActive && isContainer && field.subFields && field.subFields.length > 0 && (
        <div className="p-3 border-t border-gray-100 bg-gray-50/50">
           <div className="space-y-2 pl-2 border-l-2 border-gray-200">
              {field.subFields.map((subField) => (
                <FieldEditor 
                  key={subField.id} 
                  field={subField} 
                  depth={depth + 1}
                  activeFieldId={activeFieldId}
                  setActiveFieldId={setActiveFieldId}
                  updateField={updateField}
                  addField={addField}
                  removeField={removeField}
                  addOption={addOption}
                  updateOption={updateOption}
                  removeOption={removeOption}
                />
              ))}
            </div>
        </div>
      )}
    </div>
  );
});

FieldEditor.displayName = 'FieldEditor';

export function FormBuilder({ onSave, onCancel, template, workflows = [] }: FormBuilderProps) {
  const [templateId] = useState<string | undefined>(template?.id);
  const [formName, setFormName] = useState(template?.name || '');
  const [requestType, setRequestType] = useState(template?.request_type || '');
  const [description, setDescription] = useState(template?.description || '');
  const [selectedWorkflow, setSelectedWorkflow] = useState(template?.workflow_template_id || '');
  const [fields, setFields] = useState<FormField[]>(template?.fields || []);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  const addField = useCallback((parentId?: string) => {
    const newField: FormField = {
      id: `f${Date.now()}`,
      name: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      subFields: [],
    };

    setFields(prevFields => {
      if (parentId) {
        const updateFieldsRecursive = (currentFields: FormField[]): FormField[] => {
          return currentFields.map(field => {
            if (field.id === parentId) {
              return { ...field, subFields: [...(field.subFields || []), newField] };
            }
            if (field.subFields) {
              return { ...field, subFields: updateFieldsRecursive(field.subFields) };
            }
            return field;
          });
        };
        return updateFieldsRecursive(prevFields);
      } else {
        return [...prevFields, newField];
      }
    });
    setActiveFieldId(newField.id);
  }, []);

  const updateField = useCallback((id: string, updates: Partial<FormField>) => {
    setFields(prevFields => {
      const updateFieldsRecursive = (currentFields: FormField[]): FormField[] => {
        return currentFields.map(field => {
          if (field.id === id) {
            return { ...field, ...updates };
          }
          if (field.subFields) {
            return { ...field, subFields: updateFieldsRecursive(field.subFields) };
          }
          return field;
        });
      };
      return updateFieldsRecursive(prevFields);
    });
  }, []);

  const removeField = useCallback((id: string) => {
    setFields(prevFields => {
      const removeFieldsRecursive = (currentFields: FormField[]): FormField[] => {
        return currentFields.filter(field => field.id !== id).map(field => {
          if (field.subFields) {
            return { ...field, subFields: removeFieldsRecursive(field.subFields) };
          }
          return field;
        });
      };
      return removeFieldsRecursive(prevFields);
    });
    if (activeFieldId === id) setActiveFieldId(null);
  }, [activeFieldId]);

  const addOption = useCallback((fieldId: string) => {
    setFields(prevFields => {
      const updateFieldsRecursive = (currentFields: FormField[]): FormField[] => {
        return currentFields.map(field => {
          if (field.id === fieldId) {
            return { ...field, options: [...(field.options || []), ''] };
          }
          if (field.subFields) {
            return { ...field, subFields: updateFieldsRecursive(field.subFields) };
          }
          return field;
        });
      };
      return updateFieldsRecursive(prevFields);
    });
  }, []);

  const updateOption = useCallback((fieldId: string, optionIndex: number, value: string) => {
    setFields(prevFields => {
      const updateFieldsRecursive = (currentFields: FormField[]): FormField[] => {
        return currentFields.map(field => {
          if (field.id === fieldId) {
            const newOptions = [...(field.options || [])];
            newOptions[optionIndex] = value;
            return { ...field, options: newOptions };
          }
          if (field.subFields) {
            return { ...field, subFields: updateFieldsRecursive(field.subFields) };
          }
          return field;
        });
      };
      return updateFieldsRecursive(prevFields);
    });
  }, []);

  const removeOption = useCallback((fieldId: string, optionIndex: number) => {
    setFields(prevFields => {
      const updateFieldsRecursive = (currentFields: FormField[]): FormField[] => {
        return currentFields.map(field => {
          if (field.id === fieldId) {
            const newOptions = (field.options || []).filter((_, i) => i !== optionIndex);
            return { ...field, options: newOptions };
          }
          if (field.subFields) {
            return { ...field, subFields: updateFieldsRecursive(field.subFields) };
          }
          return field;
        });
      };
      return updateFieldsRecursive(prevFields);
    });
  }, []);

  const handleSave = () => {
    if (!formName || !requestType || !description) {
      alert('Please fill in all required fields');
      return;
    }

    if (fields.length === 0) {
      alert('Please add at least one field');
      return;
    }

    onSave({
      id: templateId,
      name: formName,
      request_type: requestType,
      description,
      fields,
      workflow_template_id: selectedWorkflow || undefined,
    });
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Left Sidebar - Form Settings */}
      <div className="w-80 flex-shrink-0 overflow-y-auto">
        <Card className="p-4 space-y-6 sticky top-0">
          <div>
            <h3 className="font-semibold text-lg mb-1">Form Settings</h3>
            <p className="text-xs text-gray-500">Configure basic form properties</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="formName">Form Name</Label>
              <Input
                id="formName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Budget Request"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestType">Request Type ID</Label>
              <Input
                id="requestType"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                placeholder="e.g., budget_request"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Form purpose..."
                rows={3}
                className="resize-none"
              />
            </div>

            {workflows.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="workflow">Workflow</Label>
                <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="pt-4 border-t flex flex-col gap-2">
            <Button onClick={handleSave} className="w-full">
              {template ? 'Save Changes' : 'Create Form'}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={handleCancel} className="w-full">
                Cancel
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Main Content - Field Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50/50 rounded-t-lg">
          <div>
            <h3 className="font-semibold">Form Fields</h3>
            <p className="text-xs text-gray-500">Build your form structure</p>
          </div>
          <Button onClick={() => addField()} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Field
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {fields.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed rounded-lg bg-gray-50">
              <Layers className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">No fields yet</p>
              <p className="text-xs mt-1">Click "Add Field" to start building</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {fields.map((field) => (
                <FieldEditor 
                  key={field.id} 
                  field={field} 
                  activeFieldId={activeFieldId}
                  setActiveFieldId={setActiveFieldId}
                  updateField={updateField}
                  addField={addField}
                  removeField={removeField}
                  addOption={addOption}
                  updateOption={updateOption}
                  removeOption={removeOption}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
