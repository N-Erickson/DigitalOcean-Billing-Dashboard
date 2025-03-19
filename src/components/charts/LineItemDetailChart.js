import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';

export const LineItemDetailChart = ({ 
  data, 
  detailedLineItems,
  onCategoryClick,
  selectedCategory
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [detailData, setDetailData] = useState([]);

  // Create chart showing category breakdown
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    if (selectedCategory) {
      // Detail view is handled separately
      return;
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
          },
          legend: {
            position: 'right',
            onClick: (e, legendItem) => {
              const index = legendItem.index;
              const category = labels[index];
              onCategoryClick(category);
            }
          }
        },
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const category = labels[index];
            onCategoryClick(category);
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, selectedCategory, onCategoryClick]);

  // Get details for selected category
  useEffect(() => {
    if (selectedCategory && detailedLineItems && detailedLineItems.length > 0) {
      // Filter line items for the selected category
      const items = detailedLineItems.filter(item => {
        const itemCategory = item.name || 
                            item.group_description || 
                            item.description || 
                            'Unknown';
        return itemCategory === selectedCategory;
      });
      
      setDetailData(items);
      setIsDetailView(true);
    } else {
      setIsDetailView(false);
      setDetailData([]);
    }
  }, [selectedCategory, detailedLineItems]);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {isDetailView ? (
        <div className="detail-view">
          <h4>Details for: {selectedCategory}</h4>
          <button 
            onClick={() => onCategoryClick(null)} 
            className="back-btn"
            style={{ 
              position: 'absolute', 
              top: 0, 
              right: 0, 
              background: '#e5e7eb', 
              border: 'none', 
              padding: '5px 10px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Chart
          </button>
          
          <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '15px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Invoice Period</th>
                  <th>Project</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {detailData.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                      No detailed line items found for this category
                    </td>
                  </tr>
                ) : (
                  detailData.map((item, index) => (
                    <tr key={`${item.invoice_uuid}-${index}`}>
                      <td>{item.description || 'No description'}</td>
                      <td>{item.invoice_period || 'N/A'}</td>
                      <td>{item.project_name || 'Unassigned'}</td>
                      <td>{formatCurrency(parseFloat(item.amount) || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <canvas ref={chartRef} />
      )}
    </div>
  );
};