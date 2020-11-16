import Vue from 'vue';
import Component from 'vue-class-component';
import { Component, Watch } from 'vue-property-decorator'
import * as cloneDeep from 'lodash/cloneDeep';
import OptionPanel from '@/components/option-panel/option-panel.vue';
import { v4 as uuid } from 'uuid';
import * as d3 from 'd3';
import { select,event,scale,drag } from 'd3-selection';
import {calcHypotenuse, getCenterPoint} from '@/point_math'
import { csvToArray } from '@/csv_translater.ts'
import { PosMapper } from './mapper.ts'
import toolbar from '@/components/toolbar/toolbar.vue'
import axios from 'axios';
import { Splitpanes, Pane } from 'splitpanes'
import OptionPanel from '@/components/option-panel-v2/option-panel-v2.vue';



interface Point {
  x: number;
  y: number;
}

interface Color {
  r: Int;
  g: Int;
  b: Int;
}

const TOUCH_POINT_NAMES = ["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7"];
const CIRCLE_RADIUS = 4;

export const getBrushBox = (pixel1: Point, pixel2: Point) => {

  const p = pixel1;
  const q = pixel2;

  const x1 = Math.min(p.x, q.x);
  const y1 = Math.min(p.y, q.y);
  const x2 = Math.max(p.x, q.x);
  const y2 = Math.max(p.y, q.y);
  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  }
}

class Box {
  pixel1: Point = null
  pixel2: Point = null
  point1: Point = null
  point2: Point = null
  id: string = null
  levels: [boolean] = []

  constructor(pixel1: Point, pixel2: Point, point1: Point, point2: Point, id=uuid(), levels = [true,false]){

    this.id = id
    this.pixel1 = pixel1
    this.pixel2 = pixel2
    this.point1 = point1
    this.point2 = point2
    this.levels = levels
  }
}

class Bundle {
  label: string = null
  boxes: Box[] = null
  id: string = null
  color: Color = null
  constructor(boxes: Box[], label="", id=uuid(), color={r: 0, g: 0, b: 255}){
    this.id = id
    this.label = label
    this.boxes = boxes
    this.color = color
  }

  setLabel(label: string){
    this.label = label
  }

  setColor(colorValue: Int, type){
    if (colorValue > 255 || colorValue < 0){
      throw "Error: color must be between 0-255"
    }
    if (type == "r"){
      this.color.r = colorValue
    } else if (type == "g"){
      this.color.g = colorValue
    } else if (type == "b"){
      this.color.b = colorValue
    } else {
      throw "setColor Error"
    }
  }

  appendBoxes(moreBoxes: Box[]){
    moreBoxes.forEach(box => {
      this.boxes.push(box)
    });
  }
}

class Link {
  id: string = null
  bundle0: Bundle = null
  bundle1: Bundle = null

  constructor(bundle0: Bundle, bundle1: Bundle){
    this.id = bundle0.id + "_" + bundle1.id
    this.bundle0 = bundle0
    this.bundle1 = bundle1
  }

  inverseId(){
    return this.bundle1.id + "_" + this.bundle0.id
  }

}

class Graph {
  bundleIdSet = null
  masterBundleList: Bundle[] = null
  linkList = null

  constructor(){
    this.bundleIdSet = new Set()
    this.masterBundleList = []
    this.linkList = {}
  }

  hasId(id: string){
    return this.bundleIdSet.has(id)
  }

  removeId(id: string){
    this.bundleIdSet.delete(id)
    for (let i = 0; i < this.masterBundleList.length; i++) {
      const iterBundle = this.masterBundleList[i];
      if (iterBundle.id == id) {
        this.masterBundleList.splice(i,1)
        break
      }
    }
  }

  bundles(){
    return this.masterBundleList
  }

  pushBundle(bundle: Bundle){
    this.bundleIdSet.add(bundle.id)
    this.masterBundleList.push(bundle)
  }

  fetchBundle(id: string){
    if (!this.hasId(id)){
      return null
    }

    for (let i = 0; i < this.masterBundleList.length; i++) {
      const bundle = this.masterBundleList[i];
      if (bundle.id == id){
        return bundle
      }
    }

    return null
  }

  links(){
    return this.linkList
  }

  pushLink(link: Link){
    if (link.id in this.linkList){
      return
    }

    this.linkList[link.id] = link
  }

  fetchLink(linkStr){
    if (linkStr in this.linkList){
      return this.linkList[linkStr]
    } else {
      return null
    }
  }

  createCsvBlob(){
    let content = 'type,bundle_id,box_id,bundle_name,r,g,b,X1,Y1,X2,Y2,top,bottom,links\n'
    let rowCount = 0
    const bundleIndex = {}
    this.masterBundleList.forEach(bundle => {
      content += "0," + bundle.id + ",," + bundle.label + "," + bundle.color.r + ","
      content += bundle.color.g + "," + bundle.color.b + ",,,,,,,\n"

      bundleIndex[bundle.id] = rowCount
      rowCount += 1
      bundle.boxes.forEach(box => {
        const boxTopLevel = box.levels[0] ? 1 : 0
        const boxBottomLevel = box.levels[1] ? 1 : 0
        content += "1," + bundle.id + "," + box.id + ",,,,," + box.point1.x + "," + box.point1.y + ","
        content += box.point2.x + "," + box.point2.y + "," + boxTopLevel + "," + boxBottomLevel + ",\n"
        rowCount += 1
      });
    });

    let prevBundleId = null
    let bundleLinks = null
    const linkKeys = Object.keys(this.links()).sort()
    for (let i = 0; i < linkKeys.length; i++) {
      const lk = linkKeys[i];
      const link = this.fetchLink(lk)
      if (link.bundle0.id != prevBundleId){
        if (prevBundleId != null){
          content += "2," + prevBundleId + ",,,,,,,,,,,," + bundleLinks.join("|") + "\n"
          rowCount += 1
        }
        bundleLinks = []
      }
      bundleLinks.push(bundleIndex[link.bundle1.id])
      prevBundleId = link.bundle0.id
    }
    if (prevBundleId != null){
      content += "2," + prevBundleId + ",,,,,,,,,,,," + bundleLinks.join("|") + "\n"
      rowCount += 1
    }

    return content
  }

