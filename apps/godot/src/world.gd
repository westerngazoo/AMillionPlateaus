class_name MPWorld
extends Node3D
## Builds the flat-3D scene from a GraphSource (R-0025 / SPEC-0025 §2.3, AC1/AC2/AC3).
## Parallel-dev: reads MP_WORLD_BLOB (CRDT bytes from the web app) and hot-reloads on change.
## Focus lens: click a plateau → it glows full size; bridge neighbors medium; rest dim dots.

const LIT := Color(1.0, 0.82, 0.4)
const FOGGED := Color(0.18, 0.24, 0.31)
const FOCUS := Color(0.62, 0.85, 1.0)
const PlaceNodeS := preload("res://src/place_node.gd")
const FixtureS := preload("res://src/graph_source_fixture.gd")
const NativeAdapterS := preload("res://src/graph_source_native.gd")

var source
var positions_by_id: Dictionary = {}
var _plateau_nodes: Dictionary = {} # id -> Node3D
var _bridges: Array = []
var _focus_id: String = ""
var _watch_path: String = ""
var _watch_mtime: int = 0
var _watch_timer: float = 0.0

func _ready() -> void:
	if source != null:
		return
	_boot()

func _boot() -> void:
	var native = NativeAdapterS.new()
	if native.is_available():
		if _try_load_blob(native):
			build(native)
			return
		native.seed_demo()
		build(native)
	else:
		build(FixtureS.new())

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
	print("Loaded world from %s (%d bytes)" % [_watch_path, bytes.size()])
	return true

func _process(delta: float) -> void:
	if _watch_path.is_empty() or not FileAccess.file_exists(_watch_path):
		return
	_watch_timer += delta
	if _watch_timer < 1.0:
		return
	_watch_timer = 0.0
	var mtime := FileAccess.get_modified_time(_watch_path)
	if mtime == _watch_mtime:
		return
	_watch_mtime = mtime
	print("world.bin changed — reloading…")
	var native = NativeAdapterS.new()
	if native.is_available() and _try_load_blob(native):
		build(native)

func build(src, rep_json: String = "") -> void:
	source = src
	_focus_id = ""
	var graph := get_node_or_null("Graph")
	if graph == null:
		graph = Node3D.new()
		graph.name = "Graph"
		add_child(graph)
	for c in graph.get_children():
		c.queue_free()
	positions_by_id.clear()
	_plateau_nodes.clear()
	_bridges = src.bridges()

	var plats: Array = src.plateaus()
	var fit: Dictionary = PlaceNodeS.compute_fit(plats, _fit_span(plats.size()))
	var lit := {}
	for id in src.reachable(rep_json):
		lit[id] = str(id)

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
		var node := _make_plateau(p, world_pos, lit.has(p.id))
		graph.add_child(node)
		_plateau_nodes[p.id] = node

	for b in _bridges:
		if positions_by_id.has(b.from) and positions_by_id.has(b.to):
			graph.add_child(_make_bridge(b, positions_by_id[b.from], positions_by_id[b.to]))

	_ensure_environment()
	_frame_camera()
	_apply_focus_visuals()

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
	print("Focus: %s" % best_id)
	return true

func _neighbor_ids(id: String) -> Dictionary:
	var out := {}
	for b in _bridges:
		if b.from == id:
			out[b.to] = true
		if b.to == id:
			out[b.from] = true
	return out

func _apply_focus_visuals() -> void:
	var neighbors := _neighbor_ids(_focus_id) if not _focus_id.is_empty() else {}
	for id in _plateau_nodes:
		var node: Node3D = _plateau_nodes[id]
		var mesh := node.get_child(0) as MeshInstance3D
		if mesh == null:
			continue
		var tier := "context"
		if _focus_id.is_empty():
			tier = "full"
		elif id == _focus_id:
			tier = "lens"
		elif neighbors.has(id):
			tier = "neighbor"

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
			if tier == "lens":
				mat.emission_enabled = true
				mat.emission = FOCUS
				mat.emission_energy_multiplier = 2.0

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
	mat.albedo_color = LIT if is_lit else FOGGED
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
		root.look_at_from_position(root.position, c, Vector3.UP)
	root.add_child(mesh)
	return root
