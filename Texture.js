
"use strict";

class TextureLoader {

  constructor(entity, config) {
    this.entity = entity;
    this.gl = config.gl;
    this.enableLight = config.enableLight;
    this.activeTextureIndex = config.activeTextureIndex;
    this.textureImageSrc = config.textureImageSrc ? config.textureImageSrc : './image/sky.jpg'; // 纹理图片路径，默认纹理是天空(sky.jpg)
  }

  init() {
    this.initShaders();

    this.initTextures();

    this.initBuffers();

    this.initPerspective();

    return this;
  }

  initShaders() {
    // Vertex shader program
    let VSHADER_SOURCE = `
            attribute vec4 a_Position; varying vec3 v_Position;
            attribute vec2 a_TexCoord; varying vec2 v_TexCoord;
            attribute vec4 a_Normal; varying vec3 v_Normal;
            uniform mat4 u_MvpMatrix;
            uniform mat4 u_ModelMatrix;
            uniform mat4 u_NormalMatrix;
            void main() {
              gl_Position = u_MvpMatrix * a_Position;
              v_TexCoord = a_TexCoord;
              v_Position = vec3(u_ModelMatrix * a_Position);
              v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));
            }`;

    // Fragment shader program
    let FSHADER_SOURCE = `
            #ifdef GL_ES
            precision mediump float;
            #endif
            uniform sampler2D u_Sampler;
            varying vec2 v_TexCoord;
            varying vec3 v_Position;
            varying vec3 v_Normal;
            uniform vec3 u_LightDirection; // 平行光的光照方向
            uniform vec3 u_PointLightPosition; // 点光源的位置
            uniform vec3 u_PointLight; // 点光源发出的光的颜色
            uniform bool u_PointLightOn; // 点光源是否开启
            uniform vec3 u_AmbientLight; // 环境光的颜色
            void main() {
              vec3 paraLight = vec3(1.0, 1.0, 1.0); // 平行光的颜色
              vec4 color = texture2D(u_Sampler, v_TexCoord); // 从纹理中获取颜色
              
              vec3 normal = v_Normal;
              
              vec3 lightDirection = normalize(u_LightDirection); // 平行光的光照方向
              float nDotL = max(dot(lightDirection, normal), 0.0);
              vec3 diffuse1 = paraLight * color.xyz * nDotL; // 平行光造成的漫反射光的颜色
              
              vec3 diffuse2 = vec3(0.0, 0.0, 0.0); // 点光源造成的漫反射光的颜色
              if (u_PointLightOn) {
                vec3 pointLightDirection = normalize(u_PointLightPosition - v_Position); // 点光源的光照方向
                float nDotL2 = max(dot(pointLightDirection, normal), 0.0);
                diffuse2 = u_PointLight * color.xyz * nDotL2; // 点光源造成的漫反射光的颜色
              }
              
              vec3 ambient = u_AmbientLight * color.xyz;
          
              gl_FragColor = vec4(diffuse1 + diffuse2 + ambient, color.a);
            }`;

    // Initialize shaders
    this.program = createProgram(this.gl, VSHADER_SOURCE, FSHADER_SOURCE);
    if (!this.program) {
      console.log('Failed to create program');
      return;
    }

    this.gl.useProgram(this.program);
    this.gl.program = this.program;
  }

  initPerspective() {
    this.gl.enable(this.gl.DEPTH_TEST);
    // Get the storage location of u_MvpMatrix
    this.u_MvpMatrix = this.gl.getUniformLocation(this.gl.program, 'u_MvpMatrix');
    if (!this.u_MvpMatrix) {
      console.log('Failed to get the storage location of u_MvpMatrix');
    }


    this.g_normalMatrix = new Matrix4();
    this.a_Position = this.gl.getAttribLocation(this.gl.program, 'a_Position');
    this.a_TexCoord = this.gl.getAttribLocation(this.gl.program, 'a_TexCoord');
    this.a_Normal = this.gl.getAttribLocation(this.gl.program, 'a_Normal');

    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    this.u_ModelMatrix = this.gl.getUniformLocation(this.program, 'u_ModelMatrix');
    this.u_NormalMatrix = this.gl.getUniformLocation(this.program, 'u_NormalMatrix');
    this.u_AmbientLight = this.gl.getUniformLocation(this.program, 'u_AmbientLight'); // 环境光的颜色
    this.u_LightDirection = this.gl.getUniformLocation(this.program, 'u_LightDirection'); // 平行光的光照方向
    this.u_PointLightPosition = this.gl.getUniformLocation(this.program, 'u_PointLightPosition'); // 点光源的位置
    this.u_PointLight = this.gl.getUniformLocation(this.program, 'u_PointLight'); // 点光源发出的光的颜色
    this.u_PointLightOn = this.gl.getUniformLocation(this.program, 'u_PointLightOn'); // 点光源是否开启

    this.g_modelMatrix = new Matrix4();
    this.g_modelMatrix.translate(this.entity.translate[0], this.entity.translate[1], this.entity.translate[2]);
    this.g_modelMatrix.scale(this.entity.scale[0], this.entity.scale[1], this.entity.scale[2]);

  }

