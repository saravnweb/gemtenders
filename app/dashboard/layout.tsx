import type { Metadata } from "next";
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ProfileSidebar from '@/components/ProfileSidebar';

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your GeM tender keywords, bookmarks, and subscription.",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?callback=/dashboard');
  }

  return (
    <div className="flex bg-slate-50 min-h-[calc(100vh-64px)]">
      {/* Side Menu Bar */}
      <aside className="hidden md:block sticky top-16 h-[calc(100vh-16)] overflow-y-auto">
        <ProfileSidebar user={user} />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-full">
        <div className="p-6 md:p-10 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
