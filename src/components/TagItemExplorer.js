import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/dataUtils';

export const TagItemExplorer = ({ 
  detailedLineItems = [],
  selectedTagKey,
  selectedTagValue,
  onBack
}) => {
  const [filteredItems, setFilteredItems] = useState([]);
  const [sortField, setSortField] = useState('amount');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  
  // Process and filter line items when data changes
  useEffect(() => {
    if (!detailedLineItems || detailedLineItems.length === 0 || !selectedTagKey || !selectedTagValue) {
      setFilteredItems([]);
      setTotalAmount(0);
      return;
    }

    // Filter items by selected tag key and value
    let items = detailedLineItems.filter(item => {
      if (!item.tags || typeof item.tags !== 'object') return false;
      return item.tags[selectedTagKey] === selectedTagValue;
    });

    // Apply search filter if provided
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      items = items.filter(item => {
        return (
          (item.description && item.description.toLowerCase().includes(searchLower)) ||
          (item.project_name && item.project_name.toLowerCase().includes(searchLower)) ||
          (item.resource_id && item.resource_id.toLowerCase().includes(searchLower)) ||
          (item.resource_name && item.resource_name.toLowerCase().includes(searchLower))
        );
      });
    }

    // Sort data
    items = sortData(items, sortField, sortDirection);

    // Calculate total
    const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setTotalAmount(total);
    
    setFilteredItems(items);
  }, [detailedLineItems, selectedTagKey, selectedTagValue, searchTerm, sortField, sortDirection]);

  // Sort data by field
  const sortData = (data, field, direction) => {
    return [...data].sort((a, b) => {
      let valueA, valueB;
      
      if (field === 'amount') {
        valueA = parseFloat(a.amount) || 0;
        valueB = parseFloat(b.amount) || 0;
      } else if (field === 'date') {
        valueA = new Date(a.invoice_date || 0);
        valueB = new Date(b.invoice_date || 0);
      } else {
        valueA = a[field] || '';
        valueB = b[field] || '';
      }
      
      if (direction === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });
  };

  // Handle sort change
  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Render sort indicator
  const renderSortIndicator = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  // For download as CSV
  const downloadAsCSV = () => {
    // CSV headers
    const headers = [
      'Description',
      'Project',
      'Resource',
      'Period',
      'Amount'
    ];
    
    // Generate CSV rows
    const rows = filteredItems.map(item => [
      item.description || '',
      item.project_name || 'Unassigned',
      item.resource_id || item.resource_name || '',
      item.invoice_period || '',
      item.amount || 0
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `tag_${selectedTagKey}_${selectedTagValue.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_details.csv`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="line-item-explorer">
      {/* Header with controls */}
      <div className="explorer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>
          Resources tagged with {selectedTagKey}={selectedTagValue}
          <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '10px' }}>
            ({filteredItems.length} items, {formatCurrency(totalAmount)})
          </span>
        </h3>
        <div className="controls" style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onBack} className="back-btn">
            Back to Chart
          </button>
          <button onClick={downloadAsCSV} className="download-btn">
            Download CSV
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="filters" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <input
          type="text"
          placeholder="Search descriptions, projects, resources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      
      {/* Data display */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('description')}>
                Description{renderSortIndicator('description')}
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('project_name')}>
                Project{renderSortIndicator('project_name')}
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('resource_id')}>
                Resource{renderSortIndicator('resource_id')}
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('invoice_period')}>
                Period{renderSortIndicator('invoice_period')}
              </th>
              <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('amount')}>
                Amount{renderSortIndicator('amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  <p>No resources found with tag {selectedTagKey}={selectedTagValue}.</p>
                  <div style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
                    This could be because:
                    <ul style={{ textAlign: 'left', marginTop: '5px' }}>
                      <li>No resources have this tag value in the selected time period</li>
                      <li>Tag data might not be available in the API response</li>
                    </ul>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => (
                <tr key={index}>
                  <td>{item.description || 'No description'}</td>
                  <td>{item.project_name || 'Unassigned'}</td>
                  <td>{item.resource_id || item.resource_name || 'N/A'}</td>
                  <td>{item.invoice_period || 'N/A'}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(item.amount) || 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};