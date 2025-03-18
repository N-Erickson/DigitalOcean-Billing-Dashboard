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

    const ctx = chartRef.current.getContext('2d');
    
    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = [
      'rgba(59, 130, 246, 0.8)', 
      'rgba(16, 185, 129, 0.8)', 
      'rgba(245, 158, 11, 0.8)', 
      'rgba(239, 68, 68, 0.8)', 
      'rgba(139, 92, 246, 0.8)', 
      'rgba(6, 182, 212, 0.8)', 
      'rgba(248, 113, 113, 0.8)', 
      'rgba(96, 165, 250, 0.8)'
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
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
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
  }, [data]);

  return <canvas ref={chartRef} />;
};