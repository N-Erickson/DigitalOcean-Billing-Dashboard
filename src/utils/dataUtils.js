// Format currency helper
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

// Filter invoices by time range
export const filterInvoicesByTimeRange = (invoices, selectedRange) => {
  if (!invoices || invoices.length === 0) return [];
  
  const mostRecentInvoice = invoices.reduce((latest, current) => {
    const currentDate = new Date(current.invoice_period || current.created_at || 0);
    const latestDate = new Date(latest.invoice_period || latest.created_at || 0);
    return currentDate > latestDate ? current : latest;
  }, invoices[0]);
  
  const mostRecentDate = mostRecentInvoice 
    ? new Date(mostRecentInvoice.invoice_period || mostRecentInvoice.created_at) 
    : new Date();
  
  const filterDate = new Date();
  
  switch (selectedRange) {
    case '1month':
      return invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoice_period || invoice.created_at || 0);
        return invoiceDate.getFullYear() === mostRecentDate.getFullYear() && 
               invoiceDate.getMonth() === mostRecentDate.getMonth();
      });
    case '3months':
      filterDate.setMonth(filterDate.getMonth() - 4);
      break;
    case '6months':
      filterDate.setMonth(filterDate.getMonth() - 7);
      break;
    case '12months':
      filterDate.setMonth(filterDate.getMonth() - 13);
      break;
    case 'all':
      filterDate.setFullYear(2000);
      break;
    default:
      filterDate.setMonth(filterDate.getMonth() - 6);
  }
  
  if (selectedRange !== '1month') {
    return invoices.filter(invoice => {
      const dateToCheck = new Date(invoice.invoice_period || invoice.created_at || 0);
      return !isNaN(dateToCheck.getTime()) && dateToCheck >= filterDate;
    });
  }
  
  return [];
};

// Helper function to extract proper project name from item
const extractProjectName = (item) => {
  // First, check for explicit project fields
  if (item.project_name && typeof item.project_name === 'string' && item.project_name.trim() !== '') {
    return item.project_name.trim();
  }
  
  // Check for resource ID
  if (item.resource_id && typeof item.resource_id === 'string') {
    return item.resource_id;
  }
  
  // Check resource name
  if (item.resource_name && typeof item.resource_name === 'string' && item.resource_name.trim() !== '') {
    return item.resource_name.trim();
  }
  
  // If we have reached here, we have no project info
  return 'Unassigned';
};

// Process project data from detailed line items
export const processProjectData = (detailedLineItems, selectedRange, invoices) => {
  if (!detailedLineItems || detailedLineItems.length === 0) {
    return { 'Unassigned': 0 };
  }
  
  console.log("Processing project data from detailed line items");
  
  // Filter invoices by time range
  const filteredInvoices = filterInvoicesByTimeRange(invoices, selectedRange);
  console.log("Filtered invoices count for projects:", filteredInvoices.length);
  
  // Get set of invoice UUIDs for the selected time range
  const invoiceIds = new Set(filteredInvoices.map(invoice => invoice.invoice_uuid));
  
  // Process line items to get project spending
  const projectSpend = {};
  let totalProjectAmount = 0;
  
  // Process each invoice item with project information
  detailedLineItems.forEach(item => {
    // Only process items from the filtered invoices
    if (!item.invoice_uuid || !invoiceIds.has(item.invoice_uuid)) {
      return;
    }
    
    const amount = parseFloat(item.amount) || 0;
    
    // Extract project name, use "Unassigned" if not present
    const project = item.project_name || 'Unassigned';
    
    // Add to project spending
    projectSpend[project] = (projectSpend[project] || 0) + amount;
    totalProjectAmount += amount;
  });
  
  console.log("Project spend data from detailed items:", projectSpend);
  console.log("Total amount across all projects:", totalProjectAmount);
  
  // If no project data was found, add a placeholder
  if (Object.keys(projectSpend).length === 0) {
    projectSpend['No Project Data'] = 0;
  }
  
  return projectSpend;
};

// Enhanced helper function to process detailed line items by category
export const processDetailedLineItems = (detailedLineItems, selectedRange, invoices) => {
  if (!detailedLineItems || detailedLineItems.length === 0) {
    return {};
  }
  
  // Filter invoices by time range
  const filteredInvoices = filterInvoicesByTimeRange(invoices, selectedRange);
  
  // Get set of invoice UUIDs for the selected time range
  const invoiceIds = new Set(filteredInvoices.map(invoice => invoice.invoice_uuid));
  
  // Filter detailed line items by invoice IDs
  const filteredLineItems = detailedLineItems.filter(item => 
    item.invoice_uuid && invoiceIds.has(item.invoice_uuid)
  );
  
  // Group items by category
  const categorizedItems = {};
  
  filteredLineItems.forEach(item => {
    // Determine the category
    const category = item.name || 
                    item.group_description || 
                    item.description || 
                    'Unknown';
    
    // Initialize the category array if needed
    if (!categorizedItems[category]) {
      categorizedItems[category] = [];
    }
    
    // Add the item to the category
    categorizedItems[category].push(item);
  });
  
  return categorizedItems;
};

// Helper function to get detailed data for a specific category
export const getCategoryDetails = (detailedLineItems, category, selectedRange, invoices) => {
  if (!category || !detailedLineItems || detailedLineItems.length === 0) {
    return [];
  }
  
  // Filter invoices by time range
  const filteredInvoices = filterInvoicesByTimeRange(invoices, selectedRange);
  
  // Get set of invoice UUIDs for the selected time range
  const invoiceIds = new Set(filteredInvoices.map(invoice => invoice.invoice_uuid));
  
  // Filter detailed line items by invoice IDs and category
  return detailedLineItems.filter(item => {
    if (!item.invoice_uuid || !invoiceIds.has(item.invoice_uuid)) {
      return false;
    }
    
    // Determine the item's category
    const itemCategory = item.name || 
                        item.group_description || 
                        item.description || 
                        'Unknown';
    
    return itemCategory === category;
  });
};

