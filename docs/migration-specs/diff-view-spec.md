// Diff View: VersionDiff.tsx - Side-by-side or inline diff view
interface VersionDiffProps {
  rowId: string
  version1: number
  version2: number
}

// Renders as:
// ┌─────────────────────────────────────────┐
// │ Changes from v4 → v5                    │
// ├─────────────────────────────────────────┤
// │ Email                                   │
// │ ┌─────────────────────────────────────┐ │
// │ │ - old@example.com                   │ │
// │ │ + new@example.com                   │ │
// │ └─────────────────────────────────────┘ │
// │                                         │
// │ Activities (Repeater)                   │
// │ ┌─────────────────────────────────────┐ │
// │ │ ➖ Removed: Chess Club              │ │
// │ │ ➕ Added: Science Olympiad          │ │
// │ └─────────────────────────────────────┘ │
// └─────────────────────────────────────────┘