  parseCsv(csvBlob, posMapping){
    let arrayCsv = csvToArray(csvBlob)
    const indexDictionary = {}
    const bundleLinkLibrary = {}
    if (arrayCsv[0][0] == "type"){
      // Is header
      arrayCsv = arrayCsv.slice(1,arrayCsv.length)
    }
    for (let i = 0; i < arrayCsv.length; i++) {
      const csvLine = arrayCsv[i];

      if (csvLine[0] == "0"){
        const bundleId = csvLine[1]
        indexDictionary[i] = bundleId
        const bundleColor = {r: csvLine[4], g: csvLine[5], b: csvLine[6]}
        const newBundle = new Bundle([],csvLine[3],bundleId,bundleColor)
        this.pushBundle(newBundle)
      } else if (csvLine[0] == "1"){
        const bundleId = csvLine[1]
        const bundle = this.fetchBundle(bundleId)
        if (!bundle){
          throw "Error"
        }

        const pixel1 = {x: posMapping.translatePoint(parseInt(csvLine[7]),true),
                        y: posMapping.translatePoint(parseInt(csvLine[8]),false)}
        const pixel2 = {x: posMapping.translatePoint(parseInt(csvLine[9]),true),
                        y: posMapping.translatePoint(parseInt(csvLine[10]),false)}
        const point1 = {x: parseInt(csvLine[7]), y: parseInt(csvLine[8])}
        const point2 = {x: parseInt(csvLine[9]), y: parseInt(csvLine[10])}

        let topLevel, bottomLevel = null
        if (csvLine[11] == 1){
          topLevel = true
        } else if (csvLine[11] ==0) {
          topLevel = false
        } else {
          throw "Error"
        }
        if (csvLine[12] == 1){
          bottomLevel = true
        } else if (csvLine[12] == 0) {
          bottomLevel = false
        } else {
          throw "Error"
        }

        const newBox = new Box(pixel1, pixel2, point1, point2, csvLine[2], [topLevel,bottomLevel])

        bundle.appendBoxes([newBox])
      } else if (csvLine[0] == "2"){
        bundleLinkLibrary[csvLine[1]] = csvLine[13]
      } else if (csvLine[0] == "") {
        console.log("??? Wut");
      } else {
        throw "Error"
      }
    }
    const bundleIds = Object.keys(bundleLinkLibrary)
    for (let i = 0; i < bundleIds.length; i++) {
      const bid0 = bundleIds[i];
      const bundle0 = this.fetchBundle(bid0)
      const complementaryBundleIndices = bundleLinkLibrary[bid0].split('|')
      for (let j = 0; j < complementaryBundleIndices.length; j++) {
        const bIndex = parseInt(complementaryBundleIndices[j]);
        const bid1 = indexDictionary[bIndex]
        const bundle1 = this.fetchBundle(bid1)

        const newLink = new Link(bundle0,bundle1)
        this.pushLink(newLink)
      }

    }
  }

  getApiPayload(){
    const bundlesPayload = []
    const boxesPayload = []
    this.masterBundleList.forEach(bundle => {
      const bunPayload = {
        'id': bundle.id,
        'label': bundle.label,
        'color':{
          'r': bundle.color.r,
          'g': bundle.color.g,
          'b': bundle.color.b,
        },
      }
      bundlesPayload.push(bunPayload)

      bundle.boxes.forEach(box => {
        const bPayload = {
          'id': box.id,
          'bundle_id': bundle.id,
          'x1': box.point1.x,
          'y1': box.point1.y,
          'x2': box.point2.x,
          'y2': box.point2.y,
          'layers': box.levels,
        }
        boxesPayload.push(bPayload)
      });
    });

    const linkKeys = Object.keys(this.links()).sort()
    const linksPayload = []
    for (let i = 0; i < linkKeys.length; i++) {
      const lk = linkKeys[i];
      const link = this.fetchLink(lk)
      const lPayload = {
        'bundle0_id': link.bundle0.id,
        'bundle1_id': link.bundle1.id,
      }
      linksPayload.push(lPayload)
    }

    return {
      'bundles': bundlesPayload,
      'boxes': boxesPayload,
      'links': linksPayload,
    }
  }
}

class BoardConfig {
  config = {}

  constructor(type="default", configHash = {}){
    if (type == "default"){
      this.config = {
        'boxConfig': {
          'boxConfigurable':true
        },
        'bundleConfig':{
          'defaultColor' : {
            'r':0,
            'g':0,
            'b':255
          },
          'label':{
            'show':true,
            'color':{
              'r':255,
              'g':255,
              'b':255
            },
          },
          'selectedIndicator': {
            'indicator' : 'innerDotColor',
            'color': {
              'r':255,
              'g':255,
              'b':255
            }
          },
        }
      }
    } else if (type == "hash"){
      this.config = {
        'boxConfig': {
          'boxConfigurable':configHash['boxConfig']['boxConfigurable']
        },
        'bundleConfig':{
          'defaultColor' : configHash['bundleConfig']['defaultColor'],
          'label': configHash['bundleConfig']['label'],
          'selectedIndicator': configHash['bundleConfig']['selectedIndicator'],
        }
      }
    }
  }
}


@Component({
  components:{
    toolbar,
    OptionPanel,
    Splitpanes,
    Pane
  },
  props:['windowTitle','id'],
})
export default class Board extends Vue{
  title = "New Board"
  isBrushing = false;
  brushPoints: Point[] = [null,null];
  graph = new Graph([])
  selectedBoxId = null;
  selectedBundles = [];
  tpName = null;
  prevDragPoint = null;
  opIsEditing = false;
  posMapping = new PosMapper();
  showSecondaryPanes = false
  showOptionPane = false
  data = {}

  saved = true
  bundleDataset = {}


  config = new BoardConfig()
  tempConfig = null
  tempBoxConfigurable = false
  tempBundleDefaultColorR = null
  tempBundleDefaultColorG = null
  tempBundleDefaultColorB = null
  tempBundleShowLabel = null
  tempBundleLabelColorR = null
  tempBundleLabelColorG = null
  tempBundleLabelColorB = null
  tempSelectedBundleOption = null
  tempBundleDotColorR = null
  tempBundleDotColorG = null
  tempBundleDotColorB = null
  tempSelectedBundleFillColorR = null
  tempSelectedBundleFillColorG = null
  tempSelectedBundleFillColorB = null

  @Watch('title')
  onPropertyChanged(value: string, oldValue: string) {
    console.log("CHNAGED");

    this.$emit('title-changed', value)
  }


  created(){
    window.addEventListener('keydown', (event) =>{
      if (!this.opIsEditing && event.keyCode == 8) {
        this.deleteKeyDown()
      }
    })

    console.log("CREATED");

    const path = `http://localhost:5000/boards/${this.id}`
    axios.get(path)
      .then((response) => {
        console.log("Fetched Board");

        console.log(response);
        if (response.data.message == "Board not found"){
          axios.post(path, this.buildBoardApiPayload())
            .then((response) => {
              console.log("Success");

              // const newId = response.data['new_id']
              // this.$emit('new-board-id', newId)
              this.title = "New Board"
            })
            .catch((error) => {
              console.log(error);
            });

        } else {
          this.buildBoardFromApi(response.data.board)
        }
      })
      .catch((error) => {
        console.log(error);
      })

    // if (!this.id){
    //   const path = 'http://localhost:5000/boards';
    //   axios.post(path, this.buildBoardApiPayload())
    //   .then((response) => {
    //
    //     const newId = response.data['new_id']
    //     this.$emit('new-board-id', newId)
    //     this.title = "New Board"
    //   })
    //   .catch((error) => {
    //     console.log(error);
    //   });
    // } else {
    //   const path = `http://localhost:5000/boards/${this.id}`
    //   console.log(path);
    //
    //   // Board Already generated. Fetch board
    //   axios.get(path)
    //     .then((response) => {
    //       console.log("Fetched Board");
    //
    //       console.log(response);
    //       this.buildBoardFromApi(response.data.board)
    //     })
    //     .catch((error) => {
    //       console.log(error);
    //     })
    // }
  }

