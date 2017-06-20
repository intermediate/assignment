'use strict';

var argv = require("minimist")(process.argv.slice(2))
  , ElevatorController = require("./elevator-controller")
  ;

ElevatorController.create(argv.elevators, argv.floor, argv.min, argv.max);