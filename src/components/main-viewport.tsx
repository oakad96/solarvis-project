"use client"
import { useEffect, useRef } from 'react';
import {
  Engine,
  Scene,
  Color4,
  PointerEventTypes,
  PickingInfo,
  Mesh,
  ActionManager,
  ExecuteCodeAction,
  GizmoManager,
  UtilityLayerRenderer
} from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { useRoofBuilder, Building } from '../store/RoofBuilderContext';
import { createBuildingMesh } from '../utils/buildingMeshes';

// Import setup functions from separate files
import { setupCamera } from '../scene/setupCamera';
import { setupGround } from '../scene/setupGround';
import { setupGizmoManager, BuildingEditor } from '../scene/setupGizmoManager';

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
  const ghostBuildingRef = useRef<Mesh | null>(null);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);

  // Replace the rotation gizmo ref with our new building editor ref
  const buildingEditorRef = useRef<BuildingEditor | null>(null);
  const utilityLayerRef = useRef<UtilityLayerRenderer | null>(null);

  // Track editor mode
  const currentEditorMode = useRef<'move' | 'edit' | null>(null);

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

    // Handle pointer events for placement and selection
    scene.onPointerObservable.add((pointerInfo) => {
      console.log("Pointer event type:", pointerInfo.type);

      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
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

    // Fix: Explicitly handle click event on the ground
    ground.actionManager = new ActionManager(scene);
    ground.actionManager.registerAction(
      new ExecuteCodeAction(
        ActionManager.OnPickDownTrigger,
        () => {
          console.log("Ground clicked directly");
          if (placementMode && currentRoofType && ghostBuildingRef.current) {
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
              height: 5,
              ...(currentRoofType === 'dualPitch' ? { ridgeHeight: 1, ridgeOffset: 0 } : {})
            };

            addBuilding(newBuilding);
            setPlacementMode(false);
          }
        }
      )
    );

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

    // Detach gizmo from any previously selected mesh (for move mode)
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.attachToMesh(null);
    }

    // Create meshes for each building
    buildings.forEach((building) => {
      // Create the building mesh
      const buildingMesh = createBuildingMesh(sceneRef.current!, building);
      buildingMeshesRef.current.set(building.id, buildingMesh);

      // Make building mesh pickable
      buildingMesh.isPickable = true;
      buildingMesh.getChildMeshes().forEach(child => {
        child.isPickable = true;
      });

      // Attach appropriate control to the selected building
      if (building.id === selectedBuildingId) {
        console.log("Attaching controls to selected building:", building.id);

        if (currentEditorMode.current === 'move') {
          // Use position gizmo for moving
          gizmoManagerRef.current?.attachToMesh(buildingMesh);
          enableMoveGizmo();
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

    console.log("Placement mode updated:", { placementMode, currentRoofType });

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
  };

  // Handle pointer down event
  const handlePointerDown = (pickResult: PickingInfo) => {
    if (!sceneRef.current) return;

    console.log("Pointer down", {
      placementMode,
      currentRoofType,
      hit: pickResult.hit,
      pickedMeshName: pickResult.pickedMesh?.name
    });

    // Place a building in placement mode
    if (placementMode && currentRoofType && pickResult.hit && pickResult.pickedMesh?.name === 'ground' && ghostBuildingRef.current) {
      console.log("Adding building", currentRoofType);

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
        height: 5,
        ...(currentRoofType === 'dualPitch' ? { ridgeHeight: 1, ridgeOffset: 0 } : {})
      };

      addBuilding(newBuilding);
      setPlacementMode(false);
    }

    // Select a building
    if (!placementMode && pickResult.hit && pickResult.pickedMesh) {
      // Check if we're clicking on a building
      if (pickResult.pickedMesh.name.startsWith('building-') ||
        pickResult.pickedMesh.parent?.name?.startsWith('building-parent-')) {
        const meshId = pickResult.pickedMesh.name.startsWith('building-') 
          ? pickResult.pickedMesh.name.substring('building-'.length)
          : pickResult.pickedMesh.parent!.name.substring('building-parent-'.length);

        console.log("Building selected:", meshId);
        selectBuilding(meshId);
      }
      // Clicking on empty space deselects
      else if (pickResult.pickedMesh.name === 'ground') {
        console.log("Deselecting building");
        selectBuilding(null);
      }
    }
  };

  // Function to sync mesh transforms with building data (for move gizmo)
  const syncMeshWithBuilding = () => {
    if (!selectedBuildingId || !gizmoManagerRef.current) return;

    const buildingMesh = buildingMeshesRef.current.get(selectedBuildingId);
    if (!buildingMesh) return;

    const building = buildings.find(b => b.id === selectedBuildingId);
    if (!building) return;

    // Update building data based on mesh position
    const updatedBuilding: Partial<Building> = {
      position: {
        x: buildingMesh.position.x,
        z: buildingMesh.position.z
      },
      rotation: buildingMesh.rotation.y,
    };

    updateBuilding(selectedBuildingId, updatedBuilding);
  };

  // Enable move gizmo (position only)
  const enableMoveGizmo = () => {
    if (!gizmoManagerRef.current || !buildingEditorRef.current) return;

    // Detach editor
    buildingEditorRef.current.detach();

    // Disable all gizmos first
    gizmoManagerRef.current.positionGizmoEnabled = false;
    gizmoManagerRef.current.rotationGizmoEnabled = false;
    gizmoManagerRef.current.scaleGizmoEnabled = false;

    // Enable position gizmo
    gizmoManagerRef.current.positionGizmoEnabled = true;

    // Set up observers for transformation changes
    if (gizmoManagerRef.current.gizmos.positionGizmo) {
      // Remove any existing observers
      if (gizmoManagerRef.current.gizmos.positionGizmo.onDragEndObservable.hasObservers()) {
        gizmoManagerRef.current.gizmos.positionGizmo.onDragEndObservable.clear();
      }

      // Add new observer
      gizmoManagerRef.current.gizmos.positionGizmo.onDragEndObservable.add(() => {
        syncMeshWithBuilding();
      });
    }

    currentEditorMode.current = 'move';
  };

  // Enable custom building editor
  const enableBuildingEditor = () => {
    if (!buildingEditorRef.current || !gizmoManagerRef.current || !selectedBuildingId) return;

    // Disable all standard gizmos
    gizmoManagerRef.current.positionGizmoEnabled = false;
    gizmoManagerRef.current.rotationGizmoEnabled = false;
    gizmoManagerRef.current.scaleGizmoEnabled = false;
    gizmoManagerRef.current.attachToMesh(null);

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
      <div style={{
        marginBottom: '0.5rem',
        display: 'flex',
        gap: '0.5rem'
      }}>
        <button
          onClick={() => {
            setPlacementMode(true);
            setCurrentRoofType('flat');
            console.log("Flat roof button clicked", { placementMode: true, currentRoofType: 'flat' });
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
            console.log("Dual pitch roof button clicked", { placementMode: true, currentRoofType: 'dualPitch' });
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

      {selectedBuildingId && (
        <div style={{
          marginBottom: '0.5rem',
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={enableMoveGizmo}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentEditorMode.current === 'move' ? '#2196f3' : '#e0e0e0',
              color: currentEditorMode.current === 'move' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Move
          </button>
          <button
            onClick={enableBuildingEditor}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentEditorMode.current === 'edit' ? '#2196f3' : '#e0e0e0',
              color: currentEditorMode.current === 'edit' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Edit Size & Rotation
          </button>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%' }}
          onClick={() => {
            if (placementMode && currentRoofType && sceneRef.current && ghostBuildingRef.current) {
              console.log("Canvas clicked in placement mode", { currentRoofType });

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
                height: 5,
                ...(currentRoofType === 'dualPitch' ? { ridgeHeight: 1, ridgeOffset: 0 } : {})
              };

              addBuilding(newBuilding);
              setPlacementMode(false);
            }
          }}
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
