import { getMessagingIfSupported } from './firebaseClient'
import { getToken } from 'firebase/messaging'
import { supabase } from '@/lib/supabaseClient'

const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

export async function ensureFranchiseFcmRegistered() {
  if (typeof window === 'undefined') return
  try {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const messaging = await getMessagingIfSupported()
    if (!messaging) return
    if (!VAPID) return
    const token = await getToken(messaging, {
      vapidKey: VAPID,
      serviceWorkerRegistration: swReg,
    })
    if (!token) return
    const { data: sessionData } = await supabase.auth.getSession()
    const email = sessionData?.session?.user?.email
    if (!email) return
    const { data: franchise, error } = await supabase
      .from('franchises')
      .select('id, owner_email, status, fcm_token')
      .eq('owner_email', email)
      .maybeSingle()
    if (error || !franchise || franchise.status !== 'active') return
    if (franchise.fcm_token !== token) {
      await supabase.from('franchises').update({ fcm_token: token }).eq('id', franchise.id)
    }
  } catch {
  }
}

