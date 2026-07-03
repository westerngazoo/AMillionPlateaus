class_name LabelPlan
extends RefCounted
## Pure label declutter for the immersive client (R-0025 / SPEC-0025 §2.5, AC3).
##
## A direct port of R-0024's `planLabels`: greedy, priority focused → lit → rest
## (stable by input order within a tier), keep a label only if its screen rect
## clears every rect already kept. The ALGORITHM is unchanged — only the input
## rects differ (3D labels projected to the active camera instead of 2D points).
##
## The camera-dependent surface — the port's real risk — is `project_to_rect`,
## given its own pure handle here (camera modelled as a plain view Transform3D +
## Projection so it is testable with no Camera3D node). Distance-fade is a separate
## material concern, not here.

## Which label ids to draw this frame. `items` is an Array of { id, rect: Rect2 }
## already projected (cull behind/outside upstream — a null rect must not be passed).
## `focused` is the travelled-to id ("" = none); `lit` is a Dictionary used as a set
## (id -> true). Returns the kept ids, deterministic (priority then input order).
static func plan_labels(items: Array, focused: String = "", lit: Dictionary = {}) -> Array:
	var ranked := []
	for i in items.size():
		var it = items[i]
		var r := 2
		if it.id == focused:
			r = 0
		elif lit.has(it.id):
			r = 1
		ranked.append({"it": it, "i": i, "r": r})
	ranked.sort_custom(func(a, b): return a.r < b.r if a.r != b.r else a.i < b.i)

	var kept := []
	var boxes: Array[Rect2] = []
	for entry in ranked:
		var rect: Rect2 = entry.it.rect
		var collide := false
		for b in boxes:
			if rect.intersects(b):
				collide = true
				break
		if collide:
			continue
		boxes.append(rect)
		kept.append(entry.it.id)
	return kept

## The set of ids "in focus scope" — the focus plateau plus its bridge-neighbors.
## A bridge shows its concept label iff one of its endpoints is in this set (A4).
## Empty focus → empty scope (all bridge labels hidden). Pure, order-free set.
static func focus_scope(focus: String, neighbors: Dictionary = {}) -> Dictionary:
	var scope := {}
	if focus.is_empty():
		return scope
	scope[focus] = true
	for n in neighbors:
		scope[n] = true
	return scope

## Whether a bridge's concept label should be drawn: visible when either endpoint is
## in the focus scope, hidden otherwise. Pure, unit-testable headless.
static func bridge_label_visible(from_id: String, to_id: String, scope: Dictionary) -> bool:
	return scope.has(from_id) or scope.has(to_id)

## Project a world point to a screen-space label Rect2, or return a sentinel when
## it is behind or outside the frustum (caller must skip those before plan_labels).
## The camera is a plain `view` (the inverse camera transform, world→view) + a
## `proj` (the projection matrix) + the `viewport` size — NO Camera3D node, so this
## is unit-testable headless. The label box is centred horizontally on the point
## and sits just below it (mirrors the 2D `labelBox`).
##
## Returns a Rect2; on cull returns `BEHIND` (a Rect2 with negative size sentinel).
const BEHIND := Rect2(0, 0, -1, -1) # sentinel: not visible

static func is_visible(rect: Rect2) -> bool:
	return rect.size.x >= 0.0 and rect.size.y >= 0.0

static func project_to_rect(world_pos: Vector3, view: Transform3D, proj: Projection, viewport: Vector2, label_size: Vector2) -> Rect2:
	var v := view * world_pos # into view space (camera looks down -Z)
	if v.z >= 0.0:
		return BEHIND # behind the camera
	var clip := proj * Vector4(v.x, v.y, v.z, 1.0)
	if clip.w <= 0.0:
		return BEHIND
	var ndc := Vector3(clip.x, clip.y, clip.z) / clip.w
	if ndc.x < -1.0 or ndc.x > 1.0 or ndc.y < -1.0 or ndc.y > 1.0:
		return BEHIND # outside the frustum
	var sx := (ndc.x * 0.5 + 0.5) * viewport.x
	var sy := (1.0 - (ndc.y * 0.5 + 0.5)) * viewport.y # y grows down on screen
	return Rect2(sx - label_size.x * 0.5, sy, label_size.x, label_size.y)
