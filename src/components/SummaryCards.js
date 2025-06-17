import React from 'react';
import { formatCurrency } from '../utils/dataUtils';

export const SummaryCards = ({ summary, accountName }) => {
  const { 
    totalAmount, 
    invoiceCount, 
    totalItems, 
    discountItems = 0, 
    totalDiscountAmount = 0,
    trendText, 
    forecastAmount, 
    confidenceText 
  } = summary;

  // Calculate gross amount (before discounts)
  const grossAmount = totalAmount - totalDiscountAmount;

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

  // Helper to render discount savings indicator
  const renderDiscountSavings = () => {
    if (discountItems === 0 || totalDiscountAmount === 0) {
      return (
        <p className="card-note" style={{ color: '#6b7280' }}>
          No discounts applied
        </p>
      );
    }

    const savingsPercent = grossAmount !== 0 ? Math.abs((totalDiscountAmount / grossAmount) * 100) : 0;
    
    return (
      <div>
        <p className="card-note" style={{ color: '#10b981', fontWeight: '500' }}>
          {savingsPercent.toFixed(1)}% savings
        </p>
        <p className="card-note" style={{ color: '#6b7280', fontSize: '11px' }}>
          {discountItems} discount{discountItems !== 1 ? 's' : ''} applied
        </p>
      </div>
    );
  };

  return (
    <div className="card-grid">
      <div className="card">
        <h3 className="card-title">Net Spend - {accountName}</h3>
        <p className="card-value">{formatCurrency(totalAmount)}</p>
        {totalDiscountAmount < 0 && (
          <p className="card-note" style={{ color: '#6b7280' }}>
            After {formatCurrency(Math.abs(totalDiscountAmount))} in discounts
          </p>
        )}
      </div>
      
      {/* Show gross amount if there are discounts */}
      {totalDiscountAmount < 0 && (
        <div className="card">
          <h3 className="card-title">Gross Spend</h3>
          <p className="card-value">{formatCurrency(grossAmount)}</p>
          <p className="card-note" style={{ color: '#6b7280' }}>
            Before discounts
          </p>
        </div>
      )}
      
      {/* Show total discounts if any exist */}
      {totalDiscountAmount < 0 && (
        <div className="card">
          <h3 className="card-title">Total Discounts</h3>
          <p className="card-value" style={{ color: '#10b981' }}>
            {formatCurrency(Math.abs(totalDiscountAmount))}
          </p>
          {renderDiscountSavings()}
        </div>
      )}
      
      <div className="card">
        <h3 className="card-title">Invoices Processed</h3>
        <p className="card-value">{invoiceCount}</p>
      </div>
      
      <div className="card">
        <h3 className="card-title">Line Items</h3>
        <p className="card-value">{totalItems}</p>
        {discountItems > 0 && (
          <p className="card-note" style={{ color: '#6b7280' }}>
            Including {discountItems} discount{discountItems !== 1 ? 's' : ''}
          </p>
        )}
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