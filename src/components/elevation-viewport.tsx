"use client"
import { useEffect, useRef, useState } from 'react';
import { useRoofBuilder } from '../store/RoofBuilderContext';

const ElevationViewport = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { buildings, selectedBuildingId, updateBuilding } = useRoofBuilder();
  const [sliderValue, setSliderValue] = useState(1);
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

  // Update view when buildings change or selection changes
  useEffect(() => {
    if (selectedBuildingId && selectedBuilding) {
      // Update slider to match current ridge height for dual pitch roofs
      if (selectedBuilding.type === 'dualPitch' && selectedBuilding.ridgeHeight) {
        setSliderValue(selectedBuilding.ridgeHeight);
      }
    }
  }, [buildings, selectedBuildingId, selectedBuilding]);

  // Handle slider change for ridge height adjustment
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSliderValue(value);

    if (selectedBuildingId && selectedBuilding?.type === 'dualPitch') {
      updateBuilding(selectedBuildingId, { ridgeHeight: value });
    }
  };

  // Render the building SVG
  const renderBuilding = () => {
    if (!selectedBuilding) return null;

    const width = 180;
    const baseHeight = 60;
    const buildingWidth = selectedBuilding.width || 120;
    const scaledWidth = Math.min(width, buildingWidth);
    const x = (width - scaledWidth) / 2;

    if (selectedBuilding.type === 'flat') {
      return (
        <g>
          {/* Ground line */}
          <line x1="10" y1="160" x2="190" y2="160" stroke="#555" strokeWidth="2" />

          {/* Flat building */}
          <rect
            x={x}
            y={160 - baseHeight}
            width={scaledWidth}
            height={baseHeight}
            fill="#ddd"
            stroke="#333"
            strokeWidth="1"
          />

          {/* Roof line */}
          <line
            x1={x}
            y1={160 - baseHeight}
            x2={x + scaledWidth}
            y2={160 - baseHeight}
            stroke="#555"
            strokeWidth="2"
          />
        </g>
      );
    } else if (selectedBuilding.type === 'dualPitch') {
      const roofHeight = sliderValue * 30; // Scale the roof height for visual effect

      return (
        <g>
          {/* Ground line */}
          <line x1="10" y1="160" x2="190" y2="160" stroke="#555" strokeWidth="2" />

          {/* Building walls */}
          <rect
            x={x}
            y={160 - baseHeight}
            width={scaledWidth}
            height={baseHeight}
            fill="#ddd"
            stroke="#333"
            strokeWidth="1"
          />

          {/* Roof */}
          <polygon
            points={`${x},${160 - baseHeight} ${x + scaledWidth / 2},${160 - baseHeight - roofHeight} ${x + scaledWidth},${160 - baseHeight}`}
            fill="#b87333"
            stroke="#555"
            strokeWidth="1"
          />
        </g>
      );
    }

    return null;
  };

  return (
    <div style={{
      height: '100%',
      backgroundColor: '#f0f0f0',
      padding: '0.5rem',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold' }}>Elevation View</span>
        {selectedBuilding?.type === 'dualPitch' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem' }}>Roof Height:</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={sliderValue}
              onChange={handleSliderChange}
              style={{ width: '80px' }}
            />
            <span style={{ fontSize: '0.8rem' }}>{sliderValue.toFixed(1)}m</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          style={{ backgroundColor: '#eef' }}
        >
          {renderBuilding()}
        </svg>

        {!selectedBuildingId && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#666',
          }}>
            Select a building to adjust
          </div>
        )}
        {selectedBuildingId && selectedBuilding?.type === 'flat' && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '14px',
          }}>
            Flat roofs have no slope to adjust
          </div>
        )}
        {selectedBuildingId && selectedBuilding?.type === 'dualPitch' && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '14px',
          }}>
            Use slider to adjust roof height
          </div>
        )}
      </div>
    </div>
  );
};

export default ElevationViewport;
