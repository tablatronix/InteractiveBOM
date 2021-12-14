This document defines the data interchange format between a electronic CAD program and this BOM tool. 

The following is a high level description of the file format.

```
PCB_DATA ::= <METEDATA> <BOARD> <PARTS>

METEDATA   ::= <PROTOCOL_VERSION> <ECAD> <PROJECT_NAME> <GENERATED_DATE> <NUMBER_PARTS>

BOARD    ::= <PCB_SHAPE> <LAYERS> 

LAYERS ::= <LAYER> | <LAYER> <LAYERS>

LAYER ::= <LAYER_NAME> <TRACES> <POURS>

POURS ::= <POUR> | <POUR> <POURS>

POUR ::= <PATHS>
PCB_SHAPE ::= <BOUNDING_BOX> <EDGES>
BOUNDING_BOX ::= <MAX_X> <MAX_Y> <MIN_X> <MIN_Y>
 
EDGES ::= <PATHS>

PARTS    ::= <PART> | <PART> <PARTS>

PART     ::= <PART_NAME> <PART_VALUE> <PACKAGE> <ATTRIBUTES> <LOCATION> 

PACKAGE :: <PADS> <BOUNDING_BOX> 

TRACES   ::= <TRACE> | <TRACE> <TRACES>

PROTOCOL_VERSION ::= "1.0"
ECAD             ::= "eagle"
PROJECT_NAME     ::= XXX <- USER specified
GENERATED_DATE   ::= XXX <- User specified
NUMBER_PARTS     ::= <NUM_PARTS_TOP> <NUM_PARTS_BOTTOM>

NUM_PARTS_TOP     ::= # parts top of board
NUM_PARTS_BOTTOM  ::= # parts bottom of board

PATHS ::= <PATH> | <PATH>, <PATHS>
PATH  ::=  <LINE> | <ARC> | <BEZIER> | <QUADRATIC_BEZIER> | <POLYGON> | <VIA>
LINE  ::= (<POINT>, <POINT>,<WIDTH>)
ARC   ::= (<POINT>,<RADIUS>,<START_ANGLE>,<END_ANGLE>, <ARC_DIRECTION>,<WIDTH>) <- POINT is center point
BEZIER ::= (<POINT>,<POINT>,<POINT>,<WIDTH>)  <- points are (start, end, control)
QUADRATIC_BEZIER ::= (<POINT>,<POINT>,<POINT>,<POINT>,<WIDTH>) <- points are (start, end, control1, control2)
POLYGON ::= <POINT> <POINT> | <POINT> <POINT> <POINTS> 
VIA     ::= <POINT> <RADIUS> <- point is the center point

POINTS ::= <POINT> | <POINT> <POINTS>
LOCATION ::= F | B  <- F=Front, B=Back


MAX_X ::= #
MAX_Y ::= #
MIN_X ::= #
MIN_Y ::= #


POINT         ::= (x,y)
RADIUS        ::= #
START_ANGLE   ::= # <- in radians
END_ANGLE     ::= # <- in radians
ARC_DIRECTION ::= clockwise | counterclockwise
WIDTH         ::= # <- How wide the line should be drawn

BOUNDING_BOX ::= <PATHS>

LAYER_NAME ::= STRING 
PART_NAME  ::= STRING <- hold part reference name
PART_VALUE ::= STRING <- hold part value if assigned
ATTRIBUTES ::= <ATTRIBUTE> | <ATTRIBUTE> <ATTRIBUTES>

PADS       ::= <PAD> | <PAD> <PADS>
TRACE      ::= <SEGMENTS>
<SEGMENTS> ::= <SEGMENT> | <SEGMENT> <SEGMENTS>
<SEGMENT>  ::= <LAYER_NAME> <PATH>
PAD        ::= <PIN1> <PAD_TYPE> <SHAPE>
PIN1       ::= "YES" | "NO"

SHAPE ::= <TYPE> <XXX>   <- XXX is polymorphic depending in what shape is. How to define in EBNF?

TYPE ::= rect | oval | circle | roundrect | oblong

PAD_TYPE   := SMD | THT  <- SMD = surface mount, THT = Through hole
ATTRIBUTE  ::= (<KEY>,<VALUE>)

```

## File Specification

