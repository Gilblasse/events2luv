import { useEffect, useRef, useState } from "react";

// Ordinary document flow is the fallback. Only a successfully initialized
// timeline takes ownership of position, visibility, and transforms.
export function useStoryMotion(ref, editing, contentKey) {
  const timeline = useRef(null);
  const [active, setActive] = useState(0);
  const query =
    "(min-width: 1000px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)";
  const [directed, setDirected] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    const update = () => setDirected(media.matches);
    media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const root = ref.current;
    if (!root || editing || !window.matchMedia) return;
    const lifetime = new AbortController();
    let disposed = false,
      media,
      observer;
    const panels = [...root.querySelectorAll(".narrative-panel")];
    const observe = () => {
      if (!globalThis.IntersectionObserver) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) setActive(panels.indexOf(entry.target));
        },
        { rootMargin: "-20% 0px -45% 0px" },
      );
      panels.forEach((panel) => observer.observe(panel));
    };
    const refresh = () => timeline.current?.scrollTrigger?.refresh();
    if (!directed) {
      observe();
      return () => observer?.disconnect();
    }
    import("./storyMotion.js")
      .then(({ createStoryMotion }) => {
        if (disposed) return;
        media = createStoryMotion(
          root,
          panels,
          setActive,
          timeline,
          observe,
          () => observer?.disconnect(),
        );
        root.addEventListener("load", refresh, true);
        const loaded =
          document.readyState === "complete"
            ? Promise.resolve()
            : new Promise((resolve) =>
                window.addEventListener("load", resolve, {
                  once: true,
                  signal: lifetime.signal,
                }),
              );
        Promise.all([loaded, document.fonts?.ready]).then(() => {
          // Resolve after native fragment restoration and ScrollTrigger's initial
          // layout pass. User navigation still uses native smooth scrolling.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (disposed) return;
              refresh();
              const index = panels.findIndex(
                (panel) => panel.id === location.hash.slice(1),
              );
              if (index >= 0) go(index, true);
            }),
          );
        });
      })
      .catch(() => {
        if (!disposed) observe();
      });
    return () => {
      disposed = true;
      lifetime.abort();
      root.removeEventListener("load", refresh, true);
      observer?.disconnect();
      media?.revert();
      timeline.current = null;
    };
  }, [editing, contentKey, directed]);

  function go(index, instant = false) {
    const tl = timeline.current;
    const target = ref.current?.querySelectorAll(".narrative-panel")[index];
    if (!target) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (tl)
      window.scrollTo({
        top: tl.scrollTrigger.labelToScroll(`chapter${index}`),
        behavior: reduced || instant ? "instant" : "smooth",
      });
    else
      target.scrollIntoView({
        behavior: reduced || instant ? "instant" : "smooth",
        block: "start",
      });
    setActive(index);
  }
  return { active, go };
}
