import Vue from 'vue';
import {Watch, Component} from 'vue-property-decorator';
import axios from 'axios'

@Component({
  components:{},
  props: ['id'],
})
export default class Action extends Vue{
  executionType = ""
  dataset = null
  datasetType = ""
  customScript = null
  datasetOptions = []
  boxes = []
  boards = []
  boardSelect = ""
  bundles = {}
  boxModel = []
  generating = false
  bindBoardTo = null

  created(){
    const path = "http://localhost:5000/demosets"
    axios.get(path)
      .then((response) => {
        console.log(response.data);

        this.datasetOptions = response.data['demosets']
      })
      .catch((error) => {
        console.error(error);
      });
  }

  @Watch('executionType')
  onExecutionTypeChange(newExecutionType, oldExecutionType){
    if (newExecutionType != "heatmap" && newExecutionType != "rankings"){
      return
    }

    const path = 'http://localhost:5000/boards';
    axios.get(path)
      .then((response) => {
        console.log(response.data);
        const allBoards = response.data["boards"]
        const boardTitleList = []
        this.bundles = {}
        for (let i = 0; i < allBoards.length; i++) {
          const boardObj = allBoards[i];
          boardTitleList.push({
            value: boardObj['id'],
            text: boardObj['title']
          })
          this.bundles[boardObj['id']] = boardObj['bundle_info']
        }
        this.boards = boardTitleList
        this.boxModel = ["",""]

      })
      .catch((error) => {
        console.error(error);
      });
  }


  boardSelectChange(){
    const bundleInfo = this.bundles[this.boardSelect]
    this.boxes = []
    for (let i = 0; i < bundleInfo.length; i++) {
      const bi = bundleInfo[i];
      const bid = bi[0]
      const label = bi[1]
      this.boxes.push({
        'value': bid,
        'text': label
      })
    }
  }

  generateMap(){
    if (this.executionType == 'heatmap'){
      this.generateHeatMap()
    } else if (this.executionType == 'rankings'){
      this.generateRankingMap()
    }
  }

  generateHeatMap(){
    const bundleEntry = this.boxModel[0]
    const bundleArea = this.boxModel[1]
    const datasetId = this.dataset

    const postPayload = {
      'bundle_entry': bundleEntry,
      'bundle_area': bundleArea,
      'dataset_id': datasetId,
    }

    const path = `http://localhost:5000/generate_heatmap/${this.boardSelect}`
    this.generating = true

    axios.post(path, postPayload)
      .then((response) => {
        console.log("Success");
        this.generating = false


        const generatedHeatmapId = response.data["generated_heatmap_id"]

        this.$emit('heatmap-generated',generatedHeatmapId)


      })
      .catch((error) => {
        console.error(error);
        this.generating = false
      });

    console.log(this.dataset);

  }

  generateRankingMap(){

    const bundleArea = this.boxModel[0]
    const datasetId = this.dataset

    const postPayload = {
      'bundle_area': bundleArea,
      'dataset_id': datasetId,
    }

    const path = `http://localhost:5000/generate_ranking_map/${this.boardSelect}`
    this.generating = true

    axios.post(path, postPayload)
      .then((response) => {
        console.log("Success");
        this.generating = false

        const generatedRankingMapId = response.data["generated_ranking_map_id"]
        console.log(generatedRankingMapId);


        this.$emit('rankings-generated',generatedRankingMapId)
      })
      .catch((error) => {
        console.error(error);
        this.generating = false
      });




    return null
  }

  changeDestinationBinding(){
    const bundleEntry = this.boxModel[0]
    const bundleArea = this.boxModel[1]
    const datasetId = this.dataset


    this.$emit('changeBoardDestination', this.id, this.executionType, this.boardSelect, this.bindBoardTo, bundleEntry, bundleArea, datasetId)
  }

}
