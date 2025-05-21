import {
  Scene,
  GizmoManager,
  PlaneRotationGizmo,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  UtilityLayerRenderer,
  TransformNode,
  Observable,
  PointerDragBehavior
} from '@babylonjs/core';
import { Building } from '../store/RoofBuilderContext';

/**
 * A custom gizmo that extends the PlaneRotationGizmo with additional features
 * for manipulating buildings in the 2D top-down view
 */
export class BuildingRotationGizmo extends PlaneRotationGizmo {
  private _directionIndicator: Mesh;

  constructor(
    utilityLayer: UtilityLayerRenderer,
    planeNormal: Vector3 = new Vector3(0, 1, 0),
    color: Color3 = new Color3(0, 1, 0)
  ) {
    // Call the parent constructor with Y-axis (up) normal
    super(planeNormal, color, utilityLayer);

    // Make the gizmo more visible and larger
    this.scaleRatio = 1.5;

    // Create a direction indicator to show the building's front
    this._directionIndicator = MeshBuilder.CreateCylinder(
      "directionIndicator",
      {
        height: 0.2,
        diameter: 0.2,
        tessellation: 3 // Triangle for direction
      },
      utilityLayer.utilityLayerScene
    );

    // Position the indicator near the edge of the rotation gizmo
    this._directionIndicator.position.y = 0.1;
    this._directionIndicator.position.x = 0;
    this._directionIndicator.position.z = 1.2;
    this._directionIndicator.rotation.x = Math.PI / 2; // Point forward

    // Create material for the direction indicator
    const indicatorMaterial = new StandardMaterial(
      "directionIndicatorMat",
      utilityLayer.utilityLayerScene
    );
    indicatorMaterial.diffuseColor = new Color3(1, 0.7, 0);
    indicatorMaterial.emissiveColor = new Color3(0.5, 0.3, 0);
    this._directionIndicator.material = indicatorMaterial;

    // Make the indicator a child of the gizmo's root node
    this._directionIndicator.parent = this._rootMesh;

    // Sync the indicator rotation with the gizmo
    this.dragBehavior.onDragObservable.add(() => {
      this._updateIndicatorPosition();
    });
  }

  /**
   * Updates the position and rotation of the direction indicator
   * based on the current gizmo rotation
   */
  private _updateIndicatorPosition(): void {
    if (!this.attachedMesh) return;

    // The indicator always points in the forward direction
    // We don't need to change its relative position
  }

  /**
   * Attaches the gizmo to a mesh
   */
  public set attachedMesh(mesh: Mesh | null) {
    super.attachedMesh = mesh;

    if (mesh) {
      this._updateIndicatorPosition();
    }
  }

  /**
   * Disposes the gizmo and its resources
   */
  public override dispose(): void {
    if (this._directionIndicator) {
      this._directionIndicator.dispose();
    }

    super.dispose();
  }
}

/**
 * Custom building editor that works like a Google Docs object editor
 * with draggable corners, edges, and a rotation handle
 */
export class BuildingEditor {
  /**
   * The scene where the editor will be created
   */
  private _scene: Scene;

  /**
   * Reference to the utility layer for visualization
   */
  private _utilityLayer: UtilityLayerRenderer;

  /**
   * The building currently being edited
   */
  private _building: Building | null = null;

  /**
   * The mesh being edited
   */
  private _targetMesh: Mesh | null = null;

  /**
   * The root node that holds all editor controls
   */
  private _rootNode: TransformNode;

  /**
   * The bounding box visualization
   */
  private _boundingBox: Mesh;

  /**
   * Corner control points for resizing
   */
  private _cornerControls: Mesh[] = [];

  /**
   * Edge control points for one-axis resizing
   */
  private _edgeControls: Mesh[] = [];

  /**
   * Rotation handle for rotating the building
   */
  private _rotationHandle: Mesh | null = null;

  /**
   * Observable that fires when the building is modified
   */
  public onBuildingModifiedObservable = new Observable<Building>();

