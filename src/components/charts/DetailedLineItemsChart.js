import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency, extractMonetaryValue } from '../../utils/dataUtils';

export const DetailedLineItemsChart = ({ 
  detailedLineItems,
  timeRange,
  onCategoryClick,
  accountName
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [chartData, setChartData] = useState({
    labels: [],
    values: [],
    colors: []
  });
  const [displayCount, setDisplayCount] = useState(20); // Default display count
  const [totalItemCount, setTotalItemCount] = useState(0);

  // Process data for the chart
  useEffect(() => {
    if (!detailedLineItems || detailedLineItems.length === 0) {
      setChartData({ labels: [], values: [], colors: [] });
      setTotalItemCount(0);
      return;
    }

    console.log("Processing detailed line items for chart visualization");
    console.log("Sample items:", detailedLineItems.slice(0, 3));
    
    // Group items by product (prioritize product field over category)
    const productSpend = {};
    let validItems = 0;
    
    detailedLineItems.forEach(item => {
      // Prioritize product field for more detailed breakdown
      const product = item.product || 
                    item.name || 
                    item.category || 
                    item.group_description || 
                    item.description || 
                    'Unknown';
      
      // Extract monetary value using the shared utility function
      const amount = extractMonetaryValue(item);
      
      if (amount <= 0) return; // Skip zero or negative values
      
      // Add to product spending
      productSpend[product] = (productSpend[product] || 0) + amount;
      validItems++;
    });
    
    setTotalItemCount(validItems);
    
    // Sort products by amount (descending)
    const sortedProducts = Object.entries(productSpend)
      .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedProducts.map(([product]) => product);
    const values = sortedProducts.map(([, amount]) => amount);
    
    console.log(`Found ${labels.length} products with total spend:`, 
      Object.entries(productSpend).reduce((sum, [_, val]) => sum + val, 0));
    
    // Generate colors for each product - repeating if needed
    const baseColors = [
      'rgba(59, 130, 246, 0.8)', // blue
      'rgba(16, 185, 129, 0.8)', // green
      'rgba(245, 158, 11, 0.8)', // amber
      'rgba(239, 68, 68, 0.8)',  // red
      'rgba(139, 92, 246, 0.8)', // purple
      'rgba(6, 182, 212, 0.8)',  // cyan
      'rgba(248, 113, 113, 0.8)', // light red
      'rgba(96, 165, 250, 0.8)', // light blue
      'rgba(52, 211, 153, 0.8)', // light green
      'rgba(167, 139, 250, 0.8)', // light purple
    ];
    
    // Repeat the colors as needed to cover all products
    const colors = [];
    for (let i = 0; i < labels.length; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    
    setChartData({ labels, values, colors });
    
  }, [detailedLineItems]);

  // Create and update chart
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    if (chartData.labels.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    
    // Only show the number of items specified by displayCount
    const displayLabels = chartData.labels.slice(0, displayCount);
    const displayValues = chartData.values.slice(0, displayCount);
    const displayColors = chartData.colors.slice(0, displayCount);
    
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: { 
        labels: displayLabels, 
        datasets: [{ 
          label: 'Product Cost', 
          data: displayValues, 
          backgroundColor: displayColors, 
          borderWidth: 1,
          // Add minimum bar length to ensure all bars are clickable
          minBarLength: 15
        }] 
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          tooltip: {
            callbacks: {
              label: context => {
                const value = context.raw;
                return `Cost: ${formatCurrency(value)}`;
              }
            }
          },
          title: {
            display: true,
            text: `Showing ${displayLabels.length} of ${chartData.labels.length} products for ${timeRange === 'all' ? 'all time' : `last ${timeRange}`}`,
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          }
        },
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const product = displayLabels[index];
            onCategoryClick(product);
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: value => formatCurrency(value)
            }
          },
          y: {
            ticks: {
              callback: function(value) {
                const label = this.getLabelForValue(value);
                // Truncate long labels
                return label.length > 25 ? label.substring(0, 22) + '...' : label;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [chartData, displayCount, onCategoryClick, timeRange]);

  // Function to load more items
  const loadMore = () => {
    setDisplayCount(prevCount => Math.min(prevCount + 20, chartData.labels.length));
  };

  // Function to show all items
  const showAll = () => {
    setDisplayCount(chartData.labels.length);
  };

  // If no data available
  if (chartData.labels.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>No product data available for {timeRange === 'all' ? 'all time' : `the last ${timeRange}`}. Make sure you've loaded detailed data.</p>
      </div>
    );
  }

  // Function to handle category selection from dropdown
  const handleSelectCategory = (e) => {
    const selectedValue = e.target.value;
    if (selectedValue) {
      onCategoryClick(selectedValue);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        marginBottom: '10px', 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ 
          fontSize: '14px', 
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          Click on any product to see detailed line items.
        </span>
        
        <div>
          <span style={{ fontSize: '14px', marginRight: '10px' }}>
            Showing {Math.min(displayCount, chartData.labels.length)} of {chartData.labels.length} products 
            (from {totalItemCount} line items)
          </span>
          {displayCount < chartData.labels.length && (
            <>
              <button 
                onClick={loadMore} 
                className="load-more-btn"
              >
                Load More
              </button>
              <button 
                onClick={showAll} 
                className="show-all-btn"
              >
                Show All
              </button>
            </>
          )}
        </div>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto', paddingRight: '10px', height: '95%' }}>
        <div style={{ height: `${Math.max(400, 30 * displayCount)}px` }}>
          <canvas ref={chartRef} style={{ cursor: 'pointer' }} className="clickable-chart" />
        </div>
      </div>
      
      {/* Product Selector Section */}
      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <button
          onClick={() => {
            // Create a simple select element
            const selectContainer = document.getElementById('product-selector-container');
            
            // If the select is already shown, hide it
            if (selectContainer.childNodes.length > 0) {
              selectContainer.innerHTML = '';
              return;
            }
            
            const select = document.createElement('select');
            select.style.width = '80%';
            select.style.padding = '10px';
            select.style.margin = '10px auto';
            select.style.display = 'block';
            
            // Add a default option
            const defaultOption = document.createElement('option');
            defaultOption.text = '-- Select a product to view detailed items --';
            defaultOption.value = '';
            select.appendChild(defaultOption);
            
            // Get all product labels and sort alphabetically
            const allProducts = [...chartData.labels].sort();
            
            // Add all products as options
            allProducts.forEach(product => {
              const option = document.createElement('option');
              option.text = product;
              option.value = product;
              select.appendChild(option);
            });
            
            // Handle selection change
            select.addEventListener('change', (e) => {
              if (e.target.value) {
                onCategoryClick(e.target.value);
              }
            });
            
            selectContainer.innerHTML = '';
            selectContainer.appendChild(select);
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Browse All Products
        </button>
        
        {/* Container for the product selector */}
        <div id="product-selector-container" style={{ marginTop: '10px' }}></div>
      </div>
    </div>
  );
};