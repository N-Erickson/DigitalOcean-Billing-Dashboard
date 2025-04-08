// CSV processing utilities for DigitalOcean FinOps Dashboard
import Papa from 'papaparse';
import { formatCurrency, extractMonetaryValue, filterLineItemsByTimeRange } from './dataUtils';

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

// Process CSV data for visualizations with optional time range filter
export const processCSVDataForVisualizations = (lineItems, timeRange = null) => {
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
  
  // Apply time range filter if provided
  let itemsToProcess = lineItems;
  if (timeRange) {
    itemsToProcess = filterLineItemsByTimeRange(lineItems, timeRange);
    console.log(`Applied time range filter: ${timeRange}. Items reduced from ${lineItems.length} to ${itemsToProcess.length}`);
  }
  
  // Initialize data structures
  const monthlySpend = {};
  const categorySpend = {};
  const projectSpend = {};
  const productSpend = {};
  let totalAmount = 0;
  let validItemCount = 0;
  
  // Process each line item
  itemsToProcess.forEach((item, index) => {
    // Find the monetary value for this item using the shared utility function
    let amount = extractMonetaryValue(item);
    
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
    
    // For category breakdown - try multiple fields
    const category = item.category || item.name || item.product || item.description || 'Unknown';
    if (category) {
      categorySpend[category] = (categorySpend[category] || 0) + amount;
    }
    
    // For project breakdown - use project_name field
    const project = item.project_name || 'Unassigned';
    projectSpend[project] = (projectSpend[project] || 0) + amount;
    
    // For product breakdown - use product field or fallback to other identifiers
    const product = item.product || item.name || item.type || 'Unknown';
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
    return processInvoiceTotals(itemsToProcess);
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
  
  // Calculate trend and forecast - ENHANCED VERSION
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
    if (!item.invoice_uuid || !item.invoice_period) return;
    
    // Skip if we've already processed this invoice
    if (invoices.has(item.invoice_uuid)) return;
    
    // For invoice amounts, make sure to parse correctly if it's a string
    let amount = 0;
    if (item.invoice_amount) {
      if (typeof item.invoice_amount === 'string') {
        // Remove currency symbols if present
        const cleaned = item.invoice_amount.replace(/[^\d.-]/g, '');
        amount = parseFloat(cleaned);
      } else if (typeof item.invoice_amount === 'number') {
        amount = item.invoice_amount;
      }
    }
    
    if (amount <= 0) return;
    
    invoices.add(item.invoice_uuid);
    invoiceAmounts[item.invoice_period] = (invoiceAmounts[item.invoice_period] || 0) + amount;
    totalAmount += amount;
    
    // Add to single categories
    projectSpend['All Projects'] += amount;
    categorySpend['All Services'] += amount;
    productSpend['All Products'] += amount;
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
  
  // Calculate trend and forecast - ENHANCED VERSION
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

// ENHANCED: Calculate trend and forecast from monthly data with advanced methods
const calculateTrendAndForecast = (labels, values, itemCount) => {
  if (!labels || !values || labels.length < 2) {
    return {
      trendText: 'N/A',
      forecastAmount: 0,
      confidenceText: `Insufficient data (${itemCount} items)`
    };
  }

  // Get the two most recent months for trend calculation
  const lastIndex = values.length - 1;
  const lastSpend = values[lastIndex];
  const prevSpend = values[lastIndex - 1];

  // Calculate trend (same as before)
  let trendText = 'N/A';
  if (prevSpend > 0) {
    const change = lastSpend - prevSpend;
    const percentChange = (change / prevSpend) * 100;
    trendText = change >= 0 ? 
      `Up ${percentChange.toFixed(1)}%` : 
      `Down ${Math.abs(percentChange).toFixed(1)}%`;
  }

  // ENHANCED FORECASTING
  let forecastAmount = 0;
  let confidenceText = '';

  // Method selection based on data availability
  if (values.length >= 12) {
    // Method 1: Use year-over-year seasonality if we have at least 12 months of data
    const sameMonthLastYear = values[lastIndex - 11];
    const lastYearGrowth = lastSpend / sameMonthLastYear;
    
    // Blend of YoY growth and recent trend
    forecastAmount = lastSpend * (0.7 * lastYearGrowth + 0.3 * (lastSpend / prevSpend));
    confidenceText = `Based on year-over-year pattern, ±${Math.min(5, 15 - values.length / 2)}%`;
  } 
  else if (values.length >= 6) {
    // Method 2: For 6-11 months, use weighted average of recent months with more emphasis on recent data
    // Calculate weighted moving average with more weight to recent months
    let weightedSum = 0;
    let weightSum = 0;
    const weights = [0.35, 0.25, 0.15, 0.10, 0.08, 0.07]; // Weights for last 6 months
    
    // Apply weights to available months (up to last 6)
    for (let i = 0; i < Math.min(6, values.length); i++) {
      weightedSum += values[lastIndex - i] * weights[i];
      weightSum += weights[i];
    }
    
    // Get base forecast from weighted average
    const weightedAvg = weightedSum / weightSum;
    
    // Adjust with recent trend factor
    const recentTrendFactor = lastSpend / prevSpend;
    forecastAmount = weightedAvg * Math.pow(recentTrendFactor, 0.7); // Dampen the trend impact
    
    confidenceText = `Based on weighted 6-month analysis, ±${Math.min(8, 20 - values.length)}%`;
  }
  else if (values.length >= 3) {
    // Method 3: For 3-5 months, use linear regression
    // Simple linear regression on available months
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = values.length;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[lastIndex - (n - 1) + i];
      sumXY += i * values[lastIndex - (n - 1) + i];
      sumX2 += i * i;
    }
    
    // Calculate slope and intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Project one month ahead
    forecastAmount = intercept + slope * n;
    
    // Apply boundary condition - forecast shouldn't be negative or too far from recent values
    if (forecastAmount < 0) forecastAmount = lastSpend * 0.9;
    if (forecastAmount > lastSpend * 2) forecastAmount = lastSpend * 1.5;
    
    confidenceText = `Based on trend analysis of last ${n} months, ±${20 - n * 2}%`;
  } 
  else {
    // Method 4: For 2 months, simple projection with dampening
    const growthRate = lastSpend / prevSpend;
    // Dampen the growth rate to avoid extreme projections
    const dampedGrowth = 1 + (growthRate - 1) * 0.7;
    forecastAmount = lastSpend * dampedGrowth;
    
    // Apply reasonability bounds
    if (forecastAmount < 0) forecastAmount = lastSpend;
    if (forecastAmount > lastSpend * 1.5) forecastAmount = lastSpend * 1.5;
    
    confidenceText = 'Based on limited data (2 months), high variance possible';
  }

  // Add anomaly detection - if last month appears to be an outlier
  if (values.length >= 4) {
    const threeMonthAvg = (values[lastIndex - 1] + values[lastIndex - 2] + values[lastIndex - 3]) / 3;
    const deviation = Math.abs(lastSpend - threeMonthAvg) / threeMonthAvg;
    
    if (deviation > 0.3) { // If last month deviates by more than 30% from previous 3-month average
      // Adjust the forecast to be more conservative by blending with the 3-month average
      forecastAmount = forecastAmount * 0.7 + threeMonthAvg * 0.3;
      confidenceText += ' (adjusted for recent anomaly)';
    }
  }

  return { trendText, forecastAmount, confidenceText };
};

// Helper function to add forecast visualization to chart data
export const addForecastToMonthlyChart = (chartData, forecastAmount) => {
  if (!chartData || !chartData.labels || chartData.labels.length === 0 || !chartData.datasets) 
    return chartData;
  
  // Clone the chart data
  const newChartData = {
    labels: [...chartData.labels],
    datasets: JSON.parse(JSON.stringify(chartData.datasets))
  };
  
  // Get the last month label and create a forecast month label
  const lastMonth = chartData.labels[chartData.labels.length - 1];
  let nextMonth = "";
  
  // Try to parse the last month format and increment by one month
  if (/^\d{4}-\d{2}$/.test(lastMonth)) {
    // Format is YYYY-MM
    const year = parseInt(lastMonth.substring(0, 4));
    const month = parseInt(lastMonth.substring(5, 7));
    
    if (month === 12) {
      nextMonth = `${year + 1}-01`;
    } else {
      nextMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    }
  } else {
    // If we can't parse the format, just append " (Forecast)" to the last month
    nextMonth = `${lastMonth} (Forecast)`;
  }
  
  // Add forecast month to labels
  newChartData.labels.push(nextMonth);
  
  // Add forecast data point to each dataset
  newChartData.datasets = newChartData.datasets.map(dataset => {
    const lastValue = dataset.data[dataset.data.length - 1];
    const forecastPoint = forecastAmount;
    
    // Create a new dataset with forecast point added
    return {
      ...dataset,
      data: [...dataset.data, forecastPoint],
      // The following properties need to be added carefully since Chart.js expects arrays
      // or single values depending on the property
      pointBackgroundColor: Array.isArray(dataset.pointBackgroundColor) 
        ? [...dataset.pointBackgroundColor, 'rgba(255, 99, 132, 1)'] 
        : dataset.pointBackgroundColor,
      pointRadius: Array.isArray(dataset.pointRadius)
        ? [...dataset.pointRadius, 6]
        : 3,
      // We need to be careful with borderDash as it might cause visual issues if not handled properly
      borderDash: dataset.borderDash || []
    };
  });
  
  return newChartData;
};