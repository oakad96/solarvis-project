"use client";

import { useState, useEffect } from 'react';
import { Scene, ShadowGenerator } from '@babylonjs/core';
import { setupLights } from '../scene/setupLights';

/**
 * Hook to create and manage a shadow generator
 * @param scene The Babylon.js scene
 * @returns The shadow generator
 */
export const useShadowGenerator = (scene: Scene | null): ShadowGenerator | null => {
  const [shadowGenerator, setShadowGenerator] = useState<ShadowGenerator | null>(null);

  useEffect(() => {
    if (!scene) return;

    // Create lights and shadow generator
    const generator = setupLights(scene);
    setShadowGenerator(generator);

    // No cleanup needed as shadow generator is disposed with the scene
  }, [scene]);

  return shadowGenerator;
};