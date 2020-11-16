<template>
  <div>
    <div ref="desktop" id="desktop">
      <desktopBar
        v-on:new-board="newBoard"/>
      <div id="desktop-content">
      </div>


      <div v-for="n in windowCount" v-bind:key="n" :id="'window_' + n">
      </div>


    </div>
  </div>
</template>


<script src="./desktop.ts"></script>
<style src="./desktop.css"></style>
