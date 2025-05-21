import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  TransformNode
} from '@babylonjs/core';
import { Building } from '../store/RoofBuilderContext';

// Create a flat roof building mesh (simple rectangle with low opacity)
export const createFlatRoofMesh = (scene: Scene, building: Building): Mesh => {
  // Parent container to hold all parts
  const buildingParent = new TransformNode('building-parent-' + building.id, scene);

  // Create a simple box with low height (like a flat rectangle from top view)
  const buildingMesh = MeshBuilder.CreateBox('building-' + building.id, {
    width: building.width,
    height: 0.1, // Very thin to appear as a rectangle from top view
    depth: building.length,
    updatable: true
  }, scene);

  // Position just slightly above ground to avoid z-fighting
  buildingMesh.position = new Vector3(0, 0.05, 0);
  buildingMesh.parent = buildingParent;

  // Create and apply semi-transparent material
  const material = new StandardMaterial('building-material-' + building.id, scene);
  material.diffuseColor = new Color3(0.4, 0.4, 0.9); // Blue-ish color
  material.alpha = 0.4; // Low opacity
  buildingMesh.material = material;

  // Add distinct border around the building
  const halfWidth = building.width / 2;
  const halfLength = building.length / 2;
  const borderHeight = 0.17; // Slightly above the building

  // Create border using lines
  const borderPoints = [
    new Vector3(-halfWidth, borderHeight, -halfLength),
    new Vector3(halfWidth, borderHeight, -halfLength),
    new Vector3(halfWidth, borderHeight, halfLength),
    new Vector3(-halfWidth, borderHeight, halfLength),
    new Vector3(-halfWidth, borderHeight, -halfLength)
  ];

  const border = MeshBuilder.CreateLines('border-' + building.id, {
    points: borderPoints,
    updatable: true
  }, scene);

  border.color = new Color3(0.9, 0.9, 0.9); // Light gray border
  border.parent = buildingParent;

  // Position the parent
  buildingParent.position = new Vector3(
    building.position.x,
    0,
    building.position.z
  );
  buildingParent.rotation.y = building.rotation;

  // Convert TransformNode to Mesh for compatibility
  const parentMesh = new Mesh('building-mesh-' + building.id, scene);
  parentMesh.position = buildingParent.position.clone();
  parentMesh.rotation = buildingParent.rotation.clone();

  // Make the building mesh a child of the parent mesh
  buildingMesh.parent = parentMesh;
  border.parent = parentMesh;

  // Dispose of the transform node as it's no longer needed
  buildingParent.dispose();

  return parentMesh;
};

// Create a dual pitch (gable) roof building mesh
export const createDualPitchRoofMesh = (scene: Scene, building: Building): Mesh => {
  // Parent container to hold all parts
  const buildingParent = new TransformNode('building-parent-' + building.id, scene);

  // Create a simple box with low height (like a flat rectangle from top view)
  const buildingMesh = MeshBuilder.CreateBox('building-' + building.id, {
    width: building.width,
    height: 0.1, // Very thin to appear as a rectangle from top view
    depth: building.length,
    updatable: true
  }, scene);

  // Position just slightly above ground to avoid z-fighting
  buildingMesh.position = new Vector3(0, 0.05, 0);
  buildingMesh.parent = buildingParent;

  // Create and apply semi-transparent material
  const material = new StandardMaterial('building-material-' + building.id, scene);
  material.diffuseColor = new Color3(0.9, 0.4, 0.4); // Red-ish color
  material.alpha = 0.4; // Low opacity
  buildingMesh.material = material;

  // Add distinct border around the building
  const halfWidth = building.width / 2;
  const halfLength = building.length / 2;
  const borderHeight = 0.17; // Slightly above the building

  // Create border using lines
  const borderPoints = [
    new Vector3(-halfWidth, borderHeight, -halfLength),
    new Vector3(halfWidth, borderHeight, -halfLength),
    new Vector3(halfWidth, borderHeight, halfLength),
    new Vector3(-halfWidth, borderHeight, halfLength),
    new Vector3(-halfWidth, borderHeight, -halfLength)
  ];

  const border = MeshBuilder.CreateLines('border-' + building.id, {
    points: borderPoints,
    updatable: true
  }, scene);

  border.color = new Color3(0.9, 0.9, 0.9); // Light gray border
  border.parent = buildingParent;

  // Create a line to represent the roof ridge
  const ridgeOffset = building.ridgeOffset || 0;
  const start = new Vector3(ridgeOffset, 0.15, -building.length / 2);
  const end = new Vector3(ridgeOffset, 0.15, building.length / 2);

  const ridgeLine = MeshBuilder.CreateLines('ridge-' + building.id, {
    points: [start, end],
    updatable: true
  }, scene);

  // Make the line more visible
  ridgeLine.color = new Color3(0.9, 0.9, 0.9); // Light gray line
  ridgeLine.parent = buildingParent;

  // Position the parent
  buildingParent.position = new Vector3(
    building.position.x,
    0,
    building.position.z
  );
  buildingParent.rotation.y = building.rotation;

  // Convert TransformNode to Mesh for compatibility
  const parentMesh = new Mesh('building-mesh-' + building.id, scene);
  parentMesh.position = buildingParent.position.clone();
  parentMesh.rotation = buildingParent.rotation.clone();

  // Make the building mesh and ridge line children of the parent mesh
  buildingMesh.parent = parentMesh;
  ridgeLine.parent = parentMesh;
  border.parent = parentMesh;

  // Dispose of the transform node as it's no longer needed
  buildingParent.dispose();

  return parentMesh;
};

