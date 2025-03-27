import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { formatCurrency } from '../../utils/dataUtils';

export const TagChart = ({ 
  detailedLineItems = [],
  timeRange,
  onTagClick
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [selectedTagKey, setSelectedTagKey] = useState(null);
  const [tagKeys, setTagKeys] = useState([]);
  const [chartData, setChartData] = useState({
    labels: [],
    values: [],
    colors: []
  });

  // Extract all available tag keys from line items
  useEffect(() => {
    if (!detailedLineItems || detailedLineItems.length === 0) {
      setTagKeys([]);
      return;
    }

    const uniqueTagKeys = new Set();
    
    detailedLineItems.forEach(item => {
      // Check for tags field which should be an object with key-value pairs
      if (item.tags && typeof item.tags === 'object') {
        Object.keys(item.tags).forEach(key => {
          uniqueTagKeys.add(key);
        });
      }
    });
    
    setTagKeys(Array.from(uniqueTagKeys));
    
    // Default to first tag key if none is selected
    if (uniqueTagKeys.size > 0 && !selectedTagKey) {
      setSelectedTagKey(Array.from(uniqueTagKeys)[0]);
    }
  }, [detailedLineItems, selectedTagKey]);

  // Process data for the selected tag key
  useEffect(() => {
    if (!selectedTagKey || !detailedLineItems || detailedLineItems.length === 0) {
      setChartData({ labels: [], values: [], colors: [] });
      return;
    }

    // Group spending by tag values for the selected tag key
    const tagValueSpend = {};
    
    detailedLineItems.forEach(item => {
      if (item.tags && typeof item.tags === 'object' && item.tags[selectedTagKey]) {
        const tagValue = item.tags[selectedTagKey];
        const amount = parseFloat(item.amount) || 0;
        
        // Add to tag value spending
        tagValueSpend[tagValue] = (tagValueSpend[tagValue] || 0) + amount;
      }
    });
    
    // Sort tag values by amount (descending)
    const sortedTagValues = Object.entries(tagValueSpend)
      .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedTagValues.map(([value]) => value);
    const values = sortedTagValues.map(([, amount]) => amount);
    
    // Generate colors - using a standard palette that repeats if needed
    const baseColors = [
      'rgba(59, 130, 246, 0.8)', // blue
      'rgba(16, 185, 129, 0.8)', // green
      'rgba(245, 158, 11, 0.8)', // amber
      'rgba(239, 68, 68, 0.8)',  // red
      'rgba(139, 92, 246, 0.8)', // purple
      'rgba(6, 182, 212, 0.8)',  // cyan
      'rgba(248, 113, 113, 0.8)', // light red
      'rgba(96, 165, 250, 0.8)', // light blue
    ];
    
    const colors = labels.map((_, i) => baseColors[i % baseColors.length]);
    
    setChartData({ labels, values, colors });
  }, [detailedLineItems, selectedTagKey]);

  // Create and update chart
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    if (chartData.labels.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    
    chartInstance.current = new Chart(ctx, {
      type: 'pie',
      data: { 
        labels: chartData.labels, 
        datasets: [{ 
          data: chartData.values, 
          backgroundColor: chartData.colors, 
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
              const tagValue = chartData.labels[index];
              onTagClick(selectedTagKey, tagValue);
            }
          }
        },
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const tagValue = chartData.labels[index];
            onTagClick(selectedTagKey, tagValue);
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [chartData, onTagClick]);

  // Handle tag key selection change
  const handleTagKeyChange = (e) => {
    setSelectedTagKey(e.target.value);
  };

  // If no data available
  if (tagKeys.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p>No tag data available in your line items.</p>
        <p style={{ fontSize: '14px', color: '#666', maxWidth: '80%', textAlign: 'center', marginTop: '10px' }}>
          Tag data should be available in your detailed line items from the DigitalOcean API. 
          Make sure your resources are tagged in your DigitalOcean console.
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="tagKeySelect" style={{ marginRight: '10px', fontWeight: '500' }}>
          Tag Key:
        </label>
        <select 
          id="tagKeySelect" 
          value={selectedTagKey || ''} 
          onChange={handleTagKeyChange}
          style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #d1d5db' }}
        >
          {tagKeys.map(key => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
        <span style={{ marginLeft: '15px', fontSize: '14px', color: '#6b7280' }}>
          Click on a segment to view resources with that tag
        </span>
      </div>
      
      <div style={{ height: 'calc(100% - 40px)' }}>
        <canvas ref={chartRef} />
      </div>
    </div>
  );
};