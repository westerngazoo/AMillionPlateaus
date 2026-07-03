class_name GraphSourceFixture
extends "res://src/graph_source.gd"
## A fixed, in-memory GraphSource (R-0025 Slice 1) so the flat-3D scene and the
## headless tests run with NO binding yet. The shapes match the mp-wasm DTOs; when
## the mp-godot GDExtension and the mp-wasm web binding land (later slices), the
## §3.1 fixture-parity test will assert they answer these SAME shapes. A small
## three-domain cluster (Math/Empirical/Creative) with two bridges; two plateaus lit.

const PLATEAUS := [
	{"id": "calc", "name": "Calculus", "description": "Limits, derivatives, integrals.", "domain_id": "math", "e1": 0.95, "e2": 0.10, "e3": 0.05},
	{"id": "motion", "name": "Motion", "description": "Kinematics & dynamics.", "domain_id": "physics", "e1": 0.45, "e2": 0.85, "e3": 0.05},
	{"id": "harmony", "name": "Harmony", "description": "Chords & voice-leading.", "domain_id": "music", "e1": 0.10, "e2": 0.10, "e3": 0.92},
	{"id": "geometry", "name": "Geometry", "description": "Shape & space.", "domain_id": "math", "e1": 0.80, "e2": 0.20, "e3": 0.30},
]

const BRIDGES := [
	{"id": "b1", "from": "calc", "to": "motion", "concept": "equations of motion"},
	{"id": "b2", "from": "calc", "to": "geometry", "concept": "coordinates"},
]

const REACHABLE := ["calc", "geometry"]

# A5: a few cross-cutting resources pinned to plateaus (shape mirrors the mp-wasm DTO
# `{ id, title, kind, uri, state, vote_count, plateau_id }`). Read-only markers.
const RESOURCES := [
	{"id": "r1", "title": "3Blue1Brown: Essence of Calculus", "kind": "video", "uri": "https://example.com/eoc", "state": "checked", "vote_count": 42, "plateau_id": "calc"},
	{"id": "r2", "title": "Paul's Online Notes", "kind": "article", "uri": "https://example.com/pon", "state": "proposed", "vote_count": 7, "plateau_id": "calc"},
	{"id": "r3", "title": "Tonal Harmony (Kostka)", "kind": "book", "uri": "https://example.com/th", "state": "checked", "vote_count": 15, "plateau_id": "harmony"},
]

func plateaus() -> Array:
	return PLATEAUS.duplicate(true)

func bridges() -> Array:
	return BRIDGES.duplicate(true)

func resources() -> Array:
	return RESOURCES.duplicate(true)

func reachable(_rep_json: String) -> Array:
	return REACHABLE.duplicate()
