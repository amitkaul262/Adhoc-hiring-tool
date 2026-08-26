import { getCurrentEmployee } from "@/lib/currentUser";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }) {
  const { employee } = await getCurrentEmployee();

  if (employee.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="container">
      <span className="eyebrow">Admin</span>
      <h1 style={{ marginBottom: 20 }}>Manage the tool</h1>
      {children}
    </div>
  );
}
