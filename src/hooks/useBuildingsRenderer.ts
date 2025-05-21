"use client";

import { useEffect, useRef } from 'react';
import {
  Scene,
  Mesh,
  PBRMaterial,
  Color3,
  ShadowGenerator,
  AbstractMesh
} from '@babylonjs/core';
import { Building } from '../store/RoofBuilderContext';
import { createEnhancedBuildingMesh } from '../utils/createEnhancedBuildingMesh';

interface BuildingsRendererProps {
  scene: Scene | null;
  buildings: Building[];
  selectedBuildingId: string | null;
  shadowGenerator: ShadowGenerator | null;
}

/**
 * Hook to manage building meshes lifecycle and updates
 * @param props Scene, buildings data, selected building ID, and shadow generator
 * @returns Map of building meshes
 */
export const useBuildingsRenderer = (props: BuildingsRendererProps): Map<string, Mesh> => {
  const { scene, buildings, selectedBuildingId, shadowGenerator } = props;
  const buildingMeshesRef = useRef<Map<string, Mesh>>(new Map());

  // Update scene when buildings change
  useEffect(() => {
    if (!scene || !shadowGenerator) return;

    // Clear existing building meshes
    buildingMeshesRef.current.forEach((mesh) => {
      mesh.dispose();
    });
    buildingMeshesRef.current.clear();

    // Create meshes for each building
    buildings.forEach((building) => {
      // Create the building mesh with custom implementation
      const buildingMesh = createEnhancedBuildingMesh(scene, building);
      buildingMeshesRef.current.set(building.id, buildingMesh);

      // Add mesh to shadow generator
      buildingMesh.getChildMeshes().forEach((mesh: AbstractMesh) => {
        shadowGenerator.addShadowCaster(mesh);
      });

      // Highlight selected building
      if (building.id === selectedBuildingId) {
        buildingMesh.getChildMeshes().forEach((mesh: AbstractMesh) => {
          if (mesh.material && mesh.material instanceof PBRMaterial) {
            mesh.material.emissiveColor = new Color3(0.1, 0.1, 0.2);
            mesh.material.emissiveIntensity = 0.3;
          }
        });
      }
    });

    return () => {
      // Cleanup meshes on unmount or before re-creating
      buildingMeshesRef.current.forEach((mesh) => {
        mesh.dispose();
      });
      buildingMeshesRef.current.clear();
    };
  }, [scene, buildings, selectedBuildingId, shadowGenerator]);

  return buildingMeshesRef.current;
}; 