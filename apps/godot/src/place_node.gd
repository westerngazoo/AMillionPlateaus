class_name PlaceNode
extends RefCounted
## Pure position mapping for the immersive client (R-0025 / SPEC-0025 §2.4, AC1).
##
## Maps a Grade-1 GA position (e1,e2,e3) to a world point. The client does NO GA —
## it consumes the {e1,e2,e3} floats the core already exposes and places a node:
##   x = e1   (Formal/Math axis → world right)
##   y = e3   (Creative axis → world UP, matching the 2D map's vertical)
##   z = e2   (Empirical axis → depth, the axis the 2D isometric map collapses)
## scaled + offset by `fit`. Both functions are pure, deterministic, and unit-tested
## with no engine (Vector3 is a headless built-in). `place_node` never reads scene
## state for the bounds — the bounds come from `compute_fit`.

## Map one GA position to a world point. `fit` is a plain value
## { scale: float, offset: Vector3 } from `compute_fit` (never a scene type).
static func place_node(e1: float, e2: float, e3: float, fit: Dictionary) -> Vector3:
	var scale: float = fit.get("scale", 1.0)
	var offset: Vector3 = fit.get("offset", Vector3.ZERO)
	return Vector3(e1, e3, e2) * scale + offset

## The 3D analogue of R-0024 "zoom to extent": bound the cluster of raw positions
## (in world-axis order x=e1,y=e3,z=e2) and return a { scale, offset } that fits it
## into a ~`span`-metre volume centred at the origin. Pure value, no scene type.
## `positions` is an Array of dicts with `e1`/`e2`/`e3` (the DTO shape).
static func compute_fit(positions: Array, span: float = 12.0) -> Dictionary:
	if positions.is_empty():
		return {"scale": 1.0, "offset": Vector3.ZERO}
	var lo := Vector3(INF, INF, INF)
	var hi := Vector3(-INF, -INF, -INF)
	for p in positions:
		var v := Vector3(p.e1, p.e3, p.e2) # world-axis order
		lo = Vector3(minf(lo.x, v.x), minf(lo.y, v.y), minf(lo.z, v.z))
		hi = Vector3(maxf(hi.x, v.x), maxf(hi.y, v.y), maxf(hi.z, v.z))
	var size := hi - lo
	var extent: float = maxf(size.x, maxf(size.y, size.z))
	var scale: float = (span / extent) if extent > 0.0 else 1.0
	var center := (lo + hi) * 0.5
	# offset so the SCALED centre lands at the origin
	return {"scale": scale, "offset": -center * scale}

## Push apart plateaus that landed too close after scaling (imported vaults).
## `positions` is id -> Vector3 raw world positions; returns adjusted copy.
static func spread_positions(positions: Dictionary, min_dist: float = 2.2, iterations: int = 24) -> Dictionary:
	var out: Dictionary = {}
	for id in positions:
		out[id] = positions[id]
	var ids: Array = out.keys()
	if ids.size() < 2:
		return out
	for _iter in iterations:
		var moved := false
		for i in ids.size():
			for j in range(i + 1, ids.size()):
				var id_a: String = ids[i]
				var id_b: String = ids[j]
				var a: Vector3 = out[id_a]
				var b: Vector3 = out[id_b]
				var delta := b - a
				var dist := delta.length()
				if dist < 0.001:
					delta = Vector3(0.1, 0.0, 0.1)
					dist = delta.length()
				if dist >= min_dist:
					continue
				var push := (min_dist - dist) * 0.5
				var dir := delta / dist
				out[id_a] = a - dir * push
				out[id_b] = b + dir * push
				moved = true
		if not moved:
			break
	return out

## Adaptive separation for large graphs (mirrors web layout.js).
static func adaptive_min_dist(count: int) -> float:
	return clampf(1.8 + sqrt(float(count)) * 0.35, 2.0, 5.5)
