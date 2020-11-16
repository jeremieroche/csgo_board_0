import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator'
import axios from 'axios';
import { v4 as uuid } from 'uuid';


@Component({
  components:{},
  props:['markForDeletion','windowTitle'],
})
export default class DemoInput extends Vue{
  selectionType = "nothing"
  demoFile = null
  parsing = false
  demoFileName = ""
  demoFileType = "dem"
  demos = []
  reader = new FileReader();
  id = uuid().replace("-","")

  // created(){
  //   this.refreshDemos()
  // }

  refreshDemos(){
    const path = 'http://localhost:5000/demos/' + this.id;
    axios.get(path)
      .then((response) => {
        const pDemos = response.data['p_demos']
        // console.log(pDemos);

        this.demos = pDemos

        console.log("GET SUCCESS");
      })
      .catch((error) => {
        console.log(error);

        console.log("Something");
      });
  }

  @Watch('demoFile')
  onPropertyChanged(value: string, oldValue: string) {
    // console.log("Demo File");
    // console.log(this.demoFile);
    this.reader.onloadend = this.loadHandler
    this.parsing = true
    this.reader.readAsDataURL(this.demoFile);
  }

  @Watch('markForDeletion')
  onMfdChanged(markForDeletion, oldMarkForDeletion) {
    if (markForDeletion["obj"]){

      const path = 'http://localhost:5000/demos/' + this.id;
      axios.delete(path)
        .then(() => {
          this.$emit('successful-deletion')
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }

  @Watch('windowTitle')
  onWindowTitleChange(newTitle, oldTitle){

    const path = 'http://localhost:5000/demos/' + this.id + "/set_title";
    const postPayload = {
      'new_title': newTitle
    }
    axios.post(path, postPayload)
      .then(() => {
        console.log("Title Changed");
      })
      .catch((error) => {
        console.error(error);
      });

  }

  loadHandler(event) {
    const result = event.target.result;

    if (result == ""){
      console.log("...Bug in FileReader Encountered");
      this.parsing = false
      return
    }



    const blob = result.split(",")[1]
    const path = `http://localhost:5000/demos/${this.id}/prep`;
    const chunkSize = 30000000 // ~30MB
    const chunkCount = parseInt(blob.length/chunkSize) + 1
    const prepPayload = {
      'chunk_count': chunkCount
    }


    axios.post(path, prepPayload)
      .then((response) => {
        console.log("PREP SUCCESS");
      })
      .catch((error) => {
        console.log("Something");
      });

    for (let i = 0; i < chunkCount; i++) {
      const startPoint = i * chunkSize
      const endPoint = Math.min((i+1) * chunkSize, blob.length)
      const blobSlice = blob.slice(startPoint,endPoint)


      const demoPayload = {
        'demo_name': this.demoFile.name,
        'chunk_index': i,
        'chunk_count': chunkCount,
        'demo': blobSlice,
      }

      const demoPath = 'http://localhost:5000/demos/' + this.id;
      axios.post(demoPath, demoPayload)
        .then((response) => {
          console.log("SUCCESS");

          if (response.data['complete']){
            this.parsing = false
            this.refreshDemos()
            console.log("DONE")
          }
        })
        .catch((error) => {
          this.parsing = false
          console.log("Something");
        });

    }

  }


}