  initBuffers() {
    // Write the vertex coordinates to the buffer object
    this.vertexBuffer = this.gl.createBuffer();

    // Write the vertex texture coordinates to the buffer object
    this.vertexTexCoordBuffer = this.gl.createBuffer();

    // Write the indices to the buffer object
    this.vertexIndexBuffer = this.gl.createBuffer();

    // Write the normals to the buffer object
    this.normalBuffer = this.gl.createBuffer();
  }

  initTextures() {
    // Create a texture object
    this.texture = this.gl.createTexture();

    // Get the storage location of u_Sampler
    this.u_Sampler = this.gl.getUniformLocation(this.gl.program, 'u_Sampler');
    if (!this.u_Sampler) {
      console.log('Failed to get the storage location of u_Sampler');
      return;
    }

    // Load texture image
    this.textureImage = new Image();
    this.textureImage.src = this.textureImageSrc; // 纹理图片路径，默认纹理是天空(sky.jpg)
    this.textureImage.onload = ()=> {
      this.handleTextureLoad();
    };
  }

  handleTextureLoad() {
    this.gl.useProgram(this.program);
    this.gl.activeTexture(this.gl[`TEXTURE${this.activeTextureIndex}`]);
    // Flip the image's y axis
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);

    // Bind the texture object to the target
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

    // Set the texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    // Set the texture image
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.textureImage);

    // Set the texture unit 0 to the sampler
    this.gl.uniform1i(this.u_Sampler, this.activeTextureIndex);
  }

  render() {
    this.gl.useProgram(this.program);

    // vertexBuffer to a_Position
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.vertex), this.gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Position);


    // vertexTexCoordBuffer to a_TexCoord
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexTexCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.texCoord), this.gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.a_TexCoord, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_TexCoord);

    // normalBuffer to a_Normal
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.normal), this.gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.a_Normal, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Normal);

    this.gl.activeTexture(this.gl[`TEXTURE${this.activeTextureIndex}`]);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.entity.index), this.gl.STATIC_DRAW);


    // Set the eye point and the viewing volume
    this.mvpMatrix = Camera.getMatrix();
    this.mvpMatrix.concat(this.g_modelMatrix);

    // Pass the model view projection matrix to u_MvpMatrix
    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, this.mvpMatrix.elements);

    this.g_normalMatrix.setInverseOf(this.g_modelMatrix);
    this.g_normalMatrix.transpose();
    this.gl.uniformMatrix4fv(this.u_NormalMatrix, false, this.g_normalMatrix.elements);
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.g_modelMatrix.elements);

    // 设置光照，包括环境光颜色，平行光方向，点光源位置，点光源颜色
    this.gl.uniform3fv(this.u_AmbientLight, sceneAmbientLight);
    this.gl.uniform3fv(this.u_LightDirection, sceneDirectionLight);
    this.gl.uniform3fv(this.u_PointLightPosition, CameraPara.eye); // 点光源位置与相机位置一致
    this.gl.uniform3fv(this.u_PointLight, scenePointLightColor); // 点光源颜色
    this.gl.uniform1i(this.u_PointLightOn, scenePointLightOn); // 点光源是否开启

    // Draw the texture
    this.gl.drawElements(this.gl.TRIANGLE_STRIP, this.entity.index.length, this.gl.UNSIGNED_SHORT, 0);
  }
}

