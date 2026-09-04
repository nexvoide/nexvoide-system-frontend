import React, { useMemo, useState } from "react";
import { useStore } from "../stores/appStore.js";

function ym(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EmployeeFinance() {
  const { state, computeProjectNumbers, formatMoney } = useStore();
  const [month, setMonth] = useState(() => ym(new Date().toISOString()));

  const monthly = useMemo(() => {
    const employeePayouts = new Map();
    let totalEarned = 0;
    let totalExpenses = 0;

    for (const p of state.projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      
      if (p.status !== "Completed") continue;
      const projectMonth = ym(p.completedAt || p.completed_at || p.updatedAt || p.updated_at);
      if (!projectMonth || projectMonth !== month) continue;

      const nums = computeProjectNumbers(p);
      totalEarned += nums.valueInDisplay;

      // Split employee payout in display currency proportionally
      const projectValue = p.amount || 0;
      for (const a of p.assigned || []) {
        let payoutInProjectCurrency = 0;
        if (a.costType === "percentage") payoutInProjectCurrency = (projectValue * (Number(a.costValue) || 0)) / 100;
        else payoutInProjectCurrency = Number(a.costValue) || 0;

        // Estimate display payout by same ratio from total employee payment
        // More accurate conversion would convert each assignment separately, but this is fine for summary
        const ratio = projectValue > 0 ? payoutInProjectCurrency / projectValue : 0;
        const displayPayout = ratio * nums.valueInDisplay;

        employeePayouts.set(a.name, (employeePayouts.get(a.name) || 0) + displayPayout);
        totalExpenses += displayPayout;
      }
    }

    const rows = Array.from(employeePayouts.entries()).map(([name, amount]) => ({ name, amount }));
    const netProfit = totalEarned - totalExpenses;
    return { rows, totalEarned, totalExpenses, netProfit };
  }, [state.projects, month, state.displayCurrency, state.exchangeRate]);

  return (
    <div className="panel">
      <div className="inline" style={{ marginBottom: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="row">
        <div className="col">
          <div className="panel panel-compact">
            <h3 className="text-sm md:text-base">Employee total payouts</h3>
            <div className="value text-lg md:text-2xl">{formatMoney(monthly.totalExpenses)}</div>
          </div>
        </div>
        <div className="col">
          <div className="panel panel-compact">
            <h3 className="text-sm md:text-base">Total earned from clients</h3>
            <div className="value text-lg md:text-2xl">{formatMoney(monthly.totalEarned)}</div>
          </div>
        </div>
        <div className="col">
          <div className="panel panel-compact">
            <h3 className="text-sm md:text-base">Net profit</h3>
            <div className="value text-lg md:text-2xl">{formatMoney(monthly.netProfit)}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Payout ({state.displayCurrency})</th>
            </tr>
          </thead>
          <tbody>
            {monthly.rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{formatMoney(r.amount)}</td>
              </tr>
            ))}
            {monthly.rows.length === 0 && (
              <tr>
                <td colSpan={2} className="muted">No completed projects for selected month.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

