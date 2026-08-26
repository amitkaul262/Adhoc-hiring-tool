import StoreManagerDashboard from "./StoreManagerDashboard";
import HodDashboard from "./HodDashboard";
import HrDashboard from "./HrDashboard";
import { getCurrentEmployee } from "@/lib/currentUser";

// employee is guaranteed non-null here — the (app) layout already
// handles the "not provisioned yet" case before this page ever renders.
export default async function DashboardPage({ searchParams }) {
  const { employee } = await getCurrentEmployee();

  return (
    <>
      {employee.role === "store_manager" && <StoreManagerDashboard employee={employee} />}
      {employee.role === "hod" && <HodDashboard employee={employee} />}
      {(employee.role === "hr" || employee.role === "admin") && (
        <HrDashboard employee={employee} searchParams={searchParams} />
      )}
    </>
  );
}
