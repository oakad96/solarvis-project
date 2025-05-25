import {
  Scene,
  UtilityLayerRenderer,
  TransformNode,
  Mesh,
  Observable,
  Vector3,
  Color3,
  MeshBuilder,
  PointerDragBehavior,
  Matrix
} from '@babylonjs/core';
import { Building } from '../../store/RoofBuilderContext';
import { createStandardMaterial, createControlPoint, disposeMeshArray } from './utils';

/**
 * Interface for control point metadata
 */
interface ControlPointMetadata {
  originalPosition: Vector3;
  controlType: 'corner' | 'edge';
  cornerId?: string;
  edgeId?: string;
  axis?: string;
  initialWidth?: number;
  initialLength?: number;
  dragStartWorldPos?: Vector3;
  meshWorldMatrix?: Matrix;
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

    const boxMaterial = createStandardMaterial(
      "buildingEditorBoxMaterial",
      new Color3(0.2, 0.6, 1),
      this._utilityLayer,
      0.3,
      0.2
    );
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
      const corner = createControlPoint(
        pos.id,
        0.25,
        new Color3(0, 0.8, 1), // Bright cyan
        this._utilityLayer,
        new Vector3(pos.x, 0.1, pos.z)
      );

      corner.parent = this._rootNode;

      // Store the original position
      corner.metadata = {
        originalPosition: corner.position.clone(),
        controlType: 'corner',
        cornerId: pos.id
      } as ControlPointMetadata;

