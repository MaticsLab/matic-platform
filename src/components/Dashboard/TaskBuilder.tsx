'use client'

import { useState } from 'react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Textarea } from '@/ui-components/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select'
import { Card } from '@/ui-components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui-components/dialog'
import { Plus, Trash2, Calendar, FileText, Upload, User, Heart, CheckCircle, AlertCircle, GripVertical } from 'lucide-react'
import { DashboardTask, TaskType } from '@/types/tasks'
import { Field } from '@/types/portal'

interface TaskBuilderProps {
  tasks: DashboardTask[]
  onChange: (tasks: DashboardTask[]) => void
  formFields: Field[]
}

export function TaskBuilder({ tasks, onChange, formFields }: TaskBuilderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<DashboardTask | null>(null)

  const handleAddTask = () => {
    setEditingTask({
      id: `task-${Date.now()}`,
      type: 'custom',
      label: '',
      description: '',
      icon: 'file-text',
      actions: [{ id: 'action-1', label: 'Complete', type: 'navigate' }],
      optional: false,
    })
    setIsDialogOpen(true)
  }

  const handleEditTask = (task: DashboardTask) => {
    setEditingTask(task)
    setIsDialogOpen(true)
  }

  const handleSaveTask = (task: DashboardTask) => {
    const existingIndex = tasks.findIndex(t => t.id === task.id)
    if (existingIndex >= 0) {
      const newTasks = [...tasks]
      newTasks[existingIndex] = task
      onChange(newTasks)
    } else {
      onChange([...tasks, task])
    }
    setIsDialogOpen(false)
    setEditingTask(null)
  }

  const handleDeleteTask = (taskId: string) => {
    onChange(tasks.filter(t => t.id !== taskId))
  }

  const getIconComponent = (iconName?: string) => {
    switch (iconName) {
      case 'upload': return Upload
      case 'user': return User
      case 'check-circle': return CheckCircle
      case 'heart': return Heart
      case 'calendar': return Calendar
      case 'alert-circle': return AlertCircle
      case 'file-text':
      default: return FileText
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Dashboard Tasks</h3>
          <p className="text-xs text-gray-500 mt-1">
            Create custom tasks for applicants to complete
          </p>
        </div>
        <Button onClick={handleAddTask} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task, index) => {
            const Icon = getIconComponent(task.icon)
            return (
              <Card key={task.id} className="p-3">
                <div className="flex items-start gap-3">
                  <GripVertical className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{task.label || 'Untitled Task'}</p>
                        {task.description && (
                          <p className="text-xs text-gray-600 mt-0.5">{task.description}</p>
                        )}
                        {task.deadline && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Deadline: {new Date(task.deadline).toLocaleDateString()}
                          </p>
                        )}
                        {task.optional && (
                          <span className="inline-block mt-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Optional
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTask(task)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">No tasks yet</p>
          <Button onClick={handleAddTask} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Task
          </Button>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask?.id.startsWith('task-') && tasks.find(t => t.id === editingTask.id) ? 'Edit Task' : 'Create Task'}</DialogTitle>
            <DialogDescription>
              Create a custom task for applicants to complete on their dashboard
            </DialogDescription>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              task={editingTask}
              formFields={formFields}
              onSave={handleSaveTask}
              onCancel={() => {
                setIsDialogOpen(false)
                setEditingTask(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskForm({
  task,
  formFields,
  onSave,
  onCancel
}: {
  task: DashboardTask
  formFields: Field[]
  onSave: (task: DashboardTask) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<DashboardTask>(task)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const updateField = (field: keyof DashboardTask, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addAction = () => {
    const newAction = {
      id: `action-${Date.now()}`,
      label: 'New Action',
      type: 'navigate' as const
    }
    updateField('actions', [...formData.actions, newAction])
  }

  const updateAction = (index: number, field: string, value: any) => {
    const newActions = [...formData.actions]
    newActions[index] = { ...newActions[index], [field]: value }
    updateField('actions', newActions)
  }

  const removeAction = (index: number) => {
    updateField('actions', formData.actions.filter((_, i) => i !== index))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="label">Task Label *</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => updateField('label', e.target.value)}
            placeholder="Complete Application Form"
            required
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Describe what the applicant needs to do"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="type">Task Type</Label>
          <Select value={formData.type} onValueChange={(value) => updateField('type', value as TaskType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="complete_application">Complete Application</SelectItem>
              <SelectItem value="complete_field">Complete Field</SelectItem>
              <SelectItem value="upload_document">Upload Document</SelectItem>
              <SelectItem value="request_recommendation">Request Recommendation</SelectItem>
              <SelectItem value="verify_information">Verify Information</SelectItem>
              <SelectItem value="custom">Custom Task</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="icon">Icon</Label>
          <Select value={formData.icon} onValueChange={(value) => updateField('icon', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="file-text">📄 File Text</SelectItem>
              <SelectItem value="upload">📤 Upload</SelectItem>
              <SelectItem value="user">👤 User</SelectItem>
              <SelectItem value="heart">❤️ Heart</SelectItem>
              <SelectItem value="calendar">📅 Calendar</SelectItem>
              <SelectItem value="check-circle">✅ Check Circle</SelectItem>
              <SelectItem value="alert-circle">⚠️ Alert Circle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="deadline">Deadline (Optional)</Label>
          <Input
            id="deadline"
            type="datetime-local"
            value={formData.deadline ? formData.deadline.slice(0, 16) : ''}
            onChange={(e) => updateField('deadline', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          />
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select value={formData.priority || 'medium'} onValueChange={(value) => updateField('priority', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.optional || false}
              onChange={(e) => updateField('optional', e.target.checked)}
              className="rounded"
            />
            <span>Make this task optional</span>
          </Label>
        </div>
      </div>

      {/* Conditions */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">When to Show This Task</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="showWhen">Show When</Label>
            <Select
              value={formData.conditions?.showWhen || 'always'}
              onValueChange={(value) =>
                updateField('conditions', {
                  ...formData.conditions,
                  showWhen: value
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="field_empty">When field is empty</SelectItem>
                <SelectItem value="field_value">When field equals value</SelectItem>
                <SelectItem value="status">When application status matches</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.conditions?.showWhen === 'field_empty' && (
            <div>
              <Label htmlFor="fieldId">Field</Label>
              <Select
                value={formData.conditions?.fieldId || ''}
                onValueChange={(value) =>
                  updateField('conditions', {
                    ...formData.conditions,
                    fieldId: value
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {formFields.map(field => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">Actions</h4>
          <Button type="button" variant="outline" size="sm" onClick={addAction}>
            <Plus className="w-4 h-4 mr-2" />
            Add Action
          </Button>
        </div>
        <div className="space-y-3">
          {formData.actions.map((action, index) => (
            <Card key={action.id} className="p-3">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Action label"
                    value={action.label}
                    onChange={(e) => updateAction(index, 'label', e.target.value)}
                  />
                  <Select
                    value={action.type}
                    onValueChange={(value) => updateAction(index, 'type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="navigate">Navigate</SelectItem>
                      <SelectItem value="upload">Upload File</SelectItem>
                      <SelectItem value="submit">Submit</SelectItem>
                      <SelectItem value="external_link">External Link</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(index)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {(action.type === 'navigate' || action.type === 'external_link') && (
                  <Input
                    placeholder="URL"
                    value={action.targetUrl || ''}
                    onChange={(e) => updateAction(index, 'targetUrl', e.target.value)}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Task
        </Button>
      </div>
    </form>
  )
}