  /**
   * Creates a new BuildingEditor
   * @param scene The scene to add the editor to
   */
  constructor(scene: Scene) {
    this._scene = scene;

    // Create a utility layer for the editor controls
    this._utilityLayer = new UtilityLayerRenderer(scene);
    this._utilityLayer.utilityLayerScene.autoClearDepthAndStencil = false;

    // Create the root node
    this._rootNode = new TransformNode("buildingEditorRoot", this._utilityLayer.utilityLayerScene);

    // Create the bounding box visualization (initially hidden)
    this._boundingBox = MeshBuilder.CreateBox("buildingEditorBox", {
      width: 1,
      height: 0.1,
      depth: 1,
      updatable: true
    }, this._utilityLayer.utilityLayerScene);

    const boxMaterial = new StandardMaterial("buildingEditorBoxMaterial", this._utilityLayer.utilityLayerScene);
    boxMaterial.diffuseColor = new Color3(0.2, 0.6, 1);
    boxMaterial.alpha = 0.2;
    boxMaterial.wireframe = true;
    this._boundingBox.material = boxMaterial;
    this._boundingBox.parent = this._rootNode;

    // Create the editor controls
    this._createControls();

    // Hide the editor until it's attached to a mesh
    this._rootNode.setEnabled(false);
  }

  /**
   * Create all the control points and handles
   */
  private _createControls(): void {
    // Create corner controls
    this._createCornerControls();

    // Create edge controls
    this._createEdgeControls();

    // Create rotation handle
    this._createRotationHandle();
  }

  /**
   * Create corner control points
   */
  private _createCornerControls(): void {
    const cornerPositions = [
      { x: -0.5, z: -0.5, id: 'topLeft' },
      { x: 0.5, z: -0.5, id: 'topRight' },
      { x: -0.5, z: 0.5, id: 'bottomLeft' },
      { x: 0.5, z: 0.5, id: 'bottomRight' }
    ];

    cornerPositions.forEach(pos => {
      const corner = this._createControlPoint(pos.id, 0.25, new Color3(0.2, 0.6, 1));
      corner.position = new Vector3(pos.x, 0.1, pos.z);

      // Store the original position
      corner.metadata = {
        originalPosition: new Vector3(pos.x, 0.1, pos.z),
        controlType: 'corner',
        cornerId: pos.id
      };

      // Add drag behavior
      const dragBehavior = new PointerDragBehavior({
        dragPlaneNormal: new Vector3(0, 1, 0)
      });

      // Store reference positions when drag begins
      dragBehavior.onDragStartObservable.add(() => {
        if (this._building) {
          corner.metadata.initialWidth = this._building.width;
          corner.metadata.initialLength = this._building.length;
          corner.metadata.initialCornerPositionX = corner.position.x;
          corner.metadata.initialCornerPositionZ = corner.position.z;
          corner.metadata.dragStartPositionX = dragBehavior.lastDragPosition.x;
          corner.metadata.dragStartPositionZ = dragBehavior.lastDragPosition.z;
        }
      });

      // Use direct drag position instead of delta for more reliable resizing
      dragBehavior.onDragObservable.add((event) => {
        if (!this._building) return;

        const deltaX = event.dragPlanePoint.x - corner.metadata.dragStartPositionX;
        const deltaZ = event.dragPlanePoint.z - corner.metadata.dragStartPositionZ;

        // Update the building dimensions based on which corner is being dragged
        let newWidth = this._building.width;
        let newLength = this._building.length;

        // Handle width changes
        if (pos.id.includes('Left')) {
          newWidth = corner.metadata.initialWidth - deltaX * 2;
        } else {
          newWidth = corner.metadata.initialWidth + deltaX * 2;
        }

        // Handle length changes
        if (pos.id.includes('top')) {
          newLength = corner.metadata.initialLength - deltaZ * 2;
        } else {
          newLength = corner.metadata.initialLength + deltaZ * 2;
        }

        // Ensure minimum size
        newWidth = Math.max(1, newWidth);
        newLength = Math.max(1, newLength);

        // Update the building
        this._updateBuildingDimensions(newWidth, newLength);
      });

      // Notify when drag ends for final update
      dragBehavior.onDragEndObservable.add(() => {
        this._notifyBuildingModified();
      });

      corner.addBehavior(dragBehavior);
      this._cornerControls.push(corner);
    });
  }

