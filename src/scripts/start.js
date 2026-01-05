globalThis.SETUP = {};

async function start() {
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

  /** @type {maker.StateManager<Flicksy3DataProject>} */
  const stateManager = new maker.StateManager(getManifest);

  const embed = maker.bundleFromHTML(document);

  // no embedded project, start editor with save or editor embed
  const save = await storage.load(SAVE_SLOT).catch(() => undefined);
  const fallback = makeBlankBundle(); //: maker.bundleFromHTML(document, "#editor-embed");
  const bundle = embed ?? save ?? fallback;

  // load bundle and enter editor mode
  await stateManager.loadBundle(bundle);

  stateManager.addEventListener("change", async (event) => {
    undoButton.disabled = !stateManager.canUndo;
    redoButton.disabled = !stateManager.canRedo;

    skyboxTex.image = (await stateManager.resources.get(stateManager.present.scenes[0].texture)).canvas;
    skyboxTex.needsUpdate = true;
    skyboxMat.needsUpdate = true;
  });

  function resize() {
    if (resizeOn) {
      scaleElementToParent(main, false);
    }

    const rect = viewport.getBoundingClientRect();
    let { left, top, width, height } = rect;

    const padding = 2;

    left = Math.ceil(left) + padding;
    top = Math.ceil(top) + padding;
    width = Math.floor(width) - padding * 2;
    height = Math.floor(height) - padding * 2;

    renderer.setSize(width, height, true);
    renderer.setPixelRatio(1);
    Object.assign(renderer.domElement.style, {
      "left": `${left}px`,
      "top": `${top}px`,
    });

    camera.aspect = width / height;

    Object.assign(camera, {
      left: 0,
      bottom: 0,
      top: height,
      right: width,
    });
    camera.updateProjectionMatrix();
  }

  function animate() {
    resize();

    renderer.render(scene, camera);
  }

  const texId = stateManager.present.scenes[0].texture;
  const skyboxRendering = /** @type {CanvasRenderingContext2D} */ (stateManager.resources.get(texId));

  const skyboxTex = new THREE.Texture(skyboxRendering.canvas);
  const skyboxGeo = new THREE.IcosahedronGeometry();
  const skyboxMat = new THREE.MeshBasicMaterial({ map: skyboxTex, side: THREE.BackSide, alphaTest: .5 });
  const skybox = new THREE.Mesh(skyboxGeo, skyboxMat);

  skyboxTex.minFilter = THREE.NearestFilter;
  skyboxTex.magFilter = THREE.NearestFilter;
  skyboxTex.wrapS = THREE.RepeatWrapping;
  skyboxTex.wrapT = THREE.RepeatWrapping;
  skyboxTex.needsUpdate = true;
  skyboxMat.needsUpdate = true;

  scene.add(skybox);

  camera.position.set(0, 0, 0);
  camera.lookAt(skybox.position);

  const { main, viewport,
    dialogueElement,
    dialogueBlockerElement,
    dialogueContentElement,
    dialoguePromptElement,
  } = setup_ui(renderer.domElement);
  main.setAttribute("data-editor-only", "");

  const raycaster = new THREE.Raycaster();

  /**
   * @param {PointerEvent} event 
   * @param {THREE.Vector2} vector 
   * @returns {boolean}
   */
  function eventToTexturePixels(event, vector) {
    vector.copy(mouseEventToCanvasClipCoords(renderer.domElement, event));

    raycaster.setFromCamera(vector, camera);
    const [first] = raycaster.intersectObject(skybox);

    if (!first?.uv)
      return false;

    const x = (2 + first.uv.x) % 1;
    const y = (2 - first.uv.y) % 1;
    const { width: w, height: h } = skyboxRendering.canvas;
    vector.set(Math.round(x * w), Math.round(y * h));

    return true;
  }

  skyboxRendering.fillStyle = "red";

  let currentColor = "black";
  let currentSize = 2;

  renderer.domElement.addEventListener("pointerdown", async (event) => {
    stateManager.makeCheckpoint();

    const prevID = stateManager.present.scenes[0].texture;
    const { id: nextID, instance } = await stateManager.resources.fork(prevID);
    stateManager.present.scenes[0].texture = nextID;

    skyboxTex.image = instance.canvas;
    skyboxTex.needsUpdate = true;
    skyboxMat.needsUpdate = true;

    instance.fillStyle = currentColor;

    const drag = ui.drag(event);

    const p0 = new THREE.Vector2();
    const p1 = new THREE.Vector2();

    function drawLine() {
      const s = currentSize;

      lineplot(p0.x, p0.y, p1.x, p1.y, (x, y) => {
        instance.fillRect(
          x - ((s / 2) | 0),
          y - ((s / 2) | 0),
          s,
          s,
        );
      });

      skyboxTex.needsUpdate = true;
      skyboxMat.needsUpdate = true;
    }

    eventToTexturePixels(event, p1);
    p0.copy(p1);

    drag.addEventListener("move", (event) => {
      eventToTexturePixels(event.detail, p1);

      if (p0.distanceTo(p1) < 32)
        drawLine();

      p0.copy(p1);
    });

    drag.addEventListener("up", (event) => stateManager.changed());
  });

  function make_grid_controls(cols = 3, rows = 3) {
    const controls = html("fieldset", { class: "editor" });
    Object.assign(controls.style, {
      "grid-template-columns": `repeat(${cols}, 1fr)`,
      "grid-template-rows": `repeat(${rows}, 1fr)`,
    });
    return controls;
  }

  let activeControls = html("fieldset");
  let prevControls;

  function add_button(controls, label, callback = () => { }) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", callback);
    button.classList.add("ui-border");
    controls.append(button);
    return button;
  }

  const moveControls = make_grid_controls();

  const colorButton = add_button(moveControls, "🎨", () => {
    currentColor = `hsl(${Math.random() * 360}deg 75 50)`;
    colorButton.style.background = currentColor;
  });
  colorButton.style.background = currentColor;

  const lookButton = add_button(moveControls, "🔄️");

  const brushButton = add_button(moveControls, "2", () => {
    currentSize = Math.max((currentSize + 1) % 6, 1); 
    brushButton.textContent = `${currentSize}`;
  });
  brushButton.textContent = `${currentSize}`;

  const undoButton = add_button(moveControls, "↩️", () => stateManager.undo());
  const saveButton = add_button(moveControls, "💾", () => stateManager.makeBundle().then((data) => storage.save(data, SAVE_SLOT)));
  const redoButton = add_button(moveControls, "↪️", () => stateManager.redo());

  add_button(moveControls, "📦", runExport);
  add_button(moveControls, "📥", runImport);

  async function runImport() {
    const [file] = await maker.pickFiles("*.html");
    const html = await maker.textFromFile(file).then(maker.htmlFromText);
    const bundle = maker.bundleFromHTML(html);
    await stateManager.loadBundle(bundle);
  }

  async function runExport() {
    // prompt the browser to download the page
    const name = "flicksy3.html";
    const blob = maker.textToBlob(await makeExportHTML(), "text/html");
    maker.saveAs(blob, name);
  }

  async function makeExportHTML() {
    // make a standalone bundle of the current project state and the 
    // resources it depends upon
    const bundle = await stateManager.makeBundle();

    // make a copy of this web page
    const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
    // remove some unwanted elements from the page copy
    ALL("[data-empty]", clone).forEach((element) => element.replaceChildren());
    ALL("[data-editor-only]", clone).forEach((element) => element.remove());
    // insert the project bundle data into the page copy 
    ONE("#bundle-embed", clone).innerHTML = JSON.stringify(bundle);

    return `<!DOCTYPE html>${clone.outerHTML}`;
  }

  lookButton.addEventListener("pointerdown", (event) => {
    const drag = ui.drag(event);
    drag.addEventListener("move", (event) => {
      const pointer = /** @type {PointerEvent} */ (event.detail);

      skybox.rotation.y += pointer.movementX * 0.01;
      skybox.rotation.x += pointer.movementY * 0.01;
    });
  });

  SET_CONTROLS(moveControls);
  // SET_CONTROLS(choice_test);

  function SET_CONTROLS(controls) {
    prevControls = activeControls;
    activeControls.remove();
    activeControls = controls;
    main.append(activeControls);
  }

  /** @type {HTMLDialogElement} */
  (document.querySelector("dialog#loading")).close();

  renderer.setAnimationLoop(animate);

  stateManager.changed();
}

