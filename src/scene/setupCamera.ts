import {
  ArcRotateCamera,
  Scene,
  Vector3
} from '@babylonjs/core';

/**
 * Sets up a top-down orthographic camera for 2D view
 */
export const setupCamera = (scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera => {
  // Create a top-down orthographic camera for 2D view
  const camera = new ArcRotateCamera('camera', -Math.PI / 2, 0, 20, new Vector3(0, 0, 0), scene);
  camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.orthoTop = 10;
  camera.orthoBottom = -10;
  camera.orthoLeft = -10;
  camera.orthoRight = 10;

  // Lock camera rotation
  camera.lowerAlphaLimit = camera.upperAlphaLimit = -Math.PI / 2;
  camera.lowerBetaLimit = camera.upperBetaLimit = 0;

  // Disable camera controls for pure 2D interaction
  camera.attachControl(canvas, false);

  return camera;
}; 