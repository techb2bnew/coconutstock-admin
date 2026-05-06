'use client'

import { useState, useEffect, FormEvent } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Info, MoreHorizontal, Plus, Building2, ArrowUp, ArrowDown, ArrowUpDown, Upload, X, Power, Pencil, Trash2, Search } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import Autocomplete from 'react-google-autocomplete'

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
  status?: string | null
  customersCount?: number
  ordersCount?: number
  casesSoldThisMonth?: number
}

interface FranchiseFormState {
  name: string // maps to franchise_name
  zone: string // maps to location_zone
  address: string
  ownerFirstName: string // maps to owner_first_name
  ownerLastName: string // maps to owner_last_name
  ownerEmail: string // maps to owner_email
  ownerPhone: string // maps to owner_phone
  contractStartDate: string // maps to contract_start_date (optional)
  logo: string // for logo preview/upload
}

type FranchiseFormErrors = Partial<Record<keyof FranchiseFormState, string>>

// Generate temporary password (same pattern as staff)
const generateTemporaryPassword = () => {
  const length = 12
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}
// Address Autocomplete Component
interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}
function AddressAutocomplete({ value, onChange, className, placeholder }: AddressAutocompleteProps) {
  useEffect(() => {
    // Add CSS to ensure Google Places Autocomplete dropdown appears above modals
    const style = document.createElement('style')
    style.textContent = `
      .pac-container {
        z-index: 9999 !important;
        pointer-events: all !important;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <Autocomplete
      apiKey="AIzaSyBVlRB_xJNrgPjlukxTrCDCfjzYuqfN0Q0"
      onPlaceSelected={(place: any) => {
        const address = place.formatted_address || place.name || ''
        onChange(address)
      }}
      options={{
        types: ['address'],
        componentRestrictions: { country: 'us' }, // You can change this to your country
      }}
      defaultValue={value}
      className={className}
      placeholder={placeholder}
      style={{
        width: '100%',
        height: '2.5rem',
        padding: '0.5rem 0.75rem',
        fontSize: '0.875rem',
        borderRadius: '0.375rem',
        border: '1px solid #d1d5db',
        backgroundColor: '#f9fafb',
      }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value)
      }}
    />
  )
}

export default function FranchisePage() {
  const router = useRouter();
  const pathName = usePathname();
  const [franchises, setFranchises] = useState<Franchise[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFranchise, setEditingFranchise] = useState<Franchise | null>(null)
  const [formState, setFormState] = useState<FranchiseFormState>({
    name: "",
    zone: "",
    address: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerEmail: "",
    ownerPhone: "",
    contractStartDate: "",
    logo: "",
  })
  const [formErrors, setFormErrors] = useState<FranchiseFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false)
  const [franchiseToChangeStatus, setFranchiseToChangeStatus] = useState<Franchise | null>(null)
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('inactive')
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)

  // Security: Role-based access control - Only Super Admin can access franchise management
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email

        if (!email) {
          toast.error('Unauthorized access. Please login.')
          router.push('/login')
          return
        }

        // Check if user is staff and super admin
        const { data: staffData } = await supabase
          .from('staff')
          .select('is_super_admin, status')
          .eq('email', email)
          .maybeSingle()

        // Check if user is franchise owner (should not have access)
        const { data: franchiseData } = await supabase
          .from('franchises')
          .select('id')
          .eq('owner_email', email)
          .maybeSingle()

        if (franchiseData) {
          // Franchise owner trying to access - deny access
          toast.error('Access denied. Franchise management is restricted to Super Admin only.')
          router.push('/admin/dashboard')
          return
        }

        if (!staffData || staffData.status !== 'Active') {
          toast.error('Access denied. Your account is inactive.')
          router.push('/login')
          return
        }

        if (staffData.is_super_admin !== true) {
          // Not a super admin - deny access
          toast.error('Access denied. Franchise management is restricted to Super Admin only.')
          router.push('/admin/dashboard')
          return
        }

        // User is super admin - allow access
        setIsCheckingAccess(false)
      } catch (error) {
        console.error('Access check error:', error)
        toast.error('Error verifying access. Please try again.')
        router.push('/admin/dashboard')
      }
    }

    checkAccess()
  }, [router])

  // Fetch franchises from Supabase with stats
  useEffect(() => {
    if (isCheckingAccess) return // Don't fetch data until access is verified
    const fetchFranchises = async () => {
      try {
        setIsLoading(true)
        const { data, error } = await supabase
          .from("franchises")
          .select(
            "id, franchise_name, location_zone, address, owner_first_name, owner_last_name, owner_email, owner_phone, logo, contract_start_date, created_at, updated_at, status",
          )
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error fetching franchises:", error)
          toast.error("Failed to load franchises. Please try again.")
          return
        }

        // Fetch stats for each franchise
        const franchisesWithStats = await Promise.all(
          (data || []).map(async (franchise) => {
            // Count customers for this franchise
            const { count: customersCount } = await supabase
              .from('customers')
              .select('*', { count: 'exact', head: true })
              .eq('franchise_id', franchise.id)

            // Count orders for this franchise
            const { count: ordersCount } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .eq('franchise_id', franchise.id)

            // Calculate cases sold this month (based on created_at)
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)
            const endOfMonth = new Date()
            endOfMonth.setMonth(endOfMonth.getMonth() + 1)
            endOfMonth.setDate(0)
            endOfMonth.setHours(23, 59, 59, 999)

            const { data: ordersData } = await supabase
              .from('orders')
              .select('quantity')
              .eq('franchise_id', franchise.id)
              .gte('created_at', startOfMonth.toISOString())
              .lte('created_at', endOfMonth.toISOString())

            const casesSoldThisMonth = ordersData?.reduce((sum, order) => {
              return sum + (Number((order as any)?.quantity) || 0)
            }, 0) || 0

            return {
              ...franchise,
              customersCount: customersCount || 0,
              ordersCount: ordersCount || 0,
              casesSoldThisMonth,
            } as Franchise
          })
        )

        setFranchises(franchisesWithStats)
      } catch (err) {
        console.error("Unexpected error fetching franchises:", err)
        toast.error("Something went wrong while loading franchises.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchFranchises()
  }, [isCheckingAccess])

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  const resetForm = () => {
    setFormState({
      name: "",
      zone: "",
      address: "",
      ownerFirstName: "",
      ownerLastName: "",
      ownerEmail: "",
      ownerPhone: "",
      contractStartDate: "",
      logo: "",
    })
    setFormErrors({})
    setEditingFranchise(null)
    setLogoPreview(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (franchise: Franchise) => {
    setEditingFranchise(franchise)
    setFormState({
      name: franchise.franchise_name,
      zone: franchise.location_zone,
      address: franchise.address,
      ownerFirstName: franchise.owner_first_name,
      ownerLastName: franchise.owner_last_name,
      ownerEmail: franchise.owner_email,
      ownerPhone: franchise.owner_phone,
      contractStartDate: franchise.contract_start_date ?? "",
      logo: franchise.logo || "",
    })
    setLogoPreview(franchise.logo || null)
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const validateForm = (): boolean => {
    const errors: FranchiseFormErrors = {}

    if (!formState.name.trim()) {
      errors.name = "Franchise name is required."
    }

    if (!formState.zone.trim()) {
      errors.zone = "Location/Zone is required."
    }

    if (!formState.address.trim()) {
      errors.address = "Address is required."
    }

    if (!formState.ownerFirstName.trim()) {
      errors.ownerFirstName = "Owner first name is required."
    }

    if (!formState.ownerLastName.trim()) {
      errors.ownerLastName = "Owner last name is required."
    }

    if (!formState.ownerEmail.trim()) {
      errors.ownerEmail = "Owner email is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.ownerEmail)) {
      errors.ownerEmail = "Please enter a valid email address."
    }

    if (!formState.ownerPhone.trim()) {
      errors.ownerPhone = "Owner phone is required."
    } else if (formState.ownerPhone.replace(/\D/g, "").length < 10) {
      errors.ownerPhone = "Please enter a valid phone number."
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Logo upload helper function
  async function uploadLogoFile(file: File) {
    try {
      const bucketName = 'logos'
      const path = `franchise-logos/${Date.now()}-${file.name}`
      
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData?.user) {
        console.error('Auth error before logo upload:', userErr)
        return null
      }

      let res = await supabase.storage.from(bucketName).upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })

      if (res.error && res.error.message?.includes('Bucket not found')) {
        console.warn('Logos bucket not found, trying invoices bucket')
        const fallbackPath = `franchise-logos/${Date.now()}-${file.name}`
        res = await supabase.storage.from('invoices').upload(fallbackPath, file, {
          cacheControl: '3600',
          upsert: false
        })
        
        if (res.error) {
          console.error('Logo upload error (invoices bucket):', res.error)
          return null
        }
        
        const publicUrl = supabase.storage.from('invoices').getPublicUrl(res.data.path).data?.publicUrl || null
        return publicUrl
      }

      if (res.error) {
        console.error('Logo upload error:', res.error)
        return null
      }

      const publicUrl = supabase.storage.from(bucketName).getPublicUrl(res.data.path).data?.publicUrl || null
      return publicUrl
    } catch (err) {
      console.error('uploadLogoFile error', err)
      return null
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setLogoPreview(result)
      setFormState((prev) => ({ ...prev, logo: result }))
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoPreview(null)
    setFormState((prev) => ({ ...prev, logo: '' }))
  }

  // Helper function to check if email exists in any table
  const checkEmailExists = async (email: string, excludeId?: string): Promise<{ exists: boolean; message: string }> => {
    const emailLower = email.toLowerCase().trim()
    
    // Check customers table
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle()
    
    if (customerData && (!excludeId || customerData.id !== excludeId)) {
      return { exists: true, message: 'This email is already registered as a customer.' }
    }
    
    // Check company table
    const { data: companyData } = await supabase
      .from('company')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle()
    
    if (companyData && (!excludeId || companyData.id !== excludeId)) {
      return { exists: true, message: 'This email is already registered as a company.' }
    }
    
    // Check drivers table
    const { data: driverData } = await supabase
      .from('drivers')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle()
    
    if (driverData && (!excludeId || driverData.id !== excludeId)) {
      return { exists: true, message: 'This email is already registered as a driver.' }
    }
    
    // Check franchises table
    const { data: franchiseData } = await supabase
      .from('franchises')
      .select('id, owner_email')
      .eq('owner_email', emailLower)
      .maybeSingle()
    
    if (franchiseData && (!excludeId || franchiseData.id !== excludeId)) {
      return { exists: true, message: 'This email is already registered as a franchise owner.' }
    }
    
    // Check staff table
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle()
    
    if (staffData && (!excludeId || staffData.id !== excludeId)) {
      return { exists: true, message: 'This email is already registered as staff.' }
    }
    
    return { exists: false, message: '' }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateForm()) return

    // Check if email already exists (only for new franchises)
    if (!editingFranchise) {
      const emailCheck = await checkEmailExists(formState.ownerEmail)
      if (emailCheck.exists) {
        toast.error(emailCheck.message)
        return
      }
    } else {
      // For edit, check if email exists in other records
      const emailCheck = await checkEmailExists(formState.ownerEmail, editingFranchise.id)
      if (emailCheck.exists) {
        toast.error(emailCheck.message)
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Upload logo if preview exists
      let logoUrl = null
      if (logoPreview && logoPreview.startsWith('data:')) {
        try {
          const res = await fetch(logoPreview)
          const blob = await res.blob()
          const file = new File([blob], `logo-${Date.now()}.png`, { type: blob.type })
          logoUrl = await uploadLogoFile(file)
          if (!logoUrl) {
            console.warn('Logo upload failed, continuing without logo')
          }
        } catch (err) {
          console.error('Error converting logo preview to file:', err)
        }
      } else if (formState.logo && !formState.logo.startsWith('data:')) {
        // If logo is already a URL (from edit), use it
        logoUrl = formState.logo
      }

      const payload = {
        franchise_name: formState.name.trim(),
        location_zone: formState.zone.trim(),
        address: formState.address.trim(),
        owner_first_name: formState.ownerFirstName.trim(),
        owner_last_name: formState.ownerLastName.trim(),
        owner_email: formState.ownerEmail.trim(),
        owner_phone: formState.ownerPhone.trim(),
        logo: logoUrl,
        contract_start_date: formState.contractStartDate ? formState.contractStartDate : null,
      }

      if (editingFranchise) {
          const { error } = await supabase
            .from("franchises")
            .update({
              ...payload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingFranchise.id)

          if (error) {
            console.error("Error updating franchise:", error)
            toast.error("Failed to update franchise. Please try again.")
            return
          }

          setFranchises((prev) =>
            prev.map((f) =>
              f.id === editingFranchise.id
                ? {
                    ...f,
                    ...payload,
                    updated_at: new Date().toISOString(),
                  }
                : f,
            ),
          )
          toast.success("Franchise updated successfully.")
        } else {
          // Save current session before creating new user
          const { data: currentSessionData, error: currentSessionError } = await supabase.auth.getSession();
          if (currentSessionError) {
            console.error('Error getting current session:', currentSessionError);
          }
          const currentAccessToken = currentSessionData?.session?.access_token;
          const currentRefreshToken = currentSessionData?.session?.refresh_token;

          // Create franchise owner auth user with temporary password
          const tempPassword = generateTemporaryPassword()

          // Add password and status to payload for new franchise
          const franchisePayload = {
            ...payload,
            password: tempPassword,
            status: 'active', // Set status to active by default
          }

          // Insert into franchises table first
          const { data: insertedFranchiseData, error: insertError } = await supabase
            .from("franchises")
            .insert(franchisePayload)
            .select(
              "id, franchise_name, location_zone, address, owner_first_name, owner_last_name, owner_email, owner_phone, contract_start_date, created_at, updated_at, status",
            )
            .single()

          if (insertError) {
            console.error("Error creating franchise:", insertError)
            toast.error("Failed to create franchise. Please try again.")
            return
          }

          // Create user in Supabase Auth
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formState.ownerEmail,
            password: tempPassword,
            options: {
              emailRedirectTo: `${window.location.origin}/login`,
              data: {
                role: "franchise_owner",
                franchise_name: formState.name,
              },
            },
          })

          if (authError) {
            console.error("Auth error (franchise):", authError)
            // If auth fails, delete the franchise record to keep data consistent
            await supabase.from("franchises").delete().eq("id", insertedFranchiseData.id);
            toast.error( 
              `  ${authError.message}`,
            )
            return
          }

          if (!authData.user) {
            console.error("Error: User account was not created")
            await supabase.from("franchises").delete().eq("id", insertedFranchiseData.id);
            toast.error("Franchise user account was not created. Please try again.")
            return
          }

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

          if (insertedFranchiseData) {
            setFranchises((prev) => [insertedFranchiseData as Franchise, ...prev])
            toast.success("Franchise created successfully.")
          }

          // Send temporary credentials via Edge Function (non-blocking)
          const loginUrl = `${window.location.origin}/login`
          supabase.functions
            .invoke("clever-handler", {
              body: {
                to: formState.ownerEmail,
                name: `${formState.ownerFirstName} ${formState.ownerLastName}`.trim(),
                email: formState.ownerEmail,
                password: tempPassword,
                role: "Franchise",
                loginUrl,
                franchiseName: formState.name,
                contractStartDate: formState.contractStartDate || null,
              },
            })
            .then(({ error: emailError }) => {
              if (emailError) {
                console.log("Franchise email function error (non-blocking):", emailError.message)
              }
            })
            .catch((err) => {
              console.log("Franchise email function not configured (non-blocking):", err)
            })
        }

      setIsDialogOpen(false)
      resetForm()
    } catch (err) {
      console.error("Unexpected error saving franchise:", err)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = (franchise: Franchise, status: 'active' | 'inactive') => {
    setFranchiseToChangeStatus(franchise)
    setNewStatus(status)
    setStatusChangeDialogOpen(true)
  }

  const confirmStatusChange = async () => {
    if (!franchiseToChangeStatus) return

    try {
      const { error } = await supabase
        .from("franchises")
        .update({ status: newStatus })
        .eq("id", franchiseToChangeStatus.id)

      if (error) {
        console.error("Error updating franchise status:", error)
        toast.error("Failed to update franchise status. Please try again.")
        return
      }

      // Update local state
      setFranchises((prev) =>
        prev.map((f) =>
          f.id === franchiseToChangeStatus.id ? { ...f, status: newStatus } : f
        )
      )

      toast.success(`Franchise ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`)
      setStatusChangeDialogOpen(false)
      setFranchiseToChangeStatus(null)
    } catch (err) {
      console.error("Error updating franchise status:", err)
      toast.error("Failed to update franchise status. Please try again.")
    }
  }

  const handleDelete = (id: string) => {
    const deleteFranchise = async () => {
      try {
        const { error } = await supabase.from("franchises").delete().eq("id", id)

        if (error) {
          console.error("Error deleting franchise:", error)
          toast.error("Failed to delete franchise. Please try again.")
          return
        }

        setFranchises((prev) => prev.filter((f) => f.id !== id))
        toast.success("Franchise deleted successfully.")
      } catch (err) {
        console.error("Unexpected error deleting franchise:", err)
        toast.error("Something went wrong while deleting.")
      }
    }

    void deleteFranchise()
  }

  const filteredFranchises = franchises.filter((franchise) => {
    if (!searchTerm.trim()) return true
    const search = searchTerm.toLowerCase()

    return (
      franchise.franchise_name.toLowerCase().includes(search) ||
      franchise.location_zone.toLowerCase().includes(search) ||
      franchise.owner_first_name.toLowerCase().includes(search) ||
      franchise.owner_last_name.toLowerCase().includes(search) ||
      franchise.owner_email.toLowerCase().includes(search)
    )
  })

  // Sort franchises
  const sortedFranchises = [...filteredFranchises].sort((a, b) => {
    if (!sortColumn) return 0

    let aValue: any
    let bValue: any

    switch (sortColumn) {
      case 'franchise_name':
        aValue = a.franchise_name || ''
        bValue = b.franchise_name || ''
        break
      case 'owner':
        aValue = `${a.owner_first_name || ''} ${a.owner_last_name || ''}`.trim() || ''
        bValue = `${b.owner_first_name || ''} ${b.owner_last_name || ''}`.trim() || ''
        break
      case 'zone':
        aValue = a.location_zone || ''
        bValue = b.location_zone || ''
        break 
      default:
        return 0
    }

    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    }

    // Handle number comparison
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
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

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentFranchises = sortedFranchises.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sortedFranchises.length / itemsPerPage)

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Show loading while checking access
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
    <div className="space-y-6">
      {pathName !== "/admin/dashboard" &&
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Franchise Management</h1>
          <p className="text-sm text-muted-foreground">System-wide franchise oversight</p>
        </div>
        <div className="flex items-center gap-2">
         
          <Button onClick={handleOpenAdd} className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            Create New Franchise
          </Button>
        </div>
      </div>
      }
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                All Franchises ({filteredFranchises.length})
              </CardTitle>
              <CardDescription>System-wide franchise visibility and performance metrics.</CardDescription>
            </div>
          </div>
          <div className="relative w-[50%]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, owner, email or zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '5%' }} />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[260px] cursor-pointer hover:bg-muted" onClick={() => handleSort('franchise_name')}>
                    <div className="flex items-center gap-2">
                      <span>Franchise Name</span>
                      {sortColumn === 'franchise_name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('owner')}>
                    <div className="flex items-center gap-2">
                      <span>Owner</span>
                      {sortColumn === 'owner' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('zone')}>
                    <div className="flex items-center gap-2">
                      <span>Zone</span>
                      {sortColumn === 'zone' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Cases Sold (Month)</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('last_activity')}>
                    <div className="flex items-center gap-2">
                      <span>Last Activity</span>
                      
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px] text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Loading franchises...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredFranchises.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No franchises found.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  currentFranchises.map((franchise) => (
                  <TableRow key={franchise.id}>
                    <TableCell className="align-top truncate">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm truncate">{franchise.franchise_name}</span>
                        <span className="text-xs text-muted-foreground">
                          Registered:{" "}
                          {franchise.contract_start_date ||
                            franchise.created_at?.slice(0, 10) ||
                            "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top truncate">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium truncate">
                          {franchise.owner_first_name} {franchise.owner_last_name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {franchise.owner_email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground truncate">
                      {franchise.location_zone}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge 
                        variant={franchise.status === 'inactive' ? 'secondary' : 'default'} 
                        className={`rounded-full px-3 py-1 text-xs ${
                          franchise.status === 'inactive' 
                            ? 'bg-gray-100 text-gray-800' 
                            : 'bg-gray-900 text-white'
                        }`}
                      >
                        {franchise.status === 'inactive' ? 'Inactive' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top text-right text-sm">
                      {franchise.customersCount ?? 0}
                    </TableCell>
                    <TableCell className="align-top text-right text-sm">
                      {franchise.ordersCount ?? 0}
                    </TableCell>
                    <TableCell className="align-top text-right text-sm">
                      {franchise.casesSoldThisMonth ?? 0}
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {franchise.updated_at?.slice(0, 10) || "-"}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/franchise/${franchise.id}`}>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="View details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {pathName !== "/admin/dashboard" &&
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {franchise.status === 'inactive' ? (
                              <DropdownMenuItem onClick={() => handleStatusChange(franchise, 'active')}>
                                <Power className="mr-2 h-4 w-4" />
                                Activate Franchise
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleStatusChange(franchise, 'inactive')}>
                                <Power className="mr-2 h-4 w-4" />
                                Deactivate Franchise
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleOpenEdit(franchise)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(franchise.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
}
                      </div>
                    </TableCell>
                  </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination Controls */}
          {filteredFranchises.length > 0 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, sortedFranchises.length)} of {sortedFranchises.length} franchises
                </p>
                <div className="flex items-center gap-2">
                  <Label htmlFor="itemsPerPage" className="text-sm text-muted-foreground whitespace-nowrap">
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
{pathName !== "/admin/dashboard" &&
      <Card className="border-dashed bg-muted/40">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Franchise Data Access</CardTitle>
            <CardDescription className="mt-1 text-sm leading-relaxed">
              As Super Admin, you can view all franchise data for oversight purposes, but cannot modify
              franchise orders, customers, or settings. Each franchise operates independently with full
              autonomy.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
}
      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={statusChangeDialogOpen} onOpenChange={setStatusChangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Franchise Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {newStatus === 'inactive' ? 'deactivate' : 'activate'} this franchise?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setStatusChangeDialogOpen(false)
              setFranchiseToChangeStatus(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusChange}
              className={newStatus === 'inactive' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {newStatus === 'inactive' ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isDialogOpen}
        
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent   onInteractOutside={(e) => {
            // Prevent closing when clicking outside the modal
            e.preventDefault()
          }} onEscapeKeyDown={(e) => {
            // Optionally prevent closing on Escape key as well
            // e.preventDefault() // Uncomment if you want to prevent Escape key from closing
          }} className="max-w-xl h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFranchise ? "Edit Franchise" : "Create New Franchise"}
            </DialogTitle>
            <DialogDescription>
              {editingFranchise
                ? "Update the franchise details below."
                : "Fill in the details below to create a new franchise."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid gap-4 md:grid-cols-2 ">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="name">
                  Franchise Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formState.name}
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Orlando Downtown Location"
                  className={formErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-500">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="zone">
                  Location/Zone <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="zone"
                  value={formState.zone}
                  onChange={(e) => setFormState((prev) => ({ ...prev, zone: e.target.value }))}
                  placeholder="e.g., Zone E - Orlando"
                  className={formErrors.zone ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {formErrors.zone && (
                  <p className="text-xs text-red-500">{formErrors.zone}</p>
                )}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="address">
                  Address <span className="text-red-500">*</span>
                </Label>
                <AddressAutocomplete
                value={formState.address}
                onChange={(value) => setFormState((prev) => ({ ...prev, address: value }))}
                className={`${formErrors.address ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Enter company address"
              />
                
                {formErrors.address && (
                  <p className="text-xs text-red-500">{formErrors.address}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerFirstName">
                  Owner First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ownerFirstName"
                  value={formState.ownerFirstName}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, ownerFirstName: e.target.value }))
                  }
                  placeholder="Enter first name"
                  className={
                    formErrors.ownerFirstName ? "border-red-500 focus-visible:ring-red-500" : ""
                  }
                />
                {formErrors.ownerFirstName && (
                  <p className="text-xs text-red-500">{formErrors.ownerFirstName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerLastName">
                  Owner Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ownerLastName"
                  value={formState.ownerLastName}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, ownerLastName: e.target.value }))
                  }
                  placeholder="Enter last name"
                  className={
                    formErrors.ownerLastName ? "border-red-500 focus-visible:ring-red-500" : ""
                  }
                />
                {formErrors.ownerLastName && (
                  <p className="text-xs text-red-500">{formErrors.ownerLastName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerEmail">
                  Owner Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={formState.ownerEmail}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, ownerEmail: e.target.value }))
                  }
                  placeholder="email@example.com"
                  className={
                    formErrors.ownerEmail ? "border-red-500 focus-visible:ring-red-500" : ""
                  }
                />
                {formErrors.ownerEmail && (
                  <p className="text-xs text-red-500">{formErrors.ownerEmail}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerPhone">
                  Owner Phone <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ownerPhone"
                  value={formState.ownerPhone}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, ownerPhone: e.target.value }))
                  }
                  placeholder="+1 (XXX) XXX-XXXX"
                  className={
                    formErrors.ownerPhone ? "border-red-500 focus-visible:ring-red-500" : ""
                  }
                />
                {formErrors.ownerPhone && (
                  <p className="text-xs text-red-500">{formErrors.ownerPhone}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contractStartDate">
                  Contract Start Date
                </Label>
                <Input
                  id="contractStartDate"
                  type="date"
                  value={formState.contractStartDate}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, contractStartDate: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="logo">Franchise Logo (Optional)</Label>
              <div className="space-y-1.5 md:col-span-1">

                {logoPreview ? (
                  <div className="relative inline-block">
                    <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-50">
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={handleRemoveLogo}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-sky-400 hover:bg-sky-50 transition-colors">
                        <Upload className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">Upload Logo</span>
                      </div>
                      <input
                        type="file"
                        id="logo"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </label>
                    <span className="text-xs text-slate-500">(PNG, JPG up to 5MB)</span>
                  </div>
                )}
              </div>
            </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {editingFranchise ? "Save Changes" : "Create Franchise & Send Credentials"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
