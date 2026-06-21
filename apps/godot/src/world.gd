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
func build(src, rep_json: String = "") -> void:
	source = src
	for c in get_children():
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
		add_child(_make_plateau(p, world_pos, lit.has(p.id)))

	for b in src.bridges():
		if positions_by_id.has(b.from) and positions_by_id.has(b.to):
			add_child(_make_bridge(b, positions_by_id[b.from], positions_by_id[b.to]))

func _make_plateau(p: Dictionary, world_pos: Vector3, is_lit: bool) -> Node3D:
	var root := Node3D.new()
	root.name = "Plateau_%s" % p.id
	root.position = world_pos
	root.set_meta("plateau_id", p.id)

	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.4
	sphere.height = 0.8
	mesh.mesh = sphere
	var mat := StandardMaterial3D.new()
	# Lit/fogged is an emission toggle driven by the core's reachable set (AC2).
	mat.albedo_color = LIT if is_lit else FOGGED
	mat.emission_enabled = is_lit
	mat.emission = LIT
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
