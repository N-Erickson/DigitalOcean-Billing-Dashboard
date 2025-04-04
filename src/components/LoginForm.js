import React, { useState } from 'react';

export const LoginForm = ({ onAddAccount }) => {
  const [accountName, setAccountName] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!accountName.trim()) {
      setError('Please enter an account name');
      return;
    }
    
    if (!apiToken.trim()) {
      setError('Please enter your API token');
      return;
    }
    
    setLoading(true);
    setError('');
    
    // Call parent function to handle the new account
    onAddAccount(accountName.trim(), apiToken.trim());
    
    // Reset form
    setAccountName('');
    setApiToken('');
    setLoading(false);
  };

  const closeError = () => {
    setError('');
  };

  return (
    <div className="form-container">
      <h2 className="form-title">DigitalOcean FinOps Dashboard</h2>
      <p className="intro-text">
        Connect your DigitalOcean account(s) to visualize and analyze your billing data.
        You'll need an API token with read access to your billing data.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="accountName">Account Name:</label>
          <input 
            type="text" 
            id="accountName" 
            placeholder="e.g., Production, Development, etc."
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            disabled={loading}
            required
          />
          <small className="form-text">
            Give this account a meaningful name to identify it later
          </small>
        </div>
        
        <div className="form-group">
          <label htmlFor="apiToken">DigitalOcean API Token:</label>
          <input 
            type="password" 
            id="apiToken" 
            placeholder="Enter your API token"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            disabled={loading}
            required
          />
          <small className="form-text">
            Create a read-only token in your DigitalOcean account settings
          </small>
        </div>
        
        <button 
          type="submit" 
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Connect Account'}
        </button>
      </form>
      
      {error && (
        <div className="alert" style={{ marginTop: '20px' }}>
          <span>{error}</span> 
          <button className="close-btn" onClick={closeError}>×</button>
        </div>
      )}

      <div className="data-security-note" style={{ marginTop: '30px', fontSize: '0.9em', color: '#666' }}>
        <p><strong>Note:</strong> Your API tokens are stored only in your browser's local storage and are never sent to any third-party servers.</p>
      </div>
    </div>
  );
};