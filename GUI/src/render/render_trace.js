var render_lowlevel     = require('./render_lowlevel.js')
var Point               = require('./point.js').Point

// Line width is not included as part of the trace as it will depend on the current gui scale factor.
function Arc(guiContext, trace, lineWidth, color)
{

    let centerPoint = new Point(trace.cx0, trace.cy0);


    let renderOptions = { color: color,
                          fill: false,
                          lineWidth: lineWidth,
                          lineCap: "round" 
                        }

    render_lowlevel.Arc( guiContext,
                         centerPoint,
                         trace.radius,
                         trace.angle0,
                         trace.angle1,
                         renderOptions
                       );
}

function Line(guiContext, trace, lineWidth, color)
{
    let startPoint = new Point(trace.x0, trace.y0);
    let endPoint   = new Point(trace.x1, trace.y1);

    let renderOptions = { color: color,
                          fill: false,
                          lineWidth: lineWidth,
                          lineCap: "round" 
                        }

    render_lowlevel.Line( guiContext,
                          startPoint,
                          endPoint,
                          renderOptions
                       );
}

function Polygon(guiContext, segments, lineWidth, color)
{
    vertices = [];
    for (let i of segments)
    {
        let point1 = new Point(i.x0, i.y0);
        vertices.push(point1);
    }
    let renderOptions = { color: color,
        fill: true,
    }

    render_lowlevel.IrregularPolygon( guiContext,
                                        vertices,
                                        renderOptions
                                      );

}



module.exports = {
  Arc, Line, Polygon
}
