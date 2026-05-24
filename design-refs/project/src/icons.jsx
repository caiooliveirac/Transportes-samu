// Tiny wrapper around lucide so we can write <Icon name="ArrowRight" />.
// Each call creates a fresh SVG via lucide.createIcons-style API.

const { createElement: h, forwardRef, useEffect, useRef } = React;

const Icon = forwardRef(function Icon({ name, size = 16, stroke = 1.75, className = "", ...rest }, ref) {
  const elRef = useRef(null);
  useEffect(() => {
    if (!elRef.current) return;
    const svgNode = window.lucide?.icons?.[name];
    if (!svgNode) return;
    // svgNode is [tag, attrs, children]
    const [, attrs, children] = svgNode;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    Object.entries({ ...attrs, width: size, height: size, "stroke-width": stroke }).forEach(([k, v]) =>
      svg.setAttribute(k, v),
    );
    svg.setAttribute("class", className);
    (children || []).forEach((c) => {
      if (!Array.isArray(c)) return;
      const [tag, a] = c;
      const node = document.createElementNS(ns, tag);
      Object.entries(a || {}).forEach(([k, v]) => node.setAttribute(k, v));
      svg.appendChild(node);
    });
    const host = elRef.current;
    host.innerHTML = "";
    host.appendChild(svg);
  }, [name, size, stroke, className]);
  return <span ref={elRef} className="inline-flex" aria-hidden="true" />;
});

window.Icon = Icon;
