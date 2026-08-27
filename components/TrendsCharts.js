"use client";

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const GREEN = "#2F6B4F";
const DARKGREEN = "#16241C";
const AMBER = "#D98E2B";

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 14 }}>{title}</h3>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>{subtitle}</p>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #DDE3DB" };

export default function TrendsCharts({ data }) {
  return (
    <div className="trends-grid">
      <ChartCard title="Requisitions raised" subtitle="Per week, last 12 weeks">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF1ED" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="raised" fill={GREEN} radius={[3, 3, 0, 0]} name="Requisitions" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Spend" subtitle="Total payable per week, by work date">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF1ED" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Spend"]} />
          <Bar dataKey="spend" fill={AMBER} radius={[3, 3, 0, 0]} name="Spend" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Attendance rate" subtitle="Of attendance marked each week, % actually present">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF1ED" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => (v === null ? ["No data", "Attendance"] : [`${v}%`, "Attendance"])} />
          <Line type="monotone" dataKey="attendanceRatePct" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} connectNulls name="Attendance rate" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Approval speed" subtitle="Average hours from raised to decided, per week">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF1ED" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => (v === null ? ["No decisions", "Avg. hours"] : [`${v}h`, "Avg. hours"])} />
          <Line type="monotone" dataKey="avgDecisionHours" stroke={DARKGREEN} strokeWidth={2} dot={{ r: 3 }} connectNulls name="Approval speed" />
        </LineChart>
      </ChartCard>
    </div>
  );
}
