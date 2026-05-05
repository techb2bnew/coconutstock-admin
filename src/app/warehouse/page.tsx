'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  Clock,
  CheckCircle2,
  Truck,
  Eye,
  FileText,
  UserPlus,
  MapPin,
  Grid3x3,
  List,
  Download,
  ArrowUpDown,
  LogOut,
  Package,
  Bell,
  Printer,
  X,
  Camera,
  Box,
  Loader2,
  GripVertical,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDndMonitor,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ensureStaffFcmRegistered } from '@/lib/registerFcm'

interface Order {
  id: number
  order_name: string | null
  logo: string | null
  special_event_logo: string | null
  customer_id: number | null
  customer_details?: any | null  
  po_number: string | null
  order_date: string | null
  delivery_date: string | null
  delivery_day_date: string | null
  deliveryStatus: string | null
  driver_id: number | null
  driver_name?: string | null
  quantity: number | null
  delivery_address: string | null
  special_instructions: string | null
  notes: string | null
  stop_number: number | null
  stop_number_position: number | null
  franchise_id: string | null
  created_at: string | null
  unable_to_deliver_reason: string | null
  status_change_count: number | null
}

interface Customer {
  id: number
  company_name: string
  first_name: string
  last_name: string
  delivery_zone?: string | number | null
  company_id?: string | null
}

interface Company {
  id: string
  company_name: string
  companyLogo?: string | null
}

interface QuantityBasedRule {
  id: string
  min_quantity: number
  max_quantity: number
  delivery_offset: number // Days
  status: string
}

interface ZoneDeliveryRule {
  id: string
  zone_id: string
  cutoff_time: string | null
  next_day_offset: number
  after_cutoff_offset: number
  status: string
}

function isFutureOrderDate(utcDateString: string | null): boolean {
  if (!utcDateString) return false
  try {
    const date = new Date(utcDateString)
    if (isNaN(date.getTime())) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const orderDate = new Date(date)
    orderDate.setHours(0, 0, 0, 0)

    return orderDate.getTime() > today.getTime()
  } catch {
    return false
  }
}

/** Warehouse: cannot move to shipped-type statuses without a driver */
function hasDriverAssignedForStatus(order: Pick<Order, 'driver_id'>): boolean {
  const id = order.driver_id
  return id != null && id !== 0 && String(id).trim() !== ''
}

// Register FCM token for warehouse staff on page mount
if (typeof window !== 'undefined') {
  // Fire and forget; internal function verifies role & status
  ensureStaffFcmRegistered()
}
interface Driver {
  id: number
  driver_name: string
  phone_number: string
  email: string
  status: string
}

// Sortable Order Item Component
interface SortableOrderItemProps {
  order: Order
  customer: Customer | undefined
  deliveryTag: { text: string; color: string; bgColor: string; value: string } | null
  statusLower: string
  isPending: boolean
  isReady: boolean
  isDispatched: boolean
  borderColor: string
  isNew: boolean
  isUndelivered: boolean
  statusFilter: string
  selectedOrders: Set<number>
  editingStopNumber: number | null
  stopNumberValue: string
  onSelectOrder: (id: number) => void
  onStatusChange: (id: number, status: string) => void
  onDeliveryTimeChange: (id: number, time: string) => void
  onStopNumberChange: (id: number, value: string) => void
  onSetEditingStopNumber: (id: number | null) => void
  onSetStopNumberValue: (value: string) => void
  onViewOrder: (id: number) => void
  onOpenNotes: (id: number) => void
  onAssignDriver: (id: number) => void
  onMarkReady: (id: number) => void
  onSetStopNumber: (id: number) => void
  onMarkDispatched: (id: number) => void
  getStatusColor: (status: string | null) => string
  formatStatusText: (status: string | null) => string
  formatLocalDateTime: (date: string | null) => string
  getDriverInfo: (id: number | null) => Driver | null
  companyLogoMap: Map<string, string>
}

