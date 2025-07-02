import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';

export const MonthlyChart = ({ data, showForecast = true, forecastAmount = null }) => {
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
    
    // Prepare chart data
    let chartData = {
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
    };
    
    // Add forecast point if enabled
    if (showForecast && forecastAmount) {
      // Calculate the next month label after the chronologically last month
      const latestLabel = sortedLabels[sortedLabels.length - 1];
      let nextMonthLabel = '';
      
      if (/^\d{4}-\d{2}$/.test(latestLabel)) {
        // Format is YYYY-MM
        const year = parseInt(latestLabel.substring(0, 4));
        const month = parseInt(latestLabel.substring(5, 7));
        
        if (month === 12) {
          nextMonthLabel = `${year + 1}-01`;
        } else {
          nextMonthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;
        }
      } else {
        // Fallback to simple labeling if we can't parse the date format
        nextMonthLabel = 'Forecast';
      }
      
      // Add the forecast month to the labels
      chartData.labels.push(nextMonthLabel);
      
      // Add the forecast value to each dataset
      chartData.datasets = chartData.datasets.map((dataset, datasetIndex) => {
        if (datasetIndex === 0) {
          // Main dataset - add forecast point with special styling
          return {
            ...dataset,
            data: [...dataset.data, forecastAmount],
            pointBackgroundColor: [
              ...Array(dataset.data.length).fill('rgba(59, 130, 246, 1)'),
              'rgba(255, 99, 132, 1)' // Red for forecast point
            ],
            pointRadius: [
              ...Array(dataset.data.length).fill(3),
              6 // Larger for forecast point
            ],
            segment: {
              borderColor: (ctx) => {
                // Make the line segment to the forecast point red and dashed
                const index = ctx.p0DataIndex;
                const isLastSegment = index === dataset.data.length - 1;
                return isLastSegment ? 'rgba(255, 99, 132, 1)' : 'rgba(59, 130, 246, 1)';
              },
              borderDash: (ctx) => {
                const index = ctx.p0DataIndex;
                const isLastSegment = index === dataset.data.length - 1;
                return isLastSegment ? [5, 5] : undefined;
              }
            }
          };
        }
        return dataset;
      });
    }
    
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: chartData,
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
              label: context => {
                // Special handling for forecast point (last point in main dataset)
                const isLastPoint = context.dataIndex === context.dataset.data.length - 1;
                if (isLastPoint && showForecast) {
                  return 'Forecast: ' + formatCurrency(context.raw);
                }
                return 'Spend: ' + formatCurrency(context.raw);
              }
            } 
          },
          legend: {
            display: false // We'll handle forecast indication via styling and tooltips
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, showForecast, forecastAmount]);

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