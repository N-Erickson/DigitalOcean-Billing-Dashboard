import React, { useState, useEffect } from 'react';
import { formatCurrency, extractMonetaryValue, filterLineItemsByTimeRange } from '../utils/dataUtils';

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
  const [monetaryField, setMonetaryField] = useState('amount'); // Will be updated based on data

  // Process and filter line items when data changes
  useEffect(() => {
    if (!detailedLineItems || detailedLineItems.length === 0 || !selectedCategory) {
      setFilteredItems([]);
      setTotalAmount(0);
      return;
    }

    console.log(`Filtering line items for product/category: ${selectedCategory}`);
    console.log(`Total line items before filtering: ${detailedLineItems.length}`);

    // Apply time range filter first
    const timeFilteredItems = filterLineItemsByTimeRange(detailedLineItems, timeRange);
    console.log(`Items after time range filtering: ${timeFilteredItems.length}`);
    
    // Find the monetary field if we don't have it yet
    if (timeFilteredItems.length > 0 && sortField === 'amount') {
      // Find a sample item that has a monetary value
      for (const item of timeFilteredItems) {
        const monetaryValue = extractMonetaryValue(item);
        if (monetaryValue > 0) {
          // Look for which field contains this value
          for (const [key, value] of Object.entries(item)) {
            if (parseFloat(value) === monetaryValue) {
              console.log(`Found monetary field: ${key}`);
              setSortField(key);
              setMonetaryField(key);
              break;
            }
          }
          break;
        }
      }
    }

    // Improved filtering logic for products
    let items = timeFilteredItems.filter(item => {
      // Get values from multiple potential fields
      const itemProduct = item.product || '';
      const itemCategory = item.category || '';
      const itemName = item.name || '';
      const itemDescription = item.description || '';
      const itemGroupDescription = item.group_description || '';
      
      // First try exact match (which is preferred for products)
      if (itemProduct === selectedCategory) return true;
      if (itemCategory === selectedCategory) return true;
      if (itemName === selectedCategory) return true;
      if (itemDescription === selectedCategory) return true;
      if (itemGroupDescription === selectedCategory) return true;
      
      // If no exact match, try more precise matching for products
      // This prioritizes the product field which is what we want when clicking on product bars
      if (itemProduct && (
        itemProduct.includes(selectedCategory) || 
        selectedCategory.includes(itemProduct)
      )) {
        return true;
      }
      
      // Only use partial matches for other fields if necessary
      // This avoids overly broad matches
      if (itemCategory && itemCategory.includes(selectedCategory)) return true;
      if (itemName && itemName.includes(selectedCategory)) return true;
      if (itemDescription && itemDescription.includes(selectedCategory)) return true;
      if (itemGroupDescription && itemGroupDescription.includes(selectedCategory)) return true;
      
      return false;
    });

    console.log(`Items after category filtering: ${items.length}`);
    
    // Log a sample item to understand what's matching
    if (items.length > 0) {
      console.log("Sample matching item:", items[0]);
      
      // Check which field matched
      const matchedOn = 
        items[0].product === selectedCategory ? "product (exact)" :
        items[0].category === selectedCategory ? "category (exact)" :
        items[0].name === selectedCategory ? "name (exact)" :
        items[0].description === selectedCategory ? "description (exact)" :
        items[0].group_description === selectedCategory ? "group_description (exact)" :
        items[0].product && items[0].product.includes(selectedCategory) ? "product (partial)" :
        items[0].category && items[0].category.includes(selectedCategory) ? "category (partial)" :
        items[0].name && items[0].name.includes(selectedCategory) ? "name (partial)" :
        items[0].description && items[0].description.includes(selectedCategory) ? "description (partial)" :
        items[0].group_description && items[0].group_description.includes(selectedCategory) ? "group_description (partial)" :
        "unknown";
        
      console.log("Matched on field:", matchedOn);
    }

    // Apply search filter if provided
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      items = items.filter(item => {
        return Object.entries(item).some(([key, value]) => {
          // Skip certain fields
          if (key === 'invoice_uuid' || key === 'invoice_amount') return false;
          // Check if value contains search term
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    // Sort data
    items = sortData(items, sortField, sortDirection);

    // Calculate total
    const total = items.reduce((sum, item) => sum + extractMonetaryValue(item), 0);
    setTotalAmount(total);
    
    // Group data if needed
    if (groupBy !== 'none') {
      const grouped = groupData(items, groupBy);
      setGroupedData(grouped);
    } else {
      setGroupedData(null);
    }

    setFilteredItems(items);
  }, [detailedLineItems, selectedCategory, searchTerm, sortField, sortDirection, groupBy, timeRange]);

  // Sort data by field
  const sortData = (data, field, direction) => {
    return [...data].sort((a, b) => {
      let valueA, valueB;
      
      if (field === 'amount' || field === 'USD' || field === monetaryField) {
        valueA = extractMonetaryValue(a);
        valueB = extractMonetaryValue(b);
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
      grouped[groupValue].totalAmount += extractMonetaryValue(item);
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
    link.download = `${selectedCategory.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_details_${timeRange}.csv`;
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
      
      <div style={{ fontSize: '14px', marginBottom: '15px', color: '#6b7280' }}>
        Showing data for {timeRange === 'all' ? 'all time' : `the last ${timeRange}`}
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
                        <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort(monetaryField)}>
                          Amount{renderSortIndicator(monetaryField)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.description || 'No description'}</td>
                          <td>{item.product || 'N/A'}</td>
                          <td>{item.hours || 'N/A'}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(extractMonetaryValue(item))}</td>
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
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort(monetaryField)}>
                  Amount{renderSortIndicator(monetaryField)}
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
                        <li>The product/category name doesn't match any line items</li>
                        <li>No data exists for this product in the selected time range</li>
                        <li>Try using a different search term or time range</li>
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
                    <td style={{ textAlign: 'right' }}>{formatCurrency(extractMonetaryValue(item))}</td>
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