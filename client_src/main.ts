import Vue from 'vue'
import App from './App.vue'
// import './plugins/bootstrap-vue'
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap-vue/dist/bootstrap-vue.css'
import 'bootstrap/dist/css/bootstrap.css';


import { library } from '@fortawesome/fontawesome-svg-core'
import { faUserSecret,faTimesCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// import '@progress/kendo-ui' // This will import the entire Kendo UI library
// // As an alternative, you could import only the scripts that are used by a specific widget:
// // import '@progress/kendo-ui/js/kendo.window' // Imports only the Window script and its dependencies
// import '@progress/kendo-theme-default/dist/all.css'
// import { Window, WindowInstaller } from '@progress/kendo-window-vue-wrapper'


Vue.use(BootstrapVue);
// Vue.use(WindowInstaller);
// Vue.use(Window);


library.add(faUserSecret,faTimesCircle)

Vue.component('font-awesome-icon', FontAwesomeIcon)

Vue.config.productionTip = false

new Vue({
  render: h => h(App),
}).$mount('#app')
