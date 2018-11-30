// This is a WebGL example that demonstrates offscreen buffer for picking

// Global WebGL context variable
let gl;

// Off-Screen Buffers
let fb, rb, tex;

// Global program variables
let program, program_id;

// Vertex offsets and lengths for the different shapes
let tetra_verts, cube_verts, sphere_verts;

// Last time the screen was redrawn
let last_redraw;

// List of all objects in the scene
// Each object has:
//	type (0 = tetrahedron, 1 = cube, 2 = sphere)
//	color (vec3)
//	position (vec3)
//	rotation (vec3 in degrees)
//	destination (vec3)
//	target rotation (vec3 in degrees)
//	time to get to destination / target rotation (int in ms)
let objects;

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
	gl.getExtension('OES_standard_derivatives');
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	onResize();

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		uniform mat4 model_view;
		uniform mat4 projection;
		varying vec3 pos, L, V;
		void main() {
			pos = vec3(model_view*vPosition);
			gl_Position = projection*model_view*vPosition;
			L = normalize(vec3(0.0, 0.0, -2.0)-pos);
			V = normalize(vec3(0.0, 0.0, 0.0)-pos);
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		#extension GL_OES_standard_derivatives : enable
		precision mediump float;
		uniform vec3 color;
		const float ka = 0.3, kd = 0.7, ks = 0.2, shininess = 20.0;
		varying vec3 pos, L, V;
		void main() {
			vec3 n = normalize(cross(dFdy(pos), dFdx(pos)));
			vec3 l = -normalize(L);
			vec3 v = normalize(V);
			vec3 h = normalize(l + v);
			float d = max(dot(l, n), 0.0);
			float s = (d == 0.0) ? 0.0 : pow(max(dot(n, h), 0.0), shininess);
			gl_FragColor.rgb = (ka + kd*d)*color + ks*s*vec3(1.0, 1.0, 1.0);
			gl_FragColor.a = 1.0; // force opaque
		}
	`);
	// TODO: create a fragment shader that has a uniform int for the "ID" of the
	// shade and no color. This ID is used to fill in the red channel of the
	// output color. Green and blue are 0 while alpha is 1. Remember that you
	// may have to scale the ID (an integer) so it works with how OpenGL uses
	// colors.

	// Link the programs
	program = linkProgram(gl, [vertShdr, fragShdr]);
	// TODO: Link a program using the new fragment shader

	// Create the basic shapes
	const sz = 0.25;
	let verts = [], inds = [];
	// Tetrahedron
	let start = inds.length;
	tetrahedron(vec3(0, 0, -sz), vec3(0, 0.94280904158*sz, sz/3),
		vec3(-0.81649658093*sz, -0.4714045207*sz, sz/3), vec3(0.81649658093*sz, -0.4714045207*sz, sz/3),
		verts, inds);
	tetra_verts = [start, inds.length - start];
	// Cube
	start = inds.length;
	cube(
		vec3(-sz, -sz, -sz), vec3(sz, -sz, -sz), vec3(sz,  sz, -sz), vec3(-sz,  sz, -sz),
		vec3(-sz,  sz,  sz), vec3(sz,  sz,  sz), vec3(sz, -sz,  sz), vec3(-sz, -sz,  sz),
		verts, inds);
	cube_verts = [start, inds.length - start];
	// Sphere
	start = inds.length;
	sphere(sz, verts, inds, 6);
	sphere_verts = [start, inds.length - start];

	// Generate the objects
	objects = create_objects(25);

	// Load the vertex data into the GPU
	let buffer = create_buffer(gl, verts);
	set_vertex_attr_buffer(gl, enable_attribute(gl, program, 'vPosition'), buffer, 3);
	// TODO: repeat the above 1 line for the new program
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

	// Off-screen buffers (we need 2 textures for ping-ponging)
	fb = gl.createFramebuffer();
	rb = gl.createRenderbuffer();
	tex = null; // will be created as necessary

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Add mouse events
	canvas.addEventListener('click', onClick);
	canvas.addEventListener('mousemove', onMouseMove);

	// Render the scene
	render();
});

/**
 * Render the scene.
 */
function render(ms) {
	// Calculate elapsed time since last render
	let elapsed_ms = 0;
	if (ms) {
		elapsed_ms = ms - last_redraw;
		last_redraw = ms;
	} else { last_redraw = performance.now(); }

	// Move objects
	update_objects(elapsed_ms);

	// Render objects to the screen
	render_to_screen(gl);
	draw_objects(program);

	// Animate
	window.requestAnimationFrame(render);
}


/////////////// Object Functions ///////////////

/**
 * Create a single random object, returning an array of its properties.
 */
function create_object() {
	let type = rand_int(0, 2);
	let color = rand_color();
	let pos = rand_pt(), rot = rand_rot();
	let dst = rand_pt(), dst_rot = rand_rot();
	let time = rand(1000, 10000);
	return [type, color, pos, rot, dst, dst_rot, time];
}

/**
 * Create an array of n random objects.
 */
function create_objects(n) {
	let objs = [];
	for (let i = 0; i < n; i++) {
		objs.push(create_object());
	}
	return objs;
}

/**
 * Update all objects, moving them 'ms' further towards their destinations.
 */
function update_objects(ms) {
	for (let i = 0; i < objects.length; i++) {
		let [type, color, pos, rot, dst, dst_rot, time] = objects[i];
		if (ms > time) {
			// Reached the destination - generate a new destination
			pos = dst;
			rot = dst_rot;
			dst = rand_pt();
			dst_rot = rand_rot();
			time = rand(1000, 10000);
		} else {
			// Move towards the destination
			pos = add(scale(ms/time, subtract(dst, pos)), pos);
			rot = add(scale(ms/time, subtract(dst_rot, rot)), rot);
			time -= ms;
		}
		objects[i] = [type, color, pos, rot, dst, dst_rot, time];
	}
}

/**
 * Draw the objects to the current render buffer using the given program. This
 * also clears the screen and sets several uniforms.
 */
function draw_objects(prog) {
	gl.useProgram(prog);
	let model_view_loc = gl.getUniformLocation(prog, 'model_view');
	let projection_loc = gl.getUniformLocation(prog, 'projection');
	let color_loc = gl.getUniformLocation(prog, 'color');
	let id_loc = gl.getUniformLocation(prog, 'id');
	let p = perspective(45, gl.canvas.width/gl.canvas.height, 0.01, 20);
	gl.uniformMatrix4fv(projection_loc, false, flatten(p));

	// Clear the screen
	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the objects to the screen
	for (let i = 0; i < objects.length; i++) {
		let [type, color, pos, rot, , , ] = objects[i];
		let mv = mult(rotateZ(rot[2]), mult(rotateY(rot[1]), rotateX(rot[0])));
		mv = mult(translate(pos[0], pos[1], pos[2]), mv);
		gl.uniformMatrix4fv(model_view_loc, false, flatten(mv));
		gl.uniform1i(id_loc, i);
		gl.uniform3fv(color_loc, color);
		if (type === 0) {
			gl.drawElements(gl.TRIANGLE_STRIP, tetra_verts[1], gl.UNSIGNED_SHORT, tetra_verts[0]*2);
		} else if (type === 1) {
			gl.drawElements(gl.TRIANGLE_STRIP, cube_verts[1], gl.UNSIGNED_SHORT, cube_verts[0]*2);
		} else {
			gl.drawElements(gl.TRIANGLES, sphere_verts[1], gl.UNSIGNED_SHORT, sphere_verts[0]*2);
		}
	}
}

function get_object_id(x, y) {
	// Render objects to the texture using the ID program
	// The texture first must be resize to the Canvas size
	tex = create_texture(gl, gl.canvas.width, gl.canvas.height, 0, gl.NEAREST, tex);
	render_to_texture(gl, fb, rb, tex);
	draw_objects(program_id);

	// TODO: Read the pixel under the mouse click. The color should contain the ID
	// in the red channel and the alpha channel tells us if it is completely empty
	// or not. If empty, return null. Otherwise return the ID. Make sure to only
	// grab a single pixel of data from the GPU to reduce memory copying.
	return null;
}


/////////////// User Interaction ///////////////

function onMouseMove(evt) {
	let [x,y] = mouse_coords(evt);
	let id = get_object_id(x, y);
	if (id !== null) {
		let types = ['tetrahedron', 'cube', 'sphere'];
		let color = objects[id][1];
		color = "#" + hex(color[0]) + hex(color[1]) + hex(color[2]);
		document.getElementById('toolbar').innerText = id + ": " + types[objects[id][0]] + ' ' + color;
	} else {
		document.getElementById('toolbar').innerText = '';
	}
}

function onClick(evt) {
	// TODO: when clicking an object change its color. When shift-clicking
	// change its shape. When control-clicking (meta key) delete it.
	// Advanced: When option-clicking (alt key) add a new object at that location.
	let [x,y] = mouse_coords(evt);
	let id = get_object_id(x, y);
	if (id !== null) {

	}
}

/////////////// Random Utilities ///////////////
/** Random floating-point number between min (inclusive) and max (exclusive) */
function rand(min, max) {
	return Math.random()*(max-min)+min;
}
/** Random int number between min (inclusive) and max (inclusive) */
function rand_int(min, max) {
	return Math.floor(Math.random()*(max-min+1)+min);
}
/** Random rotation as a vec3 in degrees */
function rand_rot() {
	return vec3(rand(0, 360), rand(0, 360), rand(0, 360));
}
/** Random visible position as a vec3 */
function rand_pt() {
	return vec3(rand(-2.5, 2.5), rand(-2.5, 2.5), rand(-5, -15));
}
/** Random color as a vec3 with values from 0.0 to 1.0 */
function rand_color() {
	return vec3(Math.random(), Math.random(), Math.random());
}


/////////////// Other Utilities ///////////////

/**
 * Convert a floating point number from 0.0-1.0 to a two-digit hex number from
 * 00 to FF.
 */
function hex(f) {
	return ("00" + Math.floor(f*255).toString(16)).substr(-2);
}

/**
 * Get coordinates in fragment-shader space as a vec2 from the MouseEvent.
 */
function mouse_coords(evt) {
	let t = evt.currentTarget;
	let x = evt.clientX - t.clientLeft - t.getBoundingClientRect().left + t.scrollLeft;
	let y = evt.clientY - t.clientTop - t.getBoundingClientRect().top + t.scrollTop;
	return vec2(x, t.height - y);
}

/**
 * Make the canvas fit the window
 */
function onResize() {
	let w = window.innerWidth, h = window.innerHeight;
	gl.canvas.width = w;
	gl.canvas.height = h;
}
