import {
  PlaneRotationGizmo,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  UtilityLayerRenderer,
  AbstractMesh,
  Nullable
} from '@babylonjs/core';
import { createStandardMaterial } from './utils';

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
    const indicatorMaterial = createStandardMaterial(
      "directionIndicatorMat",
      new Color3(1, 0.7, 0),
      utilityLayer,
      0.5
    );
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
  public set attachedMesh(mesh: Nullable<AbstractMesh>) {
    super.attachedMesh = mesh;

    if (mesh) {
      this._updateIndicatorPosition();
    }
  }

  /**
   * Gets the currently attached mesh
   */
  public get attachedMesh(): Nullable<AbstractMesh> {
    return super.attachedMesh;
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