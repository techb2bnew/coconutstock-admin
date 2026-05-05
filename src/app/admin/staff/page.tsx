'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogClose
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Edit, Trash2, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type Staff = {
  id: number
  name: string
  email: string
  role: string
  status: string
  last_login: string | null
  hire_date: string | null
}

export default function StaffManagementPage() {
  const router = useRouter()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Warehouse', hire_date: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [franchiseId, setFranchiseId] = useState<string | null | undefined>(undefined)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<number | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const hasCheckedRef = useRef(false)

  // Security: Block super admin from accessing warehouse staff page
  useEffect(() => {
    if (hasCheckedRef.current) return
    const checkAccess = async () => {
      hasCheckedRef.current = true
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email
        if (!email) {
          router.push('/login')
          return
        }
        const { data: staffData } = await supabase
          .from('staff')
          .select('is_super_admin, status')
          .eq('email', email)
          .maybeSingle()
        if (staffData && staffData.status === 'Active' && staffData.is_super_admin === true) {
          toast.error('Access denied. Warehouse Staff is not available for Super Admin.')
          router.push('/admin/dashboard')
          return
        }
        setIsCheckingAccess(false)
      } catch (error) {
        console.error('Access check error:', error)
        toast.error('Error verifying access. Please try again.')
        router.push('/admin/dashboard')
      }
    }
    checkAccess()
  }, [router])

  useEffect(() => {
    if (isCheckingAccess) return
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
          console.error('Franchise lookup error (staff page):', error)
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
        console.error('Franchise resolve error (staff page):', err)
        setFranchiseId(null)
      }
    }

    void resolveFranchise()
  }, [isCheckingAccess])

  const fetchStaff = async () => {
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

    // Sort by id descending (latest first) - since id auto-increments, latest entry has highest id
    let query = supabase.from('staff').select('*').order('id', { ascending: false })
    
    // Filter based on user role:
    // Super Admin: Show ALL staff (no filter)
    // Franchise: Show only staff where franchise_id = their franchise_id
    if (isSuperAdmin) {
      // Super admin sees ALL staff (no filter applied)
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
      console.error('Fetch error:', error)
    } else {
      // Filter out Super Admin role from staff list
      const filteredData = (data || []).filter((staff: Staff) => 
        staff.role?.toLowerCase() !== 'super admin'
      )
      setStaffList(filteredData)
    }
  }

  useEffect(() => {
    if (franchiseId === undefined) return
    fetchStaff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franchiseId])

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  // Sort staff
  const sortedStaff = [...staffList].sort((a, b) => {
    if (!sortColumn) return 0

    let aValue: any
    let bValue: any

    switch (sortColumn) {
      case 'name':
        aValue = a.name || ''
        bValue = b.name || ''
        break
      case 'email':
        aValue = a.email || ''
        bValue = b.email || ''
        break
      case 'role':
        aValue = a.role || ''
        bValue = b.role || ''
        break
      case 'status':
        aValue = a.status || ''
        bValue = b.status || ''
        break
      case 'hire_date':
        aValue = a.hire_date || ''
        bValue = b.hire_date || ''
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
  const currentStaff = sortedStaff.slice(indexOfFirstItem, indexOfLastItem)

  const openModal = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff)
      setFormData({
        name: staff.name,
        email: staff.email,
        role: staff.role,
        hire_date: staff.hire_date ? staff.hire_date.split('T')[0] : ''
      })
    } else {
      setEditingStaff(null)
      setFormData({ name: '', email: '', role: 'Warehouse', hire_date: '' })
    }
    setErrors({})
    setModalOpen(true)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }
    
     
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    // Check if email already exists
    if (editingStaff) {
      // For edit, check if email exists in other records
      const emailCheck = await checkEmailExists(formData.email, editingStaff.id)
      if (emailCheck.exists) {
        toast.error(emailCheck.message)
        return
      }
    } else {
      // For new staff, check if email exists in any table
      const emailCheck = await checkEmailExists(formData.email)
      if (emailCheck.exists) {
        toast.error(emailCheck.message)
        return
      }
    }
    
    setLoading(true)

    try {
      if (editingStaff) {
        // Update existing staff
        const tempPassword: string = generateTemporaryPassword()
        
        // Always read from localStorage (source of truth set by AdminLayout)
        const isSuperAdmin = typeof window !== 'undefined' 
          ? localStorage.getItem('is_super_admin') === 'true'
          : false
        const currentFranchiseId = typeof window !== 'undefined' 
          ? localStorage.getItem('current_franchise_id') 
          : null

        const { error } = await supabase
          .from('staff')
          .update({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            hire_date: formData.hire_date || null,
            password: tempPassword, 
            franchise_id: isSuperAdmin ? null : (currentFranchiseId || null),

          })
          .eq('id', editingStaff.id)

        if (error) {
          console.error('Update error:', error)
          
          // Check for duplicate email error
          if (error.code === '23505') {
            toast.error('This email address is already registered. Please use a different email.')
            setLoading(false)
            return
          }
          
          toast.error(error.message || 'Failed to update staff member. Please try again.')
        } else {
          toast.success('Staff member updated successfully!')
        }
      } else {
        // Save current session tokens to restore after signUp
        const { data: currentSession } = await supabase.auth.getSession()
        const savedAccessToken = currentSession?.session?.access_token
        const savedRefreshToken = currentSession?.session?.refresh_token
        
        // Also save localStorage values before signUp
        const savedIsSuperAdmin = typeof window !== 'undefined' 
          ? localStorage.getItem('is_super_admin')
          : null
        const savedCurrentStaffEmail = typeof window !== 'undefined' 
          ? localStorage.getItem('current_staff_email')
          : null
        const savedCurrentFranchiseId = typeof window !== 'undefined' 
          ? localStorage.getItem('current_franchise_id')
          : null
        
        // Create new staff member with temporary password
        const tempPassword: string = generateTemporaryPassword()
        
        // Always read from localStorage (source of truth set by AdminLayout)
        const isSuperAdmin = typeof window !== 'undefined' 
          ? localStorage.getItem('is_super_admin') === 'true'
          : false
        const currentFranchiseId = typeof window !== 'undefined' 
          ? localStorage.getItem('current_franchise_id') 
          : null
        const currentStaffEmail = typeof window !== 'undefined' 
          ? localStorage.getItem('current_staff_email') 
          : null
        
        // First, insert into staff table
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .insert([{ 
            name: formData.name,
            email: formData.email,
            password: tempPassword,
            role: formData.role,
            hire_date: formData.hire_date || null,
            status: 'Active',
            franchise_id: isSuperAdmin ? null : (currentFranchiseId || null),
            created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
          }])
          .select()
          .single()

        if (staffError) {
          console.error('Staff insert error:', staffError)
          
          // Check for duplicate email error
          if (staffError.code === '23505') {
            toast.error('This email address is already registered. Please use a different email.')
            setLoading(false)
            return
          }
          
          // Show generic error
          toast.error(staffError.message || 'Failed to create staff member. Please try again.')
          setLoading(false)
          return
        }

        // Try to create auth account (non-blocking, staff record already created)
        const loginUrl = `${window.location.origin}/login`
        
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: tempPassword,
            options: {
              emailRedirectTo: loginUrl,
              data: {
                name: formData.name,
                role: formData.role,
                is_temporary_password: true
              }
            }
          })
          
          if (authError) {
            console.log('Auth account creation skipped (may already exist or failed):', authError.message)
            
            // Check for user already exists error
            const errorMessage = authError.message || '';
            const errorCode = (authError as any).code || '';
            const errorString = JSON.stringify(authError);
            const hasUserExistsCode = errorString.includes('user_already_exists') || 
                                     errorString.includes('User already registered');
            
            // Only show toast if it's a user already exists error (not just a general auth error)
            if (errorCode === 'user_already_exists' || 
                errorMessage.includes('User already registered') || 
                errorMessage.includes('user_already_exists') ||
                errorMessage.toLowerCase().includes('already registered') ||
                errorMessage.toLowerCase().includes('already exists') ||
                hasUserExistsCode) {
              toast.error('This email address is already registered. Please use a different email.')
            }
          } else if (authData.user) {
            console.log('Staff auth account created successfully')
          }
        } catch (authErr) {
          console.error('Auth creation error:', authErr)
        }
        
        // CRITICAL: Immediately restore the admin's session and localStorage values
        if (savedAccessToken && savedRefreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: savedAccessToken,
              refresh_token: savedRefreshToken,
            })
            console.log('Admin session restored successfully')
          } catch (restoreErr) {
            console.error('Session restore error:', restoreErr)
            // If restore fails, try to get session again
            const { data: newSession } = await supabase.auth.getSession()
            if (!newSession?.session && savedAccessToken && savedRefreshToken) {
              // Last attempt to restore
              await supabase.auth.setSession({
                access_token: savedAccessToken,
                refresh_token: savedRefreshToken,
              })
            }
          }
        }
        
        // Restore localStorage values
        if (typeof window !== 'undefined') {
          if (savedIsSuperAdmin !== null) {
            localStorage.setItem('is_super_admin', savedIsSuperAdmin)
          }
          if (savedCurrentStaffEmail !== null) {
            localStorage.setItem('current_staff_email', savedCurrentStaffEmail)
          }
          if (savedCurrentFranchiseId !== null) {
            localStorage.setItem('current_franchise_id', savedCurrentFranchiseId)
          }
        }
        
        // Send welcome email (non-blocking)
        supabase.functions.invoke('clever-handler', {
          body: {
            to: formData.email,
            name: formData.name,
            email: formData.email,
            password: tempPassword,
            role: formData.role,
            loginUrl: loginUrl,
            hireDate: formData.hire_date || null
          }
        }).then(({ error: emailError }) => {
          if (emailError) {
            console.log('Email function not available (this is okay):', emailError.message)
          } else {
            console.log('Email sent successfully')
          }
        }).catch((err) => {
          console.log('Email function not configured (this is okay):', err)
        })
        
        // Show success message
        toast.success('Staff member created successfully!')
      }
    } catch (error: any) {
      console.error('Unexpected error:', error)
      
      // Extract error details
      const errorMessage = error?.message || error?.error?.message || '';
      const errorCode = error?.code || error?.error?.code || '';
      
      // Check for duplicate email error
      if (errorCode === '23505' || errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
        toast.error('This email address is already registered. Please use a different email.')
      } else if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
      setModalOpen(false)
      fetchStaff()
    }
  }

  const handleDeleteClick = (id: number) => {
    setStaffToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleStatusToggle = async (staff: Staff) => {
    const newStatus = staff.status === 'Active' ? 'Inactive' : 'Active'
    try {
      const { error } = await supabase
        .from('staff')
        .update({ status: newStatus })
        .eq('id', staff.id)

      if (error) {
        console.error('Error updating status:', error)
        toast.error('Failed to update status')
      } else {
        toast.success(`Staff status updated to ${newStatus}`)
        // Update local state
        setStaffList(staffList.map((s) => (s.id === staff.id ? { ...s, status: newStatus } : s)))
      }
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Failed to update status')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!staffToDelete) return
    
    const { error } = await supabase.from('staff').delete().eq('id', staffToDelete)
    if (error) {
      console.error('Delete error:', error)
    } else {
      fetchStaff()
    }
    
    setDeleteDialogOpen(false)
    setStaffToDelete(null)
  }

  if (isCheckingAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-[#f9fafb] min-h-screen">

      <div>
        <h1 className="text-2xl font-semibold">Warehouse Staff Management</h1>
        <p className="text-sm text-gray-500">CoconutStock HQ</p>
      </div>

      {/* Add Button */}
      <div className="flex items-center justify-end">
        <Button
          className="bg-sky-500 hover:bg-sky-600 text-white"
          onClick={() => openModal()}
        >
          <span className="text-lg font-bold mr-1">+</span> Add Staff Member
        </Button>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-gray-200 rounded-md shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-medium text-gray-800">
            All Warehouse Staff Members ({staffList.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <Table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '20%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center relative pr-4">
                    <span className="whitespace-nowrap">Name</span>
                    <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                      {sortColumn === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center relative pr-4">
                    <span className="whitespace-nowrap">Email</span>
                    <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                      {sortColumn === 'email' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSort('role')}
                >
                  <div className="flex items-center relative pr-4">
                    <span className="whitespace-nowrap">Role</span>
                    <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                      {sortColumn === 'role' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center relative pr-4">
                    <span className="whitespace-nowrap">Status</span>
                    <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                      {sortColumn === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSort('hire_date')}
                >
                  <div className="flex items-center relative pr-4">
                    <span className="whitespace-nowrap">Hire Date</span>
                    <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                      {sortColumn === 'hire_date' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </div>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentStaff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="truncate">{member.name}</TableCell>
                  <TableCell className="truncate">
                    <a href={`mailto:${member.email}`} className="text-sky-600 hover:underline truncate block">
                      {member.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        member.role === 'Warehouse'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }
                    >
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={member.status === 'Active'}
                        onCheckedChange={() => handleStatusToggle(member)}
                      />
                      <Badge className={member.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {member.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="truncate">
                    {member.hire_date
                      ? new Date(member.hire_date).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openModal(member)}
                        className="text-green-600 bg-green-100 hover:text-green-700 hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(member.id)}
                        className="text-red-600 bg-red-100 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {currentStaff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                    No staff found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

          </Table>

          {/* Pagination Controls */}
          {sortedStaff.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-white">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600">
                  Showing {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, sortedStaff.length)} of {sortedStaff.length}
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
                  onClick={() =>
                    setCurrentPage((p) =>
                      indexOfLastItem < sortedStaff.length ? p + 1 : p
                    )
                  }
                  disabled={indexOfLastItem >= sortedStaff.length}
                  className={`px-3 py-1.5 rounded-md border text-sm ${indexOfLastItem >= sortedStaff.length
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
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
            </DialogTitle>
            <DialogDescription>
              {editingStaff
                ? 'Update the details below and save changes.'
                : 'Enter the details of the new staff member.'}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  setErrors((prev) => ({ ...prev, name: '' }))
                }}
                className={`w-full border rounded-md px-3 py-2 focus:ring focus:ring-sky-200 focus:outline-none ${
                  errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value.toLowerCase() })
                  setErrors((prev) => ({ ...prev, email: '' }))
                }}
                className={`w-full border rounded-md px-3 py-2 focus:ring focus:ring-sky-200 focus:outline-none ${
                  errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                } ${editingStaff ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                disabled={!!editingStaff}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hire Date
              </label>
              <input
                type="date"
                value={formData.hire_date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setFormData({ ...formData, hire_date: e.target.value })
                  
                }}
                className="w-full border rounded-md px-3 py-2 focus:ring focus:ring-sky-200"                  
              />
             
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                className="bg-sky-500 hover:bg-sky-600 text-white flex items-center"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      ></path>
                    </svg>
                    Saving...
                  </>
                ) : editingStaff ? (
                  'Save Changes'
                ) : (
                  'Add Staff Member'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this staff member? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStaffToDelete(null)}>No</AlertDialogCancel>
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
