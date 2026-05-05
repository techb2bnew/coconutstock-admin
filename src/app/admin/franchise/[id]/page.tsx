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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  User,
  CalendarDays,
  Package,
  TrendingUp,
  ShoppingBag,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface Franchise {
  id: string
  franchise_name: string
  location_zone: string
  address: string
  owner_first_name: string
  owner_last_name: string
  owner_email: string
  owner_phone: string
  logo: string | null
  contract_start_date: string | null
  created_at: string | null
  updated_at: string | null
}

interface FranchiseOrderRow {
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

export default function FranchiseDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [franchise, setFranchise] = useState<Franchise | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    customers: 0,
    orders: 0,
    casesThisMonth: 0,
    recentOrders: 0,
  })
  const [orders, setOrders] = useState<FranchiseOrderRow[]>([])
  const [allOrders, setAllOrders] = useState<FranchiseOrderRow[]>([]) // Store all orders for pagination
  const [customers, setCustomers] = useState<Customer[]>([])
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
  const [zoneMap, setZoneMap] = useState<Map<string | number, string>>(new Map())
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)
  const [viewCustomerDialogOpen, setViewCustomerDialogOpen] = useState(false)
  const [editCustomerDialogOpen, setEditCustomerDialogOpen] = useState(false)
  const [deleteCustomerDialogOpen, setDeleteCustomerDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10) // Number of orders per page

  useEffect(() => {
    if (!params?.id) return

    const loadData = async () => {
      try {
        setIsLoading(true)

        const franchiseId = params.id

        // Fetch franchise details
        const { data: franchiseData, error: franchiseError } = await supabase
          .from('franchises')
          .select(
            'id, franchise_name, location_zone, address, owner_first_name, owner_last_name, owner_email, owner_phone, logo, contract_start_date, created_at, updated_at',
          )
          .eq('id', franchiseId)
          .maybeSingle()

        if (franchiseError) {
          console.error('Error fetching franchise:', franchiseError)
        } else if (franchiseData) {
          setFranchise(franchiseData as Franchise)
        }

        // Fetch statistics (requires franchise_id columns in related tables)
        const [customersResult, ordersResult] = await Promise.all([
          supabase.from('customers').select('id, franchise_id, company_name').eq('franchise_id', franchiseId),
          supabase
            .from('orders')
            .select('id, order_name, order_date, delivery_date, status, deliveryStatus, quantity, franchise_id, customer_id')
            .eq('franchise_id', franchiseId),
        ])

        const customersData = (customersResult.data || []) as { id: string; company_name: string | null }[]
        const ordersData =
          (ordersResult.data || []) as {
            id: string
            order_name: string | null
            order_date: string | null
            delivery_date: string | null
            status: string | null
            deliveryStatus: string | null
            quantity: number | null
            customer_id: string | null
          }[]

        // Map customer id -> name for quick lookup
        const customerMap = new Map<string, string>()
        customersData.forEach((c) => {
          if (c.id) {
            customerMap.set(c.id, c.company_name || 'Customer')
          }
        })

        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        let casesThisMonth = 0
        let recentOrders = 0

        // Sort all orders by date (newest first)
        const sortedOrders = [...ordersData].sort((a, b) => {
          const da = a.order_date ? new Date(a.order_date).getTime() : 0
          const db = b.order_date ? new Date(b.order_date).getTime() : 0
          return db - da
        })

        ordersData.forEach((order) => {
          if (order.quantity && order.quantity > 0 && order.delivery_date) {
            const d = new Date(order.delivery_date)
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
              casesThisMonth += order.quantity
            }
          }
        })

        recentOrders = Math.min(5, ordersData.length)

        setStats({
          customers: customersData.length,
          orders: ordersData.length,
          casesThisMonth,
          recentOrders,
        })

        // Map all orders (not just 5)
        const allOrderRows: FranchiseOrderRow[] = sortedOrders.map((order) => ({
          id: order.id,
          order_name: order.order_name,
          order_date: order.order_date,
          delivery_date: order.delivery_date,
          status: order.status,
          deliveryStatus: order.deliveryStatus || order.status, // Use deliveryStatus if available, fallback to status
          customer_name: order.customer_id ? customerMap.get(order.customer_id) || null : null,
          cases: order.quantity ?? null,
        }))

        setAllOrders(allOrderRows)
        // Set initial paginated orders
        setOrders(allOrderRows.slice(0, itemsPerPage))

        // Fetch delivery zones for mapping
        const { data: zonesData, error: zonesError } = await supabase
          .from('delivery_zones')
          .select('id, zone_name, status')
          .eq('status', 'Active')

        // Create a map of zone_id -> zone_name (declare outside if block)
        const zoneMapping = new Map<string | number, string>()
        if (!zonesError && zonesData) {
          setDeliveryZones(zonesData as DeliveryZone[])
          zonesData.forEach((zone) => {
            zoneMapping.set(zone.id, zone.zone_name)
          })
          setZoneMap(zoneMapping)
        }

        // Fetch customers for this franchise
        const { data: franchiseCustomersData, error: customersError } = await supabase
          .from('customers')
          .select('id, company_name, first_name, last_name, email, phone, delivery_address, delivery_zone, notes, created_at')
          .eq('franchise_id', franchiseId)
          .order('created_at', { ascending: false })

        if (customersError) {
          console.error('Error fetching customers:', customersError)
        } else {
          // Map delivery_zone IDs to zone names using the zoneMapping from above
          const customersWithZoneNames = (franchiseCustomersData || []).map((customer: any) => {
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
      } catch (error) {
        console.error('Error loading franchise detail:', error)
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

  // Get status color based on delivery status
  const getStatusColor = (status: string | null): string => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-300'
    
    const statusLower = status.toLowerCase()
    const statusColors: Record<string, string> = {
      'processing': 'bg-blue-100 text-blue-800 border-blue-300',
      'pending payment': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'driver assigned': 'bg-cyan-100 text-cyan-800 border-cyan-300',
      'dispatched': 'bg-blue-700 text-white border-blue-800',
      'in transit': 'bg-indigo-100 text-indigo-800 border-indigo-300',
      'completed': 'bg-green-100 text-green-800 border-green-300',
      'closed / paid': 'bg-green-700 text-white border-green-800',
      'undelivered': 'bg-red-100 text-red-800 border-red-300',
      'cancelled': 'bg-red-700 text-white border-red-800',
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'delivered': 'bg-green-100 text-green-800 border-green-300',
    }
    
    return statusColors[statusLower] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  // Format status text - capitalize first letter of each word
  const formatStatusText = (status: string | null): string => {
    if (!status) return 'Pending'
    return status
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Pagination logic
  const totalPages = Math.ceil(allOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOrders = allOrders.slice(startIndex, endIndex)

  // Update displayed orders when page changes
  useEffect(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    setOrders(allOrders.slice(start, end))
  }, [currentPage, allOrders, itemsPerPage])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      // Scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

      // Reload data - fetch zones first, then customers
      if (params?.id) {
        // Fetch delivery zones for mapping
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
          .eq('franchise_id', params.id)
          .order('created_at', { ascending: false })
        
        // Map delivery_zone IDs to zone names
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

      // Reload data - fetch zones first, then customers
      if (params?.id) {
        // Fetch delivery zones for mapping
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
          .eq('franchise_id', params.id)
          .order('created_at', { ascending: false })
        
        // Map delivery_zone IDs to zone names
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
    } catch (error) {
      toast.error('Failed to delete customer')
      console.error('Delete error:', error)
    }
  }

  if (isLoading || !franchise) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/franchise')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Franchises
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading franchise details...
          </CardContent>
        </Card>
      </div>
    )
  }

  const ownerFullName = `${franchise.owner_first_name} ${franchise.owner_last_name}`.trim()

  return (
    <div className="space-y-6">
      {/* Header / Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {franchise.logo && (
            <button
              type="button"
              onClick={() => setLogoDialogOpen(true)}
              className="flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
            >
              <img
                src={franchise.logo}
                alt={`${franchise.franchise_name} logo`}
                className="h-16 w-16 rounded-full object-cover border-2 border-slate-200 shadow-sm"
              />
            </button>
          )}
          <div>
            <button
              type="button"
              className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-primary"
              onClick={() => router.push('/admin/franchise')}
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to Franchises
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">{franchise.franchise_name}</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive franchise overview and order history
            </p>
          </div>
        </div>
        <Badge variant="outline" className="px-3 py-1 text-xs">
          Active
        </Badge>
      </div>

      {/* Logo Preview Dialog */}
      {franchise.logo && (
        <Dialog open={logoDialogOpen} onOpenChange={setLogoDialogOpen}>
          <DialogContent className="max-w-2xl p-0">
            <div className="relative">
              <img
                src={franchise.logo}
                alt={`${franchise.franchise_name} logo`}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Owner Information */}
      <Card>
        <CardHeader className="border-b bg-muted/40 py-3">
          <CardTitle className="text-sm font-semibold">Owner Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 py-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Owner Name</span>
            </div>
            <p className="text-sm font-medium">{ownerFullName}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>Phone</span>
            </div>
            <p className="text-sm font-medium">{franchise.owner_phone}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span>Email</span>
            </div>
            <p className="text-sm font-medium">{franchise.owner_email}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Location</span>
            </div>
            <p className="text-sm font-medium">{franchise.location_zone}</p>
            <p className="text-xs text-muted-foreground">{franchise.address}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>Registration Date</span>
            </div>
            <p className="text-sm font-medium">
              {formatDate(franchise.contract_start_date || franchise.created_at)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>Last Activity</span>
            </div>
            <p className="text-sm font-medium">{formatDate(franchise.updated_at)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Franchise Stats */}
      <Card>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm font-semibold">Franchise Statistics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 py-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Customers</p>
                <p className="mt-1 text-2xl font-semibold">{stats.customers}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
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

      {/* Franchise Customers & Orders */}
      <Card>
        <CardHeader className="border-b py-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Franchise Data</CardTitle>
              <CardDescription>Customers and orders for this franchise</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
              <TabsTrigger value="orders">Orders ({allOrders.length})</TabsTrigger>
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
                          No customers found for this franchise.
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
              <div className="space-y-4">
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
                      {paginatedOrders.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-6 text-center text-sm text-muted-foreground"
                          >
                            No orders found for this franchise.
                          </TableCell>
                        </TableRow>
                      )}
                      {paginatedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="text-sm font-medium">
                            {order.order_name || `ORD-${order.id}`}
                          </TableCell>
                          <TableCell className="text-sm">{order.customer_name || '-'}</TableCell>
                          <TableCell className="text-sm">{formatDate(order.order_date)}</TableCell> 
                          <TableCell className="text-sm">
                            {order.deliveryStatus !== null ? (
                              <Badge
                                className={`rounded-full px-3 py-1 text-xs border ${getStatusColor(order.deliveryStatus)}`}
                              >
                                {formatStatusText(order.deliveryStatus)}
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
                
                {/* Pagination Controls */}
                {allOrders.length > itemsPerPage && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {startIndex + 1} to {Math.min(endIndex, allOrders.length)} of {allOrders.length} orders
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // Show first page, last page, current page, and pages around current
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <Button
                                key={page}
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className="h-8 w-8 p-0"
                              >
                                {page}
                              </Button>
                            )
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <span key={page} className="px-2 text-sm text-muted-foreground">
                                ...
                              </span>
                            )
                          }
                          return null
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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


