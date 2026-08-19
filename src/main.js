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

const CONFIG = {
  textBlur: 0.3, // em, CSS blur on the text at full liquid
  svgBlur: 15.5, // px, feGaussianBlur stdDeviation at full liquid
  alphaMult: 400, // feColorMatrix alpha multiplier at full liquid
  alphaShift: -117, // feColorMatrix alpha offset at full liquid
  opacityPow: 1, // >1 = text stays invisible longer before surfacing
  meltEnd: 1, // progress at which melt fully resolves (0.5 = twice as fast)
};

function createMelt(el, id) {
  const inner = el.querySelector(".melt__inner");
  const blur = document.querySelector(`#${id} feGaussianBlur`);
  const matrix = document.querySelector(`#${id} feColorMatrix`);

  let filterOn = false;

  return function render(t) {
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
  };
}

function setupSection(section, index) {
  const heading = section.querySelector(".statement__heading");
  const melt = createMelt(heading, `goo-${index}`);
  const state = { progress: 0 };

  const render = () => melt(state.progress);

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
}

gsap.utils
  .toArray(".statement")
  .forEach((section, index) => setupSection(section, index));

document.fonts.ready.then(() => {
  ScrollTrigger.refresh();
  document.body.classList.add("is-ready");
});

// Safety net: never leave the page hidden if the font request stalls
setTimeout(() => document.body.classList.add("is-ready"), 1500);
