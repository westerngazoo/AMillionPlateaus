extends Camera3D
## Flat-3D free-fly inspector camera (R-0025, the no-headset path). Lets you move
## through and look around the world cluster with mouse + keyboard. This is NOT the
## immersive VR locomotion (teleport + travel-to-plateau, SPEC-0025 §2.6, Track B/C) —
## it's the desktop fallback so the flat-3D view (AC6) is actually navigable. Pure
## input → camera transform; no graph, no GA.
##
## Controls:  hold RIGHT-mouse to look (mouselook) · W A S D move · E / Q up / down ·
##            mouse wheel dolly in/out · the world.gd "zoom to extent" sets the start pose.

@export var move_speed: float = 8.0
@export var look_sensitivity: float = 0.005
@export var dolly_step: float = 1.2

var _looking := false
var _yaw := 0.0
var _pitch := 0.0

func _ready() -> void:
	_sync_angles()

# Re-read yaw/pitch from the current basis (world.gd reframes the camera on build,
# so sync at look-start to avoid a jump).
func _sync_angles() -> void:
	_pitch = rotation.x
	_yaw = rotation.y

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		match event.button_index:
			MOUSE_BUTTON_RIGHT:
				_looking = event.pressed
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if _looking else Input.MOUSE_MODE_VISIBLE
				if _looking:
					_sync_angles()
			MOUSE_BUTTON_WHEEL_UP:
				global_translate(-global_transform.basis.z * dolly_step)
			MOUSE_BUTTON_WHEEL_DOWN:
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
		var sprint := 2.0 if Input.is_key_pressed(KEY_SHIFT) else 1.0
		global_translate(dir.normalized() * move_speed * sprint * delta)
