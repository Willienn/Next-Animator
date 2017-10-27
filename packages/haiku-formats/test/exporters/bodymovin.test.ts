import * as tape from 'tape';

import {HaikuBytecode} from 'haiku-common/lib/types';

import {BodymovinExporter} from '../../lib/exporters/bodymovin/bodymovinExporter';
import baseBytecode from './baseBytecode';

const rawOutput = (bytecode: HaikuBytecode) => (new BodymovinExporter(bytecode).rawOutput());

const overrideShapeAttributes = (bytecode, attributes) => {
  bytecode.timelines.Default['haiku:shape'] = attributes;
  return bytecode;
};

const overrideShapeElement = (bytecode, elementName) => {
  bytecode.template.children[0].children[0].elementName = elementName;
};

const baseBytecodeDeepCopy = () => JSON.parse(JSON.stringify(baseBytecode));

tape('BodymovinExporter', (test: tape.Test) => {
  test.test('requires a div wrapper', (test: tape.Test) => {
    const bytecode = {
      ...baseBytecode, template: {
        ...baseBytecode.template, elementName: 'span',
      },
    };
    test.throws(rawOutput.bind(undefined, bytecode), 'throws if provided a span wrapper');
    test.end();
  });

  test.test('requires svg wrapper children', (test: tape.Test) => {
    const bytecode = {
      ...baseBytecode, template: {
        ...baseBytecode.template, children: [{
          elementName: 'div',
        }],
      },
    };
    test.throws(rawOutput.bind(undefined, bytecode), 'throws if provided a div child');
    test.end();
  });

  test.test('uses the specified version of Bodymovin', (test: tape.Test) => {
    const {v} = rawOutput(baseBytecode);
    test.deepEqual({v}, {v: '4.11.1'}, 'gets the Bodymovin version from package.json');
    test.end();
  });

  test.test('uses constant in-point and framerate', (test: tape.Test) => {
    const {ip, fr} = rawOutput(baseBytecode);
    test.deepEqual({ip, fr}, {ip: 0, fr: 60}, 'always uses in-point of 0 and 60 fps');
    test.end();
  });

  test.test('derives animation dimensions from wrapper element', (test: tape.Test) => {
    const {w, h} = rawOutput(baseBytecode);
    test.deepEqual({w, h}, {w: 640, h: 480}, 'gets animation width and height from stage');
    test.end();
  });

  test.test('morphs translation to positional', (test: tape.Test) => {
    const {
      layers: [{
        ks: {p: {s, y}},
      }],
    } = rawOutput(baseBytecode);
    test.equal(s, true, 'splits positionals');
    test.deepEqual(y, {a: 0, k: 20}, 'passes through scalar values');
    test.end();
  });

  test.test('animates properties', (test: tape.Test) => {
    const {
      layers: [{
        ks: {p: {x: {a, k: [{t, s, e, i, o}, finalKeyframe]}}},
      }], op,
    } = rawOutput(baseBytecode);

    test.equal(op, 60, 'derives out-point from final keyframe');
    test.equal(a, 1, 'knows an animation is active');
    test.deepEqual({t, s, e}, {t: 0, s: [0], e: [10]}, 'animates using keyframes');
    test.deepEqual({i, o}, {i: {x: [1], y: [1]}, o: {x: [0], y: [0]}}, 'derives bezier interpolation points');
    test.deepEqual(finalKeyframe, {t: 60}, 'provides a final keyframe with no properties');
    test.end();
  });

  test.test('normalizes curves for transitions lacking tweens', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    bytecode.timelines.Default['haiku:svg'].opacity = {
      0: {value: 0},
      10: {value: 1},
    };

    const {
      layers: [{
        ks: {o: {k: [initialKeyframe, injectedKeyframe, finalKeyframe]}},
      }],
    } = rawOutput(bytecode);

    test.deepEqual(initialKeyframe.e, [0], 'forks initial keyframe to transition back to itself');
    test.equal(injectedKeyframe.t, 9, 'injects a keyframe one frame before the jumped-to keyframe');
    test.deepEqual(injectedKeyframe.s, [0], 'initializes the injected keyframe at the same value as the initial');
    test.deepEqual(injectedKeyframe.e, [100], 'terminates the injected keyframe at the jumped-to value');
    test.equal(finalKeyframe.t, 10, 'terminates the final keyframe as it originally was');
    test.end();
  });

  test.test('provides default transforms for layers', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    // Provide no information about how to transform the SVG layer.
    delete bytecode.timelines.Default['haiku:svg'];
    const {
      layers: [{
        ks: {p, o, s, a},
      }],
    } = rawOutput(bytecode);
    test.deepEqual(p.k, [0, 0, 0], 'default translation is (0, 0, 0)');
    test.equal(o.k, 100, 'default opacity is 100%');
    test.deepEqual(s.k, [100, 100, 100], 'default scaling is 100%');
    test.deepEqual(a.k, [0, 0, 0], 'default transform origin is (0, 0, 0)');
    test.end();
  });

  test.test('uses necessary defaults for layers', (test: tape.Test) => {
    const {
      layers: [{ip, op, st}],
    } = rawOutput(baseBytecode);

    test.equal(ip, 0, 'in-point is always 0');
    test.equal(st, 0, 'start time is always 0');
    test.equal(op, 60, 'out-point is the same as the entire animation');
    test.end();
  });

  test.test('transforms opacity correctly', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    bytecode.timelines.Default['haiku:svg'].opacity = {0: {value: 0.2}};
    const {layers: [{ks: {o}}]} = rawOutput(bytecode);
    test.equal(o.k, 20, 'denormalizes opacity in [0, 100]');
    test.end();
  });

  test.test('transforms 2.5D rotations correctly', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    bytecode.timelines.Default['haiku:svg']['rotation.x'] = {0: {value: Math.PI / 2}};
    bytecode.timelines.Default['haiku:svg']['rotation.y'] = {0: {value: -Math.PI / 6}};
    bytecode.timelines.Default['haiku:svg']['rotation.z'] = {0: {value: Math.PI / 3}};
    const {layers: [{ks: {rx, ry, rz}}]} = rawOutput(bytecode);
    test.equal(Number(rx.k.toFixed(6)), 90, 'transforms rotation.x from radians to degrees');
    test.equal(Number(ry.k.toFixed(6)), -30, 'transforms rotation.y from radians to degrees');
    test.equal(Number(rz.k.toFixed(6)), 60, 'transforms rotation.z from radians to degrees');
    test.end();
  });

  test.test('transforms scaling correctly', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    bytecode.timelines.Default['haiku:svg']['scale.x'] = {0: {value: 0.5}};
    bytecode.timelines.Default['haiku:svg']['scale.y'] = {0: {value: 0.8}};
    const {layers: [{ks: {s}}]} = rawOutput(bytecode);
    test.deepEqual(s.k, [50, 80], 'denormalizes scale in [0, 100] as an ordered pair (x, y)');
    test.end();
  });

  test.test('animates scale as a compound animation', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    bytecode.timelines.Default['haiku:svg']['scale.x'] = {0: {value: 0.5, curve: 'easeInOutQuad'}, 60: {value: 0.6}};
    bytecode.timelines.Default['haiku:svg']['scale.y'] = {0: {value: 0.8, curve: 'easeOutExpo'}, 60: {value: 0.9}};
    const {layers: [{ks: {s: {a, k : [keyframe]}}}]} = rawOutput(bytecode);

    // The animated property reducer is responsible for both applying the standard transformations to scaling and
    // reducing the presentation of an animation to a sequence of waypoints and bezier curve descriptions in a
    // single package. easeInOutQuad uses interpolation points [.455, .03, .515, .955] to animate from 50% to 60%
    // opacity, and easeOutExpo uses interpolation points [.19, 1, .22, 1] to animate from 80% to 90% opacity. The
    // result of compound-reducing these should be be a curve with out-points x = [.455, .19], y = [.03, 1], etc.
    test.equal(a, 1, 'knows when scale is compound-animated');
    test.deepEqual(keyframe.s, [50, 80], 'starts at the correct compound property');
    test.deepEqual(keyframe.e, [60, 90], 'ends at the correct compound property');
    test.deepEqual(keyframe.o, {x: [.455, .19], y: [.03, 1]}, 'correctly reduces compound interpolation out-points');
    test.deepEqual(keyframe.i, {x: [.515, .22], y: [.955, 1]}, 'correctly reduces compound interpolation in-points');
    test.end();
  });

  test.test('uses the correct transform-origin for layers', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    bytecode.timelines.Default['haiku:svg']['sizeAbsolute.x'] = {0: {value: 100}};
    bytecode.timelines.Default['haiku:svg']['sizeAbsolute.y'] = {0: {value: 200}};
    bytecode.timelines.Default['haiku:svg']['translation.x'] = {0: {value: 10}};
    bytecode.timelines.Default['haiku:svg']['translation.y'] = {0: {value: 20}};
    const {layers: [{ks: {a, p}}]} = rawOutput(bytecode);
    test.deepEqual(a.k, [100 / 2, 200 / 2, 0], 'places the transform-origin at the 2D center of the layer');
    test.equal(p.x.k, 10 + 100 / 2, 'increments translation.x by the x-coordinate of the 2D center');
    test.equal(p.y.k, 20 + 200 / 2, 'increments translation.y by the y-coordinate of the 2D center');
    test.end();
  });

  test.test('generally supports shapes', (test: tape.Test) => {
    const {
      layers: [{
        ty, shapes: [{it: [_, stroke, fill]}],
      }],
    } = rawOutput(baseBytecode);

    test.equal(ty, 4, 'identifies shape layers');

    {
      const {ty, w, c} = stroke;
      test.equal(ty, 'st', 'identifies stroke');
      test.deepEqual(w, {a: 0, k: 10}, 'parses stroke width');
      test.deepEqual(c, {a: 0, k: [1, 0, 0, 1]}, 'parses stroke color');
    }

    {
      const {ty, c} = fill;
      test.equal(ty, 'fl', 'identifies fill');
      test.deepEqual(c, {a: 0, k: [0, 1, 0, 1]}, 'parses fill color');
    }

    test.end();
  });

  test.test('handles non-CSS colors gracefully', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();

    {
      bytecode.timelines.Default['haiku:shape'].stroke = {0: {value: 'none'}};
      const {layers: [{shapes: [{it: [_, stroke]}]}]} = rawOutput(bytecode);
      test.deepEqual(stroke.c.k, [0, 0, 0, 0], '"none" is treated like "transparent"');
    }

    {
      bytecode.timelines.Default['haiku:shape'].stroke = {0: {value: 'tomfoolery'}};
      const {layers: [{shapes: [{it: [_, stroke]}]}]} = rawOutput(bytecode);
      test.deepEqual(stroke.c.k, [0, 0, 0, 0], 'nonsense colors are treated like "transparent"');
    }

    test.end();
  });

  test.test('cascades group properties down to shapes', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();

    // Shim in a group to wrap our shape.
    bytecode.timelines.Default['haiku:group'] = {
      'stroke-width': {0: {value: 5}},
    };
    bytecode.template.children[0].children = [{
      elementName: 'g',
      attributes: {'haiku-id': 'group'},
      children: bytecode.template.children[0].children,
    }];

    {
      const {
        layers: [{
          shapes: [{it: [_, stroke, __]}],
        }],
      } = rawOutput(bytecode);
      test.equal(stroke.w.k, 10, 'child shape properties override parent group properties');
    }

    {
      delete bytecode.timelines.Default['haiku:shape']['stroke-width'];
      const {
        layers: [{
          shapes: [{it: [_, stroke, __]}],
        }],
      } = rawOutput(bytecode);
      test.equal(stroke.w.k, 5, 'parent group properties cascade to child shapes');
    }

    test.end();
  });

  test.test('transcludes defs down to shapes through use', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();

    // Shim in <defs>, and replace our shape element with a <use>.
    bytecode.timelines.Default['haiku:def'] = {
      'stroke-width': {0: {value: 5}},
    };
    overrideShapeElement(bytecode, 'use');
    bytecode.template.children[0].children.unshift({
      elementName: 'defs',
      attributes: {'haiku-id': 'unused'},
      children: [{
        elementName: 'ellipse',
        attributes: {'haiku-id': 'def', id: 'my-circle'},
        children: [],
      }],
    });
    overrideShapeAttributes(
      bytecode, {stroke: {0: {value: '#FF0000'}}, 'stroke-width': {0: {value: 10}}, href: {0: {value: '#my-circle'}}});

    {
      const {
        layers: [{
          shapes: [{it: [shape, stroke]}],
        }],
      } = rawOutput(bytecode);
      test.equal(shape.ty, 'el', 'transcludes the correct vector element');
      test.deepEqual(stroke.w.k, 10, 'attributes from <use> override attributes from <defs>');
    }

    {
      delete bytecode.timelines.Default['haiku:shape']['stroke-width'];
      const {
        layers: [{
          shapes: [{it: [_, stroke]}],
        }],
      } = rawOutput(bytecode);
      test.deepEqual(stroke.w.k, 5, 'attributes from <defs> transclude through to <use>');
    }

    test.end();
  });

  test.test('supports circles', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    overrideShapeAttributes(bytecode, {cx: {0: {value: 5}}, cy: {0: {value: 5}}, r: {0: {value: 10}}});
    overrideShapeElement(bytecode, 'circle');

    const {
      layers: [{
        shapes: [{it: [{ty, p, s}]}],
      }],
    } = rawOutput(bytecode);

    test.equal(ty, 'el', 'translates circles as ellipses');
    test.deepEqual(p, {a: 0, k: [5, 5]}, 'translates ellipse to (cx, cy)');
    test.deepEqual(s, {a: 0, k: [20, 20]}, 'sizes circles at (2r, 2r)');
    test.end();
  });

  test.test('supports ellipses', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    overrideShapeAttributes(bytecode, {rx: {0: {value: 10}}, ry: {0: {value: 20}}});
    overrideShapeElement(bytecode, 'ellipse');

    const {
      layers: [{
        shapes: [{it: [{ty, s}]}],
      }],
    } = rawOutput(bytecode);

    test.equal(ty, 'el', 'translates ellipses');
    test.deepEqual(s, {a: 0, k: [20, 40]}, 'sizes ellipses at (2rx, 2ry)');
    test.end();
  });

  test.test('supports rectangles', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    overrideShapeAttributes(bytecode, {
      x: {0: {value: 10}},
      y: {0: {value: 10}},
      'sizeAbsolute.x': {0: {value: 10}},
      'sizeAbsolute.y': {0: {value: 20}},
      rx: {0: {value: 20}},
    });
    overrideShapeElement(bytecode, 'rect');

    const {
      layers: [{
        shapes: [{it: [{ty, s, r}, transformLayer]}],
      }],
    } = rawOutput(bytecode);

    test.equal(ty, 'rc', 'translates rectangles');
    test.deepEqual(s, {a: 0, k: [10, 20]}, 'sizes rectangles based on absolute size');
    test.deepEqual(r, {a: 0, k: 20}, 'translates border radius');

    test.equal(transformLayer.ty, 'tr', 'creates a translation layer for transposition');
    test.deepEqual(transformLayer.p, {a: 0, k: [15, 20]}, 'translates the rectangle relative to a center origin');
    test.end();
  });

  test.test('supports polygons', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    overrideShapeAttributes(bytecode, {
      points: {0: {value: '1,2 3,4'}},
    });
    overrideShapeElement(bytecode, 'polygon');

    const {
      layers: [{
        shapes: [{it: [{ty, ks: {k: {c, v, i, o}}}]}],
      }],
    } = rawOutput(bytecode);

    test.equal(ty, 'sh', 'translates polygons as shapes');
    test.equal(c, true, 'creates a closed shape');
    test.deepEqual(v, [[1, 2], [3, 4]], 'parses points into vertex chunks for closed shapes');
    test.deepEqual(i, [[0, 0], [0, 0]], 'uses null interpolation in-points');
    test.deepEqual(o, [[0, 0], [0, 0]], 'uses null interpolation in-points');
    test.end();
  });

  test.test('supports paths', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    overrideShapeElement(bytecode, 'path');

    const {
      layers: [{
        shapes: [{it: [{ty}]}],
      }],
    } = rawOutput(bytecode);

    test.equal(ty, 'sh', 'translates paths as shapes');

    // Scope for testing closed shape support.
    {
      overrideShapeAttributes(bytecode, {
        d: {0: {value: 'M0,0 L1,1 L0,0 Z'}},
      });

      const {
        layers: [{
          shapes: [{it: [{ks: {k: {c, v, i, o}}}]}],
        }],
      } = rawOutput(bytecode);
      test.equal(c, true, 'creates a closed shape');
      test.deepEqual(v, [[0, 0], [1, 1]], 'gets coordinates from movetos and line endpoints');
      test.deepEqual(i, [[0, 0], [0, 0]], 'translates lines in relative to vertices');
      test.deepEqual(o, [[0, 0], [0, 0]], 'translates lines out relative to vertices');
    }

    // Scope for testing compound shape support.
    {
      overrideShapeAttributes(bytecode, {
        d: {0: {value: 'M0,0 L1,1 L0,0 Z M2,2 L3,3 L2,2 Z'}},
      });

      const {layers: [{shapes}]} = rawOutput(bytecode);
      test.deepEqual(shapes[0].it[0].ks.k.v, [[0, 0], [1, 1]], 'creates a shape from the first closed segment');
      test.deepEqual(shapes[1].it[0].ks.k.v, [[2, 2], [3, 3]], 'creates additional shapes from other closed segments');
    }

    // Scope for testing cubic bezier support.
    {
      overrideShapeAttributes(bytecode, {
        d: {0: {value: 'M0,0 C1,2 3,4 5,6 L0,0 Z'}},
      });

      const {
        layers: [{
          shapes: [{it: [{ks: {k: {v, i, o}}}]}],
        }],
      } = rawOutput(bytecode);
      test.deepEqual(v, [[0, 0], [5, 6]], 'gets coordinates from bezier curve endpoints');
      test.deepEqual(i, [[0, 0], [-2, -2]], 'translates lines in relative to vertices');
      test.deepEqual(o, [[1, 2], [0, 0]], 'translates lines out relative to vertices');
    }

    test.end();
  });

  test.test('stacks elements in order of descending z-index', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    // Shim in two SVG layers.
    bytecode.template.children = [
      {
        elementName: 'svg',
        attributes: {'haiku-id': 'svg1'},
        children: [],
      },
      {
        elementName: 'svg',
        attributes: {'haiku-id': 'svg2'},
        children: [],
      },
    ];
    bytecode.timelines.Default['haiku:svg1'] = {
      opacity: {0: {value: .5}},
      'style.zIndex': {0: {value: 1}},
    };
    bytecode.timelines.Default['haiku:svg2'] = {
      opacity: {0: {value: 1}},
      'style.zIndex': {0: {value: 2}},
    };

    const {layers} = rawOutput(bytecode);
    test.equal(layers[0].ks.o.k, 100, 'elements with higher z-index come earlier');
    test.equal(layers[1].ks.o.k, 50, 'elements with lower z-index come later');
    test.end();
  });

  test.test('simulates wrapper div with a background color as a rectangle', (test: tape.Test) => {
    const bytecode = baseBytecodeDeepCopy();
    bytecode.timelines.Default['haiku:wrapper'].backgroundColor = {0: {value: '#000'}};
    const {layers: [{ind, ty, shapes: [{it: [shape, fill]}]}]} = rawOutput(bytecode);
    test.equal(ind, 0, 'wrapper rectangle has z-index 0');
    test.equal(ty, 4, 'wrapper rectangle is an ordinary shape layer');
    test.equal(shape.ty, 'rc', 'wrapper rectangle is in fact a rectangle');
    test.deepEqual(shape.s.k, [640, 480], 'wrapper rectangle uses the animation dimensions');
    test.deepEqual(fill.c.k, [0, 0, 0, 1], 'wrapper rectangle is filled with the wrapper backgroundColor');
    test.end();
  });

  test.end();
});