import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';
import { addForecastToMonthlyChart } from '../../utils/csvUtils';

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
    if (showForecast && data.labels.length >= 2) {
      // Use provided forecast amount or get it from the last point
      const forecast = forecastAmount || (data.values[data.values.length - 1] * 1.1);
      chartData = addForecastToMonthlyChart(chartData, forecast);
      
      // Add annotation plugin config to make forecast point more visible
      const forecastIndex = chartData.labels.length - 1;
      
      // Modified options for forecast styling
      chartData.datasets[0].pointBackgroundColor = chartData.datasets[0].data.map((_, i) => 
        i === forecastIndex ? 'rgba(255, 99, 132, 1)' : 'rgba(59, 130, 246, 1)'
      );
      
      chartData.datasets[0].pointRadius = chartData.datasets[0].data.map((_, i) => 
        i === forecastIndex ? 6 : 3
      );
      
      // Change the line style for the forecast segment
      const originalData = [...chartData.datasets[0].data];
      const originalBorderColor = [...(Array.isArray(chartData.datasets[0].borderColor) ? 
        chartData.datasets[0].borderColor : 
        Array(chartData.datasets[0].data.length).fill(chartData.datasets[0].borderColor))];
      
      // Create a segment dataset for the forecast (dashed line)
      chartData.datasets.push({
        label: 'Forecast',
        data: [originalData[originalData.length - 2], originalData[originalData.length - 1]],
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: [0, 6],
        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
        tension: 0.1,
        fill: false
      });
      
      // Remove the last point from the main dataset
      chartData.datasets[0].data.pop();
      chartData.datasets[0].pointBackgroundColor = chartData.datasets[0].pointBackgroundColor.slice(0, -1);
      chartData.datasets[0].pointRadius = chartData.datasets[0].pointRadius.slice(0, -1);
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
                // Special handling for forecast point
                if (context.dataset.label === 'Forecast') {
                  return 'Forecast: ' + formatCurrency(context.raw);
                }
                return 'Spend: ' + formatCurrency(context.raw);
              }
            } 
          },
          legend: {
            display: showForecast && chartData.datasets.length > 1,
            position: 'top'
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