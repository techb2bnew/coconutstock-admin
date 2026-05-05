'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

type Franchise = { id: string; franchise_name: string }

type Broadcast = {
  id: string
  title: string
  message: string
  target_type: 'all' | 'selected'
  franchise_ids: string[] | null
  recipient_count: number
  status: string
  sent_at: string | null
  created_at: string
  created_by_email: string | null
}

export default function FranchiseNotificationsPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [franchises, setFranchises] = useState<Franchise[]>([])
  const [history, setHistory] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(false)

  const [scope, setScope] = useState<'all' | 'selected'>('all')
  const [selectedFranchiseIds, setSelectedFranchiseIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send')

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (!email) {
        router.push('/login')
        return
      }
      const { data: staff } = await supabase
        .from('staff')
        .select('is_super_admin, status')
        .eq('email', email)
        .maybeSingle()
      if (!staff || staff.status !== 'Active' || staff.is_super_admin !== true) {
        toast.error('Access denied. Super Admin only.')
        router.push('/admin/dashboard')
        return
      }
      setChecking(false)
      await Promise.all([fetchFranchises(), fetchHistory()])
    }
    check()
  }, [router])

  const canSubmit = useMemo(() => {
    if (!title.trim() || !message.trim()) return false
    if (scope === 'selected' && selectedFranchiseIds.length === 0) return false
    return true
  }, [title, message, scope, selectedFranchiseIds])

  const fetchFranchises = async () => {
    const { data, error } = await supabase
      .from('franchises')
      .select('id, franchise_name')
      .order('franchise_name', { ascending: true })
    if (error) {
      console.error(error)
      toast.error('Failed to load franchises')
      return
    }
    setFranchises((data || []) as Franchise[])
  }

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('franchise_notifications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.log('history table not available yet:', error.message)
      setHistory([])
      return
    }
    setHistory((data || []) as Broadcast[])
  }

  const fetchFranchiseTokens = async (ids: string[] | null) => {
    let query = supabase
      .from('franchises')
      .select('fcm_token, status')
      .not('fcm_token', 'is', null)
      .eq('status', 'active')
    if (ids && ids.length > 0) {
      query = query.in('id', ids)
    }
    const { data, error } = await query
    if (error) {
      console.error('fetch tokens error', error)
      return [] as string[]
    }
    const tokens = (data || [])
      .map((r: any) => (r?.fcm_token ?? '').toString().trim())
      .filter((t: string) => t.length > 0)
    return Array.from(new Set(tokens))
  }

  const sendPush = async (tokens: string[], titleText: string, messageText: string) => {
    if (tokens.length === 0) return { success: true }
    const chunkSize = 900
    const chunks: string[][] = []
    for (let i = 0; i < tokens.length; i += chunkSize) {
      chunks.push(tokens.slice(i, i + chunkSize))
    }
    for (const chunk of chunks) {
      const { error } = await supabase.functions.invoke('send-fcm-notification', {
        body: { tokens: chunk, title: titleText, message: messageText }
      } as any)
      if (error) {
        console.error('push error', error)
        return { success: false }
      }
    }
    return { success: true }
  }

  const handleSend = async () => {
    if (!canSubmit || loading) return
    setLoading(true)
    try {
      const ids = scope === 'all' ? null : selectedFranchiseIds
      const tokens = await fetchFranchiseTokens(ids)
      const pushRes = await sendPush(tokens, title.trim(), message.trim())

      const { data: sessionData } = await supabase.auth.getSession()
      const createdBy = sessionData?.session?.user?.email || null
      const { error: insertError } = await supabase
        .from('franchise_notifications')
        .insert([{
          title: title.trim(),
          message: message.trim(),
          target_type: scope,
          franchise_ids: ids,
          recipient_count: tokens.length,
          status: pushRes.success ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          created_by_email: createdBy
        }])
      if (insertError) {
        console.log('table not ready to store history:', insertError.message)
      }
      toast.success(`Notification sent to ${tokens.length} device(s)`)
      setTitle('')
      setMessage('')
      setSelectedFranchiseIds([])
      await fetchHistory()
    } catch (e) {
      console.error(e)
      toast.error('Failed to send notification')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Franchise Notifications</h1>
            <p className="text-sm text-muted-foreground">
              Send targeted push notifications to franchise owners and review delivery history.
            </p>
          </div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'send' | 'history')}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="send">Send Notification</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'send' | 'history')}>
          <TabsContent value="send">
            <Card>
              <CardHeader>
                <CardTitle>Compose Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recipients</Label>
                    <Select value={scope} onValueChange={(v: 'all' | 'selected') => setScope(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Franchises</SelectItem>
                        <SelectItem value="selected">Selected Franchises</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={120}
                      placeholder="Short, clear title (max 120 characters)"
                    />
                  </div>
                </div>

                {scope === 'selected' && (
                  <div className="space-y-2">
                    <Label>Select Franchises</Label>
                    <div className="border rounded-lg p-3">
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {franchises.map((f) => {
                          const checked = selectedFranchiseIds.includes(f.id)
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setSelectedFranchiseIds((prev) =>
                                  checked ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                                )
                              }}
                              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                                checked
                                  ? 'bg-sky-50 border border-sky-200 text-sky-700'
                                  : 'hover:bg-gray-50 border border-transparent text-gray-800'
                              }`}
                            >
                              <span className="truncate">{f.franchise_name || f.id}</span>
                              <span
                                className={`h-4 w-4 rounded-sm border flex items-center justify-center ${
                                  checked ? 'bg-sky-500 border-sky-500' : 'border-gray-300 bg-white'
                                }`}
                              >
                                {checked && (
                                  <span className="block h-2 w-2 rounded-sm bg-white" />
                                )}
                              </span>
                            </button>
                          )
                        })}
                        {franchises.length === 0 && (
                          <div className="text-xs text-muted-foreground py-2">
                            No franchises available.
                          </div>
                        )}
                      </div>
                      {selectedFranchiseIds.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {selectedFranchiseIds.length} franchise
                          {selectedFranchiseIds.length > 1 ? 's' : ''} selected
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={500}
                    rows={6}
                    placeholder="Write the main content of your notification (max 500 characters)"
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSend} disabled={!canSubmit || loading}>
                    {loading ? 'Sending...' : 'Send Notification'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Notification History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No history available</div>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-start justify-between border rounded-lg p-3 bg-white">
                        <div className="space-y-1">
                          <div className="font-medium">{h.title}</div>
                          <div className="text-sm text-gray-700 line-clamp-3">{h.message}</div>
                          <div className="text-xs text-muted-foreground">
                            Scope: {h.target_type === 'all' ? 'All franchises' : 'Selected franchises'} • Recipients: {h.recipient_count} • Status: {h.status}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                          {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

