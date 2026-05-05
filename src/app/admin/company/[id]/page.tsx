'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  Building,
  CalendarDays,
  Package,
  TrendingUp,
  ShoppingBag,
  Edit,
  Trash2,
  Eye,
  Share2,
} from 'lucide-react'

interface Company {
  id: string
  company_name: string
  email: string
  phone_number: string
  address: string
  franchise_id: string | null
  companyLogo: string | null
  created_at: string | null
  franchise_name?: string | null
}

interface CompanyOrderRow {
  id: string
  order_name: string | null
  customer_name: string | null
  order_date: string | null
  delivery_date: string | null
  status: string | null
  deliveryStatus: string | null
  cases: number | null
}

interface Customer {
  id: string
  company_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  delivery_address: string | null
  delivery_zone: string | number | null
  delivery_zone_name?: string | null
  notes: string | null
  created_at: string | null
}

interface DeliveryZone {
  id: string
  zone_name: string
  description: string | null
  status: string
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    customers: 0,
    orders: 0,
    casesThisMonth: 0,
    recentOrders: 0,
  })
  const [orders, setOrders] = useState<CompanyOrderRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
  const [zoneMap, setZoneMap] = useState<Map<string | number, string>>(new Map())
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)
  const [viewCustomerDialogOpen, setViewCustomerDialogOpen] = useState(false)
  const [editCustomerDialogOpen, setEditCustomerDialogOpen] = useState(false)
  const [deleteCustomerDialogOpen, setDeleteCustomerDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({})
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  useEffect(() => {
    if (!params?.id) return

    const loadData = async () => {
      try {
        setIsLoading(true)

        const companyId = params.id

        // Fetch company details
        const { data: companyData, error: companyError } = await supabase
          .from('company')
          .select('id, company_name, email, phone_number, address, franchise_id, companyLogo, created_at')
          .eq('id', companyId)
          .maybeSingle()

        if (companyError) {
          console.error('Error fetching company:', companyError)
          toast.error('Failed to load company details')
          return
        } else if (companyData) {
          // Fetch franchise name if franchise_id exists
          let franchiseName = null
          if (companyData.franchise_id) {
            const { data: franchiseData } = await supabase
              .from('franchises')
              .select('franchise_name')
              .eq('id', companyData.franchise_id)
              .maybeSingle()
            franchiseName = franchiseData?.franchise_name || null
          }

          setCompany({
            ...companyData,
            franchise_name: franchiseName,
          } as Company)
        }

        // Fetch customers for this company (by company_name)
        const { data: companyDataForQuery } = await supabase
          .from('company')
          .select('company_name')
          .eq('id', companyId)
          .maybeSingle()

        if (!companyDataForQuery) {
          setIsLoading(false)
          return
        }

        const companyName = companyDataForQuery.company_name

        // Fetch customers with this company_name
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('id, company_name, first_name, last_name, email, phone, delivery_address, delivery_zone, notes, created_at')
          .eq('company_name', companyName)
          .order('created_at', { ascending: false })

        if (customersError) {
          console.error('Error fetching customers:', customersError)
        }

        // Fetch delivery zones for mapping
        const { data: zonesData, error: zonesError } = await supabase
          .from('delivery_zones')
          .select('id, zone_name, status')
          .eq('status', 'Active')

        const zoneMapping = new Map<string | number, string>()
        if (!zonesError && zonesData) {
          setDeliveryZones(zonesData as DeliveryZone[])
          zonesData.forEach((zone) => {
            zoneMapping.set(zone.id, zone.zone_name)
          })
          setZoneMap(zoneMapping)
        }

        // Map customers with zone names
        const customersWithZoneNames = (customersData || []).map((customer: any) => {
          const zoneName = customer.delivery_zone && zoneMapping.has(customer.delivery_zone)
            ? zoneMapping.get(customer.delivery_zone)
            : null
          return {
            ...customer,
            delivery_zone_name: zoneName,
          }
        })
        setCustomers(customersWithZoneNames as Customer[])

        // Fetch orders for customers of this company
        const customerIds = customersWithZoneNames.map((c: any) => c.id)
        
        let ordersData: any[] = []
        if (customerIds.length > 0) {
          const { data: ordersResult, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_name, order_date, delivery_date, status, deliveryStatus, quantity, customer_id')
            .in('customer_id', customerIds)
            .order('order_date', { ascending: false })

          if (ordersError) {
            console.error('Error fetching orders:', ordersError)
          } else {
            ordersData = ordersResult || []
          }
        }

        // Create customer map for quick lookup
        const customerMap = new Map<string, string>()
        customersWithZoneNames.forEach((c: any) => {
          if (c.id) {
            customerMap.set(c.id, c.company_name || 'Customer')
          }
        })

        // Calculate statistics
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        let casesThisMonth = 0
        ordersData.forEach((order) => {
          if (order.quantity && order.quantity > 0 && order.delivery_date) {
            const d = new Date(order.delivery_date)
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
              casesThisMonth += order.quantity
            }
          }
        })

        const lastFiveOrders = [...ordersData]
          .sort((a, b) => {
            const da = a.order_date ? new Date(a.order_date).getTime() : 0
            const db = b.order_date ? new Date(b.order_date).getTime() : 0
            return db - da
          })
          .slice(0, 5)

        setStats({
          customers: customersWithZoneNames.length,
          orders: ordersData.length,
          casesThisMonth,
          recentOrders: lastFiveOrders.length,
        })

        const orderRows: CompanyOrderRow[] = lastFiveOrders.map((order) => ({
          id: order.id,
          order_name: order.order_name,
          order_date: order.order_date,
          delivery_date: order.delivery_date,
          status: order.status,
          deliveryStatus: (order as any).deliveryStatus || order.status || null,
          customer_name: order.customer_id ? customerMap.get(order.customer_id) || null : null,
          cases: order.quantity ?? null,
        }))

        setOrders(orderRows)
      } catch (error) {
        console.error('Error loading company detail:', error)
        toast.error('Failed to load company details')
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [params?.id])

  const formatDate = (value: string | null) => {
    if (!value) return '-'
    try {
      return new Date(value).toISOString().slice(0, 10)
    } catch {
      return value
    }
  }

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setViewCustomerDialogOpen(true)
  }

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setCustomerForm({
      company_name: customer.company_name,
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      delivery_address: customer.delivery_address || '',
      delivery_zone: customer.delivery_zone || null,
      notes: customer.notes || '',
    })
    setEditCustomerDialogOpen(true)
  }

  const handleDeleteCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setDeleteCustomerDialogOpen(true)
  }

  const handleSaveCustomer = async () => {
    if (!selectedCustomer) return

    try {
      const { error } = await supabase
        .from('customers')
        .update({
          company_name: customerForm.company_name,
          first_name: customerForm.first_name,
          last_name: customerForm.last_name,
          email: customerForm.email,
          phone: customerForm.phone,
          delivery_address: customerForm.delivery_address || null,
          delivery_zone: customerForm.delivery_zone || null,
          notes: customerForm.notes || null,
        })
        .eq('id', selectedCustomer.id)

      if (error) {
        toast.error('Failed to update customer')
        console.error('Update error:', error)
        return
      }

      toast.success('Customer updated successfully')
      setEditCustomerDialogOpen(false)
      setSelectedCustomer(null)
      setCustomerForm({})

      // Reload data
      if (params?.id) {
        const { data: companyDataForQuery } = await supabase
          .from('company')
          .select('company_name')
          .eq('id', params.id)
          .maybeSingle()

        if (companyDataForQuery) {
          const { data: zonesData } = await supabase
            .from('delivery_zones')
            .select('id, zone_name, status')
            .eq('status', 'Active')

          const zoneMapping = new Map<string | number, string>()
          if (zonesData) {
            zonesData.forEach((zone) => {
              zoneMapping.set(zone.id, zone.zone_name)
            })
            setZoneMap(zoneMapping)
          }

          const { data: reloadedCustomersData } = await supabase
            .from('customers')
            .select('id, company_name, first_name, last_name, email, phone, delivery_address, delivery_zone, notes, created_at')
            .eq('company_name', companyDataForQuery.company_name)
            .order('created_at', { ascending: false })

          const customersWithZoneNames = (reloadedCustomersData || []).map((customer: any) => {
            const zoneName = customer.delivery_zone && zoneMapping.has(customer.delivery_zone)
              ? zoneMapping.get(customer.delivery_zone)
              : null
            return {
              ...customer,
              delivery_zone_name: zoneName,
            }
          })
          setCustomers(customersWithZoneNames as Customer[])
        }
      }
    } catch (error) {
      toast.error('Failed to update customer')
      console.error('Update error:', error)
    }
  }

  const handleConfirmDeleteCustomer = async () => {
    if (!selectedCustomer) return

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', selectedCustomer.id)

      if (error) {
        toast.error('Failed to delete customer')
        console.error('Delete error:', error)
        return
      }

      toast.success('Customer deleted successfully')
      setDeleteCustomerDialogOpen(false)
      setSelectedCustomer(null)

      // Reload data
      if (params?.id) {
        const { data: companyDataForQuery } = await supabase
          .from('company')
          .select('company_name')
          .eq('id', params.id)
          .maybeSingle()

        if (companyDataForQuery) {
          const { data: zonesData } = await supabase
            .from('delivery_zones')
            .select('id, zone_name, status')
            .eq('status', 'Active')

          const zoneMapping = new Map<string | number, string>()
          if (zonesData) {
            zonesData.forEach((zone) => {
              zoneMapping.set(zone.id, zone.zone_name)
            })
            setZoneMap(zoneMapping)
          }

          const { data: reloadedCustomersData } = await supabase
            .from('customers')
            .select('id, company_name, first_name, last_name, email, phone, delivery_address, delivery_zone, notes, created_at')
            .eq('company_name', companyDataForQuery.company_name)
            .order('created_at', { ascending: false })

          const customersWithZoneNames = (reloadedCustomersData || []).map((customer: any) => {
            const zoneName = customer.delivery_zone && zoneMapping.has(customer.delivery_zone)
              ? zoneMapping.get(customer.delivery_zone)
              : null
            return {
              ...customer,
              delivery_zone_name: zoneName,
            }
          })
          setCustomers(customersWithZoneNames as Customer[])
        }
      }
    } catch (error) {
      toast.error('Failed to delete customer')
      console.error('Delete error:', error)
    }
  }

  if (isLoading || !company) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/company')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Companies
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading company details...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header / Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {company.companyLogo && (
            <button
              type="button"
              onClick={() => setLogoDialogOpen(true)}
              className="flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
            >
              <img
                src={company.companyLogo}
                alt={`${company.company_name} logo`}
                className="h-16 w-16 rounded-full object-cover border-2 border-slate-200 shadow-sm"
              />
            </button>
          )}
          <div>
            <button
              type="button"
              className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-primary"
              onClick={() => router.push('/admin/company')}
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to Companies
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">{company.company_name}</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive company overview and order history
            </p>
          </div>
        </div>
        <Badge variant="outline" className="px-3 py-1 text-xs">
          {company.franchise_name || 'Super Admin'}
        </Badge>
      </div>

      {/* Logo Preview Dialog */}
      {company.companyLogo && (
        <Dialog open={logoDialogOpen} onOpenChange={setLogoDialogOpen}>
          <DialogContent className="max-w-2xl p-0">
            <div className="relative">
              <img
                src={company.companyLogo}
                alt={`${company.company_name} logo`}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Company Information */}
      <Card>
        <CardHeader className="border-b bg-muted/40 py-3">
          <CardTitle className="text-sm font-semibold">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 py-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building className="h-3 w-3" />
              <span>Company Name</span>
            </div>
            <p className="text-sm font-medium">{company.company_name}</p>
          </div>

          {/* <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>Phone</span>
            </div>
            <p className="text-sm font-medium">{company.phone_number}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span>Email</span>
            </div>
            <p className="text-sm font-medium">{company.email}</p>
          </div> */}

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Address</span>
            </div>
            <p className="text-sm font-medium">{company.address}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>Registration Date</span>
            </div>
            <p className="text-sm font-medium">
              {formatDate(company.created_at)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building className="h-3 w-3" />
              <span>Franchise</span>
            </div>
            <p className="text-sm font-medium">
              {company.franchise_name || 'Super Admin'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Company Stats */}
      <Card>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm font-semibold">Company Statistics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 py-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Customers</p>
                <p className="mt-1 text-2xl font-semibold">{stats.customers}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="mt-1 text-2xl font-semibold">{stats.orders}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Package className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Cases Sold This Month</p>
                <p className="mt-1 text-2xl font-semibold">{stats.casesThisMonth.toLocaleString()}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Recent Orders</p>
                <p className="mt-1 text-2xl font-semibold">{stats.recentOrders}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Customers & Orders */}
      <Card>
        <CardHeader className="border-b py-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Company Data</CardTitle>
              <CardDescription>Customers and orders for this company</CardDescription>
            </div>
            <Button onClick={() => { setInviteDialogOpen(true) }}>
              <Share2 className="h-4 w-4 mr-2" />
              Invite Customer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="customers" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
              <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="customers" className="mt-4">
              <div className="overflow-x-auto rounded-b-xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Delivery Zone</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          No customers found for this company.
                        </TableCell>
                      </TableRow>
                    )}
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="text-sm font-medium">
                          {customer.company_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {customer.first_name} {customer.last_name}
                        </TableCell>
                        <TableCell className="text-sm">{customer.email}</TableCell>
                        <TableCell className="text-sm">{customer.phone}</TableCell>
                        <TableCell className="text-sm">
                          {customer.delivery_zone_name || customer.delivery_zone || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewCustomer(customer)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {/* <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setInviteDialogOpen(true) }}
                              className="h-8 w-8 p-0"
                            >
                              <Share2 className="h-4 w-4" />
                            </Button> */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCustomer(customer)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCustomer(customer)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <div className="overflow-x-auto rounded-b-xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cases</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          No recent orders for this company.
                        </TableCell>
                      </TableRow>
                    )}
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-sm font-medium">
                          {order.order_name || `ORD-${order.id}`}
                        </TableCell>
                        <TableCell className="text-sm">{order.customer_name || '-'}</TableCell>
                        <TableCell className="text-sm">{formatDate(order.order_date)}</TableCell>
                        <TableCell className="text-sm">
                          {order.deliveryStatus ? (
                            <Badge
                              variant={order.deliveryStatus.toLowerCase() === 'delivered' ? 'default' : 'outline'}
                              className="rounded-full px-3 py-1 text-xs"
                            >
                              {order.deliveryStatus}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {order.cases != null ? `${order.cases} Cases` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Customer</DialogTitle>
            <DialogDescription>Generate and share signup link</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={company ? `coconutapp://signup?company_id=${company.id}&franchise_id=${company.franchise_id || ''}` : ''}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const link = company ? `coconutapp://signup?company_id=${company.id}&franchise_id=${company.franchise_id || ''}` : ''
                    if (!link) return
                    navigator.clipboard?.writeText(link)
                    toast.success('Link copied')
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            {/* <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const link = company ? `coconutapp://signup?company_id=${company.id}&franchise_id=${company.franchise_id || ''}` : ''
                  if (!link) return
                  const text = encodeURIComponent(`Signup link:\n${link}`)
                  window.open(`https://wa.me/?text=${text}`, '_blank')
                }}
              >
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const link = company ? `coconutapp://signup?company_id=${company.id}&franchise_id=${company.franchise_id || ''}` : ''
                  if (!link) return
                  const subject = encodeURIComponent('CoconutApp Signup')
                  const body = encodeURIComponent(`Please sign up using the link below:\n\n${link}`)
                  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
                }}
              >
                Email
              </Button>
            </div> */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Customer Dialog */}
      <Dialog open={viewCustomerDialogOpen} onOpenChange={setViewCustomerDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>View customer information</DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company Name</Label>
                  <p className="text-sm font-medium">{selectedCustomer.company_name}</p>
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <p className="text-sm font-medium">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm font-medium">{selectedCustomer.email}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="text-sm font-medium">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <Label>Delivery Zone</Label>
                  <p className="text-sm font-medium">{selectedCustomer.delivery_zone_name || selectedCustomer.delivery_zone || '-'}</p>
                </div>
                <div>
                  <Label>Created At</Label>
                  <p className="text-sm font-medium">{formatDate(selectedCustomer.created_at)}</p>
                </div>
              </div>
              {selectedCustomer.delivery_address && (
                <div>
                  <Label>Delivery Address</Label>
                  <p className="text-sm font-medium">{selectedCustomer.delivery_address}</p>
                </div>
              )}
              {selectedCustomer.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm font-medium whitespace-pre-wrap">{selectedCustomer.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewCustomerDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setViewCustomerDialogOpen(false)
              if (selectedCustomer) handleEditCustomer(selectedCustomer)
            }}>
              Edit Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editCustomerDialogOpen} onOpenChange={setEditCustomerDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={customerForm.company_name || ''}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={customerForm.first_name || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={customerForm.last_name || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, last_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerForm.email || ''}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={customerForm.phone || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="delivery_zone">Delivery Zone</Label>
                <Input
                  id="delivery_zone"
                  value={selectedCustomer?.delivery_zone_name || '-'}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="delivery_address">Delivery Address</Label>
              <Textarea
                id="delivery_address"
                value={customerForm.delivery_address || ''}
                onChange={(e) => setCustomerForm({ ...customerForm, delivery_address: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={customerForm.notes || ''}
                onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditCustomerDialogOpen(false)
              setSelectedCustomer(null)
              setCustomerForm({})
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomer}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Dialog */}
      <AlertDialog open={deleteCustomerDialogOpen} onOpenChange={setDeleteCustomerDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCustomer?.company_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteCustomerDialogOpen(false)
              setSelectedCustomer(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteCustomer}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
