// This is a WebGL example that draws a cube that has ambient, diffuse, and specular lighting only
// with options for smooth vs flat shading, light attenuation, and separate color lighting
// components.
/* exported cube tetrahedron */

// Global WebGL context variable
let gl;

// Global list of vertices being drawn
let total_verts;

// Uniform locations
let model_view_loc, projection_loc, flat_shading_loc, phong_model_loc;
let color_a_loc, color_d_loc, color_s_loc, shininess_loc;
let light_src_loc, light_in_model_loc, light_atten_loc;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 1;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;

// HTML Elements
let viewing_mode;
let mat_color_a, mat_color_d, mat_color_s, ka, kd, ks;
let light_color_a, light_color_d, light_color_s, brightness_a, brightness_d, brightness_s;
let ls_x, ls_y, ls_z, ls_w;
let atten_a, atten_b, atten_c;

window.addEventListener('load', function init() {
	// Get the HTML5 canvas object from it's ID
	const canvas = document.getElementById('gl-canvas');

	// Get the WebGL context (save into a global variable)
	gl = WebGLUtils.create3DContext(canvas, {premultipliedAlpha:false});
	if (!gl) {
		window.alert("WebGL isn't available");
		return;
	}

	// Add a listener to the checkboxes
	viewing_mode = document.getElementById('viewing-mode');
	let flat_shading = document.getElementById('flat-shading');
	let light_in_model = document.getElementById('light-in-model');
	let light_model = document.getElementById('light-model');
	viewing_mode.addEventListener('click', onChangeMode);
	flat_shading.addEventListener('click', onChangeShading);
	light_in_model.addEventListener('click', onChangeLightInModel);
	light_model.addEventListener('click', onChangeLightModel);

	// Add listeners for the colors
	mat_color_a = document.getElementById('mat-color-a');
	mat_color_d = document.getElementById('mat-color-d');
	mat_color_s = document.getElementById('mat-color-s');
	ka = document.getElementById('ka');
	kd = document.getElementById('kd');
	ks = document.getElementById('ks');
	light_color_a = document.getElementById('light-color-a');
	light_color_d = document.getElementById('light-color-d');
	light_color_s = document.getElementById('light-color-s');
	brightness_a = document.getElementById('bright-a');
	brightness_d = document.getElementById('bright-d');
	brightness_s = document.getElementById('bright-s');
	mat_color_a.addEventListener('change', onChangeAmbient);
	mat_color_d.addEventListener('change', onChangeDiffuse);
	mat_color_s.addEventListener('change', onChangeSpecular);
	ka.addEventListener('change', onChangeAmbient);
	kd.addEventListener('change', onChangeDiffuse);
	ks.addEventListener('change', onChangeSpecular);
	light_color_a.addEventListener('change', onChangeAmbient);
	light_color_d.addEventListener('change', onChangeDiffuse);
	light_color_s.addEventListener('change', onChangeSpecular);
	brightness_a.addEventListener('change', onChangeAmbient);
	brightness_d.addEventListener('change', onChangeDiffuse);
	brightness_s.addEventListener('change', onChangeSpecular);

	// Add listeners for the extra material properties
	let shininess = document.getElementById('shininess');
	shininess.addEventListener('change', onChangeShininess);

	// Add listeners for the extra light properties
	ls_x = document.getElementById('x');
	ls_y = document.getElementById('y');
	ls_z = document.getElementById('z');
	ls_w = document.getElementById('pt_src');
	ls_x.addEventListener('change', onChangeLightSource);
	ls_y.addEventListener('change', onChangeLightSource);
	ls_z.addEventListener('change', onChangeLightSource);
	ls_w.addEventListener('click', onChangeLightSource);
	atten_a = document.getElementById('atten_a');
	atten_b = document.getElementById('atten_b');
	atten_c = document.getElementById('atten_c');
	atten_a.addEventListener('change', onChangeLightAttenuation);
	atten_b.addEventListener('change', onChangeLightAttenuation);
	atten_c.addEventListener('change', onChangeLightAttenuation);


	// Configure WebGL
	onResize();
	gl.getExtension('OES_standard_derivatives');
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden
	gl.enable(gl.CULL_FACE); // faces turned away from the view will be hidden
	gl.cullFace(gl.BACK);

	// Create a cube
	let verts = [], inds = [];
	cube(
		vec4(-0.5, -0.5, -0.5, 1),
		vec4( 0.5, -0.5, -0.5, 1),
		vec4( 0.5,  0.5, -0.5, 1),
		vec4(-0.5,  0.5, -0.5, 1),
		vec4(-0.5,  0.5,  0.5, 1),
		vec4( 0.5,  0.5,  0.5, 1),
		vec4( 0.5, -0.5,  0.5, 1),
		vec4(-0.5, -0.5,  0.5, 1),
		verts, inds);
	let normals = calc_normals(verts, inds);
	total_verts = inds.length;

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec4 vNormal;
		uniform mat4 model_view;
		uniform mat4 projection;
		uniform vec4 light_src;
		uniform bool light_in_model;
		varying vec4 pos, N, L, V;
		varying float light_dist;
		void main() {
			pos = model_view*vPosition;
			gl_Position = projection*pos;

			N = normalize(model_view*vNormal);

			L = light_in_model ? model_view*light_src : light_src;
			light_dist = 0.0;
			if (light_src.w == 1.0) {
				// light source is given as a location
				L -= pos;
				light_dist = length(L);
			}
			L = normalize(L);

			// NOTE: this assumes viewer is at <0,0,0> in model coordinates
			V = normalize(vec4(0.0, 0.0, 0.0, 1.0)-pos);
			V.z = -V.z;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		#extension GL_OES_standard_derivatives : enable
		precision highp float;
		uniform bool flat_shading, phong_model;
		uniform vec4 color_a, color_d, color_s;
		uniform vec3 light_atten;
		varying float light_dist;
		uniform float shininess;
		varying vec4 N, L, V, pos;
		void main() {
			vec4 n = normalize(flat_shading ?
				vec4(cross(vec3(dFdy(pos)), vec3(dFdx(pos))), 0) :
				N);
			vec4 l = normalize(L);
			vec4 v = normalize(V);

			float d = max(dot(l, n), 0.0), s = 0.0;
			if (d != 0.0) {
				if (phong_model) {
					// Phong Model
					vec4 R = 2.0*dot(l, n)*n-l;
					s = pow(max(dot(R, V), 0.0), shininess);
				} else {
					// Blinn Model
					vec4 H = normalize(l + v);
					s = pow(max(dot(n, H), 0.0), shininess);
				}
			}
			float atten = 1.0/(light_atten[0] + light_atten[1]*light_dist + light_atten[2]*light_dist*light_dist);
			gl_FragColor = color_a + atten*(d*color_d + s*color_s);
			gl_FragColor.a = 1.0; // force opaque
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Load the vertex data into the GPU and associate with shader
	let bufferId = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
	gl.bufferData(gl.ARRAY_BUFFER, flatten(verts), gl.STATIC_DRAW); // load the flattened data into the buffer
	let vPosition = gl.getAttribLocation(program, 'vPosition'); // get the vertex shader attribute "vPosition"
	gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Load the normal data into the GPU and associate with shader
	bufferId = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
	gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW); // load the flattened data into the buffer
	let vNormal = gl.getAttribLocation(program, 'vNormal'); // get the vertex shader attribute "vNormal"
	gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vNormal" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vNormal); // enable this set of data

	// Upload the indices
	bufferId = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

	// Get the uniform locations
	model_view_loc = gl.getUniformLocation(program, 'model_view');
	projection_loc = gl.getUniformLocation(program, 'projection');
	flat_shading_loc = gl.getUniformLocation(program, 'flat_shading');
	light_in_model_loc = gl.getUniformLocation(program, 'light_in_model');
	phong_model_loc = gl.getUniformLocation(program, 'phong_model');
	color_a_loc = gl.getUniformLocation(program, 'color_a');
	color_d_loc = gl.getUniformLocation(program, 'color_d');
	color_s_loc = gl.getUniformLocation(program, 'color_s');
	light_src_loc = gl.getUniformLocation(program, 'light_src');
	light_atten_loc = gl.getUniformLocation(program, 'light_atten');
	shininess_loc = gl.getUniformLocation(program, 'shininess');

	// Give the uniforms their initial values
	update_model_view();
	update_projection();
	gl.uniform1i(flat_shading_loc, flat_shading.checked);
	gl.uniform1i(light_in_model_loc, light_in_model.checked);
	gl.uniform1i(phong_model_loc, light_model.value === 'phong');
	onChangeAmbient();
	onChangeDiffuse();
	onChangeSpecular();
	onChangeLightSource();
	onChangeLightAttenuation();
	gl.uniform1f(shininess_loc, +shininess.value);

	// Add just the mouse-down handler initially
	canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Render the static scene
	render();
});

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
	if (viewing_mode.checked) {
		p = perspective(45, w/h, 0.01, 10);
		// Need to move the camera away from the origin and flip the z-axis
		p = mult(p, mult(translate(0, 0, -3), scalem(1, 1, -1)));
	} else {
		p = (w > h) ? ortho(-w/h, w/h, -1, 1, 10, -10) : ortho(-1, 1, -h/w, h/w, 10, -10);
	}
	gl.uniformMatrix4fv(projection_loc, false, flatten(p));
}

