import React, { useState, useEffect } from 'react';
import { SummaryCards } from './SummaryCards';
import { MonthlyChart } from './charts/MonthlyChart';
import { CategoryChart } from './charts/CategoryChart';
import { ProjectChart } from './charts/ProjectChart';
import { ProductChart } from './charts/ProductChart';
import { DetailedLineItemsChart } from './charts/DetailedLineItemsChart';
import { TagChart } from './charts/TagChart';
import { LineItemExplorer } from './LineItemExplorer';
import { TagItemExplorer } from './TagItemExplorer';
import { InvoiceTable } from './InvoiceTable';
import { formatCurrency, processData, processProjectData, processTagData } from '../utils/dataUtils';

export const Dashboard = ({ 
  allInvoices, 
  allInvoiceSummaries, 
  detailedLineItems,
  isLoading, 
  error, 
  apiToken, 
  timeRange, 
  onLogout, 
  onRefresh, 
  onTimeRangeChange,
  fetchLineItemDetails
}) => {
  const [showDataNotice, setShowDataNotice] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTagKey, setSelectedTagKey] = useState(null);
  const [selectedTagValue, setSelectedTagValue] = useState(null);
  const [processedData, setProcessedData] = useState({
    monthlyData: { labels: [], values: [] },
    categoryData: {},
    projectData: {},
    productData: {},
    summary: {
      totalAmount: 0,
      invoiceCount: 0,
      totalItems: 0,
      trendText: 'N/A',
      forecastAmount: 0,
      confidenceText: ''
    }
  });
  const [projectData, setProjectData] = useState({});
  const [tagData, setTagData] = useState({
    tagKeys: [],
    tagValuesByKey: {}
  });

  // Process data when invoices, summaries, or time range changes - for main charts
  useEffect(() => {
    if (allInvoices.length > 0 && allInvoiceSummaries.length > 0) {
      const data = processData(allInvoices, allInvoiceSummaries, timeRange);
      setProcessedData(data);
    }
  }, [allInvoices, allInvoiceSummaries, timeRange]);

  // Process project data separately
  useEffect(() => {
    if (detailedLineItems.length > 0 && allInvoices.length > 0) {
      const data = processProjectData(detailedLineItems, timeRange, allInvoices);
      setProjectData(data);
    }
  }, [detailedLineItems, allInvoices, timeRange]);
  
  // Process tag data
  useEffect(() => {
    if (detailedLineItems.length > 0 && allInvoices.length > 0) {
      const data = processTagData(detailedLineItems, timeRange, allInvoices);
      setTagData(data);
      console.log("Processed tag data:", data);
    }
  }, [detailedLineItems, allInvoices, timeRange]);

  // Download full billing data as CSV
  const downloadBillingCSV = () => {
    const csvRows = ['Invoice ID,Period,Date,Amount,Category,Project,Product,Item Amount'];
    allInvoiceSummaries.forEach(summary => {
      const invoice = allInvoices.find(inv => inv.invoice_uuid === summary.invoice_uuid) || {};
      const productItems = (summary.product_charges && summary.product_charges.items) || [];
      const overageItems = (summary.overages && summary.overages.items) || [];
      
      [...productItems, ...overageItems].forEach(item => {
        const row = [
          summary.invoice_uuid,
          invoice.invoice_period || 'N/A',
          invoice.created_at ? new Date(invoice.created_at).toISOString().slice(0, 10) : 'N/A',
          invoice.amount || '0',
          item.name || item.group_description || item.description || 'Unknown',
          item.project_name || item.resource_id || item.resource_name || 'Unassigned',
          item.name || item.product || item.type || 'Unknown',
          item.amount || '0'
        ].map(val => `"${val}"`).join(',');
        csvRows.push(row);
      });
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `do_billing_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle category click for drill-down
  const handleCategoryClick = (category) => {
    console.log(`Selected category: ${category}`);
    setSelectedCategory(category);
    // Reset tag selection when category is selected
    setSelectedTagKey(null);
    setSelectedTagValue(null);
  };

  // Handle tag click for drill-down
  const handleTagClick = (tagKey, tagValue) => {
    console.log(`Selected tag: ${tagKey}=${tagValue}`);
    setSelectedTagKey(tagKey);
    setSelectedTagValue(tagValue);
    // Reset category selection when tag is selected
    setSelectedCategory(null);
  };

  // Close data notice
  const closeDataNotice = () => {
    setShowDataNotice(false);
  };

  return (
    <div className="container">
      <header>
        <h1>DigitalOcean FinOps Dashboard</h1>
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
          <button onClick={downloadBillingCSV} disabled={isLoading || allInvoices.length === 0}>
            Download CSV
          </button>
          <button onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {showDataNotice && apiToken && (
        <div className="data-source-notice">
          Connected to DigitalOcean API - Using real billing data 
          <button className="close-btn" onClick={closeDataNotice}>×</button>
        </div>
      )}

      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-spinner"></div> Loading your DigitalOcean billing data...
        </div>
      )}

      {error && !isLoading && (
        <div className="alert">
          {error} 
          <button className="close-btn" onClick={() => {}}>×</button>
        </div>
      )}

      {!isLoading && (
        <>
          <SummaryCards summary={processedData.summary} />

          <div className="chart-container">
            <h3 className="chart-title">Monthly Spend Trend</h3>
            <div className="chart">
              <MonthlyChart data={processedData.monthlyData} />
            </div>
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
                <ProjectChart 
                  data={Object.keys(projectData).length > 0 ? projectData : processedData.projectData} 
                />
              </div>
            </div>
          </div>

          {/* Line Items Chart Section */}
          <div className="chart-container scrollable">
            <h3 className="chart-title">
              {selectedCategory ? `Line Items: ${selectedCategory}` : 
               (selectedTagKey && selectedTagValue) ? `Resources Tagged with ${selectedTagKey}=${selectedTagValue}` : 
               'Detailed Line Items'}
            </h3>
            <div className="chart" style={{ 
              height: (selectedCategory || (selectedTagKey && selectedTagValue)) ? "600px" : "550px",
              overflowY: (selectedCategory || (selectedTagKey && selectedTagValue)) ? "auto" : "hidden" // Add scroll when needed
            }}>
              {selectedCategory ? (
                <LineItemExplorer
                  detailedLineItems={detailedLineItems}
                  selectedCategory={selectedCategory}
                  onBack={() => setSelectedCategory(null)}
                  timeRange={timeRange}
                />
              ) : (selectedTagKey && selectedTagValue) ? (
                <TagItemExplorer
                  detailedLineItems={detailedLineItems}
                  selectedTagKey={selectedTagKey}
                  selectedTagValue={selectedTagValue}
                  onBack={() => {
                    setSelectedTagKey(null);
                    setSelectedTagValue(null);
                  }}
                  timeRange={timeRange}
                />
              ) : (
                <DetailedLineItemsChart 
                  detailedLineItems={detailedLineItems}
                  timeRange={timeRange}
                  onCategoryClick={handleCategoryClick}
                />
              )}
            </div>
          </div>

          <div className="chart-container">
            <h3 className="chart-title">Spend by Product</h3>
            <div className="chart">
              <ProductChart data={processedData.productData} />
            </div>
          </div>
          
          {/* Tag Chart Section */}
          <div className="chart-container">
            <h3 className="chart-title">Spend by Tags</h3>
            {tagData.tagKeys.length === 0 ? (
              <div className="note" style={{ marginBottom: "10px", color: "#666", fontSize: "14px", padding: "20px" }}>
                <p>No tag data available in your line items.</p>
                <p style={{ marginTop: "10px" }}>
                  To use this feature, ensure your DigitalOcean resources are tagged and tag data is included in the API response. 
                  Tags help allocate costs to business units, projects, or environments.
                </p>
              </div>
            ) : (
              <div className="chart" style={{ height: "400px" }}>
                <TagChart 
                  detailedLineItems={detailedLineItems}
                  timeRange={timeRange}
                  onTagClick={handleTagClick}
                />
              </div>
            )}
          </div>

          <InvoiceTable 
            invoices={allInvoices} 
            timeRange={timeRange} 
            apiToken={apiToken} 
          />
        </>
      )}
    </div>
  );
};