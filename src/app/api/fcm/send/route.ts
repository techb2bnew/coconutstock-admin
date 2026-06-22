import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK
let firebaseAdminInitialized = false

function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized) {
    return
  }

  try {
    const serviceAccountJson = process.env.NEXT_PUBLIC_FCM_SERVICE_ACCOUNT_JSON
     console.log('ENV found:', !!serviceAccountJson)
    const parsed = JSON.parse(serviceAccountJson!)
    console.log('project_id:', parsed.project_id)
    console.log('client_email:', parsed.client_email)
    console.log('private_key starts:', parsed.private_key?.substring(0, 50))
    
    if (!serviceAccountJson) {
      throw new Error('NEXT_PUBLIC_FCM_SERVICE_ACCOUNT_JSON not configured')
    }

    const serviceAccount = JSON.parse(serviceAccountJson)

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
        }),
      })
    }

    firebaseAdminInitialized = true
  } catch (error) {
    console.error('Firebase Admin initialization error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    initializeFirebaseAdmin()

    const body = await request.json()
    const { tokens, title, message } = body

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No FCM tokens provided' },
        { status: 400 }
      )
    }

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'Title and message are required' },
        { status: 400 }
      )
    }

    // Filter valid tokens
    const validTokens = tokens.filter((token: string) => token && token.trim() !== '')

    if (validTokens.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid FCM tokens found' },
        { status: 400 }
      )
    }

    // Send FCM notification using Firebase Admin SDK
    const messagePayload = {
      notification: {
        title: title,
        body: message,
      },
      data: {
        title: title,
        message: message,
        type: 'admin_notification',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    }

    // Send to multiple tokens
    const response = await admin.messaging().sendEachForMulticast({
      tokens: validTokens,
      ...messagePayload,
    })

    // console.log('FCM Notification sent:', {
    //   successCount: response.successCount,
    //   failureCount: response.failureCount,
    //   responses: response.responses,
    // })

    // Collect invalid tokens to remove from database
    const invalidTokens: string[] = []
    
    // Check for failures
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code
          console.error(`Token ${idx} failed:`, resp.error)
          
          // These error codes indicate the token is invalid and should be removed
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/mismatched-credential'
          ) {
            invalidTokens.push(validTokens[idx])
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens: invalidTokens, // Tokens that should be removed from database
      result: response,
    })
  } catch (error) {
    console.error('Error sending FCM notification:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