/**
 * Render the scene.
 */
function render() {
	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawElements(gl.TRIANGLE_STRIP, total_verts, gl.UNSIGNED_SHORT, 0);

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * Calculates the normals for the vertices given an array of vertices and array of indices to look
 * up into. By default this assumes the indices represents a triangle strip. To work with triangles
 * pass a third argument of false.
 */
function calc_normals(verts, inds, strip) {
	if (strip !== true && strip !== false) { strip = true; }
	let normals = new Array(verts.length);

	// Start with all vertex normals as <0,0,0,0>
	for (let i = 0; i < verts.length; i++) { normals[i] = vec4(0, 0, 0, 0); }

	// Calculate the face normals for each triangle then add them to the vertices
	let inc = strip ? 1 : 3;
	for (let i = 0; i < inds.length - 2; i+=inc) {
		let j = inds[i], k = inds[i+1], l = inds[i+2];
		let a = verts[j], b = verts[k], c = verts[l];
		let face_norm = cross((strip && (i%2) !== 0) ? subtract(a, b) : subtract(b, a), subtract(a, c));
		normals[j] = add(normals[j], face_norm);
		normals[k] = add(normals[k], face_norm);
		normals[l] = add(normals[l], face_norm);
	}

	// Normalize the normals
	for (let i = 0; i < verts.length; i++) { normals[i] = normalize(normals[i]); }
	return normals;
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

/**
 * When the mode (perspective vs orthographic) is changed update the projection
 * matrix on the GPU to give that form of projection.
 */
function onChangeMode() { update_projection(); }

/**
 * When the shading is changed inform the GPU.
 */
function onChangeShading() {
	gl.uniform1i(flat_shading_loc, this.checked);
}

/**
 * When the state of the light is changed inform the GPU.
 */
function onChangeLightInModel() { gl.uniform1i(light_in_model_loc, this.checked); }

/**
 * When the type of light model is changed inform the GPU.
 */
function onChangeLightModel() { gl.uniform1i(phong_model_loc, this.value === 'phong'); }

/**
 * Get an RGB vec4 from an HTML color value.
 */
function get_rgb(color) {
	let r = parseInt(color.substring(1, 3), 16);
	let g = parseInt(color.substring(3, 5), 16);
	let b = parseInt(color.substring(5, 7), 16);
	return vec4(r/255, g/255, b/255, 1);
}

/**
 * When any of the ambient settings is changed update the GPU
 */
function onChangeAmbient() {
	let color = mult(
		scale(+ka.value, get_rgb(mat_color_a.value)),
		scale(+brightness_a.value, get_rgb(light_color_a.value)));
	gl.uniform4fv(color_a_loc, color);
}

/**
 * When any of the diffuse settings is changed update the GPU
 */
function onChangeDiffuse() {
	let color = mult(
		scale(+kd.value, get_rgb(mat_color_d.value)),
		scale(+brightness_d.value, get_rgb(light_color_d.value)));
	gl.uniform4fv(color_d_loc, color);
}

/**
 * When any of the specular settings is changed update the GPU
 */
function onChangeSpecular() {
	let color = mult(
		scale(+ks.value, get_rgb(mat_color_s.value)),
		scale(+brightness_s.value, get_rgb(light_color_s.value)));
	gl.uniform4fv(color_s_loc, color);
}

/**
 * When the shininess is changed update the value on the GPU
 */
function onChangeShininess() { gl.uniform1f(shininess_loc, +this.value); }

/**
 * When any of the light source attributes change update on the GPU
 */
function onChangeLightSource() {
	gl.uniform4fv(light_src_loc, vec4(+ls_x.value, +ls_y.value, +ls_z.value, ls_w.checked ? 1 : 0));
}

/**
 * When any of the light attenuation coefficients change update on the GPU
 */
function onChangeLightAttenuation() {
	gl.uniform3fv(light_atten_loc, vec3(+atten_a.value, +atten_b.value, +atten_c.value));
}

/**
 * Adds a cube to verts/inds defined by the vertices a, b, c, d, e, f, g, h with
 * abcd and efgh as opposite faces of the cube.
 * The indices need to be drawn as a triangle strip.
 */
function cube(a, b, c, d, e, f, g, h, verts, inds) {
	let off = verts.length;
	verts.push(a, b, c, d, e, f, g, h);
	inds.push(off+0, off+2,
		off+3, off+4, off+0, // around vertex d
		off+7, off+6, off+4, // around vertex h
		off+5, off+2, off+6, // around vertex f
		off+1, off+0, off+2  // around vertex b
	);
}

/**
 * Adds a tetrahedron to verts/inds defined by the vertices a, b, c, and d.
 * The indices need to be drawn as a triangle strip.
 */
function tetrahedron(a, b, c, d, verts, inds) {
	let off = verts.length;
	verts.push(a, b, c, d);
	inds.push(off+0, off+1, off+2, off+3, off+0, off+1);
}