function SortableOrderItem({
  order,
  customer,
  deliveryTag,
  statusLower,
  isPending,
  isReady,
  isDispatched,
  borderColor,
  isNew,
  isUndelivered,
  statusFilter,
  selectedOrders,
  editingStopNumber,
  stopNumberValue,
  onSelectOrder,
  onStatusChange,
  onDeliveryTimeChange,
  onStopNumberChange,
  onSetEditingStopNumber,
  onSetStopNumberValue,
  onViewOrder,
  onOpenNotes,
  onAssignDriver,
  onMarkReady,
  onSetStopNumber,
  onMarkDispatched,
  getStatusColor,
  formatStatusText,
  formatLocalDateTime,
  getDriverInfo,
  companyLogoMap,
}: SortableOrderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
                  className={`bg-white rounded-lg shadow-sm ${isNew && statusFilter === 'Today Orders' ? 'border-2 border-red-500' : isUndelivered && statusFilter === 'Today Orders' ? 'border-2 border-orange-500' : `border-l-4 ${borderColor} border border-gray-200`} hover:shadow-md transition-shadow ${isDragging ? 'cursor-grabbing' : ''} relative`}
    >
      {isNew && statusFilter === 'Today Orders' && (
        <div className="absolute top-[-13px] left-[20px] bg-red-500 text-white px-3 py-1.5 flex items-center gap-1.5   rounded-lg shadow-md z-10">
          <Bell className="h-3.5 w-3.5" />
          <span className="font-semibold text-xs uppercase tracking-wide">NEW ORDER</span>
        </div>
      )}
      {isUndelivered && statusFilter === 'Today Orders' && (
        <div className="absolute top-[-13px] left-[20px] bg-orange-500 text-white px-3 py-1.5 flex items-center gap-1.5   rounded-lg shadow-md z-10">
          <Package className="h-3.5 w-3.5" />
          <span className="font-semibold text-xs uppercase tracking-wide">UNDELIVERED</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          {/* Checkbox */}
          <div className="flex-shrink-0 w-4">
            <input
              type="checkbox"
              checked={selectedOrders.has(order.id)}
              onChange={() => onSelectOrder(order.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
          </div>

          {/* Order Image */}
          <div className="w-12 h-12 rounded overflow-hidden border border-gray-200 flex-shrink-0">
            {(order.special_event_logo || order.logo || (customer?.company_id && companyLogoMap.get(customer.company_id))) ? (
              <img
                src={order.special_event_logo || order.logo || (customer?.company_id ? companyLogoMap.get(customer.company_id) || '' : '')}
                alt={order.order_name || 'Order'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-center">
                <span className="text-gray-400 text-xs">No Image</span>
              </div>
            )}
          </div>

          {/* Order ID & Customer */}
          <div className="flex-shrink-0 w-[130px]">
            <p className="font-semibold text-sm text-gray-900 leading-tight">{order.order_name}</p>
          
          </div>
          <div className="flex-shrink-0 w-[100px]">

          {customer && (
              <div className="mt-0.5">
                <p className="font-medium text-xs text-gray-700 leading-tight">Customer</p>
                <p className="font-medium text-xs text-gray-900 leading-tight">{customer.company_name}</p>
                <p className="text-xs text-gray-600 leading-tight">{customer.first_name} {customer.last_name}</p>
              </div>
            )}
          </div>

          {/* Order Date & Time with Delivery Time Selector */}
          <div className="flex-shrink-0 w-[150px]">
            <p className="font-medium text-xs text-gray-700 leading-tight">Order Date & Time</p>
            <p className="text-xs text-gray-900 mb-1 leading-tight">
              {formatLocalDateTime(order.order_date)}
            </p>
            {deliveryTag && !isFutureOrderDate(order.order_date) && (
              <Select
                value={deliveryTag.value || (deliveryTag.text === 'Same Day' ? 'same-day' : deliveryTag.text === '1 day' ? '1-day' : deliveryTag.text === '2 day' ? '2-day' : '1-day')}
                onValueChange={(value) => onDeliveryTimeChange(order.id, value)}
              >
                <SelectTrigger className={`h-7 text-xs ${deliveryTag.bgColor} border`}>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same-day">Same Day</SelectItem>
                  <SelectItem value="1-day">1 day</SelectItem>
                  <SelectItem value="2-day">2 day</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quantity */}
          <div className="flex-shrink-0 w-[80px]">
            <p className="text-xs text-gray-600 mb-0.5 leading-tight">Quantity:</p>
            <p className="font-medium text-sm text-gray-900 leading-tight">{order.quantity || 0} Cases</p>
          </div> 

          {/* Stop # - Editable Field */}
          <div className="flex-shrink-0 w-[80px]">
            <p className="text-xs text-gray-600 mb-0.5 leading-tight">Stop #:</p>
            {editingStopNumber === order.id ? (
              <Input
                type="number"
                value={stopNumberValue}
                onChange={(e) => onSetStopNumberValue(e.target.value)}
                onBlur={() => {
                  if (stopNumberValue.trim()) {
                    onStopNumberChange(order.id, stopNumberValue)
                  } else {
                    onSetEditingStopNumber(null)
                    onSetStopNumberValue('')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (stopNumberValue.trim()) {
                      onStopNumberChange(order.id, stopNumberValue)
                    } else {
                      onSetEditingStopNumber(null)
                      onSetStopNumberValue('')
                    }
                  } else if (e.key === 'Escape') {
                    onSetEditingStopNumber(null)
                    onSetStopNumberValue('')
                  }
                }}
                className="h-7 text-sm w-full px-2"
                autoFocus
                placeholder="0"
              />
            ) : (
              <p 
                className="font-medium text-sm text-gray-900 cursor-pointer hover:text-blue-600 min-h-[28px] flex items-center leading-tight"
                onClick={() => {
                  onSetEditingStopNumber(order.id)
                  onSetStopNumberValue(order.stop_number?.toString() || '')
                }}
              >
                {order.stop_number || '—'}
              </p>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="flex-shrink-0 w-[160px]">
            {(() => {
              const statusLower = (order.deliveryStatus || '').toLowerCase()
              const isLockedStatus = statusLower === 'completed' || statusLower === 'cancelled'
              const hasDriver = hasDriverAssignedForStatus(order)

              // When order is Completed/Cancelled: show read-only pill, no dropdown
              if (isLockedStatus) {
                return (
                  <div
                    className={`w-full h-8 flex items-center justify-center rounded-md text-sm border ${getStatusColor(order.deliveryStatus)} bg-gray-100 cursor-not-allowed`}
                  >
                    {formatStatusText(order.deliveryStatus)}
                  </div>
                )
              }

              // Normal editable dropdown for other statuses
              return (
                <Select 
                  value={order.deliveryStatus || 'pending'} 
                  onValueChange={(value) => onStatusChange(order.id, value)}
                >
                  <SelectTrigger className={`w-full h-8 text-sm ${getStatusColor(order.deliveryStatus)}`}>
                    <SelectValue>{formatStatusText(order.deliveryStatus)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    {/* Hide "Driver Assigned" as a manual choice; it is set via Assign Driver */}
                    {/* <SelectItem value="driver assigned">Driver Assigned</SelectItem> */}
                    <SelectItem value="dispatched" disabled={!hasDriver}>
                      Dispatched
                    </SelectItem>
                    <SelectItem value="in transit" disabled={!hasDriver}>
                      In Transit
                    </SelectItem>
                    <SelectItem value="completed" disabled={!hasDriver}>
                      Completed
                    </SelectItem>
                    <SelectItem value="undelivered">Undelivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    {/* <SelectItem value="pending payment">Pending Payment</SelectItem>
                    <SelectItem value="closed / paid">Closed / Paid</SelectItem> */}
                  </SelectContent>
                </Select>
              )
            })()}
          </div>

          {/* Action Buttons */}
          <TooltipProvider>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onViewOrder(order.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Details</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onOpenNotes(order.id)}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Notes</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={statusLower === 'completed' || statusLower === 'cancelled'}
                    onClick={() => {
                      if (statusLower === 'completed' || statusLower === 'cancelled') return
                      onAssignDriver(order.id)
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Assign Driver</p>
                </TooltipContent>
              </Tooltip>
               
              {isReady && (
                <>
               
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => onMarkDispatched(order.id)}
                      >
                        <Truck className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Mark as Dispatched</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

export default function WarehousePage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyLogoMap, setCompanyLogoMap] = useState<Map<string, string>>(new Map())
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [quantityRules, setQuantityRules] = useState<QuantityBasedRule[]>([])
  const [zoneRules, setZoneRules] = useState<ZoneDeliveryRule[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    | 'all'
    | 'Today Orders'
    | 'Upcoming Orders'
    | 'Pending Orders'
    | 'Processing'
    | 'Dispatched'
    | 'In Transit'
    | 'Completed'
    | 'Cancelled'
    | 'Undelivered'
  >('Today Orders')
  const ordersTabsRef = useRef<HTMLDivElement>(null)
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false)
  const isAudioUnlockedRef = useRef(false)
  const SOUND_ENABLED_KEY = 'warehouse_notification_sound_enabled'
  const [soundEnabledPreference, setSoundEnabledPreference] = useState(false)
  const [isEnableSoundDialogOpen, setIsEnableSoundDialogOpen] = useState(false)

  const unlockNotificationAudio = async (): Promise<boolean> => {
    // Prepare audio element once
    if (!notificationAudioRef.current) {
      const a = new Audio('/sound/notification.mp3')
      a.preload = 'auto'
      notificationAudioRef.current = a
    } 

    const audio = notificationAudioRef.current
    if (!audio) return false

    try {
      audio.muted = true
      audio.currentTime = 0
      await audio.play()
      audio.pause()
      audio.currentTime = 0
      audio.muted = false
      isAudioUnlockedRef.current = true
      setIsAudioUnlocked(true)
      return true
    } catch (err) {
      console.log('Audio unlock blocked:', err)
      return false
    }
  }
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list')
  const [sortByStopNumber, setSortByStopNumber] = useState<'asc' | 'desc' | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  const [isAssignDriverDialogOpen, setIsAssignDriverDialogOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [isReadyDialogOpen, setIsReadyDialogOpen] = useState(false)
  const [orderToReady, setOrderToReady] = useState<number | null>(null)
  const [isDispatchedDialogOpen, setIsDispatchedDialogOpen] = useState(false)
  const [orderToDispatch, setOrderToDispatch] = useState<number | null>(null)
  const [isStopNumberDialogOpen, setIsStopNumberDialogOpen] = useState(false)
  const [orderForStopNumber, setOrderForStopNumber] = useState<number | null>(null)
  const [stopNumber, setStopNumber] = useState<string>('')
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [orderForNotes, setOrderForNotes] = useState<number | null>(null)
  const [notes, setNotes] = useState<string>('')
  const [viewOrderId, setViewOrderId] = useState<number | null>(null)
  const [editingStopNumber, setEditingStopNumber] = useState<number | null>(null)
  const [stopNumberValue, setStopNumberValue] = useState<string>('')
  const [isCancelOrderDialogOpen, setIsCancelOrderDialogOpen] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<number | null>(null)
  const [isClearStopNumbersDialogOpen, setIsClearStopNumbersDialogOpen] = useState(false)
  const [ordersToClearCount, setOrdersToClearCount] = useState<number>(0)
  const [isUnableToDeliverDialogOpen, setIsUnableToDeliverDialogOpen] = useState(false)
  const [orderForUnableToDeliver, setOrderForUnableToDeliver] = useState<number | null>(null)
  const [unableToDeliverReason, setUnableToDeliverReason] = useState<string>('')
  const [loadingAssignDriver, setLoadingAssignDriver] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)
  
  // Drag & Drop sensors - optimized for smooth dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [staffInfo, setStaffInfo] = useState<{
    isSuperAdmin: boolean
    franchiseId: string | null
    staffEmail: string | null
  } | null>(null)

  useEffect(() => {
    checkStaffAndFetch()

    // Periodic check for staff status only (every 5 seconds) - don't refetch orders
    const interval = setInterval(() => {
      checkStaffStatusOnly()
    }, 5000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Read saved preference so we don't keep showing the modal after refresh
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(SOUND_ENABLED_KEY) === 'true'
    setSoundEnabledPreference(saved)
    if (saved) {
      // Trust user preference after refresh; we'll fallback to modal if browser blocks playback.
      isAudioUnlockedRef.current = true
      setIsAudioUnlocked(true)
    }
    setIsEnableSoundDialogOpen(!saved && !isAudioUnlocked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // If audio becomes unlocked, hide the modal (if open)
    if (isAudioUnlocked) setIsEnableSoundDialogOpen(false)
  }, [isAudioUnlocked])
 
  // --- unlock notification audio on first user gesture (must be mounted BEFORE the click happens) ---
  useEffect(() => {
    // Add as early as possible; do NOT use once:true so we can retry if the first gesture is blocked.
    const options: AddEventListenerOptions = { capture: true }
    document.addEventListener('click', unlockNotificationAudio, options)
    document.addEventListener('keydown', unlockNotificationAudio, options)
    document.addEventListener('touchstart', unlockNotificationAudio, options)

    return () => {
      document.removeEventListener('click', unlockNotificationAudio, options)
      document.removeEventListener('keydown', unlockNotificationAudio, options)
      document.removeEventListener('touchstart', unlockNotificationAudio, options)
    }
  }, [])

  // --- realtime updates + play sound on INSERT ---
  useEffect(() => {
    if (!staffInfo) return

    const channel = supabase
      .channel('warehouse-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          try {
            // If staff is scoped to a franchise, only react to changes for that franchise
            const franchiseId = staffInfo.franchiseId
            const newRow: any = payload.new
            const oldRow: any = payload.old

            if (franchiseId) {
              const affectsFranchise =
                (newRow && newRow.franchise_id === franchiseId) ||
                (oldRow && oldRow.franchise_id === franchiseId)

              if (!affectsFranchise) {
                return
              }
            }
            if (payload.eventType === 'INSERT') {
              const audio = notificationAudioRef.current
              if (audio && isAudioUnlockedRef.current) {
                audio.currentTime = 0
                audio.play().catch(err => {
                  console.log('Notification sound blocked:', err)
                  // Browser blocked playback despite saved preference; ask user to re-enable.
                  isAudioUnlockedRef.current = false
                  setIsAudioUnlocked(false)
                  setIsEnableSoundDialogOpen(true)
                })
              }
            }

            // Reuse existing fetch logic so all derived data (customers, rules, etc.) stays consistent
            await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
          } catch (err) {
            console.error('Error handling realtime orders update:', err)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [staffInfo])

  const checkStaffAndFetch = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (!email) {
        router.push('/login')
        return
      }

      // Check if user is staff
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, email, is_super_admin, franchise_id, status')
        .eq('email', email)
        .maybeSingle()

      if (staffError || !staffData) {
        // Not a staff member, redirect to login
        router.push('/login')
        return
      }

      // Check if staff is active
      if (staffData.status !== 'Active') {
        // Staff is inactive, show toast and logout
        toast.error('Your account is inactive. Please contact administrator.')
        await handleLogout()
        return
      }

      const isSuperAdmin = staffData.is_super_admin === true
      const franchiseId = staffData.franchise_id || null // Ensure it's null if not present

      // Security: Only regular staff (non-super admin) can access warehouse
      if (isSuperAdmin) {
        toast.error('Super Admin cannot access warehouse. Redirecting to admin dashboard.')
        router.push('/admin/dashboard')
        return
      }

      // Check if user is franchise owner (should not access warehouse)
      const { data: franchiseData } = await supabase
        .from('franchises')
        .select('id')
        .eq('owner_email', email)
        .maybeSingle()

      if (franchiseData) {
        toast.error('Franchise owners cannot access warehouse. Redirecting to admin dashboard.')
        router.push('/admin/dashboard')
        return
      }

      console.log('🔍 Staff login check:', {
        email,
        isSuperAdmin,
        franchiseId,
        staffFranchiseId: staffData.franchise_id
      })

      setStaffInfo({
        isSuperAdmin,
        franchiseId,
        staffEmail: email,
      })

      // Store in localStorage for filtering
      if (isSuperAdmin) {
        localStorage.setItem('is_super_admin', 'true')
        localStorage.removeItem('current_franchise_id')
      } else if (franchiseId) {
        localStorage.setItem('current_franchise_id', franchiseId)
        localStorage.removeItem('is_super_admin')
      } else {
        // Staff has no franchise_id - treat as super admin
        localStorage.setItem('is_super_admin', 'true')
        localStorage.removeItem('current_franchise_id')
      }

      await fetchData(isSuperAdmin, franchiseId)
    } catch (error) {
      console.error('Error checking staff:', error)
      router.push('/login')
    }
  }

  // Check staff status only (without refetching orders)
  const checkStaffStatusOnly = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (!email) {
        router.push('/login')
        return
      }

      // Check if user is staff and status
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, email, status')
        .eq('email', email)
        .maybeSingle()

      if (staffError || !staffData) {
        router.push('/login')
        return
      }

      // Check if staff is active
      if (staffData.status !== 'Active') {
        toast.error('Your account is inactive. Please contact administrator.')
        await handleLogout()
        return
      }
    } catch (error) {
      console.error('Error checking staff status:', error)
    }
  }

  const fetchData = async (isSuperAdmin: boolean, franchiseId: string | null) => {
    setLoading(true)
    try {
      // Fetch orders based on staff type (include customer_details for delivery_zone)
      let ordersQuery = supabase
        .from('orders')
        .select('*') // customer_details is already included in * if it exists in the table
        .order('created_at', { ascending: false })

      // Filter based on staff's franchise_id:
      // Super Admin (no franchise_id): Show ALL orders (no filter)
      // Franchise staff (has franchise_id): Show only orders matching that franchise_id
      console.log('📦 Fetching orders with filter:', {
        isSuperAdmin,
        franchiseId,
        filterType: franchiseId ? `franchise_id = ${franchiseId}` : 'ALL orders (no filter)'
      })
      
      if (franchiseId) {
        // Staff has franchise_id: show only their franchise orders
        ordersQuery = ordersQuery.eq('franchise_id', franchiseId)
      } else {
        // Super Admin has no franchise_id: show ALL orders (no filter applied)
        // Don't apply any filter - show all data
      }

      const { data: ordersData, error: ordersError } = await ordersQuery
      
      console.log('📦 Orders fetched:', {
        count: ordersData?.length || 0,
        sampleFranchiseIds: ordersData?.slice(0, 5).map((o: any) => o.franchise_id)
      })

      if (ordersError) throw ordersError

      // Fetch customers with delivery_zone and company_id
      let customersQuery = supabase.from('customers').select('id, company_name, first_name, last_name, delivery_zone, company_id')
      // Filter customers based on staff's franchise_id
      if (franchiseId) {
        // Staff has franchise_id: show only their franchise customers
        customersQuery = customersQuery.eq('franchise_id', franchiseId)
      } else {
        // Super Admin has no franchise_id: show ALL customers (no filter applied)
        // Don't apply any filter - show all data
      }
      const { data: customersData } = await customersQuery

      // Fetch companies with logos for company logo mapping
      let companiesQuery = supabase.from('company').select('id, company_name, companyLogo')
      // Filter companies based on staff's franchise_id
      if (franchiseId) {
        companiesQuery = companiesQuery.eq('franchise_id', franchiseId)
      }
      const { data: companiesData } = await companiesQuery

      // Create a map from company_id to companyLogo
      const logoMap = new Map<string, string>()
      if (companiesData) {
        companiesData.forEach((company: Company) => {
          if (company.id && company.companyLogo) {
            logoMap.set(company.id, company.companyLogo)
          }
        })
      }
      setCompanies((companiesData || []) as Company[])
      setCompanyLogoMap(logoMap)

      // Fetch drivers
      let driversQuery = supabase.from('drivers').select('id, driver_name, phone_number, email, status')
      // Filter drivers based on staff's franchise_id
      if (franchiseId) {
        // Staff has franchise_id: show only their franchise drivers
        driversQuery = driversQuery.eq('franchise_id', franchiseId)
      } else {
        // Super Admin has no franchise_id: show ALL drivers (no filter applied)
        // Don't apply any filter - show all data
      }
      const { data: driversData } = await driversQuery

      // Fetch quantity-based delivery rules
      let quantityRulesQuery = supabase
        .from('quantity_delivery_rules')
        .select('id, min_quantity, max_quantity, delivery_offset, status')
        .eq('status', 'Active')
      
      // Filter quantity rules based on staff's franchise_id
      if (franchiseId) {
        // Staff has franchise_id: show only their franchise quantity rules
        quantityRulesQuery = quantityRulesQuery.eq('franchise_id', franchiseId)
      } else {
        // Super Admin has no franchise_id: show ALL quantity rules (no filter applied)
        // Don't apply any filter - show all data
      }
      
      const { data: quantityRulesData } = await quantityRulesQuery

      // Fetch zone delivery rules
      let zoneRulesQuery = supabase
        .from('zone_delivery_rules')
        .select('id, zone_id, cutoff_time, next_day_offset, after_cutoff_offset, status')
        .eq('status', 'Active')
      
      // Filter zone rules based on staff's franchise_id
      if (franchiseId) {
        // Staff has franchise_id: show only their franchise zone rules
        zoneRulesQuery = zoneRulesQuery.eq('franchise_id', franchiseId)
      } else {
        // Super Admin has no franchise_id: show ALL zone rules (no filter applied)
        // Don't apply any filter - show all data
      }
      
      const { data: zoneRulesData } = await zoneRulesQuery

      // Initialize stop_number_position and status_change_count for orders that don't have it
      const ordersWithPositions = (ordersData || []).map((order: any, index: number) => ({
        ...order,
        stop_number_position: order.stop_number_position ?? (index + 1),
        status_change_count: order.status_change_count ?? 1, // Default to 1 if not set
      }))

      setOrders(ordersWithPositions as Order[])
      setCustomers((customersData || []) as Customer[])
      setDrivers((driversData || []) as Driver[])
      setQuantityRules((quantityRulesData || []) as QuantityBasedRule[])
      setZoneRules((zoneRulesData || []) as ZoneDeliveryRule[])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error loading orders')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('coconut_auth')
    localStorage.removeItem('current_franchise_id')
    localStorage.removeItem('is_super_admin')
    localStorage.removeItem('current_staff_email')
    document.cookie = 'auth-token=; path=/; max-age=0'
    router.push('/login')
  }

  const getStatusCounts = () => {
    const pending = orders.filter(o => {
      const status = o.deliveryStatus?.toLowerCase() || ''
      return status === 'pending'
    }).length
    const dispatched = orders.filter(o => {
      const status = o.deliveryStatus?.toLowerCase() || ''
      return status === 'dispatched'
    }).length
    const completed = orders.filter(o => {
      const status = o.deliveryStatus?.toLowerCase() || ''
      return status === 'completed'
    }).length
    return { pending, dispatched, completed, total: orders.length }
  }

  const getFilteredOrders = () => {
    let filtered = orders

    if (statusFilter !== 'all') {
      if (statusFilter === 'Today Orders') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        filtered = filtered.filter(o => {
          if (!o.order_date) return false
          const od = new Date(o.order_date)
          return od >= today && od < tomorrow
        })
      } else if (statusFilter === 'Upcoming Orders') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        filtered = filtered.filter(o => {
          if (!o.order_date) return false
          const od = new Date(o.order_date)
          return od >= tomorrow
        })
      } else if (statusFilter === 'Pending Orders') {
        filtered = filtered.filter(o => (o.deliveryStatus?.toLowerCase() || '') === 'pending')
      } else if (statusFilter === 'Processing') {
        filtered = filtered.filter(o => o.deliveryStatus?.toLowerCase() === 'processing')
      } else if (statusFilter === 'Dispatched') {
        filtered = filtered.filter(o => o.deliveryStatus?.toLowerCase() === 'dispatched')
      } else if (statusFilter === 'In Transit') {
        filtered = filtered.filter(o => {
          const s = (o.deliveryStatus || '').toLowerCase().trim()
          return s === 'in transit' || s === 'intransit'
        })
      } else if (statusFilter === 'Completed') {
        filtered = filtered.filter(o => o.deliveryStatus?.toLowerCase() === 'completed')
      } else if (statusFilter === 'Cancelled') {
        filtered = filtered.filter(o => {
          const s = (o.deliveryStatus || '').toLowerCase().trim()
          return s === 'cancelled' || s === 'canceled'
        })
      } else if (statusFilter === 'Undelivered') {
        filtered = filtered.filter(o => o.deliveryStatus?.toLowerCase() === 'undelivered')
      }
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(order => {
        const customer = customers.find(c => c.id === order.customer_id)
        return (
          order.order_name?.toLowerCase().includes(search) ||
          order.po_number?.toLowerCase().includes(search) ||
          customer?.company_name.toLowerCase().includes(search) ||
          customer?.first_name.toLowerCase().includes(search) ||
          customer?.last_name.toLowerCase().includes(search)
        )
      })
    }

    filtered = [...filtered].sort((a, b) => {
      const aPos = a.stop_number_position ?? 999999
      const bPos = b.stop_number_position ?? 999999
      return aPos - bPos
    })

    if (sortByStopNumber) {
      filtered = [...filtered].sort((a, b) => {
        const aStop = a.stop_number ?? 999999
        const bStop = b.stop_number ?? 999999
        
        if (sortByStopNumber === 'asc') {
          return aStop - bStop
        } else {
          return bStop - aStop
        }
      })
    }

    return filtered
  }

  const handleSortByStopNumber = () => {
    if (sortByStopNumber === null) {
      setSortByStopNumber('asc')
    } else if (sortByStopNumber === 'asc') {
      setSortByStopNumber('desc')
    } else {
      setSortByStopNumber(null)
    }
  }

  const getCustomerInfo = (customerId: number | null) => {
    return customers.find(c => c.id === customerId)
  }

  const getDriverInfo = (driverId: number | null): Driver | null => {
    if (!driverId) return null
    return drivers.find(d => d.id === driverId) || null
  }

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    const filtered = getFilteredOrders()
    if (selectedOrders.size === filtered.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(filtered.map(o => o.id)))
    }
  }

  const handleMarkReady = async (orderId: number) => {
    try {
      // Get order details before updating (to get previous status)
      const order = orders.find(o => o.id === orderId)
      const previousStatus = (order?.deliveryStatus || '').toLowerCase()
      const newStatus = 'driver assigned'
      
      // Only increment status_change_count if status actually changed
      const statusChanged = previousStatus !== newStatus
      const currentCount = Number(order?.status_change_count) || 1
      const newCount = statusChanged ? currentCount + 1 : currentCount
      
      const updatePayload: any = {
        deliveryStatus: newStatus,
      }
      
      // Only update status_change_count if status changed
      if (statusChanged) {
        updatePayload.status_change_count = newCount
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)

      if (error) throw error
      
      toast.success('Order marked as Ready to Dispatch')
      
      // Send notification to driver and customer (with email)
      if (order) {
        await sendStatusChangeNotification(order, 'driver assigned', previousStatus || undefined)
      }
      
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      setIsReadyDialogOpen(false)
      setOrderToReady(null)
    } catch (error: any) {
      console.error('Error marking ready:', error)
      toast.error(error.message || 'Error updating order')
    }
  }

  const handleMarkDispatched = async (orderId: number) => {
    try {
      // Get order details before updating (to get previous status)
      const order = orders.find(o => o.id === orderId)
      const previousStatus = (order?.deliveryStatus || '').toLowerCase()
      const newStatus = 'dispatched'
      
      // Only increment status_change_count if status actually changed
      const statusChanged = previousStatus !== newStatus
      const currentCount = Number(order?.status_change_count) || 1
      const newCount = statusChanged ? currentCount + 1 : currentCount
      
      const updatePayload: any = {
        deliveryStatus: newStatus,
      }
      
      // Only update status_change_count if status changed
      if (statusChanged) {
        updatePayload.status_change_count = newCount
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)

      if (error) throw error
      
      toast.success('Order marked as Dispatched')
      
      // Send notification to driver and customer (with email)
      if (order) {
        await sendStatusChangeNotification(order, 'dispatched', previousStatus || undefined)
      }
      
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      setIsDispatchedDialogOpen(false)
      setOrderToDispatch(null)
    } catch (error: any) {
      console.error('Error marking dispatched:', error)
      toast.error(error.message || 'Error updating order')
    }
  }

  const handleBulkMarkDispatched = async (orderIds: number[]) => {
    setLoadingAssignDriver(true)
    try {
      // Get order details before updating for notifications
      const ordersToUpdate = orders.filter(o => orderIds.includes(o.id))
      
      // Filter only orders with "driver assigned" status
      const driverAssignedOrders = ordersToUpdate.filter(order => {
        const statusLower = (order.deliveryStatus || '').toLowerCase()
        return statusLower === 'driver assigned'
      })
      
      if (driverAssignedOrders.length === 0) {
        toast.error('No orders with "Driver Assigned" status selected')
        setLoadingAssignDriver(false)
        return
      }
      
      // Update status to 'dispatched', increment status_change_count only if status changed
      const updatePromises = driverAssignedOrders.map(order => {
        const previousStatus = (order.deliveryStatus || '').toLowerCase()
        const newStatus = 'dispatched'
        const statusChanged = previousStatus !== newStatus
        const currentCount = Number(order.status_change_count) || 1
        const newCount = statusChanged ? currentCount + 1 : currentCount
        
        const updatePayload: any = {
          deliveryStatus: newStatus,
        }
        
        // Only update status_change_count if status changed
        if (statusChanged) {
          updatePayload.status_change_count = newCount
        }
        
        return supabase
          .from('orders')
          .update(updatePayload)
          .eq('id', order.id)
      })
      
      const results = await Promise.all(updatePromises)
      const error = results.find(r => r.error)?.error

      if (error) throw error
      
      // Send notifications for each order (with email)
      for (const order of driverAssignedOrders) {
        // Create updated order object with new status
        const updatedOrder = { ...order, deliveryStatus: 'dispatched' }
        const previousStatus = order.deliveryStatus || null
        await sendStatusChangeNotification(updatedOrder, 'dispatched', previousStatus || undefined)
      }
      
      toast.success(`${driverAssignedOrders.length} order(s) marked as Dispatched`)
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      setSelectedOrders(new Set())
    } catch (error: any) {
      console.error('Error bulk marking dispatched:', error)
      toast.error(error.message || 'Error updating orders')
    } finally {
      setLoadingAssignDriver(false)
    }
  }

  const handleAssignDriver = async (orderIds: number[]) => {
    if (!selectedDriver) {
      toast.error('Please select a driver')
      return
    }

    setLoadingAssignDriver(true)
    try {
      // Get order details before updating for notifications
      const selectedOrdersList = orders.filter(o => orderIds.includes(o.id))

      // Do not assign driver or change status for Completed / Cancelled orders
      const ordersToUpdate = selectedOrdersList.filter(order => {
        const statusLower = (order.deliveryStatus || '').toLowerCase()
        return statusLower !== 'completed' && statusLower !== 'cancelled'
      })

      if (ordersToUpdate.length === 0) {
        toast.error('Selected orders are already Completed or Cancelled')
        setLoadingAssignDriver(false)
        return
      }

      console.log('ordersToUpdate', ordersToUpdate)
      // Update driver_id and status to 'driver assigned', increment status_change_count only if status changed
      const updatePromises = ordersToUpdate.map(order => {
        const previousStatus = (order.deliveryStatus || '').toLowerCase()
        const newStatus = 'driver assigned'
        const statusChanged = previousStatus !== newStatus
        const currentCount = Number(order.status_change_count) || 1
        const newCount = statusChanged ? currentCount + 1 : currentCount
        const driver = drivers.find(d => d.id === Number(selectedDriver))
        console.log('driver', driver)
        
        if (!driver) {
          toast.error('Driver not found')
          return
        }
        const updatePayload: any = {
          driver_id: Number(selectedDriver),
          deliveryStatus: newStatus,
          driver_name: driver.driver_name,
          driver_email: driver.email,
          driver_number: driver.phone_number
        }
        
        // Only update status_change_count if status changed
        if (statusChanged) {
          updatePayload.status_change_count = newCount
        }
        
        return supabase
        .from('orders')
          .update(updatePayload)
          .eq('id', order.id)
      })
      
      const results = await Promise.all(updatePromises)
      const error = results.find((r: any) => r.error)?.error

      if (error) throw error
      
      // Send notifications for each order (with email)
      for (const order of ordersToUpdate) {
        // Create updated order object with new driver_id and status
        const updatedOrder = { ...order, driver_id: Number(selectedDriver), deliveryStatus: 'driver assigned' }
        const previousStatus = order.deliveryStatus || null
        await sendStatusChangeNotification(updatedOrder, 'driver assigned', previousStatus || undefined)
      }
      
      toast.success(`Driver assigned to ${ordersToUpdate.length} order(s)`)
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      setIsAssignDriverDialogOpen(false)
      setSelectedDriver('')
      setSelectedOrders(new Set())
    } catch (error: any) {
      console.error('Error assigning driver:', error)
      toast.error(error.message || 'Error assigning driver')
    } finally {
      setLoadingAssignDriver(false)
    }
  }

  const handleCancelAssignDriver = () => {
    setIsAssignDriverDialogOpen(false)
    setSelectedDriver('')
    setSelectedOrders(new Set())
  }
  

  const handleSetStopNumber = async () => {
    if (!orderForStopNumber || !stopNumber) {
      toast.error('Please enter a stop number')
      return
    }

    try {
      const numValue = Number(stopNumber)
      
      // Check if stop number is already used by another order
      const existingOrder = orders.find(
        (o) => o.stop_number === numValue && o.id !== orderForStopNumber
      )
      
      if (existingOrder) {
        toast.error(`Stop number ${numValue} is already assigned to order ${existingOrder.order_name}`)
        return
      }

      const { error } = await supabase
        .from('orders')
        .update({ stop_number: numValue })
        .eq('id', orderForStopNumber)

      if (error) throw error
      toast.success('Stop number updated')
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      setIsStopNumberDialogOpen(false)
      setOrderForStopNumber(null)
      setStopNumber('')
    } catch (error: any) {
      console.error('Error setting stop number:', error)
      toast.error(error.message || 'Error updating stop number')
    }
  }

  const handleSaveNotes = async () => {
    if (!orderForNotes) return

    try {
      const { error } = await supabase
        .from('orders')
        .update({ notes: notes })
        .eq('id', orderForNotes)

      if (error) throw error
      toast.success('Warehouse notes saved')
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      setIsNotesDialogOpen(false)
      setOrderForNotes(null)
      setNotes('')
    } catch (error: any) {
      console.error('Error saving notes:', error)
      toast.error(error.message || 'Error saving notes')
    }
  }

  // Send FCM notification to driver and customer
  const sendFCMNotification = async (tokens: string[], title: string, message: string) => {
    try {
      if (!tokens || tokens.length === 0) {
        console.warn('⚠️ No FCM tokens found. Push notifications will not be sent.')
        return { success: false, error: 'No FCM tokens found' }
      }

      const validTokens = tokens.filter(token => token && token.trim() !== '')

      if (validTokens.length === 0) {
        console.warn('⚠️ No valid FCM tokens found.')
        return { success: false, error: 'No valid FCM tokens found' }
      }

      console.log(`✅ Sending FCM notification to ${validTokens.length} device(s)`)

      const { data: result, error: functionError } = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          tokens: validTokens,
          title: title,
          message: message,
        },
      })

      if (functionError) {
        console.error('❌ FCM Edge Function Error:', functionError)
        throw new Error(functionError.message || 'Failed to send FCM notification')
      }

      if (!result || !result.success) {
        const errorMsg = result?.error || 'Unknown error occurred'
        console.error('❌ FCM Edge Function returned error:', errorMsg)
        throw new Error(errorMsg)
      }

      console.log('✅ FCM Notification Response:', result)
      return { success: true, result }
    } catch (error) {
      console.error('❌ Error sending FCM notification:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Send notification to driver and customer when order status changes
  const sendStatusChangeNotification = async (order: Order, newStatus: string, previousStatus?: string) => {
    try {
      const tokens: string[] = []
      const recipientIds: number[] = []
      const notificationTitle = `Order ${order.order_name} Status Updated`
      let notificationMessage = `Your order ${order.order_name} status has been updated to ${newStatus}.`

      // Fetch customer data (FCM token and email)
      let customerEmail: string | null = null
      let customerName: string = 'Customer'
      
      if (order.customer_id) {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('fcm_token, company_name, first_name, last_name, email')
          .eq('id', order.customer_id)
          .maybeSingle()

        if (!customerError && customerData) {
          // Get customer email for email notification
          customerEmail = customerData.email || null
          customerName = customerData.company_name || 
            `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || 
            'Customer'
          
          // Get FCM token for push notification (only for allowed statuses)
          const allowedCustomerStatuses = ['pending', 'completed', 'cancelled', 'driver assigned']
          if (customerData.fcm_token && allowedCustomerStatuses.includes(newStatus.toLowerCase())) {
            tokens.push(customerData.fcm_token)
            recipientIds.push(order.customer_id)
            console.log(`📱 Found customer FCM token for order ${order.order_name}`)
          }
        }
      }

      // Fetch driver FCM token
      if (order.driver_id) {
        console.log('order.driver_id', order.driver_id)
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('fcm_token, driver_name')
          .eq('id', order.driver_id)
          .maybeSingle()

        if (!driverError && driverData && driverData.fcm_token) {
          tokens.push(driverData.fcm_token)
          recipientIds.push(order.driver_id)
          console.log(`🚗 Found driver FCM token for order ${order.order_name}`)
        }
      }

      // Send FCM push notification if tokens found
      if (tokens.length > 0) {
        await sendFCMNotification(tokens, notificationTitle, notificationMessage)
        console.log(`✅ Status change notification sent to ${tokens.length} recipient(s)`)
      } else {
        console.log('ℹ️ No FCM tokens found for driver or customer')
      }

      // Send email to customer only for allowed statuses
      const normalizedStatusForEmail = (newStatus || '').toLowerCase()
      const shouldSendEmail = ['completed', 'cancelled', 'driver assigned'].includes(normalizedStatusForEmail)
      if (customerEmail && shouldSendEmail) {
        try {
          await supabase.functions.invoke('send_order_email', {
            body: JSON.stringify({
              to: customerEmail,
              customer_name: customerName,
              order_name: order.order_name,
              order_id: order.id,
              delivery_status: newStatus,
              delivery_date: order.delivery_date,
              quantity: order.quantity,
              previous_status: previousStatus || order.deliveryStatus || null,
              email_type: 'status_updated'
            })
          })
          console.log(`✅ Status update email sent to ${customerEmail}`)
        } catch (emailErr: any) {
          console.error('Error sending status update email:', emailErr)
          // Don't block status update if email fails
        }
      } else {
        console.log('ℹ️ Customer email not found, skipping email notification')
      }

      // Save notification to database
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      const notificationData: any = {
        title: notificationTitle,
        message: notificationMessage,
        recipient_type: 'order_status_update',
        recipient_count: recipientIds.length,
        status: 'sent',
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        recipient_ids: recipientIds.length > 0 ? recipientIds : null,
        franchise_id: !isSuperAdmin && currentFranchiseId ? currentFranchiseId : null,
        order_id: order.id,
        order_name: order.order_name
      }

      const { error: notifError } = await supabase
        .from('notifications')
        .insert([notificationData])

      if (notifError) {
        console.error('Error saving notification to database:', notifError)
      } else {
        console.log('✅ Notification saved to database')
      }
    } catch (error) {
      console.error('Error sending status change notification:', error)
      // Don't block status update if notification fails
    }
  }

  // --- Send notification to driver and customer when delivery time changes ---
  const sendDeliveryTimeChangeNotification = async (order: Order, deliveryTime: string) => {
    try {
      const tokens: string[] = []
      const recipientIds: number[] = []
      const notificationTitle = `Order ${order.order_name} Delivery Time Updated`
      
      // Map delivery time values to display text
      const deliveryTimeText = deliveryTime === 'same-day' ? 'Same Day' : 
                               deliveryTime === '1-day' ? '1 day' : 
                               deliveryTime === '2-day' ? '2 day' : 
                               '1 day'
      const notificationMessage = `Your order ${order.order_name} delivery time has been updated to ${deliveryTimeText}.`

      // Fetch customer data (FCM token and email)
      let customerEmail: string | null = null
      let customerName: string = 'Customer'
      
      if (order.customer_id) {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('fcm_token, company_name, first_name, last_name, email')
          .eq('id', order.customer_id)
          .maybeSingle()

        if (!customerError && customerData) {
          // Get customer email for email notification
          customerEmail = customerData.email || null
          customerName = customerData.company_name || 
            `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || 
            'Customer'
          
          // Get FCM token for push notification
          if (customerData.fcm_token) {
            tokens.push(customerData.fcm_token)
            recipientIds.push(order.customer_id)
            console.log(`📱 Found customer FCM token for order ${order.order_name}`)
          }
        }
      }

      // Fetch driver FCM token
      if (order.driver_id) {
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('fcm_token, driver_name, email')
          .eq('id', order.driver_id)
          .maybeSingle()

        if (!driverError && driverData) {
          if (driverData.fcm_token) {
            tokens.push(driverData.fcm_token)
            recipientIds.push(order.driver_id)
            console.log(`🚗 Found driver FCM token for order ${order.order_name}`)
          }
        }
      }

      // Send FCM push notification if tokens found
      if (tokens.length > 0) {
        await sendFCMNotification(tokens, notificationTitle, notificationMessage)
        console.log(`✅ Delivery time change notification sent to ${tokens.length} recipient(s)`)
      } else {
        console.log('ℹ️ No FCM tokens found for driver or customer')
      }

      // Send email to customer if email exists
      if (customerEmail) {
        try {
          // Calculate new delivery date based on delivery time
          let newDeliveryDate: string | null = null
          if (order.order_date) {
            const orderDate = new Date(order.order_date)
            if (deliveryTime === 'same-day') {
              newDeliveryDate = orderDate.toISOString().split('T')[0]
            } else if (deliveryTime === '1-day') {
              orderDate.setDate(orderDate.getDate() + 1)
              newDeliveryDate = orderDate.toISOString().split('T')[0]
            } else if (deliveryTime === '2-day') {
              orderDate.setDate(orderDate.getDate() + 2)
              newDeliveryDate = orderDate.toISOString().split('T')[0]
            }
          }

          await supabase.functions.invoke('send_delivery_time_email', {
            body: JSON.stringify({
              to: customerEmail,
              customer_name: customerName,
              order_name: order.order_name,
              order_id: order.id,
              delivery_time: deliveryTimeText,
              new_delivery_date: newDeliveryDate || order.delivery_date,
              quantity: order.quantity,
              order_date: order.order_date
            })
          })
          console.log(`✅ Delivery time change email sent to ${customerEmail}`)
        } catch (emailErr: any) {
          console.error('Error sending delivery time change email:', emailErr)
          // Don't block delivery time update if email fails
        }
      } else {
        console.log('ℹ️ Customer email not found, skipping email notification')
      }

      // Save notification to database
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      const notificationData: any = {
        title: notificationTitle,
        message: notificationMessage,
        recipient_type: 'delivery_time_update',
        recipient_count: recipientIds.length,
        status: 'sent',
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        recipient_ids: recipientIds.length > 0 ? recipientIds : null,
        franchise_id: !isSuperAdmin && currentFranchiseId ? currentFranchiseId : null,
        order_id: order.id,
        order_name: order.order_name
      }

      const { error: notifError } = await supabase
        .from('notifications')
        .insert([notificationData])

      if (notifError) {
        console.error('Error saving notification to database:', notifError)
      } else {
        console.log('✅ Notification saved to database')
      }
    } catch (error) {
      console.error('Error sending delivery time change notification:', error)
      // Don't block delivery time update if notification fails
    }
  }

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      // Convert status to lowercase for database
      const statusLower = newStatus.toLowerCase()
      const order = orders.find(o => o.id === orderId)

      // If status is "undelivered", open dialog instead of updating directly
      if (statusLower === 'undelivered') {
        setOrderForUnableToDeliver(orderId)
        setUnableToDeliverReason(order?.unable_to_deliver_reason || '')
        setIsUnableToDeliverDialogOpen(true)
        return
      }

      // If status is "cancelled", require confirmation (same dialog as Cancel Order button)
      if (statusLower === 'cancelled') {
        if ((order?.deliveryStatus || '').toLowerCase() === 'cancelled') {
          return
        }
        setOrderToCancel(orderId)
        setIsCancelOrderDialogOpen(true)
        return
      }

      const needsDriverForStatus =
        statusLower === 'dispatched' ||
        statusLower === 'in transit' ||
        statusLower === 'completed'
      if (needsDriverForStatus && (!order || !hasDriverAssignedForStatus(order))) {
        toast.error('Please assign a driver before Dispatched, In Transit, or Completed.')
        return
      }

      const previousStatus = (order?.deliveryStatus || '').toLowerCase()
      
      // Only increment status_change_count if status actually changed
      const statusChanged = previousStatus !== statusLower
      const currentCount = Number(order?.status_change_count) || 1
      const newCount = statusChanged ? currentCount + 1 : currentCount
      
      const updatePayload: any = {
        deliveryStatus: statusLower,
      }
      
      // Only update status_change_count if status changed
      if (statusChanged) {
        updatePayload.status_change_count = newCount
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)

      if (error) throw error
      
      toast.success('Status updated successfully')
      
      // Send notification to driver and customer (with email)
      if (order) {
        await sendStatusChangeNotification(order, statusLower, previousStatus || undefined)
      }
      
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
    } catch (error: any) {
      console.error('Error updating status:', error)
      toast.error(error.message || 'Error updating status')
    }
  }

  const handleSaveUnableToDeliver = async () => {
    if (!orderForUnableToDeliver) return

    try {
      // Get order details before updating (to get previous status)
      const order = orders.find(o => o.id === orderForUnableToDeliver)
      const previousStatus = (order?.deliveryStatus || '').toLowerCase()
      const newStatus = 'undelivered'
      
      // Only increment status_change_count if status actually changed
      const statusChanged = previousStatus !== newStatus
      const currentCount = Number(order?.status_change_count) || 1
      const newCount = statusChanged ? currentCount + 1 : currentCount
      
      const updatePayload: any = {
        deliveryStatus: newStatus,
        unable_to_deliver_reason: unableToDeliverReason,
      }
      
      // Only update status_change_count if status changed
      if (statusChanged) {
        updatePayload.status_change_count = newCount
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderForUnableToDeliver)

      if (error) throw error
      
      toast.success('Status updated to Undelivered')
      
      // Send notification to driver and customer (with email)
      if (order) {
        await sendStatusChangeNotification(
          { ...order, deliveryStatus: 'undelivered' }, 
          'undelivered',
          previousStatus || undefined
        )
      }
      
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      
      setIsUnableToDeliverDialogOpen(false)
      setOrderForUnableToDeliver(null)
      setUnableToDeliverReason('')
    } catch (error: any) {
      console.error('Error updating status:', error)
      toast.error(error.message || 'Error updating status')
    }
  }

  const handleExportCSV = () => {
    const filtered = getFilteredOrders()
    const csv = [
      ['Order ID', 'Customer', 'PO Number', 'Order Date', 'Delivery Date', 'Quantity', 'Stop Number', 'Status', 'Driver'].join(','),
      ...filtered.map(order => {
        const customer = getCustomerInfo(order.customer_id)
        const driver = getDriverInfo(order.driver_id)
        return [
          order.order_name || '',
          customer ? `${customer.company_name} (${customer.first_name} ${customer.last_name})` : '',
          order.po_number || '',
          order.order_date || '',
          order.delivery_date || '',
          order.quantity || 0,
          order.stop_number || '',
          order.deliveryStatus || '',
          driver ? driver.driver_name : '',
        ].join(',')
      }),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Convert UTC date to local time string
  const formatLocalDateTime = (utcDateString: string | null): string => {
    if (!utcDateString) return '—'
    try {
      // Ensure the date string is treated as UTC if it doesn't have timezone info
      let dateStr = utcDateString
      // If the string doesn't end with Z or timezone offset, assume it's UTC
      if (!dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
        // If it's ISO format without timezone, add Z to indicate UTC
        if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
          dateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z'
        }
      }
      
      const date = new Date(dateStr)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '—'
      }
      
      // Convert UTC to local time - new Date() automatically converts UTC to local
      // So we just need to format it in local timezone
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    } catch (error) {
      console.error('Error formatting date:', error, utcDateString)
      return '—'
    }
  }

  const isNewOrder = (order: Order) => {
    // New order: status_change_count = 1 (never changed) - handle both number and string
    const statusChangeCount = Number(order.status_change_count) || 1
    return statusChangeCount === 1
  }

  const isUndeliveredOldOrder = (order: Order) => {
    // Old undelivered order: from ANY previous date (before today) and NOT completed/closed/paid/cancelled
    if (!order.created_at) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const orderDate = new Date(order.created_at)
    orderDate.setHours(0, 0, 0, 0)
    // Check if order is from any previous date (before today)
    const isFromPreviousDate = orderDate < today
    
    const statusLower = order.deliveryStatus?.toLowerCase() || ''
    const isNotDelivered = statusLower !== 'completed' && 
                           statusLower !== 'closed / paid' && 
                           statusLower !== 'cancelled'
    
    return isFromPreviousDate && isNotDelivered && order.status_change_count !== 1
  }

  const getDeliveryTag = (order: Order): { text: string; color: string; bgColor: string; value: string } | null => {
   
    
    // First check if delivery_day_date exists in order (user manually set)
    if (order.delivery_day_date) {
      console.log('✅ Using manual delivery_day_date:', order.delivery_day_date)
      const deliveryText = order.delivery_day_date
      let deliveryValue: string
      let deliveryColor: string
      let deliveryBgColor: string
      
      if (deliveryText === 'Same Day' || deliveryText === 'After 2PM') {
        // Support old "After 2PM" value for backward compatibility
        deliveryValue = 'same-day'
        deliveryColor = 'text-orange-600'
        deliveryBgColor = 'bg-orange-100 text-orange-700 border-orange-200'
      } else if (deliveryText === '1 day' || deliveryText === 'Next Day') {
        // Support old "Next Day" value for backward compatibility
        deliveryValue = '1-day'
        deliveryColor = 'text-green-600'
        deliveryBgColor = 'bg-green-100 text-green-700 border-green-200'
      } else if (deliveryText === '2 day') {
        deliveryValue = '2-day'
        deliveryColor = 'text-blue-600'
        deliveryBgColor = 'bg-blue-100 text-blue-700 border-blue-200'
      } else {
        // Default fallback
        deliveryValue = '1-day'
        deliveryColor = 'text-green-600'
        deliveryBgColor = 'bg-green-100 text-green-700 border-green-200'
      }
      
      return { 
        text: deliveryText === 'After 2PM' ? 'Same Day' : deliveryText === 'Next Day' ? '1 day' : deliveryText, 
        color: deliveryColor, 
        bgColor: deliveryBgColor,
        value: deliveryValue
      }
    }
    
    if (!order.order_date || !order.customer_id) {
      console.log('❌ Missing order_date or customer_id')
      return null
    }
    
    const orderQuantity = order.quantity || 0
     
    // PRIORITY 1: Check quantity-based rules first
    const activeQuantityRules = quantityRules.filter(rule => rule.status === 'Active')
    console.log('📦 Checking quantity rules. Order quantity:', orderQuantity, 'Total quantity rules:', quantityRules.length, 'Active rules:', activeQuantityRules.length)
    
    if (activeQuantityRules.length > 0) {
      // Find matching quantity rule (order quantity falls within min-max range)
      const matchingQuantityRule = activeQuantityRules.find(rule => {
        const matches = orderQuantity >= rule.min_quantity && orderQuantity <= rule.max_quantity
        console.log('🔍 Quantity rule check:', {
          ruleId: rule.id,
          minQty: rule.min_quantity,
          maxQty: rule.max_quantity,
          orderQty: orderQuantity,
          matches: matches,
          deliveryOffset: rule.delivery_offset
        })
        return matches
      })
      
      if (matchingQuantityRule) {
        // Map delivery_offset to delivery tag:
        // delivery_offset = 0 → "Same Day"
        // delivery_offset = 1 → "1 day"
        // delivery_offset = 2 → "2 day"
        const deliveryOffset = matchingQuantityRule.delivery_offset
        let deliveryText: string
        let deliveryValue: string
        let deliveryColor: string
        let deliveryBgColor: string
        
        if (deliveryOffset === 0) {
          deliveryText = 'Same Day'
          deliveryValue = 'same-day'
          deliveryColor = 'text-orange-600'
          deliveryBgColor = 'bg-orange-100 text-orange-700 border-orange-200'
        } else if (deliveryOffset === 1) {
          deliveryText = '1 day'
          deliveryValue = '1-day'
          deliveryColor = 'text-green-600'
          deliveryBgColor = 'bg-green-100 text-green-700 border-green-200'
        } else if (deliveryOffset === 2) {
          deliveryText = '2 day'
          deliveryValue = '2-day'
          deliveryColor = 'text-blue-600'
          deliveryBgColor = 'bg-blue-100 text-blue-700 border-blue-200'
        } else {
          // Fallback for any other value
          deliveryText = '1 day'
          deliveryValue = '1-day'
          deliveryColor = 'text-green-600'
          deliveryBgColor = 'bg-green-100 text-green-700 border-green-200'
        }
        
        console.log('✅ Quantity rule matched:', {
          orderId: order.order_name,
          orderQuantity: orderQuantity,
          matchedRule: {
            minQty: matchingQuantityRule.min_quantity,
            maxQty: matchingQuantityRule.max_quantity,
            deliveryOffset: matchingQuantityRule.delivery_offset
          },
          result: deliveryText
        })
        
        return {
          text: deliveryText,
          color: deliveryColor,
          bgColor: deliveryBgColor,
          value: deliveryValue
        }
      } else {
        console.log('❌ No quantity rule matched for order:', order.order_name, {
          orderQuantity: orderQuantity,
          availableRules: activeQuantityRules.map(r => ({
            minQty: r.min_quantity,
            maxQty: r.max_quantity,
            deliveryOffset: r.delivery_offset
          }))
        })
      }
    }
    
    // PRIORITY 2: Check zone-based rules (only if no quantity rules exist or no match found)
    const customer = customers.find(c => c.id === order.customer_id)
    
    // Get delivery_zone from order's customer_details first, then fallback to customer table
    let deliveryZoneId: string | number | null = null
    let deliveryZoneSource = 'none'
    
    // First, try to get from order's customer_details object
    if (order.customer_details && typeof order.customer_details === 'object' && order.customer_details.delivery_zone) {
      deliveryZoneId = order.customer_details.delivery_zone
      deliveryZoneSource = 'order_customer_details'
    } else if (order.customer_details && typeof order.customer_details === 'string') {
      // If customer_details is a JSON string, parse it
      try {
        const parsedCustomerDetails = JSON.parse(order.customer_details)
        if (parsedCustomerDetails.delivery_zone) {
          deliveryZoneId = parsedCustomerDetails.delivery_zone
          deliveryZoneSource = 'order_customer_details_parsed'
        }
      } catch (e) {
        console.warn('Failed to parse customer_details JSON:', e)
      }
    }
    
    // Fallback to customer table's delivery_zone
    if (!deliveryZoneId && customer && customer.delivery_zone) {
      deliveryZoneId = customer.delivery_zone
      deliveryZoneSource = 'customer_table'
    } 
    
    if (deliveryZoneId) {
      // Find zone rule for customer's delivery zone
      // Convert both to string for comparison to handle type mismatches
      const customerZoneStr = String(deliveryZoneId)
      const zoneRule = zoneRules.find(rule => {
        const ruleZoneIdStr = String(rule.zone_id)
        const matches = ruleZoneIdStr === customerZoneStr && rule.status === 'Active'
        return matches
      })
       
      if (zoneRule && zoneRule.cutoff_time) {
        // Parse cutoff time (format: "HH:MM:SS" or "HH:MM")
        const cutoffTimeStr = zoneRule.cutoff_time
        const [cutoffHours, cutoffMinutes] = cutoffTimeStr.split(':').map(Number)
        
        // Get order time in local timezone
        // order.order_date is stored as UTC (ISO format), convert to local time
        let orderTime: Date
        const orderDateStr = order.order_date || ''
        
        // If order_date is in ISO format without timezone (from Supabase), treat as UTC
        if (orderDateStr.includes('T') && !orderDateStr.includes('Z') && !orderDateStr.includes('+') && !orderDateStr.match(/-\d{2}:\d{2}$/)) {
          // Add 'Z' to indicate UTC, then JavaScript will convert to local time
          orderTime = new Date(orderDateStr + 'Z')
        } else if (orderDateStr.includes('T') && orderDateStr.includes('Z')) {
          // Already has 'Z', treat as UTC
          orderTime = new Date(orderDateStr)
        } else {
          // Fallback: try parsing as is
          orderTime = new Date(orderDateStr)
        }
        
        // Get local time hours and minutes (converted from UTC to local)
        const orderHours = orderTime.getHours()
        const orderMinutes = orderTime.getMinutes()
        
        // Also get UTC time for debugging
        const orderTimeUTC = new Date(orderDateStr.includes('Z') ? orderDateStr : orderDateStr + 'Z')
        const orderHoursUTC = orderTimeUTC.getUTCHours()
        const orderMinutesUTC = orderTimeUTC.getUTCMinutes()
        
        // Compare order time with cutoff time (using LOCAL time)
        const orderTimeMinutes = orderHours * 60 + orderMinutes
        const cutoffTimeMinutes = cutoffHours * 60 + cutoffMinutes
        
      
        
        // Zone-based rule logic:
        // - If order time is BEFORE cutoff time → use next_day_offset (from rule) - "Before cutoff offset" in UI
        // - If order time is AFTER or EQUAL to cutoff time → use after_cutoff_offset (from rule) - "After Cutoff Offset" in UI
        const isAfterCutoff = orderTimeMinutes >= cutoffTimeMinutes
        // Order BEFORE cutoff → Use next_day_offset from rule (this is "Before cutoff offset" in UI)
        // Order AFTER cutoff → Use after_cutoff_offset from rule (this is "After Cutoff Offset" in UI)
        const deliveryOffset = isAfterCutoff ? zoneRule.after_cutoff_offset : zoneRule.next_day_offset
        
       
        
        let deliveryText: string
        let deliveryValue: string
        let deliveryColor: string
        let deliveryBgColor: string
        
        if (deliveryOffset === 0) {
          deliveryText = 'Same Day'
          deliveryValue = 'same-day'
          deliveryColor = 'text-orange-600'
          deliveryBgColor = 'bg-orange-100 text-orange-700 border-orange-200'
        } else if (deliveryOffset === 1) {
          deliveryText = '1 day'
          deliveryValue = '1-day'
          deliveryColor = 'text-green-600'
          deliveryBgColor = 'bg-green-100 text-green-700 border-green-200'
        } else if (deliveryOffset === 2) {
          deliveryText = '2 day'
          deliveryValue = '2-day'
          deliveryColor = 'text-blue-600'
          deliveryBgColor = 'bg-blue-100 text-blue-700 border-blue-200'
        } else {
          // Fallback for any other value
          deliveryText = '1 day'
          deliveryValue = '1-day'
          deliveryColor = 'text-green-600'
          deliveryBgColor = 'bg-green-100 text-green-700 border-green-200'
        }
        
        return {
          text: deliveryText,
          color: deliveryColor,
          bgColor: deliveryBgColor,
          value: deliveryValue
        }
      } else { 
      }
    }
     
    const orderTime = new Date(order.order_date)
    
    // Handle UTC to local conversion
    let orderTimeLocal: Date
    const orderDateStr = order.order_date || ''
    if (orderDateStr.includes('T') && !orderDateStr.includes('Z') && !orderDateStr.includes('+') && !orderDateStr.match(/-\d{2}:\d{2}$/)) {
      orderTimeLocal = new Date(orderDateStr + 'Z')
    } else {
      orderTimeLocal = new Date(orderDateStr)
    }
    
    const hours = orderTimeLocal.getHours() 
    
    // Fallback logic: >= 14 hours (2 PM) → "Same Day", else → "1 day"
    if (hours >= 14) {
      return { text: 'Same Day', color: 'text-orange-600', bgColor: 'bg-orange-100 text-orange-700 border-orange-200', value: 'same-day' }
    }
    return { text: '1 day', color: 'text-green-600', bgColor: 'bg-green-100 text-green-700 border-green-200', value: '1-day' }
  }

  // Format status text - capitalize first letter of each word
  const formatStatusText = (status: string | null): string => {
    if (!status) return 'Pending'
    // Split by space, capitalize first letter of each word, rest lowercase
    return status
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Get status color based on OrderManagement.tsx colors
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
      'unable to driver': 'bg-orange-100 text-orange-800 border-orange-300',
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
    
    return statusColors[statusLower] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const handleDeliveryTimeChange = async (orderId: number, deliveryTime: string) => {
    try {
      // Fetch order details before updating
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle()

      if (fetchError) throw fetchError

      const deliveryValue = deliveryTime === 'same-day' ? 'Same Day' : deliveryTime === '1-day' ? '1 day' : deliveryTime === '2-day' ? '2 day' : '1 day'
      const { error } = await supabase
        .from('orders')
        .update({ delivery_day_date: deliveryValue })
        .eq('id', orderId)

      if (error) throw error
      toast.success('Delivery time preference updated')

      // Send notification to customer and driver
      if (orderData) {
        const order: Order = {
          id: orderData.id,
          order_name: orderData.order_name,
          logo: orderData.logo || null,
          special_event_logo: orderData.special_event_logo || null,
          customer_id: orderData.customer_id,
          po_number: orderData.po_number || null,
          order_date: orderData.order_date || null,
          delivery_date: orderData.delivery_date || null,
          delivery_day_date: orderData.delivery_day_date || null,
          deliveryStatus: orderData.deliveryStatus || orderData.status || null,
          driver_id: orderData.driver_id,
          quantity: orderData.quantity || null,
          delivery_address: orderData.delivery_address || null,
          special_instructions: orderData.special_instructions || null,
          notes: orderData.notes || null,
          stop_number: orderData.stop_number || null,
          stop_number_position: orderData.stop_number_position || null,
          franchise_id: orderData.franchise_id || null,
          created_at: orderData.created_at || null,
          unable_to_deliver_reason: orderData.unable_to_deliver_reason || null,
          status_change_count: orderData.status_change_count || 1,
        }
        await sendDeliveryTimeChangeNotification(order, deliveryTime)
      }

      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
    } catch (error: any) {
      console.error('Error updating delivery time:', error)
      toast.error(error.message || 'Error updating delivery time')
    }
  }

  const handleStopNumberChange = async (orderId: number, stopNumber: string) => {
    try {
      if (!stopNumber || stopNumber.trim() === '') {
        // Allow clearing stop number (setting to null)
        const { error } = await supabase
          .from('orders')
          .update({ stop_number: null })
          .eq('id', orderId)

        if (error) throw error
        toast.success('Stop number cleared')
        // if (staffInfo) {
        //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
        // }
        setEditingStopNumber(null)
        setStopNumberValue('')
        return
      }

      const numValue = parseInt(stopNumber)
      
      // Check if stop number is already used by another order
      const existingOrder = orders.find(
        (o) => o.stop_number === numValue && o.id !== orderId
      )
      
      if (existingOrder) {
        toast.error(`Stop number ${numValue} is already assigned to order ${existingOrder.order_name}`)
        setEditingStopNumber(null)
        setStopNumberValue('')
        return
      }

      const { error } = await supabase
        .from('orders')
        .update({ stop_number: numValue })
        .eq('id', orderId)

      if (error) throw error
      toast.success('Stop number updated')
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      setEditingStopNumber(null)
      setStopNumberValue('')
    } catch (error: any) {
      console.error('Error updating stop number:', error)
      toast.error(error.message || 'Error updating stop number')
      setEditingStopNumber(null)
      setStopNumberValue('')
    }
  }

  const handleClearAllStopNumbers = () => {
    const filtered = getFilteredOrders()
    const ordersWithStopNumbers = filtered.filter(o => o.stop_number !== null)
    
    if (ordersWithStopNumbers.length === 0) {
      toast.info('No orders with stop numbers to clear')
      return
    }

    // Open confirmation dialog
    setOrdersToClearCount(ordersWithStopNumbers.length)
    setIsClearStopNumbersDialogOpen(true)
  }

  const confirmClearAllStopNumbers = async () => {
    try {
      const filtered = getFilteredOrders()
      const ordersWithStopNumbers = filtered.filter(o => o.stop_number !== null)
      
      if (ordersWithStopNumbers.length === 0) {
        toast.info('No orders with stop numbers to clear')
        setIsClearStopNumbersDialogOpen(false)
        return
      }

      // Update all orders to clear stop_number
      const orderIds = ordersWithStopNumbers.map(o => o.id)
      const { error } = await supabase
        .from('orders')
        .update({ stop_number: null })
        .in('id', orderIds)

      if (error) throw error
      
      toast.success(`Stop numbers cleared for ${orderIds.length} order(s)`)
      
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      
      setIsClearStopNumbersDialogOpen(false)
      setOrdersToClearCount(0)
    } catch (error: any) {
      console.error('Error clearing stop numbers:', error)
      toast.error(error.message || 'Error clearing stop numbers')
    }
  }

  // Handle drag start - set active id for overlay
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number)
  }

  // Handle drag end - update stop_number_position and stop_number in database
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const filtered = getFilteredOrders()
    const oldIndex = filtered.findIndex((order) => order.id === active.id)
    const newIndex = filtered.findIndex((order) => order.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Reorder the filtered orders array
    const reorderedOrders = arrayMove(filtered, oldIndex, newIndex)

    // Update local state immediately for smooth UX (optimistic update)
    setOrders((prevOrders) => {
      const updatedOrders = [...prevOrders]
      reorderedOrders.forEach((reorderedOrder, index) => {
        const orderIndex = updatedOrders.findIndex((o) => o.id === reorderedOrder.id)
        if (orderIndex !== -1) {
          const newPosition = index + 1
          updatedOrders[orderIndex] = {
            ...updatedOrders[orderIndex],
            stop_number_position: newPosition,
            stop_number: newPosition, // Auto-update stop_number to match position
          }
        }
      })
      return updatedOrders
    })

    // Update positions and stop numbers in database (async, non-blocking)
    try {
      // Update all orders with new positions and stop numbers
      const updates = reorderedOrders.map((order, index) => ({
        id: order.id,
        stop_number_position: index + 1,
        stop_number: index + 1, // Auto-set stop_number to match position
      }))

      // Batch update all orders in parallel for better performance
      const updatePromises = updates.map((update) =>
        supabase
          .from('orders')
          .update({ 
            stop_number_position: update.stop_number_position,
            stop_number: update.stop_number 
          })
          .eq('id', update.id)
      )

      const results = await Promise.all(updatePromises)
      
      // Check for errors
      const hasError = results.some((result) => result.error)
      if (hasError) {
        console.error('Some order positions/stop numbers failed to update')
        // Refresh data on error to sync with database
        // if (staffInfo) {
        //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
        // }
      } else {
        toast.success(`Stop numbers updated for ${updates.length} order(s)`)
      }
    } catch (error: any) {
      console.error('Error updating order positions/stop numbers:', error)
      toast.error('Error updating stop numbers')
      // Refresh data on error to sync with database
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
    }
  }

  const handlePrintPackingSlip = (order: Order) => {
    const customer = getCustomerInfo(order.customer_id)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const now = new Date()
    const printDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
    const printTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    
    // Parse delivery address
    let deliveryAddress = '—'
    let deliveryCity = ''
    let deliveryState = ''
    let deliveryZip = ''
    if (order.delivery_address) {
      try {
        const addr = typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : order.delivery_address
        if (Array.isArray(addr) && addr.length > 0) {
          const selectedAddr = addr.find((a: any) => a.isSelected) || addr[0]
          deliveryAddress = selectedAddr.street || ''
          deliveryCity = selectedAddr.city || ''
          deliveryState = selectedAddr.state || ''
          deliveryZip = selectedAddr.zipCode || selectedAddr.zip || ''
        } else if (typeof addr === 'object' && addr !== null) {
          deliveryAddress = addr.street || ''
          deliveryCity = addr.city || ''
          deliveryState = addr.state || ''
          deliveryZip = addr.zipCode || addr.zip || ''
        }
      } catch {
        deliveryAddress = typeof order.delivery_address === 'string' ? order.delivery_address : '—'
      }
    }

    const fullAddress = [deliveryAddress, deliveryCity, deliveryState, deliveryZip].filter(Boolean).join(', ')

    // Check if special event order
    const isSpecialEvent = order.special_instructions?.toLowerCase().includes('event') || 
                          order.special_instructions?.toLowerCase().includes('branding')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Packing Slip - ${order.order_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #000;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }
            .header-left {
              font-size: 12px;
              color: #666;
            }
            .header-right {
              font-size: 14px;
              font-weight: bold;
            }
            .company-name {
              text-align: center;
              color: #0066cc;
              font-size: 24px;
              font-weight: bold;
              margin: 10px 0;
            }
            .packing-slip-title {
              text-align: center;
              font-size: 18px;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 10px;
            }
            .blue-line {
              height: 2px;
              background-color: #0066cc;
              margin: 15px 0;
            }
            .order-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
            }
            .order-number {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .order-number-bar {
              width: 4px;
              height: 30px;
              background-color: #0066cc;
            }
            .order-date {
              font-size: 14px;
            }
            .special-event-alert {
              background-color: #fff3cd;
              border: 2px solid #ffc107;
              border-radius: 4px;
              padding: 12px;
              margin: 15px 0;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .warning-icon {
              font-size: 20px;
            }
            .alert-text {
              font-weight: bold;
              color: #856404;
            }
            .address-section {
              display: flex;
              gap: 20px;
              margin: 20px 0;
            }
            .address-box {
              flex: 1;
              background-color: #fff;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 15px;
            }
            .address-title {
              font-weight: bold;
              margin-bottom: 10px;
              font-size: 14px;
            }
            .order-details-title {
              color: #0066cc;
              font-weight: bold;
              text-transform: uppercase;
              margin: 20px 0 10px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #f5f5f5;
              padding: 10px;
              text-align: left;
              border: 1px solid #ddd;
              font-weight: bold;
            }
            td {
              padding: 10px;
              border: 1px solid #ddd;
            }
            .order-notes {
              background-color: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 4px;
              padding: 15px;
              margin: 20px 0;
            }
            .notes-title {
              font-weight: bold;
              text-transform: uppercase;
              color: #856404;
              margin-bottom: 10px;
            }
            .notes-content {
              font-size: 14px;
              color: #333;
            }
            .notes-author {
              text-align: right;
              margin-top: 10px;
              font-size: 12px;
              color: #666;
            }
            .footer { 
              margin-top: 30px;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body> 
          
          <div class="company-name">CoconutStock</div>
          <div class="packing-slip-title">PACKING SLIP</div>
          <div class="blue-line"></div>
          
          <div class="order-info">
            <div class="order-number">
              <div class="order-number-bar"></div>
              <div>
                <div style="font-weight: bold;">Order #${order.order_name}</div>
              </div>
            </div>
            <div class="order-date">${fullDate}</div>
          </div>
          
          ${isSpecialEvent ? `
            <div class="special-event-alert">
              <span class="warning-icon">⚠️</span>
              <span class="alert-text">SPECIAL EVENT ORDER - CUSTOM BRANDING</span>
            </div>
          ` : ''}
          
          <div class="address-section">
            <div class="address-box">
              <div class="address-title">FROM</div>
              <div>CoconutStock</div>
              <div>Warehouse Department</div>
              <div>CoconutStock HQ - Primary Store</div>
            </div>
            <div class="address-box">
              <div class="address-title">SHIP TO</div>
              <div>${customer?.company_name || '—'}</div>
              <div>Contact: ${customer ? `${customer.first_name} ${customer.last_name}` : '—'}</div>
              <div>Address: ${fullAddress || '—'}</div>
            </div>
          </div>
          
          <div class="order-details-title">ORDER DETAILS</div>
          <table>
            <thead>
              <tr>
                <th>PRODUCT TYPE</th>
                <th>QUANTITY</th>
                <th>ORDER DATE</th>
                <th>DELIVERY DATE</th>
                <th>PO NUMBER</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Case</td>
                <td>${order.quantity || 0} Cases</td>
                <td>${order.order_date ? new Date(order.order_date).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                <td>${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'}</td>
                <td>${order.po_number || '—'}</td>
              </tr>
            </tbody>
          </table>
          
          ${order.special_instructions ? `
            <div class="order-notes">
              <div class="notes-title">ORDER NOTES</div>
              <div class="notes-content">
     ${order.special_instructions}
              </div>
              ${staffInfo?.staffEmail ? `
                <div class="notes-author">${staffInfo.staffEmail.split('@')[0]} Warehouse</div>
              ` : ''}
            </div>
          ` : ''}
          
          <div class="footer" style="text-align: center;"> 
            <div style="text-align: center;">Printed on ${now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })} <br /> CoconutStock Warehouse Management System</div>
           </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handleCancelOrder = async () => {
    if (!orderToCancel) return

    try {
      // Get order details before updating
      const order = orders.find(o => o.id === orderToCancel)
      const previousStatus = (order?.deliveryStatus || '').toLowerCase()
      const newStatus = 'cancelled'
      
      // Only increment status_change_count if status actually changed
      const statusChanged = previousStatus !== newStatus
      const currentCount = Number(order?.status_change_count) || 1
      const newCount = statusChanged ? currentCount + 1 : currentCount
      
      const updatePayload: any = {
        deliveryStatus: newStatus,
      }
      
      // Only update status_change_count if status changed
      if (statusChanged) {
        updatePayload.status_change_count = newCount
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderToCancel)

      if (error) throw error
      
      toast.success('Order cancelled successfully')
      
      // Send notification to driver and customer
      if (order) {
        await sendStatusChangeNotification(order, 'Cancelled')
      }
      
      // if (staffInfo) {
      //   await fetchData(staffInfo.isSuperAdmin, staffInfo.franchiseId)
      // }
      setIsCancelOrderDialogOpen(false)
      setOrderToCancel(null)
      setViewOrderId(null)
    } catch (error: any) {
      console.error('Error cancelling order:', error)
      toast.error(error.message || 'Error cancelling order')
    }
  }

  const statusCounts = getStatusCounts()
  const filteredOrders = useMemo(() => getFilteredOrders(), [orders, statusFilter, searchTerm, viewMode, sortByStopNumber, customers])

  const scrollToOrdersTabs = () => {
    ordersTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!staffInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-8xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Warehouse Module</h1>
                <p className="text-sm text-gray-600">CoconutStock HQ</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700">
              <Package className="h-5 w-5" />
              <span className="font-medium">{statusCounts.total} Total Orders</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enable Notification Sound (shown on entry) */}
      <Dialog
        open={isEnableSoundDialogOpen}
        onOpenChange={(open) => {
          // If user already enabled sound before, don't reopen modal
          if (!open) setIsEnableSoundDialogOpen(false)
          else if (!soundEnabledPreference && !isAudioUnlocked) setIsEnableSoundDialogOpen(true)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enable order notification sound?</DialogTitle>
            <DialogDescription>
              We can play a short sound whenever a new order arrives in real time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                Your browser requires a user action to enable sound. Click{" "}
                <span className="font-semibold">Enable sound</span> below to turn it on.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEnableSoundDialogOpen(false)}
            >
              Not now
            </Button>
            <Button
              onClick={async () => {
                const ok = await unlockNotificationAudio()
                if (ok) {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(SOUND_ENABLED_KEY, 'true')
                  }
                  setSoundEnabledPreference(true)
                  setIsEnableSoundDialogOpen(false)
                  toast.success('Notification sound enabled')
                } else {
                  toast.error('Please click again to enable sound')
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Enable sound
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-8xl mx-auto px-6 py-6">
        {/* Summary Cards — click switches tab + scrolls to order list (same page) */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('Pending Orders')
              scrollToOrdersTabs()
            }}
            className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500 text-left w-full hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Orders</p>
                <p className="text-3xl font-bold text-gray-900">{statusCounts.pending}</p>
              </div>
              <Clock className="h-12 w-12 text-yellow-500" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('Dispatched')
              scrollToOrdersTabs()
            }}
            className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500 text-left w-full hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Dispatched</p>
                <p className="text-3xl font-bold text-gray-900">{statusCounts.dispatched}</p>
              </div>
              <Truck className="h-12 w-12 text-green-500" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('Completed')
              scrollToOrdersTabs()
            }}
            className="bg-white rounded-lg shadow-md p-6 border-l-4 border-emerald-500 text-left w-full hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed Orders</p>
                <p className="text-3xl font-bold text-gray-900">{statusCounts.completed}</p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search by Order ID, Customer, or PO Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-300"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div ref={ordersTabsRef} className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto scroll-mt-24">
          <button
            onClick={() => setStatusFilter('Today Orders')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'Today Orders'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today Orders
          </button>
          <button
            onClick={() => setStatusFilter('Upcoming Orders')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'Upcoming Orders'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upcoming Orders
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'all'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Orders
          </button>
          <button
            onClick={() => setStatusFilter('Pending Orders')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'Pending Orders'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending Orders
          </button>
          <button
            onClick={() => setStatusFilter('Processing')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'Processing'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Processing
          </button>
          <button
            onClick={() => setStatusFilter('Dispatched')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'Dispatched'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Dispatched
          </button>
          <button
            onClick={() => setStatusFilter('In Transit')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'In Transit'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            In Transit
          </button>
          <button
            onClick={() => setStatusFilter('Completed')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'Completed'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter('Cancelled')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'Cancelled'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Cancelled
          </button>
          <button
            onClick={() => setStatusFilter('Undelivered')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'Undelivered'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Undelivered
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedOrders.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">
                {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedOrders(new Set())}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Clear Selection
              </button>
            </div>
            <div className="flex items-center gap-3">
              
              {(() => {
                const selectedOrdersList = Array.from(selectedOrders)
                // Disable bulk assign when all selected are Completed/Cancelled
                const hasAssignableOrder = selectedOrdersList.some(orderId => {
                  const order = orders.find(o => o.id === orderId)
                  const statusLower = (order?.deliveryStatus || '').toLowerCase()
                  return statusLower !== 'completed' && statusLower !== 'cancelled'
                })

                const isDisabled = !hasAssignableOrder || selectedOrdersList.length === 0

                return (
                  <Button
                    onClick={() => {
                      if (isDisabled) return
                      setIsAssignDriverDialogOpen(true)
                    }}
                    disabled={isDisabled}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Truck className="h-4 w-4" />
                    Assign Driver to {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
                  </Button>
                )
              })()}
              {(() => {
                // Check if any selected orders have "driver assigned" status
                const selectedOrdersList = Array.from(selectedOrders)
                const driverAssignedCount = selectedOrdersList.filter(orderId => {
                  const order = orders.find(o => o.id === orderId)
                  const statusLower = (order?.deliveryStatus || '').toLowerCase()
                  return statusLower === 'driver assigned'
                }).length
                
                if (driverAssignedCount > 0) {
                  return (
                    <Button
                      onClick={() => handleBulkMarkDispatched(selectedOrdersList)}
                      disabled={loadingAssignDriver}
                      className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                    >
                      {loadingAssignDriver ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Truck className="h-4 w-4" />
                          Mark {driverAssignedCount} as Dispatched
                        </>
                      )}
                    </Button>
                  )
                }
                return null
              })()}
            </div>
          </div>
        )}

        {/* Orders Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Orders for Processing</h2>
            <p className="text-sm text-gray-600">{filteredOrders.length} orders to display</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-all"
                checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="select-all" className="text-sm text-gray-700">Select All</label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSortByStopNumber}
              className={`flex items-center gap-2 ${
                sortByStopNumber === 'asc' ? 'bg-blue-50 border-blue-300' : 
                sortByStopNumber === 'desc' ? 'bg-blue-50 border-blue-300' : ''
              }`}
            >
              <ArrowUpDown className="h-4 w-4" />
              Sort by Stop # {sortByStopNumber === 'asc' ? '(↑)' : sortByStopNumber === 'desc' ? '(↓)' : ''}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAllStopNumbers}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <X className="h-4 w-4" />
              Clear Stop #
            </Button>
            <div className="flex items-center gap-1 border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Orders Display */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredOrders.map((order) => {
              const customer = getCustomerInfo(order.customer_id)
              const driver = getDriverInfo(order.driver_id)
              const isNew = isNewOrder(order)
              const isUndelivered = isUndeliveredOldOrder(order)
              const deliveryTag = getDeliveryTag(order)
              const statusLower = order.deliveryStatus?.toLowerCase() || ''
              const isPending = statusLower === 'processing' || statusLower === 'pending payment'
              const isReady = statusLower === 'in transit' || statusLower === 'driver assigned'
              const isDispatched =  statusLower === 'completed'
              const isUnableToDeliver = statusLower === 'undelivered'
              const borderColor = isUnableToDeliver ? 'border-t-red-500' : isPending ? 'border-t-yellow-500' : isReady ? 'border-t-blue-500' : isDispatched ? 'border-t-green-500' : 'border-t-gray-300'

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-lg shadow-md overflow-hidden ${isNew && statusFilter === 'Today Orders' ? 'border-2 border-red-500' : isUndelivered && statusFilter === 'Today Orders' ? 'border-2 border-orange-500' : `border-t-4 ${borderColor} border border-gray-200`}`}
                >
                  {isNew && statusFilter === 'Today Orders' && (
                    <div className="bg-red-500 text-white px-4 py-2 flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <span className="font-semibold text-sm">NEW ORDER</span>
                    </div>
                  )}
                  {isUndelivered && statusFilter === 'Today Orders' && (
                    <div className="bg-orange-500 text-white px-4 py-2 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="font-semibold text-sm">UNDELIVERED</span>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                    <div className="w-[60%]">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                        id={`select-order-${order.id}`}
                        name={`select-order-${order.id}`}
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => handleSelectOrder(order.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                        />
                        <label htmlFor={`select-order-${order.id}`} className="text-sm text-gray-700">Select for bulk action</label>
                        </div>
                      <div className="flex items-center gap-3 mb-3">
                      
                        <div>
                          <h3 className="font-bold text-base">{order.order_name}</h3>
                          {customer && (
                            <>
                              <p className="text-sm font-medium text-gray-900">{customer.company_name}</p>
                              <p className="text-xs text-gray-600">{customer.first_name} {customer.last_name}</p>
                            </>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const isLockedStatus = statusLower === 'completed' || statusLower === 'cancelled'
                        const hasDriver = hasDriverAssignedForStatus(order)

                        // Completed / Cancelled: read-only status pill (no dropdown)
                        if (isLockedStatus) {
                          return (
                            <div
                              className={`w-[160px] h-8 flex items-center justify-center rounded-md text-sm border ${getStatusColor(order.deliveryStatus)} bg-gray-100 cursor-not-allowed`}
                            >
                              {formatStatusText(order.deliveryStatus)}
                            </div>
                          )
                        }

                        // Editable dropdown for other statuses
                        return (
                          <Select 
                            value={order.deliveryStatus || 'pending'} 
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                          >
                            <SelectTrigger className={`w-[160px] ${getStatusColor(order.deliveryStatus)}`}>
                              <SelectValue>{formatStatusText(order.deliveryStatus)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              {/* Hide "Driver Assigned" as manual option in grid view */}
                              {/* <SelectItem value="driver assigned">Driver Assigned</SelectItem> */}
                              <SelectItem value="dispatched" disabled={!hasDriver}>
                                Dispatched
                              </SelectItem>
                              <SelectItem value="in transit" disabled={!hasDriver}>
                                In Transit
                              </SelectItem>
                              <SelectItem value="completed" disabled={!hasDriver}>
                                Completed
                              </SelectItem>
                              <SelectItem value="undelivered">Undelivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                              {/* <SelectItem value="pending payment">Pending Payment</SelectItem>
                              <SelectItem value="closed / paid">Closed / Paid</SelectItem> */}
                            </SelectContent>
                          </Select>
                        )
                      })()}
                    </div>

                    <div className="w-[40%] mb-3">
                    {(order.special_event_logo || order.logo || (customer?.company_id && companyLogoMap.get(customer.company_id))) ? (
                      <img
                        src={order.special_event_logo || order.logo || (customer?.company_id ? companyLogoMap.get(customer.company_id) || '' : '')}
                        alt={order.order_name || 'Order'}
                        className="w-full h-32 object-cover rounded"
                      />
                      ) : (
                        <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center text-center">
                          <span className="text-gray-400 text-sm">No Image</span>
                        </div>
                      )}
                    </div>
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quantity:</span>
                        <span className="font-medium">{order.quantity || 0} Cases</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Order Date & Time:</span>
                        <span className="font-medium">
                          {formatLocalDateTime(order.order_date)}
                        </span>
                      </div>
                      {deliveryTag && !isFutureOrderDate(order.order_date) && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Delivery:</span>
                          <Select
                            value={deliveryTag.value || (deliveryTag.text === 'Same Day' ? 'same-day' : deliveryTag.text === '1 day' ? '1-day' : deliveryTag.text === '2 day' ? '2-day' : '1-day')}
                            onValueChange={(value) => handleDeliveryTimeChange(order.id, value)}
                          >
                            <SelectTrigger className={`h-7 text-xs w-[120px] ${deliveryTag.bgColor} border`}>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="same-day">Same Day</SelectItem>
                              <SelectItem value="1-day">1 day</SelectItem>
                              <SelectItem value="2-day">2 day</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )} 
                      {order.po_number && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">PO Number:</span>
                          <span className="font-medium">{order.po_number}</span>
                        </div>
                      )}
                      {order.stop_number && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Stop #:</span>
                          <span className="font-medium">{order.stop_number}</span>
                        </div>
                      )}
                    </div>

                    <div className=" grid grid-cols-1 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewOrderId(order.id)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOrderForNotes(order.id)
                          setNotes(order.notes || '')
                          setIsNotesDialogOpen(true)
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Notes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={statusLower === 'completed' || statusLower === 'cancelled'}
                        onClick={() => {
                          if (statusLower === 'completed' || statusLower === 'cancelled') return
                          setSelectedOrders(new Set([order.id]))
                          setIsAssignDriverDialogOpen(true)
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Assign Driver
                      </Button>
                       
                      {statusLower !== 'in transit' && statusLower !== 'completed' && (
                        <>
                           
                          {isReady && (
                          <Button
                            onClick={() => {
                              setOrderToDispatch(order.id)
                              setIsDispatchedDialogOpen(true)
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white flex-1"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Mark as Dispatched
                          </Button>
                          )}
                        </>
                      )}
                      {statusLower === 'in transit' && (
                        <Button
                          onClick={() => {
                            setOrderToDispatch(order.id)
                            setIsDispatchedDialogOpen(true)
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white flex-1"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Mark as Dispatched
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {filteredOrders.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                No orders found.
              </div>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredOrders.map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const customer = getCustomerInfo(order.customer_id)
                  const deliveryTag = getDeliveryTag(order)
                  const statusLower = order.deliveryStatus?.toLowerCase() || ''
                  const isPending = statusLower === 'processing' || statusLower === 'pending payment'
                  const isReady = statusLower === 'in transit' || statusLower === 'driver assigned'
                  const isDispatched = statusLower === 'completed'
                  const isUnableToDeliver = statusLower === 'undelivered'
                  const borderColor = isUnableToDeliver ? 'border-l-red-500' : isPending ? 'border-l-yellow-500' : isReady ? 'border-l-blue-500' : isDispatched ? 'border-l-green-500' : 'border-l-gray-300'
                  const isNew = isNewOrder(order)
                  const isUndelivered = isUndeliveredOldOrder(order)

                  return (
                    <SortableOrderItem
                      key={order.id}
                      order={order}
                      customer={customer}
                      deliveryTag={deliveryTag}
                      statusLower={statusLower}
                      isPending={isPending}
                      isReady={isReady}
                      isDispatched={isDispatched}
                      borderColor={borderColor}
                      isNew={isNew}
                      isUndelivered={isUndelivered}
                      statusFilter={statusFilter}
                      selectedOrders={selectedOrders}
                      editingStopNumber={editingStopNumber}
                      stopNumberValue={stopNumberValue}
                      onSelectOrder={handleSelectOrder}
                      onStatusChange={handleStatusChange}
                      onDeliveryTimeChange={handleDeliveryTimeChange}
                      onStopNumberChange={handleStopNumberChange}
                      onSetEditingStopNumber={setEditingStopNumber}
                      onSetStopNumberValue={setStopNumberValue}
                      onViewOrder={setViewOrderId}
                      onOpenNotes={(id) => {
                        setOrderForNotes(id)
                        setNotes(orders.find(o => o.id === id)?.notes || '')
                              setIsNotesDialogOpen(true)
                            }}
                      onAssignDriver={(id) => {
                        setSelectedOrders(new Set([id]))
                              setIsAssignDriverDialogOpen(true)
                            }}
                      onMarkReady={(id) => {
                        setOrderToReady(id)
                                setIsReadyDialogOpen(true)
                              }}
                      onSetStopNumber={(id) => {
                        setOrderForStopNumber(id)
                        setStopNumber(orders.find(o => o.id === id)?.stop_number?.toString() || '')
                                  setIsStopNumberDialogOpen(true)
                                }}
                      onMarkDispatched={(id) => {
                        setOrderToDispatch(id)
                                  setIsDispatchedDialogOpen(true)
                                }}
                      getStatusColor={getStatusColor}
                      formatStatusText={formatStatusText}
                      formatLocalDateTime={formatLocalDateTime}
                      getDriverInfo={getDriverInfo}
                      companyLogoMap={companyLogoMap}
                    />
                  )
                })}
                {filteredOrders.length === 0 && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                      No orders found.
                  </div>
                )}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (() => {
                const order = filteredOrders.find(o => o.id === activeId)
                const customer = order ? getCustomerInfo(order.customer_id) : null
                const statusLower = order?.deliveryStatus?.toLowerCase() || ''
                const isPending = statusLower === 'processing' || statusLower === 'pending payment'
                const isReady = statusLower === 'in transit' || statusLower === 'driver assigned'
                const isDispatched = statusLower === 'completed'
                const isUnableToDeliver = statusLower === 'undelivered'
                const borderColor = isUnableToDeliver ? 'border-l-red-500' : isPending ? 'border-l-yellow-500' : isReady ? 'border-l-blue-500' : isDispatched ? 'border-l-green-500' : 'border-l-gray-300'
                
                if (!order) return null
                
                return (
                  <div className={`bg-white rounded-lg shadow-lg border-l-4 ${borderColor} border border-gray-200 opacity-95 rotate-2`} style={{ width: '100%' }}>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-4"></div>
                        <div className="w-12 h-12 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                          {(order.special_event_logo || order.logo || (customer?.company_id && companyLogoMap.get(customer.company_id))) ? (
                            <img src={order.special_event_logo || order.logo || (customer?.company_id ? companyLogoMap.get(customer.company_id) || '' : '')} alt={order.order_name || 'Order'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">No Image</span>
          </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 w-[160px]">
                          <p className="font-semibold text-sm text-gray-900 leading-tight">{order.order_name}</p>
                          {customer && (
                            <div className="mt-0.5">
                              <p className="font-medium text-xs text-gray-900 leading-tight">{customer.company_name}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })() : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Assign Driver Dialog */}
        <Dialog open={isAssignDriverDialogOpen} onOpenChange={setIsAssignDriverDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Driver to Multiple Orders</DialogTitle>
              <DialogDescription>
                Select a driver to assign to {selectedOrders.size} selected order{selectedOrders.size > 1 ? 's' : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Selected Orders:</label>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedOrders).map(orderId => {
                      const order = orders.find(o => o.id === orderId)
                      return (
                        <div key={orderId} className="bg-blue-100 flex gap-2 items-center text-blue-800 px-3 py-1 rounded-full text-sm">
                          <span>
                          {order?.order_name || `Order ${orderId}`}
                          </span>
                          {order?.driver_name && (
                              <div className="flex items-center gap-1 ml-2">
                                <span className="text-blue-500">•</span>
                                <span className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full">
                                  🚚 {order.driver_name}
                                </span>
                              </div>
                            )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Select Driver</label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {drivers.map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => setSelectedDriver(driver.id.toString())}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedDriver === driver.id.toString()
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{driver.driver_name}</p>
                          <p className="text-sm text-gray-600">{driver.phone_number}</p>
                        </div>
                        {(() => {
                          // Determine driver status based on orders table:
                          // If this driver has ANY active orders (not completed/cancelled/closed/undelivered),
                          // show "Assigned", otherwise show "Available".
                          const activeStatuses = new Set([
                            'pending',
                            'processing',
                            'driver assigned',
                            'dispatched',
                            'in transit',
                            'pending payment',
                          ])

                          const hasActiveOrders = orders.some(order => {
                            if (order.driver_id !== driver.id) return false
                            const statusLower = (order.deliveryStatus || '').toLowerCase()
                            return activeStatuses.has(statusLower)
                          })

                          const displayStatus = hasActiveOrders ? 'Assigned' : 'Available'
                          const badgeClass =
                            displayStatus === 'Assigned'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'

                          return (
                            <Badge className={badgeClass}>
                              {displayStatus}
                            </Badge>
                          )
                        })()}
                      </div>
                    </button>
                  ))}
                  {drivers.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No drivers available</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelAssignDriver}>
                Cancel
              </Button>
              <Button
                onClick={() => handleAssignDriver(Array.from(selectedOrders))}
                disabled={!selectedDriver || selectedOrders.size === 0 || loadingAssignDriver}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loadingAssignDriver ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                <Truck className="h-4 w-4 mr-2" />
                Assign to {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ready to Dispatch Confirmation */}
        <Dialog open={isReadyDialogOpen} onOpenChange={setIsReadyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Ready to Dispatch?</DialogTitle>
              <DialogDescription>
                Are you sure you want to mark this order as Ready to Dispatch?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReadyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => orderToReady && handleMarkReady(orderToReady)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Mark as Ready
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dispatched Confirmation */}
        <Dialog open={isDispatchedDialogOpen} onOpenChange={setIsDispatchedDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Dispatched?</DialogTitle>
              <DialogDescription>
                Are you sure you want to mark this order as Dispatched?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDispatchedDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => orderToDispatch && handleMarkDispatched(orderToDispatch)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Mark as Dispatched
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Set Stop Number Dialog */}
        <Dialog open={isStopNumberDialogOpen} onOpenChange={setIsStopNumberDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Stop Number</DialogTitle>
              <DialogDescription>
                Enter the stop number for this delivery route.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Stop Number</label>
                <Input
                  type="number"
                  placeholder="Enter stop number"
                  value={stopNumber}
                  onChange={(e) => setStopNumber(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStopNumberDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSetStopNumber}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Set Stop Number
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Notes Dialog */}
        <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Order Notes</DialogTitle>
              <DialogDescription>
                Add or edit warehouse notes for this order.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Warehouse Notes</label>
                <textarea
                  className="w-full min-h-[200px] p-3 border border-gray-300 rounded-md"
                  placeholder="Enter warehouse notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">These notes will be saved in the order record.</p>
              </div>
              {orderForNotes && (() => {
                const order = orders.find(o => o.id === orderForNotes)
                return order?.special_instructions ? (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Existing Order Notes</label>
                    <div className="w-full min-h-[100px] p-3 border border-gray-200 rounded-md bg-gray-50">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.special_instructions}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">These are the original order notes (read-only).</p>
                  </div>
                ) : null
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveNotes}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save Warehouse Notes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Order Confirmation Dialog */}
        <Dialog open={isCancelOrderDialogOpen} onOpenChange={(open) => {
          setIsCancelOrderDialogOpen(open)
          if (!open) setOrderToCancel(null)}}
        >
          <DialogContent className="max-w-md">
              <DialogHeader>
              <DialogTitle>Are you sure you want to cancel this order?</DialogTitle>
              <DialogDescription>
              Please confirm before proceeding. This action cannot be undone. Only click ‘Confirm’ if you are certain you want to cancel this order.
              </DialogDescription>
              </DialogHeader>
            <div className="space-y-4 py-4"> 
              
              {orderToCancel && (() => {
                const order = orders.find(o => o.id === orderToCancel)
                const customer = order ? getCustomerInfo(order.customer_id) : null
                return order ? (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <div className="text-red-600 mt-0.5">
                      <X className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 mb-1">Order ID: {order.order_name}</p>
                      <p className="text-sm text-gray-700">Customer: {customer?.company_name || '—'}</p>
                      <p className="text-sm text-gray-700">Quantity: {order.quantity || 0} Cases</p>
                    </div>
                  </div>
                ) : null
              })()}
               
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCancelOrderDialogOpen(false)
                  setOrderToCancel(null)
                }}
              >
                No, keep order
              </Button>
              <Button
                onClick={handleCancelOrder}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Yes, cancel order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear Stop Numbers Confirmation Dialog */}
        <Dialog open={isClearStopNumbersDialogOpen} onOpenChange={setIsClearStopNumbersDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Clear Stop Numbers</DialogTitle>
              <DialogDescription>
                Are you sure you want to clear stop numbers for all orders?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-600">
                This will clear stop numbers for <span className="font-semibold">{ordersToClearCount} order(s)</span>. This action cannot be undone.
              </p>
              
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <div className="text-yellow-600 mt-0.5">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  All stop numbers will be permanently cleared and cannot be restored.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsClearStopNumbersDialogOpen(false)
                  setOrdersToClearCount(0)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmClearAllStopNumbers}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Yes, Clear Stop Numbers
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Undelivered Dialog */}
        <Dialog open={isUnableToDeliverDialogOpen} onOpenChange={setIsUnableToDeliverDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Undelivered</DialogTitle>
              <DialogDescription>
                Please provide a reason why this order cannot be delivered.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Reason</label>
                <textarea
                  className="w-full min-h-[150px] p-3 border border-gray-300 rounded-md"
                  placeholder="Enter reason for unable to deliver..."
                  value={unableToDeliverReason}
                  onChange={(e) => setUnableToDeliverReason(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">This reason will be saved with the order.</p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsUnableToDeliverDialogOpen(false)
                  setOrderForUnableToDeliver(null)
                  setUnableToDeliverReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveUnableToDeliver}
                disabled={!unableToDeliverReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Save & Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Order Details - Enhanced Modal */}
        {viewOrderId && (
          <Dialog open={!!viewOrderId} onOpenChange={() => setViewOrderId(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
              {(() => {
                const order = orders.find(o => o.id === viewOrderId)
                const customer = order ? getCustomerInfo(order.customer_id) : null
                const driver = order ? getDriverInfo(order.driver_id) : null
                const deliveryTag = order ? getDeliveryTag(order) : null
                const statusLower = order?.deliveryStatus?.toLowerCase() || ''
                const isPending = statusLower === 'pending' || statusLower === 'pending payment'
                const isReady = statusLower === 'processing' || statusLower === 'driver assigned'
                const isDispatched = statusLower === 'in transit' || statusLower === 'completed'

                if (!order) return <p>Order not found</p>

                return (
                  <div className="space-y-0">
                    {/* Header */}
                    <DialogHeader className="px-6 pt-6 pb-4 border-b">
                      <div className="flex items-start justify-between">
                      <div>
                          <DialogTitle className="text-2xl font-bold">Order Details</DialogTitle>
                          <DialogDescription className="mt-1">
                            View comprehensive information about this order.
                          </DialogDescription>
                      </div>
                      </div>
                    </DialogHeader>

                    <div className="px-6 py-4">
                      {/* Order ID and Status */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                            <Box className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{order.order_name}</p>
                      {customer && (
                              <p className="text-sm text-gray-600">{customer.company_name}</p>
                            )}
                          </div>
                        </div>
                        {(() => {
                          const statusLower = (order.deliveryStatus || '').toLowerCase()
                          const isLockedStatus = statusLower === 'completed' || statusLower === 'cancelled'
                          const hasDriver = hasDriverAssignedForStatus(order)

                          // Completed / Cancelled: read-only pill, no dropdown
                          if (isLockedStatus) {
                            return (
                              <div
                                className={`w-[200px] h-9 flex items-center justify-center rounded-md text-sm border ${getStatusColor(order.deliveryStatus)} bg-gray-100 cursor-not-allowed`}
                              >
                                {formatStatusText(order.deliveryStatus)}
                              </div>
                            )
                          }

                          // Editable dropdown for other statuses
                          return (
                            <Select 
                              value={order.deliveryStatus || 'pending'} 
                              onValueChange={(value) => {
                                handleStatusChange(order.id, value)
                              }}
                            >
                              <SelectTrigger className={`w-[200px] ${getStatusColor(order.deliveryStatus)}`}>
                                <SelectValue>{formatStatusText(order.deliveryStatus)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                {/* Hide "Driver Assigned" as a manual option in detail view */}
                                {/* <SelectItem value="driver assigned">Driver Assigned</SelectItem> */}
                                <SelectItem value="dispatched" disabled={!hasDriver}>
                                  Dispatched
                                </SelectItem>
                                <SelectItem value="in transit" disabled={!hasDriver}>
                                  In Transit
                                </SelectItem>
                                <SelectItem value="completed" disabled={!hasDriver}>
                                  Completed
                                </SelectItem>
                                <SelectItem value="undelivered">Undelivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                {/* <SelectItem value="pending payment">Pending Payment</SelectItem>
                                <SelectItem value="closed / paid">Closed / Paid</SelectItem> */}
                              </SelectContent>
                            </Select>
                          )
                        })()}
                      </div>

                      {/* Banner Image */}
                      <div className="relative mb-4 rounded-lg overflow-hidden">
                        {(order.special_event_logo || order.logo) ? (
                          <div className="relative">
                            <img
                              src={order.special_event_logo || order.logo || ''}
                              alt={order.order_name || 'Order'}
                              className="w-full h-48 object-cover"
                            />
                           
                          </div>
                        ) : (
                          <div className="w-full h-48 bg-gray-200 flex items-center justify-center relative">
                            <span className="text-gray-400">No Image</span>
                            
                          </div>
                        )}
                      </div>

                      {/* Special Event Order Banner (if applicable) */}
                      {order.special_instructions && order.special_instructions.toLowerCase().includes('event') && (
                        <div className="bg-purple-100 border border-purple-300 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-700">Special Event Order</span>
                        </div>
                      )}

                      {/* Order Information Grid */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                          <p className="text-sm text-gray-600 mb-1">Customer Name</p>
                          <p className="font-medium">{customer ? `${customer.first_name} ${customer.last_name}` : '—'}</p>
                          </div>
                          <div>
                          <p className="text-sm text-gray-600 mb-1">Product Type</p>
                          <p className="font-medium">Case</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Quantity</p>
                          <p className="font-medium">{order.quantity || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">PO Number</p>
                            <p className="font-medium">{order.po_number || '—'}</p>
                          </div>
                      <div>
                          <p className="text-sm text-gray-600 mb-1">Driver</p>
                          <p className="font-medium">{driver ? driver.driver_name : '—'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Order Date & Time</p>
                        <p className="font-medium">
                            {formatLocalDateTime(order.order_date)}
                          </p>
                          {deliveryTag && !isFutureOrderDate(order.order_date) && (
                            <div className="mt-1">
                              <span className={`text-xs px-2 py-1 rounded ${deliveryTag.color.includes('green') ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {deliveryTag.text}
                              </span>
                            </div>
                          )}
                      </div>
                      
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 mb-6 pb-6 border-b">
                        <Button 
                          variant="outline" 
                          className="flex items-center gap-2"
                          onClick={() => handlePrintPackingSlip(order)}
                        >
                          <Printer className="h-4 w-4" />
                          Print
                        </Button>
                        <Button 
                          variant="outline" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-2"
                          onClick={() => {
                            setOrderToCancel(order.id)
                            setIsCancelOrderDialogOpen(true)
                          }}
                        >
                          <X className="h-4 w-4" />
                          Cancel Order
                        </Button>
                      </div>

                      {/* Undelivered Reason Section */}
                      {order.deliveryStatus?.toLowerCase() === 'undelivered' && order.unable_to_deliver_reason && (
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <X className="h-5 w-5 text-red-500" />
                            <h3 className="font-semibold text-gray-900">Undelivered Reason</h3>
                          </div>
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {order.unable_to_deliver_reason}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Order Notes Section */}
                        <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-5 w-5 text-orange-500" />
                          <h3 className="font-semibold text-gray-900">Order Notes</h3>
                        </div>
                        {order.special_instructions ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                               
                              {order.special_instructions}
                            </p>
                        </div>
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-500">No notes available for this order.</p>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

