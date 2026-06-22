class_name MPWorld
extends Node3D
## Builds the flat-3D scene from a GraphSource (R-0025 / SPEC-0025 §2.3, AC1/AC2/AC3).
## A pure VIEW: it asks the source for plateaus/bridges/reachable (DTOs), fits the
## cluster with PlaceNode.compute_fit, places each plateau via PlaceNode.place_node,
## draws a line per bridge, and lights the reachable set via an emission toggle. No
## GA, no reputation recompute — the `reachable` set comes straight from the core.
## (The OpenXR rig, label declutter wiring, and worldspace study are later slices.)

const LIT := Color(1.0, 0.82, 0.4)
const FOGGED := Color(0.18, 0.24, 0.31)
# Cross-script refs by PATH (not class_name) so the scene + tests load in pure
# `--headless --script` mode, which lacks the editor's global class-name cache.
const PlaceNodeS := preload("res://src/place_node.gd")
const FixtureS := preload("res://src/graph_source_fixture.gd")

var source # a GraphSource (untyped to avoid class-cache reliance at load)
var positions_by_id: Dictionary = {} # plateau id -> Vector3 (world)

## Run as the main scene → build the flat-3D demo from the fixture (Slice 1: the
## native/web bindings are later slices). Tests call build() directly and skip this.
func _ready() -> void:
	if source == null:
		build(FixtureS.new())

## Build (or rebuild) the scene from `src`. `rep_json` is handed to the source's
## reachable() — the same reputation JSON the 2D app uses; opaque here.
## Plateaus/bridges go under a dedicated "Graph" child so a rebuild clears ONLY them
## — never the sibling Camera3D / lights / XR rig (freeing those blanked the view).
func build(src, rep_json: String = "") -> void:
	source = src
	var graph := get_node_or_null("Graph")
	if graph == null:
		graph = Node3D.new()
		graph.name = "Graph"
		add_child(graph)
	for c in graph.get_children():
		c.queue_free()
	positions_by_id.clear()

	var plats: Array = src.plateaus()
	var fit: Dictionary = PlaceNodeS.compute_fit(plats)
	var lit := {}
	for id in src.reachable(rep_json):
		lit[id] = true

	for p in plats:
		var world_pos: Vector3 = PlaceNodeS.place_node(p.e1, p.e2, p.e3, fit)
		positions_by_id[p.id] = world_pos
		graph.add_child(_make_plateau(p, world_pos, lit.has(p.id)))

	for b in src.bridges():
		if positions_by_id.has(b.from) and positions_by_id.has(b.to):
			graph.add_child(_make_bridge(b, positions_by_id[b.from], positions_by_id[b.to]))

	_ensure_environment()
	_frame_camera()

## A dark-navy background + ambient fill so fogged plateaus read against the void
## (matching the 2D map's palette). Added once; flat-3D only (XR uses passthrough/none).
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

## Frame the (origin-centred, ~span-wide) cluster: pull the Camera3D back along +Z,
## a little above, looking at the origin — the 3D "zoom to extent" (R-0024 analogue).
func _frame_camera() -> void:
	var cam := get_node_or_null("Camera3D") as Camera3D
	if cam == null:
		return
	cam.position = Vector3(0.0, 5.0, 16.0)
	cam.look_at(Vector3.ZERO, Vector3.UP)

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
	# Lit/fogged is an emission toggle driven by the core's reachable set (AC2).
	mat.albedo_color = LIT if is_lit else FOGGED
	mat.emission_enabled = is_lit
	mat.emission = LIT
	mat.emission_energy_multiplier = 1.6
	mesh.material_override = mat
	root.add_child(mesh)

	var label := Label3D.new()
	label.text = p.name
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position = Vector3(0, -0.7, 0)
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
	# place the box at the midpoint, oriented from a → c
	root.position = (a + c) * 0.5
	if span > 0.0001:
		root.look_at_from_position(root.position, c, Vector3.UP)
	root.add_child(mesh)
	return root
