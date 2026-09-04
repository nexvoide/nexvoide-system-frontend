import React, { useState, useEffect } from "react";
import { useAppStore } from "../stores/appStore.js";
import { Save, Calendar, AlertTriangle } from "lucide-react";
import MonthlyClosingDialog from "../components/MonthlyClosing/MonthlyClosingDialog.jsx";
import { hasRole } from "../utils/permissions.js";
import { ROLES } from "../utils/permissions.js";

export default function SettingsSection() {
  const { rate, setRate, currency, setCurrency, user } = useAppStore();
  const [localRate, setLocalRate] = useState(rate);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCloseMonth, setShowCloseMonth] = useState(false);
  
  const isAdmin = hasRole(user?.role, ROLES.ADMIN);

  // Update local rate when store rate changes
  useEffect(() => {
    setLocalRate(rate);
    setHasChanges(false);
  }, [rate]);

  // Check if rate has changed
  useEffect(() => {
    setHasChanges(Number(localRate) !== Number(rate));
  }, [localRate, rate]);

  async function handleSaveRate() {
    try {
      await setRate(localRate);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to update rate:', error);
      alert('Failed to update conversion rate. Please try again.');
    }
  }

  return (
    <div className="grid gap-3">
      <div className="glass rounded-2xl h-11 px-3 flex items-center">
        <div className="text-sm font-semibold">Settings</div>
      </div>
      <div className="glass rounded-2xl p-4 md:p-5 grid gap-3 md:gap-4">
        <div>
          <label className="text-xs md:text-sm text-slate-500">Display currency</label>
          <select className="glass w-full md:w-40 px-3 h-11 rounded-xl text-base md:text-sm" value={currency} onChange={async (e)=>{
            try {
              await setCurrency(e.target.value);
            } catch (error) {
              console.error('Failed to update currency:', error);
              alert('Failed to update currency. Please try again.');
            }
          }}>
            <option value="USD">USD</option>
            <option value="PKR">PKR</option>
          </select>
          <div className="text-xs text-slate-500 mt-1">Controls which currency is displayed across the system.</div>
        </div>
        <div>
          <label className="text-xs md:text-sm text-slate-500">USD → PKR conversion rate</label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              className="glass w-full sm:w-40 px-3 h-11 rounded-xl text-base md:text-sm"
              type="number"
              step="0.01"
              value={localRate}
              onChange={(e) => setLocalRate(e.target.value)}
            />
            <button
              onClick={handleSaveRate}
              disabled={!hasChanges}
              className={`btn btn-primary inline-flex items-center justify-center gap-2 px-4 h-11 rounded-xl text-sm md:text-base ${
                !hasChanges ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Save size={16} />
              Save
            </button>
          </div>
          {hasChanges && (
            <div className="text-xs text-amber-500 mt-1">You have unsaved changes</div>
          )}
          <div className="text-xs text-slate-500 mt-1">Used to calculate PKR values across Finance and Dashboard.</div>
        </div>

        {/* Monthly Closing Section - Admin Only */}
        {isAdmin && (
          <div className="border-t border-slate-700 pt-4 mt-4">
            <div className="mb-3">
              <label className="text-xs text-slate-500">Monthly Closing</label>
              <div className="text-xs text-slate-400 mt-1 mb-3">
                Close the current month to archive completed projects and reset counters for the new month.
              </div>
            </div>
            <button
              onClick={() => setShowCloseMonth(true)}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Calendar size={18} />
              Close Current Month
            </button>
            <div className="text-xs text-amber-400 mt-2 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>This action archives all completed projects and moves incomplete projects to the next month.</span>
            </div>
          </div>
        )}
      </div>

      {/* Monthly Closing Dialog */}
      {isAdmin && (
        <MonthlyClosingDialog
          open={showCloseMonth}
          onClose={() => setShowCloseMonth(false)}
          onSuccess={() => {
            setShowCloseMonth(false);
            // Optionally reload data or show success message
            window.location.reload(); // Reload to refresh all data
          }}
        />
      )}
    </div>
  );
}


