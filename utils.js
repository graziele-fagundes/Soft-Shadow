function hasSegment(x, y, dx, dy, roads) {
    const nx = x + dx;
    const ny = y + dy;
    const width = roads.length;
    const height = roads[0].length;
    return nx >= 0 && ny >= 0 && nx < width && ny < height && roads[nx][ny];
}

function determineTileType(x, y, roads) {
    const left = hasSegment(x, y, -1, 0, roads);
    const right = hasSegment(x, y, 1, 0, roads);
    const top = hasSegment(x, y, 0, -1, roads);
    const bottom = hasSegment(x, y, 0, 1, roads);

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
        return rotation;
    }
    if (hasBottom) {
        rotation = 0;
        return rotation;
    }
    if (hasRight) {
        rotation = 90 * Math.PI / 180;
        return rotation;
    }
    if (hasLeft) {
        rotation = 270 * Math.PI / 180;
        return rotation;
    }
    
    // Verificar diagonais
    let hasTopLeft = x > 0 && y > 0 && roads[x - 1][y - 1];
    let hasTopRight = x < roads.length - 1 && y > 0 && roads[x + 1][y - 1];
    let hasBottomRight = x < roads.length - 1 && y < roads[0].length - 1 && roads[x + 1][y + 1];
    let hasBottomLeft = x > 0 && y < roads[0].length - 1 && roads[x - 1][y + 1];

    if (hasTopLeft) {
        rotation = 225 * Math.PI / 180;
        return rotation;
    }
    if (hasTopRight) {
        rotation = 135 * Math.PI / 180;
        return rotation;
    }
    if (hasBottomRight) {
        rotation = 45 * Math.PI / 180;
        return rotation;
    }
    if (hasBottomLeft) {
        rotation = 315 * Math.PI / 180;
        return rotation;
    }
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function degToRad(d) {
    return d * Math.PI / 180;
}

function getRandomIntBasedOnTime(min, max) {
    const timeSeed = Date.now();
    const random = (timeSeed * Math.random()) % (max - min + 1);

    return Math.floor(min + random);
}

function getSettings() {
    return {
        posX: 0,
        posY: 5, 
        posZ: 30,
        targetX: 7,
        targetY: 0,
        targetZ: 3.5,
        projWidth: 60,
        projHeight: 50,
        fieldOfView: 120,
        bias: -0.01,
    };
}

function determineRotation(tileType)
{
    rotation = m4.identity();

    switch (tileType) {
        case 'cornerTopLeft':
          rotation = m4.yRotation(Math.PI);
          break;
        case 'cornerTopRight':
          rotation = m4.yRotation(Math.PI / 2);
          break;
        case 'cornerBottomRight':
          break;
        case 'cornerBottomLeft':
          rotation = m4.yRotation(3 * Math.PI / 2);
          break;
        case 'horizontal':
          rotation = m4.yRotation(Math.PI / 2);
          break;
        case 'vertical':
          break;
        case 'intersection':
          break;
        case 'tsplitLeft':
          rotation = m4.yRotation(0);
          break;
        case 'tsplitRight':
          rotation = m4.yRotation(Math.PI); 
          break;
        case 'tsplitTop':
          rotation = m4.yRotation(-Math.PI / 2);
          break;
        case 'tsplitBottom':
          rotation = m4.yRotation(Math.PI / 2); 
          break;
        default:
           break;
      }

    return rotation;
}

function determineRoadPart(tileType, road_corner, road, road_t_split)
{
    switch (tileType) {
        case 'cornerTopLeft':
          return road_corner;
        case 'cornerTopRight':
          return road_corner;
        case 'cornerBottomRight':
          return road_corner;
        case 'cornerBottomLeft':
          return road_corner;
        case 'horizontal':
          return road;
        case 'vertical':
          return road;
        case 'intersection':
          return road;
        case 'tsplitLeft':
          return road_t_split;
        case 'tsplitRight':
          return road_t_split;
        case 'tsplitTop':
          return road_t_split;
        case 'tsplitBottom':
          return road_t_split;
        default:
          return road;
      }
}

