const URL_PARAMS = new URLSearchParams(window.location.search);
let SAVE_SLOT = URL_PARAMS.get("save") ?? "slot0";

// browser saves will be stored under the id "flicksy3"
let storage = new maker.ProjectStorage("flicksy3");

// type definitions for the structure of project data. useful for the
// code editor, ignored by the browser 
/**
 * @typedef {Object} Flicksy3DataScene
 * @property {number} id
 * @property {string} texture
 */

/**
 * @typedef {Object} Flicksy3DataProject
 * @property {Flicksy3DataScene[]} scenes
 */

/**
 * Return a list of resource ids that a particular project depends on. 
 * @param {Flicksy3DataProject} data 
 * @returns {string[]}
 */
function getManifest(data) {
  // all textures
  const textures = data.scenes.map((scene) => scene.texture);

  return [...textures];
}

/**
 * @returns {maker.ProjectBundle<Flicksy3DataProject>}
 */
function makeBlankBundle() {
  const skybox = createRendering2D(128, 128);
  withPixels(skybox, (pixels) => {
    for (let y = 0; y < 128; ++y) {
      for (let x = 0; x < 128; ++x) {
        const c = (x/31+y/17) % 16;

        pixels[y * 128 + x] = (0x11111111 * c) | 0xFF000000;
      }
    }
  });
  skybox.fillStyle = `rgb(16 16 16)`;
  skybox.fillRect(0, 64, 128, 64);
  const data = skybox.canvas.toDataURL("image/png");

  return {
    project: makeBlankProject(),
    resources: { "1": { type: "canvas-datauri", data } },
  };
}

/**
 * @returns {Flicksy3DataProject}
 */
function makeBlankProject() {
  const scene = { id: 1, texture: "1" };

  return {
    scenes: [scene],
  }
}

const constants = {
}
