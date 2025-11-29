//UI Components for History: History Panel (Figma-style)

HistoryPanel.tsx - Shows version history with diffs
interface HistoryPanelProps {
  rowId: string
  tableId: string
  onRestore: (version: number) => void
}

// Renders as:
// ┌─────────────────────────────────────────┐
// │ History                          [×]    │
// ├─────────────────────────────────────────┤
// │ ● Current (v5)                          │
// │   Today at 2:34 PM by John              │
// │   Updated: email, phone                 │
// │   [View Changes] [Restore ▾]            │
// │                                         │
// │ ○ Version 4                             │
// │   Yesterday at 11:20 AM by Jane         │
// │   Updated: activities (removed 1 item)  │
// │   [View Changes] [Restore]              │
// │                                         │
// │ ○ Version 3                             │
// │   Nov 25 at 9:00 AM by AI Assistant     │
// │   Corrected: email format               │
// │   🤖 AI-assisted edit                   │
// │   [View Changes] [Restore]              │
// │                                         │
// │ ○ Version 1 (Created)                   │
// │   Nov 24 at 3:00 PM via Portal          │
// │   [View Snapshot]                       │
// └─────────────────────────────────────────┘