  buildBoardFromApi(boardPayload){

    const graphPayload = boardPayload['graph']

    console.log("JBuild");

    console.log(graphPayload);
    this.clearGraph()

    this.graph = new Graph([])



    for (let i = 0; i < graphPayload['bundles'].length; i++) {
      const bnPayload = graphPayload['bundles'][i]
      const newBundle = new Bundle([],bnPayload['label'], bnPayload['id'],bnPayload['color'])
      this.graph.pushBundle(newBundle)
    }

    for (let i = 0; i < graphPayload['boxes'].length; i++) {
      const bxPayload = graphPayload['boxes'][i];
      const pixel1X = this.posMapping.translatePoint(bxPayload['x1'],true)
      const pixel1Y = this.posMapping.translatePoint(bxPayload['y1'],false)
      const pixel1 = {x: pixel1X, y: pixel1Y}
      const point1 = {x: bxPayload['x1'], y: bxPayload['y1']}
      const pixel2X = this.posMapping.translatePoint(bxPayload['x2'],true)
      const pixel2Y = this.posMapping.translatePoint(bxPayload['y2'],false)
      const pixel2 = {x: pixel2X, y: pixel2Y}
      const point2 = {x: bxPayload['x2'], y: bxPayload['y2']}
      const newBox = new Box(pixel1,pixel2,point1,point2,bxPayload['id'],bxPayload['layers'])
      console.log(bxPayload['bundle_id']);

      const bundle = this.graph.fetchBundle(bxPayload['bundle_id'])
      bundle.appendBoxes([newBox])
    }



    for (let i = 0; i < graphPayload['links'].length; i++) {
      const linkPayload = graphPayload['links'][i];
      const bundle0 = this.graph.fetchBundle(linkPayload['bundle0_id'])
      const bundle1 = this.graph.fetchBundle(linkPayload['bundle1_id'])
      const newLink = new Link(bundle0, bundle1)
      this.graph.pushLink(newLink)
    }

    // console.log(this.graph);

    this.data = boardPayload['data']


    this.refreshAllBundles()

  }

  clearGraph(){
    const canvas = select('#canvas_'+this.id)

    const linkKeys = Object.keys(this.graph.links())
    for (let i = 0; i < linkKeys.length; i++) {
      const lk = linkKeys[i];
      const link = this.graph.fetchLink(lk)
      this.removeLink(link)
    }

    this.graph.bundles().forEach(bundle => {
      this.removeDrawBundle(bundle.id)
    });

  }

  buildBoardApiPayload(){
    const graphPayload = this.graph.getApiPayload()
    console.log(this.windowTitle );

    const payload = {
      'title': (this.windowTitle ? this.windowTitle : "No Title"),
      'config': {
        'box_configurable': this.config.config['boxConfig']['boxConfigurable'],
        'bundle_default_color': this.config.config['bundleConfig']['defaultColor'],
        'bundle_label_config': this.config.config['bundleConfig']['label'],
        'bundle_selected_indicator': this.config.config['bundleConfig']['selectedIndicator']
      },
      'graph': graphPayload,
      'data':[],
    }
    return payload
  }


  // // TODO
  // loadJson(){
  //   const path = `http://localhost:5000/boards/${this.id}`;
  //   axios.get(path)
  //     .then((res) => {
  //       this.books = res.data.books;
  //     })
  //     .catch((error) => {
  //       // eslint-disable-next-line
  //       console.error(error);
  //     });
  // }


  mouseDown(evt: MouseEvent){
    const point: Point = this.fetchBrushPoint(evt);
    this.tpName = this.isInCircle(point)
    if (this.tpName){
      return
    }

    const selectedBox = this.findSelectedBox()[1]
    if (selectedBox && this.isInBox(selectedBox,point,true) ){
      this.prevDragPoint = point
      return
    }

    if (this.isInSelectedBundle(point)){
      this.prevDragPoint = point
      return
    }


    const foundBundle = this.inABundle(point, false)
    if (foundBundle){
      let inSelectedBundle = false
      for (let i = 0; i < this.selectedBundles.length; i++) {
        const bundle = this.selectedBundles[i];
        if (bundle.id == foundBundle.id) {
          inSelectedBundle = true
          break
        }
      }
      if (!inSelectedBundle){
        this.selectedBundles = [foundBundle]
      }
      this.selectedBoxId = null
      this.prevDragPoint = point

      const linkKeys = Object.keys(this.graph.links())

      this.showOP()
      this.refreshBundleData()
      this.clearBoxTouchPoints()
      this.refreshAllBundles()
      return
    }

    this.refreshBundleData()
    this.selectedBundles = []
    this.selectedBoxId = null
    this.isBrushing = true;
    this.setBrushPoint(true, point);
    this.clearBoxTouchPoints()
    this.refreshAllBundles()
  }

  rightMouseDown(evt: MouseEvent){
    const point = this.fetchBrushPoint(evt);

    const foundSelectedBoxId = this.isInBoxes(point, this.selectedBundles)
    if (foundSelectedBoxId){
      this.selectedBoxId = foundSelectedBoxId
      this.selectedBundles = []
      this.prevDragPoint = point
      this.showOP()
      this.refreshAllBundles()
      return
    }

    const foundBoxId = this.isInBoxes(point)
    if (foundBoxId){
      this.selectedBoxId = foundBoxId
      this.selectedBundles = []
      this.prevDragPoint = point
      this.showOP()
      this.refreshAllBundles()
      return
    }

    return
  }

  mouseMove(evt: MouseEvent) {
    const point = this.fetchBrushPoint(evt);
    if (this.tpName){
      this.readjustBox(point);
      return;
    }

    if (this.prevDragPoint){
      const boxes = []
      const bundleBox = this.findSelectedBox()
      const box = bundleBox[1]
      const boxIsSelected = box != null
      if (box){
        boxes.push(box)
      } else {
        this.selectedBundles.forEach(bundle => {
          bundle.boxes.forEach(box => {
            boxes.push(box)
          });
        });
      }

      const displacementX = point.x - this.prevDragPoint.x
      const displacementY = point.y - this.prevDragPoint.y
      boxes.forEach(box => {
        box.pixel1.x += displacementX
        box.pixel1.y += displacementY
        box.pixel2.x += displacementX
        box.pixel2.y += displacementY

        // // Debug
        // console.log("box.pixel1.x");
        // console.log(box.pixel1.x)
        // console.log("box.pixel1.y");
        // console.log(box.pixel1.y)
        // console.log("box.pixel2.x");
        // console.log(box.pixel2.x)
        // console.log("box.pixel2.y");
        // console.log(box.pixel2.y)
        // console.log("");

        box.point1 = this.posMapping.translatePixel(box.pixel1)
        box.point2 = this.posMapping.translatePixel(box.pixel2)
      });

      if (boxIsSelected){
        this.drawBundle(bundleBox[0])
        // const bundleId = bundleBox[0].id
        // this.removeDrawBundle(bundleId)
        // this.drawBox(box.pixel1, box.pixel2, box.id, bundleId)
      } else {
        this.selectedBundles.forEach(bundle => {
          this.drawBundle(bundle)
        });
      }
      this.prevDragPoint = point

      if (!boxIsSelected){
        const movedLinks = new Set()
        const allLinkKeys = Object.keys(this.graph.links())
        for (let i = 0; i < this.selectedBundles.length; i++) {
          const sBundle = this.selectedBundles[i];
          const bundleLinks = allLinkKeys.filter(l => l.startsWith(sBundle.id)); // TODO: Optimize
          for (let j = 0; j < bundleLinks.length; j++) {
            const linkId = bundleLinks[j];
            const link = this.graph.fetchLink(linkId)
            if (movedLinks.has(link.id) || movedLinks.has(link.inverseId())){
              continue
            }
            this.drawLink(link)
            movedLinks.add(link.id)
          }
        }
      }

      return
    }

    if (!this.isBrushing) {
      return;
    }

    this.setBrushPoint(false, point);
    this.drawBox(this.brushPoints[0], this.brushPoints[1], 'temp', null);

  }

