import React, { useState } from 'react';

export const AccountSelector = ({ 
  accounts,
  currentIndex,
  onSwitchAccount,
  onRemoveAccount,
  onAddAccount
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountToken, setNewAccountToken] = useState('');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Handle form submission for new account
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!newAccountName.trim()) {
      setError('Please enter an account name');
      return;
    }
    
    if (!newAccountToken.trim()) {
      setError('Please enter an API token');
      return;
    }
    
    // Call the parent function to add the account
    onAddAccount(newAccountName.trim(), newAccountToken.trim());
    
    // Reset form
    setNewAccountName('');
    setNewAccountToken('');
    setShowAddForm(false);
    setError('');
  };

  // Toggle add form display
  const toggleAddForm = () => {
    setShowAddForm(!showAddForm);
    setError('');
  };
  
  // Toggle slide-out menu
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };
  
  // Close the menu after an action (optional)
  const handleAccountAction = (action) => {
    action();
    // Optionally close the menu after action
    // setMenuOpen(false);
  };

  return (
    <div className="account-selector-container">
      {/* Account Menu Button - Always Visible */}
      <button 
        className={`account-menu-toggle ${menuOpen ? 'active' : ''}`}
        onClick={toggleMenu}
      >
        <span className="current-account-name">
          {accounts.length > 0 ? accounts[currentIndex]?.name : 'Accounts'}
        </span>
        <span className="menu-icon">{menuOpen ? '×' : '☰'}</span>
      </button>
      
      {/* Slide-out Account Panel */}
      <div className={`account-panel ${menuOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <h2>Account Manager</h2>
          <button className="close-panel" onClick={toggleMenu}>×</button>
        </div>
        
        {/* Current Account Info */}
        {accounts.length > 0 && (
          <div className="current-account-info">
            <h3>Current Account</h3>
            <div className="account-badge">
              {accounts[currentIndex]?.name || 'Unknown'}
            </div>
          </div>
        )}
        
        {/* Account Actions */}
        <div className="account-actions">
          <button 
            onClick={toggleAddForm}
            className="add-account-btn"
          >
            {showAddForm ? 'Cancel Adding' : 'Add Account'}
          </button>
          
          {accounts.length > 1 && (
            <div className="account-switcher">
              <label htmlFor="accountDropdown">Switch to:</label>
              <select 
                id="accountDropdown"
                value={currentIndex}
                onChange={(e) => onSwitchAccount(parseInt(e.target.value))}
                className="account-dropdown"
              >
                {accounts.map((account, index) => (
                  <option key={index} value={index}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        {/* Add Account Form */}
        {showAddForm && (
          <div className="add-account-form">
            <h3>Add New Account</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="accountName">Account Name:</label>
                <input 
                  type="text" 
                  id="accountName" 
                  placeholder="e.g., Production, Development, etc."
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="apiToken">Digital Ocean API Token:</label>
                <input 
                  type="password" 
                  id="apiToken" 
                  placeholder="Enter API token with billing read access"
                  value={newAccountToken}
                  onChange={(e) => setNewAccountToken(e.target.value)}
                />
              </div>
              
              <div className="form-buttons">
                <button type="submit">Add Account</button>
              </div>
            </form>
            
            {error && (
              <div className="alert" style={{ marginTop: '10px' }}>
                <span>{error}</span> 
                <button className="close-btn" onClick={() => setError('')}>×</button>
              </div>
            )}
          </div>
        )}
        
        {/* Accounts List */}
        {accounts.length > 0 && (
          <div className="accounts-list">
            <h3>Manage Accounts</h3>
            <ul>
              {accounts.map((account, index) => (
                <li key={index} className={index === currentIndex ? 'active' : ''}>
                  <span className="account-name">{account.name}</span>
                  <div className="account-controls">
                    <button 
                      onClick={() => onSwitchAccount(index)}
                      disabled={index === currentIndex}
                      className="switch-btn"
                    >
                      Switch
                    </button>
                    <button 
                      onClick={() => onRemoveAccount(index)}
                      className="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Overlay for closing the menu when clicking outside */}
      {menuOpen && <div className="account-panel-overlay" onClick={toggleMenu}></div>}
    </div>
  );
};