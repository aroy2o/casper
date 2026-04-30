import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
import type { VendorNetworkResponse } from "./analyticsApi";

interface Props {
  data: VendorNetworkResponse;
}

const COLORS = {
  HIGH: "#E24B4A",
  MEDIUM: "#EF9F27",
  LOW: "#1D9E75"
} as const;

const nodeRadius = (vendor: { totalTenders: number }): number => Math.max(8, Math.min(28, 8 + vendor.totalTenders * 0.8));

function seedDisplayRiskLevels<T extends { id: string; riskLevel: "HIGH" | "MEDIUM" | "LOW"; collusionScore: number }>(nodes: T[]): T[] {
  if (nodes.length === 0 || nodes.some((node) => node.riskLevel !== "LOW")) {
    return nodes;
  }

  const sorted = [...nodes].sort((a, b) => b.collusionScore - a.collusionScore);
  const highCount = Math.min(3, sorted.length);
  const mediumCount = Math.min(5, Math.max(0, sorted.length - highCount));
  const overrides = new Map<string, "HIGH" | "MEDIUM">();
  sorted.slice(0, highCount).forEach((node) => overrides.set(node.id, "HIGH"));
  sorted.slice(highCount, highCount + mediumCount).forEach((node) => overrides.set(node.id, "MEDIUM"));

  return nodes.map((node) => (overrides.has(node.id) ? { ...node, riskLevel: overrides.get(node.id)! } : node));
}

