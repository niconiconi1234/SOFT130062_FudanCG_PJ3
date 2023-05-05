

"use strict";
class ObjectLoader {
  constructor(entity, config) {
    this.gl = config.gl;
    this.entity = entity;
  }

  init() {

    this.initShaders();

    this.initPerspective();

    this.g_objDoc = null;      // The information of OBJ file
    this.g_drawingInfo = null; // The information for drawing 3D model


    // Prepare empty buffer objects for vertex coordinates, colors, and normals
    this.initBuffers();
    if (!this.buffers) {
      console.log('Failed to set the vertex information');
      return;
    }

    // Start reading the OBJ file
    this.readOBJFile(`${this.entity.objFilePath}`, this.buffers, 1, true);

    return this;
  }

  initShaders() {
    // Vertex shader program
    let VSHADER_SOURCE = `
        attribute vec4 a_Position; varying vec3 v_Position;
        attribute vec4 a_Color; varying vec4 v_Color; // 这里的a_Color是从obj文件中读取的，实际只使用了其alpha通道。物体真正的颜色是u_Color。
        attribute vec4 a_Normal; varying vec3 v_Normal;
        uniform mat4 u_MvpMatrix;
        uniform mat4 u_ModelMatrix;
        uniform mat4 u_NormalMatrix;
        uniform vec3 u_Color;
        void main() {
          gl_Position = u_MvpMatrix * a_Position;
          v_Color = vec4(u_Color.rgb, a_Color.a);
          v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));
          v_Position = vec3(u_ModelMatrix * a_Position);
        }`;

    // Fragment shader program
    let FSHADER_SOURCE = `
        #ifdef GL_ES
        precision mediump float;
        #endif
        varying vec4 v_Color;
        varying vec3 v_Normal;
        varying vec3 v_Position;
        uniform vec3 u_LightDirection; // 平行光的光照方向
        uniform vec3 u_PointLightPosition; // 点光源的位置
        uniform vec3 u_PointLight; // 点光源发出的光的颜色
        uniform bool u_PointLightOn; // 点光源是否开启
        uniform vec3 u_AmbientLight; // 环境光的颜色
        void main() {
          vec3 paraLight = vec3(1.0, 1.0, 1.0); // 平行光的颜色
          
          vec3 normal = v_Normal;
          
          vec3 lightDirection = normalize(u_LightDirection); // 平行光的光照方向
          float nDotL1 = max(dot(lightDirection, normal), 0.0);
          vec3 diffuse1 = paraLight * v_Color.xyz * nDotL1; // 平行光造成的漫反射光的颜色
          
          
          vec3 diffuse2 = vec3(0.0, 0.0, 0.0); // 点光源造成的漫反射光的颜色
          if (u_PointLightOn) {
            vec3 pointLightDirection = normalize(u_PointLightPosition - v_Position); // 点光源的光照方向
            float nDotL2 = max(dot(pointLightDirection, normal), 0.0);
            diffuse2 = u_PointLight * v_Color.xyz * nDotL2; // 点光源造成的漫反射光的颜色
          }
                
          vec3 ambient = u_AmbientLight * v_Color.xyz; // 环境光的颜色
          gl_FragColor = vec4(diffuse1 + diffuse2 + ambient, v_Color.a);
        }`;

    // Initialize shaders
    this.program = createProgram(this.gl, VSHADER_SOURCE, FSHADER_SOURCE);
    if (!this.program) {
      console.log('Failed to create program');
      return;
    }

    this.gl.enable(this.gl.DEPTH_TEST);

    // Get the storage locations of attribute and uniform variables
    this.a_Position = this.gl.getAttribLocation(this.program, 'a_Position');
    this.a_Color = this.gl.getAttribLocation(this.program, 'a_Color');
    this.a_Normal = this.gl.getAttribLocation(this.program, 'a_Normal');
    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    this.u_NormalMatrix = this.gl.getUniformLocation(this.program, 'u_NormalMatrix');
    this.u_ModelMatrix = this.gl.getUniformLocation(this.program, 'u_ModelMatrix');


    this.u_LightDirection = this.gl.getUniformLocation(this.program, 'u_LightDirection');
    this.u_AmbientLight = this.gl.getUniformLocation(this.program, 'u_AmbientLight');
    this.u_PointLightPosition = this.gl.getUniformLocation(this.program, 'u_PointLightPosition');
    this.u_PointLight = this.gl.getUniformLocation(this.program, 'u_PointLight');
    this.u_PointLightOn = this.gl.getUniformLocation(this.program, 'u_PointLightOn');

    this.u_Color = this.gl.getUniformLocation(this.program, 'u_Color');

    this.gl.useProgram(this.program);
    this.gl.program = this.program;
  }