  mouseUp(evt: MouseEvent){
    this.mouseDone(evt,true)
  }

  mouseLeave(evt: MouseEvent){
    this.mouseDone(evt)
  }

  mouseDone(evt: MouseEvent){
    if (this.isBrushing && this.brushPoints[1]){
      const point1 = this.posMapping.translatePixel(this.brushPoints[0])
      const point2 = this.posMapping.translatePixel(this.brushPoints[1])
      const newBox = new Box(this.brushPoints[0],this.brushPoints[1],point1,point2)
      const newBundleColor = {
        'r': this.config.config['bundleConfig']['defaultColor']['r'],
        'g': this.config.config['bundleConfig']['defaultColor']['g'],
        'b': this.config.config['bundleConfig']['defaultColor']['b'],
      }
      this.selectedBoxId = newBox.id
      this.selectedBundles = []
      this.graph.pushBundle(new Bundle([newBox],"",uuid(),newBundleColor))
      this.brushPoints = [null,null]
      this.isBrushing = false;
      this.removeBox('temp')
      this.refreshAllBundles()
      this.isBrushing = false;
      this.prevDragPoint = null;
      this.showOP()
      // this.getMessage()
      this.saved = false
      return
    }

    if (this.tpName){
      this.tpName = null
    }

    this.isBrushing = false;
    this.prevDragPoint = null;
    this.refreshAllBundles()
  }

  altMouseDown(evt: MouseEvent){
    const point = this.fetchBrushPoint(evt);
    const foundBundle = this.inABundle(point, true)
    if (foundBundle){

      this.selectedBundles = [foundBundle]
      this.prevDragPoint = point

      this.refreshAllBundles()
    }
  }

  shiftMouseDown(evt: MouseEvent){
    const point = this.fetchBrushPoint(evt);

    const foundBundle = this.inABundle(point, false)
    if (foundBundle){
      this.selectedBundles.push(foundBundle)
      this.selectedBoxId = null
      this.clearBoxTouchPoints()
      this.refreshAllBundles()
      return
    }
  }

  deleteKeyDown(){
    if (this.selectedBundles.length > 0){
      this.selectedBundles.forEach(iterBundle => {
        this.removeSelectedBundle(iterBundle)
      });
      this.refreshAllBundles()
    } else if (this.selectedBoxId){
      this.removeSelectedBoxId()
      this.refreshAllBundles()
    }
  }

  removeBox(id){
    select(".box-" + id + "-" + this.id).remove();
  }


  clearBoxTouchPoints(){
    for (let i = 0; i < TOUCH_POINT_NAMES.length; i++) {
      const tp = TOUCH_POINT_NAMES[i];
      select('#canvas_' + this.id).select("." + tp + "_" + this.id).remove();
    }
  }


  isInCircle(point: Point){
    const selectedBox = this.findSelectedBox()[1]

    if (selectedBox == null){
      return null
    }

    for (let i = 0; i < TOUCH_POINT_NAMES.length; i++) {
      const tpName = TOUCH_POINT_NAMES[i];
      const selectCircle = select("." + tpName + "_" + this.id)



      const cx = selectCircle.attr("cx")
      const cy = selectCircle.attr("cy")

      const distX = Math.abs(point.x - cx)
      const distY = Math.abs(point.y - cy)
      const absDist = calcHypotenuse(distX, distY)

      if (absDist < CIRCLE_RADIUS) {
        return tpName
      }
    }
    return null
  }

  isInBoxes(point: Point, customBundleSet=this.graph.bundles()){
    for (let i = 0; i < customBundleSet.length; i++) {
      const bundle = customBundleSet[i];
      for (let j = 0; j < bundle.boxes.length; j++) {
        const iterBox = bundle.boxes[j];
        if (this.isInBox(iterBox,point,true)){
          return iterBox.id
        }
      }
    }
    return null
  }

  isInSelectedBundle(point: Point){
    for (let i = 0; i < this.selectedBundles.length; i++) {
      const sBundle = this.selectedBundles[i];
      if (this.isInBundle(sBundle, point)){
        return true
      }
    }
    return false
  }

  isInBundle(bundle: Bundle, point: Point){
    for (let i = 0; i < bundle.boxes.length; i++) {
      const iterBox = bundle.boxes[i];
      const inBox = this.isInBox(iterBox, point, true)
      if (inBox){
        return true
      }
    }
    return false
  }

  inABundle(point: Point, jump: boolean){
    let firstIndex = 0
    // If more than 2 selected bundles return nothing
    if (jump && this.selectedBundles.length > 1){
      return null
    }

    const bundleList = this.graph.bundles()

    if (jump && this.selectedBundles.length == 1){

      for (let i = 0; i < bundleList.length; i++) {
        const bundle = bundleList[i];
        if (bundle.id == this.selectedBundles[0].id) {
          firstIndex = i + 1
          break
        }
      }
    }

    for (let i = firstIndex; i < firstIndex + bundleList.length; i++) {
      const bundle = bundleList[i % bundleList.length];

      for (let j = 0; j < bundle.boxes.length; j++) {
        const iterBox = bundle.boxes[j];
        if (this.isInBox(iterBox, point, true)) {
          return bundle
        }
      }
    }
    return null

  }

