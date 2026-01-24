'use client';

import { useState, useEffect } from 'react';
import { Search, Download, MoreHorizontal, Mail, Filter, SlidersHorizontal, Grid3X3, List, Eye, Trash2, Edit, UserPlus, X } from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Badge } from '@/ui-components/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/ui-components/avatar';
import { Skeleton } from '@/ui-components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui-components/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/ui-components/dropdown-menu';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/ui-components/resizable';
import { ScrollArea } from '@/ui-components/scroll-area';
import { Separator } from '@/ui-components/separator';
import { Checkbox } from '@/ui-components/checkbox';
import { adminClient, BetterAuthUser } from '@/lib/api/admin-client';
import { toast } from 'sonner';
import { cn } from '@/ui-components/utils';

interface Contact {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  avatar?: string;
  initials: string;
  type?: string;
  lastSignIn?: string;
  updatedAt?: string;
  raw?: BetterAuthUser;
}

interface CRMPageProps {
  workspaceId: string;
}

export function CRMPage({ workspaceId }: CRMPageProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    
    const load = async () => {
      try {
        setLoading(true);
        const users = await adminClient.listBetterAuthUsers();
        
        if (!mounted || !users || !Array.isArray(users)) {
          setContacts([]);
          return;
        }
        
        const data: Contact[] = users.map((u: BetterAuthUser) => {
          const name = u.full_name || u.name || u.email.split('@')[0];
          const parts = name.split(' ');
          const initials = parts.length > 1 
            ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
            : name.charAt(0).toUpperCase();
          
          return {
            id: u.id,
            name,
            email: u.email,
            status: 'Active',
            createdAt: new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            avatar: u.avatar_url,
            initials,
            type: u.user_type,
            lastSignIn: u.last_sign_in_at,
            updatedAt: u.updated_at,
            raw: u,
          };
        });
        
        setContacts(data);
      } catch (e: any) {
        if (!mounted) return;
        if (e.status === 401) {
          toast.error('Please sign in again');
        } else if (!e.message?.includes('Admin access')) {
          toast.error('Failed to load data');
        }
        setContacts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [workspaceId]);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.type?.toLowerCase().includes(q);
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const viewDetails = (contact: Contact) => {
    setSelected(contact);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelected(null);
  };

  const typeColor = (type?: string) => {
    const colors: Record<string, string> = {
      staff: 'bg-violet-100 text-violet-700',
      applicant: 'bg-sky-100 text-sky-700',
      reviewer: 'bg-amber-100 text-amber-700',
    };
    return colors[type || ''] || 'bg-muted text-muted-foreground';
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-background">
      {/* Action Bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 pt-2 pb-2 border-b bg-muted/50">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground">
            <List className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground">
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-5 mx-1" />
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm bg-background"
          />
        </div>

        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
          <Filter className="w-4 h-4" />
          Filter
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Sort
        </Button>

        <div className="flex-1" />

        <span className="text-xs text-muted-foreground">{filtered.length} records</span>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Download className="w-4 h-4 text-muted-foreground" />
        </Button>
        <Button size="sm" className="h-8 gap-1.5">
          <UserPlus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {/* Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
          <Button variant="ghost" size="sm" className="h-7 text-primary hover:bg-primary/20">
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Email
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-primary hover:bg-primary/20">
            <Edit className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table & Details Panel */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={showDetails ? 60 : 100} minSize={40}>
          <ScrollArea className="h-full">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Search className="w-10 h-10 mb-3 stroke-1" />
                <p className="text-sm">No results found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-4">
                      <Checkbox 
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-[280px] text-xs font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground w-24">Type</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground w-28 text-right">Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow 
                  key={contact.id} 
                  className={cn(
                    "group cursor-pointer",
                    selectedIds.has(contact.id) && "bg-primary/10"
                  )}
                  onClick={() => viewDetails(contact)}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={contact.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs">
                          {contact.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground text-sm">{contact.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{contact.email}</TableCell>
                  <TableCell>
                    {contact.type && (
                      <Badge variant="secondary" className={cn("text-xs font-normal", typeColor(contact.type))}>
                        {contact.type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground text-right">{contact.createdAt}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => viewDetails(contact)}>
                          <Eye className="w-3.5 h-3.5 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="w-3.5 h-3.5 mr-2" />
                          Email
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="w-3.5 h-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            )}
          </ScrollArea>
        </ResizablePanel>

        {/* Details Panel */}
        {showDetails && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={25} maxSize={50}>
              <div className="h-full flex flex-col border-l bg-background">
                {selected && (
                  <>
                    <div className="p-4 pb-3 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={selected.avatar} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-base">
                            {selected.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h2 className="text-base font-semibold text-foreground truncate">{selected.name}</h2>
                          <p className="text-sm text-muted-foreground truncate">{selected.email}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                            {selected.type && (
                              <Badge variant="secondary" className={cn("text-xs", typeColor(selected.type))}>
                                {selected.type}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={closeDetails}>
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>

                    <Separator />

                    <div className="flex gap-2 p-3">
                      <Button variant="outline" size="sm" className="flex-1 h-8">
                        <Mail className="w-3.5 h-3.5 mr-1.5" />
                        Email
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8">
                        <Edit className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                    </div>

                    <Separator />

                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Created</p>
                            <p className="text-sm text-foreground">{formatDate(selected.raw?.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Last Sign In</p>
                            <p className="text-sm text-foreground">{formatDate(selected.lastSignIn)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Updated</p>
                            <p className="text-sm text-foreground">{formatDate(selected.updatedAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Type</p>
                            <p className="text-sm text-foreground capitalize">{selected.type || '—'}</p>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-xs text-muted-foreground mb-1">ID</p>
                          <p className="text-xs text-muted-foreground font-mono break-all">{selected.id}</p>
                        </div>
                      </div>
                    </ScrollArea>
                  </>
                )}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
