'use strict';

async function main() {
  let seed = getRandomIntBasedOnTime(0, 1000);
  Math.seedrandom(seed);
  let seedText = document.getElementById('seed');
  seedText.innerHTML = "Seed: " + seed;

  let nBuildings = document.getElementById('buildings').value;
  let nCars = document.getElementById('cars').value;
  let time = document.getElementById('time').value;
  let timeText = document.getElementById('timeText');

  document.getElementById('NewSeed').addEventListener('click', function() {
    seed = getRandomIntBasedOnTime(0, 1000);
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

  const building = await loadOBJ(gl, textureProgramInfo, 'Objects/building.obj');
  const building2 = await loadOBJ(gl, textureProgramInfo, 'Objects/building2.obj');
  const building3 = await loadOBJ(gl, textureProgramInfo, 'Objects/building3.obj');

  const road = await loadOBJ(gl, textureProgramInfo, 'Objects/road.obj');
  const road_corner = await loadOBJ(gl, textureProgramInfo, 'Objects/road_corner.obj');
  const road_t_split = await loadOBJ(gl, textureProgramInfo, 'Objects/road_t_split.obj');

  const car1 = await loadOBJ(gl, textureProgramInfo, 'Objects/car1.obj');
  const car2 = await loadOBJ(gl, textureProgramInfo, 'Objects/car2.obj');

  const ground = await loadGround(gl, textureProgramInfo, 50);

  const cubeLinesBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    position: [
      -1, -1, -1,
      1, -1, -1,
      -1, 1, -1,
      1, 1, -1,
      -1, -1, 1,
      1, -1, 1,
      -1, 1, 1,
      1, 1, 1,
    ],
    indices: [
      0, 1,
      1, 3,
      3, 2,
      2, 0,

      4, 5,
      5, 7,
      7, 6,
      6, 4,

      0, 4,
      1, 5,
      3, 7,
      2, 6,
    ],
  });
  const cubeLinesVAO = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, cubeLinesBufferInfo);


  // Create a depth texture and framebuffer for shadow.
  const depthTexture = gl.createTexture();
  const depthTextureSize = 1024;
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,      // target
    0,                  // mip level
    gl.DEPTH_COMPONENT32F, // internal format
    depthTextureSize,   // width
    depthTextureSize,   // height
    0,                  // border
    gl.DEPTH_COMPONENT, // format
    gl.FLOAT,           // type
    null);              // data
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

  const width = 21;  
  const height = 21; 
  let roads = [];
  let buildings = [];
  let cars = [];

  // Grid
  function generateGrid()
  {
    roads = Array.from({ length: width }, () => Array(height).fill(false));
    buildings = Array.from({ length: width }, () => Array(height).fill(0));
    cars = Array.from({ length: width }, () => Array(height).fill(0));

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
    function generateBuildingsCars(x, y, width, height, buildings, cars) {
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

    generateRoads(0, 0, width, height, roads);
    generateBuildingsCars(0, 0, width, height, buildings, cars);
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

    const segmentSize = 2; // Tamanho de cada segmento de estrada
    const offset = 20; // Offset para centralizar o grid

    // ------ Draw the grid ------
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
        else 
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
      }
    }
  }

  // Draw the scene.
  function render(timestamp) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    let t = parseInt(time);
    let degrees = (t / 12) * 180;
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
      settings.projWidth / 2,    // right
      -settings.projHeight / 2,  // bottom
      settings.projHeight / 2,   // top
      0.5,                       // near
      70);                       // far

    // Draw from the light's point of view
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, depthTextureSize, depthTextureSize);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawScene(lightProjectionMatrix, lightWorldMatrix, m4.identity(), lightWorldMatrix, colorProgramInfo);

    // Draw from the camera's point of view
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(250 / 255, 214 / 255, 165 / 255, 1);
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

    //const cameraPosition = [0,20,50];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraMatrix = m4.lookAt(cameraPosition, target, up);

    drawScene(projectionMatrix, cameraMatrix, textureMatrix, lightWorldMatrix, textureProgramInfo);


    // Draw the light frustum
    drawFrustum();
    function drawFrustum() {
      const viewMatrix = m4.inverse(cameraMatrix);
      gl.useProgram(colorProgramInfo.program);
      gl.bindVertexArray(cubeLinesVAO);
      const mat = m4.multiply(lightWorldMatrix, m4.inverse(lightProjectionMatrix));
      twgl.setUniforms(colorProgramInfo, {
        u_color: [1, 1, 1, 1],
        u_view: viewMatrix,
        u_projection: projectionMatrix,
        u_world: mat,
      });
      twgl.drawBufferInfo(gl, cubeLinesBufferInfo, gl.LINES);
    }

    requestAnimationFrame(render);
  }

  
  requestAnimationFrame(render);
}

main();