  isInBox(box: Box, point: Point, pixel: boolean){
    let minx, maxx, miny, maxy = null
    if (pixel){
      minx = Math.min(box.pixel1.x, box.pixel2.x)
      maxx = Math.max(box.pixel1.x, box.pixel2.x)
      miny = Math.min(box.pixel1.y, box.pixel2.y)
      maxy = Math.max(box.pixel1.y, box.pixel2.y)
    } else {
      minx = Math.min(box.point1.x, box.point2.x)
      maxx = Math.max(box.point1.x, box.point2.x)
      miny = Math.min(box.point1.y, box.point2.y)
      maxy = Math.max(box.point1.y, box.point2.y)
    }

    return point.x >= minx && point.y >= miny && point.x <= maxx && point.y <= maxy

    // Some day, maybe we will implement rotation
    if (box.rotation == 0){
      return point.x >= minx && point.y >= miny && point.x <= maxx && point.y <= maxy
    }

    const centerX = (minx + maxx)/2
    const centerY = (miny + maxy)/2

    const radians = Math.PI/180 * box.rotation

    // https://math.stackexchange.com/a/1964911

    // P1 ------- P2
    //  |          |
    //  |          |
    //  |          |
    // P3 -------- P4

    const p1 = rotatePointAngleDegrees({x: centerX, y: centerY}, {x: minx, y: miny}, box.rotation)
    const p1X = p1.x; const p1Y = p1.y
    const p2 = rotatePointAngleDegrees({x: centerX, y: centerY}, {x: maxx, y: miny}, box.rotation)
    const p2X = p2.x; const p2Y = p2.y
    const p3 = rotatePointAngleDegrees({x: centerX, y: centerY}, {x: minx, y: maxy}, box.rotation)
    const p3X = p3.x; const p3Y = p3.y
    const p4 = rotatePointAngleDegrees({x: centerX, y: centerY}, {x: maxx, y: maxy}, box.rotation)
    const p4X = p4.x; const p4Y = p4.y

    // Line12

    if (p2X - p1X != 0){
      const p12Slope = (p2Y - p1Y) / (p2X - p1X)
      const p12Intercept = p1Y - (p12Slope * p1X)

      const expectedY12 = p12Slope * point.x + p12Intercept

      if ((p2X > p1X) && (point.y < expectedY12)){
        return false
      } else if ((p2X < p1X) && (point.y > expectedY12)) {
        return false
      }
    } else if ((p1Y < p2Y) && (point.x > p1X)) {
      return false
    } else if ((p2Y < p1Y) && (point.x < p1X)) {
      return false
    }

    // Line13
    if (p3X - p1X != 0){
      const p13Slope = (p3Y - p1Y) / (p3X - p1X)
      const p13Intercept = p1Y - (p13Slope * p1X)
      const expectedY13 = p13Slope * point.x + p13Intercept

      if ((p3X > p1X) && (point.y > expectedY13)){
        return false
      } else if ((p3X < p1X) && (point.y < expectedY13)){
        return false
      }


    } else if ((p1Y < p3Y) && (point.x < p1X)){
      return false
    } else if ((p3Y < p1Y) && (point.x > p1X)){
      return false
    }

    // Line24

    if (p4X - p2X != 0){
      const p24Slope = (p4Y - p2Y) / (p4X - p2X)
      const p24Intercept = p2Y - (p24Slope * p2X)
      const expectedY24 = p24Slope * point.x + p24Intercept

      if ((p4X > p2X) && (point.y < expectedY24)){
        return false
      } else if ((p4X < p2X) && (point.y > expectedY24)){
        return false
      }
    } else if ((p2Y < p4Y) && (point.x < p2X)){
      return false
    } else if ((p4Y < p2Y) && (point.x > p2X)){
      return false
    }


    // Line34

    if (p4X - p3X != 0){
      const p34Slope = (p4Y - p3Y) / (p4X - p3X)
      const p34Intercept = p3Y - (p34Slope * p3X)
      const expectedY34 = p34Slope * point.x + p34Intercept

      if ((p4X > p3X) && (point.y > expectedY34)){
        return false
      } else if ((p4X < p3X) && (point.y < expectedY34)){
        return false
      }
    } else if ((p3Y < p4Y) && (point.x < p3X)){
      return false
    } else if ((p4Y < p3Y) && (point.x > p3X)){
      return false
    }

    return true
  }

  setBrushPoint(isFirst: boolean, point){
    const index = isFirst ? 0 : 1
    this.brushPoints[index] = point
    if (isFirst){
      this.brushPoints[1] = null;
    }
  }

  fetchBrushPoint(evt: MouseEvent) {
    const e = select('#map_' + this.id).node();
    const dim = e.getBoundingClientRect();
    const offset = {
      left: evt.pageX,
      top: evt.pageY,
    };

    return { x: Math.abs(offset.left - dim.left - window.scrollX), y: Math.abs(offset.top - dim.top - window.scrollY) }
  }


  refreshAllBundles(){
    const linkKeys = Object.keys(this.graph.links())
    for (let i = 0; i < linkKeys.length; i++) {
      const lk = linkKeys[i];
      const link = this.graph.fetchLink(lk)
      if (link.bundle0.id < link.bundle1.id){
        this.drawLink(link)
      }
    }

    this.graph.bundles().forEach(bundle => {
      this.drawBundle(bundle)
    });

  }

  refresh(){
    const path = `http://localhost:5000/boards/${this.id}`
    console.log(path);

    axios.get(path)
      .then((response) => {
        console.log("J1");
        console.log(response);


        this.buildBoardFromApi(response.data.board)
      })
      .catch((error) => {
        console.log(error);
      })

  }

  drawCircle(element: string, x: Int, y: Int, radius: Int, color: string, parentElement) {
    const circle = parentElement.append('circle')
      .classed(element + "_" + this.id, true);


    circle
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', radius)
      .attr('fill',color)
      .attr('stroke','black')
      .attr('stroke-width',1)
  }

  drawBundle(bundle: Bundle){
    let bundleIsSelected = false
    for (let i = 0; i < this.selectedBundles.length; i++) {
      const selectedBundle = this.selectedBundles[i];

      if (selectedBundle.id == bundle.id){
        bundleIsSelected = true
        break
      }
    }

    this.removeDrawBundle(bundle.id)

    const canvas = select('#canvas_'+this.id)
    const bundleClass = 'bundle-' + bundle.id
    const greaterG = canvas.append('g').classed('bundle-' + bundle.id + "-" + this.id,true)
                        .attr("filter", "url(#constantOpacity)")



    for (let i = 0; i < bundle.boxes.length; i++) {
      const iterBox = bundle.boxes[i];
      if (i == 0){
        this.drawBox(iterBox.pixel1, iterBox.pixel2, iterBox.id, bundle.id, bundle.label, true, bundleIsSelected)
      } else {
        this.drawBox(iterBox.pixel1, iterBox.pixel2, iterBox.id, bundle.id)
      }
    }

    let bundleColorR = bundle.color.r
    let bundleColorG = bundle.color.g
    let bundleColorB = bundle.color.b
    if (bundleIsSelected && this.config.config['bundleConfig']['selectedIndicator']['indicator'] == "fillBundleColor"){
      bundleColorR = this.config.config['bundleConfig']['selectedIndicator']['color']['r']
      bundleColorG = this.config.config['bundleConfig']['selectedIndicator']['color']['g']
      bundleColorB = this.config.config['bundleConfig']['selectedIndicator']['color']['b']
    }
    const bundleColor = `rgb(${bundleColorR},${bundleColorG},${bundleColorB})`;


    greaterG
      .attr("fill",bundleColor)
      // .attr("fill-opacity",0.33)

  }

