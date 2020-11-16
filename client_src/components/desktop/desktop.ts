import Vue from 'vue';
import Component from 'vue-class-component';
import desktopBar from '@/components/desktopBar/desktopBar.vue'
import { select,event,scale,drag } from 'd3-selection';
import CsWindow from '@/components/csWindow/csWindow.vue'
import axios from 'axios'
import { v4 as uuid } from 'uuid';


function setNewPosition(newPosition){
  this.windowTop = newPosition['newTop']
  this.windowLeft = newPosition['newLeft']
}


interface Bind {
  actionId: string;
  actionType: string;
  sourceBoardId: string;
  destinationBoardId: string;
  bundleEntry: string;
  bundleArea: string;
  datasetId: string;
}

@Component({
  components:{
    desktopBar,
    CsWindow,
  },
})
export default class Desktop extends Vue{
  boards = []
  windowCount = 1
  bindings = {}
  windows = {}

  newBoard(){
    this.createNewWindow()
  }

  createNewWindow(id = null, type = ""){
    console.log("New Window");

    let windowWidth = null
    let windowHeight = null
    if (type == "board"){
      windowWidth = "800"
      windowHeight = "600"
    } else {
      windowWidth = "400"
      windowHeight = "300"
    }

    if (id == null){
      id = uuid()
    }

    const newWindow = new CsWindow({
      propsData: {'windowWidth':windowWidth,
                  'windowHeight':windowHeight,
                  'windowTop':'100',
                  'windowLeft':'100',
                  'id': id,
                  'windowType' : type,
                },
    })
    newWindow.$on('barMove', setNewPosition)
    newWindow.$on('action-heatmap-generated', (generatedHeatmapId) => {
      this.createNewWindow(generatedHeatmapId, "board")
    })
    newWindow.$on('action-ranking-generated', (generatedRankingId) => {
      console.log("JROCHE");

      console.log(generatedRankingId);
      this.createNewWindow(generatedRankingId, "board")
    })
    newWindow.$on('boardNewId', function(newBoardId){
      this.id = newBoardId
    })
    newWindow.$on('windowChangeToNonDefault', function (newWindowType) {
      this.windowType = newWindowType
    })
    newWindow.$on('board-saved', (boardId) =>{
      const bindingKeys = Object.keys(this.bindings)
      console.log("JBOARD-Saved");

      console.log(bindingKeys);
      for (let i = 0; i < bindingKeys.length; i++) {
        const actionId = bindingKeys[i];
        const bind = this.bindings[actionId]
        if (bind['sourceBoardId'] != boardId){
          continue
        }
        const path = `http://localhost:5000/boards/bind/${actionId}/refresh`
        console.log(path);

        axios.post(path,{})
          .then((response) => {
            console.log("Save Success");
            this.windows[bind['destinationBoardId']].refresh()

          })
          .catch((error) => {
            console.error(error);
            this.generating = false
          });

      }
    })
    newWindow.$on('setBoardDestination', (actionId, actionType, sourceBoardId, destinationBoardId, bundleEntry, bundleArea, datasetId) => {
      this.bindings[actionId] = {
        actionId: actionId,
        actionType: actionType,
        sourceBoardId: sourceBoardId,
        destinationBoardId: destinationBoardId,
        bundleEntry: bundleEntry,
        bundleArea: bundleArea,
        datasetId: datasetId,
      }
      const path = "http://localhost:5000/boards/bind"
      const postPayload = {
        'action_id': actionId,
        'action_type': actionType,
        'source_board_id': sourceBoardId,
        'destination_board_id': destinationBoardId,
        'bundle_entry': bundleEntry,
        'bundle_area': bundleArea,
        'dataset_id': datasetId,
      }
      axios.post(path, postPayload)
        .then((response) => {
          console.log("Success");
          console.log("JROCHE");

          console.log(this.windows);
          console.log(destinationBoardId);
          console.log(this.windows[destinationBoardId]);



          this.windows[destinationBoardId].refresh()

        })
        .catch((error) => {
          console.error(error);
          this.generating = false
        });
    })


    newWindow.$mount('#window_' + this.windowCount)

    this.windows[id] = newWindow

    console.log("mounted");


    this.windowCount += 1
  }


  created(){
    const path = "http://localhost:5000/demosets"
    axios.delete(path)
      .then((response) => {
        console.log(response.data);

      })
      .catch((error) => {
        console.error(error);
      });
  }
}
