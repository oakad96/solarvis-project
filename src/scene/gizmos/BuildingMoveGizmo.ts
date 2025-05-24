import {
  Scene,
  UtilityLayerRenderer,
  TransformNode,
  Mesh,
  Observable,
  Vector3,
  Color3,
  MeshBuilder,
  PointerDragBehavior
} from '@babylonjs/core';
import { Building } from '../../store/RoofBuilderContext';
import {
  ArrowHandle,
  createStandardMaterial,
  createArrowHandle,
  createGuideLines,
  toggleGuideLines,
  disposeMeshArray
} from './utils';

/**
 * Custom move gizmo for buildings with visual handles
 */
export class BuildingMoveGizmo {
  /**
   * The scene where the gizmo will be created
   */
  private _scene: Scene;

  /**
   * Reference to the utility layer for visualization
   */
  private _utilityLayer: UtilityLayerRenderer;

  /**
   * The building currently being moved
   */
  private _building: Building | null = null;

  /**
   * The mesh being moved
   */
  private _targetMesh: Mesh | null = null;

  /**
   * The root node that holds all gizmo controls
   */
  private _rootNode: TransformNode;

  /**
   * The main move handle (center cross)
   */
  private _centerHandle: Mesh | null = null;

  /**
   * Directional arrow handles for constrained movement
   */
  private _arrowHandles: {
    x: ArrowHandle | null;
    z: ArrowHandle | null;
  } = { x: null, z: null };

  /**
   * Visual guide lines
   */
  private _guideLines: Mesh[] = [];

  /**
   * Observable that fires when the building is moved
   */
  public onBuildingMovedObservable = new Observable<Building>();

  /**
   * Creates a new BuildingMoveGizmo
   * @param scene The scene to add the gizmo to
   */
  constructor(scene: Scene) {
    this._scene = scene;

    // Create a utility layer for the gizmo controls
    this._utilityLayer = new UtilityLayerRenderer(scene);
    this._utilityLayer.utilityLayerScene.autoClearDepthAndStencil = false;

    // Create the root node
    this._rootNode = new TransformNode("buildingMoveGizmoRoot", this._utilityLayer.utilityLayerScene);

    // Create the gizmo controls
    this._createControls();

    // Hide the gizmo until it's attached to a mesh
    this._rootNode.setEnabled(false);
  }

  /**
   * Create all the control handles
   */
  private _createControls(): void {
    // Create center handle for free movement
    this._createCenterHandle();

    // Create directional arrows for constrained movement
    this._createArrowHandles();

    // Create guide lines
    this._guideLines = createGuideLines(this._utilityLayer);
    this._guideLines.forEach(line => line.parent = this._rootNode);
  }

  /**
   * Create the center handle for free XZ movement
   */
  private _createCenterHandle(): void {
    // Create a cross shape for the center handle
    const size = 0.8;
    const thickness = 0.15;

    // Create horizontal bar
    const horizontalBar = MeshBuilder.CreateBox(
      "centerHandleH",
      { width: size, height: thickness, depth: thickness },
      this._utilityLayer.utilityLayerScene
    );

    // Create vertical bar
    const verticalBar = MeshBuilder.CreateBox(
      "centerHandleV",
      { width: thickness, height: thickness, depth: size },
      this._utilityLayer.utilityLayerScene
    );

    // Merge into single mesh
    this._centerHandle = Mesh.MergeMeshes(
      [horizontalBar, verticalBar],
      true,
      false,
      undefined,
      false,
      true
    );

    if (!this._centerHandle) return;

    this._centerHandle.name = "centerHandle";
    this._centerHandle.position.y = 0.1;

    // Create material
    const handleMaterial = createStandardMaterial(
      "moveHandleMaterial",
      new Color3(0, 1, 0), // Bright green
      this._utilityLayer,
      0.5
    );
    this._centerHandle.material = handleMaterial;

    this._centerHandle.parent = this._rootNode;

    // Add drag behavior for free movement
    this._addCenterHandleDragBehavior();
  }

