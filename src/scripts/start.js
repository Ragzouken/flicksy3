globalThis.SETUP = {};

async function start() {
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  renderer.setAnimationLoop(animate);

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

    // skybox.rotation.y = Math.PI * 2 * (performance.now() * .0001);

    renderer.render(scene, camera);
  }

  const img = document.querySelector("img");
  img.remove();

  await imageLoadWaiter(img);

  const skyboxRendering = createRendering2D(256, 256);
  skyboxRendering.drawImage(img, 0, 0);

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

  const raycaster = new THREE.Raycaster();

  /**
   * @param {PointerEvent} event 
   * @param {THREE.Vector2} vector 
   * @returns {THREE.Vector2}
   */
  function eventToClipCoords(event, vector) {
    const { x, y } = mouseEventToCanvasClipCoords(renderer.domElement, event);
    vector.set(x, y);
    return vector;
  }

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

  renderer.domElement.addEventListener("pointerdown", (event) => {
    const drag = ui.drag(event);

    const p0 = new THREE.Vector2();
    const p1 = new THREE.Vector2();

    function drawLine() {
      const s = 2;

      lineplot(p0.x, p0.y, p1.x, p1.y, (x, y) => {
        skyboxRendering.fillRect(
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

  add_button(moveControls, "🎨", () => skyboxRendering.fillStyle = `hsl(${Math.random()*360}deg 75 50)`);
  const move = add_button(moveControls, "🔄️");

  move.addEventListener("pointerdown", (event) => {
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
