// CSV processing utilities for DigitalOcean FinOps Dashboard
import Papa from 'papaparse';
import { formatCurrency, extractMonetaryValue, filterLineItemsByTimeRange, isDiscountItem, categorizeDiscountItem } from './dataUtils';

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
      
      // Look for any field that might be a monetary value (including negative)
      for (const [key, value] of Object.entries(results.data[0])) {
        if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
          console.log(`Potential numeric field: ${key} = ${value} (${typeof value})`);
        }
      }
      
      // Check for discount items in the sample
      const discountItems = results.data.filter(item => isDiscountItem(item));
      if (discountItems.length > 0) {
        console.log(`Found ${discountItems.length} discount items in CSV`);
        console.log("Sample discount item:", discountItems[0]);
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
        
        // Count discount items for this invoice
        const discountItems = processedItems.filter(item => isDiscountItem(item));
        console.log(`Added ${processedItems.length} line items from invoice ${invoice.invoice_uuid} (${discountItems.length} discounts)`);
      } else {
        console.warn(`No CSV data found for invoice ${invoice.invoice_uuid}`);
      }
    });
    
    await Promise.all(promises);
    
    // Log overall discount statistics
    const totalDiscountItems = allLineItems.filter(item => isDiscountItem(item));
    const totalDiscountAmount = totalDiscountItems.reduce((sum, item) => sum + extractMonetaryValue(item), 0);
    console.log(`Total discount items found: ${totalDiscountItems.length}`);
    console.log(`Total discount amount: ${formatCurrency(totalDiscountAmount)}`);
    
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

// UPDATED: Process CSV data for visualizations with optional time range filter (now includes discounts)
export const processCSVDataForVisualizations = (lineItems, timeRange = null) => {
  console.log("Processing visualization data from", lineItems.length, "items (including discounts)");
  
  if (lineItems.length === 0) {
    console.warn("No line items to process for visualizations");
    return createEmptyVisualizationData();
  }
  
  // Show sample item for debugging
  console.log("Sample line item:", lineItems[0]);
  
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
  let discountItemCount = 0;
  let totalDiscountAmount = 0;
  
  // Process each line item
  itemsToProcess.forEach((item, index) => {
    // Find the monetary value for this item using the shared utility function
    let amount = extractMonetaryValue(item);
    
    // Log details for the first few items to debug (including discounts)
    if (index < 5) {
      console.log(`Item ${index} amount detection:`, amount);
      if (amount < 0) {
        console.log(`Item ${index} is a discount:`, {
          description: item.description,
          category: item.category,
          amount: amount
        });
      }
    }
    
    // Track discount items separately
    if (amount < 0) {
      discountItemCount++;
      totalDiscountAmount += amount;
    }
    
    // IMPORTANT: Don't skip negative amounts anymore - they represent discounts!
    // Previously we might have had: if (amount <= 0) return;
    // Now we process all amounts, including negative ones
    
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
    
    // For category breakdown - handle discounts specially
    let category;
    if (isDiscountItem(item)) {
      category = categorizeDiscountItem(item);
    } else {
      category = item.category || item.name || item.product || item.description || 'Unknown';
    }
    
    if (category) {
      categorySpend[category] = (categorySpend[category] || 0) + amount;
    }
    
    // For project breakdown - use project_name field
    const project = item.project_name || 'Unassigned';
    projectSpend[project] = (projectSpend[project] || 0) + amount;
    
    // For product breakdown - handle discounts specially
    let product;
    if (isDiscountItem(item)) {
      product = categorizeDiscountItem(item);
    } else {
      product = item.product || item.name || item.type || 'Unknown';
    }
    productSpend[product] = (productSpend[product] || 0) + amount;
    
    // Add to total (including negative amounts for discounts)
    totalAmount += amount;
    validItemCount++;
  });
  
  // Debug logging for data validation (now including discount info)
  console.log("Monthly data:", monthlySpend);
  console.log("Category data:", categorySpend);
  console.log("Project data:", projectSpend);
  console.log("Total amount (after discounts):", totalAmount);
  console.log("Valid items count:", validItemCount);
  console.log("Discount items count:", discountItemCount);
  console.log("Total discount amount:", totalDiscountAmount);
  
  // Check if we have any data
  if (validItemCount === 0) {
    console.warn("No valid items found in line items");
    
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
  
  // Calculate trend and forecast with improved methods
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
      discountItems: discountItemCount,
      totalDiscountAmount: totalDiscountAmount,
      trendText,
      forecastAmount,
      confidenceText
    }
  };
};

