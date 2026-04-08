import { Zap, CheckCircle, Database, Shield, LayoutDashboard, Cpu, ArrowRight, Users, FileText, Brain, Banknote, MapPin, Building2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  // Auth guard — only the admin email may access this page
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const userEmail = user?.email?.trim().toLowerCase();

  // Redirect to login if not authenticated
  if (!user) {
    redirect("/login?callback=/admin");
  }

  // Show "Access Denied" if email mismatch
  if (!adminEmail || userEmail !== adminEmail) {
    console.log(`[Admin Access Denied] User: ${userEmail}, Expected: ${adminEmail}`);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-800 mb-2">Access Denied</h1>
          
          {!adminEmail ? (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-left">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-1 items-center flex">
                 <Shield className="w-3 h-3 mr-1" />
                 Server Configuration Error
              </p>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">
                The <code className="bg-amber-100 px-1 rounded">ADMIN_EMAIL</code> environment variable is missing on your server.
              </p>
              <p className="text-slate-500 text-[11px] mt-2 leading-relaxed">
                 You must add <code className="bg-slate-100 px-1">ADMIN_EMAIL=saravn.ent@gmail.com</code> to your project's Environment Variables in the Vercel/Production dashboard.
              </p>
            </div>
          ) : (
            <p className="text-slate-600 mb-6 font-medium leading-relaxed">
              Your email <span className="text-slate-900 font-bold underline">{userEmail}</span> is not authorized to access the command center.
            </p>
          )}

          <div className="space-y-4 mt-6">
             <Link href="/" className="block w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
               Return to Live Site
             </Link>
             <div className="pt-2 border-t border-slate-100">
               <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Administrator Hint</p>
               <p className="text-[11px] text-slate-500 mt-1">
                 Ensure the email you are logged in with matches exactly the one configured in your server environment.
               </p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // Fetch detailed stats on server
  const { count: totalCount } = await supabase
    .from("tenders")
    .select("*", { count: "exact", head: true });

  const { count: enrichedCount } = await supabase
    .from("tenders")
    .select("*", { count: "exact", head: true })
    .not("pdf_url", "is", null);

  // ── Data Quality Stats ───────────────────────────────────────────────────
  const [
    { count: hasAiSummary },
    { count: hasEmd },
    { count: hasState },
    { count: hasCity },
    { count: hasMinistry },
    { count: hasOrg },
    { count: enrichmentTried },
    { count: nullBidNumber },
  ] = await Promise.all([
    supabase.from("tenders").select("*", { count: "exact", head: true }).not("ai_summary", "is", null),
    supabase.from("tenders").select("*", { count: "exact", head: true }).not("emd_amount", "is", null),
    supabase.from("tenders").select("*", { count: "exact", head: true }).not("state", "is", null),
    supabase.from("tenders").select("*", { count: "exact", head: true }).not("city", "is", null),
    supabase.from("tenders").select("*", { count: "exact", head: true }).not("ministry_name", "is", null),
    supabase.from("tenders").select("*", { count: "exact", head: true }).not("organisation_name", "is", null),
    supabase.from("tenders").select("*", { count: "exact", head: true }).not("enrichment_tried_at", "is", null),
    supabase.from("tenders").select("*", { count: "exact", head: true }).is("bid_number", null),
  ]);

  const total = totalCount || 0;
  const pct = (n: number | null) => total ? Math.round((n || 0) / total * 100) : 0;

  // ── Detail rows for missing data (up to 100 each) ────────────────────────
  const [
    { data: missingPdfRows },
    { data: missingAiRows },
    { data: missingEmdRows },
    { data: missingStateRows },
    { data: missingCityRows },
    { data: missingMinistryRows },
    { data: missingOrgRows },
  ] = await Promise.all([
    supabase.from("tenders").select("bid_number, title, slug, details_url").is("pdf_url", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("tenders").select("bid_number, title, slug, details_url").is("ai_summary", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("tenders").select("bid_number, title, slug, details_url").is("emd_amount", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("tenders").select("bid_number, title, slug, details_url").is("state", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("tenders").select("bid_number, title, slug, details_url").is("city", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("tenders").select("bid_number, title, slug, details_url").is("ministry_name", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("tenders").select("bid_number, title, slug, details_url").is("organisation_name", null).order("created_at", { ascending: false }).limit(100),
  ]);

  // Subscriptions & Users Stats (bypassing RLS)
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch ALL profiles with pagination (PostgREST default limit is 1000)
  let profiles: { id: string; full_name: string | null; membership_plan: string | null; subscription_status: string | null; updated_at: string | null }[] = [];
  let profilePage = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, membership_plan, subscription_status, updated_at")
      .range(profilePage * PAGE_SIZE, (profilePage + 1) * PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    profiles = profiles.concat(data);
    if (data.length < PAGE_SIZE) break;
    profilePage++;
  }

  // Fetch auth users to get emails + detect users with no profile row
  let emailMap: Record<string, string> = {};
  let nameMap: Record<string, string> = {};
  let totalAuthUsers = 0;
  let profileIds = new Set(profiles.map((p) => p.id));
  let noProfileUsers: { id: string; email: string | null; name: string | null }[] = [];
  try {
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    if (!authError && authUsers) {
      authUsers.forEach((u) => {
        if (u.email) emailMap[u.id] = u.email;
        const name = u.user_metadata?.full_name || u.user_metadata?.name || null;
        if (name) nameMap[u.id] = name;
        if (!profileIds.has(u.id)) {
          noProfileUsers.push({ id: u.id, email: u.email ?? null, name });
        }
      });
      totalAuthUsers = authUsers.length;
    }
  } catch {
    totalAuthUsers = profiles.length;
  }

  // Build enriched subscriber list
  type Subscriber = { id: string; name: string | null; email: string | null; plan: string; status: string | null; updatedAt: string | null };
  const subscribers: Subscriber[] = profiles.map((p) => ({
    id: p.id,
    name: p.full_name,
    email: emailMap[p.id] ?? null,
    plan: (p.membership_plan || "free").toLowerCase(),
    status: p.subscription_status,
    updatedAt: p.updated_at,
  }));

  // Auth users with no profile row are implicitly free tier
  const ghostFreeSubscribers: Subscriber[] = noProfileUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    plan: "free",
    status: "active",
    updatedAt: null,
  }));

  const freeSubscribers = [...subscribers.filter((s) => s.plan === "free"), ...ghostFreeSubscribers];
  const starterSubscribers = subscribers.filter((s) => s.plan === "starter");
  const proSubscribers = subscribers.filter((s) => s.plan === "pro");

  const starterCount = starterSubscribers.length;
  const proCount = proSubscribers.length;
  const freeCount = freeSubscribers.length;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Area */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
              <LayoutDashboard className="mr-3 text-blue-600 w-8 h-8" />
              Command Center
            </h1>
            <p className="text-slate-500 font-medium mt-1">Manage tender ingestion and AI enrichment</p>
          </div>
          <Link href="/" className="flex items-center space-x-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <span>View Live Site</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Subscriptions Section */}
        <h2 id="all-users" className="text-xl font-bold text-slate-800 mb-6 flex items-center">
          <Users className="w-6 h-6 mr-2 text-slate-400" />
          Users & Subscriptions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <a href="#all-users" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-slate-400 hover:shadow-md transition-all cursor-pointer block">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Users</p>
            <p className="text-3xl font-black text-slate-800">{totalAuthUsers}</p>
            <p className="text-xs text-slate-400 mt-2">Click to view all ↓</p>
          </a>
          <a href="#free-subscribers" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-slate-400 hover:shadow-md transition-all cursor-pointer block">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Free Tier</p>
            <p className="text-3xl font-black text-slate-800">{freeCount}</p>
            <p className="text-xs text-slate-400 mt-2">Click to view ↓</p>
          </a>
          <a href="#starter-subscribers" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-orange-500 hover:shadow-md transition-all cursor-pointer block">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-1">Starter Plans</p>
            <p className="text-3xl font-black text-slate-800">{starterCount}</p>
            <p className="text-sm text-slate-500 mt-2">Active Subscribers</p>
            <p className="text-xs text-orange-400 mt-1">Click to view ↓</p>
          </a>
          <a href="#pro-subscribers" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-amber-500 hover:shadow-md transition-all cursor-pointer block">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Pro Plans</p>
            <p className="text-3xl font-black text-slate-800">{proCount}</p>
            <p className="text-sm text-slate-500 mt-2">Active Subscribers</p>
            <p className="text-xs text-amber-400 mt-1">Click to view ↓</p>
          </a>
        </div>
        {/* Auto-open the targeted <details> section on hash navigation */}
        <script dangerouslySetInnerHTML={{ __html: `
          function openTargetDetails() {
            if (!location.hash) return;
            var el = document.querySelector(location.hash);
            if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          }
          openTargetDetails();
          window.addEventListener('hashchange', openTargetDetails);
        ` }} />

        {/* ── Subscriber List ── */}
        <div className="mt-2 mb-14 space-y-4">
          <SubscriberTable id="pro-subscribers" title="Pro Subscribers" color="amber" subscribers={proSubscribers} />
          <SubscriberTable id="starter-subscribers" title="Starter Subscribers" color="orange" subscribers={starterSubscribers} />
          <SubscriberTable id="free-subscribers" title="Free Tier Users" color="slate" subscribers={freeSubscribers} />
        </div>

        {/* ── Data Quality Section ── */}
        <div className="mt-14">
          <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
            <AlertCircle className="w-6 h-6 mr-2 text-slate-400" />
            Data Quality
          </h2>
          <p className="text-sm text-slate-500 mb-6">Coverage across all {total} indexed tenders</p>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PDF</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pct(enrichedCount)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{enrichedCount ?? 0} / {total}</p>
              {(total - (enrichedCount || 0)) > 0 && (
                <p className="text-xs text-red-500 font-semibold mt-1">Missing: {total - (enrichedCount || 0)}</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Summary</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pct(hasAiSummary)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{hasAiSummary ?? 0} / {total}</p>
              {(total - (hasAiSummary || 0)) > 0 && (
                <p className="text-xs text-red-500 font-semibold mt-1">Missing: {total - (hasAiSummary || 0)}</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Banknote className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">EMD</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pct(hasEmd)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{hasEmd ?? 0} / {total}</p>
              {(total - (hasEmd || 0)) > 0 && (
                <p className="text-xs text-red-500 font-semibold mt-1">Missing: {total - (hasEmd || 0)}</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <MapPin className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">State</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pct(hasState)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{hasState ?? 0} / {total}</p>
              {(total - (hasState || 0)) > 0 && (
                <p className="text-xs text-red-500 font-semibold mt-1">Missing: {total - (hasState || 0)}</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Building2 className="w-4 h-4 text-pink-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">City</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pct(hasCity)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{hasCity ?? 0} / {total}</p>
              {(total - (hasCity || 0)) > 0 && (
                <p className="text-xs text-red-500 font-semibold mt-1">Missing: {total - (hasCity || 0)}</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ministry</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pct(hasMinistry)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{hasMinistry ?? 0} / {total}</p>
              {(total - (hasMinistry || 0)) > 0 && (
                <p className="text-xs text-red-500 font-semibold mt-1">Missing: {total - (hasMinistry || 0)}</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Org</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pct(hasOrg)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{hasOrg ?? 0} / {total}</p>
              {(total - (hasOrg || 0)) > 0 && (
                <p className="text-xs text-red-500 font-semibold mt-1">Missing: {total - (hasOrg || 0)}</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Cpu className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enriched</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pct(enrichmentTried)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{enrichmentTried ?? 0} / {total}</p>
              {(nullBidNumber || 0) > 0 && (
                <p className="text-xs text-red-500 font-semibold mt-1">Null Bid#: {nullBidNumber}</p>
              )}
            </div>
          </div>

          {/* Detail Tables */}
          <div className="space-y-6">
            <DataQualityTable
              title="Missing PDF"
              icon={<FileText className="w-4 h-4 text-blue-500" />}
              rows={missingPdfRows ?? []}
              totalMissing={total - (enrichedCount || 0)}
            />
            <DataQualityTable
              title="Missing AI Summary"
              icon={<Brain className="w-4 h-4 text-purple-500" />}
              rows={missingAiRows ?? []}
              totalMissing={total - (hasAiSummary || 0)}
            />
            <DataQualityTable
              title="Missing EMD Amount"
              icon={<Banknote className="w-4 h-4 text-emerald-500" />}
              rows={missingEmdRows ?? []}
              totalMissing={total - (hasEmd || 0)}
            />
            <DataQualityTable
              title="Missing State"
              icon={<MapPin className="w-4 h-4 text-orange-500" />}
              rows={missingStateRows ?? []}
              totalMissing={total - (hasState || 0)}
            />
            <DataQualityTable
              title="Missing City"
              icon={<Building2 className="w-4 h-4 text-pink-500" />}
              rows={missingCityRows ?? []}
              totalMissing={total - (hasCity || 0)}
            />
            <DataQualityTable
              title="Missing Ministry"
              icon={<Shield className="w-4 h-4 text-indigo-500" />}
              rows={missingMinistryRows ?? []}
              totalMissing={total - (hasMinistry || 0)}
            />
            <DataQualityTable
              title="Missing Organisation"
              icon={<Database className="w-4 h-4 text-cyan-500" />}
              rows={missingOrgRows ?? []}
              totalMissing={total - (hasOrg || 0)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subscriber table ──────────────────────────────────────────────────────
function SubscriberTable({
  id,
  title,
  color,
  subscribers,
}: {
  id?: string;
  title: string;
  color: "amber" | "orange" | "slate";
  subscribers: { id: string; name: string | null; email: string | null; plan: string; status: string | null; updatedAt: string | null }[];
}) {
  const colorMap = {
    amber: { badge: "bg-amber-100 text-amber-700", border: "border-t-amber-500", label: "text-amber-600" },
    orange: { badge: "bg-orange-100 text-orange-700", border: "border-t-orange-500", label: "text-orange-600" },
    slate: { badge: "bg-slate-100 text-slate-600", border: "", label: "text-slate-500" },
  };
  const c = colorMap[color];

  return (
    <details id={id} className={`group bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${c.border ? `border-t-4 ${c.border}` : ""}`}>
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none">
        <div className="flex items-center space-x-3">
          <span className={`font-bold text-slate-800`}>{title}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{subscribers.length}</span>
        </div>
        <span className="text-xs text-slate-400 font-medium group-open:hidden">Show</span>
        <span className="text-xs text-slate-400 font-medium hidden group-open:inline">Hide</span>
      </summary>
      {subscribers.length === 0 ? (
        <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-400 italic">No users in this tier.</div>
      ) : (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscribers.map((s, i) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">{s.name || <span className="text-slate-400 italic">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-mono">{s.email || <span className="text-slate-400 italic">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {s.status || "unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

// ── Reusable detail table ──────────────────────────────────────────────────
function DataQualityTable({
  title,
  icon,
  rows,
  totalMissing,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { bid_number: string | null; title: string | null; slug: string | null; details_url?: string | null }[];
  totalMissing: number;
}) {
  if (totalMissing === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-3">
        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
        <span className="text-sm font-semibold text-emerald-700">{title}: All complete</span>
      </div>
    );
  }

  return (
    <details className="group bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none">
        <div className="flex items-center space-x-3">
          {icon}
          <span className="font-bold text-slate-800">{title}</span>
          <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">{totalMissing} missing</span>
        </div>
        <span className="text-xs text-slate-400 font-medium group-open:hidden">Show {Math.min(rows.length, 100)}</span>
        <span className="text-xs text-slate-400 font-medium hidden group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Bid Number</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Title</th>
              <th className="px-4 py-2 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">{row.bid_number ?? <span className="text-red-400 italic">null</span>}</td>
                <td className="px-4 py-3 text-slate-700 text-xs font-medium leading-relaxed max-w-sm">
                   <div className="line-clamp-2" title={row.title || ""}>{row.title ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end space-x-4">
                    {row.details_url && (
                      <a href={row.details_url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-600 hover:underline font-bold transition-colors">GeM Portal</a>
                    )}
                    {row.slug && (
                      <Link href={`/bids/${row.slug}`} target="_blank" className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 font-bold transition-colors">View Bid</Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalMissing > rows.length && (
          <p className="text-xs text-slate-400 text-center py-3 border-t border-slate-100">
            Showing first {rows.length} of {totalMissing} — run enrichment to reduce this list
          </p>
        )}
      </div>
    </details>
  );
}
