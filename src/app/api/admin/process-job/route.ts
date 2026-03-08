import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { speechmaticsService } from '@/lib/speechmatics/service';

// Vercel configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes
import { getTranscriptionByIdAdmin, updateTranscriptionStatusAdmin } from '@/lib/firebase/transcriptions-admin';

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

    // Update status to processing
    await updateTranscriptionStatusAdmin(jobId, 'processing');

    // Download the audio file from Firebase Storage
    console.log(`[Admin API] Downloading audio file for job ${jobId}`);
    const audioBuffer = await downloadAudioFile(transcriptionJob.downloadURL);
    
    if (!audioBuffer) {
      await updateTranscriptionStatusAdmin(jobId, 'failed', {
        specialInstructions: 'Failed to download audio file for manual processing'
      });
      
      return NextResponse.json(
        { error: 'Failed to download audio file' },
        { status: 500 }
      );
    }

    console.log(`[Admin API] Starting Speechmatics processing for job ${jobId}`);
    console.log(`[Admin API] File size: ${audioBuffer.length} bytes, duration: ${transcriptionJob.duration}s`);

    // Use webhook-based processing for files longer than 5 minutes (safer for large files)
    const useWebhook = transcriptionJob.duration > 300;

    if (useWebhook) {
      // Use webhook-based async processing
      console.log(`[Admin API] Using webhook-based processing for long file`);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.talktotext.ca';
      const webhookToken = process.env.SPEECHMATICS_WEBHOOK_TOKEN || 'default-webhook-secret';
      const callbackUrl = `${baseUrl}/api/speechmatics/callback?token=${webhookToken}&jobId=${jobId}`;

      const result = await speechmaticsService.submitJobWithWebhook(
        audioBuffer,
        transcriptionJob.originalFilename,
        {
          language,
          operatingPoint,
          enableDiarization: true,
          enablePunctuation: true,
          domain: transcriptionJob.domain || 'general',
          removeDisfluencies: !transcriptionJob.includeFiller
        },
        callbackUrl
      );

      if (result.success && result.jobId) {
        await updateTranscriptionStatusAdmin(jobId, 'processing', {
          speechmaticsJobId: result.jobId
        });

        console.log(`[Admin API] Job ${jobId} submitted to Speechmatics with ID: ${result.jobId}`);

        return NextResponse.json({
          success: true,
          message: 'Job submitted to Speechmatics. It will complete in a few minutes.',
          jobId,
          speechmaticsJobId: result.jobId,
          status: 'processing'
        });
      } else {
        await updateTranscriptionStatusAdmin(jobId, 'failed', {
          specialInstructions: `Failed to submit to Speechmatics: ${result.error || 'Unknown error'}`
        });

        return NextResponse.json(
          { error: result.error || 'Failed to submit to Speechmatics' },
          { status: 500 }
        );
      }
    } else {
      // Use synchronous processing for shorter files
      const result = await speechmaticsService.transcribeAudio(
        audioBuffer,
        transcriptionJob.originalFilename,
        {
          language,
          operatingPoint,
          enableDiarization: true,
          enablePunctuation: true,
          domain: transcriptionJob.domain || 'general',
          removeDisfluencies: !transcriptionJob.includeFiller
        }
      );

      if (result.success && result.transcript) {
        const finalStatus = transcriptionJob.mode === 'hybrid' ? 'pending-review' : 'complete';

        await updateTranscriptionStatusAdmin(jobId, finalStatus, {
          transcript: result.transcript,
          duration: result.duration || transcriptionJob.duration
        });

        console.log(`[Admin API] Successfully processed job ${jobId} - Status: ${finalStatus}`);

        return NextResponse.json({
          success: true,
          message: `Job processed successfully`,
          jobId,
          status: finalStatus,
          transcript: result.transcript?.substring(0, 100) + '...'
        });

      } else {
        await updateTranscriptionStatusAdmin(jobId, 'failed', {
          specialInstructions: `Manual processing failed: ${result.error || 'Unknown error'}`
        });

        console.error(`[Admin API] Failed to process job ${jobId}:`, result.error);

        return NextResponse.json(
          { error: result.error || 'Speechmatics transcription failed' },
          { status: 500 }
        );
      }
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

/**
 * Download audio file from Firebase Storage URL
 */
async function downloadAudioFile(downloadURL: string): Promise<Buffer | null> {
  try {
    console.log(`[Admin API] Downloading audio file from: ${downloadURL}`);
    
    const response = await fetch(downloadURL);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
    
  } catch (error) {
    console.error('[Admin API] Error downloading audio file:', error);
    return null;
  }
}