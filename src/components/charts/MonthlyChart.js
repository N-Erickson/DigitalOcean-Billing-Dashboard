import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';

export const MonthlyChart = ({ data }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Return early if no data
    if (!data || !data.labels || data.labels.length === 0) {
      console.log("No monthly data available for chart");
      return;
    }

    console.log("Creating monthly chart with data:", data);
    const ctx = chartRef.current.getContext('2d');
    
    // Ensure proper date sorting for monthly data
    // This should be done in csvUtils.js, but adding again for safety
    const sortedIndices = [...data.labels.keys()].sort((a, b) => {
      return parseMonthPeriod(data.labels[a]) - parseMonthPeriod(data.labels[b]);
    });
    
    const sortedLabels = sortedIndices.map(i => data.labels[i]);
    const sortedValues = sortedIndices.map(i => data.values[i]);
    
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedLabels,
        datasets: [{ 
          label: 'Monthly Spend', 
          data: sortedValues, 
          backgroundColor: 'rgba(59, 130, 246, 0.2)', 
          borderColor: 'rgba(59, 130, 246, 1)', 
          borderWidth: 2, 
          tension: 0.1, 
          fill: true 
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { 
          y: { 
            beginAtZero: true, 
            ticks: { 
              callback: value => '$' + value.toLocaleString() 
            } 
          } 
        },
        plugins: { 
          tooltip: { 
            callbacks: { 
              label: context => 'Spend: ' + formatCurrency(context.raw) 
            } 
          },
          legend: {
            display: false
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

  // Helper function to parse month period strings into comparable dates
  const parseMonthPeriod = (periodStr) => {
    if (!periodStr) return new Date(0); // Default for empty strings
    
    // Check if it's already in YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(periodStr)) {
      return new Date(`${periodStr}-01`);
    }
    
    // Try to parse various date formats
    try {
      // For "Month YYYY" format (e.g., "January 2023")
      const monthYearMatch = periodStr.match(/([A-Za-z]+)\s+(\d{4})/);
      if (monthYearMatch) {
        const monthNames = ["january", "february", "march", "april", "may", "june", 
                          "july", "august", "september", "october", "november", "december"];
        const month = monthNames.indexOf(monthYearMatch[1].toLowerCase());
        const year = parseInt(monthYearMatch[2]);
        if (month !== -1 && !isNaN(year)) {
          return new Date(year, month, 1);
        }
      }
      
      // For full date strings
      const date = new Date(periodStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
      console.warn(`Failed to parse period string: ${periodStr}`);
    }
    
    // Return original string converted to date (may be invalid)
    return new Date(periodStr);
  };

  // Determine if we have data or need to show a message
  const hasData = data && data.labels && data.labels.length > 0;

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
          No monthly data available
        </div>
      ) : (
        <canvas ref={chartRef} />
      )}
    </div>
  );
};