File specification is provided in eBPF form and validated using [BNF Playground](https://bnfplayground.pauliankline.com/).

```
/* TOP LEVEL */
<FILE>             ::= "{" <PCB_DATA> "}"
<PCB_DATA>         ::= <METADATA> "," <BOARD> "," <PARTS>

/*************** METADATA SECTION ***************/
<METADATA>         ::= "\"metadata\":" "{" <PROTOCOL_VERSION> "," <ECAD> "," <PROJECT_NAME> "," <DATE> "," <NUMBER_PARTS> "}"

<PROTOCOL_VERSION> ::= "\"protocol_version\":" <UNSIGNED_INTEGER>

<ECAD>             ::= "\"ecad\":" <ECAD_PROGRAM>
<ECAD_PROGRAM>     ::= <EAGLE_CAD>
<EAGLE_CAD>        ::= "\"EAGLE\"" | "\"eagle\"" | "\"Eagle\""

<PROJECT_NAME>     ::= "\"project_name\"" ":" "\"" <STRING>  "\""

<DATE>             ::= "\"date\":" "\"" <DATE_STRING> "\""

<NUMBER_PARTS>     ::= "\"number_parts\":" "{" <PARTS_TOP> "," <PARTS_BOTTOM> "}"
<PARTS_TOP>        ::= "\"top\":" <UNSIGNED_INTEGER>
<PARTS_BOTTOM>     ::= "\"bottom\":" <UNSIGNED_INTEGER>


/*************** BOARD SECTION ***************/
<BOARD>         ::= "\"board\":" "{" <BOARD_SHAPE> "," <BOARD_TRACES>  "," <BOARD_LAYERS> "}"
<BOARD_SHAPE>   ::= <PCB_SHAPE>
<BOARD_TRACES>  ::= "\"traces\":" "[" <PCB_TRACES> "]"
<BOARD_LAYERS>  ::= "\"layers\":" "[" <PCB_LAYERS> "]"


<PCB_SHAPE> ::= "\"pcb_shape\":" "{" <BOUNDING_BOX> "," <EDGES> "}"
<EDGES>     ::= "\"edges\":" "[" <PATHS> "]"

<PCB_TRACES> ::= <PCB_TRACE> | <PCB_TRACE> "," <PCB_TRACES>
<PCB_TRACE>  ::= "{" "\"name\":" "\"" <STRING> "\"" "," "\"segments\":" "[" <SEGMENT> "]" "}"

<PCB_LAYERS> ::= <PCB_LAYER> | <PCB_LAYER> "," <PCB_LAYERS>
<PCB_LAYER>  ::= "{" "\"name\":" "\"" <STRING> "\"" "," "\"layerNumber\":" <UNSIGNED_INTEGER> "," "\"paths\":" "[" <PATHS> "]" "}"


/*************** PARTS SECTION ***************/
<PARTS> ::= "\"parts\":" "[" "]"





/*************** COMMON RULES ***************/

<SEGMENT>          ::= <PATHS> | <POLYGONS> | <VIAS>

<PATHS>            ::= <PATH>    | <PATH>    "," <PATHS>
<POLYGONS>         ::= <POLYGON> | <POLYGON> "," <POLYGONS>
<VIAS>             ::= <VIA>     | <VIA>     "," <VIAS>

<PATH>             ::= <LINE> | <ARC>
<LINE>             ::= "{" "\"type\"" ":" "\"line\"" "," "\"x0\"" ":" <REAL_NUMBER> "," "\"y0\"" ":" <REAL_NUMBER> "," "\"x1\"" ":" <REAL_NUMBER> "," "\"y1\"" ":" <REAL_NUMBER> "," "\"width\"" ":" <REAL_NUMBER> "}"
<ARC>              ::= "{" "\"type\"" ":" "\"arc\"" "," "\"cx0\"" ":" <REAL_NUMBER> "," "\"cy0\"" ":" <REAL_NUMBER> "," "\"radius\"" ":" <REAL_NUMBER> "," "\"angle0\"" ":" <REAL_NUMBER> "," "\"angle1\"" ":" <REAL_NUMBER> "," "\"width\"" ":" <REAL_NUMBER> "," "\"direction\"" ":" <ARC_DIRECTION> "}"
<POLYGON>          ::= "{" "\"type\"" ":" "\"polygon\"" "," "\"positive\"" ":" <POLYGON_DIRECTION> "," "\"segments\"" ":" "[" <PATHS> "]" "}"
<VIA>              ::= <VIA_ROUND> | <VIA_SQUARE> | <VIA_OCTOGON>


<ARC_DIRECTION>     ::= "\"clockwise\"" | "\"counterclockwise\""
<POLYGON_DIRECTION> ::= "1" | "0"

<VIA_ROUND>    ::= "{" "\"type\"" ":" "\"via_round\""   "," "\"x\"" ":" <REAL_NUMBER> "," "\"y\"" ":" <REAL_NUMBER> "," "\"diameter\"" ":" <REAL_NUMBER> "," "\"drill\"" ":" <REAL_NUMBER> "}"
<VIA_SQUARE>   ::= "{" "\"type\"" ":" "\"via_square\""  "," "\"x\"" ":" <REAL_NUMBER> "," "\"y\"" ":" <REAL_NUMBER> "," "\"diameter\"" ":" <REAL_NUMBER> "," "\"drill\"" ":" <REAL_NUMBER> "}"
<VIA_OCTOGON>  ::= "{" "\"type\"" ":" "\"via_octagon\"" "," "\"x\"" ":" <REAL_NUMBER> "," "\"y\"" ":" <REAL_NUMBER> "," "\"diameter\"" ":" <REAL_NUMBER> "," "\"drill\"" ":" <REAL_NUMBER> "}"



<BOUNDING_BOX> ::= "\"bounding_box\":" "{" <X0> "," <Y0> "," <X1> "," <Y1> "}"
<X0>           ::= "\"x0\":" <REAL_NUMBER>
<Y0>           ::= "\"y0\":" <REAL_NUMBER>
<X1>           ::= "\"x1\":" <REAL_NUMBER>
<Y1>           ::= "\"y1\":" <REAL_NUMBER>

<UNSIGNED_INTEGER>     ::=        ("0" | [1-9] [0-9]*)
<SIGNED_INTEGER>       ::= ("-")? ("0" | [1-9] [0-9]*)

<REAL_NUMBER>          ::= <POSITIVE_REAL_NUMBER> | <NEGATIVE_REAL_NUMBER>
<POSITIVE_REAL_NUMBER> ::=     ("0" |  [1-9] [0-9]*) ("." [0-9]+ )?
<NEGATIVE_REAL_NUMBER> ::= "-" (       [1-9] [0-9]*) ("." [0-9]+ )?


<STRING>      ::= ([a-z] | [A-Z]) ([a-z] | [A-Z] | [0-9] | "-" | "_")*
<DATE_STRING> ::= ([a-z] | [A-Z] | [0-9] | "-" | "_" | ":" | " ")*
```