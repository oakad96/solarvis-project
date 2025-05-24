import {
  StandardMaterial,
  Color3,
  Scene,
  PointerDragBehavior,
  Vector3,
  Mesh,
  MeshBuilder,
  UtilityLayerRenderer
} from '@babylonjs/core';

/**
 * Interface for arrow handle components
 */
export interface ArrowHandle {
  arrow: Mesh;
  shaft: Mesh;
}

/**
 * Interface for axis constraint in drag behavior
 */
export interface AxisConstraint {
  x?: boolean;
  z?: boolean;
}

/**
 * Creates a standard material with given color and optional emissive properties
 */
export function createStandardMaterial(
  name: string,
  color: Color3,
  scene: Scene | UtilityLayerRenderer,
  emissiveScale: number = 0.3,
  alpha: number = 1
): StandardMaterial {
  const utilityScene = scene instanceof UtilityLayerRenderer ? scene.utilityLayerScene : scene;

  const material = new StandardMaterial(name, utilityScene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(emissiveScale);
  material.specularColor = Color3.White();

  if (alpha < 1) {
    material.alpha = alpha;
  }

  return material;
}

/**
 * Creates a control point mesh with consistent styling
 */
export function createControlPoint(
  id: string,
  size: number,
  color: Color3,
  scene: UtilityLayerRenderer,
  position?: Vector3
): Mesh {
  const point = MeshBuilder.CreateBox(
    `control-${id}`,
    {
      width: size,
      height: size,
      depth: size
    },
    scene.utilityLayerScene
  );

  const material = createStandardMaterial(
    `control-material-${id}`,
    color,
    scene
  );
  point.material = material;

  if (position) {
    point.position.copyFrom(position);
  }

  return point;
}

/**
 * Creates a drag behavior with XZ plane constraint and optional axis limitations
 */
export function createConstrainedDragBehavior(
  axisConstraint?: AxisConstraint
): PointerDragBehavior {
  const dragBehavior = new PointerDragBehavior({
    dragPlaneNormal: Vector3.Up()
  });

  if (axisConstraint) {
    // Add constraint logic in the drag observable
    dragBehavior.onDragObservable.add((event) => {
      if (!axisConstraint.x && !axisConstraint.z) return;

      // Constrain delta to allowed axes
      const constrainedDelta = new Vector3(
        axisConstraint.x ? event.delta.x : 0,
        0,
        axisConstraint.z ? event.delta.z : 0
      );

      // Replace the original delta
      event.delta.copyFrom(constrainedDelta);
    });
  }

  return dragBehavior;
}

/**
 * Creates an arrow handle (shaft + arrow head) for directional movement
 */
export function createArrowHandle(
  axis: 'x' | 'z',
  color: Color3,
  scene: UtilityLayerRenderer,
  shaftLength: number = 1.2,
  arrowSize: number = 0.3
): ArrowHandle {
  // Create shaft
  const shaft = MeshBuilder.CreateCylinder(
    `${axis}Shaft`,
    {
      height: shaftLength,
      diameter: 0.1,
      tessellation: 8
    },
    scene.utilityLayerScene
  );

  // Create arrow head
  const arrow = MeshBuilder.CreateCylinder(
    `${axis}Arrow`,
    {
      height: arrowSize,
      diameterTop: 0,
      diameterBottom: arrowSize,
      tessellation: 4
    },
    scene.utilityLayerScene
  );

  // Position and rotate based on axis
  if (axis === 'x') {
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = shaftLength / 2;
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.x = shaftLength + arrowSize / 2;
  } else {
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = shaftLength / 2;
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.z = shaftLength + arrowSize / 2;
  }

  shaft.position.y = 0.1;
  arrow.position.y = 0.1;

  // Apply materials
  const shaftMaterial = createStandardMaterial(
    `${axis}ShaftMaterial`,
    color,
    scene
  );
  const arrowMaterial = createStandardMaterial(
    `${axis}ArrowMaterial`,
    color,
    scene,
    0.5
  );

  shaft.material = shaftMaterial;
  arrow.material = arrowMaterial;

  return { arrow, shaft };
}

/**
 * Creates guide lines for visual feedback during operations
 */
export function createGuideLines(
  scene: UtilityLayerRenderer,
  lineLength: number = 50,
  lineColor: Color3 = new Color3(0.5, 0.5, 0.5)
): Mesh[] {
  const guideLines: Mesh[] = [];

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
    scene.utilityLayerScene
  );
  xLine.color = lineColor;
  xLine.alpha = 0.5;
  xLine.setEnabled(false);
  guideLines.push(xLine);

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
    scene.utilityLayerScene
  );
  zLine.color = lineColor;
  zLine.alpha = 0.5;
  zLine.setEnabled(false);
  guideLines.push(zLine);

  return guideLines;
}

/**
 * Utility function to dispose of an array of meshes
 */
export function disposeMeshArray(meshes: Mesh[]): void {
  meshes.forEach(mesh => mesh.dispose());
  meshes.length = 0;
}

/**
 * Utility function to show/hide guide lines
 */
export function toggleGuideLines(guideLines: Mesh[], visible: boolean): void {
  guideLines.forEach(line => line.setEnabled(visible));
} 