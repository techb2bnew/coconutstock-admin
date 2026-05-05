import { getMessagingIfSupported } from './firebaseClient'
import { getToken } from 'firebase/messaging'
import { supabase } from '@/lib/supabaseClient'

const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

export async function ensureStaffFcmRegistered() {
  if (typeof window === 'undefined') return
  try {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser')
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('Notification permission not granted')
      return
    }

    // Register service worker
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

    // Setup Firebase Messaging
    const messaging = await getMessagingIfSupported()
    if (!messaging) return
    if (!VAPID) {
      console.warn('VAPID key missing; set NEXT_PUBLIC_FIREBASE_VAPID_KEY')
      return
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID,
      serviceWorkerRegistration: swReg,
    })

    if (!token) {
      console.warn('FCM getToken returned empty token')
      return
    }

    // Get current user email and update staff token
    const { data: sessionData } = await supabase.auth.getSession()
    const email = sessionData?.session?.user?.email
    if (!email) return

    // Verify staff and active
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, email, status, fcm_token')
      .eq('email', email)
      .maybeSingle()
    if (staffError || !staff || staff.status !== 'Active') return

    if (staff.fcm_token !== token) {
      await supabase.from('staff').update({ fcm_token: token }).eq('id', staff.id)
      console.log('✅ Staff FCM token saved/updated')
    } else {
      console.log('ℹ️ Staff FCM token unchanged')
    }
  } catch (e) {
    console.error('Error registering FCM token:', e)
  }
}

