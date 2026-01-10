'use client';

import { useState, useEffect } from 'react';
import { Search, List, Download, Plus, ChevronDown, MoreVertical, HelpCircle } from 'lucide-react';
import { Button } from '@/ui-components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu';
import { adminClient, BetterAuthUser } from '@/lib/api/admin-client';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Inactive';
  creationDate: string;
  avatar?: string;
  avatarInitial?: string;
}

interface CRMPageProps {
  workspaceId: string;
}

export function CRMPage({ workspaceId }: CRMPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Better Auth users from portals
  useEffect(() => {
    let isMounted = true;
    
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 [CRM] Fetching portal applicants...');
        
        // Make the API call directly to see the raw response
        const baseUrl = typeof window !== 'undefined' 
          ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8080/api/v1'
            : 'https://backend.maticslab.com/api/v1'
          : 'https://backend.maticslab.com/api/v1';
        
        const response = await fetch(`${baseUrl}/admin/users?type=better_auth`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('📡 [CRM] Response status:', response.status, response.statusText);
        console.log('📡 [CRM] Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [CRM] API error:', response.status, errorText);
          throw new Error(`Failed to fetch: ${response.status} ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log('📦 [CRM] Raw response text:', responseText);
        
        const users = responseText ? JSON.parse(responseText) : null;
        console.log('📦 [CRM] Parsed response:', users);
        console.log('📦 [CRM] Response type:', typeof users, 'Is array:', Array.isArray(users));
        
        if (!isMounted) return; // Prevent state updates if component unmounted
        
        // Handle null or undefined response
        if (!users || !Array.isArray(users)) {
          console.warn('⚠️ [CRM] Invalid response format:', users);
          setClients([]);
          setIsLoading(false);
          return;
        }
        
        console.log(`✅ [CRM] Processing ${users.length} portal applicants`);
        
        // Transform Better Auth users to Client format
        const clientsData: Client[] = users.map((user: BetterAuthUser) => {
          const name = user.full_name || user.name || user.email.split('@')[0];
          const nameParts = name.split(' ');
          const initial = nameParts.length > 1 
            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
            : name.charAt(0).toUpperCase();
          
          const createdDate = new Date(user.created_at);
          const formattedDate = createdDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
          
          // Determine status based on last sign in (if available) or default to Active
          const status: 'Active' | 'Inactive' = user.last_sign_in_at 
            ? 'Active' 
            : 'Active'; // Default to Active for Better Auth users
          
          return {
            id: user.id,
            name,
            email: user.email,
            status,
            creationDate: formattedDate,
            avatar: user.avatar_url || undefined,
            avatarInitial: initial,
          };
        });
        
        setClients(clientsData);
      } catch (error: any) {
        if (!isMounted) return; // Prevent toast if component unmounted
        
        console.error('❌ [CRM] Failed to load portal applicants:', error);
        console.error('❌ [CRM] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          response: error.response,
        });
        
        // Only show toast for actual errors, not if it's just "Admin access required" from old server
        const errorMessage = error.message || 'Failed to load clients';
        if (!errorMessage.includes('Admin access required')) {
          toast.error(errorMessage);
        }
        setClients([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadUsers();
    
    return () => {
      isMounted = false; // Cleanup to prevent state updates after unmount
    };
  }, [workspaceId]);

  const getStatusColor = (status: 'Active' | 'Inactive') => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-2xl font-semibold text-gray-900">CRM</h1>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Search className="w-4 h-4" />
            Search
          </Button>
          
          <Button variant="outline" size="sm" className="gap-2">
            <List className="w-4 h-4" />
            View
          </Button>
          
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Create
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>New Client</DropdownMenuItem>
              <DropdownMenuItem>Import Clients</DropdownMenuItem>
              <DropdownMenuItem>Bulk Create</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading clients...</div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    Status
                    <HelpCircle className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creation date
                  <span className="ml-1">↓</span>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  {/* Actions column */}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {client.avatar ? (
                        <img
                          src={client.avatar}
                          alt={client.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-sm">
                          {client.avatarInitial || client.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {client.name}
                        </div>
                        <div className="text-sm text-gray-500">{client.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {client.creationDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
