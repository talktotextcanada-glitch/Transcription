# Firebase Auth App - Claude Code Documentation

## 🎯 Project Overview

This is a **Firebase-powered Next.js 15 transcription application** with role-based authentication, Stripe payments, and Speechmatics integration. The app provides a complete platform for uploading audio/video files, processing transcriptions, and managing user accounts with credit-based billing.

## 🛠️ Tech Stack

### Core Framework
- **Next.js 15.5.2** - React framework with App Router
- **React 19.1.0** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling

### Authentication & Database
- **Firebase 12.2.1** - Authentication and Firestore database
- **Firebase Admin 13.5.0** - Server-side operations

### Payments & UI
- **Stripe 18.5.0** - Payment processing
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icons

### File Processing
- **docx 9.5.1** - Document generation
- **jspdf 3.0.2** - PDF generation
- **html2canvas 1.4.1** - Screenshot capture

## 📁 Project Structure

```
firebase-auth-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Authentication routes
│   │   │   ├── signin/        # Sign-in page
│   │   │   └── signup/        # Sign-up page
│   │   ├── (protected)/       # Protected routes
│   │   │   ├── admin/         # Admin dashboard
│   │   │   ├── billing/       # Billing management
│   │   │   ├── dashboard/     # User dashboard
│   │   │   ├── profile/       # User profile
│   │   │   ├── transcriptions/ # Transcription list
│   │   │   ├── transcript/[id]/ # Individual transcript viewer
│   │   │   └── upload/        # File upload
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── billing/       # Payment processing
│   │   │   └── test-config/   # Configuration testing
│   │   ├── about/             # About page
│   │   ├── contact/           # Contact page
│   │   ├── pricing/           # Pricing page
│   │   └── page.tsx           # Landing page
│   ├── components/            # Reusable components
│   │   ├── auth/              # Authentication components
│   │   ├── layout/            # Layout components
│   │   └── ui/                # UI components (Radix-based)
│   ├── contexts/              # React contexts
│   │   └── AuthContext.tsx    # Authentication state management
│   ├── lib/                   # Utility libraries
│   │   └── firebase/          # Firebase configuration
│   │       ├── config.ts      # Client-side Firebase config
│   │       ├── auth.ts        # Authentication functions
│   │       └── admin.ts       # Admin SDK setup
│   └── pages/                 # Page components
├── public/                    # Static assets
├── firebase.json             # Firebase configuration
├── firestore.rules          # Firestore security rules
├── storage.rules            # Firebase Storage rules
└── middleware.ts            # Next.js middleware for auth
```

## 🔐 Authentication System

### Firebase Auth Implementation
- **Client-side auth**: `src/lib/firebase/auth.ts`
- **Admin auth**: `src/lib/firebase/admin.ts`
- **Auth context**: `src/contexts/AuthContext.tsx`
- **Middleware protection**: `middleware.ts`

### User Roles
- **user**: Regular users with transcription access
- **admin**: Full system access and management capabilities

### Authentication Flow
1. User signs in/up through Firebase Auth
2. User document created in Firestore with role and metadata
3. Auth token stored in HTTP-only cookie for SSR
4. Middleware protects routes based on auth status
5. Context provides auth state throughout app

## 🔥 Firebase Configuration

### Environment Variables Required
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Admin SDK (server-side)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional integrations
SPEECHMATICS_API_KEY=your_speechmatics_key
SPEECHMATICS_API_URL=https://asr.api.speechmatics.com/v2
```

### Firestore Collections
- **users**: User profiles, roles, and credits
- **transcriptions**: Transcription jobs and metadata
- **credits**: Credit transaction history
- **packages**: Available credit packages

### Security Rules
- Users can only access their own data
- Admins have elevated permissions
- File uploads restricted by user authentication

## 💳 Payment System

### Stripe Integration
- **Payment forms**: Stripe Elements for secure card processing
- **Webhooks**: `src/app/api/billing/webhook/route.ts`
- **Credit packages**: Configurable pricing tiers
- **Transaction history**: Full audit trail

### Credit System
- Users purchase credits for transcription services
- Different transcription modes have different costs:
  - AI: 1 credit
  - Hybrid: 2 credits
  - Human: 3 credits
- Real-time balance checking before uploads

## 🎵 File Processing

### Supported Upload Formats
- **Audio**: MP3, WAV, M4A, FLAC
- **Video**: MP4, MOV, AVI (audio extraction)
- **Size limit**: 1GB per file

### Export Formats
- **PDF** - Professional formatted transcript document
- **DOCX** - Word document with speaker labels and timestamps
- **SRT** - SubRip subtitle format (YouTube, VLC, Premiere, etc.)
- **VTT** - WebVTT subtitle format (HTML5 video, web players)

### Upload Flow
1. Files uploaded to Firebase Storage at `/transcriptions/{userId}/`
2. Transcription job created in Firestore
3. Credit deduction from user balance
4. Optional Speechmatics API processing
5. Results stored and user notified

## 🔧 Development Commands

### Available Scripts
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Production build with Turbopack
npm start           # Start production server
npm run lint        # ESLint code checking
```