  drawBox(pixel1={}, pixel2={}, boxId="", bundleId="", bundleLabel = null, hasDot = false, bundleIsSelected = false){
    const boxIsTemp = boxId == "temp"
    if (boxIsTemp){
      this.removeBox(boxId)
    }


    const bundleClass = '.bundle-' + bundleId + "-" + this.id
    let gOfInterest = select(bundleClass)
    if (boxIsTemp){
      gOfInterest = select("#canvas_" + this.id)
    }

    const boxClass = "box-" + boxId + "-" + this.id
    let boxRect = gOfInterest.select(boxClass)
    if (boxRect.empty()){

      const attrs = getBrushBox(pixel1, pixel2);
      boxRect = gOfInterest.append('rect').classed(boxClass, true)
      boxRect
        .attr('x', attrs.x)
        .attr('y', attrs.y)
        .attr('width', attrs.width)
        .attr('height', attrs.height)
    }

    // First time drawing box
    if (boxIsTemp){

      let boxColorR = this.config.config['bundleConfig']['defaultColor']['r']
      let boxColorG = this.config.config['bundleConfig']['defaultColor']['g']
      let boxColorB = this.config.config['bundleConfig']['defaultColor']['b']

      if (this.config.config['bundleConfig']['selectedIndicator']['indicator'] == "fillBundleColor"){
        boxColorR = this.config.config['bundleConfig']['selectedIndicator']['color']['r']
        boxColorG = this.config.config['bundleConfig']['selectedIndicator']['color']['g']
        boxColorB = this.config.config['bundleConfig']['selectedIndicator']['color']['b']
      }
      const boxColor = `rgb(${boxColorR},${boxColorG},${boxColorB})`

      boxRect
        .attr("fill", boxColor)
        .attr("fill-opacity", 0.33)
    }
    if (this.config.config['bundleConfig']['selectedIndicator']['indicator'] == "fillBundleColor" && this.selectedBoxId == boxId){
      const boxColorR = this.config.config['bundleConfig']['selectedIndicator']['color']['r']
      const boxColorG = this.config.config['bundleConfig']['selectedIndicator']['color']['g']
      const boxColorB = this.config.config['bundleConfig']['selectedIndicator']['color']['b']
      const revisedBundleColor = `rgb(${boxColorR},${boxColorG},${boxColorB})`
      boxRect
        .attr("fill", revisedBundleColor)
        .attr("fill-opacity", 0.33)
    }



    if (this.config.config['bundleConfig']['selectedIndicator']['indicator'] == "innerDotColor" && hasDot){
      // const greaterG = select('.bundle-' + bundleId)

      const circle = gOfInterest.append('circle').classed("dot-" + bundleId + "-" + this.id, true)
      const centerX = (pixel1.x + pixel2.x)/2
      const centerY = (pixel1.y + pixel2.y)/2

      circle
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', CIRCLE_RADIUS)
        .attr('fill',"black")

      if (bundleIsSelected){
        const smallCircle = gOfInterest.append('circle').classed("dot-" + bundleId+ "-" + this.id, true)
        const smallCircleColorR = this.config.config['bundleConfig']['selectedIndicator']['color']['r']
        const smallCircleColorG = this.config.config['bundleConfig']['selectedIndicator']['color']['g']
        const smallCircleColorB = this.config.config['bundleConfig']['selectedIndicator']['color']['b']
        const smallCirlceColor = `rgb(${smallCircleColorR},${smallCircleColorG},${smallCircleColorB})`

        smallCircle
          .attr('cx', centerX)
          .attr('cy', centerY)
          .attr('r', CIRCLE_RADIUS-2)
          .attr('fill',smallCirlceColor)
      }
    }

    if (this.config.config['bundleConfig']['label']['show'] && bundleLabel){
      // const greaterG = select('.bundle-' + bundleId)

      const label = gOfInterest.append('text').classed("label-" + bundleId + "-" + this.id, true)
      const centerX = (pixel1.x + pixel2.x)/2
      const centerY = (pixel1.y + pixel2.y)/2
      const labelColorR = this.config.config['bundleConfig']['label']['color']['r']
      const labelColorG = this.config.config['bundleConfig']['label']['color']['g']
      const labelColorB = this.config.config['bundleConfig']['label']['color']['b']
      const labelColor = `rgb(${labelColorR},${labelColorG},${labelColorB})`

      label
        .text(function(d){return bundleLabel.length > 9 ? bundleLabel.substring(0,8) + "..." : bundleLabel})
        .attr('x',centerX)
        .attr('y',centerY)
        .style("text-anchor", "middle")
        .attr("font-size",'0.3em')
        .attr("fill",labelColor)
    }

    if (this.selectedBoxId == boxId) {
      this.drawCircle(TOUCH_POINT_NAMES[0], pixel1.x, pixel1.y, CIRCLE_RADIUS, "red", gOfInterest)
      this.drawCircle(TOUCH_POINT_NAMES[1], (pixel1.x+pixel2.x)/2, pixel1.y, CIRCLE_RADIUS, "white", gOfInterest)
      this.drawCircle(TOUCH_POINT_NAMES[2], pixel2.x, pixel1.y, CIRCLE_RADIUS, "white", gOfInterest)
      this.drawCircle(TOUCH_POINT_NAMES[3], pixel1.x, (pixel1.y + pixel2.y)/2, CIRCLE_RADIUS, "white", gOfInterest)
      this.drawCircle(TOUCH_POINT_NAMES[4], pixel2.x, (pixel1.y + pixel2.y)/2, CIRCLE_RADIUS, "white", gOfInterest)
      this.drawCircle(TOUCH_POINT_NAMES[5], pixel1.x, pixel2.y, CIRCLE_RADIUS, "white", gOfInterest)
      this.drawCircle(TOUCH_POINT_NAMES[6], (pixel1.x+pixel2.x)/2, pixel2.y, CIRCLE_RADIUS, "white", gOfInterest)
      this.drawCircle(TOUCH_POINT_NAMES[7], pixel2.x, pixel2.y, CIRCLE_RADIUS, "green", gOfInterest)
    }
  }

  drawLink(link: Link){
    const box0 = link.bundle0.boxes[0]
    const box1 = link.bundle1.boxes[0]

    const pixel1X = (box0.pixel1.x + box0.pixel2.x)/2
    const pixel1Y = (box0.pixel1.y + box0.pixel2.y)/2
    const pixel2X = (box1.pixel1.x + box1.pixel2.x)/2
    const pixel2Y = (box1.pixel1.y + box1.pixel2.y)/2

    this.removeLink(link)
    const canvas = select('#canvas_'+this.id)
    const lineLinkId = "link_" + link.id + "_" + this.id
    const line = canvas.append('line').classed(lineLinkId, true)

    line
      .attr("x1", pixel1X)
      .attr("x2", pixel2X)
      .attr("y1", pixel1Y)
      .attr("y2", pixel2Y)
      .attr("stroke","black")
      .attr("stroke-width",1)
  }

  removeLink(link){
    const canvas = select('#canvas_'+this.id)
    const lineLinkId = "link_" + link.id + "_" + this.id
    const inverseLineLinkId = "link_" + link.inverseId() + "_" + this.id
    if (!select("." + lineLinkId).node() && !select("." + inverseLineLinkId).node()){
      console.log("First Time drawing line");
    } else if (!select("." + lineLinkId).node() && select("." + inverseLineLinkId).node()){
      canvas.select("." + inverseLineLinkId).remove()
    } else {
      canvas.select("." + lineLinkId).remove()
    }
  }


  findSelectedBoxAttrs(){
    const box = this.findSelectedBox()[1]
    if (!box){
      return {
        point1X: null,
        point1Y: null,
        point2X: null,
        point2Y: null
      }
    } else {
      return {
        point1X: box.point1.x,
        point1Y: box.point1.y,
        point2X: box.point2.x,
        point2Y: box.point2.y
      }
    }

  }

  findSelectedBox(){
    if (!this.selectedBoxId) {
      return [null,null]
    }
    for (let i = 0; i < this.graph.bundles().length; i++) {
      const bundle = this.graph.bundles()[i];
      for (let j = 0; j < bundle.boxes.length; j++) {
        const box = bundle.boxes[j];
        if (box.id == this.selectedBoxId) {
          return [bundle,box]
        }
      }
    }
    return [null,null]
  }

