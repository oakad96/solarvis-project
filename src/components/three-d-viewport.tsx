"use client"
import { useEffect, useRef } from 'react';
import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Color4,
  ArcRotateCamera,
  Mesh,
  Texture,
  ShadowGenerator,
  CubeTexture,
  VertexData
} from '@babylonjs/core';
import { useRoofBuilder, Building } from '../store/RoofBuilderContext';

const ThreeDViewport = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const shadowGeneratorRef = useRef<ShadowGenerator | null>(null);

  const { buildings, selectedBuildingId } = useRoofBuilder();

  // Track building meshes
  const buildingMeshesRef = useRef<Map<string, Mesh>>(new Map());

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the BabylonJS engine
    const engine = new Engine(canvasRef.current, true);
    engineRef.current = engine;

    // Create a new scene
    const scene = new Scene(engine);
    sceneRef.current = scene;

    // Set the clear color (sky color)
    scene.clearColor = new Color4(0.75, 0.85, 0.9, 1);

    // Create a perspective camera for 3D view
    const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3.5, 30, new Vector3(0, 0, 0), scene);
    camera.minZ = 0.1;
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 60;
    camera.wheelPrecision = 50;
    camera.attachControl(canvasRef.current, true);

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
    shadowGeneratorRef.current = shadowGenerator;

    // Create environment for PBR materials
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

    // Start the render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle window resize
    const resizeHandler = () => {
      engine.resize();
    };
    window.addEventListener('resize', resizeHandler);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeHandler);
      engine.dispose();
    };
  }, []);

  // Update scene when buildings change
  useEffect(() => {
    if (!sceneRef.current || !shadowGeneratorRef.current) return;

    // Clear existing building meshes
    buildingMeshesRef.current.forEach((mesh) => {
      mesh.dispose();
    });
    buildingMeshesRef.current.clear();

    // Create meshes for each building
    buildings.forEach((building) => {
      // Create the building mesh with custom implementation
      const buildingMesh = createEnhancedBuildingMesh(sceneRef.current!, building);
      buildingMeshesRef.current.set(building.id, buildingMesh);

      // Add mesh to shadow generator
      buildingMesh.getChildMeshes().forEach(mesh => {
        shadowGeneratorRef.current!.addShadowCaster(mesh);
      });

      // Highlight selected building
      if (building.id === selectedBuildingId) {
        buildingMesh.getChildMeshes().forEach(mesh => {
          if (mesh.material && mesh.material instanceof PBRMaterial) {
            mesh.material.emissiveColor = new Color3(0.1, 0.1, 0.2);
            mesh.material.emissiveIntensity = 0.3;
          }
        });
      }
    });
  }, [buildings, selectedBuildingId]);

  // Create an enhanced building mesh with PBR materials
  const createEnhancedBuildingMesh = (scene: Scene, building: Building): Mesh => {
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

  return (
    <div style={{
      height: '100%',
      backgroundColor: '#f0f0f0',
      padding: '0.5rem',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
        3D View
      </div>
      <div style={{ flex: 1 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default ThreeDViewport;
