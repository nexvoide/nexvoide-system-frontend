import jsPDF from "jspdf";

/**
 * Generate a PDF invoice for an agency or brand showing all projects for the current month
 * @param {Object} entity - The agency or brand object
 * @param {Array} projects - All projects from the store
 * @param {string} entityType - 'agency' or 'brand'
 * @param {string} currency - Display currency (USD or PKR)
 * @param {number} rate - USD to PKR conversion rate
 */
export function generateInvoicePDF(
  entity,
  projects,
  entityType,
  currency = "PKR",
  rate = 280
) {
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;
  const contentWidth = pageWidth - margin * 2;

  // Color scheme matching the invoice design
  const COLORS = {
    primaryDark: "#1e293b",
    primaryBlue: "#3b82f6", // Blue from invoice
    lightGray: "#e2e8f0",
    mediumGray: "#94a3b8",
    darkGray: "#64748b",
    white: "#FFFFFF",
    black: "#0f172a",
    borderGray: "#e5e7eb",
  };

  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    const bigint = parseInt(h, 16);
    if (h.length === 6) {
      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
      };
    }
    // fallback to black
    return { r: 0, g: 0, b: 0 };
  };

  // Get current month in YYYY-MM format
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const monthName = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  // Filter projects by entity and month
  const entityProjects = projects.filter((p) => {
    // Check if project belongs to this entity (handle both camelCase and snake_case)
    const agencyId = p.agencyId || p.agency_id;
    const brandId = p.brandId || p.brand_id;
    const matchesEntity =
      entityType === "agency"
        ? agencyId === entity.id || String(agencyId) === String(entity.id)
        : brandId === entity.id || String(brandId) === String(entity.id);

    if (!matchesEntity) return false;

    // Check if project is in current month (use endDate or startDate)
    const projectDate = p.endDate || p.end_date || p.startDate || p.start_date;
    if (!projectDate) return false;

    // Handle both Date objects and strings
    let dateObj;
    if (projectDate instanceof Date) {
      dateObj = projectDate;
    } else if (typeof projectDate === "string") {
      dateObj = new Date(projectDate);
      if (isNaN(dateObj.getTime())) return false; // Invalid date
    } else {
      return false;
    }

    // Extract YYYY-MM from the date
    const projectYear = dateObj.getFullYear();
    const projectMonth = String(dateObj.getMonth() + 1).padStart(2, "0");
    const projectMonthStr = `${projectYear}-${projectMonth}`;

    return projectMonthStr === currentMonth;
  });

  // Helper to convert currency
  const convertCurrency = (amount, fromCurrency) => {
    if (fromCurrency === currency) return amount;
    if (fromCurrency === "USD" && currency === "PKR") return amount * rate;
    if (fromCurrency === "PKR" && currency === "USD") return amount / rate;
    return amount;
  };

  // Calculate totals
  let totalValue = 0;
  const projectRows = entityProjects.map((p) => {
    const projectAmount = Number(p.amount || 0);
    const projectCurrency = p.currency || "USD";
    const convertedAmount = convertCurrency(projectAmount, projectCurrency);
    totalValue += convertedAmount;

    // Handle both camelCase and snake_case field names
    const projectName = p.projectName || p.project_name || "Unnamed Project";
    const quantity =
      p.quantity || p.revisionQuantity || p.revision_quantity || "-";

    return {
      name: projectName,
      quantity: quantity,
      value: convertedAmount,
      currency: currency,
    };
  });

  // Color variables
  const { r: hdR, g: hdG, b: hdB } = hexToRgb(COLORS.primaryDark);
  const { r: wR, g: wG, b: wB } = hexToRgb(COLORS.white);
  const { r: pbR, g: pbG, b: pbB } = hexToRgb(COLORS.primaryBlue);
  const { r: lgR, g: lgG, b: lgB } = hexToRgb(COLORS.lightGray);
  const { r: dgR, g: dgG, b: dgB } = hexToRgb(COLORS.darkGray);
  const { r: mgR, g: mgG, b: mgB } = hexToRgb(COLORS.mediumGray);
  const { r: bgR, g: bgG, b: bgB } = hexToRgb(COLORS.borderGray);

  // Header - Nexvoide Logo
  doc.setFont("helvetica", "bold");
  doc.setTextColor(pbR, pbG, pbB); // Blue color for logo
  doc.setFontSize(28);
  doc.text("Nexvoide", margin, margin + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Invoice Statement", margin, margin + 36);

  // Invoice number badge top-right
  const invoiceNum = `INV-${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const badgeW = 150;
  const badgeH = 34;
  const badgeX = pageWidth - margin - badgeW;
  const badgeY = margin + 8;

  // Invoice # label
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(dgR, dgG, dgB);
  const labelWidth = doc.getTextWidth("Invoice #");
  doc.text("Invoice #", badgeX + badgeW - labelWidth, badgeY);

  // Invoice number in blue box
  doc.setFillColor(pbR, pbG, pbB);
  doc.roundedRect(badgeX, badgeY + 6, badgeW, badgeH - 6, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(wR, wG, wB);
  const numWidth = doc.getTextWidth(invoiceNum);
  doc.text(invoiceNum, badgeX + (badgeW - numWidth) / 2, badgeY + 23);

  // From/To panel with refined border
  const panelY = margin + 60;
  const panelH = 110;

  // Light border around panel (softer color)
  doc.setDrawColor(bgR, bgG, bgB);
  doc.setLineWidth(1.5);
  doc.roundedRect(margin, panelY, contentWidth, panelH, 10, 10, "S");

  // FROM section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(mgR, mgG, mgB);
  doc.text("FROM", margin + 26, panelY + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(hdR, hdG, hdB);
  doc.text("Nexvoide", margin + 26, panelY + 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Suite 101, Tech Park", margin + 26, panelY + 64);
  doc.text("Lahore, Punjab", margin + 26, panelY + 79);
  doc.text("Pakistan", margin + 26, panelY + 94);

  // TO section
  const toX = margin + contentWidth / 2 + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(mgR, mgG, mgB);
  doc.text("TO", toX, panelY + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(hdR, hdG, hdB);
  doc.text(String(entity.name || "Client"), toX, panelY + 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(dgR, dgG, dgB);
  if (entity.city) doc.text(entity.city, toX, panelY + 64);
  if (entity.country) doc.text(entity.country, toX, panelY + 79);

  // Info boxes (4 cards in a row) - matching invoice design
  const infoY = panelY + panelH + 28;
  const boxGap = 16;
  const boxW = (contentWidth - boxGap * 3) / 4;
  const boxH = 72;

  const labels = ["PAY PERIOD", "ISSUE DATE", "DUE DATE", "SERVICE"];
  const dueDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 15
  );
  const values = [
    monthName,
    now.toISOString().slice(0, 10),
    dueDate.toISOString().slice(0, 10),
    String(entity.service || "Video Editing"),
  ];

  for (let i = 0; i < 4; i++) {
    const x = margin + i * (boxW + boxGap);

    // Card border with background
    doc.setDrawColor(bgR, bgG, bgB);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(1.5);
    doc.roundedRect(x, infoY, boxW, boxH, 10, 10, "FD");

    // Label in uppercase blue
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(pbR, pbG, pbB);
    doc.text(labels[i], x + 16, infoY + 22);

    // Value in bold dark
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(hdR, hdG, hdB);
    const valueText = values[i] || "-";
    // Wrap text if too long
    const maxWidth = boxW - 32;
    const wrappedValue = doc.splitTextToSize(valueText, maxWidth);
    doc.text(wrappedValue, x + 16, infoY + 46);
  }

  // Table section with cleaner borders
  let yPos = infoY + boxH + 32;
  const rowHeight = 54;

  // Table columns: DESCRIPTION | RATE | QTY | AMOUNT
  const colDescW = Math.floor(contentWidth * 0.42);
  const colRateW = Math.floor(contentWidth * 0.22);
  const colQtyW = Math.floor(contentWidth * 0.14);
  const colAmountW = Math.floor(contentWidth * 0.22);

  // Table background (subtle)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(bgR, bgG, bgB);
  doc.setLineWidth(1.5);
  doc.roundedRect(margin, yPos - 4, contentWidth, rowHeight + 8, 10, 10, "S");

  // Table header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(mgR, mgG, mgB);
  doc.text("DESCRIPTION", margin + 16, yPos + 16);
  doc.text("RATE", margin + colDescW + 16, yPos + 16);
  doc.text("QTY", margin + colDescW + colRateW + 12, yPos + 16);
  doc.text("AMOUNT", margin + colDescW + colRateW + colQtyW + 12, yPos + 16);

  // Header border line (thinner)
  yPos += 24;
  doc.setDrawColor(bgR, bgG, bgB);
  doc.setLineWidth(1);
  doc.line(margin + 16, yPos, margin + contentWidth - 16, yPos);

  // Table rows
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  if (projectRows.length === 0) {
    doc.setTextColor(dgR, dgG, dgB);
    doc.text("No projects found for this month.", margin, yPos + 20);
    yPos += 40;
  } else {
    const nf = new Intl.NumberFormat("en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    projectRows.forEach((row, index) => {
      // Check for page break
      if (yPos > pageHeight - 200) {
        doc.addPage();
        yPos = margin + 20;

        // Redraw header on new page
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(dgR, dgG, dgB);
        doc.text("DESCRIPTION", margin, yPos);
        doc.text("RATE", margin + colDescW, yPos);
        doc.text("QTY", margin + colDescW + colRateW, yPos);
        doc.text("AMOUNT", margin + colDescW + colRateW + colQtyW, yPos);
        yPos += 20;
        doc.setDrawColor(lgR, lgG, lgB);
        doc.line(margin, yPos, margin + contentWidth, yPos);
        yPos += 8;
      }

      // Row content with better spacing
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(hdR, hdG, hdB);

      // Description
      const projectName = doc.splitTextToSize(row.name, colDescW - 32);
      doc.text(projectName, margin + 16, yPos + 18);

      // Rate (amount divided by quantity)
      const rate =
        row.quantity && row.quantity !== "-"
          ? row.value / Number(row.quantity)
          : row.value;
      const rateText = `$${nf.format(rate)}`;
      doc.text(rateText, margin + colDescW + 16, yPos + 18);

      // Quantity (center aligned in column)
      const qtyText = String(row.quantity);
      const qtyWidth = doc.getTextWidth(qtyText);
      doc.text(qtyText, margin + colDescW + colRateW + 12, yPos + 18);

      // Amount (right aligned)
      const amountText = `$${nf.format(row.value)}`;
      const amountWidth = doc.getTextWidth(amountText);
      doc.text(amountText, margin + contentWidth - 16 - amountWidth, yPos + 18);

      // Row separator line (softer)
      yPos += rowHeight;
      doc.setDrawColor(bgR, bgG, bgB);
      doc.setLineWidth(1);
      doc.line(margin + 16, yPos, margin + contentWidth - 16, yPos);
      yPos += 4;
    });
  }
  // Totals section
  yPos += 24;
  if (yPos > pageHeight - 150) {
    doc.addPage();
    yPos = margin + 40;
  }

  const totalsX = margin + contentWidth * 0.55;
  const totalLabelX = totalsX;
  const totalValueX = margin + contentWidth - 12;

  const nfTotal = new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Subtotal", totalLabelX, yPos + 20);

  const subtotalText = `$${nfTotal.format(totalValue)}`;
  doc.setTextColor(hdR, hdG, hdB);
  const subtotalWidth = doc.getTextWidth(subtotalText);
  doc.text(subtotalText, totalValueX - subtotalWidth, yPos + 20);

  // Tax
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Tax", totalLabelX, yPos + 42);

  const taxText = "$0.00";
  doc.setTextColor(hdR, hdG, hdB);
  const taxWidth = doc.getTextWidth(taxText);
  doc.text(taxText, totalValueX - taxWidth, yPos + 42);

  // Total Due badge
  yPos += 60;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Total Due", totalLabelX, yPos + 18);

  // Blue box for total
  const totalText = `$${nfTotal.format(totalValue)}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const totalTextWidth = doc.getTextWidth(totalText);
  const boxPadding = 20;
  const boxWidth = totalTextWidth + boxPadding * 2;
  const boxHeight = 38;
  const boxX = totalValueX - totalTextWidth - boxPadding;

  doc.setFillColor(pbR, pbG, pbB);
  doc.roundedRect(boxX, yPos, boxWidth, boxHeight, 6, 6, "F");

  doc.setTextColor(wR, wG, wB);
  doc.text(totalText, boxX + boxPadding, yPos + 25);

  yPos += boxHeight + 20;

  // Footer section - two columns like invoice
  const footerY = pageHeight - 100;
  const footerMidX = pageWidth / 2;

  // Left column - Payment Methods
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(hdR, hdG, hdB);
  doc.text("PAYMENT METHODS", margin, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Payoneer - Binance - Remitly - WireTransfer", margin, footerY + 18);

  // Right column - Terms & Conditions
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(hdR, hdG, hdB);
  doc.text("TERMS & CONDITIONS", footerMidX, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text(
    "No transaction fees or taxes apply on Nexvoide.",
    footerMidX,
    footerY + 18
  );

  // Center aligned contact info at bottom
  const contactY = pageHeight - 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(mgR, mgG, mgB);

  const thankYouText = "Thank you for your business!";
  const thankYouWidth = doc.getTextWidth(thankYouText);
  doc.text(thankYouText, (pageWidth - thankYouWidth) / 2, contactY);

  const contactText = "+92 336 455 8535 | support@nexvoide.com";
  const contactWidth = doc.getTextWidth(contactText);
  doc.text(contactText, (pageWidth - contactWidth) / 2, contactY + 16);

  // Generate filename (sanitize entity name for filename)
  const sanitizedName = (entity.name || "Invoice")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
  const filename = `${sanitizedName}_${currentMonth}_invoice.pdf`;

  // Save PDF
  doc.save(filename);

  return {
    projectCount: projectRows.length,
    totalValue,
    currency,
  };
}

/**
 * Generate a Salary PDF for a single employee for the current month.
 * Lists: Project Name, Quantity, Employee Cost, and totals.
 */
export function generateSalaryPDF(
  employee,
  projects,
  currency = "PKR",
  rate = 280
) {
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;
  const contentWidth = pageWidth - margin * 2;

  // Matching invoice color scheme
  const COLORS = {
    primaryDark: "#1e293b",
    primaryBlue: "#3b82f6",
    lightGray: "#e2e8f0",
    mediumGray: "#94a3b8",
    darkGray: "#64748b",
    white: "#FFFFFF",
    black: "#0f172a",
    borderGray: "#e5e7eb",
  };
  const hexToRgb = (h) => {
    h = h.replace("#", "");
    const b = parseInt(h, 16);
    if (h.length === 6) {
      return { r: (b >> 16) & 255, g: (b >> 8) & 255, b: b & 255 };
    }
    return { r: 0, g: 0, b: 0 };
  };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const monthName = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  // Convert helper
  const convertCurrency = (amount, fromCurrency) => {
    const n = Number(amount) || 0;
    if (fromCurrency === currency) return n;
    if (fromCurrency === "USD" && currency === "PKR") return n * rate;
    if (fromCurrency === "PKR" && currency === "USD") return n / rate;
    return n;
  };

  // Filter projects in current month where employee is assigned
  const inMonth = (p) => {
    const d = p.endDate || p.end_date || p.startDate || p.start_date;
    if (!d) return false;
    const dt = new Date(d);
    if (isNaN(dt)) return false;
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    return ym === currentMonth;
  };

  // Normalize assigned field
  const ensureAssigned = (assigned) => {
    if (Array.isArray(assigned)) return assigned;
    if (typeof assigned === "string") {
      try {
        const a = JSON.parse(assigned);
        return Array.isArray(a) ? a : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Build rows where this employee appears
  const rows = [];
  for (const p of projects.filter(inMonth)) {
    const assigned = ensureAssigned(p.assigned);
    const found = assigned.find((a) => a?.name === employee.name);
    if (!found) continue;
    // Compute employee cost for this project in display currency
    const orderDisplay = convertCurrency(p.amount || 0, p.currency || "USD");
    let empCost = 0;
    if (found.costType === "percentage") {
      empCost = orderDisplay * ((Number(found.costValue) || 0) / 100);
    } else {
      // fixed in PKR originally
      empCost = convertCurrency(found.costValue || 0, "PKR");
    }
    const quantity =
      (p.isRevision ? p.revisionQuantity || p.revision_quantity : p.quantity) ||
      "-";
    const projectName = p.projectName || p.project_name || "Unnamed Project";
    rows.push({ name: projectName, quantity, cost: empCost });
  }

  // Color variables
  const { r: hdR, g: hdG, b: hdB } = hexToRgb(COLORS.primaryDark);
  const { r: wR, g: wG, b: wB } = hexToRgb(COLORS.white);
  const { r: pbR, g: pbG, b: pbB } = hexToRgb(COLORS.primaryBlue);
  const { r: lgR, g: lgG, b: lgB } = hexToRgb(COLORS.lightGray);
  const { r: dgR, g: dgG, b: dgB } = hexToRgb(COLORS.darkGray);
  const { r: mgR, g: mgG, b: mgB } = hexToRgb(COLORS.mediumGray);
  const { r: bgR, g: bgG, b: bgB } = hexToRgb(COLORS.borderGray);

  // Header - Nexvoide Logo (matching invoice)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(pbR, pbG, pbB);
  doc.setFontSize(28);
  doc.text("Nexvoide", margin, margin + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Salary Statement", margin, margin + 36);

  // Salary slip number badge top-right
  const salaryNum = `SAL-${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const badgeW = 150;
  const badgeH = 34;
  const badgeX = pageWidth - margin - badgeW;
  const badgeY = margin + 8;

  // Salary # label
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(dgR, dgG, dgB);
  const labelWidth = doc.getTextWidth("Salary #");
  doc.text("Salary #", badgeX + badgeW - labelWidth, badgeY);

  // Salary number in blue box
  doc.setFillColor(pbR, pbG, pbB);
  doc.roundedRect(badgeX, badgeY + 6, badgeW, badgeH - 6, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(wR, wG, wB);
  const numWidth = doc.getTextWidth(salaryNum);
  doc.text(salaryNum, badgeX + (badgeW - numWidth) / 2, badgeY + 23);

  // FROM/TO panel (Company/Employee info)
  const panelY = margin + 60;
  const panelH = 110;

  // Light border around panel
  doc.setDrawColor(bgR, bgG, bgB);
  doc.setLineWidth(1.5);
  doc.roundedRect(margin, panelY, contentWidth, panelH, 10, 10, "S");

  // FROM section (Company)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(mgR, mgG, mgB);
  doc.text("FROM", margin + 26, panelY + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(hdR, hdG, hdB);
  doc.text("Nexvoide", margin + 26, panelY + 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Suite 101, Tech Park", margin + 26, panelY + 64);
  doc.text("Lahore, Punjab", margin + 26, panelY + 79);
  doc.text("Pakistan", margin + 26, panelY + 94);

  // TO section (Employee)
  const toX = margin + contentWidth / 2 + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(mgR, mgG, mgB);
  doc.text("TO", toX, panelY + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(hdR, hdG, hdB);
  doc.text(String(employee.name || "Employee"), toX, panelY + 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(dgR, dgG, dgB);
  if (employee.role) doc.text(employee.role, toX, panelY + 64);
  if (employee.email) doc.text(employee.email, toX, panelY + 79);

  // Info boxes (3 cards in a row)
  const infoY = panelY + panelH + 28;
  const boxGap = 16;
  const boxW = (contentWidth - boxGap * 2) / 3;
  const boxH = 72;

  const dueDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 15
  );

  const labels = ["PAY PERIOD", "ISSUE DATE", "DUE DATE"];
  const values = [
    monthName,
    now.toISOString().slice(0, 10),
    dueDate.toISOString().slice(0, 10),
  ];

  for (let i = 0; i < 3; i++) {
    const x = margin + i * (boxW + boxGap);

    // Card border with background
    doc.setDrawColor(bgR, bgG, bgB);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(1.5);
    doc.roundedRect(x, infoY, boxW, boxH, 10, 10, "FD");

    // Label in uppercase blue
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(pbR, pbG, pbB);
    doc.text(labels[i], x + 16, infoY + 22);

    // Value in bold dark
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(hdR, hdG, hdB);
    const valueText = values[i] || "-";
    const maxWidth = boxW - 32;
    const wrappedValue = doc.splitTextToSize(valueText, maxWidth);
    doc.text(wrappedValue, x + 16, infoY + 46);
  }

  // Table section (matching invoice style)
  let yPos = infoY + boxH + 32;
  const rowHeight = 54;
  const colNameW = Math.floor(contentWidth * 0.5);
  const colQtyW = Math.floor(contentWidth * 0.2);
  const colCostW = Math.floor(contentWidth * 0.3);

  // Table background border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(bgR, bgG, bgB);
  doc.setLineWidth(1.5);
  doc.roundedRect(margin, yPos - 4, contentWidth, rowHeight + 8, 10, 10, "S");

  // Table header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(mgR, mgG, mgB);
  doc.text("DESCRIPTION", margin + 16, yPos + 16);
  doc.text("QTY", margin + colNameW + 16, yPos + 16);
  doc.text(`AMOUNT (${currency})`, margin + colNameW + colQtyW + 16, yPos + 16);

  // Header border line
  yPos += 24;
  doc.setDrawColor(bgR, bgG, bgB);
  doc.setLineWidth(1);
  doc.line(margin + 16, yPos, margin + contentWidth - 16, yPos);

  // Table rows
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  let totalCost = 0;
  const nf = new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (rows.length === 0) {
    doc.setTextColor(dgR, dgG, dgB);
    doc.text("No projects found for this month.", margin + 16, yPos + 20);
    yPos += 40;
  } else {
    rows.forEach((r, i) => {
      // Check for page break
      if (yPos > pageHeight - 200) {
        doc.addPage();
        yPos = margin + 20;

        // Redraw header on new page
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(mgR, mgG, mgB);
        doc.text("DESCRIPTION", margin + 16, yPos);
        doc.text("QTY", margin + colNameW + 16, yPos);
        doc.text(
          `AMOUNT (${currency})`,
          margin + colNameW + colQtyW + 16,
          yPos
        );
        yPos += 24;
        doc.setDrawColor(bgR, bgG, bgB);
        doc.line(margin + 16, yPos, margin + contentWidth - 16, yPos);
        yPos += 8;
      }

      // Row content
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(hdR, hdG, hdB);

      // Description
      const projectName = doc.splitTextToSize(
        String(r.name || ""),
        colNameW - 32
      );
      doc.text(projectName, margin + 16, yPos + 18);

      // Quantity
      const qtyText = String(r.quantity ?? "-");
      doc.text(qtyText, margin + colNameW + 16, yPos + 18);

      // Amount (right aligned in column)
      const costText = `${nf.format(r.cost)}`;
      const costWidth = doc.getTextWidth(costText);
      doc.text(costText, margin + contentWidth - 16 - costWidth, yPos + 18);

      totalCost += Number(r.cost) || 0;

      // Row separator line
      yPos += rowHeight;
      doc.setDrawColor(bgR, bgG, bgB);
      doc.setLineWidth(1);
      doc.line(margin + 16, yPos, margin + contentWidth - 16, yPos);
      yPos += 4;
    });
  }

  // Totals section (matching invoice)
  yPos += 24;
  if (yPos > pageHeight - 150) {
    doc.addPage();
    yPos = margin + 40;
  }

  const totalsX = margin + contentWidth * 0.55;
  const totalLabelX = totalsX;
  const totalValueX = margin + contentWidth - 12;

  // Total Salary label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text("Total Salary", totalLabelX, yPos + 18);

  // Blue box for total
  const totalText = `${nf.format(totalCost)} ${currency}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const totalTextWidth = doc.getTextWidth(totalText);
  const boxPadding = 20;
  const boxWidth = totalTextWidth + boxPadding * 2;
  const boxHeight = 38;
  const boxX = totalValueX - totalTextWidth - boxPadding;

  doc.setFillColor(pbR, pbG, pbB);
  doc.roundedRect(boxX, yPos, boxWidth, boxHeight, 6, 6, "F");

  doc.setTextColor(wR, wG, wB);
  doc.text(totalText, boxX + boxPadding, yPos + 25);

  yPos += boxHeight + 20;

  // Footer section (matching invoice)
  const footerY = pageHeight - 100;
  const footerMidX = pageWidth / 2;

  // Left column - Payment Info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(hdR, hdG, hdB);
  doc.text("PAYMENT INFO", margin, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text(
    "Salary will be disbursed as per company policy",
    margin,
    footerY + 18
  );

  // Right column - Terms & Conditions
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(hdR, hdG, hdB);
  doc.text("TERMS & CONDITIONS", footerMidX, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(dgR, dgG, dgB);
  doc.text(
    "This is an auto-generated salary statement",
    footerMidX,
    footerY + 18
  );

  // Center aligned contact info at bottom
  const contactY = pageHeight - 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(mgR, mgG, mgB);

  const thankYouText = "Thank you for your dedication!";
  const thankYouWidth = doc.getTextWidth(thankYouText);
  doc.text(thankYouText, (pageWidth - thankYouWidth) / 2, contactY);

  const contactText = "+92 336 455 8535 | support@nexvoide.com";
  const contactWidth = doc.getTextWidth(contactText);
  doc.text(contactText, (pageWidth - contactWidth) / 2, contactY + 16);

  // Generate filename
  const file = `${(employee.name || "employee")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()}_${currentMonth}_salary.pdf`;
  doc.save(file);
  return { rows: rows.length, totalCost, currency };
}

// =============== Simple HTML-based generators ==================

function openHtmlDocument(html) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give time to render then trigger print (user can select Save as PDF)
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch (_) {}
  }, 400);
}

function currencyFormat(n, currency) {
  try {
    return (
      new Intl.NumberFormat("en", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(n) || 0) +
      " " +
      currency
    );
  } catch {
    return String(n) + " " + currency;
  }
}

export function generateInvoiceHTML(
  entity,
  projects,
  entityType,
  currency = "PKR",
  rate = 280
) {
  const now = new Date();
  const monthName = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const inMonth = (p) => {
    const d = p.endDate || p.end_date || p.startDate || p.start_date;
    if (!d) return false;
    const dt = new Date(d);
    if (isNaN(dt)) return false;
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    return ym === thisYm;
  };
  const convert = (amt, from) => {
    const n = Number(amt) || 0;
    if (from === currency) return n;
    if (from === "USD" && currency === "PKR") return n * rate;
    if (from === "PKR" && currency === "USD") return n / rate;
    return n;
  };
  const agencyId = entity.id;
  const rows = [];
  let total = 0;
  projects.filter(inMonth).forEach((p) => {
    const match =
      entityType === "agency"
        ? p.agencyId === agencyId || p.agency_id === agencyId
        : p.brandId === agencyId || p.brand_id === agencyId;
    if (!match) return;
    const name = p.projectName || p.project_name || "Unnamed Project";
    const qty = p.quantity || p.revisionQuantity || p.revision_quantity || "-";
    const amount = convert(p.amount || 0, p.currency || "USD");
    total += amount;
    rows.push({ name, qty, amount });
  });
  const itemsHtml = rows
    .map(
      (r) => `
      <tr>
        <td class="desc">${r.name}</td>
        <td class="qty">${r.qty}</td>
        <td class="amt">${currencyFormat(r.amount, currency)}</td>
      </tr>
  `
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <title>Invoice</title>
  <style>
    :root{ --blue:#2642FF; --dark:#001033; --muted:#8A93A6; --line:#e9edf5; }
    *{ box-sizing:border-box; }
    body{ font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Helvetica,Arial; margin:24px; color:#111827; }
    .card{ border:1px solid var(--line); border-radius:12px; padding:14px 16px; background:#fff; }
    .row{ display:flex; gap:16px; }
    .col{ flex:1; }
    .muted{ color:var(--muted); font-weight:600; font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
    h1{ margin:0 0 6px; font-size:26px; }
    table{ width:100%; border-collapse:separate; border-spacing:0; }
    thead th{ text-align:left; color:var(--muted); font-size:12px; padding:12px 14px; background:#f8fafc; }
    tbody td{ padding:12px 14px; border-top:1px solid var(--line); font-size:13px; }
    .desc{ width:60%; }
    .qty{ width:15%; }
    .amt{ width:25%; text-align:right; }
    .badge{ background:#eef2ff; border-radius:10px; display:inline-block; padding:6px 10px; color:#fff; }
    .btn{ background:var(--blue); color:#fff; padding:10px 14px; border-radius:10px; display:inline-block; font-weight:700; }
    .total{ text-align:right; font-weight:700; }
  </style></head><body>
    <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:18px;">
      <div>
        <h1>Nexvoide</h1>
        <div class="muted">Invoice Statement</div>
      </div>
      <div class="card" style="min-width:220px; text-align:center;">
        <div class="muted" style="margin-bottom:6px;">Invoice #</div>
        <div class="btn">INV-${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="row">
        <div class="col">
          <div class="muted">From</div>
          <div style="font-weight:700; margin:6px 0;">Nexvoide</div>
          <div>Suite 101, Tech Park</div><div>Lahore, Punjab</div><div>Pakistan</div>
        </div>
        <div class="col">
          <div class="muted">To</div>
          <div style="font-weight:700; margin:6px 0;">${entity.name || ""}</div>
          ${entity.street ? `<div>${entity.street}</div>` : ""}
          ${
            entity.city || entity.state || entity.zip
              ? `<div>${[entity.city, entity.state, entity.zip]
                  .filter(Boolean)
                  .join(", ")}</div>`
              : ""
          }
          ${entity.country ? `<div>${entity.country}</div>` : ""}
        </div>
      </div>
      <div class="row" style="margin-top:12px;">
        <div class="card col"><div class="muted">Pay Period</div><div style="font-weight:700; font-size:16px; margin-top:6px;">${monthName}</div></div>
        <div class="card col"><div class="muted">Issue Date</div><div style="font-weight:700; font-size:16px; margin-top:6px;">${now
          .toISOString()
          .slice(0, 10)}</div></div>
        <div class="card col"><div class="muted">Due Date</div><div style="font-weight:700; font-size:16px; margin-top:6px;">${new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 15
        )
          .toISOString()
          .slice(0, 10)}</div></div>
        <div class="card col"><div class="muted">Service</div><div style="font-weight:700; font-size:16px; margin-top:6px;">${
          entity.service || ""
        }</div></div>
      </div>
    </div>

    <table>
      <thead><tr><th class="desc">Description</th><th class="qty">Qty</th><th class="amt">Amount</th></tr></thead>
      <tbody>${
        itemsHtml ||
        '<tr><td colspan="3" style="text-align:center; padding:24px; color:#94a3b8;">No items this month</td></tr>'
      }</tbody>
    </table>

    <div class="card" style="margin-top:18px;">
      <div class="row" style="align-items:center;">
        <div class="col"></div>
        <div class="col" style="text-align:right;">
          <div style="margin-bottom:8px; color:#64748b;">Subtotal</div>
          <div class="total" style="margin-bottom:8px;">${currencyFormat(
            total,
            currency
          )}</div>
          <div style="margin-top:10px;"><span class="btn">${currencyFormat(
            total,
            currency
          )}</span></div>
        </div>
      </div>
    </div>

    <div style="display:flex; gap:24px; margin-top:22px; color:#64748b;">
      <div style="flex:1;">
        <div class="muted">Payment Methods</div>
        <div style="margin-top:6px;">Payoneer · Binance · Remitly · WireTransfer</div>
      </div>
      <div style="flex:1;">
        <div class="muted">Terms & Conditions</div>
        <div style="margin-top:6px;">No transaction fees or taxes apply on Nexvoide.</div>
      </div>
    </div>
  </body></html>`;
  openHtmlDocument(html);
}

export function generateSalaryHTML(
  employee,
  projects,
  currency = "PKR",
  rate = 280
) {
  const now = new Date();
  const monthName = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const inMonth = (p) => {
    const d = p.endDate || p.end_date || p.startDate || p.start_date;
    if (!d) return false;
    const dt = new Date(d);
    if (isNaN(dt)) return false;
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    return ym === thisYm;
  };
  const convert = (amt, from) => {
    const n = Number(amt) || 0;
    if (from === currency) return n;
    if (from === "USD" && currency === "PKR") return n * rate;
    if (from === "PKR" && currency === "USD") return n / rate;
    return n;
  };
  const ensureAssigned = (assigned) =>
    Array.isArray(assigned)
      ? assigned
      : typeof assigned === "string"
      ? (() => {
          try {
            const a = JSON.parse(assigned);
            return Array.isArray(a) ? a : [];
          } catch {
            return [];
          }
        })()
      : [];
  const rows = [];
  let total = 0;
  projects.filter(inMonth).forEach((p) => {
    const assigned = ensureAssigned(p.assigned);
    const found = assigned.find((a) => a?.name === employee.name);
    if (!found) return;
    const orderDisplay = convert(p.amount || 0, p.currency || "USD");
    const cost =
      found.costType === "percentage"
        ? orderDisplay * ((Number(found.costValue) || 0) / 100)
        : convert(found.costValue || 0, "PKR");
    const qty =
      (p.isRevision ? p.revisionQuantity || p.revision_quantity : p.quantity) ||
      "-";
    const name = p.projectName || p.project_name || "Unnamed Project";
    total += cost;
    rows.push({ name, qty, cost });
  });
  const itemsHtml = rows
    .map(
      (r) => `
      <tr>
        <td class="desc">${r.name}</td>
        <td class="qty">${r.qty}</td>
        <td class="amt">${currencyFormat(r.cost, currency)}</td>
      </tr>
  `
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <title>Salary</title>
  <style>
    :root{ --blue:#2642FF; --dark:#001033; --muted:#8A93A6; --line:#e9edf5; }
    *{ box-sizing:border-box; }
    body{ font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Helvetica,Arial; margin:24px; color:#111827; }
    .card{ border:1px solid var(--line); border-radius:12px; padding:14px 16px; background:#fff; }
    .row{ display:flex; gap:16px; }
    .col{ flex:1; }
    .muted{ color:var(--muted); font-weight:600; font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
    h1{ margin:0 0 6px; font-size:26px; }
    table{ width:100%; border-collapse:separate; border-spacing:0; }
    thead th{ text-align:left; color:var(--muted); font-size:12px; padding:12px 14px; background:#f8fafc; }
    tbody td{ padding:12px 14px; border-top:1px solid var(--line); font-size:13px; }
    .desc{ width:60%; }
    .qty{ width:15%; }
    .amt{ width:25%; text-align:right; }
    .btn{ background:var(--blue); color:#fff; padding:10px 14px; border-radius:10px; display:inline-block; font-weight:700; }
    .total{ text-align:right; font-weight:700; }
  </style></head><body>
    <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:18px;">
      <div>
        <h1>Nexvoide</h1>
        <div class="muted">Salary Statement</div>
      </div>
      <div class="card" style="min-width:220px; text-align:center;">
        <div class="muted" style="margin-bottom:6px;">Period</div>
        <div class="btn">${monthName}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="row">
        <div class="col">
          <div class="muted">Employee</div>
          <div style="font-weight:700; margin:6px 0;">${
            employee.name || ""
          }</div>
          <div>${employee.role || ""}</div>
        </div>
        <div class="col">
          <div class="muted">Currency</div>
          <div style="font-weight:700; margin:6px 0;">${currency}</div>
          <div class="muted">Rate</div>
          <div>${rate}</div>
        </div>
      </div>
    </div>

    <table>
      <thead><tr><th class="desc">Description</th><th class="qty">Qty</th><th class="amt">Employee Cost</th></tr></thead>
      <tbody>${
        itemsHtml ||
        '<tr><td colspan="3" style="text-align:center; padding:24px; color:#94a3b8;">No items this month</td></tr>'
      }</tbody>
    </table>

    <div class="card" style="margin-top:18px;">
      <div class="row" style="align-items:center;">
        <div class="col"></div>
        <div class="col" style="text-align:right;">
          <div style="margin-bottom:8px; color:#64748b;">Total Salary</div>
          <div class="total" style="margin-bottom:8px;">${currencyFormat(
            total,
            currency
          )}</div>
          <div style="margin-top:10px;"><span class="btn">${currencyFormat(
            total,
            currency
          )}</span></div>
        </div>
      </div>
    </div>
  </body></html>`;
  openHtmlDocument(html);
}
