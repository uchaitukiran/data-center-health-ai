/**
 * Rack State and Emissive Material Manager
 * Synchronizes 3D mesh illumination with real-time WebSocket telemetry.
 */

import * as THREE from 'three';

export class RackManager {
  constructor(sceneEngine) {
    this.sceneEngine = sceneEngine;
    this.racksData = new Map();
  }

  updateRacks(rackStates) {
    if (!rackStates || !Array.isArray(rackStates)) return;

    rackStates.forEach(state => {
      this.racksData.set(state.rack_id, state);

      // Find 3D mesh corresponding to this rack
      const rackMesh = this.sceneEngine.interactiveRacks.find(
        r => r.userData.rackId === state.rack_id
      );

      if (rackMesh && rackMesh.userData.bezelMat) {
        const mat = rackMesh.userData.bezelMat;
        let colorHex = 0x00ff88; // Normal Green
        let isAlert = false;

        if (state.severity === "CRITICAL") {
          colorHex = 0xff385c; // Neon Red
          isAlert = true;
        } else if (state.severity === "WARNING") {
          colorHex = 0xffb700; // Cyber Amber
          isAlert = true;
        }

        mat.color.setHex(colorHex);
        mat.emissive.setHex(colorHex);
        mat.userData.isAlert = isAlert;
      }
    });
  }

  getRackData(rackId) {
    return this.racksData.get(rackId) || null;
  }
}
