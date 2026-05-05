import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging'

let app: FirebaseApp | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null
  if (app) return app

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID

  if (!apiKey || !projectId || !messagingSenderId || !appId) {
    console.warn('Firebase env variables missing; skipping FCM init')
    return null
  }

  const config = {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId,
    appId,
  }

  app = getApps().length ? getApps()[0] : initializeApp(config)
  return app
}

export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null
  const appInstance = getFirebaseApp()
  if (!appInstance) return null
  const supported = await isSupported().catch(() => false)
  if (!supported) {
    console.warn('FCM not supported in this browser')
    return null
  }
  try {
    return getMessaging(appInstance)
  } catch {
    return null
  }
}

