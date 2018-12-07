// Defines nodes for creating a scene graph.
/* exported ElementValue */

// Dynamic value class - takes a function to be called whenever a value is needed
function Value(f) { this.value = f; }
// Dynamic value that gets value from an HTML element by ID
function ElementValue(id) {
	Value.call(this, function () { return +document.getElementById(id).value; });
}
ElementValue.prototype = Object.create(Value.prototype);

// Converts scalar, vector, and matrices that may contain dynamic values to
// all static values.
function get_value(val) {
	if (Array.isArray(val)) {
		let out = val.map(x => get_value(x));
		if (val.matrix) { out.matrix = true; }
		return out;
	}
	return (val instanceof Value) ? val.value() : val;
}

// Base class of all node types
// Can be used directly to group other nodes together
function Node() {
	this.parent = null;
	this.children = [];
}
Node.prototype.render = function (gl) {
	this.begin_render(gl);
	this.draw(gl);
	for (let child of this.children) { child.render(gl); }
	this.end_render(gl);
};
Node.prototype.begin_render = function () { }
Node.prototype.draw = function () { }
Node.prototype.end_render = function () { }
Node.prototype.add_child = function (child) {
	if (child.parent) {
		throw "cannot add a node to multiple parents, copy first";
	}
	child.parent = this;
	this.children.push(child);
	return child;
};
Node.prototype.copy = function () { return new Node(); }
Node.prototype.deep_copy = function () {
	let n = this.copy();
	for (let child of this.children) {
		n.add_child(child.deep_copy());
	}
	return n;
}

// The entire scene - either a perspective or orthographic view
// Subclasses must implement get_matrix()
function Scene() { Node.call(this); }
Scene.prototype = Object.create(Node.prototype);
Scene.prototype.get_matrix = function () { return mat4(); }
Scene.prototype.begin_render = function (gl) {
	let p = this.get_matrix(gl.canvas.width, gl.canvas.height);
	let program = gl.getParameter(gl.CURRENT_PROGRAM);
	let proj_loc = gl.getUniformLocation(program, 'projection');
	this.proj_prev = gl.getUniform(program, proj_loc);
	gl.uniformMatrix4fv(proj_loc, false, flatten(p));
}
Scene.prototype.end_render = function (gl) {
	let program = gl.getParameter(gl.CURRENT_PROGRAM);
	let proj_loc = gl.getUniformLocation(program, 'projection');
	gl.uniformMatrix4fv(proj_loc, false, this.proj_prev);
	delete this.proj_prev;
}

// Perspective scene - optional arguments for degree of field of view y, near
// plane, and far plane.
function Perspective(fov, near, far) {
	Scene.call(this);
	this.fov = typeof fov === "undefined" ? 45 : fov;
	this.near = typeof near === "undefined" ? 0.001 : near;
	this.far = typeof far === "undefined" ? 100 : far;
}
Perspective.prototype = Object.create(Scene.prototype);
Perspective.prototype.get_matrix = function (w, h) {
	return perspective(this.fov, w/h, this.near, this.far);
};
Perspective.prototype.copy = function () {
	return new Perspective(this.fov, this.near, this.far);
};

// Orthographic scene - optional arguments for near and far planes.
function Orthographic(near, far) {
	Scene.call(this);
	this.near = typeof near === "undefined" ? -10 : near;
	this.far = typeof far === "undefined" ? 10 : far;
}
Orthographic.prototype = Object.create(Scene.prototype);
Orthographic.prototype.get_matrix = function (w, h) {
	return (w > h) ? ortho(-w/h, w/h, -1, 1, this.far, this.near) : ortho(-1, 1, -h/w, h/w, this.far, this.near);
};
Orthographic.prototype.copy = function () {
	return new Orthographic(this.near, this.far);
};

// Base class for all transformation nodes
// Subclasses must implement get_matrix()
function Transformation() { Node.call(this); }
Transformation.prototype = Object.create(Node.prototype);
Transformation.prototype.get_matrix = function () { return mat4(); };
Transformation.prototype.begin_render = function (gl) {
	let n = this.parent;
	while (n !== null && !('mv' in n)) { n = n.parent; }
	let mv = this.mv_prev = (n === null) ? mat4() : n.mv;
	this.mv = mult(mv, this.get_matrix());
	let mv_loc = gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'model_view');
	gl.uniformMatrix4fv(mv_loc, false, flatten(this.mv));
};
Transformation.prototype.end_render = function (gl) {
	let mv_loc = gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'model_view');
	gl.uniformMatrix4fv(mv_loc, false, flatten(this.mv_prev));
	delete this.mv_prev;
	delete this.mv;
};

