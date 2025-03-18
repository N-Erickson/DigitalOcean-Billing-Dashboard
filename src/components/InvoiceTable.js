import React from 'react';
import { formatCurrency, filterInvoicesByTimeRange } from '../utils/dataUtils';

export const InvoiceTable = ({ invoices, timeRange, apiToken }) => {
  const filteredInvoices = filterInvoicesByTimeRange(invoices, timeRange);
  
  const downloadInvoiceCSV = async (uuid) => {
    if (!apiToken) {
      console.error('No API token found');
      return;
    }
    
    try {
      const response = await fetch(
        `https://api.digitalocean.com/v2/customers/my/invoices/${uuid}/csv`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);
      
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice_${uuid}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading invoice CSV:', err);
      alert('Failed to download invoice CSV. Check your API token or network.');
    }
  };

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    const periodA = a.invoice_period || '';
    const periodB = b.invoice_period || '';
    if (periodA && periodB) return periodB.localeCompare(periodA);
    const dateA = new Date(a.date || a.created_at || 0);
    const dateB = new Date(b.date || b.created_at || 0);
    return dateB - dateA;
  });

  return (
    <div className="table-container">
      <h3 className="chart-title">Recent Invoices</h3>
      <table>
        <thead>
          <tr>
            <th>Invoice ID</th>
            <th>Period</th>
            <th>Date</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sortedInvoices.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center' }}>
                No invoice data available for the selected time period
              </td>
            </tr>
          ) : (
            sortedInvoices.map(invoice => {
              const amount = parseFloat(invoice.amount) || 0;
              return (
                <tr key={invoice.invoice_uuid}>
                  <td>{invoice.invoice_uuid || 'Unknown'}</td>
                  <td>{invoice.invoice_period || 'N/A'}</td>
                  <td>
                    {invoice.date || 
                    (invoice.created_at ? new Date(invoice.created_at).toISOString().slice(0, 10) : 'N/A')}
                  </td>
                  <td>
                    {formatCurrency(amount)}
                    <button 
                      className="csv-btn" 
                      onClick={() => downloadInvoiceCSV(invoice.invoice_uuid)}
                    >
                      CSV
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};