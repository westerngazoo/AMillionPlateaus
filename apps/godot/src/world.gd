class_name MPWorld
extends Node3D
## Builds the flat-3D scene from a GraphSource (R-0025 / SPEC-0025 §2.3, AC1/AC2/AC3).
## Parallel-dev: reads MP_WORLD_BLOB (CRDT bytes from the web app) and hot-reloads on change.
## Focus lens: click a plateau → it glows full size; bridge neighbors medium; rest dim dots.

const LIT := Color(1.0, 0.82, 0.4)
const FOGGED := Color(0.18, 0.24, 0.31)
const FOCUS := Color(0.62, 0.85, 1.0)
const RESOURCE := Color(0.55, 1.0, 0.72)
const PlaceNodeS := preload("res://src/place_node.gd")
const LabelPlanS := preload("res://src/label_plan.gd")
const DomainPaletteS := preload("res://src/domain_palette.gd")
const MinimapS := preload("res://src/minimap.gd")
const FixtureS := preload("res://src/graph_source_fixture.gd")
const NativeAdapterS := preload("res://src/graph_source_native.gd")

var source
var positions_by_id: Dictionary = {}
var _plateau_nodes: Dictionary = {} # id -> Node3D
var _bridge_nodes: Dictionary = {} # bridge id -> Node3D
var _domain_by_id: Dictionary = {} # plateau id -> domain_id
var _minimap # Minimap CanvasLayer (created only when running in-tree)
var _bridges: Array = []
var _focus_id: String = ""
var _lens_mode: bool = true
var _rep_json: String = "{}"
var _lit_ids: Dictionary = {}
var _watch_path: String = ""
var _watch_rep_path: String = ""
var _watch_focus_path: String = ""
var _watch_mtime: int = 0
var _watch_rep_mtime: int = 0
var _watch_focus_mtime: int = 0
var _watch_timer: float = 0.0
var _label_timer: float = 0.0

func _ready() -> void:
	if source != null:
		return
	_boot()

func _boot() -> void:
	_sidecar_paths()
	_ensure_minimap()
	var native = NativeAdapterS.new()
	if native.is_available():
		_load_sidecars()
		if _try_load_blob(native):
			build(native, _rep_json)
			return
		native.seed_demo()
		build(native, _rep_json)
	else:
		build(FixtureS.new())

func _sidecar_paths() -> void:
	_watch_path = OS.get_environment("MP_WORLD_BLOB")
	if _watch_path.is_empty():
		return
	var dir := _watch_path.get_base_dir()
	_watch_rep_path = dir.path_join("reputation.json")
	_watch_focus_path = dir.path_join("focus.json")

func _load_sidecars() -> void:
	_rep_json = _read_text(_watch_rep_path, "{}")
	_apply_focus_file()

func _read_text(path: String, fallback: String) -> String:
	if path.is_empty() or not FileAccess.file_exists(path):
		return fallback
	var text := FileAccess.get_file_as_string(path)
	return text if not text.is_empty() else fallback

func _apply_focus_file() -> void:
	if _watch_focus_path.is_empty() or not FileAccess.file_exists(_watch_focus_path):
		return
	var parsed := parse_focus(FileAccess.get_file_as_string(_watch_focus_path))
	_lens_mode = parsed.lens_mode
	_focus_id = parsed.focus_id
	_apply_focus_visuals()
	_fly_to_focus()

## Pure: parse a `focus.json` payload → { lens_mode: bool, focus_id: String }. Mirrors
## the read-only sync contract: `lens_mode` gates whether `lens_id` is the active
## focus, and a "null"/absent id (or the lens turned off) means no focus. Bad JSON →
## lens on, no focus. Static + scene-free so it is unit-tested headless.
static func parse_focus(text: String) -> Dictionary:
	var data = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY:
		return {"lens_mode": true, "focus_id": ""}
	var lens_mode := bool(data.get("lens_mode", true))
	var lid := str(data.get("lens_id", ""))
	if lid == "null":
		lid = ""
	return {"lens_mode": lens_mode, "focus_id": lid if lens_mode else ""}

# A2: smoothly tween the camera toward the current focus plateau (if any). Guarded on
# tree membership + a known position so build()/headless callers stay side-effect free.
func _fly_to_focus() -> void:
	if not is_inside_tree():
		return
	var active := _focus_id if _lens_mode else ""
	if active.is_empty() or not positions_by_id.has(active):
		return
	var cam := get_node_or_null("Camera3D")
	if cam != null and cam.has_method("fly_to"):
		cam.fly_to(positions_by_id[active])

