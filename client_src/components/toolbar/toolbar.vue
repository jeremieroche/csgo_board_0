<template>
  <div id="toolbar">
    <v-style>
      body {
        background-color: #828282;
        box-shadow: none;
      }
      ::selection {
        background-color: rgb(186, 212, 253);
      }
      :root {
        --demo-font-color: #222;
        --demo-bars-bkg: rgb(255, 255, 255);
        --demo-bars-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
        --demo-bars-padding: 5px;
        --demo-bars-border-radius: 1px;
        --demo-text-bkg-color: white;
        --demo-text-box-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15);

        --bar-font-color: rgb(32, 33, 36);
        --bar-font-family: Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
        --bar-font-size: 15px;
        --bar-font-weight: 500;
        --bar-letter-spacing: 0.2px;
        --bar-padding: 3px;
        --bar-button-icon-size: 20px;
        --bar-button-padding: 4px 6px;
        --bar-button-radius: 4px;
        --bar-button-hover-bkg: rgb(241, 243, 244);
        --bar-button-active-color: rgb(26, 115, 232);
        --bar-button-active-bkg: rgb(232, 240, 254);
        --bar-button-open-color: rgb(32, 33, 36);
        --bar-button-open-bkg: rgb(232, 240, 254);
        --bar-menu-bkg: white;
        --bar-menu-border-radius: 0 0 3px 3px;
        --bar-menu-item-chevron-margin: 0;
        --bar-menu-item-hover-bkg: rgb(241, 243, 244);
        --bar-menu-item-padding: 5px 8px 5px 35px;
        --bar-menu-item-icon-size: 15px;
        --bar-menu-item-icon-margin: 0 9px 0 -25px;
        --bar-menu-padding: 6px 1px;
        --bar-menu-shadow: 0 2px 6px 2px rgba(60, 64, 67, 0.15);
        --bar-menu-separator-height: 1px;
        --bar-menu-separator-margin: 5px 0 5px 34px;
        --bar-menu-separator-color: rgb(227, 229, 233);
        --bar-separator-color: rgb(218, 220, 224);
        --bar-separator-width: 1px;
        --bar-sub-menu-border-radius: 3px;
      }
      .bars > .bar:first-child {
        border-bottom: 1px solid rgb(218, 220, 224);
        margin-bottom: 3px;
      }
    </v-style>
    <vue-file-toolbar-menu id="main-toolbar" :content="myMenu" />
  </div>
</template>


<script src="./toolbar.ts"></script>
<style src="./toolbar.css"></style>
