'use strict';

async function main() {
  let seed = getRandomIntBasedOnTime(0, 2000);
  Math.seedrandom(seed);
  let seedText = document.getElementById('seed');
  seedText.innerHTML = "Seed: " + seed;

  let nBuildings = document.getElementById('buildings').value;
  let nCars = document.getElementById('cars').value;
  let time = document.getElementById('time').value;
  let timeText = document.getElementById('timeText');

  document.getElementById('NewSeed').addEventListener('click', function() {
    seed = getRandomIntBasedOnTime(0, 2000);
    seedText.innerHTML = "Seed: " + seed;
    Math.seedrandom(seed);
    generateGrid();
  });

  document.getElementById('Generate').addEventListener('click', function() {
    nBuildings = document.getElementById('buildings').value;
    nCars = document.getElementById('cars').value;
    time = document.getElementById('time').value;
    Math.seedrandom(seed);
    generateGrid();
  });

  document.getElementById('time').addEventListener('input', function() {
    let t = document.getElementById('time').value;
    timeText.innerHTML = (parseInt(t) + 6) + ":00";
  });

  const canvas = document.querySelector('#canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    return;
  }

  const programOptions = {
    attribLocations: {
      'a_position': 0,
      'a_normal': 1,
      'a_texcoord': 2,
      'a_color': 3,
    },
  };

  const textureProgramInfo = twgl.createProgramInfo(gl, [vs, fs], programOptions);
  const colorProgramInfo = twgl.createProgramInfo(gl, [colorVS, colorFS], programOptions);
  twgl.setAttributePrefix("a_");

  const building = await loadOBJ(gl, textureProgramInfo, 'objects/building.obj');
  const building2 = await loadOBJ(gl, textureProgramInfo, 'objects/building2.obj');
  const building3 = await loadOBJ(gl, textureProgramInfo, 'objects/building3.obj');

  const road = await loadOBJ(gl, textureProgramInfo, 'objects/road.obj');
  const road_corner = await loadOBJ(gl, textureProgramInfo, 'objects/road_corner.obj');
  const road_t_split = await loadOBJ(gl, textureProgramInfo, 'objects/road_t_split.obj');

  const car1 = await loadOBJ(gl, textureProgramInfo, 'objects/car1.obj');
  const car2 = await loadOBJ(gl, textureProgramInfo, 'objects/car2.obj');

  const tree = await loadOBJ(gl, textureProgramInfo, 'objects/tree.obj');

  const ground = loadGround(gl, textureProgramInfo, 22);

  // Create a depth texture and framebuffer for shadow.
  const depthTexture = gl.createTexture();
  const depthTextureSize = 1024;
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,            // target
    0,                        // mip level
    gl.DEPTH_COMPONENT32F,    // internal format
    depthTextureSize,         // width
    depthTextureSize,         // height
    0,                        // border
    gl.DEPTH_COMPONENT,       // format
    gl.FLOAT,                 // type
    null);                    // data
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
  const depthFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,       // target
    gl.DEPTH_ATTACHMENT,  // attachment point
    gl.TEXTURE_2D,        // texture target
    depthTexture,         // texture
    0);                   // mip level

  let settings = getSettings();
  const fieldOfViewRadians = degToRad(60);

  const width = 22;  
  const height = 22; 
  let roads = [];
  let buildings = [];
  let cars = [];
  let trees = [];

  // Grid
  function generateGrid()
  {
    roads = Array.from({ length: width }, () => Array(height).fill(false));
    buildings = Array.from({ length: width }, () => Array(height).fill(0));
    cars = Array.from({ length: width }, () => Array(height).fill(0));
    trees = Array.from({ length: width }, () => Array(height).fill(false));
    
    // Roads Position
    function generateRoads(x, y, width, height, grid) {
      const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      grid[x][y] = true; 

      const shuffledDirections = directions.sort(() => Math.random() - 0.5);

      for (const [dx, dy] of shuffledDirections) {
        const nx = x + dx * 2;
        const ny = y + dy * 2;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !grid[nx][ny]) {
          grid[x + dx][y + dy] = true;
          generateRoads(nx, ny, width, height, grid);
        }
      }
    }
    
    // Buildings and Cars Position
    function generateBuildingsCars(width, height, buildings, cars) {
      let changeBuildings = nBuildings / 100;
      let changeCars = nCars / 100;

      for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {

          if (!roads[i][j]) // Se não tiver estrada, pode ter prédio
          {
            if (Math.random() < changeBuildings) {
              buildings[i][j] = getRandomInt(1, 3);
            }
          }
          else // Se tiver estrada, pode ter carro
          {
            if (Math.random() < changeCars) {
              if (Math.random() < 0.5) // 50% de chance de ter carro modelo 1 ou 2
                cars[i][j] = 1;
              else
                cars[i][j] = 2;
            }
          }
        }
      }
    }

    // Trees Position
    function generateTrees(width, height, trees) {
      for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
          if (!roads[i][j] && buildings[i][j] == 0) // Se não tiver estrada e prédio, pode ter árvore
          {
            if (Math.random() < 0.4) {
              trees[i][j] = true;
            }
          }
        }
      }
    }

    generateRoads(0, 0, width, height, roads);
    generateBuildingsCars(width, height, buildings, cars);
    generateTrees(width, height, trees);
  }

  generateGrid();

  function drawScene(projectionMatrix, cameraMatrix, textureMatrix, lightWorldMatrix, programInfo) {
    const viewMatrix = m4.inverse(cameraMatrix);
    gl.useProgram(programInfo.program);

    twgl.setUniforms(programInfo, {
      u_view: viewMatrix,
      u_projection: projectionMatrix,
      u_bias: settings.bias,
      u_textureMatrix: textureMatrix,
      u_projectedTexture: depthTexture,
      u_reverseLightDirection: lightWorldMatrix.slice(8, 11),
    });

    // ------ Draw the ground ------
    gl.bindVertexArray(ground.vao);
    twgl.setUniforms(programInfo, ground.uniforms);
    twgl.drawBufferInfo(gl, ground.bufferInfo);

    // ------ Draw the grid ------
    const segmentSize = 2; // Tamanho de cada segmento de estrada
    const offset = 21; // Offset para centralizar o grid

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (roads[x][y]) {
          let u_world = m4.identity();
          
          let tileType = determineTileType(x, y, roads);
          let rotation = determineRotation(tileType);
          let currentPart = determineRoadPart(tileType, road_corner, road, road_t_split);
          
          let carRotation = m4.identity();
          if (tileType == 'horizontal')
            carRotation = m4.yRotation(Math.PI / 2);

          u_world = m4.translate(u_world, (x * segmentSize) - offset, 0, (y * segmentSize) - offset);
          u_world = m4.multiply(u_world, rotation);

          for (const { bufferInfo, vao, material } of currentPart.parts) {
            gl.bindVertexArray(vao);
            twgl.setUniforms(programInfo, {
              u_world,
            }, material);

            twgl.drawBufferInfo(gl, bufferInfo);
          }

          if (cars[x][y] == 1 || cars[x][y] == 2) 
          {
            let car = cars[x][y] == 1 ? car1 : car2;
            let u_world = m4.identity();
            let carX = (x * segmentSize) - offset;
            let carY = 0.1;
            let carZ = (y * segmentSize) - offset;

            u_world = m4.translate(u_world, carX, carY, carZ);
            u_world = m4.multiply(u_world, carRotation);

            for (const { bufferInfo, vao, material } of car.parts) {
              gl.bindVertexArray(vao);
              twgl.setUniforms(programInfo, {
                u_world,
              }, material);

              twgl.drawBufferInfo(gl, bufferInfo);
            }
          }
        }
        else if (buildings[x][y] != 0) 
        {
          let buildingModel;
          let buildingType = buildings[x][y];

          let buildingY = -0.3;

          switch (buildingType) {
            case 1:
              buildingModel = building; 
              break;
            case 2:
              buildingModel = building2;
              break;
            case 3:
              buildingModel = building3;
              break;
            default:
              continue;
          }
          
          let u_world = m4.identity();

          let buildingX = (x * 2) - offset;
          let buildingZ = (y * 2) - offset;
          u_world = m4.translate(u_world, buildingX, buildingY, buildingZ);

          let rotation = getRotationForBuilding(x, y, roads);
          let rotationMatrix = m4.yRotation(rotation);
          u_world = m4.multiply(u_world, rotationMatrix);

          u_world = m4.scale(u_world, 1, 1.5, 1);

          for (const { bufferInfo, vao, material } of buildingModel.parts) {
            gl.bindVertexArray(vao);
            twgl.setUniforms(programInfo, {
              u_world,
            }, material);

            twgl.drawBufferInfo(gl, bufferInfo);
          }
        }
        else if (trees[x][y]) 
        {
          let u_world = m4.identity();
          let treeX = (x * 2) - offset;
          let treeY = 0;
          let treeZ = (y * 2) - offset;
          let scale = 0.22;

          u_world = m4.translate(u_world, treeX, treeY, treeZ);
          u_world = m4.scale(u_world, scale, scale, scale);

          for (const { bufferInfo, vao, material } of tree.parts) {
            gl.bindVertexArray(vao);
            twgl.setUniforms(programInfo, {
              u_world,
            }, material);

            twgl.drawBufferInfo(gl, bufferInfo);
          }
        }
      }
    }
  }

  // Draw the scene.
  function render(timestamp) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    let t = parseInt(time);
    let degrees = (t / 12) * 180 + 1;
    let radiustime = 40;

    let x = 0;
    let y = Math.sin(degrees * Math.PI / 180) * radiustime + 10;
    let z = Math.cos(degrees * Math.PI / 180) * radiustime;

    const lightWorldMatrix = m4.lookAt(
      [x, y, z],
      [0, 0, 0],
      [0, 1, 0]
    );

    const lightProjectionMatrix = m4.orthographic(
            -settings.projWidth / 2,   // left
             settings.projWidth / 2,   // right
            -settings.projHeight / 2,  // bottom
             settings.projHeight / 2,  // top
             0.5,                      // near
             100);                      // far

    // Draw from the light's point of view
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, depthTextureSize, depthTextureSize);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawScene(lightProjectionMatrix, lightWorldMatrix, m4.identity(), lightWorldMatrix, colorProgramInfo);

    // Draw from the camera's point of view
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    let color = getSkyColor(time)
    gl.clearColor(color[0] / 255, color[1] / 255, color[2] / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let textureMatrix = m4.identity();
    textureMatrix = m4.translate(textureMatrix, 0.5, 0.5, 0.5);
    textureMatrix = m4.scale(textureMatrix, 0.5, 0.5, 0.5);
    textureMatrix = m4.multiply(textureMatrix, lightProjectionMatrix);
    textureMatrix = m4.multiply(textureMatrix, m4.inverse(lightWorldMatrix));

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    // Camera
    const radius = 38;
    const cameraPosition = [
      Math.cos(timestamp / 2000) * radius,
     17,
     Math.sin(timestamp / 2000) * radius
    ];

    //const cameraPosition = [-40,20,50];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraMatrix = m4.lookAt(cameraPosition, target, up);

    drawScene(projectionMatrix, cameraMatrix, textureMatrix, lightWorldMatrix, textureProgramInfo);

    requestAnimationFrame(render);
  }

  
  requestAnimationFrame(render);
}

main();
