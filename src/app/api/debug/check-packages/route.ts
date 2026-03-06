import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get user authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user document from Firebase
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Get recent transactions
    const transactionsSnapshot = await adminDb.collection('transactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const transactions = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
    }));

    // Get recent webhook events for this user
    const webhookEventsSnapshot = await adminDb.collection('_webhook_events')
      .orderBy('processedAt', 'desc')
      .limit(10)
      .get();

    const webhookEvents = webhookEventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      processedAt: doc.data().processedAt?.toDate?.()?.toISOString() || null
    }));

    return NextResponse.json({
      userId,
      email: decodedToken.email,
      walletBalance: userData?.walletBalance || 0,
      packages: userData?.packages || [],
      packagesCount: (userData?.packages || []).length,
      freeTrialMinutes: userData?.freeTrialMinutes || 0,
      freeTrialActive: userData?.freeTrialActive || false,
      recentTransactions: transactions,
      recentWebhookEvents: webhookEvents,
      rawUserData: {
        walletBalance: userData?.walletBalance,
        packages: userData?.packages,
        freeTrialMinutes: userData?.freeTrialMinutes,
        freeTrialActive: userData?.freeTrialActive,
        updatedAt: userData?.updatedAt?.toDate?.()?.toISOString() || null
      }
    });

  } catch (error) {
    console.error('[Debug Check Packages] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
