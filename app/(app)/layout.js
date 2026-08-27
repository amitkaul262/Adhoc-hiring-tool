import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import { getCurrentEmployee } from "@/lib/currentUser";

export default async function AppLayout({ children }) {
  const { user, employee } = await getCurrentEmployee();

  if (!employee) {
    return (
      <>
        <TopBar employee={null} />
        <div className="app-shell">
          <main className="app-main">
            <div className="container">
              <div className="card">
                <h2>You&apos;re signed in, but not yet set up</h2>
                <p>
                  {user.email} doesn&apos;t have an active employee_master record yet.
                  Ask an admin to add you before you can use the tool.
                </p>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar employee={employee} />
      <div className="app-shell">
        <Sidebar role={employee.role} />
        <main className="app-main">{children}</main>
      </div>
      <CommandPalette />
    </>
  );
}
