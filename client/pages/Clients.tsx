import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  RefreshCw,
  Phone,
  MapPin,
  FileText,
  Building,
} from 'lucide-react';
import { clientAPI, eventAPI, leadsAPI } from '@/lib/api';

interface Client {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstNumber: string;
}

const initialFormData: ClientFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  gstNumber: '',
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [leadStatuses, setLeadStatuses] = useState<Record<string, 'hot' | 'cold' | null>>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
      };
      
      const response = await clientAPI.getAll(params);
      setClients(response.data.clients || []);
      setPagination(response.data.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
      });
    } catch (error: any) {
      console.error('Fetch clients error:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [pagination.page, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Client name is required');
      return;
    }

    if (!formData.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    // Validate phone number (10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.error('Please enter a valid 10-digit Indian phone number');
      return;
    }

    // Validate email if provided
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address');
        return;
      }
    }

    // Validate GST number format if provided
    if (formData.gstNumber && formData.gstNumber.trim()) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(formData.gstNumber.toUpperCase())) {
        toast.error('Please enter a valid GST number (15 characters)');
        return;
      }
    }

    const clientData: any = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
    };

    // Only include optional fields if they have values
    if (formData.email && formData.email.trim()) {
      clientData.email = formData.email.trim();
    }

    if (formData.address && formData.address.trim()) {
      clientData.address = formData.address.trim();
    }

    if (formData.gstNumber && formData.gstNumber.trim()) {
      clientData.gstNumber = formData.gstNumber.toUpperCase();
    }

    try {
      if (editingClient) {
        await clientAPI.update(editingClient._id, clientData);
        toast.success('Client updated successfully');
      } else {
        await clientAPI.create(clientData);
        toast.success('Client created successfully');
      }
      
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setEditingClient(null);
      fetchClients();
    } catch (error: any) {
      console.error('Save client error:', error);
      if (error.response?.status === 409) {
        toast.error('A client with this phone number already exists');
      } else if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.error || 'Invalid data provided';
        toast.error(`Validation error: ${errorMessage}`);
      } else {
        toast.error(error.response?.data?.error || 'Failed to save client');
      }
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      gstNumber: client.gstNumber || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await clientAPI.delete(id);
      toast.success('Client deleted successfully');
      fetchClients();
    } catch (error: any) {
      console.error('Delete client error:', error);
      if (error.response?.status === 409) {
        toast.error('Cannot delete client. There are invoices associated with this client.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to delete client');
      }
    }
  };

  const resetDialog = () => {
    setIsDialogOpen(false);
    setFormData(initialFormData);
    setEditingClient(null);
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.length === 10) {
      return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
    }
    return phone;
  };

  const handleLeadStatus = async (clientId: string, status: 'hot' | 'cold') => {
    try {
      await leadsAPI.updateStatusByClient(clientId, status);
      setLeadStatuses((prev) => ({ ...prev, [clientId]: status }));
      toast.success(`Marked as ${status.toUpperCase()}`);
    } catch (error: any) {
      console.error('Update lead status error:', error);
      toast.error(error.response?.data?.error || 'Failed to update lead');
    }
  };

  const handleGoToAgreement = async (client: Client) => {
    try {
      // Try to find an event for this client
      const res = await eventAPI.getAll({ clientId: client._id, limit: 1 });
      const existing = res.data?.events?.[0];
      if (existing?._id) {
        window.location.href = `/admin/events/${existing._id}/agreement`;
        return;
      }
      // Create draft event
      const today = new Date().toISOString().slice(0,10);
      const payload = {
        name: `${client.name} Event`,
        clientId: client._id,
        dateFrom: today,
        dateTo: today,
        notes: 'Draft',
      };
      const created = await eventAPI.create(payload);
      const id = created.data?._id;
      if (id) {
        window.location.href = `/admin/events/${id}/agreement`;
      } else {
        toast.error('Failed to create draft event');
      }
    } catch (e: any) {
      console.error('Go to agreement error:', e);
      toast.error(e.response?.data?.error || 'Failed to open T&C');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600">Manage your customers and their contact information</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </DialogTitle>
              <DialogDescription>
                {editingClient 
                  ? 'Update the client information below.'
                  : 'Enter the details for the new client.'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="name">Client Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter client name"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: value });
                    }}
                    placeholder="Enter 10-digit phone number"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Enter 10-digit Indian mobile number (without +91)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email address (optional)"
                  />
                </div>
                
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter client address (optional)"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="gstNumber">GST Number</Label>
                  <Input
                    id="gstNumber"
                    value={formData.gstNumber}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().slice(0, 15);
                      setFormData({ ...formData, gstNumber: value });
                    }}
                    placeholder="Enter 15-digit GST number (optional)"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Format: 22AAAAA0000A1Z5 (15 characters)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingClient ? 'Update Client' : 'Add Client'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or GST number..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Button variant="outline" onClick={fetchClients}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clients ({pagination.total})
          </CardTitle>
          <CardDescription>
            Manage your customer database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No clients found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search criteria.'
                  : 'Get started by adding your first client.'
                }
              </p>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Client
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>GST Number</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{client.name}</div>
                            {client.email && (
                              <div className="text-sm text-gray-500">{client.email}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{formatPhoneNumber(client.phone)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.address ? (
                          <div className="flex items-start gap-1">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                            <span className="text-sm max-w-xs">{client.address}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {client.gstNumber ? (
                          <div className="flex items-center gap-1">
                            <Building className="h-4 w-4 text-gray-400" />
                            <span className="font-mono text-sm">{client.gstNumber}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(client.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={leadStatuses[client._id] === 'hot' ? 'bg-green-600 text-white hover:bg-green-700' : ''}
                            onClick={() => handleLeadStatus(client._id, 'hot')}
                          >
                            Hot Lead
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={leadStatuses[client._id] === 'cold' ? 'bg-red-600 text-white hover:bg-red-700' : ''}
                            onClick={() => handleLeadStatus(client._id, 'cold')}
                          >
                            Cold Lead
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleGoToAgreement(client)}
                          >
                            Terms & Conditions
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(client)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Client</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{client.name}"? This action cannot be undone.
                                  {client.gstNumber && (
                                    <div className="mt-2 text-amber-600">
                                      ⚠️ This client has a GST number and may have associated invoices.
                                    </div>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(client._id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} clients
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === pagination.pages}
                      onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
