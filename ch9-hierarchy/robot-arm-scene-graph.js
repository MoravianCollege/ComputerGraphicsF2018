// This is a WebGL example that demonstrates basic hierarchial modeling with
// a robot arm.

// Global WebGL context variable
let gl;

// Description of model
const BASE_HEIGHT = 0.1;
const ARM1_LENGTH = 0.4;
const ARM2_LENGTH = 0.2;
let scene;


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
	let base = new Cube(vec3(-0.1, 0, -0.1), vec3(0.1, BASE_HEIGHT, 0.1), verts, inds);
	let lower = new Cube(vec3(-0.01, 0, -0.01), vec3(0.01, ARM1_LENGTH, 0.01), verts, inds);
	let upper = new Cube(vec3(-0.01, 0, -0.01), vec3(0.01, ARM2_LENGTH, 0.01), verts, inds);

	// Add the parts in a scene graph
	scene = new Perspective();
	scene.
		add_child(new Translation(vec3(0, -0.25, -2))). // move away from the camera
		add_child(new SetVecUniform('color', vec3(0.6, 0.6, 0.6))).
		add_child(new YRotation(new ElementValue('base-angle'))).
		add_child(base);
	// Red arm
	base.
		add_child(new SetVecUniform('color', vec3(1.0, 0.1, 0.1))).
		add_child(new Translation(vec3(0,BASE_HEIGHT,0))).
		add_child(new ZRotation(new ElementValue('lower-angle'))).
		add_child(lower).
		add_child(new Translation(vec3(0,ARM1_LENGTH,0))).
		add_child(new ZRotation(new ElementValue('upper-angle'))).
		add_child(upper);
	// Green arm
	let lower2 = lower.copy(); // copy re-uses the data from the previous one
	let upper2 = upper.copy();
	base.
		add_child(new SetVecUniform('color', vec3(0.0, 0.5, 0.0))).
		add_child(new Translation(vec3(0,BASE_HEIGHT,0))).
		add_child(new ZRotation(new ElementValue('lower2-angle'))).
		add_child(lower2).
		add_child(new Translation(vec3(0,ARM1_LENGTH,0))).
		add_child(new ZRotation(new ElementValue('upper2-angle'))).
		add_child(upper2);


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
		uniform vec3 color;
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

	// Load the vertex data into the GPU
	create_vertex_attr_buffer(gl, program, 'vPosition', verts);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

	// Make the canvas fit the window
	window.addEventListener('resize', onResize);

	// Render the scene
	render();
});

/**
 * Render the scene.
 */
function render() {
	// Clear
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw entire scene
	scene.render(gl);

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * Make the canvas fit the window
 */
function onResize() {
	let w = window.innerWidth, h = window.innerHeight;
	gl.canvas.width = w;
	gl.canvas.height = h;
	gl.viewport(0, 0, w, h);
}
