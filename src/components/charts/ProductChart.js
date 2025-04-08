import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';

export const ProductChart = ({ data }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Return early if no meaningful data
    if (!data || Object.keys(data).length === 0) {
      console.log("No product data available for chart");
      return;
    }

    console.log("Creating product chart with data:", data);
    const ctx = chartRef.current.getContext('2d');
    
    // Sort products by spend amount (descending)
    const sortedEntries = Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15); // Limit to top 15 products for better readability
    
    const labels = sortedEntries.map(([key]) => key);
    const values = sortedEntries.map(([, value]) => value);
    
    // Calculate total for all products
    const totalAmount = Object.values(data).reduce((sum, val) => sum + val, 0);
    
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Product Spend',
          data: values,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: { 
            beginAtZero: true, 
            ticks: { 
              callback: value => '$' + value.toLocaleString() 
            } 
          },
          y: {
            ticks: {
              // Truncate long product names
              callback: function(value) {
                const label = this.getLabelForValue(value);
                return label.length > 30 ? label.substring(0, 27) + '...' : label;
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: context => `Spend: ${formatCurrency(context.raw)}`
            }
          },
          legend: {
            display: false // Hide legend since product names are on Y-axis
          },
          title: {
            display: Object.keys(data).length > 15,
            text: `Showing top 15 of ${Object.keys(data).length} products`,
            position: 'bottom',
            padding: {
              top: 10
            },
            font: {
              size: 14
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
  }, [data]);

  // Determine if we have data or need to show a message
  const hasData = data && Object.keys(data).length > 0;

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {!hasData ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100%',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          No product data available
        </div>
      ) : (
        <canvas ref={chartRef} />
      )}
    </div>
  );
};