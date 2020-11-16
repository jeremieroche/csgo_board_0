import VueFileToolbarMenu from 'vue-file-toolbar-menu'
import Vue from 'vue'

Vue.component("v-style", {
  render (createElement) { return createElement("style", this.$slots.default); }
});
export default {
  components: { VueFileToolbarMenu },

  data () { return { happy: false } },

  computed: {
    myMenu () {
      return [
        { text: "New", menu: [
          { text: "Board", click: () => this.$emit('new-board')},
          // { text: "Save", click: () => this.$emit('toolbar-save') }
        ] },
        // { text: "Option", menu: [
        //   { text: "Option Window", click: () => this.$emit('toolbar-loadOptions')},
        // ] },
      ]
    }
  }
}