func _try_load_blob(native) -> bool:
	_watch_path = OS.get_environment("MP_WORLD_BLOB")
	if _watch_path.is_empty():
		return false
	if not FileAccess.file_exists(_watch_path):
		return false
	var bytes := FileAccess.get_file_as_bytes(_watch_path)
	if bytes.is_empty():
		return false
	if not native.load_bytes(bytes):
		push_warning("MP_WORLD_BLOB failed to load: %s" % _watch_path)
		return false
	_watch_mtime = FileAccess.get_modified_time(_watch_path)
	if FileAccess.file_exists(_watch_rep_path):
		_watch_rep_mtime = FileAccess.get_modified_time(_watch_rep_path)
	if FileAccess.file_exists(_watch_focus_path):
		_watch_focus_mtime = FileAccess.get_modified_time(_watch_focus_path)
	print("Loaded world from %s (%d bytes)" % [_watch_path, bytes.size()])
	return true

func _process(delta: float) -> void:
	_label_timer += delta
	if _label_timer >= 0.25:
		_label_timer = 0.0
		_update_labels()
		_update_minimap_camera()
	if _watch_path.is_empty():
		return
	_watch_timer += delta
	if _watch_timer < 1.0:
		return
	_watch_timer = 0.0
	_poll_sidecars()

func _poll_sidecars() -> void:
	var world_changed := false
	if FileAccess.file_exists(_watch_path):
		var mtime := FileAccess.get_modified_time(_watch_path)
		if mtime != _watch_mtime:
			_watch_mtime = mtime
			world_changed = true
	if FileAccess.file_exists(_watch_rep_path):
		var rm := FileAccess.get_modified_time(_watch_rep_path)
		if rm != _watch_rep_mtime:
			_watch_rep_mtime = rm
			_rep_json = _read_text(_watch_rep_path, "{}")
			world_changed = true
	if FileAccess.file_exists(_watch_focus_path):
		var fm := FileAccess.get_modified_time(_watch_focus_path)
		if fm != _watch_focus_mtime:
			_watch_focus_mtime = fm
			_apply_focus_file()
	if not world_changed:
		return
	print("world sync changed — reloading…")
	var native = NativeAdapterS.new()
	if native.is_available() and _try_load_blob(native):
		build(native, _rep_json)

func build(src, rep_json: String = "") -> void:
	source = src
	if not rep_json.is_empty():
		_rep_json = rep_json
	_focus_id = ""
	_lens_mode = true
	var graph := get_node_or_null("Graph")
	if graph == null:
		graph = Node3D.new()
		graph.name = "Graph"
		add_child(graph)
	for c in graph.get_children():
		c.queue_free()
	positions_by_id.clear()
	_plateau_nodes.clear()
	_bridge_nodes.clear()
	_domain_by_id.clear()
	_bridges = src.bridges()

	var plats: Array = src.plateaus()
	var fit: Dictionary = PlaceNodeS.compute_fit(plats, _fit_span(plats.size()))
	_lit_ids = {}
	for id in src.reachable(_rep_json):
		_lit_ids[str(id)] = true

	var raw: Dictionary = {}
	for p in plats:
		raw[p.id] = PlaceNodeS.place_node(p.e1, p.e2, p.e3, fit)
	var spread: Dictionary = PlaceNodeS.spread_positions(
		raw,
		PlaceNodeS.adaptive_min_dist(plats.size()),
		32
	)

	for p in plats:
		var world_pos: Vector3 = spread[p.id]
		positions_by_id[p.id] = world_pos
		_domain_by_id[p.id] = str(p.get("domain_id", ""))
		var node := _make_plateau(p, world_pos, _lit_ids.has(p.id))
		graph.add_child(node)
		_plateau_nodes[p.id] = node

	for b in _bridges:
		if positions_by_id.has(b.from) and positions_by_id.has(b.to):
			var bnode := _make_bridge(b, positions_by_id[b.from], positions_by_id[b.to])
			graph.add_child(bnode)
			_bridge_nodes[b.id] = bnode

	_attach_resources(src)

	_ensure_environment()
	_frame_camera()
	_apply_focus_file()
	_apply_focus_visuals()
	_feed_minimap_points()
	if is_inside_tree():
		_update_labels()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if _pick_plateau(event.position):
			get_viewport().set_input_as_handled()

func _pick_plateau(screen_pos: Vector2) -> bool:
	var cam := get_node_or_null("Camera3D") as Camera3D
	if cam == null:
		return false
	var origin := cam.project_ray_origin(screen_pos)
	var dir := cam.project_ray_normal(screen_pos)
	var best_id := ""
	var best_t := INF
	for id in _plateau_nodes:
		var node: Node3D = _plateau_nodes[id]
		var center := node.global_position
		var oc := origin - center
		var b := 2.0 * oc.dot(dir)
		var c := oc.length_squared() - 0.7 * 0.7
		var disc := b * b - 4.0 * c
		if disc < 0.0:
			continue
		var t := (-b - sqrt(disc)) / 2.0
		if t > 0.0 and t < best_t:
			best_t = t
			best_id = id
	if best_id.is_empty():
		return false
	_focus_id = best_id
	_apply_focus_visuals()
	_fly_to_focus()
	print("Focus: %s" % best_id)
	return true

