// Storage utilities for DigitalOcean FinOps Dashboard

// Save data with metadata
export const saveData = (accountId, dataType, data) => {
    try {
      const storageItem = {
        data: data,
        lastUpdated: new Date().toISOString(),
        accountId: accountId
      };
      
      localStorage.setItem(`${accountId}_${dataType}`, JSON.stringify(storageItem));
      console.log(`Saved ${dataType} data for account ${accountId}`);
      return true;
    } catch (error) {
      console.error(`Error saving ${dataType} data:`, error);
      
      // If we hit storage limits, try clearing and saving only essential data
      if (error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, attempting to save with reduced data');
        try {
          // For line items, we might need to reduce the amount of data
          if (dataType === 'csvLineItems' && Array.isArray(data)) {
            // Keep only the most recent items or essential fields
            const reducedData = reduceDataSize(data);
            const reducedItem = {
              data: reducedData,
              lastUpdated: new Date().toISOString(),
              accountId: accountId,
              isReduced: true
            };
            localStorage.removeItem(`${accountId}_${dataType}`);
            localStorage.setItem(`${accountId}_${dataType}`, JSON.stringify(reducedItem));
            console.log(`Saved reduced ${dataType} data for account ${accountId}`);
            return true;
          }
        } catch (retryError) {
          console.error('Failed to save even with reduced data:', retryError);
        }
      }
      return false;
    }
  };
  
  // Load data from storage
  export const loadData = (accountId, dataType) => {
    try {
      const item = localStorage.getItem(`${accountId}_${dataType}`);
      if (!item) {
        console.log(`No ${dataType} data found for account ${accountId}`);
        return null;
      }
      
      const parsed = JSON.parse(item);
      console.log(`Loaded ${dataType} data for account ${accountId}, last updated: ${parsed.lastUpdated}`);
      
      // If it's marked as reduced data, log a warning
      if (parsed.isReduced) {
        console.warn(`Note: Using reduced dataset for ${dataType} due to previous storage limitations`);
      }
      
      return parsed;
    } catch (error) {
      console.error(`Error loading ${dataType} data:`, error);
      return null;
    }
  };
  
  // Check if data needs refresh (older than 24 hours by default)
  export const needsRefresh = (accountId, dataType, hoursThreshold = 24) => {
    const item = loadData(accountId, dataType);
    if (!item) return true;
    
    try {
      const lastUpdated = new Date(item.lastUpdated);
      const now = new Date();
      const hoursDifference = (now - lastUpdated) / (1000 * 60 * 60);
      
      const needsUpdate = hoursDifference > hoursThreshold;
      if (needsUpdate) {
        console.log(`${dataType} data for ${accountId} is ${hoursDifference.toFixed(1)} hours old and needs refresh`);
      } else {
        console.log(`${dataType} data for ${accountId} is current (${hoursDifference.toFixed(1)} hours old)`);
      }
      
      return needsUpdate;
    } catch (error) {
      console.error('Error checking data freshness:', error);
      return true; // Refresh if we can't determine freshness
    }
  };
  
  // Clear all data for an account
  export const clearAccountData = (accountId) => {
    try {
      const dataTypes = ['invoices', 'csvLineItems', 'processedData'];
      let cleared = 0;
      
      dataTypes.forEach(type => {
        if (localStorage.getItem(`${accountId}_${type}`)) {
          localStorage.removeItem(`${accountId}_${type}`);
          cleared++;
        }
      });
      
      console.log(`Cleared ${cleared} data items for account ${accountId}`);
      return true;
    } catch (error) {
      console.error('Error clearing account data:', error);
      return false;
    }
  };
  
  // Get cache status information for UI display
  export const getCacheStatus = (accountId) => {
    try {
      const csvData = loadData(accountId, 'csvLineItems');
      
      if (!csvData) return { isCached: false };
      
      const lastUpdated = new Date(csvData.lastUpdated);
      const now = new Date();
      const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);
      
      return {
        isCached: true,
        lastUpdated: lastUpdated,
        hoursSinceUpdate: hoursSinceUpdate,
        formattedDate: lastUpdated.toLocaleString(),
        isStale: hoursSinceUpdate > 24,
        itemCount: Array.isArray(csvData.data) ? csvData.data.length : 0,
        isReduced: csvData.isReduced || false
      };
    } catch (error) {
      console.error('Error getting cache status:', error);
      return { isCached: false, error: error.message };
    }
  };
  
  // Helper to reduce data size for large datasets
  const reduceDataSize = (data) => {
    if (!Array.isArray(data)) return data;
    
    // If we have a large array, we need to reduce it
    if (data.length > 1000) {
      console.warn(`Reducing data array size from ${data.length} items to avoid storage limits`);
      
      // Keep a subset of the data, focusing on the most recent items
      // Sort by date if possible
      const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || 0);
        const dateB = new Date(b.date || b.created_at || 0);
        return dateB - dateA; // Most recent first
      });
      
      // Take the most recent 1000 items
      return sortedData.slice(0, 1000);
    }
    
    // For smaller arrays, just return the original data
    return data;
  };