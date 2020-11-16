<template>
  <div id="demo-input">
    <b-row class="text-center" align-v="center" align-h="center">
      <b-col cols="1"></b-col>
      <b-col cols="3">
        <b-form-select v-model="demoFileType">
          <b-form-select-option value="dem">.dem</b-form-select-option>
          <b-form-select-option value="zip">.zip</b-form-select-option>
          <b-form-select-option value="rar">.rar</b-form-select-option>
        </b-form-select>
      </b-col>
      <b-col cols="6">
        <b-form-file
        v-model="demoFile"
        placeholder="Choose Demo"
        ></b-form-file>
        <div>{{ parsing ? "Parsing Demo" : '' }}</div>
      </b-col>
      <b-col cols="1"></b-col>
    </b-row>
    <b-row align-h="center" v-if="demoFile">
      <div class="text-center"
        id="spinner-container"
        v-if="parsing">
        <b-spinner label="Spinning"></b-spinner>
      </div>
    </b-row>
    <b-row align-h="center">
      <b-table striped hover :items="demos" responsive=true></b-table>
    </b-row>
  </div>
</template>

<script src="./demo-input.ts"></script>
<style src="./demo-input.css"></style>
