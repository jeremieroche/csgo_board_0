<template>
  <div id="backdrop-container">
    <div id="backdrop">
      <div id="permutation-options">
        <toolbar id="board-toolbar"
          v-on:toolbar-loadCsv="$refs.file.click()"
          v-on:toolbar-save="save"
          v-on:toolbar-download="download"
          v-on:toolbar-loadOptions="loadOptions"
        ></toolbar>
        <input type="file" ref="file" style="display: none" @change="loadCsv">
      </div>
      <div id="splitpane-div">
        <splitpanes id="main-splitpane" class="default-theme">
          <pane id="canvas-pane" min-size="55">
            <div id="canvasBack">
              <svg v-bind:id="'canvas_' + id" ref="svg"
                @mousedown.exact="mouseDown"
                @mousedown.right.exact="rightMouseDown"
                @mousemove="mouseMove"
                @mouseup="mouseUp"
                @mouseleave="mouseLeave"
                @mousedown.alt="altMouseDown"
                @mousedown.shift="shiftMouseDown"
                v-on:keydown.enter="deleteKeyDown"
                @contextmenu.prevent
                >
                <filter id="constantOpacity">
                  <feComponentTransfer>
                    <!-- https://stackoverflow.com/a/14387859 -->
                    <!-- This transfer function leaves all alpha values of the unfiltered
                         graphics that are lower than .5 at their original values.
                         All higher alpha above will be changed to .5.
                         These calculations are derived from the values in
                         the tableValues attribute using linear interpolation. -->
                    <feFuncA type="table" tableValues="0 0.33 0.33" />
                  </feComponentTransfer>
                </filter>
                <image v-bind:id="'map_' + id" href="https://live.staticflickr.com/65535/50098712241_e836158193_o.jpg/"/>
              </svg>
            </div>
          </pane>
          <pane v-if="showSecondaryPanes" size="45">
            <splitpanes horizontal>
              <pane v-if="showOptionPane" size="50">
                <option-panel id="option-panel"
                  v-bind:selectedBoxAttrs="findSelectedBoxAttrs()"
                  v-bind:slice="getSliceOptions()"
                  v-bind:bundleIds="getBundleIds()"
                  v-bind:bundleObj="getBundleObj()"
                  v-on:pointSent="setDimension"
                  v-on:opIsEditing="toggleOpIsEditing(true)"
                  v-on:opIsntEditing="toggleOpIsEditing(false)"
                  v-on:setSliceLevel="setSliceLevel"
                  v-on:setLabel="setBundleLabel"
                  v-on:setRColor="setRColor"
                  v-on:setGColor="setGColor"
                  v-on:setBColor="setBColor"
                  v-on:linkSelectedBundleIds="linkSelectedBundles"
                  v-on:glueSelectedBundleIds="glueSelectedBundles"
                  >
                </option-panel>
              </pane>
              <pane size="50">
                <div class="table-container">
                  <b-table class="text-small" max-height="0.01em" :items="bundleDataset"></b-table>
                </div>
              </pane>
            </splitpanes>
          </pane>
        </splitpanes>
      </div>
    </div>
    <div id="bootstap-modal">
      <b-modal
        ref="option-modal"
        title="Bundle/Box Options"
        @show="openConfig"
        @ok="saveConfig">
        <b-tabs content-class="mt-3">
          <b-tab title="Bundle" active>
            Default Bundle Color<b-form-input
              type="color"
              v-bind:value="getRgbCode(this.tempBundleDefaultColorR,this.tempBundleDefaultColorG,this.tempBundleDefaultColorB)"
              v-on:change="hexToTempBundleRgb">
            </b-form-input>
            <b-form-checkbox
              v-model="tempBundleShowLabel"
            >
              Show Label
            </b-form-checkbox>
            Label Color<b-form-input
              type="color"
              v-bind:value="getRgbCode(this.tempBundleLabelColorR,this.tempBundleLabelColorG,this.tempBundleLabelColorB)"
              v-on:change="hexToTempBundleLabelRgb"
              v-bind:disabled="this.tempBundleShowLabel==false">
            </b-form-input>
            Bundle Selected Indicator
            <b-form-select v-model="tempSelectedBundleOption">
              <b-form-select-option value="">Please select an option</b-form-select-option>
              <b-form-select-option value="innerDotColor">Inner Dot Color</b-form-select-option>
              <b-form-select-option value="fillBundleColor">Fill Bundle Color</b-form-select-option>
            </b-form-select>
            Dot Color<b-form-input
              type="color"
              v-bind:value="getRgbCode(this.tempBundleDotColorR,this.tempBundleDotColorG,this.tempBundleDotColorB)"
              v-on:change="hexToTempBundleDotRgb"
              v-bind:disabled="this.tempSelectedBundleOption!='innerDotColor'">
            </b-form-input>
            Selected Bundle Color<b-form-input
              type="color"
              v-bind:value="getRgbCode(this.tempSelectedBundleFillColorR,this.tempSelectedBundleFillColorG,this.tempSelectedBundleFillColorB)"
              v-on:change="hexToTempBundleDotRgb"
              v-bind:disabled="this.tempSelectedBundleOption!='fillBundleColor'">
            </b-form-input>
            <div id="example-bundle">
              <svg id="example-bundle-svg" viewBox="0 0 300 150">
                <g id="example-bundles-boxes" opacity=0.33
                  v-bind:fill="getRgbCode(this.tempBundleDefaultColorR,this.tempBundleDefaultColorG,this.tempBundleDefaultColorB)">
                  <g id="box1">
                    <rect x="60" y="10" width="100" height="80" ></rect>
                  </g>
                  <rect x="120" y="60" width="100" height="80" ></rect>
                </g>
                <g id="dot" v-if="this.tempSelectedBundleOption=='innerDotColor'">
                  <circle id="backdot" fill="black" cx="110" cy="50" r="5px"></circle>
                  <circle id="innerdot" cx="110" cy="50" r="3px"
                  v-bind:fill="getRgbCode(this.tempBundleDotColorR,this.tempBundleDotColorG,this.tempBundleDotColorB)"></circle>
                </g>
                <g id="label" v-if="this.tempBundleShowLabel">
                  <text x='110' y='50' text-anchor="middle"
                    v-bind:fill="getRgbCode(this.tempBundleLabelColorR,this.tempBundleLabelColorG,this.tempBundleLabelColorB)">
                    ASite
                  </text>
                </g>
              </svg>
            </div>
          </b-tab>
          <b-tab title="Box">
            <b-form-checkbox
              id="tempBoxConfigurableCheckbox"
              v-model="tempBoxConfigurable"
            >
              Box is configurable
            </b-form-checkbox>
          </b-tab>
        </b-tabs>
      </b-modal>
    </div>
  </div>
</template>

<script src="./board.ts"></script>
<style src="./board.css"></style>
