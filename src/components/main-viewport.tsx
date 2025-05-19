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
  ArcRotateCamera,
  ActionManager,
  ExecuteCodeAction,
  GizmoManager,
  PlaneRotationGizmo,
  UtilityLayerRenderer
} from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { useRoofBuilder, Building } from '../store/RoofBuilderContext';
import { createBuildingMesh } from '../utils/buildingMeshes';

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
  const currentGizmoMode = useRef<'translate' | 'rotate' | 'scale' | null>(null);

  // Add refs for direct gizmo access
  const planeRotationGizmoRef = useRef<PlaneRotationGizmo | null>(null);
  const utilityLayerRef = useRef<UtilityLayerRenderer | null>(null);

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

    // Create a checkboard/grid pattern with tiling
    const gridTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAACXBIWXMAAAsTAAALEwEAmpwYAAAGnmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0NDYwLCAyMDIwLzA1LzEyLTE2OjA0OjE3ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIGV4aWY6UGl4ZWxYRGltZW5zaW9uPSIxMjgiIGV4aWY6UGl4ZWxZRGltZW5zaW9uPSIxMjgiIHhtcDpDcmVhdGVEYXRlPSIyMDE5LTAyLTA3VDE2OjQ0OjA4KzAxOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMC0wNi0yM1QxNToxMTozOSswMjowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyMC0wNi0yM1QxNToxMTozOSswMjowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo0ZmRlZjE2MS0wOWIzLTQ1OGEtODY1Zi1lYWRjMTk0NzljZTMiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpmZjE3YWE2ZC1iNDRlLTZhNGUtYTYzOC05NDhhYjQyNTgyMzYiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowZjNkYWU4NS1jNzE0LTQ2OTAtOWI5Yi0xM2E3YjZlOWI1MTciPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDowZjNkYWU4NS1jNzE0LTQ2OTAtOWI5Yi0xM2E3YjZlOWI1MTciIHN0RXZ0OndoZW49IjIwMTktMDItMDdUMTY6NDY6MzcrMDE6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyBNYWMgKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjRmZGVmMTYxLTA5YjMtNDU4YS04NjVmLWVhZGMxOTQ3OWNlMyIgc3RFdnQ6d2hlbj0iMjAyMC0wNi0yM1QxNToxMTozOSswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDIxLjEgKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+OhvURAAAAQVJREFUeJzt17ENwkAQRUEmukJCCk5MkQmQUiJ6YIwSc9svbL/w3z9n6dlZb0spuZ+sP2Y32f3yd8g1bMgVlFJmNzMOvM9X8zi6Ac4ngLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2AugLkA5gKYC2Cr0Q1wPgHMBTAXwFwAcwHMBTAXwFwAcwHMBTAXwFwAcwHMBTAXwFwAcwHMBTAXwFwAcwHMBbAXVFcC+5PN2BIAAAAASUVORK5CYII=", scene);
    gridTexture.uScale = 20;
    gridTexture.vScale = 20;
    groundMaterial.diffuseTexture = gridTexture;

    ground.material = groundMaterial;

    console.log("Ground created with name:", ground.name);

    // Initialize Gizmo Manager for transforming buildings
    const gizmoManager = new GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.usePointerToAttachGizmos = false;

    // Configure gizmos to work on XZ plane
    if (gizmoManager.gizmos.positionGizmo) {
      // Restrict position gizmo to XZ plane
      gizmoManager.gizmos.positionGizmo.xGizmo.dragBehavior.updateDragPlane = false;
      gizmoManager.gizmos.positionGizmo.zGizmo.dragBehavior.updateDragPlane = false;
      gizmoManager.gizmos.positionGizmo.yGizmo.isEnabled = false; // Disable Y-axis movement
    }

    // For rotation, we'll use a PlaneRotationGizmo instead of the default RotationGizmo
    // We'll implement this when enableRotateGizmo is called
    if (gizmoManager.gizmos.rotationGizmo) {
      // Disable the standard rotation gizmo entirely - we'll use our custom one instead
      gizmoManager.gizmos.rotationGizmo.xGizmo.isEnabled = false;
      gizmoManager.gizmos.rotationGizmo.yGizmo.isEnabled = false;
      gizmoManager.gizmos.rotationGizmo.zGizmo.isEnabled = false;
    }

    // Create utility layer for our custom gizmos
    const utilityLayer = new UtilityLayerRenderer(scene);
    utilityLayerRef.current = utilityLayer;

    if (gizmoManager.gizmos.scaleGizmo) {
      // Restrict scaling to XZ plane
      gizmoManager.gizmos.scaleGizmo.yGizmo.isEnabled = false; // Disable Y-axis scaling
    }

    gizmoManagerRef.current = gizmoManager;

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
              height: 2,
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
      if (planeRotationGizmoRef.current) {
        planeRotationGizmoRef.current.dispose();
        planeRotationGizmoRef.current = null;
      }

      engine.dispose();
    };
  }, []);

  // Update scene when buildings change
  useEffect(() => {
    if (!sceneRef.current || !gizmoManagerRef.current) return;

    console.log("Buildings updated:", buildings);
    console.log("Selected building ID:", selectedBuildingId);

    // Clear existing building meshes
    buildingMeshesRef.current.forEach((mesh) => {
      mesh.dispose();
    });
    buildingMeshesRef.current.clear();

    // Detach gizmo from any previously selected mesh
    gizmoManagerRef.current.attachToMesh(null);

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

      // Attach gizmo to the selected building
      if (building.id === selectedBuildingId) {
        console.log("Attaching gizmos to selected building:", building.id);
        gizmoManagerRef.current!.attachToMesh(buildingMesh);

        // Apply current gizmo mode if one is set
        if (currentGizmoMode.current === 'translate') {
          enableTranslateGizmo();
        } else if (currentGizmoMode.current === 'rotate') {
          enableRotateGizmo();
        } else if (currentGizmoMode.current === 'scale') {
          enableScaleGizmo();
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
        height: 2,
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

  // Function to sync mesh transforms with building data
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

    // For scaling, we need to handle differently based on mesh type
    // This is simplified, you might need to adjust based on your mesh structure
    if (buildingMesh.scaling) {
      updatedBuilding.width = building.width * buildingMesh.scaling.x;
      updatedBuilding.length = building.length * buildingMesh.scaling.z;
    }

    updateBuilding(selectedBuildingId, updatedBuilding);
  };

  // Enable translation gizmo
  const enableTranslateGizmo = () => {
    if (!gizmoManagerRef.current) return;

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

    currentGizmoMode.current = 'translate';
  };

  // Enable rotation gizmo - replace with a Y-axis-only rotation gizmo
  const enableRotateGizmo = () => {
    if (!gizmoManagerRef.current || !utilityLayerRef.current) return;

    // Disable all existing gizmos first
    gizmoManagerRef.current.positionGizmoEnabled = false;
    gizmoManagerRef.current.rotationGizmoEnabled = false;
    gizmoManagerRef.current.scaleGizmoEnabled = false;

    // Clean up any existing plane rotation gizmo
    if (planeRotationGizmoRef.current) {
      planeRotationGizmoRef.current.dispose();
    }

    // Get the selected mesh
    if (!selectedBuildingId) return;
    const buildingMesh = buildingMeshesRef.current.get(selectedBuildingId);
    if (!buildingMesh) return;

    // Create a new PlaneRotationGizmo that only rotates around the Y-axis
    const planeRotationGizmo = new PlaneRotationGizmo(
      new Vector3(0, 1, 0), // Y-axis normal vector
      new Color3(0, 1, 0),  // Green color
      utilityLayerRef.current
    );

    // Attach to the selected mesh
    planeRotationGizmo.attachedMesh = buildingMesh;

    // Store the gizmo for later cleanup
    planeRotationGizmoRef.current = planeRotationGizmo;

    // Add observer for drag end
    planeRotationGizmo.dragBehavior.onDragEndObservable.add(() => {
      syncMeshWithBuilding();
    });

    currentGizmoMode.current = 'rotate';
  };

  // Enable scale gizmo
  const enableScaleGizmo = () => {
    if (!gizmoManagerRef.current) return;

    // Disable all gizmos first
    gizmoManagerRef.current.positionGizmoEnabled = false;
    gizmoManagerRef.current.rotationGizmoEnabled = false;
    gizmoManagerRef.current.scaleGizmoEnabled = false;

    // Enable scale gizmo
    gizmoManagerRef.current.scaleGizmoEnabled = true;

    // Set up observers for transformation changes
    if (gizmoManagerRef.current.gizmos.scaleGizmo) {
      // Remove any existing observers
      if (gizmoManagerRef.current.gizmos.scaleGizmo.onDragEndObservable.hasObservers()) {
        gizmoManagerRef.current.gizmos.scaleGizmo.onDragEndObservable.clear();
      }

      // Add new observer
      gizmoManagerRef.current.gizmos.scaleGizmo.onDragEndObservable.add(() => {
        syncMeshWithBuilding();
      });
    }

    currentGizmoMode.current = 'scale';
  };

  // Render info about key controls and gizmo buttons
  const renderControlsInfo = () => {
    return (
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '14px',
      }}>
        <div>Press <b>E</b> to rotate counter-clockwise</div>
        <div>Press <b>R</b> to rotate clockwise</div>
        <div>Use gizmo controls for direct manipulation</div>
      </div>
    );
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
            onClick={enableTranslateGizmo}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentGizmoMode.current === 'translate' ? '#2196f3' : '#e0e0e0',
              color: currentGizmoMode.current === 'translate' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Move
          </button>
          <button
            onClick={enableRotateGizmo}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentGizmoMode.current === 'rotate' ? '#2196f3' : '#e0e0e0',
              color: currentGizmoMode.current === 'rotate' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Rotate
          </button>
          <button
            onClick={enableScaleGizmo}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentGizmoMode.current === 'scale' ? '#2196f3' : '#e0e0e0',
              color: currentGizmoMode.current === 'scale' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Scale
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
                height: 2,
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
        {selectedBuildingId && renderControlsInfo()}
      </div>
    </div>
  );
};

export default MainViewport;
