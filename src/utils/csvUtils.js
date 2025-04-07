// CSV processing utilities for DigitalOcean FinOps Dashboard
import Papa from 'papaparse';
import { formatCurrency } from './dataUtils';

// Parse CSV text into structured data
export const parseCSV = (csvText) => {
  try {
    const results = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      // Handle quotes and common CSV formatting issues
      delimitersToGuess: [',', '\t', '|', ';']
    });
    
    // Log parsing results for debugging
    console.log(`Parsed ${results.data.length} CSV rows with ${results.meta.fields?.length || 0} fields`);
    
    // Debug logging to see the structure (only for the first CSV)
    if (results.data && results.data.length > 0 && !window._hasLoggedCSVStructure) {
      console.log("CSV Headers:", results.meta.fields);
      console.log("Sample CSV row (full details):", JSON.stringify(results.data[0], null, 2));
      
      // Look for any field that might be a monetary value
      for (const [key, value] of Object.entries(results.data[0])) {
        if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
          console.log(`Potential numeric field: ${key} = ${value} (${typeof value})`);
        }
      }
      
      window._hasLoggedCSVStructure = true; // Only log once
    }
    
    return results.data;
  } catch (error) {
    console.error('Error parsing CSV data:', error);
    return [];
  }
};

// Fetch CSV data for a specific invoice
export const fetchInvoiceCSV = async (token, invoiceId) => {
  try {
    const response = await fetch(
      `https://api.digitalocean.com/v2/customers/my/invoices/${invoiceId}/csv`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);
    
    const csvText = await response.text();
    
    // Ensure we received valid CSV data
    if (!csvText || csvText.trim().length === 0) {
      console.warn(`Empty CSV response for invoice ${invoiceId}`);
      return [];
    }
    
    // Parse the CSV data
    const parsedData = parseCSV(csvText);
    return parsedData;
  } catch (err) {
    console.error(`Error fetching CSV for invoice ${invoiceId}:`, err);
    return [];
  }
};

// Fetch all invoices and their CSV data
export const fetchAllInvoiceData = async (token) => {
  try {
    // First get list of invoices
    const invoicesList = await fetchInvoicesList(token);
    console.log(`Retrieved ${invoicesList.length} invoices`);
    
    // Then fetch CSVs for each invoice
    const allLineItems = [];
    
    // Using Promise.all for parallel fetching - be cautious with rate limits
    const promises = invoicesList.map(async invoice => {
      console.log(`Fetching CSV data for invoice ${invoice.invoice_uuid}...`);
      const csvData = await fetchInvoiceCSV(token, invoice.invoice_uuid);
      
      if (csvData && csvData.length > 0) {
        // Add invoice information to each line item
        const processedItems = csvData.map(item => ({
          ...item,
          // Ensure these fields are present for compatibility with existing code
          invoice_uuid: invoice.invoice_uuid,
          invoice_period: invoice.invoice_period,
          invoice_amount: invoice.amount, // Add the invoice's total amount for reference
          date: invoice.date || invoice.created_at
        }));
        
        allLineItems.push(...processedItems);
        console.log(`Added ${processedItems.length} line items from invoice ${invoice.invoice_uuid}`);
      } else {
        console.warn(`No CSV data found for invoice ${invoice.invoice_uuid}`);
      }
    });
    
    await Promise.all(promises);
    
    return {
      invoices: invoicesList,
      lineItems: allLineItems
    };
  } catch (error) {
    console.error('Error fetching invoice data:', error);
    return { invoices: [], lineItems: [] };
  }
};

// Fetch list of invoices
export const fetchInvoicesList = async (token) => {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Initialize variables for pagination
    let fetchedInvoices = [];
    let hasMorePages = true;
    let pageUrl = 'https://api.digitalocean.com/v2/customers/my/invoices?per_page=100';
    
    // Fetch all pages
    while (hasMorePages) {
      console.log(`Fetching invoices page: ${pageUrl}`);
      const response = await fetch(pageUrl, { method: 'GET', headers });
      
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();
      const pageInvoices = data.invoices || [];
      fetchedInvoices = [...fetchedInvoices, ...pageInvoices];
      
      console.log(`Retrieved ${pageInvoices.length} invoices from current page`);
      
      // Check for more pages
      if (data.links && data.links.pages && data.links.pages.next) {
        pageUrl = data.links.pages.next;
      } else if (response.headers && response.headers.get('Link')) {
        const linkHeader = response.headers.get('Link');
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch && nextMatch[1]) {
          pageUrl = nextMatch[1];
        } else {
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }
    }
    
    return fetchedInvoices;
  } catch (error) {
    console.error('Error fetching invoices list:', error);
    return [];
  }
};

