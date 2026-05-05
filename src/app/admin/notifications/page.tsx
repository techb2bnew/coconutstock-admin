'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Send, Calendar, Clock, Paperclip, Eye, Edit, Trash2, Users, User, X, Bell } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Notification {
  id: string
  notification_id?: string
  title: string
  message: string
  recipient_type: string
  recipient_count: number
  scheduled_date?: string
  scheduled_time?: string
  schedule_type?: string
  recurrence?: string
  day_of_week?: string
  status: string
  sent_at?: string
  attachments?: string[]
  created_at: string
}

interface FranchiseNotification {
  id: string
  title: string
  message: string
  target_type: 'all' | 'selected'
  franchise_ids: string[] | null
  recipient_count: number
  status: string
  sent_at: string | null
  created_at: string
}

interface Customer {
  id: string
  company_name: string
  first_name: string
  last_name: string
  email: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const hasCheckedRef = useRef(false) // Ref to prevent duplicate checks
  
  const [activeTab, setActiveTab] = useState<'send' | 'scheduled' | 'history' | 'received'>('send')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [scheduledNotifications, setScheduledNotifications] = useState<Notification[]>([])
  const [historyNotifications, setHistoryNotifications] = useState<Notification[]>([])
  const [receivedNotifications, setReceivedNotifications] = useState<FranchiseNotification[]>([])
  const [isFranchiseContext, setIsFranchiseContext] = useState(false)
  
  const [form, setForm] = useState({
    recipientType: '',
    title: '',
    message: '',
    deliveryOption: 'send_now',
    scheduleType: 'one_time',
    scheduleDate: '',
    dayOfWeek: '',
    scheduleTime: '',
    files: [] as File[],
    selectedCustomers: [] as string[] // Array of customer IDs
  })
  
  // Customer selection state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)

