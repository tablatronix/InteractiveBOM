# File Specification

File specification is provided in eBPF form and validated using [BNF Playground](https://bnfplayground.pauliankline.com/).
Generated JSON is validated using [JSON Formatter & Validator](https://jsonformatter.curiousconcept.com/#)
```
    /*************** TOP LEVEL ***************/
    <FILE>             ::= "{" <PCB_DATA> "}"

    <PCB_DATA>         ::= <METADATA> "," <BOARD> "," <PARTS>

    /*************** METADATA SECTION ***************/
    <METADATA>         ::= "\"metadata\":" "{" <PROTOCOL_VERSION> "," <ECAD> "," <COMPANY_NAME> "," <PROJECT_NAME> "," <PROJECT_REVISION> "," <DATE> "," <NUMBER_PARTS> "}"

    <PROTOCOL_VERSION> ::= "\"protocol_version\":" <POSITIVE_REAL_NUMBER>

    <COMPANY_NAME>     ::= "\"revision\"" ":" "\"" <STRING> "\""
    <PROJECT_REVISION> ::= "\"company\""  ":" "\"" <STRING> "\""

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
    <BOARD_SHAPE>   ::= <BOUNDING_BOX>
    <BOARD_TRACES>  ::= "\"traces\":" "[" <PCB_TRACES> "]"
    <BOARD_LAYERS>  ::= "\"layers\":" "[" <PCB_LAYERS> "]"

    <PCB_TRACES> ::= <PCB_TRACE> | <PCB_TRACE> "," <PCB_TRACES>
    <PCB_TRACE>  ::= "{" "\"name\":" "\"" <STRING> "\"" "," "\"segments\":" "[" <SEGMENT> "]" "}"

    <PCB_LAYERS> ::= <PCB_LAYER> | <PCB_LAYER> "," <PCB_LAYERS>
    <PCB_LAYER>  ::= "{" "\"name\":" "\"" <STRING> "\"" "," "\"layerNumber\":" <UNSIGNED_INTEGER> "," "\"paths\":" "[" <PATHS> "]" "}"


    /*************** PARTS SECTION ***************/
    <PARTS> ::= "\"parts\":" "[" <PARTS_ENTRY> "]"

    <PARTS_ENTRY> ::= <PART> | <PART> "," <PARTS_ENTRY>
    <PART>        ::= "{" <PART_NAME> "," <PART_VALUE> "," <PART_PACKAGE> "," <PART_ATTRIBUTE> "," <PART_LOCATION> "}"

    <PART_NAME>            ::= "\"name\":"  "\"" <STRING> "\""
    <PART_VALUE>           ::= "\"value\":" "\"" <STRING> "\""
    <PART_PACKAGE>         ::= "\"package\":" "{" <PACKAGE_PADS> "," <PACKAGE_BOUNDING_BOX> "}"
    <PART_ATTRIBUTE>       ::= "\"attributes\":" "[" <ATTRIBUTES> "]"
    <PART_LOCATION>        ::= "\"location\":" <LOCATION>

    <LOCATION>  ::= "\"F\"" | "\"B\""

    <ATTRIBUTES> ::= <ATTRIBUTE> | <ATTRIBUTE> "," <ATTRIBUTES>
    <ATTRIBUTE>  ::= "{" "\"name\":" "\"" <STRING> "\"" "," "\"value\":" "\"" <STRING> "\"" "}"


    <PACKAGE_PADS>         ::= "\"pads\":" "[" <PADS> "]"
    <PACKAGE_BOUNDING_BOX> ::= <BOUNDING_BOX>


    <PADS> ::= <PAD> | <PAD> "," <PADS>
    <PAD>  ::= "{" "\"pad_type\":" <PAD_TYPE> "," "\"pin1\":" <PAD_PIN_ONE> "," "\"shape\":" <PAD_SHAPE> "," "\"angle\":" <REAL_NUMBER> "," "\"x\":" <REAL_NUMBER> "," "\"y\":" <REAL_NUMBER> "," "\"dx\":" <REAL_NUMBER> "," "\"dy\":" <REAL_NUMBER> "}"

    <PAD_TYPE>    ::= "\"smd\""  | "\"tht\""
    <PAD_PIN_ONE> ::= "\"yes\""  | "\"no\""
    <PAD_SHAPE>   ::= "\"rect\"" | "\"octagon\"" | "\"oblong\"" | "\"circle\""

    /*************** COMMON RULES ***************/

    <SEGMENT>          ::= <PATHS> | <POLYGONS> | <VIAS>

    <PATHS>            ::= <PATH>    | <PATH>    "," <PATHS>
    <POLYGONS>         ::= <POLYGON> | <POLYGON> "," <POLYGONS>
    <VIAS>             ::= <VIA>     | <VIA>     "," <VIAS>

    <PATH>             ::= <LINE> | <ARC>
    <LINE>             ::= "{" "\"type\"" ":" "\"line\"" "," "\"layer\":" <UNSIGNED_INTEGER> "," "\"x0\"" ":" <REAL_NUMBER> "," "\"y0\"" ":" <REAL_NUMBER> "," "\"x1\"" ":" <REAL_NUMBER> "," "\"y1\"" ":" <REAL_NUMBER> "," "\"width\"" ":" <REAL_NUMBER> "}"
    <ARC>              ::= "{" "\"type\"" ":" "\"arc\"" "," "\"layer\":" <UNSIGNED_INTEGER> "," "\"cx0\"" ":" <REAL_NUMBER> "," "\"cy0\"" ":" <REAL_NUMBER> "," "\"radius\"" ":" <REAL_NUMBER> "," "\"angle0\"" ":" <REAL_NUMBER> "," "\"angle1\"" ":" <REAL_NUMBER> "," "\"width\"" ":" <REAL_NUMBER> "," "\"direction\"" ":" <ARC_DIRECTION> "}"
    <POLYGON>          ::= "{" "\"type\"" ":" "\"polygon\"" "," "\"layer\":" <UNSIGNED_INTEGER> "," "\"positive\"" ":" <POLYGON_DIRECTION> "," "\"segments\"" ":" "[" <PATHS> "]" "}"
    <VIA>              ::= <VIA_ROUND> | <VIA_SQUARE> | <VIA_OCTAGON>


    <ARC_DIRECTION>     ::= "\"clockwise\"" | "\"counterclockwise\""
    <POLYGON_DIRECTION> ::= "1" | "0"

    <VIA_ROUND>    ::= "{" "\"type\"" ":" "\"via_round\""   "," \"layer\":" <UNSIGNED_INTEGER> "," "\"x\"" ":" <REAL_NUMBER> "," "\"y\"" ":" <REAL_NUMBER> "," "\"diameter\"" ":" <REAL_NUMBER> "," "\"drill\"" ":" <REAL_NUMBER> "}"
    <VIA_SQUARE>   ::= "{" "\"type\"" ":" "\"via_square\""  "," \"layer\":" <UNSIGNED_INTEGER> "," "\"x\"" ":" <REAL_NUMBER> "," "\"y\"" ":" <REAL_NUMBER> "," "\"diameter\"" ":" <REAL_NUMBER> "," "\"drill\"" ":" <REAL_NUMBER> "}"
    <VIA_OCTAGON>  ::= "{" "\"type\"" ":" "\"via_octagon\"" "," \"layer\":" <UNSIGNED_INTEGER> "," "\"x\"" ":" <REAL_NUMBER> "," "\"y\"" ":" <REAL_NUMBER> "," "\"diameter\"" ":" <REAL_NUMBER> "," "\"drill\"" ":" <REAL_NUMBER> "}"



    <BOUNDING_BOX> ::= "\"bounding_box\":" "{" <X0> "," <Y0> "," <X1> "," <Y1> "}"
    <X0>           ::= "\"x0\":" <REAL_NUMBER>
    <Y0>           ::= "\"y0\":" <REAL_NUMBER>
    <X1>           ::= "\"x1\":" <REAL_NUMBER>
    <Y1>           ::= "\"y1\":" <REAL_NUMBER>

    <UNSIGNED_INTEGER>     ::=        ("0" | [1-9] [0-9]*)
    <SIGNED_INTEGER>       ::= ("-")? ("0" | [1-9] [0-9]*)

    <REAL_NUMBER>          ::= <POSITIVE_REAL_NUMBER> | <NEGATIVE_REAL_NUMBER>
    <POSITIVE_REAL_NUMBER> ::=     ("0" |  [1-9] [0-9]*) ("." [0-9]+ )?
    <NEGATIVE_REAL_NUMBER> ::= "-" ([1-9] [0-9]*) ("." [0-9]+ )? | "-" ("0" "." [0-9]+) 


    <STRING>      ::= ([a-z] | [A-Z]) ([a-z] | [A-Z] | [0-9] | "-" | "_" | "$")*
    <DATE_STRING> ::= ([a-z] | [A-Z] | [0-9] | "-" | "_" | ":" | " ")*
```