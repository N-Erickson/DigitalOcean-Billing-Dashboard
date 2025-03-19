import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/dataUtils';

export const LineItemExplorer = ({ 
  detailedLineItems,
  selectedCategory,
  onBack,
  timeRange
}) => {
  const [filteredItems, setFilteredItems] = useState([]);
  const [sortField, setSortField] = useState('amount');
  const [sortDirection, setSortDirection] = useState('desc');
  const [groupBy, setGroupBy] = useState('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [groupedData, setGroupedData] = useState(null);

  // Process and filter line items when data changes
  useEffect(() => {
    if (!detailedLineItems || detailedLineItems.length === 0 || !selectedCategory) {
      setFilteredItems([]);
      setTotalAmount(0);
      return;
    }

    console.log(`Filtering line items for category: ${selectedCategory}`);
    console.log(`Total line items before filtering: ${detailedLineItems.length}`);

    // Filter items by selected category
    let items = detailedLineItems.filter(item => {
      const itemCategory = item.name || 
                           item.group_description || 
                           item.description || 
                           'Unknown';
      
      // Debug logging
      if (itemCategory === selectedCategory) {
        console.log(`Matched item: ${JSON.stringify(item, null, 2)}`);
      }
      
      return itemCategory === selectedCategory;
    });

    console.log(`Items after category filtering: ${items.length}`);

    // If we still don't have items, try a more lenient match
    if (items.length === 0) {
      console.log("No exact matches, trying partial matches...");
      items = detailedLineItems.filter(item => {
        const itemName = item.name || '';
        const itemDesc = item.description || '';
        const itemGroupDesc = item.group_description || '';
        
        return (
          itemName.includes(selectedCategory) || 
          selectedCategory.includes(itemName) ||
          itemDesc.includes(selectedCategory) ||
          itemGroupDesc.includes(selectedCategory)
        );
      });
      
      console.log(`Items after lenient filtering: ${items.length}`);
    }

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
    
    // Group data if needed
    if (groupBy !== 'none') {
      const grouped = groupData(items, groupBy);
      setGroupedData(grouped);
    } else {
      setGroupedData(null);
    }

    setFilteredItems(items);
  }, [detailedLineItems, selectedCategory, searchTerm, sortField, sortDirection, groupBy]);

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

  // Group data by field
  const groupData = (data, field) => {
    const grouped = {};
    
    data.forEach(item => {
      let groupValue;
      
      if (field === 'project') {
        groupValue = item.project_name || 'Unassigned';
      } else if (field === 'month') {
        const date = new Date(item.invoice_date);
        groupValue = isNaN(date.getTime()) ? 'Unknown Date' : 
          date.toLocaleString('default', { month: 'long', year: 'numeric' });
      } else if (field === 'resource') {
        groupValue = item.resource_id || item.resource_name || 'Unknown';
      } else {
        groupValue = item[field] || 'Unknown';
      }
      
      if (!grouped[groupValue]) {
        grouped[groupValue] = {
          items: [],
          totalAmount: 0
        };
      }
      
      grouped[groupValue].items.push(item);
      grouped[groupValue].totalAmount += parseFloat(item.amount) || 0;
    });
    
    return grouped;
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
    link.download = `${selectedCategory.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_details.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // To debug issues with data
  console.log(`Rendering explorer with ${filteredItems.length} items for ${selectedCategory}`);
  
  return (
    <div className="line-item-explorer">
      {/* Header with controls */}
      <div className="explorer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>
          {selectedCategory} Details 
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
          placeholder="Search descriptions, projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1 }}
        />
        
        <select 
          value={groupBy} 
          onChange={(e) => setGroupBy(e.target.value)}
          style={{ minWidth: '120px' }}
        >
          <option value="none">No Grouping</option>
          <option value="project">Group by Project</option>
          <option value="month">Group by Month</option>
          <option value="resource">Group by Resource</option>
        </select>
      </div>
      
      {/* Data display - grouped or table */}
      {groupedData ? (
        <div className="grouped-data">
          {Object.entries(groupedData).map(([groupName, group], index) => (
            <div key={index} className="group-section" style={{ marginBottom: '20px' }}>
              <h4 style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '10px', 
                backgroundColor: '#f9fafb', 
                borderBottom: '1px solid #e5e7eb',
                margin: '0 0 10px 0'
              }}>
                <span>{groupName}</span>
                <span>{formatCurrency(group.totalAmount)}</span>
              </h4>
              
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '14px' }}>
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('description')}>
                        Description{renderSortIndicator('description')}
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
                    {group.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.description || 'No description'}</td>
                        <td>{item.resource_id || item.resource_name || 'N/A'}</td>
                        <td>{item.invoice_period || 'N/A'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(item.amount) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
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
                    <p>No detailed line items found for {selectedCategory}.</p>
                    <div style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
                      This could be because:
                      <ul style={{ textAlign: 'left', marginTop: '5px' }}>
                        <li>The category name doesn't exactly match the line items</li>
                        <li>No detailed data is available for this category</li>
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
      )}
    </div>
  );
};