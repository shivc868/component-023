import "./style.css";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({
  duration: 1.2,
  smoothWheel: true,
});

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// --- Liquid text (artemartemartem.com technique), scrubbed by scroll.
// Two layers do the melting:
//   1. the text itself carries a large em-based CSS blur (scales with font
//      size) plus opacity 0 → 1
//   2. the wrapper carries an SVG filter whose feColorMatrix alpha threshold
//      is itself animated — a steep alpha ramp snaps the blurred glyphs into
//      solid liquid blobs, relaxing to identity as the text resolves
// Heading and body each melt as one block, on the same scrub.

// Live-tunable via the panel on the right (Copy Config to export values)
const CONFIG = {
  // NOTE: textBlur is em-relative to each element's own font size — the big
  // heading and the smaller body text melt with the same visual weight
  textBlur: 0.3, // em, CSS blur on the text at full liquid
  svgBlur: 15.5, // px, feGaussianBlur stdDeviation at full liquid
  alphaMult: 400, // feColorMatrix alpha multiplier at full liquid
  alphaShift: -117, // feColorMatrix alpha offset at full liquid
  opacityPow: 1, // >1 = text stays invisible longer before surfacing
  meltEnd: 1, // progress at which melt fully resolves (0.5 = twice as fast)
};

const svgNS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(svgNS, "svg");
svg.setAttribute("aria-hidden", "true");
svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
document.body.appendChild(svg);
const defs = document.createElementNS(svgNS, "defs");
svg.appendChild(defs);

let filterId = 0;

function createGooFilter() {
  const id = `goo-${filterId++}`;
  const filter = document.createElementNS(svgNS, "filter");
  filter.setAttribute("id", id);
  // widen the filter region so heavy blur never clips at the edges
  filter.setAttribute("x", "-20%");
  filter.setAttribute("y", "-100%");
  filter.setAttribute("width", "140%");
  filter.setAttribute("height", "300%");

  const blur = document.createElementNS(svgNS, "feGaussianBlur");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "0");
  blur.setAttribute("result", "blur");

  const matrix = document.createElementNS(svgNS, "feColorMatrix");
  matrix.setAttribute("in", "blur");
  matrix.setAttribute("type", "matrix");
  matrix.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");

  filter.appendChild(blur);
  filter.appendChild(matrix);
  defs.appendChild(filter);
  return { id, filter, blur, matrix };
}

// Wraps el's children in an inner span and returns a melt renderer for it.
// render(t): t = 0 fully liquid/invisible, t = 1 crisp resolved text.
function createMelt(el) {
  const { id, filter, blur, matrix } = createGooFilter();

  const inner = document.createElement("span");
  inner.className = "melt__inner";
  while (el.firstChild) inner.appendChild(el.firstChild);
  el.appendChild(inner);

  let filterOn = false;

  function render(t) {
    t = Math.min(1, t / CONFIG.meltEnd);
    const melt = 1 - t;

    if (t <= 0) {
      inner.style.visibility = "hidden";
      inner.style.opacity = "0";
      inner.style.filter = `blur(${CONFIG.textBlur}em)`;
    } else {
      inner.style.visibility = "visible";
      inner.style.opacity = String(Math.pow(t, CONFIG.opacityPow));
      inner.style.filter =
        t >= 1 ? "none" : `blur(${(CONFIG.textBlur * melt).toFixed(3)}em)`;
    }

    const shift = CONFIG.alphaShift * melt;
    if (shift === 0 || t <= 0 || t >= 1) {
      if (filterOn) {
        el.style.filter = "none";
        filterOn = false;
      }
    } else {
      if (!filterOn) {
        el.style.filter = `url(#${id})`;
        filterOn = true;
      }
      const mult = 1 + (CONFIG.alphaMult - 1) * melt;
      blur.setAttribute("stdDeviation", (CONFIG.svgBlur * melt).toFixed(2));
      matrix.setAttribute(
        "values",
        `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${mult.toFixed(2)} ${shift.toFixed(2)}`,
      );
    }
  }

  function destroy() {
    el.style.filter = "none";
    while (inner.firstChild) el.insertBefore(inner.firstChild, inner);
    inner.remove();
    filter.remove();
  }

  return { render, destroy };
}

// re-render hooks for the tuner panel (re-apply CONFIG at current progress)
const renders = [];

// Heading and body each melt as one block, driven by the same scrub —
// textBlur is em-relative so both carry the same visual melt weight
function setupSection(section) {
  const melts = [
    createMelt(section.querySelector(".statement__heading")),
    createMelt(section.querySelector(".statement__body")),
  ];
  const state = { progress: 0 };

  const render = () => melts.forEach((m) => m.render(state.progress));

  gsap.to(state, {
    progress: 1,
    ease: "none",
    onUpdate: render,
    scrollTrigger: {
      trigger: section,
      start: "top bottom",
      end: "center center",
      scrub: true,
    },
  });

  render();
  renders.push(render);
}

gsap.utils.toArray(".statement").forEach((section) => setupSection(section));

// --- Tuning panel: live sliders for every melting value + Copy Config
const controls = [
  { key: "textBlur", label: "Text blur (em)", min: 0, max: 1, step: 0.025 },
  { key: "svgBlur", label: "SVG blur (px)", min: 0, max: 20, step: 0.5 },
  { key: "alphaMult", label: "Goo alpha ×", min: 1, max: 400, step: 1 },
  { key: "alphaShift", label: "Goo alpha shift", min: -250, max: 0, step: 0.5 },
  { key: "opacityPow", label: "Fade-in delay", min: 0.3, max: 4, step: 0.1 },
  { key: "meltEnd", label: "Melt speed (end)", min: 0.2, max: 1, step: 0.05 },
];

function buildPanel() {
  const panel = document.createElement("div");
  panel.className = "tuner";
  panel.innerHTML = `<div class="tuner__title">MELT TUNER</div>`;

  for (const c of controls) {
    const row = document.createElement("label");
    row.className = "tuner__row";
    row.innerHTML = `
      <span class="tuner__label">${c.label}</span>
      <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${CONFIG[c.key]}" />
      <span class="tuner__value">${CONFIG[c.key]}</span>`;
    const input = row.querySelector("input");
    const value = row.querySelector(".tuner__value");
    input.addEventListener("input", () => {
      CONFIG[c.key] = parseFloat(input.value);
      value.textContent = input.value;
      renders.forEach((fn) => fn());
    });
    panel.appendChild(row);
  }

  const copy = document.createElement("button");
  copy.className = "tuner__copy";
  copy.textContent = "Copy Config";
  copy.addEventListener("click", async () => {
    const snippet = `const CONFIG = ${JSON.stringify(CONFIG, null, 2)};`;
    try {
      await navigator.clipboard.writeText(snippet);
      copy.textContent = "Copied!";
    } catch {
      copy.textContent = "Copy failed";
    }
    setTimeout(() => (copy.textContent = "Copy Config"), 1500);
  });
  panel.appendChild(copy);

  document.body.appendChild(panel);
}

buildPanel();

document.fonts.ready.then(() => {
  ScrollTrigger.refresh();
  document.body.classList.add("is-ready");
});

// Safety net: never leave the page hidden if the font request stalls
setTimeout(() => document.body.classList.add("is-ready"), 1500);
