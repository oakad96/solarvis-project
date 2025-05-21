import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Texture,
  Mesh,
  CubeTexture
} from '@babylonjs/core';

/**
 * Sets up the environment including ground, skybox, and environmental textures
 * @param scene The Babylon.js scene
 * @returns The ground mesh
 */
export const setupEnvironment = (scene: Scene): Mesh => {
  // Set up environment texture for PBR materials
  const environmentTexture = CubeTexture.CreateFromPrefilteredData(
    "https://assets.babylonjs.com/environments/environmentSpecular.env",
    scene
  );
  scene.environmentTexture = environmentTexture;
  scene.environmentIntensity = 0.4;

  // Create ground with PBR material
  const ground = MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, scene);
  ground.receiveShadows = true;

  // Create PBR material for ground
  const groundMaterial = new PBRMaterial("groundMaterial", scene);
  groundMaterial.albedoColor = new Color3(0.2, 0.25, 0.2);
  groundMaterial.metallic = 0.1;
  groundMaterial.roughness = 0.8;

  // Add grid pattern
  const gridTexture = new Texture("https://assets.babylonjs.com/textures/floor_diffuse.png", scene);
  gridTexture.uScale = 20;
  gridTexture.vScale = 20;
  groundMaterial.albedoTexture = gridTexture;

  // Add bump for realism
  const bumpTexture = new Texture("https://assets.babylonjs.com/textures/floor_bump.png", scene);
  bumpTexture.uScale = 20;
  bumpTexture.vScale = 20;
  groundMaterial.bumpTexture = bumpTexture;
  groundMaterial.bumpTexture.level = 0.3;

  ground.material = groundMaterial;

  return ground;
}; 