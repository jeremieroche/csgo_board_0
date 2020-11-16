<template>
  <div id="wholeOptionPanel">
    <div id="boxBundleOptions">
      <div id="selectedBoxOptions" class="bbOption" v-bind:class="getBoxOptionsClass()">
        <div class="multiSelectedBoxInput">
          <div id="msbInputLabel" class="side-column">
            <h1 class="p1-header">x1</h1>
            <h1 class="p1-header">y1</h1>
            <h1 class="p2-header">x2</h1>
            <h1 class="p2-header">y2</h1>
          </div>
          <div id="msbInput" class="side-column">
            <input class="selectedBoxInput"
            v-model="selectedBoxAttrs.point1X"
            v-on:keyup.enter="sendPointToParent('point1X',selectedBoxAttrs.point1X)"
            @focus="setIsEditing(true)"
            @blur="setIsEditing(false)"
            >
            <input class="selectedBoxInput"
            v-model="selectedBoxAttrs.point1Y"
            v-on:keyup.enter="sendPointToParent('point1Y',selectedBoxAttrs.point1Y)"
            @focus="setIsEditing(true)"
            @blur="setIsEditing(false)"
            >
            <input class="selectedBoxInput"
            v-model="selectedBoxAttrs.point2X"
            v-on:keyup.enter="sendPointToParent('point2X',selectedBoxAttrs.point2X)"
            @focus="setIsEditing(true)"
            @blur="setIsEditing(false)"
            >
            <input class="selectedBoxInput"
            v-model="selectedBoxAttrs.point2Y"
            v-on:keyup.enter="sendPointToParent('point2Y',selectedBoxAttrs.point2Y)"
            @focus="setIsEditing(true)"
            @blur="setIsEditing(false)"
            >
          </div>
        </div>
        <div id="sliceOptions" v-bind:class="getSliceOptionsClass()" style="clear:both;">
          <div id="sliceCheckBoxes">
            <div class="scb">
              <input type="checkbox" name="top-slice" v-model="slice[0]">
              <label class="sliceLabel" for="top-slice">Top</label>
            </div>
            <div class="scb">
              <input type="checkbox" name="bottom-slice" v-model="slice[1]">
              <label class="sliceLabel" for="bottom-slice">Bottom</label>
            </div>
          </div>
          <button id="setSliceButton" v-on:mouseUp="setSliceLevel">Set Level</button>
        </div>
      </div>
      <div id="selectedBundleOptions" class="bbOption">
        <div v-bind:class="getGlueLinkClass()">
          <button class="glueLinkButton" id="glue-button" v-on:mouseup="glue">Glue</button>
          <button class="glueLinkButton" id="link-button" v-on:mouseup="link">Link</button>
        </div>
        <div v-bind:class="getBundleInputsClass()">
          <input class="bundleInput"
          v-model="bundleObj.bundleLabel"
          v-on:keyup.enter="sendLabelToParent(bundleObj.bundleLabel)"
          @focus="setIsEditing(true)"
          @blur="setIsEditing(false)"
          >
          <input class="bundleInput"
          v-model="bundleObj.bundleRColor"
          v-on:keyup.enter="sendColorToParent(bundleObj.bundleRColor,'R')"
          @focus="setIsEditing(true)"
          @blur="setIsEditing(false)">
          <input class="bundleInput"
          v-model="bundleObj.bundleGColor"
          v-on:keyup.enter="sendColorToParent(bundleObj.bundleColor.g,'G')"
          @focus="setIsEditing(true)"
          @blur="setIsEditing(false)">
          <input class="bundleInput"
          v-model="bundleObj.bundleBColor"
          v-on:keyup.enter="sendColorToParent(bundleObj.bundleColor.b,'B')"
          @focus="setIsEditing(true)"
          @blur="setIsEditing(false)">
        </div>
      </div>
    </div>
  </div>
</template>


<script src="./option-panel.ts"></script>
<style src="./option-panel.css"></style>
