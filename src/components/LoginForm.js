import React, { useState } from 'react';

export const LoginForm = ({ onLogin }) => {
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!apiToken.trim()) {
      setError('Please enter your API token');
      return;
    }
    
    setLoading(true);
    setError('');
    onLogin(apiToken.trim());
  };

  const closeError = () => {
    setError('');
  };

  return (
    <div className="form-container">
      <h2 className="form-title">DigitalOcean FinOps Dashboard</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="apiToken">Digital Ocean API Token:</label>
          <input 
            type="password" 
            id="apiToken" 
            placeholder="Enter your API token"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
          />
        </div>
        <button 
          type="submit" 
          style={{ width: '100%' }}
          disabled={loading}
        >
          Connect to Digital Ocean
        </button>
      </form>
      {error && (
        <div className="alert" style={{ marginTop: '20px' }}>
          <span>{error}</span> 
          <button className="close-btn" onClick={closeError}>×</button>
        </div>
      )}
    </div>
  );
};