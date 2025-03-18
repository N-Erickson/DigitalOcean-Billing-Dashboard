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

    const ctx = chartRef.current.getContext('2d');
    
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{ 
          label: 'Monthly Spend', 
          data: data.values, 
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

  return <canvas ref={chartRef} />;
};