### Development Workflow
1. **Start dev server**: `npm run dev`
2. **Test configuration**: Visit `/api/test-config`
3. **Check Firebase connection**: Verify auth and database access
4. **Test file upload**: Try uploading files in `/upload`

## 🧪 Testing

### Test Accounts
- **User**: `user@demo.com` / `demo123`
- **Admin**: `admin@demo.com` / `demo123`

### Test Endpoints
- **Config check**: `GET /api/test-config`
- **Auth session**: `GET /api/auth/session`

### Testing Checklist
- [ ] User authentication (sign in/up/out)
- [ ] File upload and storage
- [ ] Credit system functionality
- [ ] Payment processing
- [ ] Admin panel access
- [ ] Security rule enforcement

## 🚀 Deployment

### Firebase Deployment
```bash
firebase deploy --only firestore:rules,storage
```

### Vercel Deployment
1. Connect repository to Vercel
2. Set environment variables
3. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `.next`

### Production Checklist
- [ ] Environment variables configured
- [ ] Firebase security rules deployed
- [ ] Stripe webhooks configured
- [ ] Domain and SSL setup
- [ ] Error monitoring configured

## 📚 Key Components

### Authentication
- **AuthContext**: Global auth state management
- **SignInPage**: Branded sign-in with Firebase auth
- **SignUpPage**: User registration with profile creation
- **ProtectedLayout**: Route protection for authenticated users

### User Interface
- **Dashboard**: User overview with stats and quick actions
- **UploadPage**: Drag-and-drop file upload with cost calculator
- **TranscriptionsPage**: Filterable list of user transcriptions
- **TranscriptViewer**: Rich transcript display with audio sync
- **BillingPage**: Credit management and payment processing

### Admin Panel
- **AdminDashboard**: System overview and metrics
- **UserManagement**: User accounts and role management
- **TranscriptionQueue**: Job monitoring and processing
- **AdminLedger**: Financial tracking and reporting

## 🔍 Troubleshooting

### Common Issues

**Authentication not working:**
- Check Firebase configuration in `.env.local`
- Verify Firebase project settings
- Ensure auth domain matches your domain

**File upload failing:**
- Check Storage rules deployment
- Verify file size limits (100MB max)
- Ensure proper authentication

**Payment processing errors:**
- Verify Stripe API keys
- Check webhook endpoint configuration
- Test in Stripe dashboard

**Speechmatics integration issues:**
- API key configuration optional
- App gracefully handles missing API
- Check `SPEECHMATICS_API_KEY` environment variable

### Debug Commands
```bash
# Check Firebase project status
firebase projects:list

# View Firebase logs
firebase functions:log

# Test local configuration
curl http://localhost:3000/api/test-config
```

## 📝 Migration Status

This project represents a complete migration from a previous authentication system to Firebase Auth. All core features have been successfully migrated:

- ✅ Authentication pages and flows
- ✅ User dashboard and file upload
- ✅ Transcription management
- ✅ Billing and payment system
- ✅ Admin panel functionality
- ✅ Security rules and data protection

See `MIGRATION-PLAN.md` for detailed migration history and `DEPLOYMENT_STATUS.md` for current deployment status.

## 🤝 Contributing

1. **Code Style**: Follow existing TypeScript and React patterns
2. **Security**: Never commit API keys or sensitive data
3. **Testing**: Test authentication flows before submitting
4. **Documentation**: Update this file for significant changes

---

**Status**: Production ready with comprehensive Firebase integration, secure authentication, and full transcription workflow.