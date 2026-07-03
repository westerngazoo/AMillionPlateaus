extends SceneTree
## Headless test runner for R-0025 Slice 1 (SPEC-0025 §3 test handles). Self-contained
## (no GUT dependency this slice — a plain SceneTree script): the pure place/label
## functions and a flat-3D scene smoke, all GPU-free.
##   Run: godot --headless --path apps/godot --script res://test/run_tests.gd
## Exits non-zero on any failure (CI-friendly).

const PlaceNodeS := preload("res://src/place_node.gd")
const LabelPlanS := preload("res://src/label_plan.gd")
const FixtureS := preload("res://src/graph_source_fixture.gd")
const WorldS := preload("res://src/world.gd")
const NativeS := preload("res://src/graph_source_native.gd")
const FlyCamS := preload("res://src/fly_camera.gd")
const DomainPaletteS := preload("res://src/domain_palette.gd")
const MinimapS := preload("res://src/minimap.gd")

var _failures := 0

func _init() -> void:
	_test_place_node()
	_test_compute_fit()
	_test_spread_positions()
	_test_plan_labels()
	_test_project_to_rect()
	_test_scene_smoke()
	_test_native_adapter_parse()
	_test_native_extension_live()
	_test_frame_position()
	_test_parse_focus()
	_test_domain_color()
	_test_bridge_labels()
	_test_resource_offset()
	_test_minimap()
	if _failures == 0:
		print("✔ ALL TESTS PASSED")
	else:
		printerr("✖ %d TEST(S) FAILED" % _failures)
	quit(_failures)

func _check(cond: bool, msg: String) -> void:
	if cond:
		print("  ✔ %s" % msg)
	else:
		_failures += 1
		printerr("  ✖ FAIL: %s" % msg)

func _approx(a: float, b: float, eps := 1e-4) -> bool:
	return absf(a - b) <= eps

# ── place_node (AC1) ───────────────────────────────────────────────────────────
func _test_place_node() -> void:
	print("place_node:")
	var fit := {"scale": 2.0, "offset": Vector3(1, 1, 1)}
	var v: Vector3 = PlaceNodeS.place_node(0.5, 0.25, 0.75, fit)
	# x=e1, y=e3, z=e2 → (0.5,0.75,0.25)*2 + (1,1,1) = (2, 2.5, 1.5)
	_check(v.is_equal_approx(Vector3(2.0, 2.5, 1.5)), "axes map x=e1,y=e3,z=e2 with scale+offset")
	var idv: Vector3 = PlaceNodeS.place_node(1.0, 2.0, 3.0, {})
	_check(idv.is_equal_approx(Vector3(1.0, 3.0, 2.0)), "default fit = identity scale/zero offset")

# ── compute_fit (AC1) ──────────────────────────────────────────────────────────
func _test_compute_fit() -> void:
	print("compute_fit:")
	var fit: Dictionary = PlaceNodeS.compute_fit([
		{"e1": 0.0, "e2": 0.0, "e3": 0.0},
		{"e1": 1.0, "e2": 0.0, "e3": 0.0},
	], 12.0)
	_check(_approx(fit.scale, 12.0), "scale fits a unit extent into the span")
	_check((fit.offset as Vector3).is_equal_approx(Vector3(-6, 0, 0)), "offset centres the cluster at origin")
	# composing: the two endpoints land symmetric about the origin, span 12
	var a: Vector3 = PlaceNodeS.place_node(0.0, 0.0, 0.0, fit)
	var b: Vector3 = PlaceNodeS.place_node(1.0, 0.0, 0.0, fit)
	_check(_approx(a.x, -6.0) and _approx(b.x, 6.0), "fitted endpoints are centred & scaled")
	var empty: Dictionary = PlaceNodeS.compute_fit([], 12.0)
	_check(_approx(empty.scale, 1.0) and (empty.offset as Vector3) == Vector3.ZERO, "empty → identity fit")

func _test_spread_positions() -> void:
	print("spread_positions:")
	var raw := {"a": Vector3(0, 0, 0), "b": Vector3(0.1, 0, 0.1)}
	var out: Dictionary = PlaceNodeS.spread_positions(raw, 2.0, 16)
	_check(out["a"].distance_to(out["b"]) >= 1.99, "overlapping nodes are pushed apart")

# ── plan_labels (AC3) — port of R-0024 planLabels ────────────────────────────────
func _test_plan_labels() -> void:
	print("plan_labels:")
	var overlap := [
		{"id": "a", "rect": Rect2(0, 0, 10, 10)},
		{"id": "b", "rect": Rect2(5, 5, 10, 10)}, # overlaps a
	]
	# no priority → input order: a kept, b dropped (collides)
	_check(LabelPlanS.plan_labels(overlap) == ["a"], "overlapping: first by input order wins")
	# focused b → b kept, a dropped
	_check(LabelPlanS.plan_labels(overlap, "b") == ["b"], "focused label wins its overlap")
	# lit b → b kept over rest a
	_check(LabelPlanS.plan_labels(overlap, "", {"b": true}) == ["b"], "lit beats rest in an overlap")
	# disjoint rects → both kept, deterministic input order
	var disjoint := [
		{"id": "a", "rect": Rect2(0, 0, 10, 10)},
		{"id": "c", "rect": Rect2(100, 100, 10, 10)},
	]
	_check(LabelPlanS.plan_labels(disjoint) == ["a", "c"], "disjoint labels all kept")

