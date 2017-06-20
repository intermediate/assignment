'use strict';

var Elevator = require("./elevator")
  , _ = require("lodash")
  ;

function ElevatorController () {}

//create the controller
ElevatorController.create = function (numElevators, numFloors, minFloor, maxFloor) {
  var min = 1
    , max = 1
    , elevCont
    ;

  //this has to be handled by the prototype, so it has access to the controller itself in the event handlers
  function setupListeners (newElev) {
    elevCont.handleEvent(newElev, "already_at_destination");
    elevCont.handleEvent(newElev, "floor_out_of_bounds");
    elevCont.handleEvent(newElev, "call_when_needs_maintenance");
    elevCont.handleEvent(newElev, "at_floor");
    elevCont.handleEvent(newElev, "doors_open");
    elevCont.handleEvent(newElev, "doors_closed");
    elevCont.handleEvent(newElev, "unoccupied");
    elevCont.handleEvent(newElev, "occupied");
    elevCont.handleEvent(newElev, "need_maintenance");
  }

  if (_.isNumber(minFloor)) {
    min = minFloor;
  }

  if (_.isNumber(maxFloor)) {
    max = maxFloor;
  } else if (_.isNumber(numFloors)) {
    max = numFloors;
  }

  if (!_.isNumber(numElevators)) {
    numElevators = 1;
  }

  elevCont = new ElevatorController();
  elevCont.elevators = [];
  elevCont.occupied = [];
  elevCont.unoccupied = [];
  elevCont.queuedRequests = [];
  elevCont.needMaintenance = [];

  //create as many elevators as we're supposed to have, and listen on their events
  for (var i = 1; i <= numElevators; i++) {
    var newElev = Elevator.create(min, max)
      ;

    setupListeners(newElev);

    elevCont.elevators.push(newElev);
    elevCont.unoccupied.push(newElev);
  }

  return elevCont;
};

var p = ElevatorController.prototype;

//called when someone pushes the call button for an elevator
p.callReceived = function (floor) {
  var me = this
    , elevOnFloor
    , closestUnoccupied
    , closestUnoccupiedDistance
    , elevWillPass
    ;

  if (!_.isNumber(floor)) {
    throw new Error("ElevatorController.callReceived called with a non-number");
  }

  //look through the elevators for one that is on the floor, one that will pass by the floor, and/or the closest unoccupied elevator
  me.elevators.some(function (elev) {
    //this elevator can't be used - should already be out of this array, but no harm in checking again
    if (elev.needs_maintenance) {
      return;
    }

    //yay!  This is the best one!
    if (elev.currentFloor === floor) {
      elevOnFloor = elev;
      return true;
    }

    //if the elevator is moving up, look for one where current floor < floor and max dest >= floor
    if (elev.direction === 1 && _.contains(_.range(elev.currentFloor, Math.max(elev.destinations) + 1), floor)) {
      elevWillPass = elev;
    //if the elevator is moving down, look for one where current floor is > floor and min dest <= floor
    } else if (elev.direction === -1 && _.contains(_.range(Math.min(elev.destinations), elev.currentFloor + 1), floor)) {
      elevWillPass = elev;
    //if we have no closestUnoccupied, or the difference between current floor and floor is < stored, store this one
    } else {
      if (!elev.occupied && (_.isUndefined(closestUnoccupied) || Math.abs(floor = elev.currentFloor) < closestUnoccupiedDistance)) {
        closestUnoccupied = elev;
        closestUnoccupiedDistance = Math.abs(floor = elev.currentFloor);
      }
    }
  });

  //decide which elevator to use, in priority order, as defined in specification
  if (elevOnFloor) {
    elevOnFloor.goToFloor(floor);
  } else if (elevWillPass) {
    elevWillPass.goToFloor(floor);
  } else if (closestUnoccupied) {
    closestUnoccupied.goToFloor(floor);
  //if no elevator is available to fulfill request, queue request to be consumed the next time an elevator emits "unoccupied"
  } else if (!_.contains(me.queuedRequests, floor)) {
    me.queuedRequests.push(floor);
  }
};

//build and listen on event handlers
p.handleEvent = function (elevator, eventType) {
  var cont = this
    ;

  //put the elevator in the appropriate occupied/unoccuied array, and if there are any pending requests queued, have this newly-unoccupied elevator go fulfill it
  function unoccupied () {
    if (!_.isEmpty(cont.queuedRequests)) {
      elevator.goToFloor(cont.queuedRequests[0]);
      cont.queuedRequests.shift();
    }

    if (_.contains(cont.occupied, elevator)) {
      _.remove(cont.occupied, elevator);
    }

    if (!_.contains(cont.unoccupied, elevator)) {
      cont.unoccupied.push(elevator);
    }
  }

  //put the elevator in the appropriate occupied/unoccuied array
  function occupied () {
    if (_.contains(cont.unoccupied, elevator)) {
      _.remove(cont.unoccupied, elevator);
    }

    if (!_.contains(cont.occupied, elevator)) {
      cont.occupied.push(elevator);
    }
  }

  //remove this elevator from the elevators array and put it in the needMaintenance array, so it won't be used anymore, and send it to the first floor for maintenance
  function needsMaintenance () {
    if (_.contains(cont.occupied, elevator)) {
      _.remove(cont.occupied, elevator);
    }
    if (_.contains(cont.unoccupied, elevator)) {
      _.remove(cont.unoccupied, elevator);
    }
    if (_.contains(cont.elevators, elevator)) {
      _.remove(cont.elevators, elevator);
    }

    cont.needMaintenance.push(elevator);
    elevator.goToFloor(1);
  }

  switch (eventType) {
    case "unoccupied":
      elevator.on(eventType, unoccupied);
      break;
    case "occupied":
      elevator.on(eventType, occupied);
      break;
    case "need_maintenance":
      elevator.on(eventType, needsMaintenance);
      break;
  }
};

module.exports = ElevatorController;