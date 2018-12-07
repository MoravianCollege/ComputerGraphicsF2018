// This is a WebGL example that demonstrates basic hierarchial modeling with
// a person.

// Global WebGL context variable
let gl;

// Description of model
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

	let shirt = vec3(0.0, 0.5, 0.0);
	let jeans = vec3(0.06, 0.3, 0.55);
	let skin  = vec3(1.0, 0.8, 0.6);
	let black = vec3(0.0, 0.0, 0.0);

	let torso = new Cube(vec3(-0.1, 0, -0.1), vec3(0.1, 0.35, 0.1), verts, inds);
	let shoulder = new Sphere(vec3(0,0,0), 0.028, verts, inds);
	let arm = new Cube(vec3(-0.025, 0, -0.025), vec3(0.025, 0.2, 0.025), verts, inds);
	let elbow = new Sphere(vec3(0,0,0), 0.018, verts, inds);
	let forearm = new Cube(vec3(-0.02, 0, -0.02), vec3(0.02, 0.18, 0.02), verts, inds);
	let wrist = new Sphere(vec3(0,0,0), 0.028, verts, inds);
	let hand = new Cube(vec3(-0.03, 0, -0.03), vec3(0.03, 0.07, 0.03), verts, inds);
	let neck = new Cube(vec3(-0.025, 0, -0.025), vec3(0.025, 0.02, 0.025), verts, inds);
	let head = new Sphere(vec3(0,0,0), 0.08, verts, inds);
	let eye = new Sphere(vec3(0,0,0), 0.01, verts, inds);
	let pants = new Cube(vec3(-0.1, -0.05, -0.1), vec3(0.1, 0.0, 0.1), verts, inds);
	let hip = new Sphere(vec3(0,0,0), 0.055, verts, inds);
	let thigh = new Cube(vec3(-0.05, -0.2, -0.05), vec3(0.05, 0.0, 0.05), verts, inds);
	let knee = new Sphere(vec3(0,0,0), 0.05, verts, inds);
	let calf = new Cube(vec3(-0.04, -0.2, -0.04), vec3(0.04, 0.0, 0.04), verts, inds);
	let ankle = new Sphere(vec3(0,0,0), 0.04, verts, inds);
	let foot = new Cube(vec3(-0.035, -0.04, -0.035), vec3(0.035, 0.0, 0.08), verts, inds);

	// Add the parts in a scene graph
	scene = new Perspective();
	scene.
		add_child(new Translation(vec3(0, -0.1, -2))). // move away from the camera
		add_child(new SetVecUniform('color', shirt)).
		add_child(new YRotation(new ElementValue('body-angle'))).
		add_child(torso);
	// Right arm
	torso.
		add_child(new Translation(vec3(-0.1,0.32,0))).
		add_child(new EulerRotation(vec3(new ElementValue('r-shoulder-x-angle'),
			new ElementValue('r-shoulder-y-angle'), new ElementValue('r-shoulder-z-angle')))).
		add_child(shoulder).
		add_child(arm).
		add_child(new SetVecUniform('color', skin)).
		add_child(new Translation(vec3(0,0.2,0))).
		add_child(new ZRotation(new ElementValue('r-elbow-angle'))).
		add_child(elbow).
		add_child(forearm).
		add_child(new Translation(vec3(0,0.18,0))).
		add_child(new EulerRotation(vec3(new ElementValue('r-hand-x-angle'),
			new ElementValue('r-hand-y-angle'), new ElementValue('r-hand-z-angle')))).
		add_child(wrist).
		add_child(hand);
	// Left arm
	torso.
		add_child(new Translation(vec3(0.1,0.32,0))).
		add_child(new EulerRotation(vec3(new ElementValue('l-shoulder-x-angle'),
			new ElementValue('l-shoulder-y-angle'), new ElementValue('l-shoulder-z-angle')))).
		add_child(shoulder.copy()).
		add_child(arm.copy()).
		add_child(new SetVecUniform('color', skin)).
		add_child(new Translation(vec3(0,0.2,0))).
		add_child(new ZRotation(new ElementValue('l-elbow-angle'))).
		add_child(elbow.copy()).
		add_child(forearm.copy()).
		add_child(new Translation(vec3(0,0.18,0))).
		add_child(new EulerRotation(vec3(new ElementValue('l-hand-x-angle'),
			new ElementValue('l-hand-y-angle'), new ElementValue('l-hand-z-angle')))).
		add_child(wrist.copy()).
		add_child(hand.copy());
	// Head
	torso.
		add_child(new SetVecUniform('color', skin)).
		add_child(new Translation(vec3(0,0.35,0))).
		add_child(new XRotation(new ElementValue('yes-angle'))).
		add_child(neck).
		add_child(new Translation(vec3(0,0.09,0))).
		add_child(new YRotation(new ElementValue('no-angle'))).
		add_child(head);
	head.
		add_child(new SetVecUniform('color', black)).
		add_child(new Translation(vec3(-0.025,0.02,0.068))).
		add_child(eye);
	head.
		add_child(new SetVecUniform('color', black)).
		add_child(new Translation(vec3(0.025,0.02,0.068))).
		add_child(eye.copy());
	// Legs
	torso.
		add_child(new SetVecUniform('color', jeans)).
		add_child(pants);
	pants.
		add_child(new Translation(vec3(-0.055, -0.05, 0.0))).
		add_child(new EulerRotation(vec3(new ElementValue('r-leg-x-angle'),
			new ElementValue('r-leg-y-angle'), new ElementValue('r-leg-z-angle')))).
		add_child(hip).
		add_child(thigh).
		add_child(new Translation(vec3(0.0, -0.2, 0.0))).
		add_child(new XRotation(new ElementValue('r-knee-angle'))).
		add_child(knee).
		add_child(calf).
		add_child(new SetVecUniform('color', black)).
		add_child(new Translation(vec3(0.0, -0.2, 0.0))).
		add_child(new EulerRotation(vec3(new ElementValue('r-ankle-x-angle'),
			new ElementValue('r-ankle-y-angle'), new ElementValue('r-ankle-z-angle')))).
		add_child(ankle).
		add_child(foot);
	pants.
		add_child(new Translation(vec3(0.055, -0.05, 0.0))).
		add_child(new EulerRotation(vec3(new ElementValue('l-leg-x-angle'),
			new ElementValue('l-leg-y-angle'), new ElementValue('l-leg-z-angle')))).
		add_child(hip.copy()).
		add_child(thigh.copy()).
		add_child(new Translation(vec3(0.0, -0.2, 0.0))).
		add_child(new XRotation(new ElementValue('l-knee-angle'))).
		add_child(knee.copy()).
		add_child(calf.copy()).
		add_child(new SetVecUniform('color', black)).
		add_child(new Translation(vec3(0.0, -0.2, 0.0))).
		add_child(new EulerRotation(vec3(new ElementValue('l-ankle-x-angle'),
			new ElementValue('l-ankle-y-angle'), new ElementValue('l-ankle-z-angle')))).
		add_child(ankle.copy()).
		add_child(foot.copy());


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
