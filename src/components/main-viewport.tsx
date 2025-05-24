"use client"
import { useEffect, useRef, useCallback } from 'react';
import {
  Engine,
  Scene,
  Color4,
  PointerEventTypes,
  PickingInfo,
  Mesh,
  GizmoManager,
  UtilityLayerRenderer
} from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { useRoofBuilder, Building } from '../store/RoofBuilderContext';
import { createBuildingMesh } from '../utils/buildingMeshes';

// Import setup functions from separate files
import { setupCamera } from '../scene/setupCamera';
import { setupGround } from '../scene/setupGround';
import { setupGizmoManager, BuildingEditor, BuildingMoveGizmo } from '../scene/setupGizmoManager';
import MainToolbar from './main-toolbar';

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
    updateBuilding
  } = useRoofBuilder();

  // Track meshes
  const buildingMeshesRef = useRef<Map<string, Mesh>>(new Map());
  const ghostBuildingRef = useRef<Mesh | null>(null);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);

  // Replace the rotation gizmo ref with our new building editor ref
  const buildingEditorRef = useRef<BuildingEditor | null>(null);
  const buildingMoveGizmoRef = useRef<BuildingMoveGizmo | null>(null);
  const utilityLayerRef = useRef<UtilityLayerRenderer | null>(null);

  // Track editor mode
  const currentEditorMode = useRef<'move' | 'edit' | null>(null);

  // Handle pointer move event
  const handlePointerMove = useCallback((pickResult: PickingInfo) => {
    if (!sceneRef.current) return;

    console.log("handlePointerMove called", {
      placementMode,
      hasGhostBuilding: !!ghostBuildingRef.current,
      hit: pickResult.hit,
      pickedMeshName: pickResult.pickedMesh?.name,
      pickedPoint: pickResult.pickedPoint
    });

    // Update ghost building position in placement mode
    if (placementMode && ghostBuildingRef.current) {
      if (pickResult.hit && pickResult.pickedMesh?.name === 'ground') {
        console.log("Enabling ghost building at", pickResult.pickedPoint);
        ghostBuildingRef.current.setEnabled(true);
        ghostBuildingRef.current.position.x = pickResult.pickedPoint!.x;
        ghostBuildingRef.current.position.z = pickResult.pickedPoint!.z;
      } else {
        console.log("Hiding ghost building - not over ground");
        // Hide ghost building when not over ground
        ghostBuildingRef.current.setEnabled(false);
      }
    }
  }, [placementMode]);

  // Handle pointer down event
  const handlePointerDown = useCallback((pickResult: PickingInfo) => {
    if (!sceneRef.current) return;

    console.log("handlePointerDown called", {
      placementMode,
      currentRoofType,
      hit: pickResult.hit,
      pickedMeshName: pickResult.pickedMesh?.name,
      pickedPoint: pickResult.pickedPoint
    });

    // Place a building in placement mode
    if (placementMode && currentRoofType && pickResult.hit && pickResult.pickedMesh?.name === 'ground' && pickResult.pickedPoint) {
      console.log("✅ All conditions met - Adding building", currentRoofType, "at position", pickResult.pickedPoint);

      const position = {
        x: pickResult.pickedPoint.x,
        z: pickResult.pickedPoint.z
      };

      const newBuilding: Building = {
        id: uuidv4(),
        type: currentRoofType,
        position,
        rotation: 0,
        width: 3,
        length: 5,
        height: 5,
        ...(currentRoofType === 'dualPitch' ? { ridgeHeight: 1, ridgeOffset: 0 } : {})
      };

      console.log("📦 Created building object:", newBuilding);
      addBuilding(newBuilding);
      setPlacementMode(false);
    } else {
      console.log("❌ Placement conditions not met:", {
        hasPlacementMode: !!placementMode,
        hasCurrentRoofType: !!currentRoofType,
        hasHit: !!pickResult.hit,
        isGroundMesh: pickResult.pickedMesh?.name === 'ground',
        hasPickedPoint: !!pickResult.pickedPoint
      });
    }
  }, [placementMode, currentRoofType, addBuilding, setPlacementMode]);

  // Set up pointer events observer
  useEffect(() => {
    if (!sceneRef.current) return;

    console.log("🖱️ Setting up pointer observer");

    const observer = sceneRef.current.onPointerObservable.add((pointerInfo) => {
      console.log("Pointer event type:", pointerInfo.type);

      const pickResult = sceneRef.current!.pick(sceneRef.current!.pointerX, sceneRef.current!.pointerY);
      console.log("Pick result", {
        hit: pickResult.hit,
        pickedMeshName: pickResult.pickedMesh?.name,
        pickedPoint: pickResult.pickedPoint
      });

      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        handlePointerMove(pickResult);
      } else if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        console.log("POINTER DOWN", {
          placementMode,
          currentRoofType,
          ghostBuildingEnabled: ghostBuildingRef.current?.isEnabled()
        });
        handlePointerDown(pickResult);
      }
    });

    return () => {
      console.log("🖱️ Cleaning up pointer observer");
      sceneRef.current?.onPointerObservable.remove(observer);
    };
  }, [handlePointerMove, handlePointerDown, placementMode, currentRoofType]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the BabylonJS engine
    const engine = new Engine(canvasRef.current, true);
    engineRef.current = engine;

    // Create a new scene
    const scene = new Scene(engine);
    sceneRef.current = scene;

    console.log("Scene initialized");

    // Set the clear color (sky color)
    scene.clearColor = new Color4(0.9, 0.9, 0.9, 1);

    // Setup camera using the imported helper function
    setupCamera(scene, canvasRef.current);

    // Remove the light to avoid affecting the ground texture
    // const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    // light.intensity = 0.7;

    // Setup ground using the imported helper function
    setupGround(scene);

    // Setup gizmo manager using the imported helper function (we'll still use it for moving)
    const gizmoManager = setupGizmoManager(scene);
    gizmoManagerRef.current = gizmoManager;

    // Create utility layer for our custom controls
    const utilityLayer = new UtilityLayerRenderer(scene);
    utilityLayerRef.current = utilityLayer;

    // Create our custom building editor
    const buildingEditor = new BuildingEditor(scene);
    buildingEditorRef.current = buildingEditor;

    // Set up observer to update building data when editor modifies it
    buildingEditor.onBuildingModifiedObservable.add((modifiedBuilding) => {
      // Create a shallow copy of the building to ensure React detects the change
      updateBuilding(modifiedBuilding.id, {
        ...modifiedBuilding,
        position: { ...modifiedBuilding.position }
      });
    });

    // Create our custom move gizmo
    const buildingMoveGizmo = new BuildingMoveGizmo(scene);
    buildingMoveGizmoRef.current = buildingMoveGizmo;

    // Set up observer to update building data when move gizmo modifies it
    buildingMoveGizmo.onBuildingMovedObservable.add((movedBuilding) => {
      // Create a shallow copy of the building to ensure React detects the change
      updateBuilding(movedBuilding.id, {
        ...movedBuilding,
        position: { ...movedBuilding.position }
      });
    });

    // Pointer events will be set up in a separate useEffect

    // Ground action manager is not needed - we handle clicks through the scene pointer observer

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

      // Clean up custom gizmos
      if (buildingEditorRef.current) {
        buildingEditorRef.current.dispose();
        buildingEditorRef.current = null;
      }

      if (buildingMoveGizmoRef.current) {
        buildingMoveGizmoRef.current.dispose();
        buildingMoveGizmoRef.current = null;
      }

      engine.dispose();
    };
  }, []);

  // Update scene when buildings change
  useEffect(() => {
    if (!sceneRef.current) return;

    console.log("Buildings updated:", buildings);
    console.log("Selected building ID:", selectedBuildingId);

    // Clear existing building meshes
    buildingMeshesRef.current.forEach((mesh) => {
      mesh.dispose();
    });
    buildingMeshesRef.current.clear();

    // Detach editor from any previously selected mesh
    if (buildingEditorRef.current) {
      buildingEditorRef.current.detach();
    }

    // Detach move gizmo from any previously selected mesh
    if (buildingMoveGizmoRef.current) {
      buildingMoveGizmoRef.current.detach();
    }

    // Detach native gizmo from any previously selected mesh (we'll remove this later)
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.attachToMesh(null);
    }

    // Create meshes for each building
    buildings.forEach((building) => {
      // Create the building mesh
      const buildingMesh = createBuildingMesh(sceneRef.current!, building);
      buildingMeshesRef.current.set(building.id, buildingMesh);

      // Attach appropriate control to the selected building
      if (building.id === selectedBuildingId) {
        console.log("Attaching controls to selected building:", building.id);

        if (currentEditorMode.current === 'move') {
          // Use our custom move gizmo
          buildingMoveGizmoRef.current?.attach(building, buildingMesh);
        } else if (currentEditorMode.current === 'edit') {
          // Use our custom editor for resizing/rotating
          buildingEditorRef.current?.attach(building, buildingMesh);
        }
      }
    });
  }, [buildings, selectedBuildingId]);

  // Update ghost building for placement mode
  useEffect(() => {
    if (!sceneRef.current) return;

    console.log("🔄 Ghost building useEffect triggered:", { placementMode, currentRoofType });

    // Dispose of existing ghost building
    if (ghostBuildingRef.current) {
      console.log("🗑️ Disposing existing ghost building");
      ghostBuildingRef.current.dispose();
      ghostBuildingRef.current = null;
    }

    // Create a new ghost building if in placement mode
    if (placementMode && currentRoofType) {
      console.log("👻 Creating new ghost building for", currentRoofType);

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
      console.log("👻 Ghost mesh created:", ghostMesh);

      // Make it semi-transparent
      ghostMesh.getChildMeshes().forEach(mesh => {
        if (mesh.material) {
          mesh.material.alpha = 0.5;
        }
      });

      ghostBuildingRef.current = ghostMesh;

      // Initially hide the ghost building
      ghostMesh.setEnabled(false);
      console.log("👻 Ghost building created and hidden");
    } else {
      console.log("❌ Not creating ghost building - placementMode:", placementMode, "currentRoofType:", currentRoofType);
    }
  }, [placementMode, currentRoofType]);

  // Enable move gizmo
  const enableMoveGizmo = () => {
    if (!buildingMoveGizmoRef.current || !buildingEditorRef.current || !selectedBuildingId) return;

    // Detach editor
    buildingEditorRef.current.detach();

    // Disable all native gizmos
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.positionGizmoEnabled = false;
      gizmoManagerRef.current.rotationGizmoEnabled = false;
      gizmoManagerRef.current.scaleGizmoEnabled = false;
      gizmoManagerRef.current.attachToMesh(null);
    }

    // Find the selected building data and mesh
    const building = buildings.find(b => b.id === selectedBuildingId);
    const buildingMesh = buildingMeshesRef.current.get(selectedBuildingId);

    if (building && buildingMesh) {
      // Attach our custom move gizmo
      buildingMoveGizmoRef.current.attach(building, buildingMesh);
    }

    currentEditorMode.current = 'move';
  };

  // Enable custom building editor
  const enableBuildingEditor = () => {
    if (!buildingEditorRef.current || !buildingMoveGizmoRef.current || !selectedBuildingId) return;

    // Detach move gizmo
    buildingMoveGizmoRef.current.detach();

    // Disable all standard gizmos
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.positionGizmoEnabled = false;
      gizmoManagerRef.current.rotationGizmoEnabled = false;
      gizmoManagerRef.current.scaleGizmoEnabled = false;
      gizmoManagerRef.current.attachToMesh(null);
    }

    // Find the selected building data and mesh
    const building = buildings.find(b => b.id === selectedBuildingId);
    const buildingMesh = buildingMeshesRef.current.get(selectedBuildingId);

    if (building && buildingMesh) {
      // Attach our custom editor
      buildingEditorRef.current.attach(building, buildingMesh);
    }

    currentEditorMode.current = 'edit';
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
      <MainToolbar
        selectedBuildingId={selectedBuildingId}
        currentEditorMode={currentEditorMode}
        onEnableMoveGizmo={enableMoveGizmo}
        onEnableBuildingEditor={enableBuildingEditor}
      />

      <div style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%' }}
        />
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
