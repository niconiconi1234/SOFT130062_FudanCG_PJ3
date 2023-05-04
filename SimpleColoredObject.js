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
        attribute vec4 a_Position;
        attribute vec4 a_Color; varying vec4 v_Color;
        uniform mat4 u_MvpMatrix;
        void main() {
            gl_Position = u_MvpMatrix * a_Position;
            v_Color = a_Color;
        }`;
    let FSHADER_SOURCE = `
        #ifdef GL_ES
        precision mediump float;
        #endif
        varying vec4 v_Color;
        void main() {
            gl_FragColor = v_Color;
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
    if (this.a_Position < 0 || this.a_Color < 0) {
      throw new Error('Failed to get the storage location of a_Position or a_Color');
    }

    // 从entity中获得顶点和颜色数据
    this.vertexColor = this.entity.vertex;
    this.index = this.entity.index

    this.bufferMap = {
      vertexBuffer: this.initArrayBufferForLaterUse(new Float32Array(this.vertexColor), 3, this.gl.FLOAT, 6 * Float32Array.BYTES_PER_ELEMENT, 0),
      colorBuffer: this.initArrayBufferForLaterUse(new Float32Array(this.vertexColor), 3, this.gl.FLOAT, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT),
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
  initArrayBufferForLaterUse(data, elemNumEachAttrib, dataType, stride, offset) {
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
    // 获得u_MvpMatrix的存储位置
    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');

    // modelMatrix，表示物体旋转/平移/缩放的模型矩阵
    const modelMatrix = new Matrix4();
    modelMatrix.translate(this.entity.translate[0], this.entity.translate[1], this.entity.translate[2]);
    modelMatrix.scale(this.entity.scale[0], this.entity.scale[1], this.entity.scale[2]);

    // 设置u_MvpMatrix的值
    const mvpMatrix = Camera.getMatrix();
    mvpMatrix.concat(modelMatrix); // mvpMatrix = vpMatrix * modelMatrix

    this.uniformMap = {
      modelMatrix: modelMatrix,
      mvpMatrix: mvpMatrix
    }
  }

  render() {
    this.gl.useProgram(this.program);
    this.allocateArrayBuffer(this.bufferMap.vertexBuffer, this.a_Position) // 把vertexBuffer分配给变量a_Position
    this.allocateArrayBuffer(this.bufferMap.colorBuffer, this.a_Color) // 把colorBuffer分配给变量a_Color
    this.bindElementArrayBuffer(this.bufferMap.indexBuffer) // 把indexBuffer绑定成element array buffer
    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, this.uniformMap.mvpMatrix.elements) // 设置u_MvpMatrix的值
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
}
