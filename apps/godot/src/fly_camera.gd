extends Camera3D
## Flat-3D free-fly inspector camera (R-0025, the no-headset path). Lets you move
## through and look around the world cluster with mouse + keyboard. This is NOT the
## immersive VR locomotion (teleport + travel-to-plateau, SPEC-0025 §2.6, Track B/C) —
## it's the desktop fallback so the flat-3D view (AC6) is actually navigable. Pure
## input → camera transform; no graph, no GA.
##
## Controls:  hold RIGHT-mouse to look (mouselook) · W A S D move · E / Q up / down ·
##            mouse wheel dolly in/out · the world.gd "zoom to extent" sets the start pose.
##
## A2 fly-to-topic: world.gd calls `fly_to()` when the focus changes (a click or a
## `focus.json` sync). The camera then smoothly tweens to frame that plateau. ANY
## manual input (move keys, wheel dolly, or right-drag look) cancels the tween, so
## the manual fly controls always win. The framing math (`frame_position`) is a pure
## static so it is unit-tested headless with no Camera3D node.

@export var move_speed: float = 8.0
@export var look_sensitivity: float = 0.005
@export var dolly_step: float = 1.2
@export var fly_lerp: float = 3.5      # position/orientation smoothing rate (1/s)
@export var fly_distance: float = 6.0  # horizontal stand-off from the framed topic
@export var fly_height: float = 2.5    # how high above the topic to sit

var _looking := false
var _yaw := 0.0
var _pitch := 0.0
var _flying := false
var _fly_pos := Vector3.ZERO
var _fly_look := Vector3.ZERO

func _ready() -> void:
	_sync_angles()

# Re-read yaw/pitch from the current basis (world.gd reframes the camera on build,
# so sync at look-start to avoid a jump).
func _sync_angles() -> void:
	_pitch = rotation.x
	_yaw = rotation.y

## Pure: where the camera should sit to frame `target`, staying on the side it is
## already on (so the tween never whips through the topic). `from` is the current
## camera position; keeps a horizontal stand-off `distance` and rises by `height`.
## No scene state — unit-testable headless.
static func frame_position(target: Vector3, from: Vector3, distance: float, height: float) -> Vector3:
	var dir := from - target
	dir.y = 0.0
	if dir.length_squared() < 0.0001:
		dir = Vector3(0.0, 0.0, 1.0)
	dir = dir.normalized()
	return target + dir * distance + Vector3(0.0, height, 0.0)

## Begin a smooth fly toward a plateau world position. Manual input cancels it.
func fly_to(target: Vector3) -> void:
	_fly_pos = frame_position(target, global_position, fly_distance, fly_height)
	_fly_look = target
	_flying = true

func _cancel_fly() -> void:
	_flying = false

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		match event.button_index:
			MOUSE_BUTTON_RIGHT:
				_looking = event.pressed
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if _looking else Input.MOUSE_MODE_VISIBLE
				if _looking:
					_cancel_fly()
					_sync_angles()
			MOUSE_BUTTON_WHEEL_UP:
				_cancel_fly()
				global_translate(-global_transform.basis.z * dolly_step)
			MOUSE_BUTTON_WHEEL_DOWN:
				_cancel_fly()
				global_translate(global_transform.basis.z * dolly_step)
	elif event is InputEventMouseMotion and _looking:
		_yaw -= event.relative.x * look_sensitivity
		_pitch = clampf(_pitch - event.relative.y * look_sensitivity, -1.4, 1.4)
		rotation = Vector3(_pitch, _yaw, 0.0)

func _process(delta: float) -> void:
	var dir := Vector3.ZERO
	var b := global_transform.basis
	if Input.is_key_pressed(KEY_W):
		dir -= b.z
	if Input.is_key_pressed(KEY_S):
		dir += b.z
	if Input.is_key_pressed(KEY_A):
		dir -= b.x
	if Input.is_key_pressed(KEY_D):
		dir += b.x
	if Input.is_key_pressed(KEY_E):
		dir += Vector3.UP
	if Input.is_key_pressed(KEY_Q):
		dir -= Vector3.UP
	if dir != Vector3.ZERO:
		_cancel_fly()
		var sprint := 2.0 if Input.is_key_pressed(KEY_SHIFT) else 1.0
		global_translate(dir.normalized() * move_speed * sprint * delta)
	elif _flying:
		_advance_fly(delta)

# Ease position + orientation toward the framed pose; snap and stop when close.
func _advance_fly(delta: float) -> void:
	var t := clampf(fly_lerp * delta, 0.0, 1.0)
	global_position = global_position.lerp(_fly_pos, t)
	var desired := global_transform.looking_at(_fly_look, Vector3.UP)
	global_transform.basis = global_transform.basis.slerp(desired.basis, t).orthonormalized()
	if global_position.distance_to(_fly_pos) < 0.05:
		global_position = _fly_pos
		look_at(_fly_look, Vector3.UP)
		_sync_angles()
		_flying = false