// Helper function to get distinct categories from detailed line items
export const getDistinctCategories = (detailedLineItems) => {
  if (!detailedLineItems || detailedLineItems.length === 0) {
    return [];
  }
  
  const categories = new Set();
  
  detailedLineItems.forEach(item => {
    const category = item.name || 
                    item.group_description || 
                    item.description || 
                    'Unknown';
    
    categories.add(category);
  });
  
  return Array.from(categories);
};

// Main data processing function
export const processData = (invoices, invoiceSummaries, selectedRange) => {
  console.log("Processing data with time range:", selectedRange);
  
  const monthlySpend = {};
  const categorySpend = {};
  const projectSpend = {};
  const productSpend = {};
  let totalAmount = 0;
  let totalItems = 0;
  
  // Filter invoices by time range
  const filteredInvoices = filterInvoicesByTimeRange(invoices, selectedRange);
  console.log("Filtered invoices count:", filteredInvoices.length);
  
  // Filter summaries by matched invoice IDs
  const invoiceIds = new Set(filteredInvoices.map(invoice => invoice.invoice_uuid));
  const filteredSummaries = invoiceSummaries.filter(summary => invoiceIds.has(summary.invoice_uuid));
  console.log("Filtered summaries count:", filteredSummaries.length);
  
  console.log("Starting to process filtered summaries");
  
  // Process invoice summaries
  filteredSummaries.forEach(summary => {
    // Process product charges items
    const productItems = (summary.product_charges && summary.product_charges.items) || [];
    totalItems += productItems.length;
    
    productItems.forEach(item => {
      const category = item.name || item.group_description || item.description || 'Unknown';
      const project = extractProjectName(item);
      const product = item.name || item.product || item.type || 'Unknown';
      const amount = parseFloat(item.amount) || 0;
      
      categorySpend[category] = (categorySpend[category] || 0) + amount;
      projectSpend[project] = (projectSpend[project] || 0) + amount;
      productSpend[product] = (productSpend[product] || 0) + amount;
    });
    
    // Process overages items
    const overageItems = (summary.overages && summary.overages.items) || [];
    totalItems += overageItems.length;
    
    overageItems.forEach(item => {
      const category = item.name || item.group_description || item.description || 'Overages';
      const project = extractProjectName(item);
      const product = item.name || item.product || item.type || 'Overages';
      const amount = parseFloat(item.amount) || 0;
      
      categorySpend[category] = (categorySpend[category] || 0) + amount;
      projectSpend[project] = (projectSpend[project] || 0) + amount;
      productSpend[product] = (productSpend[product] || 0) + amount;
    });
  });
  
  // Process invoice totals for monthly trend
  filteredInvoices.forEach(invoice => {
    const amount = parseFloat(invoice.amount) || 0;
    totalAmount += amount;
    const month = invoice.invoice_period || 'Unknown';
    monthlySpend[month] = (monthlySpend[month] || 0) + amount;
  });
  
  // Sort monthly spend by date
  const sortedMonths = Object.keys(monthlySpend).sort();
  const monthlyLabels = sortedMonths;
  const monthlyValues = sortedMonths.map(month => monthlySpend[month]);
  
  // Calculate trend (last 2 invoices)
  const sortedInvoices = [...invoices].sort((a, b) => {
    const dateA = new Date(a.created_at || a.invoice_period || 0);
    const dateB = new Date(b.created_at || b.invoice_period || 0);
    return dateB - dateA;
  });
  
  let trendText = 'N/A';
  if (sortedInvoices.length >= 2) {
    const lastSpend = parseFloat(sortedInvoices[0].amount) || 0;
    const prevSpend = parseFloat(sortedInvoices[1].amount) || 0;
    if (prevSpend > 0) {
      const change = lastSpend - prevSpend;
      const percentChange = (change / prevSpend) * 100;
      trendText = change >= 0 ? `Up ${percentChange.toFixed(1)}%` : `Down ${Math.abs(percentChange).toFixed(1)}%`;
    } else {
      trendText = 'N/A (Previous spend was $0)';
    }
  }
  
  // Calculate forecast (linear trend from last 3 invoices)
  let forecastAmount = 0;
  let confidenceText = '';
  
  if (sortedInvoices.length >= 3) {
    const amounts = sortedInvoices.slice(0, 3).map(inv => parseFloat(inv.amount) || 0);
    const avgChange = (amounts[0] - amounts[2]) / 2; // Average change over 2 steps
    forecastAmount = amounts[0] + avgChange; // Project forward from latest
    if (forecastAmount < 0) forecastAmount = amounts[0]; // No negative forecasts
    
    const confidenceRange = Math.min(10, sortedInvoices.length * 2); // Simple confidence range
    confidenceText = `Based on ${sortedInvoices.length} invoices, ±${confidenceRange}%`;
  } else if (sortedInvoices.length > 0) {
    forecastAmount = parseFloat(sortedInvoices[0].amount) || 0; // Fallback to latest
    confidenceText = 'Based on 1 invoice, highly variable';
  }
  
  return {
    monthlyData: { labels: monthlyLabels, values: monthlyValues },
    categoryData: categorySpend,
    projectData: projectSpend,
    productData: productSpend,
    summary: {
      totalAmount,
      invoiceCount: filteredInvoices.length,
      totalItems,
      trendText,
      forecastAmount,
      confidenceText
    }
  };
};