// Create the appropriate mesh based on building type
export const createBuildingMesh = (scene: Scene, building: Building): Mesh => {
  switch (building.type) {
    case 'flat':
      return createFlatRoofMesh(scene, building);
    case 'dualPitch':
      return createDualPitchRoofMesh(scene, building);
    default:
      throw new Error(`Unknown roof type: ${building.type}`);
  }
};

// Helper function to position a control point in world space
const positionControlPoint = (building: Building, localPos: { x: number, z: number }, yPos: number): Vector3 => {
  const rotatedX = Math.cos(building.rotation) * localPos.x - Math.sin(building.rotation) * localPos.z;
  const rotatedZ = Math.sin(building.rotation) * localPos.x + Math.cos(building.rotation) * localPos.z;

  return new Vector3(
    building.position.x + rotatedX,
    yPos,
    building.position.z + rotatedZ
  );
};

// Create control points for resizing the building
export const createControlPointsMesh = (scene: Scene, building: Building): Mesh[] => {
  const controlPoints: Mesh[] = [];
  const size = 0.3;
  const yPos = 0.1; // Just above ground level

  // Corner control points
  const cornerPositions = [
    { x: -building.width / 2, z: -building.length / 2, id: 'topLeft' },
    { x: building.width / 2, z: -building.length / 2, id: 'topRight' },
    { x: -building.width / 2, z: building.length / 2, id: 'bottomLeft' },
    { x: building.width / 2, z: building.length / 2, id: 'bottomRight' },
  ];

  // Mid-point control points
  const midPositions = [
    { x: 0, z: -building.length / 2, id: 'midTop' },
    { x: building.width / 2, z: 0, id: 'midRight' },
    { x: 0, z: building.length / 2, id: 'midBottom' },
    { x: -building.width / 2, z: 0, id: 'midLeft' },
  ];

  // Create control point mesh with helper function
  const createControlPoint = (position: { x: number, z: number, id: string }, color: Color3) => {
    const point = MeshBuilder.CreateBox(`control-${position.id}-${building.id}`, {
      width: size,
      height: size,
      depth: size,
      updatable: true
    }, scene);

    const material = new StandardMaterial(`control-material-${position.id}`, scene);
    material.diffuseColor = color;
    point.material = material;

    // Position in world space
    point.position = positionControlPoint(building, position, yPos);

    // Store metadata
    point.metadata = {
      buildingId: building.id,
      controlType: position.id,
    };

    // Make control points pickable
    point.isPickable = true;

    return point;
  };

  // Create corner control points
  cornerPositions.forEach(pos => {
    controlPoints.push(createControlPoint(pos, new Color3(1, 0, 0)));
  });

  // Create mid-point control points
  midPositions.forEach(pos => {
    controlPoints.push(createControlPoint(pos, new Color3(0, 0, 1)));
  });

  return controlPoints;
};