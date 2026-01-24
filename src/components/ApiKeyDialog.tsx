'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Key, Copy, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Badge } from '@/ui-components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import { Loader2 } from 'lucide-react'

interface ApiKey {
  id: string
  name: string | null
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
  key?: string
}

interface ApiKeyDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ApiKeyDialog({ isOpen, onClose }: ApiKeyDialogProps) {
  const [loading, setLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [keyName, setKeyName] = useState('')

  const loadApiKeys = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/api-keys')
      if (!response.ok) {
        throw new Error('Failed to load API keys')
      }
      const keys = await response.json()
      setApiKeys(keys)
    } catch (error) {
      console.error('Failed to load API keys:', error)
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadApiKeys()
    }
  }, [isOpen, loadApiKeys])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName || null }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create API key')
      }

      const newKey = await response.json()
      setNewlyCreatedKey(newKey.key ?? null)
      setApiKeys((prev) => [newKey, ...prev])
      setShowCreateForm(false)
      setKeyName('')
      toast.success('API key created successfully')
    } catch (error) {
      console.error('Failed to create API key:', error)
      toast.error('Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (keyId: string) => {
    setDeleting(keyId)
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete API key')
      }

      setApiKeys((prev) => prev.filter((k) => k.id !== keyId))
      toast.success('API key deleted')
    } catch (error) {
      console.error('Failed to delete API key:', error)
      toast.error('Failed to delete API key')
    } finally {
      setDeleting(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </DialogTitle>
          <DialogDescription>
            Manage API keys for webhook authentication and API access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Newly created key warning */}
          {newlyCreatedKey && (
            <Card className="border-yellow-500/50 bg-yellow-500/10">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <p className="font-medium text-sm text-yellow-600 dark:text-yellow-400">
                    Copy your API key now. You won't be able to see it again!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-xs">
                      {newlyCreatedKey}
                    </code>
                    <Button
                      onClick={() => copyToClipboard(newlyCreatedKey)}
                      size="sm"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => setNewlyCreatedKey(null)}
                    size="sm"
                    variant="ghost"
                    className="w-full"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create API Key Form */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Create New API Key</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Name (optional)</Label>
                  <Input
                    id="keyName"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g., Production, Testing, Webhooks"
                    disabled={creating}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={creating}
                    size="sm"
                  >
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Key
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCreateForm(false)
                      setKeyName('')
                    }}
                    variant="ghost"
                    size="sm"
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* API Keys List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Your API Keys</h3>
              {!showCreateForm && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Key
                </Button>
              )}
            </div>

            <ScrollArea className="h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Key className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No API keys yet</p>
                  <p className="text-xs">Create your first API key to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((apiKey, index) => (
                    <div key={apiKey.id}>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                              {apiKey.keyPrefix}...
                            </code>
                            {apiKey.name && (
                              <Badge variant="secondary" className="text-xs">
                                {apiKey.name}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-muted-foreground text-xs">
                            Created {formatDate(apiKey.createdAt)}
                            {apiKey.lastUsedAt &&
                              ` · Last used ${formatDate(apiKey.lastUsedAt)}`}
                          </p>
                        </div>
                        <Button
                          disabled={deleting === apiKey.id}
                          onClick={() => handleDelete(apiKey.id)}
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                        >
                          {deleting === apiKey.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {index < apiKeys.length - 1 && <Separator className="my-2" />}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}