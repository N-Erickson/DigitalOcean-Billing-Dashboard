import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { AccountSelector } from './components/AccountSelector';
import './App.css';

function App() {
  // Multi-account state
  const [accounts, setAccounts] = useState([]);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  
  // Original state - now per account
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [allInvoices, setAllInvoices] = useState([]);
  const [allInvoiceSummaries, setAllInvoiceSummaries] = useState([]);
  const [detailedLineItems, setDetailedLineItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('6months');

  useEffect(() => {
    // Check for stored accounts and auto-login
    const storedAccounts = localStorage.getItem('doAccounts');
    if (storedAccounts) {
      const parsedAccounts = JSON.parse(storedAccounts);
      if (parsedAccounts.length > 0) {
        setAccounts(parsedAccounts);
        setIsLoggedIn(true);
        
        // Load data for the first account by default
        fetchInvoicesFromAPI(parsedAccounts[0].token);
      }
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
      
      // Count items with detailed descriptions
      const itemsWithDesc = allLineItems.filter(item => item.description && item.description.length > 5).length;
      console.log(`Items with detailed description: ${itemsWithDesc} out of ${allLineItems.length} (${((itemsWithDesc/allLineItems.length)*100).toFixed(1)}%)`);
      
      return allLineItems;
    } catch (error) {
      console.error("Error fetching detailed invoice data:", error);
      return [];
    }
  };

  // Fetch invoices from Digital Ocean API with pagination support
  const fetchInvoicesFromAPI = async (token) => {
    setIsLoading(true);
    setError('');
    
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      console.log("Fetching invoices list with pagination...");
      
      // Initialize variables for pagination
      let allInvoices = [];
      let hasMorePages = true;
      let pageUrl = 'https://api.digitalocean.com/v2/customers/my/invoices?per_page=100'; // Request 100 per page
      
      // Fetch all pages
      while (hasMorePages) {
        console.log(`Fetching invoices page: ${pageUrl}`);
        const response = await fetch(pageUrl, { 
          method: 'GET', 
          headers 
        });
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        const pageInvoices = data.invoices || [];
        allInvoices = [...allInvoices, ...pageInvoices];
        
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
      
      setAllInvoices(allInvoices);
      console.log(`Retrieved ${allInvoices.length} total invoices`);
      
      // Fetch both regular summaries and detailed project data
      console.log("Fetching invoice summaries...");
      const summaries = await fetchAllInvoiceSummaries(allInvoices, headers);
      setAllInvoiceSummaries(summaries);
      console.log(`Retrieved ${summaries.length} invoice summaries`, summaries.slice(0, 5));
      
      // Get detailed invoice data with project information
      const lineItems = await fetchDetailedInvoiceData(allInvoices, token);
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

  // Handle adding a new account
  const handleAddAccount = (name, token) => {
    // Create new account object
    const newAccount = { name, token };
    
    // Update accounts list
    const updatedAccounts = [...accounts, newAccount];
    setAccounts(updatedAccounts);
    
    // Store in localStorage
    localStorage.setItem('doAccounts', JSON.stringify(updatedAccounts));
    
    // Set as current account if it's the first one
    if (updatedAccounts.length === 1) {
      setCurrentAccountIndex(0);
    }
    
    setIsLoggedIn(true);
    fetchInvoicesFromAPI(token);
  };

  // Handle switching between accounts
  const handleAccountSwitch = (index) => {
    if (index >= 0 && index < accounts.length) {
      setCurrentAccountIndex(index);
      fetchInvoicesFromAPI(accounts[index].token);
    }
  };

  // Handle removing an account
  const handleRemoveAccount = (index) => {
    // Create a copy of accounts without the one being removed
    const updatedAccounts = [...accounts];
    updatedAccounts.splice(index, 1);
    
    // Update state and localStorage
    setAccounts(updatedAccounts);
    localStorage.setItem('doAccounts', JSON.stringify(updatedAccounts));
    
    // Handle what happens after removal
    if (updatedAccounts.length === 0) {
      // No accounts left, go back to login
      setIsLoggedIn(false);
    } else if (index === currentAccountIndex) {
      // Current account was removed, switch to first account
      setCurrentAccountIndex(0);
      fetchInvoicesFromAPI(updatedAccounts[0].token);
    } else if (index < currentAccountIndex) {
      // Account before current was removed, adjust index
      setCurrentAccountIndex(currentAccountIndex - 1);
    }
  };

  // Handle logout (all accounts)
  const handleLogout = () => {
    localStorage.removeItem('doAccounts');
    setAccounts([]);
    setCurrentAccountIndex(0);
    setIsLoggedIn(false);
    setAllInvoices([]);
    setAllInvoiceSummaries([]);
    setDetailedLineItems([]);
  };

  // Handle refresh (current account)
  const handleRefresh = () => {
    if (accounts.length > 0 && currentAccountIndex < accounts.length) {
      fetchInvoicesFromAPI(accounts[currentAccountIndex].token);
    }
  };

  // Handle time range change
  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
  };

  // Fetch additional line item details for a specific invoice
  const fetchLineItemDetails = async (invoiceId) => {
    if (accounts.length === 0 || currentAccountIndex >= accounts.length || !invoiceId) {
      return null;
    }
    
    try {
      const headers = {
        'Authorization': `Bearer ${accounts[currentAccountIndex].token}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(
        `https://api.digitalocean.com/v2/customers/my/invoices/${invoiceId}`,
        { method: 'GET', headers }
      );
      
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching line item details for invoice ${invoiceId}:`, error);
      return null;
    }
  };

  return (
    <div className="App">
      {!isLoggedIn ? (
        <LoginForm onAddAccount={handleAddAccount} />
      ) : (
        <>
          {/* Account Selector is now floating and not part of the main layout */}
          <AccountSelector 
            accounts={accounts}
            currentIndex={currentAccountIndex}
            onSwitchAccount={handleAccountSwitch}
            onRemoveAccount={handleRemoveAccount}
            onAddAccount={handleAddAccount}
          />
          <Dashboard 
            accountName={accounts[currentAccountIndex]?.name || 'Unknown Account'}
            allInvoices={allInvoices}
            allInvoiceSummaries={allInvoiceSummaries}
            detailedLineItems={detailedLineItems}
            isLoading={isLoading}
            error={error}
            apiToken={accounts[currentAccountIndex]?.token}
            timeRange={timeRange}
            onLogout={handleLogout}
            onRefresh={handleRefresh}
            onTimeRangeChange={handleTimeRangeChange}
            fetchLineItemDetails={fetchLineItemDetails}
          />
        </>
      )}
    </div>
  );
}

export default App;