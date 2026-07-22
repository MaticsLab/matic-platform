'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

// ============================================================================
// FLOATING ADD BUTTON - Shows on hover between blocks
//
// NOTE: not currently invoked anywhere — preserved as dead code from the
// original BlockEditor.tsx. Not wired up; out of scope to do so.
// ============================================================================

interface FloatingAddButtonProps {
  position: { top: number; left: number };
  onClick: () => void;
}

export function FloatingAddButton({ position, onClick }: FloatingAddButtonProps) {
  return createPortal(
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={onClick}
      className="fixed z-50 w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
      style={{ top: position.top - 14, left: position.left }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <Plus className="w-4 h-4" />
    </motion.button>,
    document.body
  );
}
