<template>
  <div id="action">
    <div id="action-content">

      Dataset
      <div id="dataset">
        <b-form-select v-model="dataset" :options="datasetOptions"></b-form-select>
      </div>
      Execution
      <div id="execution">
        <b-form-select v-model="executionType">
          <b-form-select-option value="">Select an Action Type</b-form-select-option>
          <b-form-select-option value="heatmap">Generate Positional Heatmap</b-form-select-option>
          <b-form-select-option value="rankings">Generate Positional Rankings</b-form-select-option>
          <!-- <b-form-select-option value="custom-script">Custom Script</b-form-select-option> -->
        </b-form-select>
      </div>
      <div id="box-info" v-if="executionType == 'heatmap' || executionType == 'rankings'">
        <b-form-select v-model="boardSelect"
        :options="boards"
        v-on:change="boardSelectChange"></b-form-select>
        <b-row>
          <b-col cols="2"></b-col>
          <b-col cols="1">
            Box1
          </b-col>
          <b-col cols="3">
            <b-form-select v-model="boxModel[0]" :options="boxes"></b-form-select>
          </b-col>
          <b-col cols="1">
            Box2
          </b-col>
          <b-col cols="3">
            <b-form-select v-model="boxModel[1]" :options="boxes"></b-form-select>
          </b-col>
          <b-col cols="1"></b-col>
        </b-row>
      </div>
      <div v-if="executionType=='custom-script'">
        <b-form-file
          v-model="customScript"
          :state="Boolean(customScript)"
          placeholder="Choose a file or drop it here..."
          drop-placeholder="Drop file here..."
        ></b-form-file>
        <div class="mt-3">Selected file: {{ customScript ? customScript.name : '' }}</div>
      </div>
      <div v-if="executionType=='heatmap' || executionType == 'rankings'">
        <b-button
          v-on:mouseup="generateMap">Generate
        </b-button>
        <div id="spinner-container"
          v-if="generating">
          <b-spinner label="Spinning"></b-spinner>
        </div>
      </div>
      <div v-if="executionType!=''">
        Bind
        <b-form-select v-model="bindBoardTo" :options="boards" v-on:change="changeDestinationBinding"></b-form-select>
      </div>
    </div>
  </div>
</template>

<script src="./action.ts"></script>
<style src="./action.css"></style>
