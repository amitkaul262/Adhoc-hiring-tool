import Navbar from "@/components/Navbar";
import NewRequisitionForm from "./NewRequisitionForm";
import { createRequisition } from "./actions";
import { getCurrentEmployee } from "@/lib/currentUser";
import { redirect } from "next/navigation";

export default async function NewRequisitionPage() {
  const { employee } = await getCurrentEmployee();

  if (!employee || employee.role !== "store_manager") {
    redirect("/dashboard");
  }

  const boundAction = createRequisition.bind(null, employee);

  return (
    <>
      <Navbar employee={employee} />
      <div className="container" style={{ maxWidth: 560 }}>
        <span className="eyebrow">New requisition</span>
        <h1 style={{ marginBottom: 24 }}>Raise adhoc hiring requisition</h1>
        <NewRequisitionForm action={boundAction} employee={employee} />
      </div>
    </>
  );
}
