import {
  Scene,
  ArcRotateCamera,
  Vector3
} from '@babylonjs/core';

/**
 * Sets up a perspective camera for 3D view
 * @param scene The Babylon.js scene
 * @param canvas The canvas element
 * @returns The camera instance
 */
export const setup3DCamera = (scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera => {
  // Create a perspective camera for 3D view
  const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3.5, 30, new Vector3(0, 0, 0), scene);
  camera.minZ = 0.1;
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 60;
  camera.wheelPrecision = 50;
  camera.attachControl(canvas, true);

  return camera;
}; 