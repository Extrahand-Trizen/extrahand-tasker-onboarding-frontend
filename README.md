# ExtraHand Admin Bulk Upload Portal

A dedicated Next.js application for bulk user operations (create, update, delete) in the ExtraHand platform.

## Features

- ✅ **Bulk Create**: Upload CSV/Excel to create multiple tasker profiles
- ✅ **Bulk Update**: Update existing user profiles in bulk
- ✅ **Bulk Delete**: Delete multiple user accounts
- ✅ **Import History**: View all past imports with detailed results
- ✅ **Error Tracking**: Detailed error reports for failed operations
- ✅ **Template Downloads**: Download CSV templates for each operation type

## Tech Stack

- **Framework**: Next.js 16.0.10 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components (inspired by shadcn/ui)
- **State Management**: React Query (TanStack Query)
- **File Upload**: react-dropzone
- **Authentication**: Firebase Auth
- **Tables**: TanStack Table

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project configured
- API Gateway running (default: http://localhost:5000)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:5000
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## CSV Formats

### Create Users
```csv
name,phone,address,city,state,pincode,skills,primarySkill
John Doe,+919876543210,123 Main St,Mumbai,Maharashtra,400001,"Cleaning,Plumbing",home_services
```

### Update Users
```csv
operation,uid,name,phone,address,city,state,pincode,skills,primarySkill,isActive
update,firebase-uid-123,John Updated,+919876543210,456 New St,Mumbai,Maharashtra,400002,"Cleaning,Electrical",home_services,true
```

### Delete Users
```csv
operation,uid,reason
delete,firebase-uid-123,User requested deletion
delete,firebase-uid-456,Account suspended
```

## Project Structure

```
extrahand-admin-bulk-upload/
├── app/
│   ├── login/          # Admin login page
│   ├── import/         # Import details pages
│   └── page.tsx        # Main bulk upload page
├── components/
│   ├── ui/             # Reusable UI components
│   └── bulk-upload/    # Bulk upload specific components
├── lib/
│   ├── api/            # API client
│   ├── config/         # Firebase config
│   ├── hooks/          # Custom React hooks
│   └── utils/          # Utility functions
└── public/             # Static assets
```

## License

Private - ExtraHand Platform
