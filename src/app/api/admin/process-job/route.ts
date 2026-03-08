import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getTranscriptionByIdAdmin } from '@/lib/firebase/transcriptions-admin';

// Vercel configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute is enough since we just call another endpoint

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Get user data from admin Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Check if user is admin
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { jobId, language = 'en', operatingPoint = 'standard' } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Admin API] Manual processing requested for job ${jobId} by admin ${userData.email}`);

    // Get the transcription job details
    const transcriptionJob = await getTranscriptionByIdAdmin(jobId);
    
    if (!transcriptionJob) {
      return NextResponse.json(
        { error: 'Transcription job not found' },
        { status: 404 }
      );
    }

    // Check if job can be processed - allow reprocessing of failed or stuck processing jobs
    if (!['failed', 'processing'].includes(transcriptionJob.status)) {
      return NextResponse.json(
        { error: `Cannot manually process job with status: ${transcriptionJob.status}. Only failed or stuck processing jobs can be manually reprocessed.` },
        { status: 400 }
      );
    }

    // Only process AI and hybrid mode jobs
    if (!['ai', 'hybrid'].includes(transcriptionJob.mode)) {
      return NextResponse.json(
        { error: 'Manual processing only available for AI and hybrid transcription jobs' },
        { status: 400 }
      );
    }

    console.log(`[Admin API] Triggering reprocessing for job ${jobId}`);

    // Instead of downloading the file here (which can exceed memory limits),
    // call the existing transcriptions/process endpoint which handles large files
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.talktotext.ca';

    try {
      const processResponse = await fetch(`${baseUrl}/api/transcriptions/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          language,
          operatingPoint
        })
      });

      const processResult = await processResponse.json();

      if (!processResponse.ok) {
        console.error(`[Admin API] Process endpoint returned error:`, processResult);
        return NextResponse.json(
          { error: processResult.error || 'Failed to process job' },
          { status: processResponse.status }
        );
      }

      console.log(`[Admin API] Successfully triggered processing for job ${jobId}:`, processResult);

      return NextResponse.json({
        success: true,
        message: processResult.message || 'Job submitted for processing',
        jobId,
        speechmaticsJobId: processResult.speechmaticsJobId,
        status: processResult.status || 'processing'
      });

    } catch (fetchError) {
      console.error(`[Admin API] Error calling process endpoint:`, fetchError);

      return NextResponse.json(
        {
          error: 'Failed to trigger processing',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Admin API] Error in manual job processing:', error);

    return NextResponse.json(
      {
        error: 'Failed to process job manually',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}