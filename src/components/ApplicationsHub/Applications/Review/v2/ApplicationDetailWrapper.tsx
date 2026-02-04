'use client';

import { useEffect, useState } from 'react';
import { ApplicationDetail } from './ApplicationDetail';
import { Application, ApplicationDetailProps } from './types';
import { createPortal } from 'react-dom';

interface ApplicationDetailWrapperProps extends Omit<ApplicationDetailProps, 'application'> {
  application: Application;
  isInSidePanel?: boolean;
}

export function ApplicationDetailWrapper({
  application,
  isInSidePanel = false,
  ...props
}: ApplicationDetailWrapperProps) {
  const [viewMode, setViewMode] = useState<'modal' | 'fullscreen' | 'sidebar'>('sidebar');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If we're in sidebar/side panel mode, render normally
  if (viewMode === 'sidebar' || !mounted) {
    return (
      <ApplicationDetail
        application={application}
        {...props}
      />
    );
  }

  // For modal and fullscreen modes, use portal to render outside the side panel
  const modalContent = (
    <div className={`
      ${viewMode === 'modal' ? 'fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50' : ''}
      ${viewMode === 'fullscreen' ? 'fixed inset-0 z-[70]' : ''}
    `}>
      {viewMode === 'modal' && (
        <div 
          className="absolute inset-0" 
          onClick={() => {
            // Close modal when clicking backdrop
            setViewMode('sidebar');
          }}
        />
      )}
      <div className={`
        ${viewMode === 'modal' ? 'relative max-w-6xl w-full h-[90vh] bg-white rounded-lg shadow-2xl' : ''}
        ${viewMode === 'fullscreen' ? 'w-full h-full' : ''}
      `}>
        <ApplicationDetail
          application={application}
          {...props}
        />
      </div>
    </div>
  );

  // Find or create portal root
  let portalRoot = document.getElementById('modal-portal-root');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.id = 'modal-portal-root';
    portalRoot.className = 'fixed inset-0 pointer-events-none z-[70]';
    document.body.appendChild(portalRoot);
  }

  return createPortal(modalContent, portalRoot);
}