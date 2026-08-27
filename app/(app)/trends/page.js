import { getCurrentEmployee } from "@/lib/currentUser";
import { fetchTrendsData } from "@/lib/trendsData";
import TrendsCharts from "@/components/TrendsCharts";
import { redirect } from "next/navigation";

export default async function TrendsPage() {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  const data = await fetchTrendsData();

  return (
    <div className="container-wide">
      <span className="eyebrow">HR</span>
      <div className="section-header">
        <h1>Trends</h1>
      </div>
      <p style={{ marginBottom: 20 }}>
        The same data as the rest of the tool, over time — last 12 weeks.
      </p>
      <TrendsCharts data={data} />
    </div>
  );
}
