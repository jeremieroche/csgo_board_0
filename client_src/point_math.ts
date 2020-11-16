export const calcHypotenuse = (a, b) => {
  return Math.sqrt((a * a) + (b * b));
}

export const getCenterPoint = (pixel1: Point, pixel2: Point) => {
  const xCoor = (pixel1.x+pixel2.x)/2
  const yCoor = (pixel1.y+pixel2.y)/2
  return {x: xCoor, y: yCoor}
}

export const getPointAngle = (p1: Point, p2: Point, p3: Point) => {
  // https://stackoverflow.com/a/1211243
  const p12 = calcHypotenuse(p1.x-p2.x, p1.y - p2.y)
  const p13 = calcHypotenuse(p1.x-p3.x, p1.y - p3.y)
  const p23 = calcHypotenuse(p2.x-p3.x, p2.y - p3.y)

  const rawAngle = Math.acos(((p12 * p12) + (p13 * p13) - (p23 * p23))/(2 * p12 * p13))
  const sign = ((p2.x < p3.x && p1.y > p2.y) || (p2.x > p3.x && p1.y < p2.y)) ? 1 : -1
  return rawAngle * (180 / Math.PI) * sign
}

export const rotatePointAngleDegrees = (center: Point, originalPoint: Point, angle: Float) => {
  const radians = Math.PI/180 * angle
  const pX = center.x + (originalPoint.x - center.x) * Math.cos(radians) - (originalPoint.y - center.y) * Math.sin(radians)
  const pY = center.y + (originalPoint.x - center.x) * Math.sin(radians) + (originalPoint.y - center.y) * Math.cos(radians)

  return {x: pX, y: pY}
}
