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

async function start() {
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  renderer.setAnimationLoop(animate);

  function animate() {
    renderer.render(scene, camera);
  }

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial({ color: "red" }),
  );
  scene.add(cube);

  camera.position.set(1, 1, 1);
  camera.lookAt(cube.position);

  const { main, viewport,
    dialogueElement,
    dialogueBlockerElement,
    dialogueContentElement,
    dialoguePromptElement,
  } = setup_ui(renderer.domElement);

  function resize() {
    // const parent = renderer.domElement.parentElement;
    const rect = viewport.getBoundingClientRect();
    let { left, top, width, height } = rect;

    left = Math.ceil(left) + 2;
    top = Math.ceil(top) + 2;
    width = Math.floor(width) - 2;
    height = Math.floor(height) - 2;

    renderer.setSize(width, height, true);
    renderer.setPixelRatio(1);
    Object.assign(renderer.domElement.style, {
      "left": `${left}px`,
      "top": `${top}px`,
    });

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    Object.assign(camera, {
      left: 0,
      bottom: 0,
      top: height,
      right: width,
    });
    camera.updateProjectionMatrix();
  }

  function resize2() {
    resize();
    if (resizeOn) {
      scaleElementToParent(main, false);
    }
    requestAnimationFrame(resize2);
  }
  resize2();

  /** @type {HTMLDialogElement} */
  (document.querySelector("dialog#loading")).close();
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
