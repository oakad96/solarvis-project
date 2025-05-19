import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Mesh, VertexData } from '@babylonjs/core';
import { Building } from '../store/RoofBuilderContext';

// Create a flat roof building mesh
export const createFlatRoofMesh = (scene: Scene, building: Building): Mesh => {
  // Create the main building box
  const buildingMesh = MeshBuilder.CreateBox('building-' + building.id, {
    width: building.width,
    height: building.height,
    depth: building.length,
  }, scene);

  // Position the building
  buildingMesh.position = new Vector3(
    building.position.x,
    building.height / 2, // Center the box vertically
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
  // Create parent mesh to group building parts
  const buildingParent = new Mesh('building-parent-' + building.id, scene);

  // Create the main building box (walls)
  const wallHeight = building.height - (building.ridgeHeight || 1);
  const wallsBox = MeshBuilder.CreateBox('walls-' + building.id, {
    width: building.width,
    height: wallHeight,
    depth: building.length,
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

  return buildingParent;
};

// Helper function to create a gable roof shape
const createGableRoof = (scene: Scene, building: Building): Mesh => {
  const width = building.width;
  const depth = building.length;
  const ridgeHeight = building.ridgeHeight || 1;

  // Create the custom roof shape using vertices
  const roofVertices = [
    // Left face
    new Vector3(-width / 2, 0, -depth / 2),
    new Vector3(-width / 2, 0, depth / 2),
    new Vector3(0, ridgeHeight, depth / 2),
    new Vector3(0, ridgeHeight, -depth / 2),

    // Right face
    new Vector3(width / 2, 0, -depth / 2),
    new Vector3(width / 2, 0, depth / 2),
  ];

  // Define faces using vertex indices
  const roofIndices = [
    // Left slope
    0, 1, 2,
    0, 2, 3,

    // Right slope
    3, 2, 5,
    3, 5, 4,

    // Front face
    1, 5, 2,

    // Back face
    0, 3, 4,
  ];

  // Create the custom mesh
  const roofMesh = new Mesh('roof-' + building.id, scene);
  const vertexData = new VertexData();

  vertexData.positions = roofVertices.flatMap(v => [v.x, v.y, v.z]);
  vertexData.indices = roofIndices;

  // Initialize the normals array before computing
  vertexData.normals = new Array(vertexData.positions.length).fill(0);

  // Calculate normal vectors for proper lighting
  VertexData.ComputeNormals(
    vertexData.positions,
    vertexData.indices, 
    vertexData.normals
  );

  vertexData.applyToMesh(roofMesh);

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

// Create control points for resizing the building
export const createControlPointsMesh = (scene: Scene, building: Building): Mesh[] => {
  const controlPoints: Mesh[] = [];
  const size = 0.3;
  const yPos = 0.1; // Just above ground level

  console.log("Creating control points for building:", building.id, building);

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

  // Create corner control points
  cornerPositions.forEach(pos => {
    const point = MeshBuilder.CreateBox(`control-${pos.id}-${building.id}`, {
      width: size,
      height: size,
      depth: size
    }, scene);

    const material = new StandardMaterial(`control-material-${pos.id}`, scene);
    material.diffuseColor = new Color3(1, 0, 0); // Red corners
    point.material = material;

    // Position in world space
    const rotatedX = Math.cos(building.rotation) * pos.x - Math.sin(building.rotation) * pos.z;
    const rotatedZ = Math.sin(building.rotation) * pos.x + Math.cos(building.rotation) * pos.z;

    const worldPos = new Vector3(
      building.position.x + rotatedX,
      yPos,
      building.position.z + rotatedZ
    );
    point.position = worldPos;

    console.log(`Control point ${pos.id} position:`, worldPos);

    // Store metadata
    point.metadata = {
      buildingId: building.id,
      controlType: pos.id,
    };

    // Make control points pickable
    point.isPickable = true;

    controlPoints.push(point);
  });

  // Create mid-point control points
  midPositions.forEach(pos => {
    const point = MeshBuilder.CreateBox(`control-${pos.id}-${building.id}`, {
      width: size,
      height: size,
      depth: size
    }, scene);

    const material = new StandardMaterial(`control-material-${pos.id}`, scene);
    material.diffuseColor = new Color3(0, 0, 1); // Blue midpoints
    point.material = material;

    // Position in world space
    const rotatedX = Math.cos(building.rotation) * pos.x - Math.sin(building.rotation) * pos.z;
    const rotatedZ = Math.sin(building.rotation) * pos.x + Math.cos(building.rotation) * pos.z;

    const worldPos = new Vector3(
      building.position.x + rotatedX,
      yPos,
      building.position.z + rotatedZ
    );
    point.position = worldPos;

    console.log(`Control point ${pos.id} position:`, worldPos);

    // Store metadata
    point.metadata = {
      buildingId: building.id,
      controlType: pos.id,
    };

    // Make control points pickable
    point.isPickable = true;

    controlPoints.push(point);
  });

  return controlPoints;
}; 