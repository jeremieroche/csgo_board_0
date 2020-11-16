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
        { text: "File", menu: [
          { text: "Load", click: () => this.$emit('toolbar-loadCsv')},
          { text: "Save", click: () => this.$emit('toolbar-save') },
          { text: "Download", click: () => this.$emit('toolbar-download')},
        ] },
        { text: "Option", menu: [
          { text: "Option Window", click: () => this.$emit('toolbar-loadOptions')},
        ] },
      ]
    }
  }
}