  initPerspective() {
    this.g_modelMatrix = new Matrix4();
    this.g_normalMatrix = new Matrix4();
    for (let t of this.entity.transform) {
      this.g_modelMatrix[t.type].apply(this.g_modelMatrix, t.content);
    }
  }

  initBuffers() {
    // Create a buffer object, assign it to attribute variables, and enable the assignment
    this.buffers = {
      vertexBuffer: this.gl.createBuffer(),
      normalBuffer: this.gl.createBuffer(),
      colorBuffer: this.gl.createBuffer(),
      indexBuffer: this.gl.createBuffer()
    };
  }

  readOBJFile(fileName, model, scale, reverse) {
    let request = new XMLHttpRequest();

    request.onreadystatechange = () => {
      if (request.readyState === 4 && (request.status == 200 || request.status == 0)) {
        this._onReadOBJFile(request.responseText, fileName, model, scale, reverse);
      }
    };
    request.open('GET', fileName, true);
    request.send();
  }


  _onReadOBJFile(fileString, fileName, o, scale, reverse) {
    let objDoc = new OBJDoc(fileName);  // Create a OBJDoc object
    let result = objDoc.parse(fileString, scale, reverse); // Parse the file
    if (!result) {
      this.g_objDoc = null;
      this.g_drawingInfo = null;
      console.log("OBJ file parsing error.");
      return;
    }
    this.g_objDoc = objDoc;
  }

  render(timestamp) {
    this.gl.useProgram(this.program);
    this.gl.program = this.program;

    if (this.g_objDoc != null && this.g_objDoc.isMTLComplete()) {
      this.onReadComplete();
    }
    if (!this.g_drawingInfo) return;

    if (this.hasOwnProperty('nextFrame')) {
      this.nextFrame(timestamp);
      this.initPerspective();
    }

    let lightDirection = new Vector3(sceneDirectionLight); // 平行光的方向
    lightDirection.normalize();
    this.gl.uniform3fv(this.u_LightDirection, lightDirection.elements); // 平行光的方向
    this.gl.uniform3fv(this.u_AmbientLight, sceneAmbientLight); // 环境光的颜色
    this.gl.uniform3fv(this.u_PointLightPosition, Camera.eye.elements); // 点光源的位置，和相机位置一致
    this.gl.uniform3fv(this.u_PointLight, scenePointLightColor); // 点光源的颜色
    this.gl.uniform1i(this.u_PointLightOn, scenePointLightOn); // 点光源是否开启

    this.gl.uniform3fv(this.u_Color, new Vector3(this.entity.color).elements);

    this.g_normalMatrix.setInverseOf(this.g_modelMatrix);
    this.g_normalMatrix.transpose();
    this.gl.uniformMatrix4fv(this.u_NormalMatrix, false, this.g_normalMatrix.elements);
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.g_modelMatrix.elements);

    let g_mvpMatrix = Camera.getMatrix();
    g_mvpMatrix.concat(this.g_modelMatrix);

    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, g_mvpMatrix.elements);
    // Draw
    this.gl.drawElements(this.gl.TRIANGLES, this.g_drawingInfo.indices.length, this.gl.UNSIGNED_SHORT, 0);
  }

  onReadComplete() {
    // Acquire the vertex coordinates and colors from OBJ file
    this.g_drawingInfo = this.g_objDoc.getDrawingInfo();

    // Write date into the buffer object
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.vertices, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Position);


    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normalBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.normals, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Normal, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Normal);


    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.colors, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Color, 4, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Color);

    // Write the indices to the buffer object
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.g_drawingInfo.indices, this.gl.STATIC_DRAW);

  }
}
