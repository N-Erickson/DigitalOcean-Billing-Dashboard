import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/dataUtils';

export const LineItemExplorer = ({ 
  detailedLineItems,
  selectedCategory,
  onBack,
  timeRange
}) => {
  const [filteredItems, setFilteredItems] = useState([]);
  const [sortField, setSortField] = useState('USD');
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

    // Filter items by selected category - using actual CSV field names
    let items = detailedLineItems.filter(item => {
      // Check multiple fields for the category match
      const itemCategory = item.category || '';
      const itemProduct = item.product || '';
      const itemDescription = item.description || '';
      const itemGroupDescription = item.group_description || '';
      
      // Try exact match first
      if (itemCategory === selectedCategory) return true;
      if (itemProduct === selectedCategory) return true;
      if (itemDescription === selectedCategory) return true;
      if (itemGroupDescription === selectedCategory) return true;
      
      // Try partial match as fallback
      return (
        itemCategory.includes(selectedCategory) || 
        selectedCategory.includes(itemCategory) ||
        itemProduct.includes(selectedCategory) ||
        selectedCategory.includes(itemProduct) ||
        itemDescription.includes(selectedCategory) ||
        itemGroupDescription.includes(selectedCategory)
      );
    });

    console.log(`Items after category filtering: ${items.length}`);

    // Apply search filter if provided
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      items = items.filter(item => {
        return (
          (item.description && item.description.toLowerCase().includes(searchLower)) ||
          (item.project_name && item.project_name.toLowerCase().includes(searchLower)) ||
          (item.product && item.product.toLowerCase().includes(searchLower)) ||
          (item.category && item.category.toLowerCase().includes(searchLower)) ||
          (item.group_description && item.group_description.toLowerCase().includes(searchLower))
        );
      });
    }

    // Sort data
    items = sortData(items, sortField, sortDirection);

    // Calculate total using USD field
    const total = items.reduce((sum, item) => sum + (parseFloat(item.USD) || 0), 0);
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
      
      if (field === 'USD') {
        valueA = parseFloat(a.USD) || 0;
        valueB = parseFloat(b.USD) || 0;
      } else if (field === 'hours') {
        valueA = parseFloat(a.hours) || 0;
        valueB = parseFloat(b.hours) || 0;
      } else if (field === 'date' || field === 'start' || field === 'end') {
        // Use any available date field
        valueA = new Date(a[field] || 0);
        valueB = new Date(b[field] || 0);
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
        // Use invoice_period directly if available
        if (item.invoice_period) {
          groupValue = item.invoice_period;
        } else if (item.start) {
          try {
            const date = new Date(item.start);
            groupValue = isNaN(date.getTime()) ? 'Unknown Date' : 
              date.toLocaleString('default', { month: 'long', year: 'numeric' });
          } catch (e) {
            groupValue = 'Unknown Date';
          }
        } else {
          groupValue = 'Unknown Date';
        }
      } else if (field === 'product') {
        groupValue = item.product || 'Unknown';
      } else if (field === 'category') {
        groupValue = item.category || 'Unknown';
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
      grouped[groupValue].totalAmount += parseFloat(item.USD) || 0;
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
    if (filteredItems.length === 0) {
      alert('No items to download.');
      return;
    }
    
    // Get all fields from the first item
    const firstItem = filteredItems[0];
    const headers = Object.keys(firstItem);
    
    // Generate CSV content
    const rows = [headers.join(',')];
    
    filteredItems.forEach(item => {
      const row = headers.map(field => {
        const value = item[field];
        // Handle special characters in CSV
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        return value;
      });
      rows.push(row.join(','));
    });
    
    // Create and download the file
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedCategory.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_details.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          <button 
            onClick={downloadAsCSV} 
            className="download-btn"
            disabled={filteredItems.length === 0}
          >
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
          <option value="product">Group by Product</option>
          <option value="category">Group by Category</option>
        </select>
      </div>
      
      {/* Data display - grouped or table */}
      {groupedData ? (
        <div className="grouped-data">
          {Object.entries(groupedData)
            .sort(([, a], [, b]) => b.totalAmount - a.totalAmount) // Sort groups by amount
            .map(([groupName, group], index) => (
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
                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('product')}>
                          Product{renderSortIndicator('product')}
                        </th>
                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('hours')}>
                          Hours{renderSortIndicator('hours')}
                        </th>
                        <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('USD')}>
                          Amount{renderSortIndicator('USD')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.description || 'No description'}</td>
                          <td>{item.product || 'N/A'}</td>
                          <td>{item.hours || 'N/A'}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(item.USD) || 0)}</td>
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
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('product')}>
                  Product{renderSortIndicator('product')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('project_name')}>
                  Project{renderSortIndicator('project_name')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('hours')}>
                  Hours{renderSortIndicator('hours')}
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('USD')}>
                  Amount{renderSortIndicator('USD')}
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
                        <li>Try using a different search term</li>
                      </ul>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.description || 'No description'}</td>
                    <td>{item.product || 'N/A'}</td>
                    <td>{item.project_name || 'Unassigned'}</td>
                    <td>{item.hours || 'N/A'}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(item.USD) || 0)}</td>
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