func _update_labels() -> void:
	if _plateau_nodes.is_empty() or not is_inside_tree():
		return
	var cam := get_node_or_null("Camera3D") as Camera3D
	if cam == null:
		return
	var vp := get_viewport().get_visible_rect().size
	var view := cam.global_transform.affine_inverse()
	var proj := cam.get_camera_projection()
	var label_size := Vector2(96, 16)
	var items: Array = []
	for id in _plateau_nodes:
		var node: Node3D = _plateau_nodes[id]
		var rect: Rect2 = LabelPlanS.project_to_rect(node.global_position, view, proj, vp, label_size)
		if LabelPlanS.is_visible(rect):
			items.append({"id": id, "rect": rect})
	var active_focus := _focus_id if _lens_mode else ""
	var kept: Array = LabelPlanS.plan_labels(items, active_focus, _lit_ids)
	var kept_set := {}
	for kid in kept:
		kept_set[kid] = true
	for id in _plateau_nodes:
		var node: Node3D = _plateau_nodes[id]
		if node.get_child_count() < 2:
			continue
		var label := node.get_child(1) as Label3D
		if label:
			label.visible = kept_set.has(id)

# A6: create the minimap once, in-tree only (build()-from-test callers skip it, so the
# minimap stays fully isolated from the headless scene smoke).
func _ensure_minimap() -> void:
	if _minimap != null or not is_inside_tree():
		return
	_minimap = MinimapS.new()
	_minimap.name = "Minimap"
	add_child(_minimap)

# Feed the minimap the plateau dots on the e1×e3 plane (world x×y), tinted by domain.
func _feed_minimap_points() -> void:
	if _minimap == null:
		return
	var pts: Dictionary = {}
	var cols: Dictionary = {}
	for id in positions_by_id:
		var wp: Vector3 = positions_by_id[id]
		pts[id] = Vector2(wp.x, wp.y)
		cols[id] = DomainPaletteS.domain_color(str(_domain_by_id.get(id, "")))
	_minimap.set_points(pts, cols)

# Push the current camera pose (position + forward) onto the minimap, projected to
# the same e1×e3 plane so the compass arrow tracks where you are looking.
func _update_minimap_camera() -> void:
	if _minimap == null:
		return
	var cam := get_node_or_null("Camera3D") as Camera3D
	if cam == null:
		return
	var pos := cam.global_position
	var fwd := -cam.global_transform.basis.z
	_minimap.set_camera(Vector2(pos.x, pos.y), Vector2(fwd.x, fwd.y))

# A5: render read-only resource orbs, parented to their plateau node so they inherit
# its world position + focus-lens scale (and never change the Graph child count, which
# the scene smoke test guards). Resources whose plateau is absent are skipped.
func _attach_resources(src) -> void:
	var res: Array = src.resources() if src.has_method("resources") else []
	var by_plateau: Dictionary = {}
	for r in res:
		var pid := str(r.get("plateau_id", ""))
		if not _plateau_nodes.has(pid):
			continue
		if not by_plateau.has(pid):
			by_plateau[pid] = []
		by_plateau[pid].append(r)
	for pid in by_plateau:
		var list: Array = by_plateau[pid]
		var node: Node3D = _plateau_nodes[pid]
		for i in list.size():
			node.add_child(_make_resource_marker(list[i], i, list.size()))

func _make_resource_marker(r: Dictionary, index: int, count: int) -> MeshInstance3D:
	var orb := MeshInstance3D.new()
	orb.name = "Resource_%s" % str(r.get("id", index))
	orb.set_meta("resource_id", str(r.get("id", "")))
	var sphere := SphereMesh.new()
	sphere.radius = 0.12
	sphere.height = 0.24
	orb.mesh = sphere
	orb.position = PlaceNodeS.resource_offset(index, count)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = RESOURCE
	mat.emission_enabled = true
	mat.emission = RESOURCE
	mat.emission_energy_multiplier = 1.2
	orb.material_override = mat
	return orb

func _neighbor_ids(id: String) -> Dictionary:
	var out := {}
	for b in _bridges:
		if b.from == id:
			out[b.to] = true
		if b.to == id:
			out[b.from] = true
	return out

