import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';

export const CategoryChart = ({ data }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Return early if no meaningful data
    if (!data || Object.keys(data).length === 0) {
      console.log("No category data available for chart");
      return;
    }

    console.log("Creating category chart with data:", data);
    const ctx = chartRef.current.getContext('2d');
    
    // Extract and sort data
    const sortedEntries = Object.entries(data)
      .sort((a, b) => b[1] - a[1]) // Sort by value (descending)
      .slice(0, 10); // Take top 10 categories for better visibility
    
    const labels = sortedEntries.map(([category]) => category);
    const values = sortedEntries.map(([, value]) => value);
    
    const totalValue = values.reduce((sum, val) => sum + val, 0);
    console.log(`Showing top ${labels.length} categories out of ${Object.keys(data).length}`);
    
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
    
    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: { 
        labels: labels, 
        datasets: [{ 
          data: values, 
          backgroundColor: colors.slice(0, labels.length), 
          borderWidth: 1 
        }] 
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: context => {
                const value = context.raw;
                const percentage = totalValue > 0 ? Math.round((value / totalValue) * 100) : 0;
                return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
              }
            }
          },
          title: {
            display: Object.keys(data).length > 10,
            text: `Showing top 10 of ${Object.keys(data).length} categories`,
            font: {
              size: 14
            },
            padding: {
              bottom: 10
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
          No category data available
        </div>
      ) : (
        <canvas ref={chartRef} />
      )}
    </div>
  );
};