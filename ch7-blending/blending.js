// This is a WebGL example that demonstrates blending and composition
/* exported cube tetrahedron unit_sphere load_texture load_cubemap_texture */

// Global WebGL context variable
let gl;

// Uniform locations
let color_loc, both_sides_loc;

// Properties for each of the sides
let sides = [
	{'idx': 0, 'color':vec4(1.0, 0.0, 0.0, 0.5), 'depthMask':false},
	{'idx': 6, 'color':vec4(1.0, 1.0, 0.0, 0.5), 'depthMask':false},
	{'idx':12, 'color':vec4(1.0, 0.0, 1.0, 0.5), 'depthMask':false},
	{'idx':18, 'color':vec4(0.0, 1.0, 0.0, 0.5), 'depthMask':false},
	{'idx':24, 'color':vec4(0.0, 1.0, 1.0, 0.5), 'depthMask':false},
	{'idx':30, 'color':vec4(0.0, 0.0, 1.0, 0.5), 'depthMask':false},
];

// HTML elements
let src_blend, dst_blend;
let clear_color, clear_alpha;

window.addEventListener('load', function init() {
	// Get the HTML5 canvas object from it's ID
	const canvas = document.getElementById('gl-canvas');

	// Get the WebGL context (save into a global variable)
	gl = WebGLUtils.create3DContext(canvas, {premultipliedAlpha:false});
	if (!gl) {
		window.alert("WebGL isn't available");
		return;
	}

	// Configure WebGL
	onResize();
	gl.getExtension('OES_standard_derivatives');
	gl.clearColor(0.0, 0.0, 0.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden
	gl.enable(gl.BLEND); // perform blending of fragments

	// Create the shape
	let verts = [];
	cube(vec3(-0.5, -0.5, -0.5),
		vec3( 0.5, -0.5, -0.5),
		vec3( 0.5,  0.5, -0.5),
		vec3(-0.5,  0.5, -0.5),
		vec3(-0.5,  0.5,  0.5),
		vec3( 0.5,  0.5,  0.5),
		vec3( 0.5, -0.5,  0.5),
		vec3(-0.5, -0.5,  0.5),
		verts);

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		uniform mat4 model_view;
		uniform mat4 projection;
		const vec3 light_src = vec3(10.0, 10.0, 10.0);
		varying vec3 L, V, pos;
		void main() {
			pos = vec3(model_view*vPosition);
			gl_Position = projection*model_view*vPosition;
			L = normalize(light_src - pos);
			V = normalize(vec3(0.0) - pos); // assumes viewer is at <0,0,0> in model coordinates
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		#extension GL_OES_standard_derivatives : enable
		precision mediump float;
		const float ka = 0.2, kd = 0.9;
		varying vec3 L, V, pos;
		uniform bool both_sides;
		uniform vec4 color;
		void main() {
			vec3 N = normalize(cross(dFdx(pos), dFdy(pos))); // normal vector (flat shading)
			float d = max(dot(N, L), 0.0);
			if (both_sides) {
				d += max(dot(-N, L), 0.0);
			}
			gl_FragColor = ka*color + kd*d*color;
			gl_FragColor.a = color.a;
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Load the vertex data into the GPU and associate with shader
	create_vertex_attr_buffer(gl, program, 'vPosition', verts);
	//create_vertex_attr_buffer(gl, program, 'vNormal', normals);
	//create_vertex_attr_buffer(gl, program, 'vTexCoord', tex_coords);

	// Get uniforms
	color_loc = gl.getUniformLocation(program, 'color');
	both_sides_loc = gl.getUniformLocation(program, 'both_sides');

	// Setup handlers for user controls
	let culling = document.getElementById('culling');
	culling.addEventListener('change', change_culling);
	src_blend = document.getElementById('src-blend');
	dst_blend = document.getElementById('dst-blend');
	src_blend.addEventListener('change', change_blend_func);
	dst_blend.addEventListener('change', change_blend_func);
	change_blend_func();
	document.getElementById('blend-eq').addEventListener('change', function () {
		gl.blendEquation(gl[this.value]);
	});
	document.getElementById('viewing-mode').addEventListener('click', function () {
		show_perspective = this.checked; // eslint-disable-line no-use-before-define
		update_projection();
	});
	clear_color = document.getElementById('clear-color');
	clear_alpha = document.getElementById('clear-alpha');
	clear_color.addEventListener('change', change_clear_color);
	clear_alpha.addEventListener('change', change_clear_color);
	for (let i = 0; i < 6; i++) { hook_side(i); }
	document.getElementById('both-sides').addEventListener('click', function () {
		gl.uniform1i(both_sides_loc, this.checked);
	});

	// Setup the standard movement system
	add_standard_handlers(program);

	// Render the scene
	render();
});

function change_culling() {
	if (this.value === 'NONE') {
		gl.disable(gl.CULL_FACE);
	} else {
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl[this.value]);
	}
}
function change_blend_func() {
	gl.blendFunc(gl[src_blend.value], gl[dst_blend.value]);
}
function change_clear_color() {
	let color = get_rgb(clear_color.value);
	let alpha = parseFloat(clear_alpha.value);
	gl.clearColor(color[0], color[1], color[2], alpha);
}
function hook_side(i) {
	let html_color = document.getElementById('side'+(i+1)+'-color');
	let html_alpha = document.getElementById('side'+(i+1)+'-alpha');
	function onchange() {
		let color = get_rgb(html_color.value);
		let alpha = parseFloat(html_alpha.value);
		sides[i].color = vec4(color[0], color[1], color[2], alpha);
	}
	html_color.addEventListener('change', onchange);
	html_alpha.addEventListener('change', onchange);

	let html_depth_mask = document.getElementById('side'+(i+1)+'-depth-mask');
	html_depth_mask.addEventListener('click', function () {
		sides[i].depthMask = html_depth_mask.checked;
	});
}

/**
 * Add the rectangle abcd to verts as two triangles. To be drawn with TRIANGLES.
 */
function rect(a, b, c, d, pts) {
	pts.push(a, b, c, a, c, d);
}

/**
 * Adds a cube to verts defined by the vertices a, b, c, d, e, f, g, h with
 * abcd and efgh as opposite faces of the cube. To be drawn with TRIANGLES.
 */
function cube(a, b, c, d, e, f, g, h, pts) {
	rect(e, f, g, h, pts);
	rect(a, b, c, d, pts);
	rect(d, c, f, e, pts);
	rect(a, d, e, h, pts);
	rect(c, b, g, f, pts);
	rect(b, a, h, g, pts);
}

/**
 * Render the scene.
 */
function render() {
	// Clear
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw each side
	for (let i = 0; i < 6; i++) {
		let side = sides[i];
		gl.depthMask(side.depthMask);
		gl.uniform4fv(color_loc, side.color);
		gl.drawArrays(gl.TRIANGLES, side.idx, 6);
	}

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * Get an RGB vec4 from an HTML color value.
 */
function get_rgb(color) {
	let r = parseInt(color.substring(1, 3), 16);
	let g = parseInt(color.substring(3, 5), 16);
	let b = parseInt(color.substring(5, 7), 16);
	return vec4(r/255, g/255, b/255, 1);
}


//////////////////////// Standard Movement Handlers ////////////////////////
// Uniform locations
let model_view_loc, projection_loc;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 1.0;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;

// Whether to render with perspective or not
let show_perspective = false;

/**
 * Sets up our standard movement handlers for the given program.
 */
function add_standard_handlers(program) {
	// Get the uniforms
	model_view_loc = gl.getUniformLocation(program, 'model_view');
	projection_loc = gl.getUniformLocation(program, 'projection');

	// Give the uniforms their initial values
	update_model_view();
	update_projection();

	// Add just the mouse-down handler initially
	gl.canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	gl.canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);
}

/**
 * Updates the model-view transformation based on the global variables.
 */
function update_model_view() {
	let mv = mult(rotateZ(thetas[2]), mult(rotateY(thetas[1]), rotateX(thetas[0])));
	mv = mult(translate(position[0], position[1], position[2]), mv);
	mv = mult(scalem(cur_scale, cur_scale, cur_scale), mv);
	gl.uniformMatrix4fv(model_view_loc, false, flatten(mv));
}

/**
 * Updates the projection transformation based on the global variables.
 */
function update_projection() {
	let p, w = gl.canvas.width, h = gl.canvas.height;
	if (show_perspective) {
		p = perspective(45, w/h, 0.01, 10);
		// Need to move the camera away from the origin and flip the z-axis
		p = mult(p, mult(translate(0, 0, -3), scalem(1, 1, -1)));
	} else {
		p = (w > h) ? ortho(-w/h, w/h, -1, 1, 10, -10) : ortho(-1, 1, -h/w, h/w, 10, -10);
	}
	gl.uniformMatrix4fv(projection_loc, false, flatten(p));
}

/**
 * Get the mouse coordinates in object-space as a vec2 from the MouseEvent.
 */
function mouse_coords(evt) {
	let t = evt.currentTarget;
	let x = evt.clientX - t.clientLeft - t.getBoundingClientRect().left + t.scrollLeft;
	let y = evt.clientY - t.clientTop - t.getBoundingClientRect().top + t.scrollTop;
	x = 2*(x/t.width) - 1;
	y = 1 - 2*(y/t.height);
	return vec2(x, y);
}

/**
 * When the mouse is pressed down we record the initial coordinates and start listening for the
 * mouse move and up events.
 */
function onMouseDown(evt) {
	drag_mode = evt.shiftKey ? 'move' : 'rotate';
	initial_coord = mouse_coords(evt);
	initial_thetas = thetas.slice(0);
	initial_pos = position.slice(0);
	this.addEventListener('mousemove', onMouseMove);
	this.addEventListener('mouseup', onMouseUp);
	update_model_view();
}

/**
 * When the mouse is moved (while down) then the rotation is updated and the scene rendered.
 */
function onMouseMove(evt) {
	if (evt.buttons === 0) {
		// mouse button went away when we weren't paying attention
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);
	} else {
		let coord = mouse_coords(evt);
		if (drag_mode === 'rotate') {
			thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
			thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
		} else {
			position[0] = initial_pos[0] + (coord[0] - initial_coord[0]);
			position[1] = initial_pos[1] + (coord[1] - initial_coord[1]);
		}
		update_model_view();
	}
}

/**
 * When the mouse is lifted we update the rotation is updated one final time and we stop listening
 * to the mouse move and up events.
 */
function onMouseUp(evt) {
	let coord = mouse_coords(evt);
	if (drag_mode === 'rotate') {
		thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
		thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
	} else {
		position[0] = initial_pos[0] + (coord[0] - initial_coord[0]);
		position[1] = initial_pos[1] + (coord[1] - initial_coord[1]);
	}
	update_model_view();
	this.removeEventListener('mousemove', onMouseMove);
	this.removeEventListener('mouseup', onMouseUp);
}

/**
 * Make the object smaller/larger on scroll wheel.
 */
function onWheel(evt) {
	// Various equations could be used here, but this is what I chose
	cur_scale *= (1000-evt.deltaY) / 1000;
	update_model_view();
}

/**
 * Make the canvas fit the window
 */
function onResize() {
	let w = window.innerWidth, h = window.innerHeight;
	gl.canvas.width = w;
	gl.canvas.height = h;
	gl.viewport(0, 0, w, h);
	update_projection();
}
