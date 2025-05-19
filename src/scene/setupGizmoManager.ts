import {
  Scene,
  GizmoManager
} from '@babylonjs/core';

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

  // For rotation, we'll use a PlaneRotationGizmo instead of the default RotationGizmo
  // We'll implement this when enableRotateGizmo is called
  if (gizmoManager.gizmos.rotationGizmo) {
    // Disable the standard rotation gizmo entirely - we'll use our custom one instead
    gizmoManager.gizmos.rotationGizmo.xGizmo.isEnabled = false;
    gizmoManager.gizmos.rotationGizmo.yGizmo.isEnabled = false;
    gizmoManager.gizmos.rotationGizmo.zGizmo.isEnabled = false;
  }

  if (gizmoManager.gizmos.scaleGizmo) {
    // Restrict scaling to XZ plane
    gizmoManager.gizmos.scaleGizmo.yGizmo.isEnabled = false; // Disable Y-axis scaling
  }

  return gizmoManager;
}; 