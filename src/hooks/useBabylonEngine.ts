"use client";

import { useEffect, useState, useRef, RefObject } from 'react';
import {
  Engine,
  Scene,
  Color4
} from '@babylonjs/core';

interface BabylonEngine {
  engine: Engine | null;
  scene: Scene | null;
  canvas: HTMLCanvasElement | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * Hook to initialize and manage a Babylon.js engine and scene
 * @returns The engine, scene, canvas, and canvasRef
 */
export const useBabylonEngine = (): BabylonEngine => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);

  useEffect(() => {
    // Skip setup during SSR
    if (typeof window === 'undefined' || !canvasRef.current) return;

    // Initialize the BabylonJS engine
    const engine = new Engine(canvasRef.current, true);
    setEngine(engine);

    // Create a new scene
    const scene = new Scene(engine);
    setScene(scene);

    // Set the clear color (sky color)
    scene.clearColor = new Color4(0.75, 0.85, 0.9, 1);

    // Start the render loop
    engine.runRenderLoop(() => {
      // Only render if scene has at least one active camera
      if (scene.activeCamera) {
        scene.render();
      }
    });

    // Handle window resize
    const resizeHandler = () => {
      engine.resize();
    };
    window.addEventListener('resize', resizeHandler);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeHandler);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return {
    engine,
    scene,
    canvas: canvasRef.current,
    canvasRef
  };
}; 