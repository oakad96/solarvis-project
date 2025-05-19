import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Texture,
  Mesh
} from '@babylonjs/core';

/**
 * Sets up the ground plane with a grid texture
 */
export const setupGround = (scene: Scene): Mesh => {
  // Create the ground with a textured grid
  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
  const groundMaterial = new StandardMaterial('groundMaterial', scene);
  groundMaterial.diffuseColor = new Color3(0.2, 0.4, 0.2);

  // Use a simpler grid pattern approach instead of base64 encoding
  const gridSize = 1;
  const gridTexture = new Texture("https://assets.babylonjs.com/textures/floor.png", scene);
  gridTexture.uScale = 20 / gridSize;
  gridTexture.vScale = 20 / gridSize;
  groundMaterial.diffuseTexture = gridTexture;

  ground.material = groundMaterial;
  return ground;
};