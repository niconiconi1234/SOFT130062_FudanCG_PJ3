class BirdObjectLoader extends ObjectLoader {
  // 直接继承ObjectLoader复用代码，虽然有点不优雅
  constructor(entity, config) {
    super(entity, config);
  }


  render(timestamp) {
    // 因为小鸟需要会动，所以我们需要重写render方法，在render方法中根据小鸟当前的位置，更新小鸟的modelMatrix
    // (原先的modelMatrix在initPerspective函数中初始化以后，就是固定的)

    this.g_modelMatrix = new Matrix4()

    const deg2rad = (deg) => deg * Math.PI / 180 // 角度转弧度

    // 小鸟的运动（动画）矩阵
    let birdMoveMat = new Matrix4()
    birdMoveMat.translate(0, -2 * Math.sin(deg2rad(this.entity.rotateAngle)), 0) // 小鸟的飞行高度与小鸟的旋转角度成正弦关系
    birdMoveMat.translate(this.entity.rotateAxisX, 0, this.entity.rotateAxisZ);
    birdMoveMat.rotate(this.entity.rotateAngle, 0, 1, 0);
    birdMoveMat.translate(-this.entity.rotateAxisX, 0, -this.entity.rotateAxisZ);

    // 应用小鸟之前原有的变换，这部分和ObjectLoader中的initPerspective函数中的代码一样
    for (let t of this.entity.transform) {
      this.g_modelMatrix[t.type].apply(this.g_modelMatrix, t.content);
    }

    // 最后把小鸟的移动（动画）矩阵和小鸟原有的变换相乘，就是小鸟最终的modelMatrix
    this.g_modelMatrix = birdMoveMat.multiply(this.g_modelMatrix);

    return super.render(timestamp);
  }
}
