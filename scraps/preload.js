const imports = {};

/**
 * @param {Element} element 
 */
function loadModuleElement(element) {
  const name = element.getAttribute("data-module-name");
  const blob = new Blob([element.textContent], { type: "text/javascript" });
  const src = URL.createObjectURL(blob);
  return { name, src };
}

const data = {
  "imports": {},
}

for (const element of document.querySelectorAll("script[data-module-name]")) {
  const { name, src } = loadModuleElement(element);
  data.imports[name] = src;
}

const mapElement = document.createElement("script");
mapElement.type = "importmap";
mapElement.textContent = JSON.stringify(data);
document.body.append(mapElement);
