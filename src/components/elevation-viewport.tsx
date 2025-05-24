"use client"
import { useEffect, useRef } from 'react';
import { useRoofBuilder } from '../store/RoofBuilderContext';

const ElevationViewport = () => {
  const { buildings, selectedBuildingId, updateBuilding } = useRoofBuilder();
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

  // Constants for ridge height mapping
  const MIN_RIDGE_HEIGHT = 0;
  const MAX_RIDGE_HEIGHT = 3.75;
  const MIN_VISUAL_HEIGHT = 20;
  const MAX_VISUAL_HEIGHT = 120;

  // Ref to store drag state
  const dragStateRef = useRef({
    isDragging: false,
    draggedHandle: null as 'left' | 'right' | null,
    initialMouseY: 0,
    initialRidgeHeight: 0,
  });

  // Get current ridge height with boundary checks
  const currentRidgeHeight = selectedBuilding?.ridgeHeight !== undefined
    ? Math.max(MIN_RIDGE_HEIGHT, Math.min(selectedBuilding.ridgeHeight, MAX_RIDGE_HEIGHT))
    : 0;

  // Convert ridge height value to visual height in pixels
  const getVisualHeight = (ridgeHeight: number) => {
    // Normalized to range 0-1
    const normalizedHeight = (ridgeHeight - MIN_RIDGE_HEIGHT) / (MAX_RIDGE_HEIGHT - MIN_RIDGE_HEIGHT || 1);
    // Convert to pixel height, min value if normalization fails
    return MIN_VISUAL_HEIGHT + normalizedHeight * (MAX_VISUAL_HEIGHT - MIN_VISUAL_HEIGHT);
  };

  const visualHeight = getVisualHeight(currentRidgeHeight);

  // Handle mouse movement during drag
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragStateRef.current.isDragging || !selectedBuildingId) return;

    // Calculate Y delta (negative = down, positive = up)
    const deltaY = dragStateRef.current.initialMouseY - e.clientY;

    // Calculate ridge height change based on pixel movement
    const heightChangePerPixel = (MAX_RIDGE_HEIGHT - MIN_RIDGE_HEIGHT) / (MAX_VISUAL_HEIGHT - MIN_VISUAL_HEIGHT || 1);
    let newRidgeHeight = dragStateRef.current.initialRidgeHeight + (deltaY * heightChangePerPixel);

    // Apply boundary limits
    newRidgeHeight = Math.max(MIN_RIDGE_HEIGHT, Math.min(newRidgeHeight, MAX_RIDGE_HEIGHT));

    // Update the building
    updateBuilding(selectedBuildingId, { ridgeHeight: newRidgeHeight });
  };

  // Handle mouse up event to end dragging
  const handleMouseUp = () => {
    dragStateRef.current.isDragging = false;
    dragStateRef.current.draggedHandle = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  // Handle mouse down on a handle to start dragging
  const handleHandleMouseDown = (e: React.MouseEvent, handle: 'left' | 'right') => {
    if (!selectedBuildingId) return;

    e.stopPropagation(); // Prevent event bubbling

    dragStateRef.current.isDragging = true;
    dragStateRef.current.draggedHandle = handle;
    dragStateRef.current.initialMouseY = e.clientY;
    dragStateRef.current.initialRidgeHeight = currentRidgeHeight;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Cleanup event listeners on unmount or selectedBuildingId change
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div style={{
      height: '100%',
      backgroundColor: '#1e1e1e',
      padding: '1rem',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      color: '#e0e0e0'
    }}>
      <div style={{ marginBottom: '1rem', fontWeight: 'bold' }}>Elevations</div>

      <div style={{
        flex: 1,
        position: 'relative',
        border: '1px solid #444',
        backgroundColor: '#2c2c2c',
        padding: '10px'
      }}>

        {!selectedBuilding ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#888',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            No building selected. Please select a building to view its elevation.
          </div>
        ) : selectedBuilding.type === 'flat' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#888',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            Elevation is not available for flat roofs.
          </div>
        ) : (
          /* Building representation - side view */
          <div style={{
            width: '70%',
            height: 'auto',
            margin: '30px auto 20px',
            position: 'relative'
          }}>
            {/* Roof */}
            <div style={{
              width: '100%',
              height: `${visualHeight}px`,
              backgroundColor: '#d0853a', // Roof color (orange/brown)
              position: 'absolute',
              top: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* Left handle */}
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#ffffff',
                  border: '2px solid #333',
                  borderRadius: '50%',
                  position: 'absolute',
                  left: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'ns-resize',
                  zIndex: 2
                }}
                onMouseDown={(e) => handleHandleMouseDown(e, 'left')}
              />

                  {/* Right handle */}
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#ffffff',
                      border: '2px solid #333',
                      borderRadius: '50%',
                      position: 'absolute',
                      right: '-6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      cursor: 'ns-resize',
                      zIndex: 2
                    }}
                    onMouseDown={(e) => handleHandleMouseDown(e, 'right')}
                  />

                  <span style={{
                    color: '#fff',
                    fontSize: '12px',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                    position: 'absolute',
                    width: '100%',
                    textAlign: 'center'
                  }}>
                    Height: {Math.round(currentRidgeHeight * 100) / 100}
                  </span>
                </div>

                {/* Building body */}
                <div style={{
                  width: '100%',
                  height: '100px',
                  backgroundColor: '#e0e0e0', // Building color (light grey)
                  position: 'absolute',
                  top: `${visualHeight}px`,
                  border: '1px solid #aaa',
                  borderTop: 'none',
                }} />
              </div>
        )}
      </div>
    </div>
  );
};

export default ElevationViewport;