// General matrix transformation - takes a matrix to use as the transformation
function MatrixTransformation(m) {
	Transformation.call(this);
	this.m = m;
}
MatrixTransformation.prototype = Object.create(Transformation.prototype);
MatrixTransformation.prototype.get_matrix = function () { return get_value(this.m); };
MatrixTransformation.prototype.copy = function () { return new MatrixTransformation(this.m); };

// Translation transformation - takes a vec3 for the change in position
function Translation(vec) {
	Transformation.call(this);
	this.vec = vec3(vec);
}
Translation.prototype = Object.create(Transformation.prototype);
Translation.prototype.get_matrix = function () { return translate(get_value(this.vec)); };
Translation.prototype.copy = function () { return new Translation(this.vec); };

// X rotation transformation - takes an angle in degrees
function XRotation(angle) {
	Transformation.call(this);
	this.angle = angle;
}
XRotation.prototype = Object.create(Transformation.prototype);
XRotation.prototype.get_matrix = function () { return rotateX(get_value(this.angle)); };
XRotation.prototype.copy = function () { return new XRotation(this.angle); };

// Y rotation transformation - takes an angle in degrees
function YRotation(angle) {
	Transformation.call(this);
	this.angle = angle;
}
YRotation.prototype = Object.create(Transformation.prototype);
YRotation.prototype.get_matrix = function () { return rotateY(get_value(this.angle)); };
YRotation.prototype.copy = function () { return new YRotation(this.angle); };

// Z rotation transformation - takes an angle in degrees
function ZRotation(angle) {
	Transformation.call(this);
	this.angle = angle;
}
ZRotation.prototype = Object.create(Transformation.prototype);
ZRotation.prototype.get_matrix = function () { return rotateZ(get_value(this.angle)); };
ZRotation.prototype.copy = function () { return new ZRotation(this.angle); };

// Euler angle rotation transformation - takes a vec3 of angles in degrees
function EulerRotation(angles) {
	Transformation.call(this);
	this.angles = vec3(angles);
}
EulerRotation.prototype = Object.create(Transformation.prototype);
EulerRotation.prototype.get_matrix = function () {
	let angles = get_value(this.angles);
	return mult(rotateZ(angles[2]), mult(rotateY(angles[1]), rotateX(angles[0])));
};
EulerRotation.prototype.copy = function () { return new EulerRotation(this.angles); };

// Rotation around an axis transformation - takes an angle in degrees and a vec3
// for the axis of rotation
function AxisRotation(angle, axis) {
	Transformation.call(this);
	this.angle = angle;
	this.axis = vec3(axis);
}
AxisRotation.prototype = Object.create(Transformation.prototype);
AxisRotation.prototype.get_matrix = function () { return rotate(get_value(this.angle), get_value(this.axis)); };
AxisRotation.prototype.copy = function () { return new Scale(this.angle, this.axis); };

// Scale transformation - takes a single size or a vec3 of sizes to scale by
function Scale(size) {
	Transformation.call(this);
	this.size = Array.isArray(size) ? vec3(size) : vec3(size, size, size);
}
Scale.prototype = Object.create(Transformation.prototype);
Scale.prototype.get_matrix = function () { return scalem(get_value(this.size)); };
Scale.prototype.copy = function () { return new Scale(this.size); };

// Base class for nodes that set a uniform to a value (and reset)
// Subclasses must implement set_value(gl, loc, value)
function SetUniform(name, value) {
	Node.call(this);
	this.name = name;
	this.value = value;
}
SetUniform.prototype = Object.create(Node.prototype);
SetUniform.prototype.set_value = function () { }
SetUniform.prototype.begin_render = function (gl) {
	let program = gl.getParameter(gl.CURRENT_PROGRAM);
	let loc = gl.getUniformLocation(program, this.name);
	this.prev_val = gl.getUniform(program, loc);
	this.set_value(gl, loc, this.value);
};
SetUniform.prototype.end_render = function (gl) {
	let program = gl.getParameter(gl.CURRENT_PROGRAM);
	let loc = gl.getUniformLocation(program, this.name);
	this.set_value(gl, loc, this.prev_val);
	delete this.prev_val;
};

// Set a uniform to a single int value
function SetIntUniform(name, value) { SetUniform.call(this, name, value); }
SetIntUniform.prototype = Object.create(SetUniform.prototype);
SetIntUniform.prototype.set_value = function (gl, loc, value) { gl.uniform1i(loc, value); };
SetIntUniform.prototype.copy = function () { return new SetIntUniform(this.name, this.value); };

