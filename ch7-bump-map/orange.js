// This is a WebGL example that draws an orange using bump mapping.

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

	// Create the shape
	let verts = [], inds = [];
	unit_sphere(verts, inds, 7);
	total_verts = inds.length;

	// Load the texture data
	let img = create_bump_map(512);

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		uniform mat4 model_view;
		uniform mat4 projection;
		const vec3 light_src = vec3(10.0, 10.0, 10.0);
		varying vec3 L, V, pos; // no N for normal - calculated in vertex shader
		varying vec2 fTexCoord;
		#define M_PI 3.1415926535897932384626433832795
		void main() {
			pos = vec3(model_view*vPosition);
			gl_Position = projection*model_view*vPosition;
			L = normalize(light_src - pos);
			V = normalize(vec3(0.0) - pos); // assumes viewer is at <0,0,0> in model coordinates

			// Texture coordinate based on spherical position
			float theta = atan(vPosition.y, vPosition.x);
			float phi = atan(sqrt(vPosition.x*vPosition.x+vPosition.y*vPosition.y), vPosition.z);
			fTexCoord = vec2(theta, phi) / (2.0*M_PI);
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		#extension GL_OES_standard_derivatives : enable
		precision mediump float;
		const float ka = 0.3, kd = 0.8, ks = 0.1, shininess = 20.0;
		const vec4 material = vec4(1.0, 0.7, 0.1, 1.0);

		varying vec3 L, V, pos;

		varying vec2 fTexCoord;
		uniform sampler2D texBump;

		void main() {
			vec3 T = normalize(dFdx(pos)); // tangent vector
			vec3 B = normalize(dFdy(pos)); // binormal vector (other tangent)
			//vec3 N = normalize(cross(T, B)); // normal vector (flat shading)
			vec3 N = normalize(-pos);      // normal vector (sphere at origin)
			mat3 M = mat3(T, B, N);

			vec3 NN = normalize(2.0*texture2D(texBump, fTexCoord).rgb - 1.0);
			vec3 LL = normalize(M * L);
			vec3 VV = normalize(M * V); VV.z = -VV.z;

			float d = max(dot(NN, LL), 0.0);
			float s = d != 0.0 ? pow(max(dot(NN, normalize(LL + VV)), 0.0), shininess) : 0.0;

			vec4 color = material;
			gl_FragColor = ka*color + kd*d*color + ks*s*vec4(1.0, 1.0, 1.0, 1.0);
			gl_FragColor.a = 1.0;
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Load the vertex data into the GPU and associate with shader
	create_vertex_attr_buffer(gl, program, 'vPosition', verts);
	//create_vertex_attr_buffer(gl, program, 'vNormal', normals);
	//create_vertex_attr_buffer(gl, program, 'vTexCoord', tex_coords);

	// Load the indices
	let bufferId = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

	// Load and set the texture
	load_texture(gl, img, 0);
	gl.uniform1i(gl.getUniformLocation(program, "texBump"), 0);

	// Setup the standard movement system
	add_standard_handlers(program);

	// Render the scene
	render();
});

function create_bump_map(texSize) {
	// Create the bump map displacement data
	// We randomly place 'divots'
	let d = new Float64Array(texSize*texSize);
	for (let i = 1; i < texSize; i++) {
		for (let j = 1; j < texSize; j++) {
			if (Math.random() < 0.1) {
				d[i*texSize+j-1] = 0.1;
				d[i*texSize+j+1] = 0.1;
				d[i*texSize+j] = 0.2;
			}
		}
	}

	// Take the derivative of the bump map
	let du = new Float64Array(texSize*texSize);
	let dv = new Float64Array(texSize*texSize);
	for (let i = 1; i < texSize; i++) {
		for (let j = 1; j < texSize; j++) {
			let off = i*texSize+j;
			du[off] = d[off] - d[off-texSize];
			dv[off] = d[off] - d[off-1];
		}
	}

	// Scale the data and save image data
	let img = new ImageData(texSize, texSize);
	let data = img.data;
	for (let i = 0; i < texSize; i++) {
		for (let j = 0; j < texSize; j++) {
			let off = i*texSize+j;
			let norm = Math.sqrt(du[off]*du[off] + dv[off]*dv[off] + 1);
			du[off] = du[off] / norm;
			dv[off] = dv[off] / norm;
			data[4*off]   = (du[off] + 1) * 127.5;
			data[4*off+1] = (dv[off] + 1) * 127.5;
			data[4*off+2] = (1/norm  + 1) * 127.5;
			data[4*off+3] = 0;
		}
	}

	return img;
}

/**
 * Render the scene.
 */
function render() {
	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawElements(gl.TRIANGLES, total_verts, gl.UNSIGNED_SHORT, 0);

	// Animate
	window.requestAnimationFrame(render);
}


//////////////////////// Standard Movement Handlers ////////////////////////
// Uniform locations
let model_view_loc, projection_loc;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 0.8;

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
