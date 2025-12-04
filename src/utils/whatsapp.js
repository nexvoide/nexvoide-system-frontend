/**
 * Utility functions for sending WhatsApp messages
 */

/**
 * Format phone number for WhatsApp
 */
export function formatPhoneForWhatsApp(phone) {
    if (!phone) return null;
  
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
  
    // Add Pakistan country code if missing
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('0')) {
        cleaned = '92' + cleaned.substring(1);
      } else {
        cleaned = '92' + cleaned;
      }
    }
  
    // Remove + for wa.me format
    cleaned = cleaned.replace('+', '');
    return cleaned;
  }
  
  /**
   * Send WhatsApp message to employee
   * @param {string} phone - Employee phone number
   * @param {object} project - Project details
   * @param {string} employeeName - Employee name
   * @param {number} employeeCost - Employee cost in PKR
   */
  export function sendWhatsAppNotification(phone, project, employeeName, employeeCost = null) {
    if (!phone) {
      console.warn('❌ No phone number provided');
      return;
    }
  
    const formattedPhone = formatPhoneForWhatsApp(phone);
    if (!formattedPhone) {
      console.warn('❌ Could not format phone number:', phone);
      return;
    }
  
    const projectType = project.isRevision ? 'Revision Project' : 'New Project';
    const quantity = project.isRevision
      ? (project.revisionQuantity || project.quantity || 'N/A')
      : (project.quantity || 'N/A');
    const service = project.service || 'N/A';
    const projectName = project.projectName || 'Unnamed Project';
    // Parse deadline - handle Supabase TIMESTAMP (may not have timezone)
    let deadlineStr = project.deadline ? String(project.deadline).trim() : null;
    if (deadlineStr && deadlineStr.includes('T') && !deadlineStr.endsWith('Z') && !deadlineStr.match(/[+-]\d{2}:\d{2}$/)) {
      deadlineStr = deadlineStr + 'Z';
    }
    const deadline = deadlineStr
      ? new Date(deadlineStr).toLocaleString('en-US', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : 'Not specified';
    const rawSourceLink = project.rawSourceLink || project.raw_source_link || null;
    const attachments = project.attachments || [];
    const attachmentLinks = Array.isArray(attachments) && attachments.length > 0
      ? attachments.map(a => a.url || '').filter(Boolean).join('\n')
      : '';
  
    // Format employee cost
    const costDisplay = employeeCost !== null && employeeCost !== undefined 
      ? new Intl.NumberFormat('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(employeeCost) + ' PKR'
      : 'Not specified';
    
    // WhatsApp message WITH emojis (ASCII + emoji only)
    // Always add a newline after deadline, then conditionally add source link(s) and attachments
    let sourceLinkSection = '';
    if (rawSourceLink) {
      const links = String(rawSourceLink)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (links.length === 1) {
        sourceLinkSection = `\n🔗 *Source Link:* ${links[0]}`;
      } else if (links.length > 1) {
        const list = links.map((l) => `- ${l}`).join('\n');
        sourceLinkSection = `\n🔗 *Source Links:*\n${list}`;
      }
    }
    const attachmentsSection = attachmentLinks ? `\n📎 *Attachments:*\n${attachmentLinks}` : '';
    const customNotes = project.notes && String(project.notes).trim().length > 0
      ? String(project.notes).trim()
      : (project.isRevision
          ? 'Kindly prioritize this revision and ensure it matches the client\'s feedback.'
          : 'Please start as soon as possible and keep your progress updated in the dashboard.');
    const message = project.isRevision
      ? `*🔁 REVISION PROJECT ASSIGNED*\n\nHello *${employeeName}* 👋\n\nA project revision has been assigned to you. Please review the details below carefully:\n\n------------------------\n📋 *Project Name:* ${projectName}\n🛠️ *Service:* ${service}\n📦 *Revision Quantity:* ${quantity}\n💰 *Your Cost:* ${costDisplay}\n⏰ *Deadline:* ${deadline}${sourceLinkSection}${attachmentsSection}\n------------------------\n\n🧾 *Notes:*\n${customNotes}\n\nIf you have any questions, contact your project manager before starting.\n\nThanks for your effort, ${employeeName}! 🙌\n- *Nexvoide Management Team* 💼`
      : `*🟢 NEW PROJECT ASSIGNED*\n\nHello *${employeeName}* 👋\n\nYou've been assigned to a new project! Please review the details below carefully:\n\n------------------------\n📋 *Project Name:* ${projectName}\n🛠️ *Service:* ${service}\n📦 *Quantity:* ${quantity}\n💰 *Your Cost:* ${costDisplay}\n⏰ *Deadline:* ${deadline}${sourceLinkSection}${attachmentsSection}\n------------------------\n\n🧾 *Notes:*\n${customNotes}\n\nIf you have any questions, feel free to reach out to your project manager.\n\nThanks & good luck, ${employeeName}! 🚀\n- *Nexvoide Management Team* 💼`;
  
  // Properly encode the message for WhatsApp URL
  // encodeURIComponent correctly handles UTF-8 including emojis
  // However, WhatsApp Web sometimes has issues with emojis in URL parameters
  // We'll use encodeURIComponent which is the standard way to encode for URLs
  const encodedMessage = encodeURIComponent(message);
  
  // Build WhatsApp URL
  // Try using api.whatsapp.com which sometimes handles emojis better than wa.me
  // Both should work, but api.whatsapp.com might have better emoji support
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMessage}`;
  
  // Debug: Log to verify encoding
  console.log('📝 Message encoding check:');
  console.log('  - Original length:', message.length);
  console.log('  - Encoded length:', encodedMessage.length);
  console.log('  - First emoji in original:', message.substring(0, 2));
  console.log('  - First emoji encoded:', encodedMessage.substring(0, 20));
  console.log('  - Test decode:', decodeURIComponent(encodedMessage).substring(0, 10));
  
    console.log('✅ Opening WhatsApp for:', employeeName);
    console.log('📱 WhatsApp URL:', whatsappUrl);
    console.log('📞 Formatted phone:', formattedPhone);
  
    try {
      // Use anchor click method (bypasses popup blockers)
      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      // Clean up the link element after a short delay
      setTimeout(() => { 
        try { 
          document.body.removeChild(link); 
        } catch (e) {
          // Ignore if already removed
        }
      }, 100);
    } catch (error) {
      console.error('❌ Error opening WhatsApp with anchor method:', error);
      // Fallback: try window.open if anchor click fails
      try {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.error('❌ Failed to open WhatsApp with window.open:', e);
        // Last resort: try direct navigation (will navigate away from current page)
        try {
          window.location.href = whatsappUrl;
        } catch (finalError) {
          console.error('❌ All methods failed:', finalError);
          alert(`Could not open WhatsApp. Please manually send a message to ${employeeName} at ${formattedPhone}`);
        }
      }
    }
  }
  
  /**
   * Notify newly assigned employees
   * @param {array} newAssigned - Array of newly assigned employees (with name, costType, costValue)
   * @param {array} oldAssigned - Array of previously assigned employees
   * @param {object} project - Project details (with amount, currency, etc.)
   * @param {array} employees - Full list of employees from store
   * @param {number} rate - USD to PKR conversion rate (optional, defaults to 280)
   */
  export function notifyAssignedEmployees(newAssigned, oldAssigned, project, employees, rate = 280) {
    console.log('🔔 notifyAssignedEmployees called:', {
      newAssigned,
      oldAssigned,
      project: project?.projectName,
      employeesCount: employees?.length
    });

    if (!Array.isArray(newAssigned)) {
      console.warn('❌ newAssigned is not an array:', newAssigned);
      return;
    }
    
    if (!Array.isArray(employees)) {
      console.warn('❌ employees is not an array:', employees);
      return;
    }
  
    const oldNames = (oldAssigned || []).map(a => a.name).filter(Boolean);
    const newlyAssigned = newAssigned
      .filter(a => a.name && !oldNames.includes(a.name))
      .map(a => a.name);
  
    console.log('📋 Old names:', oldNames);
    console.log('📋 Newly assigned names:', newlyAssigned);
  
    if (newlyAssigned.length === 0) {
      console.log('ℹ️ No newly assigned employees to notify.');
      return;
    }
  
    newlyAssigned.forEach((employeeName, index) => {
      console.log(`🔍 Looking for employee: "${employeeName}"`);
      const employee = employees.find(
        e => {
          const empName = e.name || e.employee_name || '';
          const match = empName === employeeName;
          if (!match) {
            console.log(`  - Checking: "${empName}" !== "${employeeName}"`);
          }
          return match;
        }
      );

      if (employee) {
        console.log(`✅ Found employee:`, employee);
        const phone = employee.phone || employee.employee_phone;
        console.log(`📞 Phone number:`, phone);
        if (phone) {
          // Find the employee's cost from the assigned array
          const assignment = newAssigned.find(a => a.name === employeeName);
          let employeeCost = null;
          if (assignment) {
            if (assignment.costType === 'percentage') {
              // Calculate percentage of project amount
              const projectAmount = project.amount || 0;
              const projectCurrency = project.currency || 'USD';
              // Convert to PKR if needed
              const projectAmountPKR = projectCurrency === 'PKR' 
                ? projectAmount 
                : projectAmount * rate;
              employeeCost = projectAmountPKR * ((assignment.costValue || 0) / 100);
            } else {
              // Fixed cost in PKR
              employeeCost = assignment.costValue || 0;
            }
          }
          
          setTimeout(() => {
            console.log(`📱 Sending WhatsApp to ${employeeName} at ${phone} with cost: ${employeeCost}`);
            sendWhatsAppNotification(phone, project, employeeName, employeeCost);
          }, index * 800);
        } else {
          console.warn(`⚠️ No phone number found for ${employeeName}. Employee data:`, employee);
        }
      } else {
        console.warn(`⚠️ Employee not found: "${employeeName}"`);
        console.log('Available employees:', employees.map(e => e.name || e.employee_name));
      }
    });
  }
  