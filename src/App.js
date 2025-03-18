import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [allInvoices, setAllInvoices] = useState([]);
  const [allInvoiceSummaries, setAllInvoiceSummaries] = useState([]);
  const [detailedLineItems, setDetailedLineItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('6months');

  useEffect(() => {
    // Check for stored token and auto-login
    const storedToken = localStorage.getItem('doApiToken');
    if (storedToken) {
      setApiToken(storedToken);
      setIsLoggedIn(true);
      fetchInvoicesFromAPI(storedToken);
    }
  }, []);

  // Fetch detailed invoice data with project information - with pagination support
  const fetchDetailedInvoiceData = async (invoices, token) => {
    try {
      console.log("Fetching detailed invoice data with project information...");
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      const allLineItems = [];
      
      // Process each invoice to get detailed line items with project info
      for (const invoice of invoices) {
        console.log(`Fetching detailed data for invoice ${invoice.invoice_uuid}...`);
        
        let hasMorePages = true;
        let pageUrl = `https://api.digitalocean.com/v2/customers/my/invoices/${invoice.invoice_uuid}?per_page=100`;
        
        while (hasMorePages) {
          const detailedResponse = await fetch(pageUrl, {
            method: 'GET',
            headers
          });
          
          if (!detailedResponse.ok) {
            console.error(`Error fetching detailed invoice ${invoice.invoice_uuid}: ${detailedResponse.status}`);
            break;
          }
          
          const detailedData = await detailedResponse.json();
          
          // Extract line items with project information
          const lineItems = detailedData.invoice_items || [];
          
          // Add invoice information to each line item
          const processedItems = lineItems.map(item => ({
            ...item,
            invoice_uuid: invoice.invoice_uuid,
            invoice_period: invoice.invoice_period,
            invoice_date: invoice.date || invoice.created_at
          }));
          
          allLineItems.push(...processedItems);
          console.log(`Added ${processedItems.length} line items from invoice ${invoice.invoice_uuid}`);
          
          // Check for more pages
          if (detailedData.links && detailedData.links.pages && detailedData.links.pages.next) {
            pageUrl = detailedData.links.pages.next;
          } else if (detailedResponse.headers && detailedResponse.headers.get('Link')) {
            const linkHeader = detailedResponse.headers.get('Link');
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
      }
      
      console.log(`Total line items with project information: ${allLineItems.length}`);
      
      // Count items with project names
      const itemsWithProject = allLineItems.filter(item => item.project_name).length;
      console.log(`Items with project_name: ${itemsWithProject} out of ${allLineItems.length} (${((itemsWithProject/allLineItems.length)*100).toFixed(1)}%)`);
      
      return allLineItems;
    } catch (error) {
      console.error("Error fetching detailed invoice data:", error);
      return [];
    }
  };

  // Fetch invoices from Digital Ocean API
  const fetchInvoicesFromAPI = async (token) => {
    setIsLoading(true);
    setError('');
    
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      console.log("Fetching invoices list...");
      const response = await fetch('https://api.digitalocean.com/v2/customers/my/invoices', { 
        method: 'GET', 
        headers 
      });
      
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();
      const invoices = data.invoices || [];
      setAllInvoices(invoices);
      console.log(`Retrieved ${invoices.length} invoices`, invoices);
      
      // Fetch both regular summaries and detailed project data
      console.log("Fetching invoice summaries...");
      const summaries = await fetchAllInvoiceSummaries(invoices, headers);
      setAllInvoiceSummaries(summaries);
      console.log(`Retrieved ${summaries.length} invoice summaries`, summaries.slice(0, 5));
      
      // Get detailed invoice data with project information
      const lineItems = await fetchDetailedInvoiceData(invoices, token);
      setDetailedLineItems(lineItems);
      
      setIsLoading(false);
    } catch (apiError) {
      console.error('API Error:', apiError);
      setError('Error connecting to DigitalOcean API. CORS issues may prevent direct API access from a browser. Set up a backend proxy server to handle API requests.');
      setIsLoading(false);
    }
  };

  // Fetch summaries for all invoices
  const fetchAllInvoiceSummaries = async (invoicesList, headers) => {
    const allSummaries = [];
    for (const invoice of invoicesList) {
      if (invoice.preview) continue; // Skip preview invoices
      console.log(`Fetching summary for invoice ${invoice.invoice_uuid}...`);
      const summary = await fetchInvoiceSummary(invoice.invoice_uuid, headers);
      if (summary) allSummaries.push(summary);
    }
    return allSummaries;
  };

  // Fetch summary for a single invoice
  const fetchInvoiceSummary = async (invoiceId, headers) => {
    try {
      const response = await fetch(
        `https://api.digitalocean.com/v2/customers/my/invoices/${invoiceId}/summary`,
        { method: 'GET', headers }
      );
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      
      const data = await response.json();
      console.log(`Retrieved summary for invoice ${invoiceId}`, data);
      return { invoice_uuid: invoiceId, ...data };
    } catch (err) {
      console.error(`Error fetching summary for invoice ${invoiceId}:`, err);
      return null;
    }
  };

  // Handle login
  const handleLogin = (token) => {
    localStorage.setItem('doApiToken', token);
    setApiToken(token);
    setIsLoggedIn(true);
    fetchInvoicesFromAPI(token);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('doApiToken');
    setApiToken('');
    setIsLoggedIn(false);
    setAllInvoices([]);
    setAllInvoiceSummaries([]);
    setDetailedLineItems([]);
  };

  // Handle refresh
  const handleRefresh = () => {
    if (apiToken) {
      fetchInvoicesFromAPI(apiToken);
    }
  };

  // Handle time range change
  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
  };

  return (
    <div className="App">
      {!isLoggedIn ? (
        <LoginForm onLogin={handleLogin} />
      ) : (
        <Dashboard 
          allInvoices={allInvoices}
          allInvoiceSummaries={allInvoiceSummaries}
          detailedLineItems={detailedLineItems}
          isLoading={isLoading}
          error={error}
          apiToken={apiToken}
          timeRange={timeRange}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
          onTimeRangeChange={handleTimeRangeChange}
        />
      )}
    </div>
  );
}

export default App;