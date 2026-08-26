import Navbar from "@/components/Navbar";
import StoreManagerDashboard from "./StoreManagerDashboard";
import HodDashboard from "./HodDashboard";
import HrDashboard from "./HrDashboard";
import { getCurrentEmployee } from "@/lib/currentUser";

export default async function DashboardPage({ searchParams }) {
  const { user, employee } = await getCurrentEmployee();

  if (!employee) {
    return (
      <>
        <Navbar employee={null} />
        <div className="container">
          <div className="card">
            <h2>You&apos;re signed in, but not yet set up</h2>
            <p>
              {user.email} doesn&apos;t have an active employee_master record yet.
              Ask an admin to add you before you can use the tool.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar employee={employee} />
      {employee.role === "store_manager" && <StoreManagerDashboard employee={employee} />}
      {employee.role === "hod" && <HodDashboard employee={employee} />}
      {(employee.role === "hr" || employee.role === "admin") && (
        <HrDashboard employee={employee} searchParams={searchParams} />
      )}
    </>
  );
}