  getSliceOptions(){
    const box = this.findSelectedBox()[1]
    if (!box){ return [null,null] }
    if (!this.inOverlap(box)) {return [null,null]}
    return box.levels
  }

  setDimension(type, value){
    const intValue = parseInt(value)

    const box = this.findSelectedBox()[1]

    if (type == "point1X"){
      const pixel = this.posMapping.translatePoint(value,true)
      box.pixel1.x = pixel
    } else if (type == "point1Y") {
      const pixel = this.posMapping.translatePoint(value,false)
      box.pixel1.y = pixel
    } else if (type == "point2X") {
      const pixel = this.posMapping.translatePoint(value,true)
      box.pixel2.x = pixel
    } else if (type == "point2Y") {
      const pixel = this.posMapping.translatePoint(value,false)
      box.pixel2.y = pixel
    }
    this.drawBox(box.pixel1, box.pixel2, box.id, null)
    this.saved = false
  }

  readjustBox(pixel: Point){
    const selectedContent = this.findSelectedBox()
    const box = selectedContent[1]
    if (this.tpName == TOUCH_POINT_NAMES[0]){
      box.pixel1 = pixel
      box.point1 = this.posMapping.translatePixel(pixel)
    } else if (this.tpName == TOUCH_POINT_NAMES[1]){
      box.pixel1.y = pixel.y
      box.point1 = this.posMapping.translatePixel({x: box.pixel1.x, y: pixel.y})
    } else if (this.tpName == TOUCH_POINT_NAMES[2]){
      box.pixel1.y = pixel.y
      box.pixel2.x = pixel.x
      box.point1 = this.posMapping.translatePixel({x: box.pixel1.x, y: pixel.y})
      box.point2 = this.posMapping.translatePixel({x: pixel.x, y: box.pixel2.y})
    } else if (this.tpName == TOUCH_POINT_NAMES[3]){
      box.pixel1.x = pixel.x
      box.point1 = this.posMapping.translatePixel({x: pixel.x, y: box.pixel1.y})
    } else if (this.tpName == TOUCH_POINT_NAMES[4]){
      box.pixel2.x = pixel.x
      box.point2 = this.posMapping.translatePixel({x: pixel.x, y: box.pixel2.y})
    } else if (this.tpName == TOUCH_POINT_NAMES[5]){
      box.pixel1.x = pixel.x
      box.pixel2.y = pixel.y
      box.point1 = this.posMapping.translatePixel({x: pixel.x, y: box.pixel1.y})
      box.point2 = this.posMapping.translatePixel({x: box.pixel2.x, y: pixel.y})
    } else if (this.tpName == TOUCH_POINT_NAMES[6]){
      box.pixel2.y = pixel.y
      box.point2 = this.posMapping.translatePixel({x: box.pixel2.x, y: pixel.y})
    } else if (this.tpName == TOUCH_POINT_NAMES[7]){
      box.pixel2 = pixel
      box.point2 = this.posMapping.translatePixel(pixel)
    } else {
      return
    }
    const selectedBundle = selectedContent[0]
    if (selectedBundle == null){
      this.drawBox(box.pixel1, box.pixel2, box.id, null)
    } else {
      this.removeBox(box.id)
      this.clearBoxTouchPoints()
      this.drawBox(box.pixel1, box.pixel2, box.id, selectedBundle.id)
    }

    this.saved = false
  }

  removeSelectedBoxId(){
    const bundleList: Bundle[] = this.graph.bundles()
    let foundBundleIndex = ""
    for (let i = 0; i < bundleList.length; i++) {
      const bundle = bundleList[i];
      let matchedIndex = -1
      for (let j = 0; j < bundle.boxes.length; j++) {
        const iterBox = bundle.boxes[j];
        if (this.selectedBoxId == iterBox.id){
          matchedIndex = i
          break
        }
      }
      if (matchedIndex != -1){
        foundBundleIndex = i
        bundle.boxes.splice(matchedIndex,1)
        break
      }
    }


    if (foundBundleIndex != "" && bundleList[foundBundleIndex].boxes.length == 0){
      delete bundleList[foundBundleIndex]
    }

    const deletedBoxId = this.selectedBoxId
    this.selectedBoxId = null
    this.removeBox(deletedBoxId)
    this.clearBoxTouchPoints()
  }

  removeSelectedBundle(bundle: Bundle){
    this.selectedBundles.forEach(bundle => {
      this.graph.removeId(bundle.id)
      this.removeDrawBundle(bundle.id)

    });
    this.selectedBundles = []

    return
  }

  removeDrawBundle(bundleId: string){
    select(".bundle-" + bundleId + "-" + this.id).remove();
  }

  // showOptionPanel(){
  //   return this.selectedBoxId != null || this.selectedBundles.length > 0
  // }

  toggleOpIsEditing(editing: boolean){
    this.opIsEditing = editing
  }

  getBundleIds(){
    const bundleIds = []
    this.selectedBundles.forEach(bundle => {
      bundleIds.push(bundle.id)
    });

    return bundleIds
  }

  glueSelectedBundles(){
    const selectedBoxes = []
    const bundleIndices = []
    let newBundleName = ""
    const newBundleColor = this.selectedBundles[0].color

    for (let i = 0; i < this.selectedBundles.length; i++) {
      const bundle = this.selectedBundles[i];
      if (newBundleName == ""){
        newBundleName = bundle.label
      }
      for (let j = 0; j < bundle.boxes.length; j++) {
        const box = bundle.boxes[j];
        selectedBoxes.push(box)
      }
      bundleIndices.unshift([i,bundle.id])
      this.removeDrawBundle(bundle.id)
    }

    bundleIndices.forEach(pair => {
      const index = pair[0]
      const bundleId = pair[1]
      this.graph.removeId(bundleId)
    });

    const newBundle = new Bundle(selectedBoxes, newBundleName, uuid(), newBundleColor)
    this.graph.pushBundle(newBundle)

    this.selectedBundles = [newBundle]
    this.refreshAllBundles()
  }

  linkSelectedBundles(){
    const selectedBundleCount = this.selectedBundles.length

    for (let i = 0; i < selectedBundleCount; i++) {
      const bundle0 = this.selectedBundles[i]
      for (let j = 0; j < selectedBundleCount; j++) {
        const bundle1 = this.selectedBundles[j];
        if (bundle0.id != bundle1.id){
          const newLink = new Link(bundle0,bundle1)
          this.graph.pushLink(newLink)
        }
      }
    }

    this.refreshAllBundles()
  }

  getBundleObj(){
    if (this.selectedBundles.length == 1){
      return {bundleLabel: this.selectedBundles[0].label,
              bundleRColor: this.selectedBundles[0].color.r,
              bundleGColor: this.selectedBundles[0].color.g,
              bundleBColor: this.selectedBundles[0].color.b}
    } else {
      return {bundleLabel: null,
              bundleRColor: null,
              bundleGColor: null,
              bundleBColor: null}
    }
  }

  setBundleLabel(bundleLabel){
    this.selectedBundles[0].setLabel(bundleLabel)
    this.refreshAllBundles()
    this.saved = false
  }