# ── project_to_rect (AC3 — the camera-dependent surface) ─────────────────────────
func _test_project_to_rect() -> void:
	print("project_to_rect:")
	var view := Transform3D.IDENTITY # camera at origin looking down -Z
	var proj := Projection.create_perspective(60.0, 800.0 / 600.0, 0.1, 100.0)
	var vp := Vector2(800, 600)
	var size := Vector2(40, 14)
	var front: Rect2 = LabelPlanS.project_to_rect(Vector3(0, 0, -5), view, proj, vp, size)
	_check(LabelPlanS.is_visible(front), "a point in front projects to a visible rect")
	_check(_approx(front.position.x + size.x * 0.5, 400.0, 1.0), "centred point → screen-centre x")
	_check(_approx(front.position.y, 300.0, 1.0), "centred point → screen-centre y")
	var behind: Rect2 = LabelPlanS.project_to_rect(Vector3(0, 0, 5), view, proj, vp, size)
	_check(not LabelPlanS.is_visible(behind), "a point behind the camera is culled")
	var off: Rect2 = LabelPlanS.project_to_rect(Vector3(50, 0, -5), view, proj, vp, size)
	_check(not LabelPlanS.is_visible(off), "a point outside the frustum is culled")

# ── flat-3D scene smoke (AC1) ────────────────────────────────────────────────────
func _test_scene_smoke() -> void:
	print("scene smoke:")
	var world = WorldS.new()
	# REGRESSION GUARD: a rebuild must clear only the graph nodes, NEVER a sibling
	# Camera3D/light (freeing those blanked the view — the black-screen bug).
	var cam := Camera3D.new()
	cam.name = "Camera3D"
	world.add_child(cam)
	world.build(FixtureS.new())
	_check(is_instance_valid(cam) and not cam.is_queued_for_deletion(), "build() preserves the sibling Camera3D (no black screen)")
	# plateaus/bridges live under the "Graph" container: 4 plateaus + 2 bridges
	var graph := world.get_node_or_null("Graph")
	_check(graph != null and graph.get_child_count() == 6, "graph container holds a node per plateau + bridge")
	_check(world.positions_by_id.size() == 4, "every plateau got a world position")
	var calc := graph.get_node_or_null("Plateau_calc")
	_check(calc != null, "plateau nodes are named by id")
	# the reachable set lights nodes via emission (AC2): calc lit, motion fogged
	var calc_mesh := calc.get_child(0) as MeshInstance3D
	_check(calc_mesh.material_override.emission_enabled, "a reachable plateau is emission-lit")
	var motion := graph.get_node_or_null("Plateau_motion")
	var motion_mesh := motion.get_child(0) as MeshInstance3D
	_check(not motion_mesh.material_override.emission_enabled, "a fogged plateau is not lit")
	_check(world.get_node_or_null("WorldEnvironment") != null, "a flat-3D environment is added")
	world.free()

# ── native adapter: DTO JSON → interface shape (contract, no extension needed) ───
func _test_native_adapter_parse() -> void:
	print("native adapter (JSON→interface):")
	# the SHAPE mp-godot's plateaus_json() emits (nested position) → flattened interface
	var dto := '[{"id":"calc","name":"Calculus","description":"d","domain_id":"m","position":{"e1":0.95,"e2":0.1,"e3":0.05}}]'
	var out := NativeS.parse_plateaus(dto)
	_check(out.size() == 1, "parses one plateau")
	var p = out[0]
	_check(p.id == "calc" and p.name == "Calculus", "id/name carried")
	_check(absf(p.e1 - 0.95) < 1e-5 and absf(p.e3 - 0.05) < 1e-5, "position flattened to e1/e2/e3")
	_check(NativeS.parse_plateaus("not json") == [], "bad JSON → []")
	var br := NativeS.parse_bridges('[{"id":"b","from":"calc","to":"geo","concept":"coords"}]')
	_check(br.size() == 1 and br[0].concept == "coords", "bridges parsed")

# ── live GDExtension (skipped if the cdylib isn't built/placed) ───────────────────
func _test_native_extension_live() -> void:
	print("native GDExtension (live):")
	if not ClassDB.class_exists("GraphSourceNative"):
		print("  • SKIP: mp-godot GDExtension not loaded (build with --features gdext + copy to bin/)")
		return
	var adapter = NativeS.new()
	_check(adapter.is_available(), "GraphSourceNative instantiates")
	# a fresh native source = empty world → empty interface arrays
	_check(adapter.plateaus() == [] and adapter.bridges() == [], "empty native world → empty arrays")
	# seed a real world through the core → the interface sees native-sourced plateaus
	adapter.seed_demo()
	var plats := adapter.plateaus()
	_check(plats.size() == 7 and adapter.bridges().size() == 6, "seed_demo → 7 plateaus, 6 bridges via the native core")
	_check(plats[0].has("e1") and plats[0].has("name"), "native plateaus arrive in the flattened interface shape")

