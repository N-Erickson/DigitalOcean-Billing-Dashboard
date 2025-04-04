import React from 'react';
import { formatCurrency } from '../utils/dataUtils';

export const SummaryCards = ({ summary, accountName }) => {
  const { totalAmount, invoiceCount, totalItems, trendText, forecastAmount, confidenceText } = summary;

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
        <p className="card-value">{trendText}</p>
      </div>
      <div className="card">
        <h3 className="card-title">Next Month Forecast</h3>
        <p className="card-value">{formatCurrency(forecastAmount)}</p>
        {confidenceText && <p className="card-note">{confidenceText}</p>}
      </div>
    </div>
  );
};