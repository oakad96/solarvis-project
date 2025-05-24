import {
  Scene,
  GizmoManager
} from '@babylonjs/core';

/**
 * Sets up the gizmo manager for transforming objects in the scene
 * @param scene The scene to add the gizmo manager to
 * @returns Configured GizmoManager instance
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