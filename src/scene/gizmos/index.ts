// Export all gizmo classes and utilities
export { BuildingEditor } from './BuildingEditor';
export { BuildingMoveGizmo } from './BuildingMoveGizmo';
export { BuildingRotationGizmo } from './BuildingRotationGizmo';
export { setupGizmoManager } from './setupGizmoManager';

// Export utility types and functions
export type {
  ArrowHandle,
  AxisConstraint
} from './utils';

export {
  createStandardMaterial,
  createControlPoint,
  createConstrainedDragBehavior,
  createArrowHandle,
  createGuideLines,
  disposeMeshArray,
  toggleGuideLines
} from './utils'; 