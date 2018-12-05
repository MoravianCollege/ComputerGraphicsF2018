// This is a WebGL example that demonstrates basic hierarchial modeling with
// a robot arm.

// Global WebGL context variable
let gl;

// Global uniform locations
let model_view_loc;

// Description of model
const BASE_HEIGHT = 0.1;
const ARM1_LENGTH = 0.4;
const ARM2_LENGTH = 0.2;
let base = {
	// Robot Arm base - if the base rotates then everything rotates
	'position': vec3(0,0,0), 'rotation': vec3(0,45,0),
	'start': 0, 'count': 0,
};
let lower = {
	// First part of the robot arm
	'position': vec3(0,BASE_HEIGHT,0), 'rotation': vec3(0,0,45),
	'start': 0, 'count': 0,
};
let upper = {
	// Second part of the robot arm
	'position': vec3(0,ARM1_LENGTH,0), 'rotation': vec3(0,0,45),
	'start': 0, 'count': 0,
};

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
	gl.clearColor(0.0, 0.0, 0.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	onResize();

	// Create cubes to use for all parts
	let verts = [], inds = [];
	base.start = inds.length;
	cube(
		vec3(-0.1, 0.0, -0.1), vec3(0.1, 0.0, -0.1), vec3(0.1, BASE_HEIGHT, -0.1), vec3(-0.1, BASE_HEIGHT, -0.1),
		vec3(-0.1, BASE_HEIGHT,  0.1), vec3(0.1, BASE_HEIGHT,  0.1), vec3(0.1, 0.0,  0.1), vec3(-0.1, 0.0,  0.1),
		verts, inds);
	base.count = inds.length - base.start;

	lower.start = inds.length;
	cube(
		vec3(-0.01, 0.0, -0.01), vec3(0.01, 0.0, -0.01), vec3(0.01, ARM1_LENGTH, -0.01), vec3(-0.01, ARM1_LENGTH, -0.01),
		vec3(-0.01, ARM1_LENGTH,  0.01), vec3(0.01, ARM1_LENGTH,  0.01), vec3(0.01, 0.0,  0.01), vec3(-0.01, 0.0,  0.01),
		verts, inds);
	lower.count = inds.length - lower.start;

	upper.start = inds.length;
	cube(
		vec3(-0.01, 0.0, -0.01), vec3(0.01, 0.0, -0.01), vec3(0.01, ARM2_LENGTH, -0.01), vec3(-0.01, ARM2_LENGTH, -0.01),
		vec3(-0.01, ARM2_LENGTH,  0.01), vec3(0.01, ARM2_LENGTH,  0.01), vec3(0.01, 0.0,  0.01), vec3(-0.01, 0.0,  0.01),
		verts, inds);
	upper.count = inds.length - upper.start;

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		uniform mat4 model_view;
		uniform mat4 projection;
		varying vec3 pos, L, V;
		void main() {
			gl_Position = projection*model_view*vPosition;
			pos = mat3(model_view)*vPosition.xyz;
			L = normalize(vec3(0.0, 1.0, -1.0)-pos);
			V = normalize(vec3(0.0, 0.0, 0.0)-pos);
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		#extension GL_OES_standard_derivatives : enable
		precision mediump float;
		const vec3 color = vec3(0.6, 0.6, 0.6);
		const float ka = 0.5, kd = 0.7, ks = 0.5, shininess = 2000.0;
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

	// Link the programs
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Get the uniforms
	model_view_loc = gl.getUniformLocation(program, 'model_view');

	// Load the vertex data into the GPU
	create_vertex_attr_buffer(gl, program, 'vPosition', verts);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

	// Add projection to the view
	add_standard_handlers(program);

	// Listen to sliders for the pieces
	document.getElementById('base-angle').addEventListener('change', function () {
		base.rotation[1] = +this.value;
	});
	document.getElementById('lower-angle').addEventListener('change', function () {
		lower.rotation[2] = +this.value;
	});
	document.getElementById('upper-angle').addEventListener('change', function () {
		upper.rotation[2] = +this.value;
	});

	// Render the scene
	render();
});

/**
 * Render the scene.
 */
function render() {
	// Clear
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw each object
	let mv = mat4(); // start with no transformation
	for (let obj of [base, lower, upper]) {
		// Add in this object's transformation
		mv = mult(mv, translate(obj.position[0], obj.position[1], obj.position[2]));
		mv = mult(mv, rotateZ(obj.rotation[2]));
		mv = mult(mv, rotateY(obj.rotation[1]));
		mv = mult(mv, rotateX(obj.rotation[0]));
		//mv = mult(scalem(obj.scale, obj.scale, obj.scale), mv);
		gl.uniformMatrix4fv(model_view_loc, false, flatten(mv));
		// Draw the object
		gl.drawElements(gl.TRIANGLE_STRIP, obj.count, gl.UNSIGNED_SHORT, 2*obj.start);
	}

	// Animate
	window.requestAnimationFrame(render);
}


//////////////////////// Standard Movement Handlers ////////////////////////
// Uniform locations
let projection_loc;

/**
 * Sets up our standard movement handlerrs for the given program.
 */
function add_standard_handlers(program) {
	// Get the uniforms
	projection_loc = gl.getUniformLocation(program, 'projection');

	// Give the uniforms their initial values
	update_projection();

	// Add the resize listener
	window.addEventListener('resize', onResize);
}

/**
 * Updates the projection transformation based on the global variables.
 */
function update_projection() {
	let p, w = gl.canvas.width, h = gl.canvas.height;
	p = perspective(45, w/h, 0.01, 10);
	// Need to move the camera away from the origin
	p = mult(p, translate(0, -0.25, -2));
	gl.uniformMatrix4fv(projection_loc, false, flatten(p));
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