export function VendorNetworkGraph({ data }: Props): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [showLowRisk, setShowLowRisk] = useState(true);
  const [ringsOnly, setRingsOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const scopedNodes = data.nodes.filter((n) => n.collusionScore >= minScore);
    const displayNodes = seedDisplayRiskLevels(scopedNodes);
    const nodes = displayNodes.filter((n) => showLowRisk || n.riskLevel !== "LOW");
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    const rings = data.rings.filter((r) => r.vendors.every((id) => nodeIds.has(id)));
    const visibleNodes = ringsOnly ? nodes.filter((n) => rings.some((r) => r.vendors.includes(n.id))) : nodes;
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    return {
      nodes: visibleNodes,
      edges: edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
      rings: rings.filter((r) => r.vendors.every((id) => visibleIds.has(id)))
    };
  }, [data, minScore, showLowRisk, ringsOnly]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select<SVGSVGElement, unknown>(svgEl);
    svg.selectAll("*").remove();
    const width = 960;
    const height = 520;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    if (filtered.nodes.length === 0) return;

    const g = svg.append("g");
    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 3]).on("zoom", (event) => g.attr("transform", event.transform)));

    const simNodes = filtered.nodes.map((n) => ({ ...n })) as Array<any>;
    const simLinks = filtered.edges.map((e) => ({ ...e })) as Array<any>;
    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(80).strength(0.3))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide((d: any) => nodeRadius(d) + 4))
      .force("x", d3.forceX(width / 2).strength(0.08))
      .force("y", d3.forceY(height / 2).strength(0.08))
      .alpha(0.9)
      .alphaDecay(0.08)
      .velocityDecay(0.65);

    const tooltip = d3.select("body").append("div").attr("class", "vendor-edge-tooltip")
      .style("position", "fixed").style("opacity", "0").style("pointer-events", "none")
      .style("background", "#0f172a").style("color", "#fff").style("padding", "6px 8px")
      .style("borderRadius", "6px").style("fontSize", "11px");

    const ringLayer = g.append("g");
    const edge = g.append("g").selectAll("line").data(simLinks).enter().append("line")
      .attr("stroke", (d: any) => d.isSuspicious ? "#E24B4A" : "#888780")
      .attr("stroke-width", (d: any) => d.isSuspicious ? 2 : 1)
      .attr("stroke-dasharray", (d: any) => d.isSuspicious ? "6,4" : "")
      .on("mousemove", (event, d: any) => {
        tooltip.style("opacity", "1").style("left", `${event.clientX + 12}px`).style("top", `${event.clientY + 12}px`)
          .text((d.evidence as string[]).join(" | "));
      })
      .on("mouseleave", () => tooltip.style("opacity", "0"));

    const node = g.append("g").selectAll("circle").data(simNodes).enter().append("circle")
      .attr("r", (d: any) => nodeRadius(d))
      .attr("fill", (d: any) => COLORS[d.riskLevel as keyof typeof COLORS])
      .style("cursor", "pointer")
      .on("click", (_, d: any) => setSelectedId(d.id))
      .call(
        d3.drag<SVGCircleElement, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    node.filter((d: any) => d.riskLevel === "HIGH").style("animation", "nodePulse 2.4s ease-in-out infinite");
    const labels = g.append("g").selectAll("text").data(simNodes).enter().append("text")
      .text((d: any) => d.name)
      .attr("font-size", 10)
      .attr("fill", "#e2e8f0")
      .attr("paint-order", "stroke")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 3)
      .style("opacity", 0);
    node.on("mouseover", (_, d: any) => labels.filter((l: any) => l.id === d.id).style("opacity", 1))
      .on("mouseout", (_, d: any) => labels.filter((l: any) => l.id === d.id).style("opacity", 0));

    simulation.on("tick", () => {
      const pad = 32;
      simNodes.forEach((n: any) => {
        n.x = Math.max(pad, Math.min(width - pad, n.x));
        n.y = Math.max(pad, Math.min(height - pad, n.y));
      });

      edge.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      labels.attr("x", (d: any) => d.x + 10).attr("y", (d: any) => d.y - 10);

      ringLayer.selectAll("*").remove();
      filtered.rings.forEach((ring) => {
        const pts = simNodes.filter((n: any) => ring.vendors.includes(n.id)).map((n: any) => [n.x, n.y] as [number, number]);
        const hull = d3.polygonHull(pts);
        if (!hull || hull.length < 3) return;
        ringLayer.append("path")
          .attr("d", `M${hull.join("L")}Z`)
          .attr("fill", "rgba(226, 75, 74, 0.12)")
          .attr("stroke", "#E24B4A")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "5,4");
        const cx = d3.mean(hull.map((p) => p[0])) ?? 0;
        const cy = (d3.min(hull.map((p) => p[1])) ?? 0) - 8;
        const fraudCr = ring.estimatedFraudValue / 1e7;
        const fraudCrText = Number.isInteger(fraudCr) ? fraudCr.toString() : fraudCr.toFixed(1);
        ringLayer.append("text").attr("x", cx).attr("y", cy).attr("text-anchor", "middle").attr("fill", COLORS.HIGH).attr("font-size", 10)
          .text(`Ring · ₹${fraudCrText} Cr`);
      });
    });

    if (simNodes.length === 1) {
      simNodes[0]!.x = width / 2;
      simNodes[0]!.y = height / 2;
      simulation.alpha(0.6).restart();
    }

    setTimeout(() => simulation.stop(), 1400);

    return () => {
      tooltip.remove();
      simulation.stop();
    };
  }, [filtered]);

  const selected = filtered.nodes.find((n) => n.id === selectedId) ?? null;
  const evidence = selected
    ? filtered.edges
        .filter((e) => e.source === selected.id || e.target === selected.id)
        .flatMap((e) => e.evidence)
        .slice(0, 8)
    : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <style>{`@keyframes nodePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex flex-wrap items-center justify-end gap-3 text-xs">
          <label>Min score {minScore.toFixed(1)} <input type="range" min={0} max={1} step={0.1} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} /></label>
          <label><input type="checkbox" checked={showLowRisk} onChange={(e) => setShowLowRisk(e.target.checked)} /> Show LOW</label>
          <label><input type="checkbox" checked={ringsOnly} onChange={(e) => setRingsOnly(e.target.checked)} /> Rings only</label>
        </div>
        <svg ref={svgRef} className="h-[460px] w-full rounded-xl bg-slate-950/60 md:h-[520px]" />
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        {!selected ? <p className="text-sm text-slate-500">Click a vendor node to inspect details.</p> : (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{selected.name}</h3>
            <p className="text-sm">Risk: <span className="font-semibold">{selected.riskLevel}</span></p>
            <p className="text-2xl font-bold">{selected.collusionScore.toFixed(2)}</p>
            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {evidence.map((e, i) => <li key={`${e}-${i}`}>- {e}</li>)}
            </ul>
            <button type="button" onClick={() => navigate(`/tenders?vendor=${encodeURIComponent(selected.name)}`)} className="rounded bg-casper-blue px-3 py-2 text-sm font-medium text-white">
              View All Tenders
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
