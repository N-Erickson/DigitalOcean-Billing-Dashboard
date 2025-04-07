import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';

export const DetailedLineItemsChart = ({ 
  detailedLineItems,
  timeRange,
  onCategoryClick
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [chartData, setChartData] = useState({
    labels: [],
    values: [],
    colors: []
  });
  const [displayCount, setDisplayCount] = useState(20); // Default display count

  // Process data for the chart
  useEffect(() => {
    if (!detailedLineItems || detailedLineItems.length === 0) {
      setChartData({ labels: [], values: [], colors: [] });
      return;
    }

    console.log("Processing detailed line items for chart visualization");
    
    // Group items by category
    const categorySpend = {};
    
    detailedLineItems.forEach(item => {
      // Determine the category based on the exact field names from the CSV
      const category = item.category || item.name || item.description || 'Unknown';
      const amount = parseFloat(item.amount) || 0;
      
      if (amount <= 0) return; // Skip zero or negative values
      
      // Add to category spending
      categorySpend[category] = (categorySpend[category] || 0) + amount;
    });
    
    // Sort categories by amount (descending)
    const sortedCategories = Object.entries(categorySpend)
      .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedCategories.map(([category]) => category);
    const values = sortedCategories.map(([, amount]) => amount);
    
    console.log(`Found ${labels.length} categories with total spend:`, categorySpend);
    
    // Generate colors for each category - repeating if needed
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
    
    // Repeat the colors as needed to cover all categories
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
          label: 'Line Item Cost', 
          data: displayValues, 
          backgroundColor: displayColors, 
          borderWidth: 1 
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
            text: `Showing ${displayLabels.length} of ${chartData.labels.length} categories`,
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
            const category = displayLabels[index];
            onCategoryClick(category);
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
  }, [chartData, displayCount, onCategoryClick]);

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
        <p>No line item data available. Make sure you've loaded detailed data.</p>
      </div>
    );
  }

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
          Click on any category to see detailed line items.
        </span>
        
        <div>
          <span style={{ fontSize: '14px', marginRight: '10px' }}>
            Showing {Math.min(displayCount, chartData.labels.length)} of {chartData.labels.length} items
          </span>
          {displayCount < chartData.labels.length && (
            <>
              <button 
                onClick={loadMore} 
                style={{ 
                  marginRight: '5px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Load More
              </button>
              <button 
                onClick={showAll} 
                style={{ 
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
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
    </div>
  );
};