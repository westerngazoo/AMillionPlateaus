class_name Minimap
extends CanvasLayer
## A6: a 2D top-down minimap / compass inset (Track A). Projects plateau positions
## onto the e1×e3 plane (world x×y) into a small corner panel, drawing a dot per
## plateau and an arrow for the camera. PURE CONSUMER: it only reads world positions
## and the camera pose — no GA, no graph mutation. Kept isolated: world.gd feeds it
## points + the camera pose, and ALL the mapping math is static + unit-tested headless
## (a Control node is not needed to verify the projection).

const SIZE := Vector2(180.0, 180.0)
const MARGIN := 12.0
const PAD := 10.0
const BG := Color(0.05, 0.07, 0.10, 0.72)
const BORDER := Color(0.35, 0.45, 0.6, 0.9)
const DOT := Color(0.62, 0.85, 1.0)
const CAM := Color(1.0, 0.82, 0.4)

var _panel: Control
var _points: Dictionary = {} # id -> Vector2 (e1, e3)
var _colors: Dictionary = {} # id -> Color
var _lo := Vector2(-1, -1)
var _hi := Vector2(1, 1)
var _cam_pos := Vector2.ZERO
var _cam_dir := Vector2(0, -1)
var _has_cam := false

func _ready() -> void:
	layer = 20
	if _panel == null:
		_panel = Control.new()
		_panel.name = "MinimapPanel"
		_panel.size = SIZE
		_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(_panel)
		_panel.draw.connect(_draw_panel)
	_reposition()

func _reposition() -> void:
	if _panel == null or not _panel.is_inside_tree():
		return
	var vp := _panel.get_viewport_rect().size
	_panel.position = Vector2(vp.x - SIZE.x - MARGIN, MARGIN)

## Feed the plateau plane points (id -> Vector2 in (e1, e3)); recomputes bounds.
## `colors` optionally tints each dot (reuses the A3 domain palette upstream).
func set_points(points: Dictionary, colors: Dictionary = {}) -> void:
	_points = points.duplicate()
	_colors = colors.duplicate()
	var arr: Array = []
	for id in _points:
		arr.append(_points[id])
	var b := compute_bounds(arr)
	_lo = b.lo
	_hi = b.hi
	if _panel != null:
		_panel.queue_redraw()

## Feed the camera plane position + heading (both in (e1, e3) world coords).
func set_camera(pos: Vector2, heading: Vector2) -> void:
	_cam_pos = pos
	_cam_dir = heading.normalized() if heading.length() > 0.0001 else Vector2(0, -1)
	_has_cam = true
	if _panel != null:
		_panel.queue_redraw()

func _draw_panel() -> void:
	_reposition() # keep pinned on viewport resize
	_panel.draw_rect(Rect2(Vector2.ZERO, SIZE), BG, true)
	_panel.draw_rect(Rect2(Vector2.ZERO, SIZE), BORDER, false, 2.0)
	for id in _points:
		var p: Vector2 = project(_points[id], _lo, _hi, SIZE, PAD)
		var col: Color = _colors.get(id, DOT)
		_panel.draw_circle(p, 3.0, col)
	if _has_cam:
		var c: Vector2 = project(_cam_pos, _lo, _hi, SIZE, PAD)
		_panel.draw_circle(c, 3.5, CAM)
		# heading arrow: flip y so world +e3 (up) points toward the TOP of the inset
		var d := Vector2(_cam_dir.x, -_cam_dir.y).normalized()
		_panel.draw_line(c, c + d * 12.0, CAM, 2.0)

# ── pure projection (unit-testable headless) ─────────────────────────────────────

## Axis-aligned bounds of a set of plane points; empty → a unit box (avoids /0).
static func compute_bounds(points: Array) -> Dictionary:
	if points.is_empty():
		return {"lo": Vector2(-1, -1), "hi": Vector2(1, 1)}
	var lo := Vector2(INF, INF)
	var hi := Vector2(-INF, -INF)
	for p in points:
		lo = Vector2(minf(lo.x, p.x), minf(lo.y, p.y))
		hi = Vector2(maxf(hi.x, p.x), maxf(hi.y, p.y))
	return {"lo": lo, "hi": hi}

## Map a plane point (e1, e3) into the padded panel rect. y is flipped so larger e3
## (world up) sits toward the TOP of the inset; a degenerate span centres that axis.
static func project(point: Vector2, lo: Vector2, hi: Vector2, size: Vector2, pad: float = 10.0) -> Vector2:
	var span := hi - lo
	var inner := size - Vector2(pad, pad) * 2.0
	var nx := 0.5 if span.x <= 0.0001 else (point.x - lo.x) / span.x
	var ny := 0.5 if span.y <= 0.0001 else (point.y - lo.y) / span.y
	return Vector2(pad + nx * inner.x, pad + (1.0 - ny) * inner.y)