  setColor(colorValue, type){
    this.selectedBundles[0].setColor(colorValue,type)
    this.refreshAllBundles()
    this.saved = false
  }

  setRColor(colorValue){
    this.setColor(colorValue,"r")
  }

  setGColor(colorValue){
    this.setColor(colorValue,"g")
  }

  setBColor(colorValue){
    this.setColor(colorValue,"b")
  }

  setSliceLevel(options){
    const box = this.findSelectedBox()[1]
    if (!box){ return null }
    box.levels = [options['topChecked'],options['bottomChecked']]
    this.saved = false
  }

  inOverlap(box){
    const pointsOfInterest = [
      {x: 227, y: 2575},
      {x: 521, y: 2043}
    ]

    const minx = Math.min(box.point1.x, box.point2.x)
    const maxx = Math.max(box.point1.x, box.point2.x)
    const miny = Math.min(box.point1.y, box.point2.y)
    const maxy = Math.max(box.point1.y, box.point2.y)

    // https://stackoverflow.com/a/306332
    // https://silentmatt.com/rectangle-intersection/
    return pointsOfInterest[0].x < maxx && pointsOfInterest[1].x > minx && pointsOfInterest[1].y < maxy && pointsOfInterest[0].y > miny
  }

  // getMessage() {
  //   const path = 'http://localhost:8080/ping';
  //   axios.get(path)
  //     .then((res) => {
  //       console.log(res.data);
  //
  //       // this.msg = ;
  //     })
  //     .catch((error) => {
  //       // eslint-disable-next-line
  //       console.error(error);
  //     });
  // }

  loadCsv(event){
    const f = event.target.files[0]
    const reader = new FileReader();

    // Closure to capture the file information.
    reader.onload = this.loadHandler

    // Read in the image file as a data URL.
    reader.readAsText(f);
  }

  download(){
    const blob = this.graph.createCsvBlob()

    const a         = document.createElement('a');
    a.href        = 'data:attachment/csv,' + blob;
    a.target      = '_blank';
    a.download    = 'myFile.csv';

    document.body.appendChild(a);
    a.click();
  }

  save(){
    const path = `http://localhost:5000/boards/${this.id}`;

    axios.put(path, this.buildBoardApiPayload())
      .then((response) => {
        this.saved = true
        this.$emit('saved',this.id)

      })
      .catch((error) => {
        // eslint-disable-next-line
        console.log(error);
      });
  }

  loadHandler(event) {
    const csvBlob = event.target.result;
    this.graph.parseCsv(csvBlob,this.posMapping)
    this.refreshAllBundles()
  }


  showOP(){
    this.showSecondaryPanes = true
    this.showOptionPane = true
  }

  loadOptions(){
    this.$refs['option-modal'].show()
  }

  openConfig(){
    this.tempConfig = cloneDeep(this.config.config)
    this.tempBoxConfigurable = this.tempConfig['boxConfig']['boxConfigurable']
    this.tempBundleDefaultColorR = this.tempConfig['bundleConfig']['defaultColor']['r']
    this.tempBundleDefaultColorG = this.tempConfig['bundleConfig']['defaultColor']['g']
    this.tempBundleDefaultColorB = this.tempConfig['bundleConfig']['defaultColor']['b']
    this.tempBundleShowLabel = this.tempConfig['bundleConfig']['label']['show']
    this.tempBundleLabelColorR = this.tempConfig['bundleConfig']['label']['color']['r']
    this.tempBundleLabelColorG = this.tempConfig['bundleConfig']['label']['color']['g']
    this.tempBundleLabelColorB = this.tempConfig['bundleConfig']['label']['color']['b']
    this.tempSelectedBundleOption = this.tempConfig['bundleConfig']['selectedIndicator']['indicator']
    if (this.tempSelectedBundleOption == "innerDotColor" || this.tempSelectedBundleOption == "fillBundleColor"){
      this.tempBundleDotColorR = this.tempConfig['bundleConfig']['selectedIndicator']['color']['r']
      this.tempBundleDotColorG = this.tempConfig['bundleConfig']['selectedIndicator']['color']['g']
      this.tempBundleDotColorB = this.tempConfig['bundleConfig']['selectedIndicator']['color']['b']
    }
  }

  saveConfig(){
    const newConfig = {
      'boxConfig' : {
        'boxConfigurable': this.tempBoxConfigurable
      },
      'bundleConfig' : {
        'defaultColor': {
          'r': this.tempBundleDefaultColorR,
          'g': this.tempBundleDefaultColorG,
          'b': this.tempBundleDefaultColorB,
        },
        'label':{
          'show':this.tempBundleShowLabel,
          'color':{
            'r': this.tempBundleLabelColorR,
            'g': this.tempBundleLabelColorG,
            'b': this.tempBundleLabelColorB
          },
        },
        'selectedIndicator': {
          'indicator' : this.tempSelectedBundleOption,
          'color': {
            'r': this.tempBundleDotColorR,
            'g': this.tempBundleDotColorG,
            'b': this.tempBundleDotColorB
          }
        },
      }
    }
    this.config = new BoardConfig('hash', newConfig)
    this.refreshAllBundles()
  }

  getRgbCode(r,g,b){
    if (r == null || g == null || b == null){
      return "#ffffff"
    }
    return "#" + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
  }

  componentToHex(c){
    const hex = (c).toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }

  hexToRgb(value){
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value);
    return {
      'r': parseInt(result[1], 16),
      'g': parseInt(result[2], 16),
      'b': parseInt(result[3], 16)
    }
  }

  hexToTempBundleRgb(value) {
    const rgbValue = this.hexToRgb(value)

    this.tempBundleDefaultColorR = rgbValue['r']
    this.tempBundleDefaultColorG = rgbValue['g']
    this.tempBundleDefaultColorB = rgbValue['b']
  }

  hexToTempBundleDotRgb(value){
    const rgbValue = this.hexToRgb(value)

    this.tempBundleDotColorR = rgbValue['r']
    this.tempBundleDotColorG = rgbValue['g']
    this.tempBundleDotColorB = rgbValue['b']
  }

  hexToTempBundleLabelRgb(value){
    const rgbValue = this.hexToRgb(value)

    this.tempBundleLabelColorR = rgbValue['r']
    this.tempBundleLabelColorG = rgbValue['g']
    this.tempBundleLabelColorB = rgbValue['b']
  }

  refreshBundleData(){
    if (!("data" in this.data)){
      return this.bundleDataset = []
    }
    const returnData = []
    const dataSet = new Set()
    for (let i = 0; i < this.selectedBundles.length; i++) {
      const bundleId = this.selectedBundles[i].id;
      const rawData = this.data["data"][bundleId]
      const header = this.data["header"]
      for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
        const row = rawData[rowIndex];
        const rowData = {}
        const flag = [rowData[0],row[1],row[2],row[3],row[6]].join("_")
        if (dataSet.has(flag)){
          continue
        }
        for (let hIndex = 0; hIndex < header.length; hIndex++) {
          const h = header[hIndex];
          rowData[h] = row[hIndex]
        }
        dataSet.add(flag)
        console.log(rowData);

        returnData.push(rowData)
      }


    }
    this.bundleDataset = returnData
  }


}
