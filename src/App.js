import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { AccountSelector } from './components/AccountSelector';
import './App.css';

// Import new CSV and storage utilities
import { fetchAllInvoiceData, processCSVDataForVisualizations } from './utils/csvUtils';
import { saveData, loadData, needsRefresh, clearAccountData, getCacheStatus } from './utils/storageUtils';

function App() {
  // Multi-account state
  const [accounts, setAccounts] = useState([]);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  
  // Account data cache - stores data for each account to avoid reloading
  const [accountsData, setAccountsData] = useState({});
  
  // Current view state - what's displayed in the UI
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [allInvoices, setAllInvoices] = useState([]);
  const [allInvoiceSummaries, setAllInvoiceSummaries] = useState([]); // Will be derived from CSV
  const [detailedLineItems, setDetailedLineItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('6months');
  const [statusMessage, setStatusMessage] = useState('');
  const [processedData, setProcessedData] = useState(null);
  const [cacheStatus, setCacheStatus] = useState({ isCached: false });

  useEffect(() => {
    // Check for stored accounts and auto-login
    const storedAccounts = localStorage.getItem('doAccounts');
    if (storedAccounts) {
      const parsedAccounts = JSON.parse(storedAccounts);
      if (parsedAccounts.length > 0) {
        setAccounts(parsedAccounts);
        setIsLoggedIn(true);
        
        // Load data for the first account by default
        const firstAccount = parsedAccounts[0];
        loadAccountData(firstAccount.token, firstAccount.name);
      }
    }
  }, []);

  // New function to load account data, with caching
  const loadAccountData = async (token, accountId) => {
    setIsLoading(true);
    setError('');
    setStatusMessage('');
    
    // Check if we have cached data
    const cachedStatus = getCacheStatus(accountId);
    setCacheStatus(cachedStatus);
    
    const shouldRefresh = !cachedStatus.isCached || cachedStatus.isStale || needsRefresh(accountId, 'csvLineItems');
    
    // If we have cached data and it's fresh enough, use it
    if (cachedStatus.isCached && !shouldRefresh) {
      console.log(`Using cached data for account ${accountId}`);
      const cachedLineItems = loadData(accountId, 'csvLineItems');
      const cachedInvoices = loadData(accountId, 'invoices');
      const cachedProcessedData = loadData(accountId, 'processedData');
      
      if (cachedLineItems?.data && cachedInvoices?.data) {
        setDetailedLineItems(cachedLineItems.data);
        setAllInvoices(cachedInvoices.data);
        
        // Either use cached processed data or process the line items again
        if (cachedProcessedData?.data) {
          setProcessedData(cachedProcessedData.data);
        } else {
          const freshProcessed = processCSVDataForVisualizations(cachedLineItems.data);
          setProcessedData(freshProcessed);
          // Cache the processed data for faster loading next time
          saveData(accountId, 'processedData', freshProcessed);
        }
        
        // Store in the account cache
        setAccountsData(prevData => ({
          ...prevData,
          [accountId]: {
            invoices: cachedInvoices.data,
            detailedLineItems: cachedLineItems.data,
            processedData: cachedProcessedData?.data || processCSVDataForVisualizations(cachedLineItems.data)
          }
        }));
        
        setStatusMessage(`Using cached data from ${cachedStatus.formattedDate}`);
        setIsLoading(false);
        
        // If it's getting stale, refresh in the background
        if (cachedStatus.hoursSinceUpdate > 20) {
          setStatusMessage(`Using cached data from ${cachedStatus.formattedDate}. Refreshing in background...`);
          setTimeout(() => {
            fetchDataFromAPI(token, accountId, true);
          }, 1000);
        }
        
        return;
      }
    }
    
    // If we don't have cached data or it needs refresh, fetch from API
    await fetchDataFromAPI(token, accountId);
  };

  // Fetch data from Digital Ocean API and process as CSV
  const fetchDataFromAPI = async (token, accountId, isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setIsLoading(true);
      setError('');
    }
    
    try {
      console.log(`Fetching data from API for account: ${accountId}...`);
      
      // Fetch all invoice data with CSVs
      const { invoices, lineItems } = await fetchAllInvoiceData(token);
      
      console.log(`Fetched ${invoices.length} invoices and ${lineItems.length} line items`);
      
      if (invoices.length === 0) {
        setError('No invoices found for this account.');
        setIsLoading(false);
        return;
      }
      
      // Process the data for visualizations
      const processedData = processCSVDataForVisualizations(lineItems);
      
      // Save to local storage
      saveData(accountId, 'invoices', invoices);
      saveData(accountId, 'csvLineItems', lineItems);
      saveData(accountId, 'processedData', processedData);
      
      // Update the cache status
      setCacheStatus(getCacheStatus(accountId));
      
      // Update the app state
      setAllInvoices(invoices);
      setDetailedLineItems(lineItems);
      setProcessedData(processedData);
      
      // Store in the account cache for quick switching
      setAccountsData(prevData => ({
        ...prevData,
        [accountId]: {
          invoices: invoices,
          detailedLineItems: lineItems,
          processedData: processedData
        }
      }));
      
      if (isBackgroundRefresh) {
        setStatusMessage(`Data refreshed at ${new Date().toLocaleString()}`);
      } else {
        setStatusMessage('');
        setIsLoading(false);
      }
    } catch (apiError) {
      console.error('API Error:', apiError);
      
      if (!isBackgroundRefresh) {
        // Try to use cached data as fallback
        const cachedLineItems = loadData(accountId, 'csvLineItems');
        const cachedInvoices = loadData(accountId, 'invoices');
        
        if (cachedLineItems?.data && cachedInvoices?.data) {
          setError('Error connecting to DigitalOcean API. Using cached data.');
          setDetailedLineItems(cachedLineItems.data);
          setAllInvoices(cachedInvoices.data);
          
          // Process or load cached processed data
          const cachedProcessedData = loadData(accountId, 'processedData');
          if (cachedProcessedData?.data) {
            setProcessedData(cachedProcessedData.data);
          } else {
            setProcessedData(processCSVDataForVisualizations(cachedLineItems.data));
          }
        } else {
          setError('Error connecting to DigitalOcean API. CORS issues may prevent direct API access from a browser. Try using a browser extension or setting up a proxy server.');
        }
        
        setIsLoading(false);
      } else {
        // If it's a background refresh, don't disrupt the user
        setStatusMessage('Background refresh failed. Will try again later.');
      }
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
    loadAccountData(token, name);
  };

  // Handle switching between accounts with data caching
  const handleAccountSwitch = (index) => {
    if (index >= 0 && index < accounts.length) {
      setCurrentAccountIndex(index);
      
      const account = accounts[index];
      const accountId = account.name;
      
      // Check if we already have data for this account in memory
      if (accountsData[accountId]) {
        console.log(`Using cached in-memory data for account: ${accountId}`);
        
        // Use in-memory cached data for this account
        setAllInvoices(accountsData[accountId].invoices);
        setDetailedLineItems(accountsData[accountId].detailedLineItems);
        setProcessedData(accountsData[accountId].processedData);
        
        // Check if we should refresh in the background
        const cachedStatus = getCacheStatus(accountId);
        setCacheStatus(cachedStatus);
        
        if (cachedStatus.isCached && cachedStatus.hoursSinceUpdate > 24) {
          setStatusMessage(`Using cached data from ${cachedStatus.formattedDate}. Refreshing in background...`);
          setTimeout(() => {
            fetchDataFromAPI(account.token, accountId, true);
          }, 1000);
        }
      } else {
        console.log(`No cached data for account: ${accountId}, loading...`);
        
        // Load data for this account
        loadAccountData(account.token, accountId);
      }
    }
  };

  // Handle removing an account
  const handleRemoveAccount = (index) => {
    // Create a copy of accounts without the one being removed
    const updatedAccounts = [...accounts];
    const removedAccount = updatedAccounts.splice(index, 1)[0];
    
    // Update state and localStorage
    setAccounts(updatedAccounts);
    localStorage.setItem('doAccounts', JSON.stringify(updatedAccounts));
    
    // Also remove this account's data from cache
    if (removedAccount) {
      setAccountsData(prevData => {
        const newData = { ...prevData };
        delete newData[removedAccount.name];
        return newData;
      });
      
      // Clear local storage for this account
      clearAccountData(removedAccount.name);
    }
    
    // Handle what happens after removal
    if (updatedAccounts.length === 0) {
      // No accounts left, go back to login
      setIsLoggedIn(false);
    } else if (index === currentAccountIndex) {
      // Current account was removed, switch to first account
      setCurrentAccountIndex(0);
      
      // Load data for the first account
      const firstAccount = updatedAccounts[0];
      if (accountsData[firstAccount.name]) {
        // Use cached data if available
        setAllInvoices(accountsData[firstAccount.name].invoices);
        setDetailedLineItems(accountsData[firstAccount.name].detailedLineItems);
        setProcessedData(accountsData[firstAccount.name].processedData);
        
        // Check if we should refresh
        const cachedStatus = getCacheStatus(firstAccount.name);
        setCacheStatus(cachedStatus);
      } else {
        // Fetch data if not cached
        loadAccountData(firstAccount.token, firstAccount.name);
      }
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
    setDetailedLineItems([]);
    setProcessedData(null);
    // Clear the account data cache as well
    setAccountsData({});
    setStatusMessage('');
  };

  // Handle refresh (current account)
  const handleRefresh = () => {
    if (accounts.length > 0 && currentAccountIndex < accounts.length) {
      const account = accounts[currentAccountIndex];
      // Force refresh by fetching new data for the current account
      fetchDataFromAPI(account.token, account.name);
    }
  };

  // Handle clearing cache (current account)
  const handleClearCache = () => {
    if (accounts.length > 0 && currentAccountIndex < accounts.length) {
      const account = accounts[currentAccountIndex];
      if (window.confirm(`Are you sure you want to clear cached data for ${account.name}?`)) {
        clearAccountData(account.name);
        // Remove from in-memory cache
        setAccountsData(prevData => {
          const newData = { ...prevData };
          delete newData[account.name];
          return newData;
        });
        // Fetch fresh data
        fetchDataFromAPI(account.token, account.name);
      }
    }
  };

  // Handle time range change
  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
  };

  // Fetch line item details for a specific invoice if needed
  // With the CSV approach, this might not be needed since we already have detailed data
  const fetchLineItemDetails = async (invoiceId) => {
    if (accounts.length === 0 || currentAccountIndex >= accounts.length || !invoiceId) {
      return null;
    }
    
    // Find line items for this invoice from our detailed line items
    const invoiceItems = detailedLineItems.filter(item => item.invoice_uuid === invoiceId);
    
    if (invoiceItems && invoiceItems.length > 0) {
      // We already have the data, return it structured as expected
      return {
        invoice_uuid: invoiceId,
        invoice_items: invoiceItems
      };
    }
    
    // If we don't have the data, try fetching it from API as a fallback
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
            processedData={processedData}
            isLoading={isLoading}
            error={error}
            statusMessage={statusMessage}
            cacheStatus={cacheStatus}
            apiToken={accounts[currentAccountIndex]?.token}
            timeRange={timeRange}
            onLogout={handleLogout}
            onRefresh={handleRefresh}
            onClearCache={handleClearCache}
            onTimeRangeChange={handleTimeRangeChange}
            fetchLineItemDetails={fetchLineItemDetails}
          />
        </>
      )}
    </div>
  );
}

export default App;