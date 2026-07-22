'use client'

import { Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
}

/**
 * Generic "upgrade to Pro" prompt used to gate Premium page types (Payment,
 * Scheduling) in the Add a page menu. There's no real plan/entitlement check
 * wired up yet, so this always opens rather than silently blocking the click.
 */
export function UpgradeModal({ open, onOpenChange, title, description }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-lg bg-[#EEEDFE] flex items-center justify-center mb-2">
            <Sparkles className="w-5 h-5 text-[#534AB7]" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            <a href="/pricing">Upgrade to Pro</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
