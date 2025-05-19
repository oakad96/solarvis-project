"use client"
import { useEffect, useRef } from 'react';
import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  ArcRotateCamera,
  Mesh
} from '@babylonjs/core';
import { useRoofBuilder } from '../store/RoofBuilderContext';
import { createBuildingMesh } from '../utils/buildingMeshes';

const ThreeDViewport = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  const { buildings, selectedBuildingId } = useRoofBuilder();

  // Track building meshes
  const buildingMeshesRef = useRef<Map<string, Mesh>>(new Map());

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the BabylonJS engine
    const engine = new Engine(canvasRef.current, true);
    engineRef.current = engine;

    // Create a new scene
    const scene = new Scene(engine);
    sceneRef.current = scene;

    // Set the clear color (sky color)
    scene.clearColor = new Color4(0.8, 0.8, 0.9, 1);

    // Create a perspective camera for 3D view
    const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3, 15, new Vector3(0, 0, 0), scene);
    camera.minZ = 0.1;
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 30;
    camera.attachControl(canvasRef.current, true);

    // Add a light to illuminate the scene
    const light = new HemisphericLight('light', new Vector3(0.5, 1, 0.3), scene);
    light.intensity = 0.8;

    // Create the ground
    const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
    const groundMaterial = new StandardMaterial('groundMaterial', scene);
    groundMaterial.diffuseColor = new Color3(0.2, 0.4, 0.2);
    ground.material = groundMaterial;

    // Start the render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle window resize
    const resizeHandler = () => {
      engine.resize();
    };
    window.addEventListener('resize', resizeHandler);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeHandler);
      engine.dispose();
    };
  }, []);

  // Update scene when buildings change
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear existing building meshes
    buildingMeshesRef.current.forEach((mesh) => {
      mesh.dispose();
    });
    buildingMeshesRef.current.clear();

    // Create meshes for each building
    buildings.forEach((building) => {
      const buildingMesh = createBuildingMesh(sceneRef.current!, building);
      buildingMeshesRef.current.set(building.id, buildingMesh);

      // Highlight selected building
      if (building.id === selectedBuildingId) {
        buildingMesh.getChildMeshes().forEach(mesh => {
          if (mesh.material) {
            const mat = mesh.material as StandardMaterial;
            mat.emissiveColor = new Color3(0.2, 0.2, 0.2);
          }
        });
      }
    });
  }, [buildings, selectedBuildingId]);

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
