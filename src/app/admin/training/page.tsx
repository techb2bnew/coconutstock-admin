'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Search, Video, FileText, Plus, Edit, Trash2, Download, Play } from 'lucide-react'
import { toast } from 'sonner'

interface TrainingVideo {
  id: string
  title: string
  description: string
  youtube_url: string
  thumbnail_url?: string
  views: number
  created_at: string
  franchise_id?: string | null
}

interface TrainingDocument {
  id: string
  title: string
  description: string
  file_url: string
  file_name: string
  file_size: number
  downloads: number
  created_at: string
  franchise_id?: string | null
}

export default function TrainingResourcesPage() {
  const [activeTab, setActiveTab] = useState<'videos' | 'documents'>('videos')
  const [searchTerm, setSearchTerm] = useState('')
  const [videos, setVideos] = useState<TrainingVideo[]>([])
  const [documents, setDocuments] = useState<TrainingDocument[]>([])
  const [loading, setLoading] = useState(false)
  
  // Modals
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [documentModalOpen, setDocumentModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: 'video' | 'document', id: string } | null>(null)
  
  // Form states
  const [videoForm, setVideoForm] = useState({
    title: '',
    description: '',
    youtube_url: '',
  })
  const [documentForm, setDocumentForm] = useState({
    title: '',
    description: '',
    file: null as File | null,
  })
  const [editingItem, setEditingItem] = useState<TrainingVideo | TrainingDocument | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)

  const [franchiseId, setFranchiseId] = useState<string | null | undefined>(undefined)

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
          console.error('Franchise lookup error:', error)
          setFranchiseId(null)
          return
        }

        const id = franchise?.id ?? null
        setFranchiseId(id)

        if (typeof window !== 'undefined' && id) {
          localStorage.setItem('current_franchise_id', id)
        }
      } catch (err) {
        console.error('Franchise resolve error:', err)
        setFranchiseId(null)
      }
    }

    void resolveFranchise()
  }, [])

  useEffect(() => {
    if (franchiseId === undefined) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franchiseId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null

      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false
      const currentStaffEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('current_staff_email') 
        : null

      // Fetch videos
      let videosQuery = supabase.from('training_videos').select('*').order('created_at', { ascending: false })
      
      // Filter based on user role:
      // Super Admin: Show only videos where franchise_id IS NULL (their own data)
      // Franchise: Show only videos where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees only their own data (franchise_id IS NULL)
        videosQuery = videosQuery.is('franchise_id', null)
      } else if (currentFranchiseId) {
        // Franchise sees only their own data
        videosQuery = videosQuery.eq('franchise_id', currentFranchiseId)
      } else if (currentStaffEmail) {
        // Staff member (not franchise owner): filter by creator
        videosQuery = videosQuery.eq('created_by_email', currentStaffEmail)
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        videosQuery = videosQuery.eq('id', '-1') // Impossible condition
      }
      const { data: videosData } = await videosQuery

      // Fetch documents
      let documentsQuery = supabase.from('training_documents').select('*').order('created_at', { ascending: false })
      
      // Filter based on user role:
      // Super Admin: Show only documents where franchise_id IS NULL (their own data)
      // Franchise: Show only documents where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees only their own data (franchise_id IS NULL)
        documentsQuery = documentsQuery.is('franchise_id', null)
      } else if (currentFranchiseId) {
        // Franchise sees only their own data
        documentsQuery = documentsQuery.eq('franchise_id', currentFranchiseId)
      } else if (currentStaffEmail) {
        // Staff member (not franchise owner): filter by creator
        documentsQuery = documentsQuery.eq('created_by_email', currentStaffEmail)
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        documentsQuery = documentsQuery.eq('id', '-1') // Impossible condition
      }
      const { data: documentsData } = await documentsQuery

      setVideos((videosData || []) as TrainingVideo[])
      setDocuments((documentsData || []) as TrainingDocument[])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error loading training resources')
    } finally {
      setLoading(false)
    }
  }

  const extractYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  const getYouTubeThumbnail = (url: string): string => {
    const videoId = extractYouTubeVideoId(url)
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : ''
  }

  const validateVideoForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!videoForm.title.trim()) errors.title = 'Title is required'
    if (!videoForm.description.trim()) errors.description = 'Description is required'
    if (!videoForm.youtube_url.trim()) {
      errors.youtube_url = 'YouTube URL is required'
    } else {
      const videoId = extractYouTubeVideoId(videoForm.youtube_url)
      if (!videoId) errors.youtube_url = 'Invalid YouTube URL'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateDocumentForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!documentForm.title.trim()) errors.title = 'Title is required'
    if (!documentForm.description.trim()) errors.description = 'Description is required'
    if (!editingItem && !documentForm.file) {
      errors.file = 'File is required'
    } else if (documentForm.file) {
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (documentForm.file.size > maxSize) {
        errors.file = 'File size must be less than 10MB'
      }
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(documentForm.file.type)) {
        errors.file = 'Only PDF, DOC, and DOCX files are allowed'
      }
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleOpenVideoModal = (video?: TrainingVideo) => {
    if (video) {
      setEditingItem(video)
      setVideoForm({
        title: video.title,
        description: video.description,
        youtube_url: video.youtube_url,
      })
    } else {
      setEditingItem(null)
      setVideoForm({ title: '', description: '', youtube_url: '' })
    }
    setFormErrors({})
    setVideoModalOpen(true)
  }

  const handleOpenDocumentModal = (document?: TrainingDocument) => {
    if (document) {
      setEditingItem(document)
      setDocumentForm({
        title: document.title,
        description: document.description,
        file: null,
      })
    } else {
      setEditingItem(null)
      setDocumentForm({ title: '', description: '', file: null })
    }
    setFormErrors({})
    setDocumentModalOpen(true)
  }

  // Send FCM notification to all customers
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

  // Send notification to all customers when training resource is added
  const sendTrainingNotification = async (type: 'video' | 'document', title: string) => {
    try {
      // Fetch all customers with FCM tokens
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, email, fcm_token')
        .not('fcm_token', 'is', null)

      if (customersError) {
        console.error('Error fetching customers:', customersError)
        return
      }

      if (!customers || customers.length === 0) {
        console.log('No customers with FCM tokens found')
        return
      }

      // Collect FCM tokens
      const fcmTokens = customers
        .map((c: any) => c.fcm_token)
        .filter((token: any) => token && token.trim() !== '')

      if (fcmTokens.length === 0) {
        console.log('No valid FCM tokens found')
        return
      }

      // Create notification message
      const notificationTitle = `New Training ${type === 'video' ? 'Video' : 'Document'} Available`
      const notificationMessage = `A new training ${type === 'video' ? 'video' : 'document'} "${title}" has been added. Check it out now!`

      // Send FCM notification
      await sendFCMNotification(fcmTokens, notificationTitle, notificationMessage)

      // Save notification to database
      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null

      await supabase
        .from('notifications')
        .insert([{
          title: notificationTitle,
          message: notificationMessage,
          recipient_type: 'all_customers',
          recipient_count: customers.length,
          status: 'sent',
          sent_at: new Date().toISOString(),
          franchise_id: !isSuperAdmin && currentFranchiseId ? currentFranchiseId : null,
          created_at: new Date().toISOString(),
        }])

      console.log(`✅ Notification sent to ${fcmTokens.length} customers`)
    } catch (error) {
      console.error('Error sending training notification:', error)
      // Don't block the save operation if notification fails
    }
  }

  const handleSaveVideo = async () => {
    if (!validateVideoForm()) return

    setUploading(true)
    try {
      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null
      const currentStaffEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('current_staff_email') 
        : null

      const thumbnailUrl = getYouTubeThumbnail(videoForm.youtube_url)

      if (editingItem) {
        // Update
        const { error } = await supabase
          .from('training_videos')
          .update({
            title: videoForm.title,
            description: videoForm.description,
            youtube_url: videoForm.youtube_url,
            thumbnail_url: thumbnailUrl,
          })
          .eq('id', editingItem.id)

        if (error) throw error
        toast.success('Video updated successfully')
      } else {
        // Create
        const { error } = await supabase
          .from('training_videos')
          .insert([{
            title: videoForm.title,
            description: videoForm.description,
            youtube_url: videoForm.youtube_url,
            thumbnail_url: thumbnailUrl,
            views: 0,
            franchise_id: isSuperAdmin ? null : (currentFranchiseId || null),
            created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
          }])

        if (error) throw error
        toast.success('Video added successfully')
        
        // Send notification to all customers when new video is added
        await sendTrainingNotification('video', videoForm.title)
      }

      setVideoModalOpen(false)
      fetchData()
    } catch (error: any) {
      console.error('Error saving video:', error)
      toast.error(error.message || 'Error saving video')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveDocument = async () => {
    if (!validateDocumentForm()) return

    setUploading(true)
    try {
      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null
      const currentStaffEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('current_staff_email') 
        : null

      let fileUrl = editingItem ? (editingItem as TrainingDocument).file_url : ''
      let fileName = editingItem ? (editingItem as TrainingDocument).file_name : ''
      let fileSize = editingItem ? (editingItem as TrainingDocument).file_size : 0

      if (documentForm.file) {
        // Upload file to Supabase Storage
        const fileExt = documentForm.file.name.split('.').pop()
        const fileNameNew = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('training-documents')
          .upload(fileNameNew, documentForm.file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('training-documents')
          .getPublicUrl(fileNameNew)

        fileUrl = publicUrl
        fileName = documentForm.file.name
        fileSize = documentForm.file.size
      }

      if (editingItem) {
        // Update
        const { error } = await supabase
          .from('training_documents')
          .update({
            title: documentForm.title,
            description: documentForm.description,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize,
          })
          .eq('id', editingItem.id)

        if (error) throw error
        toast.success('Document updated successfully')
      } else {
        // Create
        const { error } = await supabase
          .from('training_documents')
          .insert([{
            title: documentForm.title,
            description: documentForm.description,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize,
            downloads: 0,
            franchise_id: isSuperAdmin ? null : (currentFranchiseId || null),
            created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
          }])

        if (error) throw error
        toast.success('Document added successfully')
        
        // Send notification to all customers when new document is added
        await sendTrainingNotification('document', documentForm.title)
      }

      setDocumentModalOpen(false)
      fetchData()
    } catch (error: any) {
      console.error('Error saving document:', error)
      toast.error(error.message || 'Error saving document')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteClick = (type: 'video' | 'document', id: string) => {
    setItemToDelete({ type, id })
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return

    try {
      const tableName = itemToDelete.type === 'video' ? 'training_videos' : 'training_documents'
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', itemToDelete.id)

      if (error) throw error
      toast.success(`${itemToDelete.type === 'video' ? 'Video' : 'Document'} deleted successfully`)
      fetchData()
    } catch (error: any) {
      console.error('Error deleting:', error)
      toast.error(error.message || 'Error deleting item')
    } finally {
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const handleDownload = async (document: TrainingDocument) => {
    try {
      // Increment download count
      await supabase
        .from('training_documents')
        .update({ downloads: (document.downloads || 0) + 1 })
        .eq('id', document.id)

      // Open download link
      window.open(document.file_url, '_blank')
      fetchData()
    } catch (error) {
      console.error('Error downloading:', error)
    }
  }

  const handlePlayVideo = async (video: TrainingVideo) => {
    try {
      // Increment views count
      await supabase
        .from('training_videos')
        .update({ views: (video.views || 0) + 1 })
        .eq('id', video.id)

      // Open YouTube video in new tab
      window.open(video.youtube_url, '_blank')
      fetchData()
    } catch (error) {
      console.error('Error playing video:', error)
      // Still open the video even if view count update fails
      window.open(video.youtube_url, '_blank')
    }
  }

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Training Resources</h1>
        <p className="text-gray-600">Manage training videos and documents available in the mobile app</p>
      </div>

      {/* Search and Summary */}
      <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-md">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Search training resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-gray-300"
          />
        </div>
        <div className="flex gap-4">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-6 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{videos.length}</p>
            <p className="text-sm text-gray-600">Videos</p>
          </div>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-6 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{documents.length}</p>
            <p className="text-sm text-gray-600">Documents</p>
          </div>
        </div>
      </div>

      {/* Tabs and Add Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-2 flex items-center gap-2 font-medium transition-colors ${
              activeTab === 'videos'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Video className="h-5 w-5" />
            Training Videos
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 flex items-center gap-2 font-medium transition-colors ${
              activeTab === 'documents'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="h-5 w-5" />
            Training Documents
          </button>
        </div>
        <button
          onClick={() => activeTab === 'videos' ? handleOpenVideoModal() : handleOpenDocumentModal()}
          className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold flex items-center gap-2 px-6 py-2.5"
        >
          <Plus className="h-4 w-4" />
          {activeTab === 'videos' ? 'Add Video' : 'Add Document'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : activeTab === 'videos' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => {
            const thumbnailUrl = video.thumbnail_url || getYouTubeThumbnail(video.youtube_url)
            return (
              <div key={video.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div 
                  className="relative aspect-video bg-gray-200 cursor-pointer group"
                  onClick={() => handlePlayVideo(video)}
                >
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity">
                    <Play className="h-16 w-16 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2">{video.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{video.description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{video.views || 0} views</span>
                    <span>{new Date(video.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenVideoModal(video)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick('video', video.id)}
                      className="flex-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
          {filteredVideos.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No videos found. Add your first training video!
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="bg-white rounded-lg shadow-md p-6 flex items-start gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">{doc.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{doc.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="font-medium">{doc.file_name}</span>
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>{doc.downloads || 0} downloads</span>
                  <span>Uploaded {new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDocumentModal(doc)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteClick('document', doc.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {filteredDocuments.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No documents found. Add your first training document!
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Video Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Training Video' : 'Add Training Video'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the training video details.' : 'Add a new training video that will be available in the mobile app.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="video-title">
                Video Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="video-title"
                placeholder="e.g., How to Open a Coconut Properly"
                value={videoForm.title}
                onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                className={`mt-1 ${formErrors.title ? 'border-red-500' : ''}`}
              />
              {formErrors.title && (
                <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>
              )}
            </div>
            <div>
              <Label htmlFor="video-description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="video-description"
                placeholder="Describe what this video covers..."
                value={videoForm.description}
                onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                className={`mt-1 ${formErrors.description ? 'border-red-500' : ''}`}
                rows={4}
              />
              {formErrors.description && (
                <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>
              )}
            </div>
            <div>
              <Label htmlFor="video-url">
                YouTube URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="video-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoForm.youtube_url}
                onChange={(e) => setVideoForm({ ...videoForm, youtube_url: e.target.value })}
                className={`mt-1 ${formErrors.youtube_url ? 'border-red-500' : ''}`}
              />
              {formErrors.youtube_url && (
                <p className="text-red-500 text-xs mt-1">{formErrors.youtube_url}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Enter a YouTube video URL. The thumbnail will be automatically fetched from YouTube.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVideo} disabled={uploading} className="bg-[#00a1ff] hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              {editingItem ? 'Update Video' : 'Add Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Document Modal */}
      <Dialog open={documentModalOpen} onOpenChange={setDocumentModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Training Document' : 'Add Training Document'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the training document details.' : 'Add a new training document that will be available in the mobile app.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doc-title">
                Document Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="doc-title"
                placeholder="e.g., Coconut Safety Guidelines"
                value={documentForm.title}
                onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                className={`mt-1 ${formErrors.title ? 'border-red-500' : ''}`}
              />
              {formErrors.title && (
                <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>
              )}
            </div>
            <div>
              <Label htmlFor="doc-description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="doc-description"
                placeholder="Describe what this document covers..."
                value={documentForm.description}
                onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                className={`mt-1 ${formErrors.description ? 'border-red-500' : ''}`}
                rows={4}
              />
              {formErrors.description && (
                <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>
              )}
            </div>
            <div>
              <Label htmlFor="doc-file">
                Upload Document <span className="text-red-500">*</span>
              </Label>
              <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  id="doc-file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setDocumentForm({ ...documentForm, file })
                    setFormErrors({ ...formErrors, file: '' })
                  }}
                  className="hidden"
                />
                <label htmlFor="doc-file" className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <div className="bg-blue-100 p-3 rounded-full mb-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      PDF, DOC, or DOCX up to 10MB
                    </p>
                    {documentForm.file && (
                      <p className="text-sm text-blue-600 mt-2">{documentForm.file.name}</p>
                    )}
                    {editingItem && !documentForm.file && (
                      <p className="text-sm text-gray-500 mt-2">
                        Current file: {(editingItem as TrainingDocument).file_name}
                      </p>
                    )}
                  </div>
                </label>
              </div>
              {formErrors.file && (
                <p className="text-red-500 text-xs mt-1">{formErrors.file}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDocument} disabled={uploading} className="bg-[#00a1ff] hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              {editingItem ? 'Update Document' : 'Add Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>No</AlertDialogCancel>
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

