import {
  Scene,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  ShadowGenerator
} from '@babylonjs/core';

/**
 * Sets up the lights in the scene
 * @param scene The Babylon.js scene
 * @returns The shadow generator for use with meshes
 */
export const setupLights = (scene: Scene): ShadowGenerator => {
  // Add ambient light
  const hemisphericLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
  hemisphericLight.intensity = 0.4;
  hemisphericLight.diffuse = new Color3(1, 1, 1);
  hemisphericLight.groundColor = new Color3(0.3, 0.3, 0.3);

  // Add directional light for shadows
  const directionalLight = new DirectionalLight('dirLight', new Vector3(-2, -4, -1), scene);
  directionalLight.intensity = 0.7;
  directionalLight.diffuse = new Color3(1, 0.9, 0.8);
  directionalLight.position = new Vector3(10, 15, 10);

  // Create shadow generator
  const shadowGenerator = new ShadowGenerator(1024, directionalLight);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 64;
  shadowGenerator.depthScale = 50;

  return shadowGenerator;
}; 