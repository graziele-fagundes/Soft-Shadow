async function loadOBJ(gl, program, file) {
  const objHref = file;
  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);
  const baseHref = new URL(objHref, window.location.href);
  const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
    const matHref = new URL(filename, baseHref).href;
    const response = await fetch(matHref);
    return await response.text();
  }));
  const materials = parseMTL(matTexts.join('\n'));

  const textures = {
    defaultWhite: twgl.createTexture(gl, { src: [255, 255, 255, 255] }),
  };

  // load texture for materials
  for (const material of Object.values(materials)) {
    Object.entries(material)
      .filter(([key]) => key.endsWith('Map'))
      .forEach(([key, filename]) => {
        let texture = textures[filename];
        if (!texture) {
          const textureHref = new URL(filename, baseHref).href;
          texture = twgl.createTexture(gl, { src: textureHref, flipY: true });
          textures[filename] = texture;
        }
        material[key] = texture;
      });
  }

  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: textures.defaultWhite,
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    shininess: 400,
    opacity: 1,
  };

  const parts = obj.geometries.map(({ material, data }) => {
    if (data.color) {
      if (data.position.length === data.color.length) {
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      data.color = { value: [1, 1, 1, 1] };
    }

    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, program, bufferInfo);
    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
      vao,
    };
  });

  function getExtents(positions) {
    const min = positions.slice(0, 3);
    const max = positions.slice(0, 3);
    for (let i = 3; i < positions.length; i += 3) {
      for (let j = 0; j < 3; ++j) {
        const v = positions[i + j];
        min[j] = Math.min(v, min[j]);
        max[j] = Math.max(v, max[j]);
      }
    }
    return { min, max };
  }

  function getGeometriesExtents(geometries) {
    return geometries.reduce(({ min, max }, { data }) => {
      const minMax = getExtents(data.position);
      return {
        min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
        max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
      };
    }, {
      min: Array(3).fill(Number.POSITIVE_INFINITY),
      max: Array(3).fill(Number.NEGATIVE_INFINITY),
    });
  }

  const extents = getGeometriesExtents(obj.geometries);
  const range = m4.subtractVectors(extents.max, extents.min);
  // amount to move the object so its center is at the origin
  const objOffset = m4.scaleVector(
    m4.addVectors(
      extents.min,
      m4.scaleVector(range, 0.5)),
    -1);

  return {
    parts,
    objOffset
  };
}

function loadGround(gl, program, size) {
  let height = 0.2;
  const boxVertices = {
    position: [
      // Front face
      -size, -height, size,
      size, -height, size,
      size, height, size,
      -size, height, size,

      // Back face
      -size, -height, -size,
      -size, height, -size,
      size, height, -size,
      size, -height, -size,

      // Top face
      -size, height, -size,
      -size, height, size,
      size, height, size,
      size, height, -size,

      // Bottom face
      -size, -height, -size,
      size, -height, -size,
      size, -height, size,
      -size, -height, size,

      // Right face
      size, -height, -size,
      size, height, -size,
      size, height, size,
      size, -height, size,

      // Left face
      -size, -height, -size,
      -size, -height, size,
      -size, height, size,
      -size, height, -size,
      ],

        normal: [
      // Front face
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,

      // Back face
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,

      // Top face
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,

      // Bottom face
      0, -1, 0,
      0, -1, 0,
      0, -1, 0,
      0, -1, 0,

      // Right face
      1, 0, 0,
      1, 0, 0,
      1, 0, 0,
      1, 0, 0,

      // Left face
      -1, 0, 0,
      -1, 0, 0,
      -1, 0, 0,
      -1, 0, 0,
    ],
    texcoord: [
      // Front face
      0, 0,
      10, 0,
      10, 1,
      0, 10,

      // Back face
      10, 0,
      10, 10,
      0, 10,
      0, 0,

      // Top face
      0, 10,
      0, 0,
      10, 0,
      10, 10,

      // Bottom face
      10, 10,
      0, 10,
      0, 0,
      10, 0,

      // Right face
      10, 0,
      10, 10,
      0, 10,
      0, 0,

      // Left face
      0, 0,
      10, 0,
      10, 10,
      0, 10,
    ],
    indices: [
      0, 1, 2, 0, 2, 3,    // Front face
      4, 5, 6, 4, 6, 7,    // Back face
      8, 9, 10, 8, 10, 11,  // Top face
      12, 13, 14, 12, 14, 15, // Bottom face
      16, 17, 18, 16, 18, 19, // Right face
      20, 21, size, 20, size, 23, // Left face
    ],
  };

  const boxBufferInfo = twgl.createBufferInfoFromArrays(gl, boxVertices);
  const boxVAO = twgl.createVAOFromBufferInfo(gl, program, boxBufferInfo);
  
  const boxUniforms = {
    diffuse: [1, 1, 1],
    diffuseMap: twgl.createTexture(gl, { src: 'grass.jpg' }),
    ambient: [1, 1, 1],
    specular: [1, 1, 1],
    shininess: 100,
    opacity: 1,
    u_world: m4.translation(0, -0.2, 0),
  };

  return {
    bufferInfo: boxBufferInfo,
    vao: boxVAO,
    uniforms: boxUniforms,
  };
}
