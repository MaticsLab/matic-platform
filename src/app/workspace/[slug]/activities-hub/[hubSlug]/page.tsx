'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { WorkspaceTabProvider } from '@/components/WorkspaceTabProvider';
import { NavigationLayout } from '@/components/NavigationLayout';
import { ActivitiesHubPage } from './ActivitiesHubPage';
import { workspacesSupabase } from '@/lib/api/workspaces-supabase';
import type { Workspace } from '@/types/workspaces';

export default function Page() {
  const params = useParams();
  const slug = params.slug as string;
  const hubSlug = params.hubSlug as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspace();
  }, [slug]);

  async function loadWorkspace() {
    try {
      setLoading(true);
      const data = await workspacesSupabase.getWorkspaceBySlug(slug);
      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500">Loading workspace...</div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Workspace Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'Not Found'}</p>
          <a href="/signup-v2?mode=login" className="text-blue-600 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceTabProvider workspaceId={workspace.id}>
      <NavigationLayout workspaceSlug={slug}>
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading activity...</div>
          </div>
        }>
          <ActivitiesHubPage 
            workspaceId={workspace.id}
            hubSlug={hubSlug}
          />
        </Suspense>
      </NavigationLayout>
    </WorkspaceTabProvider>
  );
}