// UPDATED: Fallback process invoice totals instead of line items (accounting for discounts)
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
        // Remove currency symbols if present, but keep minus sign for negative amounts
        const cleaned = item.invoice_amount.replace(/[^\d.-]/g, '');
        amount = parseFloat(cleaned);
      } else if (typeof item.invoice_amount === 'number') {
        amount = item.invoice_amount;
      }
    }
    
    // Don't skip negative amounts anymore - they could be credit invoices
    if (isNaN(amount)) return;
    
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
  
  console.log("Using invoice totals (with discounts applied): ", totalAmount);
  console.log("Monthly data from invoice totals:", monthlyLabels, monthlyValues);
  
  // If still no data, return empty result
  if (totalAmount === 0 && monthlyValues.every(val => val === 0)) {
    return createEmptyVisualizationData();
  }
  
  // Calculate trend and forecast with improved methods
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
      discountItems: 0, // We don't have detailed discount info in this fallback
      totalDiscountAmount: 0,
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
      discountItems: 0,
      totalDiscountAmount: 0,
      trendText: 'N/A',
      forecastAmount: 0,
      confidenceText: 'No data available'
    }
  };
};

// IMPROVED: Calculate trend and forecast from monthly data with advanced methods (unchanged but now accounts for discounts in the data)
const calculateTrendAndForecast = (labels, values, itemCount) => {
  // Handle the case where we don't have enough data
  if (!labels || !values || values.length === 0) {
    return {
      trendText: 'N/A',
      forecastAmount: 0,
      confidenceText: `No data available`
    };
  }
  
  // Special case: If we're looking at only the last month (timeRange = '1month')
  // we should still make a forecast by looking at a wider range of data
  let lastSpend = 0;
  let prevSpend = 0;
  let fullDataset = false;
  
  // Case 1: We have at least 2 months of data in the current view
  if (values.length >= 2) {
    const lastIndex = values.length - 1;
    lastSpend = values[lastIndex];
    prevSpend = values[lastIndex - 1];
    fullDataset = true;
  } 
  // Case 2: We only have 1 month in view (likely because timeRange = '1month')
  // In this case, we'll use the last month's value and make a simple projection
  else if (values.length === 1) {
    lastSpend = values[0];
    
    // Even with only one month in view, we'll attempt a forecast
    // Set a reasonable default value (for now, just use the last month)
    // We'll refine this in the forecast calculation
    prevSpend = lastSpend;
    
    // Mark that we don't have a full dataset to calculate trend
    fullDataset = false;
  }
  // Case 3: No data available at all
  else {
    return {
      trendText: 'N/A',
      forecastAmount: 0,
      confidenceText: `Insufficient data (${itemCount} items)`
    };
  }

  // Calculate trend, but only if we have at least 2 months of data
  let trendText = 'N/A';
  if (fullDataset && prevSpend !== 0) { // Changed from prevSpend > 0 to handle negative previous spend
    const change = lastSpend - prevSpend;
    const percentChange = (change / Math.abs(prevSpend)) * 100; // Use absolute value for percentage calculation
    trendText = change >= 0 ? 
      `Up ${percentChange.toFixed(1)}%` : 
      `Down ${Math.abs(percentChange).toFixed(1)}%`;
  }

  // IMPROVED FORECASTING METHODS (now accounts for discounts in calculations)
  let forecastAmount = 0;
  let confidenceText = '';

  // For limited visible data
  if (!fullDataset) {
    forecastAmount = lastSpend * 1.03; // Assume 3% growth instead of 5%
    confidenceText = 'Based on limited visible data, high variance possible';
  }
  // For 12+ months of data
  else if (values.length >= 12) {
    // IMPROVED METHOD FOR 12+ MONTHS: Multiple model ensemble
    
    // 1. Calculate moving average growth rates (last 3, 6, and 12 months)
    const last3MonthsAvg = values.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
    const last6MonthsAvg = values.slice(-6).reduce((sum, val) => sum + val, 0) / 6;
    
    // 2. Calculate month-over-month growth rates
    const recentGrowthRates = [];
    for (let i = 1; i < Math.min(6, values.length); i++) {
      if (values[values.length - i - 1] !== 0) { // Changed from > 0 to !== 0
        recentGrowthRates.push(values[values.length - i] / values[values.length - i - 1]);
      }
    }
    
    // Average of recent growth rates
    const avgGrowthRate = recentGrowthRates.length > 0 ? 
      recentGrowthRates.reduce((sum, rate) => sum + rate, 0) / recentGrowthRates.length : 1;
    
    // 3. Calculate seasonal index (compare current month to trailing average)
    // For 12-month view, we need to avoid comparing with ourselves
    let seasonalFactor = 1;
    if (values.length > 12) {
      // Use true seasonal comparison with prior year
      const sameMonthLastYear = values[values.length - 12];
      const trailingAvgLastYear = values.slice(-15, -9).reduce((sum, val) => sum + val, 0) / 6;
      
      if (trailingAvgLastYear !== 0) { // Changed from > 0 to !== 0
        // How much this month typically differs from the average
        seasonalFactor = (sameMonthLastYear / trailingAvgLastYear);
      }
    } else {
      // For exactly 12 months, use the overall pattern in the data
      // rather than comparing with ourselves
      const firstHalfAvg = values.slice(0, 6).reduce((sum, val) => sum + val, 0) / 6;
      const secondHalfAvg = values.slice(-6).reduce((sum, val) => sum + val, 0) / 6;
      
      if (firstHalfAvg !== 0) { // Changed from > 0 to !== 0
        const overallGrowthFactor = secondHalfAvg / firstHalfAvg;
        // Apply a dampened growth factor
        seasonalFactor = Math.pow(overallGrowthFactor, 1/6); // Sixth root for monthly growth
      }
    }
    
    // Cap seasonal factor to avoid extreme values
    seasonalFactor = Math.max(0.8, Math.min(1.2, seasonalFactor));
    
    // 4. Calculate variance to determine confidence
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const coefficientOfVariation = Math.abs(mean) > 0 ? Math.sqrt(variance) / Math.abs(mean) : 0; // Use absolute value for mean
    
    // 5. Ensemble forecast using all factors
    // Weighted blend of different models
    const trendModelForecast = lastSpend * avgGrowthRate;
    const movingAvgForecast = (last3MonthsAvg * 0.7 + last6MonthsAvg * 0.3) * seasonalFactor;
    
    // Final forecast with weightings
    forecastAmount = trendModelForecast * 0.6 + movingAvgForecast * 0.4;
    
    // Confidence text based on actual variance in the data
    const confidencePercent = Math.min(25, Math.max(5, Math.round(coefficientOfVariation * 100)));
    confidenceText = `Based on ${values.length} months with seasonal adjustment, ±${confidencePercent}%`;
  } 
  else if (values.length >= 6) {
    // IMPROVED METHOD FOR 6-11 MONTHS
    
    // Calculate exponentially weighted moving average
    // More weight to recent months
    const weights = [0.35, 0.25, 0.15, 0.10, 0.08, 0.07]; // Sum = 1
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < Math.min(6, values.length); i++) {
      weightedSum += values[values.length - 1 - i] * weights[i];
      weightSum += weights[i];
    }
    
    const weightedAvg = weightedSum / weightSum;
    
    // Calculate growth rate with longer-term trend
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    let growthFactor = 1.02; // Default modest growth
    
    if (firstHalfAvg !== 0) { // Changed from > 0 to !== 0
      // Calculate monthly growth factor
      growthFactor = Math.pow(secondHalfAvg / firstHalfAvg, 1/secondHalf.length);
      // Cap growth to avoid extreme forecasts
      growthFactor = Math.max(0.9, Math.min(1.1, growthFactor));
    }
    
    // Retrending method: Weighted average × growth factor
    forecastAmount = weightedAvg * growthFactor;
    
    // Calculate variance for confidence
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const relativeVariance = Math.abs(mean) > 0 ? Math.sqrt(variance) / Math.abs(mean) : 0; // Use absolute value for mean
    
    const confidencePercent = Math.min(20, Math.max(8, Math.round(relativeVariance * 100)));
    confidenceText = `Based on ${values.length} months trend analysis, ±${confidencePercent}%`;
  }
  else if (values.length >= 3) {
    // IMPROVED METHOD FOR 3-5 MONTHS
    // Enhanced linear regression with drift adjustment
    
    // 1. Simple linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = values.length;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    // Calculate slope and intercept
    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = (sumY - slope * sumX) / n;
    
    // Base projection
    let baseProjection = intercept + slope * n;
    
    // 2. Calculate acceleration/deceleration
    let acceleration = 0;
    if (n >= 3) {
      const firstDiffs = [];
      for (let i = 1; i < n; i++) {
        firstDiffs.push(values[i] - values[i-1]);
      }
      
      // Calculate average change in differences (acceleration)
      let diffSum = 0;
      for (let i = 1; i < firstDiffs.length; i++) {
        diffSum += firstDiffs[i] - firstDiffs[i-1];
      }
      
      if (firstDiffs.length > 1) {
        acceleration = diffSum / (firstDiffs.length - 1);
        // Dampen the acceleration effect
        acceleration *= 0.5;
      }
    }
    
    // Apply acceleration adjustment
    forecastAmount = baseProjection + acceleration;
    
    // Apply reasonable bounds (now considering negative values for discounts)
    const lastValue = values[n-1];
    if (forecastAmount < lastValue * 0.5 && lastValue > 0) forecastAmount = lastValue * 0.9;
    if (forecastAmount > lastValue * 2 && lastValue > 0) forecastAmount = lastValue * 1.3;
    
    // Calculate error bounds based on regression residuals
    let sumSquaredErrors = 0;
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * i;
      sumSquaredErrors += Math.pow(values[i] - predicted, 2);
    }
    
    const standardError = Math.sqrt(sumSquaredErrors / (n - 2));
    const meanValue = sumY / n;
    const confidencePercent = Math.abs(meanValue) > 0 ? 
      Math.min(25, Math.max(10, Math.round((standardError / Math.abs(meanValue)) * 100))) : 15;
    
    confidenceText = `Based on ${n} months regression analysis, ±${confidencePercent}%`;
  } 
  else if (values.length >= 2) {
    // IMPROVED METHOD FOR 2 MONTHS (now handles negative values properly)
    // Use dampened growth with reasonability checks
    
    const growthRate = prevSpend !== 0 ? lastSpend / prevSpend : 1;
    
    // Apply stronger dampening for extreme growth rates
    let dampening = 0.7; // Default dampening factor
    if (growthRate > 1.5 || growthRate < 0.75) {
      dampening = 0.5; // More aggressive dampening for extreme changes
    }
    
    const dampedGrowthRate = 1 + (growthRate - 1) * dampening;
    forecastAmount = lastSpend * dampedGrowthRate;
    
    // Apply more conservative bounds (considering negative values)
    const absLastSpend = Math.abs(lastSpend);
    if (Math.abs(forecastAmount) > absLastSpend * 1.3) {
      forecastAmount = lastSpend * (lastSpend >= 0 ? 1.3 : 0.7);
    }
    
    confidenceText = 'Based on 2 months of data, high uncertainty (±20%)';
  }

  // Apply anomaly detection and smoothing for all methods (now considers negative values)
  if (values.length >= 4) {
    const sortedValues = [...values].sort((a, b) => a - b);
    const medianValue = sortedValues[Math.floor(values.length / 2)];
    const threeMonthAvg = (values[values.length - 2] + values[values.length - 3] + values[values.length - 4]) / 3;
    
    // Check if the last month is an outlier compared to both median and recent average
    const medianDeviation = Math.abs(medianValue) > 0 ? Math.abs(lastSpend - medianValue) / Math.abs(medianValue) : 0;
    const recentDeviation = Math.abs(threeMonthAvg) > 0 ? Math.abs(lastSpend - threeMonthAvg) / Math.abs(threeMonthAvg) : 0;
    
    // If both deviations are high, it's likely an anomaly
    if (medianDeviation > 0.3 && recentDeviation > 0.25) {
      // Use a blend that reduces the impact of the anomaly
      const blendedBaseline = threeMonthAvg * 0.7 + medianValue * 0.3;
      // Adjust the forecast by blending the original with the adjusted baseline
      forecastAmount = forecastAmount * 0.4 + blendedBaseline * 0.6;
      confidenceText += ' (adjusted for potential anomaly)';
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
  
  // Sort labels chronologically to ensure we get the actual last month
  const sortedIndices = [...chartData.labels.keys()].sort((a, b) => {
    const parseMonthPeriod = (periodStr) => {
      if (!periodStr) return new Date(0);
      if (/^\d{4}-\d{2}$/.test(periodStr)) {
        return new Date(`${periodStr}-01`);
      }
      return new Date(periodStr);
    };
    return parseMonthPeriod(chartData.labels[a]) - parseMonthPeriod(chartData.labels[b]);
  });
  
  // Get the chronologically last month label and create a forecast month label
  const lastMonthIndex = sortedIndices[sortedIndices.length - 1];
  const lastMonth = chartData.labels[lastMonthIndex];
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