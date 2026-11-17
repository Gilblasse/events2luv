import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function createStoryMotion(
  root,
  panels,
  setActive,
  reference,
  observe,
  disconnect,
) {
  const media = gsap.matchMedia();
  try {
    media.add(
      {
        spacious: "(min-width: 1000px) and (min-height: 650px)",
        reduced: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        if (!context.conditions.spacious || context.conditions.reduced) {
          observe();
          return disconnect;
        }
        const stage = root.querySelector(".narrative-stage");
        root.classList.add("is-directed");
        const captions = panels.map((p) =>
          p.querySelector(".narrative-caption"),
        );
        const photos = panels.map((p) => p.querySelector(".narrative-photo"));
        // Long owner-written copy must remain readable instead of clipping in a pin.
        if (
          captions.some(
            (caption) => caption.scrollHeight > window.innerHeight - 160,
          )
        ) {
          root.classList.remove("is-directed");
          observe();
          return disconnect;
        }
        gsap.set(panels.slice(1), { autoAlpha: 0 });
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: stage,
            start: "top top",
            end: () => `+=${window.innerHeight * 2.4}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
          },
          onUpdate() {
            const time = this.time();
            const current = time >= 2.65 ? 2 : time >= 1.25 ? 1 : 0;
            setActive(current);
            panels.forEach((panel, index) => {
              panel.inert = current !== index;
              panel.setAttribute("aria-hidden", String(current !== index));
            });
          },
        });
        panels.forEach((panel, i) => {
          panel.inert = i !== 0;
          panel.setAttribute("aria-hidden", String(i !== 0));
        });
        tl.addLabel("chapter0", 0.1);
        for (let i = 1; i < panels.length; i++) {
          const start = i === 1 ? 0.9 : 2.3;
          // Outgoing text is fully gone before any incoming text appears.
          tl.to(captions[i - 1], { autoAlpha: 0, duration: 0.18 }, start)
            .to(
              photos[i - 1],
              { autoAlpha: 0, y: -24, duration: 0.38 },
              start + 0.12,
            )
            .set(panels[i - 1], { autoAlpha: 0 }, start + 0.5)
            .set(panels[i], { autoAlpha: 1 }, start + 0.2)
            .fromTo(
              photos[i],
              { autoAlpha: 0, y: 32 },
              { autoAlpha: 1, y: 0, duration: 0.5 },
              start + 0.2,
            )
            .fromTo(
              captions[i],
              { autoAlpha: 0 },
              { autoAlpha: 1, duration: 0.22 },
              start + 0.54,
            )
            .addLabel(`chapter${i}`, start + 0.8);
        }
        tl.to({}, { duration: 0.85 });
        reference.current = tl;
        return () => {
          reference.current = null;
          root.classList.remove("is-directed");
          panels.forEach((panel) => {
            panel.inert = false;
            panel.removeAttribute("aria-hidden");
          });
        };
      },
    );
  } catch (error) {
    media.revert();
    root.classList.remove("is-directed");
    panels.forEach((panel) => {
      panel.inert = false;
      panel.removeAttribute("aria-hidden");
    });
    throw error;
  }
  return media;
}
