'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Circle, Users, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useIsConnected,
  useCurrentUser,
  useCollaborators,
  useSectionCollaborators,
  useBlockCollaborator,
  type Collaborator 
} from '@/lib/collaboration/collaboration-store';

// ============================================================================
// Presence Header - Shows in the toolbar area
// Uses Zustand selectors directly - each selector only triggers re-render
// when its specific slice of state changes
// ============================================================================

interface PresenceHeaderProps {
  className?: string;
}

export function PresenceHeader({ className }: PresenceHeaderProps) {
  // Each of these hooks only re-renders this component when their specific value changes
  const isConnected = useIsConnected();
  const currentUser = useCurrentUser();
  const collaborators = useCollaborators();
  
  const totalUsers = collaborators.length + (currentUser ? 1 : 0);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Connection status indicator */}
      <div className="flex items-center gap-1.5">
        <Circle 
          className={cn(
            "w-2 h-2 transition-colors",
            isConnected 
              ? "fill-green-500 text-green-500" 
              : "fill-amber-500 text-amber-500 animate-pulse"
          )} 
        />
        <span className="text-xs text-gray-500">
          {isConnected ? 'Live' : 'Connecting...'}
        </span>
      </div>

      {/* User avatars */}
      {totalUsers > 0 && (
        <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-200 rounded-full shadow-sm cursor-default">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          
          {/* Avatar stack */}
          <div className="flex -space-x-2">
            {/* Current user first */}
            {currentUser && (
              <div
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-medium text-white overflow-hidden ring-2 ring-blue-400"
                style={{ backgroundColor: '#3B82F6' }}
                title="You"
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="You" className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0).toUpperCase()
                )}
              </div>
            )}
            
            {/* Other collaborators */}
            {collaborators.slice(0, 3).map((user) => (
              <div
                key={user.id}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-medium text-white overflow-hidden"
                style={{ backgroundColor: user.avatarUrl ? 'transparent' : user.color }}
                title={user.name}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
            ))}
            
            {/* Overflow indicator */}
            {collaborators.length > 3 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">
                +{collaborators.length - 3}
              </div>
            )}
          </div>
          
          {/* Count */}
          <span className="text-xs text-gray-500 tabular-nums">
            {totalUsers}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Collaborator Avatar
// ============================================================================