// Try to find the most likely monetary field in an item
const findMonetaryValue = (item) => {
  // Check common field names first
  if ('USD' in item && !isNaN(parseFloat(item.USD))) return parseFloat(item.USD);
  if ('amount' in item && !isNaN(parseFloat(item.amount))) return parseFloat(item.amount);
  if ('cost' in item && !isNaN(parseFloat(item.cost))) return parseFloat(item.cost);
  if ('price' in item && !isNaN(parseFloat(item.price))) return parseFloat(item.price);
  if ('charge' in item && !isNaN(parseFloat(item.charge))) return parseFloat(item.charge);
  
  // If no common field names are found, look through all fields for numeric values
  // that aren't hours (since hours is its own field)
  let highestValue = 0;
  
  for (const [key, value] of Object.entries(item)) {
    // Skip non-numeric fields and hours field
    if (key === 'hours') continue;
    if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(parseFloat(value)))) continue;
    
    const numValue = parseFloat(value);
    if (numValue > 0) {
      // Typically the highest numeric value in a CSV row (that's not hours) would be the cost
      if (numValue > highestValue) {
        highestValue = numValue;
      }
    }
  }
  
  return highestValue;
};

// Process CSV data for visualizations
export const processCSVDataForVisualizations = (lineItems) => {
  console.log("Processing visualization data from", lineItems.length, "items");
  
  if (lineItems.length === 0) {
    console.warn("No line items to process for visualizations");
    return createEmptyVisualizationData();
  }
  
  // Show sample item for debugging
  console.log("Sample line item:", lineItems[0]);
  
  // Log all fields from the first item to see what we're working with
  if (lineItems.length > 0) {
    console.log("First item fields:");
    for (const [key, value] of Object.entries(lineItems[0])) {
      console.log(`${key}: ${value} (${typeof value})`);
    }
  }
  
  // Initialize data structures
  const monthlySpend = {};
  const categorySpend = {};
  const projectSpend = {};
  const productSpend = {};
  let totalAmount = 0;
  let validItemCount = 0;
  
  // Process each line item
  lineItems.forEach((item, index) => {
    // Find the monetary value for this item
    let amount = findMonetaryValue(item);
    
    // Log details for the first few items to debug
    if (index < 5) {
      console.log(`Item ${index} amount detection:`, amount);
    }
    
    if (amount <= 0) return; // Skip items with zero or negative amount
    
    // For monthly data - use invoice_period or extract from start date
    let month = item.invoice_period || '';
    if (!month && item.start) {
      // Try to extract YYYY-MM from start date
      try {
        const date = new Date(item.start);
        if (!isNaN(date.getTime())) {
          month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
      } catch (e) {
        console.warn("Failed to parse date:", item.start);
      }
    }
    
    if (month) {
      monthlySpend[month] = (monthlySpend[month] || 0) + amount;
    }
    
    // For category breakdown - use the category field
    const category = item.category || item.product || 'Unknown';
    if (category) {
      categorySpend[category] = (categorySpend[category] || 0) + amount;
    }
    
    // For project breakdown - use project_name field
    const project = item.project_name || 'Unassigned';
    projectSpend[project] = (projectSpend[project] || 0) + amount;
    
    // For product breakdown - use product field
    const product = item.product || 'Unknown';
    productSpend[product] = (productSpend[product] || 0) + amount;
    
    // Add to total
    totalAmount += amount;
    validItemCount++;
  });
  
  // Debug logging for data validation
  console.log("Monthly data:", monthlySpend);
  console.log("Category data:", categorySpend);
  console.log("Project data:", projectSpend);
  console.log("Total amount:", totalAmount);
  console.log("Valid items count:", validItemCount);
  
  // Check if we have any data
  if (validItemCount === 0 || totalAmount === 0) {
    console.warn("No valid amounts found in line items");
    
    // Fallback: if no valid items were found, try using invoice totals instead
    console.log("Using invoice totals as fallback...");
    return processInvoiceTotals(lineItems);
  }
  
  // Sort monthly data by date for time-series display
  const monthKeys = Object.keys(monthlySpend);
  const sortedMonths = monthKeys.sort((a, b) => {
    // Extract YYYY-MM from period strings like "2023-01" or "January 2023"
    const dateA = parseMonthPeriod(a);
    const dateB = parseMonthPeriod(b);
    return dateA - dateB;
  });
  
  const monthlyLabels = sortedMonths;
  const monthlyValues = sortedMonths.map(month => monthlySpend[month]);
  
  // Calculate trend and forecast
  const { trendText, forecastAmount, confidenceText } = 
    calculateTrendAndForecast(monthlyLabels, monthlyValues, validItemCount);
  
  return {
    monthlyData: { labels: monthlyLabels, values: monthlyValues },
    categoryData: categorySpend,
    projectData: projectSpend,
    productData: productSpend,
    summary: {
      totalAmount,
      invoiceCount: Object.keys(monthlySpend).length,
      totalItems: validItemCount,
      trendText,
      forecastAmount,
      confidenceText
    }
  };
};

// Fallback: process invoice totals instead of line items
const processInvoiceTotals = (lineItems) => {
  // Group by invoice and use the invoice totals
  const invoiceAmounts = {};
  const invoices = new Set();
  const projectSpend = {'All Projects': 0};
  const categorySpend = {'All Services': 0};
  const productSpend = {'All Products': 0};
  let totalAmount = 0;
  
  // Use invoice_amount field that we added during processing
  lineItems.forEach(item => {
    if (!item.invoice_uuid || !item.invoice_period || !item.invoice_amount) return;
    
    if (!invoiceAmounts[item.invoice_period]) {
      const amount = parseFloat(item.invoice_amount) || 0;
      if (amount <= 0) return;
      
      invoiceAmounts[item.invoice_period] = amount;
      totalAmount += amount;
      invoices.add(item.invoice_uuid);
      
      // Add to single categories
      projectSpend['All Projects'] += amount;
      categorySpend['All Services'] += amount;
      productSpend['All Products'] += amount;
    }
  });
  
  // Sort months
  const monthKeys = Object.keys(invoiceAmounts);
  const sortedMonths = monthKeys.sort((a, b) => {
    const dateA = parseMonthPeriod(a);
    const dateB = parseMonthPeriod(b);
    return dateA - dateB;
  });
  
  const monthlyLabels = sortedMonths;
  const monthlyValues = sortedMonths.map(month => invoiceAmounts[month]);
  
  console.log("Using invoice totals: ", totalAmount);
  console.log("Monthly data from invoice totals:", monthlyLabels, monthlyValues);
  
  // If still no data, return empty result
  if (totalAmount === 0) {
    return createEmptyVisualizationData();
  }
  
  // Calculate trend and forecast
  const { trendText, forecastAmount, confidenceText } = 
    calculateTrendAndForecast(monthlyLabels, monthlyValues, invoices.size);
  
  return {
    monthlyData: { labels: monthlyLabels, values: monthlyValues },
    categoryData: categorySpend,
    projectData: projectSpend,
    productData: productSpend,
    summary: {
      totalAmount,
      invoiceCount: invoices.size,
      totalItems: lineItems.length,
      trendText,
      forecastAmount,
      confidenceText
    }
  };
};

// Helper function to parse month period strings into comparable dates
const parseMonthPeriod = (periodStr) => {
  if (!periodStr) return new Date(0); // Default for empty strings
  
  // Check if it's already in YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(periodStr)) {
    return new Date(`${periodStr}-01`);
  }
  
  // Try to parse various date formats
  try {
    // For "Month YYYY" format (e.g., "January 2023")
    const monthYearMatch = periodStr.match(/([A-Za-z]+)\s+(\d{4})/);
    if (monthYearMatch) {
      const monthNames = ["january", "february", "march", "april", "may", "june", 
                         "july", "august", "september", "october", "november", "december"];
      const month = monthNames.indexOf(monthYearMatch[1].toLowerCase());
      const year = parseInt(monthYearMatch[2]);
      if (month !== -1 && !isNaN(year)) {
        return new Date(year, month, 1);
      }
    }
    
    // For full date strings
    const date = new Date(periodStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    console.warn(`Failed to parse period string: ${periodStr}`);
  }
  
  // Return original string converted to date (may be invalid)
  return new Date(periodStr);
};

// Create empty data structures when no data is available
const createEmptyVisualizationData = () => {
  return {
    monthlyData: { labels: [], values: [] },
    categoryData: {'No Data': 0},
    projectData: {'No Data': 0},
    productData: {'No Data': 0},
    summary: {
      totalAmount: 0,
      invoiceCount: 0,
      totalItems: 0,
      trendText: 'N/A',
      forecastAmount: 0,
      confidenceText: 'No data available'
    }
  };
};

// Calculate trend and forecast from monthly data
const calculateTrendAndForecast = (labels, values, itemCount) => {
  if (!labels || !values || labels.length < 2) {
    return {
      trendText: 'N/A',
      forecastAmount: 0,
      confidenceText: `Insufficient data (${itemCount} items)`
    };
  }
  
  // Get the two most recent months
  const lastIndex = values.length - 1;
  const lastSpend = values[lastIndex];
  const prevSpend = values[lastIndex - 1];
  
  // Calculate trend
  let trendText = 'N/A';
  if (prevSpend > 0) {
    const change = lastSpend - prevSpend;
    const percentChange = (change / prevSpend) * 100;
    trendText = change >= 0 ? 
      `Up ${percentChange.toFixed(1)}%` : 
      `Down ${Math.abs(percentChange).toFixed(1)}%`;
  }
  
  // Calculate forecast (simple linear projection)
  let forecastAmount = 0;
  let confidenceText = '';
  
  if (values.length >= 3) {
    // Use last 3 months for forecast
    const recentValues = values.slice(-3);
    
    // Calculate average month-to-month change
    const avgChange = (recentValues[2] - recentValues[0]) / 2;
    
    // Project forward from latest
    forecastAmount = recentValues[2] + avgChange;
    if (forecastAmount < 0) forecastAmount = recentValues[2]; // No negative forecasts
    
    confidenceText = `Based on ${values.length} months of data, ±${Math.min(10, values.length * 2)}%`;
  } else if (values.length > 0) {
    // With limited data, just use the most recent value
    forecastAmount = values[values.length - 1];
    confidenceText = 'Limited historical data, high variance';
  }
  
  return { trendText, forecastAmount, confidenceText };
};