"use client"
import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Engine,
  Scene,
  Color4,
  PointerEventTypes,
  PickingInfo,
  Mesh,
  GizmoManager,
  UtilityLayerRenderer,
  ActionManager,
  ExecuteCodeAction
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

  // Replace the ref with state to trigger re-renders
  const [currentEditorMode, setCurrentEditorMode] = useState<'move' | 'edit' | null>(null);

  // Use refs to track current state values to avoid stale closures
  const placementModeRef = useRef(placementMode);
  const currentRoofTypeRef = useRef(currentRoofType);
  const lastClickTimeRef = useRef(0);

  // Update refs when state changes
  useEffect(() => {
    placementModeRef.current = placementMode;
  }, [placementMode]);

  useEffect(() => {
    currentRoofTypeRef.current = currentRoofType;
  }, [currentRoofType]);

  // Handle pointer move event
  const handlePointerMove = useCallback((pickResult: PickingInfo) => {
    if (!sceneRef.current) return;

    const currentPlacementMode = placementModeRef.current;

    console.log("handlePointerMove called", {
      placementMode: currentPlacementMode,
      hasGhostBuilding: !!ghostBuildingRef.current,
      hit: pickResult.hit,
      pickedMeshName: pickResult.pickedMesh?.name,
      pickedPoint: pickResult.pickedPoint
    });

    // Update ghost building position in placement mode
    if (currentPlacementMode && ghostBuildingRef.current) {
      const isGroundMesh = pickResult.pickedMesh?.name === 'ground' || pickResult.pickedMesh?.id === 'ground';
      if (pickResult.hit && isGroundMesh && pickResult.pickedPoint) {
        console.log("Enabling ghost building at", pickResult.pickedPoint);
        ghostBuildingRef.current.setEnabled(true);
        ghostBuildingRef.current.position.x = pickResult.pickedPoint.x;
        ghostBuildingRef.current.position.z = pickResult.pickedPoint.z;
      } else {
        console.log("Hiding ghost building - not over ground", {
          hit: pickResult.hit,
          meshName: pickResult.pickedMesh?.name,
          isGroundMesh,
          hasPickedPoint: !!pickResult.pickedPoint
        });
        // Hide ghost building when not over ground
        ghostBuildingRef.current.setEnabled(false);
      }
    }
  }, []);

  // Handle pointer down event
  const handlePointerDown = useCallback((pickResult: PickingInfo) => {
    if (!sceneRef.current) return;

    const currentPlacementMode = placementModeRef.current;
    const currentType = currentRoofTypeRef.current;

    console.log("handlePointerDown called", {
      placementMode: currentPlacementMode,
      currentRoofType: currentType,
      hit: pickResult.hit,
      pickedMeshName: pickResult.pickedMesh?.name,
      pickedPoint: pickResult.pickedPoint
    });

    // Place a building in placement mode
    const isGroundMesh = pickResult.pickedMesh?.name === 'ground' || pickResult.pickedMesh?.id === 'ground';
    if (currentPlacementMode && currentType && pickResult.hit && isGroundMesh && pickResult.pickedPoint) {
      // Debounce rapid clicks
      const now = Date.now();
      if (now - lastClickTimeRef.current < 300) {
        console.log("⏱️ Click ignored due to debounce");
        return;
      }
      lastClickTimeRef.current = now;

      console.log("✅ All conditions met - Adding building", currentType, "at position", pickResult.pickedPoint);

      const position = {
        x: pickResult.pickedPoint.x,
        z: pickResult.pickedPoint.z
      };

      const newBuilding: Building = {
        id: uuidv4(),
        type: currentType,
        position,
        rotation: 0,
        width: 3,
        length: 5,
        height: 5,
        ...(currentType === 'dualPitch' ? { ridgeHeight: 1, ridgeOffset: 0 } : {})
      };

      console.log("📦 Created building object:", newBuilding);
      addBuilding(newBuilding);
      setPlacementMode(false);
    } else {
      console.log("❌ Placement conditions not met:", {
        hasPlacementMode: !!currentPlacementMode,
        hasCurrentRoofType: !!currentType,
        hasHit: !!pickResult.hit,
        isGroundMesh: isGroundMesh,
        hasPickedPoint: !!pickResult.pickedPoint,
        allMeshNames: sceneRef.current?.meshes.map(m => m.name) || []
      });
    }
  }, [addBuilding, setPlacementMode]);

  // Set up pointer events observer (only once)
  useEffect(() => {
    if (!sceneRef.current) return;

    console.log("🖱️ Setting up pointer observer");

    const observer = sceneRef.current.onPointerObservable.add((pointerInfo) => {
      console.log("Pointer event type:", pointerInfo.type, "placement mode:", placementModeRef.current);

      const pickResult = sceneRef.current!.pick(sceneRef.current!.pointerX, sceneRef.current!.pointerY);

      // Log cursor state and what's being picked
      console.log("Pick result", {
        hit: pickResult.hit,
        pickedMeshName: pickResult.pickedMesh?.name,
        pickedPoint: pickResult.pickedPoint,
        distance: pickResult.distance,
        cursorStyle: canvasRef.current?.style.cursor || 'default'
      });

      // If in placement mode, ensure we're not being blocked by other meshes
      if (placementModeRef.current && pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        // Force cursor to default in placement mode
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'crosshair';
        }

        // If something other than ground is picked, try to pick through it
        if (pickResult.hit && pickResult.pickedMesh?.name !== 'ground') {
          console.log("⚠️ Non-ground mesh picked in placement mode:", pickResult.pickedMesh?.name);

          // Try picking with predicate to only pick ground
          const groundOnlyPick = sceneRef.current!.pick(
            sceneRef.current!.pointerX,
            sceneRef.current!.pointerY,
            (mesh) => mesh.name === 'ground'
          );

          console.log("Ground-only pick result:", {
            hit: groundOnlyPick.hit,
            meshName: groundOnlyPick.pickedMesh?.name,
            point: groundOnlyPick.pickedPoint
          });

          // Use the ground-only pick result for ghost building
          if (groundOnlyPick.hit && groundOnlyPick.pickedMesh?.name === 'ground') {
            handlePointerMove(groundOnlyPick);
            return;
          }
        }
      }

      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        handlePointerMove(pickResult);
      } else if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        console.log("POINTER DOWN", {
          placementMode: placementModeRef.current,
          currentRoofType: currentRoofTypeRef.current,
          ghostBuildingEnabled: ghostBuildingRef.current?.isEnabled(),
          gizmoAttached: !!gizmoManagerRef.current?.attachedMesh,
          pickedMesh: pickResult.pickedMesh?.name
        });

        // If in placement mode and didn't pick ground directly, try ground-only picking
        if (placementModeRef.current && pickResult.hit && pickResult.pickedMesh?.name !== 'ground') {
          console.log("🎯 Trying ground-only pick for placement");
          const groundOnlyPick = sceneRef.current!.pick(
            sceneRef.current!.pointerX,
            sceneRef.current!.pointerY,
            (mesh) => mesh.name === 'ground'
          );

          if (groundOnlyPick.hit && groundOnlyPick.pickedMesh?.name === 'ground') {
            console.log("✅ Ground-only pick successful for placement");
            handlePointerDown(groundOnlyPick);
            return;
          }
        }

        handlePointerDown(pickResult);
      }
    });

    return () => {
      console.log("🖱️ Cleaning up pointer observer");
      sceneRef.current?.onPointerObservable.remove(observer);
    };
  }, [handlePointerMove, handlePointerDown]);

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
    const ground = setupGround(scene);
    // Ensure ground is pickable and optimize for picking
    ground.isPickable = true;
    ground.useOctreeForPicking = true;

    // Ensure scene pointer picking is enabled
    scene.skipPointerMovePicking = false;
    scene.constantlyUpdateMeshUnderPointer = true;

    console.log("Ground mesh created:", ground.name, "isPickable:", ground.isPickable);
    console.log("Scene picking configuration:", {
      skipPointerMovePicking: scene.skipPointerMovePicking,
      constantlyUpdateMeshUnderPointer: scene.constantlyUpdateMeshUnderPointer
    });

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

    // Add direct canvas click handler as fallback
    const canvasClickHandler = (event: MouseEvent) => {
      console.log("🖱️ Canvas click detected");
      if (!placementModeRef.current || !currentRoofTypeRef.current) return;

      const pickResult = scene.pick(event.offsetX, event.offsetY);
      console.log("Direct pick result:", {
        hit: pickResult.hit,
        meshName: pickResult.pickedMesh?.name,
        point: pickResult.pickedPoint
      });

      const isGroundMesh = pickResult.pickedMesh?.name === 'ground' || pickResult.pickedMesh?.id === 'ground';
      if (pickResult.hit && isGroundMesh && pickResult.pickedPoint) {
        // Debounce rapid clicks
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
          console.log("⏱️ Click ignored due to debounce (canvas handler)");
          return;
        }
        lastClickTimeRef.current = now;

        console.log("✅ Canvas click - Adding building", currentRoofTypeRef.current, "at position", pickResult.pickedPoint);

        const position = {
          x: pickResult.pickedPoint.x,
          z: pickResult.pickedPoint.z
        };

        const newBuilding: Building = {
          id: uuidv4(),
          type: currentRoofTypeRef.current,
          position,
          rotation: 0,
          width: 3,
          length: 5,
          height: 5,
          ...(currentRoofTypeRef.current === 'dualPitch' ? { ridgeHeight: 1, ridgeOffset: 0 } : {})
        };

        console.log("📦 Created building object (canvas handler):", newBuilding);
        addBuilding(newBuilding);
        setPlacementMode(false);
      }
    };

    canvasRef.current.addEventListener('click', canvasClickHandler);

    // Also add action manager to ground as another fallback
    ground.actionManager = new ActionManager(scene);
    ground.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, (event) => {
      console.log("🎯 Ground action manager triggered");
      if (!placementModeRef.current || !currentRoofTypeRef.current) return;

      const pickInfo = event.sourceEvent;
      if (pickInfo && pickInfo.pickedPoint) {
        // Debounce rapid clicks
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
          console.log("⏱️ Click ignored due to debounce (action manager)");
          return;
        }
        lastClickTimeRef.current = now;

        console.log("✅ Action manager - Adding building", currentRoofTypeRef.current, "at position", pickInfo.pickedPoint);

        const position = {
          x: pickInfo.pickedPoint.x,
          z: pickInfo.pickedPoint.z
        };

        const newBuilding: Building = {
          id: uuidv4(),
          type: currentRoofTypeRef.current,
          position,
          rotation: 0,
          width: 3,
          length: 5,
          height: 5,
          ...(currentRoofTypeRef.current === 'dualPitch' ? { ridgeHeight: 1, ridgeOffset: 0 } : {})
        };

        console.log("📦 Created building object (action manager):", newBuilding);
        addBuilding(newBuilding);
        setPlacementMode(false);
      }
    }));

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
      canvasRef.current?.removeEventListener('click', canvasClickHandler);

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

      // Hide custom editor during placement mode
      if (placementMode) {
        console.log("🚫 Hiding building editor during placement mode");
      }
    }

    // Detach move gizmo from any previously selected mesh
    if (buildingMoveGizmoRef.current) {
      buildingMoveGizmoRef.current.detach();

      // Hide custom move gizmo during placement mode
      if (placementMode) {
        console.log("🚫 Hiding move gizmo during placement mode");
      }
    }

    // Detach native gizmo from any previously selected mesh and disable during placement
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.attachToMesh(null);

      if (placementMode) {
        // Disable all gizmos during placement mode to prevent interference
        gizmoManagerRef.current.positionGizmoEnabled = false;
        gizmoManagerRef.current.rotationGizmoEnabled = false;
        gizmoManagerRef.current.scaleGizmoEnabled = false;
        gizmoManagerRef.current.boundingBoxGizmoEnabled = false;
        console.log("🚫 Disabled all gizmos during placement mode");
      }
    }

    // Create meshes for each building
    buildings.forEach((building) => {
      // Create the building mesh
      const buildingMesh = createBuildingMesh(sceneRef.current!, building);
      buildingMeshesRef.current.set(building.id, buildingMesh);

      // Disable picking on building meshes when in placement mode to prevent interference
      if (placementMode) {
        buildingMesh.isPickable = false;
        buildingMesh.getChildMeshes().forEach(child => {
          child.isPickable = false;
        });
        console.log("🚫 Disabled picking on building mesh during placement mode:", building.id);
      } else {
        buildingMesh.isPickable = true;
        buildingMesh.getChildMeshes().forEach(child => {
          child.isPickable = true;
        });
      }

      // Attach appropriate control to the selected building
      if (building.id === selectedBuildingId) {
        console.log("Attaching controls to selected building:", building.id);

        if (currentEditorMode === 'move') {
          // Use our custom move gizmo
          buildingMoveGizmoRef.current?.attach(building, buildingMesh);
        } else if (currentEditorMode === 'edit') {
          // Use our custom editor for resizing/rotating
          buildingEditorRef.current?.attach(building, buildingMesh);
        }
      }
    });
  }, [buildings, selectedBuildingId, currentEditorMode]);

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

      // Set cursor to crosshair for placement mode
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'crosshair';
        console.log("🎯 Set cursor to crosshair for placement mode");
      }

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

      // Reset cursor when not in placement mode
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default';
      }
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

    setCurrentEditorMode('move');
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

    setCurrentEditorMode('edit');
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
