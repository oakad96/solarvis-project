import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Mesh
} from '@babylonjs/core';

/**
 * Sets up the ground plane with the main-view-map texture
 */
export const setupGround = (scene: Scene): Mesh => {
  // Create the ground with a textured grid
  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
  const groundMaterial = new StandardMaterial('groundMaterial', scene);

  // Load the main-view-map texture from public folder
  const mapTexture = new Texture("/images/main-view-map.png", scene);
  groundMaterial.diffuseTexture = mapTexture;

  // Make the material emissive to be visible without lighting
  groundMaterial.emissiveTexture = mapTexture;

  // Disable tiling to show the full image once
  if (mapTexture) {
    mapTexture.uScale = 1;
    mapTexture.vScale = 1;
  }

  ground.material = groundMaterial;
  return ground;
};