"use client"
import { useEffect, useRef, useState } from 'react';
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
  Mesh,
  PointerEventTypes
} from '@babylonjs/core';
import { useRoofBuilder } from '../store/RoofBuilderContext';
import { createBuildingMesh } from '../utils/buildingMeshes';

const ElevationViewport = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  const { buildings, selectedBuildingId, updateBuilding } = useRoofBuilder();
  const [sliderValue, setSliderValue] = useState(1);
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

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
    scene.clearColor = new Color4(0.85, 0.85, 0.9, 1);

    // Create a side view camera (elevation view)
    const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2, 10, new Vector3(0, 0, 0), scene);
    camera.minZ = 0.1;

    // Lock camera to side view only
    camera.lowerAlphaLimit = camera.upperAlphaLimit = Math.PI / 2;
    camera.lowerBetaLimit = camera.upperBetaLimit = Math.PI / 2;
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 12;
    camera.attachControl(canvasRef.current, false);

    // Add a light to illuminate the scene
    const light = new HemisphericLight('light', new Vector3(0, 1, 0.5), scene);
    light.intensity = 0.8;

    // Create a reference ground line
    const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 0.5 }, scene);
    const groundMaterial = new StandardMaterial('groundMaterial', scene);
    groundMaterial.diffuseColor = new Color3(0.2, 0.4, 0.2);
    ground.material = groundMaterial;

    // Start the render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle interaction for slope adjustment
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN && selectedBuildingId) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.name.startsWith('roof-')) {
          // Start tracking pointer movement for slope adjustment
          const startY = scene.pointerY;
          const startHeight = selectedBuilding?.ridgeHeight || 1;

          const moveHandler = (event: MouseEvent) => {
            const deltaY = startY - event.clientY;
            const newHeight = Math.max(0.2, startHeight + deltaY * 0.05);

            if (selectedBuilding && selectedBuilding.type === 'dualPitch') {
              updateBuilding(selectedBuildingId, { ridgeHeight: newHeight });
              setSliderValue(newHeight);
            }
          };

          const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
          };

          document.addEventListener('mousemove', moveHandler);
          document.addEventListener('mouseup', upHandler);
        }
      }
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
  }, [selectedBuildingId, updateBuilding]);

  // Update scene when buildings change
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear existing building meshes
    buildingMeshesRef.current.forEach((mesh) => {
      mesh.dispose();
    });
    buildingMeshesRef.current.clear();

    // Only show the selected building in elevation view
    if (selectedBuildingId) {
      const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
      if (selectedBuilding) {
        const buildingMesh = createBuildingMesh(sceneRef.current, selectedBuilding);
        buildingMeshesRef.current.set(selectedBuilding.id, buildingMesh);

        // Update slider to match current ridge height
        if (selectedBuilding.type === 'dualPitch' && selectedBuilding.ridgeHeight) {
          setSliderValue(selectedBuilding.ridgeHeight);
        }
      }
    }
  }, [buildings, selectedBuildingId]);

  // Handle slider change for ridge height adjustment
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSliderValue(value);

    if (selectedBuildingId && selectedBuilding?.type === 'dualPitch') {
      updateBuilding(selectedBuildingId, { ridgeHeight: value });
    }
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
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
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
            Drag roof or use slider to adjust slope
          </div>
        )}
      </div>
    </div>
  );
};

export default ElevationViewport;
