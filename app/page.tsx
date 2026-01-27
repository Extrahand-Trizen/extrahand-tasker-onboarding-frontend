'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { CheckCircle, ShieldCheck, Zap, Users } from 'lucide-react';

const features = [
  { title: 'Capture partners fast', desc: 'Add or upload CSVs, auto-check duplicates.', icon: Users },
  { title: 'Verify & approve', desc: 'Docs, skills, checklist in one flow.', icon: ShieldCheck },
  { title: 'Create accounts', desc: 'Bulk-create users after approval.', icon: Zap },
  { title: 'Stay compliant', desc: 'Secure docs, role-gated actions.', icon: CheckCircle },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAdminAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="ExtraHand Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">Partner Onboarding Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="outline" size="sm">Login</Button>
          </Link>
        </div>
      </header>

      <main className="px-6 py-16 lg:px-16 max-w-7xl mx-auto">
        <section>
          <div className="max-w-3xl space-y-6">
            <p className="text-sm font-semibold text-amber-600 uppercase tracking-wide">For Qualifier,Onboarder and leads manager Team</p>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight text-gray-900">
              Track and upload bulk users in one place.
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Simple tool for managing partners, verifying documents, and creating accounts.
            </p>
            <div className="flex gap-3">
              <Button size="lg" onClick={() => router.push('/login')}>
                Login to Start
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">Key Features</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                <f.icon className="h-6 w-6 text-amber-600 mb-3" />
                <p className="font-semibold text-gray-900 mb-1">{f.title}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
