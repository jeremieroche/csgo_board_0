<template>
  <div v-if="windowOpen" id="windowContainer" ref="windowContainer"
    v-bind:style="{position:'absolute', width: windowWidth + 'px', height: windowHeight + 'px', top: windowTop + 'px', left: windowLeft + 'px'}"
    >
    <div id="window">
      <div id="window-bar"
        @mousedown="barMouseDown">
        <div id="window-title"
          v-on:mousedown="headerTitleMouseDown">
          <div v-if="windowTitleType == 'newWindow'">
            New Window
          </div>
          <div v-if="windowTitleType == 'editTitle'">
            <b-form-input v-model="windowTitleTemp"
              v-on:keyup.enter="setTitle"></b-form-input>
          </div>
          <div v-if="windowTitleType == 'setWindowTitle'">
            {{ windowTitle }}
          </div>
        </div>
        <div id="delete-window-icon"
          v-on:click="closeWindow">
          <font-awesome-icon icon="times-circle" />
        </div>
      </div>
      <div id="window-content">
        <div id="button-only-layout"
          v-if="windowType == ''">
          <b-row class="text-center" align-v="center" align-h="center">
            <b-col col lg="12"></b-col>
            <b-col cols="2" md="auto">
              <b-form-select v-model="selectedWindowType"
                size="sm"
                v-on:change.native="changeToNonDefualt">
                <b-form-select-option value="">Please select an option</b-form-select-option>
                <b-form-select-option value="board">CS:Board</b-form-select-option>
                <b-form-select-option value="action">Action</b-form-select-option>
                <b-form-select-option value="demo">Demo</b-form-select-option>
              </b-form-select>
            </b-col>
            <b-col col lg="12"></b-col>
          </b-row>
        </div>
        <div id="board-container"
          v-if="windowType == 'board'">
          <Board
            ref="board"
            v-bind:windowTitle="this.windowTitle"
            v-bind:id="id"
            v-on:title-changed="setTitle"
            v-on:new-board-id="newBoardId"
            v-on:saved="boardSaved"
            >
          </Board>
        </div>
        <div id="action-container"
          v-if="windowType == 'action'">
          <Action
            v-bind:id="id"
            v-on:heatmap-generated="heatmapGenerated"
            v-on:changeBoardDestination="setBoardDestination"
            v-on:rankings-generated="rankingsGenerated">
          </Action>
        </div>
        <div id="demo-input-container"
          v-if="windowType == 'demo'">
          <DemoInput
            v-bind:markForDeletion="windowMarkForDeletionGetter()"
            v-on:successful-deletion="hardCloseWindow"
            v-bind:windowTitle="this.windowTitle">
          </DemoInput>
        </div>
      </div>
    </div>
  </div>
</template>


<script src="./csWindow.ts"></script>
<style src="./csWindow.css"></style>
