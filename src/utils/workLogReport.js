import jsPDF from 'jspdf';

const duration = (minutes) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;

export function downloadMonthlyWorkLogPDF(employee, month, entries) {
  const doc = new jsPDF('p', 'pt', 'a4');
  const margin = 38;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dailyTotals = entries.reduce((totals, entry) => ({ ...totals, [entry.work_date]: (totals[entry.work_date] || 0) + Number(entry.minutes_spent || 0) }), {});
  const monthlyTotal = Object.values(dailyTotals).reduce((sum, value) => sum + value, 0);
  let y = 42;
  const header = () => {
    doc.setFillColor(3, 7, 18); doc.rect(0, 0, doc.internal.pageSize.getWidth(), 88, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(19); doc.text('MONTHLY WORK LOG', margin, 38);
    doc.setFontSize(10); doc.setTextColor(148,163,184); doc.text(monthLabel, margin, 58); y = 112;
  };
  header();
  doc.setTextColor(15,23,42); doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.text(`Employee: ${employee.name}`, margin, y);
  const customerNames = (employee.retainerAssignments || employee.retainer_assignments || [])
    .map(assignment => assignment.name)
    .filter(Boolean)
    .join(', ');
  doc.text(`Customer: ${customerNames || employee.assignedClient || employee.assigned_client || 'Not assigned'}`, margin, y + 18);
  doc.text(`Monthly Total: ${duration(monthlyTotal)}`, margin, y + 36); y += 62;
  const columns = [0, 72, 188, 350, 425];
  const headings = ['Date', 'Project / Task', 'Activity', 'Time', 'Daily Total'];
  const drawTableHeader = () => { doc.setFillColor(37,99,235); doc.roundedRect(margin, y, width, 28, 4, 4, 'F'); doc.setTextColor(255,255,255); doc.setFontSize(8); headings.forEach((h,i)=>doc.text(h, margin + columns[i] + 6, y + 18)); y += 34; };
  drawTableHeader();
  let previousDate = '';
  entries.forEach((entry) => {
    const project = doc.splitTextToSize(entry.project_task || '', 105);
    const activity = doc.splitTextToSize(entry.activity || '', 150);
    const notes = entry.notes ? doc.splitTextToSize(`Notes: ${entry.notes}`, 255) : [];
    const rowHeight = Math.max(32, Math.max(project.length, activity.length) * 11 + notes.length * 9 + 10);
    if (y + rowHeight > 790) { doc.addPage(); header(); drawTableHeader(); }
    doc.setTextColor(30,41,59); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    const isFirstEntryForDate = entry.work_date !== previousDate;
    if (isFirstEntryForDate) doc.text(entry.work_date, margin + 6, y + 14);
    doc.text(project, margin + columns[1] + 6, y + 14); doc.text(activity, margin + columns[2] + 6, y + 14);
    doc.text(duration(Number(entry.minutes_spent || 0)), margin + columns[3] + 6, y + 14);
    if (isFirstEntryForDate) doc.text(duration(dailyTotals[entry.work_date]), margin + columns[4] + 6, y + 14);
    if (notes.length) { doc.setTextColor(100,116,139); doc.text(notes, margin + columns[2] + 6, y + 14 + activity.length * 11); }
    doc.setDrawColor(226,232,240); doc.line(margin, y + rowHeight, margin + width, y + rowHeight); previousDate = entry.work_date; y += rowHeight;
  });
  if (!entries.length) { doc.setTextColor(100,116,139); doc.text('No work-log activities recorded for this month.', margin, y + 20); }
  doc.save(`${employee.name.replace(/[^a-z0-9]+/gi, '-')}-${month}-work-log.pdf`);
}
