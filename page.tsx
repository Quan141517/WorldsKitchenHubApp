import Image from "next/image";
import { HubClient } from "@/components/HubClient";
import { readHubData } from "@/lib/hub-store";
import { getSession } from "@/lib/session";
import { filterHubDataForSession } from "@/lib/visibility";

export default async function HomePage() {
  const session = await getSession();
  const hubData = await readHubData();

  if (!session) {
    return (
      <main className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <Image className="brand-logo" src="/assets/worlds-kitchen-logo.png" alt="World's Kitchen logo" width={48} height={48} />
            <div>
              <p className="eyebrow">Staff Portal</p>
              <h1>World&apos;s Kitchen Hub</h1>
            </div>
          </div>
        </aside>
        <section className="main-content">
          <div className="workspace">
            <p className="eyebrow">Discord Login</p>
            <h2>Sign in to access the Hub.</h2>
            <p className="muted">Your Discord account is used to detect your staff role and show only the resources you can access.</p>
            <a className="button primary" href="/api/auth/discord/login">Sign in with Discord</a>
          </div>
        </section>
      </main>
    );
  }

  return <HubClient session={session} initialData={filterHubDataForSession(hubData, session)} />;
}
