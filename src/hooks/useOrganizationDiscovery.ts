"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { organizationsClient, type Organization } from '@/lib/api/organizations-client'
import { useSession } from '@/lib/better-auth-client'

interface OrganizationWithWorkspaces extends Organization {
  workspaces?: Array<{
    id: string
    name: string
    slug: string
    color?: string
    icon?: string
  }>
}

export function useOrganizationDiscovery() {
  const [organizations, setOrganizations] = useState<OrganizationWithWorkspaces[]>([])
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationWithWorkspaces | null>(null)
  const [loading, setLoading] = useState(true)
  const { data, isPending: authLoading } = useSession()
  const user = data?.user || null
  const isAuthenticated = !!user
  
  // Track if we've already fetched to prevent infinite loops
  const hasFetchedRef = useRef(false)

  const fetchOrganizations = useCallback(async () => {
    try {
      console.log('🔍 Fetching organizations for user')
      
      // Fetch from Go backend (uses auth context internally)
      const apiOrganizations = await organizationsClient.list()
      
      console.log('✅ Organizations loaded:', apiOrganizations)
      setOrganizations(apiOrganizations || [])
      
      return apiOrganizations || []
    } catch (error) {
      console.error('❌ Error fetching organizations:', error)
      setOrganizations([])
      return []
    }
  }, [])

  useEffect(() => {
    const loadOrganizations = async () => {
      // Wait for auth to finish loading
      if (authLoading) return
      
      // Prevent duplicate fetches
      if (hasFetchedRef.current) return
      
      if (isAuthenticated) {
        hasFetchedRef.current = true
        const loaded = await fetchOrganizations()
        
        // Set first organization as current if none selected
        if (loaded.length > 0 && !currentOrganization) {
          setCurrentOrganization(loaded[0])
          // Store in localStorage
          localStorage.setItem('lastOrganization', JSON.stringify(loaded[0]))
        }
      }
      setLoading(false)
    }

    loadOrganizations()
  }, [authLoading, isAuthenticated, fetchOrganizations, currentOrganization])

  // Load from localStorage on mount
  useEffect(() => {
    if (!currentOrganization && organizations.length > 0) {
      const lastOrgJson = localStorage.getItem('lastOrganization')
      if (lastOrgJson) {
        try {
          const lastOrg = JSON.parse(lastOrgJson)
          const found = organizations.find(o => o.id === lastOrg.id)
          if (found) {
            setCurrentOrganization(found)
            return
          }
        } catch (e) {
          console.error('Failed to parse last organization:', e)
        }
      }
      // Fallback to first organization
      if (organizations.length > 0) {
        setCurrentOrganization(organizations[0])
      }
    }
  }, [organizations, currentOrganization])

  const switchToOrganization = (organizationId: string) => {
    console.log('🔄 Switching to organization:', organizationId)
    const org = organizations.find(o => o.id === organizationId)
    if (org) {
      setCurrentOrganization(org)
      localStorage.setItem('lastOrganization', JSON.stringify(org))
    }
  }

  const setCurrentOrganizationById = (id: string) => {
    const org = organizations.find(o => o.id === id)
    if (org) {
      console.log('✅ Setting current organization:', org)
      setCurrentOrganization(org)
      localStorage.setItem('lastOrganization', JSON.stringify(org))
    } else {
      console.log('⚠️ Organization not found with id:', id, 'Available organizations:', organizations)
    }
  }

  return {
    organizations,
    currentOrganization,
    loading: loading || authLoading,
    user,
    fetchOrganizations,
    switchToOrganization,
    setCurrentOrganizationById,
  }
}

