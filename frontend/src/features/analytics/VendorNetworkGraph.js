import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
const COLORS = {
    HIGH: "#E24B4A",
    MEDIUM: "#EF9F27",
    LOW: "#1D9E75"
};
const nodeRadius = (vendor) => Math.max(8, Math.min(28, 8 + vendor.totalTenders * 0.8));
function seedDisplayRiskLevels(nodes) {
    if (nodes.length === 0 || nodes.some((node) => node.riskLevel !== "LOW")) {
        return nodes;
    }
    const sorted = [...nodes].sort((a, b) => b.collusionScore - a.collusionScore);
    const highCount = Math.min(3, sorted.length);
    const mediumCount = Math.min(5, Math.max(0, sorted.length - highCount));
    const overrides = new Map();
    sorted.slice(0, highCount).forEach((node) => overrides.set(node.id, "HIGH"));
    sorted.slice(highCount, highCount + mediumCount).forEach((node) => overrides.set(node.id, "MEDIUM"));
    return nodes.map((node) => (overrides.has(node.id) ? { ...node, riskLevel: overrides.get(node.id) } : node));
}
export function VendorNetworkGraph({ data }) {
    const svgRef = useRef(null);
    const [minScore, setMinScore] = useState(0);
    const [showLowRisk, setShowLowRisk] = useState(true);
    const [ringsOnly, setRingsOnly] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
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
        if (!svgEl)
            return;
        const svg = d3.select(svgEl);
        svg.selectAll("*").remove();
        const width = 960;
        const height = 520;
        svg.attr("viewBox", `0 0 ${width} ${height}`);
        if (filtered.nodes.length === 0)
            return;
        const g = svg.append("g");
        svg.call(d3.zoom().scaleExtent([0.4, 3]).on("zoom", (event) => g.attr("transform", event.transform)));
        const simNodes = filtered.nodes.map((n) => ({ ...n }));
        const simLinks = filtered.edges.map((e) => ({ ...e }));
        const simulation = d3.forceSimulation(simNodes)
            .force("link", d3.forceLink(simLinks).id((d) => d.id).distance(80).strength(0.3))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide((d) => nodeRadius(d) + 4))
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
            .attr("stroke", (d) => d.isSuspicious ? "#E24B4A" : "#888780")
            .attr("stroke-width", (d) => d.isSuspicious ? 2 : 1)
            .attr("stroke-dasharray", (d) => d.isSuspicious ? "6,4" : "")
            .on("mousemove", (event, d) => {
            tooltip.style("opacity", "1").style("left", `${event.clientX + 12}px`).style("top", `${event.clientY + 12}px`)
                .text(d.evidence.join(" | "));
        })
            .on("mouseleave", () => tooltip.style("opacity", "0"));
        const node = g.append("g").selectAll("circle").data(simNodes).enter().append("circle")
            .attr("r", (d) => nodeRadius(d))
            .attr("fill", (d) => COLORS[d.riskLevel])
            .style("cursor", "pointer")
            .on("click", (_, d) => setSelectedId(d.id))
            .call(d3.drag()
            .on("start", (event, d) => {
            if (!event.active)
                simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
            .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
            .on("end", (event, d) => {
            if (!event.active)
                simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }));
        node.filter((d) => d.riskLevel === "HIGH").style("animation", "nodePulse 2.4s ease-in-out infinite");
        const labels = g.append("g").selectAll("text").data(simNodes).enter().append("text")
            .text((d) => d.name)
            .attr("font-size", 10)
            .attr("fill", "#e2e8f0")
            .attr("paint-order", "stroke")
            .attr("stroke", "#0f172a")
            .attr("stroke-width", 3)
            .style("opacity", 0);
        node.on("mouseover", (_, d) => labels.filter((l) => l.id === d.id).style("opacity", 1))
            .on("mouseout", (_, d) => labels.filter((l) => l.id === d.id).style("opacity", 0));
        simulation.on("tick", () => {
            const pad = 32;
            simNodes.forEach((n) => {
                n.x = Math.max(pad, Math.min(width - pad, n.x));
                n.y = Math.max(pad, Math.min(height - pad, n.y));
            });
            edge.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
            node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
            labels.attr("x", (d) => d.x + 10).attr("y", (d) => d.y - 10);
            ringLayer.selectAll("*").remove();
            filtered.rings.forEach((ring) => {
                const pts = simNodes.filter((n) => ring.vendors.includes(n.id)).map((n) => [n.x, n.y]);
                const hull = d3.polygonHull(pts);
                if (!hull || hull.length < 3)
                    return;
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
            simNodes[0].x = width / 2;
            simNodes[0].y = height / 2;
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
    return (_jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]", children: [_jsx("style", { children: `@keyframes nodePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}` }), _jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("div", { className: "mb-2 flex flex-wrap items-center justify-end gap-3 text-xs", children: [_jsxs("label", { children: ["Min score ", minScore.toFixed(1), " ", _jsx("input", { type: "range", min: 0, max: 1, step: 0.1, value: minScore, onChange: (e) => setMinScore(Number(e.target.value)) })] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: showLowRisk, onChange: (e) => setShowLowRisk(e.target.checked) }), " Show LOW"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: ringsOnly, onChange: (e) => setRingsOnly(e.target.checked) }), " Rings only"] })] }), _jsx("svg", { ref: svgRef, className: "h-[460px] w-full rounded-xl bg-slate-950/60 md:h-[520px]" })] }), _jsx("aside", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900", children: !selected ? _jsx("p", { className: "text-sm text-slate-500", children: "Click a vendor node to inspect details." }) : (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-lg font-semibold", children: selected.name }), _jsxs("p", { className: "text-sm", children: ["Risk: ", _jsx("span", { className: "font-semibold", children: selected.riskLevel })] }), _jsx("p", { className: "text-2xl font-bold", children: selected.collusionScore.toFixed(2) }), _jsx("ul", { className: "space-y-1 text-xs text-slate-600 dark:text-slate-300", children: evidence.map((e, i) => _jsxs("li", { children: ["- ", e] }, `${e}-${i}`)) }), _jsx("button", { type: "button", onClick: () => navigate(`/tenders?vendor=${encodeURIComponent(selected.name)}`), className: "rounded bg-casper-blue px-3 py-2 text-sm font-medium text-white", children: "View All Tenders" })] })) })] }));
}
