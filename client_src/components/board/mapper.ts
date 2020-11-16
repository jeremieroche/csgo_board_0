class CoordinateMapper {
  scaler = null
  intercept = null
  charDisplacement = null

  constructor(xCoor: boolean){
    if (xCoor){
      this.scaler = 5.499919357
      this.intercept = -2454.928751
      this.charDisplacement = - 18.5
    } else {
      this.scaler = -5.556886228
      this.intercept = 3214.184319
      this.charDisplacement = 18.5
    }
  }

  translatePixel(pixel: Int){
    return Math.round(this.scaler * pixel + this.intercept + this.charDisplacement)
  }


  translateNumber(number: Int){
    return Math.round((number - this.intercept - this.charDisplacement) / this.scaler)
  }
}

export class PosMapper {
  xCoorMapper = new CoordinateMapper(true)
  yCoorMapper = new CoordinateMapper(false)

  completeMapper(canvasProperties, imageWidth){
    const displacementFloat = (canvasProperties.width + canvasProperties.x)/2 - imageWidth/2
    const displacement = parseInt(displacementFloat)
    this.xCoorMapper.completeMapper(displacement)
    this.yCoorMapper.completeMapper(0)
  }

  translatePixel(point: Point){
    const xPoint = point.x
    const yPoint = point.y
    return {x: this.xCoorMapper.translatePixel(xPoint),
            y: this.yCoorMapper.translatePixel(yPoint)}
  }

  translatePoint(newInt: Int, isX: boolean){
    const mapper = isX ? this.xCoorMapper : this.yCoorMapper
    return mapper.translateNumber(newInt)
  }
}
