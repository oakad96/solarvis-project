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
  Texture,
  PointerEventTypes,
  PickingInfo,
  Mesh,
  ArcRotateCamera
} from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { useRoofBuilder, Building } from '../store/RoofBuilderContext';
import { createBuildingMesh, createControlPointsMesh } from '../utils/buildingMeshes';

const MainViewport = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  const {
    buildings,
    selectedBuildingId,
    placementMode,
    currentRoofType,
    setPlacementMode,
    addBuilding,
    updateBuilding,
    selectBuilding,
    setCurrentRoofType
  } = useRoofBuilder();

  // Track meshes
  const buildingMeshesRef = useRef<Map<string, Mesh>>(new Map());
  const controlPointsRef = useRef<Map<string, Mesh[]>>(new Map());
  const ghostBuildingRef = useRef<Mesh | null>(null);
  const selectedControlPoint = useRef<{ buildingId: string, controlType: string } | null>(null);
  const pointerStartPosition = useRef<{ x: number, z: number } | null>(null);
  const buildingStartData = useRef<Building | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the BabylonJS engine
    const engine = new Engine(canvasRef.current, true);
    engineRef.current = engine;

    // Create a new scene
    const scene = new Scene(engine);
    sceneRef.current = scene;

    // Set the clear color (sky color)
    scene.clearColor = new Color4(0.9, 0.9, 0.9, 1);

    // Create a top-down orthographic camera for 2D view
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, 0, 20, new Vector3(0, 0, 0), scene);
    camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
    camera.minZ = 0.1;
    camera.orthoTop = 10;
    camera.orthoBottom = -10;
    camera.orthoLeft = -10;
    camera.orthoRight = 10;

    // Lock camera rotation
    camera.lowerAlphaLimit = camera.upperAlphaLimit = -Math.PI / 2;
    camera.lowerBetaLimit = camera.upperBetaLimit = 0;

    // Disable camera controls for pure 2D interaction
    camera.attachControl(canvasRef.current, false);

    // Add a light to illuminate the scene
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Create the ground with a textured grid
    const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
    const groundMaterial = new StandardMaterial('groundMaterial', scene);
    groundMaterial.diffuseColor = new Color3(0.2, 0.4, 0.2);
    ground.material = groundMaterial;

    // Setup grid texture for the ground
    const gridTexture = new Texture('/grid.png', scene);
    groundMaterial.diffuseTexture = gridTexture;

    // Handle pointer events for placement and control point interactions
    scene.onPointerObservable.add((pointerInfo) => {
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);

      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        handlePointerMove(pickResult);
      } else if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        handlePointerDown(pickResult);
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
        handlePointerUp();
      }
    });

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

    // Clear existing building meshes and control points
    buildingMeshesRef.current.forEach((mesh) => {
      mesh.dispose();
    });
    buildingMeshesRef.current.clear();

    controlPointsRef.current.forEach((points) => {
      points.forEach((point) => point.dispose());
    });
    controlPointsRef.current.clear();

    // Create meshes for each building
    buildings.forEach((building) => {
      const buildingMesh = createBuildingMesh(sceneRef.current!, building);
      buildingMeshesRef.current.set(building.id, buildingMesh);

      // Add control points if this is the selected building
      if (building.id === selectedBuildingId) {
        const controlPoints = createControlPointsMesh(sceneRef.current!, building);
        controlPointsRef.current.set(building.id, controlPoints);
      }
    });
  }, [buildings, selectedBuildingId]);

  // Update ghost building for placement mode
  useEffect(() => {
    if (!sceneRef.current) return;

    // Dispose of existing ghost building
    if (ghostBuildingRef.current) {
      ghostBuildingRef.current.dispose();
      ghostBuildingRef.current = null;
    }

    // Create a new ghost building if in placement mode
    if (placementMode && currentRoofType) {
      const ghostBuilding: Building = {
        id: 'ghost',
        type: currentRoofType,
        position: { x: 0, z: 0 },
        rotation: 0,
        width: 3,
        length: 5,
        height: 2,
        ...(currentRoofType === 'dualPitch' ? { ridgeHeight: 1 } : {})
      };

      const ghostMesh = createBuildingMesh(sceneRef.current, ghostBuilding);

      // Make it semi-transparent
      ghostMesh.getChildMeshes().forEach(mesh => {
        if (mesh.material) {
          mesh.material.alpha = 0.5;
        }
      });

      ghostBuildingRef.current = ghostMesh;

      // Initially hide the ghost building
      ghostMesh.setEnabled(false);
    }
  }, [placementMode, currentRoofType]);

  // Handle pointer move event
  const handlePointerMove = (pickResult: PickingInfo) => {
    if (!sceneRef.current) return;

    // Update ghost building position in placement mode
    if (placementMode && ghostBuildingRef.current && pickResult.hit && pickResult.pickedMesh?.name === 'ground') {
      ghostBuildingRef.current.setEnabled(true);
      ghostBuildingRef.current.position.x = pickResult.pickedPoint!.x;
      ghostBuildingRef.current.position.z = pickResult.pickedPoint!.z;
    }

    // Handle control point dragging
    if (selectedControlPoint.current && pointerStartPosition.current && buildingStartData.current) {
      const { buildingId, controlType } = selectedControlPoint.current;
      const building = buildings.find(b => b.id === buildingId);

      if (building && pickResult.hit && pickResult.pickedPoint) {
        const currentPosition = {
          x: pickResult.pickedPoint.x,
          z: pickResult.pickedPoint.z
        };

        // Calculate delta in world space
        const dx = currentPosition.x - pointerStartPosition.current.x;
        const dz = currentPosition.z - pointerStartPosition.current.z;

        // Transform based on control point type
        const updatedBuilding = { ...building };

        switch (controlType) {
          case 'topLeft':
            updatedBuilding.width = buildingStartData.current.width - dx * 2;
            updatedBuilding.length = buildingStartData.current.length - dz * 2;
            updatedBuilding.position.x = buildingStartData.current.position.x + dx;
            updatedBuilding.position.z = buildingStartData.current.position.z + dz;
            break;
          case 'topRight':
            updatedBuilding.width = buildingStartData.current.width + dx * 2;
            updatedBuilding.length = buildingStartData.current.length - dz * 2;
            updatedBuilding.position.x = buildingStartData.current.position.x + dx;
            updatedBuilding.position.z = buildingStartData.current.position.z + dz;
            break;
          case 'bottomLeft':
            updatedBuilding.width = buildingStartData.current.width - dx * 2;
            updatedBuilding.length = buildingStartData.current.length + dz * 2;
            updatedBuilding.position.x = buildingStartData.current.position.x + dx;
            updatedBuilding.position.z = buildingStartData.current.position.z + dz;
            break;
          case 'bottomRight':
            updatedBuilding.width = buildingStartData.current.width + dx * 2;
            updatedBuilding.length = buildingStartData.current.length + dz * 2;
            updatedBuilding.position.x = buildingStartData.current.position.x + dx;
            updatedBuilding.position.z = buildingStartData.current.position.z + dz;
            break;
          case 'midTop':
            updatedBuilding.length = buildingStartData.current.length - dz * 2;
            updatedBuilding.position.z = buildingStartData.current.position.z + dz;
            break;
          case 'midRight':
            updatedBuilding.width = buildingStartData.current.width + dx * 2;
            break;
          case 'midBottom':
            updatedBuilding.length = buildingStartData.current.length + dz * 2;
            break;
          case 'midLeft':
            updatedBuilding.width = buildingStartData.current.width - dx * 2;
            updatedBuilding.position.x = buildingStartData.current.position.x + dx;
            break;
        }

        // Enforce minimum sizes
        updatedBuilding.width = Math.max(1, updatedBuilding.width);
        updatedBuilding.length = Math.max(1, updatedBuilding.length);

        updateBuilding(buildingId, updatedBuilding);
      }
    }
  };

  // Handle pointer down event
  const handlePointerDown = (pickResult: PickingInfo) => {
    if (!sceneRef.current) return;

    // Place a building in placement mode
    if (placementMode && currentRoofType && pickResult.hit && pickResult.pickedMesh?.name === 'ground' && ghostBuildingRef.current) {
      const position = {
        x: ghostBuildingRef.current.position.x,
        z: ghostBuildingRef.current.position.z
      };

      const newBuilding: Building = {
        id: uuidv4(),
        type: currentRoofType,
        position,
        rotation: 0,
        width: 3,
        length: 5,
        height: 2,
        ...(currentRoofType === 'dualPitch' ? { ridgeHeight: 1, ridgeOffset: 0 } : {})
      };

      addBuilding(newBuilding);
      setPlacementMode(false);
    }

    // Select a building
    if (!placementMode && pickResult.hit && pickResult.pickedMesh) {
      // Check if we're clicking on a control point
      if (pickResult.pickedMesh.name.startsWith('control-') && pickResult.pickedMesh.metadata) {
        const { buildingId, controlType } = pickResult.pickedMesh.metadata;
        selectedControlPoint.current = { buildingId, controlType };

        pointerStartPosition.current = {
          x: pickResult.pickedPoint!.x,
          z: pickResult.pickedPoint!.z
        };

        buildingStartData.current = { ...buildings.find(b => b.id === buildingId)! };
      }
      // Check if we're clicking on a building
      else if (pickResult.pickedMesh.name.startsWith('building-') ||
        pickResult.pickedMesh.parent?.name?.startsWith('building-parent-')) {
        const meshId = pickResult.pickedMesh.name.startsWith('building-')
          ? pickResult.pickedMesh.name.substring('building-'.length)
          : pickResult.pickedMesh.parent!.name.substring('building-parent-'.length);

        selectBuilding(meshId);
      }
      // Clicking on empty space deselects
      else if (pickResult.pickedMesh.name === 'ground') {
        selectBuilding(null);
      }
    }
  };

  // Handle pointer up event
  const handlePointerUp = () => {
    selectedControlPoint.current = null;
    pointerStartPosition.current = null;
    buildingStartData.current = null;
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f0f0f0',
      padding: '0.5rem',
      borderRadius: '4px',
    }}>
      <div style={{
        marginBottom: '0.5rem',
        display: 'flex',
        gap: '0.5rem'
      }}>
        <button
          onClick={() => {
            setPlacementMode(true);
            setCurrentRoofType('flat');
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: currentRoofType === 'flat' && placementMode ? '#2196f3' : '#e0e0e0',
            color: currentRoofType === 'flat' && placementMode ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Flat Roof
        </button>
        <button
          onClick={() => {
            setPlacementMode(true);
            setCurrentRoofType('dualPitch');
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: currentRoofType === 'dualPitch' && placementMode ? '#2196f3' : '#e0e0e0',
            color: currentRoofType === 'dualPitch' && placementMode ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Dual Pitch Roof
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        {placementMode && (
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
            Click to place {currentRoofType === 'flat' ? 'Flat' : 'Dual Pitch'} Roof
          </div>
        )}
      </div>
    </div>
  );
};

export default MainViewport;