interface CollaboratorAvatarProps {
  user: Collaborator;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

export function CollaboratorAvatar({ user, size = 'sm', showStatus = false }: CollaboratorAvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "rounded-full border-2 border-white flex items-center justify-center font-medium text-white overflow-hidden",
          sizeClasses[size]
        )}
        style={{ backgroundColor: user.avatarUrl ? 'transparent' : user.color }}
        title={user.name}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          user.name.charAt(0).toUpperCase()
        )}
      </div>
      
      {/* Typing/editing indicator */}
      {showStatus && user.isTyping && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-white rounded-full flex items-center justify-center">
          <Edit3 className="w-2 h-2 text-blue-500 animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Collaborator List (Tooltip content)
// ============================================================================

interface CollaboratorListProps {
  collaborators: Collaborator[];
  currentUser: { id: string; name: string; avatarUrl?: string } | null;
}

function CollaboratorList({ collaborators, currentUser }: CollaboratorListProps) {
  return (
    <div className="py-2 min-w-[200px]">
      <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
        Collaborators
      </div>
      
      {/* Current user */}
      {currentUser && (
        <div className="px-3 py-2 flex items-center gap-3 hover:bg-gray-50">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white overflow-hidden ring-2 ring-blue-400"
            style={{ backgroundColor: '#3B82F6' }}
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="You" className="w-full h-full object-cover" />
            ) : (
              currentUser.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{currentUser.name}</div>
            <div className="text-xs text-blue-600">You</div>
          </div>
        </div>
      )}
      
      {/* Separator */}
      {currentUser && collaborators.length > 0 && (
        <div className="my-1 border-t border-gray-100" />
      )}
      
      {/* Other collaborators */}
      {collaborators.map((user) => (
        <div key={user.id} className="px-3 py-2 flex items-center gap-3 hover:bg-gray-50">
          <CollaboratorAvatar user={user} size="md" showStatus />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
            {user.currentSectionTitle && (
              <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: user.color }} />
                {user.currentSectionTitle}
              </div>
            )}
            {!user.currentSectionTitle && user.isTyping && (
              <div className="text-xs text-blue-500">Typing...</div>
            )}
          </div>
        </div>
      ))}
      
      {collaborators.length === 0 && !currentUser && (
        <div className="px-3 py-4 text-center text-sm text-gray-500">
          No one else is here
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Cursor Overlay - Shows other users' cursors
// ============================================================================

interface CursorOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export function CursorOverlay({ containerRef }: CursorOverlayProps) {
  const collaborators = useCollaborators();
  const [containerBounds, setContainerBounds] = useState<DOMRect | null>(null);
  
  // Update container bounds on resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateBounds = () => {
      if (containerRef.current) {
        setContainerBounds(containerRef.current.getBoundingClientRect());
      }
    };
    
    updateBounds();
    window.addEventListener('resize', updateBounds);
    
    return () => window.removeEventListener('resize', updateBounds);
  }, [containerRef]);
  
  if (!containerBounds) return null;
  
  // Filter to only show cursors that are within reasonable time
  const activeCursors = collaborators.filter(
    (c) => c.cursor && (Date.now() - (c.cursor.timestamp || 0)) < 5000
  );
  
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <AnimatePresence>
        {activeCursors.map((user) => {
          if (!user.cursor) return null;
          
          // Adjust cursor position relative to viewport
          const x = user.cursor.x;
          const y = user.cursor.y;
          
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
              className="absolute"
              style={{
                left: x,
                top: y,
                transform: 'translate(-2px, -2px)',
              }}
            >
              {/* Cursor pointer */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-md"
              >
                <path
                  d="M5.65376 12.4563L5.65376 5.65377L12.4563 12.4563H8.65376L5.65376 12.4563Z"
                  fill={user.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
              
              {/* Name label */}
              <div
                className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap shadow-md"
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Section Indicator - Shows who's editing which section
// Uses useSectionCollaborators - only re-renders when collaborators in THIS section change
// ============================================================================

interface SectionCollaboratorIndicatorProps {
  sectionId: string;
  className?: string;
}

export function SectionCollaboratorIndicator({ sectionId, className }: SectionCollaboratorIndicatorProps) {
  // This hook only re-renders when collaborators in this specific section change
  const sectionCollaborators = useSectionCollaborators(sectionId);
  
  if (sectionCollaborators.length === 0) return null;
  
  return (
    <div className={cn("flex -space-x-1.5", className)}>
      {sectionCollaborators.slice(0, 3).map((user) => (
        <div
          key={user.id}
          className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-medium text-white overflow-hidden cursor-default"
          style={{ backgroundColor: user.avatarUrl ? 'transparent' : user.color }}
          title={`${user.name} is editing`}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
      ))}
      {sectionCollaborators.length > 3 && (
        <div className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[8px] font-medium text-gray-600">
          +{sectionCollaborators.length - 3}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Block Collaborator Ring - Shows colored ring around blocks being edited
// Uses useBlockCollaborator - only re-renders when THIS block's collaborator changes
// ============================================================================

interface BlockCollaboratorRingProps {
  blockId: string;
  children: React.ReactNode;
}

export function BlockCollaboratorRing({ blockId, children }: BlockCollaboratorRingProps) {
  // This hook only re-renders when someone starts/stops editing this specific block
  const editingUser = useBlockCollaborator(blockId);
  
  if (!editingUser) return <>{children}</>;
  
  return (
    <div className="relative">
      <div 
        className="absolute -inset-1 rounded-lg pointer-events-none animate-pulse"
        style={{ 
          border: `2px solid ${editingUser.color}`,
          boxShadow: `0 0 8px ${editingUser.color}40`
        }}
      />
      <div 
        className="absolute -top-3 left-2 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: editingUser.color }}
      >
        {editingUser.name}
      </div>
      {children}
    </div>
  );
}
