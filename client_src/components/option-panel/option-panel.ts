import Vue from 'vue';
import Component from 'vue-class-component';
import { select } from 'd3-selection';

@Component({
  props: ['selectedBoxAttrs','bundleIds','bundleObj','slice']
})
export default class OptionPanel extends Vue{


  sendPointToParent(type, value){
    this.$emit('pointSent',type,value)
  }

  setIsEditing(bool: boolean){
    if (bool) {
      this.$emit('opIsEditing')
    } else {
      this.$emit('opIsntEditing')
    }
  }

  destroyed(){
    this.$emit('opIsntEditing')
  }


  setSliceLevel(){
    checked = {
      topChecked: select("#top-slice").property("checked"),
      bottomChecked: select("#bottom-slice").property("checked")
    }

    this.$emit('setSliceLevel',checked)
  }

  getBoxOptionsClass(){
    return  {
              'disabledbutton': this.selectedBoxAttrs.point1X == null,
              '' : this.selectedBoxAttrs.point1X != null,
            }
  }

  getSliceOptionsClass(){
    return  {
              'disabledbutton': this.slice[0] == null,
              '' : this.slice[0] != null,
            }

  }

  getGlueLinkClass(){
    return  {
              'disabledbutton': this.bundleIds.length <= 1,
              '' : this.bundleIds.length > 1,
            }
  }

  getBundleInputsClass(){
    return {
      'disabledbutton': this.bundleIds.length != 1,
      '' : this.bundleIds.length == 1,
    }
  }

  glueEnabled(){
    return this.bundleIds.length > 1
  }

  linkEnabled(){
    return this.bundleIds.length > 1
  }

  glue(){
    this.$emit('glueSelectedBundleIds')

  }

  link(){
    this.$emit('linkSelectedBundleIds')
  }


  sendLabelToParent(bundleLabel){
    this.$emit('setLabel', bundleLabel)
  }

  sendColorToParent(bundleColorValue,type){
    this.$emit(`set${type}Color`, bundleColorValue)
  }

}
