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
  Mesh,
  Texture
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

    // Create a checkboard/grid pattern with tiling
    const gridTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAACXBIWXMAAAsTAAALEwEAmpwYAAAGnmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0NDYwLCAyMDIwLzA1LzEyLTE2OjA0OjE3ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIGV4aWY6UGl4ZWxYRGltZW5zaW9uPSIxMjgiIGV4aWY6UGl4ZWxZRGltZW5zaW9uPSIxMjgiIHhtcDpDcmVhdGVEYXRlPSIyMDE5LTAyLTA3VDE2OjQ0OjA4KzAxOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMC0wNi0yM1QxNToxMTozOSswMjowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyMC0wNi0yM1QxNToxMTozOSswMjowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo0ZmRlZjE2MS0wOWIzLTQ1OGEtODY1Zi1lYWRjMTk0NzljZTMiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpmZjE3YWE2ZC1iNDRlLTZhNGUtYTYzOC05NDhhYjQyNTgyMzYiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowZjNkYWU4NS1jNzE0LTQ2OTAtOWI5Yi0xM2E3YjZlOWI1MTciPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDowZjNkYWU4NS1jNzE0LTQ2OTAtOWI5Yi0xM2E3YjZlOWI1MTciIHN0RXZ0OndoZW49IjIwMTktMDItMDdUMTY6NDY6MzcrMDE6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyBNYWMgKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjRmZGVmMTYxLTA5YjMtNDU4YS04NjVmLWVhZGMxOTQ3OWNlMyIgc3RFdnQ6d2hlbj0iMjAyMC0wNi0yM1QxNToxMTozOSswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDIxLjEgKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+OhvURAAAAQVJREFUeJzt17ENwkAQRUEmukJCCk5MkQmQUiJ6YIwSc9svbL/w3z9n6dlZb0spuZ+sP2Y32f3yd8g1bMgVlFJmNzMOvM9X8zi6Ac4ngLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2Cr0Q1wPgHMBTAXwFwAcwHMBTAXwFwAcwHMBTAXwFwAcwHMBTAXwFwAcwHMBTAXwFwAcwHMBbAXVFcC+5PN2BIAAAAASUVORK5CYII=", scene);
    gridTexture.uScale = 20;
    gridTexture.vScale = 20;
    groundMaterial.diffuseTexture = gridTexture;

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
