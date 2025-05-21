import {
  Scene,
  Vector3,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Mesh,
  Texture,
  VertexData
} from '@babylonjs/core';
import { Building } from '../store/RoofBuilderContext';

/**
 * Creates an enhanced building mesh with PBR materials
 * @param scene The Babylon.js scene
 * @param building The building data
 * @returns The parent mesh containing the building parts
 */
export const createEnhancedBuildingMesh = (scene: Scene, building: Building): Mesh => {
  // Create a parent mesh to hold all parts
  const parentMesh = new Mesh(`building-${building.id}`, scene);
  parentMesh.position = new Vector3(building.position.x, 0, building.position.z);
  parentMesh.rotation.y = building.rotation;

  // Create walls
  const walls = MeshBuilder.CreateBox('walls', {
    width: building.width,
    height: building.type === 'dualPitch' ? building.height - (building.ridgeHeight || 1) : building.height,
    depth: building.length,
    updatable: true
  }, scene);

  // Position the walls
  walls.position.y = building.type === 'dualPitch'
    ? (building.height - (building.ridgeHeight || 1)) / 2
    : building.height / 2;
  walls.parent = parentMesh;

  // Create wall PBR material
  const wallMaterial = new PBRMaterial(`wall-material-${building.id}`, scene);
  wallMaterial.albedoColor = new Color3(0.9, 0.9, 0.9);
  wallMaterial.metallic = 0.1;
  wallMaterial.roughness = 0.6;

  // Add subtle texture to walls
  const brickTexture = new Texture("https://assets.babylonjs.com/textures/bricks.jpg", scene);
  brickTexture.uScale = 2;
  brickTexture.vScale = 2;
  wallMaterial.bumpTexture = brickTexture;
  wallMaterial.bumpTexture.level = 0.2;

  // Apply material to walls
  walls.material = wallMaterial;

  // Create roof based on type
  if (building.type === 'flat') {
    // Create flat roof
    const roof = MeshBuilder.CreateBox('roof', {
      width: building.width + 0.2,  // Slight overhang
      height: 0.2,
      depth: building.length + 0.2  // Slight overhang
    }, scene);

    roof.position.y = building.height + 0.1;
    roof.parent = parentMesh;

    // Create roof PBR material 
    const roofMaterial = new PBRMaterial(`roof-material-${building.id}`, scene);
    roofMaterial.albedoColor = new Color3(0.15, 0.15, 0.15);
    roofMaterial.metallic = 0.2;
    roofMaterial.roughness = 0.9;
    roof.material = roofMaterial;
  } else if (building.type === 'dualPitch') {
    const width = building.width;
    const depth = building.length;
    const ridgeHeight = building.ridgeHeight || 1;
    const baseHeight = building.height - ridgeHeight;
    const overhang = 0.2; // Roof overhang

    // Create a parent container for the entire roof
    const roofContainer = new Mesh("roof-container", scene);
    roofContainer.position.y = baseHeight;
    roofContainer.parent = parentMesh;

    // Create roof material
    const roofMaterial = new PBRMaterial(`roof-material-${building.id}`, scene);
    roofMaterial.albedoColor = new Color3(0.55, 0.25, 0.2);
    roofMaterial.metallic = 0.05;
    roofMaterial.roughness = 0.85;
    // Disable backface culling to ensure all faces are visible from any angle
    roofMaterial.backFaceCulling = false;

    // Create a single comprehensive roof mesh with custom vertices
    const roofMesh = new Mesh('roof', scene);
    roofMesh.parent = roofContainer;

    // Create vertices for the entire roof including overhangs
    const positions = [
      // Left face
      -width / 2 - overhang, 0, -depth / 2 - overhang,  // 0: bottom left back
      -width / 2 - overhang, 0, depth / 2 + overhang,   // 1: bottom left front
      0, ridgeHeight, depth / 2 + overhang,           // 2: top ridge front
      0, ridgeHeight, -depth / 2 - overhang,          // 3: top ridge back

      // Right face
      width / 2 + overhang, 0, -depth / 2 - overhang,   // 4: bottom right back
      width / 2 + overhang, 0, depth / 2 + overhang     // 5: bottom right front
    ];

    // Define faces using vertex indices
    const indices = [
      // Left slope
      0, 1, 2,
      0, 2, 3,

      // Right slope
      3, 2, 5,
      3, 5, 4,

      // Front triangular face
      1, 5, 2,

      // Back triangular face
      0, 3, 4,

      // Add the reverse faces to ensure visibility from all angles
      // Left slope reverse
      3, 2, 1,
      3, 1, 0,

      // Right slope reverse
      4, 5, 2,
      4, 2, 3,

      // Front triangular face reverse
      2, 5, 1,

      // Back triangular face reverse
      4, 3, 0
    ];

    // Add UV coordinates for better texture mapping
    const uvs = [
      0, 0,
      0, 1,
      0.5, 1,
      0.5, 0,
      1, 0,
      1, 1
    ];

    // Create vertex data
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.uvs = uvs;

    // Initialize normals array with zeros before computing normals
    vertexData.normals = new Array(positions.length).fill(0);

    // Calculate normals for proper lighting
    VertexData.ComputeNormals(positions, indices, vertexData.normals);
    vertexData.applyToMesh(roofMesh);

    // Apply roof material
    roofMesh.material = roofMaterial;

    // Add roof texture with proper tiling
    const roofTexture = new Texture("https://assets.babylonjs.com/textures/roof.jpg", scene);
    roofTexture.uScale = 2;
    roofTexture.vScale = 2;
    roofMaterial.albedoTexture = roofTexture;

    // Add bump texture for more detail
    const bumpTexture = new Texture("https://assets.babylonjs.com/textures/floor_bump.png", scene);
    bumpTexture.uScale = 4;
    bumpTexture.vScale = 4;
    roofMaterial.bumpTexture = bumpTexture;
    roofMaterial.bumpTexture.level = 0.4;

    // Enable shadows
    roofMesh.receiveShadows = true;
  }

  return parentMesh;
}; 