// Set a uniform to a single float value
function SetFloatUniform(name, value) { SetUniform.call(this, name, value); }
SetFloatUniform.prototype = Object.create(SetUniform.prototype);
SetFloatUniform.prototype.set_value = function (gl, loc, value) { gl.uniform1f(loc, value); };
SetFloatUniform.prototype.copy = function () { return new SetFloatUniform(this.name, this.value); };

// Set a uniform to a vector value (length 2, 3, or 4)
function SetVecUniform(name, value, isint) {
	SetUniform.call(this, name, value);
	if (typeof isint === "undefined") { isint = false; }
	this.func = 'uniform'+value.length+(isint?'i':'f')+'v';
}
SetVecUniform.prototype = Object.create(SetUniform.prototype);
SetVecUniform.prototype.set_value = function (gl, loc, value) { gl[this.func](loc, get_value(value)); };
SetVecUniform.prototype.copy = function () { return new SetVecUniform(this.name, this.value); };

// Set a uniform to a matrix value (size 2x2, 3x3, or 4x4)
function SetMatUniform(name, value) {
	SetUniform.call(this, name, value);
	this.func = 'uniformMatrix'+value.length+'fv';
}
SetMatUniform.prototype = Object.create(SetUniform.prototype);
SetMatUniform.prototype.set_value = function (gl, loc, value) { gl[this.func](loc, false, flatten(get_value(value))); };
SetMatUniform.prototype.copy = function () { return new SetMatUniform(this.name, this.value); };


// Draw an object using drawElements using indices from start to count. The mode
// is optional and defaults to TRIANGLE_STRIP.
function DrawElements(start, count, mode) {
	Node.call(this);
	this.start = start;
	this.count = count;
	this.mode = typeof mode === "undefined" ? WebGLRenderingContext.TRIANGLE_STRIP : mode;
}
DrawElements.prototype = Object.create(Node.prototype);
DrawElements.prototype.draw = function (gl) { gl.drawElements(this.mode, this.count, WebGLRenderingContext.UNSIGNED_SHORT, 2*this.start); };
DrawElements.prototype.copy = function () { return new DrawElements(this.start, this.count, this.mode); };

// Draw a tetrahedron with the vertices a, b, c, and d.
function Tetrahedron(a, b, c, d, verts, inds) {
	let start = inds.length;
	tetrahedron(a, b, c, d, verts, inds);
	DrawElements.call(this, start, inds.length - start);
}
Tetrahedron.prototype = Object.create(DrawElements.prototype);

// Draw a cube that has pt1 and pt2 opposite each other.
function Cube(pt1, pt2, verts, inds) {
	let start = inds.length;
	cube(
		vec3(pt1[0], pt1[1], pt1[2]), vec3(pt2[0], pt1[1], pt1[2]),
		vec3(pt2[0], pt2[1], pt1[2]), vec3(pt1[0], pt2[1], pt1[2]),
		vec3(pt1[0], pt2[1], pt2[2]), vec3(pt2[0], pt2[1], pt2[2]),
		vec3(pt2[0], pt1[1], pt2[2]), vec3(pt1[0], pt1[1], pt2[2]),
		verts, inds);
	DrawElements.call(this, start, inds.length - start);
}
Cube.prototype = Object.create(DrawElements.prototype);

// Draw a sphere that has the given center and radius. The number of subdivisions
// defaults to 4 (which is 1024 triangles).
function Sphere(center, radius, verts, inds, num_subdivisions) {
	if (typeof num_subdivisions === "undefined") { num_subdivisions = 4; }
	let start = inds.length;
	let start_verts = verts.length;
	sphere(radius, verts, inds, num_subdivisions);
	for (let i = start_verts; i < verts.length; i++) {
		verts[i][0] += center[0];
		verts[i][1] += center[1];
		verts[i][2] += center[2];
	}
	DrawElements.call(this, start, inds.length - start, WebGLRenderingContext.TRIANGLES);
}
Sphere.prototype = Object.create(DrawElements.prototype);


// Draw an object using drawArrays using vertices from start to count. The mode
// is optional and defaults to TRIANGLE_STRIP.
function DrawArrays(start, count, mode) {
	Node.call(this);
	this.start = start;
	this.count = count;
	this.mode = typeof mode === "undefined" ? WebGLRenderingContext.TRIANGLE_STRIP : mode;
}
DrawArrays.prototype = Object.create(Node.prototype);
DrawArrays.prototype.draw = function (gl) { gl.drawArrays(this.mode, this.start, this.count); };
DrawArrays.prototype.copy = function () { return new DrawArrays(this.start, this.count, this.mode); };
