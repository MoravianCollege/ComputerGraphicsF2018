// This is a WebGL example that draws a cube with a reflective texture. The world is a outdoor
// scene.
/* exported cube tetrahedron unit_sphere load_texture load_cubemap_texture */

// Global WebGL context variable
let gl;

// Global list of vertices being drawn
let total_verts;


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

	// Load the texture data
	let img_loaded = 0;
	let img1 = new Image(), img2 = new Image(), img3 = new Image();
	let img4 = new Image(), img5 = new Image(), img6 = new Image();
	let onload_img = function () {
		if (++img_loaded === 6) {
			// Load the texture onto the GPU
			load_cubemap_texture(gl, img1, img2, img4, img3, img5, img6);
			// Render the scene
			render();
		}
	};
	img1.addEventListener('load', onload_img);
	img2.addEventListener('load', onload_img);
	img3.addEventListener('load', onload_img);
	img4.addEventListener('load', onload_img);
	img5.addEventListener('load', onload_img);
	img6.addEventListener('load', onload_img);
	img1.src = 'img1.png';
	img2.src = 'img2.png';
	img3.src = 'img3.png';
	img4.src = 'img4.png';
	img5.src = 'img5.png';
	img6.src = 'img6.png';

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec4 vNormal;
		uniform mat4 model_view;
		uniform mat4 projection;
		const vec4 light_src = vec4(1.0, 4.0, -1.0, 1.0);
		const bool light_in_model = false;
		varying vec4 pos, N, L, V;
		varying vec3 fTexCoord;
		void main() {
			pos = model_view*vPosition;
			gl_Position = projection*pos;

			N = normalize(model_view*vNormal);

			L = light_in_model ? model_view*light_src : light_src;
			if (light_src.w == 1.0) { L -= pos; } // light source is given as a location
			L = normalize(L);

			// NOTE: this assumes viewer is at <0,0,0> in model coordinates
			V = normalize(vec4(0.0, 0.0, 0.0, 1.0)-pos);

			// Texture coordinate is the reflection of the viewer vector into the world
			fTexCoord = reflect(vec3(V), vec3(N));
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		#extension GL_OES_standard_derivatives : enable
		precision highp float;
		const bool flat_shading = true;
		const float ka = 0.2, kd = 1.0, ks = 1.0;
		const float shininess = 20.0;
		varying vec4 N, L, V, pos;

		uniform samplerCube texture;
		varying vec3 fTexCoord;

		void main() {
			vec4 n = normalize(!flat_shading ? N :
				vec4(cross(vec3(dFdy(pos)), vec3(dFdx(pos))), 0));
			vec4 l = normalize(L);
			vec4 v = normalize(V); v.z = -v.z; // for some reason this is necessary
			float d = max(dot(l, n), 0.0);
			float s = d != 0.0 ? pow(max(dot(n, normalize(l + v)), 0.0), shininess) : 0.0;

			vec4 color = textureCube(texture, fTexCoord);
			gl_FragColor = ka*color + d*kd*color + s*ks*vec4(1.0, 1.0, 1.0, 0.0);
			gl_FragColor.a = 1.0; // force opaque
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Load the vertex data into the GPU and associate with shader
	create_vertex_attr_buffer(gl, program, 'vPosition', verts);
	create_vertex_attr_buffer(gl, program, 'vNormal', normals);

	// Load the indices
	let bufferId = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

	// Set the textures
	gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);

	// Setup the standard movement system
	add_standard_handlers(program);

	// DO NOT Render the scene
	//render();
});

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



//////////////////////// Standard Movement Handlers ////////////////////////
// Uniform locations
let model_view_loc, projection_loc;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 0.4;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;

// Whether to render with perspective or not
const show_perspective = false;

/**
 * Sets up our standard movement handlerrs for the given program.
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
