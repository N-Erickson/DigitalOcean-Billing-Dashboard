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

  // Process data for the chart
  useEffect(() => {
    if (!detailedLineItems || detailedLineItems.length === 0) {
      setChartData({ labels: [], values: [], colors: [] });
      return;
    }

    // Group items by category
    const categorySpend = {};
    
    detailedLineItems.forEach(item => {
      // Determine the category
      const category = item.name || 
                       item.group_description || 
                       item.description || 
                       'Unknown';
      
      const amount = parseFloat(item.amount) || 0;
      
      // Add to category spending
      categorySpend[category] = (categorySpend[category] || 0) + amount;
    });
    
    // Sort categories by amount (descending)
    const sortedCategories = Object.entries(categorySpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Limit to top 10 for readability
    
    const labels = sortedCategories.map(([category]) => category);
    const values = sortedCategories.map(([, amount]) => amount);
    
    // Generate colors for each category
    const colors = [
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
    
    setChartData({ labels, values, colors });
    
  }, [detailedLineItems]);

  // Create and update chart
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    if (chartData.labels.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: { 
        labels: chartData.labels, 
        datasets: [{ 
          label: 'Line Item Cost', 
          data: chartData.values, 
          backgroundColor: chartData.colors.slice(0, chartData.labels.length), 
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
            text: 'Top 10 Detailed Line Items',
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
            const category = chartData.labels[index];
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
  }, [chartData, onCategoryClick]);

  // If no data available
  if (chartData.labels.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>No line item data available. Make sure you've loaded detailed data.</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div style={{ 
        marginBottom: '10px', 
        fontSize: '14px', 
        color: '#6b7280',
        fontStyle: 'italic'
      }}>
        Click on any category to see detailed line items.
      </div>
      <canvas ref={chartRef} style={{ cursor: 'pointer' }} />
    </div>
  );
};