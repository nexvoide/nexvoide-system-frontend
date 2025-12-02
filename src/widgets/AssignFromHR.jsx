import React, { useState } from "react";
import { useAppStore } from "../stores/appStore.js";

export default function AssignFromHR({ onPick }) {
  const { employees } = useAppStore();
  const [sel, setSel] = useState("");
  return (
    <div className="flex items-end gap-2 mt-2">
      <div className="flex-1">
        <label className="text-xs text-slate-500">Quick assign from HR</label>
        <select className="glass w-full px-3 py-2 rounded-xl" value={sel} onChange={(e)=>setSel(e.target.value)}>
          <option value="">Select employee...</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
          ))}
        </select>
      </div>
      <button type="button" className="btn btn-secondary" onClick={()=>{
        const emp = employees.find(e => e.id === sel);
        if (emp && onPick) onPick(emp);
      }}>Add</button>
    </div>
  );
}









