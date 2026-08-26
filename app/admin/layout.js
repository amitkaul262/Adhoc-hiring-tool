import Navbar from "@/components/Navbar";
import AdminTabs from "@/components/AdminTabs";
import { getCurrentEmployee } from "@/lib/currentUser";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }) {
  const { employee } = await getCurrentEmployee();

  if (!employee || employee.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <>
      <Navbar employee={employee} />
      <div className="container">
        <span className="eyebrow">Admin</span>
        <h1 style={{ marginBottom: 20 }}>Manage the tool</h1>
        <AdminTabs />
        {children}
      </div>
    </>
  );
}
