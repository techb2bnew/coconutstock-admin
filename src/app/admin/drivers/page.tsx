'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CheckCircle, Truck, Send, Package, Edit, Trash2, Eye, Navigation, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
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
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface Driver {
  id: number
  driver_name: string
  phone_number?: string
  email?: string
  vehicle_id?: string
  shift_start?: string
  shift_end?: string
  created_at?: string
  status?: string
  franchise_id?: string | null
}

interface Franchise {
  id: string
  franchise_name: string
}

export default function DriverManagementPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false) // modal open
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Driver | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [franchiseId, setFranchiseId] = useState<string | null | undefined>(undefined)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [driverToDelete, setDriverToDelete] = useState<number | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [franchises, setFranchises] = useState<Franchise[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  
  // Static role for drivers
  const DRIVER_ROLE = 'Driver'

  // form state
  const [form, setForm] = useState({
    driver_name: '',
    phone_number: '',
    email: '',
    vehicle_id: '',
    shift_start: '08:00',
    shift_end: '16:00',
    status: 'Available',
    franchise_id: '',
  })

  const fetchFranchises = async () => {
    try {
      const { data, error } = await supabase
        .from('franchises')
        .select('id, franchise_name')
        .order('franchise_name', { ascending: true })
      if (error) {
        console.error('Error fetching franchises:', error)
        return
      }
      setFranchises(data || [])
    } catch (err) {
      console.error('Fetch franchises error:', err)
    }
  }

  useEffect(() => {
    const superAdmin = typeof window !== 'undefined' && localStorage.getItem('is_super_admin') === 'true'
    setIsSuperAdmin(superAdmin)
    if (superAdmin) {
      fetchFranchises()
    }
  }, [])

  useEffect(() => {
    const resolveFranchise = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email
        if (!email) {
          setFranchiseId(null)
          return
        }

        const { data: franchise, error } = await supabase
          .from('franchises')
          .select('id')
          .eq('owner_email', email)
          .maybeSingle()

        if (error) {
          console.error('Franchise lookup error (drivers page):', error)
          setFranchiseId(null)
          return
        }

        const id = franchise?.id ?? null
        setFranchiseId(id)

        // Don't modify localStorage here - AdminLayout handles it
        // Only set it if we found a franchise (don't remove if not found)
        if (typeof window !== 'undefined' && id) {
          localStorage.setItem('current_franchise_id', id)
        }
      } catch (err) {
        console.error('Franchise resolve error (drivers page):', err)
        setFranchiseId(null)
      }
    }

    void resolveFranchise()
  }, [])

  useEffect(() => {
    if (franchiseId === undefined) return
    fetchDrivers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franchiseId])

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  // Generate temporary password
  const generateTemporaryPassword = () => {
    const length = 12
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }

  // Filter and sort drivers
  const filteredDrivers = drivers.filter(d => {
    // Apply status filter
    if (statusFilter !== 'All' && (d.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
      return false
    }
    // Apply search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      const matchesSearch = 
        (d.driver_name || '').toLowerCase().includes(q) ||
        (d.phone_number || '').toLowerCase().includes(q) ||
        (d.vehicle_id || '').toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    return true
  })

  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (!sortColumn) return 0

    let aValue: any
    let bValue: any

    switch (sortColumn) {
      case 'driver_name':
        aValue = a.driver_name || ''
        bValue = b.driver_name || ''
        break
      case 'email':
        aValue = a.email || ''
        bValue = b.email || ''
        break
      case 'status':
        aValue = a.status || ''
        bValue = b.status || ''
        break
      case 'vehicle_id':
        aValue = a.vehicle_id || ''
        bValue = b.vehicle_id || ''
        break
      case 'shift':
        // Sort by shift_start
        aValue = a.shift_start || ''
        bValue = b.shift_start || ''
        break
      default:
        return 0
    }

    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    }

    return 0
  })

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentDrivers = sortedDrivers.slice(indexOfFirstItem, indexOfLastItem)

  async function fetchDrivers() {
    setLoading(true)
    try {
      // Always read from localStorage (source of truth set by AdminLayout)
      // Don't rely on state as it might be stale after create
      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null
      const currentStaffEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('current_staff_email') 
        : null

      let query = supabase.from('drivers').select('*').order('id', { ascending: false })
      
      // Filter based on user role:
      // Super Admin: Show ALL drivers (no filter)
      // Franchise: Show only drivers where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees ALL drivers (no filter applied)
        // Don't apply any filter - show all data
      } else if (currentFranchiseId) {
        // Franchise sees only their own data
        query = query.eq('franchise_id', currentFranchiseId)
      } else if (currentStaffEmail) {
        // Staff member (not franchise owner): filter by creator
        query = query.eq('created_by_email', currentStaffEmail)
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        query = query.eq('id', -1) // Impossible condition
      }

      const { data, error } = await query

      if (error) {
        console.error('Fetch drivers error:', error)
        return
      }
      setDrivers(data || [])
    } finally {
      setLoading(false)
    }
  }

  function openAddModal() {
    setEditing(null)
    setForm({
      driver_name: '',
      phone_number: '',
      email: '',
      vehicle_id: '',
      shift_start: '08:00',
      shift_end: '16:00',
      status: 'Available',
      franchise_id: '',
    })
    setErrors({})
    setOpen(true)
  }

  function openEditModal(d: Driver) {
    setEditing(d)
    setForm({
      driver_name: d.driver_name || '',
      phone_number: d.phone_number || '',
      email: d.email || '',
      vehicle_id: d.vehicle_id || '',
      // if stored with seconds, take first 5 chars for <input type=time>
      shift_start: d.shift_start ? d.shift_start.slice(0, 5) : '08:00',
      shift_end: d.shift_end ? d.shift_end.slice(0, 5) : '16:00',
      status: d.status || 'Available',
      franchise_id: d.franchise_id ?? '',
    })
    setErrors({})
    setOpen(true)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!form.driver_name.trim()) {
      newErrors.driver_name = 'Driver name is required'
    }

    // Phone number validation - required, must be exactly 10 digits
    if (!form.phone_number || !form.phone_number.trim()) {
      newErrors.phone_number = 'Phone number is required'
    } else {
      // Remove all non-digit characters
      const digitsOnly = form.phone_number.replace(/\D/g, '')
      if (digitsOnly.length !== 10) {
        newErrors.phone_number = 'Phone number must be exactly 10 digits'
      }
    }

    // Email validation - required, must be valid format
    if (!form.email || !form.email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(form.email.trim())) {
        newErrors.email = 'Please enter a valid email address'
      }
    }

    // Shift validation - only validate if both times are provided
    if (form.shift_start && form.shift_end) {
      const start = new Date(`2000-01-01T${form.shift_start}`)
      const end = new Date(`2000-01-01T${form.shift_end}`)
      if (end <= start) {
        newErrors.shift_end = 'Shift end time must be after shift start time'
      }
    }

    // Super Admin: Franchise is required
    if (isSuperAdmin && (!form.franchise_id || form.franchise_id.trim() === '')) {
      newErrors.franchise_id = 'Franchise is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Helper function to check if email exists in any table
  const checkEmailExists = async (email: string, excludeId?: string | number): Promise<{ exists: boolean; message: string }> => {
    const emailLower = email.toLowerCase().trim()
    const excludeIdStr = excludeId ? String(excludeId) : undefined
    
    // Check customers table
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle()
    
    if (customerData && (!excludeIdStr || String(customerData.id) !== excludeIdStr)) {
      return { exists: true, message: 'This email is already registered as a customer.' }
    }
    
    // Check company table
    const { data: companyData } = await supabase
      .from('company')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle()
    
    if (companyData && (!excludeIdStr || String(companyData.id) !== excludeIdStr)) {
      return { exists: true, message: 'This email is already registered as a company.' }
    }
    
    // Check drivers table
    const { data: driverData } = await supabase
      .from('drivers')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle()
    
    if (driverData && (!excludeIdStr || String(driverData.id) !== excludeIdStr)) {
      return { exists: true, message: 'This email is already registered as a driver.' }
    }
    
    // Check franchises table
    const { data: franchiseData } = await supabase
      .from('franchises')
      .select('id, owner_email')
      .eq('owner_email', emailLower)
      .maybeSingle()
    
    if (franchiseData && (!excludeIdStr || String(franchiseData.id) !== excludeIdStr)) {
      return { exists: true, message: 'This email is already registered as a franchise owner.' }
    }
    
    // Check staff table
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle()
    
    if (staffData && (!excludeIdStr || String(staffData.id) !== excludeIdStr)) {
      return { exists: true, message: 'This email is already registered as staff.' }
    }
    
    return { exists: false, message: '' }
  }

  async function handleSave(e?: React.SyntheticEvent) {
    if (e) e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Check if email already exists
    if (editing) {
      // For edit, check if email exists in other records
      const emailCheck = await checkEmailExists(form.email, editing.id)
      if (emailCheck.exists) {
        toast.error(emailCheck.message)
        return
      }
    } else {
      // For new driver, check if email exists in any table
      const emailCheck = await checkEmailExists(form.email)
      if (emailCheck.exists) {
        toast.error(emailCheck.message)
        return
      }
    }

    setSaving(true)
    try {
      // Always read from localStorage (source of truth set by AdminLayout)
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null

      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false

      // Build payload - only include password for new drivers, not when editing
      // Super Admin: franchise_id from form dropdown; Franchise user: from current_franchise_id
      const payload: any = {
        driver_name: form.driver_name,
        phone_number: form.phone_number || null,
        email: form.email || null,
        vehicle_id: form.vehicle_id?.trim() || '',
        shift_start: form.shift_start?.length === 5 ? `${form.shift_start}:00` : form.shift_start,
        shift_end: form.shift_end?.length === 5 ? `${form.shift_end}:00` : form.shift_end,
        // Status handling:
        // - New driver: always "Available"
        // - Edit driver: keep existing status, but if it's "Assigned" keep sending "Assigned"
        status: editing ? (editing.status || 'Available') : 'Available',
        role: DRIVER_ROLE,
        franchise_id: isSuperAdmin ? (form.franchise_id || null) : (currentFranchiseId || null),
      }

      // Only generate and add password for new drivers, not when editing
      let tempPassword: string | null = null
      if (!editing) {
        tempPassword = generateTemporaryPassword()
        payload.password = tempPassword
      }

      if (editing) {
        const { error } = await supabase
          .from('drivers')
          .update(payload)
          .eq('id', editing.id)
        if (error) {
          // Check for duplicate email error
          if (error.code === '23505') {
            toast.error('This email address is already registered. Please use a different email.')
            setSaving(false)
            return
          }
          throw error
        }
      } else {
        // Save current session before creating new user
        const { data: currentSessionData, error: currentSessionError } = await supabase.auth.getSession();
        if (currentSessionError) {
          console.error('Error getting current session:', currentSessionError);
        }
        const currentAccessToken = currentSessionData?.session?.access_token;
        const currentRefreshToken = currentSessionData?.session?.refresh_token;

        // Get current identifiers for creator tracking
        const isSuperAdmin = typeof window !== 'undefined' 
          ? localStorage.getItem('is_super_admin') === 'true'
          : false
        const currentStaffEmail = typeof window !== 'undefined' 
          ? localStorage.getItem('current_staff_email') 
          : null

        // Insert into drivers table first
        // IMPORTANT: Explicitly include password in insert payload to ensure it's saved correctly
        const insertPayload = { 
          ...payload,
          password: tempPassword, // Explicitly set password to ensure it's saved correctly
          created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
          franchise_id: payload.franchise_id
        }
        
        console.log('Inserting driver with password:', tempPassword, 'Email:', form.email)
        
        const { data: insertedDriverData, error: insertError } = await supabase
          .from('drivers')
          .insert([insertPayload])
          .select()
          .single()

        if (insertError) {
          console.error('Driver insert error:', insertError);
          // Check for duplicate email error
          if (insertError.code === '23505') {
            toast.error('This email address is already registered. Please use a different email.')
            setSaving(false)
            return
          }
          throw insertError;
        }

        // Create user in Supabase Auth
        // IMPORTANT: If email confirmation is enabled in Supabase Auth settings,
        // the driver will need to confirm their email before they can login.
        // To disable email confirmation, go to Supabase Dashboard > Authentication > Settings
        // and disable "Enable email confirmations"
        if (!tempPassword) {
          console.error('Error: tempPassword is null for new driver')
          await supabase.from('drivers').delete().eq('id', insertedDriverData.id)
          toast.error('Failed to generate password. Please try again.')
          setSaving(false)
          return
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: tempPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: {
              name: form.driver_name,
              role: DRIVER_ROLE,
              is_temporary_password: true
            }
          }
        })

        if (authError) {
          console.error('Auth error:', authError);
          
          // If auth fails, delete the driver record to keep data consistent
          await supabase.from('drivers').delete().eq('id', insertedDriverData.id);
          
          // Check for user already exists error - multiple ways to check
          const errorMessage = authError.message || '';
          const errorCode = (authError as any).code || (authError as any).error?.code || '';
          
          // Also check the stringified error for code
          const errorString = JSON.stringify(authError);
          const hasUserExistsCode = errorString.includes('user_already_exists') || 
                                   errorString.includes('User already registered');
          
          // Determine the error message to show
          let toastMessage = '';
          if (errorCode === 'user_already_exists' || 
              errorMessage.includes('User already registered') || 
              errorMessage.includes('user_already_exists') ||
              errorMessage.toLowerCase().includes('already registered') ||
              errorMessage.toLowerCase().includes('already exists') ||
              hasUserExistsCode) {
            toastMessage = 'This email address is already registered. Please use a different email.';
          } else if (errorMessage) {
            toastMessage = errorMessage;
          } else {
            toastMessage = 'Failed to create user account. Please try again.';
          }
          
          // Show toast and return early
          toast.error(toastMessage);
          setSaving(false);
          return;
        } else if (!authData.user) {
          console.error('Error: User account was not created');
          await supabase.from('drivers').delete().eq('id', insertedDriverData.id);
          toast.error('Failed to create user account. Please try again.')
          setSaving(false)
          return
        } else {
          // Restore original session immediately after signUp
          if (currentAccessToken && currentRefreshToken) {
            const { error: restoreError } = await supabase.auth.setSession({
              access_token: currentAccessToken,
              refresh_token: currentRefreshToken,
            });
            if (restoreError) {
              console.error('Error restoring session:', restoreError);
            }
          }

          // Send email via Supabase Edge Function (non-blocking)
          const loginUrl = `${window.location.origin}/login`
          
          // Log password for debugging (remove in production)
          console.log('Driver created - Password:', tempPassword, 'Email:', form.email)
          
          supabase.functions.invoke('clever-handler', {
            body: {
              to: form.email,
              name: form.driver_name,
              email: form.email,
              password: tempPassword,
              role: DRIVER_ROLE,
              loginUrl: loginUrl,
              vehicleId: form.vehicle_id
            }
          }).then(({ error: emailError }) => {
            if (emailError) {
              console.log('Email function not available (this is okay):', emailError.message)
            } else {
              console.log('Email sent successfully with password:', tempPassword)
            }
          }).catch((err) => {
            // CORS or function not found - this is expected if function doesn't exist
            console.log('Email function not configured (this is okay):', err)
          })
          
          // IMPORTANT: Check Supabase Auth Settings
          // If drivers cannot login, check:
          // 1. Supabase Dashboard > Authentication > Settings > "Enable email confirmations"
          //    - If enabled, driver must confirm email before login
          //    - To disable: Turn off "Enable email confirmations"
          // 2. Verify auth account was created: Check auth.users table in Supabase
          // 3. Verify password matches: Check drivers.password matches email password
          console.log('Driver auth account created. If login fails, check email confirmation settings in Supabase.')
        }
      }

      setOpen(false)
      await fetchDrivers()
      toast.success(editing ? 'Driver updated successfully!' : 'Driver created successfully!')
    } catch (err: any) {
      console.error('Save driver error:', err)
      
      // Extract error details - handle different error formats
      const errorMessage = err?.message || err?.error?.message || '';
      const errorCode = err?.code || err?.error?.code || '';
      
      // Also check the stringified error for code
      const errorString = JSON.stringify(err);
      const hasUserExistsCode = errorString.includes('user_already_exists') || 
                               errorString.includes('User already registered');
      
      // Determine the error message to show
      let toastMessage = '';
      if (errorCode === 'user_already_exists' || 
          errorMessage.includes('User already registered') || 
          errorMessage.includes('user_already_exists') ||
          errorMessage.toLowerCase().includes('already registered') ||
          errorMessage.toLowerCase().includes('already exists') ||
          hasUserExistsCode) {
        toastMessage = 'This email address is already registered. Please use a different email.';
      } else if (err?.code === '23505' || errorCode === '23505') {
        toastMessage = 'This email address is already registered. Please use a different email.';
      } else if (errorMessage) {
        toastMessage = errorMessage;
      } else {
        toastMessage = editing ? 'Failed to update driver. Please try again.' : 'Failed to create driver. Please try again.';
      }
      
      // Show toast
      toast.error(toastMessage);
    } finally {
      setSaving(false)
    }
  }


  const handleDeleteClick = (id: number) => {
    setDriverToDelete(id)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!driverToDelete) return
    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverToDelete)
      if (error) throw error
      await fetchDrivers()
    } catch (err) {
      console.error('Delete driver error:', err)
      alert('Could not delete driver. Check console for details.')
    } finally {
      setDeleteDialogOpen(false)
      setDriverToDelete(null)
    }
  }

  // stats
  const total = drivers.length
  const available = drivers.filter(d => (d.status || '').toLowerCase() === 'available').length
  const enroute = drivers.filter(d => (d.status || '').toLowerCase() === 'en route' || (d.status || '').toLowerCase() === 'enroute').length
  const assigned = drivers.filter(d => (d.status || '').toLowerCase() === 'assigned').length

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Driver Management</h1>
        <p className="text-sm text-gray-500">
          Manage drivers, view routes, and track delivery capacity for CoconutStock HQ  
        </p>
      </div>

      
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Drivers</p>
                <p className="text-3xl font-bold text-slate-900">{total}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Truck className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-green-700 mb-2">Available</p>
                <p className="text-3xl font-bold text-green-700">{available}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-purple-700 mb-2">En Route</p>
                <p className="text-3xl font-bold text-purple-700">{enroute}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Navigation className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-blue-700 mb-2">Assigned</p>
                <p className="text-3xl font-bold text-blue-700">{assigned}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Package className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-100 gap-4">
        <input
          type="text"
          placeholder="Search by name, phone, or vehicle..."
          className="w-full sm:w-auto flex-1 border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setCurrentPage(1) // Reset to first page when search changes
          }}
        />
        <div className="flex items-center gap-3 mt-3 sm:mt-0">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1) // Reset to first page when filter changes
            }}
            className="border border-gray-300 rounded-md text-sm p-2 text-gray-700"
          >
            <option value="All">All Status</option>
            <option value="Available">Available</option>
            <option value="En Route">En Route</option>
            <option value="Assigned">Assigned</option>
          </select>
          <button
            onClick={openAddModal}
            className="bg-[#00a1ff] hover:bg-[#0090e6] text-white px-4 py-2 rounded-md text-sm font-medium shadow"
          >
            + Add Driver
          </button>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">All Drivers</h2>
          {loading ? <div className="text-xs text-gray-500">Loading…</div> : null}
        </div>
        <table className="w-full text-sm text-left" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('driver_name')}>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">Driver</span>
                  {sortColumn === 'driver_name' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('email')}>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">Email</span>
                  {sortColumn === 'email' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">Status</span>
                  {sortColumn === 'status' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('vehicle_id')}>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">Vehicle Id</span>
                  {sortColumn === 'vehicle_id' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('shift')}>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">Shift</span>
                  {sortColumn === 'shift' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentDrivers.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 truncate">
                  <div className="font-medium text-gray-800 truncate">{d.driver_name}</div>
                  {d.phone_number && (
                    <a 
                      href={`tel:${d.phone_number}`}
                      className="text-xs   truncate  text-sky-600 hover:underline"
                    >
                      {d.phone_number}
                    </a>
                  )}
                </td>
                <td className="px-6 py-3 truncate">
                  {d.email && (
                    <a 
                      href={`mailto:${d.email}`}
                      className="font-medium   truncate  text-sky-600 hover:underline"
                    >
                      {d.email}
                    </a>
                  )}
                </td>
                <td className="px-6 py-3 truncate">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${(d.status || '').toLowerCase() === 'available'
                        ? 'bg-green-100 text-green-700'
                        : (d.status || '').toLowerCase() === 'en route' || (d.status || '').toLowerCase() === 'enroute'
                          ? 'bg-purple-100 text-purple-700'
                          : (d.status || '').toLowerCase() === 'assigned'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-700 truncate">{d.vehicle_id}</td>
                <td className="px-6 py-3 text-gray-700 truncate">
                  {d.shift_start ? d.shift_start.slice(0, 5) : '—'} - {d.shift_end ? d.shift_end.slice(0, 5) : '—'}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(d)}
                      className="text-green-600 bg-green-100 hover:text-green-700 hover:bg-green-50"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(d.id)}
                      className="text-red-600 bg-red-100 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {currentDrivers.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center p-6 text-sm text-gray-500">No drivers found.</td>
              </tr>
            )}
          </tbody>

        </table>
        {/* Pagination Controls */}
        {drivers.length > 0 && (
          <div className="flex justify-between items-center px-6 py-4 border-t">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, sortedDrivers.length)} of {sortedDrivers.length}
              </p>
              <div className="flex items-center gap-2">
                <Label htmlFor="itemsPerPage" className="text-sm text-gray-600 whitespace-nowrap">
                  View:
                </Label>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => setItemsPerPage(Number(value))}
                >
                  <SelectTrigger id="itemsPerPage" className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-md border text-sm ${currentPage === 1
                    ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                    : 'text-gray-700 bg-white hover:bg-gray-100'
                  }`}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => (indexOfLastItem < sortedDrivers.length ? p + 1 : p))}
                disabled={indexOfLastItem >= sortedDrivers.length}
                className={`px-3 py-1.5 rounded-md border text-sm ${indexOfLastItem >= sortedDrivers.length
                    ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                    : 'text-gray-700 bg-white hover:bg-gray-100'
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      

      {/* Add / Edit Driver Modal (simple custom modal) */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between pb-3">
              <div>
              <h3 className="text-lg font-semibold text-gray-800">{editing ? 'Edit Driver' : 'Add New Driver'}</h3>
              <p className="text-sm text-gray-500">Enter the details of the new driver to add them to the system</p>
              </div>
              <button
                onClick={() => { setOpen(false); setEditing(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 mt-4">
            <div className={`grid gap-3 ${isSuperAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isSuperAdmin && (
                <div>
                  <Label htmlFor="driver_franchise_id">
                    Franchise <span className="text-red-500">*</span>
                  </Label>
                  {franchises.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 px-3 rounded-md border border-gray-200 bg-gray-50 mt-1">
                      No franchises added
                    </p>
                  ) : (
                    <Select
                      value={form.franchise_id || 'none'}
                      onValueChange={(value) => {
                        setForm(prev => ({ ...prev, franchise_id: value === 'none' ? '' : value }))
                        setErrors(prev => ({ ...prev, franchise_id: '' }))
                      }}
                    >
                      <SelectTrigger id="driver_franchise_id" className={`mt-1 bg-gray-50 border-gray-300 ${errors.franchise_id ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select a franchise (required)" />
                      </SelectTrigger>
                      <SelectContent>
                        {franchises.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.franchise_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.franchise_id && (
                    <p className="text-red-500 text-xs mt-1">{errors.franchise_id}</p>
                  )}
                </div>
              )}
              <div>
                <Label>Driver Name <span className="text-red-500">*</span></Label>
                <Input 
                  value={form.driver_name} 
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, driver_name: e.target.value }))
                    setErrors(prev => ({ ...prev, driver_name: '' }))
                  }} 
                  placeholder="Driver full name" 
                  className={`bg-gray-100 border-gray-300 ${errors.driver_name ? 'border-red-500 focus:ring-red-500' : ''}`} 
                />
                {errors.driver_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.driver_name}</p>
                )}
              </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone <span className="text-red-500">*</span></Label>
                  <Input 
                    type="tel"
                    inputMode="numeric"
                    value={form.phone_number} 
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setForm(prev => ({ ...prev, phone_number: value }))
                      setErrors(prev => ({ ...prev, phone_number: '' }))
                    }} 
                    placeholder="10 digit number" 
                    maxLength={10}
                    className={`bg-gray-100 border-gray-300 ${errors.phone_number ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {errors.phone_number && (
                    <p className="text-red-500 text-xs mt-1">{errors.phone_number}</p>
                  )}
                </div>
                <div>
                  <Label>Email <span className="text-red-500">*</span></Label>
                  <Input 
                    type="email"
                    value={form.email} 
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, email: e.target.value.toLowerCase() }))
                      setErrors(prev => ({ ...prev, email: '' }))
                    }} 
                    placeholder="email@example.com" 
                    className={`bg-gray-100 border-gray-300 ${errors.email ? 'border-red-500 focus:ring-red-500' : ''} ${editing ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                    disabled={!!editing}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Vehicle ID</Label>
                <Input 
                  value={form.vehicle_id} 
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, vehicle_id: e.target.value }))
                    setErrors(prev => ({ ...prev, vehicle_id: '' }))
                  }} 
                  placeholder="VAN-101" 
                  className="bg-gray-100 border-gray-300" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Shift Start</Label>
                  <input 
                    type="time" 
                    value={form.shift_start} 
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, shift_start: e.target.value }))
                      setErrors(prev => ({ ...prev, shift_end: '' }))
                    }} 
                    className="w-full mt-1 border border-gray-300 bg-gray-100 rounded-md p-2 text-sm" 
                  />
                </div>
                <div>
                  <Label>Shift End</Label>
                  <input 
                    type="time" 
                    value={form.shift_end} 
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, shift_end: e.target.value }))
                      setErrors(prev => ({ ...prev, shift_end: '' }))
                    }} 
                    className={`w-full mt-1 border border-gray-300 bg-gray-100 rounded-md p-2 text-sm ${errors.shift_end ? 'border-red-500' : ''}`} 
                  />
                  {errors.shift_end && (
                    <p className="text-red-500 text-xs mt-1">{errors.shift_end}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Input
                  value={editing ? (editing.status || 'Available') : 'Available'}
                  readOnly
                  className="bg-gray-100 border-gray-300 cursor-not-allowed"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => { setOpen(false); setEditing(null) }} className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold">
                  {saving ? 'Saving…' : editing ? 'Update Driver' : 'Add Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this driver? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDriverToDelete(null)}>No</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>





  )
}
