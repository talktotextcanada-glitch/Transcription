import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const requestingUserId = decodedToken.uid;

    // Determine if this is a self-delete or admin-delete
    const isSelfDelete = requestingUserId === userId;

    if (!isSelfDelete) {
      // Verify admin role for deleting other users
      const adminDoc = await adminDb.collection('users').doc(requestingUserId).get();
      const adminData = adminDoc.data();

      if (adminData?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Unauthorized - Admin access required' },
          { status: 403 }
        );
      }
    }

    // Verify the target user exists
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const targetUserData = userDoc.data();

    // Prevent deleting admin accounts (safety measure)
    if (!isSelfDelete && targetUserData?.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete admin accounts. Remove admin role first.' },
        { status: 403 }
      );
    }

    // 1. Delete user subcollections (packages, activity)
    const subcollections = ['packages', 'activity'];
    for (const subcollection of subcollections) {
      const subRef = adminDb.collection('users').doc(userId).collection(subcollection);
      const subDocs = await subRef.listDocuments();
      const batch = adminDb.batch();
      for (const doc of subDocs) {
        batch.delete(doc);
      }
      if (subDocs.length > 0) {
        await batch.commit();
      }
    }

    // 2. Delete user's transcription documents
    const transcriptionsQuery = adminDb.collection('transcriptions').where('userId', '==', userId);
    const transcriptions = await transcriptionsQuery.get();
    if (!transcriptions.empty) {
      const batch = adminDb.batch();
      transcriptions.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // 3. Delete user's transaction records
    const transactionsQuery = adminDb.collection('transactions').where('userId', '==', userId);
    const transactions = await transactionsQuery.get();
    if (!transactions.empty) {
      const batch = adminDb.batch();
      transactions.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // 4. Delete user files from storage
    try {
      const bucket = adminStorage.bucket();
      await bucket.deleteFiles({
        prefix: `transcriptions/${userId}/`,
      });
    } catch (storageError) {
      // Storage cleanup is best-effort - files may not exist
      console.warn(`[Delete] Storage cleanup for user ${userId}:`, storageError);
    }

    // 5. Delete user Firestore document
    await userRef.delete();

    // 6. Delete user from Firebase Auth
    await adminAuth.deleteUser(userId);

    const deletedBy = isSelfDelete ? 'self' : decodedToken.email;
    console.log(`[Account Deletion] User ${userId} (${targetUserData?.email}) deleted by ${deletedBy}`);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });

  } catch (error) {
    console.error('[API] Error deleting user account:', error);

    if (error instanceof Error && error.message.includes('ID token')) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to delete account',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