addEventListener("wheel", (event) => resizeOn = false);
let resizeOn = true;

/**
 * @param {HTMLElement} element 
 * @param {boolean} integer
 */
function scaleElementToParent(element, integer = true) {
  const parent = element.parentElement;

  const [tw, th] = [parent.clientWidth, parent.clientHeight];
  const [sw, sh] = [tw / element.clientWidth, th / element.clientHeight];
  let scale = Math.min(sw, sh);
  scale = scale > 1 && integer ? Math.floor(scale) : scale;

  if (element.dataset.scale !== scale.toString()) {
    element.dataset.scale = scale.toString();
    element.style.setProperty("scale", `${scale}`);
  }

  return scale;
}

function setup_dialogue_ui() {
  const dialogueBlockerElement = html("div", { id: "dialogue-blocker", hidden: "" });
  const dialogueContentElement = html("div");
  dialogueContentElement.style.whiteSpace = "pre-wrap";
  const dialoguePromptElement = html("div", {}, "🔽");
  dialoguePromptElement.style = `
        position: absolute;
        left: 50%;
        transform: translate(-50%, .125rem);
        animation: 1s ease-in-out infinite alternate flash;`
  const dialogueElement = html("div", { id: "dialogue", class: "ui-border ui-dialogue", hidden: "" }, dialogueContentElement, dialoguePromptElement);

  return {
    dialogueElement,
    dialogueBlockerElement,
    dialogueContentElement,
    dialoguePromptElement,
  }
}

function setup_ui(canvas) {
  Object.assign(canvas.style, {
    "position": "absolute",
    "z-index": "-1",
    "border-radius": "1rem",
    "pointer-events": "all",
  });
  document.body.append(canvas);

  const viewport = html("div", { id: "viewport" });
  viewport.style.gridArea = "viewport";

  const border = html("div", { class: "ui-border" });
  border.style.gridArea = "viewport";

  const {
    dialogueElement,
    dialogueBlockerElement,
    dialogueContentElement,
    dialoguePromptElement,
  } = setup_dialogue_ui();

  const main = html(
    "main",
    { class: "centered" },
    viewport,
    border,

    dialogueElement,
    dialogueBlockerElement,
  );
  Object.assign(main.style, {
    "width": "480px",
    "height": "768px",
  });
  Object.assign(main.style, {
    "display": "grid",
    "grid-template": `"viewport" 1fr "controls" min-content`,
  });
  document.body.append(main);

  return {
    main,
    viewport,

    dialogueElement,
    dialogueBlockerElement,
    dialogueContentElement,
    dialoguePromptElement,
  }
}
