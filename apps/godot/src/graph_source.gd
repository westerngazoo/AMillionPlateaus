class_name GraphSource
extends RefCounted
## The binding-agnostic interface the scene talks to (R-0025 / SPEC-0025 §2.1, §3).
## The scene NEVER calls a binding directly — native resolves this to the mp-godot
## GDExtension (calling the crates), web resolves it to mp-wasm via JavaScriptBridge.
## Slice 1 ships the interface + a fixture implementation; the two real bindings are
## later slices. All shapes mirror the DTOs mp-wasm already exposes (no new core API);
## positions arrive as {e1,e2,e3} floats and the client does NO GA.

## [{ id, name, description, domain_id, e1, e2, e3 }]
func plateaus() -> Array:
	return []

## [{ id, from, to, concept }]
func bridges() -> Array:
	return []

## [{ id, title, kind, uri, state, vote_count, plateau_id }]
func resources() -> Array:
	return []

## The lit (reachable/fog) plateau ids for a reputation JSON — computed by the core's
## reachable set, NEVER recomputed in the client. `rep_json` is opaque to the scene.
func reachable(_rep_json: String) -> Array:
	return []