  const [messageLength, setMessageLength] = useState(0)
  const maxMessageLength = 500
  
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [editNotification, setEditNotification] = useState<Notification | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null)

  const fetchReceivedNotifications = async () => {
    try {
      const currentFranchiseId = typeof window !== 'undefined'
        ? localStorage.getItem('current_franchise_id')
        : null

      if (!currentFranchiseId) {
        setReceivedNotifications([])
        return
      }

      const { data, error } = await supabase
        .from('franchise_notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const filtered = (data || []).filter((n: any) => {
        if (n.target_type === 'all') return true
        if (n.target_type === 'selected' && Array.isArray(n.franchise_ids)) {
          return n.franchise_ids.includes(currentFranchiseId)
        }
        return false
      })

      setReceivedNotifications(filtered as FranchiseNotification[])
    } catch (error) {
      console.error('Error fetching received franchise notifications:', error)
      setReceivedNotifications([])
    }
  }

  // Security: Block super admin from accessing notifications page
  useEffect(() => {
    const checkAccess = async () => {
      if (hasCheckedRef.current) return // Prevent duplicate checks
      hasCheckedRef.current = true

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email

        if (!email) {
          router.push('/login')
          return
        }

        // Check if user is staff and super admin
        const { data: staffData } = await supabase
          .from('staff')
          .select('is_super_admin, status')
          .eq('email', email)
          .maybeSingle()

        if (staffData && staffData.status === 'Active' && staffData.is_super_admin === true) {
          // Super admin - deny access
          toast.error('Access denied. Notifications is not available for Super Admin.')
          router.push('/admin/dashboard')
          return
        }

        const currentFranchiseId = typeof window !== 'undefined'
          ? localStorage.getItem('current_franchise_id')
          : null
        const isSuperAdminLocal = typeof window !== 'undefined'
          ? localStorage.getItem('is_super_admin') === 'true'
          : false

        setIsFranchiseContext(!!currentFranchiseId && !isSuperAdminLocal)

        // Allow access for franchise owners and regular staff
        setIsCheckingAccess(false)
        fetchNotifications()
        fetchCustomers()
        fetchReceivedNotifications()
      } catch (error) {
        console.error('Access check error:', error)
        toast.error('Error verifying access. Please try again.')
        router.push('/admin/dashboard')
      }
    }

    checkAccess()
  }, [router])

  // Test toast on mount (remove after testing)
  // useEffect(() => {
  //   toast.success('Notifications page loaded')
  // }, [])

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.customer-dropdown-container')) {
        setCustomerDropdownOpen(false)
      }
    }

    if (customerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [customerDropdownOpen])

  const fetchCustomers = async () => {
    try {
      // Get franchise_id for filtering
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      let customerQuery = supabase
        .from('customers')
        .select('id, company_name, first_name, last_name, email')
        .order('company_name', { ascending: true });

      // Filter based on user role:
      // Super Admin: Show only customers where franchise_id IS NULL (no franchise assigned)
      // Franchise: Show only customers where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees only customers with no franchise_id (franchise_id IS NULL)
        customerQuery = customerQuery.is('franchise_id', null);
      } else if (currentFranchiseId) {
        // Franchise sees only their own data
        customerQuery = customerQuery.eq('franchise_id', currentFranchiseId);
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        customerQuery = customerQuery.eq('id', '-1'); // Impossible condition
      }

      const { data, error } = await customerQuery;

      if (error) throw error
      console.log(`📋 Fetched ${data?.length || 0} customers for notification dropdown (Super Admin: ${isSuperAdmin})`)
      setCustomers((data || []) as Customer[])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchNotifications = async () => {
    try {
      // Get franchise_id for filtering
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      let query = supabase
        .from('notifications')
        .select('*');

      // Filter based on user role:
      // Super Admin: Show only notifications where franchise_id IS NULL (no franchise assigned)
      // Franchise: Show only notifications where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees only notifications with no franchise_id (franchise_id IS NULL)
        query = query.is('franchise_id', null);
      } else if (currentFranchiseId) {
        // Franchise sees only their own notifications
        query = query.eq('franchise_id', currentFranchiseId);
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        query = query.eq('id', '-1'); // Impossible condition
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error

      // Use data directly (already filtered at query level)
      let filteredNotifications = data || [];

      // Separate notifications by status
      const scheduled = filteredNotifications.filter(n => n.status === 'scheduled')
      const history = filteredNotifications.filter(n => n.status === 'sent' || n.status === 'failed')
      
      setScheduledNotifications(scheduled)
      setHistoryNotifications(history)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 10) {
      toast.error('Maximum 10 files allowed')
      return
    }
    setForm({ ...form, files: [...form.files, ...files] })
  }

  // Helper function to upload files to Supabase storage
  const uploadAttachments = async (files: File[]): Promise<string[]> => {
    if (!files || files.length === 0) return []

    const uploadedUrls: string[] = []

    try {
      // Verify user is authenticated before storage upload
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData?.user) {
        console.error('Auth error before file upload:', userErr)
        toast.error('Authentication required for file upload')
        return []
      }

      // Use 'invoices' bucket as it's more likely to exist and have proper permissions
      // You can create a 'notifications' bucket later if needed
      const bucketName = 'invoices'

      for (const file of files) {
        try {
          const timestamp = Date.now()
          const filenameSafe = file.name.replace(/\s+/g, '-')
          const path = `notification-attachments/${timestamp}-${filenameSafe}`

          const uploadRes = await supabase.storage
            .from(bucketName)
            .upload(path, file, {
              cacheControl: '3600',
              upsert: false
            })
          
          if (uploadRes.error) {
            console.error('File upload error:', uploadRes.error)
            // If upload fails, show warning but continue with other files
            toast.warning(`Failed to upload ${file.name}`, {
              description: uploadRes.error.message
            })
            continue
          }
          
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(uploadRes.data.path)
          
          if (urlData?.publicUrl) {
            uploadedUrls.push(urlData.publicUrl)
          }
        } catch (err) {
          console.error('Error uploading file:', err)
          toast.warning(`Failed to upload ${file.name}`)
          continue
        }
      }

      if (uploadedUrls.length > 0 && uploadedUrls.length < files.length) {
        toast.warning(`Uploaded ${uploadedUrls.length} of ${files.length} files`)
      }

      return uploadedUrls
    } catch (err) {
      console.error('Error in uploadAttachments:', err)
      toast.error('Error uploading attachments')
      return []
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!form.recipientType.trim()) {
      newErrors.recipientType = 'Recipient type is required'
    }
    
    if (!form.title.trim()) {
      newErrors.title = 'Notification title is required'
    }
    
    if (!form.message.trim()) {
      newErrors.message = 'Message is required'
    } else if (form.message.length > maxMessageLength) {
      newErrors.message = `Message cannot exceed ${maxMessageLength} characters`
    }
    
    if (form.recipientType === 'selected_customers' && form.selectedCustomers.length === 0) {
      newErrors.selectedCustomers = 'Please select at least one customer'
    }
    
    if (form.deliveryOption === 'schedule') {
      if (form.scheduleType === 'weekly' && !form.dayOfWeek) {
        newErrors.dayOfWeek = 'Day of week is required for weekly schedule'
      } else if (form.scheduleType !== 'weekly' && !form.scheduleDate) {
        newErrors.scheduleDate = 'Date is required'
      }
      
      if (!form.scheduleTime) {
        newErrors.scheduleTime = 'Time is required'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Helper function to send FCM push notifications
  // Using Next.js API route with Firebase Admin SDK (V1 API)
  // Service Account JSON is configured in .env.local
  const sendFCMNotification = async (tokens: string[], title: string, message: string) => {
    try { 
      
      if (!tokens || tokens.length === 0) {
        console.warn('⚠️ No FCM tokens found. Push notifications will not be sent.')
        console.warn('Make sure customers have logged in via mobile app and FCM tokens are stored in database.')
        toast.error('No FCM tokens found', {
          description: 'Make sure customers have logged in via mobile app.'
        })
        return { success: false, error: 'No FCM tokens found' }
      }

      // Filter out null/undefined/empty tokens
      const validTokens = tokens.filter(token => token && token.trim() !== '')

      if (validTokens.length === 0) {
        console.warn('⚠️ No valid FCM tokens found. Push notifications will not be sent.')
        toast.error('No valid FCM tokens found', {
          description: 'Make sure customers have valid FCM tokens in database.'
        })
        return { success: false, error: 'No valid FCM tokens found' }
      }

      console.log(`✅ Sending FCM notification to ${validTokens.length} device(s) via Supabase Edge Function`)

      // Call Supabase Edge Function (uses FCM REST API V1 - same as scheduled notifications)
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
      
      // Note: Edge Function automatically removes invalid tokens from database
      if (result.invalidTokens && result.invalidTokens.length > 0) {
        console.log(`🗑️ Edge Function removed ${result.invalidTokens.length} invalid FCM token(s) from database`)
      }
      
      // Check for failures (Edge Function returns successCount, failureCount, invalidTokens)
      if (result.failureCount > 0) {
        console.warn(`⚠️ ${result.failureCount} notification(s) failed out of ${validTokens.length}`)
        
        // Show user-friendly message
        if (result.invalidTokens && result.invalidTokens.length > 0) {
          toast.warning(`${result.invalidTokens.length} customer(s) have invalid FCM tokens`, {
            description: 'Please ask them to login again via mobile app to refresh their token.'
          })
        } else {
          toast.warning(`${result.failureCount} notification(s) failed`, {
            description: 'Some notifications could not be delivered.'
          })
        }
      }
      
      if (result.successCount > 0) {
        console.log(`✅ Successfully sent to ${result.successCount} device(s)`)
      }
      
      return { success: true, result }
    } catch (error) {
      console.error('❌ Error sending FCM notification:', error)
      toast.error('Error sending FCM notification', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Helper function to fetch FCM tokens based on recipient type
  const fetchFCMTokens = async (recipientType: string, selectedCustomerIds?: string[]) => {
    try {
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      console.log('🔍 Fetching FCM Tokens - Debug Info:')
      console.log('- Recipient Type:', recipientType)
      console.log('- Selected Customer IDs:', selectedCustomerIds)
      console.log('- Current Franchise ID:', currentFranchiseId)
      console.log('- Is Super Admin:', isSuperAdmin)

      let tokens: string[] = []

      if (recipientType === 'all_customers') {
        let query = supabase
          .from('customers')
          .select('id, email, fcm_token')
          .not('fcm_token', 'is', null)
        
        // Filter based on user role:
        // Super Admin: Send only to customers where franchise_id IS NULL (no franchise assigned)
        // Franchise: Send only to customers where franchise_id = their franchise_id
        if (isSuperAdmin) {
          // Super admin sends only to customers with no franchise_id (franchise_id IS NULL)
          query = query.is('franchise_id', null)
        } else if (currentFranchiseId) {
          // Franchise sends only to their own customers
          query = query.eq('franchise_id', currentFranchiseId)
        } else {
          // If no franchise_id found, return empty (shouldn't happen but safety check)
          query = query.eq('id', '-1') // Impossible condition
        }

        const { data, error } = await query
        if (error) {
          console.error('❌ Error fetching customer FCM tokens:', error)
          throw error
        }
        
        console.log(`📋 Found ${data?.length || 0} customers with FCM tokens (Super Admin: ${isSuperAdmin})`)
        if (data && data.length > 0) {
          console.log('Customer FCM tokens:', data.map((c: any) => ({ id: c.id, email: c.email, hasToken: !!c.fcm_token })))
        }
        
        tokens = (data || []).map((c: any) => c.fcm_token).filter(Boolean)
      } 
      else if (recipientType === 'selected_customers' && selectedCustomerIds && selectedCustomerIds.length > 0) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, email, fcm_token')
          .in('id', selectedCustomerIds)
          .not('fcm_token', 'is', null)
        
        if (error) {
          console.error('❌ Error fetching selected customer FCM tokens:', error)
          throw error
        }
        
        console.log(`📋 Found ${data?.length || 0} selected customers with FCM tokens`)
        if (data && data.length > 0) {
          console.log('Selected Customer FCM tokens:', data.map((c: any) => ({ id: c.id, email: c.email, hasToken: !!c.fcm_token })))
        }
        
        tokens = (data || []).map((c: any) => c.fcm_token).filter(Boolean)
      }
      else if (recipientType === 'all_staff') {
        let query = supabase
          .from('staff')
          .select('id, email, fcm_token')
          .not('fcm_token', 'is', null)
        
        if (!isSuperAdmin && currentFranchiseId) {
          query = query.eq('franchise_id', currentFranchiseId)
        }

        const { data, error } = await query
        if (error) {
          console.error('❌ Error fetching staff FCM tokens:', error)
          throw error
        }
        
        console.log(`📋 Found ${data?.length || 0} staff with FCM tokens`)
        tokens = (data || []).map((s: any) => s.fcm_token).filter(Boolean)
      }

      console.log(`✅ Total FCM tokens fetched: ${tokens.length}`)
      return tokens
    } catch (error) {
      console.error('❌ Error fetching FCM tokens:', error)
      return []
    }
  }

  const handleSendNotification = async () => {
    if (!validateForm()) {
      return
    }

    try {
      // Get franchise_id for storing with notification (must be declared first)
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      // Get recipient count based on type
      let recipientCount = 0
      if (form.recipientType === 'all_customers') {
        // Filter based on user role for count
        let countQuery = supabase.from('customers').select('*', { count: 'exact', head: true })
        if (isSuperAdmin) {
          // Super Admin: count only customers with no franchise_id (franchise_id IS NULL)
          countQuery = countQuery.is('franchise_id', null)
        } else if (currentFranchiseId) {
          // Franchise: count only their own customers
          countQuery = countQuery.eq('franchise_id', currentFranchiseId)
        }
        const { count } = await countQuery
        recipientCount = count || 0
      } else if (form.recipientType === 'all_staff') {
        // Filter based on user role for count
        let countQuery = supabase.from('staff').select('*', { count: 'exact', head: true })
        if (!isSuperAdmin && currentFranchiseId) {
          countQuery = countQuery.eq('franchise_id', currentFranchiseId)
        }
        // If Super Admin, no filter - count all staff
        const { count } = await countQuery
        recipientCount = count || 0
      } else if (form.recipientType === 'selected_customers') {
        recipientCount = form.selectedCustomers.length
      }

      // Upload attachments if any
      const attachmentUrls = form.files.length > 0 ? await uploadAttachments(form.files) : []

      const notificationData: any = {
        title: form.title,
        message: form.message,
        recipient_type: form.recipientType,
        recipient_count: recipientCount,
        status: form.deliveryOption === 'send_now' ? 'sent' : 'scheduled',
        created_at: new Date().toISOString(),
        recipient_ids: form.recipientType === 'selected_customers' ? form.selectedCustomers : null,
        franchise_id: !isSuperAdmin && currentFranchiseId ? currentFranchiseId : null, // Store franchise_id
      }

      if (form.deliveryOption === 'schedule') {
        // Helper function to convert IST time to UTC time
        // User selects time in IST, but database stores in UTC
        const convertISTtoUTC = (istTime: string): string => {
          // IST time format: "HH:MM" or "HH:MM:SS"
          const [hours, minutes, seconds] = istTime.split(':').map(Number)
          // Create a date object for today in IST
          const istDate = new Date()
          istDate.setHours(hours, minutes || 0, seconds || 0, 0)
          // Convert IST to UTC (IST = UTC + 5:30, so UTC = IST - 5:30)
          const utcDate = new Date(istDate.getTime() - (5.5 * 60 * 60 * 1000))
          // Return time in HH:MM:SS format
          return `${utcDate.getHours().toString().padStart(2, '0')}:${utcDate.getMinutes().toString().padStart(2, '0')}:${utcDate.getSeconds().toString().padStart(2, '0')}`
        }

        // For weekly, use day of week; for others, use date
        if (form.scheduleType === 'weekly') {
          // Calculate next occurrence date based on day of week
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          const selectedDayIndex = days.indexOf(form.dayOfWeek)
          const today = new Date()
          const currentDay = today.getDay()
          let daysUntilNext = (selectedDayIndex - currentDay + 7) % 7
          if (daysUntilNext === 0) daysUntilNext = 7 // Next week if today is the selected day
          const nextDate = new Date(today)
          nextDate.setDate(today.getDate() + daysUntilNext)
          notificationData.scheduled_date = nextDate.toISOString().split('T')[0]
        } else {
          notificationData.scheduled_date = form.scheduleDate
        }
        // Convert IST time to UTC before storing
        notificationData.scheduled_time = convertISTtoUTC(form.scheduleTime)
        notificationData.schedule_type = form.scheduleType
        notificationData.recurrence = form.scheduleType === 'one_time' ? null : form.scheduleType
        if (form.scheduleType === 'weekly') {
          notificationData.day_of_week = form.dayOfWeek
        }
      } else {
        notificationData.sent_at = new Date().toISOString()
      }

      // Set attachments AFTER all conditional fields are set
      if (attachmentUrls.length > 0) {
        notificationData.attachments = attachmentUrls
      } else {
        notificationData.attachments = null
      }

      // Log the payload before insert for debugging
      console.log('📤 Notification payload before insert:', JSON.stringify(notificationData, null, 2))
      console.log('📎 Attachments URLs:', attachmentUrls)
      console.log('📎 Attachments in payload:', notificationData.attachments)

      const { error, data } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select()

      if (error) {
        console.error('❌ Insert error:', error)
        console.error('❌ Error details:', JSON.stringify(error, null, 2))
        throw error
      }
      
      console.log('✅ Inserted notification:', data)
      console.log('✅ Inserted attachments:', data?.[0]?.attachments)
      
      // Verify attachments were saved
      if (attachmentUrls.length > 0 && !data?.[0]?.attachments) {
        console.warn('⚠️ Warning: Attachments were sent but not saved to database')
        toast.warning('Attachments uploaded but may not be saved', {
          description: 'Please check database permissions'
        })
      }

      // Send FCM push notification if sending now (not scheduled)
      if (form.deliveryOption === 'send_now') {
        console.log('📤 Preparing to send FCM notification...')
        const fcmTokens = await fetchFCMTokens(
          form.recipientType,
          form.recipientType === 'selected_customers' ? form.selectedCustomers : undefined
        )
        
        if (fcmTokens.length > 0) { 
          const fcmResult = await sendFCMNotification(fcmTokens, form.title, form.message)
          if (fcmResult.success) { 
            toast.success(`Notification sent successfully`, {
              description: `Sent to ${fcmTokens.length} device(s)`
            })
          } else { 
            toast.warning('Notification saved to database', {
              description: `FCM push failed: ${fcmResult.error}`
            })
          }
        } else { 
          toast.info('Notification saved to database', {
            description: 'No FCM tokens found. Make sure customers have logged in via mobile app.'
          })
        }
      }

      // Reset form
      setForm({
        recipientType: '',
        title: '',
        message: '',
        deliveryOption: 'send_now',
        scheduleType: 'one_time',
        scheduleDate: '',
        dayOfWeek: '',
        scheduleTime: '',
        files: [],
        selectedCustomers: []
      })
      setMessageLength(0)
      setCustomerSearchTerm('')
      setCustomerDropdownOpen(false)

      // Refresh notifications
      await fetchNotifications()
      
      // Switch to appropriate tab
      if (form.deliveryOption === 'schedule') {
        setActiveTab('scheduled')
      } else {
        setActiveTab('history')
      } 
    } catch (error) {
      console.error('Error sending notification:', error)
      toast.error('Error sending notification', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  const handleClearForm = () => {
    setForm({
      recipientType: '',
      title: '',
      message: '',
      deliveryOption: 'send_now',
      scheduleType: 'one_time',
      scheduleDate: '',
      dayOfWeek: '',
      scheduleTime: '',
      files: [],
      selectedCustomers: []
    })
    setMessageLength(0)
    setEditNotification(null)
    setErrors({})
    setCustomerSearchTerm('')
    setCustomerDropdownOpen(false)
  }

  const filteredCustomersList = customers.filter(customer => {
    if (!customerSearchTerm.trim()) return true
    const search = customerSearchTerm.toLowerCase()
    return (
      customer.company_name?.toLowerCase().includes(search) ||
      customer.first_name?.toLowerCase().includes(search) ||
      customer.last_name?.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search)
    )
  })

  const handleCustomerToggle = (customerId: string) => {
    setForm(prev => {
      const isSelected = prev.selectedCustomers.includes(customerId)
      return {
        ...prev,
        selectedCustomers: isSelected
          ? prev.selectedCustomers.filter(id => id !== customerId)
          : [...prev.selectedCustomers, customerId]
      }
    })
    setErrors(prev => ({ ...prev, selectedCustomers: '' }))
  }

  const handleSelectAllCustomers = () => {
    const filtered = filteredCustomersList
    const allSelected = filtered.every(c => form.selectedCustomers.includes(c.id))
    
    setForm(prev => ({
      ...prev,
      selectedCustomers: allSelected
        ? prev.selectedCustomers.filter(id => !filtered.some(c => c.id === id))
        : [...new Set([...prev.selectedCustomers, ...filtered.map(c => c.id)])]
    }))
    setErrors(prev => ({ ...prev, selectedCustomers: '' }))
  }

  const handleRemoveCustomer = (customerId: string) => {
    setForm(prev => ({
      ...prev,
      selectedCustomers: prev.selectedCustomers.filter(id => id !== customerId)
    }))
  }

  const handleView = (notification: Notification) => {
    setSelectedNotification(notification)
    setViewModalOpen(true)
  }

  const handleEdit = (notification: Notification) => {
    setEditNotification(notification)
    // Pre-fill form with notification data
    const recipientIds = (notification as any).recipient_ids || []
    setForm({
      recipientType: notification.recipient_type,
      title: notification.title,
      message: notification.message,
      deliveryOption: notification.status === 'scheduled' ? 'schedule' : 'send_now',
      scheduleType: notification.schedule_type || 'one_time',
      scheduleDate: notification.scheduled_date || '',
      dayOfWeek: notification.day_of_week || '',
      scheduleTime: notification.scheduled_time || '',
      files: [],
      selectedCustomers: Array.isArray(recipientIds) ? recipientIds : []
    })
    setMessageLength(notification.message.length)
    setActiveTab('send')
  }

  const handleDelete = (notification: Notification) => {
    setNotificationToDelete(notification)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!notificationToDelete) return

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationToDelete.id)

      if (error) throw error

      // Refresh notifications
      await fetchNotifications()
      setDeleteConfirmOpen(false)
      setNotificationToDelete(null)
      toast.success('Notification deleted successfully')
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Error deleting notification', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  const handleUpdateNotification = async () => {
    if (!editNotification) return
    if (!validateForm()) {
      return
    }

    try {
      // Get franchise_id for storing with notification (must be declared first)
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      // Get recipient count based on type
      let recipientCount = 0
      if (form.recipientType === 'all_customers') {
        // Filter based on user role for count
        let countQuery = supabase.from('customers').select('*', { count: 'exact', head: true })
        if (isSuperAdmin) {
          // Super Admin: count only customers with no franchise_id (franchise_id IS NULL)
          countQuery = countQuery.is('franchise_id', null)
        } else if (currentFranchiseId) {
          // Franchise: count only their own customers
          countQuery = countQuery.eq('franchise_id', currentFranchiseId)
        }
        const { count } = await countQuery
        recipientCount = count || 0
      } else if (form.recipientType === 'all_staff') {
        // Filter based on user role for count
        let countQuery = supabase.from('staff').select('*', { count: 'exact', head: true })
        if (!isSuperAdmin && currentFranchiseId) {
          countQuery = countQuery.eq('franchise_id', currentFranchiseId)
        }
        // If Super Admin, no filter - count all staff
        const { count } = await countQuery
        recipientCount = count || 0
      }

      // Upload attachments if any
      const attachmentUrls = form.files.length > 0 ? await uploadAttachments(form.files) : []

      const notificationData: any = {
        title: form.title,
        message: form.message,
        recipient_type: form.recipientType,
        recipient_count: recipientCount,
        status: form.deliveryOption === 'send_now' ? 'sent' : 'scheduled',
        franchise_id: !isSuperAdmin && currentFranchiseId ? currentFranchiseId : null, // Store franchise_id as string
      }

      if (form.deliveryOption === 'schedule') {
        if (form.scheduleType === 'weekly') {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          const selectedDayIndex = days.indexOf(form.dayOfWeek)
          const today = new Date()
          const currentDay = today.getDay()
          let daysUntilNext = (selectedDayIndex - currentDay + 7) % 7
          if (daysUntilNext === 0) daysUntilNext = 7
          const nextDate = new Date(today)
          nextDate.setDate(today.getDate() + daysUntilNext)
          notificationData.scheduled_date = nextDate.toISOString().split('T')[0]
        } else {
          notificationData.scheduled_date = form.scheduleDate
        }
        notificationData.scheduled_time = form.scheduleTime
        notificationData.schedule_type = form.scheduleType
        notificationData.recurrence = form.scheduleType === 'one_time' ? null : form.scheduleType
        if (form.scheduleType === 'weekly') {
          notificationData.day_of_week = form.dayOfWeek
        }
      }

      // Set attachments AFTER all conditional fields are set - ensure it's an array for jsonb column
      if (attachmentUrls && attachmentUrls.length > 0) {
        notificationData.attachments = attachmentUrls
      } else {
        notificationData.attachments = null
      }

      console.log('📎 Final attachments before insert:', notificationData.attachments)

      const { error } = await supabase
        .from('notifications')
        .update(notificationData)
        .eq('id', editNotification.id)

      if (error) throw error

      // Reset form
      handleClearForm()
      await fetchNotifications()
      toast.success('Notification updated successfully')
    } catch (error) {
      console.error('Error updating notification:', error)
      toast.error('Error updating notification', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  const getRecurrenceLabel = (recurrence: string | null) => {
    if (!recurrence) return 'One Time'
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly'
    }
    return labels[recurrence] || recurrence
  }

  const getRecurrenceIcon = (recurrence: string | null) => {
    const colors: Record<string, string> = {
      daily: 'bg-green-100 text-green-600',
      weekly: 'bg-purple-100 text-purple-600',
      monthly: 'bg-orange-100 text-orange-600'
    }
    return colors[recurrence || 'one_time'] || 'bg-gray-100 text-gray-600'
  }

  const formatSchedule = (notification: Notification) => {
    if (!notification.scheduled_time) return 'Not scheduled'
    
    if (notification.recurrence === 'daily') {
      const time = notification.scheduled_time || ''
      return `Every day at ${time}`
    } else if (notification.recurrence === 'weekly') {
      const dayOfWeek = notification.day_of_week || 'Monday'
      return `Every ${dayOfWeek} at ${notification.scheduled_time}`
    } else if (notification.recurrence === 'monthly') {
      if (!notification.scheduled_date) return `Monthly at ${notification.scheduled_time}`
      const date = new Date(notification.scheduled_date)
      if (isNaN(date.getTime())) return `Monthly at ${notification.scheduled_time}`
      const day = date.getDate()
      const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'
      return `Monthly on the ${day}${suffix} at ${notification.scheduled_time}`
    } else {
      if (!notification.scheduled_date) return `At ${notification.scheduled_time}`
      return `${notification.scheduled_date} at ${notification.scheduled_time}`
    }
  }

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Send className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-semibold text-slate-800">Notifications</h1>
        </div>
        <p className="text-sm text-slate-500">Send and schedule notifications to all locations</p>
       
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('send')}
          className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'send'
              ? 'text-[#00a1ff] border-b-2 border-[#00a1ff]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Send className="h-4 w-4" />
          Send Notification
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'scheduled'
              ? 'text-[#00a1ff] border-b-2 border-[#00a1ff]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Scheduled Notifications
          {scheduledNotifications.length > 0 && (
            <span className="bg-[#00a1ff] text-white text-xs rounded-full px-2 py-0.5 ml-1">
              {scheduledNotifications.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'history'
              ? 'text-[#00a1ff] border-b-2 border-[#00a1ff]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="h-4 w-4" />
          History
        </button>
        {isFranchiseContext && (
          <button
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'received'
                ? 'text-[#00a1ff] border-b-2 border-[#00a1ff]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Bell className="h-4 w-4" />
            Received Notifications
            {receivedNotifications.length > 0 && (
              <span className="bg-gray-200 text-gray-700 text-xs rounded-full px-2 py-0.5 ml-1">
                {receivedNotifications.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Send Notification Tab */}
      {activeTab === 'send' && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{editNotification ? 'Edit Notification' : 'Compose Notification'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recipient Type */}
            <div className="space-y-2">
              <Label>Recipient Type <span className="text-red-500">*</span></Label>
              <Select 
                value={form.recipientType} 
                onValueChange={(value) => {
                  setForm({ ...form, recipientType: value })
                  setErrors({ ...errors, recipientType: '' })
                }}
              >
                <SelectTrigger className={`h-10 bg-gray-50 border-gray-300 ${errors.recipientType ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Select recipient type" />
                </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all_customers">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      All Customers
                    </div>
                  </SelectItem>
                  <SelectItem value="all_staff">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      All Staff
                    </div>
                  </SelectItem>
                  <SelectItem value="selected_customers">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      Selected Customers
                    </div>
                  </SelectItem>
              </SelectContent>
            </Select>
              {errors.recipientType && (
                <p className="text-red-500 text-xs mt-1">{errors.recipientType}</p>
              )}
            </div>

            {/* Customer Selection - Show when Selected Customers is chosen */}
            {form.recipientType === 'selected_customers' && (
              <div className="space-y-2 customer-dropdown-container">
                <Label>Select Customers <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <div
                    onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                    className={`flex items-center justify-between h-10 px-3 py-2 bg-gray-50 border rounded-md cursor-pointer ${errors.selectedCustomers ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <span className="text-sm text-gray-600">
                      {form.selectedCustomers.length === 0
                        ? 'Choose customers...'
                        : `${form.selectedCustomers.length} customer(s) selected`}
                    </span>
                    <span className="text-gray-400">▼</span>
                  </div>
                  
                  {customerDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-hidden">
                      <div className="p-3 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Select Customers</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSelectAllCustomers}
                            className="h-7 text-xs"
                          >
                            Select All
                          </Button>
                        </div>
                        <Input
                          placeholder="Search customers..."
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          className="h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredCustomersList.length === 0 ? (
                          <div className="p-4 text-center text-sm text-gray-500">
                            No customers found
                          </div>
                        ) : (
                          filteredCustomersList.map((customer) => {
                            const isSelected = form.selectedCustomers.includes(customer.id)
                            return (
                              <div
                                key={customer.id}
                                onClick={() => handleCustomerToggle(customer.id)}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-4 h-4 text-[#00a1ff] rounded"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {customer.company_name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {customer.first_name} {customer.last_name} - {customer.email}
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Selected Customers Display */}
                {form.selectedCustomers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.selectedCustomers.map((customerId) => {
                      const customer = customers.find(c => c.id === customerId)
                      if (!customer) return null
                      return (
                        <div
                          key={customerId}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                        >
                          <span>{customer.company_name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomer(customerId)}
                            className="ml-1 hover:text-blue-900"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                
                {errors.selectedCustomers && (
                  <p className="text-red-500 text-xs mt-1">{errors.selectedCustomers}</p>
                )}
              </div>
            )}

            {/* Notification Title */}
            <div className="space-y-2">
              <Label>Notification Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Enter notification title"
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value })
                  setErrors({ ...errors, title: '' })
                }}
                className={`h-10 bg-gray-50 border-gray-300 ${errors.title ? 'border-red-500' : ''}`}
              />
              {errors.title && (
                <p className="text-red-500 text-xs mt-1">{errors.title}</p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label>Message <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Enter your message here..."
                value={form.message}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.length <= maxMessageLength) {
                    setForm({ ...form, message: value })
                    setMessageLength(value.length)
                    setErrors({ ...errors, message: '' })
                  }
                }}
                className={`min-h-[120px] bg-gray-50 border-gray-300 resize-none ${errors.message ? 'border-red-500' : ''}`}
              />
              <div className="flex justify-between items-center">
                <p className={`text-xs ${errors.message ? 'text-red-500' : 'text-gray-500'}`}>
                  {messageLength}/{maxMessageLength} characters
                </p>
                {errors.message && (
                  <p className="text-red-500 text-xs">{errors.message}</p>
                )}
              </div>
            </div>

            {/* Attach Files */}
            <div className="space-y-2">
              <Label>Attach Files (Optional)</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Paperclip className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Click to upload files or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">Any file type • Max 10 files</p>
                </div>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="*/*"
                />
              </label>
              {form.files.length > 0 && (
                <div className="text-xs text-gray-600 mt-2">
                  {form.files.length} file(s) selected
                </div>
              )}
            </div>

            {/* Delivery Options */}
            <div className="space-y-4">
              <Label>Delivery Options</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deliveryOption"
                    value="send_now"
                    checked={form.deliveryOption === 'send_now'}
                    onChange={(e) => setForm({ ...form, deliveryOption: e.target.value })}
                    className="w-4 h-4 text-[#00a1ff]"
                  />
                  <Send className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Send Now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deliveryOption"
                    value="schedule"
                    checked={form.deliveryOption === 'schedule'}
                    onChange={(e) => setForm({ ...form, deliveryOption: e.target.value })}
                    className="w-4 h-4 text-[#00a1ff]"
                  />
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Schedule Notification</span>
                </label>
              </div>

              {/* Schedule Options */}
              {form.deliveryOption === 'schedule' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="one_time"
                        checked={form.scheduleType === 'one_time'}
                        onChange={(e) => setForm({ ...form, scheduleType: e.target.value })}
                        className="w-4 h-4 text-[#00a1ff]"
                      />
                      <span className="text-sm font-medium">One Time</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="daily"
                        checked={form.scheduleType === 'daily'}
                        onChange={(e) => setForm({ ...form, scheduleType: e.target.value })}
                        className="w-4 h-4 text-[#00a1ff]"
                      />
                      <span className="text-sm font-medium">Daily</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="weekly"
                        checked={form.scheduleType === 'weekly'}
                        onChange={(e) => setForm({ ...form, scheduleType: e.target.value })}
                        className="w-4 h-4 text-[#00a1ff]"
                      />
                      <span className="text-sm font-medium">Weekly</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="monthly"
                        checked={form.scheduleType === 'monthly'}
                        onChange={(e) => setForm({ ...form, scheduleType: e.target.value })}
                        className="w-4 h-4 text-[#00a1ff]"
                      />
                      <span className="text-sm font-medium">Monthly</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {form.scheduleType === 'weekly' ? (
                      <div className="space-y-2">
                        <Label>Day of Week <span className="text-red-500">*</span></Label>
                        <Select 
                          value={form.dayOfWeek} 
                          onValueChange={(value) => {
                            setForm({ ...form, dayOfWeek: value })
                            setErrors({ ...errors, dayOfWeek: '' })
                          }}
                        >
                          <SelectTrigger className={`h-10 bg-white border-gray-300 ${errors.dayOfWeek ? 'border-red-500' : ''}`}>
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Monday">Monday</SelectItem>
                            <SelectItem value="Tuesday">Tuesday</SelectItem>
                            <SelectItem value="Wednesday">Wednesday</SelectItem>
                            <SelectItem value="Thursday">Thursday</SelectItem>
                            <SelectItem value="Friday">Friday</SelectItem>
                            <SelectItem value="Saturday">Saturday</SelectItem>
                            <SelectItem value="Sunday">Sunday</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.dayOfWeek && (
                          <p className="text-red-500 text-xs mt-1">{errors.dayOfWeek}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Date <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="date"
                            value={form.scheduleDate}
                            onChange={(e) => {
                              setForm({ ...form, scheduleDate: e.target.value })
                              setErrors({ ...errors, scheduleDate: '' })
                            }}
                            className={`pl-10 h-10 bg-white border-gray-300 ${errors.scheduleDate ? 'border-red-500' : ''}`}
                          />
                        </div>
                        {errors.scheduleDate && (
                          <p className="text-red-500 text-xs mt-1">{errors.scheduleDate}</p>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Time <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="time"
                          value={form.scheduleTime}
                          onChange={(e) => {
                            setForm({ ...form, scheduleTime: e.target.value })
                            setErrors({ ...errors, scheduleTime: '' })
                          }}
                          className={`pl-10 h-10 bg-white border-gray-300 ${errors.scheduleTime ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.scheduleTime && (
                        <p className="text-red-500 text-xs mt-1">{errors.scheduleTime}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-blue-100 border border-blue-300 rounded p-3">
                    <p className="text-xs text-blue-800">
                      Notification will be sent {form.scheduleType === 'one_time' ? 'once' : form.scheduleType === 'daily' ? 'daily' : form.scheduleType === 'weekly' ? 'weekly' : 'monthly'} on the selected date and time
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={editNotification ? handleUpdateNotification : handleSendNotification}
                className="bg-[#00a1ff] hover:bg-[#0090e6] text-white"
              >
                {editNotification ? (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Notification
                  </>
                ) : form.deliveryOption === 'schedule' ? (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Notification
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Notification
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleClearForm}
                className="border-gray-300"
              >
                {editNotification ? 'Cancel Edit' : 'Clear Form'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Notifications Tab */}
      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          {scheduledNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No scheduled notifications</p>
              </CardContent>
            </Card>
          ) : (
            scheduledNotifications.map((notification) => (
              <Card key={notification.id} className="bg-white">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRecurrenceIcon(notification.recurrence || null)}`}>
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {getRecurrenceLabel(notification.recurrence || null)}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {notification.recipient_type.replace('_', ' ')}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                          {notification.recipient_count} Recipients
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Clock className="h-4 w-4" />
                        <span>{formatSchedule(notification)}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{notification.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      {notification.attachments && notification.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Paperclip className="h-3 w-3" />
                          <span>{notification.attachments.length} file attached</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleView(notification)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleEdit(notification)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleDelete(notification)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Notification History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700 font-semibold">
                  <tr>
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">Title</th>
                    <th className="p-3 text-left">Message</th>
                    <th className="p-3 text-left">Recipients</th>
                    <th className="p-3 text-left">Count</th>
                    <th className="p-3 text-left">Date & Time</th>
                    <th className="p-3 text-left">Attachments</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-500">
                        No notification history
                      </td>
                    </tr>
                  ) : (
                    historyNotifications.map((notification) => (
                      <tr key={notification.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-xs">{notification.notification_id || `NOTIF-${String(notification.id).padStart(3, '0')}`}</td>
                        <td className="p-3 font-medium">{notification.title}</td>
                        <td className="p-3 text-gray-600">{notification.message}</td>
                        <td className="p-3">{notification.recipient_type.replace('_', ' ')}</td>
                        <td className="p-3">{notification.recipient_count}</td>
                        <td className="p-3">{notification.sent_at ? new Date(notification.sent_at).toLocaleString() : '—'}</td>
                        <td className="p-3">
                          {notification.attachments && notification.attachments.length > 0 ? (
                            <span className="text-blue-600 hover:underline cursor-pointer">
                              {notification.attachments.length} file
                            </span>
                          ) : (
                            'None'
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            {notification.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
          </CardContent>
        </Card>
      )}

      {/* Received Notifications Tab (Franchise view) */}
      {activeTab === 'received' && (
        <Card>
          <CardHeader>
            <CardTitle>Received Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {receivedNotifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No notifications received yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {receivedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start justify-between border rounded-lg p-3 bg-white"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{notification.title}</div>
                      <div className="text-sm text-gray-700 line-clamp-3">
                        {notification.message}
                      </div>
                      <div className="text-xs text-gray-500">
                        Scope:{' '}
                        {notification.target_type === 'all'
                          ? 'All franchises'
                          : 'Selected franchises'}{' '}
                        • Recipients: {notification.recipient_count} • Status: {notification.status}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 text-right whitespace-nowrap">
                      {notification.created_at
                        ? new Date(notification.created_at).toLocaleString()
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* View Notification Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>View complete notification information</DialogDescription>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-sm text-gray-500">Title</Label>
                <p className="font-semibold text-gray-900 mt-1">{selectedNotification.title}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Message</Label>
                <p className="text-gray-700 mt-1 whitespace-pre-wrap">{selectedNotification.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Recipient Type</Label>
                  <p className="text-gray-700 mt-1">{selectedNotification.recipient_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Recipient Count</Label>
                  <p className="text-gray-700 mt-1">{selectedNotification.recipient_count}</p>
                </div>
              </div>
              {selectedNotification.status === 'scheduled' && (
                <div>
                  <Label className="text-sm text-gray-500">Schedule</Label>
                  <p className="text-gray-700 mt-1">{formatSchedule(selectedNotification)}</p>
                </div>
              )}
              {selectedNotification.sent_at && (
                <div>
                  <Label className="text-sm text-gray-500">Sent At</Label>
                  <p className="text-gray-700 mt-1">{new Date(selectedNotification.sent_at).toLocaleString()}</p>
                </div>
              )}
              <div>
                <Label className="text-sm text-gray-500">Status</Label>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                  selectedNotification.status === 'sent' ? 'bg-green-100 text-green-700' :
                  selectedNotification.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedNotification.status}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            {selectedNotification && (
              <Button
                onClick={() => {
                  setViewModalOpen(false)
                  handleEdit(selectedNotification)
                }}
                className="bg-[#00a1ff] hover:bg-[#0090e6] text-white"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Notification
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Notification</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this notification? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
         
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
