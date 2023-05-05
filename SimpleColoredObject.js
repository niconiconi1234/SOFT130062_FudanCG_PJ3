class SimpleColoredObjectLoader {
  constructor(entity, config) {
    this.entity = entity;
    this.gl = config.gl;
    this.enableLight = config.enableLight;
  }

  init() {
    this.initShaders()
    this.initBuffers()
    this.initPerspective()
    return this
  }

  initShaders() {
    let VSHADER_SOURCE = `
        attribute vec4 a_Position; varying vec3 v_Position;
        attribute vec4 a_Color; varying vec4 v_Color;
        attribute vec4 a_Normal; varying vec3 v_Normal;
        uniform mat4 u_MvpMatrix;
        uniform mat4 u_ModelMatrix;
        uniform mat4 u_NormalMatrix;
        void main() {
            gl_Position = u_MvpMatrix * a_Position;
            v_Color = a_Color;
            v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));
            v_Position = vec3(u_ModelMatrix * a_Position);
        }`;
    let FSHADER_SOURCE = `
        #ifdef GL_ES
        precision mediump float;
        #endif
        varying vec3 v_Position;
        varying vec4 v_Color;
        varying vec3 v_Normal;
        uniform vec3 u_LightDirection; // 平行光的光照方向
        uniform vec3 u_PointLightPosition; // 点光源的位置
        uniform vec3 u_PointLight; // 点光源发出的光的颜色
        uniform bool u_PointLightOn; // 点光源是否开启
        uniform vec3 u_AmbientLight; // 环境光的颜色
        void main() {
            vec3 paraLight = vec3(1.0, 1.0, 1.0); // 平行光的颜色
            
            vec3 normal = v_Normal;
            
            vec3 lightDirection = normalize(u_LightDirection); // 平行光的光照方向
            float nDotL = max(dot(lightDirection, normal), 0.0);
            vec3 diffuse1 = paraLight * v_Color.xyz * nDotL; // 平行光造成的漫反射光的颜色
            
            vec3 diffuse2 = vec3(0.0, 0.0, 0.0); // 点光源造成的漫反射光的颜色
            if (u_PointLightOn) {
              vec3 pointLightDirection = normalize(u_PointLightPosition - v_Position); // 点光源的光照方向
              float nDotL2 = max(dot(pointLightDirection, normal), 0.0);
              diffuse2 = u_PointLight * v_Color.xyz * nDotL2; // 点光源造成的漫反射光的颜色
            }
            
            vec3 ambient = u_AmbientLight * v_Color.xyz;
            
            gl_FragColor = vec4(diffuse1 + diffuse2 + ambient, v_Color.a);
        }`;
    this.program = createProgram(this.gl, VSHADER_SOURCE, FSHADER_SOURCE);
    if (!this.program) {
      console.log('Failed to create program');
      return;
    }
    this.gl.useProgram(this.program);
    this.gl.program = this.program;
  }

  initBuffers() {
    // 获得a_Position和a_Color的存储位置
    this.a_Position = this.gl.getAttribLocation(this.program, 'a_Position');
    this.a_Color = this.gl.getAttribLocation(this.program, 'a_Color')
    this.a_Normal = this.gl.getAttribLocation(this.program, 'a_Normal')
    if (this.a_Position < 0 || this.a_Color < 0 || this.a_Normal < 0) {
      throw new Error('Failed to get the storage location of a_Position, a_Color or a_Normal');
    }

    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    this.u_ModelMatrix = this.gl.getUniformLocation(this.program, 'u_ModelMatrix');
    this.u_NormalMatrix = this.gl.getUniformLocation(this.program, 'u_NormalMatrix');
    this.u_LightDirection = this.gl.getUniformLocation(this.program, 'u_LightDirection'); // 平行光的光照方向
    this.u_AmbientLight = this.gl.getUniformLocation(this.program, 'u_AmbientLight'); // 环境光的颜色
    this.u_PointLightPosition = this.gl.getUniformLocation(this.program, 'u_PointLightPosition'); // 点光源的位置
    this.u_PointLight = this.gl.getUniformLocation(this.program, 'u_PointLight'); // 点光源发出的光的颜色
    this.u_PointLightOn = this.gl.getUniformLocation(this.program, 'u_PointLightOn'); // 点光源是否开启

    // 从entity中获得顶点和颜色数据
    this.vertex = this.entity.vertex;
    this.color = this.entity.color;
    this.index = this.entity.index
    this.normal = this.entity.normal

    this.bufferMap = {
      vertexBuffer: this.initArrayBufferForLaterUse(new Float32Array(this.vertex), 3, this.gl.FLOAT),
      colorBuffer: this.initArrayBufferForLaterUse(new Float32Array(this.color), 3, this.gl.FLOAT),
      normalBuffer: this.initArrayBufferForLaterUse(new Float32Array(this.normal), 3, this.gl.FLOAT),
      indexBuffer: this.initElementArrayBufferForLaterUse(new Uint8Array(this.index)),
      indexNum: this.index.length
    }
  }

  /**
   * 创建array buffer，写入数据，但不分配给变量
   * @param data
   * @param elemNumEachAttrib
   * @param dataType
   * @param stride
   * @param offset
   */
  initArrayBufferForLaterUse(data, elemNumEachAttrib, dataType, stride = 0, offset = 0) {
    const buf = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    buf.elemNumEachAttrib = elemNumEachAttrib
    buf.dataType = dataType
    buf.stride = stride
    buf.offset = offset

    return buf
  }

  /**
   * 创建element array buffer，写入数据
   * @param data
   */
  initElementArrayBufferForLaterUse(data) {
    const buf = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, buf);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    return buf
  }

  initPerspective() {
    this.gl.enable(this.gl.DEPTH_TEST)

    // modelMatrix，表示物体旋转/平移/缩放的模型矩阵
    const modelMatrix = new Matrix4();
    modelMatrix.translate(this.entity.translate[0], this.entity.translate[1], this.entity.translate[2]);
    modelMatrix.scale(this.entity.scale[0], this.entity.scale[1], this.entity.scale[2]);

    this.uniformMap = {
      modelMatrix: modelMatrix,
    }
  }

  render() {
    this.gl.useProgram(this.program);
    this.allocateArrayBuffer(this.bufferMap.vertexBuffer, this.a_Position) // 把vertexBuffer分配给变量a_Position
    this.allocateArrayBuffer(this.bufferMap.colorBuffer, this.a_Color) // 把colorBuffer分配给变量a_Color
    this.allocateArrayBuffer(this.bufferMap.normalBuffer, this.a_Normal) // 把normalBuffer分配给变量a_Normal
    this.bindElementArrayBuffer(this.bufferMap.indexBuffer) // 把indexBuffer绑定成element array buffer
    this.setAllUniformVariables() // 设置所有uniform变量
    this.gl.drawElements(this.gl.TRIANGLES, this.index.length, this.gl.UNSIGNED_BYTE, 0);
  }

  /**
   * 把array buffer分配给变量
   * @param buf
   * @param a_attribute
   */
  allocateArrayBuffer(buf, a_attribute) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    this.gl.vertexAttribPointer(a_attribute, buf.elemNumEachAttrib, buf.dataType, false, buf.stride, buf.offset);
    this.gl.enableVertexAttribArray(a_attribute);
  }

  /**
   * 绑定element array buffer
   * @param buf
   */
  bindElementArrayBuffer(buf) {
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, buf);
  }


  /**
   * 渲染前，设置所有uniform变量
   */
  setAllUniformVariables() {
    // u_MvpMatrix
    const mvpMatrix = Camera.getMatrix().multiply(this.uniformMap.modelMatrix)
    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, mvpMatrix.elements);

    // u_ModelMatrix
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.uniformMap.modelMatrix.elements);

    // u_NormalMatrix
    const normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(this.uniformMap.modelMatrix);
    normalMatrix.transpose();
    this.gl.uniformMatrix4fv(this.u_NormalMatrix, false, normalMatrix.elements);

    // u_LightDirection 平行光方向
    const lightDirection = new Vector3(sceneDirectionLight);
    lightDirection.normalize(); // Normalize
    this.gl.uniform3fv(this.u_LightDirection, lightDirection.elements);

    // u_AmbientLight 环境光颜色
    this.gl.uniform3fv(this.u_AmbientLight, sceneAmbientLight);

    // u_PointLightPosition 点光源位置
    this.gl.uniform3fv(this.u_PointLightPosition, CameraPara.eye); // 点光源位置和相机位置一致

    // u_PointLight 点光源颜色
    this.gl.uniform3fv(this.u_PointLight, scenePointLightColor);

    // u_PointLightOn 点光源是否开启
    this.gl.uniform1i(this.u_PointLightOn, scenePointLightOn);
  }
}

