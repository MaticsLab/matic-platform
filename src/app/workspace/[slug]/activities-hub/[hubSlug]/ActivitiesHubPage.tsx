'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getActivitiesHubBySlug } from '@/lib/api/activities-hubs-client';
import { ActivityDetailPanel } from '@/components/ActivitiesHub/ActivityDetailPanel';
import type { ActivitiesHubWithTabs } from '@/types/activities-hubs';

interface ActivitiesHubPageProps {
  workspaceId: string;
  hubSlug: string;
}

export function ActivitiesHubPage({ workspaceId, hubSlug }: ActivitiesHubPageProps) {
  const router = useRouter();
  const [hub, setHub] = useState<ActivitiesHubWithTabs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHub();
  }, [workspaceId, hubSlug]);

  const loadHub = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getActivitiesHubBySlug(workspaceId, hubSlug);
      setHub(data);
    } catch (err) {
      console.error('Error loading activity hub:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleDeleted = () => {
    router.push(`/workspace/${workspaceId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading activity...</div>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Activity not found</h3>
          <p className="text-gray-500 mb-4">{error || 'The activity you\'re looking for doesn\'t exist.'}</p>
          <button
            onClick={() => router.back()}
            className="text-violet-600 hover:text-violet-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const handleUpdated = (updatedActivity: ActivitiesHubWithTabs) => {
    setHub(updatedActivity);
  };

  return (
    <div className="h-full">
      <ActivityDetailPanel
        activity={hub}
        onClose={handleClose}
        onDeleted={handleDeleted}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
