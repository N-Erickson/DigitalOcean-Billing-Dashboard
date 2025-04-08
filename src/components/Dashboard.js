import React, { useState, useEffect } from 'react';
import { SummaryCards } from './SummaryCards';
import { MonthlyChart } from './charts/MonthlyChart';
import { CategoryChart } from './charts/CategoryChart';
import { ProjectChart } from './charts/ProjectChart';
import { ProductChart } from './charts/ProductChart';
import { DetailedLineItemsChart } from './charts/DetailedLineItemsChart';
import { LineItemExplorer } from './LineItemExplorer';
import { InvoiceTable } from './InvoiceTable';
import { formatCurrency, filterLineItemsByTimeRange } from '../utils/dataUtils';

export const Dashboard = ({ 
  accountName,
  allInvoices, 
  allInvoiceSummaries, 
  detailedLineItems,
  processedData,
  isLoading, 
  error, 
  statusMessage,
  cacheStatus,
  apiToken, 
  timeRange, 
  onLogout, 
  onRefresh, 
  onClearCache,
  onTimeRangeChange,
  fetchLineItemDetails
}) => {
  const [showDataNotice, setShowDataNotice] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filteredLineItems, setFilteredLineItems] = useState([]);
  const [showForecast, setShowForecast] = useState(true); // New state for forecast toggle
  
  // Effect to filter line items by time range
  useEffect(() => {
    if (detailedLineItems && detailedLineItems.length > 0) {
      const filtered = filterLineItemsByTimeRange(detailedLineItems, timeRange);
      console.log(`Filtered line items by time range: ${filtered.length} of ${detailedLineItems.length} items`);
      setFilteredLineItems(filtered);
    } else {
      setFilteredLineItems([]);
    }
  }, [detailedLineItems, timeRange]);
  
  useEffect(() => {
    // Log details about the processed data for debugging
    if (processedData) {
      console.log("Dashboard received processed data:", {
        monthlyDataPoints: processedData.monthlyData?.labels?.length || 0,
        categoryCount: Object.keys(processedData.categoryData || {}).length,
        projectCount: Object.keys(processedData.projectData || {}).length,
        totalAmount: processedData.summary?.totalAmount || 0
      });
    }
  }, [processedData]);

  // Handle category click for drill-down
  const handleCategoryClick = (category) => {
    console.log(`Selected category: ${category}`);
    setSelectedCategory(category);
  };

  // Close data notice
  const closeDataNotice = () => {
    setShowDataNotice(false);
  };

  // Toggle forecast display
  const toggleForecast = () => {
    setShowForecast(!showForecast);
  };

  // Custom label for displaying the forecast confidence text based on time range
  const getForecastLabel = () => {
    if (!processedData || !processedData.summary) return '';
    
    // For 1-month view, add a special note
    if (timeRange === '1month') {
      return 'Forecast based on available data trends (may use data outside current view)';
    }
    
    return processedData.summary.confidenceText || '';
  };

  // Download full billing data as CSV
  const downloadBillingCSV = () => {
    if (!filteredLineItems || filteredLineItems.length === 0) {
      alert('No data available to download.');
      return;
    }
    
    // Get all columns from the first item
    const firstItem = filteredLineItems[0];
    const headers = Object.keys(firstItem);
    
    // Create CSV content
    const csvRows = [headers.join(',')];
    
    filteredLineItems.forEach(item => {
      const row = headers.map(field => {
        const value = item[field];
        // Format value for CSV (handle commas, quotes, etc.)
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        return value;
      });
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${accountName.replace(/\s+/g, '_').toLowerCase()}_billing_${timeRange}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render data notice based on cache status
  const renderDataNotice = () => {
    if (statusMessage) {
      return (
        <div className="data-source-notice">
          {statusMessage}
          <button className="close-btn" onClick={closeDataNotice}>×</button>
        </div>
      );
    } else if (cacheStatus.isCached) {
      return (
        <div className="data-source-notice">
          Using cached data from {cacheStatus.formattedDate}
          {cacheStatus.isReduced && " (reduced dataset due to storage limitations)"}
          <button className="close-btn" onClick={closeDataNotice}>×</button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container">
      <header>
        <div className="header-title">
          <h1>DigitalOcean FinOps Dashboard</h1>
          <span className="account-badge">{accountName}</span>
        </div>
        <div className="controls">
          <select 
            id="timeRange" 
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value)}
          >
            <option value="1month">Last Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="12months">Last 12 Months</option>
            <option value="all">All Time</option>
          </select>
          <button onClick={onRefresh} disabled={isLoading}>
            Refresh Data
          </button>
          <button onClick={downloadBillingCSV} disabled={isLoading || filteredLineItems.length === 0}>
            Download CSV
          </button>
          <button onClick={onClearCache} disabled={isLoading || !cacheStatus.isCached}>
            Clear Cache
          </button>
          <button onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {showDataNotice && renderDataNotice()}

      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-spinner"></div> Loading {accountName}'s DigitalOcean billing data...
        </div>
      )}

      {error && !isLoading && (
        <div className="alert">
          {error} 
          <button className="close-btn" onClick={() => {}}>×</button>
        </div>
      )}

      {!isLoading && processedData && (
        <>
          <div className="time-range-info" style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
            Showing data for {timeRange === 'all' ? 'all time' : `last ${timeRange}`}
            ({filteredLineItems.length} of {detailedLineItems.length} line items)
          </div>

          <SummaryCards summary={processedData.summary} accountName={accountName} />

          <div className="chart-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 className="chart-title">Monthly Spend Trend - {accountName}</h3>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#666' }}>
                <input 
                  type="checkbox" 
                  checked={showForecast} 
                  onChange={toggleForecast} 
                  style={{ marginRight: '5px' }}
                />
                Show Next Month Forecast
              </label>
            </div>
            <div className="chart">
              <MonthlyChart 
                data={processedData.monthlyData} 
                showForecast={showForecast} 
                forecastAmount={processedData.summary.forecastAmount} 
              />
            </div>
            {showForecast && (
              <div style={{ textAlign: 'right', marginTop: '5px', fontSize: '12px', color: '#666' }}>
                {getForecastLabel()}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="chart-container">
              <h3 className="chart-title">Spend by Category</h3>
              <div className="chart">
                <CategoryChart data={processedData.categoryData} />
              </div>
            </div>
            <div className="chart-container">
              <h3 className="chart-title">Spend by Project</h3>
              {detailedLineItems.length === 0 && (
                <div className="note" style={{ marginBottom: "10px", color: "#666", fontSize: "14px" }}>
                  Note: Loading detailed project data from DigitalOcean API...
                </div>
              )}
              <div className="chart" style={{ height: "400px" }}>
                <ProjectChart data={processedData.projectData} />
              </div>
            </div>
          </div>

          {/* Detailed Line Items (Interactive) */}
          <div className="chart-container scrollable">
            <h3 className="chart-title">
              {selectedCategory 
                ? `Line Items: ${selectedCategory} - ${accountName}` 
                : `Detailed Line Items - ${accountName}`}
            </h3>
            <div className="chart" style={{ 
              height: selectedCategory ? "600px" : "550px",
              overflowY: selectedCategory ? "auto" : "hidden" // Add scroll when needed
            }}>
              {selectedCategory ? (
                <LineItemExplorer
                  detailedLineItems={detailedLineItems}
                  selectedCategory={selectedCategory}
                  onBack={() => setSelectedCategory(null)}
                  timeRange={timeRange}
                  accountName={accountName}
                />
              ) : (
                <DetailedLineItemsChart 
                  detailedLineItems={filteredLineItems} // Use filtered line items here
                  timeRange={timeRange}
                  onCategoryClick={handleCategoryClick}
                  accountName={accountName}
                />
              )}
            </div>
          </div>

          <div className="chart-container">
            <h3 className="chart-title">Spend by Product - {accountName}</h3>
            <div className="chart">
              <ProductChart data={processedData.productData} />
            </div>
          </div>

          <InvoiceTable 
            invoices={allInvoices} 
            timeRange={timeRange} 
            apiToken={apiToken}
            accountName={accountName}
          />
        </>
      )}
    </div>
  );
};