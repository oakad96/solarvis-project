"use client"
import { useEffect } from 'react';
import { useRoofBuilder } from '../store/RoofBuilderContext';
import { useBabylonEngine } from '../hooks/useBabylonEngine';
import { setup3DCamera } from '../scene/setup3DCamera';
import { setupEnvironment } from '../scene/setupEnvironment';
import { useShadowGenerator } from '../hooks/useShadowGenerator';
import { useBuildingsRenderer } from '../hooks/useBuildingsRenderer';

const ThreeDViewport = () => {
  const { buildings, selectedBuildingId } = useRoofBuilder();

  // Initialize Babylon engine and scene
  const { scene, canvas, canvasRef } = useBabylonEngine();

  // Create and manage shadow generator
  const shadowGenerator = useShadowGenerator(scene);

  // Setup scene components when the scene is ready
  useEffect(() => {
    if (!scene || !canvas) return;

    // Setup camera - store the returned camera
    const camera = setup3DCamera(scene, canvas);

    // Make sure it's set as the active camera
    scene.activeCamera = camera;

    // Setup environment (ground, skybox, etc.)
    setupEnvironment(scene);

    // No cleanup needed as this is handled in useBabylonEngine
  }, [scene, canvas]);

  // Manage building meshes
  useBuildingsRenderer({
    scene,
    buildings,
    selectedBuildingId,
    shadowGenerator
  });

  return (
    <div style={{
      height: '100%',
      backgroundColor: '#f0f0f0',
      padding: '0.5rem',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
        3D View
      </div>
      <div style={{ flex: 1 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default ThreeDViewport;
