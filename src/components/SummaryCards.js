import React from 'react';
import { formatCurrency } from '../utils/dataUtils';

export const SummaryCards = ({ summary, accountName }) => {
  const { totalAmount, invoiceCount, totalItems, trendText, forecastAmount, confidenceText } = summary;

  // Helper to create trend indicator with color
  const renderTrendIndicator = (trend) => {
    if (!trend || trend === 'N/A') {
      return <span style={{ color: '#6b7280' }}>{trend}</span>;
    }
    
    const isUp = trend.startsWith('Up');
    const color = isUp ? '#ef4444' : '#10b981'; // Red for up, green for down
    const icon = isUp ? '↑' : '↓';
    
    return (
      <span style={{ color, fontWeight: '500' }}>
        {icon} {trend}
      </span>
    );
  };

  // Helper to create confidence level indicator
  const renderConfidenceLevel = (text) => {
    if (!text) return null;
    
    // Extract the percentage if available
    const percentMatch = text.match(/±(\d+)%/);
    const percent = percentMatch ? parseInt(percentMatch[1]) : 0;
    
    // Determine confidence level
    let confidenceLevel = 'high';
    let color = '#10b981'; // green
    
    if (percent > 15) {
      confidenceLevel = 'low';
      color = '#ef4444'; // red
    } else if (percent > 8) {
      confidenceLevel = 'medium';
      color = '#f59e0b'; // amber
    }
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '8px' }}>
        <div style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: color 
        }}></div>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {text}
        </span>
      </div>
    );
  };

  return (
    <div className="card-grid">
      <div className="card">
        <h3 className="card-title">Total Spend - {accountName}</h3>
        <p className="card-value">{formatCurrency(totalAmount)}</p>
      </div>
      <div className="card">
        <h3 className="card-title">Invoices Processed</h3>
        <p className="card-value">{invoiceCount}</p>
      </div>
      <div className="card">
        <h3 className="card-title">Line Items</h3>
        <p className="card-value">{totalItems}</p>
      </div>
      <div className="card">
        <h3 className="card-title">Spend Trend</h3>
        <p className="card-value">{renderTrendIndicator(trendText)}</p>
        <p className="card-note">
          Month-over-month change
        </p>
      </div>
      <div className="card">
        <h3 className="card-title">Next Month Forecast</h3>
        <p className="card-value">{formatCurrency(forecastAmount)}</p>
        {renderConfidenceLevel(confidenceText)}
      </div>
    </div>
  );
};