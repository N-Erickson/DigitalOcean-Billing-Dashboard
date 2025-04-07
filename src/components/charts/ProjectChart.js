import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';

export const ProjectChart = ({ data }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Return early if no meaningful data
    if (!data || Object.keys(data).length === 0) {
      console.log("No project data available for chart");
      return;
    }

    console.log("Creating project chart with data:", data);
    const ctx = chartRef.current.getContext('2d');
    
    // Sort projects by spend amount (descending)
    const sortedData = Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15); // Limit to top 15 projects to avoid overcrowding
    
    const labels = sortedData.map(([key]) => key);
    const values = sortedData.map(([, value]) => value);
    
    // Calculate total for all projects
    const totalAmount = Object.values(data).reduce((sum, val) => sum + val, 0);
    
    // Create chart with appropriate colors
    const backgroundColors = sortedData.map(([key]) => {
      // Use a distinct color for Unassigned
      if (key === 'Unassigned' || key === 'No Project Data') {
        return 'rgba(200, 200, 200, 0.8)';
      }
      return 'rgba(16, 185, 129, 0.8)'; // Green for real projects
    });
    
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: { 
        labels: labels, 
        datasets: [{ 
          label: 'Project Spend', 
          data: values, 
          backgroundColor: backgroundColors, 
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
              // Truncate long project names
              callback: function(value) {
                const label = this.getLabelForValue(value);
                return label.length > 25 ? label.substring(0, 22) + '...' : label;
              }
            }
          }
        },
        plugins: { 
          tooltip: { 
            callbacks: { 
              label: context => 'Spend: ' + formatCurrency(context.raw)
            } 
          },
          // Add legend display options
          legend: {
            display: false // Hide legend since project names are on Y-axis
          },
          title: {
            display: Object.keys(data).length > 15,
            text: `Showing top 15 of ${Object.keys(data).length} projects`,
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
        No project data available
      </div>
    ) : (
      <canvas ref={chartRef} />
    )}
  </div>
);
};