# ── A2 frame_position (fly-to framing math) ──────────────────────────────────────
func _test_frame_position() -> void:
	print("frame_position (A2):")
	# camera at +Z, target at origin → stand off along +Z, lifted by height
	var pos: Vector3 = FlyCamS.frame_position(Vector3(0, 0, 0), Vector3(0, 0, 10), 6.0, 2.5)
	_check(pos.is_equal_approx(Vector3(0, 2.5, 6.0)), "frames the topic on the camera's side, lifted")
	# degenerate (from == target) falls back to +Z so looking_at never breaks
	var deg: Vector3 = FlyCamS.frame_position(Vector3(1, 1, 1), Vector3(1, 1, 1), 4.0, 1.0)
	_check(deg.is_equal_approx(Vector3(1, 2, 5)), "coincident from/target → default +Z stand-off")

# ── A2 parse_focus (focus.json contract) ─────────────────────────────────────────
func _test_parse_focus() -> void:
	print("parse_focus (A2):")
	var on: Dictionary = WorldS.parse_focus('{"lens_mode": true, "lens_id": "calc"}')
	_check(on.lens_mode == true and on.focus_id == "calc", "lens on + id → that focus")
	var off: Dictionary = WorldS.parse_focus('{"lens_mode": false, "lens_id": "calc"}')
	_check(off.focus_id == "", "lens off → no focus")
	var noid: Dictionary = WorldS.parse_focus('{"lens_mode": true}')
	_check(noid.focus_id == "", "missing lens_id → no focus")
	var bad: Dictionary = WorldS.parse_focus("not json")
	_check(bad.lens_mode == true and bad.focus_id == "", "bad JSON → lens on, no focus")

# ── A3 domain_color (deterministic tint) ─────────────────────────────────────────
func _test_domain_color() -> void:
	print("domain_color (A3):")
	_check(DomainPaletteS.domain_color("math") == DomainPaletteS.domain_color("math"), "same domain → same colour (deterministic)")
	_check(DomainPaletteS.domain_color("music") != DomainPaletteS.domain_color("math"), "different domains → different colour")
	var e: Color = DomainPaletteS.domain_color("")
	_check(e.a >= 0.99, "empty domain → a valid opaque colour")

# ── A4 bridge label visibility (focus scope) ─────────────────────────────────────
func _test_bridge_labels() -> void:
	print("bridge labels (A4):")
	var scope: Dictionary = LabelPlanS.focus_scope("calc", {"motion": true})
	_check(scope.has("calc") and scope.has("motion"), "scope = focus + neighbors")
	_check(LabelPlanS.bridge_label_visible("calc", "geo", scope), "bridge touching the focus is shown")
	_check(not LabelPlanS.bridge_label_visible("x", "y", scope), "bridge outside the scope is hidden")
	_check(LabelPlanS.focus_scope("").is_empty(), "no focus → empty scope (all bridge labels hidden)")

# ── A5 resource_offset (marker ring) ─────────────────────────────────────────────
func _test_resource_offset() -> void:
	print("resource_offset (A5):")
	var o0: Vector3 = PlaceNodeS.resource_offset(0, 1)
	_check(o0.is_equal_approx(Vector3(1.1, 1.0, 0.0)), "single marker sits on +X ring, lifted")
	var a: Vector3 = PlaceNodeS.resource_offset(0, 2)
	var b: Vector3 = PlaceNodeS.resource_offset(1, 2)
	_check(not a.is_equal_approx(b), "distinct markers spread apart")
	_check(_approx(Vector2(a.x, a.z).length(), 1.1) and _approx(Vector2(b.x, b.z).length(), 1.1), "markers lie on the ring radius")

# ── A6 minimap projection (e1×e3 inset) ──────────────────────────────────────────
func _test_minimap() -> void:
	print("minimap (A6):")
	var bnd: Dictionary = MinimapS.compute_bounds([Vector2(0, 0), Vector2(10, 10)])
	_check((bnd.lo as Vector2).is_equal_approx(Vector2(0, 0)) and (bnd.hi as Vector2).is_equal_approx(Vector2(10, 10)), "compute_bounds spans the points")
	_check((MinimapS.compute_bounds([]).lo as Vector2) == Vector2(-1, -1), "empty → unit box (no /0)")
	var size := Vector2(100, 100)
	var lo := Vector2(0, 0)
	var hi := Vector2(10, 10)
	_check(MinimapS.project(lo, lo, hi, size, 10.0).is_equal_approx(Vector2(10, 90)), "lo → bottom-left (e3 up is flipped)")
	_check(MinimapS.project(hi, lo, hi, size, 10.0).is_equal_approx(Vector2(90, 10)), "hi → top-right")
	_check(MinimapS.project(Vector2(5, 5), lo, hi, size, 10.0).is_equal_approx(Vector2(50, 50)), "centre → centre")
	_check(MinimapS.project(Vector2(3, 3), Vector2(3, 3), Vector2(3, 3), size, 10.0).is_equal_approx(Vector2(50, 50)), "degenerate span → centre")