func _apply_focus_visuals() -> void:
	var active_focus := _focus_id if _lens_mode else ""
	var neighbors := _neighbor_ids(active_focus) if not active_focus.is_empty() else {}
	for id in _plateau_nodes:
		var node: Node3D = _plateau_nodes[id]
		var mesh := node.get_child(0) as MeshInstance3D
		if mesh == null:
			continue
		var tier := "full"
		if _lens_mode and not active_focus.is_empty():
			if id == active_focus:
				tier = "lens"
			elif neighbors.has(id):
				tier = "neighbor"
			else:
				tier = "context"

		var scale := 1.0
		var alpha := 1.0
		match tier:
			"lens":
				scale = 1.35
				alpha = 1.0
			"neighbor":
				scale = 0.9
				alpha = 0.85
			"context":
				scale = 0.4
				alpha = 0.35
			_:
				scale = 1.0
				alpha = 1.0

		node.scale = Vector3.ONE * scale
		var mat := mesh.material_override as StandardMaterial3D
		if mat:
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA if alpha < 0.99 else BaseMaterial3D.TRANSPARENCY_DISABLED
			mat.albedo_color.a = alpha
			var is_lit := _lit_ids.has(id)
			if tier == "lens":
				mat.emission_enabled = true
				mat.emission = FOCUS
				mat.emission_energy_multiplier = 2.0
			else:
				mat.emission_enabled = is_lit
				mat.emission = LIT if is_lit else FOGGED
				mat.emission_energy_multiplier = 1.6 if is_lit else 0.0
	_update_bridge_labels(active_focus, neighbors)

# A4: show a bridge's concept label only when one endpoint is in the focus scope
# (the focus plateau or one of its bridge-neighbors); hidden otherwise.
func _update_bridge_labels(active_focus: String, neighbors: Dictionary) -> void:
	var scope := LabelPlanS.focus_scope(active_focus, neighbors)
	for bid in _bridge_nodes:
		var bnode: Node3D = _bridge_nodes[bid]
		var label := bnode.get_node_or_null("Concept") as Label3D
		if label == null:
			continue
		var from_id := str(bnode.get_meta("from", ""))
		var to_id := str(bnode.get_meta("to", ""))
		label.visible = LabelPlanS.bridge_label_visible(from_id, to_id, scope)

func _ensure_environment() -> void:
	if get_node_or_null("WorldEnvironment") != null:
		return
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.06, 0.08, 0.11)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.45, 0.55, 0.7)
	env.ambient_light_energy = 0.6
	var we := WorldEnvironment.new()
	we.name = "WorldEnvironment"
	we.environment = env
	add_child(we)

func _frame_camera() -> void:
	var cam := get_node_or_null("Camera3D") as Camera3D
	if cam == null:
		return
	cam.position = Vector3(0.0, 5.0, 16.0)
	cam.look_at(Vector3.ZERO, Vector3.UP)

func _fit_span(count: int) -> float:
	return clampf(12.0 + sqrt(float(count)) * 1.2, 12.0, 28.0)

func _make_plateau(p: Dictionary, world_pos: Vector3, is_lit: bool) -> Node3D:
	var root := Node3D.new()
	root.name = "Plateau_%s" % p.id
	root.position = world_pos
	root.set_meta("plateau_id", p.id)

	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.7
	sphere.height = 1.4
	mesh.mesh = sphere
	var mat := StandardMaterial3D.new()
	# A3: tint the base material by a stable hash of the domain (read-only DTO). The
	# lit/fogged emission below is unchanged; fogged nodes just get a dimmer band so
	# the fog still reads against the void.
	var band := DomainPaletteS.domain_color(str(p.get("domain_id", "")))
	mat.albedo_color = band if is_lit else band.darkened(0.55)
	mat.emission_enabled = is_lit
	mat.emission = LIT
	mat.emission_energy_multiplier = 1.6
	mesh.material_override = mat
	root.add_child(mesh)

	var label := Label3D.new()
	label.text = p.name
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position = Vector3(0, -0.9, 0)
	root.add_child(label)
	return root

func _make_bridge(b: Dictionary, a: Vector3, c: Vector3) -> Node3D:
	var root := Node3D.new()
	root.name = "Bridge_%s" % b.id
	root.set_meta("bridge_id", b.id)
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	var span := a.distance_to(c)
	box.size = Vector3(0.04, 0.04, maxf(span, 0.001))
	mesh.mesh = box
	root.position = (a + c) * 0.5
	if span > 0.0001:
		var forward := (c - a).normalized()
		if forward.length_squared() > 0.0001:
			root.basis = Basis.looking_at(forward, Vector3.UP)
	root.add_child(mesh)

	# A4: billboard the bridge's concept at the midpoint. Endpoints are stored on the
	# node so visibility can be recomputed from the focus scope without re-reading the
	# DTO. Hidden by default — shown only when an endpoint is the focus or a neighbor.
	root.set_meta("from", b.from)
	root.set_meta("to", b.to)
	var label := Label3D.new()
	label.name = "Concept"
	label.text = str(b.get("concept", ""))
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 28
	label.modulate = Color(0.75, 0.85, 1.0)
	label.outline_size = 6
	label.visible = false
	root.add_child(label)
	return root