  /**
   * Create edge control points for one-axis resizing
   */
  private _createEdgeControls(): void {
    const edgePositions = [
      { x: 0, z: -0.5, id: 'top', axis: 'z' },
      { x: 0.5, z: 0, id: 'right', axis: 'x' },
      { x: 0, z: 0.5, id: 'bottom', axis: 'z' },
      { x: -0.5, z: 0, id: 'left', axis: 'x' }
    ];

    edgePositions.forEach(pos => {
      const edge = this._createControlPoint(pos.id, 0.2, new Color3(0.6, 0.8, 1));
      edge.position = new Vector3(pos.x, 0.1, pos.z);

      // Store metadata
      edge.metadata = {
        originalPosition: new Vector3(pos.x, 0.1, pos.z),
        controlType: 'edge',
        edgeId: pos.id,
        axis: pos.axis
      };

      // Add drag behavior
      const dragBehavior = new PointerDragBehavior({
        dragPlaneNormal: new Vector3(0, 1, 0)
      });

      // Store reference positions when drag begins
      dragBehavior.onDragStartObservable.add(() => {
        if (this._building) {
          edge.metadata.initialWidth = this._building.width;
          edge.metadata.initialLength = this._building.length;
          edge.metadata.initialEdgePositionX = edge.position.x;
          edge.metadata.initialEdgePositionZ = edge.position.z;
          edge.metadata.dragStartPositionX = dragBehavior.lastDragPosition.x;
          edge.metadata.dragStartPositionZ = dragBehavior.lastDragPosition.z;
        }
      });

      // Use direct drag position instead of delta for more reliable resizing
      dragBehavior.onDragObservable.add((event) => {
        if (!this._building) return;

        const deltaX = event.dragPlanePoint.x - edge.metadata.dragStartPositionX;
        const deltaZ = event.dragPlanePoint.z - edge.metadata.dragStartPositionZ;

        let newWidth = this._building.width;
        let newLength = this._building.length;

        // Handle resizing based on which edge is being dragged
        if (pos.axis === 'x') {
          // Left or right edge
          if (pos.id === 'left') {
            newWidth = edge.metadata.initialWidth - deltaX * 2;
          } else {
            newWidth = edge.metadata.initialWidth + deltaX * 2;
          }
        } else {
          // Top or bottom edge
          if (pos.id === 'top') {
            newLength = edge.metadata.initialLength - deltaZ * 2;
          } else {
            newLength = edge.metadata.initialLength + deltaZ * 2;
          }
        }

        // Ensure minimum size
        newWidth = Math.max(1, newWidth);
        newLength = Math.max(1, newLength);

        // Update the building
        this._updateBuildingDimensions(newWidth, newLength);
      });

      // Notify when drag ends for final update
      dragBehavior.onDragEndObservable.add(() => {
        this._notifyBuildingModified();
      });

      edge.addBehavior(dragBehavior);
      this._edgeControls.push(edge);
    });
  }

