import Link from "next/link";
import Navbar from "@/components/Navbar";
import RequisitionTable from "@/components/RequisitionTable";
import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function DashboardPage() {
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
              Ask HR to add you before you can raise requisitions.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (employee.role !== "store_manager") {
    return (
      <>
        <Navbar employee={employee} />
        <div className="container">
          <div className="card">
            <h2>{roleLabel(employee.role)} view coming soon</h2>
            <p>
              We&apos;ve built the store manager view first. Your dashboard
              ({roleLabel(employee.role)}) is next.
            </p>
          </div>
        </div>
      </>
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: requisitions } = await supabase
    .from("requisitions")
    .select("*")
    .eq("raised_by_email", employee.email)
    .order("created_at", { ascending: false });

  return (
    <>
      <Navbar employee={employee} />
      <div className="container">
        <span className="eyebrow">Store Manager</span>
        <div className="section-header">
          <h1>{employee.store_name || employee.full_name}</h1>
        </div>

        <div className="card" style={{ marginBottom: 28 }}>
          <div className="profile-grid">
            <div className="profile-field">
              <div className="label">Store</div>
              <div className="value">{employee.store_name || "-"}</div>
            </div>
            <div className="profile-field">
              <div className="label">Store code</div>
              <div className="value">{employee.store_code || "-"}</div>
            </div>
            <div className="profile-field">
              <div className="label">Function</div>
              <div className="value">{employee.function || "-"}</div>
            </div>
            <div className="profile-field">
              <div className="label">Cost center</div>
              <div className="value">{employee.cost_center || "-"}</div>
            </div>
            <div className="profile-field">
              <div className="label">Reports to</div>
              <div className="value">{employee.reports_to_email || "-"}</div>
            </div>
          </div>
        </div>

        <div className="section-header">
          <h2>Your requisitions</h2>
          <Link href="/requisitions/new" className="btn btn-primary">
            + Raise requisition
          </Link>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: requisitions?.length ? "8px 16px" : 0 }}>
            <RequisitionTable requisitions={requisitions} />
          </div>
        </div>
      </div>
    </>
  );
}

function roleLabel(role) {
  return { hod: "HOD", hr: "HR", admin: "Admin", store_manager: "Store Manager" }[role] || role;
}
