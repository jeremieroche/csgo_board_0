<template>
  <div id="app">
    <!-- <router-view/> -->
    <div id="container">
      <Header id="header"/>
      <!-- <Board id="board"/> -->
      <Desktop id="main-desktop"/>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Board from '@/components/board/board.vue'
import Header from '@/components/header/header.vue'
import Desktop from '@/components/desktop/desktop.vue'

@Component({
  components: {
    // Router,
    Board,
    Header,
    Desktop,
  },
})
export default class App extends Vue {}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  height:100%;
  width:100vw;
  display:flex;
  top:0px;
  left:0px;
  position:absolute;
}

#container{
  position: relative;
  top:0px;
  left:0px;
  width:100%;
  height:100%;
}

/* #app-div{
  top:0px;
  left:0px;
  height:100vh;
  width:100vw;
} */

#header{
  position:fixed;
  height:76px;
}

#main-desktop{
  position:absolute;
  top:76px;
  left:0px;
  height:calc(100% - 76px);
  width:100%;
}

#board{
  /* height: calc(100% - 76px); */
  top:76px;
  position: absolute;
  height:calc(100% - 76px);
}
</style>
