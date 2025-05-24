"use client"
import { useRoofBuilder } from '../store/RoofBuilderContext';

// Icon components using SVG
const FlatRoofIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="10" width="18" height="2" />
    <rect x="5" y="12" width="14" height="6" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const DualPitchRoofIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 16 L12 8 L21 16 L21 18 L3 18 Z" stroke="currentColor" strokeWidth="1" fill="none" />
    <path d="M5 16 L5 20 L19 20 L19 16" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const MoveIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2 L12 22 M2 12 L22 12" stroke="currentColor" strokeWidth="2" />
    <path d="M8 6 L12 2 L16 6 M8 18 L12 22 L16 18 M6 8 L2 12 L6 16 M18 8 L22 12 L18 16"
      stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const EditIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17.25 V21 H6.75 L17.81 9.94 L14.06 6.19 L3 17.25 Z M20.71 7.04 C21.1 6.65 21.1 6.02 20.71 5.63 L18.37 3.29 C17.98 2.9 17.35 2.9 16.96 3.29 L15.13 5.12 L18.88 8.87 L20.71 7.04 Z"
      stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

// Add a delete icon
const DeleteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
      stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

interface MainToolbarProps {
  selectedBuildingId: string | null;
  currentEditorMode: 'move' | 'edit' | null;
  onEnableMoveGizmo: () => void;
  onEnableBuildingEditor: () => void;
}

const MainToolbar = ({
  selectedBuildingId,
  currentEditorMode,
  onEnableMoveGizmo,
  onEnableBuildingEditor
}: MainToolbarProps) => {
  const {
    buildings,
    placementMode,
    currentRoofType,
    setPlacementMode,
    setCurrentRoofType,
    selectBuilding,
    deleteBuilding
  } = useRoofBuilder();

  return (
    <div style={{
      marginBottom: '0.5rem',
      display: 'flex',
      gap: '0.5rem',
      flexWrap: 'wrap'
    }}>
      {/* Building Placement Toolbar */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '0.5rem',
        backgroundColor: '#e8f5e8',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: '1px solid #c8e6c9'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '500',
          color: '#2e7d32',
          display: 'flex',
          alignItems: 'center',
          marginRight: '0.5rem'
        }}>
          Add Building:
        </div>
        <button
          onClick={() => {
            setPlacementMode(true);
            setCurrentRoofType('flat');
            console.log("Flat roof button clicked", { placementMode: true, currentRoofType: 'flat' });
          }}
          style={{
            padding: '0.75rem',
            backgroundColor: currentRoofType === 'flat' && placementMode ? '#2196f3' : '#f5f5f5',
            color: currentRoofType === 'flat' && placementMode ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            minWidth: '48px',
            minHeight: '48px'
          }}
          title="Flat Roof"
        >
          <FlatRoofIcon />
        </button>
        <button
          onClick={() => {
            setPlacementMode(true);
            setCurrentRoofType('dualPitch');
            console.log("Dual pitch roof button clicked", { placementMode: true, currentRoofType: 'dualPitch' });
          }}
          style={{
            padding: '0.75rem',
            backgroundColor: currentRoofType === 'dualPitch' && placementMode ? '#2196f3' : '#f5f5f5',
            color: currentRoofType === 'dualPitch' && placementMode ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            minWidth: '48px',
            minHeight: '48px'
          }}
          title="Dual Pitch Roof"
        >
          <DualPitchRoofIcon />
        </button>
      </div>

      {/* Building Selection Toolbar */}
      {buildings.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #90caf9'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#1565c0',
            display: 'flex',
            alignItems: 'center',
            marginRight: '0.5rem'
          }}>
            Select Building:
          </div>
          <select
            value={selectedBuildingId || ''}
            onChange={(e) => selectBuilding(e.target.value || null)}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              fontSize: '14px',
              minWidth: '150px'
            }}
          >
            <option value="">None</option>
            {buildings.map((building, index) => (
              <option key={building.id} value={building.id}>
                Building {index + 1} ({building.type === 'flat' ? 'Flat' : 'Dual Pitch'})
              </option>
            ))}
          </select>
          {selectedBuildingId && (
            <button
              onClick={() => {
                if (selectedBuildingId && window.confirm('Are you sure you want to delete this building?')) {
                  deleteBuilding(selectedBuildingId);
                }
              }}
              style={{
                padding: '0.5rem',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              title="Delete Building"
            >
              <DeleteIcon />
            </button>
          )}
        </div>
      )}

      {/* Building Edit Toolbar - Only show when a building is selected */}
      {selectedBuildingId && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#fff3e0',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #ffcc02'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#e65100',
            display: 'flex',
            alignItems: 'center',
            marginRight: '0.5rem'
          }}>
            Edit Building:
          </div>
          <button
            onClick={onEnableMoveGizmo}
            style={{
              padding: '0.75rem',
              backgroundColor: currentEditorMode === 'move' ? '#2196f3' : '#f5f5f5',
              color: currentEditorMode === 'move' ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              minWidth: '48px',
              minHeight: '48px'
            }}
            title="Move Building"
          >
            <MoveIcon />
          </button>
          <button
            onClick={onEnableBuildingEditor}
            style={{
              padding: '0.75rem',
              backgroundColor: currentEditorMode === 'edit' ? '#2196f3' : '#f5f5f5',
              color: currentEditorMode === 'edit' ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              minWidth: '48px',
              minHeight: '48px'
            }}
            title="Edit Size & Rotation"
          >
            <EditIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default MainToolbar; 