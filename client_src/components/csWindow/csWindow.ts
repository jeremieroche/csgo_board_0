import Vue from 'vue';
import Component from 'vue-class-component';
import { select,event,scale,drag } from 'd3-selection';
import Board from '@/components/board/board.vue'
import Action from '@/components/action/action.vue'
import DemoInput from '@/components/demo-input/demo-input.vue'
import { v4 as uuid } from 'uuid';


@Component({
  components:{ Board, Action, DemoInput},
  props: ['windowWidth','windowHeight','windowTop','windowLeft','id','windowType']
})
export default class CsWindow extends Vue{
  windowOpen = true
  windowMarkForDeletion = false
  positions = {
        clientX: undefined,
        clientY: undefined,
        movementX: 0,
        movementY: 0
      }
  // windowType = ""
  selectedWindowType = ""
  titleMouseDownDateTime = null
  windowTitle = ""
  windowTitleTemp = ""
  windowTitleType = "newWindow"

  onOpen(){
    console.log("Helloooooo");
  }

  closeWindow(){
    if (this.windowType != 'demo'){
      this.windowOpen = false
    } else {
      this.windowMarkForDeletion = true
    }
  }

  windowMarkForDeletionGetter(){
    return {"obj": this.windowMarkForDeletion}
  }

  hardCloseWindow(){
    console.log("HARD");

    this.windowOpen = false
  }

  barMouseDown(event){
    console.log("Mouse Down");

    this.positions.clientX = event.clientX
    this.positions.clientY = event.clientY
    document.onmousemove = this.elementDrag
    document.onmouseup = this.closeDragElement
  }

  elementDrag(event) {

    this.positions.movementX = this.positions.clientX - event.clientX
    this.positions.movementY = this.positions.clientY - event.clientY
    this.positions.clientX = event.clientX
    this.positions.clientY = event.clientY
    // set the element's new position:



    const newPosition = {
      newTop: (this.$refs.windowContainer.offsetTop - this.positions.movementY),
      newLeft: (this.$refs.windowContainer.offsetLeft - this.positions.movementX),
    }

    this.$emit('barMove',newPosition)
  }

  closeDragElement() {
    console.log("Close");

    document.onmouseup = null
    document.onmousemove = null
  }

  changeToNonDefualt(evt){
    if (this.selectedWindowType == "board"){
      this.windowWidth = 800;
      this.windowHeight = 600;
    } else if (this.selectedWindowType == "action"){
      this.windowWidth = 500;
      this.windowHeight = 400;
    }
    this.$emit('windowChangeToNonDefault', this.selectedWindowType)
  }

  setTitle(){
    this.windowTitle = this.windowTitleTemp
    this.windowTitleType = "setWindowTitle"
  }

  headerTitleMouseDown(){
    console.log("Header Mouse Down");

    const newTime = new Date();
    console.log(newTime);
    if (this.titleMouseDownDateTime && (newTime - this.titleMouseDownDateTime) < 300){
      this.windowTitleType = "editTitle"
    }


    this.titleMouseDownDateTime = new Date();
  }

  heatmapGenerated(generatedHeatmapId){
    this.$emit('action-heatmap-generated',generatedHeatmapId)
  }

  rankingsGenerated(generatedRankingID){
    console.log("JHello");

    this.$emit('action-ranking-generated',generatedRankingID)
  }

  newBoardId(newId){
    this.$emit('boardNewId', newId)
  }

  boardSaved(boardId){
    console.log("HEllow World");

    this.$emit('board-saved',boardId)
  }

  setBoardDestination(actionId,actionType,sourceBoardId, destinationBoardId, bundleEntry, bundleArea, datasetId){

    this.$emit('setBoardDestination',actionId, actionType, sourceBoardId, destinationBoardId, bundleEntry, bundleArea, datasetId)
  }

  refresh(){
    console.log("JRefresh");

    this.$refs.board.refresh()
  }


}
