import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { IconButton } from "@astryxdesign/core/IconButton";
import {
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  MinusIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { MermaidBlock as MermaidFrame } from "../ui/layout.tsx";

function mermaidTheme(): "dark" | "neutral" {
  if (typeof document === "undefined") return "neutral";
  const mode = document.documentElement.getAttribute("data-theme");
  if (mode === "dark") return "dark";
  if (mode === "light") return "neutral";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "neutral";
}

export function MermaidChart({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);

  // Inline zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPan = useRef({ x: 0, y: 0 });

  // Modal state
  const [isExpanded, setIsExpanded] = useState(false);
  const [modalZoom, setModalZoom] = useState(1);
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const modalDragStart = useRef({ x: 0, y: 0 });
  const modalInitialPan = useRef({ x: 0, y: 0 });

  // Hover state for showing toolbar
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setErrorMessage(null);
    setSvgContent(null);

    void (async () => {
      try {
        const mermaid = await import("mermaid");
        mermaid.default.initialize({ startOnLoad: false, theme: mermaidTheme() });
        const id = `mermaid-${crypto.randomUUID()}`;
        const result = await mermaid.default.render(id, chart);
        if (!cancelled) {
          setSvgContent(result.svg);
          setState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setErrorMessage(error instanceof Error ? error.message : "Diagram failed to render");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  // Sync SVG content to container
  useEffect(() => {
    if (state === "ready" && svgContent && containerRef.current) {
      containerRef.current.innerHTML = svgContent;
    }
  }, [state, svgContent]);

  // Sync SVG content to modal container
  useEffect(() => {
    if (isExpanded && svgContent && modalContainerRef.current) {
      modalContainerRef.current.innerHTML = svgContent;
    }
  }, [isExpanded, svgContent]);

  // Zoom helpers
  const zoomIn = () => setZoom((z) => Math.min(z * 1.25, 8));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.25, 0.2));
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const modalZoomIn = () => setModalZoom((z) => Math.min(z * 1.25, 8));
  const modalZoomOut = () => setModalZoom((z) => Math.max(z / 1.25, 0.2));
  const modalReset = () => {
    setModalZoom(1);
    setModalPan({ x: 0, y: 0 });
  };

  // Dragging handlers (Inline)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (state !== "ready") return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPan.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({
      x: initialPan.current.x + dx,
      y: initialPan.current.y + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel Zoom handler (Inline)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = 1.1;
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(z * zoomFactor, 8));
      } else {
        setZoom((z) => Math.max(z / zoomFactor, 0.2));
      }
    }
  };

  // Dragging handlers (Modal)
  const handleModalMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalDragging(true);
    modalDragStart.current = { x: e.clientX, y: e.clientY };
    modalInitialPan.current = { ...modalPan };
  };

  const handleModalMouseMove = (e: React.MouseEvent) => {
    if (!isModalDragging) return;
    const dx = e.clientX - modalDragStart.current.x;
    const dy = e.clientY - modalDragStart.current.y;
    setModalPan({
      x: modalInitialPan.current.x + dx,
      y: modalInitialPan.current.y + dy,
    });
  };

  const handleModalMouseUp = () => setIsModalDragging(false);

  // Wheel Zoom handler (Modal)
  const handleModalWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY < 0) {
      setModalZoom((z) => Math.min(z * zoomFactor, 8));
    } else {
      setModalZoom((z) => Math.max(z / zoomFactor, 0.2));
    }
  };

  return (
    <>
      <section
        className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsDragging(false);
        }}
        aria-label="Mermaid Diagram"
      >
        {state === "ready" && (isHovered || isDragging) && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100/90 p-1 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-800/90">
            <IconButton
              icon={<PlusIcon className="h-4 w-4" />}
              label="Zoom In"
              tooltip="Zoom In"
              variant="ghost"
              size="sm"
              onClick={zoomIn}
            />
            <IconButton
              icon={<MinusIcon className="h-4 w-4" />}
              label="Zoom Out"
              tooltip="Zoom Out"
              variant="ghost"
              size="sm"
              onClick={zoomOut}
            />
            <IconButton
              icon={<ArrowPathIcon className="h-4 w-4" />}
              label="Reset Zoom"
              tooltip="Reset Zoom"
              variant="ghost"
              size="sm"
              onClick={reset}
            />
            <div className="mx-1 h-4 w-[1px] bg-zinc-200 dark:bg-zinc-700" />
            <IconButton
              icon={<ArrowsPointingOutIcon className="h-4 w-4" />}
              label="Expand to Fullscreen"
              tooltip="Expand to Fullscreen"
              variant="ghost"
              size="sm"
              onClick={() => {
                setModalZoom(1);
                setModalPan({ x: 0, y: 0 });
                setIsExpanded(true);
              }}
            />
          </div>
        )}

        {state === "ready" && (isHovered || isDragging) && (
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-zinc-900/5 px-1.5 py-0.5 text-[10px] text-zinc-400 backdrop-blur dark:bg-zinc-100/5 dark:text-zinc-500">
            {isDragging ? "Panning..." : "Drag to pan • Cmd/Ctrl + Scroll to zoom"}
          </div>
        )}

        <MermaidFrame
          aria-busy={state === "loading"}
          className="relative flex min-h-[150px] cursor-grab select-none items-center justify-center active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {state === "loading" ? (
            <span className="reader-mermaid-status">Rendering diagram…</span>
          ) : null}
          {state === "error" ? (
            <span className="reader-mermaid-status reader-mermaid-status-error" role="alert">
              {errorMessage ?? "Diagram failed to render"}
            </span>
          ) : null}
          <div
            ref={containerRef}
            className="transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          />
        </MermaidFrame>
      </section>

      <Dialog isOpen={isExpanded} onOpenChange={setIsExpanded} variant="fullscreen">
        <DialogHeader
          title="Mermaid Diagram View"
          subtitle={`Zoom: ${Math.round(modalZoom * 100)}%`}
          onOpenChange={setIsExpanded}
          endContent={
            <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-1">
              <IconButton
                icon={<PlusIcon className="h-4 w-4" />}
                label="Zoom In"
                tooltip="Zoom In"
                variant="ghost"
                size="sm"
                onClick={modalZoomIn}
              />
              <IconButton
                icon={<MinusIcon className="h-4 w-4" />}
                label="Zoom Out"
                tooltip="Zoom Out"
                variant="ghost"
                size="sm"
                onClick={modalZoomOut}
              />
              <IconButton
                icon={<ArrowPathIcon className="h-4 w-4" />}
                label="Reset View"
                tooltip="Reset View"
                variant="ghost"
                size="sm"
                onClick={modalReset}
              />
            </div>
          }
        />

        <div
          className="flex min-h-0 flex-1 cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
          onMouseDown={handleModalMouseDown}
          onMouseMove={handleModalMouseMove}
          onMouseUp={handleModalMouseUp}
          onMouseLeave={handleModalMouseUp}
          onWheel={handleModalWheel}
          role="application"
          aria-label="Interactive Diagram Canvas"
        >
          <div
            ref={modalContainerRef}
            className="transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${modalPan.x}px, ${modalPan.y}px) scale(${modalZoom})`,
              transformOrigin: "center center",
            }}
          />
        </div>
      </Dialog>
    </>
  );
}