  /**
   * Add drag behavior to the center handle
   */
  private _addCenterHandleDragBehavior(): void {
    if (!this._centerHandle) return;

    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up()
    });

    dragBehavior.onDragStartObservable.add(() => {
      if (this._building && this._targetMesh) {
        this._centerHandle!.metadata = {
          initialPosition: this._targetMesh.position.clone()
        };
        // Show guide lines
        toggleGuideLines(this._guideLines, true);
      }
    });

    dragBehavior.onDragObservable.add((event) => {
      if (!this._building || !this._targetMesh) return;

      // Apply delta movement
      this._targetMesh.position.addInPlace(event.delta);

      // Update gizmo position
      this._rootNode.position.copyFrom(this._targetMesh.position);

      // Update building data
      this._building.position = {
        x: this._targetMesh.position.x,
        z: this._targetMesh.position.z
      };
    });

    dragBehavior.onDragEndObservable.add(() => {
      // Hide guide lines
      toggleGuideLines(this._guideLines, false);
      this._notifyBuildingMoved();
    });

    this._centerHandle.addBehavior(dragBehavior);
  }

  /**
   * Create directional arrow handles for constrained movement
   */
  private _createArrowHandles(): void {
    // Create X-axis arrow (bright red)
    this._arrowHandles.x = createArrowHandle('x', new Color3(1, 0, 0), this._utilityLayer);
    this._setupArrowDragBehavior(this._arrowHandles.x, 'x');

    // Create Z-axis arrow (bright blue)
    this._arrowHandles.z = createArrowHandle('z', new Color3(0, 0, 1), this._utilityLayer);
    this._setupArrowDragBehavior(this._arrowHandles.z, 'z');

    // Parent to root
    if (this._arrowHandles.x) {
      this._arrowHandles.x.shaft.parent = this._rootNode;
      this._arrowHandles.x.arrow.parent = this._rootNode;
    }
    if (this._arrowHandles.z) {
      this._arrowHandles.z.shaft.parent = this._rootNode;
      this._arrowHandles.z.arrow.parent = this._rootNode;
    }
  }

  /**
   * Setup drag behavior for arrow handles
   */
  private _setupArrowDragBehavior(arrowHandle: ArrowHandle, axis: 'x' | 'z'): void {
    [arrowHandle.shaft, arrowHandle.arrow].forEach(mesh => {
      const dragBehavior = new PointerDragBehavior({
        dragPlaneNormal: Vector3.Up()
      });

      dragBehavior.onDragStartObservable.add(() => {
        if (this._building && this._targetMesh) {
          mesh.metadata = {
            axis: axis,
            initialPosition: this._targetMesh.position.clone()
          };
          // Show guide lines
          toggleGuideLines(this._guideLines, true);
        }
      });

      dragBehavior.onDragObservable.add((event) => {
        if (!this._building || !this._targetMesh) return;

        // Constrain movement to the specific axis
        const constrainedDelta = new Vector3(
          axis === 'x' ? event.delta.x : 0,
          0,
          axis === 'z' ? event.delta.z : 0
        );

        // Apply constrained movement
        this._targetMesh.position.addInPlace(constrainedDelta);

        // Update gizmo position
        this._rootNode.position.copyFrom(this._targetMesh.position);

        // Update building data
        this._building.position = {
          x: this._targetMesh.position.x,
          z: this._targetMesh.position.z
        };
      });

      dragBehavior.onDragEndObservable.add(() => {
        // Hide guide lines
        toggleGuideLines(this._guideLines, false);
        this._notifyBuildingMoved();
      });

      mesh.addBehavior(dragBehavior);
    });
  }

  /**
   * Notify that the building has been moved
   */
  private _notifyBuildingMoved(): void {
    if (this._building) {
      this.onBuildingMovedObservable.notifyObservers(this._building);
    }
  }

  /**
   * Attach the gizmo to a building and mesh
   * @param building The building data to move
   * @param mesh The mesh representation of the building
   */
  public attach(building: Building, mesh: Mesh): void {
    // Detach from any previous building
    this.detach();

    // Set the new building and mesh
    this._building = building;
    this._targetMesh = mesh;

    // Position the gizmo at the mesh location
    this._rootNode.position.copyFrom(mesh.position);

    // Show the gizmo
    this._rootNode.setEnabled(true);
  }

  /**
   * Detach the gizmo from the current building
   */
  public detach(): void {
    this._building = null;
    this._targetMesh = null;
    this._rootNode.setEnabled(false);

    // Hide guide lines
    toggleGuideLines(this._guideLines, false);
  }

  /**
   * Dispose of all resources used by the gizmo
   */
  public dispose(): void {
    // Dispose center handle
    if (this._centerHandle) {
      this._centerHandle.dispose();
      this._centerHandle = null;
    }

    // Dispose arrow handles
    if (this._arrowHandles.x) {
      this._arrowHandles.x.arrow.dispose();
      this._arrowHandles.x.shaft.dispose();
      this._arrowHandles.x = null;
    }
    if (this._arrowHandles.z) {
      this._arrowHandles.z.arrow.dispose();
      this._arrowHandles.z.shaft.dispose();
      this._arrowHandles.z = null;
    }

    // Dispose guide lines
    disposeMeshArray(this._guideLines);

    this._rootNode.dispose();
    this._utilityLayer.dispose();
    this.onBuildingMovedObservable.clear();
  }
} 