  /**
   * Create a rotation handle
   */
  private _createRotationHandle(): void {
    // Create the rotation handle above the top edge
    this._rotationHandle = MeshBuilder.CreateCylinder(
      "rotationHandle",
      {
        height: 0.2,
        diameter: 0.3,
        tessellation: 12
      },
      this._utilityLayer.utilityLayerScene
    );

    const handleMaterial = new StandardMaterial(
      "rotationHandleMaterial",
      this._utilityLayer.utilityLayerScene
    );
    handleMaterial.diffuseColor = new Color3(1, 0.8, 0.1);
    handleMaterial.emissiveColor = new Color3(0.5, 0.4, 0);
    this._rotationHandle.material = handleMaterial;

    // Position handle above the top edge
    this._rotationHandle.position = new Vector3(0, 0.1, -0.7);
    this._rotationHandle.parent = this._rootNode;

    // Add drag behavior for rotation
    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal: new Vector3(0, 1, 0)
    });

    dragBehavior.onDragStartObservable.add(() => {
      if (this._building && this._rotationHandle) {
        this._rotationHandle.metadata = {
          initialRotation: this._building.rotation,
          initialCenterX: this._building.position.x,
          initialCenterZ: this._building.position.z
        };
      }
    });

    dragBehavior.onDragObservable.add((event) => {
      if (!this._building || !this._targetMesh) return;

      // Calculate rotation based on drag position relative to building center
      const centerPoint = new Vector3(0, 0, 0);
      const dragPoint = event.dragPlanePoint;

      // Calculate angle between original and current position
      const angle = Math.atan2(
        dragPoint.z - centerPoint.z,
        dragPoint.x - centerPoint.x
      );

      // Update the rotation
      this._updateBuildingRotation(angle + Math.PI / 2);
    });

    dragBehavior.onDragEndObservable.add(() => {
      this._notifyBuildingModified();
    });

    this._rotationHandle.addBehavior(dragBehavior);
  }

  /**
   * Create a control point mesh
   * @param id The ID of the control point
   * @param size The size of the control point
   * @param color The color of the control point
   * @returns The created mesh
   */
  private _createControlPoint(id: string, size: number, color: Color3): Mesh {
    const point = MeshBuilder.CreateBox(
      `control-${id}`,
      {
        width: size,
        height: size,
        depth: size
      },
      this._utilityLayer.utilityLayerScene
    );

    const material = new StandardMaterial(
      `control-material-${id}`,
      this._utilityLayer.utilityLayerScene
    );
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.3); // Add glow effect
    material.specularColor = new Color3(1, 1, 1);
    point.material = material;

    point.parent = this._rootNode;
    return point;
  }

  /**
   * Update the building dimensions
   * @param width The new width
   * @param length The new length
   */
  private _updateBuildingDimensions(width: number, length: number): void {
    if (!this._building || !this._targetMesh) return;

    // Update the building data
    this._building.width = width;
    this._building.length = length;

    // Update the target mesh directly for immediate visual feedback
    // Since the building mesh is a parent mesh with children, we need to update the first child
    // which is the actual box representing the building
    const buildingBox = this._targetMesh.getChildMeshes()[0];
    if (buildingBox) {
      // Update the scaling of the box to match the new dimensions
      const originalWidth = buildingBox.getBoundingInfo().boundingBox.extendSize.x * 2;
      const originalLength = buildingBox.getBoundingInfo().boundingBox.extendSize.z * 2;

      if (originalWidth > 0 && originalLength > 0) {
        buildingBox.scaling.x = width / originalWidth;
        buildingBox.scaling.z = length / originalLength;
      }

      // Also update any border lines or ridge lines
      this._targetMesh.getChildMeshes().forEach(child => {
        if (child.name.startsWith('border-')) {
          // Recreate the border with new dimensions
          child.dispose();

          const halfWidth = width / 2;
          const halfLength = length / 2;
          const borderHeight = 0.17;

          const borderPoints = [
            new Vector3(-halfWidth, borderHeight, -halfLength),
            new Vector3(halfWidth, borderHeight, -halfLength),
            new Vector3(halfWidth, borderHeight, halfLength),
            new Vector3(-halfWidth, borderHeight, halfLength),
            new Vector3(-halfWidth, borderHeight, -halfLength)
          ];

          const newBorder = MeshBuilder.CreateLines('border-' + this._building!.id, {
            points: borderPoints,
            updatable: true
          }, this._utilityLayer.utilityLayerScene);

          newBorder.color = new Color3(0.9, 0.9, 0.9);
          newBorder.parent = this._targetMesh;
        }

        if (child.name.startsWith('ridge-') && this._building!.type === 'dualPitch') {
          // Update the ridge line
          child.dispose();

          const ridgeOffset = this._building!.ridgeOffset || 0;
          const start = new Vector3(ridgeOffset, 0.15, -length / 2);
          const end = new Vector3(ridgeOffset, 0.15, length / 2);

          const newRidgeLine = MeshBuilder.CreateLines('ridge-' + this._building!.id, {
            points: [start, end],
            updatable: true
          }, this._utilityLayer.utilityLayerScene);

          newRidgeLine.color = new Color3(0.9, 0.9, 0.9);
          newRidgeLine.parent = this._targetMesh;
        }
      });
    }

    // Update the editor visualization
    this._updateEditorVisuals();

    // Notify building modified in real-time for better responsiveness
    this._notifyBuildingModified();
  }

  /**
   * Update the building rotation
   * @param rotation The new rotation in radians
   */
  private _updateBuildingRotation(rotation: number): void {
    if (!this._building || !this._targetMesh) return;

    // Update the building data
    this._building.rotation = rotation;

    // Update the target mesh rotation directly for immediate visual feedback
    this._targetMesh.rotation.y = rotation;
  }

  /**
   * Update the visual representation of the editor
   */
  private _updateEditorVisuals(): void {
    if (!this._building || !this._targetMesh) return;

    // Update the bounding box size
    this._boundingBox.scaling.x = this._building.width;
    this._boundingBox.scaling.z = this._building.length;

    // Update the position and rotation to match the target mesh
    this._rootNode.position.copyFrom(this._targetMesh.position);
    this._rootNode.rotation.y = this._targetMesh.rotation.y;

    // Update corner control positions
    this._cornerControls.forEach(corner => {
      const originalPos = corner.metadata.originalPosition;
      corner.position.x = originalPos.x * this._building!.width;
      corner.position.z = originalPos.z * this._building!.length;
    });

    // Update edge control positions
    this._edgeControls.forEach(edge => {
      const originalPos = edge.metadata.originalPosition;

      if (edge.metadata.axis === 'x') {
        // Left or right edge
        edge.position.x = originalPos.x * this._building!.width;
        edge.position.z = 0;
      } else {
        // Top or bottom edge
        edge.position.x = 0;
        edge.position.z = originalPos.z * this._building!.length;
      }
    });

    // Update rotation handle position
    if (this._rotationHandle) {
      this._rotationHandle.position.z = -this._building.length / 2 - 0.5;
    }
  }

  /**
   * Notify that the building has been modified
   */
  private _notifyBuildingModified(): void {
    if (this._building) {
      this.onBuildingModifiedObservable.notifyObservers(this._building);
    }
  }

  /**
   * Attach the editor to a building and mesh
   * @param building The building data to edit
   * @param mesh The mesh representation of the building
   */
  public attach(building: Building, mesh: Mesh): void {
    // Detach from any previous building
    this.detach();

    // Set the new building and mesh
    this._building = building;
    this._targetMesh = mesh;

    // Update visual representation
    this._updateEditorVisuals();

    // Show the editor
    this._rootNode.setEnabled(true);
  }

  /**
   * Detach the editor from the current building
   */
  public detach(): void {
    this._building = null;
    this._targetMesh = null;
    this._rootNode.setEnabled(false);
  }

  /**
   * Dispose of all resources used by the editor
   */
  public dispose(): void {
    this._cornerControls.forEach(c => c.dispose());
    this._cornerControls = [];

    this._edgeControls.forEach(e => e.dispose());
    this._edgeControls = [];

    if (this._rotationHandle) {
      this._rotationHandle.dispose();
      this._rotationHandle = null;
    }

    this._boundingBox.dispose();
    this._rootNode.dispose();

    this._utilityLayer.dispose();
    this.onBuildingModifiedObservable.clear();
  }
}

/**
 * Sets up the gizmo manager for transforming objects in the scene
 */
export const setupGizmoManager = (scene: Scene): GizmoManager => {
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

  if (gizmoManager.gizmos.rotationGizmo) {
    // Disable the standard rotation gizmo entirely - we'll use our custom controls instead
    gizmoManager.gizmos.rotationGizmo.xGizmo.isEnabled = false;
    gizmoManager.gizmos.rotationGizmo.yGizmo.isEnabled = false;
    gizmoManager.gizmos.rotationGizmo.zGizmo.isEnabled = false;
  }

  if (gizmoManager.gizmos.scaleGizmo) {
    // Disable standard scale gizmo - we'll use our custom controls instead
    gizmoManager.gizmos.scaleGizmo.xGizmo.isEnabled = false;
    gizmoManager.gizmos.scaleGizmo.yGizmo.isEnabled = false;
    gizmoManager.gizmos.scaleGizmo.zGizmo.isEnabled = false;
  }

  return gizmoManager;
}; 