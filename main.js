'use strict';

async function main() {
  Math.seedrandom(666);
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

  // Arvore
  const tree1File = 'Objects/PineTree.obj';
  const tree1 = await loadOBJ(gl, textureProgramInfo, tree1File);

  const tree2File = 'Objects/Tree.obj';
  const tree2 = await loadOBJ(gl, textureProgramInfo, tree2File);

  const rock = await loadOBJ(gl, textureProgramInfo, 'Objects/Rock.obj');

  const building = await loadOBJ(gl, textureProgramInfo, 'Objects/building.obj');
  const building2 = await loadOBJ(gl, textureProgramInfo, 'Objects/building2.obj');
  const building3 = await loadOBJ(gl, textureProgramInfo, 'Objects/building3.obj');

  const road = await loadOBJ(gl, textureProgramInfo, 'Objects/road.obj');
  const road_corner = await loadOBJ(gl, textureProgramInfo, 'Objects/road_corner.obj');
  const road_t_split = await loadOBJ(gl, textureProgramInfo, 'Objects/road_t_split.obj');
  const car1 = await loadOBJ(gl, textureProgramInfo, 'Objects/car1.obj');
 
  // Chao
  const planeBufferInfo = twgl.primitives.createPlaneBufferInfo(
    gl,
    50,  // width
    50,  // height
    1,   // subdivisions across
    1,   // subdivisions down
  );
  const planeVAO = twgl.createVAOFromBufferInfo(gl, textureProgramInfo, planeBufferInfo);

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

  let settings = ui();
  const fieldOfViewRadians = degToRad(60);
  let rotate = false
  document.querySelector("#rotateCamera").addEventListener("change", function() {
    performance.now();
    rotate = !rotate;
  });

  const width = 20;  // largura do grid
  const height = 20; // altura do grid
  const roads = Array.from({ length: width }, () => Array(height).fill(false));
  const buildings = Array.from({ length: width }, () => Array(height).fill(0));
  const cars = Array.from({ length: width }, () => Array(height).fill(0));
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    function generateRoads(x, y) {
      roads[x][y] = true; // Marca a célula como visitada

      // Embaralha as direções para explorar aleatoriamente
      const shuffledDirections = directions.sort(() => Math.random() - 0.5);

      for (const [dx, dy] of shuffledDirections) {
        const nx = x + dx * 2;
        const ny = y + dy * 2;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !roads[nx][ny]) {
          roads[x + dx][y + dy] = true; // Cria o caminho
          generateRoads(nx, ny);
        }
      }
    }
    function getRandomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

  generateRoads(0, 0);
  
  // Buildings
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (!roads[x][y]) {
        buildings[x][y] = getRandomInt(0, 3);
      }
      else
      {
        cars[x][y] = getRandomInt(0, 1);
      }
    }
  }

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

    const segmentSize = 2; // Tamanho de cada segmento de estrada
    const offset = 18
    
    // Função para verificar se um segmento está presente em uma direção
    function hasSegment(x, y, dx, dy) {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < width && ny < height && roads[nx][ny];
    }
    
    // Determina o tipo de tile com base nas conexões adjacentes
    function determineTileType(x, y) {
      const left = hasSegment(x, y, -1, 0);
      const right = hasSegment(x, y, 1, 0);
      const top = hasSegment(x, y, 0, -1);
      const bottom = hasSegment(x, y, 0, 1);
    
      // Detecta o padrão Tsplit (três ruas se encontrando)
      if ((left && right && top) || (left && right && bottom) || (left && top && bottom) || (right && top && bottom)) {
        if (!left && top && right && bottom) {
          return 'tsplitLeft'; // T em cima
        }
        if (!right && top && left && bottom) {
          return 'tsplitRight'; // T em baixo
        }
        if (!top && left && right && bottom) {
          return 'tsplitTop'; // T à esquerda
        }
        if (!bottom && left && right && top) {
          return 'tsplitBottom'; // T à direita
        }
      }
      if (left && right && top && bottom) {
        return 'intersection'; // Todos os lados conectados
      }
      if (left && top) {
        return 'cornerTopLeft'; // Canto superior esquerdo
      }
      if (right && top) {
        return 'cornerTopRight'; // Canto superior direito
      }
      if (right && bottom) {
        return 'cornerBottomRight'; // Canto inferior direito
      }
      if (left && bottom) {
        return 'cornerBottomLeft'; // Canto inferior esquerdo
      }
      if (left || right) {
        return 'horizontal'; // Segmento horizontal
      }
      if (top || bottom) {
        return 'vertical'; // Segmento vertical
      }
      return 'empty'; // Sem segmento
    }

    function getRotationForBuilding(x, y, roads) {
      let rotation = 0; // Sem rotação por padrão
    
      // Verifica ruas ao redor
      let hasLeft = x > 0 && roads[x - 1][y];
      let hasRight = x < roads.length - 1 && roads[x + 1][y];
      let hasTop = y > 0 && roads[x][y - 1];
      let hasBottom = y < roads[0].length - 1 && roads[x][y + 1];
    
      if (hasTop) {
        rotation = 180 * Math.PI / 180;
      }
      if (hasBottom) {
        rotation = 0;
      }
      if (hasRight) {
        rotation = 90 * Math.PI / 180;
      }
      if (hasLeft) {
        rotation = 270 * Math.PI / 180;
      }
      return rotation;
    }
    
    // Renderiza o grid
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (roads[x][y]) {
          let u_world = m4.identity();
          let tileType = determineTileType(x, y);
          let rotation = m4.identity();
          let carRotation = m4.identity();
          
          // Seleciona o modelo com base no tipo de tile
          let currentPart;
          switch (tileType) {
            case 'cornerTopLeft':
              currentPart = road_corner.parts;
              rotation = m4.yRotation(Math.PI);
              break;
            case 'cornerTopRight':
              currentPart = road_corner.parts;
              rotation = m4.yRotation(Math.PI / 2);
              break;
            case 'cornerBottomRight':
              currentPart = road_corner.parts;
              break;
            case 'cornerBottomLeft':
              currentPart = road_corner.parts;
              rotation = m4.yRotation(3 * Math.PI / 2);
              break;
            case 'horizontal':
              currentPart = road.parts;
              rotation = m4.yRotation(Math.PI / 2);
              carRotation = m4.yRotation(Math.PI / 2);
              break;
            case 'vertical':
              currentPart = road.parts;
              break;
            case 'intersection':
              currentPart = road.parts;
              break;
              case 'tsplitLeft':
                currentPart = road_t_split.parts;
                rotation = m4.yRotation(0); // T em cima
                break;
              case 'tsplitRight':
                currentPart = road_t_split.parts;
                rotation = m4.yRotation(Math.PI); // T em baixo
                break;
              case 'tsplitTop':
                currentPart = road_t_split.parts;
                rotation = m4.yRotation(-Math.PI / 2); // T à esquerda
                break;
              case 'tsplitBottom':
                currentPart = road_t_split.parts;
                rotation = m4.yRotation(Math.PI / 2); // T à direita
                break;
            default:
              continue; // Pular se não houver modelo
          }
    

          // Translação para a posição do segmento
          u_world = m4.translate(u_world, (x * segmentSize) - offset, 0, (y * segmentSize) - offset);
          
          // Aplica a rotação
          u_world = m4.multiply(u_world, rotation);
          for (const { bufferInfo, vao, material } of currentPart) {
            gl.bindVertexArray(vao);
            twgl.setUniforms(programInfo, {
              u_world,
            }, material);
            
            twgl.drawBufferInfo(gl, bufferInfo);
          }

          if (cars[x][y] == 1)
          {
            let u_world = m4.identity();
            let carX = (x * segmentSize) - offset;
            let carY = 0.1;
            let carZ = (y * segmentSize) - offset;

            u_world = m4.translate(u_world, carX, carY, carZ);
            u_world = m4.multiply(u_world, carRotation);

            for (const { bufferInfo, vao, material } of car1.parts) {
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
          let u_world = m4.identity();
      
          // Calcula a posição do prédio
          let buildingX = (x * segmentSize) - offset;
          let buildingY = (y * segmentSize) - offset;
          u_world = m4.translate(u_world, buildingX, 0, buildingY);
        
          // Determina a rotação do prédio
          let rotation = getRotationForBuilding(x, y, roads);
          let rotationMatrix = m4.yRotation(rotation);
          u_world = m4.multiply(u_world, rotationMatrix);

          // Seleciona o modelo do prédio
          let buildingModel;
          let buildingType = buildings[x][y];
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
    
    
    // ------ Draw the plane --------
    const planeUniforms = {
      diffuse: [1, 1, 1],
      diffuseMap: twgl.createTexture(gl, { src: [130, 162, 99, 255] }),
      ambient: [1, 1, 1],
      specular: [1, 1, 1],
      shininess: 100,
      opacity: 1,
      u_world: m4.translation(0, 0, 0),
    };
    gl.bindVertexArray(planeVAO);
    twgl.setUniforms(programInfo, planeUniforms);
    twgl.drawBufferInfo(gl, planeBufferInfo);
  }

  // Draw the scene.
  function render(timestamp) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    const RADIUS = 10;
    const SPEED = 0.0003; 

    function updateLightPosition(timestamp) {
        // Calcular o ângulo de rotação com base no timestamp
        const angle = timestamp * SPEED;

        // Calcular as novas coordenadas da luz
        const posX = RADIUS * Math.cos(angle);
        const posY = settings.posY; // Altura fixa ou ajustar conforme necessário
        const posZ = settings.posZ; // Altura fixa ou ajustar conforme necessário

        // Atualizar a matriz da luz
        const lightWorldMatrix = m4.lookAt(
            [settings.posX, settings.posY, settings.posZ],               // posição
            [0, 0, 0],                       // ponto alvo, ajustado para o centro do mundo
            [0, 1, 0]                        // vetor "up", ajustado para o eixo Y
        );

        // Retornar a matriz da luz se necessário
        return lightWorldMatrix;
    }

    // first draw from the POV of the light
    const lightWorldMatrix = updateLightPosition(timestamp);
    const lightProjectionMatrix = m4.orthographic(
      -settings.projWidth / 2,   // left
      settings.projWidth / 2,   // right
      -settings.projHeight / 2,  // bottom
      settings.projHeight / 2,  // top
      0.5,                      // near
      70);                      // far

    // draw to the depth texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, depthTextureSize, depthTextureSize);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    drawScene(lightProjectionMatrix, lightWorldMatrix, m4.identity(), lightWorldMatrix, colorProgramInfo);

    // now draw scene to the canvas projecting the depth texture into the scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(250/255, 214/255, 165/255, 1); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let textureMatrix = m4.identity();
    textureMatrix = m4.translate(textureMatrix, 0.5, 0.5, 0.5);
    textureMatrix = m4.scale(textureMatrix, 0.5, 0.5, 0.5);
    textureMatrix = m4.multiply(textureMatrix, lightProjectionMatrix);
    textureMatrix = m4.multiply(textureMatrix, m4.inverse(lightWorldMatrix));

    // Compute the projection matrix
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    // Compute the camera's matrix using look at.
    const radius = 60;
    
   
    let cameraPosition = [0,10,50]
    if (rotate)
    {
      cameraPosition = [
      Math.cos(timestamp / 2000) * radius,
      15,
      Math.sin(timestamp / 2000) * radius
    ];
  }
    else
    {
     cameraPosition = [
        0,15,60
      ];
    }
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraMatrix = m4.lookAt(cameraPosition, target, up);

    drawScene(projectionMatrix, cameraMatrix, textureMatrix, lightWorldMatrix, textureProgramInfo);

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

  function ui() {
    const settings = {
      posX: 0,
      posY: 20,
      posZ: 30,
      targetX: 7,
      targetY: 0,
      targetZ: 3.5,
      projWidth: 50,
      projHeight: 50,
      fieldOfView: 120,
      bias: -0.01,
    };
    return settings;
  }

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  requestAnimationFrame(render);
}

main();
