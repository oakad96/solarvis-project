"use client"
import { createContext, useContext, useState, ReactNode } from 'react';

export type RoofType = 'flat' | 'dualPitch';
export type ControlPoint = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'midTop' | 'midRight' | 'midBottom' | 'midLeft';

export interface Building {
  id: string;
  type: RoofType;
  position: { x: number, z: number };
  rotation: number;
  width: number;
  length: number;
  height: number;
  // For dual pitch roofs
  ridgeHeight?: number;
  ridgeOffset?: number;
}

interface RoofBuilderContextType {
  buildings: Building[];
  selectedBuildingId: string | null;
  placementMode: boolean;
  currentRoofType: RoofType | null;

  // Actions
  setPlacementMode: (mode: boolean) => void;
  setCurrentRoofType: (type: RoofType | null) => void;
  addBuilding: (building: Building) => void;
  updateBuilding: (id: string, updates: Partial<Building>) => void;
  selectBuilding: (id: string | null) => void;
  deleteBuilding: (id: string) => void;
}

const RoofBuilderContext = createContext<RoofBuilderContextType | undefined>(undefined);

export const useRoofBuilder = () => {
  const context = useContext(RoofBuilderContext);
  if (context === undefined) {
    throw new Error('useRoofBuilder must be used within a RoofBuilderProvider');
  }
  return context;
};

interface RoofBuilderProviderProps {
  children: ReactNode;
}

export const RoofBuilderProvider = ({ children }: RoofBuilderProviderProps) => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [currentRoofType, setCurrentRoofType] = useState<RoofType | null>(null);

  const addBuilding = (building: Building) => {
    setBuildings((prev) => [...prev, building]);
    setSelectedBuildingId(building.id);
  };

  const updateBuilding = (id: string, updates: Partial<Building>) => {
    setBuildings((prev) => prev.map((building) =>
      building.id === id ? { ...building, ...updates } : building
    ));
  };

  const selectBuilding = (id: string | null) => {
    setSelectedBuildingId(id);
  };

  const deleteBuilding = (id: string) => {
    setBuildings((prev) => prev.filter((building) => building.id !== id));
    if (selectedBuildingId === id) {
      setSelectedBuildingId(null);
    }
  };

  return (
    <RoofBuilderContext.Provider
      value={{
        buildings,
        selectedBuildingId,
        placementMode,
        currentRoofType,
        setPlacementMode,
        setCurrentRoofType,
        addBuilding,
        updateBuilding,
        selectBuilding,
        deleteBuilding,
      }}
    >
      {children}
    </RoofBuilderContext.Provider>
  );
};