// This is a WebGL example that demonstrates image processing

// Global WebGL context variable
let gl;

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
	gl.clearColor(0.0, 0.0, 0.0, 0.0); // setup the background color with red, green, blue, and alpha

	// Create a single rectangle
	let verts = [vec2(-1, -1), vec2(-1, 1), vec2(1, -1), vec2(1, 1)];
	let tex_coords = [vec2(0, 0), vec2(0, 1), vec2(1, 0), vec2(1, 1)];

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec2 vPosition;
		attribute vec2 vTexCoord;
		varying vec2 fTexCoord;
		void main() {
			gl_Position = vec4(vPosition, 0, 1);
			fTexCoord = vTexCoord;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		varying vec2 fTexCoord;
		uniform vec2 range;
		uniform sampler2D texture;
		void main() {
			vec4 color = texture2D(texture, fTexCoord);
			gl_FragColor = (color - range[0]) / (range[1] - range[0]);
			//gl_FragColor = (color - 0.0) / (1.0 - 0.0);
			gl_FragColor.a = 1.0;
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Load the vertex data into the GPU and associate with shader
	create_vertex_attr_buffer(gl, program, 'vPosition', verts);
	create_vertex_attr_buffer(gl, program, 'vTexCoord', tex_coords);

	// Get the uniforms
	let range_loc = gl.getUniformLocation(program, 'range');

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Load the image
	let img = new Image();
	img.addEventListener('load', function () {
		// Load the image onto the GPU
		let tex = load_texture(gl, img, 0);

		// Find the image min and max values
		let data = get_image_data(gl, tex);
		let min = 255, max = 0;
		for (let i = 0; i < data.length; i++) {
			if (i % 4 !== 3) {
				if (data[i] < min) { min = data[i]; }
				if (data[i] > max) { max = data[i]; }
			}
		}
		min /= 255; max /= 255;
		gl.uniform2f(range_loc, min, max);

		// Render the scene
		render();
	});
	img.src = 'chickens2.png';
});

/**
 * Render the scene.
 */
function render() {
	// Clear
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * When resizing the canvas takes up the entire screen.
 */
function onResize() {
	let w = window.innerWidth, h = window.innerHeight;
	gl.canvas.width = w;
	gl.canvas.height = h;
	gl.viewport(0, 0, w, h);
}
