class_name DomainPalette
extends RefCounted
## Pure, read-only domain → colour mapping for the immersive client (Track A / A3).
##
## Each plateau's base material is tinted by a STABLE hash of its `domain_id` so a
## domain reads as a consistent colour band across the world, the 2D map, and reloads.
## The client does NO GA and never mutates the DTO — `domain_id` is consumed as-is.
##
## The hash is a hand-rolled 32-bit FNV-1a (NOT Godot's String.hash(), whose value is
## an engine-version detail) so the colour is deterministic across runs, platforms,
## and Godot versions. The lit/fogged emission and focus-lens behaviour live in
## world.gd and are unaffected — this only picks the albedo hue.

const _FNV_OFFSET := 2166136261
const _FNV_PRIME := 16777619
const _MASK := 0xFFFFFFFF

## Stable colour for a domain id. Empty id → a neutral grey (still deterministic).
## Fixed saturation/value keep every band legible against the dark-navy void.
static func domain_color(domain_id: String) -> Color:
	if domain_id.is_empty():
		return Color(0.55, 0.58, 0.62)
	var h := _fnv1a(domain_id)
	var hue := float(h % 360) / 360.0
	return Color.from_hsv(hue, 0.55, 0.9)

## 32-bit FNV-1a over the id's UTF-8 bytes. Masked to 32 bits at each step so the
## result never depends on GDScript's (arbitrary-precision) int width.
static func _fnv1a(s: String) -> int:
	var hash := _FNV_OFFSET
	for b in s.to_utf8_buffer():
		hash = (hash ^ int(b)) & _MASK
		hash = (hash * _FNV_PRIME) & _MASK
	return hash
