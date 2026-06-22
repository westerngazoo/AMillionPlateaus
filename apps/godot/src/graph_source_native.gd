class_name GraphSourceNativeAdapter
extends "res://src/graph_source.gd"
## The NATIVE GraphSource (R-0025 / SPEC-0025 §2.1): wraps the mp-godot GDExtension
## class `GraphSourceNative` (a thin shell over the unchanged GA/CRDT core) and maps
## its DTO JSON onto the binding-agnostic interface the scene consumes. The DTO shape
## (`{...,position:{e1,e2,e3}}`) is FLATTENED to the interface's `{...,e1,e2,e3}` so
## the scene treats native and web sources identically. The JSON→interface mapping is
## a pure static helper (contract-tested headless without loading the extension).

var _native # the GDExtension GraphSourceNative instance, when the extension is loaded

func _init() -> void:
	# Available only when the mp-godot GDExtension cdylib is built + placed in bin/.
	if ClassDB.class_exists("GraphSourceNative"):
		_native = ClassDB.instantiate("GraphSourceNative")

func is_available() -> bool:
	return _native != null

func load_bytes(bytes: PackedByteArray) -> bool:
	return _native.load_bytes(bytes) if _native != null else false

func plateaus() -> Array:
	return parse_plateaus(_native.plateaus_json()) if _native != null else []

func bridges() -> Array:
	return parse_bridges(_native.bridges_json()) if _native != null else []

func resources() -> Array:
	return parse_resources(_native.resources_json()) if _native != null else []

# ── pure JSON → interface mapping (contract-tested) ──────────────────────────────
## DTO plateau `{id,name,description,domain_id,position:{e1,e2,e3}}` → interface
## `{id,name,description,domain_id,e1,e2,e3}` (flattened). Bad JSON → [].
static func parse_plateaus(json_str: String) -> Array:
	var arr = JSON.parse_string(json_str)
	if typeof(arr) != TYPE_ARRAY:
		return []
	var out := []
	for p in arr:
		var pos = p.get("position", {})
		out.append({
			"id": p.get("id", ""),
			"name": p.get("name", ""),
			"description": p.get("description", ""),
			"domain_id": p.get("domain_id", ""),
			"e1": float(pos.get("e1", 0.0)),
			"e2": float(pos.get("e2", 0.0)),
			"e3": float(pos.get("e3", 0.0)),
		})
	return out

static func parse_bridges(json_str: String) -> Array:
	var arr = JSON.parse_string(json_str)
	return arr if typeof(arr) == TYPE_ARRAY else []

static func parse_resources(json_str: String) -> Array:
	var arr = JSON.parse_string(json_str)
	return arr if typeof(arr) == TYPE_ARRAY else []
