'use client'

import {
  ListTodo, CheckCircle2, Clock, MessageSquare, FileText, Lightbulb,
  Settings as SettingsIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/ui-components/label'
import { Input } from '@/ui-components/input'
import { Switch } from '@/ui-components/switch'
import { Slider } from '@/ui-components/slider'
import { DashboardBlock, DashboardBlockType } from '@/types/dashboard'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'

const BLOCK_TYPES_MAP = {
  tasks: { label: 'Tasks', icon: ListTodo, color: 'blue' },
  status: { label: 'Status Card', icon: CheckCircle2, color: 'green' },
  timeline: { label: 'Activity Timeline', icon: Clock, color: 'purple' },
  messages: { label: 'Messages', icon: MessageSquare, color: 'indigo' },
  documents: { label: 'Documents', icon: FileText, color: 'amber' },
  recommendations: { label: 'Recommendations', icon: Lightbulb, color: 'orange' },
}

interface DashboardBlockSettingsProps {
  block: DashboardBlock
  onUpdateBlock: (updates: Partial<DashboardBlock>) => void
}

export function DashboardBlockSettings({ block, onUpdateBlock }: DashboardBlockSettingsProps) {
  const blockType = BLOCK_TYPES_MAP[block.type]
  const Icon = blockType.icon

  const updateSettings = (key: string, value: unknown) => {
    onUpdateBlock({
      settings: {
        ...block.settings,
        [key]: value
      }
    })
  }

  return (
    <div className="h-full flex flex-col bg-white border-r">
      {/* Header */}
      <div className={cn(
        "p-4 border-b",
        `bg-${blockType.color}-50`
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            `bg-${blockType.color}-100`
          )}>
            <Icon className={cn("w-5 h-5", `text-${blockType.color}-600`)} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{blockType.label}</h3>
            <p className="text-xs text-gray-500">Block Settings</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Size Settings */}
          <div>
            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
              Size & Position
            </Label>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Width (columns)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={block.width}
                    onChange={(e) => onUpdateBlock({ width: parseInt(e.target.value) || 1 })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Height (rows)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={block.height}
                    onChange={(e) => onUpdateBlock({ height: parseInt(e.target.value) || 1 })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Column</Label>
                  <Input
                    type="number"
                    min={0}
                    max={11}
                    value={block.x}
                    onChange={(e) => onUpdateBlock({ x: parseInt(e.target.value) || 0 })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">Row</Label>
                  <Input
                    type="number"
                    min={0}
                    max={11}
                    value={block.y}
                    onChange={(e) => onUpdateBlock({ y: parseInt(e.target.value) || 0 })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Block-specific settings */}
          {block.type === 'tasks' && (
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                Tasks Settings
              </Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Show completed tasks</Label>
                    <p className="text-xs text-gray-500">Display tasks that are done</p>
                  </div>
                  <Switch
                    checked={block.settings.showCompleted as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('showCompleted', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Group by category</Label>
                    <p className="text-xs text-gray-500">Organize tasks by type</p>
                  </div>
                  <Switch
                    checked={block.settings.groupByCategory as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('groupByCategory', checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'status' && (
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                Status Settings
              </Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Show progress bar</Label>
                    <p className="text-xs text-gray-500">Visual completion indicator</p>
                  </div>
                  <Switch
                    checked={block.settings.showProgress as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('showProgress', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Show stage name</Label>
                    <p className="text-xs text-gray-500">Display current workflow stage</p>
                  </div>
                  <Switch
                    checked={block.settings.showStage as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('showStage', checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'timeline' && (
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                Timeline Settings
              </Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Maximum events</Label>
                  <Input
                    type="number"
                    min={3}
                    max={50}
                    value={(block.settings.maxEvents as number) ?? 10}
                    onChange={(e) => updateSettings('maxEvents', parseInt(e.target.value) || 10)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Show timestamps</Label>
                    <p className="text-xs text-gray-500">Display date and time</p>
                  </div>
                  <Switch
                    checked={block.settings.showTimestamps as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('showTimestamps', checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'messages' && (
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                Messages Settings
              </Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Allow file uploads</Label>
                    <p className="text-xs text-gray-500">Applicants can send files</p>
                  </div>
                  <Switch
                    checked={block.settings.allowFileUpload as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('allowFileUpload', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Email notifications</Label>
                    <p className="text-xs text-gray-500">Notify on new messages</p>
                  </div>
                  <Switch
                    checked={block.settings.emailNotifications as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('emailNotifications', checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'documents' && (
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                Documents Settings
              </Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Max file size (MB)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={(block.settings.maxFileSize as number) ?? 10}
                    onChange={(e) => updateSettings('maxFileSize', parseInt(e.target.value) || 10)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Allow multiple uploads</Label>
                    <p className="text-xs text-gray-500">Upload multiple files at once</p>
                  </div>
                  <Switch
                    checked={block.settings.allowMultiple as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('allowMultiple', checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'recommendations' && (
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                Recommendations Settings
              </Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Max suggestions</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={(block.settings.maxSuggestions as number) ?? 5}
                    onChange={(e) => updateSettings('maxSuggestions', parseInt(e.target.value) || 5)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Show AI badge</Label>
                    <p className="text-xs text-gray-500">Indicate AI-generated content</p>
                  </div>
                  <Switch
                    checked={block.settings.showAIBadge as boolean ?? true}
                    onCheckedChange={(checked) => updateSettings('showAIBadge', checked)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
