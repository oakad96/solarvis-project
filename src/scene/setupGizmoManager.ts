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
  PointerDragBehavior,
  Matrix
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
   * Parent node for the rotation handle
   */
  private _rotationHandleParent: TransformNode | null = null;

  /**
   * Central drag handle for moving the entire building
   */
  private _dragHandle: Mesh | null = null;

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

    // Create central drag handle
    this._createDragHandle();
  }

  /**
   * Create corner control points using Babylon.js patterns
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
        originalPosition: corner.position.clone(),
        controlType: 'corner',
        cornerId: pos.id
      };

      // Add drag behavior
      const dragBehavior = new PointerDragBehavior({
        dragPlaneNormal: Vector3.Up()
      });

      // Store initial state when drag begins
      dragBehavior.onDragStartObservable.add(() => {
        if (this._building && this._targetMesh) {
          corner.metadata.initialWidth = this._building.width;
          corner.metadata.initialLength = this._building.length;
          corner.metadata.dragStartWorldPos = dragBehavior.lastDragPosition.clone();
          corner.metadata.meshWorldMatrix = this._targetMesh.getWorldMatrix().clone();
        }
      });

      // Handle drag using Babylon's coordinate transformation utilities
      dragBehavior.onDragObservable.add((event) => {
        if (!this._building || !this._targetMesh) return;

        // Get drag position in world space
        const currentWorldPos = event.dragPlanePoint;

        // Transform to local space using Babylon's utilities
        const meshWorldMatrix = corner.metadata.meshWorldMatrix;
        const invWorldMatrix = Matrix.Invert(meshWorldMatrix);

        // Transform drag position to local space
        const localDragPos = Vector3.TransformCoordinates(currentWorldPos, invWorldMatrix);

        // Get current corner position in local space
        const cornerWorldPos = corner.getAbsolutePosition();
        const localCornerPos = Vector3.TransformCoordinates(cornerWorldPos, invWorldMatrix);

        // Calculate new dimensions based on local positions
        const newWidth = 2 * Math.abs(localDragPos.x);
        const newLength = 2 * Math.abs(localDragPos.z);

        // Determine if we're expanding or shrinking
        const isDragXExpanding = Math.sign(localDragPos.x) === Math.sign(localCornerPos.x) &&
          Math.abs(localDragPos.x) > Math.abs(localCornerPos.x);
        const isDragZExpanding = Math.sign(localDragPos.z) === Math.sign(localCornerPos.z) &&
          Math.abs(localDragPos.z) > Math.abs(localCornerPos.z);

        // Apply appropriate sizing logic
        let finalWidth = corner.metadata.initialWidth;
        let finalLength = corner.metadata.initialLength;

        if (isDragXExpanding) {
          finalWidth = Math.max(newWidth, corner.metadata.initialWidth);
        } else {
          finalWidth = newWidth;
        }

        if (isDragZExpanding) {
          finalLength = Math.max(newLength, corner.metadata.initialLength);
        } else {
          finalLength = newLength;
        }

        // Ensure minimum size
        finalWidth = Math.max(1, finalWidth);
        finalLength = Math.max(1, finalLength);

        // Update the building dimensions
        this._updateBuildingDimensions(finalWidth, finalLength);
      });

      // Notify when drag ends
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
        originalPosition: edge.position.clone(),
        controlType: 'edge',
        edgeId: pos.id,
        axis: pos.axis
      };

      // Add drag behavior
      const dragBehavior = new PointerDragBehavior({
        dragPlaneNormal: Vector3.Up()
      });

      // Store initial state when drag begins
      dragBehavior.onDragStartObservable.add(() => {
        if (this._building && this._targetMesh) {
          edge.metadata.initialWidth = this._building.width;
          edge.metadata.initialLength = this._building.length;
          edge.metadata.meshWorldMatrix = this._targetMesh.getWorldMatrix().clone();
        }
      });

      // Handle drag using Babylon's coordinate transformation
      dragBehavior.onDragObservable.add((event) => {
        if (!this._building || !this._targetMesh) return;

        // Transform drag position to local space
        const currentWorldPos = event.dragPlanePoint;
        const invWorldMatrix = Matrix.Invert(edge.metadata.meshWorldMatrix);
        const localDragPos = Vector3.TransformCoordinates(currentWorldPos, invWorldMatrix);

        // Get edge position in local space
        const edgeWorldPos = edge.getAbsolutePosition();
        const localEdgePos = Vector3.TransformCoordinates(edgeWorldPos, invWorldMatrix);

        let newWidth = edge.metadata.initialWidth;
        let newLength = edge.metadata.initialLength;

        // Handle resizing based on edge axis
        if (pos.axis === 'x') {
          // Width adjustment
          const calculatedWidth = 2 * Math.abs(localDragPos.x);
          const edgeSign = Math.sign(localEdgePos.x) || 1;
          const isExpanding = Math.sign(localDragPos.x) === edgeSign &&
            Math.abs(localDragPos.x) > Math.abs(localEdgePos.x);

          newWidth = isExpanding ? Math.max(calculatedWidth, edge.metadata.initialWidth) : calculatedWidth;
        } else {
          // Length adjustment
          const calculatedLength = 2 * Math.abs(localDragPos.z);
          const edgeSign = Math.sign(localEdgePos.z) || 1;
          const isExpanding = Math.sign(localDragPos.z) === edgeSign &&
            Math.abs(localDragPos.z) > Math.abs(localEdgePos.z);

          newLength = isExpanding ? Math.max(calculatedLength, edge.metadata.initialLength) : calculatedLength;
        }

        // Ensure minimum size
        newWidth = Math.max(1, newWidth);
        newLength = Math.max(1, newLength);

        // Update the building dimensions
        this._updateBuildingDimensions(newWidth, newLength);
      });

      // Notify when drag ends
      dragBehavior.onDragEndObservable.add(() => {
        this._notifyBuildingModified();
      });

      edge.addBehavior(dragBehavior);
      this._edgeControls.push(edge);
    });
  }

  /**
   * Create a rotation handle using Babylon's rotation utilities
   */
  private _createRotationHandle(): void {
    // Create the rotation handle
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

    // Create parent for rotation handle positioning
    this._rotationHandleParent = new TransformNode("rotationHandleParent", this._utilityLayer.utilityLayerScene);
    this._rotationHandleParent.parent = this._rootNode;

    this._rotationHandle.position.y = 0.1;
    this._rotationHandle.parent = this._rotationHandleParent;

    // Add drag behavior for rotation
    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up()
    });

    dragBehavior.onDragStartObservable.add(() => {
      if (this._building && this._targetMesh) {
        this._rotationHandle!.metadata = {
          initialRotation: this._building.rotation || 0,
          meshCenter: this._targetMesh.getAbsolutePosition()
        };
      }
    });

    dragBehavior.onDragObservable.add((event) => {
      if (!this._building || !this._targetMesh || !this._rotationHandle) return;

      const meshCenter = this._rotationHandle.metadata.meshCenter;
      const dragPoint = event.dragPlanePoint;

      // Calculate angle using atan2
      const dragVector = dragPoint.subtract(meshCenter);
      const angle = Math.atan2(dragVector.x, dragVector.z);

      // Store initial angle on first drag
      if (!this._rotationHandle.metadata.hasOwnProperty('initialAngle')) {
        this._rotationHandle.metadata.initialAngle = angle;
      }

      // Calculate rotation difference
      const angleDiff = angle - this._rotationHandle.metadata.initialAngle;
      const newRotation = this._rotationHandle.metadata.initialRotation + angleDiff;

      // Update rotation
      this._updateBuildingRotation(newRotation);
    });

    dragBehavior.onDragEndObservable.add(() => {
      this._notifyBuildingModified();
    });

    this._rotationHandle.addBehavior(dragBehavior);
  }

  /**
   * Create a central drag handle for repositioning the building
   */
  private _createDragHandle(): void {
    // Create a central handle for dragging the entire building
    this._dragHandle = MeshBuilder.CreatePlane(
      "dragHandle",
      {
        width: 0.8,
        height: 0.8
      },
      this._utilityLayer.utilityLayerScene
    );

    // Rotate to horizontal
    this._dragHandle.rotation.x = Math.PI / 2;
    this._dragHandle.position.y = 0.05;

    // Create material
    const handleMaterial = new StandardMaterial(
      "dragHandleMaterial",
      this._utilityLayer.utilityLayerScene
    );
    handleMaterial.diffuseColor = new Color3(0.3, 0.7, 1);
    handleMaterial.alpha = 0.2;
    this._dragHandle.material = handleMaterial;

    this._dragHandle.parent = this._rootNode;

    // Add drag behavior
    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up()
    });

    dragBehavior.onDragStartObservable.add(() => {
      if (this._building && this._targetMesh) {
        this._dragHandle!.metadata = {
          initialPosition: this._targetMesh.position.clone()
        };
      }
    });

    dragBehavior.onDragObservable.add((event) => {
      if (!this._building || !this._targetMesh) return;

      // Apply delta movement
      this._targetMesh.position.addInPlace(event.delta);

      // Update editor position
      this._rootNode.position.copyFrom(this._targetMesh.position);

      // Update building data
      this._building.position = {
        x: this._targetMesh.position.x,
        z: this._targetMesh.position.z
      };
    });

    dragBehavior.onDragEndObservable.add(() => {
      this._notifyBuildingModified();
    });

    this._dragHandle.addBehavior(dragBehavior);
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
    material.emissiveColor = color.scale(0.3);
    material.specularColor = Color3.White();
    point.material = material;

    point.parent = this._rootNode;
    return point;
  }

  /**
   * Update the building dimensions using Babylon's scaling utilities
   * @param width The new width
   * @param length The new length
   */
  private _updateBuildingDimensions(width: number, length: number): void {
    if (!this._building || !this._targetMesh) return;

    // Update the building data
    this._building.width = width;
    this._building.length = length;

    // Update the target mesh using Babylon's scaling
    const buildingBox = this._targetMesh.getChildMeshes()[0];
    if (buildingBox && buildingBox.getBoundingInfo()) {
      const bounds = buildingBox.getBoundingInfo().boundingBox;
      const currentWidth = bounds.extendSize.x * 2 * buildingBox.scaling.x;
      const currentLength = bounds.extendSize.z * 2 * buildingBox.scaling.z;

      if (currentWidth > 0 && currentLength > 0) {
        // Use Babylon's scaling to resize
        buildingBox.scaling.x *= width / currentWidth;
        buildingBox.scaling.z *= length / currentLength;
      }

      // Update borders and ridge lines
      this._updateBuildingVisuals();
    }

    // Update the editor visualization
    this._updateEditorVisuals();

    // Notify building modified
    this._notifyBuildingModified();
  }

  /**
   * Update building visual elements (borders, ridges)
   */
  private _updateBuildingVisuals(): void {
    if (!this._building || !this._targetMesh) return;

    this._targetMesh.getChildMeshes().forEach(child => {
      if (child.name.startsWith('border-')) {
        child.dispose();

        const halfWidth = this._building!.width / 2;
        const halfLength = this._building!.length / 2;
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
        }, this._scene);

        newBorder.color = new Color3(0.9, 0.9, 0.9);
        newBorder.parent = this._targetMesh;
      }

      if (child.name.startsWith('ridge-') && this._building!.type === 'dualPitch') {
        child.dispose();

        const ridgeOffset = this._building!.ridgeOffset || 0;
        const halfLength = this._building!.length / 2;

        const ridgeLine = MeshBuilder.CreateLines('ridge-' + this._building!.id, {
          points: [
            new Vector3(ridgeOffset, 0.15, -halfLength),
            new Vector3(ridgeOffset, 0.15, halfLength)
          ],
          updatable: true
        }, this._scene);

        ridgeLine.color = new Color3(0.9, 0.9, 0.9);
        ridgeLine.parent = this._targetMesh;
      }
    });
  }

  /**
   * Update the building rotation using Babylon's rotation methods
   * @param rotation The new rotation in radians
   */
  private _updateBuildingRotation(rotation: number): void {
    if (!this._building || !this._targetMesh) return;

    // Update the building data
    this._building.rotation = rotation;

    // Update the target mesh rotation using Babylon's Y-axis rotation
    this._targetMesh.rotation.y = rotation;
  }

  /**
   * Update the visual representation of the editor using Babylon's transform utilities
   */
  private _updateEditorVisuals(): void {
    if (!this._building || !this._targetMesh) return;

    // Update bounding box using Babylon's scaling
    this._boundingBox.scaling.set(
      this._building.width,
      1,
      this._building.length
    );

    // Sync editor position and rotation with target mesh
    this._rootNode.position.copyFrom(this._targetMesh.position);
    this._rootNode.rotation.y = this._targetMesh.rotation.y;

    // Update corner control positions using scaling
    const halfLength = this._building.length / 2;

    this._cornerControls.forEach(corner => {
      const originalPos = corner.metadata.originalPosition;
      // Scale positions based on current dimensions
      corner.position.x = originalPos.x * this._building!.width;
      corner.position.z = originalPos.z * this._building!.length;
    });

    // Update edge control positions
    this._edgeControls.forEach(edge => {
      const originalPos = edge.metadata.originalPosition;

      if (edge.metadata.axis === 'x') {
        edge.position.x = originalPos.x * this._building!.width;
        edge.position.z = 0;
      } else {
        edge.position.x = 0;
        edge.position.z = originalPos.z * this._building!.length;
      }
    });

    // Update rotation handle position
    if (this._rotationHandleParent) {
      // Keep handle at fixed offset from top edge
      this._rotationHandleParent.position.set(0, 0, -halfLength - 0.5);
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
    // Dispose controls
    this._cornerControls.forEach(c => c.dispose());
    this._cornerControls = [];

    this._edgeControls.forEach(e => e.dispose());
    this._edgeControls = [];

    if (this._rotationHandle) {
      this._rotationHandle.dispose();
      this._rotationHandle = null;
    }

    if (this._rotationHandleParent) {
      this._rotationHandleParent.dispose();
      this._rotationHandleParent = null;
    }

    if (this._dragHandle) {
      this._dragHandle.dispose();
      this._dragHandle = null;
    }

    this._boundingBox.dispose();
    this._rootNode.dispose();

    this._utilityLayer.dispose();
    this.onBuildingModifiedObservable.clear();
  }
}

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
    x: { arrow: Mesh; shaft: Mesh } | null;
    z: { arrow: Mesh; shaft: Mesh } | null;
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
    this._createGuideLines();
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
    const handleMaterial = new StandardMaterial(
      "moveHandleMaterial",
      this._utilityLayer.utilityLayerScene
    );
    handleMaterial.diffuseColor = new Color3(0.2, 0.8, 0.4);
    handleMaterial.emissiveColor = new Color3(0.1, 0.4, 0.2);
    this._centerHandle.material = handleMaterial;

    this._centerHandle.parent = this._rootNode;

    // Add drag behavior for free movement
    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up()
    });

    dragBehavior.onDragStartObservable.add(() => {
      if (this._building && this._targetMesh) {
        this._centerHandle!.metadata = {
          initialPosition: this._targetMesh.position.clone()
        };
        // Show guide lines
        this._guideLines.forEach(line => line.setEnabled(true));
      }
    });

    dragBehavior.onDragObservable.add((event) => {
      if (!this._building || !this._targetMesh) return;

      // Apply delta movement
      this._targetMesh.position.addInPlace(event.delta);

      // Update gizmo position
      this._rootNode.position.copyFrom(this._targetMesh.position);

      // Update guide lines
      this._updateGuideLines();

      // Update building data
      this._building.position = {
        x: this._targetMesh.position.x,
        z: this._targetMesh.position.z
      };
    });

    dragBehavior.onDragEndObservable.add(() => {
      // Hide guide lines
      this._guideLines.forEach(line => line.setEnabled(false));
      this._notifyBuildingMoved();
    });

    this._centerHandle.addBehavior(dragBehavior);
  }

  /**
   * Create directional arrow handles for constrained movement
   */
  private _createArrowHandles(): void {
    // Create X-axis arrow (red)
    this._createArrowHandle('x', new Vector3(1, 0, 0), new Color3(1, 0.2, 0.2));

    // Create Z-axis arrow (blue)
    this._createArrowHandle('z', new Vector3(0, 0, 1), new Color3(0.2, 0.2, 1));
  }

  /**
   * Create a single arrow handle
   */
  private _createArrowHandle(axis: 'x' | 'z', direction: Vector3, color: Color3): void {
    const shaftLength = 1.2;
    const arrowSize = 0.3;

    // Create shaft
    const shaft = MeshBuilder.CreateCylinder(
      `${axis}Shaft`,
      {
        height: shaftLength,
        diameter: 0.1,
        tessellation: 8
      },
      this._utilityLayer.utilityLayerScene
    );

    // Rotate and position shaft
    if (axis === 'x') {
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = shaftLength / 2;
    } else {
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = shaftLength / 2;
    }
    shaft.position.y = 0.1;

    // Create arrow head
    const arrow = MeshBuilder.CreateCylinder(
      `${axis}Arrow`,
      {
        height: arrowSize,
        diameterTop: 0,
        diameterBottom: arrowSize,
        tessellation: 4
      },
      this._utilityLayer.utilityLayerScene
    );

    // Position arrow at end of shaft
    if (axis === 'x') {
      arrow.rotation.z = -Math.PI / 2;
      arrow.position.x = shaftLength + arrowSize / 2;
    } else {
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.z = shaftLength + arrowSize / 2;
    }
    arrow.position.y = 0.1;

    // Create materials
    const shaftMaterial = new StandardMaterial(
      `${axis}ShaftMaterial`,
      this._utilityLayer.utilityLayerScene
    );
    shaftMaterial.diffuseColor = color;
    shaftMaterial.emissiveColor = color.scale(0.3);
    shaft.material = shaftMaterial;

    const arrowMaterial = new StandardMaterial(
      `${axis}ArrowMaterial`,
      this._utilityLayer.utilityLayerScene
    );
    arrowMaterial.diffuseColor = color;
    arrowMaterial.emissiveColor = color.scale(0.5);
    arrow.material = arrowMaterial;

    // Parent to root
    shaft.parent = this._rootNode;
    arrow.parent = this._rootNode;

    // Store references
    this._arrowHandles[axis] = { arrow, shaft };

    // Add drag behavior to both shaft and arrow
    [shaft, arrow].forEach(mesh => {
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
          this._guideLines.forEach(line => line.setEnabled(true));
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

        // Update guide lines
        this._updateGuideLines();

        // Update building data
        this._building.position = {
          x: this._targetMesh.position.x,
          z: this._targetMesh.position.z
        };
      });

      dragBehavior.onDragEndObservable.add(() => {
        // Hide guide lines
        this._guideLines.forEach(line => line.setEnabled(false));
        this._notifyBuildingMoved();
      });

      mesh.addBehavior(dragBehavior);
    });
  }

  /**
   * Create guide lines that show during movement
   */
  private _createGuideLines(): void {
    const lineLength = 50;
    const lineColor = new Color3(0.5, 0.5, 0.5);

    // X-axis guide line
    const xLine = MeshBuilder.CreateLines(
      "xGuideLine",
      {
        points: [
          new Vector3(-lineLength, 0.05, 0),
          new Vector3(lineLength, 0.05, 0)
        ],
        updatable: true
      },
      this._utilityLayer.utilityLayerScene
    );
    xLine.color = lineColor;
    xLine.alpha = 0.5;
    xLine.parent = this._rootNode;
    xLine.setEnabled(false);
    this._guideLines.push(xLine);

    // Z-axis guide line
    const zLine = MeshBuilder.CreateLines(
      "zGuideLine",
      {
        points: [
          new Vector3(0, 0.05, -lineLength),
          new Vector3(0, 0.05, lineLength)
        ],
        updatable: true
      },
      this._utilityLayer.utilityLayerScene
    );
    zLine.color = lineColor;
    zLine.alpha = 0.5;
    zLine.parent = this._rootNode;
    zLine.setEnabled(false);
    this._guideLines.push(zLine);
  }

  /**
   * Update guide lines position
   */
  private _updateGuideLines(): void {
    // Guide lines are parented to root node, so they move automatically
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
    this._guideLines.forEach(line => line.setEnabled(false));
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
    this._guideLines.forEach(line => line.dispose());
    this._guideLines = [];

    this._rootNode.dispose();
    this._utilityLayer.dispose();
    this.onBuildingMovedObservable.clear();
  }
}

/**
 * Sets up the gizmo manager for transforming objects in the scene
 */
export const setupGizmoManager = (scene: Scene): GizmoManager => {
  // Initialize Gizmo Manager with disabled default gizmos
  const gizmoManager = new GizmoManager(scene);

  // Disable all default gizmos - we use custom controls
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.usePointerToAttachGizmos = false;

  // Configure gizmos for 2D operation (XZ plane only)
  if (gizmoManager.gizmos.positionGizmo) {
    // Restrict to XZ plane movement
    gizmoManager.gizmos.positionGizmo.xGizmo.dragBehavior.updateDragPlane = false;
    gizmoManager.gizmos.positionGizmo.zGizmo.dragBehavior.updateDragPlane = false;
    gizmoManager.gizmos.positionGizmo.yGizmo.isEnabled = false;
  }

  return gizmoManager;
}; 