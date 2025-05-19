import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  VertexData,
  TransformNode
} from '@babylonjs/core';
import { Building } from '../store/RoofBuilderContext';

// Create a flat roof building mesh
export const createFlatRoofMesh = (scene: Scene, building: Building): Mesh => {
  const buildingMesh = MeshBuilder.CreateBox('building-' + building.id, {
    width: building.width,
    height: building.height,
    depth: building.length,
    updatable: true
  }, scene);

  // Position the building
  buildingMesh.position = new Vector3(
    building.position.x,
    building.height / 2,
    building.position.z
  );

  buildingMesh.rotation.y = building.rotation;

  // Create and apply material
  const material = new StandardMaterial('building-material-' + building.id, scene);
  material.diffuseColor = new Color3(0.8, 0.8, 0.8);
  buildingMesh.material = material;

  return buildingMesh;
};

// Create a dual pitch (gable) roof building mesh
export const createDualPitchRoofMesh = (scene: Scene, building: Building): Mesh => {
  // Use TransformNode as the parent container for better hierarchy management
  const buildingParent = new TransformNode('building-parent-' + building.id, scene);

  // Create the main building box (walls)
  const wallHeight = building.height - (building.ridgeHeight || 1);
  const wallsBox = MeshBuilder.CreateBox('walls-' + building.id, {
    width: building.width,
    height: wallHeight,
    depth: building.length,
    updatable: true
  }, scene);

  wallsBox.position = new Vector3(0, wallHeight / 2, 0);
  wallsBox.parent = buildingParent;

  // Create the roof (triangular prism)
  const roofMesh = createGableRoof(scene, building);
  roofMesh.position = new Vector3(
    0,
    wallHeight + (building.ridgeHeight || 1) / 2,
    (building.ridgeOffset || 0)
  );
  roofMesh.parent = buildingParent;

  // Position the entire building
  buildingParent.position = new Vector3(
    building.position.x,
    0, // Base on ground
    building.position.z
  );

  buildingParent.rotation.y = building.rotation;

  // Materials
  const wallMaterial = new StandardMaterial('wall-material-' + building.id, scene);
  wallMaterial.diffuseColor = new Color3(0.8, 0.8, 0.8);
  wallsBox.material = wallMaterial;

  const roofMaterial = new StandardMaterial('roof-material-' + building.id, scene);
  roofMaterial.diffuseColor = new Color3(0.6, 0.3, 0.2);
  roofMesh.material = roofMaterial;

  // Convert TransformNode to Mesh for compatibility
  const parentMesh = new Mesh('building-mesh-' + building.id, scene);
  parentMesh.position = buildingParent.position.clone();
  parentMesh.rotation = buildingParent.rotation.clone();

  // Make the walls and roof children of the new parent mesh
  wallsBox.parent = parentMesh;
  roofMesh.parent = parentMesh;

  // Dispose of the transform node as it's no longer needed
  buildingParent.dispose();

  return parentMesh;
};

// Helper function to create a gable roof shape
const createGableRoof = (scene: Scene, building: Building): Mesh => {
  const width = building.width;
  const depth = building.length;
  const ridgeHeight = building.ridgeHeight || 1;
  const roofMesh = new Mesh('roof-' + building.id, scene);

  // Create custom vertex data
  const vertexData = new VertexData();

  // Create the custom roof shape using vertices
  const positions = [
    // Left face
    -width / 2, 0, -depth / 2,   // 0
    -width / 2, 0, depth / 2,    // 1
    0, ridgeHeight, depth / 2, // 2
    0, ridgeHeight, -depth / 2,// 3

    // Right face
    width / 2, 0, -depth / 2,    // 4
    width / 2, 0, depth / 2      // 5
  ];

  // Define faces using vertex indices
  const indices = [
    // Left slope
    0, 1, 2,
    0, 2, 3,

    // Right slope
    3, 2, 5,
    3, 5, 4,

    // Front face
    1, 5, 2,

    // Back face
    0, 3, 4
  ];

  // Add UV coordinates for better texture mapping
  const uvs = [
    0, 0,
    1, 0,
    1, 1,
    0, 1,
    0, 0,
    1, 0
  ];

  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.uvs = uvs;

  // Initialize the normals array
  vertexData.normals = new Array(positions.length).fill(0);

  // Calculate normal vectors for proper lighting
  VertexData.ComputeNormals(
    vertexData.positions,
    vertexData.indices, 
    vertexData.normals
  );

  vertexData.applyToMesh(roofMesh, true); // Set updatable to true for potential future modifications

  return roofMesh;
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