      // Add drag behavior
      this._addCornerDragBehavior(corner);
      this._cornerControls.push(corner);
    });
  }

  /**
   * Add drag behavior to corner controls
   */
  private _addCornerDragBehavior(corner: Mesh): void {
    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up()
    });

    // Store initial state when drag begins
    dragBehavior.onDragStartObservable.add(() => {
      if (this._building && this._targetMesh) {
        const metadata = corner.metadata as ControlPointMetadata;
        metadata.initialWidth = this._building.width;
        metadata.initialLength = this._building.length;
        metadata.dragStartWorldPos = dragBehavior.lastDragPosition?.clone();
        metadata.meshWorldMatrix = this._targetMesh.getWorldMatrix().clone();
      }
    });

    // Handle drag using Babylon's coordinate transformation utilities
    dragBehavior.onDragObservable.add((event) => {
      if (!this._building || !this._targetMesh) return;

      const metadata = corner.metadata as ControlPointMetadata;

      // Get drag position in world space
      const currentWorldPos = event.dragPlanePoint;

      // Transform to local space using Babylon's utilities
      const meshWorldMatrix = metadata.meshWorldMatrix!;
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
      let finalWidth = metadata.initialWidth!;
      let finalLength = metadata.initialLength!;

      if (isDragXExpanding) {
        finalWidth = Math.max(newWidth, metadata.initialWidth!);
      } else {
        finalWidth = newWidth;
      }

      if (isDragZExpanding) {
        finalLength = Math.max(newLength, metadata.initialLength!);
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
      const edge = createControlPoint(
        pos.id,
        0.2,
        new Color3(1, 0.4, 0), // Bright orange
        this._utilityLayer,
        new Vector3(pos.x, 0.1, pos.z)
      );

      edge.parent = this._rootNode;

      // Store metadata
      edge.metadata = {
        originalPosition: edge.position.clone(),
        controlType: 'edge',
        edgeId: pos.id,
        axis: pos.axis
      } as ControlPointMetadata;

      // Add drag behavior
      this._addEdgeDragBehavior(edge, pos.axis);
      this._edgeControls.push(edge);
    });
  }

  /**
   * Add drag behavior to edge controls
   */
  private _addEdgeDragBehavior(edge: Mesh, axis: string): void {
    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up()
    });

    // Store initial state when drag begins
    dragBehavior.onDragStartObservable.add(() => {
      if (this._building && this._targetMesh) {
        const metadata = edge.metadata as ControlPointMetadata;
        metadata.initialWidth = this._building.width;
        metadata.initialLength = this._building.length;
        metadata.meshWorldMatrix = this._targetMesh.getWorldMatrix().clone();
      }
    });

    // Handle drag using Babylon's coordinate transformation
    dragBehavior.onDragObservable.add((event) => {
      if (!this._building || !this._targetMesh) return;

      const metadata = edge.metadata as ControlPointMetadata;

      // Transform drag position to local space
      const currentWorldPos = event.dragPlanePoint;
      const invWorldMatrix = Matrix.Invert(metadata.meshWorldMatrix!);
      const localDragPos = Vector3.TransformCoordinates(currentWorldPos, invWorldMatrix);

      // Get edge position in local space
      const edgeWorldPos = edge.getAbsolutePosition();
      const localEdgePos = Vector3.TransformCoordinates(edgeWorldPos, invWorldMatrix);

      let newWidth = metadata.initialWidth!;
      let newLength = metadata.initialLength!;

      // Handle resizing based on edge axis
      if (axis === 'x') {
        // Width adjustment
        const calculatedWidth = 2 * Math.abs(localDragPos.x);
        const edgeSign = Math.sign(localEdgePos.x) || 1;
        const isExpanding = Math.sign(localDragPos.x) === edgeSign &&
          Math.abs(localDragPos.x) > Math.abs(localEdgePos.x);

        newWidth = isExpanding ? Math.max(calculatedWidth, metadata.initialWidth!) : calculatedWidth;
      } else {
        // Length adjustment
        const calculatedLength = 2 * Math.abs(localDragPos.z);
        const edgeSign = Math.sign(localEdgePos.z) || 1;
        const isExpanding = Math.sign(localDragPos.z) === edgeSign &&
          Math.abs(localDragPos.z) > Math.abs(localEdgePos.z);

        newLength = isExpanding ? Math.max(calculatedLength, metadata.initialLength!) : calculatedLength;
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

    const handleMaterial = createStandardMaterial(
      "rotationHandleMaterial",
      new Color3(1, 0.1, 0.8), // Bright magenta
      this._utilityLayer,
      0.5
    );
    this._rotationHandle.material = handleMaterial;

    // Create parent for rotation handle - positioned at building center
    this._rotationHandleParent = new TransformNode("rotationHandleParent", this._utilityLayer.utilityLayerScene);

    // Set handle at fixed offset from parent
    this._rotationHandle.position.set(0, 0.1, -2.0); // 2 units forward from parent
    this._rotationHandle.parent = this._rotationHandleParent;

    // Initially hide the rotation handle parent (will be shown when attached)
    this._rotationHandleParent.setEnabled(false);

    // Add drag behavior for rotation
    this._addRotationDragBehavior();
  }

  /**
   * Add rotation drag behavior to the rotation handle
   */
  private _addRotationDragBehavior(): void {
    if (!this._rotationHandle) return;

    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up()
    });

    dragBehavior.onDragStartObservable.add(() => {
      if (this._building && this._targetMesh) {
        this._rotationHandle!.metadata = {
          initialRotation: this._building.rotation || 0,
          meshCenter: this._targetMesh.getAbsolutePosition(),
          isDragging: false
        };
      }
    });

    dragBehavior.onDragObservable.add((event) => {
      if (!this._building || !this._targetMesh || !this._rotationHandle) return;

      const metadata = this._rotationHandle.metadata;
      const meshCenter = metadata.meshCenter;
      const dragPoint = event.dragPlanePoint;

      // Calculate current angle from mesh center to drag point
      const dragVector = dragPoint.subtract(meshCenter);
      const currentAngle = Math.atan2(dragVector.x, dragVector.z);

      // On first drag, store the initial drag angle
      if (!metadata.isDragging) {
        metadata.initialDragAngle = currentAngle;
        metadata.isDragging = true;
      }

      // Calculate rotation difference from initial drag angle
      const angleDiff = currentAngle - metadata.initialDragAngle;
      const newRotation = metadata.initialRotation + angleDiff;

      // Update rotation
      this._updateBuildingRotation(newRotation);
    });

    dragBehavior.onDragEndObservable.add(() => {
      // Reset dragging state
      if (this._rotationHandle && this._rotationHandle.metadata) {
        this._rotationHandle.metadata.isDragging = false;
      }
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
    const handleMaterial = createStandardMaterial(
      "dragHandleMaterial",
      new Color3(0.2, 1, 0.3), // Bright green
      this._utilityLayer,
      0.3,
      0.3
    );
    this._dragHandle.material = handleMaterial;

    this._dragHandle.parent = this._rootNode;

    // Add drag behavior
    this._addDragHandleBehavior();
  }

  /**
   * Add drag behavior to the central drag handle
   */
  private _addDragHandleBehavior(): void {
    if (!this._dragHandle) return;

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
    this._cornerControls.forEach(corner => {
      const metadata = corner.metadata as ControlPointMetadata;
      const originalPos = metadata.originalPosition;
      // Scale positions based on current dimensions
      corner.position.x = originalPos.x * this._building!.width;
      corner.position.z = originalPos.z * this._building!.length;
    });

    // Update edge control positions
    this._edgeControls.forEach(edge => {
      const metadata = edge.metadata as ControlPointMetadata;
      const originalPos = metadata.originalPosition;

      if (metadata.axis === 'x') {
        edge.position.x = originalPos.x * this._building!.width;
        edge.position.z = 0;
      } else {
        edge.position.x = 0;
        edge.position.z = originalPos.z * this._building!.length;
      }
    });

    // Update rotation handle position - position relative to bottom edge control
    if (this._rotationHandleParent && this._targetMesh) {
      // Position parent at building center
      this._rotationHandleParent.position.copyFrom(this._targetMesh.position);
      // Match building rotation
      this._rotationHandleParent.rotation.y = this._building.rotation || 0;

      // Position handle relative to top edge control
      const topEdgeZ = -0.5 * this._building.length; // Top edge position
      const handleOffset = topEdgeZ - 0.5; // Add some distance beyond the edge
      this._rotationHandle!.position.set(0, 0.1, handleOffset);
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

    // Show the rotation handle
    if (this._rotationHandleParent) {
      this._rotationHandleParent.setEnabled(true);
    }
  }

  /**
   * Detach the editor from the current building
   */
  public detach(): void {
    this._building = null;
    this._targetMesh = null;
    this._rootNode.setEnabled(false);

    // Hide the rotation handle
    if (this._rotationHandleParent) {
      this._rotationHandleParent.setEnabled(false);
    }
  }

  /**
   * Dispose of all resources used by the editor
   */
  public dispose(): void {
    // Dispose controls
    disposeMeshArray(this._cornerControls);
    disposeMeshArray(this._edgeControls);

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